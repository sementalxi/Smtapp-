const fs = require('fs');
const path = require('path');
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  MessageFlags
} = require('discord.js');
const { DATA_DIR } = require('./store');

const SITE_ASSET_DIR = path.join(DATA_DIR, 'site-assets');
fs.mkdirSync(SITE_ASSET_DIR, { recursive: true });

const DEFAULT_WEBSITE = Object.freeze({
  enabled: true,
  registrationOpen: true,
  updatedAt: null,
  homepage: {
    en: {
      kicker: 'EA SPORTS FC 27 COMPETITIVE CLUBS',
      headline: 'WHERE CHAMPIONS ARE MADE.',
      body: 'Build your club. Enter the pressure. Compete in KIXO leagues, relámpagos and community events built for serious FC 27 teams.',
      primaryCta: 'REGISTER YOUR TEAM',
      secondaryCta: 'OPEN LEAGUE HUB'
    },
    es: {
      kicker: 'EA SPORTS FC 27 CLUBS COMPETITIVO',
      headline: 'DONDE NACEN LOS CAMPEONES.',
      body: 'Forma tu club. Entra bajo presión. Compite en ligas, relámpagos y eventos de la comunidad KIXO creados para equipos serios de FC 27.',
      primaryCta: 'REGISTRA TU EQUIPO',
      secondaryCta: 'ABRIR CENTRO DE LIGA'
    }
  },
  league: {
    prizePool: '$1,500',
    startDate: 'October 23, 2026',
    matchDays: 'Friday + Sunday',
    entry: '$25 + tax',
    platforms: 'Xbox · PS5 · PC',
    statusEn: 'Registration Open',
    statusEs: 'Inscripción Abierta'
  },
  events: [
    {
      id: 'smt-league',
      en: { eyebrow: 'SEASON LEAGUE', title: 'KIXO LEAGUE', prize: '$1,500', meta: 'STARTS OCT 23 · FRI + SUN' },
      es: { eyebrow: 'LIGA DE TEMPORADA', title: 'KIXO LEAGUE', prize: '$1,500', meta: 'INICIA OCT 23 · VIE + DOM' }
    },
    {
      id: 'relampago',
      en: { eyebrow: 'WEEKLY EVENT', title: 'RELÁMPAGO', prize: 'FAST', meta: 'SHORT FORMAT · HIGH PRESSURE' },
      es: { eyebrow: 'EVENTO SEMANAL', title: 'RELÁMPAGO', prize: 'RÁPIDO', meta: 'FORMATO CORTO · MÁXIMA PRESIÓN' }
    },
    {
      id: 'troll-edition',
      en: { eyebrow: 'COMMUNITY FORMAT', title: 'TROLL EDITION', prize: 'CHAOS', meta: 'SPECIAL RULES · BIG ENERGY' },
      es: { eyebrow: 'FORMATO DE COMUNIDAD', title: 'TROLL EDITION', prize: 'CAOS', meta: 'REGLAS ESPECIALES · PURA ENERGÍA' }
    }
  ],
  links: {
    discord: '', leagueArena: ''
  },
  theme: {
    primary: '#F32270',
    purple: '#C118F2',
    cyan: '#00E5FF',
    green: '#9BFF00',
    yellow: '#FFE600',
    background: '#0F0B11'
  },
  media: {
    logoUrl: '',
    leagueImageUrl: '',
    heroImageUrl: '',
    introVideoUrl: '',
    logoFile: '',
    leagueImageFile: '',
    heroImageFile: '',
    introVideoFile: ''
  },
  audit: []
});

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function normalizeWebsite(input = {}) {
  const d = clone(DEFAULT_WEBSITE);
  return {
    ...d,
    ...input,
    homepage: {
      en: { ...d.homepage.en, ...(input.homepage?.en || {}) },
      es: { ...d.homepage.es, ...(input.homepage?.es || {}) }
    },
    league: { ...d.league, ...(input.league || {}) },
    events: Array.isArray(input.events) && input.events.length
      ? input.events.map((event, index) => {
          const fallback = d.events[index] || { id: `event-${index + 1}`, en: {}, es: {} };
          return {
            ...fallback,
            ...event,
            id: trim(event?.id || fallback.id || `event-${index + 1}`, 80),
            visible: event?.visible !== false,
            registrationUrl: validHttpUrl(event?.registrationUrl, d.links.discord),
            imageFile: trim(event?.imageFile, 160),
            imageUrl: validHttpUrl(event?.imageUrl, ''),
            en: { ...fallback.en, ...(event?.en || {}) },
            es: { ...fallback.es, ...(event?.es || {}) }
          };
        })
      : d.events.map(event => ({ ...event, visible: true, registrationUrl: d.links.discord, imageFile: '', imageUrl: '' })),
    links: { ...d.links, ...(input.links || {}) },
    theme: { ...d.theme, ...(input.theme || {}) },
    media: { ...d.media, ...(input.media || {}) },
    audit: Array.isArray(input.audit) ? input.audit.slice(0, 100) : []
  };
}

function ensureWebsite(store) {
  store.data.website = normalizeWebsite(store.data.website || {});
  return store.data.website;
}

function normalizeHex(value, fallback) {
  const v = String(value || '').trim();
  return /^#[0-9a-f]{6}$/i.test(v) ? v.toUpperCase() : fallback;
}

function validHttpUrl(value, fallback = '') {
  const v = String(value || '').trim();
  if (!v) return fallback;
  try {
    const u = new URL(v);
    return ['http:', 'https:'].includes(u.protocol) ? u.toString() : fallback;
  } catch {
    return fallback;
  }
}

function trim(value, max = 1000) {
  return String(value || '').trim().slice(0, max);
}

