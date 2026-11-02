'use strict';
// Server-rendered Discord welcome image: real avatar + username + guild member count.
// The optional image uploaded in Welcome Settings is the background (not the member avatar).
const sharp=require('sharp');
const fs=require('fs');
const path=require('path');
const {DATA_DIR}=require('./store');
const W=1200,H=540,AVATAR_SIZE=178;
const escapeXml=value=>String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  .replace(/"/g,'&quot;').replace(/'/g,'&apos;');
function backSvg(){
 const pillars=[];
 for(let x=754;x<=1150;x+=90){
   pillars.push('<rect x="'+x+'" y="93" width="22" height="310" fill="url(#pillar)" opacity=".72"/>');
   pillars.push('<rect x="'+(x-10)+'" y="80" width="43" height="18" fill="#c79d53" opacity=".6"/>');
 }
 const steps=[];
 for(let i=0;i<8;i++)steps.push('<path d="M '+(830-i*25)+' '+(388+i*17)+' L '+(1090+i*22)+' '+(388+i*17)+'" stroke="#d9a754" stroke-width="'+(2+i*.45)+'" opacity=".65"/>');
 return '<svg xmlns="http://www.w3.org/2000/svg" width="'+W+'" height="'+H+'" viewBox="0 0 1200 540">'+
  '<defs>'+
  '<linearGradient id="sky" x2=".7" y2="1"><stop stop-color="#160d1e"/><stop offset=".42" stop-color="#583024"/><stop offset="1" stop-color="#e5ab58"/></linearGradient>'+
  '<radialGradient id="sun"><stop stop-color="#fff0b9"/><stop offset=".3" stop-color="#ffd385" stop-opacity=".89"/><stop offset="1" stop-color="#d9974e" stop-opacity="0"/></radialGradient>'+
  '<linearGradient id="pillar"><stop stop-color="#402a21"/><stop offset=".22" stop-color="#dfb679"/><stop offset=".55" stop-color="#f6d399"/><stop offset=".85" stop-color="#5a3829"/></linearGradient>'+
  '<linearGradient id="left" x2="1" y2=".1"><stop stop-color="#16050b"/><stop offset=".58" stop-color="#210914"/><stop offset="1" stop-color="#241014" stop-opacity=".1"/></linearGradient>'+
  '<linearGradient id="red" x2=".6" y2="1"><stop stop-color="#500514"/><stop offset=".5" stop-color="#af1430"/><stop offset="1" stop-color="#1b0715"/></linearGradient>'+
  '<linearGradient id="gold" x2=".3" y2=".7"><stop stop-color="#fff5cb"/><stop offset=".23" stop-color="#a7722a"/><stop offset=".49" stop-color="#fbd37a"/><stop offset=".8" stop-color="#a5742a"/><stop offset="1" stop-color="#fff5c3"/></linearGradient>'+
  '</defs>'+
  '<rect width="1200" height="540" fill="url(#sky)"/>'+
  '<circle cx="985" cy="165" r="455" fill="url(#sun)"/>'+
  '<path d="M685 0H1200V450Q1000 410 895 500L685 440Z" fill="#5d3222" opacity=".25"/>'+
  '<path d="M810 0V320M1000 0V320" stroke="#f3bd76" stroke-width="14" opacity=".45"/>'+
  '<path d="M740 260Q972 -30 1200 260" fill="none" stroke="url(#pillar)" stroke-width="39" opacity=".65"/>'+
  '<path d="M790 267Q986 30 1180 267" fill="none" stroke="#3b251e" stroke-width="16" opacity=".65"/>'+
  '<rect x="730" y="350" width="470" height="190" fill="#1c1218" opacity=".5"/>'+
  pillars.join('')+steps.join('')+
  '<path d="M800 540L931 322H1042L1180 540Z" fill="#331921" opacity=".85"/>'+
  '<path d="M825 540L939 324H1033L1152 540Z" fill="#8b5131" opacity=".45"/>'+
  '<path d="M765 0H807L795 333L764 324Z" fill="url(#red)" stroke="#c7924d" stroke-width="3"/>'+
  '<path d="M1120 0H1170L1150 330L1115 323Z" fill="url(#red)" stroke="#c7924d" stroke-width="3"/>'+
  '<rect width="765" height="540" fill="url(#left)"/>'+
  '<path d="M0 0H590C450 84 640 218 453 540H0Z" fill="url(#red)" opacity=".49"/>'+
  '<path d="M0 0Q226 66 95 270Q28 380 0 540Z" fill="#a40928" opacity=".58"/>'+
  '<path d="M0 0Q166 88 45 360" stroke="#f9c478" stroke-width="9" opacity=".45" fill="none"/>'+
  '<path d="M40 43H730" stroke="url(#gold)" stroke-width="3" opacity=".7"/>'+
  '<path d="M0 505H1200" stroke="#cb904f" stroke-width="3" opacity=".65"/>'+
  '<path d="M0 519H1200" stroke="#5d351d" stroke-width="13" opacity=".7"/>'+
  '<g opacity=".55" fill="#ffe7a2"><circle cx="80" cy="70" r="2"/><circle cx="390" cy="92" r="2"/><circle cx="472" cy="460" r="3"/><circle cx="1100" cy="130" r="3"/><circle cx="1010" cy="450" r="2"/></g>'+
  '</svg>';
}
function foregroundSvg(memberName,count){
 const user=String(memberName||'Member').replace(/[\r\n\t]/g,' ').trim().slice(0,42)||'Member';
 const fontSize=user.length>24?25:user.length>17?30:user.length>12?34:39;
 const countValue=String(Math.max(0,Number(count)||0));
 return '<svg xmlns="http://www.w3.org/2000/svg" width="'+W+'" height="'+H+'" viewBox="0 0 1200 540">'+
 '<defs><linearGradient id="coin" x2=".8" y2="1"><stop stop-color="#fff2ca"/><stop offset=".34" stop-color="#a77728"/><stop offset=".63" stop-color="#f7d692"/><stop offset="1" stop-color="#ae761c"/></linearGradient>'+
 '<radialGradient id="inside"><stop stop-color="#602928"/><stop offset="1" stop-color="#100a12"/></radialGradient></defs>'+
 '<circle cx="208" cy="259" r="166" fill="#10080b" stroke="url(#coin)" stroke-width="13"/>'+
 '<circle cx="208" cy="259" r="147" fill="url(#inside)" stroke="#f0cc75" stroke-width="5"/>'+
 '<text x="208" y="305" font-size="104" text-anchor="middle" font-weight="900" font-family="DejaVu Sans, sans-serif" fill="url(#coin)" stroke="#4f2d0c" stroke-width="1.3">KIXO</text>'+
 '<path d="M168 91L170 62L194 79L210 47L227 79L254 62L254 91Z" fill="url(#coin)"/>'+
 '<circle cx="572" cy="232" r="111" fill="#0d0a0c" stroke="url(#coin)" stroke-width="10"/>'+
 '<circle cx="572" cy="232" r="99" fill="none" stroke="#f8df9e" stroke-width="2"/>'+
 '<rect x="405" y="355" width="342" height="115" rx="12" fill="#120b10" opacity=".69"/>'+
 '<path d="M415 413H730" stroke="#d3a85f" stroke-width="2"/>'+
 '<text x="572" y="395" text-anchor="middle" font-weight="800" font-size="'+fontSize+'" font-family="DejaVu Sans, sans-serif" fill="#fff4e7">'+escapeXml(user)+'</text>'+
 '<text x="572" y="453" text-anchor="middle" letter-spacing="5" font-size="19" font-family="DejaVu Sans, sans-serif" fill="#f4dbb1">MEMBER #'+escapeXml(countValue)+'</text>'+
 '</svg>';
}
async function avatarBuffer(member){
 const raw=member.user.displayAvatarURL?.({extension:'png',size:256})||'';
 if(!raw)return null;
 let uri;
 try{uri=new URL(raw)}catch{return null}
 if(uri.protocol!=='https:'||!['cdn.discordapp.com','media.discordapp.net'].includes(uri.hostname))return null;
 try{
  const response=await fetch(uri,{signal:AbortSignal.timeout(7000)});
  if(!response.ok)return null;
  const buf=Buffer.from(await response.arrayBuffer());
  if(buf.length>4*1024*1024)return null;
  return buf;
 }catch{return null}
}
async function renderWelcomeBanner(member,backgroundPath=''){
 const name=member.displayName||member.user.globalName||member.user.username||'Member';
 const count=member.guild.memberCount||0;
 let base;
 if(backgroundPath&&fs.existsSync(backgroundPath)){
  try{base=await sharp(backgroundPath).rotate().resize(W,H,{fit:'cover',position:'centre'}).png().toBuffer()}
  catch(err){console.warn('Invalid uploaded welcome background, using built-in design:',err.message)}
 }
 if(!base)base=await sharp(Buffer.from(backSvg())).png().toBuffer();
 // Dark left-side canvas makes usernames readable even with uploaded pictures.
 const panel=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="540"><defs><linearGradient id="p"><stop stop-color="#09050b" stop-opacity=".88"/><stop offset=".62" stop-color="#130812" stop-opacity=".86"/><stop offset=".8" stop-color="#1e0d16" stop-opacity=".32"/><stop offset="1" stop-color="#1e0d16" stop-opacity="0"/></linearGradient></defs><rect width="1200" height="540" fill="url(#p)"/></svg>');
 const background=await sharp(base).composite([{input:panel}]).png().toBuffer();
 const overlay=Buffer.from(foregroundSvg(name,count));
 const layers=[{input:overlay}];
 // Use the bot's own official KIXO avatar as the large left-side emblem.
 // It keeps the welcome card matched to the real logo without bundling static images.
 const botUser=member.guild?.client?.user;
 const guildIcon=!botUser&&typeof member.guild?.iconURL==='function'
   ?{displayAvatarURL:()=>member.guild.iconURL({extension:'png',size:512})}:null;
 const [avatar,logo]=await Promise.all([
   avatarBuffer(member),
   botUser||guildIcon?avatarBuffer({user:botUser||guildIcon}):Promise.resolve(null)
 ]);
 if(logo){
  try{
   const size=284;
   const mask=Buffer.from('<svg width="'+size+'" height="'+size+'" xmlns="http://www.w3.org/2000/svg"><circle cx="'+size/2+'" cy="'+size/2+'" r="'+size/2+'" fill="white"/></svg>');
   const badge=await sharp(logo).resize(size,size,{fit:'cover'}).composite([{input:mask,blend:'dest-in'}]).png().toBuffer();
   layers.push({input:badge,left:208-size/2,top:259-size/2});
  }catch(err){console.warn('Could not render the KIXO bot logo:',err.message)}
 }
 if(avatar){
  try{
   const size=AVATAR_SIZE;
   const mask=Buffer.from('<svg width="'+size+'" height="'+size+'" xmlns="http://www.w3.org/2000/svg"><circle cx="'+size/2+'" cy="'+size/2+'" r="'+size/2+'" fill="white"/></svg>');
   const photo=await sharp(avatar).resize(size,size,{fit:'cover'}).composite([{input:mask,blend:'dest-in'}]).png().toBuffer();
   // Avatar is placed inside the circular badge drawn by the overlay.
   layers.push({input:photo,left:572-size/2,top:232-size/2});
  }catch(err){console.warn('Could not render welcome member avatar:',err.message)}
 }
 return sharp(background).composite(layers).png().toBuffer();
}
module.exports={renderWelcomeBanner,backSvg,foregroundSvg,avatarBuffer};
