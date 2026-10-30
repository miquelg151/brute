// The four bosses. Each is a fixed fighter (same build, look and plan every time) that blocks
// the way at a gate level until the player beats it. Their tricks are skill ids that only
// bosses carry; they are never offered as upgrades. What a trick does lives in fight.ts.
import { createCharacter } from './character';
import { applyUpgrade } from './progression';
import { DEFAULT_PLAN, type Plan } from './tactics';
import type { Appearance, BranchId, Character, ClassId } from './types';

export type BossId = 'rusty' | 'alley_cat' | 'sewer_king' | 'champion';

export interface BossDef {
  id: BossId;
  level: number;
  name: string;
  /** One line shown on the boss card. */
  intro: string;
  /** The trick skill id (a key of SKILLS). */
  trick: string;
  /** What the trick does, in plain words, for the boss card. */
  trickText: string;
  /** The plan the boss fights with. */
  plan: Plan;
  build: () => Character;
}

/** The levels that have a boss. */
export const BOSS_LEVELS = [5, 10, 15, 20];

/** The level a fighter must be at to challenge the boss. The last boss is met at 19, to reach 20. */
export function gateLevel(boss: BossDef): number {
  return boss.level === 20 ? 19 : boss.level;
}

interface BossBuild {
  name: string;
  look: Appearance;
  classId: ClassId;
  originId: string;
  branch: BranchId;
  /** Upgrade ids (see UPGRADES): one for every level gained after level 1. */
  upgrades: string[];
  trick: string;
}

/** Makes the boss fighter: a new character at its level with its fixed upgrades. */
function buildFrom(level: number, b: BossBuild): Character {
  const c = createCharacter(b.name, b.look, b.classId, b.originId);
  c.level = level;
  c.branch = b.branch;
  for (const id of b.upgrades) applyUpgrade(c, id);
  c.skills.push(b.trick);
  return c;
}

export const BOSSES: Record<BossId, BossDef> = {
  rusty: {
    id: 'rusty',
    level: 5,
    name: 'Rusty',
    intro: 'The scrapyard bouncer. Nobody gets past the gate without a dent.',
    trick: 'boss_spare_parts',
    trickText: 'Once, when badly hurt, he patches himself up and gets tougher armor.',
    plan: { stance: 'balanced', target: 'mixed', weaponStyle: 'normal' },
    build: () =>
      buildFrom(5, {
        name: 'Rusty',
        look: { skinTone: 3, hairStyle: 1, hairColor: 2, outfitColor: 4 },
        classId: 'bouncer',
        originId: 'scrapyard',
        branch: 'wall',
        // Tuned with `npm run balance -- 600 bosses`: the Riot Vest makes him slow, and Spare Parts is strong.
        upgrades: ['gen_agility', 'gen_agility', 'gear:riot_vest', 'card:body_slam'],
        trick: 'boss_spare_parts',
      }),
  },
  alley_cat: {
    id: 'alley_cat',
    level: 10,
    name: 'Alley Cat',
    intro: 'Rooftop runner. You will not land a clean hit.',
    trick: 'boss_nine_lives',
    trickText: 'The first hit that would knock her out leaves her on 1 health, and she dodges the next attack.',
    plan: { stance: 'agile', target: 'fighter', weaponStyle: 'normal' },
    build: () =>
      buildFrom(10, {
        name: 'Alley Cat',
        look: { skinTone: 1, hairStyle: 2, hairColor: 4, outfitColor: 6 },
        classId: 'parkour',
        originId: 'rooftops',
        branch: 'acrobat',
        upgrades: [
          'parkour_agility', 'gen_speed', 'gear:tracksuit', 'skill:sixth_sense', 'card:flurry',
          'skill:momentum', 'gen_health', 'gen_agility', 'gen_health',
        ],
        trick: 'boss_nine_lives',
      }),
  },
  sewer_king: {
    id: 'sewer_king',
    level: 15,
    name: 'Sewer King',
    intro: 'Ruler of the tunnels. Every rat down there answers to him.',
    trick: 'boss_rat_tide',
    trickText: 'A new rat joins him at the start of every round, up to 3 extra rats.',
    plan: { stance: 'balanced', target: 'mixed', weaponStyle: 'normal' },
    build: () =>
      buildFrom(15, {
        name: 'Sewer King',
        look: { skinTone: 4, hairStyle: 3, hairColor: 1, outfitColor: 2 },
        classId: 'tamer',
        originId: 'sewers',
        branch: 'pack',
        // Only a dog and a rat to start with: Rat Tide brings the rest of the pack.
        upgrades: [
          'tamer_health', 'gen_health', 'gen_speed', 'pet:rat', 'card:gang_up', 'gen_speed', 'gen_speed',
          'gen_speed', 'gen_agility', 'gen_agility', 'gen_agility', 'gen_agility', 'tamer_agility', 'skill:pack_call',
        ],
        trick: 'boss_rat_tide',
      }),
  },
  champion: {
    id: 'champion',
    level: 20,
    name: 'The Champion',
    intro: 'Undefeated at the Port. He reads you like a book.',
    trick: 'boss_read_the_fight',
    trickText: 'At every break he switches his plan to counter yours.',
    plan: { ...DEFAULT_PLAN },
    build: () =>
      buildFrom(20, {
        name: 'The Champion',
        look: { skinTone: 2, hairStyle: 0, hairColor: 0, outfitColor: 0 },
        classId: 'brawler',
        originId: 'port',
        branch: 'boxer',
        upgrades: [
          'brawler_strength', 'brawler_health', 'gen_health', 'gen_agility', 'gen_speed', 'gen_strength',
          'gear:leather_jacket', 'skill:jab', 'skill:rhythm', 'card:haymaker', 'card:jab_flurry', 'gen_speed',
          'gen_speed', 'gen_agility', 'gen_agility', 'gen_speed', 'gen_agility', 'gen_speed', 'gen_agility',
        ],
        trick: 'boss_read_the_fight',
      }),
  },
};

/** The boss that blocks this fighter right now, or null (no boss at this level, or already beaten or skipped). */
export function gatedBoss(c: Character): BossDef | null {
  const boss = Object.values(BOSSES).find((b) => gateLevel(b) === c.level);
  if (!boss || c.bosses?.[boss.id]) return null;
  return boss;
}

/** A fresh copy of the boss fighter. */
export function buildBoss(id: BossId): Character {
  return BOSSES[id].build();
}
