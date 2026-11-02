const fs = require('fs');
const path = require('path');
const {
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
  MessageFlags,
  StringSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  RoleSelectMenuBuilder,
  UserSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');
const { brandColor } = require('./embeds');
const { DATA_DIR } = require('./store');

const STYLE_MAP = {
  primary: ButtonStyle.Primary,
  secondary: ButtonStyle.Secondary,
  success: ButtonStyle.Success,
  danger: ButtonStyle.Danger
};
const openCooldowns = new Map();
const TICKET_ASSET_DIR = path.join(DATA_DIR, 'ticket-assets');
fs.mkdirSync(TICKET_ASSET_DIR, { recursive: true });

function parsePanelColor(value) {
  const raw = String(value || '').trim();
  if (/^#[0-9a-f]{6}$/i.test(raw)) return Number.parseInt(raw.slice(1), 16);
  if (/^[0-9a-f]{6}$/i.test(raw)) return Number.parseInt(raw, 16);
  return brandColor();
}

function normalizeHexColor(value) {
  const raw = String(value || '').trim();
  if (/^#[0-9a-f]{6}$/i.test(raw)) return raw.toUpperCase();
  if (/^[0-9a-f]{6}$/i.test(raw)) return `#${raw.toUpperCase()}`;
  return '#FF2D8B';
}

function normalizeCommandTrigger(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^[/!?.#-]+/, '')
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
}

function ticketCustomCommands(store) {
  ensureTicketData(store);
  return store.data.ticketCustomCommands;
}

function newCustomCommandId() {
  return `tc-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function findCustomCommand(store, idOrTrigger) {
  const needle = String(idOrTrigger || '').toLowerCase();
  return ticketCustomCommands(store).find(cmd => cmd.id === idOrTrigger || cmd.trigger === needle) || null;
}

function ticketAttachment(relativePath, fallbackName) {
  if (!relativePath) return null;
  const base = path.resolve(DATA_DIR);
  const fullPath = path.resolve(DATA_DIR, relativePath);
  if (!fullPath.startsWith(base) || !fs.existsSync(fullPath)) return null;
  const name = path.basename(fullPath) || fallbackName;
  return { attachment: new AttachmentBuilder(fullPath, { name }), name };
}

function ensureTicketData(store) {
  if (!Array.isArray(store.data.ticketTypes)) store.data.ticketTypes = [];
  if (!store.data.tickets || typeof store.data.tickets !== 'object') store.data.tickets = {};
  if (!Number.isFinite(Number(store.data.ticketCounter))) store.data.ticketCounter = 0;
  const s = store.data.settings;
  if (typeof s.ticketClosedCategoryId !== 'string') s.ticketClosedCategoryId = '';
  if (typeof s.ticketClaimedCategoryId !== 'string') s.ticketClaimedCategoryId = '';
  if (typeof s.ticketPanelFooter !== 'string') s.ticketPanelFooter = 'KIXO • Support Tickets';
  if (typeof s.ticketPanelColor !== 'string') s.ticketPanelColor = '#FF2D8B';
  if (typeof s.ticketLogoUrl !== 'string') s.ticketLogoUrl = '';
  if (typeof s.ticketBannerUrl !== 'string') s.ticketBannerUrl = '';
  if (typeof s.ticketLogoFile !== 'string') s.ticketLogoFile = '';
  if (typeof s.ticketBannerFile !== 'string') s.ticketBannerFile = '';
  if (typeof s.ticketCreatedReplyTemplate !== 'string') s.ticketCreatedReplyTemplate = '✅ Your **{type}** ticket is ready: {channel}';
  if (typeof s.ticketCommandPrefix !== 'string' || !s.ticketCommandPrefix.trim()) s.ticketCommandPrefix = '!';
  if (typeof s.ticketAutoDeleteEnabled !== 'boolean') s.ticketAutoDeleteEnabled = true;
  const configuredAutoDeleteHours = Number(s.ticketAutoDeleteHours);
  s.ticketAutoDeleteHours = Number.isFinite(configuredAutoDeleteHours) ? Math.min(720, Math.max(1, Math.round(configuredAutoDeleteHours))) : 24;
  if (!Array.isArray(store.data.ticketCustomCommands)) store.data.ticketCustomCommands = [];
  store.data.ticketCustomCommands = store.data.ticketCustomCommands.slice(0, 25).map((cmd, index) => ({
    id: String(cmd?.id || `cmd-${index + 1}`).slice(0, 60),
    trigger: normalizeCommandTrigger(cmd?.trigger || `command${index + 1}`),
    title: String(cmd?.title || '').slice(0, 256),
    message: String(cmd?.message || '').slice(0, 4000),
    color: normalizeHexColor(cmd?.color || '#FF2D8B'),
    footer: String(cmd?.footer || '').slice(0, 200)
  })).filter(cmd => cmd.trigger && cmd.message);
  for (const type of store.data.ticketTypes) {
    if (!Array.isArray(type.questions)) type.questions = [];
    if (typeof type.staffRoleId !== 'string') type.staffRoleId = '';
    if (typeof type.approvalRoleId !== 'string') type.approvalRoleId = '';
    if (typeof type.approvalEnabled !== 'boolean') type.approvalEnabled = false;
    if (typeof type.approvalCreateChannel !== 'boolean') type.approvalCreateChannel = false;
    if (typeof type.approvalCategoryId !== 'string') type.approvalCategoryId = '';
    if (typeof type.approvalChannelNameTemplate !== 'string' || !type.approvalChannelNameTemplate.trim()) type.approvalChannelNameTemplate = 'partner-{server}';
    if (typeof type.partnerRulesEn !== 'string') type.partnerRulesEn = '';
    if (typeof type.partnerRulesEs !== 'string') type.partnerRulesEs = '';
  }
  for (const ticket of Object.values(store.data.tickets)) {
    if (!Array.isArray(ticket.extraUsers)) ticket.extraUsers = [];
    if (!Array.isArray(ticket.notes)) ticket.notes = [];
    if (!Array.isArray(ticket.answers)) ticket.answers = [];
    if (typeof ticket.claimedBy !== 'string') ticket.claimedBy = '';
    if (typeof ticket.decision !== 'string') ticket.decision = '';
    if (typeof ticket.decidedBy !== 'string') ticket.decidedBy = '';
    if (typeof ticket.decidedAt !== 'string') ticket.decidedAt = '';
    if (typeof ticket.autoDeleteAfter !== 'string') ticket.autoDeleteAfter = '';
    if (typeof ticket.preClaimCategoryId !== 'string') ticket.preClaimCategoryId = '';
  }
}

function ticketTypes(store) {
  ensureTicketData(store);
  return store.data.ticketTypes;
}

function findType(store, id) {
  return ticketTypes(store).find(x => x.id === id) || null;
}

function findTicket(store, channelId) {
  ensureTicketData(store);
  return store.data.tickets[channelId] || null;
}

function ticketAutoDeleteHours(store) {
  const value = Number(store.data.settings.ticketAutoDeleteHours);
  return Number.isFinite(value) ? Math.min(720, Math.max(1, Math.round(value))) : 24;
}

function ticketAutoDeleteDeadline(store, from = Date.now()) {
  return new Date(Number(from) + ticketAutoDeleteHours(store) * 60 * 60 * 1000).toISOString();
}

function resetOpenUnclaimedAutoDeleteDeadlines(store) {
  ensureTicketData(store);
  const now = Date.now();
  let updated = 0;
  for (const ticket of Object.values(store.data.tickets || {})) {
    if (!ticket || ticket.status !== 'open') continue;
    if (ticket.claimedBy) {
      if (ticket.autoDeleteAfter) { ticket.autoDeleteAfter = ''; updated++; }
      continue;
    }
    ticket.autoDeleteAfter = ticketAutoDeleteDeadline(store, now);
    updated++;
  }
  if (updated) store.save();
  return updated;
}

function safeEmoji(button, emoji) {
  const value = String(emoji || '').trim();
  if (!value) return button;
  try { button.setEmoji(value); } catch {}
  return button;
}

function memberTicketPermissions() {
  return {
    ViewChannel: true,
    SendMessages: true,
    ReadMessageHistory: true,
    AttachFiles: true,
    EmbedLinks: true
  };
}

function configuredStaffRoleIds(store, type = null) {
  const ids = new Set(store.data.settings.staffRoleIds || []);
  if (type?.staffRoleId) ids.add(type.staffRoleId);
  return [...ids].filter(Boolean);
}

function botCanManageRole(guild, roleId) {
  const role = guild.roles.cache.get(roleId);
  const me = guild.members.me;
  if (!role || !me) return false;
  if (role.managed) return false;
  if (role.id === guild.roles.everyone.id) return true;
  return me.roles.highest.comparePositionTo(role) > 0;
}

function ticketPermissionDiagnostics(guild, category, store, type) {
  const me = guild.members.me;
  const problems = [];
  if (!me) {
    problems.push('I could not resolve my own bot member in this server.');
    return problems;
  }

  const guildPerms = me.permissions;
  if (!guildPerms.has(PermissionFlagsBits.ManageChannels)) problems.push('My bot role is missing **Manage Channels**.');
  if (!guildPerms.has(PermissionFlagsBits.ManageRoles)) problems.push('My bot role is missing **Manage Roles** (Discord uses this for channel permission overwrites).');

  if (category) {
    const inCategory = category.permissionsFor(me);
    if (!inCategory?.has(PermissionFlagsBits.ViewChannel)) problems.push(`I cannot **View Channel** in the destination category **${category.name}**.`);
    if (!inCategory?.has(PermissionFlagsBits.ManageChannels)) problems.push(`I do not have **Manage Channels** inside the destination category **${category.name}**.`);
  }

  for (const roleId of configuredStaffRoleIds(store, type)) {
    const role = guild.roles.cache.get(roleId);
    if (!role) {
      problems.push(`A configured ticket staff role (${roleId}) no longer exists.`);
      continue;
    }
    const categoryAlreadyAllows = category?.permissionsFor(role)?.has(PermissionFlagsBits.ViewChannel);
    if (!categoryAlreadyAllows && !botCanManageRole(guild, roleId)) {
      problems.push(`The staff role **${role.name}** is above my bot role (or is managed). Move the bot role above it, or grant that role access directly on the destination category.`);
    }
  }
  return problems;
}

async function applyTicketAccess(channel, guild, store, type, ownerId, extraUsers = [], category = null) {
  // Do not clone every category overwrite. Discord can reject cloned overwrites
  // that reference roles above the bot. The channel inherits the category, and
  // we add only the private/member overrides that are actually needed.
  await channel.permissionOverwrites.edit(guild.roles.everyone.id, { ViewChannel: false });
  await channel.permissionOverwrites.edit(ownerId, memberTicketPermissions());
  for (const userId of extraUsers || []) {
    await channel.permissionOverwrites.edit(userId, memberTicketPermissions());
  }

  for (const roleId of configuredStaffRoleIds(store, type)) {
    const role = guild.roles.cache.get(roleId);
    if (!role) continue;
    // If the category already grants the role visibility, keep that inherited
    // access and avoid touching the role. This is especially important when the
    // staff role sits above the bot in the hierarchy.
    if (category?.permissionsFor(role)?.has(PermissionFlagsBits.ViewChannel)) continue;
    if (!botCanManageRole(guild, roleId)) continue;
    await channel.permissionOverwrites.edit(roleId, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
      AttachFiles: true,
      EmbedLinks: true
    });
  }

}

async function resolveClaimedTicketCategory(guild, store, createIfMissing = true) {
  ensureTicketData(store);
  const s = store.data.settings;
  if (s.ticketClaimedCategoryId) {
    const configured = await guild.channels.fetch(s.ticketClaimedCategoryId).catch(() => null);
    if (configured?.type === ChannelType.GuildCategory) return configured;
    s.ticketClaimedCategoryId = '';
    store.save();
  }

  if (!createIfMissing) return null;

  const existing = guild.channels.cache.find(channel =>
    channel.type === ChannelType.GuildCategory && String(channel.name || '').toUpperCase() === '📌 CLAIMED TICKETS'
  );
  if (existing) {
    s.ticketClaimedCategoryId = existing.id;
    store.save();
    return existing;
  }

  const created = await guild.channels.create({
    name: '📌 CLAIMED TICKETS',
    type: ChannelType.GuildCategory,
    reason: 'KIXO claimed-ticket category'
  });
  s.ticketClaimedCategoryId = created.id;
  store.save();
  return created;
}

async function moveTicketForClaimState(channel, guild, store, ticket) {
  if (!channel || !ticket) return { moved: false, category: null };
  const type = findType(store, ticket.typeId);

  if (ticket.claimedBy) {
    if (!ticket.preClaimCategoryId) ticket.preClaimCategoryId = channel.parentId || ticket.categoryId || type?.categoryId || '';
    const claimedCategory = await resolveClaimedTicketCategory(guild, store, true);
    if (!claimedCategory) return { moved: false, category: null };
    if (channel.parentId !== claimedCategory.id) {
      await channel.setParent(claimedCategory.id, { lockPermissions: false, reason: `KIXO ticket #${String(ticket.number || 0).padStart(4, '0')} claimed` });
    }
    await applyTicketAccess(channel, guild, store, type, ticket.userId, ticket.extraUsers || [], claimedCategory);
    return { moved: true, category: claimedCategory };
  }

  const restoreId = ticket.preClaimCategoryId || ticket.categoryId || type?.categoryId || '';
  ticket.preClaimCategoryId = '';
  let restoreCategory = null;
  if (restoreId) {
    restoreCategory = await guild.channels.fetch(restoreId).catch(() => null);
    if (restoreCategory?.type === ChannelType.GuildCategory) {
      if (channel.parentId !== restoreCategory.id) {
        await channel.setParent(restoreCategory.id, { lockPermissions: false, reason: `KIXO ticket #${String(ticket.number || 0).padStart(4, '0')} unclaimed` });
      }
      await applyTicketAccess(channel, guild, store, type, ticket.userId, ticket.extraUsers || [], restoreCategory);
      return { moved: true, category: restoreCategory };
    }
  }

  const claimedCategory = await resolveClaimedTicketCategory(guild, store, false);
  if (claimedCategory && channel.parentId === claimedCategory.id) {
    await channel.setParent(null, { lockPermissions: false, reason: `KIXO ticket #${String(ticket.number || 0).padStart(4, '0')} unclaimed` });
  }
  await applyTicketAccess(channel, guild, store, type, ticket.userId, ticket.extraUsers || [], null);
  return { moved: true, category: null };
}

async function moveAllClaimedTicketsToCategory(guild, store, category) {
  ensureTicketData(store);
  let moved = 0;
  let failed = 0;
  for (const ticket of Object.values(store.data.tickets || {})) {
    if (!ticket || ticket.status !== 'open' || !ticket.claimedBy) continue;
    const channel = await guild.channels.fetch(ticket.channelId).catch(() => null);
    if (!channel?.isTextBased?.()) continue;
    const type = findType(store, ticket.typeId);
    try {
      if (!ticket.preClaimCategoryId && channel.parentId !== category.id) {
        ticket.preClaimCategoryId = channel.parentId || ticket.categoryId || type?.categoryId || '';
      }
      if (channel.parentId !== category.id) {
        await channel.setParent(category.id, { lockPermissions: false, reason: 'KIXO claimed-ticket category updated' });
      }
      await applyTicketAccess(channel, guild, store, type, ticket.userId, ticket.extraUsers || [], category);
      moved++;
    } catch {
      failed++;
    }
  }
  store.save();
  return { moved, failed };
}

function claimedCategoryAdminPanel(store, notice = '') {
  ensureTicketData(store);
  const id = store.data.settings.ticketClaimedCategoryId;
  const embed = new EmbedBuilder()
    .setColor(brandColor())
    .setTitle('🙋 CLAIMED TICKET CATEGORY')
    .setDescription([
      notice ? `**${notice}**\n` : '',
      `**Current Category:** ${id ? `<#${id}>` : '**Automatic — the bot will create 📌 CLAIMED TICKETS on the first claim**'}`,
      '',
      'When staff presses **Claim Ticket**, the ticket moves into this category and the automatic close timer is disabled.',
      'When the same staff member presses **Unclaim Ticket**, the ticket returns to its previous department category and receives a fresh auto-close timer.',
      '',
      'Choose an existing category below, or leave it on Automatic.'
    ].filter(Boolean).join('\n'))
    .setFooter({ text: 'KIXO • Claimed Tickets' });
  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder().setCustomId('ticketadmin:claimed-category-select').setPlaceholder('Choose category for claimed tickets').setChannelTypes(ChannelType.GuildCategory).setMinValues(1).setMaxValues(1)
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticketadmin:claimed-category-clear').setLabel('Use Automatic').setEmoji('♻️').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('ticketadmin:claimed-category-back').setLabel('Back').setEmoji('⬅️').setStyle(ButtonStyle.Secondary)
      )
    ]
  };
}

