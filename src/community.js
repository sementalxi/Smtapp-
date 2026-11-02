'use strict';
const crypto=require('crypto');
const fs=require('fs');
const path=require('path');
const { DATA_DIR }=require('./store');
const {renderWelcomeBanner}=require('./welcome-banner');
const {EmbedBuilder,AttachmentBuilder,PermissionFlagsBits}=require('discord.js');
const {future,nextRecurring,TIME_ZONES}=require('./schedule');
const PREFIX='!';
const makeId=p=>p+'_'+crypto.randomBytes(7).toString('hex');
const state=store=>{
  for(const k of ['reactionPanels','globalCommands','reminders'])if(!Array.isArray(store.data[k]))store.data[k]=[];
  return store.data;
};
function url(raw){
  const v=String(raw||'').trim();
  if(!v)return '';
  if(v.length>1000||!/^https:\/\/[^ ]+$/i.test(v))throw Error('Picture must be a valid HTTPS image URL.');
  return v;
}
function expand(template,member){
  const guild=member.guild,user=member.user||member;
  return String(template||'').replace(/\{user\}/gi,user.username||'Member').replace(/\{server\}/gi,guild.name||'KIXO')
    .replace(/\{(?:count|server\.member_count|server\.memberCount)\}/gi,String(guild.memberCount||0)).slice(0,3800);
}
function notificationSettings(store){
  const s=store.data.settings;
  return {
    welcomeEnabled:s.welcomeEnabled!==false,
    welcomeChannelId:s.welcomeChannelId||'',welcomeRoleId:s.welcomeRoleId||'',
    welcomeCaption:s.welcomeCaption||'Hey {user}, welcome to KIXO | GFX STUDIO "KIXO" 🏆!',
    welcomeTitle:s.welcomeTitle||'Welcome to KIXO, {user}!',
    welcomeText:s.welcomeText||'Welcome to the community. Read the rules and verify to get started.',
    welcomeImageUrl:s.welcomeImageUrl||'',welcomeImageFile:s.welcomeImageFile||'',
    goodbyeEnabled:s.goodbyeEnabled===true,goodbyeChannelId:s.goodbyeChannelId||'',
    goodbyeTitle:s.goodbyeTitle||'Goodbye, {user}',
    goodbyeText:s.goodbyeText||'{user} has left {server}.',
    goodbyeImageUrl:s.goodbyeImageUrl||'',goodbyeImageFile:s.goodbyeImageFile||''
  };
}
// Diagnose the exact Discord permission(s) required by greeting messages.
// An uploaded photo requires Attach Files in addition to ordinary embed permissions.
async function checkGreetingDelivery(guild,store,kind='welcome'){
 if(kind!=='welcome'&&kind!=='goodbye')throw Error('Invalid greeting type.');
 const cfg=notificationSettings(store),settings=store.data.settings;
 const enabled=kind==='welcome'
   ?cfg.welcomeEnabled&&settings.features?.welcomes!==false
   :cfg.goodbyeEnabled;
 const channelId=kind==='welcome'?cfg.welcomeChannelId:cfg.goodbyeChannelId;
 const label=kind==='welcome'?'Welcome':'Goodbye';
 if(!enabled)return {ok:false,enabled:false,channelId,message:label+' messages are disabled. Turn on Enable '+(kind==='welcome'?'welcomes':'goodbye messages')+' and save the settings.'};
 if(!channelId)return {ok:false,enabled:true,channelId:'',message:'Select and save a '+kind+' channel before testing.'};
 const channel=await guild.channels.fetch(channelId).catch(()=>null);
 if(!channel||channel.guildId!==guild.id||typeof channel.send!=='function')
   return {ok:false,enabled:true,channelId,message:'The selected '+kind+' channel cannot be found or is not a text channel.'};
 const me=guild.members.me||await guild.members.fetchMe().catch(()=>null);
 if(!me||typeof channel.permissionsFor!=='function')
   return {ok:false,enabled:true,channelId,message:'Unable to inspect the bot permissions for this Discord channel.'};
 const perms=channel.permissionsFor(me);
 const needed=[
  ['View Channel',PermissionFlagsBits.ViewChannel],
  ['Send Messages',PermissionFlagsBits.SendMessages],
  ...(kind==='welcome'
    ?[['Attach Files',PermissionFlagsBits.AttachFiles]]
    :[['Embed Links',PermissionFlagsBits.EmbedLinks]])
 ];
 const missing=needed.filter(([name,bit])=>!perms?.has(bit)).map(([name])=>name);
 if(missing.length)return {
  ok:false,enabled:true,channelId,missingPermissions:missing,
  message:'Missing Discord permissions in #'+channel.name+': '+missing.join(', ')+'. Allow these permissions for the KIXO bot role in Channel Settings → Permissions.'
 };
 return {ok:true,enabled:true,channelId,message:'Bot has the required permissions in #'+channel.name+'.'};
}
async function testGreeting(client,store,kind='welcome'){
 const guild=await client.guilds.fetch(process.env.GUILD_ID);
 const status=await checkGreetingDelivery(guild,store,kind);
 if(!status.ok)throw Error(status.message);
 const mockMember={guild,user:{
  id:client.user.id,username:'New Member',bot:false,
  displayAvatarURL:()=>client.user.displayAvatarURL?.({size:128})||''
 }};
 await sendMemberNotification(mockMember,store,kind,{test:true});
 return {ok:true,channelId:status.channelId,message:'Test '+kind+' message sent to Discord successfully.'};
}

