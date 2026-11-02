const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DATA_DIR } = require('./store');
const { publicPanelPayload } = require('./rules');

class JsonSessionStore extends session.Store {
  constructor(file) {
    super(); this.file = file; this.sessions = {};
    try { fs.mkdirSync(path.dirname(file), { recursive:true }); if (fs.existsSync(file)) this.sessions = JSON.parse(fs.readFileSync(file,'utf8')) || {}; }
    catch (e) { console.error('Dashboard session store load warning:', e.message); this.sessions = {}; }
  }
  persist(){ try { const tmp=`${this.file}.tmp`; fs.writeFileSync(tmp,JSON.stringify(this.sessions)); fs.renameSync(tmp,this.file); } catch(e){ console.error('Dashboard session store save warning:',e.message); } }
  get(sid,cb){ const sess=this.sessions[sid]||null; if(sess?.cookie?.expires&&Date.parse(sess.cookie.expires)<Date.now()){delete this.sessions[sid];this.persist();return cb(null,null);} cb(null,sess); }
  set(sid,sess,cb=()=>{}){this.sessions[sid]=sess;this.persist();cb(null);} destroy(sid,cb=()=>{}){delete this.sessions[sid];this.persist();cb(null);} touch(sid,sess,cb=()=>{}){this.sessions[sid]=sess;this.persist();cb(null);}
}

