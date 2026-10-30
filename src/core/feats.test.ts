import { describe, expect, it } from 'vitest';
import {
  BOSSES,
  FEATS,
  availableTitles,
  createCharacter,
  evaluateFeats,
  featsFor,
  finishFight,
  fighterStats,
  newGame,
  prepareFight,
  recordBreak,
  setTitle,
  simulateFight,
  startFight,
  DEFAULT_PLAN,
  type Appearance,
  type BossId,
  type Character,
  type FeatContext,
  type FightEvent,
  type FightResult,
  type FighterStats,
  type UnitInfo,
} from './index';

const look: Appearance = { skinTone: 0, hairStyle: 0, hairColor: 0, outfitColor: 0 };

// ---- Crafted fights ----
// Unit 0 is the player, 1 the foe, then the player's pets, then the foe's pets.

interface Setup {
  won?: boolean;
  pets?: number;
  foePets?: number;
  bossId?: BossId;
  skills?: string[];
  progress?: number;
  stats?: Partial<FighterStats>;
  bosses?: Character['bosses'];
}

const unit = (team: 0 | 1, isMain: boolean): UnitInfo => ({ team, isMain, name: 'U', defId: isMain ? 'brawler' : 'rat', maxHp: 100, maxStamina: 100, maxMana: 0 });

function context(events: FightEvent[], s: Setup = {}): FeatContext {
  const won = s.won ?? true;
  const roster = [unit(0, true), unit(1, true)];
  for (let i = 0; i < (s.pets ?? 0); i++) roster.push(unit(0, false));
  for (let i = 0; i < (s.foePets ?? 0); i++) roster.push(unit(1, false));
  const character = createCharacter('Me', look, 'brawler', 'port');
  character.skills.push(...(s.skills ?? []));
  character.bosses = s.bosses;
  character.stats = { fights: 0, wins: 0, kos: 0, streak: 0, bestStreak: 0, bossLosses: {}, ...s.stats };
  const result = { won, log: { seed: 1, roster, events, winner: won ? 0 : 1 }, bossId: s.bossId } as unknown as FightResult;
  return { character, result, side: 0, progress: s.progress ?? 0 };
}

const feat = (id: string) => FEATS.find((f) => f.id === id)!;
const done = (id: string, events: FightEvent[], s: Setup = {}) => feat(id).check(context(events, s)) >= (feat(id).target ?? 1);

const hit = (actor: number, target: number, kind: 'melee' | 'double' | 'throw' | 'spell' | 'combo', damage: number, hp: number, weapon: string | null = null): FightEvent => ({ t: 'hit', actor, target, kind, weapon, damage, hp });
const death = (actor: number): FightEvent => ({ t: 'death', actor });
const card = (actor: number, id: string): FightEvent => ({ t: 'card', actor, card: id, level: 1 });
const times = (n: number, make: (i: number) => FightEvent): FightEvent[] => Array.from({ length: n }, (_, i) => make(i));
const bleed = (actor: number, damage: number): FightEvent => ({ t: 'bleed', actor, damage, hp: 50 });
const steal = (stamina: number): FightEvent => ({ t: 'steal', actor: 0, target: 1, energy: 0, stamina });
const thorns = (damage: number, hp = 50): FightEvent => ({ t: 'thorns', actor: 0, target: 1, damage, hp });
const rhythm = (stacks: number): FightEvent => ({ t: 'rhythm', actor: 0, stacks });
const breakEv: FightEvent = { t: 'break', round: 1, choices: [null, null] };
const armorBreak = (amount: number, armor: number): FightEvent => ({ t: 'armor_break', actor: 0, target: 1, amount, armor });
const ward = (left: number): FightEvent => ({ t: 'ward', actor: 0, absorbed: 0, left });
const heal = (amount: number): FightEvent => ({ t: 'heal', actor: 0, amount, hp: 100 });
const res = (actor: number, stamina: number): FightEvent => ({ t: 'res', actor, stamina, mana: 0 });
const dodge = (actor: number, target: number): FightEvent => ({ t: 'dodge', actor, target, kind: 'melee' });

