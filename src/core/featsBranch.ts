// The branch feats: three for each of the ten branches (the last one of each gives a title).
// See feats.ts for how feats are checked. Conditions the log cannot show exactly are read in
// the closest way it can, and the description says so.
import {
  best, cardCount, damageBy, died, eventsOf, events, flag, foe, isFoePet, knockedOutByCard, lastBlow, lowestHp, maxHp, me, ownPets, strikes, total,
  type FeatContext, type FeatDef,
} from './featTools';
import type { FightEvent } from './fight';

const won = (ctx: FeatContext): boolean => ctx.result.won;

/** True when the event just before the knockout came from the foe (a bleed or burn tick). */
const tickKilled = (ctx: FeatContext, type: 'bleed' | 'burn'): boolean => {
  const blow = lastBlow(ctx);
  return !!blow && blow.t === type && blow.actor === foe(ctx);
};

/** Strikes (or misses) on the player, by kind. */
const hitsOnMe = (ctx: FeatContext) => strikes(ctx).filter((e) => e.target === me(ctx));

/** The longest run of attacks on the player that were all dodged. */
function longestDodgeRun(ctx: FeatContext): number {
  let run = 0;
  let longest = 0;
  for (const e of events(ctx)) {
    if (e.t === 'dodge' && e.target === me(ctx)) longest = Math.max(longest, ++run);
    else if ((e.t === 'hit' || e.t === 'block') && e.target === me(ctx)) run = 0;
  }
  return longest;
}

/** True if the player's rhythm built up and was then knocked down (a new round starting at zero does not count). */
function rhythmWasReset(ctx: FeatContext): boolean {
  let stacks = 0;
  return events(ctx).some((e, i) => {
    if (e.t !== 'rhythm' || e.actor !== me(ctx)) return false;
    const reset = e.stacks < stacks && events(ctx)[i - 1]?.t !== 'round';
    stacks = e.stacks;
    return reset;
  });
}

/** The most different enemy pets that attacked the player within TAUNT_TICKS ticks of one Taunt card. */
const TAUNT_TICKS = 10;
function tauntCrowd(ctx: FeatContext): number {
  let tick = 0;
  const taunts: { from: number; pets: Set<number> }[] = [];
  for (const e of events(ctx)) {
    if (e.t === 'tick') tick = e.n;
    else if (e.t === 'card' && e.actor === me(ctx) && e.card === 'taunt') taunts.push({ from: tick, pets: new Set() });
    else if ((e.t === 'hit' || e.t === 'block' || e.t === 'dodge' || e.t === 'miss') && e.target === me(ctx) && isFoePet(ctx, e.actor)) {
      for (const t of taunts) if (tick - t.from <= TAUNT_TICKS) t.pets.add(e.actor);
    }
  }
  return Math.max(0, ...taunts.map((t) => t.pets.size));
}

/** How many spells of the player landed on the foe and set it burning (Flame, or a Fireball). */
function burnsApplied(ctx: FeatContext): number {
  const flame = ctx.character.skills.includes('flame');
  let lastSpell = '';
  let count = 0;
  for (const e of events(ctx)) {
    if (e.t === 'cast' && e.actor === me(ctx)) lastSpell = e.spell;
    else if (e.t === 'hit' && e.kind === 'spell' && e.actor === me(ctx) && e.target === foe(ctx) && e.hp > 0 && (flame || lastSpell === 'fireball')) count++;
  }
  return count;
}

/** Steals, thorns and the like: add up one number from the player's events of a type. */
const sumOf = <T extends FightEvent['t']>(ctx: FeatContext, type: T, who: 'actor' | 'foe', pick: (e: Extract<FightEvent, { t: T }>) => number): number =>
  total(eventsOf(ctx, type).filter((e) => (e as { actor: number }).actor === (who === 'foe' ? foe(ctx) : me(ctx))).map(pick));

/** Pets of the player that are still on their feet at the end. */
const petsAlive = (ctx: FeatContext): number => ownPets(ctx).filter((p) => !died(ctx, p)).length;

/** Parts of a card's burst of events, for knockedOutByCard. */
const kindOf = (e: FightEvent): string | null => (e.t === 'hit' || e.t === 'block' || e.t === 'dodge' ? e.kind : null);
const quiet = (e: FightEvent): boolean => e.t === 'ward' || e.t === 'scrap';