function escapeHtml(v=''){ return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function checked(v){return v?'checked':'';}
function page(body,title='KIXO AI'){return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><link rel="stylesheet" href="/style.css"></head><body>${body}</body></html>`;}
function featureText(k){return ({aiAnswers:'Automatic smart replies in your help channel.',tickets:'Private support tickets with transcripts.',levels:'XP, ranks and leaderboard.',welcomes:'Branded join messages and optional auto-role.',moderation:'Automatic filters plus staff moderation commands.',tournaments:'Registration panels and player lists.',announcements:'Branded staff announcement command.',rules:'Independent English/Spanish rules panels with private language views.',verification:'Button verification that swaps the join role for the verified role.'})[k]||'';}
function dashboardHtml(store,guild,rulesStore){
  const s=store.data.settings,m=store.data.meta,rulePanels=rulesStore?.list?.()||[];
  const rulesHtml=rulePanels.length?rulePanels.slice(0,12).map(p=>`<div class="qa"><b>${escapeHtml(p.name)}</b><span>${p.rules.en.length} EN rules • ${p.rules.es.length} ES rules • ${p.publications.length} published copies • <code>${escapeHtml(p.id)}</code></span></div>`).join(''):'<p class="muted">No rules panels yet. Use /rules-create in Discord.</p>';
  const sources=s.autoDiscover!==false?`<span class="chip">AUTO DISCOVER</span><span class="muted">${m.syncChannels||0} indexed • ${m.excludedChannels||0} excluded</span>`:(s.knowledgeChannelIds.length?s.knowledgeChannelIds.map(id=>`<span class="chip">#${escapeHtml(guild?.channels?.cache?.get(id)?.name||id)}</span>`).join(''):'<span class="muted">Manual mode with no source list</span>');
  const qa=store.data.qaLog.slice(0,8).map(x=>`<div class="qa"><b>${escapeHtml(x.question)}</b><span>${escapeHtml(x.answer).slice(0,220)}</span></div>`).join('')||'<p class="muted">No questions answered yet.</p>';
  return page(`<div class="shell"><aside><div class="brand"><div class="mark">S</div><div><b>KIXO AI</b><small>SERVER ASSISTANT</small></div></div><nav><a href="#overview">Overview</a><a href="#knowledge">Smart Knowledge</a><a href="#rules">Rules System</a><a href="#features">Features</a><a href="#activity">Activity</a></nav><form method="post" action="/logout"><button class="ghost">Log out</button></form></aside><main><header><div><span class="eyebrow">THE ULTIMATE BOT FOR YOUR SERVER</span><h1>KIXO <em>AI</em></h1><p>Control your Discord assistant, knowledge sources and community systems from one place.</p></div><div class="status"><i></i> ONLINE</div></header>
  <section id="overview" class="grid stats"><article><span>Indexed Messages</span><strong>${store.data.knowledge.length.toLocaleString()}</strong></article><article><span>Knowledge Channels</span><strong>${m.syncChannels||s.knowledgeChannelIds.length}</strong></article><article><span>Open Tickets</span><strong>${Object.values(store.data.tickets).filter(x=>x.status==='open').length}</strong></article><article><span>Members With XP</span><strong>${Object.keys(store.data.levels).length}</strong></article><article><span>Rules Panels</span><strong>${rulePanels.length}</strong></article></section>
  <section class="grid two"><article class="panel" id="knowledge"><div class="panel-title"><div><span class="icon">🧠</span><b>Smart AI Knowledge</b></div><span class="pill">${escapeHtml(s.answerMode.toUpperCase())}</span></div><p>Auto Discover can scan every readable eligible Discord channel, while Ignore Lists keep staff chat, tickets, logs, or noisy channels out of the knowledge base.</p><div class="sources">${sources}</div><form method="post" action="/settings" class="form"><label>Automatic Answer Channel ID<input name="answerChannelId" value="${escapeHtml(s.answerChannelId)}" placeholder="Discord channel ID"></label><label class="inline-check"><input type="checkbox" name="autoDiscover" ${checked(s.autoDiscover!==false)}> Auto Discover all readable channels</label><label class="inline-check"><input type="checkbox" name="smartFilter" ${checked(s.smartFilter!==false)}> Smart Filter common ticket/log/off-topic channels</label><label>Manual Knowledge Channel IDs<textarea name="knowledgeChannelIds">${escapeHtml(s.knowledgeChannelIds.join(','))}</textarea></label><label>Ignored Channel IDs<textarea name="ignoredChannelIds">${escapeHtml(s.ignoredChannelIds.join(','))}</textarea></label><label>Ignored Category IDs<textarea name="ignoredCategoryIds">${escapeHtml(s.ignoredCategoryIds.join(','))}</textarea></label><label>Answer Mode<select name="answerMode"><option ${s.answerMode==='hybrid'?'selected':''}>hybrid</option><option ${s.answerMode==='ai'?'selected':''}>ai</option><option ${s.answerMode==='search'?'selected':''}>search</option></select></label><button>Save Knowledge Settings</button></form></article>
  <article class="panel" id="features"><div class="panel-title"><div><span class="icon">⚙️</span><b>Server Systems</b></div><span class="pill red">LIVE</span></div><form method="post" action="/features" class="switches">${Object.entries(s.features).map(([k,v])=>`<label><span><b>${escapeHtml(k.replace(/([A-Z])/g,' $1'))}</b><small>${featureText(k)}</small></span><input type="checkbox" name="${escapeHtml(k)}" ${checked(v)}></label>`).join('')}<button>Save Features</button></form></article></section>
  <section class="panel" id="rules"><div class="panel-title"><div><span class="icon">📜</span><b>Multi-Channel Rules System</b></div><span class="pill red">MERGED</span></div><div class="qa-list">${rulesHtml}</div></section>
  <section class="panel" id="activity"><div class="panel-title"><div><span class="icon">⚡</span><b>Recent AI Answers</b></div><span class="muted">Last sync: ${escapeHtml(m.lastSync||'Never')}</span></div><div class="qa-list">${qa}</div></section></main></div>`);
}

function secureEqual(a,b){ const aa=Buffer.from(String(a||'')),bb=Buffer.from(String(b||'')); return aa.length===bb.length && crypto.timingSafeEqual(aa,bb); }
function controlKey(req){ const bearer=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'').trim(); return String(req.headers['x-kixo-key']||bearer||''); }
function controlAuth(req,res,next){ const expected=String(process.env.CONTROL_API_SECRET||process.env.DASHBOARD_PASSWORD||''); if(!expected||!secureEqual(controlKey(req),expected)) return res.status(401).json({ok:false,error:'Unauthorized'}); next(); }
function incoming(obj,a,b,def){ return obj?.[a] ?? obj?.[b] ?? def; }
function normalizeRules(items=[]){ return Array.isArray(items)?items.map((r,i)=>({id:String(r?.id||`r_${Date.now().toString(36)}_${i}`),title:String(r?.title||`Rule ${i+1}`).trim(),body:String(r?.body||'').trim()})).filter(r=>r.body||r.title):[]; }
function publicSettings(s){ return { answerChannelId:s.answerChannelId||'', autoDiscoverChannels:s.autoDiscover!==false, smartFilter:s.smartFilter!==false, answerMode:s.answerMode||'hybrid', knowledgeChannelIds:s.knowledgeChannelIds||[], ignoredChannelIds:s.ignoredChannelIds||[], ignoredCategoryIds:s.ignoredCategoryIds||[], features:s.features||{} }; }

