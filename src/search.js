const STOPWORDS = new Set([
  'the','a','an','and','or','but','if','then','to','of','for','in','on','at','by','from','with','about','is','are','was','were','be','it','this','that','i','me','my','we','our','you','your','what','when','where','why','how','who','which','can','could','would','should','do','does','did','have','has','will','please','tell','show',
  'el','la','los','las','un','una','y','o','pero','si','que','de','del','para','por','en','con','sobre','es','son','ser','esto','esta','este','yo','mi','mis','nosotros','nuestro','tu','tus','usted','ustedes','ellos','ellas','su','sus','como','cuando','donde','porque','quien','cual','puede','puedo','quiero','favor','dime'
]);

const OFFICIAL_CHANNEL_HINTS = [
  'rule','rules','regla','reglamento','announce','announcement','anuncio',
  'registration','register','registro','inscripcion','faq','info','information',
  'league','liga','schedule','horario','fixture',
  'pc-check','pccheck','premium','pass','payment','pago','prize','premio','roster'
];
const VERY_OFFICIAL_HINTS = ['rule','rules','regla','reglamento','announcement','announcements','anuncio','registration','registro','faq'];
const CHAT_CHANNEL_HINTS = ['general','chat','lounge','media','memes','random','clips'];

const SYNONYM_GROUPS = [
  ['register','registration','registrar','registro','inscripcion','inscribir','signup','sign-up','entry'],
  ['rules','rule','reglas','reglamento','normas','policy','policies'],
  ['schedule','time','times','horario','hora','fecha','date','start','starts','when','cuando'],
  ['prize','prizes','premio','premios','cash','pool','winner','ganador'],
  ['fee','pago','payment','costo','cost','price','precio','cuanto','how much'],
  ['pc','check','scan','security','seguridad','anticheat','anti-cheat','secure boot','tpm'],
  ['roster','plantilla','jugadores','players','squad','team','equipo'],
  ['premium','vip','pass','pase','benefit','benefits','beneficio','beneficios'],
  ['discord','ticket','support','soporte','help','ayuda'],
  ['forfeit','ff','wo','walkover','grace','gracia'],
  ['stream','live','directo','caster','casters','transmision','transmisión']
];

