'use strict';

const crypto = require('crypto');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder, MessageFlags } = require('discord.js');

const { future } = require('./schedule');
const media=require('./admin-media');
const PREFIX = 'smtgive:join:';
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function all(store) {
  if (!Array.isArray(store.data.giveaways)) store.data.giveaways = [];
  return store.data.giveaways;
}
function participantCount(entry) {
  // Count Discord IDs rather than button clicks, including for older giveaways.
  return new Set((entry.participants||[]).map(p=>String(p?.id||'')).filter(Boolean)).size;
}
function demoCount(entry) {
  // Private sample names are not public registrations or eligible entries for prizes.
  return Array.isArray(entry.demoNames) ? entry.demoNames.length : 0;
}
function participationRow(id, disabled = false, realCount = 0) {
  // Public counts must represent real people who entered the giveaway.
  const count=Math.max(0,Number(realCount)||0);
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(PREFIX + id)
      .setEmoji('🎉')
      .setLabel((disabled ? 'Closed • ' : 'Participate • ')+count+' joined')
      .setStyle(ButtonStyle.Success)
      .setDisabled(disabled)
  );
}
const SAMPLE_FIELDS=new Set(['Entry count','About this participation total']);
function removeSampleNotice(message){
  const original=message.embeds?.[0];
  if(!original)return null;
  const fields=original.fields||original.data?.fields||[];
  if(!fields.some(f=>SAMPLE_FIELDS.has(f.name)))return null;
  const embed=EmbedBuilder.from(original);
  embed.setFields(...fields.filter(f=>!SAMPLE_FIELDS.has(f.name)));
  return embed;
}
// Serialize edits of the same giveaway button to prevent stale participant
// counts when multiple users join at once.
const buttonUpdates=new Map();
function updateParticipationCount(message,entry){
  const prior=buttonUpdates.get(entry.id)||Promise.resolve();
  const task=prior.catch(()=>{}).then(async()=>{
    if(!message||typeof message.edit!=='function')return false;
    const payload={components:[participationRow(entry.id,entry.status!=='open',participantCount(entry))]};
    const embed=removeSampleNotice(message);
    if(embed)payload.embeds=[embed];
    await message.edit(payload);
    return true;
  }).catch(err=>{
    console.warn('Giveaway participant counter could not sync:',err.message||err);
    return false;
  });
  buttonUpdates.set(entry.id,task);
  void task.finally(()=>{if(buttonUpdates.get(entry.id)===task)buttonUpdates.delete(entry.id)});
  return task;
}
async function refreshPublishedGiveawayCounts(client,store,max=40){
  let updated=0,skipped=0;
  for(const entry of all(store).slice(0,max)){
    try{
      const channel=await client.channels.fetch(entry.channelId).catch(()=>null);
      const message=await channel?.messages?.fetch(entry.messageId).catch(()=>null);
      if(!message){skipped++;continue}
      if(await updateParticipationCount(message,entry))updated++;
      else skipped++;
    }catch(e){skipped++;console.warn('Giveaway button recovery:',e.message||e)}
  }
  return {updated,skipped};
}
function asImage(raw) {
  if (!raw) return null;
  if (typeof raw !== 'string' || raw.length > 7_200_000) throw Error('Picture must be 5 MB or smaller.');
  const match = /^data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/=]+)$/.exec(raw);
  if (!match) throw Error('Upload a PNG, JPG, WEBP or GIF picture.');
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) throw Error('Picture must be 5 MB or smaller.');
  const kind = match[1];
  const valid = kind === 'png' ? buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
    : kind === 'jpeg' ? buffer[0]===0xff && buffer[1]===0xd8 && buffer[2]===0xff
    : kind === 'gif' ? ['GIF87a','GIF89a'].includes(buffer.toString('ascii',0,6))
    : buffer.toString('ascii',0,4)==='RIFF' && buffer.toString('ascii',8,12)==='WEBP';
  if (!valid) throw Error('Picture content does not match its image format.');
  return { buffer, name: 'giveaway.'+(kind==='jpeg'?'jpg':kind) };
}
async function publishGiveaway(client, store, p = {}) {
  const title=String(p.title||'').trim();
  const description=String(p.description||'').trim();
  if (!title || title.length>250) throw Error('Giveaway title is required (up to 250 characters).');
  if (!description || description.length>3500) throw Error('Giveaway text is required (up to 3500 characters).');
  const channelId=String(p.channelId||'');
  if (!/^\d{16,22}$/.test(channelId)) throw Error('Select a valid Discord channel.');
  const ch=await client.channels.fetch(channelId).catch(()=>null);
  if (!ch || ch.guildId !== process.env.GUILD_ID || typeof ch.send !== 'function') throw Error('Choose a text channel in your KIXO Discord server.');
  const timeZone=String(p.timeZone||'America/Mexico_City');
  const endLocal=String(p.endLocal||'');
  const endsAt=future(endLocal,timeZone);
  const images=media.prepare({},p,['image']);
  const id='ga_'+crypto.randomBytes(8).toString('hex');
  const embed=new EmbedBuilder()
    .setColor('#FF2D8B')
    .setTitle('🎁 '+title)
    .setDescription(description)
    .addFields({name:'How to enter',value:'Press **🎉 Participate** below. One entry per Discord member.'})
    .addFields({name:'Entries close',value:'<t:'+Math.floor(Date.parse(endsAt)/1000)+':F> • <t:'+Math.floor(Date.parse(endsAt)/1000)+':R>'})
    .setFooter({text:'KIXO | GFX STUDIO • OFFICIAL GIVEAWAY'})
    .setTimestamp();
  const files=[];
  media.attach(embed,images.patch.imageFile,'image',files);
  let message;
  try{message=await ch.send({embeds:[embed],components:[participationRow(id,false,0)],files,allowedMentions:{parse:[]}})}
  catch(err){images.rollback();throw err}
  const entry={
    id, title, description, channelId, messageId:message.id,
    imageUrl:message.attachments?.first()?.url||'',imageFile:images.patch.imageFile||'',
    status:'open', endsAt, endLocal, timeZone, createdAt:new Date().toISOString(), closedAt:null,
    participants:[]
  };
  all(store).unshift(entry);
  store.save();
  return {ok:true,id,messageId:message.id,url:'https://discord.com/channels/'+process.env.GUILD_ID+'/'+channelId+'/'+message.id};
}
// Admin sample names are separate from real entrants.
// Both public counts and winner drawing use only actual participants.
async function setAdminSampleNames(client, store, p={}) {
  const entry=all(store).find(g=>g.id===String(p.id||''));
  if(!entry)throw Error('Giveaway not found.');
  if(!Array.isArray(p.names))throw Error('Provide a list of sample names.');
  if(p.names.length>50)throw Error('Maximum 50 private sample names.');
  const names=[], seen=new Set();
  for(const raw of p.names){
    if(typeof raw!=='string')throw Error('Sample names must be text.');
    const name=raw.trim();
    if(!name)continue;
    if(name.length>60)throw Error('Each sample name must be 60 characters or fewer.');
    const key=name.toLocaleLowerCase();
    if(seen.has(key))continue;
    seen.add(key);names.push(name);
  }
  const before=entry.demoNames;
  entry.demoNames=names;
  try{store.save()}catch(err){if(before===undefined)delete entry.demoNames;else entry.demoNames=before;throw err}
  // Refresh the existing published post; do not alter the participant roster or winners.
  const channel=await client.channels.fetch(entry.channelId).catch(()=>null);
  const message=await channel?.messages?.fetch(entry.messageId).catch(()=>null);
  const discordUpdated=message ? await updateParticipationCount(message,entry) : false;
  return {
    ok:true, previewCount:names.length,realCount:participantCount(entry),
    publicCount:participantCount(entry),discordUpdated,
    warning:discordUpdated?'':'Sample names saved, but Discord counter could not be refreshed. Check the original post and bot permissions.'
  };
}

