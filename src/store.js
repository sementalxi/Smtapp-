const fs = require('fs');
const path = require('path');

const DATA_DIR = path.resolve(process.env.DATA_DIR || './data');
const DB_FILE = path.join(DATA_DIR, 'kixo-data.json');

function initialState() {
  return {
    version: 12,
    settings: {
      answerChannelId: process.env.ANSWER_CHANNEL_ID || '',
      knowledgeChannelIds: split(process.env.SEARCH_CHANNEL_IDS),
      ignoredChannelIds: split(process.env.IGNORED_CHANNEL_IDS),
      ignoredCategoryIds: split(process.env.IGNORED_CATEGORY_IDS),
      autoDiscover: String(process.env.AUTO_DISCOVER_CHANNELS || 'false') === 'true',
      smartFilter: String(process.env.SMART_CHANNEL_FILTER || 'true') !== 'false',
      logChannelId: process.env.LOG_CHANNEL_ID || '',
      welcomeChannelId: process.env.WELCOME_CHANNEL_ID || '',
      welcomeRoleId: process.env.WELCOME_ROLE_ID || '',
      unverifiedRoleId: process.env.UNVERIFIED_ROLE_ID || '',
      verifiedRoleId: process.env.VERIFIED_ROLE_ID || '',
      verifyAssignJoinRole: String(process.env.VERIFY_ASSIGN_JOIN_ROLE || 'true') !== 'false',
      verifyPanelTitle: process.env.VERIFY_PANEL_TITLE || '',
      verifyPanelText: process.env.VERIFY_PANEL_TEXT || 'This server requires you to verify yourself to get access to the other channels. Click the Verify button below to continue.',
      verifyButtonText: process.env.VERIFY_BUTTON_TEXT || 'Verify',
      verifyPanelColor: process.env.VERIFY_PANEL_COLOR || '#5865F2',
      verifyLogoUrl: process.env.VERIFY_LOGO_URL || '',
      verifyBannerUrl: process.env.VERIFY_BANNER_URL || '',
      verifyLogoFile: '',
      verifyBannerFile: '',
      ticketCategoryId: process.env.TICKET_CATEGORY_ID || '',
      ticketTranscriptChannelId: process.env.TICKET_TRANSCRIPT_CHANNEL_ID || '',
      ticketClosedCategoryId: process.env.TICKET_CLOSED_CATEGORY_ID || '',
      ticketPanelFooter: process.env.TICKET_PANEL_FOOTER || 'KIXO | GFX STUDIO • Orders',
      ticketPanelTitle: process.env.TICKET_PANEL_TITLE || '🎨 KIXO | GFX STUDIO • Orders',
      ticketPanelText: process.env.TICKET_PANEL_TEXT || 'Choose a service below to open a private ticket. / Elige una opción para abrir un ticket privado.',
      ticketPanelColor: process.env.TICKET_PANEL_COLOR || '#FF2D8B',
      ticketLogoUrl: process.env.TICKET_LOGO_URL || '',
      ticketBannerUrl: process.env.TICKET_BANNER_URL || '',
      ticketLogoFile: '',
      ticketBannerFile: '',
      ticketCommandPrefix: process.env.TICKET_COMMAND_PREFIX || '!',
      ticketAutoDeleteEnabled: String(process.env.TICKET_AUTO_DELETE_ENABLED || 'true') !== 'false',
      ticketAutoDeleteHours: Math.min(720, Math.max(1, Number(process.env.TICKET_AUTO_DELETE_HOURS || 24))),
      inviteTrackingEnabled: String(process.env.INVITE_TRACKING_ENABLED || 'true') !== 'false',
      inviteLogChannelId: process.env.INVITE_LOG_CHANNEL_ID || '',
      staffRoleIds: split(process.env.STAFF_ROLE_IDS),
      spamGuardEnabled: String(process.env.SPAM_GUARD_ENABLED || 'false') === 'true',
      spamGuardMinChannels: Number(process.env.SPAM_GUARD_MIN_CHANNELS || 3),
      spamGuardWindowSeconds: Number(process.env.SPAM_GUARD_WINDOW_SECONDS || 20),
      spamGuardAction: String(process.env.SPAM_GUARD_ACTION || 'delete').toLowerCase(),
      spamGuardTimeoutMinutes: Number(process.env.SPAM_GUARD_TIMEOUT_MINUTES || 1440),
      spamGuardMinLength: Number(process.env.SPAM_GUARD_MIN_LENGTH || 12),
      spamGuardIgnoredChannelIds: split(process.env.SPAM_GUARD_IGNORED_CHANNEL_IDS),
      spamGuardIgnoredRoleIds: split(process.env.SPAM_GUARD_IGNORED_ROLE_IDS),
      verifyDeadlineEnabled: String(process.env.VERIFY_DEADLINE_ENABLED || 'false') === 'true',
      verifyDeadlineDays: 3,
      accountAgeGuardEnabled: String(process.env.ACCOUNT_AGE_GUARD_ENABLED || 'false') === 'true',
      accountAgeGuardDays: Math.min(3650, Math.max(1, Number(process.env.ACCOUNT_AGE_GUARD_DAYS || 7))),
      autoModWords: process.env.AUTO_MOD_WORDS || '',
      blockInvites: String(process.env.BLOCK_INVITES || 'false') === 'true',
      answerMode: process.env.ANSWER_MODE || 'hybrid',
      features: {
        aiAnswers: true,
        tickets: true,
        levels: true,
        welcomes: true,
        moderation: String(process.env.AUTO_MOD_ENABLED || 'false') === 'true',
        announcements: true,
        rules: true,
        verification: true
      }
    },
    knowledge: [],
    levels: {},
    warnings: {},
    tickets: {},
    inviteTracking: { stats: {}, members: {} },
    ticketTypes: [
      { id: 'new-design', label: 'New Design Order', emoji: '🎨', style: 'primary',
        intro: '🎨 KIXO | GFX STUDIO — New Design Order / Nuevo pedido. Send reference pictures and files here once the private ticket opens.',
        questions: ['Design + exact text / Diseño y texto', 'Size, platform, colors / Tamaño, colores', 'References / Referencias', 'Deadline + notes / Fecha y detalles'],
        categoryId: process.env.TICKET_CATEGORY_ID || '', staffRoleId: '', defaultPriority: 'normal' },
      { id: 'revision', label: 'Revision Request', emoji: '✏️', style: 'secondary',
        intro: '✏️ KIXO | GFX STUDIO — Revision Request / Solicitud de cambios. Attach the original design in this channel.',
        questions: ['Order ID / Número de pedido', 'Changes / Cambios solicitados', 'References / Referencias', 'Deadline + timezone / Fecha y zona'],
        categoryId: process.env.TICKET_CATEGORY_ID || '', staffRoleId: '', defaultPriority: 'normal' },
      { id: 'order-support', label: 'Order Support', emoji: '📩', style: 'success',
        intro: '📩 KIXO | GFX STUDIO — Order Support / Soporte de pedidos.',
        questions: ['Order ID / Número de pedido', 'Describe issue / Describe el problema', 'Links, screenshots / Referencias', 'Notes / Comentarios'],
        categoryId: process.env.TICKET_CATEGORY_ID || '', staffRoleId: '', defaultPriority: 'normal' },
      { id: 'collaboration', label: 'Collaboration', emoji: '🤝', style: 'secondary',
        intro: '🤝 KIXO | GFX STUDIO — Collaboration / Colaboraciones.',
        questions: ['Brand & contact / Marca y contacto', 'Proposal / Propuesta', 'Budget & deadline / Presupuesto y fecha', 'Portfolio / Portafolio'],
        categoryId: process.env.TICKET_CATEGORY_ID || '', staffRoleId: '', defaultPriority: 'normal' }
    ],
    ticketCounter: 0,
    ticketCustomCommands: [],
    qaLog: [],
    meta: { lastSync: null, syncChannels: 0, readableChannels: 0, excludedChannels: 0 }
  };
}

