const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

function brandColor() {
  return process.env.BRAND_COLOR || '#FF2D8B';
}
function logo() { return process.env.BRAND_LOGO_URL || null; }

function aiAnswerEmbed(question, result, options = {}) {
  const confidence = result.confidence || 'medium';
  const confidenceLabel = confidence === 'high' ? 'High confidence' : confidence === 'low' ? 'Needs confirmation' : 'Good match';
  const embed = new EmbedBuilder()
    .setColor(brandColor())
    .setAuthor({ name: process.env.BRAND_NAME || 'KIXO AI', iconURL: logo() || undefined })
    .setTitle('KIXO AI • Server Assistant')
    .setDescription(String(result.text || '').slice(0, 3900))
    .addFields({ name: 'Question', value: String(question || '').slice(0, 900) })
    .setFooter({ text: `${confidenceLabel} • Grounded in KIXO server information` })
    .setTimestamp();

  const rows = [];
  const sourceButtons = (result.sources || [])
    .filter(s => /^https:\/\//i.test(String(s.url || '')))
    .slice(0, 3)
    .map((s, i) => new ButtonBuilder()
      .setLabel(`Source ${i + 1} • ${s.sourceLabel || `#${s.channelName}`}`.slice(0, 80))
      .setStyle(ButtonStyle.Link)
      .setURL(s.url));
  if (sourceButtons.length) rows.push(new ActionRowBuilder().addComponents(sourceButtons));

  if (options.feedbackId) {
    const feedback = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`ai:feedback:${options.feedbackId}:up`).setLabel('Helpful').setEmoji('👍').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`ai:feedback:${options.feedbackId}:down`).setLabel('Needs work').setEmoji('👎').setStyle(ButtonStyle.Secondary)
    );
    if (confidence === 'low' && options.includeTicket !== false) {
      feedback.addComponents(new ButtonBuilder().setCustomId('ticket:create').setLabel('Ask Staff').setEmoji('🎫').setStyle(ButtonStyle.Danger));
    }
    rows.push(feedback);
  }
  return { embed, rows };
}

function errorEmbed(title, description) {
  return new EmbedBuilder().setColor('#8b1e21').setTitle(title).setDescription(description);
}

function successEmbed(title, description) {
  return new EmbedBuilder().setColor(brandColor()).setTitle(title).setDescription(description).setTimestamp();
}

module.exports = { aiAnswerEmbed, errorEmbed, successEmbed, brandColor, logo };
