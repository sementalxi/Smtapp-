require('dotenv').config();
const {
  Client, GatewayIntentBits, Partials, REST, Routes, EmbedBuilder, MessageFlags, PermissionFlagsBits
} = require('discord.js');
const { Store } = require('./store');
const {
  rebuildKnowledge, upsertMessage, deleteMessage, shouldIndex,
  scanChannelHistory, removeChannelMessages, removeMessagesForCategory
} = require('./knowledge');
const { answerQuestion } = require('./ai');
const { aiAnswerEmbed, successEmbed, errorEmbed, brandColor } = require('./embeds');
const { buildCommands, isStaff } = require('./commands');
const { addMessageXp, rankEmbed, leaderboardEmbed } = require('./levels');
const { autoModerate, addWarning, logAction, spamSettings } = require('./moderation');
const { ticketPanel, ticketAdminPanel, staffTicketControlsPayload, handleTicketAdminInteraction, handleTicketInteraction, handleTicketCustomMessage, repairTicketControls, clearStaleTicketsForUser} = require('./tickets');
const { startHealthServer } = require('./health');
const { verificationPanel, verificationAdminPanel, handleVerificationAdminInteraction, handleVerifyButton, applyJoinVerificationRole, repairRecentUnverifiedMembers, verifyAllMembers, validateRole } = require('./verification');
const {
  RulesStore, publicPanelPayload, privateRulesPayload, sendSeparateRules, editorPayload, designMenuPayload,
  refreshPublishedPanel, deletePublishedMessages, handleRulesInteraction
} = require('./rules');

for (const key of ['DISCORD_TOKEN','GUILD_ID']) if (!process.env[key]) { console.error(`Missing ${key}`); process.exit(1); }
const store = new Store();
const rulesStore = new RulesStore();
const client = new Client({
  intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMembers,GatewayIntentBits.GuildMessages,GatewayIntentBits.MessageContent,GatewayIntentBits.GuildModeration],
  partials:[Partials.Channel,Partials.Message,Partials.GuildMember]
});
let syncing = false;

async function registerCommands() {
  const rest = new REST({ version:'10' }).setToken(process.env.DISCORD_TOKEN);
  await rest.put(Routes.applicationGuildCommands(client.user.id, process.env.GUILD_ID), { body: buildCommands() });
}
async function syncKnowledge(guild) {
  if (syncing) return null;
  syncing = true;
  try { return await rebuildKnowledge(guild, store, Math.max(50, Number(process.env.MAX_MESSAGES_PER_CHANNEL || 500))); }
  finally { syncing = false; }
}
function newFeedbackId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

function visibleSourceChannels(guild, member) {
  const ids = new Set();
  if (!guild || !member) return ids;
  for (const ch of guild.channels.cache.values()) {
    try {
      if (ch.permissionsFor(member)?.has(PermissionFlagsBits.ViewChannel)) ids.add(ch.id);
    } catch {}
  }
  return ids;
}

async function sendAiAnswer(message, question) {
  await message.channel.sendTyping().catch(()=>{});
  const feedbackId = newFeedbackId();
  const result = await answerQuestion(question, store, {
    rulesStore,
    userId: message.author.id,
    channelId: message.channel.id,
    allowedChannelIds: visibleSourceChannels(message.guild, message.member)
  });
  const { embed, rows } = aiAnswerEmbed(question, result, { feedbackId });
  const sent = await message.reply({ embeds:[embed], components:rows, allowedMentions:{ repliedUser:false } }).catch(()=>null);
  store.logQA({
    id: feedbackId,
    userId:message.author.id,
    channelId:message.channel.id,
    question,
    answer:result.text,
    mode:result.mode,
    confidence:result.confidence,
    sourceCount:result.sources.length,
    sourceIds:result.sources.slice(0,8).map(x=>x.id),
    responseMessageId:sent?.id || null
  });
}
async function welcome(member) {
  if (!store.data.settings.features.welcomes) return;
  const s=store.data.settings;
  if (s.welcomeRoleId) await member.roles.add(s.welcomeRoleId).catch(()=>{});
  if (!s.welcomeChannelId) return;
  const ch=await member.guild.channels.fetch(s.welcomeChannelId).catch(()=>null);
  if (!ch?.isTextBased()) return;
  const embed=new EmbedBuilder().setColor(brandColor()).setTitle(`Welcome to SEMENTAL, ${member.user.username}!`).setDescription('Welcome to the community. Please read the rules, get your roles, and check the latest league announcements.').setThumbnail(member.displayAvatarURL()).setFooter({text:'COMPETE WITH RESPECT • PLAY TO WIN'});
  await ch.send({ content:`<@${member.id}>`, embeds:[embed], allowedMentions:{users:[member.id]} }).catch(()=>{});
}
function getPanel(interaction) {
  return rulesStore.find(interaction.options.getString('panel') || '');
}