async function sendMemberNotification(member,store,kind='welcome',options={}){
  if(!member?.guild||!member.user?.id||(member.user.bot&&!options.test))return false;
  const cfg=notificationSettings(store);
  const diagnosis=await checkGreetingDelivery(member.guild,store,kind);
  if(!diagnosis.ok){
    if(!diagnosis.enabled&&!options.test)return false;
    throw Error(diagnosis.message);
  }
  const ch=await member.guild.channels.fetch(diagnosis.channelId);
  if(kind==='welcome'){
    const username=member.displayName||member.user.globalName||member.user.username||'Member';
    const mention=options.test?'@New Member':'<@'+member.user.id+'>';
    const caption=String(cfg.welcomeCaption||'Hey {user}, welcome to KIXO | GFX STUDIO "KIXO" 🏆!')
      .replace(/\{(?:user|mention)\}/gi,mention)
      .replace(/\{username\}/gi,username)
      .replace(/\{server\}/gi,member.guild.name||'KIXO | GFX STUDIO')
      .replace(/\{(?:count|server\.member_count|server\.memberCount)\}/gi,String(member.guild.memberCount||0))
      .slice(0,1900);
    const picture=greetingAttachment(cfg.welcomeImageFile,'welcome');
    const background=picture?path.join(DATA_DIR,cfg.welcomeImageFile):'';
    const png=await renderWelcomeBanner(member,background);
    const content=(options.test?'🧪 TEST • ':'')+caption;
    try{
      await ch.send({content,files:[new AttachmentBuilder(png,{name:'kixo-welcome.png'})],
        allowedMentions:{parse:[],users:options.test?[]:[member.user.id]}});
    }catch(err){
      if(err.code===50013||err.code===50001)
        throw Error('Discord blocked the welcome banner in #'+ch.name+
          '. Allow View Channel, Send Messages and Attach Files for KIXO BOT. '+err.message);
      throw err;
    }
    return true;
  }
  const title=expand(kind==='welcome'?cfg.welcomeTitle:cfg.goodbyeTitle,member);
  const description=expand(kind==='welcome'?cfg.welcomeText:cfg.goodbyeText,member);
  const embed=new EmbedBuilder().setColor(kind==='welcome'?'#FF2D8B':'#3c4555')
    .setTitle((options.test?'🧪 TEST • ':'')+(kind==='welcome'?'👋 ':'🚪 ')+title.slice(0,options.test?226:245))
    .setDescription(description||' ')
    .setFooter({text:'KIXO | GFX STUDIO • COMMUNITY'}).setTimestamp();
  if(kind==='welcome'&&typeof member.user.displayAvatarURL==='function')embed.setThumbnail(member.user.displayAvatarURL());
  const privatePicture=greetingAttachment(kind==='welcome'?cfg.welcomeImageFile:cfg.goodbyeImageFile,kind);
  const files=[];
  if(privatePicture){
    embed.setImage('attachment://'+privatePicture.name);
    files.push(privatePicture.file);
  }else{
    const picture=kind==='welcome'?cfg.welcomeImageUrl:cfg.goodbyeImageUrl;
    if(picture)embed.setImage(url(picture));
  }
  try{await ch.send({embeds:[embed],files,allowedMentions:{parse:[]}});}
  catch(err){
    if(err.code===50013||err.code===50001)
      throw Error('Discord blocked the '+kind+' message in #'+ch.name+' (Missing Permissions). Ensure View Channel, Send Messages, Embed Links and'+(files.length?' Attach Files':'')+' are allowed for the bot. Original error: '+err.message);
    throw err;
  }
  return true;
}

