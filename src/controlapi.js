const crypto = require('crypto');
const { ChannelType, EmbedBuilder, AttachmentBuilder, PermissionFlagsBits } = require('discord.js');
const { RulesStore, publicPanelPayload, refreshPublishedPanel, deletePublishedMessages } = require('./rules');
const { ticketPanel, archiveClosedTickets, resolveClosedTicketCategory } = require('./tickets');
const { verificationPanel } = require('./verification');
const { rebuildKnowledge } = require('./knowledge');
const { all: allGiveaways, publishGiveaway, editGiveaway, deleteGiveaway, closeGiveaway, drawWinners, setAdminSampleNames } = require('./giveaways');
const community = require('./community');
const polls=require('./polls');
const teamBoard=require('./team-availability');
const media = require('./admin-media');

function json(res, status, data) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(data));
}
function readBody(req, max = 11 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > max) return reject(new Error('Request too large')); chunks.push(c); });
    req.on('end', () => { try { const s = Buffer.concat(chunks).toString('utf8'); resolve(s ? JSON.parse(s) : {}); } catch { reject(new Error('Invalid JSON')); } });
    req.on('error', reject);
  });
}
function safeEqual(a, b) {
  const aa = Buffer.from(String(a || '')); const bb = Buffer.from(String(b || ''));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}
