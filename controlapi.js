const crypto = require('crypto');
const { ChannelType, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { RulesStore, publicPanelPayload } = require('./rules');
const { ticketPanel } = require('./tickets');
const { verificationPanel } = require('./verification');
const { rebuildKnowledge } = require('./knowledge');

function json(res, status, data) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(data));
}
function readBody(req, max = 3 * 1024 * 1024) {
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
  const got = req.headers['x-semental-control'] || String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  return safeEqual(got, secret);
}
function id(prefix){return `${prefix}_${crypto.randomBytes(4).toString('hex')}`;}
function ensureExtended(store) {
  if (!Array.isArray(store.data.fixtures)) store.data.fixtures = [];
  if (!Array.isArray(store.data.announcements)) store.data.announcements = [];
  if (!Array.isArray(store.data.globalCommands)) store.data.globalCommands = [];
  if (!store.data.settings.features) store.data.settings.features = {};
  store.data.settings.features = { aiAnswers:true,tickets:true,levels:true,welcomes:true,moderation:false,announcements:true,rules:true,verification:true, ...(store.data.settings.features||{}) };
}
function sanitizeSettings(s) {
  return {
    answerChannelId:s.answerChannelId||'', knowledgeChannelIds:s.knowledgeChannelIds||[], ignoredChannelIds:s.ignoredChannelIds||[], ignoredCategoryIds:s.ignoredCategoryIds||[], autoDiscover:s.autoDiscover!==false, smartFilter:s.smartFilter!==false, answerMode:s.answerMode||'hybrid', features:s.features||{},
    welcomeChannelId:s.welcomeChannelId||'', welcomeRoleId:s.welcomeRoleId||'', logChannelId:s.logChannelId||'', staffRoleIds:s.staffRoleIds||[],
    unverifiedRoleId:s.unverifiedRoleId||'', verifiedRoleId:s.verifiedRoleId||'', verifyAssignJoinRole:!!s.verifyAssignJoinRole, verifyPanelTitle:s.verifyPanelTitle||'', verifyPanelText:s.verifyPanelText||'', verifyButtonText:s.verifyButtonText||'Verify', verifyPanelColor:s.verifyPanelColor||'#5865F2', verifyLogoUrl:s.verifyLogoUrl||'', verifyBannerUrl:s.verifyBannerUrl||'',
    ticketTranscriptChannelId:s.ticketTranscriptChannelId||'', ticketClosedCategoryId:s.ticketClosedCategoryId||'', ticketPanelTitle:s.ticketPanelTitle||'', ticketPanelText:s.ticketPanelText||'', ticketPanelFooter:s.ticketPanelFooter||'', ticketPanelColor:s.ticketPanelColor||'#D90429', ticketLogoUrl:s.ticketLogoUrl||'', ticketBannerUrl:s.ticketBannerUrl||'', ticketCommandPrefix:s.ticketCommandPrefix||'!', ticketCreatedReplyTemplate:s.ticketCreatedReplyTemplate||'',
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
    id:p.id||id('fx'), competition:String(p.competition||'SEMENTAL League').slice(0,100), season:String(p.season||'').slice(0,80), matchday:String(p.matchday||'').slice(0,80), round:String(p.round||'').slice(0,80), group:String(p.group||'').slice(0,80), leg:String(p.leg||'').slice(0,50),
    homeTeam:String(p.homeTeam||p.home||'').slice(0,100), awayTeam:String(p.awayTeam||p.away||'').slice(0,100), homeLogoUrl:String(p.homeLogoUrl||'').slice(0,1000), awayLogoUrl:String(p.awayLogoUrl||'').slice(0,1000),
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
  const e = new EmbedBuilder().setColor(fixture.status==='live'?'#22c55e':fixture.status==='completed'?'#64748b':'#D90429').setTitle(`⚽ ${home} vs ${away}`)
    .addFields({name:'Competition',value:fixture.competition||'SEMENTAL',inline:true},{name:'Date',value:fixture.date||'TBA',inline:true},{name:'Status',value:String(fixture.status||'upcoming').toUpperCase(),inline:true},{name:'Official Times',value:fixtureTimeBlock(fixture),inline:false});
  const stage=[fixture.matchday&&`Matchday ${fixture.matchday}`,fixture.round,fixture.group&&`Group ${fixture.group}`,fixture.leg&&`Leg ${fixture.leg}`].filter(Boolean).join(' • '); if(stage)e.addFields({name:'Stage',value:stage,inline:false});
  if(fixture.homeScore!==null&&fixture.awayScore!==null)e.addFields({name:'Result',value:`**${home} ${fixture.homeScore} - ${fixture.awayScore} ${away}**`,inline:false});
  if(fixture.notes)e.addFields({name:'Notes',value:fixture.notes.slice(0,1024),inline:false});
  if(fixture.homeLogoUrl)e.setThumbnail(fixture.homeLogoUrl);
  if(fixture.streamUrl)e.setURL(fixture.streamUrl);
  e.setFooter({text:'SEMENTAL • COMPETE WITH RESPECT • PLAY TO WIN'}).setTimestamp();
  let m=null;
  if(fixture.messageId && fixture.channelId===ch.id){m=await ch.messages.fetch(fixture.messageId).catch(()=>null); if(m) await m.edit({embeds:[e]});}
  if(!m)m=await ch.send({embeds:[e]}); fixture.channelId=ch.id; fixture.messageId=m.id; return m;
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
    announcements:store.data.announcements||[], globalCommands:store.data.globalCommands||[], meta:store.data.meta||{}
  };
}
async function mutate(client, store, rulesStore, body) {
  ensureExtended(store);
  const {section, action, payload={}} = body||{};
  if (section==='settings' && action==='update') { store.updateSettings(payload); return {ok:true}; }
  if (section==='feature' && action==='toggle') { store.data.settings.features[payload.key]=!!payload.enabled; store.save(); return {ok:true}; }
  if (section==='ai' && action==='sync') { const g=await client.guilds.fetch(process.env.GUILD_ID); const r=await rebuildKnowledge(g,store,Math.max(50,Number(process.env.MAX_MESSAGES_PER_CHANNEL||500))); return {ok:true,result:r}; }
  if (section==='ticketType') {
    if (action==='upsert') { const row={...payload,id:payload.id||id('ticket')}; const i=(store.data.ticketTypes||[]).findIndex(x=>x.id===row.id); if(i>=0) store.data.ticketTypes[i]={...store.data.ticketTypes[i],...row}; else store.data.ticketTypes.push(row); store.save(); return {ok:true,id:row.id}; }
    if (action==='delete') { store.data.ticketTypes=(store.data.ticketTypes||[]).filter(x=>x.id!==payload.id); store.save(); return {ok:true}; }
    if (action==='publish') { const ch=await client.channels.fetch(payload.channelId).catch(()=>null); if(!ch?.isTextBased()) throw new Error('Publish channel not found.'); const m=await ch.send(ticketPanel(store)); return {ok:true,messageId:m.id}; }
  }
  if (section==='ticketCommand') {
    if(action==='upsert'){const row={...payload,id:payload.id||id('cmd')};const a=store.data.ticketCustomCommands||[];const i=a.findIndex(x=>x.id===row.id);if(i>=0)a[i]={...a[i],...row};else a.push(row);store.data.ticketCustomCommands=a.slice(0,25);store.save();return{ok:true,id:row.id};}
    if(action==='delete'){store.data.ticketCustomCommands=(store.data.ticketCustomCommands||[]).filter(x=>x.id!==payload.id);store.save();return{ok:true};}
  }
  if (section==='rule') {
    if(action==='upsert'){let p=payload.id?rulesStore.find(payload.id):null;if(!p)p=rulesStore.create(payload.name||'Rules Panel');Object.assign(p,{name:payload.name??p.name,title:payload.title??p.title,bio:payload.bio??p.bio,bannerUrl:payload.bannerUrl??p.bannerUrl,thumbnailUrl:payload.thumbnailUrl??p.thumbnailUrl});if(payload.colors)p.colors={...p.colors,...payload.colors};if(payload.rules)p.rules=payload.rules;rulesStore.touch(p);return{ok:true,id:p.id};}
    if(action==='delete'){rulesStore.remove(payload.id);return{ok:true};}
    if(action==='publish'){const p=rulesStore.find(payload.id);if(!p)throw new Error('Rules panel not found.');const ch=await client.channels.fetch(payload.channelId).catch(()=>null);if(!ch?.isTextBased())throw new Error('Publish channel not found.');const m=await ch.send(publicPanelPayload(p));p.publications.push({id:id('pub'),channelId:ch.id,messageId:m.id,createdAt:new Date().toISOString()});rulesStore.touch(p);return{ok:true,messageId:m.id};}
  }
  if(section==='fixture'){
    if(action==='upsert'){const existing=store.data.fixtures.find(x=>x.id===payload.id)||{};const row=normalizeFixture(payload,existing);if(!row.homeTeam||!row.awayTeam)throw new Error('Home team and away team are required.');const i=store.data.fixtures.findIndex(x=>x.id===row.id);if(i>=0)store.data.fixtures[i]=row;else store.data.fixtures.push(row);store.save();return{ok:true,id:row.id};}
    if(action==='delete'){store.data.fixtures=store.data.fixtures.filter(x=>x.id!==payload.id);store.save();return{ok:true};}
    if(action==='publish'){const f=store.data.fixtures.find(x=>x.id===payload.id);if(!f)throw new Error('Fixture not found.');const m=await publishFixture(client,f,payload.channelId||f.channelId);store.save();return{ok:true,messageId:m.id};}
  }
  if(section==='verification'&&action==='publish'){const ch=await client.channels.fetch(payload.channelId).catch(()=>null);if(!ch?.isTextBased())throw new Error('Publish channel not found.');const m=await ch.send(verificationPanel(store));return{ok:true,messageId:m.id};}
  if(section==='announcement'&&action==='send'){const ch=await client.channels.fetch(payload.channelId).catch(()=>null);if(!ch?.isTextBased())throw new Error('Announcement channel not found.');const e=new EmbedBuilder().setColor(payload.color||'#D90429').setTitle(String(payload.title||'Announcement').slice(0,256)).setDescription(String(payload.message||'').slice(0,4096));if(payload.bannerUrl)e.setImage(String(payload.bannerUrl).slice(0,1000));const m=await ch.send({content:payload.everyone?'@everyone':undefined,embeds:[e],allowedMentions:{parse:payload.everyone?['everyone']:[]}});store.data.announcements.unshift({id:id('ann'),title:payload.title||'',message:payload.message||'',channelId:ch.id,at:new Date().toISOString()});store.data.announcements=store.data.announcements.slice(0,100);store.save();return{ok:true,messageId:m.id};}
  throw new Error('Unsupported control action.');
}
function createControlApi(client, store, rulesStore = new RulesStore()) {
  return async function(req,res){
    if(!String(req.url||'').startsWith('/control')) return false;
    if(!auth(req)) { json(res,401,{error:'Unauthorized — BOT_CONTROL_SECRET does not match.'}); return true; }
    try {
      if(req.method==='GET' && req.url==='/control/state'){json(res,200,await buildState(client,store,rulesStore));return true;}
      if(req.method==='GET' && req.url==='/control/ping'){json(res,200,{ok:true,bot:client.user?.tag||'starting',guildId:process.env.GUILD_ID||'',version:'8.4.0'});return true;}
      if(req.method==='POST' && req.url==='/control/mutate'){const body=await readBody(req);json(res,200,await mutate(client,store,rulesStore,body));return true;}
      json(res,404,{error:'Not found'});return true;
    } catch(e){console.error('Control API error:',e);json(res,400,{error:e.message||'Control API error'});return true;}
  };
}
module.exports={createControlApi};
