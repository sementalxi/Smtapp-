const fs = require('fs');
const path = require('path');
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  RoleSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  ChannelType,
  MessageFlags,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  AttachmentBuilder
} = require('discord.js');
const { brandColor } = require('./embeds');
const { DATA_DIR } = require('./store');

const VERIFY_ASSET_DIR = path.join(DATA_DIR, 'verify-assets');
fs.mkdirSync(VERIFY_ASSET_DIR, { recursive: true });

function settings(store) {
  return store.data.settings;
}

function parseColor(value) {
  const raw = String(value || '').trim();
  if (/^#[0-9a-f]{6}$/i.test(raw)) return Number.parseInt(raw.slice(1), 16);
  if (/^[0-9a-f]{6}$/i.test(raw)) return Number.parseInt(raw, 16);
  return brandColor();
}

function attachmentFor(relativePath, fallbackName) {
  if (!relativePath) return null;
  const fullPath = path.resolve(DATA_DIR, relativePath);
  if (!fullPath.startsWith(path.resolve(DATA_DIR)) || !fs.existsSync(fullPath)) return null;
  const name = path.basename(fullPath) || fallbackName;
  return { attachment: new AttachmentBuilder(fullPath, { name }), name };
}

function verificationPanel(store) {
  const s = settings(store);
  const embed = new EmbedBuilder()
    .setColor(parseColor(s.verifyPanelColor || '#5865F2'))
    .setDescription(String(s.verifyPanelText || 'This server requires you to verify yourself to get access to the other channels. Click the Verify button below to continue.').slice(0, 4096));

  if (String(s.verifyPanelTitle || '').trim()) embed.setTitle(String(s.verifyPanelTitle).trim().slice(0, 256));

  const files = [];
  const logo = attachmentFor(s.verifyLogoFile, 'verify-logo.png');
  const banner = attachmentFor(s.verifyBannerFile, 'verify-banner.png');

  if (logo) {
    files.push(logo.attachment);
    embed.setThumbnail(`attachment://${logo.name}`);
  } else if (s.verifyLogoUrl) {
    embed.setThumbnail(s.verifyLogoUrl);
  }

  if (banner) {
    files.push(banner.attachment);
    embed.setImage(`attachment://${banner.name}`);
  } else if (s.verifyBannerUrl) {
    embed.setImage(s.verifyBannerUrl);
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('verify:member')
      .setLabel(String(s.verifyButtonText || 'Verify').slice(0, 80))
      .setStyle(ButtonStyle.Primary)
  );

  const payload = { embeds: [embed], components: [row] };
  if (files.length) payload.files = files;
  return payload;
}

function verificationAdminPanel(store, notice = '') {
  const s = settings(store);
  const enabled = s.features?.verification !== false;
  const joinRole = s.unverifiedRoleId ? `<@&${s.unverifiedRoleId}>` : '**Not configured**';
  const verifiedRole = s.verifiedRoleId ? `<@&${s.verifiedRoleId}>` : '**Not configured**';
  const autoJoin = s.verifyAssignJoinRole === true;
  const hasLogo = Boolean(s.verifyLogoFile || s.verifyLogoUrl);
  const hasBanner = Boolean(s.verifyBannerFile || s.verifyBannerUrl);

  const description = [
    notice ? `**${notice}**\n` : '',
    'Manage verification and customize the simple member Verify panel from Discord.',
    '',
    `**Verification:** ${enabled ? '🟢 ON' : '🔴 OFF'}`,
    `**Join / Unverified role:** ${joinRole}`,
    `**Verified role:** ${verifiedRole}`,
    `**Auto-add Join role:** ${autoJoin ? '🟢 ON' : '⚪ OFF'}`,
    '',
    '**Panel Design**',
    `**Title:** ${String(s.verifyPanelTitle || '').trim() || 'None'}`,
    `**Button:** ${s.verifyButtonText || 'Verify'}`,
    `**Color:** ${s.verifyPanelColor || '#5865F2'}`,
    `**Logo:** ${hasLogo ? '✅ Uploaded' : 'Not set'}`,
    `**Banner:** ${hasBanner ? '✅ Uploaded' : 'Not set'}`,
    '',
    'Use **Edit Panel** for the wording, then **Upload Logo** or **Upload Banner** to send an image directly in Discord.'
  ].filter(Boolean).join('\n');

  const embed = new EmbedBuilder()
    .setColor(brandColor())
    .setTitle('🛡️ KIXO • VERIFICATION ADMIN')
    .setDescription(description)
    .setFooter({ text: 'Private staff control panel • KIXO' })
    .setTimestamp();

  const joinRoleRow = new ActionRowBuilder().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId('verifyadmin:role:join')
      .setPlaceholder(s.unverifiedRoleId ? 'Change Join / Unverified role' : 'Choose Join / Unverified role')
      .setMinValues(1)
      .setMaxValues(1)
  );

  const verifiedRoleRow = new ActionRowBuilder().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId('verifyadmin:role:verified')
      .setPlaceholder(s.verifiedRoleId ? 'Change Verified role' : 'Choose Verified role')
      .setMinValues(1)
      .setMaxValues(1)
  );

  const channelRow = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId('verifyadmin:channel:panel')
      .setPlaceholder('Post Verify Panel in a channel')
      .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
      .setMinValues(1)
      .setMaxValues(1)
  );

  const designRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('verifyadmin:design').setLabel('Edit Panel').setEmoji('✏️').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('verifyadmin:upload:logo').setLabel('Upload Logo').setEmoji('🖼️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('verifyadmin:upload:banner').setLabel('Upload Banner').setEmoji('🌄').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('verifyadmin:design:clear-images').setLabel('Clear Images').setEmoji('🗑️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('verifyadmin:preview').setLabel('Preview').setEmoji('👁️').setStyle(ButtonStyle.Secondary)
  );

  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('verifyadmin:toggle:system')
      .setLabel(enabled ? 'Disable' : 'Enable')
      .setEmoji(enabled ? '⛔' : '✅')
      .setStyle(enabled ? ButtonStyle.Danger : ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('verifyadmin:toggle:auto')
      .setLabel(autoJoin ? 'Auto Join: ON' : 'Auto Join: OFF')
      .setEmoji('👤')
      .setStyle(autoJoin ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('verifyadmin:bulk')
      .setLabel('Verify All')
      .setEmoji('👥')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('verifyadmin:refresh')
      .setLabel('Refresh')
      .setEmoji('🔄')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('verifyadmin:close')
      .setLabel('Close')
      .setEmoji('✖️')
      .setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [joinRoleRow, verifiedRoleRow, channelRow, designRow, buttons] };
}