async function closeGiveaway(client, store, id) {
  const entry=all(store).find(g=>g.id===String(id));
  if (!entry) throw Error('Giveaway not found.');
  if (entry.status==='closed') return {ok:true,alreadyClosed:true};
  entry.status='closed';
  entry.closedAt=new Date().toISOString();
  store.save(); // Stop new registrations even if the original message has been deleted.
  let messageUpdated=false;
  try {
    const ch=await client.channels.fetch(entry.channelId).catch(()=>null);
    const message=await ch?.messages?.fetch(entry.messageId).catch(()=>null);
    if(message)messageUpdated=await updateParticipationCount(message,entry);
  } catch(e) { console.warn('Giveaway button close:',e.message); }
  return {ok:true,messageUpdated};
}

function details(title,description,imageUrl='',endsAt='') {
  const embed=new EmbedBuilder()
    .setColor('#FF2D8B').setTitle('🎁 '+title).setDescription(description)
    .addFields({name:'How to enter',value:'Press **🎉 Participate** below. One entry per Discord member.'})
    .setFooter({text:'KIXO | GFX STUDIO • OFFICIAL GIVEAWAY'}).setTimestamp();
  if(endsAt)embed.addFields({name:'Entries close',value:'<t:'+Math.floor(Date.parse(endsAt)/1000)+':F> • <t:'+Math.floor(Date.parse(endsAt)/1000)+':R>'});
  if(imageUrl)embed.setImage(imageUrl);
  return embed;
}
async function editGiveaway(client, store, p={}) {
  const entry=all(store).find(g=>g.id===String(p.id));
  if(!entry)throw Error('Giveaway not found.');
  const title=String(p.title||'').trim();
  const description=String(p.description||'').trim();
  if(!title||title.length>250)throw Error('Giveaway title is required (up to 250 characters).');
  if(!description||description.length>3500)throw Error('Giveaway text is required (up to 3500 characters).');
  const timeZone=String(p.timeZone||entry.timeZone||'America/Mexico_City');
  const endLocal=String(p.endLocal||entry.endLocal||'');
  const endsAt=entry.status==='open'?future(endLocal,timeZone):entry.endsAt;
  const images=media.prepare(entry,{...p,imageRemove:p.removeImage},['image']);
  const ch=await client.channels.fetch(entry.channelId).catch(()=>null);
  const message=await ch?.messages?.fetch(entry.messageId).catch(()=>null);
  if(!message){images.rollback();throw Error('Discord giveaway message was not found. No changes were made.');}
  const imageRef=images.patch.imageFile??entry.imageFile??'';
  const isNew=Boolean(p.imageData),remove=Boolean(p.removeImage)&&!isNew;
  const previousImageUrl=remove?'':entry.imageUrl||'';
  const embed=details(title,description,'',endsAt);
  const files=[];
  const attached=media.attach(embed,imageRef,'image',files);
  if(!attached&&previousImageUrl)embed.setImage(previousImageUrl);
  const edit={embeds:[embed],allowedMentions:{parse:[]},components:[participationRow(entry.id,entry.status!=='open',participantCount(entry))]};
  if(attached||remove){edit.files=files;edit.attachments=[];}
  let updated;
  try{updated=await message.edit(edit)}catch(err){images.rollback();throw err}
  entry.title=title;entry.description=description;entry.endsAt=endsAt;entry.endLocal=endLocal;entry.timeZone=timeZone;
  entry.imageFile=imageRef;
  if(attached)entry.imageUrl=updated.attachments?.first()?.url||entry.imageUrl||'';
  else if(remove)entry.imageUrl='';
  entry.updatedAt=new Date().toISOString();
  store.save();
  images.complete();
  return {ok:true,id:entry.id};
}
async function deleteGiveaway(client, store, id) {
  const list=all(store);
  const position=list.findIndex(g=>g.id===String(id));
  if(position<0)throw Error('Giveaway not found.');
  const entry=list[position];
  const ch=await client.channels.fetch(entry.channelId).catch(()=>null);
  if(ch) {
    try {
      const message=await ch.messages?.fetch(entry.messageId);
      if(message)await message.delete();
    } catch(err) {
      if(err.code!==10008&&err.code!==10003)throw Error('Could not delete the Discord giveaway message. Check Manage Messages permission.');
    }
  }
  const images=media.prepare(entry,{imageRemove:true},['image']);
  list.splice(position,1);
  store.save();
  images.complete();
  return {ok:true,id:entry.id};
}