function auth(req) {
  const secret = process.env.BOT_CONTROL_SECRET || '';
  if (!secret) return false;
  const got = req.headers['x-kixo-control'] || String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  return safeEqual(got, secret);
}
function id(prefix){return `${prefix}_${crypto.randomBytes(4).toString('hex')}`;}
function ensureExtended(store) {
  if (!Array.isArray(store.data.fixtures)) store.data.fixtures = [];
  if (!Array.isArray(store.data.announcements)) store.data.announcements = [];
  if (!Array.isArray(store.data.globalCommands)) store.data.globalCommands = [];
  allGiveaways(store);
  polls.all(store);
  teamBoard.ensure(store);
  community.state(store);
  if (!store.data.settings.features) store.data.settings.features = {};
  store.data.settings.features = { aiAnswers:true,tickets:true,levels:true,welcomes:true,moderation:false,announcements:true,rules:true,verification:true, ...(store.data.settings.features||{}) };
}
function sanitizeSettings(s) {
  return {
    answerChannelId:s.answerChannelId||'', knowledgeChannelIds:s.knowledgeChannelIds||[], ignoredChannelIds:s.ignoredChannelIds||[], ignoredCategoryIds:s.ignoredCategoryIds||[], autoDiscover:s.autoDiscover!==false, smartFilter:s.smartFilter!==false, answerMode:s.answerMode||'hybrid', features:s.features||{},
    ...community.notificationSettings({data:{settings:s}}), generalCommandPrefix:s.generalCommandPrefix||'!',
    logChannelId:s.logChannelId||'', staffRoleIds:s.staffRoleIds||[],
    unverifiedRoleId:s.unverifiedRoleId||'', verifiedRoleId:s.verifiedRoleId||'', verifyAssignJoinRole:!!s.verifyAssignJoinRole, verifyPanelTitle:s.verifyPanelTitle||'', verifyPanelText:s.verifyPanelText||'', verifyButtonText:s.verifyButtonText||'Verify', verifyPanelColor:s.verifyPanelColor||'#5865F2', verifyLogoUrl:s.verifyLogoUrl||'', verifyBannerUrl:s.verifyBannerUrl||'', verifyLogoFile:s.verifyLogoFile||'', verifyBannerFile:s.verifyBannerFile||'',
    ticketTranscriptChannelId:s.ticketTranscriptChannelId||'', ticketClosedCategoryId:s.ticketClosedCategoryId||'', ticketPanelTitle:s.ticketPanelTitle||'', ticketPanelText:s.ticketPanelText||'', ticketPanelFooter:s.ticketPanelFooter||'', ticketPanelColor:s.ticketPanelColor||'#FF2D8B', ticketLogoUrl:s.ticketLogoUrl||'', ticketBannerUrl:s.ticketBannerUrl||'', ticketLogoFile:s.ticketLogoFile||'', ticketBannerFile:s.ticketBannerFile||'', ticketCommandPrefix:s.ticketCommandPrefix||'!', ticketCreatedReplyTemplate:s.ticketCreatedReplyTemplate||'',
    spamGuardEnabled:s.spamGuardEnabled!==false, spamGuardMinChannels:Number(s.spamGuardMinChannels||3), spamGuardWindowSeconds:Number(s.spamGuardWindowSeconds||20), spamGuardAction:s.spamGuardAction||'ban', spamGuardTimeoutMinutes:Number(s.spamGuardTimeoutMinutes||1440), spamGuardMinLength:Number(s.spamGuardMinLength||12), spamGuardIgnoredChannelIds:s.spamGuardIgnoredChannelIds||[], spamGuardIgnoredRoleIds:s.spamGuardIgnoredRoleIds||[]
  };
}
async function guildData(client) {
  const guild = await client.guilds.fetch(process.env.GUILD_ID);
  const fetchedChannels = await guild.channels.fetch();
  const fetchedRoles = await guild.roles.fetch();
  const channelMap = new Map([...fetchedChannels.values()].filter(Boolean).map(c=>[c.id,c]));
  const categoryRows = [...channelMap.values()].filter(c => c.type === ChannelType.GuildCategory).sort((a,b)=>a.rawPosition-b.rawPosition).map(c=>({id:c.id,name:c.name,position:c.rawPosition}));
  const categoriesById = Object.fromEntries(categoryRows.map(c=>[c.id,c.name]));
  const textRows = [...channelMap.values()].filter(c => [ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildForum].includes(c.type)).sort((a,b)=>a.rawPosition-b.rawPosition).map(c=>({id:c.id,name:c.name,type:c.type,categoryId:c.parentId||'',category:categoriesById[c.parentId]||'',position:c.rawPosition}));
  const roleRows = [...fetchedRoles.values()].filter(r=>r && !r.managed && r.id!==guild.roles.everyone.id).sort((a,b)=>b.position-a.position).map(r=>({id:r.id,name:r.name,color:r.hexColor,position:r.position}));
  return {guild, channels:textRows, categories:categoryRows, roles:roleRows, channelMap};
}
function fixtureSort(a,b){
  const ad=Date.parse(`${a.date||''}T${a.timeCt||a.time||'00:00'}`)||0; const bd=Date.parse(`${b.date||''}T${b.timeCt||b.time||'00:00'}`)||0; return ad-bd;
}
function normalizeFixture(payload, existing={}) {
  const p={...existing,...payload};
  const num=v=>Number.isFinite(Number(v))?Number(v):null;
  return {
    id:p.id||id('fx'), competition:String(p.competition||'KIXO League').slice(0,100), season:String(p.season||'').slice(0,80), matchday:String(p.matchday||'').slice(0,80), round:String(p.round||'').slice(0,80), group:String(p.group||'').slice(0,80), leg:String(p.leg||'').slice(0,50),
    homeTeam:String(p.homeTeam||p.home||'').slice(0,100), awayTeam:String(p.awayTeam||p.away||'').slice(0,100), homeLogoUrl:String(p.homeLogoUrl||'').slice(0,1000), awayLogoUrl:String(p.awayLogoUrl||'').slice(0,1000), homeLogoFile:String(p.homeLogoFile||''),awayLogoFile:String(p.awayLogoFile||''),
    date:String(p.date||'').slice(0,20), timePt:String(p.timePt||'').slice(0,20), timeMx:String(p.timeMx||'').slice(0,20), timeCt:String(p.timeCt||'').slice(0,20), timeEt:String(p.timeEt||'').slice(0,20),
    status:['upcoming','live','completed','postponed'].includes(String(p.status))?String(p.status):'upcoming', homeScore:num(p.homeScore), awayScore:num(p.awayScore), streamUrl:String(p.streamUrl||'').slice(0,1000), notes:String(p.notes||'').slice(0,1800),
    channelId:String(p.channelId||''), messageId:String(p.messageId||''), createdAt:p.createdAt||new Date().toISOString(), updatedAt:new Date().toISOString()
  };
}
function fixtureTimeBlock(f){
  const lines=[]; if(f.timePt)lines.push(`🇺🇸 PT: ${f.timePt}`); if(f.timeMx)lines.push(`🇲🇽 MX: ${f.timeMx}`); if(f.timeCt)lines.push(`🇺🇸 CT: ${f.timeCt}`); if(f.timeEt)lines.push(`🇺🇸 ET: ${f.timeEt}`); return lines.join('\n')||'TBA';
}
async function publishFixture(client, fixture, channelId) {
  const ch = await client.channels.fetch(channelId).catch(()=>null); if (!ch?.isTextBased()) throw new Error('Publish channel not found.');
  const home=fixture.homeTeam||'TBA'; const away=fixture.awayTeam||'TBA';
  const e = new EmbedBuilder().setColor(fixture.status==='live'?'#22c55e':fixture.status==='completed'?'#64748b':'#FF2D8B').setTitle(`⚽ ${home} vs ${away}`)
    .addFields({name:'Competition',value:fixture.competition||'KIXO',inline:true},{name:'Date',value:fixture.date||'TBA',inline:true},{name:'Status',value:String(fixture.status||'upcoming').toUpperCase(),inline:true},{name:'Official Times',value:fixtureTimeBlock(fixture),inline:false});
  const stage=[fixture.matchday&&`Matchday ${fixture.matchday}`,fixture.round,fixture.group&&`Group ${fixture.group}`,fixture.leg&&`Leg ${fixture.leg}`].filter(Boolean).join(' • '); if(stage)e.addFields({name:'Stage',value:stage,inline:false});
  if(fixture.homeScore!==null&&fixture.awayScore!==null)e.addFields({name:'Result',value:`**${home} ${fixture.homeScore} - ${fixture.awayScore} ${away}**`,inline:false});
  if(fixture.notes)e.addFields({name:'Notes',value:fixture.notes.slice(0,1024),inline:false});
  const files=[];
  if(!media.attach(e,fixture.homeLogoFile,'thumbnail',files)&&fixture.homeLogoUrl)e.setThumbnail(fixture.homeLogoUrl);
  if(fixture.awayLogoFile)media.attach(e,fixture.awayLogoFile,'image',files);
  if(fixture.streamUrl)e.setURL(fixture.streamUrl);
  e.setFooter({text:'KIXO • COMPETE WITH RESPECT • PLAY TO WIN'}).setTimestamp();
  let m=null;
  if(fixture.messageId && fixture.channelId===ch.id){m=await ch.messages.fetch(fixture.messageId).catch(()=>null); if(m) await m.edit({embeds:[e],files,attachments:[]});}
  if(!m)m=await ch.send({embeds:[e],files}); fixture.channelId=ch.id; fixture.messageId=m.id; return m;
}
async function buildState(client, store, rulesStore) {
  ensureExtended(store);
  const {guild,channels,categories,roles}=await guildData(client);
  const tickets = Object.values(store.data.tickets||{}).sort((a,b)=>Number(b.number||0)-Number(a.number||0));
  const perms=guild.members.me?.permissions;
  return {
    server:{id:guild.id,name:guild.name,icon:guild.iconURL({size:128})||'',memberCount:guild.memberCount},
    bot:{tag:client.user?.tag||'',online:!!client.user,uptime:Math.floor(process.uptime()),userId:client.user?.id||''},
    permissions:{viewChannels:!!perms?.has(PermissionFlagsBits.ViewChannel),sendMessages:!!perms?.has(PermissionFlagsBits.SendMessages),manageChannels:!!perms?.has(PermissionFlagsBits.ManageChannels),manageRoles:!!perms?.has(PermissionFlagsBits.ManageRoles),manageMessages:!!perms?.has(PermissionFlagsBits.ManageMessages),banMembers:!!perms?.has(PermissionFlagsBits.BanMembers),moderateMembers:!!perms?.has(PermissionFlagsBits.ModerateMembers)},
    summary:{members:guild.memberCount,openTickets:tickets.filter(t=>t.status==='open').length,closedTickets:tickets.filter(t=>t.status==='closed').length,departments:(store.data.ticketTypes||[]).length,rules:rulesStore.list().length,fixtures:store.data.fixtures.length,indexedMessages:(store.data.knowledge||[]).length,indexedChannels:store.data.meta?.syncChannels||0,channels:channels.length,roles:roles.length},
    settings:sanitizeSettings(store.data.settings), channels, categories, roles,
    ticketTypes:store.data.ticketTypes||[], ticketCommands:store.data.ticketCustomCommands||[], tickets:tickets.slice(0,300),
    rules:rulesStore.list(), fixtures:[...(store.data.fixtures||[])].sort(fixtureSort), qaLog:(store.data.qaLog||[]).slice(0,100),
    announcements:store.data.announcements||[], globalCommands:store.data.globalCommands||[], meta:store.data.meta||{},
    reactionPanels:community.state(store).reactionPanels, reminders:community.state(store).reminders,
    polls:polls.listing(store),
    teamAvailability:teamBoard.state(store),
    giveaways:allGiveaways(store).map(g=>({
      id:g.id,title:g.title,description:g.description,channelId:g.channelId,
      messageId:g.messageId,imageUrl:g.imageUrl||'',status:g.status,createdAt:g.createdAt,closedAt:g.closedAt||null,
      endsAt:g.endsAt||null,endLocal:g.endLocal||'',timeZone:g.timeZone||'America/Mexico_City',
      participants:Array.isArray(g.participants)?g.participants:[], participantCount:(g.participants||[]).length,
      demoNames:Array.isArray(g.demoNames)?g.demoNames:[], // Private dashboard preview only
      winners:Array.isArray(g.winners)?g.winners:null,winnersDrawnAt:g.winnersDrawnAt||null,winnersMessageId:g.winnersMessageId||null
    }))
  };
}

