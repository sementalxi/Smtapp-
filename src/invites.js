const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { brandColor } = require('./embeds');

const inviteCache = new Map();
const vanityCache = new Map();
const joinQueues = new Map();

function ensureInviteData(store) {
  if (!store.data.inviteTracking || typeof store.data.inviteTracking !== 'object') {
    store.data.inviteTracking = { stats: {}, members: {} };
  }
  if (!store.data.inviteTracking.stats || typeof store.data.inviteTracking.stats !== 'object') store.data.inviteTracking.stats = {};
  if (!store.data.inviteTracking.members || typeof store.data.inviteTracking.members !== 'object') store.data.inviteTracking.members = {};
  return store.data.inviteTracking;
}

function getSettings(store) {
  return {
    enabled: store.data.settings.inviteTrackingEnabled !== false,
    channelId: String(store.data.settings.inviteLogChannelId || '')
  };
}

function activeInvites(row) {
  return Math.max(0, Number(row?.joins || 0) - Number(row?.leaves || 0));
}

function inviteMapFromCollection(collection) {
  const map = new Map();
  for (const invite of collection?.values?.() || []) {
    map.set(invite.code, {
      code: invite.code,
      uses: Number(invite.uses || 0),
      inviterId: invite.inviter?.id || null,
      createdTimestamp: invite.createdTimestamp || null,
      maxUses: Number(invite.maxUses || 0),
      temporary: Boolean(invite.temporary)
    });
  }
  return map;
}

async function fetchVanityUses(guild) {
  try {
    if (!guild?.vanityURLCode && !guild?.features?.includes?.('VANITY_URL')) return null;
    const data = await guild.fetchVanityData();
    return Number(data?.uses || 0);
  } catch {
    return null;
  }
}

async function primeInviteCache(guild) {
  const invites = await guild.invites.fetch();
  inviteCache.set(guild.id, inviteMapFromCollection(invites));
  const vanityUses = await fetchVanityUses(guild);
  if (vanityUses !== null) vanityCache.set(guild.id, vanityUses);
  return { invites: invites.size, vanityUses };
}

function updateInviteCache(invite) {
  if (!invite?.guild?.id || !invite.code) return;
  let map = inviteCache.get(invite.guild.id);
  if (!map) {
    map = new Map();
    inviteCache.set(invite.guild.id, map);
  }
  map.set(invite.code, {
    code: invite.code,
    uses: Number(invite.uses || 0),
    inviterId: invite.inviter?.id || null,
    createdTimestamp: invite.createdTimestamp || null,
    maxUses: Number(invite.maxUses || 0),
    temporary: Boolean(invite.temporary)
  });
}

function removeInviteCache(invite) {
  if (!invite?.guild?.id || !invite.code) return;
  inviteCache.get(invite.guild.id)?.delete(invite.code);
}

function detectUsedInvite(before, after) {
  let best = null;
  let bestDelta = 0;
  for (const [code, now] of after.entries()) {
    const oldUses = Number(before?.get(code)?.uses || 0);
    const delta = Number(now.uses || 0) - oldUses;
    if (delta > bestDelta) {
      bestDelta = delta;
      best = now;
    }
  }
  return best;
}

async function sendInviteLog(guild, store, payload) {
  const { enabled, channelId } = getSettings(store);
  if (!enabled || !channelId) return false;
  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased?.()) return false;
  await channel.send(payload).catch(err => {
    console.error('Invite log send failed:', err.message);
  });
  return true;
}

