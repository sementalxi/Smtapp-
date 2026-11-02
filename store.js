const fs = require('fs');
const path = require('path');

const DATA_DIR = path.resolve(process.env.DATA_DIR || './data');
const DB_FILE = path.join(DATA_DIR, 'semental-data.json');

function initialState() {
  return {
    version: 9,
    settings: {
      answerChannelId: process.env.ANSWER_CHANNEL_ID || '',
      knowledgeChannelIds: split(process.env.SEARCH_CHANNEL_IDS),
      ignoredChannelIds: split(process.env.IGNORED_CHANNEL_IDS),
      ignoredCategoryIds: split(process.env.IGNORED_CATEGORY_IDS),
      autoDiscover: String(process.env.AUTO_DISCOVER_CHANNELS || 'true') !== 'false',
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
      ticketPanelFooter: process.env.TICKET_PANEL_FOOTER || 'SEMENTAL • Support Tickets',
      ticketPanelTitle: process.env.TICKET_PANEL_TITLE || '🎫 SEMENTAL Support',
      ticketPanelText: process.env.TICKET_PANEL_TEXT || 'Choose the type of support you need below. A private ticket will be created for you and the correct staff team.',
      ticketPanelColor: process.env.TICKET_PANEL_COLOR || '#D90429',
      ticketLogoUrl: process.env.TICKET_LOGO_URL || '',
      ticketBannerUrl: process.env.TICKET_BANNER_URL || '',
      ticketLogoFile: '',
      ticketBannerFile: '',
      ticketCommandPrefix: process.env.TICKET_COMMAND_PREFIX || '!',
      staffRoleIds: split(process.env.STAFF_ROLE_IDS),
      spamGuardEnabled: String(process.env.SPAM_GUARD_ENABLED || 'true') !== 'false',
      spamGuardMinChannels: Number(process.env.SPAM_GUARD_MIN_CHANNELS || 3),
      spamGuardWindowSeconds: Number(process.env.SPAM_GUARD_WINDOW_SECONDS || 20),
      spamGuardAction: String(process.env.SPAM_GUARD_ACTION || 'ban').toLowerCase(),
      spamGuardTimeoutMinutes: Number(process.env.SPAM_GUARD_TIMEOUT_MINUTES || 1440),
      spamGuardMinLength: Number(process.env.SPAM_GUARD_MIN_LENGTH || 12),
      spamGuardIgnoredChannelIds: split(process.env.SPAM_GUARD_IGNORED_CHANNEL_IDS),
      spamGuardIgnoredRoleIds: split(process.env.SPAM_GUARD_IGNORED_ROLE_IDS),
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
    ticketTypes: [
      {
        id: 'support',
        label: 'Support',
        emoji: '🎫',
        style: 'danger',
        intro: 'Tell us what you need help with. You can upload screenshots or other files here.',
        questions: [],
        categoryId: process.env.TICKET_CATEGORY_ID || '',
        staffRoleId: '',
        defaultPriority: 'normal'
      }
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
      this.data.version = 9;
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