function panelEmbed(store) {
  ensureTicketData(store);
  const s = store.data.settings;
  const embed = new EmbedBuilder()
    .setColor(parsePanelColor(s.ticketPanelColor || '#FF2D8B'))
    .setTitle(String(s.ticketPanelTitle || '🎫 KIXO Support').slice(0, 256))
    .setDescription(String(s.ticketPanelText || 'Choose the type of support you need below. A private ticket will be created for you and the correct staff team.').slice(0, 4096));
  if (s.ticketPanelFooter) embed.setFooter({ text: String(s.ticketPanelFooter).slice(0, 2048) });

  const files = [];
  const logo = ticketAttachment(s.ticketLogoFile, 'ticket-logo.png');
  const banner = ticketAttachment(s.ticketBannerFile, 'ticket-banner.png');
  if (logo) {
    files.push(logo.attachment);
    embed.setThumbnail(`attachment://${logo.name}`);
  } else if (s.ticketLogoUrl) {
    embed.setThumbnail(String(s.ticketLogoUrl).slice(0, 2000));
  }
  if (banner) {
    files.push(banner.attachment);
    embed.setImage(`attachment://${banner.name}`);
  } else if (s.ticketBannerUrl) {
    embed.setImage(String(s.ticketBannerUrl).slice(0, 2000));
  }
  return { embed, files };
}

function ticketPanel(store) {
  const types = ticketTypes(store).slice(0, 25);
  const rows = [];
  for (let i = 0; i < types.length; i += 5) {
    const row = new ActionRowBuilder();
    for (const type of types.slice(i, i + 5)) {
      const button = new ButtonBuilder()
        .setCustomId(`ticket:create:${type.id}`)
        .setLabel(String(type.label || 'Support').slice(0, 80))
        .setStyle(STYLE_MAP[String(type.style || 'secondary').toLowerCase()] || ButtonStyle.Secondary);
      safeEmoji(button, type.emoji);
      row.addComponents(button);
    }
    rows.push(row);
  }
  const built = panelEmbed(store);
  const payload = { embeds: [built.embed], components: rows };
  if (built.files.length) payload.files = built.files;
  return payload;
}

function ticketStats(store) {
  const tickets = Object.values(store.data.tickets || {});
  return {
    total: tickets.length,
    open: tickets.filter(t => t.status === 'open').length,
    closed: tickets.filter(t => t.status === 'closed').length,
    claimed: tickets.filter(t => t.status === 'open' && t.claimedBy).length
  };
}

function adminEmbed(store, selectedId = '', notice = '') {
  const types = ticketTypes(store);
  const selected = findType(store, selectedId) || types[0] || null;
  const enabled = store.data.settings.features?.tickets !== false;
  const destination = selected?.categoryId ? `<#${selected.categoryId}>` : '**Not set**';
  const team = selected?.staffRoleId ? `<@&${selected.staffRoleId}>` : '**Category/global staff**';
  const transcript = store.data.settings.ticketTranscriptChannelId ? `<#${store.data.settings.ticketTranscriptChannelId}>` : '**Not set**';
  const archive = store.data.settings.ticketClosedCategoryId ? `<#${store.data.settings.ticketClosedCategoryId}>` : '**Lock in place**';
  const stats = ticketStats(store);

  const lines = [
    notice ? `**${notice}**\n` : '',
    `**System:** ${enabled ? '🟢 ON' : '🔴 OFF'}  •  **Buttons:** ${types.length}/25`,
    `**Open:** ${stats.open}  •  **Claimed:** ${stats.claimed}  •  **Closed:** ${stats.closed}`,
    `**Transcript Log:** ${transcript}`,
    `**Closed Archive:** ${archive}`,
    '',
    '**Selected Department**',
    selected
      ? `**${selected.emoji || '🎫'} ${selected.label}**\nDestination: ${destination}\nStaff Team: ${team}\nForm Questions: **${selected.questions?.length || 0}/4**\nApproval Workflow: **${selected.approvalEnabled ? '🟢 ON' : '⚪ OFF'}**${selected.approvalRoleId ? ` • Role: <@&${selected.approvalRoleId}>` : ''}\nOpen tickets: **${Object.values(store.data.tickets || {}).filter(t => t.status === 'open' && t.typeId === selected.id).length}**`
      : '*No ticket buttons yet. Press Add Department.*',
    '',
    'Tickets support **pictures/files**, claim, transfer, add/remove members, staff notes, rename, close reasons, transcripts, archive and reopen.'
  ].filter(Boolean);

  return new EmbedBuilder()
    .setColor(brandColor())
    .setTitle('🎫 KIXO • ADVANCED TICKET ADMIN')
    .setDescription(lines.join('\n'))
    .setFooter({ text: 'Private staff control panel • saved to /data' })
    .setTimestamp();
}

function ticketAdminPanel(store, selectedId = '', notice = '') {
  const types = ticketTypes(store);
  const selected = findType(store, selectedId) || types[0] || null;
  const rows = [];

  if (types.length) {
    rows.push(new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('ticketadmin:select')
        .setPlaceholder('Choose a ticket department')
        .setMinValues(1)
        .setMaxValues(1)
        .addOptions(types.slice(0, 25).map(type => ({
          label: String(type.label || 'Support').slice(0, 100),
          value: type.id,
          description: type.categoryId ? 'Destination configured' : 'Destination not set',
          emoji: type.emoji || undefined,
          default: selected?.id === type.id
        })))
    ));

    rows.push(new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId(`ticketadmin:category:${selected.id}`)
        .setPlaceholder(selected.categoryId ? 'Change destination category' : 'Choose destination category')
        .setChannelTypes(ChannelType.GuildCategory)
        .setMinValues(1)
        .setMaxValues(1)
    ));

    rows.push(new ActionRowBuilder().addComponents(
      new RoleSelectMenuBuilder()
        .setCustomId(`ticketadmin:staffrole:${selected.id}`)
        .setPlaceholder(selected.staffRoleId ? 'Change department staff role' : 'Choose department staff role (optional)')
        .setMinValues(1)
        .setMaxValues(1)
    ));
  } else {
    rows.push(new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('ticketadmin:empty')
        .setPlaceholder('No ticket departments created yet')
        .setDisabled(true)
        .addOptions({ label: 'Press Add Department below', value: 'empty' })
    ));
  }

  rows.push(new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId('ticketadmin:post')
      .setPlaceholder('Post ticket panel in a channel')
      .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
      .setMinValues(1)
      .setMaxValues(1)
  ));

  rows.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticketadmin:add').setLabel('Add Department').setEmoji('➕').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`ticketadmin:edit:${selected?.id || 'none'}`).setLabel('Edit').setEmoji('✏️').setStyle(ButtonStyle.Primary).setDisabled(!selected),
    new ButtonBuilder().setCustomId('ticketadmin:advanced').setLabel('Settings').setEmoji('⚙️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`ticketadmin:workflow:${selected?.id || 'none'}`).setLabel('Approval').setEmoji('✅').setStyle(ButtonStyle.Secondary).setDisabled(!selected),
    new ButtonBuilder().setCustomId(`ticketadmin:delete:${selected?.id || 'none'}`).setLabel('Delete').setEmoji('🗑️').setStyle(ButtonStyle.Danger).setDisabled(!selected)
  ));

  return { embeds: [adminEmbed(store, selected?.id || '', notice)], components: rows };
}


function sanitizeChannelName(value) {
  return String(value || 'partner')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-_ ]+/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 90) || 'partner';
}

function renderApprovalChannelName(type, ticket, member) {
  const firstAnswer = String(ticket?.answers?.[0]?.answer || ticket?.answers?.[0] || '').trim();
  const template = String(type?.approvalChannelNameTemplate || 'partner-{server}');
  const rendered = template
    .replaceAll('{username}', member?.user?.username || 'member')
    .replaceAll('{displayname}', member?.displayName || member?.user?.username || 'member')
    .replaceAll('{server}', firstAnswer || member?.user?.username || 'partner')
    .replaceAll('{number}', String(ticket?.number || 0).padStart(4, '0'));
  return sanitizeChannelName(rendered);
}

function approvalAccessChoicePayload(type) {
  const canCreate = Boolean(type?.approvalCreateChannel && type?.approvalCategoryId);
  const embed = new EmbedBuilder()
    .setColor(brandColor())
    .setTitle('✅ Approve Partnership')
    .setDescription([
      'Choose how you want to give this approved partner access:',
      '',
      '🆕 **Create New Channel** — enter a new channel name and I will create it under the configured partner category.',
      '🔗 **Give Existing Channel** — select an existing text channel and I will give the ticket owner permission to view and post there.',
      '✅ **Approve Only** — approve the partnership and give the configured role without changing channel access.'
    ].join('\n'));

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('ticket:decision:approve-create')
          .setLabel('Create New Channel')
          .setEmoji('🆕')
          .setStyle(ButtonStyle.Success)
          .setDisabled(!canCreate),
        new ButtonBuilder()
          .setCustomId('ticket:decision:approve-existing')
          .setLabel('Give Existing Channel')
          .setEmoji('🔗')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('ticket:decision:approve-only')
          .setLabel('Approve Only')
          .setEmoji('✅')
          .setStyle(ButtonStyle.Secondary)
      )
    ]
  };
}

function approvalExistingChannelPayload() {
  return {
    embeds: [
      new EmbedBuilder()
        .setColor(brandColor())
        .setTitle('🔗 Give Partner Access to Existing Channel')
        .setDescription('Select the text channel this approved partner should be able to **view and post in**.')
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId('ticket:decision:existing-channel')
          .setPlaceholder('Select an existing partner channel')
          .addChannelTypes(ChannelType.GuildText)
          .setMinValues(1)
          .setMaxValues(1)
      )
    ]
  };
}

function approvalDecisionChannelNameModal(ticket) {
  return new ModalBuilder()
    .setCustomId(`ticket:decision:approve-name:${ticket.channelId || ticket.id || 'current'}`)
    .setTitle('Approve Partnership')
    .addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('channelName')
        .setLabel('New partnership channel name')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(90)
        .setPlaceholder('mythic-partner')
    ));
}

function approvalChannelNameModal(type) {
  return new ModalBuilder()
    .setCustomId(`ticketadmin:modal:approvalchannel:${type.id}`)
    .setTitle('Approved Partner Channel')
    .addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('template')
        .setLabel('Channel name template')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(90)
        .setValue(String(type.approvalChannelNameTemplate || 'partner-{server}').slice(0, 90))
        .setPlaceholder('partner-{server}')
    ));
}

function approvalWorkflowPanel(store, typeId, notice = '') {
  const type = findType(store, typeId);
  if (!type) return ticketAdminPanel(store, '', 'That department no longer exists.');
  const roleText = type.approvalRoleId ? `<@&${type.approvalRoleId}>` : '**No role selected**';
  const categoryText = type.approvalCategoryId ? `<#${type.approvalCategoryId}>` : '**No category selected**';
  const label = String(type.label || 'Application').slice(0, 80);
  const embed = new EmbedBuilder()
    .setColor(brandColor())
    .setTitle(`✅ APPROVAL WORKFLOW • ${label}`)
    .setDescription([
      notice ? `**${notice}**\n` : '',
      `**Workflow:** ${type.approvalEnabled ? '🟢 ON' : '⚪ OFF'}`,
      `**Role given on approval:** ${roleText}`,
      `**Create partner channel on approval:** ${type.approvalCreateChannel ? '🟢 ON' : '⚪ OFF'}`,
      `**Approved channel category:** ${categoryText}`,
      `**Approved channel name:** \`${String(type.approvalChannelNameTemplate || 'partner-{server}').slice(0, 90)}\``,
      `**Questions before ticket opens:** ${type.questions?.length || 0}/4`,
      `**English partnership rules:** ${type.partnerRulesEn?.trim() ? '✅ Set' : 'Not set'}`,
      `**Spanish partnership rules:** ${type.partnerRulesEs?.trim() ? '✅ Set' : 'Not set'}`,
      '',
      'When approved, the bot can give the selected role **and** automatically create a new text channel under the selected category.',
      'The approved channel inherits the permissions from that category.',
      'Channel-name variables: `{server}` = first application answer, `{username}`, `{displayname}`, `{number}`.',
      'Example: `partner-{server}` → `partner-kixo-esports`.',
      'If bilingual rules are set, new tickets also show **English** and **Español** buttons so the applicant can open the rules privately.'
    ].filter(Boolean).join('\n'))
    .setFooter({ text: 'KIXO • Ticket Approval Workflow' });

  const rows = [
    new ActionRowBuilder().addComponents(
      new RoleSelectMenuBuilder()
        .setCustomId(`ticketadmin:approvalrole:${type.id}`)
        .setPlaceholder(type.approvalRoleId ? 'Change role given on approval' : 'Choose role given on approval')
        .setMinValues(1)
        .setMaxValues(1)
    ),
    new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId(`ticketadmin:approvalcategory:${type.id}`)
        .setPlaceholder(type.approvalCategoryId ? 'Change approved-partner category' : 'Choose approved-partner category')
        .setChannelTypes(ChannelType.GuildCategory)
        .setMinValues(1)
        .setMaxValues(1)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`ticketadmin:rules-en:${type.id}`).setLabel('Edit English Rules').setEmoji('🇺🇸').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`ticketadmin:rules-es:${type.id}`).setLabel('Editar Reglas Español').setEmoji('🇲🇽').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`ticketadmin:rules-clear:${type.id}`).setLabel('Clear Rules').setEmoji('🗑️').setStyle(ButtonStyle.Secondary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`ticketadmin:approvalchannel-toggle:${type.id}`).setLabel(type.approvalCreateChannel ? 'Disable Channel' : 'Create Channel: OFF').setEmoji('📁').setStyle(type.approvalCreateChannel ? ButtonStyle.Danger : ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`ticketadmin:approvalchannel-name:${type.id}`).setLabel('Channel Name').setEmoji('✏️').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`ticketadmin:approvalcategory-clear:${type.id}`).setLabel('Clear Category').setStyle(ButtonStyle.Secondary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`ticketadmin:workflow-toggle:${type.id}`).setLabel(type.approvalEnabled ? 'Disable Approval' : 'Enable Approval').setStyle(type.approvalEnabled ? ButtonStyle.Danger : ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`ticketadmin:approvalrole-clear:${type.id}`).setLabel('Clear Role').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`ticketadmin:workflow-back:${type.id}`).setLabel('Back').setEmoji('⬅️').setStyle(ButtonStyle.Secondary)
    )
  ];
  return { embeds: [embed], components: rows };
}

function advancedAdminPanel(store, notice = '') {
  ensureTicketData(store);
  const s = store.data.settings;
  const enabled = s.features?.tickets !== false;
  const transcript = s.ticketTranscriptChannelId ? `<#${s.ticketTranscriptChannelId}>` : '**Not set**';
  const archive = s.ticketClosedCategoryId ? `<#${s.ticketClosedCategoryId}>` : '**Not set — closed tickets stay locked in place**';
  const claimedCategory = s.ticketClaimedCategoryId ? `<#${s.ticketClaimedCategoryId}>` : '**Automatic — creates 📌 CLAIMED TICKETS**';
  const hasLogo = Boolean(s.ticketLogoFile || s.ticketLogoUrl);
  const hasBanner = Boolean(s.ticketBannerFile || s.ticketBannerUrl);
  const embed = new EmbedBuilder()
    .setColor(brandColor())
    .setTitle('⚙️ TICKET SYSTEM SETTINGS')
    .setDescription([
      notice ? `**${notice}**\n` : '',
      `**Ticket System:** ${enabled ? '🟢 ON' : '🔴 OFF'}`,
      `**Transcript / Activity Log:** ${transcript}`,
      `**Closed Ticket Archive:** ${archive}`,
      `**Claimed Ticket Category:** ${claimedCategory}`,
      `**Auto Close Unclaimed:** ${s.ticketAutoDeleteEnabled ? `🟢 ON after **${ticketAutoDeleteHours(store)}h**` : '🔴 OFF'}  •  Claimed tickets are protected`,
      '',
      '**Public Panel Branding**',
      `**Title:** ${String(s.ticketPanelTitle || '🎫 KIXO Support').slice(0, 100)}`,
      `**Bio / Description:** ${String(s.ticketPanelText || '').slice(0, 180) || 'Not set'}`,
      `**Color:** ${s.ticketPanelColor || '#FF2D8B'}`,
      `**Logo:** ${hasLogo ? '✅ Set' : 'Not set'}  •  **Banner:** ${hasBanner ? '✅ Set' : 'Not set'}`,
      '',
      '**Ticket-Created Confirmation**',
      String(s.ticketCreatedReplyTemplate || '✅ Your **{type}** ticket is ready: {channel}').slice(0, 240),
      'Variables: `{type}` `{channel}` `{user}` `{username}` `{number}` `{server}`',
      '',
      '**Custom Ticket Commands**',
      `Prefix: **${String(s.ticketCommandPrefix || '!').slice(0, 5)}**  •  Commands: **${ticketCustomCommands(store).length}/50**`,
      'Staff can run custom commands inside an open ticket and the bot will automatically tag the ticket opener.',
      '',
      'Open **unclaimed** tickets automatically close and are archived after the configured time. Claimed tickets are protected.',
      'If staff unclaims a ticket, a fresh auto-close timer starts. Closed tickets and their messages are preserved until staff explicitly deletes them.',
      'Use the controls below to edit the public ticket panel and the private ticket-created reply directly from Discord.'
    ].filter(Boolean).join('\n'))
    .setFooter({ text: 'KIXO • Advanced Tickets' });

  const rows = [
    new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder().setCustomId('ticketadmin:transcript').setPlaceholder('Choose transcript / activity log channel').setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setMinValues(1).setMaxValues(1)
    ),
    new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder().setCustomId('ticketadmin:archive').setPlaceholder('Choose closed-ticket archive category').setChannelTypes(ChannelType.GuildCategory).setMinValues(1).setMaxValues(1)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticketadmin:panel-edit').setLabel('Edit Title / Bio').setEmoji('✏️').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('ticketadmin:upload:logo').setLabel('Upload Logo').setEmoji('🖼️').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('ticketadmin:upload:banner').setLabel('Upload Banner').setEmoji('🌄').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('ticketadmin:panel-preview').setLabel('Preview').setEmoji('👁️').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('ticketadmin:clear-images').setLabel('Clear Images').setEmoji('🗑️').setStyle(ButtonStyle.Secondary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticketadmin:open-reply').setLabel('Open Confirmation').setEmoji('💬').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('ticketadmin:custom').setLabel('Custom Commands').setEmoji('⌨️').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('ticketadmin:permissions').setLabel('Permissions Check').setEmoji('🔐').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('ticketadmin:toggle').setLabel(enabled ? 'Disable Tickets' : 'Enable Tickets').setStyle(enabled ? ButtonStyle.Danger : ButtonStyle.Success),
      new ButtonBuilder().setCustomId('ticketadmin:back').setLabel('Back').setEmoji('⬅️').setStyle(ButtonStyle.Secondary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticketadmin:autodelete-toggle').setLabel(s.ticketAutoDeleteEnabled ? 'Auto Close: ON' : 'Auto Close: OFF').setEmoji('🧹').setStyle(s.ticketAutoDeleteEnabled ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('ticketadmin:autodelete-hours').setLabel(`Set ${ticketAutoDeleteHours(store)}h`).setEmoji('⏱️').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('ticketadmin:claimed-category').setLabel('Claimed Category').setEmoji('🙋').setStyle(ButtonStyle.Primary)
    )
  ];
  return { embeds: [embed], components: rows };
}