export const BRANCH_FEATS: FeatDef[] = [
  // Boxer
  { id: 'boxer_rhythm5', branch: 'boxer', name: 'Perfect Rhythm', description: 'Reach 5 Rhythm stacks.', check: (ctx) => flag(Math.max(0, ...eventsOf(ctx, 'rhythm').filter((e) => e.actor === me(ctx)).map((e) => e.stacks)) >= 5, ctx) },
  {
    id: 'boxer_jab_ko', branch: 'boxer', name: 'Flurry Finish', description: 'Knock out the foe with Jab Flurry.',
    check: (ctx) => flag(knockedOutByCard(ctx, 'jab_flurry', (e) => kindOf(e) === 'double' || e.t === 'miss' || e.t === 'rhythm' || quiet(e), 3), ctx),
  },
  {
    id: 'boxer_unbroken', branch: 'boxer', name: 'Unbroken', title: 'Iron Fist', target: 3,
    description: 'Win 3 fights in a row in which you built Rhythm and the foe never knocked it down.',
    check: (ctx) => (won(ctx) && eventsOf(ctx, 'rhythm').some((e) => e.actor === me(ctx)) && !rhythmWasReset(ctx) ? ctx.progress + 1 : 0),
  },
  // Brute
  { id: 'brute_bleed_ko', branch: 'brute', name: 'Bled Dry', description: 'Knock out the foe with bleed.', check: (ctx) => flag(tickKilled(ctx, 'bleed'), ctx) },
  { id: 'brute_bleed20', branch: 'brute', name: 'Open Wounds', description: 'Deal 20 bleed damage in one fight.', target: 20, check: (ctx) => best(sumOf(ctx, 'bleed', 'foe', (e) => e.damage), ctx) },
  { id: 'brute_bite3', branch: 'brute', name: 'Rabid', title: 'Street Biter', target: 3, description: 'Play Street Bite 3 times in one fight.', check: (ctx) => best(cardCount(ctx, 'street_bite'), ctx) },
  // Acrobat
  { id: 'acrobat_dodge5', branch: 'acrobat', name: 'Slippery', target: 5, description: 'Dodge 5 attacks in a row.', check: (ctx) => best(longestDodgeRun(ctx), ctx) },
  { id: 'acrobat_momentum6', branch: 'acrobat', name: 'Gathering Speed', target: 6, description: 'Gain 6 energy from Momentum in one fight.', check: (ctx) => best(eventsOf(ctx, 'momentum').filter((e) => e.actor === me(ctx)).length, ctx) },
  {
    id: 'acrobat_clean', branch: 'acrobat', name: 'Not a Scratch', title: 'Shadow',
    description: 'Win without taking a melee hit (thrown weapons and spells do not count).',
    check: (ctx) => flag(won(ctx) && !hitsOnMe(ctx).some((e) => e.kind !== 'throw' && e.kind !== 'spell'), ctx),
  },
  // Thief
  { id: 'thief_steal30', branch: 'thief', name: 'Sticky Fingers', target: 30, description: 'Steal 30 stamina in one fight.', check: (ctx) => best(sumOf(ctx, 'steal', 'actor', (e) => e.stamina), ctx) },
  { id: 'thief_heist2', branch: 'thief', name: 'Double Heist', target: 2, description: 'Play Heist twice in one fight.', check: (ctx) => best(cardCount(ctx, 'heist'), ctx) },
  {
    id: 'thief_drained', branch: 'thief', name: 'Bled of Breath', title: 'Light Fingers',
    description: 'Win while the foe is down to 0 stamina (the last stamina we saw of them).',
    check: (ctx) => flag(won(ctx) && eventsOf(ctx, 'res').filter((e) => e.actor === foe(ctx)).at(-1)?.stamina === 0, ctx),
  },
  // Wall
  {
    id: 'wall_thorn_ko', branch: 'wall', name: 'Ouch', description: 'Knock out the foe with thorns.',
    check: (ctx) => {
      const blow = lastBlow(ctx);
      return flag(!!blow && blow.t === 'thorns' && blow.actor === me(ctx) && blow.target === foe(ctx), ctx);
    },
  },
  { id: 'wall_reflect30', branch: 'wall', name: 'Mirror Wall', target: 30, description: 'Reflect 30 damage with thorns in one fight.', check: (ctx) => best(sumOf(ctx, 'thorns', 'actor', (e) => e.damage), ctx) },
  {
    id: 'wall_taunt3', branch: 'wall', name: 'Crowd Pleaser', title: 'Immovable', target: 3,
    description: 'Have 3 different enemy pets attack you within 10 ticks of playing Taunt.',
    check: (ctx) => best(tauntCrowd(ctx), ctx),
  },
  // Wrecker
  { id: 'wrecker_strip', branch: 'wrecker', name: 'Stripped Bare', description: 'Strip all of the foe\'s armor.', check: (ctx) => flag(eventsOf(ctx, 'armor_break').some((e) => e.actor === me(ctx) && e.armor === 0), ctx) },
  {
    id: 'wrecker_sledge_ko', branch: 'wrecker', name: 'Sledge Finish', description: 'Knock out the foe with Sledge Swing.',
    check: (ctx) => flag(knockedOutByCard(ctx, 'sledge_swing', (e) => (e.t === 'hit' || e.t === 'block') && e.actor === me(ctx) || quiet(e), 1), ctx),
  },
  { id: 'wrecker_break10', branch: 'wrecker', name: 'Wrecking Crew', title: 'Demolisher', target: 10, description: 'Break 10 armor in one fight.', check: (ctx) => best(sumOf(ctx, 'armor_break', 'actor', (e) => e.amount), ctx) },
  // Pack
  { id: 'pack_three_alive', branch: 'pack', name: 'Full Pack', description: 'Win with 3 pets still alive.', check: (ctx) => flag(won(ctx) && petsAlive(ctx) >= 3, ctx) },
  {
    id: 'pack_gangup_ko', branch: 'pack', name: 'Mob Rules', description: 'Knock out the foe with Gang Up.',
    check: (ctx) => flag(knockedOutByCard(ctx, 'gang_up', (e) => kindOf(e) === 'melee' || e.t === 'miss' || e.t === 'heal' || e.t === 'thorns' || e.t === 'armor_break' || e.t === 'guardian' || quiet(e), ownPets(ctx).length + 1), ctx),
  },
  {
    id: 'pack_outdamage', branch: 'pack', name: 'Leader of the Pack', title: 'Pack Leader',
    description: 'Have your pets deal more damage than you in one fight.',
    check: (ctx) => flag(damageBy(ctx, true) > damageBy(ctx, false), ctx),
  },
  // Bond
  { id: 'bond_all_alive', branch: 'bond', name: 'No One Left Behind', description: 'Win with all your pets alive (you need at least one).', check: (ctx) => flag(won(ctx) && ownPets(ctx).length > 0 && petsAlive(ctx) === ownPets(ctx).length, ctx) },
  {
    id: 'bond_guardian_save', branch: 'bond', name: 'Guardian Angel',
    description: 'Have Guardian take a share of a hit that would have knocked you out.',
    check: (ctx) => {
      const list = events(ctx);
      const saved = list.some((e, i) => {
        if (e.t !== 'guardian' || e.target !== me(ctx)) return false;
        // The hit it softened comes next. Without the share, you would have been left on 0 or less.
        const next = list.slice(i + 1).find((n) => (n.t === 'hit' || n.t === 'block') && n.target === me(ctx));
        return !!next && (next.t === 'hit' || next.t === 'block') && next.hp > 0 && e.damage >= next.hp;
      });
      return flag(saved, ctx);
    },
  },
  {
    id: 'bond_together30', branch: 'bond', name: 'Stronger Together', title: 'Best Friend', target: 30,
    description: 'Heal 30 health with Together in one fight.',
    check: (ctx) => {
      // Together heals you first: the heal right after the card is yours.
      const list = events(ctx);
      const healed = list.map((e, i) => (e.t === 'card' && e.actor === me(ctx) && e.card === 'together' ? list[i + 1] : undefined)).flatMap((n) => (n?.t === 'heal' && n.actor === me(ctx) ? [n.amount] : []));
      return best(total(healed), ctx);
    },
  },
  // Witch
  { id: 'witch_burn_ko', branch: 'witch', name: 'Burned Out', description: 'Knock out the foe with burn.', check: (ctx) => flag(tickKilled(ctx, 'burn'), ctx) },
  { id: 'witch_burn3', branch: 'witch', name: 'Pyromaniac', target: 3, description: 'Set the foe burning 3 times in one fight (3 landed spells with Flame, or Fireballs).', check: (ctx) => best(burnsApplied(ctx), ctx) },
  {
    id: 'witch_fireball_ko', branch: 'witch', name: 'Fireball Finish', title: 'Firebrand', description: 'Knock out the foe with Fireball.',
    check: (ctx) => flag(knockedOutByCard(ctx, 'fireball', (e) => (e.t === 'cast' && e.spell === 'fireball') || ((e.t === 'hit' || e.t === 'block') && e.kind === 'spell') || quiet(e), 1), ctx),
  },
  // Warden
  {
    id: 'warden_ward20', branch: 'warden', name: 'Shielded', target: 20, description: 'Have a ward of 20 at once.',
    check: (ctx) => best(Math.max(0, ...events(ctx).flatMap((e) => (e.t === 'ward' && e.actor === me(ctx) ? [e.left] : e.t === 'overheal' && e.actor === me(ctx) ? [e.ward] : []))), ctx),
  },
  { id: 'warden_overheal50', branch: 'warden', name: 'Overflowing', target: 50, description: 'Overheal 50 in one fight.', check: (ctx) => best(sumOf(ctx, 'overheal', 'actor', (e) => e.amount), ctx) },
  {
    id: 'warden_steady', branch: 'warden', name: 'Steady', title: 'Steadfast',
    description: 'Win without dropping below 50% health.',
    check: (ctx) => flag(won(ctx) && lowestHp(ctx) * 2 >= maxHp(ctx), ctx),
  },
];
