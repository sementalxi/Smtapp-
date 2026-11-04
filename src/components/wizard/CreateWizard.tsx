"use client";

import { TypeIcon } from "./TypeIcon";
import { thumb } from "@/lib/thumb";
import { sfx } from "@/lib/sfx";
import { FontPicker } from "./FontPicker";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useT } from "@/i18n/client";
import type { ClientTemplate } from "@/lib/samples";
import { BannerInputs, EMPTY_INPUTS, LayoutKind } from "@/lib/templates";
import { ART_TYPES, BG_POSES, BG_SCENES, PALETTES, LANGUAGES, TROPHY_STYLES } from "@/lib/pro-options";
import { TemplateThumb } from "../TemplateThumb";
import { ImageDrop } from "../ImageDrop";
import { SavedPicker, updateSavedCache, type SavedItem } from "./SavedPicker";
import { parseLine } from "@/lib/roster";
import { positionsFor, slotsToLogos, slotsToPhotos, slotsToTotwLines } from "@/lib/formations";
import { LineupBuilder, slotsToLines, type Slot } from "./LineupBuilder";
import { AiVideo } from "../AiVideo";
import { DownloadSizes } from "../DownloadSizes";
import { GenerationProgress } from "../GenerationProgress";
import { forgetPending, pendingBanner, rememberPending, waitForBanner } from "@/lib/wait-banner";
import { useRouter } from "next/navigation";
import { useWakeLock } from "../useWakeLock";

const FORMATIONS = ["4-3-3", "4-4-2", "4-2-3-1", "4-1-2-1-2", "3-5-2", "3-4-3", "5-3-2", "4-5-1"];

const TXT = {
  en: {
    steps: ["Type", "Style", "Details", "Look & colors", "Generate"],
    stepSub: ["What are you making?", "Choose the visual", "Fill in the details", "Logo, background and colors", "Generate and download"],
    next: "Next",
    back: "Back",
    photo: "Player photo",
    photoOpt: "Photo (optional) — a player to feature",
    team: "Team",
    home: "Home team",
    away: "Away team",
    champ: "Championship / competition",
    league: "League / organizer logo",
    infoLine: "Info line (optional, small at the bottom)",
    infoPh: "Free 11v11 clubs tournament with cash prizes",
    name: "Player name / gamertag",
    position: "Position",
    number: "Number",
    tagline: "Small top word (e.g. WELCOME, MVP)",
    subtitle: "Accent line",
    footer: "Bottom line (league, edition)",
    date: "Date",
    time: "Kick-off time",
    venue: "Venue / platform",
    formation: "Formation",
    players: "Players — one per line: number name position",
    playersPh: "1 Bryant GK\n2 Nesta1 RB\n4 Silent54 CB\n…",
    squad: "List of champion players (one per line or comma-separated)",
    squadPh: "xChrome, Vernos7, AceKing, ProMan…",
    trophy: "Trophy style",
    trophyUpload: "…or upload your own trophy image",
    prize: "Prize",
    homeScore: "Home goals",
    awayScore: "Away goals",
    scorers: "Goal scorers (one per line)",
    headline: "Headline",
    title: "Event title",
    details: "Times / details",
    extra: "Extra idea for the AI (optional)",
    extraPh: "e.g. lightning, snow, golden crown",
    lang: "Text language",
    langHint: "Team, player and competition names are always kept exactly as you typed them.",
    primary: "Primary style (titles, highlight)",
    secondary: "Secondary style (names, numbers, text)",
    pick: "Select a style…",
    preview: "Preview",
    generate: "Generate art",
    finish: "Finish",
    artType: "Art type",
    status: "Status",
    creditsUsed: "Credits used",
    balance: "Your balance",
    download: "Download",
    edit: "Edit text / new version",
    another: "Create another",
    needCredits: "Not enough credits",
    getCredits: "Get credits",
    stages: ["Planning art…", "Generating background…", "Adding elements…", "Applying visual effects…", "Finalizing image…"],
    wait: "This may take a minute or two — keep this page open.",
    completed: "Completed",
    generating: "Generating…",
    failed: "Failed — credits refunded",
    noPro: "Pro AI isn't set up yet. Add OPENAI_API_KEY in Vercel.",
    required: "Fill in the required fields (*) to continue.",
  },
  es: {
    steps: ["Tipo", "Estilo", "Detalles", "Aspecto y colores", "Generar"],
    stepSub: ["¿Qué vas a crear?", "Elige el visual", "Completa los detalles", "Logo, fondo y colores", "Genera y descarga"],
    next: "Siguiente",
    back: "Atrás",
    photo: "Foto del jugador",
    photoOpt: "Foto (opcional) — un jugador destacado",
    team: "Equipo",
    home: "Equipo local",
    away: "Equipo visitante",
    champ: "Torneo / competición",
    league: "Logo de la liga / organizador",
    infoLine: "Línea de información (opcional, pequeña abajo)",
    infoPh: "Relámpago de clubes 11v11 gratis con premios en efectivo",
    name: "Nombre / gamertag",
    position: "Posición",
    number: "Número",
    tagline: "Palabra superior (ej. WELCOME, MVP)",
    subtitle: "Línea de acento",
    footer: "Línea inferior (liga, edición)",
    date: "Fecha",
    time: "Hora",
    venue: "Lugar / plataforma",
    formation: "Formación",
    players: "Jugadores — uno por línea: número nombre posición",
    playersPh: "1 Bryant POR\n2 Nesta1 LD\n4 Silent54 DFC\n…",
    squad: "Lista de jugadores campeones (uno por línea o separados por coma)",
    squadPh: "xChrome, Vernos7, AceKing, ProMan…",
    trophy: "Estilo de trofeo",
    trophyUpload: "…o sube la imagen de tu trofeo",
    prize: "Premio",
    homeScore: "Goles local",
    awayScore: "Goles visitante",
    scorers: "Goleadores (uno por línea)",
    headline: "Titular",
    title: "Título del evento",
    details: "Horarios / detalles",
    extra: "Idea extra para la IA (opcional)",
    extraPh: "ej. rayos, nieve, corona dorada",
    lang: "Idioma del texto",
    langHint: "Los nombres de equipos, jugadores y torneos se mantienen exactamente como los escribes.",
    primary: "Estilo principal (títulos)",
    secondary: "Estilo secundario (nombres, números, texto)",
    pick: "Elige un estilo…",
    preview: "Vista previa",
    generate: "Generar arte",
    finish: "Final",
    artType: "Tipo de arte",
    status: "Estado",
    creditsUsed: "Créditos usados",
    balance: "Tu saldo",
    download: "Descargar",
    edit: "Editar texto / nueva versión",
    another: "Crear otro",
    needCredits: "No tienes créditos suficientes",
    getCredits: "Conseguir créditos",
    stages: ["Planeando el arte…", "Generando el fondo…", "Añadiendo elementos…", "Aplicando efectos…", "Finalizando imagen…"],
    wait: "Puede tardar uno o dos minutos — no cierres esta página.",
    completed: "Completado",
    generating: "Generando…",
    failed: "Falló — créditos devueltos",
    noPro: "La IA Pro aún no está configurada. Agrega OPENAI_API_KEY en Vercel.",
    required: "Completa los campos obligatorios (*) para continuar.",
  },
};

const lines = (s: string) => s.split(/\n|,/).map((x) => x.trim()).filter(Boolean);
/** Fields that are plain numbers — they get the digit keypad on phones. */
const NUMERIC_FIELDS = new Set<string>(["number", "homeScore", "awayScore"]);

const SWATCHES = [
  "#e10600", "#ff5a1f", "#ffb800", "#ffd35a", "#b6ff1a", "#0fbf6b", "#00a88f", "#00e5ff",
  "#1d5bff", "#1a2f7a", "#7b2cff", "#ff2bd6", "#ff3d8b", "#8b0000", "#ffffff", "#c0c7d1", "#111111",
];

