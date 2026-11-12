// Event-flyer styles copied from the owner's own tournament flyers come with that flyer's exact texts: picking the
// style fills the Event form with them (each box can still be changed), and the style's preview poster uses them.
export type EventTexts = Partial<Record<"headline" | "name" | "subtitle" | "rule" | "ruleNote" | "date" | "details" | "prize" | "entry" | "footer", string>>;

export const EVENT_DEFAULTS: Record<string, EventTexts> = {
  "event-star-badge": { headline: "RELAMPAGO", name: "Semental", subtitle: "QUIEN DIJO MIEDO", entry: "FREE ENTRY", prize: "$100 TO WINNER", footer: "DISCIPLINE · RESPECT · PASSION" },
  "event-badge-trio": { headline: "RELAMPAGO", name: "Semental", subtitle: "QUIEN DIJO MIEDO", prize: "$50 TO WINNER", entry: "INCRIPSIONS FREE", date: "TODAY", footer: "DISCIPLINA · CORAJE · UNIDAD · ESTD 2023" },
  "event-purple-schedule": { headline: "LAST DANCE", name: "XUMMIT AFTER HOURS NOCTURNO", prize: "PREMIO $200", subtitle: "+ 85% RECAUDADO", entry: "$10 INSCRIPCION", rule: "NARRACION", ruleNote: "DESDE 8VOS", date: "HORARIOS", details: "10:00 PM (CA) · 11:00 PM (MX) · 12:00 AM (TX) · 1:00 AM (NY)", footer: "FOOTZ GFX · FULL TEAM CHAMPS" },
  "event-trophy-duel": { subtitle: "LPL RELAMPAGO", headline: "PREMIO +500$", name: "LAST DANCE", entry: "10$ INSCRIPCION", date: "VIERNES 4 DE SEPTIEMBRE", details: "8:00 p. m. · 9:00 p. m. · 10:00 p. m.", footer: "ADIOS FC26 · LPL LATIN PRO LEAGUE" },
  "event-division-tiers": { headline: "NEW SEASON 4", name: "MLPC", date: "START DATE OCT. 19TH", prize: "GOLD DIVISION $500+", entry: "$30 ENTRY", rule: "SILVER DIVISION $300+", ruleNote: "$15 ENTRY", details: "BRONZE DIVISION $100 · NO ENTRY FEE", subtitle: "REGISTRATION OPENS SEPT. 21", footer: "CASH PRIZE FOR GOLDEN BOOT, GLOVE, AND BALL WITH GFX CARDS" },
  "event-trophy-welcome": { headline: "BANDITZ FC27", name: "BANDITZ", subtitle: "WELCOME", date: "WELCOME FC27 SEASON", footer: "ACL D1 EAST CHAMPS | FMVP D1 | VPN WEST | LIGA VPN | LIGA PREMIER" },
  "event-chrome-season": { headline: "VCL", name: "SEASON 7", date: "JULY 6TH", subtitle: "GET READY FOR SEASON 7", prize: "DIV1 $75", entry: "DIV2 $50", footer: "FEEL FREE TO REACH OUT TO LEAGUE STAFF · All league payments are submitted by June 28th to guarantee your spot for the Upcoming Season" },
  "event-mega-purple": { headline: "RELAMPAGO", name: "Semental", subtitle: "MEGA RELAMPAGO", entry: "ENTRY FREE", prize: "PRIZE $200", details: "TIME 9PM MEXICO | 10PM CENTRAL USA | SUNDAY 16 AUGUST", footer: "FREE 11V11 CLUBS TOURNAMENT WITH CASH PRIZES · DISCORD.GG/SEMENTAL" },
  "event-magazine-desk": { headline: "RELAMPAGO SUNDAY", name: "Semental Pro Clubs League", subtitle: "PRO CLUBS LEAGUE", prize: "PRIZE $150", details: "10PM CENTRAL · 9PM MEXICO · 8PM WESTERN · 11PM EASTERN", footer: "FOOTBALL · COMMUNITY · COMPETITION · GLORY" },
  "event-marquee-winner": { prize: "$100 WINNER", headline: "1V1 ULTIMATE TEAM", entry: "Free Entry", footer: "SEMENTAL · SEMENTAL" },
  "event-knight-dungeon": { name: "Rpcl X Qfg", headline: "BYOT", date: "COMING OCTOBER FC 27", prize: "$1000", entry: "Free Entry" },
  "event-golden-palace": { headline: "SEMENTAL", name: "SEASON 1", date: "STARTS: OCTOBER 23", prize: "$1500", subtitle: "in prices", details: "10PM CENTRAL TIME // 9PM MEXICO // 8PM WESTERN // 11PM EASTERN", footer: "MATCH DAYS: FRIDAYS & SUNDAYS" },
};
