// Ready-made design instructions for some built-in styles. Loaded into a style only if its
// instructions box is empty (prisma/seed.ts), so admin edits are never overwritten.

export const PRESET_INSTRUCTIONS: Record<string, string> = {
  inferno: `PLAYER CARD — premium editorial sports poster, magazine-cover quality.

COLOURS — NO fixed colour: build the whole palette from the player's photo (kit colours) and the team logo. The main kit/logo colour becomes the background colour, its second colour the accents, plus cream/off-white and black. Only use red if the kit or logo is red.

BACKGROUND
- Rich grunge texture in the team's main colour: big diagonal paint-brush strokes, scratched paper, ink splatter and dust, with a faint stadium and crowd glowing in the team colour in the far background. Floating sparks and embers in the accent colour. Never a plain gradient.
- Giant faded brush-script letters or the team name painted diagonally behind everything (very low opacity).

THE PLAYER — shown THREE times, all the SAME person from the photo (same face, kit and colours):
1. Big hero portrait in the centre-top: head and chest, arms crossed, confident look, sharp rim light.
2. A second, slightly smaller side shot on the left, half faded into the background.
3. A full-body ACTION shot in front at the bottom centre, running with the ball, overlapping the big name lettering.
- If a team logo is given: render the crest large in the upper right as a glossy 3D emblem, and small (about 8% width) in the top-left corner with tiny text under it.

LETTERING
- The player's NAME huge across the bottom in a tall, elegant high-contrast condensed SERIF (like a fashion magazine masthead), warm cream/off-white with a subtle paper texture; the action shot overlaps part of the letters.
- The small word above the name in a refined small serif, cream.
- The accent line in flowing handwritten brush SCRIPT in the accent colour, written across the bottom of the name.
- The shirt NUMBER very large on the right in the same serif style, in a deep shade of the team colour with a thin cream outline.
- The position in small serif capitals inside a thin cream rectangle under the number.
- Spell every text exactly as given; don't add any other words.

FINISH
- Cinematic lighting, high detail fur/fabric/skin texture, film grain, strong contrast. Palette: the team/kit colours from the photo and logo, cream #efe6d8 and black.`,
  "matchday-floodlights": `MATCH DAY poster — night game under blazing stadium floodlights, premium pro-clubs social-media style.

LAYOUT
- Top: the title in huge, tall, condensed 3D chrome letters with a cold white-blue glow and sharp reflections; the competition logo or name small above it.
- Centre: the two team crests HUGE (each about 40% of the poster width), glossy 3D emblems facing each other, each blasted by its own floodlight beam with rim light and glow; a heavy metallic "VS" between them exploding with light flares and sparks.
- Background: each team's crest repeated GIANT and faded (about 10–15% opacity) on its own half, behind the stadium haze, like it's projected in light.
- Bottom: date, kick-off time and venue as DESIGNED LETTERING directly on the poster — bold condensed 3D metallic letters with a soft glow, separated by thin glowing vertical lines. NO boxes, NO panels, NO pills, NO icons.

BACKGROUND & EFFECTS
- A packed stadium at night: tall floodlight towers firing light beams through haze, big lens flares, crowd as bokeh, wet pitch reflecting the crests and lights.
- Light rays, drifting haze, sparks, fine film grain; deep shadows and high contrast.

COLOURS: each team's colours glowing on its own half, joined by cold white floodlight light.
FEEL: powerful, broadcast-quality — like an official club match-day graphic.`,

  "matchday-derby": `DERBY MATCH DAY poster — a fierce rivalry, premium pro-clubs social-media style.

LAYOUT
- The poster is split diagonally down the middle by a jagged, glowing crack full of sparks.
- Home side: engulfed in roaring fire and embers in the home team's colour; away side: crackling lightning and electric energy in the away team's colour.
- Each team crest HUGE (about 40% of the poster width) and glowing on its own side, facing the other, wrapped in its side's fire or lightning; a heavy 3D metallic "VS" sits right on the crack with sparks flying off it.
- Background: each team's crest repeated GIANT and faded (about 10–15% opacity) behind its own half, half-hidden in smoke.
- Top: the title in massive 3D metal letters lit by the fire on one edge and the lightning on the other.
- Bottom: date, kick-off time and venue as DESIGNED LETTERING directly on the poster — bold condensed 3D metal letters with a fiery/electric glow, separated by thin glowing slashes. NO boxes, NO panels, NO pills, NO icons.

BACKGROUND & EFFECTS
- Stadium at night behind both halves: smoke, coloured flares, waving flags and ultras silhouettes as bokeh.
- Embers, sparks, smoke trails, heat haze and fine grain; very high contrast.

COLOURS: home colour vs away colour, clashing at the crack.
FEEL: intense, explosive, big-game energy — the poster for the biggest match of the season.`,
};

