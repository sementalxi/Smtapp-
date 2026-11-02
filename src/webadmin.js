const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder
} = require('discord.js');
const { DATA_DIR } = require('./store');
const { ticketPanel } = require('./tickets');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const TICKET_ASSET_DIR = path.join(DATA_DIR, 'ticket-assets');
fs.mkdirSync(TICKET_ASSET_DIR, { recursive: true });

function sendJson(res, status, data, extra = {}) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra });
  res.end(JSON.stringify(data));
}

function sendText(res, status, text, type = 'text/plain; charset=utf-8', extra = {}) {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store', ...extra });
  res.end(text);
}

function readBody(req, maxBytes = 12 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let total = 0;
    const chunks = [];
    req.on('data', chunk => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new Error('Request too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function cookieMap(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function hmacSecret() {
  const base = process.env.DASHBOARD_SESSION_SECRET || process.env.DASHBOARD_PASSWORD || '';
  return crypto.createHash('sha256').update(`KIXO:${base}`).digest();
}

function signSession(exp) {
  const sig = crypto.createHmac('sha256', hmacSecret()).update(String(exp)).digest('hex');
  return `${exp}.${sig}`;
}

function validSession(req) {
  const token = cookieMap(req).smt_admin || '';
  const [expRaw, sig] = token.split('.');
  const exp = Number(expRaw);
  if (!exp || !sig || Date.now() > exp) return false;
  const expected = crypto.createHmac('sha256', hmacSecret()).update(String(exp)).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

function safeEqualText(a, b) {
  const aa = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

function normalizeHexColor(value) {
  const raw = String(value || '').trim();
  if (/^#[0-9a-f]{6}$/i.test(raw)) return raw.toUpperCase();
  if (/^[0-9a-f]{6}$/i.test(raw)) return `#${raw.toUpperCase()}`;
  return '#FF2D8B';
}

function normalizeTrigger(value) {
  return String(value || '').trim().toLowerCase().replace(/^[/!?.#-]+/, '').replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32);
}

function safeDepartmentId(value, store) {
  const base = String(value || 'department').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'department';
  let id = base;
  let i = 2;
  while ((store.data.ticketTypes || []).some(x => x.id === id)) id = `${base}-${i++}`.slice(0, 50);
  return id;
}

async function guildFor(client) {
  const id = process.env.GUILD_ID;
  if (!id) return null;
  return client.guilds.fetch(id).catch(() => null);
}

function assetContentType(filename) {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  return 'application/octet-stream';
}

function resolveDataFile(relative) {
  if (!relative) return '';
  const root = path.resolve(DATA_DIR);
  const full = path.resolve(DATA_DIR, relative);
  if (!full.startsWith(root + path.sep) && full !== root) return '';
  return full;
}

function panelAssetUrl(store, kind) {
  const s = store.data.settings || {};
  const file = kind === 'logo' ? s.ticketLogoFile : s.ticketBannerFile;
  const url = kind === 'logo' ? s.ticketLogoUrl : s.ticketBannerUrl;
  if (file && fs.existsSync(resolveDataFile(file))) return `/admin/assets/${kind}`;
  return url || '';
}

async function buildState(client, store) {
  const guild = await guildFor(client);
  if (!guild) throw new Error('Discord server is not available.');
  await guild.channels.fetch().catch(() => null);
  await guild.roles.fetch().catch(() => null);

  const categories = [...guild.channels.cache.values()]
    .filter(ch => ch.type === ChannelType.GuildCategory)
    .sort((a, b) => a.rawPosition - b.rawPosition)
    .map(ch => ({ id: ch.id, name: ch.name }));
  const textChannels = [...guild.channels.cache.values()]
    .filter(ch => [ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(ch.type))
    .sort((a, b) => a.rawPosition - b.rawPosition)
    .map(ch => ({ id: ch.id, name: ch.name, category: ch.parent?.name || '' }));
  const roles = [...guild.roles.cache.values()]
    .filter(r => !r.managed && r.id !== guild.roles.everyone.id)
    .sort((a, b) => b.position - a.position)
    .map(r => ({ id: r.id, name: r.name, color: r.hexColor }));

  const tickets = Object.values(store.data.tickets || {})
    .sort((a, b) => Number(b.number || 0) - Number(a.number || 0))
    .slice(0, 200)
    .map(t => ({
      ...t,
      channelName: guild.channels.cache.get(t.channelId)?.name || '',
      ownerName: client.users.cache.get(t.userId)?.username || t.userId
    }));

  const s = store.data.settings || {};
  return {
    server: { id: guild.id, name: guild.name, icon: guild.iconURL({ size: 128 }) || '' },
    bot: { tag: client.user?.tag || 'Starting', online: Boolean(client.user), uptime: Math.floor(process.uptime()) },
    summary: {
      departments: (store.data.ticketTypes || []).length,
      openTickets: tickets.filter(t => t.status === 'open').length,
      closedTickets: tickets.filter(t => t.status === 'closed').length,
      customCommands: (store.data.ticketCustomCommands || []).length
    },
    settings: {
      enabled: s.features?.tickets !== false,
      ticketPanelTitle: s.ticketPanelTitle || '🎫 KIXO Support',
      ticketPanelText: s.ticketPanelText || '',
      ticketPanelFooter: s.ticketPanelFooter || '',
      ticketPanelColor: s.ticketPanelColor || '#FF2D8B',
      ticketCreatedReplyTemplate: s.ticketCreatedReplyTemplate || '✅ Your **{type}** ticket is ready: {channel}',
      ticketCommandPrefix: s.ticketCommandPrefix || '!',
      ticketTranscriptChannelId: s.ticketTranscriptChannelId || '',
      ticketClosedCategoryId: s.ticketClosedCategoryId || '',
      logoUrl: panelAssetUrl(store, 'logo'),
      bannerUrl: panelAssetUrl(store, 'banner')
    },
    departments: store.data.ticketTypes || [],
    customCommands: store.data.ticketCustomCommands || [],
    tickets,
    categories,
    textChannels,
    roles
  };
}

function permissionState(guild, store) {
  const me = guild.members.me;
  if (!me) return { ok: false, checks: [{ ok: false, label: 'Bot member could not be resolved.' }], departments: [] };
  const checks = [
    ['View Channels', PermissionFlagsBits.ViewChannel],
    ['Send Messages', PermissionFlagsBits.SendMessages],
    ['Read Message History', PermissionFlagsBits.ReadMessageHistory],
    ['Embed Links', PermissionFlagsBits.EmbedLinks],
    ['Attach Files', PermissionFlagsBits.AttachFiles],
    ['Manage Channels', PermissionFlagsBits.ManageChannels],
    ['Manage Roles', PermissionFlagsBits.ManageRoles]
  ].map(([label, flag]) => ({ label, ok: me.permissions.has(flag) }));
  const departments = (store.data.ticketTypes || []).map(type => {
    const category = guild.channels.cache.get(type.categoryId);
    if (!type.categoryId) return { id: type.id, label: type.label, ok: false, message: 'No destination category selected.' };
    if (!category || category.type !== ChannelType.GuildCategory) return { id: type.id, label: type.label, ok: false, message: 'Destination category is missing.' };
    const perms = category.permissionsFor(me);
    const ok = Boolean(perms?.has(PermissionFlagsBits.ViewChannel) && perms?.has(PermissionFlagsBits.ManageChannels));
    return { id: type.id, label: type.label, ok, message: ok ? `Ready in ${category.name}` : `Missing View Channel or Manage Channels in ${category.name}` };
  });
  return { ok: checks.every(x => x.ok) && departments.every(x => x.ok), checks, departments };
}

function replaceVars(text, ctx) {
  const repl = {
    '{user}': `<@${ctx.ticket.userId}>`,
    '{username}': ctx.ownerName || 'member',
    '{staff}': 'KIXO GFX Studio Admin',
    '{ticket}': `#${String(ctx.ticket.number || 0).padStart(4, '0')}`,
    '{number}': String(ctx.ticket.number || 0).padStart(4, '0'),
    '{type}': ctx.type?.label || ctx.ticket.typeLabel || 'Support',
    '{channel}': `<#${ctx.ticket.channelId}>`,
    '{server}': ctx.guild.name,
    '{args}': ctx.args || ''
  };
  let out = String(text || '');
  for (const [k, v] of Object.entries(repl)) out = out.split(k).join(String(v));
  return out;
}

async function serveAsset(req, res, store, kind) {
  const file = kind === 'logo' ? store.data.settings.ticketLogoFile : store.data.settings.ticketBannerFile;
  const full = resolveDataFile(file);
  if (!full || !fs.existsSync(full)) return sendText(res, 404, 'Not found');
  res.writeHead(200, { 'content-type': assetContentType(full), 'cache-control': 'private, max-age=60' });
  fs.createReadStream(full).pipe(res);
}

async function saveDataUrl(store, kind, dataUrl) {
  const match = String(dataUrl || '').match(/^data:image\/(png|jpeg|jpg|webp|gif);base64,([A-Za-z0-9+/=]+)$/i);
  if (!match) throw new Error('Use a PNG, JPG, WEBP, or GIF image.');
  const ext = match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase();
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > 10 * 1024 * 1024) throw new Error('Image must be under 10 MB.');
  for (const old of fs.readdirSync(TICKET_ASSET_DIR)) {
    if (old.startsWith(`ticket-${kind}.`)) {
      try { fs.unlinkSync(path.join(TICKET_ASSET_DIR, old)); } catch {}
    }
  }
  const filename = `ticket-${kind}.${ext}`;
  const full = path.join(TICKET_ASSET_DIR, filename);
  fs.writeFileSync(full, bytes);
  const relative = path.relative(DATA_DIR, full).replace(/\\/g, '/');
  if (kind === 'logo') store.updateSettings({ ticketLogoFile: relative, ticketLogoUrl: '' });
  else store.updateSettings({ ticketBannerFile: relative, ticketBannerUrl: '' });
  return relative;
}

function sanitizeDepartment(body, existing = null, store) {
  const label = String(body.label || existing?.label || 'Support').trim().slice(0, 80) || 'Support';
  const questions = Array.isArray(body.questions)
    ? body.questions.map(x => String(x).trim().slice(0, 80)).filter(Boolean).slice(0, 4)
    : String(body.questions || '').split(/\r?\n/).map(x => x.trim().slice(0, 80)).filter(Boolean).slice(0, 4);
  const style = ['primary', 'secondary', 'success', 'danger'].includes(String(body.style)) ? String(body.style) : 'secondary';
  return {
    id: existing?.id || safeDepartmentId(body.id || label, store),
    label,
    emoji: String(body.emoji || '').trim().slice(0, 40),
    style,
    intro: String(body.intro || 'Tell us what you need help with. You can upload screenshots or other files here.').slice(0, 1000),
    questions,
    categoryId: String(body.categoryId || ''),
    staffRoleId: String(body.staffRoleId || '')
  };
}

function sanitizeCustomCommand(body, existing = null) {
  const trigger = normalizeTrigger(body.trigger || existing?.trigger || 'command');
  if (!trigger) throw new Error('Command name is required.');
  const message = String(body.message || '').trim().slice(0, 4000);
  if (!message) throw new Error('Command response is required.');
  return {
    id: existing?.id || `tc-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    trigger,
    title: String(body.title || '').slice(0, 256),
    message,
    color: normalizeHexColor(body.color || '#FF2D8B'),
    footer: String(body.footer || '').slice(0, 200)
  };
}

function staticFile(res, name, type) {
  const full = path.join(PUBLIC_DIR, name);
  if (!fs.existsSync(full)) return sendText(res, 404, 'Not found');
  sendText(res, 200, fs.readFileSync(full), type, { 'cache-control': 'no-cache' });
}

function createWebAdminHandler(client, store) {
  return async function handle(req, res) {
    const url = new URL(req.url, 'http://localhost');
    const pathname = url.pathname;

    if (pathname === '/admin' || pathname === '/admin/') return staticFile(res, 'admin.html', 'text/html; charset=utf-8');
    if (pathname === '/admin/app.css') return staticFile(res, 'admin.css', 'text/css; charset=utf-8');
    if (pathname === '/admin/app.js') return staticFile(res, 'admin.js', 'application/javascript; charset=utf-8');

    const password = String(process.env.DASHBOARD_PASSWORD || '');
    if (pathname === '/api/admin/login' && req.method === 'POST') {
      if (!password) return sendJson(res, 503, { error: 'DASHBOARD_PASSWORD is not configured in Railway.' });
      const body = await readBody(req, 64 * 1024).catch(err => ({ __error: err.message }));
      if (body.__error) return sendJson(res, 400, { error: body.__error });
      if (!safeEqualText(body.password || '', password)) return sendJson(res, 401, { error: 'Incorrect password.' });
      const exp = Date.now() + 12 * 60 * 60 * 1000;
      const secure = String(req.headers['x-forwarded-proto'] || '').includes('https') ? '; Secure' : '';
      return sendJson(res, 200, { ok: true }, { 'set-cookie': `smt_admin=${encodeURIComponent(signSession(exp))}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${secure}` });
    }

    if (pathname === '/api/admin/logout' && req.method === 'POST') {
      return sendJson(res, 200, { ok: true }, { 'set-cookie': 'smt_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' });
    }

    if (pathname.startsWith('/api/admin/') || pathname.startsWith('/admin/assets/')) {
      if (!password) return sendJson(res, 503, { error: 'DASHBOARD_PASSWORD is not configured in Railway.' });
      if (!validSession(req)) return sendJson(res, 401, { error: 'Login required.' });
    }

    try {
      if (pathname === '/admin/assets/logo' && req.method === 'GET') return serveAsset(req, res, store, 'logo');
      if (pathname === '/admin/assets/banner' && req.method === 'GET') return serveAsset(req, res, store, 'banner');

      if (pathname === '/api/admin/state' && req.method === 'GET') return sendJson(res, 200, await buildState(client, store));

      if (pathname === '/api/admin/permissions' && req.method === 'GET') {
        const guild = await guildFor(client);
        if (!guild) return sendJson(res, 503, { error: 'Discord server is unavailable.' });
        await guild.channels.fetch().catch(() => null);
        return sendJson(res, 200, permissionState(guild, store));
      }

      if (pathname === '/api/admin/settings' && req.method === 'PUT') {
        const body = await readBody(req);
        const current = store.data.settings;
        const features = { ...(current.features || {}), tickets: body.enabled !== false };
        store.updateSettings({
          features,
          ticketPanelTitle: String(body.ticketPanelTitle ?? current.ticketPanelTitle ?? '').slice(0, 256),
          ticketPanelText: String(body.ticketPanelText ?? current.ticketPanelText ?? '').slice(0, 4000),
          ticketPanelFooter: String(body.ticketPanelFooter ?? current.ticketPanelFooter ?? '').slice(0, 200),
          ticketPanelColor: normalizeHexColor(body.ticketPanelColor ?? current.ticketPanelColor),
          ticketCreatedReplyTemplate: String(body.ticketCreatedReplyTemplate ?? current.ticketCreatedReplyTemplate ?? '').slice(0, 1900),
          ticketCommandPrefix: String(body.ticketCommandPrefix ?? current.ticketCommandPrefix ?? '!').trim().slice(0, 3) || '!',
          ticketTranscriptChannelId: String(body.ticketTranscriptChannelId ?? current.ticketTranscriptChannelId ?? ''),
          ticketClosedCategoryId: String(body.ticketClosedCategoryId ?? current.ticketClosedCategoryId ?? '')
        });
        return sendJson(res, 200, { ok: true });
      }

      if (pathname === '/api/admin/assets' && req.method === 'POST') {
        const body = await readBody(req);
        if (!['logo', 'banner'].includes(body.kind)) return sendJson(res, 400, { error: 'Invalid image type.' });
        await saveDataUrl(store, body.kind, body.dataUrl);
        return sendJson(res, 200, { ok: true, url: `/admin/assets/${body.kind}?v=${Date.now()}` });
      }

      if (pathname === '/api/admin/assets' && req.method === 'DELETE') {
        const kind = url.searchParams.get('kind');
        if (!['logo', 'banner'].includes(kind)) return sendJson(res, 400, { error: 'Invalid image type.' });
        const file = kind === 'logo' ? store.data.settings.ticketLogoFile : store.data.settings.ticketBannerFile;
        const full = resolveDataFile(file);
        if (full && fs.existsSync(full)) try { fs.unlinkSync(full); } catch {}
        if (kind === 'logo') store.updateSettings({ ticketLogoFile: '', ticketLogoUrl: '' });
        else store.updateSettings({ ticketBannerFile: '', ticketBannerUrl: '' });
        return sendJson(res, 200, { ok: true });
      }

      if (pathname === '/api/admin/departments' && req.method === 'POST') {
        const body = await readBody(req);
        if ((store.data.ticketTypes || []).length >= 25) return sendJson(res, 400, { error: 'Discord supports up to 25 buttons per ticket panel.' });
        const dept = sanitizeDepartment(body, null, store);
        store.data.ticketTypes.push(dept);
        store.save();
        return sendJson(res, 200, { ok: true, department: dept });
      }

      const deptMatch = pathname.match(/^\/api\/admin\/departments\/([^/]+)$/);
      if (deptMatch && req.method === 'PUT') {
        const body = await readBody(req);
        const existing = (store.data.ticketTypes || []).find(x => x.id === decodeURIComponent(deptMatch[1]));
        if (!existing) return sendJson(res, 404, { error: 'Department not found.' });
        Object.assign(existing, sanitizeDepartment(body, existing, store));
        store.save();
        return sendJson(res, 200, { ok: true, department: existing });
      }
      if (deptMatch && req.method === 'DELETE') {
        const id = decodeURIComponent(deptMatch[1]);
        store.data.ticketTypes = (store.data.ticketTypes || []).filter(x => x.id !== id);
        store.save();
        return sendJson(res, 200, { ok: true });
      }

      if (pathname === '/api/admin/custom-commands' && req.method === 'POST') {
        const body = await readBody(req);
        if ((store.data.ticketCustomCommands || []).length >= 25) return sendJson(res, 400, { error: 'Maximum 25 custom commands.' });
        const cmd = sanitizeCustomCommand(body);
        if ((store.data.ticketCustomCommands || []).some(x => x.trigger === cmd.trigger)) return sendJson(res, 400, { error: 'That command name already exists.' });
        store.data.ticketCustomCommands.push(cmd);
        store.save();
        return sendJson(res, 200, { ok: true, command: cmd });
      }

      const cmdMatch = pathname.match(/^\/api\/admin\/custom-commands\/([^/]+)$/);
      if (cmdMatch && req.method === 'PUT') {
        const id = decodeURIComponent(cmdMatch[1]);
        const existing = (store.data.ticketCustomCommands || []).find(x => x.id === id);
        if (!existing) return sendJson(res, 404, { error: 'Command not found.' });
        const body = await readBody(req);
        const updated = sanitizeCustomCommand(body, existing);
        if ((store.data.ticketCustomCommands || []).some(x => x.id !== id && x.trigger === updated.trigger)) return sendJson(res, 400, { error: 'Another command already uses that name.' });
        Object.assign(existing, updated);
        store.save();
        return sendJson(res, 200, { ok: true, command: existing });
      }
      if (cmdMatch && req.method === 'DELETE') {
        const id = decodeURIComponent(cmdMatch[1]);
        store.data.ticketCustomCommands = (store.data.ticketCustomCommands || []).filter(x => x.id !== id);
        store.save();
        return sendJson(res, 200, { ok: true });
      }

      if (pathname === '/api/admin/publish-panel' && req.method === 'POST') {
        const body = await readBody(req);
        const guild = await guildFor(client);
        const channel = guild ? await guild.channels.fetch(String(body.channelId || '')).catch(() => null) : null;
        if (!channel?.isTextBased()) return sendJson(res, 400, { error: 'Choose a valid text channel.' });
        const sent = await channel.send(ticketPanel(store));
        return sendJson(res, 200, { ok: true, messageId: sent.id, channelId: channel.id });
      }

      const sendCmdMatch = pathname.match(/^\/api\/admin\/tickets\/([^/]+)\/send-command$/);
      if (sendCmdMatch && req.method === 'POST') {
        const channelId = decodeURIComponent(sendCmdMatch[1]);
        const ticket = store.data.tickets?.[channelId];
        if (!ticket || ticket.status !== 'open') return sendJson(res, 404, { error: 'Open ticket not found.' });
        const body = await readBody(req);
        const command = (store.data.ticketCustomCommands || []).find(x => x.id === body.commandId || x.trigger === normalizeTrigger(body.commandId));
        if (!command) return sendJson(res, 404, { error: 'Custom command not found.' });
        const guild = await guildFor(client);
        const channel = guild ? await guild.channels.fetch(channelId).catch(() => null) : null;
        if (!channel?.isTextBased()) return sendJson(res, 404, { error: 'Ticket channel is unavailable.' });
        const type = (store.data.ticketTypes || []).find(x => x.id === ticket.typeId);
        const owner = await guild.members.fetch(ticket.userId).catch(() => null);
        const ctx = { guild, ticket, type, ownerName: owner?.user?.username || 'member', args: String(body.args || '').slice(0, 500) };
        const embed = new EmbedBuilder()
          .setColor(Number.parseInt(normalizeHexColor(command.color).slice(1), 16))
          .setDescription(replaceVars(command.message, ctx).slice(0, 4096) || ' ');
        const title = replaceVars(command.title, ctx).slice(0, 256);
        const footer = replaceVars(command.footer, ctx).slice(0, 2048);
        if (title) embed.setTitle(title);
        if (footer) embed.setFooter({ text: footer });
        await channel.send({ content: `<@${ticket.userId}>`, embeds: [embed], allowedMentions: { users: [ticket.userId] } });
        return sendJson(res, 200, { ok: true });
      }

      const noteMatch = pathname.match(/^\/api\/admin\/tickets\/([^/]+)\/note$/);
      if (noteMatch && req.method === 'POST') {
        const channelId = decodeURIComponent(noteMatch[1]);
        const ticket = store.data.tickets?.[channelId];
        if (!ticket) return sendJson(res, 404, { error: 'Ticket not found.' });
        const body = await readBody(req);
        const text = String(body.text || '').trim().slice(0, 1500);
        if (!text) return sendJson(res, 400, { error: 'Note is empty.' });
        if (!Array.isArray(ticket.notes)) ticket.notes = [];
        ticket.notes.push({ by: 'web-admin', at: new Date().toISOString(), text });
        ticket.notes = ticket.notes.slice(-50);
        store.save();
        return sendJson(res, 200, { ok: true });
      }

      return false;
    } catch (err) {
      console.error('Web admin error:', err);
      return sendJson(res, 500, { error: String(err.message || err).slice(0, 500) });
    }
  };
}

module.exports = { createWebAdminHandler };