async function syncPanels(client,store,kind) {
  const key=kind==='ticket'?'ticketPanelPublications':'verificationPanelPublications';
  const items=Array.isArray(store.data[key])?store.data[key]:[];
  const payload=kind==='ticket'?ticketPanel(store):verificationPanel(store);
  let updated=0;const failures=[];
  for(const pub of items){
    try {
      const ch=await client.channels.fetch(pub.channelId);
      if(!ch?.messages?.fetch)throw Error('Channel unavailable');
      const msg=await ch.messages.fetch(pub.messageId);
      if(msg.author?.id!==client.user?.id)throw Error('Panel was not authored by this bot');
      await msg.edit({...payload,attachments:[]});
      updated++;
    }catch(e){failures.push(pub.channelId+': '+e.message)}
  }
  return {discordUpdated:updated,syncWarnings:failures.slice(0,10)};
}
async function linkExistingPanel(client,store,payload){
  const kind=payload.kind;
  if(!['ticket','verification'].includes(kind))throw Error('Choose Ticket or Verification panel.');
  const channel=await assertTextChannel(client,payload.channelId);
  const messageId=String(payload.messageId||'').trim();
  if(!/^\d{16,22}$/.test(messageId))throw Error('Paste a valid Discord message ID.');
  const message=await channel.messages?.fetch(messageId).catch(()=>null);
  if(!message)throw Error('Message not found. Enable Developer Mode and copy its ID.');
  if(message.author?.id!==client.user?.id)throw Error('Only panels published by KIXO BOT can be linked.');
  const ids=(message.components||[]).flatMap(row=>row.components||[]).map(c=>c.customId||c.data?.custom_id||'');
  const verified=kind==='ticket'?ids.some(x=>x.startsWith('ticket:create:')):ids.includes('verify:member');
  if(!verified)throw Error('This message is not a '+kind+' panel from the current bot.');
  const key=kind==='ticket'?'ticketPanelPublications':'verificationPanelPublications';
  if(!Array.isArray(store.data[key]))store.data[key]=[];
  if(!store.data[key].some(x=>x.messageId===messageId))store.data[key].push({channelId:channel.id,messageId});
  store.save();
  const result=await syncPanels(client,store,kind);
  return {ok:true,linked:true,messageId,kind,...result};
}
async function publishOrUpdatePanel(client,store,kind,channelId){
  const ch=await assertTextChannel(client,channelId);
  const key=kind==='ticket'?'ticketPanelPublications':'verificationPanelPublications';
  if(!Array.isArray(store.data[key]))store.data[key]=[];
  const payload=kind==='ticket'?ticketPanel(store):verificationPanel(store);
  // Reuse the latest tracked publication in the selected channel; no duplicate posts.
  const row=[...store.data[key]].reverse().find(x=>x.channelId===ch.id);
  if(row){
    const existing=await ch.messages.fetch(row.messageId).catch(()=>null);
    if(existing&&existing.author?.id===client.user?.id){
      await existing.edit(payload);
      return {ok:true,messageId:existing.id,updatedExisting:true};
    }
  }
  const sent=await ch.send(payload);
  store.data[key].push({channelId:ch.id,messageId:sent.id});
  store.save();
  return {ok:true,messageId:sent.id,updatedExisting:false};
}
async function assertTextChannel(client,id){
  const ch=await client.channels.fetch(String(id||'')).catch(()=>null);
  if(!ch||ch.guildId!==process.env.GUILD_ID||typeof ch.send!=='function')throw Error('Choose a text channel on this KIXO server.');
  return ch;
}
function validateGreetingSettings(p){
  if(p.welcomeCaption!==undefined&&String(p.welcomeCaption).length>1900)throw Error('Welcome text is too long.');
  for(const key of ['welcomeTitle','goodbyeTitle','welcomeText','goodbyeText']){
    if(p[key]!==undefined&&String(p[key]).length>(key.endsWith('Title')?245:3800))throw Error(key+' is too long.');
  }
  for(const key of ['welcomeImageUrl','goodbyeImageUrl']){
    if(p[key]!==undefined)community.url(p[key]);
  }
}