function autoDeleteHoursModal(store) {
  ensureTicketData(store);
  return new ModalBuilder()
    .setCustomId('ticketadmin:modal:autodelete-hours')
    .setTitle('Ticket Auto Close Timer')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('hours')
          .setLabel('Hours before unclaimed ticket closes')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMinLength(1)
          .setMaxLength(3)
          .setValue(String(ticketAutoDeleteHours(store)))
          .setPlaceholder('24')
      )
    );
}

function typeModal(type = null) {
  const editing = Boolean(type);
  const modal = new ModalBuilder()
    .setCustomId(editing ? `ticketadmin:modal:edit:${type.id}` : 'ticketadmin:modal:add')
    .setTitle(editing ? 'Edit Ticket Department' : 'Add Ticket Department');

  const label = new TextInputBuilder().setCustomId('label').setLabel('Button / department name').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(80);
  if (type?.label) label.setValue(String(type.label).slice(0, 80));

  const emoji = new TextInputBuilder().setCustomId('emoji').setLabel('Emoji (optional)').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(40);
  if (type?.emoji) emoji.setValue(String(type.emoji).slice(0, 40));

  const style = new TextInputBuilder().setCustomId('style').setLabel('Color: primary, secondary, success, danger').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(20).setValue(String(type?.style || 'secondary'));

  const intro = new TextInputBuilder().setCustomId('intro').setLabel('Opening message inside ticket').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1000).setValue(String(type?.intro || 'Tell us what you need help with. You can upload screenshots or other files here.').slice(0, 1000));

  const questions = new TextInputBuilder()
    .setCustomId('questions')
    .setLabel('Form questions — one per line, max 4')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setMaxLength(1000)
    .setPlaceholder('Team name\nWhat do you need help with?\nTransaction ID (if applicable)');
  if (type?.questions?.length) questions.setValue(type.questions.slice(0, 4).join('\n').slice(0, 1000));

  modal.addComponents(
    new ActionRowBuilder().addComponents(label),
    new ActionRowBuilder().addComponents(emoji),
    new ActionRowBuilder().addComponents(style),
    new ActionRowBuilder().addComponents(intro),
    new ActionRowBuilder().addComponents(questions)
  );
  return modal;
}


function partnershipRulesModal(type, lang) {
  const spanish = lang === 'es';
  const current = spanish ? type.partnerRulesEs : type.partnerRulesEn;
  return new ModalBuilder()
    .setCustomId(`ticketadmin:modal:rules:${lang}:${type.id}`)
    .setTitle(spanish ? 'Reglas de Partnership — Español' : 'Partnership Rules — English')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('rules')
          .setLabel(spanish ? 'Reglas en Español' : 'Rules in English')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false)
          .setMaxLength(4000)
          .setPlaceholder(spanish ? 'Escribe las reglas que verá el solicitante...' : 'Enter the rules the applicant will see...')
          .setValue(String(current || '').slice(0, 4000))
      )
    );
}

function partnershipRulesPrompt(type) {
  const hasEn = Boolean(type?.partnerRulesEn?.trim());
  const hasEs = Boolean(type?.partnerRulesEs?.trim());
  if (!hasEn && !hasEs) return null;
  const embed = new EmbedBuilder()
    .setColor(brandColor())
    .setTitle('🤝 PARTNERSHIP RULES • REGLAS DE PARTNERSHIP')
    .setDescription(`Please select your language to read the partnership rules before staff reviews your application.\n\nSelecciona tu idioma para leer las reglas de partnership antes de que el staff revise tu solicitud.`)
    .setFooter({ text: 'KIXO • Partnerships' });
  const buttons = [];
  if (hasEn) buttons.push(new ButtonBuilder().setCustomId('ticket:rules:en').setLabel('English').setEmoji('🇺🇸').setStyle(ButtonStyle.Primary));
  if (hasEs) buttons.push(new ButtonBuilder().setCustomId('ticket:rules:es').setLabel('Español').setEmoji('🇲🇽').setStyle(ButtonStyle.Success));
  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(...buttons)] };
}

function panelEditModal(store) {
  const s = store.data.settings;
  return new ModalBuilder()
    .setCustomId('ticketadmin:modal:panel')
    .setTitle('Edit Ticket Panel Branding')
    .addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('title').setLabel('Panel title').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(256).setValue(String(s.ticketPanelTitle || '🎫 KIXO Support').slice(0, 256))),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('text').setLabel('Bio / description').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(4000).setValue(String(s.ticketPanelText || 'Choose the type of support you need below.').slice(0, 4000))),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('footer').setLabel('Footer').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(200).setValue(String(s.ticketPanelFooter || 'KIXO • Support Tickets').slice(0, 200))),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('color').setLabel('Embed color — example #FF2D8B').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(7).setValue(String(s.ticketPanelColor || '#FF2D8B').slice(0, 7)))
    );
}

function ticketCreatedReplyModal(store) {
  const s = store.data.settings;
  return new ModalBuilder()
    .setCustomId('ticketadmin:modal:open-reply')
    .setTitle('Edit Ticket-Created Reply')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('message')
          .setLabel('Confirmation message')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(1900)
          .setPlaceholder('✅ Your {type} ticket is ready: {channel}')
          .setValue(String(s.ticketCreatedReplyTemplate || '✅ Your **{type}** ticket is ready: {channel}').slice(0, 1900))
      )
    );
}

function renderTicketCreatedReply(store, interaction, ticket, type, channel) {
  ensureTicketData(store);
  let text = String(store.data.settings.ticketCreatedReplyTemplate || '✅ Your **{type}** ticket is ready: {channel}').slice(0, 1900);
  const values = {
    '{type}': type?.label || ticket.typeLabel || 'Support',
    '{channel}': `<#${channel.id}>`,
    '{user}': `<@${interaction.user.id}>`,
    '{username}': interaction.user.username,
    '{number}': String(ticket.number || 0).padStart(4, '0'),
    '{server}': interaction.guild?.name || 'this server'
  };
  for (const [token, value] of Object.entries(values)) text = text.split(token).join(String(value));
  return text.slice(0, 2000);
}

function ticketImageExtension(attachment) {
  const name = String(attachment.name || '').toLowerCase();
  const byName = name.match(/\.(png|jpe?g|webp|gif)$/i)?.[1];
  if (byName) return byName === 'jpeg' ? 'jpg' : byName;
  const type = String(attachment.contentType || '').toLowerCase();
  if (type.includes('png')) return 'png';
  if (type.includes('jpeg') || type.includes('jpg')) return 'jpg';
  if (type.includes('webp')) return 'webp';
  if (type.includes('gif')) return 'gif';
  return '';
}

async function saveTicketPanelImage(attachment, kind) {
  const ext = ticketImageExtension(attachment);
  if (!ext) throw new Error('Please upload a PNG, JPG, WEBP, or GIF image.');
  if (Number(attachment.size || 0) > 10 * 1024 * 1024) throw new Error('Image is too large. Keep it under 10 MB.');
  const response = await fetch(attachment.url);
  if (!response.ok) throw new Error(`Could not download the image (${response.status}).`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 10 * 1024 * 1024) throw new Error('Image is too large. Keep it under 10 MB.');
  for (const old of fs.readdirSync(TICKET_ASSET_DIR)) {
    if (old.startsWith(`ticket-${kind}.`)) {
      try { fs.unlinkSync(path.join(TICKET_ASSET_DIR, old)); } catch {}
    }
  }
  const filename = `ticket-${kind}.${ext}`;
  const fullPath = path.join(TICKET_ASSET_DIR, filename);
  fs.writeFileSync(fullPath, bytes);
  return path.relative(DATA_DIR, fullPath).replace(/\\/g, '/');
}

async function requestTicketPanelImage(interaction, store, kind) {
  const label = kind === 'logo' ? 'logo' : 'banner';
  if (!interaction.channel?.awaitMessages) {
    await interaction.reply({ content: `Run \`/ticket-admin\` in a normal staff text channel, then try **Upload ${label}** again.`, flags: MessageFlags.Ephemeral });
    return;
  }
  await interaction.reply({
    content: `🖼️ **Upload your ticket ${label} now.**\nSend **one image** in this staff channel within 60 seconds. PNG, JPG, WEBP, or GIF • max 10 MB.\n\nThe image is saved to your Railway \`/data\` volume. Type **cancel** to stop.`,
    flags: MessageFlags.Ephemeral
  });
  try {
    const collected = await interaction.channel.awaitMessages({
      filter: m => m.author.id === interaction.user.id && (m.content.trim().toLowerCase() === 'cancel' || m.attachments.size > 0),
      max: 1,
      time: 60_000,
      errors: ['time']
    });
    const message = collected.first();
    if (!message || message.content.trim().toLowerCase() === 'cancel') {
      await interaction.editReply('Upload cancelled.');
      return;
    }
    const attachment = message.attachments.first();
    const relative = await saveTicketPanelImage(attachment, kind);
    const patch = kind === 'logo'
      ? { ticketLogoFile: relative, ticketLogoUrl: '' }
      : { ticketBannerFile: relative, ticketBannerUrl: '' };
    store.updateSettings(patch);
    await message.delete().catch(() => {});
    await interaction.editReply(`✅ Ticket ${label} uploaded and saved. Open **Settings → Preview** to see it.`);
  } catch (err) {
    if (String(err?.message || '').toLowerCase().includes('time')) await interaction.editReply('⌛ Upload timed out. Press the upload button again when you are ready.');
    else await interaction.editReply(`❌ ${err.message}`);
  }
}

function clearTicketPanelImages(store) {
  for (const old of fs.readdirSync(TICKET_ASSET_DIR)) {
    if (old.startsWith('ticket-logo.') || old.startsWith('ticket-banner.')) {
      try { fs.unlinkSync(path.join(TICKET_ASSET_DIR, old)); } catch {}
    }
  }
  store.updateSettings({ ticketLogoFile: '', ticketBannerFile: '', ticketLogoUrl: '', ticketBannerUrl: '' });
}

function ticketPermissionsPayload() {
  return {
    embeds: [new EmbedBuilder()
      .setColor(brandColor())
      .setTitle('🔐 KIXO Ticket Bot Permissions')
      .setDescription([
        '**Required for the advanced ticket system:**',
        '• View Channels',
        '• Send Messages',
        '• Read Message History',
        '• Embed Links',
        '• Attach Files',
        '• Manage Channels — create/move/lock ticket channels and edit overwrites',
        '• Manage Messages — cleanup uploads/control messages',
        '• Use Application Commands',
        '',
        '**Also required by other KIXO modules:**',
        '• Manage Roles — verification role add/remove',
        '• Moderate Members — timeout moderation command',
        '• Kick Members / Ban Members — only if you use those moderation commands',
        '',
        '**Discord Developer Portal:** enable **Message Content Intent** so server knowledge scanning and image-upload capture work correctly.',
        '',
        'The bot role must be high enough in the role list for the roles/features it manages. Administrator permission is **not required**.'
      ].join('\n'))
      .setFooter({ text: 'KIXO • Permission Guide' })],
    flags: MessageFlags.Ephemeral
  };
}

function ticketPermissionsCheckPayload(guild, store) {
  ensureTicketData(store);
  const me = guild.members.me;
  const lines = [];
  if (!me) {
    lines.push('❌ Could not resolve the bot member.');
  } else {
    lines.push(`${me.permissions.has(PermissionFlagsBits.ManageChannels) ? '✅' : '❌'} **Manage Channels**`);
    lines.push(`${me.permissions.has(PermissionFlagsBits.ManageRoles) ? '✅' : '❌'} **Manage Roles**`);
    lines.push(`${me.permissions.has(PermissionFlagsBits.ViewChannel) ? '✅' : '❌'} **View Channels**`);
    lines.push(`${me.permissions.has(PermissionFlagsBits.SendMessages) ? '✅' : '❌'} **Send Messages**`);
    lines.push(`${me.permissions.has(PermissionFlagsBits.ReadMessageHistory) ? '✅' : '❌'} **Read Message History**`);
    lines.push(`${me.permissions.has(PermissionFlagsBits.AttachFiles) ? '✅' : '❌'} **Attach Files**`);
  }

  const departments = [];
  for (const type of ticketTypes(store)) {
    const category = type.categoryId ? guild.channels.cache.get(type.categoryId) : null;
    if (type.categoryId && (!category || category.type !== ChannelType.GuildCategory)) {
      departments.push(`❌ **${type.label}** — destination category is missing.`);
      continue;
    }
    const problems = ticketPermissionDiagnostics(guild, category, store, type);
    if (!problems.length) {
      departments.push(`✅ **${type.label}** — ${category ? `# ${category.name}` : 'no category configured'}`);
    } else {
      departments.push(`❌ **${type.label}** — ${problems.join(' ')}`);
    }
  }

  return {
    embeds: [new EmbedBuilder()
      .setColor(departments.some(x => x.startsWith('❌')) || lines.some(x => x.startsWith('❌')) ? 0xD90429 : 0x2ECC71)
      .setTitle('🔐 Ticket Permissions Check')
      .setDescription([
        '**Bot permissions**',
        ...lines,
        '',
        '**Departments**',
        ...(departments.length ? departments : ['No ticket departments configured.']),
        '',
        '**Important:** V7.5 no longer copies every category overwrite when creating a ticket. The ticket inherits the destination category, then the bot only adds the member-specific private access it needs.'
      ].join('\n').slice(0, 4000))
      .setFooter({ text: 'KIXO • Live Ticket Permission Check' })],
    flags: MessageFlags.Ephemeral
  };
}

// Every ticket collects the member's reason before a private channel exists.
// Keep up to four extra department questions under Discord's five-field limit.
function isMainTicketQuestion(question) {
  const q=String(question||'').toLowerCase().replace(/[?¿¡!.,]/g,'').trim();
  return /what can we help|how can we help|what do you need help with|describe your (issue|problem|request)|en qu[eé] (podemos|te podemos) ayudar|c[oó]mo podemos ayudarte/.test(q);
}
function additionalTicketQuestions(type) {
  return (type.questions||[]).filter(q=>!isMainTicketQuestion(q)).slice(0,4);
}
function openFormModal(type) {
  const modal = new ModalBuilder().setCustomId(`ticketform:${type.id}`).setTitle('Open Support Ticket');
  modal.addComponents(new ActionRowBuilder().addComponents(
    new TextInputBuilder()
      .setCustomId('request')
      .setLabel('What can we help you with?')
      .setPlaceholder('Describe your issue, question, or request...')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(1000)
  ));
  additionalTicketQuestions(type).forEach((question,i)=>{
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId(`q${i}`)
        .setLabel(String(question).slice(0,45))
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(1000)
    ));
  });
  return modal;
}

function noteModal(channelId) {
  return new ModalBuilder().setCustomId(`ticket:note:${channelId}`).setTitle('Add Staff Note').addComponents(
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('note').setLabel('Private staff note').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1500))
  );
}

function renameModal(channelId, currentName = '') {
  return new ModalBuilder().setCustomId(`ticket:rename:${channelId}`).setTitle('Rename Ticket').addComponents(
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('name').setLabel('New channel name').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(80).setValue(String(currentName || '').slice(0, 80)))
  );
}

function newTypeId() {
  return `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`.slice(0, 18);
}

