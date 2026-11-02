'use strict';
const {ChannelType,MessageFlags,PermissionFlagsBits}=require('discord.js');
const normalized=x=>String(x||'').trim().replace(/\s+/g,' ');
// The '(Adicional)' tag is internal import metadata, not part of a team name.
// Normalize names at the boundary so lists, public boards, and admin controls
// all use the same clean display while keeping existing team records/status.
const teamName=x=>normalized(x).replace(/\s*\(\s*adicional\s*\)\s*$/iu,'').trim();
const key=x=>teamName(x).toLowerCase();
const safe=x=>normalized(x).replace(/([\\*_~|>])/g,'\\$1').replace(/@/g,'＠').replace(/\x60/g,'\\'+String.fromCharCode(96));
const ephemeral=content=>({content,flags:MessageFlags.Ephemeral,allowedMentions:{parse:[]}});
function ensure(store){
 if(!store.data.teamAvailability)store.data.teamAvailability={title:'KIXO | GFX STUDIO • TEAM AVAILABILITY',teams:[],channelId:'',messageIds:[],updatedAt:''};
 const b=store.data.teamAvailability;
 if(!Array.isArray(b.teams))b.teams=[];
 if(!Array.isArray(b.messageIds))b.messageIds=[];
 // One-time migration for already-published teams on the persistent /data
 // volume. Only rename labels: do not change team count, status or username.
 let changed=false;
 for(const team of b.teams){
  const name=teamName(team.name);
  if(name!==team.name){team.name=name;changed=true;}
 }
 if(changed){b.updatedAt=new Date().toISOString();store.save();}
 return b;
}
function state(store){const b=ensure(store);return {title:b.title,teams:b.teams.map(t=>({...t})),channelId:b.channelId||'',messageIds:[...b.messageIds],updatedAt:b.updatedAt,available:b.teams.filter(t=>t.available).length,taken:b.teams.filter(t=>!t.available).length};}
function parseList(raw){
 const input=String(raw||'');if(input.length>35000)throw Error('Maximum 35,000 characters.');
 let lines=input.replace(/^\uFEFF/,'').split(/\r?\n/);if(lines.length===1&&input.includes(','))lines=input.split(',');
 const seen=new Set(),out=[];
 for(let rawLine of lines){
  let name=normalized(rawLine).replace(/^[✅❌✔✖☑☒]\s*/u,'').replace(/^\d{1,4}\s*[.):\-]\s*/,'');
  if(!name||/^(team|team name|name|nombre|team,status|team name,status|name,status|nombre,estado)$/i.test(name))continue;
  const comma=name.split(',');
  if(comma.length===2&&/^(available|taken|open|closed|disponible|ocupado|yes|no)$/i.test(comma[1].trim()))name=normalized(comma[0]);
  name=teamName(name);
  if(name.length>80)throw Error('Team name too long: '+name.slice(0,30));
  if(seen.has(key(name)))continue;seen.add(key(name));out.push(name);
  if(out.length>250)throw Error('Maximum 250 teams.');
 }
 if(!out.length)throw Error('Enter at least one team name.');return out;
}
function update(store,fn){const b=ensure(store);fn(b);b.updatedAt=new Date().toISOString();store.save();return state(store);}
function importTeams(store,p={}){
 const names=parseList(p.text);
 return update(store,b=>{
  const old=new Map(b.teams.map(t=>[key(t.name),t]));
  const merged=p.replace===true?[]:b.teams.map(x=>({...x})),seen=new Set(merged.map(t=>key(t.name)));
  for(const name of names)if(!seen.has(key(name))){const prior=old.get(key(name));merged.push({name,available:prior?.available!==false,username:prior?.available===false?String(prior.username||''):''});seen.add(key(name));}
  if(merged.length>250)throw Error('Maximum 250 teams.');b.teams=merged;
  if(p.title!==undefined){const t=normalized(p.title);if(!t||t.length>100)throw Error('Invalid title.');b.title=t;}
 });
}
function changeStatus(store,p){
 if(typeof p.available!=='boolean')throw Error('Select available or taken.');
 const username=normalized(p.username);
 if(username.length>60)throw Error('Username must be 60 characters or fewer.');
 if(p.available===false&&!username)throw Error('Enter the username assigned to this team.');
 return update(store,b=>{
  const team=b.teams.find(t=>key(t.name)===key(p.name));
  if(!team)throw Error('Team not found.');
  team.available=p.available;
  team.username=p.available?'':username;
 });
}
function add(store,p){const name=teamName(p.name);if(!name||name.length>80)throw Error('Invalid team name.');
 return update(store,b=>{if(b.teams.length>=250)throw Error('Maximum 250 teams.');if(b.teams.some(t=>key(t.name)===key(name)))throw Error('Team already listed.');b.teams.push({name,available:true});});
}
function remove(store,p){return update(store,b=>{const n=b.teams.length;b.teams=b.teams.filter(t=>key(t.name)!==key(p.name));if(n===b.teams.length)throw Error('Team not found.');});}
function rename(store,p){const t=normalized(p.title);if(!t||t.length>100)throw Error('Invalid title.');return update(store,b=>{b.title=t;});}
// Public team board: show every team immediately. No filters or next/previous buttons.
// Two inline embed fields form each pair of columns. A full-width spacer prevents
// Discord from arranging three columns on desktop. Mobile may stack them.
const BOARD_PREFIX='smtteams:';
const BRAND_RED=0xD90429;
const MAX_FIELD_LENGTH=1024, MAX_EMBED_TOTAL=5500, MAX_EMBED_FIELDS=25;
const COLUMN_TEAMS=8;
const BLANK='\u200b';