function escapeMd(value) {
  return String(value || '').replace(/([*_`~>|])/g, '\\$1');
}

function websitePanel(store) {
  const w = ensureWebsite(store);
  const embed = new EmbedBuilder()
    .setColor(w.theme.primary || '#F32270')
    .setTitle('🌐 KIXO | GFX STUDIO • WEBSITE CONTROL')
    .setDescription('Manage the KIXO website directly from Discord. Changes are saved to the Railway volume and exposed to the website through the bot API.')
    .addFields(
      { name: '🏆 KIXO League', value: `Prize: **${escapeMd(w.league.prizePool)}**\nStart: **${escapeMd(w.league.startDate)}**\nDays: **${escapeMd(w.league.matchDays)}**`, inline: true },
      { name: '🟢 Registration', value: w.registrationOpen ? '**OPEN**' : '**CLOSED**', inline: true },
      { name: '🌎 Languages', value: 'English + Español', inline: true },
      { name: '🎨 Neon Theme', value: `${w.theme.primary} • ${w.theme.purple}\n${w.theme.cyan} • ${w.theme.green} • ${w.theme.yellow}`, inline: false },
      { name: '🔗 LeagueArena', value: w.links.leagueArena || 'Not set', inline: false }
    )
    .setFooter({ text: `KIXO | GFX STUDIO • Last update: ${w.updatedAt ? new Date(w.updatedAt).toLocaleString() : 'Not changed yet'}` });

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('site:home:en').setLabel('Homepage EN').setEmoji('🇺🇸').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('site:home:es').setLabel('Homepage ES').setEmoji('🇲🇽').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('site:league').setLabel('League').setEmoji('🏆').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('site:links').setLabel('Links').setEmoji('🔗').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('site:theme').setLabel('Neon Theme').setEmoji('🎨').setStyle(ButtonStyle.Secondary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('site:status').setLabel(w.registrationOpen ? 'Close Registration' : 'Open Registration').setEmoji(w.registrationOpen ? '🔴' : '🟢').setStyle(w.registrationOpen ? ButtonStyle.Danger : ButtonStyle.Success),
    new ButtonBuilder().setCustomId('site:events').setLabel('Event Cards').setEmoji('⚡').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('site:media').setLabel('Media / Images').setEmoji('🖼️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('site:logs').setLabel('Change Log').setEmoji('📋').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('site:refresh').setLabel('Refresh').setEmoji('🔄').setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [row1, row2] };
}

function smtControlCenter(store) {
  const w = ensureWebsite(store);
  const embed = new EmbedBuilder()
    .setColor(w.theme.primary || '#F32270')
    .setTitle('🐎 KIXO | GFX STUDIO CONTROL CENTER')
    .setDescription('Private staff control center for KIXO systems. Use the buttons below to manage the website and open the existing bot admin systems.')
    .addFields(
      { name: '🌐 Website', value: 'Homepage, league, links, neon colors, images, registration status', inline: true },
      { name: '📜 Rules', value: 'Bilingual rules panels and publishing', inline: true },
      { name: '🎫 Tickets', value: 'Departments, questions, routing, branding and staff controls', inline: true },
      { name: '✅ Verification', value: 'Roles, verify panel and server access', inline: true },
      { name: '⚙️ Bot', value: 'AI, moderation, logs and server configuration', inline: true }
    )
    .setFooter({ text: 'KIXO | GFX STUDIO • Staff Only' });

  return {
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('smt:website').setLabel('Website').setEmoji('🌐').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('smt:rules').setLabel('Rules').setEmoji('📜').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('smt:tickets').setLabel('Tickets').setEmoji('🎫').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('smt:verify').setLabel('Verification').setEmoji('✅').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('smt:config').setLabel('Bot Info').setEmoji('⚙️').setStyle(ButtonStyle.Secondary)
    )]
  };
}

function input(id, label, value, style = TextInputStyle.Short, maxLength = 1000, required = true) {
  const i = new TextInputBuilder()
    .setCustomId(id)
    .setLabel(label.slice(0, 45))
    .setStyle(style)
    .setRequired(required)
    .setMaxLength(maxLength);
  if (value) i.setValue(String(value).slice(0, maxLength));
  return new ActionRowBuilder().addComponents(i);
}

function homeModal(store, lang) {
  const w = ensureWebsite(store);
  const c = w.homepage[lang];
  return new ModalBuilder()
    .setCustomId(`site:modal:home:${lang}`)
    .setTitle(lang === 'es' ? 'Website • Inicio Español' : 'Website • English Homepage')
    .addComponents(
      input('kicker', 'Small heading / kicker', c.kicker, TextInputStyle.Short, 120),
      input('headline', 'Main headline', c.headline, TextInputStyle.Short, 150),
      input('body', 'Homepage description', c.body, TextInputStyle.Paragraph, 900),
      input('primaryCta', 'Primary button text', c.primaryCta, TextInputStyle.Short, 80),
      input('secondaryCta', 'Secondary button text', c.secondaryCta, TextInputStyle.Short, 80)
    );
}

function leagueModal(store) {
  const w = ensureWebsite(store);
  const c = w.league;
  return new ModalBuilder()
    .setCustomId('site:modal:league')
    .setTitle('Website • KIXO League')
    .addComponents(
      input('prizePool', 'Prize pool', c.prizePool, TextInputStyle.Short, 60),
      input('startDate', 'Start date', c.startDate, TextInputStyle.Short, 80),
      input('matchDays', 'Match days', c.matchDays, TextInputStyle.Short, 80),
      input('entry', 'Team entry', c.entry, TextInputStyle.Short, 60),
      input('platforms', 'Platforms', c.platforms, TextInputStyle.Short, 100)
    );
}

function linksModal(store) {
  const w = ensureWebsite(store);
  return new ModalBuilder()
    .setCustomId('site:modal:links')
    .setTitle('Website • Links')
    .addComponents(
      input('discord', 'Discord invite URL', w.links.discord, TextInputStyle.Short, 300),
      input('leagueArena', 'LeagueArena URL', w.links.leagueArena, TextInputStyle.Short, 300)
    );
}

function themeModal(store) {
  const t = ensureWebsite(store).theme;
  return new ModalBuilder()
    .setCustomId('site:modal:theme')
    .setTitle('Website • Neon Colors')
    .addComponents(
      input('primary', 'Neon pink (#RRGGBB)', t.primary, TextInputStyle.Short, 7),
      input('purple', 'Neon purple (#RRGGBB)', t.purple, TextInputStyle.Short, 7),
      input('cyan', 'Neon cyan (#RRGGBB)', t.cyan, TextInputStyle.Short, 7),
      input('green', 'Neon green (#RRGGBB)', t.green, TextInputStyle.Short, 7),
      input('yellow', 'Neon yellow (#RRGGBB)', t.yellow, TextInputStyle.Short, 7)
    );
}

function eventsPanel(store) {
  const w = ensureWebsite(store);
  const visible = w.events.filter(e => e.visible !== false).length;
  const lines = w.events.slice(0, 12).map((e, i) => `**${i + 1}. ${escapeMd(e.en?.title || e.id)}** • ID: \`${escapeMd(e.id)}\`${e.visible === false ? ' • HIDDEN' : ''}`).join('\n');
  return {
    embeds: [new EmbedBuilder()
      .setColor(w.theme.yellow || '#FFE600')
      .setTitle('⚡ Upcoming Tournaments / Leagues')
      .setDescription(`**${w.events.length}** total events • **${visible}** visible on the website\n\n${lines || 'No events yet.'}\n\nUse the website event commands to add, edit, upload flyers, hide/show, reorder or delete events. There is no 3-card limit.`)],
    components: [
      ...(w.events.length ? [new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('site:event:select')
          .setPlaceholder('Select an event to edit')
          .addOptions(w.events.slice(0, 25).map((e, i) => ({
            label: String(e.en?.title || e.id).slice(0, 100),
            description: `Card ${i + 1} • ${e.visible === false ? 'Hidden' : 'Visible'}`.slice(0, 100),
            value: String(i)
          })))
      )] : []),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('site:event:add').setLabel('Create Event').setEmoji('➕').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('site:events').setLabel('Refresh List').setEmoji('🔄').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('site:back').setLabel('Back').setEmoji('⬅️').setStyle(ButtonStyle.Secondary)
      )
    ]
  };
}

