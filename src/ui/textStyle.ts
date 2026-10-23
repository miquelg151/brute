// How titles look: colour, outline and effect for screen titles, section headings, the
// big "VS" and the main button text. The effects themselves are CSS (search style.css
// for `data-text`); this file only picks which one is used.
// Try any of them in the whole game with ?text=<id> (it is remembered on this device;
// ?text=default goes back), or compare them all side by side with ?styles.
// To make one the permanent default, change DEFAULT_TEXT_STYLE below.

export interface TextStyle {
  id: string;
  name: string;
  /** What it looks like. */
  note: string;
}

export const TEXT_STYLES: TextStyle[] = [
  { id: 'plain', name: 'Plain', note: 'No effect: what the game had before.' },
  { id: 'sticker', name: 'Sticker', note: 'Light letters with a thick dark outline and a pink shadow, like a die-cut sticker.' },
  { id: 'arcade', name: 'Arcade', note: 'Bright letters pushed out in 3D, like an old arcade title.' },
  { id: 'spray', name: 'Spray', note: 'Colour gradient from yellow to pink, like fresh spray paint.' },
  { id: 'neon', name: 'Neon', note: 'Glowing pink and cyan signs, like a shop at night.' },
];

export const DEFAULT_TEXT_STYLE = 'plain';
const STORAGE_KEY = 'brute-text-style';

const byId = (id: string | null | undefined) => TEXT_STYLES.find((s) => s.id === id);

/** Picks the title style (from ?text=, or the one remembered on this device) and applies it. */
export function applyTextStyle(): void {
  const asked = new URLSearchParams(location.search).get('text');
  let saved: string | null = null;
  try {
    if (asked === 'default') localStorage.removeItem(STORAGE_KEY);
    else if (byId(asked)) localStorage.setItem(STORAGE_KEY, asked!);
    saved = localStorage.getItem(STORAGE_KEY);
  } catch {
    // Storage blocked: the choice just isn't remembered.
  }
  document.documentElement.dataset.text = (byId(asked) ?? byId(saved) ?? byId(DEFAULT_TEXT_STYLE)!).id;
}