describe('feat data', () => {
  it('has 15 general feats and 3 for each of the 10 branches', () => {
    expect(FEATS.filter((f) => !f.branch)).toHaveLength(15);
    expect(FEATS.filter((f) => f.branch)).toHaveLength(30);
    expect(new Set(FEATS.map((f) => f.id)).size).toBe(45);
    for (const f of FEATS) {
      expect(f.name.length).toBeGreaterThan(2);
      expect(f.description.length).toBeGreaterThan(8);
    }
  });

  it('marks the secret feats and the feats that give a title', () => {
    expect(FEATS.filter((f) => f.secret).map((f) => f.id).sort()).toEqual(['close_call', 'prodigy', 'stubborn']);
    const titled = FEATS.filter((f) => f.title).map((f) => f.id);
    expect(titled).toHaveLength(14);
    expect(titled).toEqual(expect.arrayContaining(['unstoppable', 'untouchable', 'knockout_artist', 'prodigy']));
    expect(new Set(FEATS.filter((f) => f.title).map((f) => f.title)).size).toBe(14);
  });
});

describe('general feats', () => {
  it('first_blood: win a fight', () => {
    expect(done('first_blood', [])).toBe(true);
    expect(done('first_blood', [], { won: false })).toBe(false);
  });
  it('hot_streak and unstoppable read the win streak', () => {
    expect(done('hot_streak', [], { stats: { bestStreak: 5 } })).toBe(true);
    expect(done('hot_streak', [], { stats: { bestStreak: 4 } })).toBe(false);
    expect(done('unstoppable', [], { stats: { bestStreak: 15 } })).toBe(true);
    expect(done('unstoppable', [], { stats: { bestStreak: 14 } })).toBe(false);
  });
  it('close_call: win with less than 10% health left', () => {
    expect(done('close_call', [hit(1, 0, 'melee', 95, 5)])).toBe(true);
    expect(done('close_call', [hit(1, 0, 'melee', 90, 10)])).toBe(false);
    expect(done('close_call', [hit(1, 0, 'melee', 95, 5)], { won: false })).toBe(false);
  });
  it('untouchable: win losing less than 10% of max health', () => {
    expect(done('untouchable', [hit(1, 0, 'melee', 9, 91)])).toBe(true);
    expect(done('untouchable', [hit(1, 0, 'melee', 10, 90)])).toBe(false);
  });
  it('comeback: below 25% health at a break, then win', () => {
    expect(done('comeback', [hit(1, 0, 'melee', 80, 20), breakEv])).toBe(true);
    expect(done('comeback', [hit(1, 0, 'melee', 75, 25), breakEv])).toBe(false);
    expect(done('comeback', [breakEv, hit(1, 0, 'melee', 80, 20)])).toBe(false);
  });
  it('junk_thrower: knock out a foe with a thrown weapon', () => {
    expect(done('junk_thrower', [hit(0, 1, 'throw', 50, 0, 'axe'), death(1)])).toBe(true);
    expect(done('junk_thrower', [hit(0, 1, 'melee', 50, 0, 'axe'), death(1)])).toBe(false);
  });
  it('full_hand: play 5 cards in one fight', () => {
    expect(done('full_hand', times(5, () => card(0, 'rage')))).toBe(true);
    expect(done('full_hand', times(4, () => card(0, 'rage')))).toBe(false);
    expect(done('full_hand', times(5, () => card(1, 'rage')))).toBe(false);
  });
  it('bare_hands: win without a weapon', () => {
    expect(done('bare_hands', [hit(0, 1, 'melee', 5, 50)])).toBe(true);
    expect(done('bare_hands', [hit(0, 1, 'melee', 5, 50, 'bat')])).toBe(false);
  });
  it('on_points: win without a knockout', () => {
    expect(done('on_points', [hit(0, 1, 'melee', 5, 50)])).toBe(true);
    expect(done('on_points', [hit(0, 1, 'melee', 5, 0), death(1)])).toBe(false);
    expect(done('on_points', [], { won: false })).toBe(false);
  });
  it('veteran and knockout_artist read the record', () => {
    expect(done('veteran', [], { stats: { fights: 100 } })).toBe(true);
    expect(done('veteran', [], { stats: { fights: 99 } })).toBe(false);
    expect(done('knockout_artist', [], { stats: { kos: 50 } })).toBe(true);
    expect(done('knockout_artist', [], { stats: { kos: 49 } })).toBe(false);
  });
  it('stubborn: beat a boss after losing to it 3 times', () => {
    expect(done('stubborn', [], { bossId: 'rusty', stats: { bossLosses: { rusty: 3 } } })).toBe(true);
    expect(done('stubborn', [], { bossId: 'rusty', stats: { bossLosses: { rusty: 2 } } })).toBe(false);
    expect(done('stubborn', [], { bossId: 'rusty', stats: { bossLosses: { alley_cat: 3 } } })).toBe(false);
    expect(done('stubborn', [], { stats: { bossLosses: { rusty: 3 } } })).toBe(false);
  });
  it('prodigy: all four bosses beaten with no loss to any', () => {
    const all: Character['bosses'] = { rusty: 'beaten', alley_cat: 'beaten', sewer_king: 'beaten', champion: 'beaten' };
    expect(done('prodigy', [], { bossId: 'champion', bosses: all })).toBe(true);
    expect(done('prodigy', [], { bossId: 'champion', bosses: all, stats: { bossLosses: { rusty: 1 } } })).toBe(false);
    expect(done('prodigy', [], { bossId: 'champion', bosses: { ...all, rusty: 'skipped' } })).toBe(false);
    expect(done('prodigy', [], { bossId: 'champion', bosses: { rusty: 'beaten', alley_cat: 'beaten', sewer_king: 'beaten' } })).toBe(false);
  });
  it('graduate: beat The Champion', () => {
    expect(done('graduate', [], { bossId: 'champion' })).toBe(true);
    expect(done('graduate', [], { bossId: 'rusty' })).toBe(false);
    expect(done('graduate', [], { bossId: 'champion', won: false })).toBe(false);
  });
});