function eventDetailPanel(store, index) {
  const w = ensureWebsite(store);
  const e = w.events[index];
  if (!e) return eventsPanel(store);
  const embed = new EmbedBuilder()
    .setColor(w.theme.yellow || '#FFE600')
    .setTitle(`⚡ ${e.en?.title || e.id}`)
    .setDescription(`Event ID: \`${escapeMd(e.id)}\`\nStatus: **${e.visible === false ? 'HIDDEN' : 'VISIBLE'}**\nBanner: **${(e.imageFile || e.imageUrl) ? 'ADDED' : 'NOT SET'}**\n\n🇺🇸 **${escapeMd(e.en?.title || '—')}**\n${escapeMd(e.en?.eyebrow || '—')} • ${escapeMd(e.en?.prize || '—')}\n${escapeMd(e.en?.meta || '—')}\n\n🇲🇽 **${escapeMd(e.es?.title || '—')}**\n${escapeMd(e.es?.eyebrow || '—')} • ${escapeMd(e.es?.prize || '—')}\n${escapeMd(e.es?.meta || '—')}\n\n🔗 ${escapeMd(e.registrationUrl || w.links.discord)}`);
  return { embeds:[embed], components:[
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`site:event:${index}:en`).setLabel('Edit English').setEmoji('🇺🇸').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`site:event:${index}:es`).setLabel('Edit Spanish').setEmoji('🇲🇽').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`site:eventlink:${index}`).setLabel('Edit Link').setEmoji('🔗').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`site:eventbanner:${index}`).setLabel((e.imageFile || e.imageUrl) ? 'Change Banner' : 'Add Banner').setEmoji('🖼️').setStyle(ButtonStyle.Success)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`site:eventvisible:${index}`).setLabel(e.visible === false ? 'Show Event' : 'Hide Event').setEmoji('👁️').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`site:eventmove:${index}:up`).setLabel('Move Up').setEmoji('⬆️').setStyle(ButtonStyle.Secondary).setDisabled(index === 0),
      new ButtonBuilder().setCustomId(`site:eventmove:${index}:down`).setLabel('Move Down').setEmoji('⬇️').setStyle(ButtonStyle.Secondary).setDisabled(index === w.events.length - 1),
      new ButtonBuilder().setCustomId(`site:eventdelete:${index}`).setLabel('Delete').setEmoji('🗑️').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('site:events').setLabel('All Events').setEmoji('⬅️').setStyle(ButtonStyle.Secondary)
    )
  ]};
}

function eventAddModal() {
  return new ModalBuilder().setCustomId('site:modal:eventadd').setTitle('Create Website Event').addComponents(
    input('title', 'English event title', '', TextInputStyle.Short, 100),
    input('titleEs', 'Spanish event title', '', TextInputStyle.Short, 100),
    input('prize', 'Prize / highlight', '', TextInputStyle.Short, 80),
    input('meta', 'Date / format line', '', TextInputStyle.Short, 140)
  );
}

function deleteEventPanel(store, index) {
  const w=ensureWebsite(store), e=w.events[index]; if(!e) return eventsPanel(store);
  return { embeds:[new EmbedBuilder().setColor('#FF2D8B').setTitle('⚠️ Delete Website Event?').setDescription(`You are about to permanently delete **${escapeMd(e.en?.title || e.id)}** from the website event list.

This cannot be undone from this panel.`)], components:[new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`site:eventdeleteconfirm:${index}`).setLabel('Yes, Delete Event').setEmoji('🗑️').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`site:eventcancel:${index}`).setLabel('Cancel').setStyle(ButtonStyle.Secondary)
  )] };
}

