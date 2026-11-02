'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {AttachmentBuilder,MessageFlags,PermissionFlagsBits,ChannelType}=require('discord.js');
const ROOT=path.join(path.resolve(process.env.DATA_DIR||'./data'),'server-backups');
const TYPES=new Set([ChannelType.GuildCategory,ChannelType.GuildText,ChannelType.GuildVoice,ChannelType.GuildAnnouncement,ChannelType.GuildStageVoice,ChannelType.GuildForum,ChannelType.GuildMedia].filter(x=>x!==undefined));
const EPHEMERAL=MessageFlags.Ephemeral;
const answer=content=>({content,flags:EPHEMERAL,allowedMentions:{parse:[]}});
function prepare(){fs.mkdirSync(ROOT,{recursive:true,mode:0o700});}
function file(id){if(!/^(auto|manual)-\d{13}-[0-9a-f]{8}$/.test(id||''))throw Error('Invalid backup ID.');return path.join(ROOT,id+'.json');}
function listBackups(guildId){
 prepare();const out=[];
 for(const name of fs.readdirSync(ROOT).filter(x=>/^(auto|manual)-\d{13}-[0-9a-f]{8}\.json$/.test(x))){
   try{const doc=JSON.parse(fs.readFileSync(path.join(ROOT,name),'utf8'));
     if(doc.schema!==1||doc.guild?.id!==guildId||!Array.isArray(doc.roles)||!Array.isArray(doc.channels))continue;
     out.push({id:doc.id,createdAt:doc.createdAt,kind:doc.kind,roles:doc.roles.length,channels:doc.channels.length});
   }catch(e){console.warn('Cannot read backup',name,e.message);}
 }
 return out.sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
}
function readBackup(guildId,id){
 const doc=JSON.parse(fs.readFileSync(file(id),'utf8'));
 if(doc.schema!==1||doc.guild?.id!==guildId||!Array.isArray(doc.roles)||!Array.isArray(doc.channels))throw Error('Backup is not valid for this server.');
 if(doc.roles.length>1000||doc.channels.length>2000)throw Error('Backup too large for safe restoration.');
 return doc;
}
function permissionRows(ch){
 return [...(ch.permissionOverwrites?.cache?.values()||[])].map(x=>({id:x.id,type:x.type,allow:x.allow.bitfield.toString(),deny:x.deny.bitfield.toString()}));
}
async function snapshot(guild,kind='manual'){
 if(!['auto','manual'].includes(kind))throw Error('Invalid backup type.');
 await Promise.all([guild.roles.fetch(),guild.channels.fetch()]);
 const roles=[...guild.roles.cache.values()].map(r=>({
   id:r.id,name:r.name,permissions:r.permissions.bitfield.toString(),color:r.color,
   hoist:!!r.hoist,mentionable:!!r.mentionable,position:r.position,managed:!!r.managed
 })).sort((a,b)=>a.position-b.position);
 const channels=[...guild.channels.cache.values()].filter(x=>x&&TYPES.has(x.type)).map(c=>({
   id:c.id,name:c.name,type:c.type,parentId:c.parentId||null,position:c.rawPosition??c.position??0,
   topic:typeof c.topic==='string'?c.topic:null,nsfw:!!c.nsfw,rateLimitPerUser:c.rateLimitPerUser||0,
   bitrate:c.bitrate||null,userLimit:c.userLimit||null,permissionOverwrites:permissionRows(c)
 })).sort((a,b)=>(a.type===ChannelType.GuildCategory?-1:0)-(b.type===ChannelType.GuildCategory?-1:0)||a.position-b.position);
 const doc={schema:1,id:kind+'-'+Date.now()+'-'+crypto.randomBytes(4).toString('hex'),
   kind,createdAt:new Date().toISOString(),guild:{id:guild.id,name:guild.name,description:guild.description||null},
   roles,channels,limitations:'Structural metadata only. No messages, attachments, member assignments, webhook credentials or bot tokens.'};
 prepare();const dest=file(doc.id),temp=dest+'.tmp';
 try{fs.writeFileSync(temp,JSON.stringify(doc,null,2),{mode:0o600,flag:'wx'});fs.renameSync(temp,dest);}
 catch(e){try{fs.unlinkSync(temp)}catch{}throw e;}
 const keep=kind==='auto'?30:20;
 for(const old of listBackups(guild.id).filter(x=>x.kind===kind).slice(keep))fs.unlinkSync(file(old.id));
 return {id:doc.id,roles:roles.length,channels:channels.length,createdAt:doc.createdAt,kind};
}
async function scheduledBackup(guild){
 const latest=listBackups(guild.id).find(x=>x.kind==='auto');
 if(latest&&Date.now()-Date.parse(latest.createdAt)<86400000)return {skipped:true,latest};
 const item=await snapshot(guild,'auto');
 console.log('Automatic Discord server backup:',item.id,item.roles+' roles,',item.channels+' channels');
 return {skipped:false,latest:item};
}
function recoveryPlan(guild,doc){
 const roles=[...guild.roles.cache.values()],channels=[...guild.channels.cache.values()];
 const categories=new Map(doc.channels.filter(x=>x.type===ChannelType.GuildCategory).map(x=>[x.id,x.name]));
 const missingRoles=doc.roles.filter(r=>r.id!==guild.id&&!r.managed&&!roles.some(x=>x.id===r.id||(!x.managed&&x.name===r.name)));
 const missingCategories=doc.channels.filter(c=>c.type===ChannelType.GuildCategory&&!channels.some(x=>x.type===c.type&&(x.id===c.id||x.name===c.name)));
 const missingChannels=doc.channels.filter(c=>c.type!==ChannelType.GuildCategory&&!channels.some(x=>{
   if(x.id===c.id)return true;
   if(x.name!==c.name||x.type!==c.type)return false;
   const existingParent=x.parentId?guild.channels.cache.get(x.parentId)?.name||'':null;
   const originalParent=c.parentId?categories.get(c.parentId)||'':null;
   return existingParent===originalParent;
 }));
 return {missingRoles,missingCategories,missingChannels};
}
function mapOverwrites(ch,roles,guild){
 const list=[];
 for(const p of ch.permissionOverwrites||[]){
   if(p.type!==0&&p.type!=='role')continue;
   const id=p.id===guild.id?guild.id:(roles.get(p.id)||p.id);
   if(!guild.roles.cache.has(id))continue;
   list.push({id,type:0,allow:BigInt(p.allow),deny:BigInt(p.deny)});
 }
 return list;
}
async function restoreMissing(guild,doc){
 await Promise.all([guild.roles.fetch(),guild.channels.fetch()]);
 const plan=recoveryPlan(guild,doc);
 if(plan.missingRoles.length+plan.missingCategories.length+plan.missingChannels.length>400)throw Error('Recovery has more than 400 missing items; restore in smaller batches.');
 const me=await guild.members.fetchMe();
 if(!me.permissions.has(PermissionFlagsBits.ManageRoles)||!me.permissions.has(PermissionFlagsBits.ManageChannels))
   throw Error('Bot needs Manage Roles and Manage Channels permissions.');
 const stats={roles:0,categories:0,channels:0,failures:[]};
 const roleIds=new Map([[guild.id,guild.id]]),categoryIds=new Map();
 for(const old of doc.roles){
   if(old.id===guild.id)continue;
   const found=guild.roles.cache.get(old.id)||[...guild.roles.cache.values()].find(r=>!r.managed&&r.name===old.name);
   if(found)roleIds.set(old.id,found.id);
 }
 for(const old of plan.missingRoles){
   try{const r=await guild.roles.create({name:old.name,color:old.color,hoist:old.hoist,mentionable:old.mentionable,permissions:BigInt(old.permissions),reason:'KIXO owner authorized backup recovery'});
     roleIds.set(old.id,r.id);stats.roles++;
   }catch(e){stats.failures.push('Role '+old.name+': '+e.message);}
 }
 for(const old of doc.channels.filter(c=>c.type===ChannelType.GuildCategory)){
   const found=guild.channels.cache.get(old.id)||[...guild.channels.cache.values()].find(c=>c.type===ChannelType.GuildCategory&&c.name===old.name);
   if(found)categoryIds.set(old.id,found.id);
 }
 for(const old of plan.missingCategories){
   try{const c=await guild.channels.create({name:old.name,type:ChannelType.GuildCategory,permissionOverwrites:mapOverwrites(old,roleIds,guild),reason:'KIXO owner authorized backup recovery'});
     categoryIds.set(old.id,c.id);stats.categories++;
   }catch(e){stats.failures.push('Category '+old.name+': '+e.message);}
 }
 for(const old of plan.missingChannels){
   try{
     if(!TYPES.has(old.type))continue;
     const options={name:old.name,type:old.type,permissionOverwrites:mapOverwrites(old,roleIds,guild),reason:'KIXO owner authorized backup recovery'};
     if(old.parentId){const mapped=categoryIds.get(old.parentId);if(!mapped){stats.failures.push('Channel '+old.name+': missing parent');continue;}options.parent=mapped;}
     if([ChannelType.GuildText,ChannelType.GuildAnnouncement,ChannelType.GuildForum,ChannelType.GuildMedia].includes(old.type)){
       if(old.topic!==null)options.topic=old.topic;
       options.nsfw=old.nsfw;
       if(old.type===ChannelType.GuildText)options.rateLimitPerUser=old.rateLimitPerUser;
     }
     if([ChannelType.GuildVoice,ChannelType.GuildStageVoice].includes(old.type)){
       if(old.bitrate)options.bitrate=old.bitrate;
       if(old.type===ChannelType.GuildVoice&&old.userLimit!=null)options.userLimit=old.userLimit;
     }
     await guild.channels.create(options);stats.channels++;
   }catch(e){stats.failures.push('Channel '+old.name+': '+e.message);}
 }
 return stats;
}
async function handleCommand(interaction){
 if(!interaction.guild||interaction.guild.id!==process.env.GUILD_ID)return interaction.reply(answer('This command works only in KIXO | GFX STUDIO.'));
 const owner=interaction.user.id===interaction.guild.ownerId;
 if(!owner&&!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator))return interaction.reply(answer('Administrators only.'));
 const action=interaction.options.getSubcommand();
 if(action==='list'){
   const items=listBackups(interaction.guild.id).slice(0,15);
   return interaction.reply(answer(items.length?items.map(x=>x.id+' — '+x.kind+' / '+x.roles+' roles / '+x.channels+' channels').join('\n'):'No backups found. Run /server-backup create.'));
 }
 if(action==='create'){
   await interaction.deferReply({flags:EPHEMERAL});
   try{const item=await snapshot(interaction.guild,'manual');
     return interaction.editReply('Backup saved: '+item.id+'\n'+item.roles+' roles and '+item.channels+' channels.\nUse /server-backup export to download a copy outside Railway.');}
   catch(e){return interaction.editReply('Backup failed: '+e.message);}
 }
 const id=interaction.options.getString('id',true);
 let doc;
 try{doc=readBackup(interaction.guild.id,id)}catch(e){return interaction.reply(answer('Cannot open backup: '+e.message));}
 if(action==='export'){
   const bytes=fs.readFileSync(file(id));
   if(bytes.length>8*1024*1024)return interaction.reply(answer('Backup exceeds private Discord attachment limit.'));
   return interaction.reply({content:'Private KIXO backup. Save it off-platform too.',files:[new AttachmentBuilder(bytes,{name:'KIXO-server-'+id+'.json'})],flags:EPHEMERAL,allowedMentions:{parse:[]}});
 }
 await Promise.all([interaction.guild.roles.fetch(),interaction.guild.channels.fetch()]);
 const plan=recoveryPlan(interaction.guild,doc);
 const summary='Saved '+doc.createdAt+'. Missing '+plan.missingRoles.length+' roles, '+plan.missingCategories.length+' categories and '+plan.missingChannels.length+' channels. Existing items will never be deleted or modified. Message history and member role assignments cannot be restored.';
 if(action==='preview')return interaction.reply(answer('Backup '+id+'\n'+summary+'\nOwner-only restore confirmation: RESTORE '+id));
 if(action==='restore'){
   if(!owner)return interaction.reply(answer('Only the Discord server OWNER can authorize restoration.'));
   if(interaction.options.getString('confirmation')!=='RESTORE '+id)return interaction.reply(answer('No changes made. Confirmation must exactly be: RESTORE '+id));
   await interaction.deferReply({flags:EPHEMERAL});
   try{const stats=await restoreMissing(interaction.guild,doc);
     return interaction.editReply('Recovery finished: '+stats.roles+' roles, '+stats.categories+' categories, '+stats.channels+' channels created.'+
       (stats.failures.length?'\nIssues ('+stats.failures.length+'):\n'+stats.failures.slice(0,8).join('\n'):'\nNo creation errors.')+
       '\nExisting items were not deleted. Discord message history cannot be recovered.');}
   catch(e){return interaction.editReply('Recovery stopped: '+e.message);}
 }
 return interaction.reply(answer('Unknown backup action.'));
}
module.exports={snapshot,listBackups,readBackup,scheduledBackup,recoveryPlan,restoreMissing,handleCommand};
