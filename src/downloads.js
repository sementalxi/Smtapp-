const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags, AttachmentBuilder, EmbedBuilder } = require('discord.js');
const FILE_DIR = path.resolve(process.env.DATA_DIR || './data', 'protected-downloads');
const attempts = new Map();
const MAX_IMAGE = 8 * 1024 * 1024;
const MAX_SIZE_MB = Math.min(500, Math.max(1, Number(process.env.PROTECTED_DOWNLOAD_MAX_MB) || 100));
const MAX_SIZE = Math.floor(MAX_SIZE_MB * 1024 * 1024);
function makeHash(password, salt) { return crypto.scryptSync(password, salt, 64).toString('hex'); }
function panel(record) {
  const embed = new EmbedBuilder().setColor(0xD90429).setTitle('🔐 ' + record.title).setDescription(record.caption || 'Press **Download** and enter the password to receive the file privately.').setFooter({text:'KIXO | GFX STUDIO • Protected Download'});
  if (record.imageName) embed.setImage('attachment://' + record.imageName);
  return {embeds:[embed], components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('download:open:' + record.id).setLabel('Download').setEmoji('📥').setStyle(ButtonStyle.Primary))]};
}
function getAll(store) { return store.data.protectedDownloads || (store.data.protectedDownloads = {}); }
async function handleCommand(interaction, store) {
  const sub = interaction.options.getSubcommand();
  if (sub === 'list') {
    const entries = Object.values(getAll(store));
    return interaction.reply({content: entries.length ? entries.map(x=>`**${x.title}** • ID: \`${x.id}\` • ${x.name}`).join('\n').slice(0,1900) : 'No protected downloads saved.', flags:MessageFlags.Ephemeral});
  }
  if (sub === 'edit') {
    const id = interaction.options.getString('id', true);
    const rec = getAll(store)[id];
    if (!rec) return interaction.reply({content:'Download ID not found. Use /download list.',flags:MessageFlags.Ephemeral});
    const caption = interaction.options.getString('caption');
    const picture = interaction.options.getAttachment('picture');
    const removePicture = interaction.options.getBoolean('remove_picture') === true;
    if (caption === null && !picture && !removePicture) return interaction.reply({content:'Choose a caption, picture, or remove_picture option.',flags:MessageFlags.Ephemeral});
    if (picture && removePicture) return interaction.reply({content:'Choose either a new picture or remove_picture, not both.',flags:MessageFlags.Ephemeral});
    if (picture && (!['image/png','image/jpeg','image/gif','image/webp'].includes(picture.contentType) || picture.size > MAX_IMAGE)) return interaction.reply({content:'Picture must be a PNG, JPG, GIF or WebP under 8 MB.',flags:MessageFlags.Ephemeral});
    const channelId = interaction.options.getChannel('channel')?.id || rec.channelId;
    const messageId = interaction.options.getString('message_id') || rec.messageId;
    if (!channelId || !messageId) return interaction.reply({content:'This is an older panel. Provide both `channel` and `message_id` from the posted Download message (Developer Mode → Copy Message ID).',flags:MessageFlags.Ephemeral});
    await interaction.deferReply({flags:MessageFlags.Ephemeral});
    const oldRec={...rec};
    try {
      const channel=await interaction.guild.channels.fetch(channelId);
      if (!channel?.messages?.fetch) throw new Error('Channel not found or inaccessible.');
      const message=await channel.messages.fetch(messageId);
      if (message.author.id !== interaction.client.user.id) throw new Error('The panel message must have been sent by this bot.');
      if (caption !== null) rec.caption=caption || 'Press **Download** and enter the password to receive the file privately.';
      if (removePicture) rec.imageName=null;
      let newPictureData=null;
      if (picture) {
        const response=await fetch(picture.url,{signal:AbortSignal.timeout(30000)});
        if (!response.ok) throw new Error('Could not retrieve picture from Discord.');
        newPictureData=Buffer.from(await response.arrayBuffer());
        if (newPictureData.length > MAX_IMAGE) throw new Error('Picture exceeds 8 MB.');
        const ext={'image/png':'.png','image/jpeg':'.jpg','image/gif':'.gif','image/webp':'.webp'}[picture.contentType];
        rec.imageName='panel-'+id+ext;
      }
      const existingPicturePath=path.join(FILE_DIR,id+'.image');
      const imageData=newPictureData || (rec.imageName && fs.existsSync(existingPicturePath) ? fs.readFileSync(existingPicturePath) : null);
      if (rec.imageName && !imageData) throw new Error('Previous panel picture is unavailable. Upload a new picture.');
      const updated=panel(rec);
      updated.attachments=[];
      if (imageData) updated.files=[new AttachmentBuilder(imageData,{name:rec.imageName})];
      await message.edit(updated);
      if (newPictureData) {fs.mkdirSync(FILE_DIR,{recursive:true});fs.writeFileSync(existingPicturePath,newPictureData);}
      if (removePicture) {try {fs.unlinkSync(existingPicturePath);}catch{}}
      rec.channelId=channelId;rec.messageId=messageId;
      store.save();
      return interaction.editReply('✅ Download panel updated. The password and stored file are unchanged.');
    } catch(e) {
      Object.assign(rec,oldRec);
      console.error('Download panel edit:',e);
      return interaction.editReply('Could not edit the Download panel: '+e.message);
    }
  }
  if (sub === 'remove') {
    const id = interaction.options.getString('id', true); const data = getAll(store); const rec = data[id];
    if (!rec) return interaction.reply({content:'Download ID not found.',flags:MessageFlags.Ephemeral});
    delete data[id]; store.save();
    try { fs.unlinkSync(path.join(FILE_DIR, id)); } catch {}
    try { fs.unlinkSync(path.join(FILE_DIR, id+'.image')); } catch {}
    return interaction.reply({content:'Download disabled. Its existing panel will no longer provide the file.',flags:MessageFlags.Ephemeral});
  }
  const attachment = interaction.options.getAttachment('file',true);
  const password = interaction.options.getString('password',true);
  const title = interaction.options.getString('title',true);
  const channel = interaction.options.getChannel('channel') || interaction.channel;
  if (!channel?.send) return interaction.reply({content:'Choose a text channel.',flags:MessageFlags.Ephemeral});
  if (attachment.size > MAX_SIZE) return interaction.reply({content:`File exceeds the configured ${MAX_SIZE_MB} MB download limit. Adjust PROTECTED_DOWNLOAD_MAX_MB on Railway if needed.`,flags:MessageFlags.Ephemeral});
  await interaction.deferReply({flags:MessageFlags.Ephemeral});
  const id = crypto.randomBytes(10).toString('hex');
  try {
    const response = await fetch(attachment.url, {signal:AbortSignal.timeout(30000)});
    if (!response.ok) throw new Error('Upload could not be retrieved from Discord.');
    const length = Number(response.headers.get('content-length') || 0);
    if (length > MAX_SIZE) throw new Error('File is too large.');
    const data = Buffer.from(await response.arrayBuffer());
    if (data.length > MAX_SIZE) throw new Error('File is too large.');
    fs.mkdirSync(FILE_DIR,{recursive:true});
    fs.writeFileSync(path.join(FILE_DIR,id),data,{flag:'wx',mode:0o600});
    const salt = crypto.randomBytes(16).toString('hex');
    const rec = {id,title,name:path.basename(attachment.name || 'download.bin').slice(0,120),salt,hash:makeHash(password,salt),createdBy:interaction.user.id};
    getAll(store)[id]=rec;store.save();
    try {const posted = await channel.send(panel(rec)); rec.channelId=posted.channelId;rec.messageId=posted.id;store.save();} catch(e) {delete getAll(store)[id];store.save();fs.unlinkSync(path.join(FILE_DIR,id));throw e;}
    return interaction.editReply(`✅ Protected download published in <#${channel.id}>. ID: \`${id}\`. Store the password somewhere safe; it cannot be recovered.`);
  } catch(e) {console.error('Protected download setup:',e);return interaction.editReply('Could not publish file: '+ e.message);}
}
async function handleInteraction(interaction, store) {
  if (interaction.isButton() && interaction.customId.startsWith('download:open:')) {
    const id=interaction.customId.slice('download:open:'.length);
    const rec=getAll(store)[id];
    if (!rec || !fs.existsSync(path.join(FILE_DIR,id))) return interaction.reply({content:'This file is no longer available.',flags:MessageFlags.Ephemeral});
    const modal=new ModalBuilder().setCustomId('download:password:'+id).setTitle('KIXO • Password Required');
    modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('password').setLabel('Enter download password').setStyle(TextInputStyle.Short).setRequired(true).setMinLength(1).setMaxLength(100)));
    return interaction.showModal(modal);
  }
  if (interaction.isModalSubmit() && interaction.customId.startsWith('download:password:')) {
    const id=interaction.customId.slice('download:password:'.length);
    const rec=getAll(store)[id];
    if (!rec) return interaction.reply({content:'This download is unavailable.',flags:MessageFlags.Ephemeral});
    const key=`${id}:${interaction.user.id}`; const previous=attempts.get(key) || {count:0,until:0};
    if (previous.until > Date.now()) return interaction.reply({content:'Too many incorrect attempts. Please try again in 15 minutes.',flags:MessageFlags.Ephemeral});
    const input=interaction.fields.getTextInputValue('password');
    const valid=crypto.timingSafeEqual(Buffer.from(makeHash(input,rec.salt),'hex'),Buffer.from(rec.hash,'hex'));
    if (!valid) { const count=previous.count+1; attempts.set(key,{count:count>=5?0:count,until:count>=5?Date.now()+15*60*1000:0}); return interaction.reply({content:count>=5?'Incorrect password. Try again in 15 minutes.':'Incorrect password. Please try again.',flags:MessageFlags.Ephemeral}); }
    attempts.delete(key);
    const file=path.join(FILE_DIR,id);
    if (!fs.existsSync(file)) return interaction.reply({content:'File is temporarily unavailable. Contact staff.',flags:MessageFlags.Ephemeral});
    await interaction.deferReply({flags:MessageFlags.Ephemeral});
    try { return await interaction.editReply({content:`✅ Password accepted. Your file: **${rec.name}**`,files:[new AttachmentBuilder(file,{name:rec.name})]}); }
    catch(e) {console.error('Protected download delivery:',e);return interaction.editReply('Password accepted, but Discord rejected the file delivery. Your server or bot may have a lower attachment upload limit. Ask staff to use a smaller file or an external protected hosting solution.');}
  }
  return false;
}
module.exports={handleCommand,handleInteraction};