async function trackJoinNow(member, store) {
  if (!member?.guild || member.user?.bot) return null;
  const guild = member.guild;
  ensureInviteData(store);

  const before = inviteCache.get(guild.id) || new Map();
  let after = new Map();
  let inviteFetchError = null;
  try {
    const fetched = await guild.invites.fetch();
    after = inviteMapFromCollection(fetched);
    inviteCache.set(guild.id, after);
  } catch (err) {
    inviteFetchError = err;
    console.error('Invite fetch on member join failed:', err.message);
  }

  const used = inviteFetchError ? null : detectUsedInvite(before, after);
  const oldVanity = vanityCache.has(guild.id) ? Number(vanityCache.get(guild.id) || 0) : null;
  const newVanity = await fetchVanityUses(guild);
  if (newVanity !== null) vanityCache.set(guild.id, newVanity);
  const vanityUsed = !used && oldVanity !== null && newVanity !== null && newVanity > oldVanity;

  const data = ensureInviteData(store);
  if (used?.inviterId) {
    const inviterId = used.inviterId;
    const stats = data.stats[inviterId] || { joins: 0, leaves: 0, lastJoinAt: null };
    stats.joins = Number(stats.joins || 0) + 1;
    stats.lastJoinAt = new Date().toISOString();
    data.stats[inviterId] = stats;
    data.members[member.id] = {
      inviterId,
      code: used.code,
      joinedAt: new Date().toISOString(),
      leftAt: null,
      source: 'invite'
    };
    store.save();
    const count = activeInvites(stats);
    await sendInviteLog(guild, store, {
      content: `<@${member.id}> has been invited by <@${inviterId}> and has now **${count} invite${count === 1 ? '' : 's'}**.`,
      allowedMentions: { users: [member.id, inviterId] }
    });
    return { type: 'invite', inviterId, code: used.code, count };
  }

  if (vanityUsed) {
    data.members[member.id] = {
      inviterId: null,
      code: guild.vanityURLCode || 'vanity',
      joinedAt: new Date().toISOString(),
      leftAt: null,
      source: 'vanity'
    };
    store.save();
    await sendInviteLog(guild, store, {
      content: `**${member.user.username}** joined using a vanity invite.`
    });
    return { type: 'vanity' };
  }

  data.members[member.id] = {
    inviterId: null,
    code: null,
    joinedAt: new Date().toISOString(),
    leftAt: null,
    source: 'unknown'
  };
  store.save();
  await sendInviteLog(guild, store, {
    content: `**${member.user.username}** joined, but I couldn't determine which invite was used.`
  });
  return { type: 'unknown', error: inviteFetchError?.message || null };
}

function trackMemberJoin(member, store) {
  const guildId = member?.guild?.id;
  if (!guildId) return Promise.resolve(null);
  const previous = joinQueues.get(guildId) || Promise.resolve();
  const next = previous.catch(() => {}).then(() => trackJoinNow(member, store));
  const tracked = next.finally(() => {
    if (joinQueues.get(guildId) === tracked) joinQueues.delete(guildId);
  });
  joinQueues.set(guildId, tracked);
  return next;
}

function trackMemberLeave(member, store) {
  if (!member?.id) return null;
  const data = ensureInviteData(store);
  const linked = data.members[member.id];
  if (!linked || linked.leftAt || !linked.inviterId) return null;
  const stats = data.stats[linked.inviterId] || { joins: 0, leaves: 0, lastJoinAt: null };
  stats.leaves = Number(stats.leaves || 0) + 1;
  linked.leftAt = new Date().toISOString();
  data.stats[linked.inviterId] = stats;
  data.members[member.id] = linked;
  store.save();
  return { inviterId: linked.inviterId, count: activeInvites(stats) };
}

function inviteLeaderboardEmbed(guild, store, limit = 15) {
  const data = ensureInviteData(store);
  const rows = Object.entries(data.stats)
    .map(([userId, row]) => ({ userId, count: activeInvites(row), joins: Number(row.joins || 0), leaves: Number(row.leaves || 0) }))
    .sort((a, b) => b.count - a.count || b.joins - a.joins)
    .slice(0, limit);
  const body = rows.length
    ? rows.map((r, i) => `**${i + 1}.** <@${r.userId}> — **${r.count}** invite${r.count === 1 ? '' : 's'} • ${r.joins} joined / ${r.leaves} left`).join('\n')
    : 'No tracked invites yet.';
  return new EmbedBuilder()
    .setColor(brandColor())
    .setTitle('➕ KIXO Invite Leaderboard')
    .setDescription(body)
    .setFooter({ text: `${guild.name} • Invite Tracker` })
    .setTimestamp();
}

function resetInviteUser(store, userId) {
  const data = ensureInviteData(store);
  const existed = Boolean(data.stats[userId]);
  delete data.stats[userId];
  for (const [memberId, row] of Object.entries(data.members)) {
    if (row?.inviterId === userId) delete data.members[memberId];
  }
  store.save();
  return existed;
}

function inviteStatus(guild, store) {
  const s = getSettings(store);
  const me = guild.members.me;
  return {
    ...s,
    manageGuild: Boolean(me?.permissions?.has(PermissionFlagsBits.ManageGuild)),
    cachedInvites: inviteCache.get(guild.id)?.size || 0,
    vanityUses: vanityCache.has(guild.id) ? vanityCache.get(guild.id) : null,
    trackedInviters: Object.keys(ensureInviteData(store).stats).length
  };
}

module.exports = {
  primeInviteCache,
  updateInviteCache,
  removeInviteCache,
  trackMemberJoin,
  trackMemberLeave,
  inviteLeaderboardEmbed,
  resetInviteUser,
  inviteStatus,
  activeInvites
};
