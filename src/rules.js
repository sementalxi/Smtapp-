const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const media = require('./admin-media');
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  MessageFlags
} = require('discord.js');

const RULES_DATA_DIR = path.resolve(process.env.RULES_DATA_DIR || process.env.DATA_DIR || './data');
const RULES_FILE = path.join(RULES_DATA_DIR, 'rules-panels.json');

// Temporary in-memory registry for private rules views so the bottom Close button
// can remove every ephemeral message that belongs to the same opened rules view.
// The saved rules themselves still live on /data; this registry only tracks the
// short-lived Discord messages created when a member opens a panel.
const openRuleViews = new Map();

function createRuleViewSession(interaction) {
  const id = crypto.randomBytes(6).toString('hex');
  const session = {
    id,
    userId: interaction.user?.id || null,
    webhook: interaction.webhook,
    messageIds: [],
    createdAt: Date.now()
  };
  openRuleViews.set(id, session);
  const timer = setTimeout(() => openRuleViews.delete(id), 60 * 60 * 1000);
  timer.unref?.();
  return session;
}

function closeRuleRow(lang, sessionId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`rules:closeview:${sessionId}`)
      .setLabel(lang === 'es' ? 'Cerrar' : 'Close')
      .setEmoji('✖️')
      .setStyle(ButtonStyle.Danger)
  );
}

function now() { return new Date().toISOString(); }
function shortId(prefix = 'rp') { return `${prefix}_${crypto.randomBytes(4).toString('hex')}`; }
function clean(v = '') { return String(v ?? '').trim(); }
function clamp(v, n) { return String(v ?? '').slice(0, n); }
function color(v, fallback) {
  const s = clean(v);
  if (/^#?[0-9a-f]{6}$/i.test(s)) return s.startsWith('#') ? s : `#${s}`;
  return fallback;
}
function styleName(v, fallback = 'Primary') {
  const s = clean(v).toLowerCase();
  const map = { primary:'Primary', blue:'Primary', secondary:'Secondary', gray:'Secondary', grey:'Secondary', success:'Success', green:'Success', danger:'Danger', red:'Danger' };
  return map[s] || fallback;
}
function styleValue(v) { return ButtonStyle[styleName(v)] || ButtonStyle.Primary; }

function panelToken(panel) {
  return crypto.createHash('sha256').update(String(panel?.id || '')).digest('hex').slice(0, 16);
}
function findPanelByToken(store, value) {
  const direct = store.find(value);
  if (direct) return direct;
  const q = clean(value);
  return store.list().find(p => panelToken(p) === q) || null;
}

function normalizeRule(item, i = 0) {
  if (typeof item === 'string') return { id: shortId('r'), title: `Rule ${i + 1}`, body: item };
  const x = item || {};
  return {
    id: clean(x.id) || shortId('r'),
    title: clean(x.title || x.name || x.heading) || `Rule ${i + 1}`,
    body: clean(x.body || x.text || x.description || x.content || x.rule)
  };
}
function normalizeRules(v) {
  if (!v) return [];
  if (typeof v === 'string') return v.split(/\n\s*\n|\n(?=\s*\d+[.)-]?\s+)/).map((x,i)=>normalizeRule(x,i)).filter(x=>x.body);
  if (Array.isArray(v)) return v.map(normalizeRule).filter(x=>x.body || x.title);
  if (typeof v === 'object') return Object.values(v).map(normalizeRule).filter(x=>x.body || x.title);
  return [];
}
function normalizePublication(x) {
  if (!x) return null;
  if (typeof x === 'string') return null;
  const channelId = clean(x.channelId || x.channel_id || x.channel);
  const messageId = clean(x.messageId || x.message_id || x.message);
  if (!channelId || !messageId) return null;
  return { id: clean(x.id) || shortId('pub'), channelId, messageId, createdAt: x.createdAt || x.created_at || now() };
}
function normalizePanel(raw, key, i = 0) {
  const p = raw || {};
  const id = clean(p.id || p.panelId || p.panel_id || key) || shortId('panel');
  const rulesObj = p.rules && !Array.isArray(p.rules) ? p.rules : {};
  const english = p.englishRules ?? p.rulesEnglish ?? p.enRules ?? p.english ?? rulesObj.en ?? rulesObj.english ?? (Array.isArray(p.rules) ? p.rules : []);
  const spanish = p.spanishRules ?? p.rulesSpanish ?? p.esRules ?? p.spanish ?? rulesObj.es ?? rulesObj.spanish ?? [];
  const pubs = [];
  const pubCandidates = p.publications || p.publishedMessages || p.messages || [];
  if (Array.isArray(pubCandidates)) for (const x of pubCandidates) { const n = normalizePublication(x); if (n) pubs.push(n); }
  if (p.channelId && p.messageId) pubs.push(normalizePublication({ channelId:p.channelId, messageId:p.messageId }));
  if (p.publishedChannelId && p.publishedMessageId) pubs.push(normalizePublication({ channelId:p.publishedChannelId, messageId:p.publishedMessageId }));
  const c = p.colors || {};
  const bs = p.buttonStyles || p.buttons || {};
  return {
    id,
    name: clean(p.name || p.panelName || p.label || p.title) || `Rules Panel ${i + 1}`,
    title: clean(p.title || p.header || p.panelTitle || p.panel_title) || 'KIXO RULES',
    bio: clean(p.bio || p.description || p.subtitle) || 'Choose your language to view the official server rules.',
    bannerUrl: clean(p.bannerUrl || p.banner || p.imageUrl || p.image || p.banner_url),
    thumbnailUrl: clean(p.thumbnailUrl || p.thumbnail || p.logoUrl || p.logo || p.iconUrl || p.thumbnail_url),
    bannerFile:media.validRef(p.bannerFile)?p.bannerFile:'',
    thumbnailFile:media.validRef(p.thumbnailFile)?p.thumbnailFile:'',
    colors: {
      panel: color(c.panel || c.main || p.panelColor || p.mainColor || p.color, '#FF2D8B'),
      en: color(c.en || c.english || p.englishColor || p.enColor, '#2563eb'),
      es: color(c.es || c.spanish || p.spanishColor || p.esColor, '#FF2D8B')
    },
    buttonStyles: {
      en: styleName(bs.en || bs.english || p.englishButtonStyle || p.enButtonStyle, 'Primary'),
      es: styleName(bs.es || bs.spanish || p.spanishButtonStyle || p.esButtonStyle, 'Danger')
    },
    rules: { en: normalizeRules(english), es: normalizeRules(spanish) },
    publications: pubs.filter(Boolean),
    createdAt: p.createdAt || p.created_at || now(),
    updatedAt: p.updatedAt || p.updated_at || now()
  };
}