const GREETING_ASSET_DIR=path.join(DATA_DIR,'greeting-images');
const GREETING_MAX_BYTES=4*1024*1024;
const IMAGE_PATTERN=/^greeting-images\/(welcome|goodbye)-[a-f0-9]{20}\.(png|jpg|webp|gif)$/;
function parseGreetingPicture(input){
  if(typeof input!=='string'||input.length>6*1024*1024)throw Error('La foto debe pesar menos de 4 MB.');
  const match=/^data:image\/(png|jpeg|jpg|webp|gif);base64,([A-Za-z0-9+/=]+)$/.exec(input);
  if(!match)throw Error('Sube una foto PNG, JPG, WEBP o GIF.');
  const b=Buffer.from(match[2],'base64');
  if(!b.length||b.length>GREETING_MAX_BYTES)throw Error('La foto debe pesar menos de 4 MB.');
  const kind=match[1]==='jpeg'?'jpg':match[1];
  const valid=kind==='png'?b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):
    kind==='jpg'?b[0]===0xff&&b[1]===0xd8&&b[2]===0xff:
    kind==='gif'?['GIF87a','GIF89a'].includes(b.toString('ascii',0,6)):
    b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP';
  if(!valid)throw Error('El contenido no es una foto válida para el formato seleccionado.');
  return {buffer:b,ext:kind};
}
function greetingAttachment(relative,kind){
  if(!relative||!IMAGE_PATTERN.test(relative)||!relative.startsWith('greeting-images/'+kind+'-'))return null;
  const full=path.join(DATA_DIR,relative);
  if(!fs.existsSync(full))return null;
  const name=kind+'-image'+path.extname(relative);
  return {file:new AttachmentBuilder(full,{name}),name};
}
function prepareGreetingImages(store,payload){
  const patch={...payload},created=[],oldFiles=[];
  // File references must only ever come from the server-side uploader.
  delete patch.welcomeImageFile;delete patch.goodbyeImageFile;
  try{
    for(const kind of ['welcome','goodbye']){
      const dataKey=kind+'ImageData',removeKey=kind+'RemoveImage',fileKey=kind+'ImageFile',urlKey=kind+'ImageUrl';
      const hasImage=Object.prototype.hasOwnProperty.call(patch,dataKey)&&Boolean(patch[dataKey]);
      const remove=patch[removeKey]===true;
      delete patch[dataKey];delete patch[removeKey];
      if(hasImage){
        const picture=parseGreetingPicture(payload[dataKey]);
        fs.mkdirSync(GREETING_ASSET_DIR,{recursive:true});
        const relative='greeting-images/'+kind+'-'+crypto.randomBytes(10).toString('hex')+'.'+picture.ext;
        const full=path.join(DATA_DIR,relative);
        fs.writeFileSync(full,picture.buffer,{flag:'wx',mode:0o600});
        created.push(full);
        patch[fileKey]=relative;
        patch[urlKey]='';
      }else if(remove){
        patch[fileKey]='';
      }else if(Object.prototype.hasOwnProperty.call(patch,urlKey)&&patch[urlKey]!==store.data.settings[urlKey]){
        // Switching back to an external URL disables the private uploaded asset.
        if(patch[urlKey])patch[fileKey]='';
      }
      if(Object.prototype.hasOwnProperty.call(patch,fileKey)){
        const old=store.data.settings[fileKey];
        if(old&&IMAGE_PATTERN.test(old))oldFiles.push(path.join(DATA_DIR,old));
      }
    }
  }catch(err){
    for(const file of created)try{fs.unlinkSync(file)}catch{}
    throw err;
  }
  return {
    patch,
    rollback(){for(const file of created)try{fs.unlinkSync(file)}catch{}},
    complete(){for(const file of oldFiles)if(!created.includes(file))try{fs.unlinkSync(file)}catch(e){console.warn('Greeting photo cleanup:',e.message)}}
  };
}

