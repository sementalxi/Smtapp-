const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ChannelSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, PermissionFlagsBits, MessageFlags } = require('discord.js');

function normPlatform(value='other') {
  const v=String(value||'other').toLowerCase();
  return ['twitch','tiktok','x','bluesky','youtube','reddit','instagram','rss','kick','podcast','facebook','other'].includes(v)?v:'other';
}
function platformLabel(p) {
  return ({twitch:'Twitch',tiktok:'TikTok',x:'X',bluesky:'Bluesky',youtube:'YouTube',reddit:'Reddit',instagram:'Instagram',rss:'RSS Feed',kick:'Kick',podcast:'Podcast',facebook:'Facebook',other:'Stream'})[normPlatform(p)];
}
function safeColor(value) {
  const s=String(value||'#FF2D8B').trim();
  return /^#[0-9A-F]{6}$/i.test(s)?s:'#FF2D8B';
}

const SOCIAL_PLATFORMS = [
  ['twitch','Twitch','🟣'],['tiktok','TikTok','🎵'],['x','X','✕'],['bluesky','Bluesky','🦋'],
  ['youtube','YouTube','▶️'],['reddit','Reddit','👽'],['instagram','Instagram','📸'],['rss','RSS Feed','📰'],
  ['kick','Kick','🟢'],['podcast','Podcast','🎙️']
];
const pendingAlertSetup = new Map();
function cleanHandle(value='') {
  return String(value||'').trim().replace(/^@/,'').replace(/^https?:\/\//i,'').replace(/\/+$/,'');
}
function profileUrl(platform, identifier='') {
  const p=normPlatform(platform), raw=String(identifier||'').trim();
  if (['rss','podcast'].includes(p)) {
    if (!/^https?:\/\//i.test(raw)) throw new Error(`${platformLabel(p)} requires a full http(s) URL.`);
    return raw;
  }
  const u=cleanHandle(raw);
  if(!u) throw new Error('Enter a username / handle.');
  const urls={
    twitch:`https://www.twitch.tv/${encodeURIComponent(u)}`,
    tiktok:`https://www.tiktok.com/@${encodeURIComponent(u)}`,
    x:`https://x.com/${encodeURIComponent(u)}`,
    bluesky:`https://bsky.app/profile/${encodeURIComponent(u)}`,
    youtube:`https://www.youtube.com/@${encodeURIComponent(u)}`,
    reddit:`https://www.reddit.com/user/${encodeURIComponent(u)}`,
    instagram:`https://www.instagram.com/${encodeURIComponent(u)}/`,
    kick:`https://kick.com/${encodeURIComponent(u)}`,
    facebook:`https://www.facebook.com/${encodeURIComponent(u)}`,
  };
  return urls[p] || raw;
}
async function twitchLookup(username) {
  const token=await getTwitchToken();
  if(!token) return null;
  const login=cleanHandle(username).toLowerCase();
  const res=await fetch(`https://api.twitch.tv/helix/users?login=${encodeURIComponent(login)}`,{headers:{'Client-ID':process.env.TWITCH_CLIENT_ID,'Authorization':`Bearer ${token}`}});
  if(!res.ok) throw new Error(`Twitch user lookup HTTP ${res.status}`);
  return (await res.json())?.data?.[0] || null;
}
async function resolveSocialProfile(platform, identifier, displayName='') {
  const p=normPlatform(platform);
  const url=profileUrl(p,identifier);
  const username=['rss','podcast'].includes(p)?'':cleanHandle(identifier);
  let name=String(displayName||'').trim() || username || platformLabel(p);
  let imageUrl=''; let verified=false;
  if(p==='twitch') {
    const user=await twitchLookup(username).catch(()=>null);
    if(user) { name=user.display_name||name; imageUrl=user.profile_image_url||''; verified=true; }
  }
  return {platform:p,username,name,url,imageUrl,verified};
}
function upsertSocialProfile(store, profile) {
  const state=streamState(store);
  const key=`${profile.platform}:${String(profile.username||profile.url||'').toLowerCase()}`;
  let player=state.players.find(p=>`${normPlatform(p.platform)}:${String(p.username||p.url||'').toLowerCase()}`===key);
  if(!player) {
    player={id:`stream_${Date.now().toString(36)}`,enabled:true,isLive:false,lastLiveId:'',createdAt:new Date().toISOString()};
    state.players.push(player);
  }
  Object.assign(player,profile,{enabled:true});
  store.save();
  return player;
}
function streamAdminPanelPayload(store) {
  const state=streamState(store), s=state.settings;
  const embed=new EmbedBuilder()
    .setColor(safeColor(s.color))
    .setTitle('📡 KIXO • SOCIAL ALERTS')
    .setDescription(`Choose a platform below, then enter the creator username / handle.\n\n**Notification channel:** ${s.channelId?`<#${s.channelId}>`:'Not configured'}\n**Saved creators:** ${state.players.length}\n**Mentions:** ${s.mentionMode==='role'?(s.mentionRoleId?`<@&${s.mentionRoleId}>`:'Role not set'):`@${s.mentionMode}`}\n\nTwitch can be verified automatically when Twitch API credentials are configured. TikTok creators are monitored directly for **new videos + LIVE status** when TikTok auto detection is enabled. Other platforms are linked from their public handle/profile URL.`)
    .setFooter({text:'KIXO • SOCIAL ALERTS'});
  const select=new StringSelectMenuBuilder().setCustomId('stream:platform').setPlaceholder('Choose a social platform').addOptions(
    SOCIAL_PLATFORMS.map(([value,label,emoji])=>new StringSelectMenuOptionBuilder().setLabel(`${emoji} ${label} Alerts`.slice(0,100)).setValue(value))
  );
  return {embeds:[embed],components:[new ActionRowBuilder().addComponents(select)]};
}
async function handleStreamAdminInteraction(interaction, store) {
  if(interaction.isStringSelectMenu() && interaction.customId==='stream:platform') {
    const platform=interaction.values[0], label=platformLabel(platform), feed=['rss','podcast'].includes(platform);
    const modal=new ModalBuilder().setCustomId(`stream:addmodal:${platform}`).setTitle(`${label} Alert`);
    const first=new TextInputBuilder().setCustomId('identifier').setLabel(feed?'Feed / podcast URL':`${label} account`).setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder(feed?'https://example.com/feed.xml':'kixopro').setMaxLength(300);
    const message=new TextInputBuilder().setCustomId('message').setLabel('Notification message').setStyle(TextInputStyle.Paragraph).setRequired(true).setPlaceholder(`Hey @everyone, **{player}** just posted / went live!`).setValue(`Hey @everyone, **{player}** just posted / went live!`).setMaxLength(1800);
    modal.addComponents(new ActionRowBuilder().addComponents(first),new ActionRowBuilder().addComponents(message));
    await interaction.showModal(modal); return true;
  }
  if(interaction.isModalSubmit() && interaction.customId.startsWith('stream:addmodal:')) {
    const platform=interaction.customId.split(':')[2];
    const identifier=interaction.fields.getTextInputValue('identifier');
    const message=interaction.fields.getTextInputValue('message');
    await interaction.deferReply({flags:MessageFlags.Ephemeral});
    try {
      const profile=await resolveSocialProfile(platform,identifier,'');
      pendingAlertSetup.set(interaction.user.id,{profile,message,createdAt:Date.now()});
      const select=new ChannelSelectMenuBuilder()
        .setCustomId('stream:alertchannel')
        .setPlaceholder('Choose the Discord alert channel')
        .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setMinValues(1).setMaxValues(1);
      const embed=new EmbedBuilder()
        .setColor('#FF2D8B')
        .setTitle(`${platformLabel(platform)} alert`)
        .setDescription(`**Account:** ${profile.name}${profile.username?`\n@${profile.username}`:''}\n\n**Message:**\n${message}\n\nNow choose the Discord channel where this alert should post.`)
        .setFooter({text:'KIXO • SOCIAL ALERTS'});
      if(profile.imageUrl) embed.setThumbnail(profile.imageUrl);
      await interaction.editReply({embeds:[embed],components:[new ActionRowBuilder().addComponents(select)]});
    } catch(e) { await interaction.editReply(`❌ Could not configure that alert: ${e.message}`); }
    return true;
  }
  if(interaction.isChannelSelectMenu() && interaction.customId==='stream:alertchannel') {
    const pending=pendingAlertSetup.get(interaction.user.id);
    if(!pending || Date.now()-pending.createdAt>10*60*1000) {
      pendingAlertSetup.delete(interaction.user.id);
      await interaction.reply({content:'This alert setup expired. Open `/stream-admin panel` and try again.',flags:MessageFlags.Ephemeral});
      return true;
    }
    const channelId=interaction.values[0];
    const player=upsertSocialProfile(store,{...pending.profile,channelId,messageTemplate:pending.message});
    pendingAlertSetup.delete(interaction.user.id);
    const verifyNote=player.platform==='twitch'?(player.verified?'✅ Twitch account verified.':'⚠️ Twitch API verification was not available; the public profile link was still saved.'):'🔗 Account linked from the username/handle.';
    const embed=new EmbedBuilder()
      .setColor('#57F287')
      .setTitle(`✅ ${platformLabel(player.platform)} Alert Saved`)
      .setDescription(`**Account:** ${player.name}${player.username?` (@${player.username})`:''}\n**Channel:** <#${channelId}>\n**Message:**\n${player.messageTemplate}\n\n${verifyNote}`)
      .setFooter({text:'KIXO • SOCIAL ALERTS'});
    if(player.imageUrl) embed.setThumbnail(player.imageUrl);
    await interaction.update({embeds:[embed],components:[]});
    return true;
  }
  return false;
}

function streamState(store) {
  if (!store.data.streaming || typeof store.data.streaming !== 'object') {
    store.data.streaming={
      settings:{
        enabled:true,
        channelId:'',
        mentionMode:'everyone',
        mentionRoleId:'',
        title:'🔴 {player} IS LIVE!',
        message:'{player} is live now on {platform}. Come support the stream! 🔥',
        footer:'KIXO • LIVE NOW',
        color:'#FF2D8B',
        autoTwitch:false,
        autoTikTok:true,
        checkMinutes:2
      },
      players:[]
    };
    store.save();
  }
  if (!store.data.streaming.settings) store.data.streaming.settings={};
  if (!Array.isArray(store.data.streaming.players)) store.data.streaming.players=[];
  if (typeof store.data.streaming.settings.autoTikTok !== 'boolean') {
    store.data.streaming.settings.autoTikTok=true;
    store.save();
  }
  return store.data.streaming;
}
function findPlayer(store, name) {
  const state=streamState(store);
  const q=String(name||'').trim().toLowerCase();
  return state.players.find(p=>String(p.name||'').toLowerCase()===q || String(p.id||'')===q) || null;
}
function render(text, player, guild) {
  const values={
    player:player.name||'Streamer',
    username:player.username||player.name||'Streamer',
    platform:platformLabel(player.platform),
    url:player.url||'',
    server:guild?.name||'KIXO',
    twitch_user:player.username||player.name||'Streamer',
    tiktok_user:player.username||player.name||'Creator',
    youtube_user:player.username||player.name||'Creator',
    instagram_user:player.username||player.name||'Creator',
    kick_user:player.username||player.name||'Streamer',
    x_user:player.username||player.name||'Creator'
  };
  return String(text||'').replace(/\{(player|username|platform|url|server|twitch_user|tiktok_user|youtube_user|instagram_user|kick_user|x_user)\}/gi,(_,k)=>values[k.toLowerCase()]||'');
}
function mentionContent(settings) {
  switch (settings.mentionMode) {
    case 'here': return '@here';
    case 'role': return settings.mentionRoleId?`<@&${settings.mentionRoleId}>`:'';
    case 'none': return '';
    case 'everyone': default: return '@everyone';
  }
}
function notificationPayload(store, player, guild, override='') {
  const state=streamState(store), s=state.settings;
  const title=render(s.title||'🔴 {player} IS LIVE!',player,guild).slice(0,256);
  const description=render(override||player.messageTemplate||s.message||'{player} is live now on {platform}.',player,guild).slice(0,4000);
  const embed=new EmbedBuilder()
    .setColor(safeColor(s.color))
    .setTitle(title)
    .setDescription(description)
    .addFields(
      {name:'Streamer',value:player.name||'Unknown',inline:true},
      {name:'Platform',value:platformLabel(player.platform),inline:true}
    )
    .setFooter({text:String(s.footer||'KIXO • LIVE NOW').slice(0,2048)})
    .setTimestamp();
  if (player.url) embed.setURL(player.url).addFields({name:'Watch Live',value:`[Open ${platformLabel(player.platform)} Stream](${player.url})`});
  if (player.imageUrl && /^https?:\/\//i.test(player.imageUrl)) embed.setThumbnail(player.imageUrl);
  const content=mentionContent(s);
  const allowedMentions={parse:[]};
  if (s.mentionMode==='everyone' || s.mentionMode==='here') allowedMentions.parse=['everyone'];
  if (s.mentionMode==='role' && s.mentionRoleId) allowedMentions.roles=[s.mentionRoleId];
  return {content:content||undefined,embeds:[embed],allowedMentions};
}
async function sendStreamNotification(guild, store, player, override='') {
  const state=streamState(store), channelId=player.channelId||state.settings.channelId;
  if (!channelId) throw new Error('No stream notification channel is configured.');
  const ch=await guild.channels.fetch(channelId).catch(()=>null);
  if (!ch?.isTextBased?.()) throw new Error('The configured stream channel is missing or is not a text channel.');
  const msg=await ch.send(notificationPayload(store,player,guild,override));
  player.lastNotifiedAt=new Date().toISOString();
  player.lastNotificationMessageId=msg.id;
  store.save();
  return msg;
}

let twitchToken={value:'',expiresAt:0};
async function getTwitchToken() {
  const id=process.env.TWITCH_CLIENT_ID, secret=process.env.TWITCH_CLIENT_SECRET;
  if (!id || !secret) return null;
  if (twitchToken.value && Date.now()<twitchToken.expiresAt-60000) return twitchToken.value;
  const url=`https://id.twitch.tv/oauth2/token?client_id=${encodeURIComponent(id)}&client_secret=${encodeURIComponent(secret)}&grant_type=client_credentials`;
  const res=await fetch(url,{method:'POST'});
  if(!res.ok) throw new Error(`Twitch token HTTP ${res.status}`);
  const data=await res.json();
  twitchToken={value:data.access_token,expiresAt:Date.now()+Number(data.expires_in||3600)*1000};
  return twitchToken.value;
}
async function checkTwitchPlayer(player) {
  const token=await getTwitchToken();
  if(!token) return null;
  const login=String(player.username||'').trim().replace(/^@/,'').toLowerCase();
  if(!login) return null;
  const res=await fetch(`https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(login)}`,{headers:{'Client-ID':process.env.TWITCH_CLIENT_ID,'Authorization':`Bearer ${token}`}});
  if(!res.ok) throw new Error(`Twitch streams HTTP ${res.status}`);
  const data=await res.json();
  return data?.data?.[0]||null;
}

function walkObjects(value, visit, seen=new Set()) {
  if (!value || typeof value!=='object' || seen.has(value)) return;
  seen.add(value);
  visit(value);
  if (Array.isArray(value)) { for (const item of value) walkObjects(item,visit,seen); return; }
  for (const child of Object.values(value)) walkObjects(child,visit,seen);
}
function parseTikTokHydration(html) {
  const scripts=[];
  for (const id of ['__UNIVERSAL_DATA_FOR_REHYDRATION__','SIGI_STATE']) {
    const re=new RegExp(`<script[^>]+id=["']${id}["'][^>]*>([\\s\\S]*?)<\\/script>`,'i');
    const m=String(html||'').match(re);
    if(m?.[1]) scripts.push(m[1]);
  }
  for (const raw of scripts) {
    try { return JSON.parse(raw); } catch {}
  }
  // Some TikTok pages put hydration JSON in a generic application/json script.
  const generic=String(html||'').match(/<script[^>]+type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/ig)||[];
  for (const tag of generic) {
    const body=(tag.match(/>([\s\S]*?)<\/script>/i)||[])[1];
    if(!body || body.length<1000) continue;
    try {
      const parsed=JSON.parse(body);
      if(JSON.stringify(parsed).includes('uniqueId')) return parsed;
    } catch {}
  }
  return null;
}
async function checkTikTokPlayer(player) {
  const username=cleanHandle(player.username||'').toLowerCase();
  if(!username) throw new Error('TikTok username is missing.');
  const url=`https://www.tiktok.com/@${encodeURIComponent(username)}`;
  const res=await fetch(url,{redirect:'follow',headers:{
    'User-Agent':process.env.TIKTOK_MONITOR_USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
    'Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language':'en-US,en;q=0.9',
    'Cache-Control':'no-cache',
    'Pragma':'no-cache'
  }});
  if(!res.ok) throw new Error(`TikTok profile HTTP ${res.status}`);
  const html=await res.text();
  if(!html || html.length<5000) throw new Error('TikTok returned an incomplete profile page.');
  const data=parseTikTokHydration(html);
  if(!data) throw new Error('TikTok profile data could not be parsed (TikTok may be blocking Railway).');
  let user=null;
  const videos=[];
  walkObjects(data,obj=>{
    const uid=String(obj.uniqueId||obj.unique_id||'').toLowerCase();
    if(!user && uid===username && (obj.secUid||obj.id||obj.nickname)) user=obj;
    const id=String(obj.id||obj.itemId||'');
    const created=Number(obj.createTime||obj.create_time||0);
    const desc=typeof obj.desc==='string'?obj.desc:'';
    let author='';
    if(typeof obj.author==='string') author=obj.author;
    else if(obj.author && typeof obj.author==='object') author=obj.author.uniqueId||obj.author.unique_id||'';
    if(/^\d{12,24}$/.test(id) && created>0 && (desc || author)) {
      if(!author || String(author).toLowerCase()===username) videos.push({id,created,desc});
    }
  });
  if(!user) throw new Error(`TikTok account @${username} was not found in the profile response.`);
  videos.sort((a,b)=>b.created-a.created);
  const latest=videos[0]||null;
  const roomId=String(user.roomId||user.room_id||'0');
  const isLive=!!(roomId && roomId!=='0');
  return {
    username,
    displayName:String(user.nickname||player.name||username),
    imageUrl:String(user.avatarLarger||user.avatarMedium||user.avatarThumb||''),
    latestVideoId:latest?.id||'',
    latestVideoUrl:latest?.id?`https://www.tiktok.com/@${encodeURIComponent(username)}/video/${latest.id}`:'',
    latestVideoDesc:latest?.desc||'',
    latestVideoCreatedAt:latest?.created?new Date(latest.created*1000).toISOString():'',
    isLive,
    liveRoomId:isLive?roomId:'',
    liveUrl:`https://www.tiktok.com/@${encodeURIComponent(username)}/live`
  };
}
async function checkTikTokCreators(guild, store, state) {
  const s=state.settings;
  if(!s.enabled || !s.autoTikTok) return;
  for(const player of state.players.filter(p=>p.enabled!==false && p.platform==='tiktok' && p.username)) {
    try {
      const info=await checkTikTokPlayer(player);
      player.lastTikTokCheckAt=new Date().toISOString();
      player.lastTikTokError='';
      if(info.displayName) player.name=info.displayName;
      if(info.imageUrl) player.imageUrl=info.imageUrl;
      // First successful scan becomes the baseline so an old video is not announced as new.
      if(info.latestVideoId) {
        if(player.lastTikTokVideoId && player.lastTikTokVideoId!==info.latestVideoId) {
          const eventPlayer={...player,url:info.latestVideoUrl||player.url};
          const desc=info.latestVideoDesc?`\n\n**${info.latestVideoDesc.slice(0,500)}**`:'';
          await sendStreamNotification(guild,store,eventPlayer,`🎵 **{player} just posted a new TikTok!**${desc}\n\n{url}`);
          player.lastTikTokVideoNotifiedAt=new Date().toISOString();
        }
        player.lastTikTokVideoId=info.latestVideoId;
        player.lastTikTokVideoUrl=info.latestVideoUrl;
        player.lastTikTokVideoCreatedAt=info.latestVideoCreatedAt;
      }
      if(info.isLive) {
        if(player.lastTikTokLiveRoomId!==info.liveRoomId || !player.isTikTokLive) {
          const eventPlayer={...player,url:info.liveUrl};
          await sendStreamNotification(guild,store,eventPlayer,'🔴 **{player} is LIVE on TikTok!**\n\nWatch now: {url}');
          player.lastTikTokLiveNotifiedAt=new Date().toISOString();
        }
        player.isTikTokLive=true;
        player.lastTikTokLiveRoomId=info.liveRoomId;
      } else {
        player.isTikTokLive=false;
        player.lastTikTokLiveRoomId='';
      }
      store.save();
    } catch(err) {
      player.lastTikTokCheckAt=new Date().toISOString();
      player.lastTikTokError=String(err?.message||err).slice(0,500);
      store.save();
      console.error(`TikTok monitor (${player.name||player.username}):`,err.message);
    }
  }
}
async function runStreamCheck(client, store) {
  const state=streamState(store), s=state.settings;
  if(!s.enabled) return;
  const guild=await client.guilds.fetch(process.env.GUILD_ID).catch(()=>null);
  if(!guild) return;
  if(s.autoTwitch && process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET) {
    for(const player of state.players.filter(p=>p.enabled!==false && p.platform==='twitch' && p.username)) {
      try {
        const live=await checkTwitchPlayer(player);
        const liveId=live?.id||'';
        if(live && player.lastLiveId!==liveId) {
          player.lastLiveId=liveId;
          player.isLive=true;
          player.lastLiveAt=new Date().toISOString();
          if(!player.url) player.url=`https://twitch.tv/${player.username}`;
          await sendStreamNotification(guild,store,player,live.title?`**${live.title}**\n\n${render(s.message,player,guild)}`:s.message);
        } else if(!live) {
          player.isLive=false;
          player.lastLiveId='';
        }
        store.save();
      } catch(err) { console.error(`Twitch monitor (${player.name}):`,err.message); }
    }
  }
  await checkTikTokCreators(guild,store,state);
}
function startStreamMonitor(client, store) {
  const state=streamState(store);
  const mins=Math.max(1,Math.min(30,Number(state.settings.checkMinutes||2)));
  setTimeout(()=>runStreamCheck(client,store).catch(e=>console.error('Stream check:',e.message)),15000).unref();
  setInterval(()=>runStreamCheck(client,store).catch(e=>console.error('Stream check:',e.message)),mins*60000).unref();
}
function streamStatusText(store) {
  const state=streamState(store), s=state.settings;
  const mention=s.mentionMode==='role'?(s.mentionRoleId?`<@&${s.mentionRoleId}>`:'Role not selected'):`@${s.mentionMode}`;
  return `**Streaming notifications:** ${s.enabled!==false?'ON':'OFF'}\n**Notification channel:** ${s.channelId?`<#${s.channelId}>`:'Not configured'}\n**Mention:** ${mention}\n**Saved players:** ${state.players.length}\n**Automatic Twitch detection:** ${s.autoTwitch?'ON':'OFF'}\n**Twitch API:** ${process.env.TWITCH_CLIENT_ID&&process.env.TWITCH_CLIENT_SECRET?'Configured':'Not configured'}\n**Automatic TikTok post/LIVE detection:** ${s.autoTikTok?'ON':'OFF'}\n**TikTok monitor:** Direct profile monitoring (no API key)\n**Check interval:** ${s.checkMinutes||2} minute(s)\n\n**Title:** ${s.title}\n**Message:** ${s.message}\n**Footer:** ${s.footer}\n**Color:** ${s.color}`;
}
module.exports={streamState,findPlayer,sendStreamNotification,startStreamMonitor,streamStatusText,platformLabel,profileUrl,resolveSocialProfile,upsertSocialProfile,streamAdminPanelPayload,handleStreamAdminInteraction,checkTikTokPlayer};
