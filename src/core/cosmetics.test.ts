import { describe, expect, it } from 'vitest';
import {
  APPEARANCE_OPTIONS,
  COSMETICS,
  MEDAL_COSMETICS,
  ROAD,
  applyMatch,
  canWear,
  cosmeticsOf,
  grantCosmetics,
  grantSaveCosmetics,
  leagueTitles,
  migrateSave,
  newCosmetics,
  newGame,
  newLeague,
  setCelebration,
  setLook,
  setTitle,
} from './index';

const look = { skinTone: 0, hairStyle: 0, hairColor: 0, outfitColor: 0 };

describe('cosmetics', () => {
  it('every cosmetic is free or has a way to get it, and every way exists', () => {
    const fromRoad = ROAD.flatMap((s) => s.rewards.flatMap((r) => (r.kind === 'cosmetic' ? [r.id] : [])));
    const fromMedals = Object.values(MEDAL_COSMETICS).flat();
    for (const c of Object.values(COSMETICS)) {
      if (c.free) continue;
      expect(c.how, c.id).toBeTruthy();
      expect([...fromRoad, ...fromMedals], c.id).toContain(c.id);
    }
    for (const id of [...fromRoad, ...fromMedals]) expect(COSMETICS[id], id).toBeDefined();
  });

  it('extra hair styles and colours come right after the base options', () => {
    expect(cosmeticsOf('hairStyle').map((c) => c.index)).toEqual([APPEARANCE_OPTIONS.hairStyle, APPEARANCE_OPTIONS.hairStyle + 1]);
    expect(cosmeticsOf('hairColor').map((c) => c.index)).toEqual([APPEARANCE_OPTIONS.hairColor, APPEARANCE_OPTIONS.hairColor + 1]);
    expect(cosmeticsOf('outfitColor').map((c) => c.index)).toEqual([APPEARANCE_OPTIONS.outfitColor, APPEARANCE_OPTIONS.outfitColor + 1]);
  });

  it('only free or owned cosmetics can be worn', () => {
    const state = newCosmetics();
    expect(canWear(state, look)).toBe(true);
    expect(canWear(state, { ...look, hat: 'cap' })).toBe(true);
    expect(canWear(state, { ...look, hat: 'crown' })).toBe(false);
    expect(canWear(state, { ...look, hat: 'nonsense' })).toBe(false);
    expect(canWear(state, { ...look, hairStyle: 4 })).toBe(false);
    expect(canWear(state, { ...look, hairColor: 99 })).toBe(false);
    state.owned.push('crown', 'spiky');
    expect(canWear(state, { ...look, hat: 'crown', hairStyle: 4 })).toBe(true);
  });

  it('setLook refuses a locked look and can take the hat off', () => {
    const save = newGame('M', look, 'brawler', 'port', 1);
    expect(() => setLook(save.cosmetics, save.character, { ...look, hat: 'crown' })).toThrow();
    setLook(save.cosmetics, save.character, { ...look, hat: 'cap', hairColor: 3 });
    expect(save.character.appearance).toEqual({ ...look, hat: 'cap', hairColor: 3 });
    setLook(save.cosmetics, save.character, look);
    expect(save.character.appearance.hat).toBeUndefined();
  });

  it('celebrations: confetti is free, the rest must be owned', () => {
    const state = newCosmetics();
    expect(state.celebration).toBe('confetti');
    expect(() => setCelebration(state, 'hearts')).toThrow();
    expect(() => setCelebration(state, 'cap')).toThrow();
    state.owned.push('hearts');
    setCelebration(state, 'hearts');
    expect(state.celebration).toBe('hearts');
  });

  it('medals of the fighter and of legends, and road stops, give their cosmetics once', () => {
    const state = newCosmetics();
    const fighter = newGame('M', look, 'brawler', 'port', 1).character;
    fighter.medals = ['boss_rusty', 'hot_streak'];
    const legend = { graduatedAt: '', character: { ...fighter, medals: ['boss_champion'] } };
    const fresh = grantCosmetics(state, { roadStops: ['r150'], fighters: [fighter], legends: [legend] });
    expect(fresh.sort()).toEqual(['champion_band', 'gold_rain', 'hard_hat', 'neon_pink', 'spiky']);
    expect(grantCosmetics(state, { roadStops: ['r150'], fighters: [fighter], legends: [legend] })).toEqual([]);
  });

  it('a league match that reaches a road stop gives its cosmetic', () => {
    const save = newGame('M', look, 'brawler', 'port', 1);
    save.league.trophies = 440;
    applyMatch(save.league, true);
    expect(grantSaveCosmetics(save)).toEqual(expect.arrayContaining(['neon_pink', 'shades']));
  });

  it('league titles can be worn', () => {
    const league = newLeague();
    league.rewards = ['r150', 'r450'];
    expect(leagueTitles(league)).toEqual(['Alley Cat', 'Dock Boss']);
    const c = newGame('M', look, 'brawler', 'port', 1).character;
    expect(() => setTitle(c, 'Dock Boss')).toThrow();
    setTitle(c, 'Dock Boss', leagueTitles(league));
    expect(c.title).toBe('Dock Boss');
  });

  it('a version 9 save gets cosmetics for what it already earned', () => {
    const save = newGame('Old', look, 'brawler', 'port', 4) as unknown as Record<string, unknown> & { character: { medals?: string[] }; league: { rewards: string[] } };
    save.character.medals = ['boss_alley_cat'];
    save.league.rewards = ['r150'];
    delete save.cosmetics;
    save.version = 9;
    const migrated = migrateSave(JSON.parse(JSON.stringify(save)))!;
    expect(migrated.version).toBe(10);
    expect(migrated.cosmetics.celebration).toBe('confetti');
    expect(migrated.cosmetics.owned.sort()).toEqual(['cat_ears', 'neon_pink']);
  });
});