/** Earlier versions — replaced automatically if the admin never edited them. */
export const PRESET_PREVIOUS: Record<string, string> = {
  inferno: `PLAYER CARD — premium editorial sports poster in deep crimson red, cream and black, magazine-cover quality.

BACKGROUND
- Rich crimson-red grunge texture: big diagonal paint-brush strokes, scratched paper, ink splatter and dust, with a faint stadium and crowd glowing red in the far background. Floating red embers and sparks. Never a plain gradient.
- Giant faded brush-script letters or the team name painted diagonally behind everything (very low opacity).

THE PLAYER — shown THREE times, all the SAME person from the photo (same face, kit and colours):
1. Big hero portrait in the centre-top: head and chest, arms crossed, confident look, sharp rim light.
2. A second, slightly smaller side shot on the left, half faded into the red background.
3. A full-body ACTION shot in front at the bottom centre, running with the ball, overlapping the big name lettering.
- If a team logo is given: render the crest large in the upper right as a glossy 3D emblem, and small (about 8% width) in the top-left corner with tiny text under it.

LETTERING
- The player's NAME huge across the bottom in a tall, elegant high-contrast condensed SERIF (like a fashion magazine masthead), warm cream/off-white with a subtle paper texture; the action shot overlaps part of the letters.
- The small word above the name in a refined small serif, cream.
- The accent line in flowing red handwritten brush SCRIPT, written across the bottom of the name.
- The shirt NUMBER very large on the right in the same serif style, deep red with a thin cream outline.
- The position in small serif capitals inside a thin cream rectangle under the number.
- Spell every text exactly as given; don't add any other words.

FINISH
- Cinematic lighting, high detail fur/fabric/skin texture, film grain, strong contrast. Palette: crimson #b5121b, blood red, cream #efe6d8, black.`,
  "matchday-floodlights": `MATCH DAY poster — night game under blazing stadium floodlights, premium pro-clubs social-media style.

LAYOUT
- Top: the title in huge, tall, condensed 3D chrome letters with a cold white-blue glow and sharp reflections; the competition name small and letter-spaced above it.
- Centre: the two team crests big, glossy and facing each other, each lit by its own floodlight beam, with a bold metallic "VS" between them bursting with light flares.
- Bottom: date, kick-off time and venue on a sleek glass/chrome info bar with thin glowing dividers.

BACKGROUND & EFFECTS
- A packed stadium at night: tall floodlight towers firing light beams through haze, big lens flares, crowd as bokeh, wet pitch reflecting the lights.
- Light rays, drifting haze, small sparks, fine film grain; deep shadows and high contrast.

COLOURS: the two teams' colours on their sides, joined by cold white floodlight glow.
FEEL: clean, powerful, broadcast-quality — like an official club match-day graphic.`,

  "matchday-derby": `DERBY MATCH DAY poster — a fierce rivalry, premium pro-clubs social-media style.

LAYOUT
- The poster is split diagonally down the middle by a jagged, glowing crack full of sparks.
- Home side: engulfed in roaring fire and embers in the home team's colour; away side: crackling lightning and electric energy in the away team's colour.
- Each team crest big and glowing on its own side, facing the other; a heavy 3D metallic "VS" sits right on the crack with sparks flying off it.
- Top: the title in massive 3D metal letters lit by the fire on one edge and the lightning on the other.
- Bottom: date, kick-off time and venue on a dark metal plate with a thin glowing edge.

BACKGROUND & EFFECTS
- Stadium at night behind both halves: smoke, coloured flares, waving flags and ultras silhouettes as bokeh.
- Embers, sparks, smoke trails, heat haze and fine grain; very high contrast.

COLOURS: home colour vs away colour, clashing at the crack.
FEEL: intense, explosive, big-game energy — the poster for the biggest match of the season.`,
};