function verificationDesignModal(store) {
  const s = settings(store);
  const modal = new ModalBuilder().setCustomId('verifyadmin:design:modal').setTitle('Edit Verify Panel');

  const title = new TextInputBuilder()
    .setCustomId('title')
    .setLabel('Title (optional)')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(256);
  if (String(s.verifyPanelTitle || '').trim()) title.setValue(String(s.verifyPanelTitle).slice(0, 256));

  const message = new TextInputBuilder()
    .setCustomId('message')
    .setLabel('Verification message')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(4000)
    .setValue(String(s.verifyPanelText || 'This server requires you to verify yourself to get access to the other channels. Click the Verify button below to continue.').slice(0, 4000));

  const button = new TextInputBuilder()
    .setCustomId('button')
    .setLabel('Button text')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(80)
    .setValue(String(s.verifyButtonText || 'Verify').slice(0, 80));

  const color = new TextInputBuilder()
    .setCustomId('color')
    .setLabel('Embed color — example #5865F2')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(7)
    .setValue(String(s.verifyPanelColor || '#5865F2').slice(0, 7));

  modal.addComponents(
    new ActionRowBuilder().addComponents(title),
    new ActionRowBuilder().addComponents(message),
    new ActionRowBuilder().addComponents(button),
    new ActionRowBuilder().addComponents(color)
  );
  return modal;
}

function bulkConfirmPanel(store) {
  const s = settings(store);
  const embed = new EmbedBuilder()
    .setColor(0xD90429)
    .setTitle('⚠️ Confirm Bulk Verification')
    .setDescription([
      'This will process **every human member** currently in the server.',
      '',
      `• Add Verified role: ${s.verifiedRoleId ? `<@&${s.verifiedRoleId}>` : '**Not configured**'}`,
      `• Remove Join role: ${s.unverifiedRoleId ? `<@&${s.unverifiedRoleId}>` : '**Not configured**'}`,
      '• Bots are skipped automatically.',
      '',
      '**This can change roles for a large number of members.**'
    ].join('\n'));
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('verifyadmin:bulk:confirm').setLabel('Confirm Verify All').setEmoji('✅').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('verifyadmin:bulk:cancel').setLabel('Cancel').setEmoji('↩️').setStyle(ButtonStyle.Secondary)
  );
  return { embeds: [embed], components: [row] };
}

