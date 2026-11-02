const { EmbedBuilder } = require('discord.js');
const { brandColor } = require('./embeds');
const cooldown = new Map();

function xpForLevel(level) { return 100 + (level * 75); }
function levelFromXp(xp) {
  let level = 0, remaining = xp;
  while (remaining >= xpForLevel(level)) { remaining -= xpForLevel(level); level++; }
  return { level, current: remaining, needed: xpForLevel(level) };
}

function addMessageXp(message, store) {
  if (!store.data.settings.features.levels || message.author.bot) return null;
  const key = `${message.guild.id}:${message.author.id}`;
  const now = Date.now();
  if ((cooldown.get(key) || 0) > now - 60000) return null;
  cooldown.set(key, now);
  const row = store.data.levels[message.author.id] || { xp: 0, messages: 0 };
  const before = levelFromXp(row.xp).level;
  row.xp += 10;
  row.messages += 1;
  store.data.levels[message.author.id] = row;
  store.save();
  const after = levelFromXp(row.xp).level;
  return after > before ? after : null;
}

function rankEmbed(member, store) {
  const row = store.data.levels[member.id] || { xp: 0, messages: 0 };
  const p = levelFromXp(row.xp);
  const ranked = Object.entries(store.data.levels).sort((a,b) => b[1].xp - a[1].xp);
  const place = Math.max(1, ranked.findIndex(([id]) => id === member.id) + 1);
  return new EmbedBuilder().setColor(brandColor()).setTitle(`${member.displayName} • Level ${p.level}`)
    .setDescription(`**XP:** ${p.current}/${p.needed}\n**Total XP:** ${row.xp}\n**Messages:** ${row.messages}\n**Server Rank:** #${place}`)
    .setThumbnail(member.displayAvatarURL()).setFooter({ text: 'SEMENTAL Level System' });
}

function leaderboardEmbed(guild, store) {
  const rows = Object.entries(store.data.levels).sort((a,b) => b[1].xp - a[1].xp).slice(0, 10);
  const body = rows.length ? rows.map(([id, d], i) => `**${i+1}.** <@${id}> — ${d.xp} XP • Level ${levelFromXp(d.xp).level}`).join('\n') : 'No XP activity yet.';
  return new EmbedBuilder().setColor(brandColor()).setTitle('🏆 SEMENTAL Leaderboard').setDescription(body).setFooter({ text: guild.name });
}

module.exports = { addMessageXp, rankEmbed, leaderboardEmbed };