function customCommandsPanel(store, selectedId = '', notice = '') {
  ensureTicketData(store);
  const commands = ticketCustomCommands(store);
  const selected = findCustomCommand(store, selectedId) || commands[0] || null;
  const prefix = String(store.data.settings.ticketCommandPrefix || '!').slice(0, 5);
  const lines = [
    notice ? `**${notice}**\n` : '',
    `**Prefix:** \`${prefix}\``,
    `**Saved Commands:** ${commands.length}/25`,
    '',
    selected
      ? `**Selected:** \`${prefix}${selected.trigger}\`\n**Title:** ${selected.title || '*No title*'}\n**Message:** ${String(selected.message || '').slice(0, 500)}${String(selected.message || '').length > 500 ? '…' : ''}\n**Color:** ${selected.color || '#FF2D8B'}\n**Footer:** ${selected.footer || '*None*'}`
      : '*No custom ticket commands yet. Press Add Command.*',
    '',
    'When staff run a custom command inside an open ticket, the bot **always tags the member who opened the ticket**.',
    'Variables: `{user}` `{username}` `{staff}` `{ticket}` `{number}` `{type}` `{channel}` `{server}` `{args}`'
  ].filter(Boolean);

  const embed = new EmbedBuilder()
    .setColor(brandColor())
    .setTitle('⌨️ CUSTOM TICKET COMMANDS')
    .setDescription(lines.join('\n'))
    .setFooter({ text: 'KIXO • Staff-only ticket commands' });

  const rows = [];
  if (commands.length) {
    rows.push(new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('ticketadmin:custom-select')
        .setPlaceholder('Choose a custom command')
        .setMinValues(1)
        .setMaxValues(1)
        .addOptions(commands.slice(0, 25).map(cmd => ({
          label: `${prefix}${cmd.trigger}`.slice(0, 100),
          value: cmd.id,
          description: String(cmd.title || cmd.message || 'Custom ticket response').replace(/\s+/g, ' ').slice(0, 100),
          default: selected?.id === cmd.id
        })))
    ));
  }
  rows.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticketadmin:custom-add').setLabel('Add Command').setEmoji('➕').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`ticketadmin:custom-edit:${selected?.id || 'none'}`).setLabel('Edit').setEmoji('✏️').setStyle(ButtonStyle.Primary).setDisabled(!selected),
    new ButtonBuilder().setCustomId(`ticketadmin:custom-delete:${selected?.id || 'none'}`).setLabel('Delete').setEmoji('🗑️').setStyle(ButtonStyle.Danger).setDisabled(!selected),
    new ButtonBuilder().setCustomId('ticketadmin:custom-prefix').setLabel('Command Prefix').setEmoji('🔣').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('ticketadmin:custom-back').setLabel('Back').setEmoji('⬅️').setStyle(ButtonStyle.Secondary)
  ));
  return { embeds: [embed], components: rows };
}

function customCommandModal(command = null) {
  const editing = Boolean(command);
  const modal = new ModalBuilder()
    .setCustomId(editing ? `ticketadmin:modal:custom-edit:${command.id}` : 'ticketadmin:modal:custom-add')
    .setTitle(editing ? 'Edit Ticket Command' : 'Add Ticket Command');

  const trigger = new TextInputBuilder().setCustomId('trigger').setLabel('Command name (example: payment)').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(32);
  if (command?.trigger) trigger.setValue(command.trigger);
  const title = new TextInputBuilder().setCustomId('title').setLabel('Embed title (optional)').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(256);
  if (command?.title) title.setValue(command.title);
  const message = new TextInputBuilder().setCustomId('message').setLabel('Response message').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(4000);
  if (command?.message) message.setValue(command.message);
  const color = new TextInputBuilder().setCustomId('color').setLabel('Embed color HEX').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(7);
  color.setValue(command?.color || '#FF2D8B');
  const footer = new TextInputBuilder().setCustomId('footer').setLabel('Footer (optional)').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(200);
  if (command?.footer) footer.setValue(command.footer);

  modal.addComponents(
    new ActionRowBuilder().addComponents(trigger),
    new ActionRowBuilder().addComponents(title),
    new ActionRowBuilder().addComponents(message),
    new ActionRowBuilder().addComponents(color),
    new ActionRowBuilder().addComponents(footer)
  );
  return modal;
}

function customPrefixModal(store) {
  const prefix = String(store.data.settings.ticketCommandPrefix || '!').slice(0, 5);
  return new ModalBuilder()
    .setCustomId('ticketadmin:modal:custom-prefix')
    .setTitle('Custom Command Prefix')
    .addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('prefix')
        .setLabel('Prefix (example: ! or -)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(5)
        .setValue(prefix)
    ));
}

function replaceCustomCommandVariables(text, ctx) {
  const replacements = {
    '{user}': `<@${ctx.ticket.userId}>`,
    '{username}': ctx.ownerName || 'member',
    '{staff}': `<@${ctx.message.author.id}>`,
    '{ticket}': `#${String(ctx.ticket.number || 0).padStart(4, '0')}`,
    '{number}': String(ctx.ticket.number || 0).padStart(4, '0'),
    '{type}': ctx.type?.label || ctx.ticket.typeLabel || 'Support',
    '{channel}': `<#${ctx.message.channel.id}>`,
    '{server}': ctx.message.guild.name,
    '{args}': ctx.args || ''
  };
  let out = String(text || '');
  for (const [key, value] of Object.entries(replacements)) out = out.split(key).join(value);
  return out;
}

async function handleTicketCustomMessage(message, store, canUseAdmin) {
  if (!message?.guild || message.author?.bot) return false;
  ensureTicketData(store);
  const ticket = findTicket(store, message.channel.id);
  if (!ticket || ticket.status !== 'open') return false;
  if (!canUseAdmin(message)) return false;

  const prefix = String(store.data.settings.ticketCommandPrefix || '!');
  const raw = String(message.content || '').trim();
  if (!raw.startsWith(prefix)) return false;
  const withoutPrefix = raw.slice(prefix.length).trim();
  if (!withoutPrefix) return false;
  const parts = withoutPrefix.split(/\s+/);
  const trigger = normalizeCommandTrigger(parts.shift());
  const command = findCustomCommand(store, trigger);
  if (!command) return false;

  const type = findType(store, ticket.typeId);
  const owner = await message.guild.members.fetch(ticket.userId).catch(() => null);
  const ctx = { message, ticket, type, ownerName: owner?.user?.username || 'member', args: parts.join(' ') };
  const body = replaceCustomCommandVariables(command.message, ctx).slice(0, 4096);
  const title = replaceCustomCommandVariables(command.title, ctx).slice(0, 256);
  const footer = replaceCustomCommandVariables(command.footer, ctx).slice(0, 2048);
  const embed = new EmbedBuilder().setColor(parsePanelColor(command.color || '#FF2D8B')).setDescription(body || ' ');
  if (title) embed.setTitle(title);
  if (footer) embed.setFooter({ text: footer });

  await message.channel.send({
    content: `<@${ticket.userId}>`,
    embeds: [embed],
    allowedMentions: { users: [ticket.userId] }
  });
  return true;
}

function normalizeQuestions(value) {
  return String(value || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean).slice(0, 4).map(x => x.slice(0, 80));
}

async function sendTicketLog(guild, store, title, description, color = brandColor(), file = null) {
  const channelId = store.data.settings.ticketTranscriptChannelId;
  if (!channelId) return;
  const ch = await guild.channels.fetch(channelId).catch(() => null);
  if (!ch?.isTextBased()) return;
  const embed = new EmbedBuilder().setColor(color).setTitle(title).setDescription(String(description).slice(0, 4096)).setTimestamp();
  const payload = { embeds: [embed], allowedMentions: { parse: [] } };
  if (file) payload.files = [file];
  await ch.send(payload).catch(() => {});
}

