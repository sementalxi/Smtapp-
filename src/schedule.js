'use strict';
const TIME_ZONES = ['America/Mexico_City','America/Chicago','America/New_York','America/Los_Angeles','UTC'];
function zone(raw){
  if(!TIME_ZONES.includes(String(raw||'')))throw Error('Choose a supported time zone.');
  return String(raw);
}
function parts(iso, timeZone){
  const d=new Date(iso), fmt=new Intl.DateTimeFormat('en-US',{timeZone,hour12:false,hourCycle:'h23',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
  const o=Object.fromEntries(fmt.formatToParts(d).filter(x=>x.type!=='literal').map(x=>[x.type,Number(x.value)]));
  return {year:o.year,month:o.month,day:o.day,hour:o.hour===24?0:o.hour,minute:o.minute};
}
function toUtc(localRaw, zoneRaw){
  const timeZone=zone(zoneRaw);
  const m=/^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)$/.exec(String(localRaw||''));
  if(!m)throw Error('Enter a valid date and time.');
  const [y,mo,d,h,mi]=m.slice(1).map(Number);
  const aim=Date.UTC(y,mo-1,d,h,mi);
  const validated=new Date(aim);
  if(validated.getUTCFullYear()!==y||validated.getUTCMonth()!==mo-1||validated.getUTCDate()!==d||h>23||mi>59)throw Error('Invalid date or time.');
  let guess=aim;
  for(let i=0;i<6;i++){
    const p=parts(guess,timeZone);
    const local=Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute);
    const delta=aim-local;
    guess+=delta;
    if(delta===0)break;
  }
  const x=parts(guess,timeZone);
  if(x.year!==y||x.month!==mo||x.day!==d||x.hour!==h||x.minute!==mi)throw Error('The selected local time does not exist in this time zone (DST change).');
  return new Date(guess).toISOString();
}
function future(local,timeZone,now=Date.now()){
  const utc=toUtc(local,timeZone);
  if(Date.parse(utc)<=now)throw Error('Choose a future date and time.');
  return utc;
}
function nextRecurring(reminder,previous){
  const z=zone(reminder.timeZone||'America/Mexico_City');
  const old=parts(previous,z);
  const date=new Date(Date.UTC(old.year,old.month-1,old.day));
  date.setUTCDate(date.getUTCDate()+(reminder.frequency==='weekly'?7:1));
  let dt=date.toISOString().slice(0,10)+'T'+String(old.hour).padStart(2,'0')+':'+String(old.minute).padStart(2,'0');
  try{return toUtc(dt,z)}
  catch(e){
    // Handle nonexistent local clock time on the spring DST transition.
    const fallback = new Date(Date.parse(previous)+(reminder.frequency==='weekly'?7:1)*86400000);
    return fallback.toISOString();
  }
}
module.exports={TIME_ZONES,zone,toUtc,future,parts,nextRecurring};