class RulesStore {
  constructor() {
    fs.mkdirSync(RULES_DATA_DIR, { recursive: true });
    this.data = { version: 4, panels: {} };
    this.load();
  }
  load() {
    if (!fs.existsSync(RULES_FILE)) return this.save();
    try {
      const raw = JSON.parse(fs.readFileSync(RULES_FILE, 'utf8'));
      const source = raw.panels ?? raw.rulePanels ?? raw.data ?? raw;
      const entries = Array.isArray(source) ? source.map((v,i)=>[v?.id || String(i),v]) : Object.entries(source || {});
      const panels = {};
      entries.forEach(([k,v],i)=>{ if (!v || typeof v !== 'object') return; const p = normalizePanel(v,k,i); panels[p.id] = p; });
      this.data = { version: 4, panels };
      this.save();
    } catch (e) {
      console.error('Could not read rules-panels.json:', e.message);
      this.data = { version:4, panels:{} };
    }
  }
  save() {
    fs.mkdirSync(RULES_DATA_DIR, { recursive: true });
    const tmp = `${RULES_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
    fs.renameSync(tmp, RULES_FILE);
  }
  list() { return Object.values(this.data.panels).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)); }
  find(value) {
    const q = clean(value).toLowerCase();
    if (!q) return this.list()[0] || null;
    return this.data.panels[value] || this.list().find(p => p.name.toLowerCase() === q || p.title.toLowerCase() === q || p.id.toLowerCase() === q) || this.list().find(p => p.name.toLowerCase().includes(q)) || null;
  }
  create(name) {
    const p = normalizePanel({ id:shortId('panel'), name, title:name || 'KIXO RULES' }, null, this.list().length);
    this.data.panels[p.id] = p; this.save(); return p;
  }
  touch(panel) { panel.updatedAt = now(); this.save(); return panel; }
  remove(id) { delete this.data.panels[id]; this.save(); }
}

function publicPanelPayload(panel) {
  const e = new EmbedBuilder().setColor(panel.colors.panel).setTitle(clamp(panel.title,256)).setDescription(clamp(panel.bio,4096)).setFooter({text:'KIXO • COMPETE WITH RESPECT • PLAY TO WIN'});
  const files=[];
  if(!media.attach(e,panel.thumbnailFile,'thumbnail',files)&&panel.thumbnailUrl)e.setThumbnail(panel.thumbnailUrl);
  if(!media.attach(e,panel.bannerFile,'image',files)&&panel.bannerUrl)e.setImage(panel.bannerUrl);
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`rules:view:${panelToken(panel)}:en`).setLabel('English').setEmoji('🇺🇸').setStyle(styleValue(panel.buttonStyles.en)),
    new ButtonBuilder().setCustomId(`rules:view:${panelToken(panel)}:es`).setLabel('Español').setEmoji('🇲🇽').setStyle(styleValue(panel.buttonStyles.es))
  );
  return { embeds:[e], components:[row],files };
}

function rulesText(panel, lang) {
  const arr = panel.rules[lang] || [];
  const title = lang === 'es' ? '📜 REGLAS DE KIXO' : '📜 KIXO RULES';
  const lines = arr.map((r,i)=>`**${i+1}. ${r.title || (lang==='es'?'Regla':'Rule')}**\n${r.body}`);
  return { title, text: lines.join('\n\n') || (lang === 'es' ? 'Todavía no hay reglas publicadas para este panel.' : 'No rules have been published for this panel yet.') };
}

// Continuous rules display.
// Rules are packed into the same embed until Discord's embed-description limit
// is reached. Only then does the viewer continue in another embed/message.
function splitLongText(text, max = 3900) {
  const input = String(text || '').trim();
  if (!input) return [''];
  const out = [];
  let remaining = input;
  while (remaining.length > max) {
    let cut = max;
    const para = remaining.lastIndexOf('\n\n', max);
    const line = remaining.lastIndexOf('\n', max);
    const space = remaining.lastIndexOf(' ', max);
    const boundary = Math.max(para, line, space);
    if (boundary > Math.floor(max * 0.55)) cut = boundary;
    out.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }
  if (remaining || !out.length) out.push(remaining);
  return out;
}

function continuousRuleChunks(panel, lang, max = 3900) {
  const arr = panel.rules[lang] || [];
  const empty = lang === 'es'
    ? 'Todavía no hay reglas publicadas para este panel.'
    : 'No rules have been published for this panel yet.';

  if (!arr.length) return [empty];

  const chunks = [];
  let current = '';

  const pushCurrent = () => {
    if (current.trim()) chunks.push(current.trim());
    current = '';
  };

  for (let i = 0; i < arr.length; i++) {
    const rule = arr[i];
    const heading = `**${i + 1}. ${rule.title || (lang === 'es' ? 'Regla' : 'Rule')}**`;
    const block = `${heading}\n${String(rule.body || '').trim()}`.trim();

    // If one rule is itself longer than one embed, split only that oversized
    // rule and continue it naturally; normal rules stay together.
    if (block.length > max) {
      pushCurrent();
      const pieces = splitLongText(block, max);
      for (let part = 0; part < pieces.length; part++) {
        if (part === 0) chunks.push(pieces[part]);
        else {
          const continuation = lang === 'es' ? '*Continuación…*' : '*Continued…*';
          const available = Math.max(500, max - continuation.length - 2);
          const sub = splitLongText(pieces[part], available);
          sub.forEach((x, j) => chunks.push(`${continuation}\n${x}`));
        }
      }
      continue;
    }

    const candidate = current ? `${current}\n\n${block}` : block;
    if (candidate.length <= max) {
      current = candidate;
    } else {
      pushCurrent();
      current = block;
    }
  }

  pushCurrent();
  return chunks.length ? chunks : [empty];
}

function buildContinuousRuleEmbeds(panel, lang) {
  const c = lang === 'es' ? panel.colors.es : panel.colors.en;
  const title = lang === 'es' ? '📜 REGLAS DE KIXO' : '📜 KIXO RULES';
  const chunks = continuousRuleChunks(panel, lang, 3900);

  return chunks.map((chunk, i) => {
    const e = new EmbedBuilder()
      .setColor(c)
      .setDescription(clamp(chunk || '—', 4096));

    if (i === 0) {
      e.setTitle(clamp(title, 256));
      if (panel.thumbnailUrl) { try { e.setThumbnail(panel.thumbnailUrl); } catch {} }
      // Keep the large banner on the public rules panel only.
      // The private/opened rules view is intentionally text-first so members
      // do not see the large panel image again after pressing English/Español.
    } else {
      const continuationTitle = lang === 'es'
        ? `${title} • CONTINUACIÓN`
        : `${title} • CONTINUED`;
      e.setTitle(clamp(continuationTitle, 256));
    }

    if (i === chunks.length - 1) {
      e.setFooter({ text: 'KIXO • COMPETE WITH RESPECT • PLAY TO WIN' });
    }
    return e;
  });
}

function embedCharCount(embed) {
  const j = typeof embed.toJSON === 'function' ? embed.toJSON() : embed;
  let n = 0;
  n += String(j.title || '').length;
  n += String(j.description || '').length;
  n += String(j.footer?.text || '').length;
  n += String(j.author?.name || '').length;
  for (const f of (j.fields || [])) n += String(f.name || '').length + String(f.value || '').length;
  return n;
}

function continuousRuleGroups(panel, lang) {
  const embeds = buildContinuousRuleEmbeds(panel, lang);
  const groups = [];
  let current = [];
  let chars = 0;

  for (const embed of embeds) {
    const size = embedCharCount(embed);
    // Discord allows up to 10 embeds and 6000 aggregate embed characters per message.
    // Because each rules embed is filled close to the 4096 description limit,
    // continuation embeds usually become a new ephemeral follow-up message.
    if (current.length && (current.length >= 10 || chars + size > 5900)) {
      groups.push(current);
      current = [];
      chars = 0;
    }
    current.push(embed);
    chars += size;
  }
  if (current.length) groups.push(current);
  return groups;
}

async function sendSeparateRules(interaction, panel, lang) {
  const groups = continuousRuleGroups(panel, lang);
  if (!groups.length) return;

  const session = createRuleViewSession(interaction);
  const lastIndex = groups.length - 1;

  try {
    let firstMessage;
    const firstComponents = lastIndex === 0 ? [closeRuleRow(lang, session.id)] : [];

    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      firstMessage = await interaction.editReply({ embeds: groups[0], components: firstComponents });
    } else {
      firstMessage = await interaction.followUp({ embeds: groups[0], components: firstComponents, flags: MessageFlags.Ephemeral });
    }
    if (firstMessage?.id) session.messageIds.push(firstMessage.id);

    for (let i = 1; i < groups.length; i++) {
      const isLast = i === lastIndex;
      const msg = await interaction.followUp({
        embeds: groups[i],
        components: isLast ? [closeRuleRow(lang, session.id)] : [],
        flags: MessageFlags.Ephemeral
      });
      if (msg?.id) session.messageIds.push(msg.id);
    }
  } catch (error) {
    openRuleViews.delete(session.id);
    throw error;
  }
}

// Kept for compatibility with older imports.
function privateRulesPayload(panel, lang) {
  const groups = continuousRuleGroups(panel, lang);
  return { embeds: groups[0] || [], components: [], flags: MessageFlags.Ephemeral };
}

function editorEmbed(panel, lang='en') {
  const rules = panel.rules[lang] || [];
  const langName = lang==='es'?'Español':'English';
  const preview = rules.slice(0,15).map((r,i)=>`**${i+1}.** ${clamp(r.title,70)}`).join('\n') || '*No rules yet.*';
  return new EmbedBuilder().setColor(lang==='es'?panel.colors.es:panel.colors.en).setTitle(`⚙️ ${panel.name} • Rules Editor`).setDescription(`Editing **${langName}** rules\n\n${preview}`).addFields({name:'Panel ID',value:`\`${panel.id}\``,inline:true},{name:'Rules',value:String(rules.length),inline:true},{name:'Published copies',value:String(panel.publications.length),inline:true}).setFooter({text:'Add, edit, delete, and move rules without recreating the panel.'});
}
function editorComponents(panel, lang='en') {
  const rows = [];
  rows.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`rules:editlang:${panel.id}:en`).setLabel('English').setEmoji('🇺🇸').setStyle(lang==='en'?ButtonStyle.Primary:ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`rules:editlang:${panel.id}:es`).setLabel('Español').setEmoji('🇲🇽').setStyle(lang==='es'?ButtonStyle.Danger:ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`rules:add:${panel.id}:${lang}`).setLabel('Add Rule').setEmoji('➕').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`rules:design:${panel.id}`).setLabel('Design').setEmoji('🎨').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`rules:preview:${panel.id}`).setLabel('Preview').setEmoji('👁️').setStyle(ButtonStyle.Secondary)
  ));
  const rules = panel.rules[lang] || [];
  if (rules.length) {
    rows.push(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`rules:select:${panel.id}:${lang}`).setPlaceholder('Select a rule to edit / move / delete').addOptions(rules.slice(0,25).map((r,i)=>({label:clamp(`${i+1}. ${r.title}`,100),value:r.id,description:clamp(r.body.replace(/\s+/g,' '),100)||'Rule'})))));
  }
  return rows;
}
function editorPayload(panel, lang='en') { return { embeds:[editorEmbed(panel,lang)], components:editorComponents(panel,lang), flags:MessageFlags.Ephemeral }; }