async function handleTicketAdminInteraction(interaction, store, canUseAdmin) {
  const id = String(interaction.customId || '');
  if (!id.startsWith('ticketadmin:')) return false;
  ensureTicketData(store);

  if (!canUseAdmin(interaction)) {
    await interaction.reply({ content: 'Staff only.', flags: MessageFlags.Ephemeral }).catch(() => {});
    return true;
  }

  if (interaction.isStringSelectMenu() && id === 'ticketadmin:select') {
    await interaction.update(ticketAdminPanel(store, interaction.values[0]));
    return true;
  }

  if (interaction.isChannelSelectMenu() && id.startsWith('ticketadmin:category:')) {
    const type = findType(store, id.split(':')[2]);
    if (!type) return void await interaction.update(ticketAdminPanel(store, '', 'That department no longer exists.'));
    const category = interaction.channels.first();
    type.categoryId = category?.id || '';
    store.save();
    await interaction.update(ticketAdminPanel(store, type.id, `Destination for **${type.label}** set to ${category}.`));
    return true;
  }

  if (interaction.isRoleSelectMenu() && id.startsWith('ticketadmin:staffrole:')) {
    const type = findType(store, id.split(':')[2]);
    if (!type) return void await interaction.update(ticketAdminPanel(store, '', 'That department no longer exists.'));
    const role = interaction.roles.first();
    type.staffRoleId = role?.id || '';
    store.save();
    await interaction.update(ticketAdminPanel(store, type.id, `Staff team for **${type.label}** set to ${role}.`));
    return true;
  }

  if (interaction.isRoleSelectMenu() && id.startsWith('ticketadmin:approvalrole:')) {
    const type = findType(store, id.split(':')[2]);
    if (!type) return void await interaction.update(ticketAdminPanel(store, '', 'That department no longer exists.'));
    const role = interaction.roles.first();
    type.approvalRoleId = role?.id || '';
    store.save();
    await interaction.update(approvalWorkflowPanel(store, type.id, `Approval role set to ${role}.`));
    return true;
  }


  if (interaction.isChannelSelectMenu() && id.startsWith('ticketadmin:approvalcategory:')) {
    const type = findType(store, id.split(':')[2]);
    if (!type) return void await interaction.update(ticketAdminPanel(store, '', 'That department no longer exists.'));
    const category = interaction.channels.first();
    type.approvalCategoryId = category?.id || '';
    store.save();
    await interaction.update(approvalWorkflowPanel(store, type.id, `Approved-partner channel category set to ${category}.`));
    return true;
  }

  if (interaction.isChannelSelectMenu() && id === 'ticketadmin:post') {
    const channel = interaction.channels.first();
    const types = ticketTypes(store);
    if (!types.length) return void await interaction.update(ticketAdminPanel(store, '', 'Add at least one department before posting the panel.'));
    await channel.send(ticketPanel(store));
    await interaction.update(ticketAdminPanel(store, types[0]?.id || '', `Ticket panel posted in ${channel}.`));
    return true;
  }

  if (interaction.isChannelSelectMenu() && id === 'ticketadmin:transcript') {
    const channel = interaction.channels.first();
    store.updateSettings({ ticketTranscriptChannelId: channel?.id || '' });
    await interaction.update(advancedAdminPanel(store, `Transcript/activity log set to ${channel}.`));
    return true;
  }

  if (interaction.isChannelSelectMenu() && id === 'ticketadmin:archive') {
    const category = interaction.channels.first();
    store.updateSettings({ ticketClosedCategoryId: category?.id || '' });
    await interaction.update(advancedAdminPanel(store, `Closed-ticket archive set to ${category}.`));
    return true;
  }

  if (interaction.isButton() && id === 'ticketadmin:claimed-category') {
    await interaction.update(claimedCategoryAdminPanel(store));
    return true;
  }

  if (interaction.isChannelSelectMenu() && id === 'ticketadmin:claimed-category-select') {
    const category = interaction.channels.first();
    if (!category || category.type !== ChannelType.GuildCategory) {
      await interaction.update(claimedCategoryAdminPanel(store, 'Please choose a valid category.'));
      return true;
    }
    store.updateSettings({ ticketClaimedCategoryId: category.id });
    await interaction.deferUpdate();
    const result = await moveAllClaimedTicketsToCategory(interaction.guild, store, category);
    await interaction.editReply(claimedCategoryAdminPanel(store, `Claimed-ticket category set to ${category}. Moved ${result.moved} claimed ticket(s)${result.failed ? `; ${result.failed} failed to move` : ''}.`));
    return true;
  }

  if (interaction.isButton() && id === 'ticketadmin:claimed-category-clear') {
    store.updateSettings({ ticketClaimedCategoryId: '' });
    await interaction.update(claimedCategoryAdminPanel(store, 'Automatic mode enabled. The bot will create/reuse 📌 CLAIMED TICKETS on the next claim.'));
    return true;
  }

  if (interaction.isButton() && id === 'ticketadmin:claimed-category-back') {
    await interaction.update(advancedAdminPanel(store));
    return true;
  }

  if (interaction.isButton() && id === 'ticketadmin:add') {
    if (ticketTypes(store).length >= 25) return void await interaction.reply({ content: 'Discord allows a maximum of 25 ticket buttons on one panel.', flags: MessageFlags.Ephemeral });
    await interaction.showModal(typeModal());
    return true;
  }

  if (interaction.isButton() && id.startsWith('ticketadmin:edit:')) {
    const type = findType(store, id.split(':')[2]);
    if (!type) return void await interaction.reply({ content: 'That ticket department no longer exists.', flags: MessageFlags.Ephemeral });
    await interaction.showModal(typeModal(type));
    return true;
  }

  if (interaction.isButton() && id === 'ticketadmin:advanced') {
    await interaction.update(advancedAdminPanel(store));
    return true;
  }

  if (interaction.isButton() && id.startsWith('ticketadmin:workflow:')) {
    const type = findType(store, id.split(':')[2]);
    if (!type) return void await interaction.reply({ content: 'That ticket department no longer exists.', flags: MessageFlags.Ephemeral });
    await interaction.update(approvalWorkflowPanel(store, type.id));
    return true;
  }


  if (interaction.isButton() && (id.startsWith('ticketadmin:rules-en:') || id.startsWith('ticketadmin:rules-es:'))) {
    const parts = id.split(':');
    const lang = parts[1] === 'rules-es' ? 'es' : 'en';
    const type = findType(store, parts[2]);
    if (!type) return void await interaction.reply({ content: 'That ticket department no longer exists.', flags: MessageFlags.Ephemeral });
    await interaction.showModal(partnershipRulesModal(type, lang));
    return true;
  }

  if (interaction.isButton() && id.startsWith('ticketadmin:rules-clear:')) {
    const type = findType(store, id.split(':')[2]);
    if (!type) return void await interaction.reply({ content: 'That ticket department no longer exists.', flags: MessageFlags.Ephemeral });
    type.partnerRulesEn = '';
    type.partnerRulesEs = '';
    store.save();
    await interaction.update(approvalWorkflowPanel(store, type.id, 'English and Spanish partnership rules cleared.'));
    return true;
  }

  if (interaction.isButton() && id.startsWith('ticketadmin:approvalchannel-toggle:')) {
    const type = findType(store, id.split(':')[2]);
    if (!type) return void await interaction.reply({ content: 'That ticket department no longer exists.', flags: MessageFlags.Ephemeral });
    type.approvalCreateChannel = !type.approvalCreateChannel;
    store.save();
    await interaction.update(approvalWorkflowPanel(store, type.id, `Automatic approved-partner channel creation turned **${type.approvalCreateChannel ? 'ON' : 'OFF'}**.`));
    return true;
  }

  if (interaction.isButton() && id.startsWith('ticketadmin:approvalchannel-name:')) {
    const type = findType(store, id.split(':')[2]);
    if (!type) return void await interaction.reply({ content: 'That ticket department no longer exists.', flags: MessageFlags.Ephemeral });
    await interaction.showModal(approvalChannelNameModal(type));
    return true;
  }

  if (interaction.isButton() && id.startsWith('ticketadmin:approvalcategory-clear:')) {
    const type = findType(store, id.split(':')[2]);
    if (!type) return void await interaction.reply({ content: 'That ticket department no longer exists.', flags: MessageFlags.Ephemeral });
    type.approvalCategoryId = '';
    store.save();
    await interaction.update(approvalWorkflowPanel(store, type.id, 'Approved-partner channel category cleared.'));
    return true;
  }

  if (interaction.isButton() && id.startsWith('ticketadmin:workflow-toggle:')) {
    const type = findType(store, id.split(':')[2]);
    if (!type) return void await interaction.reply({ content: 'That ticket department no longer exists.', flags: MessageFlags.Ephemeral });
    type.approvalEnabled = !type.approvalEnabled;
    store.save();
    await interaction.update(approvalWorkflowPanel(store, type.id, `Approval workflow turned **${type.approvalEnabled ? 'ON' : 'OFF'}**.`));
    return true;
  }

  if (interaction.isButton() && id.startsWith('ticketadmin:approvalrole-clear:')) {
    const type = findType(store, id.split(':')[2]);
    if (!type) return void await interaction.reply({ content: 'That ticket department no longer exists.', flags: MessageFlags.Ephemeral });
    type.approvalRoleId = '';
    store.save();
    await interaction.update(approvalWorkflowPanel(store, type.id, 'Approval role cleared.'));
    return true;
  }

  if (interaction.isButton() && id.startsWith('ticketadmin:workflow-back:')) {
    const typeId = id.split(':')[2];
    await interaction.update(ticketAdminPanel(store, typeId));
    return true;
  }


  if (interaction.isButton() && id === 'ticketadmin:custom') {
    await interaction.update(customCommandsPanel(store));
    return true;
  }

  if (interaction.isStringSelectMenu() && id === 'ticketadmin:custom-select') {
    await interaction.update(customCommandsPanel(store, interaction.values[0]));
    return true;
  }

  if (interaction.isButton() && id === 'ticketadmin:custom-add') {
    if (ticketCustomCommands(store).length >= 25) return void await interaction.reply({ content: 'You already have the maximum of 25 custom ticket commands.', flags: MessageFlags.Ephemeral });
    await interaction.showModal(customCommandModal());
    return true;
  }

  if (interaction.isButton() && id.startsWith('ticketadmin:custom-edit:')) {
    const command = findCustomCommand(store, id.split(':')[2]);
    if (!command) return void await interaction.reply({ content: 'That custom command no longer exists.', flags: MessageFlags.Ephemeral });
    await interaction.showModal(customCommandModal(command));
    return true;
  }

  if (interaction.isButton() && id.startsWith('ticketadmin:custom-delete:')) {
    const command = findCustomCommand(store, id.split(':')[2]);
    if (!command) return void await interaction.update(customCommandsPanel(store, '', 'That custom command no longer exists.'));
    store.data.ticketCustomCommands = ticketCustomCommands(store).filter(x => x.id !== command.id);
    store.save();
    await interaction.update(customCommandsPanel(store, '', `Deleted \`${store.data.settings.ticketCommandPrefix || '!'}${command.trigger}\`.`));
    return true;
  }

  if (interaction.isButton() && id === 'ticketadmin:custom-prefix') {
    await interaction.showModal(customPrefixModal(store));
    return true;
  }

  if (interaction.isButton() && id === 'ticketadmin:custom-back') {
    await interaction.update(advancedAdminPanel(store));
    return true;
  }

  if (interaction.isButton() && id === 'ticketadmin:panel-edit') {
    await interaction.showModal(panelEditModal(store));
    return true;
  }

  if (interaction.isButton() && id === 'ticketadmin:open-reply') {
    await interaction.showModal(ticketCreatedReplyModal(store));
    return true;
  }

  if (interaction.isButton() && id === 'ticketadmin:upload:logo') {
    await requestTicketPanelImage(interaction, store, 'logo');
    return true;
  }

  if (interaction.isButton() && id === 'ticketadmin:upload:banner') {
    await requestTicketPanelImage(interaction, store, 'banner');
    return true;
  }

  if (interaction.isButton() && id === 'ticketadmin:panel-preview') {
    await interaction.reply({ ...ticketPanel(store), flags: MessageFlags.Ephemeral });
    return true;
  }

  if (interaction.isButton() && id === 'ticketadmin:clear-images') {
    clearTicketPanelImages(store);
    await interaction.update(advancedAdminPanel(store, 'Ticket panel logo and banner cleared.'));
    return true;
  }

  if (interaction.isButton() && id === 'ticketadmin:permissions') {
    await interaction.reply(ticketPermissionsCheckPayload(interaction.guild, store));
    return true;
  }

  if (interaction.isButton() && id === 'ticketadmin:back') {
    await interaction.update(ticketAdminPanel(store));
    return true;
  }

  if (interaction.isButton() && id.startsWith('ticketadmin:delete:')) {
    const type = findType(store, id.split(':')[2]);
    if (!type) return void await interaction.update(ticketAdminPanel(store, '', 'That department no longer exists.'));
    const embed = new EmbedBuilder().setColor(0xD90429).setTitle('Delete Ticket Department?').setDescription(`Delete **${type.label}** from the public ticket panel? Existing tickets will remain.`);
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`ticketadmin:delete-confirm:${type.id}`).setLabel('Delete').setEmoji('🗑️').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`ticketadmin:delete-cancel:${type.id}`).setLabel('Cancel').setStyle(ButtonStyle.Secondary)
    );
    await interaction.update({ embeds: [embed], components: [row] });
    return true;
  }

  if (interaction.isButton() && id.startsWith('ticketadmin:delete-confirm:')) {
    const typeId = id.split(':')[2];
    const type = findType(store, typeId);
    store.data.ticketTypes = ticketTypes(store).filter(x => x.id !== typeId);
    store.save();
    await interaction.update(ticketAdminPanel(store, store.data.ticketTypes[0]?.id || '', type ? `Deleted **${type.label}**.` : 'Department already deleted.'));
    return true;
  }

  if (interaction.isButton() && id.startsWith('ticketadmin:delete-cancel:')) {
    await interaction.update(ticketAdminPanel(store, id.split(':')[2], 'Delete cancelled.'));
    return true;
  }

  if (interaction.isButton() && id === 'ticketadmin:autodelete-toggle') {
    const enabled = store.data.settings.ticketAutoDeleteEnabled !== false;
    store.data.settings.ticketAutoDeleteEnabled = !enabled;
    if (!enabled) resetOpenUnclaimedAutoDeleteDeadlines(store);
    else store.save();
    await interaction.update(advancedAdminPanel(store, `Unclaimed ticket auto-close turned **${!enabled ? 'ON' : 'OFF'}**.${!enabled ? ` Fresh ${ticketAutoDeleteHours(store)}h timers were started for current unclaimed open tickets.` : ''}`));
    return true;
  }

  if (interaction.isButton() && id === 'ticketadmin:autodelete-hours') {
    await interaction.showModal(autoDeleteHoursModal(store));
    return true;
  }

  if (interaction.isButton() && id === 'ticketadmin:toggle') {
    const current = store.data.settings.features?.tickets !== false;
    store.data.settings.features = { ...store.data.settings.features, tickets: !current };
    store.save();
    await interaction.update(advancedAdminPanel(store, `Ticket system turned **${!current ? 'ON' : 'OFF'}**.`));
    return true;
  }

  if (interaction.isButton() && id === 'ticketadmin:close') {
    await interaction.update({ content: 'Ticket admin closed.', embeds: [], components: [] });
    return true;
  }


  if (interaction.isModalSubmit() && id === 'ticketadmin:modal:autodelete-hours') {
    const raw = Number(String(interaction.fields.getTextInputValue('hours') || '').trim());
    if (!Number.isFinite(raw) || raw < 1 || raw > 720) {
      await interaction.reply({ content: 'Enter a number from **1 to 720 hours**.', flags: MessageFlags.Ephemeral });
      return true;
    }
    store.data.settings.ticketAutoDeleteHours = Math.round(raw);
    const updated = resetOpenUnclaimedAutoDeleteDeadlines(store);
    await interaction.reply({ ...advancedAdminPanel(store, `Auto-delete timer set to **${ticketAutoDeleteHours(store)} hours**. ${updated} current open/unclaimed ticket(s) received a fresh timer.`), flags: MessageFlags.Ephemeral });
    return true;
  }

  if (interaction.isModalSubmit() && id.startsWith('ticketadmin:modal:approvalchannel:')) {
    const type = findType(store, id.split(':')[3]);
    if (!type) return void await interaction.reply({ content: 'That ticket department no longer exists.', flags: MessageFlags.Ephemeral });
    const template = String(interaction.fields.getTextInputValue('template') || 'partner-{server}').trim().slice(0, 90);
    type.approvalChannelNameTemplate = template || 'partner-{server}';
    store.save();
    await interaction.reply({ ...approvalWorkflowPanel(store, type.id, `Approved channel name template saved as \`${type.approvalChannelNameTemplate}\`.`), flags: MessageFlags.Ephemeral });
    return true;
  }

  if (interaction.isModalSubmit() && id.startsWith('ticketadmin:modal:rules:')) {
    const parts = id.split(':');
    const lang = parts[3];
    const type = findType(store, parts[4]);
    if (!type) return void await interaction.reply({ content: 'That ticket department no longer exists.', flags: MessageFlags.Ephemeral });
    const rules = String(interaction.fields.getTextInputValue('rules') || '').trim().slice(0, 4000);
    if (lang === 'es') type.partnerRulesEs = rules;
    else type.partnerRulesEn = rules;
    store.save();
    await interaction.reply({ ...approvalWorkflowPanel(store, type.id, `${lang === 'es' ? 'Spanish' : 'English'} partnership rules ${rules ? 'saved' : 'cleared'}.`), flags: MessageFlags.Ephemeral });
    return true;
  }

  if (interaction.isModalSubmit() && id === 'ticketadmin:modal:add') {
    const styleRaw = String(interaction.fields.getTextInputValue('style') || 'secondary').trim().toLowerCase();
    const type = {
      id: newTypeId(),
      label: String(interaction.fields.getTextInputValue('label') || 'Support').trim().slice(0, 80),
      emoji: String(interaction.fields.getTextInputValue('emoji') || '').trim().slice(0, 40),
      style: STYLE_MAP[styleRaw] ? styleRaw : 'secondary',
      intro: String(interaction.fields.getTextInputValue('intro') || '').trim().slice(0, 1000),
      questions: normalizeQuestions(interaction.fields.getTextInputValue('questions')),
      categoryId: '',
      staffRoleId: '',
      approvalEnabled: false,
      approvalRoleId: '',
      approvalCreateChannel: false,
      approvalCategoryId: '',
      approvalChannelNameTemplate: 'partner-{server}',
      partnerRulesEn: '',
      partnerRulesEs: ''
    };
    ticketTypes(store).push(type);
    store.save();
    await interaction.reply({ ...ticketAdminPanel(store, type.id, `Added **${type.label}**. Choose its destination category and staff role.`), flags: MessageFlags.Ephemeral });
    return true;
  }

  if (interaction.isModalSubmit() && id.startsWith('ticketadmin:modal:edit:')) {
    const type = findType(store, id.split(':')[3]);
    if (!type) return void await interaction.reply({ content: 'That ticket department no longer exists.', flags: MessageFlags.Ephemeral });
    const styleRaw = String(interaction.fields.getTextInputValue('style') || 'secondary').trim().toLowerCase();
    type.label = String(interaction.fields.getTextInputValue('label') || type.label).trim().slice(0, 80);
    type.emoji = String(interaction.fields.getTextInputValue('emoji') || '').trim().slice(0, 40);
    type.style = STYLE_MAP[styleRaw] ? styleRaw : 'secondary';
    type.intro = String(interaction.fields.getTextInputValue('intro') || type.intro).trim().slice(0, 1000);
    type.questions = normalizeQuestions(interaction.fields.getTextInputValue('questions'));
    store.save();
    await interaction.reply({ ...ticketAdminPanel(store, type.id, `Updated **${type.label}**.`), flags: MessageFlags.Ephemeral });
    return true;
  }

  if (interaction.isModalSubmit() && id === 'ticketadmin:modal:panel') {
    const colorRaw = String(interaction.fields.getTextInputValue('color') || '#FF2D8B').trim();
    const color = /^#?[0-9a-f]{6}$/i.test(colorRaw) ? (colorRaw.startsWith('#') ? colorRaw.toUpperCase() : `#${colorRaw.toUpperCase()}`) : '#FF2D8B';
    store.updateSettings({
      ticketPanelTitle: String(interaction.fields.getTextInputValue('title') || '').trim().slice(0, 256),
      ticketPanelText: String(interaction.fields.getTextInputValue('text') || '').trim().slice(0, 4000),
      ticketPanelFooter: String(interaction.fields.getTextInputValue('footer') || '').trim().slice(0, 200),
      ticketPanelColor: color
    });
    await interaction.reply({ ...advancedAdminPanel(store, 'Public ticket panel branding updated.'), flags: MessageFlags.Ephemeral });
    return true;
  }

  if (interaction.isModalSubmit() && id === 'ticketadmin:modal:custom-add') {
    const trigger = normalizeCommandTrigger(interaction.fields.getTextInputValue('trigger'));
    if (!trigger) return void await interaction.reply({ content: 'Please enter a valid command name.', flags: MessageFlags.Ephemeral });
    if (findCustomCommand(store, trigger)) return void await interaction.reply({ content: `A custom command named \`${store.data.settings.ticketCommandPrefix || '!'}${trigger}\` already exists.`, flags: MessageFlags.Ephemeral });
    const command = {
      id: newCustomCommandId(),
      trigger,
      title: String(interaction.fields.getTextInputValue('title') || '').trim().slice(0, 256),
      message: String(interaction.fields.getTextInputValue('message') || '').trim().slice(0, 4000),
      color: normalizeHexColor(interaction.fields.getTextInputValue('color')),
      footer: String(interaction.fields.getTextInputValue('footer') || '').trim().slice(0, 200)
    };
    ticketCustomCommands(store).push(command);
    store.save();
    await interaction.reply({ ...customCommandsPanel(store, command.id, `Created \`${store.data.settings.ticketCommandPrefix || '!'}${command.trigger}\`.`), flags: MessageFlags.Ephemeral });
    return true;
  }

  if (interaction.isModalSubmit() && id.startsWith('ticketadmin:modal:custom-edit:')) {
    const command = findCustomCommand(store, id.split(':')[3]);
    if (!command) return void await interaction.reply({ content: 'That custom command no longer exists.', flags: MessageFlags.Ephemeral });
    const trigger = normalizeCommandTrigger(interaction.fields.getTextInputValue('trigger'));
    if (!trigger) return void await interaction.reply({ content: 'Please enter a valid command name.', flags: MessageFlags.Ephemeral });
    const duplicate = ticketCustomCommands(store).find(x => x.id !== command.id && x.trigger === trigger);
    if (duplicate) return void await interaction.reply({ content: `Another custom command already uses \`${store.data.settings.ticketCommandPrefix || '!'}${trigger}\`.`, flags: MessageFlags.Ephemeral });
    command.trigger = trigger;
    command.title = String(interaction.fields.getTextInputValue('title') || '').trim().slice(0, 256);
    command.message = String(interaction.fields.getTextInputValue('message') || '').trim().slice(0, 4000);
    command.color = normalizeHexColor(interaction.fields.getTextInputValue('color'));
    command.footer = String(interaction.fields.getTextInputValue('footer') || '').trim().slice(0, 200);
    store.save();
    await interaction.reply({ ...customCommandsPanel(store, command.id, `Updated \`${store.data.settings.ticketCommandPrefix || '!'}${command.trigger}\`.`), flags: MessageFlags.Ephemeral });
    return true;
  }

  if (interaction.isModalSubmit() && id === 'ticketadmin:modal:custom-prefix') {
    const rawPrefix = String(interaction.fields.getTextInputValue('prefix') || '!').trim().slice(0, 5);
    const prefix = rawPrefix.replace(/\s+/g, '') || '!';
    store.updateSettings({ ticketCommandPrefix: prefix });
    await interaction.reply({ ...customCommandsPanel(store, '', `Command prefix changed to \`${prefix}\`.`), flags: MessageFlags.Ephemeral });
    return true;
  }

  if (interaction.isModalSubmit() && id === 'ticketadmin:modal:open-reply') {
    const message = String(interaction.fields.getTextInputValue('message') || '').trim().slice(0, 1900);
    store.updateSettings({ ticketCreatedReplyTemplate: message || '✅ Your **{type}** ticket is ready: {channel}' });
    await interaction.reply({ ...advancedAdminPanel(store, 'Ticket-created confirmation message updated.'), flags: MessageFlags.Ephemeral });
    return true;
  }

  return false;
}

function ticketNumber(store) {
  store.data.ticketCounter = Number(store.data.ticketCounter || 0) + 1;
  return store.data.ticketCounter;
}


// Send what the member typed as ordinary Discord text, not as a field inside
// the bot's control embed. Additional form responses are separate text messages.
function ticketOpeningTextPayloads(ticket) {
  const messages=[];
  const request=String(ticket.requestMessage||ticket.answers?.find(a=>isMainTicketQuestion(a.question))?.answer||'').trim().slice(0,1000);
  if(request){
    messages.push({
      content:'💬 **Message from <@'+ticket.userId+'>**\n'+request,
      allowedMentions:{parse:[]}
    });
  }
  for(const answer of (ticket.answers||[]).filter(a=>!isMainTicketQuestion(a.question)).slice(0,4)){
    const question=String(answer.question||'Question').slice(0,80);
    const response=String(answer.answer||'—').trim().slice(0,1000);
    if(!response)continue;
    messages.push({
      content:'📝 **'+question+'**\n'+response,
      allowedMentions:{parse:[]}
    });
  }
  return messages;
}

function ticketControlPayload(ticket, type) {
  const fields = [
    { name: 'Ticket', value: `#${String(ticket.number || 0).padStart(4, '0')}`, inline: true },
    { name: 'Department', value: type?.label || ticket.typeLabel || 'Support', inline: true },
    { name: 'Opened by', value: `<@${ticket.userId}>`, inline: true },
    { name: 'Claimed by', value: ticket.claimedBy ? `<@${ticket.claimedBy}>` : 'Not claimed', inline: true }
  ];
  if (ticket.decision) fields.push({ name: 'Decision', value: `${ticket.decision === 'approved' ? '✅ Approved' : '❌ Denied'}${ticket.decidedBy ? ` by <@${ticket.decidedBy}>` : ''}`, inline: false });
  // The member's opening request is shown as a separate, plain-text message.
  if (ticket.closeReason) fields.push({ name: 'Close reason', value: String(ticket.closeReason).slice(0, 1024) });

  const embed = new EmbedBuilder()
    .setColor(brandColor())
    .setTitle(ticket.status==='closed'
      ? `${type?.emoji||'🎫'} ${type?.label||ticket.typeLabel||'Support'} • Closed`
      : '🎫 Support ticket opened')
    .setDescription(ticket.status === 'closed'
      ? 'This ticket is closed. Staff can reopen it or delete it permanently.'
      : `Thank you for contacting **KIXO Support**. A staff member will be with you shortly.\n\n${type?.intro ? String(type.intro).slice(0,1000)+'\n\n' : ''}You can also upload screenshots or files directly into this channel.`)
    .addFields(fields)
    .setFooter({ text: 'KIXO • Advanced Tickets' })
    .setTimestamp(new Date(ticket.openedAt || Date.now()));

  const components = [];
  if (ticket.status === 'closed') {
    components.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket:reopen').setLabel('Reopen').setEmoji('🔓').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('ticket:delete').setLabel('Delete Permanently').setEmoji('🗑️').setStyle(ButtonStyle.Danger)
    ));
  } else {
    components.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('ticket:claim')
        .setLabel(ticket.claimedBy ? 'Unclaim Ticket' : 'Claim Ticket')
        .setEmoji(ticket.claimedBy ? '↩️' : '🙋')
        .setStyle(ticket.claimedBy ? ButtonStyle.Secondary : ButtonStyle.Success),
      new ButtonBuilder().setCustomId('ticket:close').setLabel('Close Ticket').setEmoji('🔒').setStyle(ButtonStyle.Secondary)
    ));

    // Approval-enabled departments (for example Partnerships) show the
    // decision controls directly inside the ticket. Discord buttons cannot be
    // hidden from the ticket owner, so authorization is enforced when clicked:
    // only staff/admins can approve or deny.
    if (type?.approvalEnabled) {
      const subject = String(type.label || 'Application').replace(/\s+/g, ' ').trim().slice(0, 55) || 'Application';
      components.unshift(new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('ticket:decision:approve')
          .setLabel(`Approve ${subject}`.slice(0, 80))
          .setEmoji('✅')
          .setStyle(ButtonStyle.Success)
          .setDisabled(Boolean(ticket.decision)),
        new ButtonBuilder()
          .setCustomId('ticket:decision:deny')
          .setLabel(`Deny ${subject}`.slice(0, 80))
          .setEmoji('❌')
          .setStyle(ButtonStyle.Danger)
          .setDisabled(Boolean(ticket.decision))
      ));
    }
  }
  return { embeds: [embed], components };
}

