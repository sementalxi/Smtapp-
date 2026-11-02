const { ChannelType, PermissionFlagsBits } = require('discord.js');

const MESSAGE_CHANNEL_TYPES = new Set([
  ChannelType.GuildText,
  ChannelType.GuildAnnouncement,
  ChannelType.PublicThread,
  ChannelType.PrivateThread,
  ChannelType.AnnouncementThread
]);

const DEFAULT_SMART_IGNORE_PATTERNS = [
  'off-topic', 'offtopic', 'bot-commands', 'botcommands',
  'mod-log', 'mod-logs', 'audit-log', 'audit-logs',
  'staff-chat', 'admin-chat', 'mod-chat', 'moderator-chat',
  'closed-ticket', 'ticket-'
];

function splitPatterns(value = '') {
  return String(value).split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
}

function smartIgnorePatterns() {
  const custom = splitPatterns(process.env.SMART_IGNORE_PATTERNS);
  return custom.length ? custom : DEFAULT_SMART_IGNORE_PATTERNS;
}

function isText(channel) {
  return Boolean(channel && MESSAGE_CHANNEL_TYPES.has(channel.type));
}

function categoryId(channel) {
  if (!channel) return null;
  if ([ChannelType.PublicThread, ChannelType.PrivateThread, ChannelType.AnnouncementThread].includes(channel.type)) {
    return channel.parent?.parentId || null;
  }
  return channel.parentId || null;
}

function cleanMessage(message) {
  const attachments = [...message.attachments.values()].map(a => `${a.name || 'attachment'} ${a.url || ''}`);
  const embeds = message.embeds.flatMap(e => [e.title, e.description, ...(e.fields || []).flatMap(f => [f.name, f.value])]).filter(Boolean);
  return [message.content, ...embeds, ...attachments].filter(Boolean).join('\n').trim();
}

function matchesSmartIgnore(channel) {
  const names = [channel?.name, channel?.parent?.name, channel?.parent?.parent?.name]
    .filter(Boolean)
    .map(x => String(x).toLowerCase().trim());
  const patterns = smartIgnorePatterns();
  return names.some(name => patterns.some(pattern => {
    if (pattern.endsWith('-')) return name.startsWith(pattern);
    return name === pattern;
  }));
}

function isSystemExcluded(channel, settings) {
  if (!channel) return true;
  if (channel.id === settings.answerChannelId) return true;
  if (channel.id === settings.logChannelId) return true;
  if (channel.id === settings.ticketTranscriptChannelId) return true;
  if (channel.id === settings.welcomeChannelId) return true;
  if (settings.ticketCategoryId && categoryId(channel) === settings.ticketCategoryId) return true;
  return false;
}

function shouldIndex(channel, store) {
  if (!isText(channel)) return false;
  const s = store.data.settings;
  if (isSystemExcluded(channel, s)) return false;
  if (s.ignoredChannelIds.includes(channel.id) || (channel.parentId && s.ignoredChannelIds.includes(channel.parentId))) return false;
  const catId = categoryId(channel);
  if (catId && s.ignoredCategoryIds.includes(catId)) return false;
  if (s.smartFilter !== false && matchesSmartIgnore(channel)) return false;

  if (s.autoDiscover !== false) return true;

  if (!s.knowledgeChannelIds.length) return true;
  return s.knowledgeChannelIds.includes(channel.id) || (channel.parentId && s.knowledgeChannelIds.includes(channel.parentId));
}

function canRead(channel, member) {
  const p = channel?.permissionsFor?.(member);
  return Boolean(p?.has(PermissionFlagsBits.ViewChannel) && p?.has(PermissionFlagsBits.ReadMessageHistory));
}

async function fetchHistory(channel, limit) {
  const out = [];
  let before;
  while (out.length < limit) {
    const batch = await channel.messages.fetch({ limit: Math.min(100, limit - out.length), before }).catch(() => null);
    if (!batch?.size) break;
    const rows = [...batch.values()];
    out.push(...rows);
    before = rows.at(-1)?.id;
    if (batch.size < 100) break;
  }
  return out;
}

function rowFromMessage(message) {
  return {
    id: message.id,
    channelId: message.channel.id,
    channelName: message.channel.name,
    parentName: message.channel.parent?.name || '',
    categoryName: message.channel.parent?.parent?.name || message.channel.parent?.name || '',
    authorId: message.author?.id || '',
    authorName: message.author?.username || 'Unknown',
    content: cleanMessage(message),
    createdTimestamp: message.createdTimestamp || Date.now(),
    editedTimestamp: message.editedTimestamp || null,
    pinned: Boolean(message.pinned),
    url: message.url
  };
}