describe('branch feats', () => {
  it('boxer', () => {
    expect(done('boxer_rhythm5', [rhythm(5)])).toBe(true);
    expect(done('boxer_rhythm5', [rhythm(4)])).toBe(false);
    expect(done('boxer_jab_ko', [card(0, 'jab_flurry'), hit(0, 1, 'double', 5, 10), hit(0, 1, 'double', 5, 0), death(1)])).toBe(true);
    expect(done('boxer_jab_ko', [card(0, 'jab_flurry'), hit(0, 1, 'melee', 5, 0), death(1)])).toBe(false);
    expect(done('boxer_jab_ko', [hit(0, 1, 'double', 5, 0), death(1)])).toBe(false);
    // Three wins in a row without the rhythm being knocked down.
    expect(done('boxer_unbroken', [rhythm(1), rhythm(2)], { progress: 2 })).toBe(true);
    expect(done('boxer_unbroken', [rhythm(1), rhythm(2)], { progress: 1 })).toBe(false);
    expect(done('boxer_unbroken', [rhythm(1), rhythm(2), rhythm(0)], { progress: 2 })).toBe(false);
    expect(feat('boxer_unbroken').check(context([rhythm(2), rhythm(0)], { progress: 2 }))).toBe(0);
    // A new round starting at zero is not a reset.
    expect(done('boxer_unbroken', [rhythm(2), { t: 'round', round: 2 }, rhythm(0)], { progress: 2 })).toBe(true);
    // The Sewer King's rats join right after the round starts: still not a reset.
    expect(done('boxer_unbroken', [rhythm(2), { t: 'round', round: 2 }, { t: 'summon', actor: 2, owner: 1 } as never, rhythm(0)], { progress: 2 })).toBe(true);
    expect(done('boxer_unbroken', [rhythm(2)], { progress: 2, won: false })).toBe(false);
  });
  it('brute', () => {
    expect(done('brute_bleed_ko', [bleed(1, 5), death(1)])).toBe(true);
    expect(done('brute_bleed_ko', [hit(0, 1, 'melee', 5, 0), death(1)])).toBe(false);
    expect(done('brute_bleed20', [bleed(1, 10), bleed(1, 10)])).toBe(true);
    expect(done('brute_bleed20', [bleed(1, 10), bleed(1, 9)])).toBe(false);
    expect(done('brute_bleed20', [bleed(0, 30)])).toBe(false);
    expect(done('brute_bite3', times(3, () => card(0, 'street_bite')))).toBe(true);
    expect(done('brute_bite3', times(2, () => card(0, 'street_bite')))).toBe(false);
  });
  it('acrobat', () => {
    expect(done('acrobat_dodge5', times(5, () => dodge(1, 0)))).toBe(true);
    expect(done('acrobat_dodge5', [...times(4, () => dodge(1, 0)), hit(1, 0, 'melee', 1, 99), dodge(1, 0)])).toBe(false);
    expect(done('acrobat_momentum6', times(6, () => ({ t: 'momentum', actor: 0, energy: 1 })))).toBe(true);
    expect(done('acrobat_momentum6', times(5, () => ({ t: 'momentum', actor: 0, energy: 1 })))).toBe(false);
    expect(done('acrobat_clean', [hit(0, 1, 'melee', 5, 50), hit(1, 0, 'throw', 5, 95)])).toBe(true);
    expect(done('acrobat_clean', [hit(1, 0, 'melee', 5, 95)])).toBe(false);
    expect(done('acrobat_clean', [], { won: false })).toBe(false);
  });
  it('thief', () => {
    expect(done('thief_steal30', [steal(15), steal(15)])).toBe(true);
    expect(done('thief_steal30', [steal(15), steal(14)])).toBe(false);
    expect(done('thief_heist2', times(2, () => card(0, 'heist')))).toBe(true);
    expect(done('thief_heist2', times(1, () => card(0, 'heist')))).toBe(false);
    expect(done('thief_drained', [res(1, 40), res(1, 0)])).toBe(true);
    expect(done('thief_drained', [res(1, 0), res(1, 5)])).toBe(false);
    expect(done('thief_drained', [res(0, 0), res(1, 5)])).toBe(false);
  });
  it('wall', () => {
    expect(done('wall_thorn_ko', [thorns(5, 0), death(1)])).toBe(true);
    expect(done('wall_thorn_ko', [hit(0, 1, 'melee', 5, 0), death(1)])).toBe(false);
    expect(done('wall_reflect30', [thorns(15), thorns(15)])).toBe(true);
    expect(done('wall_reflect30', [thorns(15), thorns(14)])).toBe(false);
    const attacks = (n: number): FightEvent[] => [{ t: 'tick', n: 0 }, card(0, 'taunt'), { t: 'tick', n: 1 }, ...times(n, (i) => hit(2 + i, 0, 'melee', 1, 99))];
    expect(done('wall_taunt3', attacks(3), { foePets: 3 })).toBe(true);
    expect(done('wall_taunt3', attacks(2), { foePets: 3 })).toBe(false);
    // The same pet hitting three times does not count.
    expect(done('wall_taunt3', [{ t: 'tick', n: 0 }, card(0, 'taunt'), ...times(3, () => hit(2, 0, 'melee', 1, 99))], { foePets: 3 })).toBe(false);
    // Without Taunt it does not count.
    expect(done('wall_taunt3', times(3, (i) => hit(2 + i, 0, 'melee', 1, 99)), { foePets: 3 })).toBe(false);
  });
  it('wrecker', () => {
    expect(done('wrecker_strip', [armorBreak(2, 0)])).toBe(true);
    expect(done('wrecker_strip', [armorBreak(2, 1)])).toBe(false);
    expect(done('wrecker_sledge_ko', [card(0, 'sledge_swing'), hit(0, 1, 'melee', 9, 0), death(1)])).toBe(true);
    expect(done('wrecker_sledge_ko', [card(0, 'sledge_swing'), hit(0, 1, 'melee', 9, 5), armorBreak(4, 1), hit(0, 1, 'melee', 9, 0), death(1)])).toBe(false);
    expect(done('wrecker_sledge_ko', [hit(0, 1, 'melee', 9, 0), death(1)])).toBe(false);
    expect(done('wrecker_break10', [armorBreak(5, 5), armorBreak(5, 0)])).toBe(true);
    expect(done('wrecker_break10', [armorBreak(5, 5), armorBreak(4, 1)])).toBe(false);
  });
  it('pack', () => {
    expect(done('pack_three_alive', [], { pets: 3 })).toBe(true);
    expect(done('pack_three_alive', [death(3)], { pets: 3 })).toBe(false);
    expect(done('pack_three_alive', [], { pets: 2 })).toBe(false);
    expect(done('pack_three_alive', [], { pets: 3, won: false })).toBe(false);
    expect(done('pack_gangup_ko', [card(0, 'gang_up'), hit(2, 1, 'melee', 9, 0), death(1)], { pets: 1 })).toBe(true);
    expect(done('pack_gangup_ko', [card(0, 'gang_up'), hit(2, 1, 'melee', 9, 40), res(0, 50), hit(0, 1, 'melee', 9, 0), death(1)], { pets: 1 })).toBe(false);
    expect(done('pack_outdamage', [hit(2, 1, 'melee', 30, 70), hit(0, 1, 'melee', 20, 50)], { pets: 1 })).toBe(true);
    expect(done('pack_outdamage', [hit(2, 1, 'melee', 20, 70), hit(0, 1, 'melee', 20, 50)], { pets: 1 })).toBe(false);
  });
  it('bond', () => {
    expect(done('bond_all_alive', [], { pets: 2 })).toBe(true);
    expect(done('bond_all_alive', [death(2)], { pets: 2 })).toBe(false);
    expect(done('bond_all_alive', [], { pets: 0 })).toBe(false);
    const guardian = (hp: number): FightEvent[] => [{ t: 'guardian', actor: 2, target: 0, damage: 10, hp: 20 }, hit(1, 0, 'melee', 20, hp)];
    expect(done('bond_guardian_save', guardian(8), { pets: 1 })).toBe(true);
    expect(done('bond_guardian_save', guardian(15), { pets: 1 })).toBe(false);
    expect(done('bond_together30', [card(0, 'together'), heal(30)])).toBe(true);
    expect(done('bond_together30', [card(0, 'together'), heal(29)])).toBe(false);
    expect(done('bond_together30', [heal(40)])).toBe(false);
  });
  it('witch', () => {
    expect(done('witch_burn_ko', [{ t: 'burn', actor: 1, damage: 3, hp: 0 }, death(1)])).toBe(true);
    expect(done('witch_burn_ko', [bleed(1, 3), death(1)])).toBe(false);
    const spells = (n: number): FightEvent[] => times(n, () => hit(0, 1, 'spell', 5, 50));
    expect(done('witch_burn3', spells(3), { skills: ['flame'] })).toBe(true);
    expect(done('witch_burn3', spells(2), { skills: ['flame'] })).toBe(false);
    expect(done('witch_burn3', spells(3))).toBe(false);
    const fireballs = Array.from({ length: 3 }, (): FightEvent[] => [{ t: 'cast', actor: 0, spell: 'fireball', target: 1 }, hit(0, 1, 'spell', 5, 50)]).flat();
    expect(done('witch_burn3', fireballs)).toBe(true);
    const fireball: FightEvent[] = [card(0, 'fireball'), { t: 'cast', actor: 0, spell: 'fireball', target: 1 }, hit(0, 1, 'spell', 9, 0), death(1)];
    expect(done('witch_fireball_ko', fireball)).toBe(true);
    expect(done('witch_fireball_ko', fireball.slice(1))).toBe(false);
    expect(done('witch_fireball_ko', [card(0, 'bolt'), { t: 'cast', actor: 0, spell: 'bolt', target: 1 }, hit(0, 1, 'spell', 9, 0), death(1)])).toBe(false);
  });
  it('warden', () => {
    expect(done('warden_ward20', [ward(20)])).toBe(true);
    expect(done('warden_ward20', [ward(19)])).toBe(false);
    expect(done('warden_overheal50', [{ t: 'overheal', actor: 0, amount: 30, ward: 30 }, { t: 'overheal', actor: 0, amount: 20, ward: 20 }])).toBe(true);
    expect(done('warden_overheal50', [{ t: 'overheal', actor: 0, amount: 30, ward: 30 }, { t: 'overheal', actor: 0, amount: 19, ward: 20 }])).toBe(false);
    expect(done('warden_steady', [hit(1, 0, 'melee', 50, 50)])).toBe(true);
    expect(done('warden_steady', [hit(1, 0, 'melee', 51, 49)])).toBe(false);
    expect(done('warden_steady', [hit(1, 0, 'melee', 10, 90)], { won: false })).toBe(false);
  });
});

