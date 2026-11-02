const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

function panelOption(o, required = true) {
  return o.setName('panel').setDescription('Choose one of your saved rules panels').setRequired(required).setAutocomplete(true);
}

function buildCommands() {
  return [
    new SlashCommandBuilder().setName('ai').setDescription('SEMENTAL AI controls')
      .addSubcommand(s => s.setName('ask').setDescription('Ask SEMENTAL AI a question').addStringOption(o => o.setName('question').setDescription('Question').setRequired(true)))
      .addSubcommand(s => s.setName('status').setDescription('Show AI/index status'))
      .addSubcommand(s => s.setName('sync').setDescription('Rescan the current knowledge sources'))
      .addSubcommand(s => s.setName('sync-all').setDescription('Auto-discover and scan all readable server channels'))
      .addSubcommand(s => s.setName('rescan').setDescription('Force a complete server knowledge rescan'))
      .addSubcommand(s => s.setName('answer-channel').setDescription('Set the automatic answer channel').addChannelOption(o => o.setName('channel').setDescription('Help channel').setRequired(true)))
      .addSubcommand(s => s.setName('auto-discover').setDescription('Turn server-wide channel discovery on or off').addBooleanOption(o => o.setName('enabled').setDescription('Enable automatic discovery').setRequired(true)))
      .addSubcommand(s => s.setName('smart-filter').setDescription('Automatically skip common chat/log/ticket channels').addBooleanOption(o => o.setName('enabled').setDescription('Enable smart filtering').setRequired(true)))
      .addSubcommand(s => s.setName('ignore-channel').setDescription('Exclude a channel from AI knowledge').addChannelOption(o => o.setName('channel').setDescription('Channel to ignore').setRequired(true)))
      .addSubcommand(s => s.setName('allow-channel').setDescription('Remove a channel from the ignore list').addChannelOption(o => o.setName('channel').setDescription('Channel to allow').setRequired(true)))
      .addSubcommand(s => s.setName('ignore-category').setDescription('Exclude every channel in a category').addChannelOption(o => o.setName('category').setDescription('Category to ignore').addChannelTypes(ChannelType.GuildCategory).setRequired(true)))
      .addSubcommand(s => s.setName('allow-category').setDescription('Remove a category from the ignore list').addChannelOption(o => o.setName('category').setDescription('Category to allow').addChannelTypes(ChannelType.GuildCategory).setRequired(true)))
      .addSubcommand(s => s.setName('source-add').setDescription('Add/allow a knowledge source channel').addChannelOption(o => o.setName('channel').setDescription('Source channel').setRequired(true)))
      .addSubcommand(s => s.setName('source-remove').setDescription('Remove/ignore a knowledge source channel').addChannelOption(o => o.setName('channel').setDescription('Source channel').setRequired(true)))
      .addSubcommand(s => s.setName('sources').setDescription('Show discovery mode and ignored sources'))
      .addSubcommand(s => s.setName('mode').setDescription('Choose answer mode').addStringOption(o => o.setName('mode').setDescription('Mode').setRequired(true).addChoices({name:'Hybrid',value:'hybrid'},{name:'AI',value:'ai'},{name:'Search only',value:'search'})))
      .addSubcommand(s => s.setName('reset-settings').setDescription('Reset SEMENTAL AI settings back to defaults').addBooleanOption(o => o.setName('confirm').setDescription('Confirm that you want to reset the AI settings').setRequired(true))),

    new SlashCommandBuilder().setName('rules').setDescription('Open a private SEMENTAL rules panel')
      .addStringOption(o => panelOption(o, false)),
    new SlashCommandBuilder().setName('rules-create').setDescription('Create a new independent bilingual rules panel')
      .addStringOption(o => o.setName('name').setDescription('Panel name').setRequired(true).setMaxLength(80)),
    new SlashCommandBuilder().setName('rules-edit').setDescription('Open the rules editor for a panel')
      .addStringOption(o => panelOption(o, true)),
    new SlashCommandBuilder().setName('rules-design').setDescription('Open the design menu for a rules panel')
      .addStringOption(o => panelOption(o, true)),
    new SlashCommandBuilder().setName('rules-publish').setDescription('Publish another copy of a rules panel')
      .addStringOption(o => panelOption(o, true))
      .addChannelOption(o => o.setName('channel').setDescription('Channel to publish in; defaults to this channel').setRequired(false)),
    new SlashCommandBuilder().setName('rules-list').setDescription('List all rules panels'),
    new SlashCommandBuilder().setName('rules-repair').setDescription('Repair and refresh existing published rules panels'),
    new SlashCommandBuilder().setName('rules-delete').setDescription('Delete a rules panel from the bot')
      .addStringOption(o => panelOption(o, true))
      .addBooleanOption(o => o.setName('delete_messages').setDescription('Also delete all published copies from Discord').setRequired(false)),

    new SlashCommandBuilder().setName('ticket-admin').setDescription('Open the advanced SEMENTAL ticket control center inside Discord'),
    new SlashCommandBuilder().setName('ticket-publish-panel').setDescription('Publish the configured SEMENTAL ticket panel')
      .addChannelOption(o => o.setName('channel').setDescription('Channel to publish the ticket panel').setRequired(false)),
    new SlashCommandBuilder().setName('ticket-panel').setDescription('Legacy alias: post the configured SEMENTAL support ticket panel')
      .addChannelOption(o => o.setName('channel').setDescription('Channel to post the ticket panel').setRequired(false)),
    new SlashCommandBuilder().setName('ticket-controls').setDescription('Open private staff controls for the current ticket'),
    new SlashCommandBuilder().setName('ticket-reset-user').setDescription('Clear stale/invisible open ticket records for a member')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addUserOption(o => o.setName('user').setDescription('Member with the stuck ticket').setRequired(true))
      .addBooleanOption(o => o.setName('confirm').setDescription('Confirm cleanup').setRequired(true)),
    new SlashCommandBuilder().setName('announce').setDescription('Send a branded announcement')
      .addStringOption(o => o.setName('title').setDescription('Announcement title').setRequired(true))
      .addStringOption(o => o.setName('message').setDescription('Announcement message').setRequired(true))
      .addChannelOption(o => o.setName('channel').setDescription('Where to post it').setRequired(false)),
    new SlashCommandBuilder().setName('warn').setDescription('Warn a member').addUserOption(o=>o.setName('user').setDescription('Member').setRequired(true)).addStringOption(o=>o.setName('reason').setDescription('Reason').setRequired(true)),
    new SlashCommandBuilder().setName('timeout').setDescription('Timeout a member').addUserOption(o=>o.setName('user').setDescription('Member').setRequired(true)).addIntegerOption(o=>o.setName('minutes').setDescription('Minutes').setMinValue(1).setMaxValue(40320).setRequired(true)).addStringOption(o=>o.setName('reason').setDescription('Reason').setRequired(false)),
    new SlashCommandBuilder().setName('kick').setDescription('Kick a member').addUserOption(o=>o.setName('user').setDescription('Member').setRequired(true)).addStringOption(o=>o.setName('reason').setDescription('Reason').setRequired(false)),
    new SlashCommandBuilder().setName('ban').setDescription('Ban a member').addUserOption(o=>o.setName('user').setDescription('Member').setRequired(true)).addStringOption(o=>o.setName('reason').setDescription('Reason').setRequired(false)),
    new SlashCommandBuilder().setName('spam-guard').setDescription('Configure automatic cross-channel spam protection')
      .addSubcommand(s=>s.setName('status').setDescription('Show spam guard settings and required permissions'))
      .addSubcommand(s=>s.setName('enable').setDescription('Turn cross-channel spam protection on or off')
        .addBooleanOption(o=>o.setName('enabled').setDescription('Enable the spam guard').setRequired(true)))
      .addSubcommand(s=>s.setName('config').setDescription('Change spam detection thresholds and automatic action')
        .addIntegerOption(o=>o.setName('min_channels').setDescription('Distinct channels required (2-10)').setMinValue(2).setMaxValue(10).setRequired(false))
        .addIntegerOption(o=>o.setName('window_seconds').setDescription('Detection window in seconds (5-120)').setMinValue(5).setMaxValue(120).setRequired(false))
        .addStringOption(o=>o.setName('action').setDescription('Automatic action').setRequired(false).addChoices({name:'Ban user',value:'ban'},{name:'Timeout user',value:'timeout'},{name:'Delete spam only',value:'delete'}))
        .addIntegerOption(o=>o.setName('timeout_minutes').setDescription('Timeout length if action is timeout').setMinValue(1).setMaxValue(40320).setRequired(false)))
      .addSubcommand(s=>s.setName('ignore-channel').setDescription('Do not scan one channel for cross-channel spam')
        .addChannelOption(o=>o.setName('channel').setDescription('Channel to ignore').setRequired(true)))
      .addSubcommand(s=>s.setName('allow-channel').setDescription('Remove a channel from the spam ignore list')
        .addChannelOption(o=>o.setName('channel').setDescription('Channel to scan again').setRequired(true)))
      .addSubcommand(s=>s.setName('ignore-role').setDescription('Exempt a role from the spam guard')
        .addRoleOption(o=>o.setName('role').setDescription('Role to exempt').setRequired(true)))
      .addSubcommand(s=>s.setName('allow-role').setDescription('Remove a role exemption from the spam guard')
        .addRoleOption(o=>o.setName('role').setDescription('Role to scan again').setRequired(true))),
    new SlashCommandBuilder().setName('rank').setDescription('Show a member level').addUserOption(o=>o.setName('user').setDescription('Member').setRequired(false)),
    new SlashCommandBuilder().setName('leaderboard').setDescription('Show the server XP leaderboard'),
    new SlashCommandBuilder().setName('welcome-config').setDescription('Configure welcome messages')
      .addChannelOption(o=>o.setName('channel').setDescription('Welcome channel').setRequired(true))
      .addRoleOption(o=>o.setName('role').setDescription('Optional role given to new members').setRequired(false)),
    new SlashCommandBuilder().setName('verify-config').setDescription('Configure SEMENTAL member verification')
      .addRoleOption(o=>o.setName('join_role').setDescription('Role members have before verification').setRequired(true))
      .addRoleOption(o=>o.setName('verified_role').setDescription('Role members receive after verification').setRequired(true))
      .addBooleanOption(o=>o.setName('assign_join_role').setDescription('Should this bot add the join role to new members?').setRequired(false)),
    new SlashCommandBuilder().setName('verify-panel').setDescription('Post the SEMENTAL Verify button panel')
      .addChannelOption(o=>o.setName('channel').setDescription('Channel to post the Verify panel').setRequired(false)),
    new SlashCommandBuilder().setName('verify-all').setDescription('Verify all current human members (Administrator only)')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addBooleanOption(o=>o.setName('confirm').setDescription('Confirm bulk verification').setRequired(true)),
    new SlashCommandBuilder().setName('verify-status').setDescription('Show the current verification configuration'),
    new SlashCommandBuilder().setName('verify-admin').setDescription('Open the private SEMENTAL verification admin panel inside Discord'),
    new SlashCommandBuilder().setName('bot-config').setDescription('Show SEMENTAL bot configuration')
  ].map(c => c.toJSON());
}

function isStaff(interaction, store) {
  const perms = interaction.memberPermissions || interaction.member?.permissions;
  if (perms?.has(PermissionFlagsBits.ManageGuild)) return true;
  const roles = interaction.member?.roles?.cache;
  return store.data.settings.staffRoleIds.some(id => roles?.has(id));
}

module.exports = { buildCommands, isStaff };
