import { describe, expect, it } from 'vitest';
import { CARD_IDS, GEAR, SKILLS } from '../core';
import { CARD_ICONS } from './cardView';
import { ICON_NAMES } from './icons';
import { CARD_ART } from './iconsCards';
import { GEAR_ICONS } from './iconsGear';
import { SKILL_ICONS } from './iconsSkills';

describe('icons', () => {
  it('every skill, spell and boss trick has its own icon', () => {
    for (const id of Object.keys(SKILLS)) expect(SKILL_ICONS, id).toHaveProperty(`skill_${id}`);
  });

  it('every gear piece has its own icon', () => {
    for (const id of Object.keys(GEAR)) expect(GEAR_ICONS, id).toHaveProperty(`gear_${id}`);
  });

  it('every card has an icon no other card uses', () => {
    for (const id of CARD_IDS) expect(ICON_NAMES, id).toContain(CARD_ICONS[id]);
    const used = CARD_IDS.map((id) => CARD_ICONS[id]);
    expect(new Set(used).size).toBe(used.length);
  });

  it('every drawn icon is a 7 × 7 grid with a colour for each letter', () => {
    for (const [name, def] of Object.entries({ ...SKILL_ICONS, ...GEAR_ICONS, ...CARD_ART })) {
      expect(def.rows, name).toHaveLength(7);
      for (const row of def.rows) {
        expect(row.length, `${name}: ${row}`).toBe(7);
        for (const ch of row) if (ch !== '.') expect((def.colors as Record<string, string>)[ch], `${name}: ${ch}`).toBeTruthy();
      }
    }
  });
});