function normalize(text = '') {
  return String(text).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/https?:\/\/\S+/g, ' ').replace(/<[@#&!]?[0-9]+>/g, ' ')
    .replace(/[^a-z0-9$%:\s.-]/gi, ' ').replace(/\s+/g, ' ').trim();
}

function stem(word) {
  if (word.length <= 4 || /\d/.test(word)) return word;
  const endings = ['amientos','imientos','aciones','adores','adoras','amente','mente','acion','iendo','ando','ados','adas','idos','idas','ments','ation','ations','ingly','edly','ing','ed','ers','ies','es','s'];
  for (const ending of endings) if (word.length - ending.length >= 4 && word.endsWith(ending)) return word.slice(0, -ending.length);
  return word;
}

function tokens(text) {
  return [...new Set(normalize(text).split(' ').filter(Boolean).filter(w => w.length > 1 && !STOPWORDS.has(w)).map(stem))];
}

function querySignals(query = '') {
  const n = normalize(query);
  return {
    latest: /\b(latest|current|today|tonight|now|next|new|nuevo|actual|hoy|esta noche|proximo|próximo)\b/.test(n),
    rules: /\b(rule|rules|regla|reglas|reglamento|norma|normas|ff|forfeit|wo)\b/.test(n),
    money: /\$|\b(price|cost|fee|payment|pago|precio|costo|cuanto|premio|prize)\b/.test(n),
    time: /\b(time|when|date|start|schedule|hora|cuando|fecha|horario|pm|am)\b/.test(n),
    registration: /\b(register|registration|signup|registro|registrar|inscripcion|inscribir)\b/.test(n)
  };
}

function sourceAuthority(item) {
  if (item.sourceType === 'rules') return 6.5;
  const channel = normalize(item.channelName || '');
  let score = 0;
  if (VERY_OFFICIAL_HINTS.some(h => channel.includes(h))) score += 3.4;
  else if (OFFICIAL_CHANNEL_HINTS.some(h => channel.includes(h))) score += 2.1;
  if (CHAT_CHANNEL_HINTS.some(h => channel === h || channel.startsWith(`${h}-`))) score -= 2.2;
  if (item.pinned) score += 2.4;
  return score;
}

function scoreMessage(query, item) {
  const q = tokens(query);
  if (!q.length) return 0;
  const channel = normalize(item.channelName || '');
  const path = normalize(`${item.parentName || ''} ${item.categoryName || ''}`);
  const body = normalize(item.content || '');
  const searchable = `${channel} ${path} ${body}`;
  const set = new Set(tokens(searchable));
  const signals = querySignals(query);
  let score = sourceAuthority(item);

  for (const token of q) {
    if (set.has(token)) score += /\d|\$/.test(token) ? 4.2 : 2.7;
    if (channel.includes(token)) score += 1.9;
    if (path.includes(token)) score += 1.1;
    if (body.includes(token)) score += .7;
  }

  const nq = normalize(query);
  if (nq.length >= 5 && searchable.includes(nq)) score += 9;

  for (const group of SYNONYM_GROUPS) {
    const queryHit = group.some(w => nq.includes(normalize(w)));
    const sourceHit = group.some(w => searchable.includes(normalize(w)));
    if (queryHit && sourceHit) score += 2.4;
  }

  if (signals.rules && item.sourceType === 'rules') score += 4.5;
  const registrationEvidence = /registration|register|registro|inscripcion|inscribir|signup/.test(`${channel} ${body}`);
  const moneyEvidence = /\$|fee|price|cost|payment|pago|precio|costo|premio|prize/.test(body);
  const timeEvidence = /\b\d{1,2}(:\d{2})?\s*(am|pm)\b|\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|lunes|martes|miercoles|jueves|viernes|sabado|domingo|january|february|march|april|may|june|july|august|september|october|november|december|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b/.test(body);
  if (signals.registration && registrationEvidence) score += 2.5;
  if (signals.registration && !registrationEvidence) score -= 4.0;
  if (signals.money && moneyEvidence) score += 2.0;
  if (signals.money && !moneyEvidence) score -= 4.0;
  if (signals.time && timeEvidence) score += 1.8;
  if (signals.time && !timeEvidence) score -= 4.5;

  const ageDays = Math.max(0, (Date.now() - Number(item.updatedTimestamp || item.editedTimestamp || item.createdTimestamp || 0)) / 86400000);
  const freshnessCap = signals.latest || signals.time || signals.money || signals.registration ? 3.2 : 1.6;
  const freshnessWindow = signals.latest ? 45 : 120;
  score += Math.max(0, freshnessCap - ageDays / freshnessWindow);

  return score;
}

function searchIndex(query, index, maxResults = 8) {
  return index.map(item => ({ item, score: scoreMessage(query, item) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score || Number(b.item.updatedTimestamp || b.item.createdTimestamp || 0) - Number(a.item.updatedTimestamp || a.item.createdTimestamp || 0))
    .slice(0, maxResults);
}

function expandQuery(query = '') {
  const n = normalize(query);
  const additions = [];
  for (const group of SYNONYM_GROUPS) {
    if (group.some(w => n.includes(normalize(w)))) additions.push(...group.slice(0, 5));
  }
  return `${query} ${[...new Set(additions)].join(' ')}`.trim();
}

function detectLanguage(text = '') {
  const n = ` ${normalize(text)} `;
  const spanish = [' que ',' como ',' donde ',' cuando ',' reglas ',' registro ',' liga ',' premio ',' pago ',' jugadores ',' quiero ',' cual ',' horario ',' cuanto ',' cuesta ',' para ',' puedo ',' necesito ',' hay ',' hoy ',' equipo ',' partido '];
  const english = [' what ',' how ',' where ',' when ',' rules ',' register ',' league ',' prize ',' payment ',' players ',' want ',' which ',' schedule ',' cost ',' need ',' today ',' team ',' match '];
  const es = spanish.reduce((a, w) => a + (n.includes(w) ? 1 : 0), 0);
  const en = english.reduce((a, w) => a + (n.includes(w) ? 1 : 0), 0);
  return es > en ? 'es' : 'en';
}

function isFollowUp(text = '') {
  const n = normalize(text);
  const t = tokens(text);
  return t.length <= 9 && (/^(and|also|but|what about|how about|when|where|how much|which|y|tambien|también|pero|y que|que tal|cuando|donde|cuanto|cual)\b/.test(n)
    || /\b(it|that|those|them|eso|esa|ese|ellos|ellas|tambien|también)\b/.test(n));
}

module.exports = { normalize, tokens, scoreMessage, searchIndex, expandQuery, detectLanguage, isFollowUp, sourceAuthority, querySignals };