function eventLinkModal(store, index) {
  const w = ensureWebsite(store);
  const e = w.events[index];
  if (!e) return null;
  return new ModalBuilder()
    .setCustomId(`site:modal:eventlink:${index}`)
    .setTitle(`Event ${index + 1} • Registration Link`)
    .addComponents(input('registrationUrl', 'Button / registration URL', e.registrationUrl || w.links.discord, TextInputStyle.Short, 500));
}

function eventModal(store, index, lang) {
  const w = ensureWebsite(store);
  const event = w.events[index];
  if (!event) return null;
  const c = event[lang];
  return new ModalBuilder()
    .setCustomId(`site:modal:event:${index}:${lang}`)
    .setTitle(`Event ${index + 1} • ${lang.toUpperCase()}`)
    .addComponents(
      input('eyebrow', 'Small category text', c.eyebrow, TextInputStyle.Short, 80),
      input('title', 'Event title', c.title, TextInputStyle.Short, 100),
      input('prize', 'Prize / highlight', c.prize, TextInputStyle.Short, 80),
      input('meta', 'Date / format line', c.meta, TextInputStyle.Short, 140)
    );
}

function mediaPanel(store) {
  const m = ensureWebsite(store).media;
  const mark = v => v ? '✅ Set' : '— Not set';
  const embed = new EmbedBuilder()
    .setColor(ensureWebsite(store).theme.cyan || '#00E5FF')
    .setTitle('🖼️ Website Media')
    .setDescription('Upload website media directly from Discord with `/website-upload`. Files are saved on the Railway `/data` volume and served by KIXO | GFX STUDIO.')
    .addFields(
      { name: 'Logo', value: mark(m.logoFile || m.logoUrl), inline: true },
      { name: 'League Image', value: mark(m.leagueImageFile || m.leagueImageUrl), inline: true },
      { name: 'Hero Image', value: mark(m.heroImageFile || m.heroImageUrl), inline: true },
      { name: 'Intro Video', value: mark(m.introVideoFile || m.introVideoUrl), inline: true }
    )
    .setFooter({ text: '/website-upload type:<type> file:<attachment>' });
  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('site:back').setLabel('Back').setEmoji('⬅️').setStyle(ButtonStyle.Secondary)
  )] };
}

function auditEmbed(store) {
  const rows = ensureWebsite(store).audit.slice(0, 10);
  const body = rows.length
    ? rows.map((x, i) => `**${i + 1}. ${escapeMd(x.action)}**\n<@${x.userId}> • ${new Date(x.at).toLocaleString()}\n${escapeMd(x.summary || '')}`).join('\n\n').slice(0, 3900)
    : 'No website changes have been logged yet.';
  return new EmbedBuilder().setColor('#FFE600').setTitle('📋 Website Change Log').setDescription(body).setFooter({ text: 'KIXO | GFX STUDIO • Latest 10 changes' });
}