function startDashboard({ store, client, rulesStore, syncKnowledge }) {
  if(String(process.env.DASHBOARD_ENABLED||'true')!=='true') return null;
  const app=express();
  app.use(helmet({contentSecurityPolicy:false}));
  app.use(express.urlencoded({extended:false}));
  app.use(express.json({limit:'2mb'}));
  app.use(express.static('public'));
  const sessionStore=new JsonSessionStore(path.join(DATA_DIR,'dashboard-sessions.json'));
  app.use(session({store:sessionStore,secret:process.env.SESSION_SECRET||'please-change-this-secret',resave:false,saveUninitialized:false,cookie:{httpOnly:true,sameSite:'lax',secure:false,maxAge:86400000}}));

  app.get('/health',(_,res)=>res.json({ok:true,bot:client.user?.tag||null}));

  // Windows Control API — authenticated with CONTROL_API_SECRET if set, otherwise the existing DASHBOARD_PASSWORD.
  app.get('/api/control/status',controlAuth,(req,res)=>res.json({online:!!client.user,botTag:client.user?.tag||'',version:require('../package.json').version,uptime:`${Math.floor(process.uptime()/3600)}h ${Math.floor((process.uptime()%3600)/60)}m`,guilds:client.guilds.cache.size,indexedMessages:store.data.knowledge.length,knowledgeChannels:store.data.meta.syncChannels||store.data.settings.knowledgeChannelIds.length,openTickets:Object.values(store.data.tickets).filter(x=>x.status==='open').length,rulesPanels:rulesStore.list().length,membersWithXp:Object.keys(store.data.levels).length,platform:'Railway',lastSync:store.data.meta.lastSync||''}));
  app.get('/api/control/snapshot',controlAuth,(req,res)=>res.json({status:{online:!!client.user,botTag:client.user?.tag||'',version:require('../package.json').version,uptime:`${Math.floor(process.uptime()/3600)}h ${Math.floor((process.uptime()%3600)/60)}m`,guilds:client.guilds.cache.size,indexedMessages:store.data.knowledge.length,knowledgeChannels:store.data.meta.syncChannels||store.data.settings.knowledgeChannelIds.length,openTickets:Object.values(store.data.tickets).filter(x=>x.status==='open').length,rulesPanels:rulesStore.list().length,membersWithXp:Object.keys(store.data.levels).length,platform:'Railway',lastSync:store.data.meta.lastSync||''},settings:publicSettings(store.data.settings),recentAnswers:store.data.qaLog.slice(0,8).map(x=>`${x.question} — ${x.answer}`)}));
  app.get('/api/control/channels',controlAuth,(req,res)=>{ const guild=client.guilds.cache.get(process.env.GUILD_ID); const s=store.data.settings; const list=[...(guild?.channels?.cache?.values?.()||[])].filter(ch=>ch?.isTextBased?.()).map(ch=>({id:ch.id,name:ch.name,category:ch.parent?.name||'',included:(s.knowledgeChannelIds||[]).includes(ch.id),ignored:(s.ignoredChannelIds||[]).includes(ch.id)})); res.json(list); });
  app.post('/api/control/settings',controlAuth,(req,res)=>{ const b=req.body||{},s=store.data.settings; store.updateSettings({answerChannelId:String(incoming(b,'answerChannelId','AnswerChannelId',s.answerChannelId)||'').trim(),autoDiscover:Boolean(incoming(b,'autoDiscoverChannels','AutoDiscoverChannels',incoming(b,'autoDiscover','AutoDiscover',s.autoDiscover!==false))),smartFilter:Boolean(incoming(b,'smartFilter','SmartFilter',s.smartFilter!==false)),knowledgeChannelIds:incoming(b,'knowledgeChannelIds','KnowledgeChannelIds',s.knowledgeChannelIds)||[],ignoredChannelIds:incoming(b,'ignoredChannelIds','IgnoredChannelIds',s.ignoredChannelIds)||[],ignoredCategoryIds:incoming(b,'ignoredCategoryIds','IgnoredCategoryIds',s.ignoredCategoryIds)||[],answerMode:['hybrid','ai','search'].includes(String(incoming(b,'answerMode','AnswerMode',s.answerMode)).toLowerCase())?String(incoming(b,'answerMode','AnswerMode',s.answerMode)).toLowerCase():'hybrid'}); res.json({ok:true,settings:publicSettings(store.data.settings)}); });
  app.post('/api/control/features',controlAuth,(req,res)=>{ const incomingFeatures=req.body||{},f={...store.data.settings.features}; for(const k of Object.keys(f)) if(Object.prototype.hasOwnProperty.call(incomingFeatures,k)) f[k]=!!incomingFeatures[k]; store.data.settings.features=f; store.save(); res.json({ok:true,features:f}); });
  app.post('/api/control/knowledge/reindex',controlAuth,async(req,res)=>{ try { const guild=client.guilds.cache.get(process.env.GUILD_ID); if(!guild||typeof syncKnowledge!=='function') return res.status(503).json({ok:false,error:'Sync unavailable'}); const result=await syncKnowledge(guild); if(!result) return res.status(409).json({ok:false,error:'Sync already running'}); res.json({ok:true,...result}); } catch(e){ res.status(500).json({ok:false,error:e.message}); } });
  app.get('/api/control/rules',controlAuth,(req,res)=>res.json(rulesStore.list()));
  app.post('/api/control/rules',controlAuth,(req,res)=>{ const b=req.body||{}; const panel=rulesStore.create(String(b.name||b.Name||'New Rules Panel')); applyPanel(panel,b); rulesStore.touch(panel); res.json(panel); });
  app.put('/api/control/rules/:id',controlAuth,(req,res)=>{ let panel=rulesStore.find(req.params.id); if(!panel){ panel=rulesStore.create(String(req.body?.name||req.body?.Name||'New Rules Panel')); const oldId=panel.id; delete rulesStore.data.panels[oldId]; panel.id=String(req.params.id); rulesStore.data.panels[panel.id]=panel; } applyPanel(panel,req.body||{}); rulesStore.touch(panel); res.json(panel); });
  app.delete('/api/control/rules/:id',controlAuth,(req,res)=>{ const panel=rulesStore.find(req.params.id); if(!panel)return res.status(404).json({ok:false,error:'Panel not found'}); rulesStore.remove(panel.id); res.json({ok:true}); });
  app.post('/api/control/rules/:id/publish',controlAuth,async(req,res)=>{ try { const panel=rulesStore.find(req.params.id); if(!panel)return res.status(404).json({ok:false,error:'Panel not found'}); const channelId=String(req.body?.channelId||req.body?.ChannelId||'').trim(); const ch=client.channels.cache.get(channelId)||await client.channels.fetch(channelId).catch(()=>null); if(!ch?.isTextBased?.())return res.status(400).json({ok:false,error:'Invalid text channel'}); const msg=await ch.send(publicPanelPayload(panel)); panel.publications.push({id:`pub_${Date.now().toString(36)}`,channelId:ch.id,messageId:msg.id,createdAt:new Date().toISOString()}); rulesStore.touch(panel); res.json({ok:true,messageId:msg.id,panel}); } catch(e){res.status(500).json({ok:false,error:e.message});} });
  app.post('/api/control/bot/restart',controlAuth,(req,res)=>{ res.status(202).json({ok:true,restarting:true}); setTimeout(()=>process.exit(0),350).unref?.(); });

  app.get('/login',(req,res)=>res.send(page(`<div class="login"><div class="brand big"><div class="mark">S</div><div><b>KIXO AI</b><small>CONTROL PANEL</small></div></div><h2>Admin Login</h2><form method="post"><input type="password" name="password" placeholder="Dashboard password" autofocus><button>Enter Control Panel</button></form></div>`,'KIXO AI Login')));
  app.post('/login',(req,res)=>{if(req.body.password&&req.body.password===process.env.DASHBOARD_PASSWORD){req.session.ok=true;return res.redirect('/');}res.status(401).send('Invalid password');});
  app.post('/logout',(req,res)=>req.session.destroy(()=>res.redirect('/login')));
  app.use((req,res,next)=>req.session.ok?next():res.redirect('/login'));
  app.get('/',(req,res)=>res.send(dashboardHtml(store,client.guilds.cache.get(process.env.GUILD_ID),rulesStore)));
  app.post('/settings',(req,res)=>{store.updateSettings({answerChannelId:String(req.body.answerChannelId||'').trim(),autoDiscover:req.body.autoDiscover==='on',smartFilter:req.body.smartFilter==='on',knowledgeChannelIds:String(req.body.knowledgeChannelIds||'').split(',').map(x=>x.trim()).filter(Boolean),ignoredChannelIds:String(req.body.ignoredChannelIds||'').split(',').map(x=>x.trim()).filter(Boolean),ignoredCategoryIds:String(req.body.ignoredCategoryIds||'').split(',').map(x=>x.trim()).filter(Boolean),answerMode:['hybrid','ai','search'].includes(req.body.answerMode)?req.body.answerMode:'hybrid'});res.redirect('/#knowledge');});
  app.post('/features',(req,res)=>{const f={...store.data.settings.features};for(const k of Object.keys(f))f[k]=req.body[k]==='on';store.data.settings.features=f;store.save();res.redirect('/#features');});
  const port=Number(process.env.PORT||3000);
  return app.listen(port,'0.0.0.0',()=>console.log(`KIXO AI dashboard + Windows Control API listening on :${port}`));
}

function applyPanel(panel,b){
  panel.name=String(incoming(b,'name','Name',panel.name)||panel.name).trim();
  panel.title=String(incoming(b,'title','Title',panel.title)||panel.title).trim();
  panel.bio=String(incoming(b,'bio','Bio',panel.bio)||'').trim();
  panel.bannerUrl=String(incoming(b,'bannerUrl','BannerUrl',panel.bannerUrl)||'').trim();
  panel.thumbnailUrl=String(incoming(b,'thumbnailUrl','ThumbnailUrl',panel.thumbnailUrl)||'').trim();
  const rules=incoming(b,'rules','Rules',null);
  if(rules){ panel.rules.en=normalizeRules(incoming(rules,'en','En',panel.rules.en)); panel.rules.es=normalizeRules(incoming(rules,'es','Es',panel.rules.es)); }
  panel.updatedAt=new Date().toISOString();
}

module.exports={startDashboard};