async function mutate(client, store, rulesStore, body) {
  ensureExtended(store);
  const {section, action, payload={}} = body||{};
  if(section==='panel' && action==='link')return linkExistingPanel(client,store,payload);
    if(section==='reactionRole'){
    if(action==='upsert')return community.upsertReactionPanel(client,store,payload);
    if(action==='delete')return community.deleteReactionPanel(client,store,payload.id);
    throw Error('Unsupported reaction role action.');
  }
  if(section==='customCommand'){
    if(action==='upsert'){
      if(payload.channelId)await assertTextChannel(client,payload.channelId);
      return community.upsertCommand(store,payload);
    }
    if(action==='delete')return community.deleteCommand(store,payload.id);
    throw Error('Unsupported command action.');
  }
  if(section==='reminder'){
    if(action==='upsert'){
      await assertTextChannel(client,payload.channelId);
      return community.upsertReminder(store,payload);
    }
    if(action==='delete')return community.deleteReminder(store,payload.id);
    throw Error('Unsupported reminder action.');
  }
  if(section==='teamAvailability'){
    if(['import','publish','add','set','remove','title'].includes(action))return teamBoard.apply(client,store,action,payload);
    throw Error('Unsupported team availability action.');
  }
  if(section==='greeting'){
    const kind=payload.kind==='goodbye'?'goodbye':'welcome';
    if(action==='check'){
      const guild=await client.guilds.fetch(process.env.GUILD_ID);
      return community.checkGreetingDelivery(guild,store,kind);
    }
    if(action==='test')return community.testGreeting(client,store,kind);
    throw Error('Unsupported greeting action.');
  }
  if(section==='poll'){
    if(action==='publish')return polls.publish(client,store,payload);
    if(action==='end')return polls.end(client,store,payload);
    throw Error('Unsupported poll action.');
  }
  if (section==='giveaway') {
    if (action==='create') return publishGiveaway(client,store,payload);
    if (action==='close') return closeGiveaway(client,store,payload.id);
    if (action==='draw') return drawWinners(client,store,payload.id,payload.count);
    if (action==='demoNames') return setAdminSampleNames(client,store,payload);
    if (action==='edit') return editGiveaway(client,store,payload);
    if (action==='delete') return deleteGiveaway(client,store,payload.id);
    throw Error('Unsupported giveaway action.');
  }
  if(section==='ticketArchive'){
    const guild=await client.guilds.fetch(process.env.GUILD_ID);
    if(action==='create'){
      const category=await resolveClosedTicketCategory(guild,store,{create:true});
      const archive=await archiveClosedTickets(guild,store,{create:false});
      return {...archive,categoryId:category.id};
    }
    if(action==='sync')return archiveClosedTickets(guild,store,{create:true});
    throw Error('Unsupported closed tickets archive action.');
  }
  if (section==='settings' && action==='update') {
    validateGreetingSettings(payload);
    if(Object.prototype.hasOwnProperty.call(payload,'ticketClosedCategoryId')&&payload.ticketClosedCategoryId){
      const categoryId=String(payload.ticketClosedCategoryId);
      if(!/^\d{16,22}$/.test(categoryId))throw Error('Select a valid Discord category for closed tickets.');
      const guild=await client.guilds.fetch(process.env.GUILD_ID);
      const category=await guild.channels.fetch(categoryId).catch(()=>null);
      if(!category||category.type!==ChannelType.GuildCategory)throw Error('Selected closed-ticket category no longer exists. Refresh and select another.');
    }

    // Upload new greeting photos into DATA_DIR and save only file references
    // in the persistent JSON database; roll back files on save failure.
    const greeting=community.prepareGreetingImages(store,payload);
    let images;
    try{images=media.prepare(store.data.settings,greeting.patch,['ticketLogo','ticketBanner','verifyLogo','verifyBanner'])}
    catch(err){greeting.rollback();throw err}
    const previousSettings={...store.data.settings};
    // Saving "Enable welcomes" from the community page also clears a legacy
    // master feature disable flag that otherwise silently prevented delivery.
    if(payload.welcomeEnabled===true&&store.data.settings.features?.welcomes===false){
      images.patch.features={...store.data.settings.features,welcomes:true};
    }
    try{store.updateSettings(images.patch)}
    catch(err){store.data.settings=previousSettings;images.rollback();greeting.rollback();throw err}
    images.complete();greeting.complete();
    const ticketKeys=['ticketPanelTitle','ticketPanelText','ticketPanelFooter','ticketPanelColor','ticketLogoUrl','ticketBannerUrl','ticketLogoFile','ticketBannerFile'];
    const verifyKeys=['verifyPanelTitle','verifyPanelText','verifyButtonText','verifyPanelColor','verifyLogoUrl','verifyBannerUrl','verifyLogoFile','verifyBannerFile'];
    let outcome={ok:true,saved:true,discordUpdated:0,syncWarnings:[]};
    if(ticketKeys.some(x=>Object.prototype.hasOwnProperty.call(payload,x))){
      const r=await syncPanels(client,store,'ticket');
      outcome.discordUpdated+=r.discordUpdated;outcome.syncWarnings.push(...r.syncWarnings);
    }
    if(verifyKeys.some(x=>Object.prototype.hasOwnProperty.call(payload,x))){
      const r=await syncPanels(client,store,'verification');
      outcome.discordUpdated+=r.discordUpdated;outcome.syncWarnings.push(...r.syncWarnings);
    }
    if(Object.prototype.hasOwnProperty.call(payload,'ticketClosedCategoryId')&&payload.ticketClosedCategoryId){
      const guild=await client.guilds.fetch(process.env.GUILD_ID);
      const archive=await archiveClosedTickets(guild,store,{create:false});
      outcome.archive=archive;
      if(archive.failed)outcome.syncWarnings.push(...archive.warnings);
    }
    if(Object.prototype.hasOwnProperty.call(payload,'welcomeEnabled')){
      const guild=await client.guilds.fetch(process.env.GUILD_ID).catch(()=>null);
      if(guild){
        const delivery=await community.checkGreetingDelivery(guild,store,'welcome');
        outcome.welcomeDelivery=delivery;
        if(!delivery.ok)outcome.syncWarnings.push(delivery.message);
      }
    }
    return outcome;
  }
  if (section==='feature' && action==='toggle') { store.data.settings.features[payload.key]=!!payload.enabled; store.save(); return {ok:true}; }
  if (section==='ai' && action==='sync') { const g=await client.guilds.fetch(process.env.GUILD_ID); const r=await rebuildKnowledge(g,store,Math.max(50,Number(process.env.MAX_MESSAGES_PER_CHANNEL||500))); return {ok:true,result:r}; }
  if (section==='ticketType') {
    if (action==='upsert') { const row={...payload,id:payload.id||id('ticket')}; const i=(store.data.ticketTypes||[]).findIndex(x=>x.id===row.id); if(i>=0) store.data.ticketTypes[i]={...store.data.ticketTypes[i],...row}; else store.data.ticketTypes.push(row); store.save(); return {ok:true,id:row.id,...await syncPanels(client,store,'ticket')}; }
    if (action==='delete') { store.data.ticketTypes=(store.data.ticketTypes||[]).filter(x=>x.id!==payload.id); store.save(); return {ok:true,...await syncPanels(client,store,'ticket')}; }
    if (action==='publish') return publishOrUpdatePanel(client,store,'ticket',payload.channelId);
  }
  if (section==='ticketCommand') {
    if(action==='upsert'){const row={...payload,id:payload.id||id('cmd')};const a=store.data.ticketCustomCommands||[];const i=a.findIndex(x=>x.id===row.id);if(i>=0)a[i]={...a[i],...row};else a.push(row);store.data.ticketCustomCommands=a.slice(0,25);store.save();return{ok:true,id:row.id};}
    if(action==='delete'){store.data.ticketCustomCommands=(store.data.ticketCustomCommands||[]).filter(x=>x.id!==payload.id);store.save();return{ok:true};}
  }
  if (section==='rule') {
    if(action==='upsert'){
      let panel=payload.id?rulesStore.find(payload.id):null;
      const previous=panel?{...panel}:null,created=!panel;
      const assets=media.prepare(panel||{},payload,['banner','thumbnail']);
      try{
        if(!panel)panel=rulesStore.create(payload.name||'Rules Panel');
        Object.assign(panel,{name:payload.name??panel.name,title:payload.title??panel.title,bio:payload.bio??panel.bio,
          bannerUrl:assets.patch.bannerUrl??panel.bannerUrl,thumbnailUrl:assets.patch.thumbnailUrl??panel.thumbnailUrl,
          bannerFile:assets.patch.bannerFile??panel.bannerFile,thumbnailFile:assets.patch.thumbnailFile??panel.thumbnailFile});
        if(payload.colors)panel.colors={...panel.colors,...payload.colors};
        if(payload.rules)panel.rules=payload.rules;
        rulesStore.touch(panel);
      }catch(err){
        assets.rollback();
        if(panel&&created)rulesStore.remove(panel.id);
        else if(previous&&panel)Object.assign(panel,previous);
        throw err;
      }
      assets.complete();
      const sync=await refreshPublishedPanel(client,panel,rulesStore);
      return {ok:true,id:panel.id,discordUpdated:sync.updated,unreachablePosts:sync.stale};
    }
    if(action==='delete'){const p=rulesStore.find(payload.id);if(!p)throw Error('Rules panel not found.');await deletePublishedMessages(client,p);rulesStore.remove(payload.id);return{ok:true};}
    if(action==='publish'){const p=rulesStore.find(payload.id);if(!p)throw new Error('Rules panel not found.');const ch=await client.channels.fetch(payload.channelId).catch(()=>null);if(!ch?.isTextBased())throw new Error('Publish channel not found.');const m=await ch.send(publicPanelPayload(p));p.publications.push({id:id('pub'),channelId:ch.id,messageId:m.id,createdAt:new Date().toISOString()});rulesStore.touch(p);return{ok:true,messageId:m.id};}
  }
  if(section==='fixture'){
    if(action==='upsert'){
      const existing=store.data.fixtures.find(x=>x.id===payload.id)||{};
      const images=media.prepare(existing,payload,['homeLogo','awayLogo']);
      const row=normalizeFixture(images.patch,existing);
      if(!row.homeTeam||!row.awayTeam){images.rollback();throw Error('Home team and away team are required.');}
      const previous=[...store.data.fixtures];
      try{const i=store.data.fixtures.findIndex(x=>x.id===row.id);if(i>=0)store.data.fixtures[i]=row;else store.data.fixtures.push(row);store.save()}
      catch(e){store.data.fixtures=previous;images.rollback();throw e}
      images.complete();
      let discordUpdated=0;
      if(row.channelId&&row.messageId){try{await publishFixture(client,row,row.channelId);store.save();discordUpdated=1}catch(e){return {ok:true,id:row.id,discordUpdated:0,syncWarnings:[e.message]}}}
      return {ok:true,id:row.id,discordUpdated};
    }
    if(action==='delete'){const row=store.data.fixtures.find(x=>x.id===payload.id);if(!row)throw Error('Fixture not found.');if(row.channelId&&row.messageId){const ch=await client.channels.fetch(row.channelId).catch(()=>null);if(ch){const m=await ch.messages?.fetch(row.messageId).catch(()=>null);if(m)await m.delete();}}store.data.fixtures=store.data.fixtures.filter(x=>x.id!==payload.id);store.save();return{ok:true};}
    if(action==='publish'){const f=store.data.fixtures.find(x=>x.id===payload.id);if(!f)throw new Error('Fixture not found.');const m=await publishFixture(client,f,payload.channelId||f.channelId);store.save();return{ok:true,messageId:m.id};}
  }
  if(section==='verification'&&action==='publish')return publishOrUpdatePanel(client,store,'verification',payload.channelId);
  if(section==='announcement'&&action==='send'){
    const ch=await client.channels.fetch(payload.channelId).catch(()=>null);
    if(!ch?.isTextBased())throw Error('Announcement channel not found.');

    // Native Discord text, not an embed card. Keep the title in readable Markdown.
    const title=String(payload.title||'').trim().slice(0,256);
    const body=String(payload.message||'').trim();
    const mention=payload.everyone===true?'@everyone':'';
    let message=[mention,title?'**'+title+'**':'',body].filter(Boolean).join('\n\n');
    const filesPayload=media.prepare({},payload,['banner']);
    const imagePath=media.fileFor(filesPayload.patch.bannerFile);
    const files=imagePath?[new AttachmentBuilder(imagePath)]:[];
    // Older URL-based announcements remain readable without using an embed card.
    if(!files.length&&filesPayload.patch.bannerUrl)
      message+='\n\n'+String(filesPayload.patch.bannerUrl).slice(0,1000);
    message=message.trim();
    if(!message&&!files.length){filesPayload.rollback();throw Error('Enter announcement text or upload a picture.');}

    // Discord text messages are limited to 2000 characters. Keep everything by
    // splitting long announcements into sequential plain-text messages.
    const chunks=[];
    while(message.length>2000){
      let cut=message.lastIndexOf('\n',2000);
      if(cut<800)cut=message.lastIndexOf(' ',2000);
      if(cut<800)cut=2000;
      chunks.push(message.slice(0,cut).trimEnd());
      message=message.slice(cut).trimStart();
    }
    if(message||!chunks.length)chunks.push(message);
    const sent=[];
    try{
      for(let i=0;i<chunks.length;i++){
        const part=await ch.send({
          content:chunks[i]||undefined,
          files:i===0?files:[],
          allowedMentions:{parse:i===0&&payload.everyone===true?['everyone']:[]}
        });
        sent.push(part);
      }
    }catch(err){
      for(const post of sent)await post.delete().catch(()=>{});
      filesPayload.rollback();
      throw err;
    }
    store.data.announcements.unshift({
      id:id('ann'),title,message:body,channelId:ch.id,
      messageId:sent[0].id,messageIds:sent.map(m=>m.id),
      bannerFile:filesPayload.patch.bannerFile||'',bannerUrl:filesPayload.patch.bannerUrl||'',
      at:new Date().toISOString()
    });
    store.data.announcements=store.data.announcements.slice(0,100);
    store.save();
    return {ok:true,messageId:sent[0].id,messageIds:sent.map(m=>m.id),format:'plain-text'};
  }
  throw new Error('Unsupported control action.');
}
function createControlApi(client, store, rulesStore = new RulesStore()) {
  return async function(req,res){
    if(!String(req.url||'').startsWith('/control')) return false;
    if(!auth(req)) { json(res,401,{error:'Unauthorized — BOT_CONTROL_SECRET does not match.'}); return true; }
    try {
      if(req.method==='GET' && req.url==='/control/state'){json(res,200,await buildState(client,store,rulesStore));return true;}
      if(req.method==='GET' && req.url==='/control/giveaways'){json(res,200,{giveaways:allGiveaways(store)});return true;}
      if(req.method==='GET' && req.url==='/control/ping'){json(res,200,{ok:true,bot:client.user?.tag||'starting',guildId:process.env.GUILD_ID||'',version:'8.23.0'});return true;}
      if(req.method==='POST' && req.url==='/control/mutate'){const body=await readBody(req);json(res,200,await mutate(client,store,rulesStore,body));return true;}
      json(res,404,{error:'Not found'});return true;
    } catch(e){console.error('Control API error:',e);json(res,400,{error:e.message||'Control API error'});return true;}
  };
}
module.exports={createControlApi};