function teamText(team){
 return (team.available?'✅':'❌')+' '+safe(teamName(team.name))+
  (!team.available?'\n   ↳ 👤 '+(team.username?'**'+safe(team.username)+'**':'*Not assigned*'):'');
}
function columns(teams){
 const groups=[];
 let offset=0;
 while(offset<teams.length){
  let take=Math.min(COLUMN_TEAMS,Math.ceil((teams.length-offset)/2));
  let left=[],right=[];
  while(take>=1){
   left=teams.slice(offset,offset+take).map(teamText);
   right=teams.slice(offset+take,offset+2*take).map(teamText);
   if(left.join('\n\n').length<=MAX_FIELD_LENGTH&&right.join('\n\n').length<=MAX_FIELD_LENGTH)break;
   take--;
  }
  if(take<1)throw Error('A team name is too long to display in Discord.');
  groups.push({
   left:{name:'TEAMS  '+(offset+1)+'–'+(offset+left.length),value:left.join('\n\n'),inline:true},
   right:right.length?{name:'TEAMS  '+(offset+take+1)+'–'+(offset+take+right.length),value:right.join('\n\n'),inline:true}:null
  });
  offset+=left.length+right.length;
 }
 return groups;
}
function embedLength(e){
 return (e.title||'').length+(e.description||'').length+(e.footer?.text||'').length+
  (e.fields||[]).reduce((sum,f)=>sum+f.name.length+f.value.length,0);
}
function sections(board,client=null){
 const teams=Array.isArray(board.teams)?board.teams:[];
 const available=teams.filter(t=>t.available).length,taken=teams.length-available;
 const intro='✅ **'+available+' AVAILABLE**   •   ❌ **'+taken+' TAKEN**   •   ⚽ **'+teams.length+' TOTAL**\n\n'+
  '**ALL TEAMS  /  TODOS LOS EQUIPOS**';
 const baseTitle='🏆 '+normalized(board.title||'KIXO | GFX STUDIO • TEAM AVAILABILITY').slice(0,100);
 const makeEmbed=(first)=>({
  color:BRAND_RED,
  title:first?baseTitle:'📋 '+normalized(board.title||'KIXO | GFX STUDIO • TEAM AVAILABILITY').slice(0,95)+' • Continued',
  description:first?intro:'**TEAM LIST • CONTINUED**',
  fields:[]
 });
 const messages=[];
 let embed=makeEmbed(true),groupCount=0;
 for(const group of columns(teams)){
  const fields=[group.left,...(group.right?[group.right]:[])];
  // After each pair, use a non-inline field so the next group begins a
  // fresh two-column row. This avoids three-column Discord layouts.
  const spacer={name:BLANK,value:BLANK,inline:false};
  const toAdd=groupCount?[spacer,...fields]:fields;
  const chars=toAdd.reduce((n,x)=>n+x.name.length+x.value.length,0);
  if(groupCount&&(embed.fields.length+toAdd.length>MAX_EMBED_FIELDS||embedLength(embed)+chars>MAX_EMBED_TOTAL)){
   messages.push({content:'',embeds:[embed],components:[],allowedMentions:{parse:[]}});
   embed=makeEmbed(false);groupCount=0;
  }
  if(groupCount)embed.fields.push({...spacer});
  embed.fields.push(...fields);
  groupCount++;
 }
 if(!teams.length)embed.description+='\n\n*No teams listed yet.*';
 embed.footer={text:'KIXO | GFX STUDIO • Updated automatically by admins'};
 messages.push({content:'',embeds:[embed],components:[],allowedMentions:{parse:[]}});
 const icon=client?.user?.displayAvatarURL?.({size:64})||null;
 if(icon&&/^https?:\/\//.test(icon))messages[0].embeds[0].thumbnail={url:icon};
 // A very large imported list may require more than one message due to
 // Discord limits, but no member ever has to click Next to see any team.
 return messages;
}
// Handle legacy pagination buttons that may still appear on cached posts.
async function handleBoardButton(interaction,client,store){
 if(!interaction.isButton()||!String(interaction.customId||'').startsWith(BOARD_PREFIX))return false;
 await interaction.reply(ephemeral('The team list now shows every team at once. The Next/Previous buttons have been removed. Please view the updated board.'));
 return true;
}
const queues=new WeakMap();
function serialize(store,fn){const last=queues.get(store)||Promise.resolve(),work=last.catch(()=>{}).then(fn);queues.set(store,work);work.finally(()=>{if(queues.get(store)===work)queues.delete(store);}).catch(()=>{});return work;}
async function getChannel(client,id){
 const ch=await client.channels.fetch(String(id||'')).catch(()=>null);
 if(!ch||ch.guildId!==process.env.GUILD_ID||![ChannelType.GuildText,ChannelType.GuildAnnouncement].includes(ch.type)||typeof ch.send!=='function')throw Error('Select a KIXO text or announcements channel.');
 return ch;
}
async function publish(client,store,target=''){
 return serialize(store,async()=>{
  const b=ensure(store);if(!b.teams.length&&!b.messageIds.length)throw Error('Upload team names first.');
  const channelId=target||b.channelId,ch=await getChannel(client,channelId),parts=sections(b,client);
  const previousIds=[...b.messageIds],previousChannel=b.channelId,same=previousChannel===channelId;
  const ids=[],warnings=[];
  for(let i=0;i<parts.length;i++){
   const payload=parts[i];
   const msg=same&&previousIds[i]?await ch.messages.fetch(previousIds[i]).catch(()=>null):null;
   if(msg?.author?.id===client.user?.id){
    try{await msg.edit(payload);ids.push(msg.id);continue;}catch(e){warnings.push('Edit failed on section '+(i+1)+': '+e.message);}
   }
   const created=await ch.send(payload);ids.push(created.id);
  }
  b.channelId=channelId;b.messageIds=ids;b.updatedAt=new Date().toISOString();store.save();
  const stale=same?previousIds.filter(id=>!ids.includes(id)):previousIds;
  const oldChannel=same?ch:previousChannel?await client.channels.fetch(previousChannel).catch(()=>null):null;
  if(oldChannel?.guildId===process.env.GUILD_ID){
   for(const id of stale){const m=await oldChannel.messages.fetch(id).catch(()=>null);if(m?.author?.id===client.user?.id)await m.delete().catch(e=>warnings.push('Old post cleanup failed: '+e.message));}
  }
  return {...state(store),url:'https://discord.com/channels/'+process.env.GUILD_ID+'/'+channelId+'/'+ids[0],syncWarnings:warnings};
 });
}
async function apply(client,store,action,p={}){
 if(action==='publish')return publish(client,store,p.channelId);
 let result;
 if(action==='import')result=importTeams(store,p);
 else if(action==='set')result=changeStatus(store,p);
 else if(action==='add')result=add(store,p);
 else if(action==='remove')result=remove(store,p);
 else if(action==='title')result=rename(store,p);
 else throw Error('Unknown team action.');
 if(!result.channelId||!result.messageIds.length)return {...result,published:false};
 try{return {...await publish(client,store),published:true};}
 catch(e){return {...state(store),published:false,syncWarnings:['Saved, but Discord update failed: '+e.message]};}
}
async function command(interaction,client,store){
 if(!interaction.guild||interaction.guild.id!==process.env.GUILD_ID)return interaction.reply(ephemeral('KIXO server only.'));
 if(!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)&&!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator))return interaction.reply(ephemeral('Manage Server permission required.'));
 const sub=interaction.options.getSubcommand();
 if(sub==='list'){
  const b=state(store),lines=b.teams.slice(0,22).map(t=>(t.available?'✅ ':'❌ ')+t.name+(t.available?'':'\n   👤 Username: '+(t.username||'Not assigned yet'))).join('\n');
  return interaction.reply(ephemeral(b.title+'\n'+b.available+' available / '+b.taken+' taken\n'+(lines||'No teams listed')+(b.teams.length>22?'\nMore in Admin Command Center.':'')));
 }
 const p={};
 if(sub==='publish')p.channelId=interaction.options.getChannel('channel')?.id;
 else if(sub==='set'){
  p.name=interaction.options.getString('team');
  p.available=interaction.options.getString('status')==='available';
  p.username=interaction.options.getUser('user')?.username||interaction.options.getString('username')||'';
}
 else if(sub==='add'||sub==='remove')p.name=interaction.options.getString('team');
 else return interaction.reply(ephemeral('Unknown command.'));
 await interaction.deferReply({flags:MessageFlags.Ephemeral});
 try{const b=await apply(client,store,sub,p);
  return interaction.editReply((b.syncWarnings?.length?'⚠️ ':'✅ ')+'Team list updated: '+b.available+' available, '+b.taken+' taken.'+(b.url?'\n'+b.url:'')+(b.syncWarnings?.length?'\n'+b.syncWarnings.join('\n'):''));}
 catch(e){return interaction.editReply('Team list error: '+e.message);}
}
module.exports={ensure,state,parseList,importTeams,changeStatus,add,remove,rename,sections,publish,apply,command,handleBoardButton};