function pickUniqueWinners(members, count, randomInt = crypto.randomInt) {
  const pool = [...members];
  for (let i = 0; i < count; i++) {
    const chosen = i + randomInt(pool.length - i);
    [pool[i],pool[chosen]] = [pool[chosen],pool[i]];
  }
  return pool.slice(0,count).map(u=>({
    id:String(u.id), username:String(u.username||'Member'),
    displayName:String(u.displayName||u.username||'Member'),
    joinedAt:u.joinedAt||null
  }));
}
async function drawWinners(client, store, id, requestedCount) {
  const entry=all(store).find(g=>g.id===String(id));
  if (!entry) throw Error('Giveaway not found.');
  if (entry.status!=='closed') throw Error('Close this giveaway before drawing winners.');
  if (Array.isArray(entry.winners)) throw Error('Winners have already been selected for this giveaway. Results are locked.');
  const members=[...new Map((entry.participants||[]).filter(u=>u&&u.id).map(u=>[String(u.id),u])).values()];
  const count=Number(requestedCount);
  if (!Number.isSafeInteger(count)||count<1||count>members.length)
    throw Error('Choose 1 to '+members.length+' winner'+(members.length===1?'':'s')+'.');
  const winners=pickUniqueWinners(members,count);
  const prev=entry.winners;
  entry.winners=winners;
  entry.winnersDrawnAt=new Date().toISOString();
  try{store.save()}catch(err){
    if(prev===undefined)delete entry.winners;else entry.winners=prev;
    delete entry.winnersDrawnAt;
    throw Error('Could not save winners. Please try again.');
  }
  let announcementSent=false, warning='';
  try {
    const channel=await client.channels.fetch(entry.channelId);
    if (!channel||channel.guildId!==process.env.GUILD_ID||typeof channel.send!=='function')
      throw Error('Giveaway channel unavailable');
    const lines=winners.map((u,i)=>String(i+1)+'. <@'+u.id+'>').join('\n');
    const embed=new EmbedBuilder().setColor('#FF2D8B')
      .setTitle('🏆 GIVEAWAY WINNERS — '+String(entry.title||'KIXO').slice(0,225))
      .setDescription('Congratulations to our '+count+' winner'+(count===1?'':'s')+'!\n\n'+lines)
      .setFooter({text:'KIXO | GFX STUDIO • OFFICIAL RESULTS'})
      .setTimestamp();
    const msg=await channel.send({embeds:[embed],allowedMentions:{users:winners.map(u=>u.id)}});
    entry.winnersMessageId=msg.id;
    store.save();
    announcementSent=true;
  } catch (err) {
    warning='Winners saved, but Discord winner announcement failed: '+err.message;
    console.error('Giveaway winner announcement:',err);
  }
  return {ok:true,winners,announcementSent,warning};
}