describe('evaluating feats', () => {
  const winResult = (): FightResult => context([hit(0, 1, 'melee', 5, 50)]).result;

  it('lists general feats plus only the fighter\'s own branch', () => {
    const c = createCharacter('Me', look, 'brawler', 'port');
    expect(featsFor(c)).toHaveLength(15);
    c.branch = 'boxer';
    const ids = featsFor(c).map((f) => f.id);
    expect(ids).toHaveLength(18);
    expect(ids.filter((id) => id.startsWith('boxer_'))).toHaveLength(3);
    expect(ids.some((id) => id.startsWith('brute_'))).toBe(false);
  });

  it('adds medals once and returns only the new ones', () => {
    const c = createCharacter('Me', look, 'brawler', 'port');
    expect(evaluateFeats(c, winResult())).toContain('first_blood');
    expect(c.medals).toContain('first_blood');
    expect(evaluateFeats(c, winResult())).not.toContain('first_blood');
    expect(c.medals!.filter((m) => m === 'first_blood')).toHaveLength(1);
  });

  it('does not award other branches\' feats', () => {
    const c = createCharacter('Me', look, 'brawler', 'port');
    c.branch = 'boxer';
    const result = context([bleed(1, 5), death(1)]).result;
    evaluateFeats(c, result);
    expect(c.medals).not.toContain('brute_bleed_ko');
  });

  it('keeps progress for counting feats', () => {
    const c = createCharacter('Me', look, 'brawler', 'port');
    c.stats = { fights: 40, wins: 0, kos: 0, streak: 0, bestStreak: 0, bossLosses: {} };
    const result = winResult();
    evaluateFeats(c, result);
    expect(c.featProgress!.veteran).toBe(40);
    expect(c.medals).not.toContain('veteran');
  });

  it('gives titles only from completed feats and checks them', () => {
    const c = createCharacter('Me', look, 'brawler', 'port');
    expect(availableTitles(c)).toEqual([]);
    expect(() => setTitle(c, 'Unstoppable')).toThrow();
    c.medals = ['unstoppable', 'first_blood'];
    expect(availableTitles(c)).toEqual([feat('unstoppable').title]);
    setTitle(c, feat('unstoppable').title);
    expect(c.title).toBe(feat('unstoppable').title);
    setTitle(c, undefined);
    expect(c.title).toBeUndefined();
  });
});

