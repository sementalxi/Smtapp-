/**
 * Per-style TEXT SLOTS for player-card styles copied from the owner's flyers.
 * Each flyer has its own text lines (a kicker at the top, a script word, an offers block, a
 * bottom address line…). The creator shows one box per line so people fill exactly the lines
 * that flyer has, and the AI is told where each line sits and how it is lettered.
 * Keyed by the style's slug. Player name, number, position and crest are separate inputs.
 */
export type TextSlot = {
  key: string;
  /** Box label (English) */
  label: string;
  /** Box label (Spanish) */
  labelEs: string;
  /** Example text shown in the empty box */
  ph?: string;
  /** Max characters */
  max?: number;
  /** For the AI: where the flyer has this line and how it is lettered */
  where: string;
};

const s = (key: string, label: string, labelEs: string, where: string, ph?: string, max = 60): TextSlot => ({ key, label, labelEs, where, ph, max });

export const TEXT_SLOTS: Record<string, TextSlot[]> = {
  "player-brush-wall": [
    s("dateSide", "Date (left edge, vertical)", "Fecha (borde izquierdo, vertical)", "running vertically up the LEFT edge in letter-spaced white caps, like the flyer's date", "FRIDAY AUGUST 22", 30),
    s("kicker", "Small word beside the name", "Palabra pequeña junto al nombre", "small letter-spaced white caps to the right under the name (the flyer's 'CONCERT' line)", "CONCERT", 24),
    s("script", "Neon script line", "Línea en script neón", "a glowing neon handwritten SCRIPT in two short lines at the right, under the kicker (the flyer's 'AFTER PARTY')", "AFTER PARTY", 30),
    s("promo", "Promo lines (white, slanted)", "Líneas promo (blancas, inclinadas)", "bold slanted white condensed caps in two or three lines at the lower middle-left, with a soft glow", "EVERYONE WITH A TICKET GETS IN FREE!!!", 80),
    s("offers", "Price lines (bottom left)", "Precios (abajo izquierda)", "two short stacked lines at the bottom-left in bold outlined caps (the flyer's '$1 SHOTS / $100 BOTTLES')", "$1 SHOTS · $100 BOTTLES", 50),
    s("ladies", "Cyan caps line", "Línea en mayúsculas cian", "one line of cyan letter-spaced caps under the price lines", "LADIES FREE ALL NIGHT", 40),
    s("djs", "DJ / names line", "Línea de DJs / nombres", "a small white caps line of names separated by × under the cyan line", "DJ ELOY × DJ PAPAS FRITAS", 60),
    s("footer", "Bottom address line", "Línea de dirección abajo", "tiny white letter-spaced caps along the very bottom", "9930 NORTH FREEWAY · RESERVATIONS 832.643.1070", 90),
  ],
  "player-carnival": [
    s("kicker", "Word above the name (pink italic)", "Palabra sobre el nombre (rosa cursiva)", "bold pink italic caps in a slanted banner right above the giant name (the flyer's 'INDEPENDENCIA')", "INDEPENDENCIA", 24),
    s("dateSide", "Date (right side, stacked)", "Fecha (lado derecho, apilada)", "stacked at the right edge beside the name: the day and month small, the number big in white 3D digits (the flyer's 'SAT FEB 22')", "SAT FEB 22", 20),
    s("promo", "Offer lines (big white, bottom)", "Líneas de oferta (grandes, abajo)", "two big lines of white condensed caps at the bottom with a red price, like the flyer's '$99.00 BOTELLAS / REGULAR ANTES DE LAS 11'", "$99 BOTTLES · REGULAR BEFORE 11", 70),
    s("bar", "Red bar line", "Línea en barra roja", "white caps inside a solid red bar under the offers (the flyer's brand list)", "CIROC · BUCHANAN 12 · BLACK LABEL", 50),
    s("footer", "Bottom address line", "Línea de dirección abajo", "tiny white caps on the blue bottom strip", "9404 WEST SAM HOUSTON PARKWAY SOUTH · HOUSTON, TX", 90),
  ],
  "player-chrome-lasers": [
    s("dateBlock", "Date block (top left)", "Bloque de fecha (arriba izquierda)", "top-left stacked block: the day and month in white caps with the day NUMBER huge in cyan 3D digits (the flyer's 'FRIDAY NOVEMBER 17')", "FRIDAY NOVEMBER 17", 24),
    s("tag", "Small tag beside the name", "Etiqueta pequeña junto al nombre", "a small white caps tag in a thin box at the right under the name (the flyer's 'EN VIVO')", "EN VIVO", 16),
    s("offers", "Offer lines (big white, bottom)", "Líneas de oferta (grandes, abajo)", "two big lines of white condensed caps at the bottom with the prices in yellow (the flyer's '$150 BUCHANAS & CIROC / 2 FOR $300 CASAMIGOS')", "$150 BUCHANANS & CIROC · 2 FOR $300 CASAMIGOS", 80),
    s("highlight", "Cyan caps line", "Línea en mayúsculas cian", "one line of cyan letter-spaced caps under the offers (the flyer's 'BEFORE 11')", "BEFORE 11", 30),
    s("footer", "Bottom address line", "Línea de dirección abajo", "tiny white caps on the dark bottom strip", "9930 NORTH FREEWAY · RESERVATIONS 832.643.1070", 90),
  ],
  "player-copa-final": [
    s("topLines", "Top lines (two short lines)", "Líneas superiores (dos cortas)", "two short centred lines of white letter-spaced caps at the very top (the flyer's 'SUNDAY SUNDAY / COPA DE ORO')", "SUNDAY SUNDAY · COPA DE ORO", 50),
    s("script", "Gold script word", "Palabra en script dorado", "a big gold handwritten SCRIPT crossing the middle, in front of the trophy's top (the flyer's 'Final')", "Final", 20),
    s("time", "Time (beside the script)", "Hora (junto al script)", "bold white caps to the right of the script word (the flyer's '6PM')", "6PM", 12),
    s("sideBlock", "Side block (stacked lines)", "Bloque lateral (líneas apiladas)", "a stacked block of gold and white condensed caps at the right middle (the flyer's 'BANDA EN VIVO / IN HALFTIME / EN VIVO WATCH PARTY')", "BANDA EN VIVO · IN HALFTIME · WATCH PARTY", 70),
    s("highlight", "Big green line (bottom)", "Línea verde grande (abajo)", "big neon-green 3D caps centred near the bottom (the flyer's '3 CLUBS 1 ENTRANCE')", "3 CLUBS 1 ENTRANCE", 30),
    s("promo", "White caps line under it", "Línea blanca debajo", "one line of white condensed caps under the green line", "THE BIGGEST SCREEN IN HOUSTON ON THE ROOFTOP", 60),
    s("djs", "Names line (tiny)", "Línea de nombres (pequeña)", "a tiny white caps line of names separated by dots", "OMIX · HAZE · WILLYB · NOEL", 90),
    s("footer", "Bottom lines (address / info)", "Líneas de abajo (dirección / info)", "tiny white caps lines at the very bottom", "702 W DALLAS ST · HOUSTON TX · RSVP 832.970.5111", 110),
  ],
  "player-desert-chrome": [
    s("presenter", "Tiny line at the top", "Línea pequeña arriba", "tiny letter-spaced white caps centred at the very top (the flyer's 'MAMAJUANA LOUNGE PRESENTA')", "KIXO PRESENTS", 40),
    s("dateBlock", "Date block (top left)", "Bloque de fecha (arriba izquierda)", "top-left stacked: the weekday and month small in white caps, the day NUMBER huge in white 3D digits (the flyer's 'VIE NOV 31')", "FRI NOV 31", 20),
    s("highlight", "Bold lines (bottom left)", "Líneas en negrita (abajo izquierda)", "two or three lines of bold white letter-spaced caps at the bottom-left, over the glow (the flyer's 'THE GOAT OF BACHATA / LIVE')", "THE GOAT OF THE LEAGUE · LIVE", 60),
    s("footer", "Bottom address line", "Línea de dirección abajo", "tiny white caps along the very bottom", "39 NORTH 9TH STREET · RSVP 610.823.9057", 100),
  ],
  "player-duotone-trio": [
    s("sub1", "Line under the name", "Línea bajo el nombre", "small white letter-spaced caps centred right under the name, between two thin lines (the flyer's 'HOUSTON')", "HOUSTON", 24),
    s("sub2", "Tiny line under it", "Línea diminuta debajo", "tiny white letter-spaced caps under that line (the flyer's 'BAR & CLUB')", "BAR & CLUB", 24),
    s("bottom", "Bottom line (letter-spaced)", "Línea de abajo (espaciada)", "wide letter-spaced white caps centred near the bottom (the flyer's 'COMING SOON')", "COMING SOON", 30),
  ],
  "player-face-off": [
    s("kicker", "Tiny line at the top", "Línea pequeña arriba", "two tiny lines of letter-spaced caps centred at the top (the flyer's 'THE #1 PARTY ON WASHINGTON AVENUE')", "THE #1 PARTY ON WASHINGTON AVENUE", 50),
    s("sideTag", "Side tag (right edge)", "Etiqueta lateral (borde derecho)", "small letter-spaced caps in two lines at the right edge of the middle (the flyer's 'SOLD OUT SATURDAYS')", "SOLD OUT SATURDAYS", 24),
    s("highlight", "Gold stacked lines", "Líneas doradas apiladas", "bold gold condensed caps stacked in two lines at the lower middle (the flyer's 'DU PLESSIS VS CHIMAEV')", "FINAL VS RIVALS", 40),
    s("sub", "Cyan line under them", "Línea cian debajo", "one line of cyan letter-spaced caps under the gold lines (the flyer's 'LIVE ON OUR SCREEN')", "LIVE ON OUR SCREEN", 30),
    s("djs", "Names list (bottom left)", "Lista de nombres (abajo izquierda)", "three stacked white caps names at the bottom-left", "DJ ELOY · DJ CHICO · DJ KILO", 60),
    s("venue", "Venue name (serif, bottom band)", "Nombre del lugar (serif, banda inferior)", "an elegant black serif name centred on the white bottom band with a tiny 'BAR & LOUNGE'-style line under it", "CANA", 24),
    s("footer", "Bottom address line", "Línea de dirección abajo", "tiny black caps along the bottom of the white band", "5310 WASHINGTON AVENUE · RESERVATIONS 832.643.1070", 90),
  ],
  "player-gold-throne": [
    s("topLine", "Top line (letter-spaced)", "Línea superior (espaciada)", "letter-spaced white caps centred at the very top (the flyer's 'SATURDAY OCTOBER 25')", "SATURDAY OCTOBER 25", 30),
    s("script", "Script line under the name", "Línea script bajo el nombre", "a light-blue handwritten SCRIPT to the right under the gold name (the flyer's 'Birth Celebration')", "Birthday Celebration", 30),
    s("bottomLeft", "Bottom-left caps line", "Línea abajo izquierda", "small white letter-spaced caps at the bottom-left (the flyer's 'FREE ENTRY ALL NIGHT')", "FREE ENTRY ALL NIGHT", 30),
    s("bottomRight", "Bottom-right caps line", "Línea abajo derecha", "small white letter-spaced caps at the bottom-right (the flyer's 'DOORS OPEN AT 9PM')", "DOORS OPEN AT 9PM", 30),
    s("footer", "Address line (very bottom)", "Dirección (muy abajo)", "wide letter-spaced white caps centred at the very bottom with a tiny area name above it (the flyer's 'MIDTOWN / 3017 MILAM ST')", "MIDTOWN · 3017 MILAM ST", 50),
  ],
  "player-green-gothic-chrome": [
    s("dateBadge", "Date badge (top right)", "Fecha en insignia (arriba derecha)", "a small stacked date in a thin outlined badge at the top-right: month small, day number big (the flyer's 'DEC 15th')", "DEC 15", 12),
    s("venue", "Venue (letter-spaced)", "Lugar (espaciado)", "wide letter-spaced white caps centred under the figure (the flyer's 'MANSION')", "MANSION", 24),
    s("tickets", "Green caps line", "Línea verde", "one line of bright green bold caps (the flyer's 'TICKETS: VIPMUSICENT.COM')", "TICKETS: KIXO.PRO", 40),
    s("footer", "Address line", "Línea de dirección", "small white caps centred under the green line", "3801 W. LAKE ST. STONE PARK IL", 60),
    s("hours", "Tiny bottom line", "Línea diminuta abajo", "tiny letter-spaced caps at the very bottom (the flyer's '10PM · 4AM · 18+')", "10PM · 4AM · 18+", 30),
  ],
  "player-inferno-neon": [
    s("kicker", "Tiny line at the top", "Línea pequeña arriba", "tiny letter-spaced white caps centred at the very top (the flyer's 'THE NEWEST OUTDOOR PARTY IN MIDTOWN')", "THE NEWEST OUTDOOR PARTY IN MIDTOWN", 50),
    s("dateBlock", "Date block (right edge)", "Bloque de fecha (borde derecho)", "stacked at the right edge: weekday and month small in white caps, the day NUMBER big in red 3D digits (the flyer's 'THU OCT 9')", "THU OCT 9", 16),
    s("offers", "Offer lines (big white)", "Líneas de oferta (grandes)", "two big lines of white condensed caps at the lower middle (the flyer's '$1 DON JULIO 70 SHOTS / $1 BEERS BEFORE 11:30')", "$1 SHOTS · $1 BEERS BEFORE 11:30", 80),
    s("djs", "DJ / names line", "Línea de DJs / nombres", "a white caps line of names separated by dots under the offers", "DJ ELOY · DJ MOVEMENT · DJ CHICO", 70),
    s("info", "Small red caps line", "Línea roja pequeña", "a small line of red letter-spaced caps (the flyer's 'DOORS OPEN AT 8PM · FREE ENTRANCE ALL NIGHT')", "DOORS OPEN 8PM · FREE ENTRANCE ALL NIGHT", 60),
    s("footer", "Bottom address line", "Línea de dirección abajo", "tiny white caps along the very bottom", "MILAM ST · RESERVATIONS 832.643.1070", 90),
  ],
  "player-neon-club": [
    s("kicker", "Top line", "Línea superior", "small white caps centred at the very top with one word in pink (the flyer's 'THE BIGGEST AFTER PARTY IN HOUSTON!')", "THE BIGGEST AFTER PARTY IN HOUSTON!", 50),
    s("script", "Script line under the name", "Línea script bajo el nombre", "a white neon handwritten SCRIPT under the giant name (the flyer's 'LATE NIGHT HABIT')", "LATE NIGHT HABIT", 30),
    s("highlight", "Big caps (bottom left)", "Mayúsculas grandes (abajo izquierda)", "two big lines of white condensed caps at the bottom-left (the flyer's 'HOOKAH & VIPS AVAILABLE')", "HOOKAH & VIPS AVAILABLE", 40),
    s("info", "White caps line", "Línea blanca", "one line of smaller white caps under it (the flyer's 'FREE COVER | FREE PARKING ALL NIGHT')", "FREE COVER | FREE PARKING ALL NIGHT", 50),
    s("footer", "Address (letter-spaced)", "Dirección (espaciada)", "wide letter-spaced pink-white caps at the bottom-left (the flyer's '14 BERRY RD')", "14 BERRY RD", 40),
    s("hours", "Times (bottom right)", "Horas (abajo derecha)", "two stacked small white caps times at the bottom-right (the flyer's '2AM / 6AM')", "2AM · 6AM", 16),
  ],
  "player-neon-echo": [
    s("kicker", "Top line (letter-spaced)", "Línea superior (espaciada)", "letter-spaced white caps centred at the very top (the flyer's 'HOY! TONIGHT!')", "HOY! TONIGHT!", 30),
    s("script", "Pink script word", "Palabra en script rosa", "a pink handwritten SCRIPT to the right under the name (the flyer's 'Primera Musa')", "Primera Musa", 24),
    s("sideTitle", "Side title (right)", "Título lateral (derecha)", "a bold slanted block at the right middle: pink caps plus a white brush script word (the flyer's 'OFFICIAL After Party')", "OFFICIAL After Party", 30),
    s("highlight", "Bold white line", "Línea blanca en negrita", "bold white condensed caps centred at the lower middle (the flyer's 'VIEJO CULPRIT')", "SPECIAL GUEST", 30),
    s("sub", "Small line under it", "Línea pequeña debajo", "small white caps in a thin pink box under the bold line (the flyer's 'OMAR COURTZ OFFICIAL DJ')", "OFFICIAL DJ", 40),
    s("info", "Doors line", "Línea de puertas", "small white letter-spaced caps (the flyer's 'DOORS OPEN 9PM')", "DOORS OPEN 9PM", 24),
    s("venue", "Venue name (serif)", "Nombre del lugar (serif)", "an elegant white serif venue name centred near the bottom with a tiny 'BAR & LOUNGE'-style line under it", "CANA", 24),
    s("footer", "Bottom address line", "Línea de dirección abajo", "tiny white caps along the very bottom", "5310 WASHINGTON AVENUE · RESERVATIONS 832.643.1070", 90),
  ],
  "player-neon-flowers": [
    s("kicker", "Top line", "Línea superior", "small white caps centred at the very top on a dark strip (the flyer's 'THE #1 PARTY ON WASHINGTON AVENUE')", "THE #1 PARTY ON WASHINGTON AVENUE", 50),
    s("bgWord", "Giant background word", "Palabra gigante de fondo", "one word GIANT in outlined blue-white caps across the whole width behind the figure, half hidden by it (the flyer's 'NAVIDAD')", "NAVIDAD", 14),
    s("djs", "Names list (bottom left)", "Lista de nombres (abajo izquierda)", "three stacked white caps names at the bottom-left with a tiny 'MUSIC BY'-style label above", "DJ ELOY · DJ MOVEMENT · DJ CHICO", 60),
    s("venue", "Venue name (serif)", "Nombre del lugar (serif)", "an elegant white serif venue name at the bottom centre-right with a tiny line under it", "CANA", 24),
    s("sideTag", "Side tag (bottom right)", "Etiqueta (abajo derecha)", "two small lines of pink letter-spaced caps at the bottom-right (the flyer's 'SOLD OUT SATURDAYS')", "SOLD OUT SATURDAYS", 24),
    s("footer", "Bottom address line", "Línea de dirección abajo", "tiny white caps along the very bottom", "5310 WASHINGTON AVENUE · RESERVATIONS 832.643.1070", 90),
  ],
  "player-neon-garden": [
    s("kicker", "Top line (left)", "Línea superior (izquierda)", "two small lines of white caps at the top-left (the flyer's 'THE #1 PARTY ON WASHINGTON AVENUE')", "THE #1 PARTY ON WASHINGTON AVENUE", 50),
    s("bgWord", "Giant background word", "Palabra gigante de fondo", "one word GIANT in outlined blue caps across the lower half behind the figure (the flyer's 'VIDA')", "VIDA", 14),
    s("djs", "Names list (bottom left)", "Lista de nombres (abajo izquierda)", "two stacked white caps names at the bottom-left with a tiny 'MUSIC BY'-style label above", "DJ ELOY · DJ KILO", 60),
    s("venue", "Venue name (serif)", "Nombre del lugar (serif)", "an elegant white serif venue name at the bottom centre with a tiny line under it", "CANA", 24),
    s("sideTag", "Side tag (bottom right)", "Etiqueta (abajo derecha)", "two small lines of green letter-spaced caps at the bottom-right (the flyer's 'SOLD OUT SATURDAYS')", "SOLD OUT SATURDAYS", 24),
    s("footer", "Bottom address line", "Línea de dirección abajo", "tiny white caps along the very bottom", "5310 WASHINGTON AVENUE · RESERVATIONS 832.643.1070", 90),
  ],
  "player-neon-palms": [
    s("stacked", "Repeated word above the name", "Palabra repetida sobre el nombre", "ONE word written four times in stacked letter-spaced caps lines that fade from dark to bright orange, right above the name (the flyer's 'TONIGHT! TONIGHT! TONIGHT! TONIGHT!')", "TONIGHT!", 16),
    s("venue", "Venue name (serif)", "Nombre del lugar (serif)", "an elegant white serif venue name centred under the name with a tiny line under it", "CANA", 24),
    s("footer", "Bottom address line", "Línea de dirección abajo", "tiny white caps along the very bottom", "5310 WASHINGTON AVENUE · RESERVATIONS 832.643.1070", 90),
  ],
  "player-orange-stripes": [
    s("highlight", "Big gold word under the name", "Palabra dorada grande bajo el nombre", "one big word in chunky gold 3D caps under the name (the flyer's 'CHAMPIONS')", "CHAMPIONS", 16),
    s("sub", "Small caps under it", "Mayúsculas pequeñas debajo", "small black letter-spaced caps in two lines under the gold word (the flyer's 'CELEBRATION PARTY')", "CELEBRATION PARTY", 30),
    s("offers", "Offer lines (slanted)", "Líneas de oferta (inclinadas)", "two slanted lines of bold white caps with prices in the middle-left (the flyer's 'BUCHANAN'S 150$ / CASAMIGOS 150$ REPO')", "BUCHANANS $150 · CASAMIGOS $150", 60),
    s("djs", "Names list (bottom left)", "Lista de nombres (abajo izquierda)", "three stacked bold white caps names at the bottom-left with a tiny 'MAIN FLOOR'-style label above", "NEGO · JAY FLOW · WILLY B", 60),
    s("footer", "Bottom address line", "Línea de dirección abajo", "tiny white caps on the black bottom strip (the flyer's '112 TRAVIS HO… RSVP')", "112 TRAVIS HOUSTON TX · RSVP 832.970.5111", 90),
  ],
  "player-purple-gold-chrome": [
    s("sideText", "Vertical text (left edge)", "Texto vertical (borde izquierdo)", "bold white caps running vertically up the LEFT edge (the flyer's 'YOUR NEXT ADDICTION')", "YOUR NEXT ADDICTION", 24),
    s("highlight", "Bold stacked lines (left)", "Líneas apiladas en negrita (izquierda)", "three stacked lines of bold white condensed caps at the left middle (the flyer's 'THE REAL INDUSTRY NIGHT')", "THE REAL INDUSTRY NIGHT", 40),
    s("sub", "Gold line under them", "Línea dorada debajo", "a gold caps line under the stacked lines (the flyer's 'CONEJO MALO GOT YOU')", "KIXO GOT YOU", 30),
    s("offer", "Big offer (stacked letters)", "Oferta grande (letras apiladas)", "a big stacked block of white heavy caps with the price in a bigger size (the flyer's 'DON JULIO 70 $10')", "SHOTS $10", 30),
    s("offerSub", "Tiny line under the offer", "Línea diminuta bajo la oferta", "tiny letter-spaced caps under the offer (the flyer's 'TILL 11PM')", "TILL 11PM", 20),
    s("djs", "Names (right)", "Nombres (derecha)", "two small stacked white caps names at the right (the flyer's 'STEEZY · JACOB ANDREW')", "STEEZY · JACOB ANDREW", 40),
    s("info", "Doors line", "Línea de puertas", "a small line of white letter-spaced caps at the bottom (the flyer's 'DOORS OPEN 5PM-2AM · NO COVER')", "DOORS OPEN 5PM-2AM · NO COVER", 40),
    s("footer", "Bottom address line", "Línea de dirección abajo", "tiny white caps along the very bottom", "112 TRAVIS HOUSTON, TX 77002 · RSVP 832.970.5111", 90),
  ],
  "player-red-echo-frames": [
    s("presenter", "Top line (letter-spaced)", "Línea superior (espaciada)", "letter-spaced white caps centred at the top (the flyer's 'BUENAVIDA HOUSTON PRESENTA')", "KIXO PRESENTS", 40),
    s("bgWord", "Giant echoed word (behind)", "Palabra gigante con eco (detrás)", "ONE or two words GIANT in red caps repeated as fading echoes behind the figure, half hidden by it (the flyer's 'EN VIVO')", "EN VIVO", 14),
    s("dateBadge", "Date badge (top right)", "Fecha en insignia (arriba derecha)", "a small round outlined badge at the top-right with the weekday tiny, the month small and the day number big (the flyer's 'SAT FEB 24')", "SAT FEB 24", 12),
    s("script", "Script word under the name", "Palabra script bajo el nombre", "a white handwritten SCRIPT with a flourish under the name (the flyer's 'Live!')", "Live!", 20),
    s("footer", "Bottom lines (address / reservations)", "Líneas de abajo (dirección / reservas)", "two small white caps lines centred at the bottom: a bold one and a letter-spaced one under it", "4483 NORTH FREEWAY · RESERVATIONS 832.643.1070", 90),
  ],
  "player-split-duotone": [
    s("topTitle", "Top title (two lines)", "Título superior (dos líneas)", "bold white condensed caps in two lines at the top with a white brush-script word after them (the flyer's 'SPENCE VS CRAWFORD / LIVE')", "FIGHT NIGHT LIVE", 40),
    s("script", "Script word under the name", "Palabra script bajo el nombre", "a white brush SCRIPT under the stacked name (the flyer's 'Saturdays')", "Saturdays", 20),
    s("rooms", "Tiny names / rooms line", "Línea de nombres / salas", "a tiny white caps line of names with coloured room words (the flyer's DJ / room line)", "DJ KD · MAIN ROOM · DJ HAZE · PATIO", 90),
    s("offers", "Offer line (white caps)", "Línea de oferta", "one or two lines of bold white caps with prices (the flyer's 'CLASE AND 1942 $400 · $100 BOTTLES TILL 10:30PM')", "$100 BOTTLES TILL 10:30PM", 70),
    s("djs", "Resident names", "Nombres residentes", "a tiny 'RESIDENT DJS'-style label and a line of names under the offers", "ERIK · WILLY B · OMIX · KD", 70),
    s("info", "Doors line", "Línea de puertas", "a small white letter-spaced caps line (the flyer's 'DOORS OPEN 5PM · 3 LEVELS')", "DOORS OPEN 5PM · 3 LEVELS", 40),
    s("footer", "Bottom address line", "Línea de dirección abajo", "tiny white caps lines at the very bottom", "112 TRAVIS HOUSTON TX · RSVP 832.970.5111", 90),
  ],
  "player-white-gold": [
    s("presenter", "Tiny line at the top", "Línea pequeña arriba", "tiny black letter-spaced caps centred at the very top (the flyer's 'presents' line)", "KIXO PRESENTS", 40),
    s("kicker", "Bold black lines above the name", "Líneas negras sobre el nombre", "bold black stacked caps above the gold name (the flyer's '26TH BIRTHDAY')", "26TH BIRTHDAY", 24),
    s("script", "Script word beside the name", "Palabra script junto al nombre", "a black handwritten SCRIPT to the right under the name (the flyer's 'Zona Rosa')", "Zona Rosa", 24),
    s("footer", "Bottom lines (address / rsvp)", "Líneas de abajo (dirección / rsvp)", "small black caps lines centred at the bottom", "112 TRAVIS HOUSTON, TX 77002 · RSVP 832.970.5111", 90),
  ],
};

export function textSlotsFor(slug: string | null | undefined): TextSlot[] {
  return (slug && TEXT_SLOTS[slug]) || [];
}