function addRuleModal(panel, lang, existing=null) {
  const editing = !!existing;
  const m = new ModalBuilder().setCustomId(`rules:${editing?'editmodal':'addmodal'}:${panel.id}:${lang}${editing?`:${existing.id}`:''}`).setTitle(`${editing?'Edit':'Add'} ${lang==='es'?'Spanish':'English'} Rule`);
  const title = new TextInputBuilder().setCustomId('title').setLabel(lang==='es'?'Título de la regla':'Rule title').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100).setValue(clamp(existing?.title||'',100));
  const body = new TextInputBuilder().setCustomId('body').setLabel(lang==='es'?'Texto de la regla':'Rule text').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(3500).setValue(clamp(existing?.body||'',3500));
  m.addComponents(new ActionRowBuilder().addComponents(title),new ActionRowBuilder().addComponents(body));
  return m;
}

function designMenuPayload(panel) {
  const e = new EmbedBuilder().setColor(panel.colors.panel).setTitle(`🎨 ${panel.name} • Design Menu`).setDescription('Edit the title/header, bio, banner, right-side logo, colors, and the English/Spanish button styles.').addFields(
    {name:'Header',value:panel.title||'—'},
    {name:'Main / EN / ES Colors',value:`${panel.colors.panel} • ${panel.colors.en} • ${panel.colors.es}`,inline:false},
    {name:'Buttons',value:`English: **${panel.buttonStyles.en}**\nEspañol: **${panel.buttonStyles.es}**`,inline:false}
  );
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`rules:designheader:${panel.id}`).setLabel('Header & Media').setEmoji('🖼️').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`rules:designcolors:${panel.id}`).setLabel('Colors').setEmoji('🎨').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`rules:back:${panel.id}:en`).setLabel('Back to Rules').setStyle(ButtonStyle.Secondary)
  );
  const en = new StringSelectMenuBuilder().setCustomId(`rules:buttonstyle:${panel.id}:en`).setPlaceholder(`English button: ${panel.buttonStyles.en}`).addOptions(['Primary','Secondary','Success','Danger'].map(x=>({label:x,value:x,default:x===panel.buttonStyles.en})));
  const es = new StringSelectMenuBuilder().setCustomId(`rules:buttonstyle:${panel.id}:es`).setPlaceholder(`Español button: ${panel.buttonStyles.es}`).addOptions(['Primary','Secondary','Success','Danger'].map(x=>({label:x,value:x,default:x===panel.buttonStyles.es})));
  return { embeds:[e], components:[row1,new ActionRowBuilder().addComponents(en),new ActionRowBuilder().addComponents(es)], flags:MessageFlags.Ephemeral };
}
function headerModal(panel) {
  const m = new ModalBuilder().setCustomId(`rules:headermodal:${panel.id}`).setTitle('Rules Panel • Header & Media');
  const inputs = [
    new TextInputBuilder().setCustomId('title').setLabel('Panel title / header').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(256).setValue(clamp(panel.title,256)),
    new TextInputBuilder().setCustomId('bio').setLabel('Bio / description').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(2000).setValue(clamp(panel.bio,2000)),
    new TextInputBuilder().setCustomId('banner').setLabel('Large banner URL (optional)').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(1000).setValue(clamp(panel.bannerUrl,1000)),
    new TextInputBuilder().setCustomId('thumbnail').setLabel('Right-side logo / thumbnail URL').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(1000).setValue(clamp(panel.thumbnailUrl,1000))
  ];
  m.addComponents(...inputs.map(x=>new ActionRowBuilder().addComponents(x))); return m;
}
function colorsModal(panel) {
  const m = new ModalBuilder().setCustomId(`rules:colorsmodal:${panel.id}`).setTitle('Rules Panel • Colors');
  const inputs = [
    new TextInputBuilder().setCustomId('panel').setLabel('Main panel color (#RRGGBB)').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(7).setValue(panel.colors.panel),
    new TextInputBuilder().setCustomId('en').setLabel('English rules color (#RRGGBB)').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(7).setValue(panel.colors.en),
    new TextInputBuilder().setCustomId('es').setLabel('Spanish rules color (#RRGGBB)').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(7).setValue(panel.colors.es)
  ];
  m.addComponents(...inputs.map(x=>new ActionRowBuilder().addComponents(x))); return m;
}