function staffTicketControlsPayload(store, ticket) {
  const type = findType(store, ticket.typeId);
  const embed = new EmbedBuilder()
    .setColor(brandColor())
    .setTitle(`🛡️ Staff Controls • Ticket #${String(ticket.number || 0).padStart(4, '0')}`)
    .setDescription([
      `**Department:** ${type?.label || ticket.typeLabel || 'Support'}`,
      `**Owner:** <@${ticket.userId}>`,
      `**Claimed by:** ${ticket.claimedBy ? `<@${ticket.claimedBy}>` : 'Not claimed'}`,
      '',
      'These controls are private and only visible to the staff member who opened them.'
    ].join('\n'))
    .setFooter({ text: 'KIXO • Staff Only' });

  if (ticket.status !== 'open') {
    return { embeds: [embed.setDescription(`${embed.data.description}\n\n🔒 This ticket is currently closed.`)], components: [] };
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket:claim').setLabel(ticket.claimedBy ? 'Unclaim Ticket' : 'Claim Ticket').setEmoji(ticket.claimedBy ? '↩️' : '🙋').setStyle(ticket.claimedBy ? ButtonStyle.Secondary : ButtonStyle.Success),
    new ButtonBuilder().setCustomId('ticket:manage').setLabel('Manage Ticket').setEmoji('⚙️').setStyle(ButtonStyle.Primary)
  );
  const components = [row];
  if (type?.approvalEnabled) {
    const subject = String(type.label || 'Application').replace(/\s+/g, ' ').trim().slice(0, 55) || 'Application';
    components.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket:decision:approve').setLabel(`Approve ${subject}`.slice(0, 80)).setEmoji('✅').setStyle(ButtonStyle.Success).setDisabled(Boolean(ticket.decision)),
      new ButtonBuilder().setCustomId('ticket:decision:deny').setLabel(`Deny ${subject}`.slice(0, 80)).setEmoji('❌').setStyle(ButtonStyle.Danger).setDisabled(Boolean(ticket.decision))
    ));
  }
  return { embeds: [embed], components };
}

async function refreshTicketHeader(channel, ticket, store) {
  if (!channel?.isTextBased() || !ticket?.controlMessageId) return;
  const message = await channel.messages.fetch(ticket.controlMessageId).catch(() => null);
  if (!message) return;
  const type = findType(store, ticket.typeId);
  await message.edit(ticketControlPayload(ticket, type)).catch(() => {});
}

function ticketManagerPayload(store, ticket, notice = '') {
  const type = findType(store, ticket.typeId);
  const types = ticketTypes(store);
  const embed = new EmbedBuilder()
    .setColor(brandColor())
    .setTitle(`⚙️ Manage Ticket #${String(ticket.number || 0).padStart(4, '0')}`)
    .setDescription([
      notice ? `**${notice}**\n` : '',
      `**Owner:** <@${ticket.userId}>`,
      `**Department:** ${type?.label || ticket.typeLabel || 'Support'}`,
      `**Claimed:** ${ticket.claimedBy ? `<@${ticket.claimedBy}>` : 'No'}`,
      `**Extra members:** ${ticket.extraUsers?.length ? ticket.extraUsers.map(id => `<@${id}>`).join(', ') : 'None'}`,
      `**Private staff notes:** ${ticket.notes?.length || 0}`
    ].filter(Boolean).join('\n'))
    .setFooter({ text: 'Only staff can use these controls.' });

  const transfer = new StringSelectMenuBuilder().setCustomId(`ticketmgr:transfer:${ticket.channelId}`).setPlaceholder(types.length ? 'Transfer to another department' : 'No departments available');
  if (types.length) {
    transfer.addOptions(types.slice(0, 25).map(t => ({ label: String(t.label).slice(0, 100), value: t.id, emoji: t.emoji || undefined, default: t.id === ticket.typeId })));
  } else {
    transfer.setDisabled(true).addOptions({ label: 'No departments configured', value: 'none' });
  }
  const addUser = new UserSelectMenuBuilder().setCustomId(`ticketmgr:adduser:${ticket.channelId}`).setPlaceholder('Add a member to this ticket').setMinValues(1).setMaxValues(1);
  const removeUser = new UserSelectMenuBuilder().setCustomId(`ticketmgr:removeuser:${ticket.channelId}`).setPlaceholder('Remove an added member').setMinValues(1).setMaxValues(1);
  const actions = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`ticketmgr:note:${ticket.channelId}`).setLabel('Add Note').setEmoji('📝').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`ticketmgr:notes:${ticket.channelId}`).setLabel('View Notes').setEmoji('👁️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`ticketmgr:rename:${ticket.channelId}`).setLabel('Rename').setEmoji('✏️').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`ticketmgr:refresh:${ticket.channelId}`).setLabel('Refresh').setEmoji('🔄').setStyle(ButtonStyle.Secondary)
  );
  return { embeds: [embed], components: [
    new ActionRowBuilder().addComponents(transfer),
    new ActionRowBuilder().addComponents(addUser),
    new ActionRowBuilder().addComponents(removeUser),
    actions
  ] };
}

async function collectTranscript(channel, maxMessages = 1000) {
  const all = [];
  let before;
  while (all.length < maxMessages) {
    const batch = await channel.messages.fetch({ limit: Math.min(100, maxMessages - all.length), before }).catch(() => null);
    if (!batch?.size) break;
    const values = [...batch.values()];
    all.push(...values);
    before = values[values.length - 1]?.id;
    if (batch.size < 100) break;
  }
  all.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
  const rows = all.map(m => {
    const attachments = [...m.attachments.values()].map(a => `${a.name || 'file'}: ${a.url}`);
    const content = m.content || (m.embeds.length ? '[embed]' : '');
    const fileText = attachments.length ? `\n  Attachments: ${attachments.join(' | ')}` : '';
    return `[${new Date(m.createdTimestamp).toISOString()}] ${m.author.tag} (${m.author.id}): ${content || '[no text]'}${fileText}`;
  });
  return new AttachmentBuilder(Buffer.from(rows.join('\n'), 'utf8'), { name: `ticket-${channel.id}.txt` });
}

async function createTicket(interaction, store, typeId = '', answers = []) {
  ensureTicketData(store);
  if (store.data.settings.features?.tickets === false) return interaction.reply({ content: 'The ticket system is currently disabled.', flags: MessageFlags.Ephemeral });

  const type = findType(store, typeId) || ticketTypes(store)[0];
  if (!type) return interaction.reply({ content: 'No ticket departments are configured yet.', flags: MessageFlags.Ephemeral });

  let existing = Object.values(store.data.tickets).find(t => t.userId === interaction.user.id && t.status === 'open' && (t.typeId || 'support') === type.id);
  if (existing) {
    const existingChannel = await interaction.guild.channels.fetch(existing.channelId).catch(() => null);

    // If the saved ticket points to a channel that no longer exists, clear the
    // stale record automatically and allow the member to open a fresh ticket.
    if (!existingChannel) {
      delete store.data.tickets[existing.channelId];
      store.save();
      existing = null;
    } else {
      // Repair the member's access in case the channel still exists but its
      // permission overwrite was removed or changed. This prevents Discord
      // from rendering the saved channel mention as #unknown for the owner.
      try {
        const category = existingChannel.parent || (existingChannel.parentId
          ? await interaction.guild.channels.fetch(existingChannel.parentId).catch(() => null)
          : null);
        await applyTicketAccess(
          existingChannel,
          interaction.guild,
          store,
          type,
          interaction.user.id,
          existing.extraUsers || [],
          category
        );
      } catch (repairError) {
        console.warn('[tickets] Could not repair access for existing ticket', existing.channelId, repairError?.message || repairError);
      }

      return interaction.reply({
        content: `You already have an open **${type.label}** ticket: <#${existing.channelId}>`,
        flags: MessageFlags.Ephemeral
      });
    }
  }

  const key = `${interaction.guildId}:${interaction.user.id}`;
  const last = openCooldowns.get(key) || 0;
  if (Date.now() - last < 15000) return interaction.reply({ content: 'Please wait a few seconds before opening another ticket.', flags: MessageFlags.Ephemeral });
  openCooldowns.set(key, Date.now());

  const guild = interaction.guild;
  const number = ticketNumber(store);
  const num = String(number).padStart(4, '0');
  const slug = String(type.label || 'ticket').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 20) || 'ticket';
  const userSlug = interaction.user.username.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 22) || interaction.user.id.slice(-6);

  try {
    const category = type.categoryId ? await guild.channels.fetch(type.categoryId).catch(() => null) : null;
    if (type.categoryId && (!category || category.type !== ChannelType.GuildCategory)) {
      return interaction.reply({ content: `❌ The destination category for **${type.label}** no longer exists. Staff can fix it with \`/ticket-admin\`.`, flags: MessageFlags.Ephemeral });
    }
    const diagnostics = ticketPermissionDiagnostics(guild, category, store, type);
    const blocking = diagnostics.filter(x => !x.includes('staff role'));
    if (blocking.length) {
      return interaction.reply({
        content: `❌ **Ticket permission check failed** for **${type.label}**:

${diagnostics.map(x => `• ${x}`).join('\n')}

Open \`/ticket-admin\` → **Permissions Check** after fixing it.`,
        flags: MessageFlags.Ephemeral
      });
    }

    const channel = await guild.channels.create({
      name: `${slug}-${num}-${userSlug}`.slice(0, 90),
      type: ChannelType.GuildText,
      parent: category?.id || undefined,
      topic: `KIXO ticket #${num} • ${type.label} • ${interaction.user.tag} (${interaction.user.id}) • type ${type.id}`
    });

    try {
      await applyTicketAccess(channel, guild, store, type, interaction.user.id, [], category);
    } catch (permissionError) {
      await channel.delete('Ticket permission setup failed').catch(() => {});
      throw permissionError;
    }

    const ticket = {
      channelId: channel.id,
      number,
      userId: interaction.user.id,
      typeId: type.id,
      typeLabel: type.label,
      categoryId: type.categoryId || '',
      openedAt: new Date().toISOString(),
      status: 'open',
      claimedBy: '',
      autoDeleteAfter: store.data.settings.ticketAutoDeleteEnabled === false ? '' : ticketAutoDeleteDeadline(store),
      extraUsers: [],
      notes: [],
      requestMessage: String(answers.find(a=>isMainTicketQuestion(a.question))?.answer||'').trim().slice(0,1000),
      answers,
      decision: '',
      decidedBy: '',
      decidedAt: ''
    };
    store.data.tickets[channel.id] = ticket;
    store.save();

    const mentionIds = [interaction.user.id];
    let content = `<@${interaction.user.id}>`;
    if (type.staffRoleId) {
      content += ` <@&${type.staffRoleId}>`;
    }
    const sent = await channel.send({
      content,
      ...ticketControlPayload(ticket, type),
      allowedMentions: { users: mentionIds, roles: type.staffRoleId ? [type.staffRoleId] : [] }
    });
    ticket.controlMessageId = sent.id;
    store.save();

    // The opening form answers are sent as readable chat messages rather
    // than repeated as fields in the ticket's control embed.
    for(const payload of ticketOpeningTextPayloads(ticket)){
      try{await channel.send(payload)}
      catch(error){console.error('[tickets] Could not publish ticket opening text:',channel.id,error?.message||error);}
    }

    const rulesPrompt = partnershipRulesPrompt(type);
    if (rulesPrompt) {
      const rulesMessage = await channel.send(rulesPrompt).catch(() => null);
      if (rulesMessage) {
        ticket.rulesMessageId = rulesMessage.id;
        store.save();
      }
    }

    await sendTicketLog(guild, store, `🎫 Ticket #${num} Opened`,
      `**Department:** ${type.label}\n**Member:** <@${interaction.user.id}>\n**Channel:** <#${channel.id}>\n**What can we help you with?**\n${ticket.requestMessage.slice(0,1000)}`);
    return interaction.reply({ content: renderTicketCreatedReply(store, interaction, ticket, type, channel), flags: MessageFlags.Ephemeral });
  } catch (err) {
    console.error('Ticket create error:', err);
    return interaction.reply({ content: `❌ I could not create the ticket. Check **Manage Channels**, **Manage Roles/Permissions**, and the destination category.\n\n${String(err.message || err).slice(0, 300)}`, flags: MessageFlags.Ephemeral });
  }
}

// Central archive category for ALL closed tickets: manually closed, automatic
// closures, and tickets closed before the admin selected a category.
const closedArchiveCreation=new Map();
async function resolveClosedTicketCategory(guild,store,{create=true}={}){
  ensureTicketData(store);
  const configured=String(store.data.settings.ticketClosedCategoryId||'');
  if(configured){
    const ch=await guild.channels.fetch(configured).catch(()=>null);
    if(ch?.type===ChannelType.GuildCategory)return ch;
    if(!create)throw Error('The selected Closed Tickets category is missing or no longer a category. Choose another in the admin page.');
  }
  if(!create)return null;
  if(closedArchiveCreation.has(guild.id))return closedArchiveCreation.get(guild.id);
  const operation=(async()=>{
    const all=await guild.channels.fetch();
    const existing=all.find(ch=>ch?.type===ChannelType.GuildCategory&&/^(?:🔒\s*)?closed[\s-]*tickets$/iu.test(ch.name.trim()));
    let category=existing;
    if(!category){
      const everyone=guild.roles.everyone?.id;
      const overwrites=everyone?[{id:everyone,deny:[PermissionFlagsBits.ViewChannel]}]:[];
      for(const roleId of configuredStaffRoleIds(store)){
        if(roleId&&roleId!==everyone&&guild.roles.cache.has(roleId)){
          overwrites.push({id:roleId,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.ReadMessageHistory]});
        }
      }
      category=await guild.channels.create({
        name:'🔒 CLOSED TICKETS',
        type:ChannelType.GuildCategory,
        permissionOverwrites:overwrites,
        reason:'KIXO closed ticket archive'
      });
    }
    store.data.settings.ticketClosedCategoryId=category.id;
    store.save();
    return category;
  })();
  closedArchiveCreation.set(guild.id,operation);
  try{return await operation}finally{closedArchiveCreation.delete(guild.id)}
}
async function archiveClosedTickets(guild,store,{create=false}={}){
  ensureTicketData(store);
  const cat=await resolveClosedTicketCategory(guild,store,{create});
  if(!cat)return {ok:false,message:'Choose or create a Closed Tickets category first.',moved:0,already:0,missing:0,failed:0,warnings:[]};
  const result={ok:true,categoryId:cat.id,categoryName:cat.name,moved:0,already:0,missing:0,failed:0,warnings:[]};
  for(const ticket of Object.values(store.data.tickets||{})){
    if(ticket?.status!=='closed'||!ticket.channelId)continue;
    const ch=await guild.channels.fetch(ticket.channelId).catch(()=>null);
    if(!ch?.isTextBased?.()){result.missing++;continue;}
    if(ch.parentId===cat.id){result.already++;continue;}
    try{
      await ch.setParent(cat.id,{lockPermissions:false,reason:'KIXO archive closed ticket'});
      result.moved++;
    }catch(error){
      result.failed++;
      result.warnings.push('Ticket #'+String(ticket.number||0).padStart(4,'0')+': '+(error?.message||error));
    }
  }
  result.warnings=result.warnings.slice(0,8);
  result.ok=result.failed===0;
  return result;
}

