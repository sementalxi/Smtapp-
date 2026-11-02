'use strict';
// Image assets are kept on Railway's persistent DATA_DIR volume. The JSON
// database stores relative references only; no base64 blobs or public URLs.
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const { AttachmentBuilder }=require('discord.js');
const { DATA_DIR }=require('./store');
const DIR=path.join(DATA_DIR,'admin-images');
const MAX_BYTES=4*1024*1024;
const REF=/^admin-images\/[a-z][a-z0-9-]{0,60}-[a-f0-9]{24}\.(png|jpg|webp|gif)$/;
const VALID_NAME=/^[a-z][a-zA-Z0-9]{1,59}$/;
function decode(data){
  if(typeof data!=='string'||data.length>6*1024*1024)throw Error('Image exceeds 4 MB.');
  const match=/^data:image\/(png|jpeg|jpg|webp|gif);base64,([A-Za-z0-9+/=]+)$/.exec(data);
  if(!match)throw Error('Upload PNG, JPG, WEBP or GIF.');
  const ext=match[1]==='jpeg'?'jpg':match[1],bytes=Buffer.from(match[2],'base64');
  if(!bytes.length||bytes.length>MAX_BYTES)throw Error('Image exceeds 4 MB.');
  const ok=ext==='png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):
    ext==='jpg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:
    ext==='gif'?['GIF87a','GIF89a'].includes(bytes.toString('ascii',0,6)):
    bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
  if(!ok)throw Error('Invalid image file content.');
  return {bytes,ext};
}
function nameFor(key){return String(key).replace(/[A-Z]/g,c=>'-'+c.toLowerCase()).replace(/[^a-z0-9-]/g,'').slice(0,58);}
function validRef(ref){return typeof ref==='string'&&REF.test(ref)}
function fileFor(ref){
  if(!validRef(ref))return null;
  const full=path.join(DATA_DIR,ref);
  return fs.existsSync(full)?full:null;
}
function attach(embed,ref,placement,files){
  const full=fileFor(ref);
  if(!full)return false;
  const filename=path.basename(full);
  if(placement==='thumbnail')embed.setThumbnail('attachment://'+filename);
  else embed.setImage('attachment://'+filename);
  files.push(new AttachmentBuilder(full,{name:filename}));
  return true;
}
function prepare(current={},input={},keys=[]){
  const patch={...input},created=[],obsolete=[];
  try{
    for(const key of keys){
      if(!VALID_NAME.test(key))throw Error('Invalid image field.');
      const data=key+'Data',remove=key+'Remove',file=key+'File',url=key+'Url';
      // Ref values must never be supplied by the website.
      delete patch[file];
      const image=input[data];const clear=input[remove]===true;
      delete patch[data];delete patch[remove];
      if(image){
        const {bytes,ext}=decode(image);
        fs.mkdirSync(DIR,{recursive:true});
        const ref='admin-images/'+nameFor(key)+'-'+crypto.randomBytes(12).toString('hex')+'.'+ext;
        const full=path.join(DATA_DIR,ref);
        fs.writeFileSync(full,bytes,{flag:'wx',mode:0o600});
        created.push(full);
        patch[file]=ref;
        patch[url]='';
      }else if(clear){patch[file]='';patch[url]='';}
      else if(Object.prototype.hasOwnProperty.call(input,url)&&String(input[url]||'').trim()!==String(current[url]||'').trim()&&input[url]){
        // Explicit URL replacement still supports existing integrations.
        patch[file]='';
      }
      if(Object.prototype.hasOwnProperty.call(patch,file)&&validRef(current[file]))obsolete.push(path.join(DATA_DIR,current[file]));
    }
  }catch(err){for(const f of created)try{fs.unlinkSync(f)}catch{};throw err;}
  return {
    patch,
    rollback(){for(const f of created)try{fs.unlinkSync(f)}catch{}},
    complete(){for(const f of obsolete)try{fs.unlinkSync(f)}catch(e){console.warn('Image cleanup:',e.message)}}
  };
}
module.exports={decode,prepare,attach,fileFor,validRef,MAX_BYTES};