function ruleActionPayload(panel, lang, ruleId) {
  const arr = panel.rules[lang] || []; const idx = arr.findIndex(x=>x.id===ruleId); const r = arr[idx];
  if (!r) return editorPayload(panel,lang);
  const e = new EmbedBuilder().setColor(lang==='es'?panel.colors.es:panel.colors.en).setTitle(`${idx+1}. ${r.title}`).setDescription(r.body).setFooter({text:`${lang==='es'?'Español':'English'} • Rule ${idx+1} of ${arr.length}`});
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`rules:editrule:${panel.id}:${lang}:${r.id}`).setLabel('Edit').setEmoji('✏️').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`rules:up:${panel.id}:${lang}:${r.id}`).setLabel('Move Up').setEmoji('⬆️').setStyle(ButtonStyle.Secondary).setDisabled(idx===0),
    new ButtonBuilder().setCustomId(`rules:down:${panel.id}:${lang}:${r.id}`).setLabel('Move Down').setEmoji('⬇️').setStyle(ButtonStyle.Secondary).setDisabled(idx===arr.length-1),
    new ButtonBuilder().setCustomId(`rules:delete:${panel.id}:${lang}:${r.id}`).setLabel('Delete').setEmoji('🗑️').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`rules:back:${panel.id}:${lang}`).setLabel('Back').setStyle(ButtonStyle.Secondary)
  );
  return { embeds:[e], components:[row], flags:MessageFlags.Ephemeral };
}