async function closeTicketWithReason(interaction, store, ticket, reason) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const channel = interaction.channel;
  const transcript = await collectTranscript(channel).catch(() => null);
  ticket.status = 'closed';
  ticket.closedAt = new Date().toISOString();
  ticket.closedBy = interaction.user.id;
  ticket.closeReason = String(reason || 'Closed by staff').slice(0, 1000);
  store.save();

  for (const userId of [ticket.userId, ...(ticket.extraUsers || [])]) {
    await channel.permissionOverwrites.edit(userId, { ViewChannel: true, SendMessages: false, ReadMessageHistory: true, AttachFiles: false }).catch(() => {});
  }
  let archiveWarning='';
  try {
    const archive=await resolveClosedTicketCategory(interaction.guild,store,{create:true});
    if(channel.parentId!==archive.id)
      await channel.setParent(archive.id,{lockPermissions:false,reason:'KIXO ticket closed'});
  }catch(error){
    archiveWarning=String(error?.message||error);
    console.warn('[tickets] Closed ticket could not enter archive:',channel.id,archiveWarning);
  }
  if (!channel.name.startsWith('closed-')) await channel.setName(`closed-${channel.name}`.slice(0, 100)).catch(() => {});
  await refreshTicketHeader(channel, ticket, store);

  const num = String(ticket.number || 0).padStart(4, '0');
  await sendTicketLog(interaction.guild, store, `🔒 Ticket #${num} Closed`, `**Member:** <@${ticket.userId}>\n**Closed by:** <@${interaction.user.id}>\n**Reason:** ${ticket.closeReason}\n**Channel:** <#${channel.id}>`, 0xD90429, transcript);
  await interaction.editReply(archiveWarning?'✅ Ticket closed and saved, but could not move into the Closed Tickets category: '+archiveWarning:'✅ Ticket closed and moved to the Closed Tickets category. Staff can reopen it or delete it permanently.');
}

async function reopenTicket(interaction, store, ticket) {
  const type = findType(store, ticket.typeId);
  ticket.status = 'open';
  ticket.closedAt = '';
  ticket.closedBy = '';
  ticket.closeReason = '';
  ticket.autoDeleteAfter = ticket.claimedBy || store.data.settings.ticketAutoDeleteEnabled === false
    ? ''
    : ticketAutoDeleteDeadline(store);
  store.save();
  const channel = interaction.channel;
  if (ticket.claimedBy) {
    await moveTicketForClaimState(channel, interaction.guild, store, ticket).catch(() => {});
  } else if (type?.categoryId) {
    await channel.setParent(type.categoryId, { lockPermissions: false }).catch(() => {});
  }
  for (const userId of [ticket.userId, ...(ticket.extraUsers || [])]) {
    await channel.permissionOverwrites.edit(userId, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true, AttachFiles: true, EmbedLinks: true }).catch(() => {});
  }
  if (channel.name.startsWith('closed-')) await channel.setName(channel.name.replace(/^closed-/, '').slice(0, 100)).catch(() => {});
  await refreshTicketHeader(channel, ticket, store);
  await sendTicketLog(interaction.guild, store, `🔓 Ticket #${String(ticket.number || 0).padStart(4, '0')} Reopened`, `Reopened by <@${interaction.user.id}> • <#${channel.id}>`);
  return interaction.reply({ content: '✅ Ticket reopened.', flags: MessageFlags.Ephemeral });
}

async function transferTicket(interaction, store, ticket, newTypeId) {
  const type = findType(store, newTypeId);
  if (!type) return interaction.update(ticketManagerPayload(store, ticket, 'That department no longer exists.'));
  const category = type.categoryId ? await interaction.guild.channels.fetch(type.categoryId).catch(() => null) : null;
  if (type.categoryId && (!category || category.type !== ChannelType.GuildCategory)) return interaction.update(ticketManagerPayload(store, ticket, 'The destination category for that department is missing.'));

  ticket.typeId = type.id;
  ticket.typeLabel = type.label;
  ticket.categoryId = type.categoryId || '';
  if (ticket.claimedBy) {
    ticket.preClaimCategoryId = ticket.categoryId;
    const claimedCategory = await resolveClaimedTicketCategory(interaction.guild, store, true).catch(() => null);
    if (claimedCategory) {
      if (interaction.channel.parentId !== claimedCategory.id) await interaction.channel.setParent(claimedCategory.id, { lockPermissions: false });
      await applyTicketAccess(interaction.channel, interaction.guild, store, type, ticket.userId, ticket.extraUsers || [], claimedCategory);
    }
  } else {
    if (category) await interaction.channel.setParent(category.id, { lockPermissions: true });
    await applyTicketAccess(interaction.channel, interaction.guild, store, type, ticket.userId, ticket.extraUsers || [], category);
  }
  store.save();
  await refreshTicketHeader(interaction.channel, ticket, store);
  await sendTicketLog(interaction.guild, store, `🔀 Ticket #${String(ticket.number || 0).padStart(4, '0')} Transferred`, `Transferred by <@${interaction.user.id}> to **${type.label}** • <#${interaction.channelId}>`);
  return interaction.update(ticketManagerPayload(store, ticket, `Transferred to **${type.label}**.`));
}

async function handleTicketInteraction(interaction, store, canUseAdmin) {
  const id = String(interaction.customId || '');
  if (!(id.startsWith('ticket:') || id.startsWith('ticketform:') || id.startsWith('ticketmgr:'))) return false;
  ensureTicketData(store);

  if (interaction.isButton() && id.startsWith('ticket:create:')) {
    const type = findType(store, id.split(':')[2]);
    if (!type) return void await interaction.reply({ content: 'That ticket option is no longer available.', flags: MessageFlags.Ephemeral });
    await interaction.showModal(openFormModal(type));
    return true;
  }

  if (interaction.isModalSubmit() && id.startsWith('ticketform:')) {
    const type = findType(store, id.split(':')[1]);
    if (!type) return void await interaction.reply({ content: 'That ticket option is no longer available.', flags: MessageFlags.Ephemeral });
    const request = String(interaction.fields.getTextInputValue('request') || '').trim();
    if(!request) {
      await interaction.reply({ content: 'Please describe what you need help with before opening a ticket.', flags: MessageFlags.Ephemeral });
      return true;
    }
    const answers = [{question:'What can we help you with?',answer:request},
      ...additionalTicketQuestions(type).map((question,i)=>({question,answer:String(interaction.fields.getTextInputValue(`q${i}`)||'').trim()}))];
    await createTicket(interaction, store, type.id, answers);
    return true;
  }

  const ticket = findTicket(store, interaction.channelId);
  if (!ticket && !id.startsWith('ticketmgr:')) {
    await interaction.reply({ content: 'This is not an active KIXO ticket.', flags: MessageFlags.Ephemeral }).catch(() => {});
    return true;
  }


  if (interaction.isButton() && (id === 'ticket:rules:en' || id === 'ticket:rules:es')) {
    const type = findType(store, ticket.typeId);
    const spanish = id.endsWith(':es');
    const rules = String(spanish ? type?.partnerRulesEs || '' : type?.partnerRulesEn || '').trim();
    if (!rules) return void await interaction.reply({ content: spanish ? 'Las reglas en Español no están configuradas todavía.' : 'English rules are not configured yet.', flags: MessageFlags.Ephemeral });
    const embed = new EmbedBuilder()
      .setColor(brandColor())
      .setTitle(spanish ? '🇲🇽 REGLAS DE PARTNERSHIP' : '🇺🇸 PARTNERSHIP RULES')
      .setDescription(rules.slice(0, 4096))
      .setFooter({ text: spanish ? 'KIXO • Lee las reglas antes de continuar' : 'KIXO • Read the rules before continuing' });
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    return true;
  }

  async function executeTicketDecision(decisionInteraction, decisionTicket, decisionType, approving, requestedChannelName = '', existingChannelId = '') {
    if (decisionTicket.decision) {
      await decisionInteraction.reply({ content: `This ticket was already **${decisionTicket.decision}** by <@${decisionTicket.decidedBy}>.`, flags: MessageFlags.Ephemeral });
      return;
    }

    let grantedRole = null;
    let approvedChannel = null;
    const member = approving ? await decisionInteraction.guild.members.fetch(decisionTicket.userId).catch(() => null) : null;
    if (approving && !member) {
      await decisionInteraction.reply({ content: '❌ I could not find the ticket owner in this server.', flags: MessageFlags.Ephemeral });
      return;
    }

    if (approving && decisionType.approvalRoleId) {
      const role = decisionInteraction.guild.roles.cache.get(decisionType.approvalRoleId) || await decisionInteraction.guild.roles.fetch(decisionType.approvalRoleId).catch(() => null);
      if (!role) {
        await decisionInteraction.reply({ content: '❌ The configured approval role no longer exists. Open `/ticket-admin` → **Approval** and select a new role.', flags: MessageFlags.Ephemeral });
        return;
      }
      if (!botCanManageRole(decisionInteraction.guild, role.id)) {
        await decisionInteraction.reply({ content: `❌ I cannot give ${role}. Move my bot role above that role and make sure I have **Manage Roles**.`, flags: MessageFlags.Ephemeral });
        return;
      }
      await member.roles.add(role.id, `Ticket #${String(decisionTicket.number || 0).padStart(4, '0')} approved by ${decisionInteraction.user.tag}`);
      grantedRole = role;
    }

    if (approving && decisionType.approvalCreateChannel) {
      if (!decisionType.approvalCategoryId) {
        await decisionInteraction.reply({ content: '❌ Approved-channel creation is ON, but no category is selected. Open `/ticket-admin` → **Approval** and choose a category.', flags: MessageFlags.Ephemeral });
        return;
      }
      const category = await decisionInteraction.guild.channels.fetch(decisionType.approvalCategoryId).catch(() => null);
      if (!category || category.type !== ChannelType.GuildCategory) {
        await decisionInteraction.reply({ content: '❌ The configured approved-partner category no longer exists. Open `/ticket-admin` → **Approval** and select it again.', flags: MessageFlags.Ephemeral });
        return;
      }
      const me = decisionInteraction.guild.members.me;
      const perms = me && category.permissionsFor(me);
      if (!perms?.has(PermissionFlagsBits.ManageChannels)) {
        await decisionInteraction.reply({ content: `❌ I cannot create a channel under ${category}. Give the bot **Manage Channels** permission for that category.`, flags: MessageFlags.Ephemeral });
        return;
      }

      const channelName = sanitizeChannelName(requestedChannelName || renderApprovalChannelName(decisionType, decisionTicket, member));
      approvedChannel = await decisionInteraction.guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: category.id,
        topic: `Approved KIXO partnership • ${member.user.tag} (${member.id}) • Ticket #${String(decisionTicket.number || 0).padStart(4, '0')}`
      });
      decisionTicket.approvedChannelId = approvedChannel.id;
    }

    if (approving && existingChannelId) {
      const existingChannel = await decisionInteraction.guild.channels.fetch(existingChannelId).catch(() => null);
      if (!existingChannel || existingChannel.type !== ChannelType.GuildText) {
        await decisionInteraction.reply({ content: '❌ That text channel no longer exists. Please choose another channel.', flags: MessageFlags.Ephemeral });
        return;
      }
      const me = decisionInteraction.guild.members.me;
      const perms = me && existingChannel.permissionsFor(me);
      if (!perms?.has(PermissionFlagsBits.ManageChannels)) {
        await decisionInteraction.reply({ content: `❌ I cannot change permissions for ${existingChannel}. Give the bot **Manage Channels** permission there.`, flags: MessageFlags.Ephemeral });
        return;
      }
      await existingChannel.permissionOverwrites.edit(member.id, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
        AttachFiles: true,
        EmbedLinks: true
      }, { reason: `Approved KIXO partnership via ticket #${String(decisionTicket.number || 0).padStart(4, '0')}` });
      approvedChannel = existingChannel;
      decisionTicket.approvedChannelId = existingChannel.id;
      decisionTicket.approvedChannelMode = 'existing';
    } else if (approvedChannel) {
      decisionTicket.approvedChannelMode = 'created';
    }

    decisionTicket.decision = approving ? 'approved' : 'denied';
    decisionTicket.decidedBy = decisionInteraction.user.id;
    decisionTicket.decidedAt = new Date().toISOString();
    store.save();
    await refreshTicketHeader(decisionInteraction.channel, decisionTicket, store);

    const subject = String(decisionType.label || 'Application').trim() || 'Application';
    const decisionEmbed = new EmbedBuilder()
      .setColor(approving ? 0x22C55E : 0xD90429)
      .setTitle(approving ? `✅ ${subject} Approved` : `❌ ${subject} Denied`)
      .setDescription(approving
        ? `<@${decisionTicket.userId}>, your **${subject}** has been approved.${grantedRole ? `\n\nYou received ${grantedRole}.` : ''}${approvedChannel ? `\n\nYou now have access to: ${approvedChannel}` : ''}`
        : `<@${decisionTicket.userId}>, your **${subject}** has been denied.`)
      .setFooter({ text: `Decision by ${decisionInteraction.user.tag}` })
      .setTimestamp();
    await decisionInteraction.channel.send({ content: `<@${decisionTicket.userId}>`, embeds: [decisionEmbed], allowedMentions: { users: [decisionTicket.userId] } });
    await sendTicketLog(decisionInteraction.guild, store, `${approving ? '✅' : '❌'} Ticket #${String(decisionTicket.number || 0).padStart(4, '0')} ${approving ? 'Approved' : 'Denied'}`, `**Department:** ${subject}\n**Member:** <@${decisionTicket.userId}>\n**Decision by:** <@${decisionInteraction.user.id}>${grantedRole ? `\n**Role added:** ${grantedRole}` : ''}${approvedChannel ? `\n**Partner channel:** ${approvedChannel}${decisionTicket.approvedChannelMode === 'existing' ? ' (existing channel access granted)' : ' (new channel created)'}` : ''}\n**Ticket channel:** <#${decisionInteraction.channelId}>`, approving ? 0x22C55E : 0xD90429);
    await decisionInteraction.reply({ content: approving ? `✅ Approved.${grantedRole ? ` ${grantedRole} was added to <@${decisionTicket.userId}>.` : ''}${approvedChannel ? ` Partner access: ${approvedChannel}.` : ''}` : '❌ Partnership/application denied.', flags: MessageFlags.Ephemeral });
  }

  if (interaction.isModalSubmit() && id.startsWith('ticket:decision:approve-name:')) {
    if (!canUseAdmin(interaction)) return void await interaction.reply({ content: 'Staff only.', flags: MessageFlags.Ephemeral });
    const modalTicket = findTicket(store, interaction.channelId);
    if (!modalTicket) return void await interaction.reply({ content: 'This is not an active KIXO ticket.', flags: MessageFlags.Ephemeral });
    const modalType = findType(store, modalTicket.typeId);
    if (!modalType?.approvalEnabled) return void await interaction.reply({ content: 'Approval workflow is not enabled for this department.', flags: MessageFlags.Ephemeral });
    const requestedChannelName = interaction.fields.getTextInputValue('channelName');
    await executeTicketDecision(interaction, modalTicket, modalType, true, requestedChannelName);
    return true;
  }

  if (interaction.isButton() && (id === 'ticket:decision:approve' || id === 'ticket:decision:deny')) {
    if (!canUseAdmin(interaction)) return void await interaction.reply({ content: 'Staff only.', flags: MessageFlags.Ephemeral });
    const type = findType(store, ticket.typeId);
    if (!type?.approvalEnabled) return void await interaction.reply({ content: 'Approval workflow is not enabled for this department.', flags: MessageFlags.Ephemeral });
    if (ticket.decision) return void await interaction.reply({ content: `This ticket was already **${ticket.decision}** by <@${ticket.decidedBy}>.`, flags: MessageFlags.Ephemeral });

    const approving = id.endsWith(':approve');
    if (approving) {
      await interaction.reply({ ...approvalAccessChoicePayload(type), flags: MessageFlags.Ephemeral });
      return true;
    }

    await executeTicketDecision(interaction, ticket, type, false);
    return true;
  }

  if (interaction.isButton() && id === 'ticket:decision:approve-create') {
    if (!canUseAdmin(interaction)) return void await interaction.reply({ content: 'Staff only.', flags: MessageFlags.Ephemeral });
    const choiceTicket = findTicket(store, interaction.channelId);
    const choiceType = choiceTicket ? findType(store, choiceTicket.typeId) : null;
    if (!choiceTicket || !choiceType?.approvalEnabled) return void await interaction.reply({ content: 'This approval workflow is no longer available.', flags: MessageFlags.Ephemeral });
    if (!choiceType.approvalCreateChannel || !choiceType.approvalCategoryId) return void await interaction.reply({ content: '❌ New partner channel creation is not configured. Open `/ticket-admin` → **Approval** and enable it/select a category.', flags: MessageFlags.Ephemeral });
    await interaction.showModal(approvalDecisionChannelNameModal(choiceTicket));
    return true;
  }

  if (interaction.isButton() && id === 'ticket:decision:approve-existing') {
    if (!canUseAdmin(interaction)) return void await interaction.reply({ content: 'Staff only.', flags: MessageFlags.Ephemeral });
    const choiceTicket = findTicket(store, interaction.channelId);
    const choiceType = choiceTicket ? findType(store, choiceTicket.typeId) : null;
    if (!choiceTicket || !choiceType?.approvalEnabled) return void await interaction.reply({ content: 'This approval workflow is no longer available.', flags: MessageFlags.Ephemeral });
    await interaction.reply({ ...approvalExistingChannelPayload(), flags: MessageFlags.Ephemeral });
    return true;
  }

  if (interaction.isButton() && id === 'ticket:decision:approve-only') {
    if (!canUseAdmin(interaction)) return void await interaction.reply({ content: 'Staff only.', flags: MessageFlags.Ephemeral });
    const choiceTicket = findTicket(store, interaction.channelId);
    const choiceType = choiceTicket ? findType(store, choiceTicket.typeId) : null;
    if (!choiceTicket || !choiceType?.approvalEnabled) return void await interaction.reply({ content: 'This approval workflow is no longer available.', flags: MessageFlags.Ephemeral });
    await executeTicketDecision(interaction, choiceTicket, choiceType, true);
    return true;
  }

  if (interaction.isChannelSelectMenu() && id === 'ticket:decision:existing-channel') {
    if (!canUseAdmin(interaction)) return void await interaction.reply({ content: 'Staff only.', flags: MessageFlags.Ephemeral });
    const choiceTicket = findTicket(store, interaction.channelId);
    const choiceType = choiceTicket ? findType(store, choiceTicket.typeId) : null;
    if (!choiceTicket || !choiceType?.approvalEnabled) return void await interaction.reply({ content: 'This approval workflow is no longer available.', flags: MessageFlags.Ephemeral });
    const selectedChannelId = interaction.values?.[0] || '';
    await executeTicketDecision(interaction, choiceTicket, choiceType, true, '', selectedChannelId);
    return true;
  }

  if (interaction.isButton() && id === 'ticket:claim') {
    if (!canUseAdmin(interaction)) return void await interaction.reply({ content: 'Staff only.', flags: MessageFlags.Ephemeral });
    if (ticket.claimedBy && ticket.claimedBy !== interaction.user.id) return void await interaction.reply({ content: `This ticket is already claimed by <@${ticket.claimedBy}>.`, flags: MessageFlags.Ephemeral });

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const claiming = !ticket.claimedBy;
    ticket.claimedBy = claiming ? interaction.user.id : '';
    // Claimed tickets are fully protected from automatic cleanup. If staff
    // later unclaims the ticket, start a brand-new timer from that moment.
    ticket.autoDeleteAfter = ticket.claimedBy || store.data.settings.ticketAutoDeleteEnabled === false
      ? ''
      : ticketAutoDeleteDeadline(store);

    let moveMessage = '';
    try {
      const result = await moveTicketForClaimState(interaction.channel, interaction.guild, store, ticket);
      if (claiming && result.category) moveMessage = ` Moved to **${result.category.name}**.`;
      if (!claiming) moveMessage = result.category ? ` Returned to **${result.category.name}**.` : ' Returned to its normal ticket area.';
    } catch (error) {
      console.error('Ticket claim category move failed:', error);
      moveMessage = ' ⚠️ The claim status was saved, but I could not move the channel. Check **Manage Channels** permission and the claimed-ticket category.';
    }

    store.save();
    await refreshTicketHeader(interaction.channel, ticket, store);
    await sendTicketLog(interaction.guild, store, ticket.claimedBy ? '🙋 Ticket Claimed' : '↩️ Ticket Unclaimed', `Ticket #${String(ticket.number || 0).padStart(4, '0')} • <#${interaction.channelId}> • by <@${interaction.user.id}>${moveMessage}`);
    await interaction.editReply({ content: ticket.claimedBy ? `✅ Ticket claimed.${moveMessage}` : `✅ Ticket unclaimed.${moveMessage} Fresh ${ticketAutoDeleteHours(store)}h auto-close timer started.` });
    return true;
  }

  if (interaction.isButton() && id === 'ticket:manage') {
    if (!canUseAdmin(interaction)) return void await interaction.reply({ content: 'Staff only.', flags: MessageFlags.Ephemeral });
    await interaction.reply({ ...ticketManagerPayload(store, ticket), flags: MessageFlags.Ephemeral });
    return true;
  }

  if (interaction.isButton() && id === 'ticket:close') {
    const isOwner = ticket.userId === interaction.user.id;
    const isStaff = canUseAdmin(interaction);
    if (!isOwner && !isStaff) return void await interaction.reply({ content: 'Only the ticket owner or staff can close this ticket.', flags: MessageFlags.Ephemeral });
    // V8.34: close immediately. No close-reason form/modal.
    const automaticReason = isStaff && !isOwner ? 'Closed by staff' : 'Closed by ticket owner';
    await closeTicketWithReason(interaction, store, ticket, automaticReason);
    return true;
  }

  if (interaction.isButton() && id === 'ticket:reopen') {
    if (!canUseAdmin(interaction)) return void await interaction.reply({ content: 'Staff only.', flags: MessageFlags.Ephemeral });
    await reopenTicket(interaction, store, ticket);
    return true;
  }

  if (interaction.isButton() && id === 'ticket:delete') {
    if (!canUseAdmin(interaction)) return void await interaction.reply({ content: 'Staff only.', flags: MessageFlags.Ephemeral });
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`ticket:deleteconfirm:${interaction.channelId}`).setLabel('Delete Permanently').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`ticket:deletecancel:${interaction.channelId}`).setLabel('Cancel').setStyle(ButtonStyle.Secondary)
    );
    await interaction.reply({ content: '⚠️ Permanently delete this ticket channel? This cannot be undone.', components: [row], flags: MessageFlags.Ephemeral });
    return true;
  }

  if (interaction.isButton() && id.startsWith('ticket:deletecancel:')) {
    await interaction.update({ content: 'Delete cancelled.', components: [] });
    return true;
  }

  if (interaction.isButton() && id.startsWith('ticket:deleteconfirm:')) {
    if (!canUseAdmin(interaction)) return void await interaction.reply({ content: 'Staff only.', flags: MessageFlags.Ephemeral });
    const channelId = id.split(':')[2];
    const t = findTicket(store, channelId);
    if (t) {
      t.status = 'deleted';
      t.deletedAt = new Date().toISOString();
      t.deletedBy = interaction.user.id;
      store.save();
      await sendTicketLog(interaction.guild, store, `🗑️ Ticket #${String(t.number || 0).padStart(4, '0')} Deleted`, `Deleted permanently by <@${interaction.user.id}>.`);
    }
    await interaction.update({ content: 'Deleting ticket channel…', components: [] });
    setTimeout(() => interaction.channel.delete('KIXO ticket permanently deleted').catch(() => {}), 800);
    return true;
  }

  const channelId = id.split(':')[2];
  const managed = findTicket(store, channelId);
  if (id.startsWith('ticketmgr:')) {
    if (!canUseAdmin(interaction)) return void await interaction.reply({ content: 'Staff only.', flags: MessageFlags.Ephemeral }).catch(() => {});
    if (!managed) return void await interaction.reply({ content: 'Ticket no longer exists in the data store.', flags: MessageFlags.Ephemeral }).catch(() => {});
  }

  if (interaction.isStringSelectMenu() && id.startsWith('ticketmgr:transfer:')) {
    await transferTicket(interaction, store, managed, interaction.values[0]);
    return true;
  }

  if (interaction.isUserSelectMenu() && id.startsWith('ticketmgr:adduser:')) {
    const userId = interaction.values[0];
    if (userId === managed.userId) return void await interaction.update(ticketManagerPayload(store, managed, 'That member already owns this ticket.'));
    if (!managed.extraUsers.includes(userId)) managed.extraUsers.push(userId);
    store.save();
    const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
    await channel?.permissionOverwrites.edit(userId, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true, AttachFiles: true, EmbedLinks: true }).catch(() => {});
    await interaction.update(ticketManagerPayload(store, managed, `Added <@${userId}> to the ticket.`));
    return true;
  }

  if (interaction.isUserSelectMenu() && id.startsWith('ticketmgr:removeuser:')) {
    const userId = interaction.values[0];
    if (userId === managed.userId) return void await interaction.update(ticketManagerPayload(store, managed, 'You cannot remove the ticket owner.'));
    managed.extraUsers = managed.extraUsers.filter(x => x !== userId);
    store.save();
    const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
    await channel?.permissionOverwrites.delete(userId).catch(() => {});
    await interaction.update(ticketManagerPayload(store, managed, `Removed <@${userId}> from the ticket.`));
    return true;
  }

  if (interaction.isButton() && id.startsWith('ticketmgr:note:')) {
    await interaction.showModal(noteModal(channelId));
    return true;
  }

  if (interaction.isModalSubmit() && id.startsWith('ticket:note:')) {
    const t = findTicket(store, id.split(':')[2]);
    if (!t || !canUseAdmin(interaction)) return void await interaction.reply({ content: 'Staff only or ticket not found.', flags: MessageFlags.Ephemeral });
    t.notes.push({ by: interaction.user.id, at: new Date().toISOString(), text: String(interaction.fields.getTextInputValue('note')).slice(0, 1500) });
    t.notes = t.notes.slice(-50);
    store.save();
    await interaction.reply({ ...ticketManagerPayload(store, t, 'Private staff note saved.'), flags: MessageFlags.Ephemeral });
    return true;
  }

  if (interaction.isButton() && id.startsWith('ticketmgr:notes:')) {
    const notes = managed.notes?.length ? managed.notes.slice(-15).map((n, i) => `**${i + 1}.** <@${n.by}> • ${new Date(n.at).toLocaleString()}\n${n.text}`).join('\n\n') : 'No private staff notes yet.';
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(brandColor()).setTitle('📝 Private Staff Notes').setDescription(notes.slice(0, 4000))], flags: MessageFlags.Ephemeral });
    return true;
  }

  if (interaction.isButton() && id.startsWith('ticketmgr:rename:')) {
    const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
    await interaction.showModal(renameModal(channelId, channel?.name || 'ticket'));
    return true;
  }

  if (interaction.isModalSubmit() && id.startsWith('ticket:rename:')) {
    if (!canUseAdmin(interaction)) return void await interaction.reply({ content: 'Staff only.', flags: MessageFlags.Ephemeral });
    const t = findTicket(store, id.split(':')[2]);
    if (!t) return void await interaction.reply({ content: 'Ticket not found.', flags: MessageFlags.Ephemeral });
    const name = String(interaction.fields.getTextInputValue('name') || '').toLowerCase().replace(/[^a-z0-9-_]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90);
    if (!name) return void await interaction.reply({ content: 'Please enter a valid channel name.', flags: MessageFlags.Ephemeral });
    await interaction.channel.setName(name).catch(() => {});
    await interaction.reply({ content: `✅ Ticket renamed to **${name}**.`, flags: MessageFlags.Ephemeral });
    return true;
  }

  if (interaction.isButton() && id.startsWith('ticketmgr:refresh:')) {
    await interaction.update(ticketManagerPayload(store, managed, 'Refreshed.'));
    return true;
  }

  return false;
}