client.once('clientReady', async()=>{
  console.log(`SEMENTAL AI + RULES online as ${client.user.tag}`);
  await registerCommands();
  const guild=await client.guilds.fetch(process.env.GUILD_ID);
  const result=await syncKnowledge(guild).catch(e=>{console.error('Initial sync:',e);return null;});
  if(result) console.log(`Indexed ${result.messages} messages from ${result.channels} channels (${result.excluded || 0} excluded).`);
  console.log(`Loaded ${rulesStore.list().length} rules panels from rules-panels.json.`);
  let repaired = 0, stale = 0;
  for (const panel of rulesStore.list()) {
    const r = await refreshPublishedPanel(client, panel, rulesStore).catch(e => {
      console.error(`Rules panel refresh failed for ${panel.name}:`, e.message);
      return { updated: 0, stale: 0 };
    });
    repaired += r?.updated || 0;
    stale += r?.stale || 0;
  }
  console.log(`Rules publication repair: ${repaired} updated, ${stale} stale/unreachable.`);
  const ticketRepair = await repairTicketControls(guild, store).catch(e => { console.error('Ticket control repair:', e.message); return null; });
  if (ticketRepair) console.log(`Ticket control repair: ${ticketRepair.updated} updated, ${ticketRepair.missing} missing/unreachable.`);
  const verifyRepairHours = Math.max(1, Number(process.env.VERIFY_REPAIR_HOURS || 24));
  const verifyRepair = await repairRecentUnverifiedMembers(guild, store, verifyRepairHours).catch(e => {
    console.error('Verification startup repair:', e.message);
    return null;
  });
  if (verifyRepair) console.log(`Verification startup repair (${verifyRepairHours}h): ${verifyRepair.repaired} role(s) restored, ${verifyRepair.failed} failed.`);
  const spamCfg = spamSettings(store);
  const me = guild.members.me || await guild.members.fetchMe().catch(()=>null);
  if (spamCfg.enabled && me) {
    const missing = [];
    if (!me.permissions.has(PermissionFlagsBits.ManageMessages)) missing.push('Manage Messages');
    if (spamCfg.action === 'ban' && !me.permissions.has(PermissionFlagsBits.BanMembers)) missing.push('Ban Members');
    if (spamCfg.action === 'timeout' && !me.permissions.has(PermissionFlagsBits.ModerateMembers)) missing.push('Moderate Members');
    if (missing.length) console.warn(`Spam Guard enabled but missing permissions: ${missing.join(', ')}`);
    else console.log(`Spam Guard ON: ${spamCfg.minChannels} channels / ${spamCfg.windowSeconds}s / action ${spamCfg.action}.`);
  }
  client.user.setActivity('SEMENTAL • AI + Rules');
  startHealthServer(client, store, rulesStore);
  const mins=Math.max(5,Number(process.env.AUTO_SYNC_MINUTES||30));
  setInterval(()=>syncKnowledge(guild).catch(e=>console.error('Scheduled sync:',e.message)),mins*60000).unref();
});

client.on('guildMemberAdd', async member=>{
  await applyJoinVerificationRole(member,store);
  await welcome(member);
});
client.on('messageCreate', async message=>{
  if(!message.guild||message.guild.id!==process.env.GUILD_ID||message.author.bot) return;
  if(await autoModerate(message,store)) return;
  const handledTicketCommand = await handleTicketCustomMessage(message, store, m => isStaff(m, store)).catch(err => { console.error('Custom ticket command error:', err); return false; });
  if (handledTicketCommand) return;
  upsertMessage(message,store);
  const newLevel=addMessageXp(message,store);
  if(newLevel!==null) message.channel.send({content:`🎉 <@${message.author.id}> reached **Level ${newLevel}**!`,allowedMentions:{users:[message.author.id]}}).catch(()=>{});
  if(!store.data.settings.features.aiAnswers) return;
  if(message.channel.id!==store.data.settings.answerChannelId) return;
  const q=message.content.trim(); if(q.length<2) return;
  await sendAiAnswer(message,q);
});
client.on('messageUpdate', async(_,newMessage)=>{ if(newMessage.partial) await newMessage.fetch().catch(()=>null); if(newMessage.guild?.id===process.env.GUILD_ID&&!newMessage.author?.bot) upsertMessage(newMessage,store); });
client.on('messageDelete', message=>{ if(message.guild?.id===process.env.GUILD_ID) deleteMessage(message.id,store); });
client.on('messageDeleteBulk', messages=>{
  let changed=false;
  for (const message of messages.values()) {
    const before=store.data.knowledge.length;
    store.data.knowledge=store.data.knowledge.filter(x=>x.id!==message.id);
    if(store.data.knowledge.length!==before) changed=true;
  }
  if(changed) store.save();
});
client.on('channelCreate', async channel=>{
  if(channel.guild?.id!==process.env.GUILD_ID || !shouldIndex(channel,store)) return;
  await scanChannelHistory(channel,store,Math.max(50,Number(process.env.MAX_MESSAGES_PER_CHANNEL||500))).catch(()=>{});
});
client.on('threadCreate', async thread=>{
  if(thread.guild?.id!==process.env.GUILD_ID || !shouldIndex(thread,store)) return;
  await scanChannelHistory(thread,store,Math.max(50,Number(process.env.MAX_MESSAGES_PER_CHANNEL||500))).catch(()=>{});
});
client.on('channelDelete', channel=>{ if(channel.guild?.id===process.env.GUILD_ID) removeChannelMessages(channel.id,store); });
client.on('threadDelete', thread=>{ if(thread.guild?.id===process.env.GUILD_ID) removeChannelMessages(thread.id,store); });
client.on('channelUpdate', async(_,channel)=>{
  if(channel.guild?.id!==process.env.GUILD_ID) return;
  if(!shouldIndex(channel,store)) return void removeChannelMessages(channel.id,store);
  await scanChannelHistory(channel,store,Math.max(50,Number(process.env.MAX_MESSAGES_PER_CHANNEL||500))).catch(()=>{});
});

