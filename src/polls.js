'use strict';
const { ChannelType } = require('discord.js');

// Native Discord polls: members vote in Discord, while the persistent bot store
// keeps publication metadata for the private KIXO Admin Command Center.
function all(store) {
  if(!Array.isArray(store.data.polls)) store.data.polls=[];
  return store.data.polls;
}
const allowedTypes=new Set([ChannelType.GuildText,ChannelType.GuildAnnouncement]);
function normalize(input={}) {
  const channelId=String(input.channelId||'').trim();
  if(!/^\d{16,22}$/.test(channelId))throw Error('Select a valid Discord text or announcement channel.');
  const question=String(input.question||'').trim();
  if(!question||question.length>300)throw Error('Poll question is required (maximum 300 characters).');
  const text=String(input.message||'').trim();
  if(text.length>1800)throw Error('Introductory poll message must be 1,800 characters or fewer.');
  if(!Array.isArray(input.answers))throw Error('Enter at least two poll answers.');
  const answers=input.answers.map(x=>String(x||'').trim()).filter(Boolean);
  if(answers.length<2||answers.length>10)throw Error('Poll must have 2–10 answers.');
  if(answers.some(x=>x.length>55))throw Error('Each poll answer must be 55 characters or fewer.');
  const unique=new Set(answers.map(x=>x.toLocaleLowerCase()));
  if(unique.size!==answers.length)throw Error('Poll answers must be different.');
  const duration=Number(input.durationHours);
  if(!Number.isInteger(duration)||duration<1||duration>168)throw Error('Poll duration must be 1–168 hours.');
  return {channelId,question,message:text,answers,durationHours:duration,allowMultiselect:input.allowMultiselect===true};
}
async function publish(client,store,input={}) {
  const data=normalize(input);
  const channel=await client.channels.fetch(data.channelId).catch(()=>null);
  if(!channel||channel.guildId!==process.env.GUILD_ID||!allowedTypes.has(channel.type)||typeof channel.send!=='function')
    throw Error('Choose a KIXO server text or announcement channel.');
  const payload={
    content:data.message||undefined,
    poll:{
      question:{text:data.question},
      answers:data.answers.map(text=>({text})),
      duration:data.durationHours,
      allowMultiselect:data.allowMultiselect
    },
    allowedMentions:{parse:[]}
  };
  // Sending before saving avoids dashboard rows for Discord messages that never posted.
  const post=await channel.send(payload);
  const record={
    id:'poll_'+post.id,channelId:data.channelId,messageId:post.id,
    question:data.question,message:data.message,answers:data.answers,
    durationHours:data.durationHours,allowMultiselect:data.allowMultiselect,
    createdAt:new Date().toISOString(),endsAt:new Date(Date.now()+data.durationHours*3600000).toISOString(),
    endedAt:null
  };
  const polls=all(store);
  polls.unshift(record);
  try{
    if(polls.length>100)polls.length=100;
    store.save();
  }catch(e){
    // Poll was already published; do not delete valid votes to undo a database error.
    console.error('Published Discord poll but failed to save dashboard record:',post.id,e);
    throw Error('Poll published in Discord but could not be saved in dashboard. Message ID: '+post.id);
  }
  return {ok:true,id:record.id,messageId:post.id,url:'https://discord.com/channels/'+process.env.GUILD_ID+'/'+data.channelId+'/'+post.id};
}
async function end(client,store,input={}) {
  const record=all(store).find(p=>p.id===String(input.id||''));
  if(!record)throw Error('Poll not found.');
  if(record.endedAt)return {ok:true,alreadyEnded:true};
  const channel=await client.channels.fetch(record.channelId).catch(()=>null);
  if(!channel||channel.guildId!==process.env.GUILD_ID)throw Error('Poll channel unavailable.');
  const post=await channel.messages?.fetch(record.messageId).catch(()=>null);
  if(!post||post.author?.id!==client.user?.id)throw Error('Poll message unavailable or not owned by KIXO bot.');
  if(!post.poll)throw Error('This message does not contain a Discord poll.');
  if(post.poll.expiresTimestamp&&post.poll.expiresTimestamp<=Date.now()){
    record.endedAt=new Date().toISOString();
  }else{
    await post.poll.end();
    record.endedAt=new Date().toISOString();
  }
  store.save();
  return {ok:true,endedAt:record.endedAt};
}
function listing(store) {
  return all(store).map(p=>({
    id:p.id,channelId:p.channelId,messageId:p.messageId,
    question:p.question,message:p.message,answers:p.answers,
    durationHours:p.durationHours,allowMultiselect:p.allowMultiselect,
    createdAt:p.createdAt,endsAt:p.endsAt,endedAt:p.endedAt||null,
    status:p.endedAt||Date.parse(p.endsAt)<=Date.now()?'closed':'open'
  }));
}
module.exports={all,normalize,publish,end,listing};