async function logWebsiteAction(store, interaction, client, action, summary) {
  const w = ensureWebsite(store);
  const row = {
    id: `site_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    at: new Date().toISOString(),
    userId: interaction.user.id,
    userTag: interaction.user.tag,
    action: trim(action, 120),
    summary: trim(summary, 600)
  };
  w.audit.unshift(row);
  w.audit = w.audit.slice(0, 100);
  w.updatedAt = row.at;
  store.save();

  const channelId = store.data.settings.logChannelId;
  if (channelId) {
    const ch = await client.channels.fetch(channelId).catch(() => null);
    if (ch?.isTextBased()) {
      const e = new EmbedBuilder()
        .setColor(w.theme.green || '#9BFF00')
        .setTitle('🌐 Website Updated')
        .addFields(
          { name: 'Admin', value: `<@${interaction.user.id}>`, inline: true },
          { name: 'Action', value: action, inline: true },
          { name: 'Change', value: summary || 'Updated website settings' }
        )
        .setTimestamp();
      await ch.send({ embeds: [e] }).catch(() => {});
    }
  }
}

async function handleWebsiteInteraction(interaction, store, isStaff, client) {
  const id = String(interaction.customId || '');
  if (!id.startsWith('site:')) return false;
  if (!isStaff(interaction, store)) {
    await interaction.reply({ content: '❌ Staff only.', flags: MessageFlags.Ephemeral }).catch(() => {});
    return true;
  }

  if (interaction.isButton()) {
    if (id === 'site:home:en') return interaction.showModal(homeModal(store, 'en')).then(() => true);
    if (id === 'site:home:es') return interaction.showModal(homeModal(store, 'es')).then(() => true);
    if (id === 'site:league') return interaction.showModal(leagueModal(store)).then(() => true);
    if (id === 'site:links') return interaction.showModal(linksModal(store)).then(() => true);
    if (id === 'site:theme') return interaction.showModal(themeModal(store)).then(() => true);
    if (id === 'site:events') { await interaction.update(eventsPanel(store)); return true; }
    if (id === 'site:event:add') return interaction.showModal(eventAddModal()).then(() => true);
    if (id.startsWith('site:eventbanner:') || id.startsWith('site:eventflyer:')) {
      const index=Number(id.split(':')[2]), e=ensureWebsite(store).events[index];
      if(!e){ await interaction.reply({content:'Event not found.',flags:MessageFlags.Ephemeral}); return true; }
      const channel = interaction.channel;
      if (!channel || typeof channel.awaitMessages !== 'function') {
        await interaction.reply({content:`🖼️ **Banner for ${e.en?.title || e.id}**\nUse: \`/website-event-image id:${e.id} image:<upload your banner>\``,flags:MessageFlags.Ephemeral});
        return true;
      }

      await interaction.reply({
        content:`🖼️ **${(e.imageFile || e.imageUrl) ? 'Change' : 'Add'} banner for ${e.en?.title || e.id}**\n\nSend the banner image **in this channel now**. I will use the next image you send within **2 minutes** and then remove your upload message if I have permission.\n\nPNG, JPG, WEBP or GIF • max 15 MB.`,
        flags:MessageFlags.Ephemeral
      });

      const collected = await channel.awaitMessages({
        filter: message => message.author?.id === interaction.user.id && message.attachments?.size > 0,
        max: 1,
        time: 120000
      }).catch(() => null);
      const uploadMessage = collected?.first?.();
      const attachment = uploadMessage?.attachments?.first?.();
      if (!attachment) {
        await interaction.editReply('⌛ Banner upload timed out. Click **Add / Change Banner** again when you are ready.').catch(() => {});
        return true;
      }

      try {
        const saved = await saveEventAttachment(store, attachment, e.id);
        await logWebsiteAction(store, interaction, client, 'Event banner', `${saved.event.en.title} banner replaced with ${saved.originalName}`);
        if (uploadMessage.deletable) await uploadMessage.delete().catch(() => {});
        await interaction.editReply(`✅ Banner saved for **${saved.event.en.title}**. The website will pick it up automatically.`).catch(() => {});
        await interaction.message.edit(eventDetailPanel(store,index)).catch(() => {});
      } catch (error) {
        await interaction.editReply(`❌ Banner upload failed: ${error.message}`).catch(() => {});
      }
      return true;
    }
    if (id.startsWith('site:eventvisible:')) {
      const index=Number(id.split(':')[2]), w=ensureWebsite(store); if(!w.events[index]) return true;
      w.events[index].visible=w.events[index].visible===false; w.updatedAt=new Date().toISOString(); store.save();
      await logWebsiteAction(store,interaction,client,'Event visibility',`${w.events[index].en?.title || w.events[index].id} • ${w.events[index].visible?'VISIBLE':'HIDDEN'}`);
      await interaction.update(eventDetailPanel(store,index)); return true;
    }
    if (id.startsWith('site:eventmove:')) {
      const parts=id.split(':'), index=Number(parts[2]), direction=parts[3], w=ensureWebsite(store), j=direction==='up'?index-1:index+1;
      if(w.events[index] && j>=0 && j<w.events.length){ [w.events[index],w.events[j]]=[w.events[j],w.events[index]]; w.updatedAt=new Date().toISOString(); store.save(); await logWebsiteAction(store,interaction,client,'Reordered website event',`${w.events[j].en?.title || w.events[j].id} moved ${direction}`); await interaction.update(eventDetailPanel(store,j)); } return true;
    }
    if (id.startsWith('site:eventdeleteconfirm:')) {
      const index=Number(id.split(':')[2]), w=ensureWebsite(store), e=w.events[index]; if(!e) return true;
      w.events.splice(index,1); if(e.imageFile){try{fs.unlinkSync(path.join(SITE_ASSET_DIR,e.imageFile));}catch{}} w.updatedAt=new Date().toISOString(); store.save();
      await logWebsiteAction(store,interaction,client,'Deleted website event',`${e.en?.title || e.id} • ${e.id}`); await interaction.update(eventsPanel(store)); return true;
    }
    if (id.startsWith('site:eventdelete:')) { const index=Number(id.split(':')[2]); await interaction.update(deleteEventPanel(store,index)); return true; }
    if (id.startsWith('site:eventcancel:')) { const index=Number(id.split(':')[2]); await interaction.update(eventDetailPanel(store,index)); return true; }
    if (id.startsWith('site:event:')) {
      const parts = id.split(':');
      const index = Number(parts[2]);
      const lang = parts[3] === 'es' ? 'es' : 'en';
      const modal = eventModal(store, index, lang);
      if (!modal) { await interaction.reply({ content: 'Event card not found.', flags: MessageFlags.Ephemeral }); return true; }
      return interaction.showModal(modal).then(() => true);
    }
    if (id.startsWith('site:eventlink:')) {
      const index = Number(id.split(':')[2]);
      const modal = eventLinkModal(store, index);
      if (!modal) { await interaction.reply({ content: 'Event card not found.', flags: MessageFlags.Ephemeral }); return true; }
      return interaction.showModal(modal).then(() => true);
    }
    if (id === 'site:media') { await interaction.update(mediaPanel(store)); return true; }
    if (id === 'site:logs') {
      await interaction.update({ embeds: [auditEmbed(store)], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('site:back').setLabel('Back').setEmoji('⬅️').setStyle(ButtonStyle.Secondary))] });
      return true;
    }
    if (id === 'site:back' || id === 'site:refresh') { await interaction.update(websitePanel(store)); return true; }
    if (id === 'site:status') {
      const w = ensureWebsite(store);
      w.registrationOpen = !w.registrationOpen;
      await logWebsiteAction(store, interaction, client, 'Registration status', w.registrationOpen ? 'Registration opened' : 'Registration closed');
      await interaction.update(websitePanel(store));
      return true;
    }
  }

  if (interaction.isStringSelectMenu() && id === 'site:event:select') {
    const index = Number(interaction.values[0]);
    await interaction.update(eventDetailPanel(store, index));
    return true;
  }

  if (interaction.isModalSubmit()) {
    const w = ensureWebsite(store);
    if (id.startsWith('site:modal:home:')) {
      const lang = id.endsWith(':es') ? 'es' : 'en';
      w.homepage[lang] = {
        kicker: trim(interaction.fields.getTextInputValue('kicker'), 120),
        headline: trim(interaction.fields.getTextInputValue('headline'), 150),
        body: trim(interaction.fields.getTextInputValue('body'), 900),
        primaryCta: trim(interaction.fields.getTextInputValue('primaryCta'), 80),
        secondaryCta: trim(interaction.fields.getTextInputValue('secondaryCta'), 80)
      };
      await logWebsiteAction(store, interaction, client, `Homepage ${lang.toUpperCase()}`, 'Updated homepage copy and buttons');
      await interaction.reply({ content: `✅ ${lang === 'es' ? 'Spanish' : 'English'} homepage saved.`, ...websitePanel(store), flags: MessageFlags.Ephemeral });
      return true;
    }
    if (id === 'site:modal:league') {
      w.league = {
        ...w.league,
        prizePool: trim(interaction.fields.getTextInputValue('prizePool'), 60),
        startDate: trim(interaction.fields.getTextInputValue('startDate'), 80),
        matchDays: trim(interaction.fields.getTextInputValue('matchDays'), 80),
        entry: trim(interaction.fields.getTextInputValue('entry'), 60),
        platforms: trim(interaction.fields.getTextInputValue('platforms'), 100)
      };
      await logWebsiteAction(store, interaction, client, 'KIXO League', `Prize ${w.league.prizePool} • ${w.league.startDate} • ${w.league.matchDays}`);
      await interaction.reply({ content: '✅ KIXO League website details saved.', ...websitePanel(store), flags: MessageFlags.Ephemeral });
      return true;
    }
    if (id === 'site:modal:links') {
      const discord = validHttpUrl(interaction.fields.getTextInputValue('discord'), w.links.discord);
      const leagueArena = validHttpUrl(interaction.fields.getTextInputValue('leagueArena'), w.links.leagueArena);
      w.links = { discord, leagueArena };
      await logWebsiteAction(store, interaction, client, 'Website links', 'Updated Discord and LeagueArena links');
      await interaction.reply({ content: '✅ Website links saved.', ...websitePanel(store), flags: MessageFlags.Ephemeral });
      return true;
    }
    if (id === 'site:modal:eventadd') {
      const title=trim(interaction.fields.getTextInputValue('title'),100), titleEs=trim(interaction.fields.getTextInputValue('titleEs'),100) || title;
      const prize=trim(interaction.fields.getTextInputValue('prize'),80), meta=trim(interaction.fields.getTextInputValue('meta'),140);
      let base=String(title||'event').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,52)||'event', eventId=base, n=2;
      while(w.events.some(e=>e.id===eventId)) eventId=`${base}-${n++}`;
      w.events.push({id:eventId,visible:true,registrationUrl:w.links.discord,imageFile:'',imageUrl:'',en:{eyebrow:'UPCOMING EVENT',title,prize,meta},es:{eyebrow:'PRÓXIMO EVENTO',title:titleEs,prize,meta}}); w.updatedAt=new Date().toISOString(); store.save();
      await logWebsiteAction(store,interaction,client,'Added website event',`${title} • ${eventId}`); await interaction.reply({content:'✅ New website event created. Select it below to finish editing or upload its flyer.',...eventsPanel(store),flags:MessageFlags.Ephemeral}); return true;
    }
    if (id.startsWith('site:modal:eventlink:')) {
      const index = Number(id.split(':')[3]);
      if (!w.events[index]) { await interaction.reply({ content: 'Event card not found.', flags: MessageFlags.Ephemeral }); return true; }
      w.events[index].registrationUrl = validHttpUrl(interaction.fields.getTextInputValue('registrationUrl'), w.links.discord);
      await logWebsiteAction(store, interaction, client, `Event card ${index + 1} link`, w.events[index].registrationUrl);
      await interaction.reply({ content: '✅ Event button / registration link saved.', ...eventDetailPanel(store, index), flags: MessageFlags.Ephemeral });
      return true;
    }
    if (id.startsWith('site:modal:event:')) {
      const parts = id.split(':');
      const index = Number(parts[3]);
      const lang = parts[4] === 'es' ? 'es' : 'en';
      if (!w.events[index]) { await interaction.reply({ content: 'Event card not found.', flags: MessageFlags.Ephemeral }); return true; }
      w.events[index][lang] = {
        eyebrow: trim(interaction.fields.getTextInputValue('eyebrow'), 80),
        title: trim(interaction.fields.getTextInputValue('title'), 100),
        prize: trim(interaction.fields.getTextInputValue('prize'), 80),
        meta: trim(interaction.fields.getTextInputValue('meta'), 140)
      };
      await logWebsiteAction(store, interaction, client, `Event card ${index + 1} ${lang.toUpperCase()}`, `Updated ${w.events[index][lang].title}`);
      await interaction.reply({ content: '✅ Website event card saved.', ...eventsPanel(store), flags: MessageFlags.Ephemeral });
      return true;
    }
    if (id === 'site:modal:theme') {
      w.theme = {
        ...w.theme,
        primary: normalizeHex(interaction.fields.getTextInputValue('primary'), w.theme.primary),
        purple: normalizeHex(interaction.fields.getTextInputValue('purple'), w.theme.purple),
        cyan: normalizeHex(interaction.fields.getTextInputValue('cyan'), w.theme.cyan),
        green: normalizeHex(interaction.fields.getTextInputValue('green'), w.theme.green),
        yellow: normalizeHex(interaction.fields.getTextInputValue('yellow'), w.theme.yellow)
      };
      await logWebsiteAction(store, interaction, client, 'Neon theme', `${w.theme.primary} • ${w.theme.purple} • ${w.theme.cyan} • ${w.theme.green} • ${w.theme.yellow}`);
      await interaction.reply({ content: '✅ Neon website colors saved.', ...websitePanel(store), flags: MessageFlags.Ephemeral });
      return true;
    }
  }

  return false;
}