// Persistent setting names "ticketAutoDelete*" are retained for backward compatibility.
// The expiry action is now a NON-DESTRUCTIVE archive/close, never channel.delete().
async function runTicketAutoDeleteSweep(guild, store) {
  ensureTicketData(store);
  if (store.data.settings.ticketAutoDeleteEnabled === false) {
    return { enabled: false, closed: 0, deleted: 0, protected: 0, seeded: 0, failed: 0, missing: 0 };
  }
  const now = Date.now();
  const hours = ticketAutoDeleteHours(store);
  let closed = 0, protected = 0, seeded = 0, failed = 0, missing = 0;
  let changed = false;

  for (const [channelId, ticket] of Object.entries(store.data.tickets || {})) {
    if (!ticket || ticket.status !== 'open') continue;
    if (ticket.claimedBy) {
      protected++;
      if (ticket.autoDeleteAfter) { ticket.autoDeleteAfter = ''; changed = true; }
      continue;
    }
    let expiresAt = Date.parse(ticket.autoDeleteAfter || '');
    if (!Number.isFinite(expiresAt)) {
      // Give old records with missing deadlines a full fresh grace period.
      ticket.autoDeleteAfter = new Date(now + hours * 3600000).toISOString();
      seeded++;
      changed = true;
      continue;
    }
    if (expiresAt > now) continue;
    const current = store.data.tickets[channelId];
    if (!current || current.status !== 'open' || current.claimedBy) continue;

    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (!channel?.isTextBased?.()) {
      // Discord channel is already gone; only its stale database record is removed.
      if (!channel) { delete store.data.tickets[channelId]; missing++; changed = true; }
      else { failed++; current.autoDeleteAfter = new Date(Date.now()+900000).toISOString(); changed = true; }
      continue;
    }
    const transcript = await collectTranscript(channel).catch(() => null);
    const latest = store.data.tickets[channelId];
    if (!latest || latest.status !== 'open' || latest.claimedBy) continue;

    // Block competing claim interactions while closing and archiving the ticket.
    latest.status = 'closing';
    try {
      // Preserve the channel and all its messages. Lock the requester and any
      // additional ticket members out of posting, as with staff-initiated closes.
      for (const userId of new Set([latest.userId, ...(latest.extraUsers||[])].filter(Boolean))) {
        await channel.permissionOverwrites.edit(userId, {
          ViewChannel: true,
          SendMessages: false,
          ReadMessageHistory: true,
          AttachFiles: false
        },{reason:'KIXO automatically closed unclaimed ticket'});
      }
      const archive=await resolveClosedTicketCategory(guild,store,{create:true});
      if(channel.parentId!==archive.id)
        await channel.setParent(archive.id,{lockPermissions:false,reason:'KIXO auto-close unclaimed ticket'});
      if(!channel.name.startsWith('closed-')){
        await channel.setName(('closed-'+channel.name).slice(0,100),'KIXO auto-close unclaimed ticket')
          .catch(err=>console.warn('[tickets] Could not rename auto-closed ticket:',channelId,err.message));
      }

      latest.status='closed';
      latest.closedAt=new Date().toISOString();
      latest.closedBy=guild.client?.user?.id||'system';
      latest.closeReason='Automatically closed after '+hours+' hour(s) without a staff claim.';
      latest.autoDeleteAfter='';
      store.save();
      changed=false; // the current ticket is safely persisted already
      closed++;
      await refreshTicketHeader(channel,latest,store).catch(()=>{});
      const number=String(latest.number||0).padStart(4,'0');
      await channel.send({
        content:'🔒 **Ticket #'+number+' automatically closed** after '+hours+
          ' hour(s) without being claimed. This channel and its messages have been saved. Staff can reopen the ticket.',
        allowedMentions:{parse:[]}
      }).catch(()=>{});
      await sendTicketLog(
        guild,store,'🔒 Ticket #'+number+' Auto-Closed',
        '**Department:** '+(latest.typeLabel||findType(store,latest.typeId)?.label||'Support')+
          '\n**Member:** <@'+latest.userId+'>\n**Channel:** <#'+channelId+
          '>\n**Reason:** Unclaimed for '+hours+' hour(s). **Messages preserved; channel not deleted.**',
        0xD90429,transcript
      ).catch(()=>{});
    }catch(error){
      // Never delete the channel on failure; retry the archive shortly.
      latest.status='open';
      latest.autoDeleteAfter=new Date(Date.now()+15*60000).toISOString();
      changed=true;
      failed++;
      console.error('[tickets] Auto-close failed for '+channelId+':',error?.message||error);
    }
  }
  if(changed)store.save();
  return {enabled:true,closed,deleted:0,protected,seeded,failed,missing,hours};
}

async function repairTicketControls(guild, store) {
  ensureTicketData(store);
  let updated = 0;
  let missing = 0;
  for (const ticket of Object.values(store.data.tickets || {})) {
    if (!ticket.channelId || !ticket.controlMessageId || !['open', 'closed'].includes(ticket.status)) continue;
    const channel = await guild.channels.fetch(ticket.channelId).catch(() => null);
    if (!channel?.isTextBased()) { missing++; continue; }
    const message = await channel.messages.fetch(ticket.controlMessageId).catch(() => null);
    if (!message) { missing++; continue; }
    const type = findType(store, ticket.typeId);
    await message.edit(ticketControlPayload(ticket, type)).catch(() => {});
    updated++;
  }
  return { updated, missing };
}

// Backward-compatible wrapper for any older direct close routing.
async function closeTicket(interaction, store) {
  const ticket = findTicket(store, interaction.channelId);
  if (!ticket) return interaction.reply({ content: 'This channel is not an active KIXO ticket.', flags: MessageFlags.Ephemeral });
  return interaction.showModal(closeReasonModal(interaction.channelId));
}


function clearStaleTicketsForUser(store, guild, userId) {
  ensureTicketData(store);
  return (async () => {
    let cleared = 0;
    let kept = 0;
    const member = await guild.members.fetch(userId).catch(() => null);
    for (const ticket of Object.values(store.data.tickets || {})) {
      if (!ticket || ticket.userId !== userId || ticket.status !== 'open') continue;
      const channel = ticket.channelId ? await guild.channels.fetch(ticket.channelId).catch(() => null) : null;
      const canView = !!(channel && member && channel.permissionsFor(member)?.has(PermissionFlagsBits.ViewChannel));
      if (!channel || !channel.isTextBased?.() || !canView) {
        ticket.status = 'orphaned';
        ticket.orphanedAt = Date.now();
        ticket.orphanReason = !channel ? 'manual_cleanup_channel_missing' : (!channel.isTextBased?.() ? 'manual_cleanup_invalid_channel' : 'manual_cleanup_owner_cannot_view');
        cleared++;
      } else {
        kept++;
      }
    }
    if (cleared) store.save();
    return { cleared, kept };
  })();
}

function resetAllOpenTicketRecords(store) {
  ensureTicketData(store);
  let reset = 0;
  const now = Date.now();
  for (const ticket of Object.values(store.data.tickets || {})) {
    if (!ticket || ticket.status !== 'open') continue;
    ticket.status = 'reset';
    ticket.resetAt = now;
    ticket.resetReason = 'admin_reset_all_open_ticket_records';
    reset++;
  }
  if (reset) store.save();
  return { reset };
}

module.exports = {
  clearStaleTicketsForUser,
  resetAllOpenTicketRecords,
  ticketPanel,
  ticketAdminPanel,
  advancedAdminPanel,
  staffTicketControlsPayload,
  handleTicketAdminInteraction,
  handleTicketInteraction,
  handleTicketCustomMessage,
  repairTicketControls,
  runTicketAutoDeleteSweep,
  resolveClosedTicketCategory,
  archiveClosedTickets,
  createTicket,
  closeTicket
};