client.on('interactionCreate', async interaction=>{
  if(interaction.guildId!==process.env.GUILD_ID) return;

  // Dynamic panel picker for every rules command that has a `panel` option.
  // This keeps saved panels on /data available as Discord autocomplete choices
  // even after redeploys, without hard-coding them into slash-command registration.
  if (interaction.isAutocomplete()) {
    const rulesCommands = new Set(['rules','rules-edit','rules-design','rules-publish','rules-delete']);
    if (!rulesCommands.has(interaction.commandName)) return;

    const focused = String(interaction.options.getFocused() || '').trim().toLowerCase();
    const choices = rulesStore.list()
      .filter(panel => {
        if (!focused) return true;
        return String(panel.name || '').toLowerCase().includes(focused)
          || String(panel.title || '').toLowerCase().includes(focused)
          || String(panel.id || '').toLowerCase().includes(focused);
      })
      .slice(0, 25)
      .map(panel => {
        const suffix = ` • EN ${panel.rules?.en?.length || 0} / ES ${panel.rules?.es?.length || 0}`;
        const maxName = 100;
        let name = `${panel.name || panel.title || 'Rules Panel'}${suffix}`;
        if (name.length > maxName) name = name.slice(0, maxName - 1) + '…';
        return { name, value: panel.id };
      });

    return interaction.respond(choices).catch(err => console.error('Rules panel autocomplete error:', err.message));
  }

  if (interaction.isButton() || interaction.isStringSelectMenu() || interaction.isRoleSelectMenu() || interaction.isUserSelectMenu() || interaction.isChannelSelectMenu() || interaction.isModalSubmit()) {
    if (interaction.isButton() && interaction.customId === 'verify:member') {
      return handleVerifyButton(interaction, store);
    }
    const ticketAdminHandled = await handleTicketAdminInteraction(interaction, store, i => isStaff(i, store)).catch(async e => {
      console.error('Ticket admin interaction error:', e);
      if (!interaction.replied && !interaction.deferred) await interaction.reply({content:'The ticket admin panel hit an error. I logged the exact cause for staff.',flags:MessageFlags.Ephemeral}).catch(()=>{});
      return true;
    });
    if (ticketAdminHandled) return;

    const ticketHandled = await handleTicketInteraction(interaction, store, i => isStaff(i, store)).catch(async e => {
      console.error('Ticket interaction error:', e);
      if (!interaction.replied && !interaction.deferred) await interaction.reply({content:'The ticket system hit an error. I logged the exact cause for staff.',flags:MessageFlags.Ephemeral}).catch(()=>{});
      return true;
    });
    if (ticketHandled) return;

    const verifyAdminHandled = await handleVerificationAdminInteraction(interaction, store, isStaff).catch(async e => {
      console.error('Verification admin interaction error:', e);
      if (!interaction.replied && !interaction.deferred) await interaction.reply({content:'The verification admin panel hit an error. I logged the exact cause for staff.',flags:MessageFlags.Ephemeral}).catch(()=>{});
      return true;
    });
    if (verifyAdminHandled) return;
    const handled = await handleRulesInteraction(interaction, rulesStore, client, i => isStaff(i,store)).catch(async e=>{
      console.error('Rules interaction error:',e);
      if (!interaction.replied && !interaction.deferred) await interaction.reply({content:'The rules viewer hit an error. I logged the exact cause for staff.',flags:MessageFlags.Ephemeral}).catch(()=>{});
      return true;
    });
    if (handled) return;

    // Legacy compatibility: old rules-bot publication buttons may have different custom IDs.
    // If the clicked message is one of our saved published rules panels, answer by button label/custom ID.
    if (interaction.isButton()) {
      const panel = rulesStore.list().find(p => (p.publications || []).some(pub => pub.messageId === interaction.message?.id));
      if (panel) {
        const hint = `${interaction.component?.label || ''} ${interaction.customId || ''}`.toLowerCase();
        const lang = /(español|spanish|\bes\b|mex|🇲🇽)/i.test(hint) ? 'es' : 'en';
        return sendSeparateRules(interaction, panel, lang);
      }
    }
  }

  if (interaction.isButton() && interaction.customId.startsWith('ai:feedback:')) {
    const parts = interaction.customId.split(':');
    const id = parts[2];
    const feedback = parts[3] === 'up' ? 'helpful' : 'needs-work';
    const saved = store.setQAFeedback(id, feedback, interaction.user.id);
    return interaction.reply({
      content: saved
        ? (feedback === 'helpful' ? '👍 Thanks — that answer was marked helpful.' : '👎 Thanks — I saved that feedback so staff can see which answers need improvement.')
        : 'I could not find that answer in the recent feedback log.',
      flags: MessageFlags.Ephemeral
    });
  }

  if(interaction.isButton()) {
    return;
  }
  if(!interaction.isChatInputCommand()) return;
  const cmd=interaction.commandName;
  if(cmd==='verify-all' && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) return interaction.reply({embeds:[errorEmbed('Administrator Only','Only a server Administrator can bulk-verify every member.')],flags:MessageFlags.Ephemeral});
  const staffNeeded=['rules-create','rules-edit','rules-design','rules-publish','rules-list','rules-delete','rules-repair','ticket-admin','ticket-panel','ticket-publish-panel','ticket-controls','announce','warn','timeout','kick','ban','spam-guard','welcome-config','bot-config','verify-config','verify-panel','verify-all','verify-status','verify-admin'];
  if(cmd==='ai' && ['sync','sync-all','rescan','answer-channel','auto-discover','smart-filter','ignore-channel','allow-channel','ignore-category','allow-category','source-add','source-remove','mode','reset-settings'].includes(interaction.options.getSubcommand())) staffNeeded.push('ai');
  if(staffNeeded.includes(cmd) && !isStaff(interaction,store)) return interaction.reply({embeds:[errorEmbed('Staff Only','You need Manage Server permission or a configured SEMENTAL staff role.')],flags:MessageFlags.Ephemeral});

  // RULES SYSTEM
  if(cmd==='rules') {
    if (!store.data.settings.features.rules) return interaction.reply({content:'The rules system is currently disabled.',flags:MessageFlags.Ephemeral});
    const panel=getPanel(interaction);
    if(!panel) return interaction.reply({content:'No rules panel has been created yet.',flags:MessageFlags.Ephemeral});
    return interaction.reply({...publicPanelPayload(panel),flags:MessageFlags.Ephemeral});
  }
  if(cmd==='rules-create') {
    const name=interaction.options.getString('name',true);
    const panel=rulesStore.create(name);
    return interaction.reply(editorPayload(panel,'en'));
  }
  if(cmd==='rules-edit') {
    const panel=getPanel(interaction);
    if(!panel) return interaction.reply({content:'Rules panel not found. Use `/rules-list` to see panel names and IDs.',flags:MessageFlags.Ephemeral});
    return interaction.reply(editorPayload(panel,'en'));
  }
  if(cmd==='rules-design') {
    const panel=getPanel(interaction);
    if(!panel) return interaction.reply({content:'Rules panel not found.',flags:MessageFlags.Ephemeral});
    return interaction.reply(designMenuPayload(panel));
  }
  if(cmd==='rules-publish') {
    const panel=getPanel(interaction);
    if(!panel) return interaction.reply({content:'Rules panel not found.',flags:MessageFlags.Ephemeral});
    const ch=interaction.options.getChannel('channel')||interaction.channel;
    if(!ch?.isTextBased?.()) return interaction.reply({content:'Choose a text channel.',flags:MessageFlags.Ephemeral});
    try {
      const msg=await ch.send(publicPanelPayload(panel));
      panel.publications.push({id:`pub_${Date.now().toString(36)}`,channelId:ch.id,messageId:msg.id,createdAt:new Date().toISOString()});
      rulesStore.touch(panel);
      return interaction.reply({content:`✅ Published **${panel.name}** in <#${ch.id}>. This is copy **#${panel.publications.length}**; you can run \`/rules-publish\` again in the same channel whenever you want another copy.`,flags:MessageFlags.Ephemeral});
    } catch(e) { return interaction.reply({content:`I could not publish there: ${e.message}`,flags:MessageFlags.Ephemeral}); }
  }
  if(cmd==='rules-list') {
    const panels=rulesStore.list();
    if(!panels.length) return interaction.reply({content:'No rules panels have been created yet.',flags:MessageFlags.Ephemeral});
    const body=panels.map((p,i)=>`**${i+1}. ${p.name}**\nID: \`${p.id}\` • EN: ${p.rules.en.length} • ES: ${p.rules.es.length} • Published: ${p.publications.length}`).join('\n\n').slice(0,3900);
    return interaction.reply({embeds:[successEmbed('📜 SEMENTAL Rules Panels',body)],flags:MessageFlags.Ephemeral});
  }
  if(cmd==='rules-repair') {
    await interaction.deferReply({flags:MessageFlags.Ephemeral});
    let updated=0, stale=0;
    for (const panel of rulesStore.list()) {
      const r=await refreshPublishedPanel(client,panel,rulesStore).catch(()=>({updated:0,stale:0}));
      updated += r?.updated || 0;
      stale += r?.stale || 0;
    }
    return interaction.editReply(`✅ Rules repair complete: **${updated}** published panel message(s) refreshed. **${stale}** stale/unreachable publication(s) were removed from saved references.`);
  }
  if(cmd==='rules-delete') {
    const panel=getPanel(interaction);
    if(!panel) return interaction.reply({content:'Rules panel not found.',flags:MessageFlags.Ephemeral});
    const deleteMessages=interaction.options.getBoolean('delete_messages')||false;
    if(deleteMessages) await deletePublishedMessages(client,panel);
    rulesStore.remove(panel.id);
    return interaction.reply({content:`✅ Deleted **${panel.name}**${deleteMessages?' and its published Discord messages':''}.`,flags:MessageFlags.Ephemeral});
  }

  // AI / KNOWLEDGE
  if(cmd==='ai') {
    const sub=interaction.options.getSubcommand();
    if(sub==='ask') {
      await interaction.deferReply({flags:MessageFlags.Ephemeral});
      const q=interaction.options.getString('question',true);
      const feedbackId=newFeedbackId();
      const askingMember=await interaction.guild.members.fetch(interaction.user.id).catch(()=>interaction.member);
      const result=await answerQuestion(q,store,{rulesStore,userId:interaction.user.id,channelId:interaction.channelId,allowedChannelIds:visibleSourceChannels(interaction.guild,askingMember)});
      const {embed,rows}=aiAnswerEmbed(q,result,{feedbackId});
      store.logQA({id:feedbackId,userId:interaction.user.id,channelId:interaction.channelId,question:q,answer:result.text,mode:result.mode,confidence:result.confidence,sourceCount:result.sources.length,sourceIds:result.sources.slice(0,8).map(x=>x.id)});
      return interaction.editReply({embeds:[embed],components:rows});
    }
    if(sub==='status') {
      const s=store.data.settings,m=store.data.meta;
      return interaction.reply({embeds:[successEmbed('SEMENTAL AI Status',`**Mode:** ${s.answerMode}\n**Auto Discover:** ${s.autoDiscover!==false?'ON':'OFF'}\n**Smart Filter:** ${s.smartFilter!==false?'ON':'OFF'}\n**Indexed messages:** ${store.data.knowledge.length}\n**Indexed channels:** ${m.syncChannels||0}\n**Readable channels found:** ${m.readableChannels||0}\n**Excluded/ignored:** ${m.excludedChannels||0}\n**Ignored channels:** ${s.ignoredChannelIds.length}\n**Ignored categories:** ${s.ignoredCategoryIds.length}\n**Last sync:** ${m.lastSync||'Never'}\n**Live sync:** ON (new/edit/delete)\n**AI API:** ${process.env.OPENAI_API_KEY?'Connected':'Not configured (smart search mode still works)'}\n**AI model:** ${process.env.OPENAI_MODEL||'gpt-5.6-terra'}\n**Conversation context:** ON\n**Rules searched directly:** ON (${rulesStore.list().length} panels)\n**Feedback learning log:** ${store.data.qaLog.length} recent answers`)],flags:MessageFlags.Ephemeral});
    }
    if(sub==='sync' || sub==='rescan') {
      await interaction.deferReply({flags:MessageFlags.Ephemeral});
      const r=await syncKnowledge(interaction.guild);
      return interaction.editReply(r?`✅ Full rescan complete: **${r.messages}** messages from **${r.channels}** channels. **${r.excluded||0}** readable channels were excluded/ignored.`:'A sync is already running.');
    }
    if(sub==='sync-all') {
      store.updateSettings({autoDiscover:true,knowledgeChannelIds:[]});
      await interaction.deferReply({flags:MessageFlags.Ephemeral});
      const r=await syncKnowledge(interaction.guild);
      return interaction.editReply(r?`✅ **Auto Discover is ON.** I scanned every readable eligible channel: **${r.messages}** messages from **${r.channels}** channels. **${r.excluded||0}** channels were skipped by permissions, ignore lists, system exclusions, or Smart Filter.`:'A sync is already running.');
    }
    if(sub==='answer-channel') {
      const ch=interaction.options.getChannel('channel',true);
      store.updateSettings({answerChannelId:ch.id});
      removeChannelMessages(ch.id,store);
      return interaction.reply({content:`✅ SEMENTAL AI will automatically answer in <#${ch.id}>. That help channel is automatically excluded from the knowledge index so member questions do not pollute the server knowledge.`,flags:MessageFlags.Ephemeral});
    }
    if(sub==='auto-discover') {
      const enabled=interaction.options.getBoolean('enabled',true);
      store.updateSettings({autoDiscover:enabled});
      return interaction.reply({content:`✅ Auto Discover is now **${enabled?'ON':'OFF'}**.${enabled?' The bot can learn from every readable eligible channel automatically.':' Manual source-channel mode is active.'}`,flags:MessageFlags.Ephemeral});
    }
    if(sub==='smart-filter') {
      const enabled=interaction.options.getBoolean('enabled',true);
      store.updateSettings({smartFilter:enabled});
      return interaction.reply({content:`✅ Smart Channel Filter is now **${enabled?'ON':'OFF'}**. Run **/ai rescan** to rebuild the current index with this setting.`,flags:MessageFlags.Ephemeral});
    }
    if(sub==='ignore-channel') {
      const ch=interaction.options.getChannel('channel',true);
      const ids=[...new Set([...store.data.settings.ignoredChannelIds,ch.id])];
      store.updateSettings({ignoredChannelIds:ids});
      const removed=removeChannelMessages(ch.id,store);
      return interaction.reply({content:`✅ <#${ch.id}> is now ignored. Removed **${removed}** indexed messages from that channel.`,flags:MessageFlags.Ephemeral});
    }
    if(sub==='allow-channel') {
      const ch=interaction.options.getChannel('channel',true);
      const ids=store.data.settings.ignoredChannelIds.filter(id=>id!==ch.id);
      store.updateSettings({ignoredChannelIds:ids});
      const r=await scanChannelHistory(ch,store,Math.max(50,Number(process.env.MAX_MESSAGES_PER_CHANNEL||500))).catch(()=>null);
      return interaction.reply({content:`✅ <#${ch.id}> was removed from the ignore list.${r?.channel?` Indexed **${r.messages}** messages immediately.`:' It will be indexed when eligible.'}`,flags:MessageFlags.Ephemeral});
    }
    if(sub==='ignore-category') {
      const cat=interaction.options.getChannel('category',true);
      const ids=[...new Set([...store.data.settings.ignoredCategoryIds,cat.id])];
      store.updateSettings({ignoredCategoryIds:ids});
      const removed=removeMessagesForCategory(interaction.guild,cat,store);
      return interaction.reply({content:`✅ Category **${cat.name}** is now ignored. Removed **${removed}** indexed messages from its channels.`,flags:MessageFlags.Ephemeral});
    }
    if(sub==='allow-category') {
      const cat=interaction.options.getChannel('category',true);
      const ids=store.data.settings.ignoredCategoryIds.filter(id=>id!==cat.id);
      store.updateSettings({ignoredCategoryIds:ids});
      await interaction.deferReply({flags:MessageFlags.Ephemeral});
      const r=await syncKnowledge(interaction.guild);
      return interaction.editReply(r?`✅ Category **${cat.name}** is allowed again. Rescan complete: **${r.messages}** indexed messages across **${r.channels}** channels.`:'Category allowed. A sync is already running.');
    }
    if(sub==='source-add') {
      const ch=interaction.options.getChannel('channel',true);
      if(store.data.settings.autoDiscover!==false) {
        const ignored=store.data.settings.ignoredChannelIds.filter(id=>id!==ch.id);
        store.updateSettings({ignoredChannelIds:ignored});
        const r=await scanChannelHistory(ch,store,Math.max(50,Number(process.env.MAX_MESSAGES_PER_CHANNEL||500))).catch(()=>null);
        return interaction.reply({content:`✅ <#${ch.id}> is allowed in Auto Discover mode.${r?.channel?` Indexed **${r.messages}** messages.`:''}`,flags:MessageFlags.Ephemeral});
      }
      const ids=[...new Set([...store.data.settings.knowledgeChannelIds,ch.id])];
      store.updateSettings({knowledgeChannelIds:ids});
      return interaction.reply({content:`✅ Added <#${ch.id}> as a manual knowledge source. Run **/ai sync**.`,flags:MessageFlags.Ephemeral});
    }
    if(sub==='source-remove') {
      const ch=interaction.options.getChannel('channel',true);
      if(store.data.settings.autoDiscover!==false) {
        const ignored=[...new Set([...store.data.settings.ignoredChannelIds,ch.id])];
        store.updateSettings({ignoredChannelIds:ignored});
        const removed=removeChannelMessages(ch.id,store);
        return interaction.reply({content:`✅ <#${ch.id}> is ignored in Auto Discover mode. Removed **${removed}** indexed messages.`,flags:MessageFlags.Ephemeral});
      }
      const ids=store.data.settings.knowledgeChannelIds.filter(id=>id!==ch.id);
      store.updateSettings({knowledgeChannelIds:ids});
      removeChannelMessages(ch.id,store);
      return interaction.reply({content:`✅ Removed <#${ch.id}> from the manual knowledge sources.`,flags:MessageFlags.Ephemeral});
    }
    if(sub==='sources') {
      const s=store.data.settings,m=store.data.meta;
      const ignoredChannels=s.ignoredChannelIds.slice(0,25).map(id=>`<#${id}>`).join(', ')||'None';
      const ignoredCategories=s.ignoredCategoryIds.slice(0,25).map(id=>interaction.guild.channels.cache.get(id)?.name||id).join(', ')||'None';
      const manual=s.knowledgeChannelIds.slice(0,25).map(id=>`<#${id}>`).join(', ')||'None';
      const text=`**Discovery:** ${s.autoDiscover!==false?'Auto Discover (all readable eligible channels)':'Manual source list'}\n**Smart Filter:** ${s.smartFilter!==false?'ON':'OFF'}\n**Last indexed channels:** ${m.syncChannels||0}\n**Ignored channels:** ${ignoredChannels}\n**Ignored categories:** ${ignoredCategories}${s.autoDiscover===false?`\n**Manual sources:** ${manual}`:''}`;
      return interaction.reply({embeds:[successEmbed('🧠 SEMENTAL Knowledge Sources',text)],flags:MessageFlags.Ephemeral});
    }
    if(sub==='mode') { const mode=interaction.options.getString('mode',true); store.updateSettings({answerMode:mode}); return interaction.reply({content:`✅ Answer mode changed to **${mode}**.`,flags:MessageFlags.Ephemeral}); }
    if(sub==='reset-settings') {
      const confirm=interaction.options.getBoolean('confirm',true);
      if(!confirm) return interaction.reply({content:'Reset cancelled. No AI settings were changed.',flags:MessageFlags.Ephemeral});
      await interaction.deferReply({flags:MessageFlags.Ephemeral});
      const s=store.resetAiSettings();
      const result=await syncKnowledge(interaction.guild).catch(e=>{ console.error('AI reset resync:',e); return null; });
      return interaction.editReply(`✅ **SEMENTAL AI settings reset.**\n\n• Answer channel: ${s.answerChannelId?`<#${s.answerChannelId}>`:'Not set'}\n• Auto Discover: **${s.autoDiscover!==false?'ON':'OFF'}**\n• Smart Filter: **${s.smartFilter!==false?'ON':'OFF'}**\n• Answer mode: **${s.answerMode}**\n• Ignored channels/categories: **${s.ignoredChannelIds.length}/${s.ignoredCategoryIds.length}**\n• Manual source channels: **${s.knowledgeChannelIds.length}**${result?`\n• Re-indexed: **${result.messages} messages from ${result.channels} channels**`:''}\n\nRules, tickets, XP, moderation settings, and saved panels were not changed.`);
    }
  }


  // OTHER SERVER SYSTEMS
  if(cmd==='ticket-admin') return interaction.reply({ ...ticketAdminPanel(store), flags: MessageFlags.Ephemeral });
  if(cmd==='ticket-controls') {
    const ticket = store.data.tickets?.[interaction.channelId];
    if(!ticket || !['open','closed'].includes(ticket.status)) return interaction.reply({content:'❌ Use `/ticket-controls` inside a SEMENTAL ticket channel.',flags:MessageFlags.Ephemeral});
    return interaction.reply({ ...staffTicketControlsPayload(store, ticket), flags: MessageFlags.Ephemeral });
  }
  if(cmd==='ticket-reset-user') {
    const confirm=interaction.options.getBoolean('confirm',true);
    if(!confirm) return interaction.reply({content:'Cleanup cancelled.',flags:MessageFlags.Ephemeral});
    const user=interaction.options.getUser('user',true);
    const result=await clearStaleTicketsForUser(store,interaction.guild,user.id);
    return interaction.reply({content:result.cleared?`✅ Cleared **${result.cleared}** stale/invisible open ticket record(s) for <@${user.id}>. ${result.kept?`Kept **${result.kept}** real visible open ticket(s).`:''}`:`ℹ️ No stale ticket records were found for <@${user.id}>.${result.kept?` They still have **${result.kept}** real visible open ticket(s).`:''}`,flags:MessageFlags.Ephemeral});
  }
  if(cmd==='ticket-panel' || cmd==='ticket-publish-panel') {
    const types = Array.isArray(store.data.ticketTypes) ? store.data.ticketTypes : [];
    if(!types.length) return interaction.reply({content:'Add at least one ticket button first with `/ticket-admin`.',flags:MessageFlags.Ephemeral});
    const ch=interaction.options.getChannel('channel')||interaction.channel;
    if(!ch?.isTextBased?.()) return interaction.reply({content:'Choose a text channel.',flags:MessageFlags.Ephemeral});
    try { await ch.send(ticketPanel(store)); return interaction.reply({content:`✅ Ticket panel published in <#${ch.id}>.`,flags:MessageFlags.Ephemeral}); }
    catch(e){ return interaction.reply({content:`❌ I could not publish the ticket panel: ${e.message}`,flags:MessageFlags.Ephemeral}); }
  }
  if(cmd==='announce') { const title=interaction.options.getString('title',true), msg=interaction.options.getString('message',true), ch=interaction.options.getChannel('channel')||interaction.channel; const embed=new EmbedBuilder().setColor(brandColor()).setTitle(title).setDescription(msg).setFooter({text:'SEMENTAL • Official Announcement'}).setTimestamp(); await ch.send({embeds:[embed]}); return interaction.reply({content:`✅ Announcement posted in <#${ch.id}>.`,flags:MessageFlags.Ephemeral}); }
  if(cmd==='warn') { const user=interaction.options.getUser('user',true),reason=interaction.options.getString('reason',true); const count=addWarning(user.id,interaction.user.id,reason,store); const embed=new EmbedBuilder().setColor(brandColor()).setTitle('⚠️ Member Warning').addFields({name:'Member',value:`<@${user.id}>`,inline:true},{name:'Moderator',value:`<@${interaction.user.id}>`,inline:true},{name:'Reason',value:reason},{name:'Warnings',value:String(count)}).setTimestamp(); await logAction(interaction.guild,store,embed); return interaction.reply({embeds:[embed]}); }
  if(['timeout','kick','ban'].includes(cmd)) { const user=interaction.options.getUser('user',true); const member=await interaction.guild.members.fetch(user.id).catch(()=>null); if(!member) return interaction.reply({content:'Member not found.',flags:MessageFlags.Ephemeral}); const reason=interaction.options.getString('reason')||`SEMENTAL ${cmd} by ${interaction.user.tag}`; try { if(cmd==='timeout') await member.timeout(interaction.options.getInteger('minutes',true)*60000,reason); if(cmd==='kick') await member.kick(reason); if(cmd==='ban') await member.ban({reason}); } catch(e){ return interaction.reply({content:`Could not ${cmd} this member: ${e.message}`,flags:MessageFlags.Ephemeral}); } const embed=new EmbedBuilder().setColor(brandColor()).setTitle(`🛡️ ${cmd.toUpperCase()} Applied`).addFields({name:'Member',value:`${user.tag} (${user.id})`},{name:'Moderator',value:`${interaction.user.tag}`},{name:'Reason',value:reason}).setTimestamp(); await logAction(interaction.guild,store,embed); return interaction.reply({embeds:[embed]}); }
  if(cmd==='spam-guard') {
    const sub=interaction.options.getSubcommand();
    const current=spamSettings(store);
    if(sub==='status') {
      const me=interaction.guild.members.me || await interaction.guild.members.fetchMe().catch(()=>null);
      const manage=!!me?.permissions.has(PermissionFlagsBits.ManageMessages);
      const ban=!!me?.permissions.has(PermissionFlagsBits.BanMembers);
      const timeout=!!me?.permissions.has(PermissionFlagsBits.ModerateMembers);
      return interaction.reply({embeds:[successEmbed('🚨 SEMENTAL Spam Guard',`**Status:** ${current.enabled?'ON':'OFF'}\n**Trigger:** same / highly similar content in **${current.minChannels} different channels** within **${current.windowSeconds} seconds**\n**Automatic action:** **${current.action.toUpperCase()}**${current.action==='timeout'?` (${current.timeoutMinutes} minutes)`:''}\n**Minimum normal-text length:** ${current.minLength} characters\n**Ignored channels:** ${current.ignoredChannelIds.length}\n**Ignored roles:** ${current.ignoredRoleIds.length}\n\n**Bot permissions**\n${manage?'✅':'❌'} Manage Messages\n${ban?'✅':'❌'} Ban Members\n${timeout?'✅':'❌'} Moderate Members\n\nBots, members with **Manage Messages / Manage Server**, ignored roles, and ignored channels are exempt.`)],flags:MessageFlags.Ephemeral});
    }
    if(sub==='enable') {
      const enabled=interaction.options.getBoolean('enabled',true);
      store.updateSettings({spamGuardEnabled:enabled});
      return interaction.reply({content:`✅ Cross-channel Spam Guard is now **${enabled?'ON':'OFF'}**.`,flags:MessageFlags.Ephemeral});
    }
    if(sub==='config') {
      const patch={};
      const minChannels=interaction.options.getInteger('min_channels');
      const windowSeconds=interaction.options.getInteger('window_seconds');
      const action=interaction.options.getString('action');
      const timeoutMinutes=interaction.options.getInteger('timeout_minutes');
      if(minChannels!==null) patch.spamGuardMinChannels=minChannels;
      if(windowSeconds!==null) patch.spamGuardWindowSeconds=windowSeconds;
      if(action) patch.spamGuardAction=action;
      if(timeoutMinutes!==null) patch.spamGuardTimeoutMinutes=timeoutMinutes;
      if(!Object.keys(patch).length) return interaction.reply({content:'Choose at least one setting to change.',flags:MessageFlags.Ephemeral});
      store.updateSettings(patch);
      const cfg=spamSettings(store);
      return interaction.reply({content:`✅ Spam Guard updated: **${cfg.minChannels} channels / ${cfg.windowSeconds}s / ${cfg.action.toUpperCase()}**${cfg.action==='timeout'?` / ${cfg.timeoutMinutes} min`:''}.`,flags:MessageFlags.Ephemeral});
    }
    if(sub==='ignore-channel' || sub==='allow-channel') {
      const ch=interaction.options.getChannel('channel',true);
      const ids=new Set(store.data.settings.spamGuardIgnoredChannelIds||[]);
      if(sub==='ignore-channel') ids.add(ch.id); else ids.delete(ch.id);
      store.updateSettings({spamGuardIgnoredChannelIds:[...ids]});
      return interaction.reply({content:`✅ <#${ch.id}> is ${sub==='ignore-channel'?'now ignored by':'no longer ignored by'} the Spam Guard.`,flags:MessageFlags.Ephemeral});
    }
    if(sub==='ignore-role' || sub==='allow-role') {
      const role=interaction.options.getRole('role',true);
      const ids=new Set(store.data.settings.spamGuardIgnoredRoleIds||[]);
      if(sub==='ignore-role') ids.add(role.id); else ids.delete(role.id);
      store.updateSettings({spamGuardIgnoredRoleIds:[...ids]});
      return interaction.reply({content:`✅ <@&${role.id}> is ${sub==='ignore-role'?'now exempt from':'no longer exempt from'} the Spam Guard.`,flags:MessageFlags.Ephemeral});
    }
  }
  if(cmd==='rank') { const user=interaction.options.getUser('user')||interaction.user; const member=await interaction.guild.members.fetch(user.id); return interaction.reply({embeds:[rankEmbed(member,store)]}); }
  if(cmd==='leaderboard') return interaction.reply({embeds:[leaderboardEmbed(interaction.guild,store)]});
  if(cmd==='welcome-config') { const ch=interaction.options.getChannel('channel',true),role=interaction.options.getRole('role'); store.updateSettings({welcomeChannelId:ch.id,welcomeRoleId:role?.id||''}); return interaction.reply({content:`✅ Welcome messages will go to <#${ch.id}>${role?` and new members will receive <@&${role.id}>`:''}.`,flags:MessageFlags.Ephemeral}); }
  if(cmd==='verify-admin') {
    return interaction.reply({ ...verificationAdminPanel(store), flags: MessageFlags.Ephemeral });
  }
  if(cmd==='verify-config') {
    const joinRole=interaction.options.getRole('join_role',true);
    const verifiedRole=interaction.options.getRole('verified_role',true);
    if(joinRole.id===verifiedRole.id) return interaction.reply({content:'Choose two different roles: one Join/Unverified role and one Verified role.',flags:MessageFlags.Ephemeral});
    const joinError=validateRole(interaction.guild,joinRole,'Join / Unverified');
    const verifiedError=validateRole(interaction.guild,verifiedRole,'Verified');
    if(joinError||verifiedError) return interaction.reply({content:`❌ ${verifiedError||joinError}`,flags:MessageFlags.Ephemeral});
    const requested=interaction.options.getBoolean('assign_join_role');
    const assign=requested===null?true:requested;
    store.updateSettings({unverifiedRoleId:joinRole.id,verifiedRoleId:verifiedRole.id,verifyAssignJoinRole:assign});
    return interaction.reply({embeds:[successEmbed('✅ Verification Configured',`**Join / Unverified role:** ${joinRole}
**Verified role:** ${verifiedRole}
**Bot auto-adds Join role to new members:** ${assign?'YES':'NO'}

Use **/verify-panel** to post the Verify button.`)],flags:MessageFlags.Ephemeral});
  }
  if(cmd==='verify-panel') {
    if(store.data.settings.features.verification===false) return interaction.reply({content:'Verification is currently disabled in Server Systems.',flags:MessageFlags.Ephemeral});
    if(!store.data.settings.unverifiedRoleId||!store.data.settings.verifiedRoleId) return interaction.reply({content:'Run `/verify-config` first.',flags:MessageFlags.Ephemeral});
    const ch=interaction.options.getChannel('channel')||interaction.channel;
    if(!ch?.isTextBased?.()) return interaction.reply({content:'Choose a text channel.',flags:MessageFlags.Ephemeral});
    try { await ch.send(verificationPanel(store)); return interaction.reply({content:`✅ Verification panel posted in <#${ch.id}>.`,flags:MessageFlags.Ephemeral}); }
    catch(e){ return interaction.reply({content:`❌ I could not post the verification panel: ${e.message}`,flags:MessageFlags.Ephemeral}); }
  }
  if(cmd==='verify-all') return verifyAllMembers(interaction,store);
  if(cmd==='verify-status') {
    const s=store.data.settings;
    return interaction.reply({embeds:[successEmbed('✅ SEMENTAL Verification Status',`**System:** ${s.features.verification===false?'OFF':'ON'}
**Join / Unverified role:** ${s.unverifiedRoleId?`<@&${s.unverifiedRoleId}>`:'Not configured'}
**Verified role:** ${s.verifiedRoleId?`<@&${s.verifiedRoleId}>`:'Not configured'}
**Auto-add Join role on member join:** ${s.verifyAssignJoinRole?'YES':'NO'}

**Member button:** removes the Join role and adds the Verified role.
**Bulk command:** \`/verify-all confirm:true\``)],flags:MessageFlags.Ephemeral});
  }
  if(cmd==='bot-config') { const s=store.data.settings; return interaction.reply({embeds:[successEmbed('SEMENTAL AI + Rules Configuration',`**Answer channel:** ${s.answerChannelId?`<#${s.answerChannelId}>`:'Not set'}\n**Answer mode:** ${s.answerMode}\n**Knowledge discovery:** ${s.autoDiscover!==false?'AUTO':'MANUAL'}
**Indexed channels:** ${store.data.meta.syncChannels||0}
**Ignored channels/categories:** ${s.ignoredChannelIds.length}/${s.ignoredCategoryIds.length}\n**Rules panels:** ${rulesStore.list().length}\n**Rules system:** ${s.features.rules?'ON':'OFF'}\n**Tickets:** ${s.features.tickets?'ON':'OFF'}\n**Levels:** ${s.features.levels?'ON':'OFF'}\n**Welcomes:** ${s.features.welcomes?'ON':'OFF'}\n**Moderation:** ${s.features.moderation?'ON':'OFF'}\n**Cross-channel Spam Guard:** ${s.spamGuardEnabled!==false?'ON':'OFF'} • ${s.spamGuardMinChannels||3} channels / ${s.spamGuardWindowSeconds||20}s / ${String(s.spamGuardAction||'ban').toUpperCase()}\n**Verification:** ${s.features.verification===false?'OFF':'ON'} • ${s.verifiedRoleId?`<@&${s.verifiedRoleId}>`:'Not configured'}`)],flags:MessageFlags.Ephemeral}); }
});

client.on('error',e=>console.error('Discord client error:',e));
process.on('unhandledRejection',e=>console.error('Unhandled rejection:',e));
client.login(process.env.DISCORD_TOKEN);
