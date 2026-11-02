const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { brandColor } = require('./embeds');

const spamHistory = new Map();
const spamProcessing = new Set();

function splitWords() { return String(process.env.AUTO_MOD_WORDS || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean); }
function clampNumber(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}
function spamSettings(store) {
  const s = store.data.settings || {};
  const action = ['ban', 'timeout', 'delete'].includes(String(s.spamGuardAction || '').toLowerCase()) ? String(s.spamGuardAction).toLowerCase() : 'ban';
  return {
    enabled: s.spamGuardEnabled !== false,
    minChannels: clampNumber(s.spamGuardMinChannels, 3, 2, 10),
    windowSeconds: clampNumber(s.spamGuardWindowSeconds, 20, 5, 120),
    action,
    timeoutMinutes: clampNumber(s.spamGuardTimeoutMinutes, 1440, 1, 40320),
    minLength: clampNumber(s.spamGuardMinLength, 12, 4, 100),
    ignoredChannelIds: Array.isArray(s.spamGuardIgnoredChannelIds) ? s.spamGuardIgnoredChannelIds : [],
    ignoredRoleIds: Array.isArray(s.spamGuardIgnoredRoleIds) ? s.spamGuardIgnoredRoleIds : []
  };
}
function normalizeSpamText(value = '') {
  return String(value)
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .toLowerCase()
    .replace(/<@!?\d+>/g, '@user')
    .replace(/<@&\d+>/g, '@role')
    .replace(/<#\d+>/g, '#channel')
    .replace(/\s+/g, ' ')
    .trim();
}
function getUrls(text = '') {
  return [...String(text).matchAll(/https?:\/\/[^\s<>]+/gi)].map(m => m[0].toLowerCase().replace(/[),.;!?]+$/g, ''));
}
function signatureFor(message, minLength) {
  const text = normalizeSpamText(message.content || '');
  const urls = getUrls(text);
  const attachments = [...message.attachments.values()]
    .map(a => `${String(a.name || 'file').toLowerCase()}:${Number(a.size || 0)}`)
    .sort();
  if (text.length < minLength && urls.length === 0 && attachments.length === 0) return null;
  return { text, urls, attachments, combined: `${text}\n${attachments.join('|')}` };
}
function tokenSet(text) {
  return new Set(String(text).match(/[a-z0-9_]{2,}/gi) || []);
}
function similarText(a, b) {
  if (!a || !b) return false;
  if (a.combined === b.combined) return true;
  if (a.attachments.length && b.attachments.length && a.attachments.join('|') === b.attachments.join('|')) {
    if (!a.text || !b.text || a.text === b.text) return true;
  }
  if (a.urls.length && b.urls.length && a.urls.some(u => b.urls.includes(u))) return true;
  if (Math.min(a.text.length, b.text.length) < 20) return false;
  const lenRatio = Math.min(a.text.length, b.text.length) / Math.max(a.text.length, b.text.length);
  if (lenRatio < 0.72) return false;
  const aa = tokenSet(a.text), bb = tokenSet(b.text);
  if (!aa.size || !bb.size) return false;
  let intersection = 0;
  for (const token of aa) if (bb.has(token)) intersection++;
  const union = new Set([...aa, ...bb]).size;
  return union > 0 && intersection / union >= 0.82;
}

async function logAction(guild, store, embed) {
  const id = store.data.settings.logChannelId;
  if (!id) return;
  const ch = await guild.channels.fetch(id).catch(() => null);
  if (ch?.isTextBased()) await ch.send({ embeds: [embed] }).catch(() => {});
}