describe('feats in finishFight', () => {
  const play = (save: ReturnType<typeof newGame>) => {
    prepareFight(save);
    startFight(save, DEFAULT_PLAN, save.character.weapons);
    for (let log = simulateFight(save); log.winner === null; log = simulateFight(save)) recordBreak(save, { ...DEFAULT_PLAN, weapons: save.character.weapons, recover: false });
    return finishFight(save);
  };

  it('returns the new medals of a won fight, and none the second time', () => {
    const save = newGame('Me', look, 'brawler', 'port', 5);
    save.character.bonusStats = { ...save.character.bonusStats, health: 300, strength: 80 };
    const first = play(save);
    expect(first.won).toBe(true);
    expect(first.newMedals).toContain('first_blood');
    expect(save.character.medals).toContain('first_blood');
    expect(fighterStats(save.character).wins).toBe(1);
    const second = play(save);
    expect(second.newMedals).not.toContain('first_blood');
  });

  it('adds a boss medal when a boss is beaten', () => {
    const save = newGame('Me', look, 'brawler', 'port', 5);
    save.character.level = 5;
    save.character.branch = 'boxer';
    save.character.bonusStats = { ...save.character.bonusStats, health: 300, strength: 80 };
    save.pendingFight = {
      opponent: { ...BOSSES.rusty.build(), bonusStats: { health: -50, strength: -5, agility: 0, speed: 0, magic: 0 } },
      opponentPlan: { ...BOSSES.rusty.plan },
      live: false,
      seed: 3,
      tactics: null,
      inputs: { plays: [], breaks: [] },
      bossId: 'rusty',
    };
    const result = play(save);
    expect(result.won).toBe(true);
    expect(result.bossBeaten).toBe(true);
    expect(result.newMedals).toContain('boss_rusty');
    expect(save.character.medals).toContain('boss_rusty');
  });
});