async function refreshPublishedPanel(client, panel, rulesStore) {
  const kept = [];
  let updated = 0, stale = 0;
  for (const pub of panel.publications || []) {
    try {
      const ch = await client.channels.fetch(pub.channelId);
      if (!ch?.isTextBased()) { stale++; continue; }
      const msg = await ch.messages.fetch(pub.messageId);
      await msg.edit({...publicPanelPayload(panel),attachments:[]});
      kept.push(pub);
      updated++;
    } catch { stale++; }
  }
  if (kept.length !== (panel.publications || []).length) { panel.publications = kept; rulesStore.touch(panel); }
  return { updated, stale };
}

async function deletePublishedMessages(client, panel) {
  for (const pub of panel.publications) {
    try { const ch=await client.channels.fetch(pub.channelId); const msg=await ch?.messages?.fetch(pub.messageId); await msg?.delete(); } catch {}
  }
}

async function handleRulesInteraction(interaction, rulesStore, client, isStaffFn) {
  const staff = () => isStaffFn(interaction);
  if (interaction.isButton()) {
    const parts = interaction.customId.split(':');
    if (parts[0] !== 'rules') return false;
    const action = parts[1];
    if (action === 'view') {
      const panel = findPanelByToken(rulesStore, parts[2]); const lang = parts[3] === 'es' ? 'es' : 'en';
      if (!panel) await interaction.reply({ content:'This rules panel no longer exists.', flags: MessageFlags.Ephemeral });
      else await sendSeparateRules(interaction, panel, lang);
      return true;
    }
    // Compatibility for a member who still has an older paginated ephemeral
    // message open: clicking one of those buttons reopens the complete separated view.
    if (action === 'page') {
      const panel = findPanelByToken(rulesStore, parts[2]); const lang = parts[3] === 'es' ? 'es' : 'en';
      if (!panel) await interaction.reply({ content:'This rules panel no longer exists.', flags: MessageFlags.Ephemeral }).catch(()=>{});
      else {
        await interaction.deferUpdate().catch(()=>{});
        await sendSeparateRules(interaction, panel, lang);
      }
      return true;
    }
    if (action === 'pageinfo' || action === 'dismiss') { await interaction.deferUpdate().catch(()=>{}); return true; }
    if (action === 'closeview') {
      const sessionId = parts[2];
      const session = openRuleViews.get(sessionId);
      if (session?.userId && session.userId !== interaction.user.id) {
        await interaction.reply({ content:'This rules view belongs to another member.', flags:MessageFlags.Ephemeral }).catch(()=>{});
        return true;
      }

      await interaction.deferUpdate().catch(()=>{});

      if (session) {
        // Delete from the bottom upward so the button message disappears first.
        for (const messageId of [...session.messageIds].reverse()) {
          await session.webhook?.deleteMessage(messageId).catch(()=>{});
        }
        openRuleViews.delete(sessionId);
      } else {
        // Session may have expired after a long time. At minimum, remove the
        // contents/buttons from the message where Close was clicked.
        await interaction.message?.edit?.({ content:'Rules closed.', embeds:[], components:[] }).catch(()=>{});
      }
      return true;
    }
    if (!staff()) { await interaction.reply({content:'Staff only.',flags:MessageFlags.Ephemeral}); return true; }
    const panel = findPanelByToken(rulesStore, parts[2]); if (!panel) { await interaction.reply({content:'Rules panel not found.',flags:MessageFlags.Ephemeral}); return true; }
    if (action === 'editlang' || action === 'back') { const lang=parts[3]==='es'?'es':'en'; await interaction.update(editorPayload(panel,lang)); return true; }
    if (action === 'add') { await interaction.showModal(addRuleModal(panel,parts[3]==='es'?'es':'en')); return true; }
    if (action === 'design') { await interaction.update(designMenuPayload(panel)); return true; }
    if (action === 'designheader') { await interaction.showModal(headerModal(panel)); return true; }
    if (action === 'designcolors') { await interaction.showModal(colorsModal(panel)); return true; }
    if (action === 'preview') { await interaction.reply({...publicPanelPayload(panel),flags:MessageFlags.Ephemeral}); return true; }
    if (['editrule','up','down','delete'].includes(action)) {
      const lang=parts[3]==='es'?'es':'en', ruleId=parts[4], arr=panel.rules[lang], idx=arr.findIndex(x=>x.id===ruleId);
      if (idx<0) { await interaction.update(editorPayload(panel,lang)); return true; }
      if (action==='editrule') { await interaction.showModal(addRuleModal(panel,lang,arr[idx])); return true; }
      if (action==='up' && idx>0) [arr[idx-1],arr[idx]]=[arr[idx],arr[idx-1]];
      if (action==='down' && idx<arr.length-1) [arr[idx+1],arr[idx]]=[arr[idx],arr[idx+1]];
      if (action==='delete') arr.splice(idx,1);
      rulesStore.touch(panel);
      await interaction.update(editorPayload(panel,lang));
      return true;
    }
    return false;
  }
  if (interaction.isStringSelectMenu()) {
    const parts=interaction.customId.split(':'); if(parts[0]!=='rules') return false;
    if(!staff()) { await interaction.reply({content:'Staff only.',flags:MessageFlags.Ephemeral}); return true; }
    const action=parts[1], panel=findPanelByToken(rulesStore, parts[2]); if(!panel){ await interaction.reply({content:'Rules panel not found.',flags:MessageFlags.Ephemeral}); return true; }
    if(action==='select') { await interaction.update(ruleActionPayload(panel,parts[3]==='es'?'es':'en',interaction.values[0])); return true; }
    if(action==='buttonstyle') { const lang=parts[3]==='es'?'es':'en'; panel.buttonStyles[lang]=styleName(interaction.values[0]); rulesStore.touch(panel); await refreshPublishedPanel(client,panel,rulesStore); await interaction.update(designMenuPayload(panel)); return true; }
    return false;
  }
  if (interaction.isModalSubmit()) {
    const parts=interaction.customId.split(':'); if(parts[0]!=='rules') return false;
    if(!staff()) { await interaction.reply({content:'Staff only.',flags:MessageFlags.Ephemeral}); return true; }
    const action=parts[1], panel=findPanelByToken(rulesStore, parts[2]); if(!panel){ await interaction.reply({content:'Rules panel not found.',flags:MessageFlags.Ephemeral}); return true; }
    if(action==='addmodal' || action==='editmodal') {
      const lang=parts[3]==='es'?'es':'en'; const arr=panel.rules[lang];
      const item={id:action==='editmodal'?parts[4]:shortId('r'),title:clean(interaction.fields.getTextInputValue('title')),body:clean(interaction.fields.getTextInputValue('body'))};
      if(action==='editmodal') { const idx=arr.findIndex(x=>x.id===item.id); if(idx>=0) arr[idx]=item; else arr.push(item); } else arr.push(item);
      rulesStore.touch(panel);
      const e=new EmbedBuilder().setColor(lang==='es'?panel.colors.es:panel.colors.en).setTitle(action==='editmodal'?'✅ Rule Updated':'✅ Rule Added').setDescription(`**${item.title}**\n${clamp(item.body,1000)}`);
      const row=new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`rules:add:${panel.id}:${lang}`).setLabel('Add Next Rule').setEmoji('➕').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`rules:back:${panel.id}:${lang}`).setLabel('Back to Rules Editor').setStyle(ButtonStyle.Secondary)
      );
      await interaction.reply({embeds:[e],components:[row],flags:MessageFlags.Ephemeral}); return true;
    }
    if(action==='headermodal') {
      panel.title=clean(interaction.fields.getTextInputValue('title'))||panel.title;
      panel.bio=clean(interaction.fields.getTextInputValue('bio'));
      panel.bannerUrl=clean(interaction.fields.getTextInputValue('banner'));
      panel.thumbnailUrl=clean(interaction.fields.getTextInputValue('thumbnail'));
      rulesStore.touch(panel); await refreshPublishedPanel(client,panel,rulesStore); await interaction.reply(designMenuPayload(panel)); return true;
    }
    if(action==='colorsmodal') {
      panel.colors.panel=color(interaction.fields.getTextInputValue('panel'),panel.colors.panel);
      panel.colors.en=color(interaction.fields.getTextInputValue('en'),panel.colors.en);
      panel.colors.es=color(interaction.fields.getTextInputValue('es'),panel.colors.es);
      rulesStore.touch(panel); await refreshPublishedPanel(client,panel,rulesStore); await interaction.reply(designMenuPayload(panel)); return true;
    }
    return false;
  }
  return false;
}

module.exports = {
  RulesStore, RULES_DATA_DIR, RULES_FILE,
  publicPanelPayload, privateRulesPayload, sendSeparateRules, editorPayload, designMenuPayload,
  refreshPublishedPanel, deletePublishedMessages, handleRulesInteraction
};