function validateRole(guild, role, label) {
  if (!role) return `${label} role was not found.`;
  if (role.id === guild.id) return `${label} cannot be @everyone.`;
  if (role.managed) return `${label} is managed by Discord/integration and cannot be assigned or removed by the bot.`;
  const me = guild.members.me;
  if (!me?.permissions.has(PermissionFlagsBits.ManageRoles)) return 'The bot needs the **Manage Roles** permission.';
  if (role.position >= me.roles.highest.position) return `Move the bot role **above ${role.name}** in Server Settings → Roles.`;
  return '';
}

async function handleVerifyButton(interaction, store) {
  if (!interaction.isButton() || interaction.customId !== 'verify:member') return false;
  const s = settings(store);
  if (s.features?.verification === false) {
    await interaction.reply({ content: 'Verification is currently disabled.', flags: MessageFlags.Ephemeral });
    return true;
  }
  if (!s.unverifiedRoleId || !s.verifiedRoleId) {
    await interaction.reply({ content: 'Verification has not been configured yet. Staff must run `/verify-admin` first.', flags: MessageFlags.Ephemeral });
    return true;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
  if (!member) {
    await interaction.editReply('I could not load your server membership. Please try again.');
    return true;
  }

  const joinRole = await interaction.guild.roles.fetch(s.unverifiedRoleId).catch(() => null);
  const verifiedRole = await interaction.guild.roles.fetch(s.verifiedRoleId).catch(() => null);
  const joinError = validateRole(interaction.guild, joinRole, 'Join / Unverified');
  const verifiedError = validateRole(interaction.guild, verifiedRole, 'Verified');
  if (joinError || verifiedError) {
    await interaction.editReply(`⚠️ Verification setup needs staff attention.\n${verifiedError || joinError}`);
    return true;
  }

  try {
    if (!member.roles.cache.has(verifiedRole.id)) await member.roles.add(verifiedRole, 'KIXO verification button');
    if (member.roles.cache.has(joinRole.id)) await member.roles.remove(joinRole, 'KIXO verification completed');
    await interaction.editReply(`✅ **You are verified!**\nYou now have ${verifiedRole} and ${joinRole} has been removed.`);
  } catch (err) {
    console.error('Verification button error:', err);
    await interaction.editReply(`❌ I could not update your roles. Make sure the bot has **Manage Roles** and its bot role is above both verification roles.\n\nError: ${String(err.message || err).slice(0, 300)}`);
  }
  return true;
}

async function applyJoinVerificationRole(member, store) {
  const s = settings(store);
  if (s.features?.verification === false || s.verifyAssignJoinRole !== true || !s.unverifiedRoleId || member.user.bot) return;
  const role = await member.guild.roles.fetch(s.unverifiedRoleId).catch(() => null);
  if (!role || validateRole(member.guild, role, 'Join / Unverified')) return;
  if (!member.roles.cache.has(role.id)) await member.roles.add(role, 'KIXO join verification role').catch(err => console.error('Could not add join verification role:', err.message));
}

async function repairRecentUnverifiedMembers(guild, store, hours = 24) {
  const s = settings(store);
  if (s.features?.verification === false || s.verifyAssignJoinRole !== true || !s.unverifiedRoleId) {
    return { checked: 0, repaired: 0, skipped: 0, failed: 0 };
  }

  const joinRole = await guild.roles.fetch(s.unverifiedRoleId).catch(() => null);
  const joinError = validateRole(guild, joinRole, 'Join / Unverified');
  if (joinError) throw new Error(joinError);

  const verifiedRole = s.verifiedRoleId
    ? await guild.roles.fetch(s.verifiedRoleId).catch(() => null)
    : null;
  const members = await guild.members.fetch();
  const cutoff = Date.now() - Math.max(1, Number(hours || 24)) * 60 * 60 * 1000;

  let checked = 0, repaired = 0, skipped = 0, failed = 0;
  for (const member of members.values()) {
    if (member.user.bot || member.id === guild.ownerId) { skipped++; continue; }
    if (!member.joinedTimestamp || member.joinedTimestamp < cutoff) { skipped++; continue; }
    checked++;
    if (verifiedRole && member.roles.cache.has(verifiedRole.id)) { skipped++; continue; }
    if (member.roles.cache.has(joinRole.id)) { skipped++; continue; }
    try {
      await member.roles.add(joinRole, 'KIXO verification startup repair');
      repaired++;
    } catch (err) {
      failed++;
      console.error(`Could not repair join verification role for ${member.user.tag}:`, err.message);
    }
  }
  return { checked, repaired, skipped, failed };
}

async function runBulkVerify(guild, actorTag, store) {
  const s = settings(store);
  if (!s.unverifiedRoleId || !s.verifiedRoleId) throw new Error('Configure both verification roles first.');

  const joinRole = await guild.roles.fetch(s.unverifiedRoleId).catch(() => null);
  const verifiedRole = await guild.roles.fetch(s.verifiedRoleId).catch(() => null);
  const joinError = validateRole(guild, joinRole, 'Join / Unverified');
  const verifiedError = validateRole(guild, verifiedRole, 'Verified');
  if (joinError || verifiedError) throw new Error(verifiedError || joinError);

  const members = await guild.members.fetch();
  const humans = [...members.values()].filter(m => !m.user.bot);
  let verified = 0, already = 0, failed = 0, removedJoin = 0;

  for (let i = 0; i < humans.length; i += 5) {
    const batch = humans.slice(i, i + 5);
    await Promise.all(batch.map(async member => {
      try {
        const hadVerified = member.roles.cache.has(verifiedRole.id);
        if (!hadVerified) {
          await member.roles.add(verifiedRole, `Bulk verification by ${actorTag}`);
          verified++;
        } else already++;
        if (member.roles.cache.has(joinRole.id)) {
          await member.roles.remove(joinRole, `Bulk verification by ${actorTag}`);
          removedJoin++;
        }
      } catch (err) {
        failed++;
        console.error(`Bulk verify failed for ${member.user.tag}:`, err.message);
      }
    }));
  }

  return { humans: humans.length, verified, already, failed, removedJoin };
}

function bulkSummary(result) {
  return `✅ **Bulk verification complete.**\n\n• Human members checked: **${result.humans}**\n• Verified role added: **${result.verified}**\n• Already verified: **${result.already}**\n• Join role removed: **${result.removedJoin}**\n• Failed: **${result.failed}**\n\nBots were skipped automatically.`;
}

async function verifyAllMembers(interaction, store) {
  const s = settings(store);
  if (!s.unverifiedRoleId || !s.verifiedRoleId) {
    return interaction.reply({ content: 'Configure verification first with `/verify-admin`.', flags: MessageFlags.Ephemeral });
  }
  const confirm = interaction.options.getBoolean('confirm', true);
  if (!confirm) return interaction.reply({ content: 'Bulk verification cancelled. No member roles were changed.', flags: MessageFlags.Ephemeral });

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    const result = await runBulkVerify(interaction.guild, interaction.user.tag, store);
    return interaction.editReply(bulkSummary(result));
  } catch (err) {
    return interaction.editReply(`❌ ${err.message}`);
  }
}