async function discoverKnowledgeChannels(guild, store) {
  await guild.channels.fetch();
  const me = guild.members.me || await guild.members.fetchMe();
  const channels = [...guild.channels.cache.values()].filter(ch => isText(ch));

  const active = await guild.channels.fetchActiveThreads().catch(() => null);
  if (active?.threads?.size) {
    for (const thread of active.threads.values()) {
      if (!channels.some(ch => ch.id === thread.id)) channels.push(thread);
    }
  }

  const readable = channels.filter(ch => canRead(ch, me));
  const eligible = readable.filter(ch => shouldIndex(ch, store));
  return {
    eligible,
    readableCount: readable.length,
    excludedCount: Math.max(0, readable.length - eligible.length)
  };
}

async function scanChannelHistory(channel, store, maxPerChannel = 500) {
  if (!channel?.guild || !shouldIndex(channel, store)) return { messages: 0, channel: false };
  const me = channel.guild.members.me || await channel.guild.members.fetchMe();
  if (!canRead(channel, me)) return { messages: 0, channel: false };

  const messages = await fetchHistory(channel, maxPerChannel);
  const rows = [];
  for (const message of messages) {
    if (message.author?.bot) continue;
    const row = rowFromMessage(message);
    if (row.content.length >= 3) rows.push(row);
  }

  store.data.knowledge = [
    ...rows,
    ...store.data.knowledge.filter(x => x.channelId !== channel.id)
  ];
  if (store.data.knowledge.length > 30000) store.data.knowledge.length = 30000;
  store.save();
  return { messages: rows.length, channel: true };
}

async function rebuildKnowledge(guild, store, maxPerChannel = 500) {
  const discovered = await discoverKnowledgeChannels(guild, store);
  const next = [];
  for (const channel of discovered.eligible) {
    const messages = await fetchHistory(channel, maxPerChannel);
    for (const message of messages) {
      if (message.author?.bot) continue;
      const row = rowFromMessage(message);
      if (row.content.length >= 3) next.push(row);
    }
  }
  next.sort((a, b) => b.createdTimestamp - a.createdTimestamp);
  store.data.knowledge = next.slice(0, 30000);
  store.data.meta.lastSync = new Date().toISOString();
  store.data.meta.syncChannels = discovered.eligible.length;
  store.data.meta.readableChannels = discovered.readableCount;
  store.data.meta.excludedChannels = discovered.excludedCount;
  store.save();
  return {
    messages: store.data.knowledge.length,
    channels: discovered.eligible.length,
    readable: discovered.readableCount,
    excluded: discovered.excludedCount
  };
}

function upsertMessage(message, store) {
  if (message.author?.bot || !shouldIndex(message.channel, store)) return false;
  const row = rowFromMessage(message);
  if (row.content.length < 3) return false;
  const i = store.data.knowledge.findIndex(x => x.id === row.id);
  if (i >= 0) store.data.knowledge[i] = row;
  else store.data.knowledge.unshift(row);
  if (store.data.knowledge.length > 30000) store.data.knowledge.length = 30000;
  store.save();
  return true;
}

function deleteMessage(messageId, store) {
  const before = store.data.knowledge.length;
  store.data.knowledge = store.data.knowledge.filter(x => x.id !== messageId);
  if (store.data.knowledge.length !== before) store.save();
}

function removeChannelMessages(channelId, store) {
  const before = store.data.knowledge.length;
  store.data.knowledge = store.data.knowledge.filter(x => x.channelId !== channelId);
  const removed = before - store.data.knowledge.length;
  if (removed) store.save();
  return removed;
}

function removeMessagesForCategory(guild, category, store) {
  const childIds = new Set(
    [...guild.channels.cache.values()]
      .filter(ch => categoryId(ch) === category.id)
      .map(ch => ch.id)
  );
  const before = store.data.knowledge.length;
  store.data.knowledge = store.data.knowledge.filter(x => !childIds.has(x.channelId));
  const removed = before - store.data.knowledge.length;
  if (removed) store.save();
  return removed;
}

module.exports = {
  isText,
  cleanMessage,
  shouldIndex,
  categoryId,
  rebuildKnowledge,
  discoverKnowledgeChannels,
  scanChannelHistory,
  upsertMessage,
  deleteMessage,
  removeChannelMessages,
  removeMessagesForCategory
};
