// Font choices. The game uses one font family; `display` is an optional heavier or wilder
// cut of the same family for titles, big numbers and the main button.
// Try any of them in the whole game with ?font=<id> (it is remembered on this device;
// ?font=default goes back), or compare them all side by side with ?fonts.
// To make one the permanent default, change DEFAULT_FONT below.

export interface FontChoice {
  id: string;
  name: string;
  /** Why it could suit the game. */
  note: string;
  /** CSS font-family for all text. */
  font: string;
  /** Weight used for headings and buttons. */
  heavy: number;
  /** Optional different family for big titles (same type family, louder style). */
  display?: string;
  displayWeight?: number;
  /** Google Fonts stylesheet; fonts without one are bundled with the game. */
  url?: string;
}

const GOOGLE = 'https://fonts.googleapis.com/css2?display=swap&family=';

export const FONTS: FontChoice[] = [
  {
    id: 'shantell',
    name: 'Shantell Sans',
    note: 'The current one. Handwriting, like marker on a poster.',
    font: "'Shantell Sans Variable', sans-serif",
    heavy: 780,
  },
  {
    id: 'baloo',
    name: 'Baloo 2',
    note: 'Chunky and rounded, the classic friendly mobile-game look.',
    font: "'Baloo 2', sans-serif",
    heavy: 800,
    url: GOOGLE + 'Baloo+2:wght@400..800',
  },
  {
    id: 'rubik',
    name: 'Rubik + Rubik Spray Paint',
    note: 'Clean and rounded for reading, spray-paint titles for the street feel.',
    font: "'Rubik', sans-serif",
    heavy: 700,
    display: "'Rubik Spray Paint', 'Rubik', sans-serif",
    displayWeight: 400,
    url: GOOGLE + 'Rubik:wght@400..800&family=Rubik+Spray+Paint',
  },
  {
    id: 'barlow',
    name: 'Barlow + Barlow Condensed',
    note: 'Tall, tight titles like an old boxing poster.',
    font: "'Barlow', sans-serif",
    heavy: 700,
    display: "'Barlow Condensed', 'Barlow', sans-serif",
    displayWeight: 800,
    url: GOOGLE + 'Barlow:wght@400;600;700&family=Barlow+Condensed:wght@700;800',
  },
  {
    id: 'bricolage',
    name: 'Bricolage Grotesque',
    note: 'Quirky, a bit hand-made, with a lot of character in the bold weights.',
    font: "'Bricolage Grotesque', sans-serif",
    heavy: 800,
    url: GOOGLE + 'Bricolage+Grotesque:opsz,wght@12..96,400..800',
  },
  {
    id: 'grandstander',
    name: 'Grandstander',
    note: 'Bouncy cartoon letters, playful and loud.',
    font: "'Grandstander', sans-serif",
    heavy: 800,
    url: GOOGLE + 'Grandstander:wght@400..900',
  },
  {
    id: 'pixelify',
    name: 'Pixelify Sans',
    note: 'Pixel letters that are still easy to read. Matches the sprites exactly.',
    font: "'Pixelify Sans', sans-serif",
    heavy: 700,
    url: GOOGLE + 'Pixelify+Sans:wght@400..700',
  },
];

export const DEFAULT_FONT = 'shantell';
const STORAGE_KEY = 'brute-font';

function fontById(id: string | null | undefined): FontChoice | undefined {
  return FONTS.find((f) => f.id === id);
}

/** Loads a font's stylesheet (once). */
export function loadFontStylesheet(choice: FontChoice): void {
  if (!choice.url || document.querySelector(`link[data-font="${choice.id}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = choice.url;
  link.dataset.font = choice.id;
  document.head.append(link);
}

/** The CSS variables that make an element (or the whole page) use a font. */
export function fontVars(choice: FontChoice): Record<string, string> {
  return {
    '--font': choice.font,
    '--heavy': String(choice.heavy),
    '--font-display': choice.display ?? choice.font,
    '--display-weight': String(choice.displayWeight ?? choice.heavy),
  };
}

/** Picks the font (from ?font=, or the one remembered on this device), applies it and returns it. */
export function applyFont(): FontChoice {
  const asked = new URLSearchParams(location.search).get('font');
  try {
    if (asked === 'default') localStorage.removeItem(STORAGE_KEY);
    else if (fontById(asked)) localStorage.setItem(STORAGE_KEY, asked!);
  } catch {
    // Storage blocked: the choice just isn't remembered.
  }
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(STORAGE_KEY);
  } catch {
    saved = null;
  }
  const choice = fontById(asked) ?? fontById(saved) ?? fontById(DEFAULT_FONT)!;
  loadFontStylesheet(choice);
  for (const [name, value] of Object.entries(fontVars(choice))) document.documentElement.style.setProperty(name, value);
  return choice;
}

/** Resolves when the font can be drawn (the arena draws text on a canvas), or after a short wait. */
export function fontReady(choice: FontChoice): Promise<unknown> {
  const first = (css: string) => css.split(',')[0]!.trim();
  const families = [first(choice.font), ...(choice.display ? [first(choice.display)] : [])];
  const link = document.querySelector<HTMLLinkElement>(`link[data-font="${choice.id}"]`);
  const sheet = link ? new Promise((resolve) => link.addEventListener('load', resolve, { once: true })) : Promise.resolve();
  const loaded = sheet.then(() => Promise.all(families.map((family) => document.fonts.load(`16px ${family}`))));
  return Promise.race([loaded, new Promise((resolve) => setTimeout(resolve, 2000))]);
}