async function handleJoin(interaction,store) {
  const id=String(interaction.customId||'').slice(PREFIX.length);
  const entry=all(store).find(g=>g.id===id);
  const ephemeral=content=>interaction.reply({content,flags:MessageFlags.Ephemeral});
  if (!entry || entry.messageId !== interaction.message?.id || entry.channelId !== interaction.channelId)
    return ephemeral('This giveaway is no longer available.');
  if ((entry.participants||[]).some(u=>u.id===interaction.user.id))
    return ephemeral('✅ You are already on the participant list. You can only enter once.');
  if (entry.status!=='open'||entry.endsAt&&Date.now()>=Date.parse(entry.endsAt))
    return ephemeral('This giveaway has ended and no longer accepts entries.');
  if (interaction.user.bot) return ephemeral('Bot accounts cannot participate.');
  const participant={
    id:interaction.user.id,
    username:interaction.user.username,
    displayName:interaction.member?.displayName||interaction.user.globalName||interaction.user.username,
    joinedAt:new Date().toISOString()
  };
  if (!Array.isArray(entry.participants)) entry.participants=[];
  entry.participants.push(participant);
  try {store.save();}
  catch(err) {
    entry.participants.pop();
    console.error('Giveaway participant could not be saved:',err);
    return ephemeral('Unable to save your entry right now. Please try again.');
  }
  // Acknowledge privately, then edit only the button in the existing Discord post.
  // If Discord temporarily rejects the edit, the persisted entry is still valid.
  try { await ephemeral('🎉 You are entered! '+participantCount(entry)+' participant(s) now registered.'); }
  finally { await updateParticipationCount(interaction.message,entry); }
  return;
}
async function sweepDeadlines(client,store,now=Date.now()){
  let closed=0;
  for(const entry of all(store).filter(g=>g.status==='open'&&g.endsAt&&Date.parse(g.endsAt)<=now).slice(0,20)){
    await closeGiveaway(client,store,entry.id);closed++;
  }
  return {closed};
}
module.exports={all,publishGiveaway,editGiveaway,deleteGiveaway,closeGiveaway,drawWinners,pickUniqueWinners,handleJoin,asImage,PREFIX,sweepDeadlines,participationRow,participantCount,refreshPublishedGiveawayCounts,setAdminSampleNames};