export function CreateWizard({
  templates,
  credits: initialCredits,
  cost,
  proEnabled,
  initialLayout,
  initialChamp = null,
  categories,
  season = null,
  seasonStart = false,
  typePics = {},
  expectedSeconds = 100,
}: {
  templates: ClientTemplate[];
  credits: number;
  cost: number;
  proEnabled: boolean;
  initialLayout?: LayoutKind;
  /** League picked before opening the creator (from "My leagues"). */
  initialChamp?: SavedItem | null;
  /** Visible categories in the admin's order. */
  categories?: LayoutKind[];
  /** Holiday/season the admin turned on (null = off). */
  season?: { key: string; emoji: string; en: string; es: string } | null;
  seasonStart?: boolean;
  /** Pictures the admin chose for the type boxes (Admin → Styles). */
  typePics?: Record<string, string>;
  /** How long the chosen poster generator usually takes (for the progress bar). */
  expectedSeconds?: number;
}) {
  const { locale } = useT();
  const L = TXT[locale === "es" ? "es" : "en"];
  const [step, setStep] = useState(initialLayout ? 2 : 1);
  // Every step change starts at the top of the page (phones stayed scrolled down).
  const [firstStep, setFirstStep] = useState(true);
  useEffect(() => {
    if (firstStep) {
      // Opening the page: start at the very top (the browser sometimes keeps the old scroll and hides the title under the header).
      window.scrollTo(0, 0);
      return setFirstStep(false);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);
  const [layout, setLayout] = useState<LayoutKind>(initialLayout ?? "PLAYER");
  const [seasonMode, setSeasonMode] = useState(!!season && seasonStart);
  const [format, setFormat] = useState<"post" | "story" | "banner">("post");
  const es5 = locale === "es";
  // A sample poster per type, shown behind the type cards.
  const typePic = useMemo(() => {
    const m: Record<string, string> = {};
    for (const t of templates) if (t.thumbUrl && !m[t.layout]) m[t.layout] = thumb(t.thumbUrl, 420);
    for (const [k, v] of Object.entries(typePics)) if (v) m[k] = thumb(v, 420);
    m.ROSTER = m.ROSTER || m.PLAYER;
    m.TEAMSET = m.TEAMSET || m.PLAYER;
    return m;
  }, [templates, typePics]);
  const styles = useMemo(() => templates.filter((t) => t.layout === layout), [templates, layout]);
  // Warm the style previews in the background so step 2 shows them instantly.
  useEffect(() => {
    const urls = templates.filter((t) => t.thumbUrl).map((t) => thumb(t.thumbUrl!, 420));
    const go = () => {
      let i = 0;
      const next = () => {
        if (i >= urls.length) return;
        const img = new Image();
        img.decoding = "async";
        img.onload = img.onerror = next;
        img.src = urls[i++];
      };
      for (let k = 0; k < 4; k++) next(); // 4 at a time
    };
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number };
    if (w.requestIdleCallback) w.requestIdleCallback(go);
    else setTimeout(go, 300);
  }, [templates]);
  const [tplId, setTplId] = useState<string | null>(null);
  const tpl = styles.find((t) => t.id === tplId) ?? null;
  // Team logo category: "create a new logo" styles vs "show off my logo" styles.
  const logoCreate = layout === "LOGO" && !!tpl && (tpl.logoCreate || /^logo-new-/.test(tpl.slug));
  // Team of the week: the cards borrow the look of one of the player-card styles.
  const effCost = cost;
  const cardStyles = useMemo(() => templates.filter((t) => t.layout === "PLAYER"), [templates]);
  const [cardTplId, setCardTplId] = useState<string | null>(null);
  const cardTpl = cardStyles.find((t) => t.id === cardTplId) ?? cardStyles[0] ?? null;
  // Wide styles always come out as a 16:9 banner (the size picker is hidden for them).
  const wideStyle = !!tpl?.wide;
  useEffect(() => {
    if (wideStyle) setFormat("banner");
    else if (format === "banner" && tpl && !tpl.wide) setFormat("post");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tplId]);

  const [inp, setInp] = useState<BannerInputs>({ ...EMPTY_INPUTS, language: locale === "es" ? "Español" : "English" });
  const set = <K extends keyof BannerInputs>(k: K, v: BannerInputs[K]) => setInp((x) => ({ ...x, [k]: v }));
  const [photo, setPhoto] = useState<string | null>(null);
  const [team, setTeam] = useState<SavedItem | null>(null);
  const [home, setHome] = useState<SavedItem | null>(null);
  const [away, setAway] = useState<SavedItem | null>(null);
  const [champ, setChamp] = useState<SavedItem | null>(initialChamp);
  const [playersText, setPlayersText] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const lineupPlayers = inp.formation ? slotsToLines(inp.formation, slots) : lines(playersText);
  // Team of the week: always built on the pitch (4-3-3 unless another formation is picked).
  const totwFormation = inp.formation || "4-3-3";
  const totwPlayers = slotsToTotwLines(totwFormation, slots);
  const [squadText, setSquadText] = useState("");
  const [scorersText, setScorersText] = useState("");
  const [barDone, setBarDone] = useState(false);
  const [genStage, setGenStage] = useState<string | null>(null);
  // Standings table rows
  type TRow = { team: string; p: string; w: string; d: string; l: string; gd: string; pts: string };
  const blankRow = (): TRow => ({ team: "", p: "", w: "", d: "", l: "", gd: "", pts: "" });
  const [table, setTable] = useState<TRow[]>(() => Array.from({ length: 6 }, blankRow));
  const [myTeams, setMyTeams] = useState<{ name: string; logoUrl: string | null }[]>([]);
  useEffect(() => {
    if ((layout !== "STANDINGS" && layout !== "TOTW") || myTeams.length) return;
    fetch("/api/saved?kind=team", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => Array.isArray(d?.items) && setMyTeams(d.items))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout]);
  const tableRows = table.filter((t) => t.team.trim());
  // Team of the week: the league's standings bring the clubs and their points to the club picker.
  const [leagueTeams, setLeagueTeams] = useState<{ name: string; pts: string }[]>([]);
  useEffect(() => {
    if (layout !== "TOTW" || !champ?.id) {
      setLeagueTeams([]);
      return;
    }
    fetch(`/api/standings?league=${encodeURIComponent(champ.id)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setLeagueTeams(Array.isArray(d?.table?.rows) ? d.table.rows.filter((r: { team?: string }) => r.team?.trim()).map((r: { team: string; pts?: string }) => ({ name: r.team.trim(), pts: (r.pts ?? "").trim() })) : []))
      .catch(() => setLeagueTeams([]));
  }, [champ?.id, layout]);
  const totwClubs = useMemo(() => {
    const out: { name: string; logoUrl: string | null; pts?: string }[] = [];
    const seen = new Set<string>();
    for (const t of leagueTeams) {
      seen.add(t.name.toLowerCase());
      out.push({ name: t.name, logoUrl: myTeams.find((m) => m.name.toLowerCase() === t.name.toLowerCase())?.logoUrl ?? null, pts: t.pts });
    }
    for (const m of myTeams) if (!seen.has(m.name.toLowerCase())) out.push({ name: m.name, logoUrl: m.logoUrl });
    return out;
  }, [leagueTeams, myTeams]);
  // Each league keeps its own saved table: picking the league loads it, generating (or "Save") updates it.
  const [tableMsg, setTableMsg] = useState("");
  useEffect(() => {
    if (layout !== "STANDINGS" || !champ?.id) return;
    setTableMsg("");
    fetch(`/api/standings?league=${encodeURIComponent(champ.id)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        const t = d?.table;
        if (t?.rows?.length) {
          setTable([...t.rows, ...Array.from({ length: Math.max(0, 2 - t.rows.length) }, blankRow)]);
          setInp((x) => ({ ...x, headline: x.headline || t.headline || "", date: t.date || x.date }));
          setTableMsg(locale === "es" ? `✓ Tabla guardada de ${champ.name} cargada — solo actualízala.` : `✓ Saved ${champ.name} table loaded — just update it.`);
        } else setTable(Array.from({ length: 6 }, blankRow));
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [champ?.id, layout]);
  function saveTable(quiet = false) {
    if (layout !== "STANDINGS" || !champ?.id || !tableRows.length) return;
    fetch("/api/standings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ league: champ.id, rows: tableRows, headline: inp.headline, date: inp.date }) })
      .then((r) => {
        if (r.ok && !quiet) setTableMsg(locale === "es" ? `💾 Tabla guardada en ${champ.name}.` : `💾 Table saved to ${champ.name}.`);
      })
      .catch(() => {});
  }
  const rowText = (t: TRow, n: number) =>
    [`${n + 1}. ${t.team.trim()}`, ...([["P", t.p], ["W", t.w], ["D", t.d], ["L", t.l], ["GD", t.gd], ["PTS", t.pts]] as const).filter(([, v]) => v.trim()).map(([k, v]) => `${k} ${v.trim()}`)].join(" · ");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMsg, setAiMsg] = useState("");
  const [undoText, setUndoText] = useState<BannerInputs | null>(null);

  const [credits, setCredits] = useState(initialCredits);
  const [phase, setPhase] = useState<"idle" | "busy" | "done" | "error">("idle");
  useWakeLock(phase === "busy"); // screen stays on while the poster is being made
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ id: string; url: string | null } | null>(null);

  useEffect(() => {
    if (!styles.some((s) => s.id === tplId)) setTplId(styles[0]?.id ?? null);
  }, [styles, tplId]);

  // If the browser reloaded the page while a poster was being made, jump to it.
  const router = useRouter();
  useEffect(() => {
    const id = pendingBanner();
    if (id) {
      forgetPending();
      router.push(`/banner/${id}`);
    }
  }, [router]);

  const art = ART_TYPES.find((a) => a.layout === layout)!;
  const artName = locale === "es" ? art.es.name : art.en.name;

  // Compose the final inputs from the pickers and text areas.
  function finalInputs(): BannerInputs {
    return {
      ...inp,
      bgPose: inp.bgPose || "style",
      ...(layout === "PLAYER" ? { colorMode: "surprise" as const } : {}),
      color1: inp.colorMode === "custom" ? inp.color1 || "#1d5bff" : inp.color1,
      color2: inp.colorMode === "custom" ? inp.color2 || "#ffd35a" : inp.color2,
      team: team?.name ?? inp.team,
      homeTeam: home?.name ?? inp.homeTeam,
      awayTeam: away?.name ?? inp.awayTeam,
      homeLogoUrl: home?.logoUrl ?? "",
      awayLogoUrl: away?.logoUrl ?? "",
      eventName: champ?.name ?? inp.eventName,
      competition: champ?.name ?? inp.competition,
      champLogoUrl: champ?.logoUrl ?? "",
      formation: layout === "TOTW" ? totwFormation : inp.formation,
      players: (layout === "LINEUP" ? lineupPlayers : layout === "TOTW" ? totwPlayers : lines(playersText)).slice(0, 18),
      playerPhotos: layout === "TOTW" ? slotsToPhotos(totwFormation, slots).slice(0, 18) : [],
      playerLogos: layout === "TOTW" ? slotsToLogos(totwFormation, slots).slice(0, 18) : [],
      roster: (lines(squadText).length ? lines(squadText) : layout === "CHAMPIONS" && team && !team.official ? (team.players ?? []).map((p) => p.name) : []).slice(0, 30),
      scorers: lines(scorersText).slice(0, 12),
      standings: layout === "STANDINGS" ? tableRows.slice(0, 20).map(rowText) : [],
      tableLogos: layout === "STANDINGS" ? tableRows.slice(0, 20).map((t) => myTeams.find((m) => m.name.toLowerCase() === t.team.trim().toLowerCase())?.logoUrl ?? "") : [],
    };
  }

  function detailsValid() {
    switch (layout) {
      case "PLAYER":
        return !!photo && !!inp.name.trim();
      case "CHAMPIONS":
        return !!team;
      case "MATCHDAY":
      case "RESULT":
        return !!home && !!away;
      case "LINEUP":
        return lineupPlayers.length > 0;
      case "TOTW":
        return totwPlayers.length > 0;
      case "EVENT":
        return !!inp.headline.trim();
      case "STANDINGS":
        return tableRows.length >= 2;
      case "LOGO":
        return logoCreate ? !!inp.team.trim() : !!team?.logoUrl;
    }
  }

  async function improveText() {
    const es = locale === "es";
    setAiBusy(true);
    setAiMsg("");
    const before = inp;
    const res = await fetch("/api/ai-text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        layout,
        language: inp.language || (es ? "Español" : "English"),
        inputs: Object.fromEntries(
          Object.entries(finalInputs()).filter(([, v]) => typeof v === "string" && v && !/^https?:|^\/api\//.test(v)),
        ),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setAiBusy(false);
    if (res.ok && data.fields && Object.keys(data.fields).length) {
      setUndoText(before);
      setInp((x) => ({ ...x, ...data.fields }));
      setAiMsg(es ? "¡Listo! Revisa y edita lo que quieras." : "Done! Check it and edit anything you like.");
    } else {
      setAiMsg(
        data.error === "too_many_requests"
          ? es ? "Demasiados intentos, espera un poco." : "Too many tries, wait a bit."
          : es ? "La IA no pudo mejorar el texto, intenta otra vez." : "The AI couldn't improve the text, try again.",
      );
    }
  }

  // ── "My teams": fill players from the saved roster, and save new ones back ──
  const roster = team && !team.official ? team.players ?? [] : [];
  function fillFromTeam() {
    if (!roster.length) return;
    if (layout === "CHAMPIONS") return setSquadText(roster.map((p) => p.name).join("\n"));
    if (inp.formation) {
      const pos = positionsFor(inp.formation);
      const used = new Set<number>();
      const pick = (f: (p: (typeof roster)[number]) => boolean) => {
        const i = roster.findIndex((p, j) => !used.has(j) && f(p));
        if (i < 0) return null;
        used.add(i);
        return roster[i];
      };
      const out: (typeof roster[number] | null)[] = pos.map((code) => pick((p) => p.pos === code));
      for (let k = 0; k < out.length; k++) if (!out[k]) out[k] = pick((p) => !p.pos) ?? pick(() => true);
      setSlots(out.map((p) => ({ num: p?.num ?? "", name: p?.name ?? "" })));
    } else setPlayersText(roster.slice(0, 11).map((p) => [p.num, p.name, p.pos].filter(Boolean).join(" ")).join("\n"));
  }
  useEffect(() => {
    // Auto-fill when a saved team is picked and nothing is typed yet.
    if (!roster.length) return;
    if (layout === "CHAMPIONS" && !squadText.trim()) fillFromTeam();
    if (layout === "LINEUP" && !playersText.trim() && !slots.some((x) => x.name.trim())) fillFromTeam();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team?.id, inp.formation, layout]);
  function saveRosterBack() {
    if (!team || team.official) return;
    const known = new Set(["GK", "RB", "CB", "LB", "RWB", "LWB", "CDM", "CM", "CAM", "RM", "LM", "RW", "LW", "CF", "ST"]);
    const merge =
      layout === "LINEUP"
        ? inp.formation
          ? positionsFor(inp.formation).map((pos, i) => ({ num: slots[i]?.num.trim() ?? "", name: slots[i]?.name.trim() ?? "", pos })).filter((p) => p.name)
          : lines(playersText).map((l) => parseLine(l, known)).filter((p) => p.name)
        : layout === "CHAMPIONS"
          ? lines(squadText).map((n) => ({ num: "", name: n.slice(0, 30), pos: "" }))
          : [];
    if (!merge.length) return;
    fetch(`/api/saved/${team.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ merge: merge.slice(0, 40) }) })
      .then((r) => r.json())
      .then((d) => {
        if (d.item) {
          updateSavedCache("team", d.item);
          setTeam(d.item);
        }
      })
      .catch(() => {});
  }

  async function generate() {
    saveRosterBack();
    saveTable(true);
    setGenStage("queued");
    setPhase("busy");
    setError("");
    const res = await fetch("/api/banners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        templateId: tpl?.id,
        inputs: finalInputs(),
        photoUrl: photo,
        logoUrl: logoCreate ? null : team?.logoUrl ?? null,
        mode: "PRO",
        ...(seasonMode && season ? { season: true } : {}),
        ...(format !== "post" ? { format } : {}),
        ...(layout === "TOTW" && cardTpl ? { cardTemplateId: cardTpl.id } : {}),
      }),
    });
    let data = await res.json().catch(() => ({}));
    if (res.ok && data.id && !data.finalUrl) {
      // Made in the background — wait for it (survives the screen turning off).
      rememberPending(data.id);
      const w = await waitForBanner(data.id, { onStage: setGenStage });
      forgetPending();
      data = w.ok ? { id: data.id, finalUrl: w.url } : { error: w.error, detail: w.detail };
    }
    if (data.id && data.finalUrl) {
      // Show the bar at 100% for a moment before the poster appears.
      setBarDone(true);
      await new Promise((r) => setTimeout(r, 1300));
      setBarDone(false);
      setResult({ id: data.id, url: data.finalUrl ?? null });
      setCredits((c) => c - effCost);
      setPhase("done");
      sfx("done");
      router.refresh(); // header credits update right away
    } else {
      const msg =
        data.error === "err_credits"
          ? L.needCredits
          : data.error === "err_photo_blocked"
            ? (locale === "es"
                ? "El filtro de seguridad de la IA rechazó esta FOTO (no se cobraron créditos). Usa otra foto: una persona adulta, con ropa, sin armas — las fotos de famosos a veces se rechazan."
                : "The AI's safety filter rejected this PHOTO (no credits were charged). Use a different photo: an adult, fully clothed, no weapons — photos of famous people are sometimes refused.") + (data.detail ? ` — ${data.detail}` : "")
          : data.error === "err_blocked"
            ? (locale === "es"
                ? "El filtro de seguridad de la IA bloqueó este póster (no se cobraron créditos). Prueba con otra foto o cambia palabras fuertes en el texto."
                : "The AI's safety filter blocked this poster (no credits were charged). Try a different photo or change strong words in the text.") + (data.detail ? ` — ${data.detail}` : "")
            : data.error === "err_ai_down"
              ? (locale === "es" ? "La IA no está disponible por el momento — inténtalo de nuevo en unos minutos. Tus créditos fueron devueltos." : "The AI is temporarily unavailable — please try again in a few minutes. Your credits were refunded.") + (data.detail ? ` — ${data.detail}` : "")
              : (locale === "es" ? "Algo salió mal." : "Something went wrong.") + (data.detail ? ` — ${data.detail}` : "");
      setError(msg);
      setPhase("error");
      sfx("error");
    }
  }

  function reset() {
    setResult(null);
    setPhase("idle");
    setStep(1);
  }

  if (!proEnabled) return <p className="card p-6 text-sm text-amber-200">{L.noPro}</p>;

  // ── UI ─────────────────────────────────────────────────
  const Stepper = (
    <div className="mb-6">
      <div className="flex items-center">
        {L.steps.map((_, i) => {
          const n = i + 1;
          const done = n < step || phase === "done";
          const active = n === step;
          return (
            <div key={n} className="flex flex-1 items-center last:flex-none">
              <span
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold ${
                  done ? "bg-lime text-ink" : active ? "border-2 border-lime text-lime" : "border border-line text-muted"
                }`}
              >
                {done ? "✓" : n}
              </span>
              {n < 5 && <span className={`mx-1 h-0.5 flex-1 ${n < step ? "bg-lime" : "bg-line"}`} />}
            </div>
          );
        })}
      </div>
      <div className="mt-3 text-center">
        <div className="font-bold">{L.steps[step - 1]}</div>
        <div className="text-xs text-muted">{L.stepSub[step - 1]}</div>
      </div>
    </div>
  );

  const nav = ({ canNext, onNext, nextLabel }: { canNext: boolean; onNext: () => void; nextLabel?: string }) => (
    <div className="kixo-stepbar flex items-center justify-between gap-3">
      {step > 1 ? (
        <button type="button" className="rounded-lg px-2 py-2 text-sm font-semibold text-muted hover:text-white" onClick={() => setStep(step - 1)}>
          ‹ {L.back}
        </button>
      ) : (
        <span />
      )}
      <div className="flex items-center gap-3">
        {!canNext && <span className="hidden text-[11px] text-muted sm:inline">{L.required}</span>}
        <button type="button" className="btn-primary min-w-32 py-3" disabled={!canNext} onClick={onNext}>
          {nextLabel ?? L.next} ›
        </button>
      </div>
    </div>
  );

  const field = ({ label, k, req, max = 40, ph }: { label: string; k: keyof BannerInputs; req?: boolean; max?: number; ph?: string }) => (
    <div>
      <label className="label">
        {label} {req && <span className="text-lime">*</span>}
      </label>
      <input
        className={`input ${k === "position" ? "uppercase" : ""}`}
        maxLength={max}
        placeholder={ph}
        value={inp[k] as string}
        onChange={(e) => set(k, (k === "position" ? e.target.value.toUpperCase() : e.target.value) as never)}
        autoCapitalize={k === "position" ? "characters" : undefined}
        // Numbers (jersey number, scores) open the phone's digit pad.
        inputMode={NUMERIC_FIELDS.has(k) ? "numeric" : undefined}
        pattern={NUMERIC_FIELDS.has(k) ? "[0-9]*" : undefined}
      />
    </div>
  );

  return (
    <div className="mx-auto max-w-2xl" data-sfx-area>
      {Stepper}

      {step === 1 && (
        <div>
          <div className="mb-4 text-center">
            <div className="text-[11px] font-bold uppercase tracking-[0.25em] text-lime">{locale === "es" ? "Paso 1" : "Step 1"}</div>
            <h2 className="font-display mt-1 text-3xl sm:text-4xl">{locale === "es" ? "¿Qué vas a crear?" : "What are you making?"}</h2>
          </div>
          {season && (
            <button
              type="button"
              onClick={() => setSeasonMode((v) => !v)}
              className={`group relative mb-3 flex w-full items-center gap-3.5 overflow-hidden rounded-2xl border p-3.5 text-left transition active:scale-[0.99] sm:p-4 ${seasonMode ? "border-amber-300 bg-gradient-to-r from-amber-400/25 via-rose-500/15 to-panel shadow-[0_10px_40px_-14px_rgba(251,191,36,0.8)]" : "border-amber-300/40 bg-gradient-to-r from-amber-400/10 via-panel-2 to-panel hover:border-amber-300/80"}`}
            >
              {typePic.SEASON ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={typePic.SEASON} alt="" loading="lazy" decoding="async" className="pointer-events-none absolute inset-y-0 right-0 h-full w-1/2 object-cover opacity-40 transition duration-700 [mask-image:linear-gradient(90deg,transparent,black)] group-hover:scale-110" />
              ) : (
                <span aria-hidden className="pointer-events-none absolute -right-6 -top-8 text-[7rem] leading-none opacity-15 transition group-hover:scale-110">{season.emoji}</span>
              )}
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-amber-300/60 bg-ink/50 text-2xl">{season.emoji}</span>
              <span className="relative min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-[15px] font-extrabold sm:text-base">{locale === "es" ? `Flyers de ${season.es}` : `${season.en} flyers`}</span>
                  <span className="rounded-full bg-amber-300 px-1.5 py-0.5 text-[9px] font-extrabold text-ink">{locale === "es" ? "TEMPORADA" : "SEASON"}</span>
                </span>
                <span className="mt-0.5 block text-[11px] leading-snug text-muted sm:text-xs">
                  {seasonMode
                    ? locale === "es" ? "✅ Activado — elige abajo qué quieres crear y saldrá con el tema." : "✅ On — pick what to make below and it comes out with the theme."
                    : locale === "es" ? "Toca para activar el tema de temporada en tu póster." : "Tap to put the holiday theme on your poster."}
                </span>
              </span>
              <span className={`relative grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 text-sm font-black ${seasonMode ? "border-amber-300 bg-amber-300 text-ink" : "border-amber-300/50 text-transparent"}`}>✓</span>
            </button>
          )}
          <div className="grid grid-cols-2 gap-3">
            {(categories ? categories.map((l) => ART_TYPES.find((a) => a.layout === l)!).filter(Boolean) : ART_TYPES).map((a) => {
              const sel = a.layout === layout;
              return (
                <button
                  key={a.layout}
                  type="button"
                  data-sfx="select"
                  onClick={() => { setLayout(a.layout); setStep(2); }}
                  className={`group relative flex min-h-[9.5rem] flex-col overflow-hidden rounded-2xl border p-3.5 text-left transition active:scale-[0.98] sm:p-4 ${
                    sel
                      ? "border-lime/70 bg-gradient-to-br from-lime/15 via-panel-2 to-panel shadow-[0_10px_30px_-14px_rgba(255,46,136,0.7)]"
                      : "border-line bg-gradient-to-br from-panel-2 to-panel hover:border-lime/40"
                  }`}
                >
                  {typePic[a.layout] ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={typePic[a.layout]} alt="" loading="lazy" decoding="async" className={`pointer-events-none absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-110 ${sel ? "opacity-60" : "opacity-40 group-hover:opacity-55"}`} />
                      <span aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink via-ink/75 to-ink/20" />
                    </>
                  ) : (
                    <span aria-hidden className="pointer-events-none absolute -top-10 -right-10 h-28 w-28 rounded-full bg-lime/10 blur-2xl transition group-hover:bg-lime/20" />
                  )}
                  <span className="relative flex items-start justify-between gap-2">
                    <span className={`grid h-11 w-11 place-items-center rounded-xl border backdrop-blur ${sel ? "border-lime/60 bg-lime text-ink" : "border-lime/40 bg-ink/60 text-lime"}`}>
                      <TypeIcon layout={a.layout} />
                    </span>
                    <span className="rounded-full border border-line bg-ink/70 px-2 py-0.5 text-[10px] font-bold text-white/80 backdrop-blur">⚡ {cost}</span>
                  </span>
                  <span className="relative mt-auto block pt-3 text-[15px] font-extrabold leading-tight [text-shadow:0_2px_10px_rgba(0,0,0,0.9)] sm:text-base">{locale === "es" ? a.es.name : a.en.name}</span>
                  <span className="relative mt-1 line-clamp-2 block text-[11px] leading-snug text-white/70 sm:text-xs">{locale === "es" ? a.es.desc : a.en.desc}</span>
                </button>
              );
            })}
            <Link
              href="/create/roster"
              className="group relative isolate col-span-2 flex items-center gap-3.5 overflow-hidden rounded-2xl border border-lime/40 bg-gradient-to-r from-lime/10 via-panel-2 to-panel p-3.5 text-left transition hover:border-lime/70 active:scale-[0.99] sm:p-4"
            >
              {typePic.ROSTER && (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={typePic.ROSTER} alt="" loading="lazy" decoding="async" className="pointer-events-none absolute inset-y-0 right-0 -z-10 h-full w-1/2 object-cover opacity-35 transition duration-700 [mask-image:linear-gradient(90deg,transparent,black)] group-hover:scale-110 group-hover:opacity-50" />
                </>
              )}
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-lime/40 bg-lime/10 text-lime">
                <TypeIcon layout="RESULT" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="text-[15px] font-extrabold sm:text-base">{locale === "es" ? "Banners de plantilla" : "Roster banners"}</span>
                  <span className="rounded-full bg-lime px-1.5 py-0.5 text-[9px] font-extrabold text-ink">{locale === "es" ? "NUEVO" : "NEW"}</span>
                </span>
                <span className="mt-0.5 line-clamp-2 block text-[11px] leading-snug text-muted sm:text-xs">
                  {locale === "es" ? "Sube varios jugadores y recibe un banner ancho por cada uno, mismo diseño." : "Upload several players, get one wide banner each — same design."}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block text-[10px] font-bold text-muted">⚡ {cost}</span>
                <span className="block text-[9px] text-muted">{locale === "es" ? "c/u" : "each"}</span>
              </span>
            </Link>
            <Link
              href="/create?team=1"
              className="group relative isolate col-span-2 flex items-center gap-3.5 overflow-hidden rounded-2xl border border-teal/40 bg-gradient-to-r from-teal/10 via-panel-2 to-panel p-3.5 text-left transition hover:border-teal/70 active:scale-[0.99] sm:p-4"
            >
              {typePic.TEAMSET && (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={typePic.TEAMSET} alt="" loading="lazy" decoding="async" className="pointer-events-none absolute inset-y-0 right-0 -z-10 h-full w-1/2 object-cover opacity-35 transition duration-700 [mask-image:linear-gradient(90deg,transparent,black)] group-hover:scale-110 group-hover:opacity-50" />
                </>
              )}
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-teal/40 bg-teal/10 text-teal">
                <TypeIcon layout="TEAM" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="text-[15px] font-extrabold sm:text-base">{locale === "es" ? "Tarjetas del equipo" : "Team player cards"}</span>
                  <span className="rounded-full bg-teal px-1.5 py-0.5 text-[9px] font-extrabold text-ink">{locale === "es" ? "NUEVO" : "NEW"}</span>
                </span>
                <span className="mt-0.5 line-clamp-2 block text-[11px] leading-snug text-muted sm:text-xs">
                  {locale === "es" ? "Toda la plantilla con el mismo diseño — solo cambia foto, nombre y número." : "The whole squad, same design — just swap photo, name and number."}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block text-[10px] font-bold text-muted">⚡ {cost}</span>
                <span className="block text-[9px] text-muted">{locale === "es" ? "c/u" : "each"}</span>
              </span>
            </Link>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="card p-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {styles.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => { setTplId(s.id); setTimeout(() => setStep(3), 180); }}
                className={`relative overflow-hidden rounded-xl border-2 text-left transition ${s.id === tplId ? "border-lime" : "border-transparent opacity-80 hover:opacity-100"}`}
              >
                <TemplateThumb template={s} eager={styles.indexOf(s) < 4} />
                {s.wide && (
                  <span className="absolute top-1.5 right-1.5 rounded-md bg-ink/80 px-1.5 py-0.5 text-[10px] font-black uppercase text-white shadow backdrop-blur">▭ Banner 16:9</span>
                )}
                {s.badge === "recommended" && (
                  <span className="absolute top-1.5 left-1.5 rounded-md bg-lime px-1.5 py-0.5 text-[10px] font-black uppercase text-ink shadow">⭐ {locale === "es" ? "Recomendado" : "Recommended"}</span>
                )}
                {s.badge === "fire" && (
                  <span className="absolute top-1.5 left-1.5 rounded-md bg-gradient-to-r from-orange-500 to-red-500 px-1.5 py-0.5 text-[10px] font-black uppercase text-white shadow">🔥 {locale === "es" ? "Lo más fire" : "Fire"}</span>
                )}
                <div className="bg-panel-2 px-2 py-1.5 text-xs font-bold">{locale === "es" ? s.nameEs : s.name}</div>
              </button>
            ))}
          </div>
          {styles.length === 0 && <p className="text-sm text-muted">{locale === "es" ? "Aún no hay estilos para este tipo." : "No styles for this type yet."}</p>}
          <p className="mt-4 text-xs text-muted">
            {locale === "es"
              ? "Las miniaturas son una referencia. El arte final lo crea la IA con tus colores, escudos y textos."
              : "Thumbnails are for reference. The final art is created by the AI with your colors, crests and text."}
          </p>
          {nav({ canNext: !!tpl, onNext: () => setStep(3) })}
        </div>
      )}

      {step === 3 && (
        <div className="card space-y-4 p-5">
          {layout === "PLAYER" && (
            <>
              <ImageDrop kind="photo" label={`${L.photo} *`} value={photo} onChange={setPhoto} searchQuery={[inp.name, inp.team].filter(Boolean).join(" ")} />
              <div>
                <span className="label">{locale === "es" ? "Segunda imagen del jugador (fondo, creada por la IA)" : "Second player image (background, made by AI)"}</span>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {[
                    { id: "style", en: "⭐ Recommended", es: "⭐ Recomendado" },
                    ...BG_POSES,
                    { id: "none", en: "🚫 No second image", es: "🚫 Sin segunda imagen" },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => set("bgPose", p.id)}
                      className={`rounded-lg border px-3 py-2.5 text-left text-sm ${(inp.bgPose || "style") === p.id ? "border-lime bg-lime/5" : "border-line bg-panel-2"}`}
                    >
                      {locale === "es" ? p.es : p.en}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-xs text-muted">
                  {locale === "es"
                    ? "La IA crea una pose nueva del mismo jugador para el fondo, en el mismo estilo del póster."
                    : "The AI creates a new pose of the same player for the background, in the same style as the poster."}
                </p>
              </div>
              <SavedPicker kind="team" label={L.team} value={team} onChange={setTeam} />
              {field({ label: L.name, k: "name", req: true })}
              <div className="grid grid-cols-2 gap-3">
                {field({ label: L.position, k: "position", max: 24, ph: "ST · CAM | OM" })}
                {field({ label: L.number, k: "number", max: 4 })}
              </div>
              {field({ label: L.tagline, k: "tagline", max: 30 })}
              {field({ label: L.subtitle, k: "subtitle" })}
            </>
          )}

          {layout === "CHAMPIONS" && (
            <>
              <SavedPicker kind="team" label={L.team} value={team} onChange={setTeam} required />
              <SavedPicker kind="championship" label={L.champ} value={champ} onChange={setChamp} />
              {field({ label: L.date, k: "date", max: 30, ph: "Nov 2026" })}
              <div>
                <span className="label">{L.trophy}</span>
                <div className="grid grid-cols-2 gap-2">
                  {TROPHY_STYLES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => set("trophy", t.id)}
                      className={`rounded-lg border px-3 py-2.5 text-left text-sm ${t.id === "surprise" ? "col-span-full border-dashed font-bold " : ""}${inp.trophy === t.id && !inp.trophyUrl ? "border-lime bg-lime/5" : "border-line bg-panel-2"}`}
                    >
                      {t.id === "surprise" ? (locale === "es" ? "🎲 Sorpréndeme (trofeo diferente cada vez)" : "🎲 Surprise me (a different cup every time)") : `🏆 ${t.label}`}
                    </button>
                  ))}
                </div>
              </div>
              <ImageDrop kind="logo" label={L.trophyUpload} value={inp.trophyUrl || null} onChange={(u) => set("trophyUrl", u ?? "")} />
              {roster.length > 0 && (
                <button type="button" onClick={fillFromTeam} className="flex w-full items-center justify-center gap-2 rounded-xl border border-teal/40 bg-teal/10 py-2.5 text-sm font-bold text-teal">
                  👥 {locale === "es" ? `Usar jugadores de ${team?.name} (${roster.length})` : `Use ${team?.name} players (${roster.length})`}
                </button>
              )}
              <div>
                <label className="label">{L.squad}</label>
                {roster.length > 0 && lines(squadText).length > 0 && (
                  <p className="mb-1.5 text-xs font-bold text-teal">✓ {lines(squadText).length} {locale === "es" ? `jugadores de ${team?.name} — saldrán en el póster` : `players from ${team?.name} — they'll be on the poster`}</p>
                )}
                <textarea className="input min-h-28" placeholder={L.squadPh} value={squadText} onChange={(e) => setSquadText(e.target.value)} />
              </div>
              {field({ label: L.prize, k: "prize", max: 24, ph: "$200 PRIZE" })}
              <ImageDrop kind="photo" label={L.photoOpt} value={photo} onChange={setPhoto} />
            </>
          )}

          {(layout === "MATCHDAY" || layout === "RESULT") && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <SavedPicker kind="team" label={L.home} value={home} onChange={setHome} required />
                <SavedPicker kind="team" label={L.away} value={away} onChange={setAway} required />
              </div>
              <SavedPicker kind="championship" label={L.champ} value={champ} onChange={setChamp} />
              {layout === "MATCHDAY" ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    {field({ label: L.date, k: "date", max: 30, ph: "Fri · Nov 6" })}
                    {field({ label: L.time, k: "time", max: 20, ph: "9:00 PM EST" })}
                  </div>
                  {field({ label: L.venue, k: "venue", max: 48, ph: "EA FC 27 · Pro Clubs" })}
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    {field({ label: L.homeScore, k: "homeScore", max: 3 })}
                    {field({ label: L.awayScore, k: "awayScore", max: 3 })}
                  </div>
                  <div>
                    <label className="label">{L.scorers}</label>
                    <textarea className="input min-h-24" value={scorersText} onChange={(e) => setScorersText(e.target.value)} placeholder={"Krypto 12'\nSantxz 45+1'"} />
                  </div>
                </>
              )}
              <ImageDrop kind="photo" label={L.photoOpt} value={photo} onChange={setPhoto} />
            </>
          )}

          {layout === "LINEUP" && (
            <>
              <SavedPicker kind="team" label={`${L.team} (${locale === "es" ? "opcional" : "optional"})`} value={team} onChange={setTeam} />
              <SavedPicker kind="championship" label={L.champ} value={champ} onChange={setChamp} />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{L.formation}</label>
                  <select className="input" value={inp.formation} onChange={(e) => set("formation", e.target.value)}>
                    <option value="">—</option>
                    {FORMATIONS.map((f) => (
                      <option key={f}>{f}</option>
                    ))}
                  </select>
                </div>
                {field({ label: L.date, k: "date", max: 30, ph: "Matchday 7" })}
              </div>
              {roster.length > 0 && (
                <button type="button" onClick={fillFromTeam} className="flex w-full items-center justify-center gap-2 rounded-xl border border-teal/40 bg-teal/10 py-2.5 text-sm font-bold text-teal">
                  👥 {locale === "es" ? `Usar jugadores de ${team?.name} (${roster.length})` : `Use ${team?.name} players (${roster.length})`}
                </button>
              )}
              {inp.formation ? (
                <div>
                  <label className="label">
                    {locale === "es" ? "Alineación" : "Lineup"} <span className="text-lime">*</span>
                  </label>
                  <LineupBuilder formation={inp.formation} slots={slots} onChange={setSlots} es={locale === "es"} />
                </div>
              ) : (
                <div>
                  <label className="label">
                    {L.players} <span className="text-lime">*</span>
                  </label>
                  <textarea className="input min-h-56 font-mono text-xs" placeholder={L.playersPh} value={playersText} onChange={(e) => setPlayersText(e.target.value)} />
                  <p className="mt-1 text-xs text-muted">{lines(playersText).length}/11 · {locale === "es" ? "o elige una formación para usar la cancha" : "or pick a formation to use the pitch"}</p>
                </div>
              )}
            </>
          )}

          {layout === "TOTW" && (
            <>
              <p className="rounded-xl border border-lime/30 bg-lime/5 p-3 text-xs text-white/80">
                ⭐ {locale === "es" ? "Once tarjetas en formación con el look de tus tarjetas de jugador. Elige la liga: su tabla trae los clubes, sus puntos y sus escudos. El de más puntos sale como jugador de la semana." : "Eleven cards in formation with the look of your player cards. Pick the league: its standings bring the clubs, their points and their crests. The highest points becomes the player of the week."}
              </p>
              <SavedPicker kind="championship" label={L.league} value={champ} onChange={setChamp} />
              {champ?.id && (
                <p className="-mt-1 text-[11px] text-muted">
                  {leagueTeams.length
                    ? locale === "es"
                      ? `✓ ${leagueTeams.length} clubes y sus puntos vienen de la tabla de ${champ.name}.`
                      : `✓ ${leagueTeams.length} clubs and their points come from the ${champ.name} standings.`
                    : locale === "es"
                      ? "Esta liga aún no tiene tabla guardada (Mis ligas) — los clubes salen de Mis equipos."
                      : "This league has no saved standings yet (My leagues) — clubs come from My teams."}
                </p>
              )}
              <div className="grid grid-cols-2 gap-3">
                {field({ label: L.headline, k: "headline", max: 30, ph: locale === "es" ? "EQUIPO DE LA SEMANA" : "TEAM OF THE WEEK" })}
                {field({ label: locale === "es" ? "Semana / división" : "Week / division", k: "date", max: 30, ph: locale === "es" ? "Semana 1 · División 1" : "Week 1 · Division 1" })}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{L.formation}</label>
                  <select className="input" value={totwFormation} onChange={(e) => set("formation", e.target.value)}>
                    {FORMATIONS.map((f) => (
                      <option key={f}>{f}</option>
                    ))}
                  </select>
                </div>
                {field({ label: L.footer, k: "footer", max: 40, ph: locale === "es" ? "Temporada 4" : "Season 4" })}
              </div>
              {cardStyles.length > 0 && (
                <div>
                  <label className="label">🃏 {locale === "es" ? "Look de las tarjetas (un estilo de tarjeta de jugador)" : "Card look (one of your player-card styles)"}</label>
                  <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
                    {cardStyles.map((t) => {
                      const on = cardTpl?.id === t.id;
                      return (
                        <button key={t.id} type="button" onClick={() => setCardTplId(t.id)} className={`w-[88px] shrink-0 overflow-hidden rounded-xl border text-left transition ${on ? "border-lime ring-2 ring-lime/40" : "border-line hover:border-lime/50"}`}>
                          {t.thumbUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={thumb(t.thumbUrl, 200)} alt="" loading="lazy" className="aspect-[4/5] w-full object-cover" />
                          ) : (
                            <span className="grid aspect-[4/5] w-full place-items-center bg-panel-2 text-2xl">🃏</span>
                          )}
                          <span className={`block truncate px-1.5 py-1 text-[10px] font-bold ${on ? "text-lime" : ""}`}>{locale === "es" ? t.nameEs : t.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <div>
                <label className="label">
                  {locale === "es" ? "Los once" : "The eleven"} <span className="text-lime">*</span>
                </label>
                <LineupBuilder mode="totw" formation={totwFormation} slots={slots} onChange={setSlots} es={locale === "es"} teams={totwClubs} />
              </div>
            </>
          )}

          {layout === "LOGO" && (
            logoCreate ? (
              <>
                <p className="rounded-xl border border-lime/30 bg-lime/5 p-3 text-xs text-white/80">
                  🛡️ {locale === "es" ? "La IA diseña un logo NUEVO para tu equipo (cuadrado, listo para redes y Discord)." : "The AI designs a brand-NEW logo for your team (square, ready for socials and Discord)."}
                </p>
                {field({ label: locale === "es" ? "Nombre del equipo" : "Team name", k: "team", req: true, max: 40, ph: "Blitz FC" })}
                {field({ label: locale === "es" ? "Mascota o idea (opcional)" : "Mascot or idea (optional)", k: "subtitle", max: 40, ph: locale === "es" ? "Lobo con corona" : "Wolf with a crown" })}
              </>
            ) : (
              <>
                <p className="rounded-xl border border-lime/30 bg-lime/5 p-3 text-xs text-white/80">
                  🛡️ {locale === "es" ? "Un póster épico que presume tu logo. Elige tu equipo (con su logo) o súbelo." : "An epic poster that shows off your logo. Pick your team (with its logo) or upload it."}
                </p>
                <SavedPicker kind="team" label={L.team} value={team} onChange={setTeam} required />
                {field({ label: L.headline, k: "headline", max: 30, ph: locale === "es" ? "EST. 2026" : "EST. 2026" })}
              </>
            )
          )}

          {layout === "STANDINGS" && (
            <>
              <SavedPicker kind="championship" label={L.league} value={champ} onChange={setChamp} />
              <div className="grid grid-cols-2 gap-3">
                {field({ label: L.headline, k: "headline", max: 30, ph: locale === "es" ? "TABLA DE POSICIONES" : "STANDINGS" })}
                {field({ label: locale === "es" ? "Jornada / semana" : "Matchday / week", k: "date", max: 30, ph: locale === "es" ? "Jornada 7" : "Matchday 7" })}
              </div>
              <div>
                <label className="label">
                  {locale === "es" ? "Tabla" : "Table"} <span className="text-lime">*</span>
                </label>
                {tableMsg && <p className="mb-2 text-xs font-bold text-teal">{tableMsg}</p>}
                {!champ?.id && (
                  <p className="mb-2 text-xs text-muted">{locale === "es" ? "Elige la liga arriba y tu tabla se guarda en ella — la próxima vez solo la actualizas." : "Pick the league above and your table is saved to it — next time you just update it."}</p>
                )}
                <datalist id="kx-my-teams">
                  {myTeams.map((m) => (
                    <option key={m.name} value={m.name} />
                  ))}
                </datalist>
                <div className="overflow-x-auto rounded-xl border border-line">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead>
                      <tr className="bg-panel-2 text-[11px] font-bold uppercase text-muted">
                        <th className="w-8 px-1 py-2">#</th>
                        <th className="px-1 py-2 text-left">{locale === "es" ? "Equipo" : "Team"}</th>
                        {(locale === "es" ? ["PJ", "G", "E", "P", "DG", "PTS"] : ["P", "W", "D", "L", "GD", "PTS"]).map((h) => (
                          <th key={h} className="w-12 px-1 py-2">{h}</th>
                        ))}
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody>
                      {table.map((row, n) => {
                        const setCell = (k: keyof TRow, val: string) => setTable((t) => t.map((x, j) => (j === n ? { ...x, [k]: val } : x)));
                        const logo = myTeams.find((m) => m.name.toLowerCase() === row.team.trim().toLowerCase())?.logoUrl;
                        return (
                          <tr key={n} className={`border-t border-line ${n === 0 ? "bg-lime/5" : ""}`}>
                            <td className="px-1 text-center font-extrabold text-muted">{n + 1}</td>
                            <td className="px-1 py-1">
                              <div className="flex items-center gap-1.5">
                                {logo && (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={logo} alt="" className="h-6 w-6 shrink-0 object-contain" />
                                )}
                                <input className="input !py-1.5" list="kx-my-teams" maxLength={30} value={row.team} placeholder={locale === "es" ? "Nombre del equipo" : "Team name"} onChange={(e) => setCell("team", e.target.value)} />
                              </div>
                            </td>
                            {(["p", "w", "d", "l", "gd", "pts"] as const).map((k) => (
                              <td key={k} className="px-0.5 py-1">
                                <input className={`input !px-1 !py-1.5 text-center ${k === "pts" ? "font-extrabold" : ""}`} inputMode={k === "gd" ? "text" : "numeric"} maxLength={4} value={row[k]} onChange={(e) => setCell(k, e.target.value.replace(k === "gd" ? /[^0-9+\-]/g : /[^0-9]/g, ""))} />
                              </td>
                            ))}
                            <td className="px-1 text-center">
                              {table.length > 2 && (
                                <button type="button" aria-label="remove" className="text-muted hover:text-white" onClick={() => setTable((t) => t.filter((_, j) => j !== n))}>✕</button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {champ?.id && tableRows.length > 0 && (
                    <button type="button" className="rounded-lg border border-lime/50 bg-lime/10 px-3 py-1.5 text-xs font-bold text-lime" onClick={() => saveTable()}>
                      💾 {locale === "es" ? `Guardar tabla en ${champ.name}` : `Save table to ${champ.name}`}
                    </button>
                  )}
                  {table.length < 20 && (
                    <button type="button" className="rounded-lg border border-line px-3 py-1.5 text-xs font-bold hover:border-lime" onClick={() => setTable((t) => [...t, blankRow()])}>
                      + {locale === "es" ? "Agregar equipo" : "Add team"}
                    </button>
                  )}
                  <span className="text-xs text-muted">
                    {locale === "es"
                      ? "En orden del 1º al último. Solo el equipo es obligatorio — deja vacías las columnas que no quieras. Tus equipos guardados salen con su escudo."
                      : "In order, 1st to last. Only the team is required — leave any column empty to hide it. Your saved teams show with their crest."}
                  </span>
                </div>
              </div>
            </>
          )}

          {layout === "EVENT" && (
            <>
              {field({ label: L.headline, k: "headline", req: true, max: 30, ph: "$100 WINNER" })}
              {field({ label: L.title, k: "name", ph: "1v1 Ultimate Team" })}
              {field({ label: L.subtitle, k: "subtitle", ph: "Free Entry" })}
              <div className="grid grid-cols-2 gap-3">
                {field({ label: L.date, k: "date", max: 30 })}
                {field({ label: L.details, k: "details", max: 48, ph: "8 PM · 9 PM" })}
              </div>
              {field({ label: L.prize, k: "prize", max: 24 })}
              {field({ label: L.infoLine, k: "footer", max: 110, ph: L.infoPh })}
              <SavedPicker kind="championship" label={L.league} value={champ} onChange={setChamp} />
              <SavedPicker kind="team" label={L.team} value={team} onChange={setTeam} />
              <ImageDrop kind="photo" label={L.photoOpt} value={photo} onChange={setPhoto} />
            </>
          )}

          {field({ label: L.footer, k: "footer", max: 48 })}
          <div className="rounded-xl border border-lime/40 bg-lime/5 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="btn-primary" disabled={aiBusy} onClick={improveText}>
                {aiBusy ? "…" : `✨ ${locale === "es" ? "Mejorar mi texto con IA" : "Improve my text with AI"}`}
              </button>
              {undoText && !aiBusy && (
                <button
                  type="button"
                  className="btn-ghost px-3 py-2 text-xs"
                  onClick={() => {
                    setInp(undoText);
                    setUndoText(null);
                    setAiMsg("");
                  }}
                >
                  ↩ {locale === "es" ? "Deshacer" : "Undo"}
                </button>
              )}
            </div>
            <p className="mt-2 text-xs text-muted">
              {aiMsg ||
                (locale === "es"
                  ? "La IA escribe frases con más estilo (títulos, lemas, línea inferior). Gratis — tus nombres no cambian. Tócalo otra vez para otra idea."
                  : "The AI writes catchier lines (titles, taglines, bottom line). Free — your names stay the same. Tap again for another idea.")}
            </p>
            <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1 accent-[var(--color-lime)]"
                checked={inp.aiCopy === "on"}
                onChange={(e) => set("aiCopy", e.target.checked ? "on" : "off")}
              />
              <span>
                {locale === "es"
                  ? "Dejar que la IA agregue 1–2 palabras de impacto en el póster (ej. NUEVO FICHAJE, MVP)"
                  : "Let the AI add 1–2 hype words on the poster (e.g. NEW SIGNING, MVP)"}
              </span>
            </label>
          </div>
          <div className="space-y-3 rounded-xl border border-line bg-panel-2/50 p-3">
            <FontPicker label={locale === "es" ? "Letra del título" : "Title font"} value={inp.fontPrimary} onChange={(v) => set("fontPrimary", v)} sample={layout === "CHAMPIONS" ? "CHAMPS" : "TITLE"} es={locale === "es"} />
            <FontPicker label={locale === "es" ? "Letra de nombres" : "Names font"} value={inp.fontSecondary} onChange={(v) => set("fontSecondary", v)} sample="Name" es={locale === "es"} />
          </div>
          <div>
            <label className="label">{L.extra}</label>
            <textarea
              className="input min-h-24"
              maxLength={1500}
              placeholder={L.extraPh}
              value={inp.extraPrompt}
              onChange={(e) => set("extraPrompt", e.target.value)}
            />
          </div>
          {!detailsValid() && <p className="text-xs text-muted">{L.required}</p>}
          {nav({ canNext: !!detailsValid(), onNext: () => setStep(4) })}
        </div>
      )}

      {step === 4 && (
        <div className="card space-y-4 p-5">
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-panel-2 p-4 text-sm">
            <input
              type="checkbox"
              className="mt-1 accent-[var(--color-lime)]"
              checked={inp.aiLogo !== "off"}
              onChange={(e) => set("aiLogo", e.target.checked ? "on" : "off")}
            />
            <span>
              <span className="block font-bold">{locale === "es" ? "Logo 3D hecho por la IA" : "AI-made 3D logo"}</span>
              <span className="block text-xs text-muted">
                {locale === "es"
                  ? "Encendido (recomendado): la IA integra tu logo en el diseño como un emblema 3D — se ve espectacular, pero puede cambiar algún detalle pequeño. Apagado: tu logo real se coloca exacto, pixel por pixel, en una esquina."
                  : "On (recommended): the AI builds your logo into the design as a 3D emblem — looks amazing, but can change small details. Off: your real logo is placed exactly, pixel for pixel, in a corner."}
              </span>
            </span>
          </label>
          <div>
            <span className="label">{locale === "es" ? "Fondo" : "Background"}</span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {[{ id: "", icon: "🎲", en: "Surprise me", es: "Sorpréndeme" }, ...BG_SCENES].map((b) => (
                <button
                  key={b.id || "surprise"}
                  type="button"
                  onClick={() => set("bgScene", b.id)}
                  className={`rounded-lg border px-3 py-2.5 text-left text-sm ${inp.bgScene === b.id ? "border-lime bg-lime/5" : "border-line bg-panel-2"}`}
                >
                  {b.icon} {locale === "es" ? b.es : b.en}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-muted">
              {locale === "es"
                ? "La IA crea un escenario detallado y realista detrás de tu diseño."
                : "The AI builds a detailed, realistic scene behind your design."}
            </p>
          </div>
          <div>
            <label className="label">{L.lang}</label>
            <select className="input" value={inp.language} onChange={(e) => set("language", e.target.value)}>
              {LANGUAGES.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted">{L.langHint}</p>
          </div>
          {layout === "PLAYER" ? (
            <p className="rounded-lg border border-line bg-panel-2 px-3 py-2.5 text-xs text-muted">
              🎲 {locale === "es" ? "Colores únicos: cada tarjeta de jugador sale con una paleta nueva." : "Unique colors: every player card gets a fresh palette."}
            </p>
          ) : (
          <div>
            <span className="label">{locale === "es" ? "Colores" : "Colors"}</span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {([
                ["team", locale === "es" ? "🛡️ Del equipo" : "🛡️ Team colors", locale === "es" ? "Colores del logo del equipo" : "Taken from the team logo"],
                ["surprise", locale === "es" ? "🎲 Únicos" : "🎲 Unique", locale === "es" ? "Paleta nueva en cada póster" : "New palette every poster"],
                ["template", locale === "es" ? "🎨 Del estilo" : "🎨 Style's own", locale === "es" ? "Colores del estilo elegido" : "Colors of the chosen style"],
                ["custom", locale === "es" ? "✏️ Los míos" : "✏️ My colors", locale === "es" ? "Elige tus colores" : "Pick your own"],
              ] as const).map(([id, label, sub]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => set("colorMode", id)}
                  className={`rounded-lg border px-3 py-2.5 text-left ${(inp.colorMode || (team?.logoUrl || home?.logoUrl ? "team" : "surprise")) === id ? "border-lime bg-lime/5" : "border-line bg-panel-2"}`}
                >
                  <span className="block text-sm font-bold">{label}</span>
                  <span className="block text-[11px] text-muted">{sub}</span>
                </button>
              ))}
            </div>
            <div className="mt-3">
              <span className="text-xs text-muted">{locale === "es" ? "Paletas listas — toca una:" : "Ready palettes — tap one:"}</span>
              <div className="mt-1.5 grid grid-cols-4 gap-2 sm:grid-cols-8">
                {PALETTES.map(([name, c1, c2, dark]) => {
                  const on = inp.colorMode === "custom" && inp.color1 === c1 && inp.color2 === c2;
                  return (
                    <button
                      key={name}
                      type="button"
                      title={name}
                      onClick={() => setInp((x) => ({ ...x, colorMode: "custom", color1: c1, color2: c2 }))}
                      className={`h-11 overflow-hidden rounded-lg border-2 ${on ? "border-white" : "border-line"}`}
                      style={{ background: `linear-gradient(135deg, ${c1} 0 45%, ${c2} 45% 75%, ${dark} 75%)` }}
                    />
                  );
                })}
              </div>
            </div>
            {inp.colorMode === "custom" && (
              <div className="mt-4 space-y-3">
                {(["color1", "color2"] as const).map((k, n) => {
                  const current = inp[k] || (n === 0 ? "#1d5bff" : "#ffd35a");
                  return (
                    <div key={k}>
                      <div className="mb-1.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted">
                        <span className="inline-block h-4 w-4 rounded border border-line" style={{ background: current }} />
                        {n === 0 ? (locale === "es" ? "Color principal" : "Main color") : locale === "es" ? "Color secundario" : "Second color"}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {SWATCHES.map((c) => (
                          <button
                            key={c}
                            type="button"
                            aria-label={c}
                            onClick={() => set(k, c)}
                            className={`h-9 w-9 rounded-full border-2 ${current.toLowerCase() === c ? "border-white ring-2 ring-lime" : "border-line"}`}
                            style={{ background: c }}
                          />
                        ))}
                        <label className="relative grid h-9 w-9 cursor-pointer place-items-center overflow-hidden rounded-full border-2 border-dashed border-muted text-sm" title={locale === "es" ? "Otro color" : "Other color"}>
                          ＋
                          <input type="color" value={current} onChange={(e) => set(k, e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <p className="mt-1 text-xs text-muted">
              {locale === "es"
                ? "Cada póster también recibe su propio fondo, composición, luz y textura, así ninguno sale igual."
                : "Every poster also gets its own background concept, layout, lighting and texture, so no two look the same."}
            </p>
          </div>
          )}
          {nav({ canNext: true, onNext: () => setStep(5) })}
        </div>
      )}

      {step === 5 && (
        <div className="space-y-4">
          <div className="card overflow-hidden">
            {phase === "done" && result?.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={result.url} alt="" className="block h-auto w-full" />
            ) : phase === "busy" ? (
              <GenerationProgress photo={photo} expectedSeconds={expectedSeconds} done={barDone} stage={genStage} />
            ) : (
              <div className="relative grid aspect-[4/5] place-items-center overflow-hidden p-8">
                {photo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-20 blur-2xl" />
                )}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(62,224,255,0.14),transparent_65%)]" />
                <div className="relative w-full max-w-xs text-center">
                  <div className="mx-auto grid h-20 w-20 place-items-center rounded-2xl border border-lime/40 bg-lime/10 text-4xl shadow-[0_0_60px_-10px] shadow-lime/50">
                    {phase === "error" ? "⚠️" : art.icon}
                  </div>
                  <div className="font-display mt-5 text-3xl">
                    {phase === "error" ? (locale === "es" ? "No se pudo crear" : "Couldn't create it") : locale === "es" ? "Todo listo" : "Ready to create"}
                  </div>
                  <div className="mt-3 flex flex-wrap justify-center gap-1.5 text-[11px]">
                    <span className="chip text-muted">{artName}</span>
                    {tpl && <span className="chip text-muted">{locale === "es" ? tpl.nameEs : tpl.name}</span>}
                    <span className="chip border-lime/40 text-lime">
                      {effCost} {locale === "es" ? "créditos" : "credits"}
                    </span>
                    {layout === "TOTW" && cardTpl && <span className="chip text-muted">🃏 {locale === "es" ? cardTpl.nameEs : cardTpl.name}</span>}
                  </div>
                  {/* Size: the AI makes the poster directly in this shape (fills the whole frame). */}
                  {logoCreate ? (
                    <p className="mt-5 text-xs text-muted">⬛ {locale === "es" ? "El logo se hace cuadrado (1:1)." : "The logo is made square (1:1)."}</p>
                  ) : wideStyle ? (
                    <p className="mt-5 text-xs text-muted">▭ {locale === "es" ? "Este estilo es de tamaño banner (16:9)." : "This style is banner size (16:9)."}</p>
                  ) : (
                  <div className="mt-5 grid grid-cols-3 gap-2">
                    {([["post", "4:5", es5 ? "Post" : "Post", "aspect-[4/5] w-5"], ["story", "9:16", es5 ? "Historia" : "Story", "aspect-[9/16] w-4"], ["banner", "16:9", "Banner", "aspect-[16/9] w-8"]] as const).map(([k, r, l, box]) => (
                      <button key={k} type="button" data-sfx="select" onClick={() => setFormat(k)} className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-xs font-bold transition ${format === k ? "border-lime bg-lime/15 text-white" : "border-line bg-ink/40 text-muted"}`}>
                        <span className={`${box} rounded-sm border-2 ${format === k ? "border-lime" : "border-muted/60"}`} />
                        <span>{l}</span>
                        <span className="text-[10px] font-semibold opacity-70">{r}</span>
                      </button>
                    ))}
                  </div>
                  )}
                  {phase === "error" && <p className="mt-4 text-sm text-danger">{error}</p>}
                  <button type="button" className="btn-primary mt-5 w-full py-3.5 text-base" disabled={credits < effCost} onClick={generate}>
                    {phase === "error" ? "↻" : "✨"} {L.generate}
                  </button>
                  <p className="mt-2 text-[11px] text-muted">
                    {(() => {
                      const lo = Math.max(1, Math.round((expectedSeconds * 0.6) / 60));
                      const hi = Math.max(lo + 1, Math.round((expectedSeconds * 1.3) / 60));
                      return locale === "es" ? `Tarda ${lo}–${hi} minutos — la IA se toma su tiempo para la mejor calidad` : `Takes ${lo}–${hi} minutes — the AI takes its time for the best quality`;
                    })()}
                  </p>
                  {credits < effCost && (
                    <Link href="/pricing" className="btn-ghost mt-3 w-full">{L.getCredits}</Link>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="card p-5 text-sm">
            <h3 className="mb-3 font-bold">{L.finish}</h3>
            <dl className="space-y-2">
              <div className="flex justify-between"><dt className="text-muted">{L.artType}</dt><dd>{artName}</dd></div>
              {tpl && (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">{locale === "es" ? "Estilo" : "Style"}</dt>
                  <dd className="truncate text-right font-semibold">{locale === "es" ? tpl.nameEs : tpl.name}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted">{L.status}</dt>
                <dd>{phase === "done" ? L.completed : phase === "busy" ? L.generating : phase === "error" ? L.failed : "—"}</dd>
              </div>
              <div className="flex justify-between"><dt className="text-muted">{L.creditsUsed}</dt><dd>{effCost}</dd></div>
              <div className="flex justify-between rounded-lg bg-panel-2 px-3 py-2"><dt className="text-muted">{L.balance}</dt><dd className="font-bold text-lime">{credits} {locale === "es" ? "créditos" : "credits"}</dd></div>
            </dl>
            {phase === "done" && result && (
              <div className="mt-4 space-y-2">
                {result.url && <AiVideo bannerId={result.id} title={`kixo-${layout.toLowerCase()}`} image={result.url} />}
                {result.url && <DownloadSizes src={result.url} baseName={`kixo-${layout.toLowerCase()}`} />}
                {layout === "PLAYER" && (
                  <Link href={`/create?match=${result.id}`} className="btn-primary w-full">
                    👥 {locale === "es" ? "Siguiente jugador — mismo diseño" : "Next player — same design"}
                  </Link>
                )}
                <Link href={`/banner/${result.id}`} className="btn-ghost w-full">✏️ {L.edit}</Link>
                <button type="button" className="w-full py-2 text-xs text-muted hover:text-white" onClick={reset}>＋ {L.another}</button>
              </div>
            )}
          </div>
          {phase === "idle" && (
            <button type="button" className="text-sm text-muted hover:text-white" onClick={() => setStep(4)}>‹ {L.back}</button>
          )}
        </div>
      )}
    </div>
  );
}