async function checkCrossChannelSpam(message, store) {
  if (!message.guild || !message.member || message.author.bot) return false;
  const cfg = spamSettings(store);
  if (!cfg.enabled) return false;
  if (message.member.permissions.has(PermissionFlagsBits.ManageMessages) || message.member.permissions.has(PermissionFlagsBits.ManageGuild)) return false;
  if (cfg.ignoredChannelIds.includes(message.channel.id)) return false;
  if (cfg.ignoredRoleIds.some(id => message.member.roles.cache.has(id))) return false;

  const sig = signatureFor(message, cfg.minLength);
  if (!sig) return false;

  const now = Date.now();
  const windowMs = cfg.windowSeconds * 1000;
  const userId = message.author.id;
  const history = (spamHistory.get(userId) || []).filter(x => now - x.at <= windowMs);
  history.push({ at: now, channelId: message.channel.id, messageId: message.id, message, sig });
  spamHistory.set(userId, history.slice(-40));

  const matching = history.filter(x => similarText(x.sig, sig));
  const distinctChannels = new Set(matching.map(x => x.channelId));
  if (distinctChannels.size < cfg.minChannels) return false;

  if (spamProcessing.has(userId)) {
    await message.delete().catch(() => {});
    return true;
  }
  spamProcessing.add(userId);
  spamHistory.delete(userId);

  try {
    let deleted = 0;
    const uniqueMessages = new Map(matching.map(x => [x.messageId, x.message]));
    for (const msg of uniqueMessages.values()) {
      if (await msg.delete().then(() => true).catch(() => false)) deleted++;
    }

    const reason = `SEMENTAL Cross-Channel Spam Guard: similar message posted in ${distinctChannels.size} channels within ${cfg.windowSeconds}s`;
    let actionResult = cfg.action;
    let actionError = '';

    try {
      if (cfg.action === 'ban') {
        if (!message.member.bannable) throw new Error('Member is not bannable. Check Ban Members permission and role hierarchy.');
        await message.member.ban({ deleteMessageSeconds: Math.min(604800, Math.max(1, cfg.windowSeconds + 10)), reason });
      } else if (cfg.action === 'timeout') {
        if (!message.member.moderatable) throw new Error('Member is not moderatable. Check Moderate Members permission and role hierarchy.');
        await message.member.timeout(cfg.timeoutMinutes * 60000, reason);
      }
    } catch (err) {
      actionError = err?.message || String(err);
      actionResult = `${cfg.action} failed`;
    }

    const sample = (sig.text || (sig.attachments.length ? '[attachment spam]' : '[no text]')).slice(0, 900);
    const embed = new EmbedBuilder()
      .setColor(actionError ? '#F59E0B' : '#D90429')
      .setTitle(actionError ? '⚠️ Cross-Channel Spam Detected' : '🚨 Cross-Channel Spam Auto-Action')
      .addFields(
        { name: 'User', value: `<@${userId}> • ${message.author.tag}`, inline: true },
        { name: 'Channels', value: String(distinctChannels.size), inline: true },
        { name: 'Window', value: `${cfg.windowSeconds} seconds`, inline: true },
        { name: 'Action', value: actionResult.toUpperCase(), inline: true },
        { name: 'Messages deleted', value: String(deleted), inline: true },
        { name: 'Detection', value: 'Same / highly similar message repeated across multiple channels', inline: false },
        { name: 'Sample', value: sample || '[attachment/link spam]' }
      )
      .setTimestamp();
    if (actionError) embed.addFields({ name: 'Action Error', value: actionError.slice(0, 1000) });
    await logAction(message.guild, store, embed);
    return true;
  } finally {
    spamProcessing.delete(userId);
  }
}

async function autoModerate(message, store) {
  if (message.author.bot || !message.member) return false;
  if (await checkCrossChannelSpam(message, store)) return true;
  if (!store.data.settings.features.moderation) return false;
  if (message.member.permissions.has(PermissionFlagsBits.ManageMessages)) return false;
  const text = message.content.toLowerCase();
  const badWord = splitWords().find(w => w && text.includes(w));
  const invite = String(process.env.BLOCK_INVITES || 'false') === 'true' && /(discord\.gg\/|discord\.com\/invite\/)/i.test(text);
  if (!badWord && !invite) return false;
  await message.delete().catch(() => {});
  await message.channel.send({ content: `<@${message.author.id}> your message was removed by SEMENTAL Auto-Moderation.`, allowedMentions: { users: [message.author.id] } }).then(m => setTimeout(() => m.delete().catch(()=>{}), 7000)).catch(() => {});
  const embed = new EmbedBuilder().setColor(brandColor()).setTitle('🛡️ Auto-Moderation').addFields(
    { name: 'User', value: `<@${message.author.id}>`, inline: true },
    { name: 'Channel', value: `<#${message.channel.id}>`, inline: true },
    { name: 'Reason', value: invite ? 'Blocked Discord invite' : `Blocked word: ${badWord}` }
  ).setTimestamp();
  await logAction(message.guild, store, embed);
  return true;
}

function addWarning(userId, moderatorId, reason, store) {
  const arr = store.data.warnings[userId] || [];
  arr.push({ id: Date.now().toString(36), moderatorId, reason, at: new Date().toISOString() });
  store.data.warnings[userId] = arr.slice(-25);
  store.save();
  return arr.length;
}

module.exports = { autoModerate, checkCrossChannelSpam, addWarning, logAction, spamSettings };