function split(value = '') {
  return String(value).split(',').map(x => x.trim()).filter(Boolean);
}

class Store {
  constructor() {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    this.data = initialState();
    this.load();
  }

  load() {
    if (!fs.existsSync(DB_FILE)) return this.save();
    try {
      const parsed = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      const fresh = initialState();
      this.data = {
        ...fresh,
        ...parsed,
        settings: {
          ...fresh.settings,
          ...(parsed.settings || {}),
          features: { ...fresh.settings.features, ...(parsed.settings?.features || {}) }
        },
        meta: { ...fresh.meta, ...(parsed.meta || {}) }
      };
      // V8.4 removes the tournament module completely, including legacy saved tournament data.
      delete this.data.tournaments;
      if (this.data.settings?.features) delete this.data.settings.features.tournaments;

      // V8.5 verification migration: Auto Join now defaults ON.
      // Upgrade existing V8.4-and-older installs once, while still allowing staff
      // to turn Auto Join OFF later and have that choice persist.
      if (Number(parsed.version || 0) < 9) {
        this.data.settings.verifyAssignJoinRole = true;
      }
      if (!this.data.inviteTracking || typeof this.data.inviteTracking !== 'object') this.data.inviteTracking = { stats: {}, members: {} };
      if (!this.data.inviteTracking.stats || typeof this.data.inviteTracking.stats !== 'object') this.data.inviteTracking.stats = {};
      if (!this.data.inviteTracking.members || typeof this.data.inviteTracking.members !== 'object') this.data.inviteTracking.members = {};
      this.data.version = 11;
      this.save();
    } catch (err) {
      console.error('Could not read data store; using defaults:', err.message);
      this.data = initialState();
      this.save();
    }
  }

  save() {
    const tmp = `${DB_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
    fs.renameSync(tmp, DB_FILE);
  }

  updateSettings(patch) {
    this.data.settings = { ...this.data.settings, ...patch };
    this.save();
    return this.data.settings;
  }

  resetAiSettings() {
    const defaults = initialState().settings;
    this.data.settings = {
      ...this.data.settings,
      answerChannelId: defaults.answerChannelId,
      knowledgeChannelIds: [...defaults.knowledgeChannelIds],
      ignoredChannelIds: [...defaults.ignoredChannelIds],
      ignoredCategoryIds: [...defaults.ignoredCategoryIds],
      autoDiscover: defaults.autoDiscover,
      smartFilter: defaults.smartFilter,
      answerMode: defaults.answerMode,
      features: { ...this.data.settings.features, aiAnswers: true }
    };
    this.save();
    return this.data.settings;
  }

  logQA(entry) {
    const row = { id: entry.id || `${Date.now().toString(36)}${Math.random().toString(36).slice(2,6)}`, at: new Date().toISOString(), ...entry };
    this.data.qaLog.unshift(row);
    this.data.qaLog = this.data.qaLog.slice(0, 200);
    this.save();
    return row;
  }

  setQAFeedback(id, feedback, userId = '') {
    const row = this.data.qaLog.find(x => x.id === id);
    if (!row) return false;
    row.feedback = feedback;
    row.feedbackBy = userId;
    row.feedbackAt = new Date().toISOString();
    this.save();
    return true;
  }
}

module.exports = { Store, split, DATA_DIR };
