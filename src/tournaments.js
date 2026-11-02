const crypto = require('crypto');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { brandColor } = require('./embeds');

function tournamentEmbed(t) {
  const players = t.participants || [];
  return new EmbedBuilder().setColor(brandColor()).setTitle(`🏆 ${t.name}`)
    .setDescription(t.description || 'KIXO tournament registration is open.')
    .addFields(
      { name: 'Starts', value: t.starts || 'TBA', inline: true },
      { name: 'Prize', value: t.prize || 'TBA', inline: true },
      { name: 'Entry', value: t.entry || 'TBA', inline: true },
      { name: 'Registered', value: `${players.length}${t.max ? ` / ${t.max}` : ''}`, inline: true }
    ).setFooter({ text: `Tournament ID: ${t.id}` }).setTimestamp();
}
function tournamentRow(t) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`tournament:join:${t.id}`).setLabel('Register / Leave').setEmoji('🏆').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`tournament:list:${t.id}`).setLabel('View Registered').setStyle(ButtonStyle.Secondary)
  );
}
function createTournament(data, store) {
  const id = crypto.randomBytes(3).toString('hex');
  const t = { id, name: data.name, description: data.description || '', starts: data.starts || 'TBA', prize: data.prize || 'TBA', entry: data.entry || 'TBA', max: data.max || null, participants: [], createdAt: new Date().toISOString(), messageId: null, channelId: null };
  store.data.tournaments[id] = t; store.save(); return t;
}
async function toggleTournament(interaction, id, store) {
  const t = store.data.tournaments[id];
  if (!t) return interaction.reply({ content: 'Tournament not found.', flags: MessageFlags.Ephemeral });
  const i = t.participants.indexOf(interaction.user.id);
  let joined;
  if (i >= 0) { t.participants.splice(i, 1); joined = false; }
  else {
    if (t.max && t.participants.length >= t.max) return interaction.reply({ content: 'This tournament is full.', flags: MessageFlags.Ephemeral });
    t.participants.push(interaction.user.id); joined = true;
  }
  store.save();
  await interaction.update({ embeds: [tournamentEmbed(t)], components: [tournamentRow(t)] });
  return interaction.followUp({ content: joined ? '✅ You are registered.' : 'You were removed from registration.', flags: MessageFlags.Ephemeral });
}
function participantList(t) {
  return t.participants.length ? t.participants.map((id,i) => `${i+1}. <@${id}>`).join('\n').slice(0, 3900) : 'Nobody has registered yet.';
}
module.exports = { tournamentEmbed, tournamentRow, createTournament, toggleTournament, participantList };
