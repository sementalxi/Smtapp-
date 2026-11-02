const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { brandColor } = require('./embeds');

let kickNotifier = async () => {};
function setKickNotifier(fn) { kickNotifier = fn; }
const spamHistory = new Map();
const spamProcessing = new Set();

function splitWords(store) { const words = store.data.settings.autoModWords; return String(words ?? process.env.AUTO_MOD_WORDS ?? '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean); }
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

    const reason = `KIXO Cross-Channel Spam Guard: similar message posted in ${distinctChannels.size} channels within ${cfg.windowSeconds}s`;
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
      .setColor(actionError ? '#F59E0B' : '#FF2D8B')
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
  const badWord = splitWords(store).find(w => w && text.includes(w));
  const invite = (store.data.settings.blockInvites ?? (String(process.env.BLOCK_INVITES || 'false') === 'true')) && /(discord\.gg\/|discord\.com\/invite\/)/i.test(text);
  if (!badWord && !invite) return false;
  await message.delete().catch(() => {});
  await message.channel.send({ content: `<@${message.author.id}> your message was removed by KIXO Auto-Moderation.`, allowedMentions: { users: [message.author.id] } }).then(m => setTimeout(() => m.delete().catch(()=>{}), 7000)).catch(() => {});
  const embed = new EmbedBuilder().setColor(brandColor()).setTitle('🛡️ Auto-Moderation').addFields(
    { name: 'User', value: `<@${message.author.id}>`, inline: true },
    { name: 'Channel', value: `<#${message.channel.id}>`, inline: true },
    { name: 'Reason', value: invite ? 'Blocked Discord invite' : `Blocked word: ${badWord}` }
  ).setTimestamp();
  await logAction(message.guild, store, embed);
  return true;
}

function accountAgeSettings(store) {
  const s = store.data.settings || {};
  return {
    enabled: s.accountAgeGuardEnabled === true,
    days: clampNumber(s.accountAgeGuardDays, 7, 1, 3650)
  };
}

async function checkAccountAge(member, store) {
  if (!member || member.user?.bot) return { checked: false, kicked: false };
  const cfg = accountAgeSettings(store);
  if (!cfg.enabled) return { checked: false, kicked: false };
  const ageMs = Date.now() - Number(member.user.createdTimestamp || 0);
  const minMs = cfg.days * 86400000;
  if (!member.user.createdTimestamp || ageMs >= minMs) return { checked: true, kicked: false };
  const ageDays = Math.max(0, Math.floor(ageMs / 86400000));
  const reason = `KIXO Account Age Guard: Discord account is ${ageDays} day(s) old; minimum is ${cfg.days} day(s).`;
  await member.send(`Your Discord account must be at least **${cfg.days} day(s) old** to join **${member.guild.name}**. Your account is currently about **${ageDays} day(s) old**.`).catch(()=>{});
  let error='';
  try {
    if (!member.kickable) throw new Error('Member is not kickable. Check Kick Members permission and role hierarchy.');
    await member.kick(reason);
    await kickNotifier(member.guild, member.user, reason, 'Account Age Guard');
  } catch (e) { error=e?.message || String(e); }
  const embed = new EmbedBuilder()
    .setColor(error ? '#F59E0B' : '#FF2D8B')
    .setTitle(error ? '⚠️ Account Age Guard Could Not Kick' : '🛡️ Account Age Guard • Auto Kick')
    .addFields(
      { name: 'Member', value: `${member.user.tag} (${member.id})` },
      { name: 'Account age', value: `${ageDays} day(s)`, inline: true },
      { name: 'Required', value: `${cfg.days} day(s)`, inline: true }
    )
    .setTimestamp();
  if (error) embed.addFields({ name: 'Error', value: error.slice(0,1000) });
  await logAction(member.guild, store, embed);
  return { checked: true, kicked: !error, error };
}

function verificationDeadlineSettings(store) {
  const s = store.data.settings || {};
  return { enabled: s.verifyDeadlineEnabled !== false, days: clampNumber(s.verifyDeadlineDays, 3, 1, 365), roleId: s.verifiedRoleId || '' };
}

let verificationSweepActive = false;
async function sweepVerificationDeadline(guild, store) {
  const cfg = verificationDeadlineSettings(store);
  if (!cfg.enabled || !cfg.roleId || verificationSweepActive) return { skipped: true };
  // Never kick anyone if the configured role no longer exists.
  const role = await guild.roles.fetch(cfg.roleId).catch(() => null);
  if (!role) { console.warn('Verification deadline: verified role missing; no members kicked.'); return { skipped: true }; }
  const me = guild.members.me || await guild.members.fetchMe().catch(() => null);
  if (!me?.permissions.has(PermissionFlagsBits.KickMembers)) { console.warn('Verification deadline: missing Kick Members permission.'); return { skipped: true }; }
  verificationSweepActive = true;
  const result = { checked: 0, kicked: 0, failed: 0 };
  try {
    const members = await guild.members.fetch();
    const cutoff = Date.now() - cfg.days * 86400000;
    for (const member of members.values()) {
      if (member.user.bot || !member.joinedTimestamp || member.joinedTimestamp > cutoff || member.roles.cache.has(cfg.roleId)) continue;
      // Recheck the role immediately before kicking to avoid racing successful verification.
      const latest = await guild.members.fetch({ user: member.id, force: true }).catch(() => null);
      if (!latest || latest.roles.cache.has(cfg.roleId) || !latest.joinedTimestamp || latest.joinedTimestamp > Date.now() - cfg.days * 86400000) continue;
      result.checked++;
      if (!latest.kickable) { result.failed++; continue; }
      const reason = `KIXO Verification Deadline: not verified within ${cfg.days} day(s) after joining.`;
      await latest.send(`You were removed from **${guild.name}** because you did not obtain the verified role within **${cfg.days} day(s)** after joining. You can rejoin and verify to gain access.`).catch(() => {});
      try {
        await latest.kick(reason);
        await kickNotifier(guild, latest.user, reason, 'Verification Deadline');
        result.kicked++;
        await logAction(guild, store, new EmbedBuilder().setColor('#FF2D8B').setTitle('🛡️ Verification Deadline • Auto Kick').addFields({name:'Member',value:`${latest.user.tag} (${latest.id})`},{name:'Deadline',value:`${cfg.days} day(s) after joining`}).setTimestamp());
      } catch (e) { result.failed++; console.error('Verification deadline kick failed:', latest.id, e.message); }
    }
  } finally { verificationSweepActive = false; }
  return result;
}

function addWarning(userId, moderatorId, reason, store) {
  const arr = store.data.warnings[userId] || [];
  arr.push({ id: Date.now().toString(36), moderatorId, reason, at: new Date().toISOString() });
  store.data.warnings[userId] = arr.slice(-25);
  store.save();
  return arr.length;
}

module.exports = { autoModerate, checkCrossChannelSpam, checkAccountAge, accountAgeSettings, verificationDeadlineSettings, sweepVerificationDeadline, addWarning, logAction, spamSettings, setKickNotifier };