function makeEventId(title) {
  const base = String(title || 'event').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 52) || 'event';
  return `${base}-${Date.now().toString(36).slice(-5)}`;
}

function findEvent(w, id) {
  const needle = String(id || '').trim().toLowerCase();
  return w.events.find(e => String(e.id).toLowerCase() === needle) || null;
}

async function addWebsiteEvent(store, interaction, client, data) {
  const w = ensureWebsite(store);
  const id = makeEventId(data.titleEn);
  const event = {
    id,
    visible: true,
    registrationUrl: validHttpUrl(data.registrationUrl, w.links.discord),
    imageFile: '', imageUrl: '',
    en: { eyebrow: trim(data.categoryEn || 'UPCOMING EVENT', 80), title: trim(data.titleEn, 100), prize: trim(data.prize || '', 80), meta: trim(data.metaEn || '', 140) },
    es: { eyebrow: trim(data.categoryEs || data.categoryEn || 'PRÓXIMO EVENTO', 80), title: trim(data.titleEs || data.titleEn, 100), prize: trim(data.prize || '', 80), meta: trim(data.metaEs || data.metaEn || '', 140) }
  };
  w.events.push(event);
  await logWebsiteAction(store, interaction, client, 'Added website event', `${event.en.title} • ${id}`);
  return event;
}

