const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { brandColor } = require('./embeds');

function smtControlCenter() {
  const embed = new EmbedBuilder()
    .setColor(brandColor())
    .setTitle('🐎 KIXO | GFX STUDIO CONTROL CENTER')
    .setDescription('Private staff control center for KIXO systems.')
    .addFields(
      { name: '📜 Rules', value: 'Bilingual rules panels and publishing', inline: true },
      { name: '🎫 Tickets', value: 'Departments, questions, routing, claim controls and cleanup', inline: true },
      { name: '✅ Verification', value: 'Roles, verify panel and server access', inline: true },
      { name: '⚙️ Bot', value: 'AI, moderation, invite tracking and server configuration', inline: true }
    )
    .setFooter({ text: 'KIXO | GFX STUDIO • Staff Only' });

  return {
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('smt:rules').setLabel('Rules').setEmoji('📜').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('smt:tickets').setLabel('Tickets').setEmoji('🎫').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('smt:verify').setLabel('Verification').setEmoji('✅').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('smt:config').setLabel('Bot Info').setEmoji('⚙️').setStyle(ButtonStyle.Secondary)
    )]
  };
}

module.exports = { smtControlCenter };