function validEmoji(value){
  const e=String(value||'').trim();
  if(!e||e.length>25||/[\n\r<>]/.test(e)||/^[A-Za-z0-9]+$/.test(e))throw Error('Use a standard Unicode emoji, such as 🎮 or 🏆.');
  return e;
}
function normalizeOptions(options,client,channel){
  if(!Array.isArray(options)||options.length<1||options.length>6)throw Error('Choose 1 to 6 emoji and role pairs.');
  const seen=new Set(),roleIDs=new Set(),me=channel.guild.members.me;
  return options.map(o=>{
    const emoji=validEmoji(o.emoji);
    const roleId=String(o.roleId||'');
    const role=channel.guild.roles.cache.get(roleId);
    if(!role)throw Error('The selected Discord role could not be found.');
    if(role.managed||role.permissions.has(PermissionFlagsBits.Administrator))throw Error('Managed or Administrator roles cannot be assigned through reactions.');
    if(!me||!me.permissions.has(PermissionFlagsBits.ManageRoles)||me.roles.highest.comparePositionTo(role)<=0)throw Error('Move the bot role above '+role.name+' and grant Manage Roles.');
    if(seen.has(emoji)||roleIDs.has(roleId))throw Error('Each emoji and role may only be used once per panel.');
    seen.add(emoji);roleIDs.add(roleId);
    return {emoji,roleId};
  });
}
function panelEmbed(p){
  return new EmbedBuilder().setColor('#FF2D8B').setTitle('🎭 '+String(p.title).slice(0,245))
    .setDescription((p.description||'React below to add a role. Remove your reaction to remove the role.').slice(0,3000)+'\n\n'+
      p.options.map(x=>x.emoji+'  <@&'+x.roleId+'>').join('\n'))
    .setFooter({text:'KIXO | GFX STUDIO • ROLE SELECTION'});
}
async function channelFor(client,id){
  const ch=await client.channels.fetch(String(id||'')).catch(()=>null);
  if(!ch||!ch.guild||ch.guild.id!==process.env.GUILD_ID||typeof ch.send!=='function')throw Error('Choose an existing text channel in your Discord server.');
  return ch;
}
async function upsertReactionPanel(client,store,p={}){
  state(store);
  const existing=p.id?store.data.reactionPanels.find(x=>x.id===p.id):null;
  if(p.id&&!existing)throw Error('Reaction role panel not found.');
  const title=String(p.title||'').trim(),description=String(p.description||'').trim();
  if(!title||title.length>240||description.length>3000)throw Error('Use a title (max 240) and description (max 3000).');
  const ch=await channelFor(client,existing?.channelId||p.channelId);
  const options=normalizeOptions(p.options,client,ch);
  const entry={id:existing?.id||makeId('roles'),channelId:ch.id,title,description,options,
    messageId:existing?.messageId||'',createdAt:existing?.createdAt||new Date().toISOString()};
  if(existing){
    const message=await ch.messages.fetch(existing.messageId).catch(()=>null);
    if(!message)throw Error('Original Discord roles panel missing. No changes saved.');
    await message.edit({embeds:[panelEmbed(entry)],allowedMentions:{parse:[]}});
    // Keep existing role reactions when possible. Drop removed emojis only.
    for(const old of existing.options||[]){
      if(!options.some(o=>o.emoji===old.emoji)){
        const reaction=message.reactions.cache.find(r=>r.emoji.name===old.emoji);
        if(reaction)await reaction.remove().catch(()=>{});
      }
    }
    for(const o of options){
      if(!(existing.options||[]).some(x=>x.emoji===o.emoji))await message.react(o.emoji);
    }
    Object.assign(existing,entry);
  }else{
    const message=await ch.send({embeds:[panelEmbed(entry)],allowedMentions:{parse:[]}});
    try{for(const o of options)await message.react(o.emoji)}
    catch(err){await message.delete().catch(()=>{});throw Error('Could not add emoji reactions: '+err.message)}
    entry.messageId=message.id;store.data.reactionPanels.unshift(entry);
  }
  store.save();
  return {ok:true,id:entry.id,messageId:entry.messageId};
}
async function deleteReactionPanel(client,store,id){
  state(store);
  const i=store.data.reactionPanels.findIndex(x=>x.id===id);
  if(i<0)throw Error('Panel not found.');
  const p=store.data.reactionPanels[i],ch=await channelFor(client,p.channelId);
  const message=await ch.messages.fetch(p.messageId).catch(()=>null);
  if(message)await message.delete();
  store.data.reactionPanels.splice(i,1);store.save();
  return {ok:true};
}
async function handleReaction(reaction,user,store,adding){
  if(user.bot)return false;
  if(reaction.partial)await reaction.fetch().catch(()=>null);
  const message=reaction.message;
  if(message.partial)await message.fetch().catch(()=>null);
  if(!message.guild||message.guild.id!==process.env.GUILD_ID)return false;
  const p=state(store).reactionPanels.find(x=>x.messageId===message.id&&x.channelId===message.channelId);
  if(!p)return false;
  const pair=p.options.find(x=>x.emoji===reaction.emoji.name);
  if(!pair)return false;
  const role=await message.guild.roles.fetch(pair.roleId).catch(()=>null);
  const member=await message.guild.members.fetch(user.id).catch(()=>null);
  if(!role||!member)return true;
  if(adding)await member.roles.add(role,'KIXO reaction role');
  else await member.roles.remove(role,'KIXO reaction removed');
  return true;
}
function normalizeCommand(payload,existing){
  const trigger=String(payload.trigger||'').trim().toLowerCase().replace(/^!/,'');
  if(!/^[a-z0-9_-]{2,32}$/.test(trigger))throw Error('Trigger must be 2–32 letters, numbers, underscores or dashes.');
  const response=String(payload.response||'').trim();
  if(!response||response.length>1900)throw Error('Command response is required (max 1900 characters).');
  return {id:existing?.id||makeId('cmd'),trigger,response,enabled:payload.enabled!==false,
    staffOnly:payload.staffOnly===true,channelId:String(payload.channelId||''),createdAt:existing?.createdAt||new Date().toISOString()};
}
function upsertCommand(store,payload){
  const list=state(store).globalCommands,old=payload.id?list.find(x=>x.id===payload.id):null;
  if(payload.id&&!old)throw Error('Command not found.');
  if(!old&&list.length>=50)throw Error('Maximum 50 custom commands.');
  const row=normalizeCommand(payload,old);
  if(list.some(x=>x.id!==row.id&&x.trigger===row.trigger))throw Error('Another custom command already uses that trigger.');
  if(old)Object.assign(old,row);else list.push(row);
  store.save();return {ok:true,id:row.id};
}
function deleteCommand(store,id){const list=state(store).globalCommands;const i=list.findIndex(x=>x.id===id);if(i<0)throw Error('Command not found.');list.splice(i,1);store.save();return {ok:true};}
const commandCooldown=new Map();
async function handleCustomCommand(message,store,isStaff){
  const content=String(message.content||'').trim();
  const prefix=String(store.data.settings.generalCommandPrefix||PREFIX);
  if(!content.startsWith(prefix))return false;
  const token=content.slice(prefix.length).split(/\s/)[0].toLowerCase();
  const c=state(store).globalCommands.find(x=>x.trigger===token&&x.enabled!==false);
  if(!c||c.channelId&&c.channelId!==message.channel.id||c.staffOnly&&!isStaff(message))return false;
  const key=message.author.id+':'+c.id,now=Date.now();
  if(now-(commandCooldown.get(key)||0)<15000)return true;
  commandCooldown.set(key,now);
  if(commandCooldown.size>10000)commandCooldown.clear();
  const output=c.response.replace(/\{user\}/gi,message.author.username)
    .replace(/\{server\}/gi,message.guild.name)
    .replace(/\{channel\}/gi,message.channel.name).slice(0,1900);
  // Send a standalone bot message instead of a reply with the user's command above it.
  // Only delete the invocation after successfully publishing the response.
  await message.channel.send({content:output,allowedMentions:{parse:[]}});
  if(typeof message.delete==='function'){
    try{await message.delete();}
    catch(err){console.warn('Custom command could not delete invocation (grant Manage Messages):',err.message||err);}
  }
  return true;
}
function normalizeReminder(payload,old){
  const title=String(payload.title||'').trim(),message=String(payload.message||'').trim();
  if(!title||title.length>100||!message||message.length>1800)throw Error('Reminder needs a title (up to 100) and message (up to 1800).');
  const frequency=String(payload.frequency||'once');
  if(!['once','daily','weekly'].includes(frequency))throw Error('Invalid reminder frequency.');
  const timeZone=String(payload.timeZone||'America/Mexico_City');
  if(!TIME_ZONES.includes(timeZone))throw Error('Invalid time zone.');
  const localDateTime=String(payload.localDateTime||'');
  const nextRunAt=future(localDateTime,timeZone);
  const channelId=String(payload.channelId||'');
  if(!/^\d{16,22}$/.test(channelId))throw Error('Select a Discord text channel.');
  return {id:old?.id||makeId('rem'),title,message,channelId,frequency,timeZone,localDateTime,
    nextRunAt,enabled:payload.enabled!==false,lastSentAt:old?.lastSentAt||null,createdAt:old?.createdAt||new Date().toISOString()};
}
function upsertReminder(store,payload){
  const list=state(store).reminders,old=payload.id?list.find(x=>x.id===payload.id):null;
  if(payload.id&&!old)throw Error('Reminder not found.');
  if(!old&&list.length>=60)throw Error('Maximum 60 reminders.');
  const row=normalizeReminder(payload,old);
  if(old)Object.assign(old,row);else list.push(row);
  store.save();return {ok:true,id:row.id,nextRunAt:row.nextRunAt};
}
function deleteReminder(store,id){const list=state(store).reminders;const i=list.findIndex(x=>x.id===id);if(i<0)throw Error('Reminder not found.');list.splice(i,1);store.save();return {ok:true};}
const running=new Set();
async function sweepReminders(client,store,now=Date.now()){
  let sent=0;
  for(const r of state(store).reminders.filter(x=>x.enabled!==false&&x.nextRunAt&&Date.parse(x.nextRunAt)<=now).slice(0,20)){
    if(running.has(r.id)||r.retryAt&&Date.parse(r.retryAt)>now)continue;
    running.add(r.id);
    try{
      const ch=await channelFor(client,r.channelId);
      await ch.send({content:r.message,allowedMentions:{parse:[]}});
      r.lastSentAt=new Date().toISOString();r.lastError='';
      delete r.retryAt;
      if(r.frequency==='once')r.enabled=false;
      else{
        let next=r.nextRunAt;
        for(let i=0;i<400&&Date.parse(next)<=now;i++)next=nextRecurring(r,next);
        r.nextRunAt=next;
        r.localDateTime=new Intl.DateTimeFormat('sv-SE',{timeZone:r.timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(next)).replace(' ','T');
      }
      store.save();sent++;
    }catch(err){r.lastError=String(err.message||err).slice(0,250);r.retryAt=new Date(now+300000).toISOString();store.save();console.error('Reminder send failed:',r.title,err)}
    finally{running.delete(r.id)}
  }
  return {sent};
}
module.exports={state,url,notificationSettings,prepareGreetingImages,sendMemberNotification,checkGreetingDelivery,testGreeting,upsertReactionPanel,deleteReactionPanel,handleReaction,
 upsertCommand,deleteCommand,handleCustomCommand,upsertReminder,deleteReminder,sweepReminders,TIME_ZONES};