function imageExtension(attachment) {
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

async function saveUploadedImage(attachment, kind) {
  const ext = imageExtension(attachment);
  if (!ext) throw new Error('Please upload a PNG, JPG, WEBP, or GIF image.');
  if (Number(attachment.size || 0) > 10 * 1024 * 1024) throw new Error('Image is too large. Keep it under 10 MB.');

  const response = await fetch(attachment.url);
  if (!response.ok) throw new Error(`Could not download the image (${response.status}).`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 10 * 1024 * 1024) throw new Error('Image is too large. Keep it under 10 MB.');

  for (const old of fs.readdirSync(VERIFY_ASSET_DIR)) {
    if (old.startsWith(`verify-${kind}.`)) {
      try { fs.unlinkSync(path.join(VERIFY_ASSET_DIR, old)); } catch {}
    }
  }

  const filename = `verify-${kind}.${ext}`;
  const fullPath = path.join(VERIFY_ASSET_DIR, filename);
  fs.writeFileSync(fullPath, bytes);
  return path.relative(DATA_DIR, fullPath).replace(/\\/g, '/');
}

async function requestImageUpload(interaction, store, kind) {
  const label = kind === 'logo' ? 'logo' : 'banner';
  if (!interaction.channel?.awaitMessages) {
    await interaction.reply({ content: `I cannot receive an upload in this channel. Run \`/verify-admin\` in a normal staff text channel and try **Upload ${label}** again.`, flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.reply({
    content: `🖼️ **Upload your ${label} now.**\nSend **one image** in this channel within 60 seconds. PNG, JPG, WEBP, or GIF • max 10 MB.\n\nThe bot will save it to your Railway \`/data\` volume and try to delete your upload message afterward. Type **cancel** to stop.`,
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
    const relative = await saveUploadedImage(attachment, kind);
    const patch = kind === 'logo'
      ? { verifyLogoFile: relative, verifyLogoUrl: '' }
      : { verifyBannerFile: relative, verifyBannerUrl: '' };
    store.updateSettings(patch);
    await message.delete().catch(() => {});
    await interaction.editReply(`✅ ${kind === 'logo' ? 'Logo' : 'Banner'} uploaded and saved. Click **Refresh** in /verify-admin, then **Preview** to see it.`);
  } catch (err) {
    if (String(err?.message || '').includes('time')) {
      await interaction.editReply('⌛ Upload timed out. Press the upload button again when you are ready.');
    } else {
      await interaction.editReply(`❌ ${err.message}`);
    }
  }
}

function clearVerificationImages(store) {
  for (const old of fs.readdirSync(VERIFY_ASSET_DIR)) {
    if (old.startsWith('verify-logo.') || old.startsWith('verify-banner.')) {
      try { fs.unlinkSync(path.join(VERIFY_ASSET_DIR, old)); } catch {}
    }
  }
  store.updateSettings({ verifyLogoFile: '', verifyBannerFile: '', verifyLogoUrl: '', verifyBannerUrl: '' });
}

async function handleVerificationAdminInteraction(interaction, store, isStaff) {
  const id = String(interaction.customId || '');
  if (!id.startsWith('verifyadmin:')) return false;

  if (!isStaff(interaction, store)) {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: 'This verification control panel is staff-only.', flags: MessageFlags.Ephemeral }).catch(() => {});
    }
    return true;
  }

  const s = settings(store);

  if (id === 'verifyadmin:design:modal' && interaction.isModalSubmit()) {
    const title = interaction.fields.getTextInputValue('title').trim();
    const message = interaction.fields.getTextInputValue('message').trim();
    const button = interaction.fields.getTextInputValue('button').trim() || 'Verify';
    const color = interaction.fields.getTextInputValue('color').trim() || '#5865F2';
    if (!/^#?[0-9a-f]{6}$/i.test(color)) {
      await interaction.reply({ content: '❌ Color must be a 6-digit hex color such as `#5865F2`.', flags: MessageFlags.Ephemeral });
      return true;
    }
    store.updateSettings({
      verifyPanelTitle: title,
      verifyPanelText: message,
      verifyButtonText: button,
      verifyPanelColor: color.startsWith('#') ? color : `#${color}`
    });
    await interaction.reply({ content: '✅ Verify panel design saved. Open `/verify-admin` and press **Preview** to see it.', flags: MessageFlags.Ephemeral });
    return true;
  }

  if (id === 'verifyadmin:design') {
    await interaction.showModal(verificationDesignModal(store));
    return true;
  }

  if (id === 'verifyadmin:upload:logo') {
    await requestImageUpload(interaction, store, 'logo');
    return true;
  }

  if (id === 'verifyadmin:upload:banner') {
    await requestImageUpload(interaction, store, 'banner');
    return true;
  }

  if (id === 'verifyadmin:design:clear-images') {
    clearVerificationImages(store);
    await interaction.update(verificationAdminPanel(store, '✅ Logo and banner cleared.'));
    return true;
  }

  if (id === 'verifyadmin:preview') {
    await interaction.reply({ ...verificationPanel(store), flags: MessageFlags.Ephemeral });
    return true;
  }

  if (id === 'verifyadmin:refresh') {
    await interaction.update(verificationAdminPanel(store));
    return true;
  }

  if (id === 'verifyadmin:close') {
    await interaction.update({ content: '✅ Verification admin panel closed.', embeds: [], components: [] });
    return true;
  }

  if (id === 'verifyadmin:toggle:system') {
    const next = s.features?.verification === false;
    store.updateSettings({ features: { ...s.features, verification: next } });
    await interaction.update(verificationAdminPanel(store, `Verification is now ${next ? 'ON' : 'OFF'}.`));
    return true;
  }

  if (id === 'verifyadmin:toggle:auto') {
    const next = !s.verifyAssignJoinRole;
    store.updateSettings({ verifyAssignJoinRole: next });
    await interaction.update(verificationAdminPanel(store, `Automatic Join-role assignment is now ${next ? 'ON' : 'OFF'}.`));
    return true;
  }

  if (id === 'verifyadmin:role:join' && interaction.isRoleSelectMenu()) {
    const roleId = interaction.values[0];
    const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
    if (roleId === s.verifiedRoleId) {
      await interaction.update(verificationAdminPanel(store, '❌ Join / Unverified role must be different from the Verified role.'));
      return true;
    }
    const err = validateRole(interaction.guild, role, 'Join / Unverified');
    if (err) {
      await interaction.update(verificationAdminPanel(store, `❌ ${err}`));
      return true;
    }
    store.updateSettings({ unverifiedRoleId: role.id, verifyAssignJoinRole: true });
    await interaction.update(verificationAdminPanel(store, `✅ Join / Unverified role set to @${role.name}.`));
    return true;
  }

  if (id === 'verifyadmin:role:verified' && interaction.isRoleSelectMenu()) {
    const roleId = interaction.values[0];
    const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
    if (roleId === s.unverifiedRoleId) {
      await interaction.update(verificationAdminPanel(store, '❌ Verified role must be different from the Join / Unverified role.'));
      return true;
    }
    const err = validateRole(interaction.guild, role, 'Verified');
    if (err) {
      await interaction.update(verificationAdminPanel(store, `❌ ${err}`));
      return true;
    }
    store.updateSettings({ verifiedRoleId: role.id });
    await interaction.update(verificationAdminPanel(store, `✅ Verified role set to @${role.name}.`));
    return true;
  }

  if (id === 'verifyadmin:channel:panel' && interaction.isChannelSelectMenu()) {
    const channelId = interaction.values[0];
    const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
    if (!s.unverifiedRoleId || !s.verifiedRoleId) {
      await interaction.update(verificationAdminPanel(store, '❌ Choose both verification roles before publishing the Verify panel.'));
      return true;
    }
    if (!channel?.isTextBased?.()) {
      await interaction.update(verificationAdminPanel(store, '❌ Choose a text or announcement channel.'));
      return true;
    }
    try {
      await channel.send(verificationPanel(store));
      await interaction.update(verificationAdminPanel(store, `✅ Verify panel posted in #${channel.name}.`));
    } catch (err) {
      await interaction.update(verificationAdminPanel(store, `❌ Could not post in #${channel?.name || 'that channel'}: ${err.message}`));
    }
    return true;
  }

  if (id === 'verifyadmin:bulk') {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: 'Only a server Administrator can use **Verify All Members**.', flags: MessageFlags.Ephemeral });
      return true;
    }
    await interaction.update(bulkConfirmPanel(store));
    return true;
  }

  if (id === 'verifyadmin:bulk:cancel') {
    await interaction.update(verificationAdminPanel(store, 'Bulk verification cancelled.'));
    return true;
  }

  if (id === 'verifyadmin:bulk:confirm') {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: 'Only a server Administrator can use **Verify All Members**.', flags: MessageFlags.Ephemeral });
      return true;
    }
    await interaction.deferUpdate();
    try {
      const result = await runBulkVerify(interaction.guild, interaction.user.tag, store);
      await interaction.editReply(verificationAdminPanel(store, `✅ Bulk complete: ${result.humans} checked • ${result.verified} newly verified • ${result.already} already verified • ${result.removedJoin} join roles removed • ${result.failed} failed.`));
    } catch (err) {
      await interaction.editReply(verificationAdminPanel(store, `❌ ${err.message}`));
    }
    return true;
  }

  return false;
}

module.exports = {
  verificationPanel,
  verificationAdminPanel,
  handleVerificationAdminInteraction,
  handleVerifyButton,
  applyJoinVerificationRole,
  repairRecentUnverifiedMembers,
  verifyAllMembers,
  validateRole
};