async function editWebsiteEvent(store, interaction, client, id, patch) {
  const w = ensureWebsite(store); const e = findEvent(w, id); if (!e) throw new Error(`Event ID "${id}" not found.`);
  if (patch.titleEn != null) e.en.title = trim(patch.titleEn,100);
  if (patch.titleEs != null) e.es.title = trim(patch.titleEs,100);
  if (patch.categoryEn != null) e.en.eyebrow = trim(patch.categoryEn,80);
  if (patch.categoryEs != null) e.es.eyebrow = trim(patch.categoryEs,80);
  if (patch.prize != null) { e.en.prize=trim(patch.prize,80); e.es.prize=trim(patch.prize,80); }
  if (patch.metaEn != null) e.en.meta = trim(patch.metaEn,140);
  if (patch.metaEs != null) e.es.meta = trim(patch.metaEs,140);
  if (patch.registrationUrl != null) e.registrationUrl = validHttpUrl(patch.registrationUrl, e.registrationUrl || w.links.discord);
  if (typeof patch.visible === 'boolean') e.visible = patch.visible;
  await logWebsiteAction(store, interaction, client, 'Edited website event', `${e.en.title} • ${e.id}`); return e;
}

async function deleteWebsiteEvent(store, interaction, client, id) {
  const w=ensureWebsite(store); const i=w.events.findIndex(e=>String(e.id).toLowerCase()===String(id).trim().toLowerCase()); if(i<0) throw new Error(`Event ID "${id}" not found.`);
  const [e]=w.events.splice(i,1); if(e.imageFile){try{fs.unlinkSync(path.join(SITE_ASSET_DIR,e.imageFile));}catch{}}
  await logWebsiteAction(store, interaction, client, 'Deleted website event', `${e.en?.title || e.id} • ${e.id}`); return e;
}

async function moveWebsiteEvent(store, interaction, client, id, direction) {
  const w=ensureWebsite(store); const i=w.events.findIndex(e=>String(e.id).toLowerCase()===String(id).trim().toLowerCase()); if(i<0) throw new Error(`Event ID "${id}" not found.`);
  const j=direction==='up'?i-1:i+1; if(j<0||j>=w.events.length) return w.events[i]; [w.events[i],w.events[j]]=[w.events[j],w.events[i]];
  await logWebsiteAction(store, interaction, client, 'Reordered website event', `${w.events[j].en?.title || id} moved ${direction}`); return w.events[j];
}

async function saveEventAttachment(store, attachment, id) {
  const w=ensureWebsite(store); const e=findEvent(w,id); if(!e) throw new Error(`Event ID "${id}" not found.`);
  const contentType=String(attachment.contentType||'').toLowerCase(); const fileName=String(attachment.name||'').toLowerCase();
  if(!(contentType.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(fileName))) throw new Error('Event flyer must be an image.');
  const max=15*1024*1024; if(Number(attachment.size||0)>max) throw new Error('Image must be 15 MB or smaller.');
  const response=await fetch(attachment.url); if(!response.ok) throw new Error(`Could not download attachment (${response.status}).`); const bytes=Buffer.from(await response.arrayBuffer()); if(!bytes.length||bytes.length>max) throw new Error('Attachment size is not allowed.');
  if(e.imageFile){try{fs.unlinkSync(path.join(SITE_ASSET_DIR,e.imageFile));}catch{}}
  const ext=extensionFor(contentType,attachment.name); const filename=`event-${String(e.id).replace(/[^a-zA-Z0-9_-]/g,'-')}${ext}`; fs.writeFileSync(path.join(SITE_ASSET_DIR,filename),bytes); e.imageFile=filename; e.imageUrl=''; w.updatedAt=new Date().toISOString(); store.save();
  return {event:e,filename,bytes:bytes.length,originalName:safeFilename(attachment.name)};
}

function safeFilename(name) {
  return String(name || 'asset.bin').replace(/[^a-zA-Z0-9._-]/g, '-').slice(-90);
}

function extensionFor(contentType, name) {
  const ext = path.extname(String(name || '')).toLowerCase().replace(/[^.a-z0-9]/g, '');
  if (ext && ext.length <= 8) return ext;
  const map = {
    'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif',
    'video/mp4': '.mp4', 'video/webm': '.webm'
  };
  return map[String(contentType || '').toLowerCase()] || '.bin';
}

async function saveWebsiteAttachment(store, attachment, type) {
  const allowed = ['logo', 'league_image', 'hero_image', 'intro_video'];
  if (!allowed.includes(type)) throw new Error('Invalid website media type.');
  const isVideo = type === 'intro_video';
  const contentType = String(attachment.contentType || '').toLowerCase();
  const fileName = String(attachment.name || '').toLowerCase();
  const looksVideo = contentType.startsWith('video/') || /\.(mp4|webm|mov)$/i.test(fileName);
  const looksImage = contentType.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(fileName);
  if (isVideo && !looksVideo) throw new Error('Intro video must be a video file.');
  if (!isVideo && !looksImage) throw new Error('This website media slot requires an image.');
  const max = isVideo ? 50 * 1024 * 1024 : 15 * 1024 * 1024;
  if (Number(attachment.size || 0) > max) throw new Error(isVideo ? 'Video must be 50 MB or smaller.' : 'Image must be 15 MB or smaller.');

  const response = await fetch(attachment.url);
  if (!response.ok) throw new Error(`Could not download the Discord attachment (${response.status}).`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length || bytes.length > max) throw new Error('Attachment size is not allowed.');

  const w = ensureWebsite(store);
  const keyMap = {
    logo: ['logoFile', 'logoUrl'],
    league_image: ['leagueImageFile', 'leagueImageUrl'],
    hero_image: ['heroImageFile', 'heroImageUrl'],
    intro_video: ['introVideoFile', 'introVideoUrl']
  };
  const [fileKey, urlKey] = keyMap[type];
  const ext = extensionFor(contentType, attachment.name);
  const filename = `site-${type.replace('_', '-')}${ext}`;

  for (const old of fs.readdirSync(SITE_ASSET_DIR)) {
    if (old.startsWith(`site-${type.replace('_', '-')}.`)) {
      try { fs.unlinkSync(path.join(SITE_ASSET_DIR, old)); } catch {}
    }
  }
  fs.writeFileSync(path.join(SITE_ASSET_DIR, filename), bytes);
  w.media[fileKey] = filename;
  w.media[urlKey] = '';
  w.updatedAt = new Date().toISOString();
  store.save();
  return { filename, bytes: bytes.length, contentType, originalName: safeFilename(attachment.name) };
}

function requestBase(req) {
  const forced = String(process.env.SITE_PUBLIC_BASE_URL || '').trim().replace(/\/$/, '');
  if (forced) return forced;
  const proto = String(req.headers['x-forwarded-proto'] || 'http').split(',')[0].trim();
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  return host ? `${proto}://${host}` : '';
}

function assetUrl(req, file, fallback = '') {
  if (!file) return fallback || '';
  const base = requestBase(req);
  return base ? `${base}/site/assets/${encodeURIComponent(file)}` : `/site/assets/${encodeURIComponent(file)}`;
}

function publicWebsiteConfig(store, req) {
  const w = ensureWebsite(store);
  return {
    ok: true,
    version: 2,
    botVersion: '8.25.0',
    updatedAt: w.updatedAt,
    enabled: w.enabled !== false,
    registrationOpen: !!w.registrationOpen,
    homepage: w.homepage,
    league: w.league,
    events: w.events.filter(e => e.visible !== false).map(e => ({ ...e, imageUrl: assetUrl(req, e.imageFile, e.imageUrl || '') })),
    links: w.links,
    theme: w.theme,
    media: {
      logoUrl: assetUrl(req, w.media.logoFile, w.media.logoUrl),
      leagueImageUrl: assetUrl(req, w.media.leagueImageFile, w.media.leagueImageUrl),
      heroImageUrl: assetUrl(req, w.media.heroImageFile, w.media.heroImageUrl),
      introVideoUrl: assetUrl(req, w.media.introVideoFile, w.media.introVideoUrl)
    }
  };
}

function contentTypeFor(file) {
  const ext = path.extname(file).toLowerCase();
  return ({ '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.mp4': 'video/mp4', '.webm': 'video/webm' })[ext] || 'application/octet-stream';
}

function createWebsitePublicHandler(store) {
  return async function handleWebsitePublic(req, res) {
    const url = new URL(req.url, 'http://localhost');
    const pathname = url.pathname;
    if (!pathname.startsWith('/site/')) return false;
    const origin = process.env.SITE_CORS_ORIGIN || '*';
    const cors = {
      'access-control-allow-origin': origin,
      'access-control-allow-methods': 'GET, OPTIONS',
      'access-control-allow-headers': 'content-type',
      'cache-control': 'no-store'
    };
    if (req.method === 'OPTIONS') {
      res.writeHead(204, cors);
      res.end();
      return true;
    }
    if (req.method === 'GET' && pathname === '/site/status') {
      res.writeHead(200, { ...cors, 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true, service: 'KIXO | GFX STUDIO', version: '8.25.0', publicWebsiteApi: true }));
      return true;
    }
    if (req.method === 'GET' && pathname === '/site/config') {
      res.writeHead(200, { ...cors, 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(publicWebsiteConfig(store, req)));
      return true;
    }
    if (req.method === 'GET' && pathname.startsWith('/site/assets/')) {
      const name = decodeURIComponent(pathname.slice('/site/assets/'.length));
      if (!name || name !== path.basename(name)) {
        res.writeHead(400, { ...cors, 'content-type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'Invalid asset path' }));
        return true;
      }
      const full = path.join(SITE_ASSET_DIR, name);
      if (!fs.existsSync(full)) {
        res.writeHead(404, { ...cors, 'content-type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'Asset not found' }));
        return true;
      }
      res.writeHead(200, { ...cors, 'content-type': contentTypeFor(full), 'cache-control': 'public, max-age=300' });
      fs.createReadStream(full).pipe(res);
      return true;
    }
    res.writeHead(404, { ...cors, 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Not found' }));
    return true;
  };
}

module.exports = {
  ensureWebsite,
  websitePanel,
  smtControlCenter,
  handleWebsiteInteraction,
  saveWebsiteAttachment,
  logWebsiteAction,
  createWebsitePublicHandler,
  publicWebsiteConfig,
  addWebsiteEvent, editWebsiteEvent, deleteWebsiteEvent, moveWebsiteEvent, saveEventAttachment
};
