import Phaser from 'phaser';
import { CARDS, Rng, SKILLS, START_STAMINA, rankOf, type CardPlay, type ClassId, type FightEvent, type FightLog, type HitKind } from '../core';
import { artImage, artManifest } from '../ui/art';
import { drawPet, drawWeapon, fighterAnimation, fighterFrames, type Pose } from '../ui/sprites';
import { PAL, num } from '../ui/theme';

/** Size of the arena in art pixels. Narrow and tall, so fighters look big on a phone. */
export const ARENA_W = 240;
export const ARENA_H = 210;
/** The canvas renders at this multiple of the pixel-art size, so text stays sharp. */
export const ARENA_ZOOM = 3;
/** Where the street starts (fighters stand on it). */
const GROUND_Y = 175;
/** Sprites are drawn this many times bigger than their PNG (3 matches the rest of the game). */
const SCALE = 3;
/** Main fighters stand this far from each side. */
const MAIN_X = 82;
const FONT = '"Shantell Sans Variable", sans-serif';
/** Arena text looks like the "sticker" title style: dark outline, offset shadow. */
const STICKER = { fontFamily: FONT, fontStyle: 'bold', stroke: PAL.black, resolution: ARENA_ZOOM };
/** How long each idle (breathing) frame stays on screen (ms). */
const IDLE_FRAME_MS = 450;
/** Freeze on every landed hit, so it feels heavy (ms). */
const HIT_STOP = 60;
/** Hits taking at least this share of max health shake the screen. */
const BIG_HIT = 0.12;

export type BreakEvent = Extract<FightEvent, { t: 'break' }>;

/** Where each main fighter stands when a break starts. */
export interface FighterState {
  name: string;
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  mana: number;
  maxMana: number;
}

interface UnitView {
  sprite: Phaser.GameObjects.Image;
  homeX: number;
  homeY: number;
  /** 1 faces right (team 0), -1 faces left (team 1). */
  dir: 1 | -1;
  team: 0 | 1;
  name: string;
  isMain: boolean;
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  mana: number;
  maxMana: number;
  bar: Phaser.GameObjects.Graphics;
  ring: Phaser.GameObjects.Graphics;
  weapon: Phaser.GameObjects.Image | null;
  /** Texture key of every animation frame (just one for pets and placeholder art). */
  frames: string[];
  pose: Pose;
  knockedOut: boolean;
}

const KIND_LABEL: Partial<Record<HitKind, string>> = { combo: 'COMBO', counter: 'COUNTER', double: 'x2' };

export interface ReplayHooks {
  /** Lets the player decide at a break and records it. */
  requestBreak: (event: BreakEvent, fighters: [FighterState, FighterState]) => Promise<void>;
  /** Re-runs the deterministic simulation with the inputs recorded so far. */
  resimulate: () => FightLog;
  onFinished: (log: FightLog) => void;
  /** A main fighter's health, stamina or mana changed (shown outside the canvas). */
  onFighter: (team: 0 | 1, state: FighterState) => void;
  /** A new round started. */
  onRound: (round: number) => void;
  /** Saves a card play; the scene re-simulates right after. */
  recordPlay: (play: CardPlay) => void;
  /** A main fighter's energy changed. */
  onEnergy: (team: 0 | 1, energy: number) => void;
  /** A main fighter played a card. */
  onCard: (team: 0 | 1, card: string) => void;
  /** The replay reached a new tick. */
  onTick: (tick: number) => void;
  /** A unit joined the fight (summoned) or left it (knocked out or vanished). */
  onUnitAlive: (idx: number, alive: boolean) => void;
}

/**
 * Plays a FightLog event by event. Has no game logic: when the log stops at a
 * player input, it asks for it and continues with the re-simulated log, whose
 * earlier events are identical.
 */
export class ReplayScene extends Phaser.Scene {
  private views: UnitView[] = [];
  private log: FightLog;
  /** A card the player tapped, applied at the next tick the replay reaches. */
  private queued: { card: string; getQuality?: () => Promise<number> } | null = null;

  constructor(
    initialLog: FightLog,
    private readonly hooks: ReplayHooks,
  ) {
    super('replay');
    this.log = initialLog;
  }

  queuePlay(card: string, getQuality?: () => Promise<number>): void {
    this.queued ??= { card, getQuality };
  }

  setSpeed(speed: number): void {
    this.tweens.timeScale = speed;
    this.time.timeScale = speed;
  }

  create(): void {
    this.cameras.main.setZoom(ARENA_ZOOM).centerOn(ARENA_W / 2, ARENA_H / 2);
    this.drawBackground();
    this.createUnits();
    // Breathing: idle fighters flip through their idle frames.
    let tick = 0;
    this.time.addEvent({
      delay: IDLE_FRAME_MS,
      loop: true,
      callback: () => {
        tick++;
        for (const v of this.views) if (v.pose === 'idle') this.setPose(v, 'idle', tick);
      },
    });
    void this.play();
  }

  private drawBackground(): void {
    const custom = artImage(artManifest().background);
    if (custom) {
      this.textures.addImage('background', custom);
      this.add.image(0, 0, 'background').setOrigin(0);
      return;
    }
    const g = this.add.graphics();
    g.fillStyle(num(PAL.wall)).fillRect(0, 0, ARENA_W, GROUND_Y);
    // City skyline, seeded by the fight so a replay always looks the same.
    const rng = new Rng(this.log.seed);
    for (let x = -10; x < ARENA_W; ) {
      const w = rng.int(24, 48);
      const top = rng.int(40, 120);
      g.fillStyle(num(PAL.night)).fillRect(x, top, w, GROUND_Y - top);
      g.fillStyle(num(PAL.amber));
      for (let wy = top + 6; wy < GROUND_Y - 14; wy += 9) {
        for (let wx = x + 4; wx < x + w - 4; wx += 7) if (rng.chance(25)) g.fillRect(wx, wy, 3, 4);
      }
      x += w + rng.int(2, 8);
    }
    g.fillStyle(num(PAL.asphalt)).fillRect(0, GROUND_Y, ARENA_W, ARENA_H - GROUND_Y);
    g.fillStyle(num(PAL.stone)).fillRect(0, GROUND_Y, ARENA_W, 3);
    g.fillStyle(num(PAL.stone));
    for (let x = 8; x < ARENA_W; x += 32) g.fillRect(x, GROUND_Y + 20, 16, 2);
  }

  private createUnits(): void {
    const sideCount: [number, number] = [0, 0];
    this.log.roster.forEach((info, idx) => {
      const dir: 1 | -1 = info.team === 0 ? 1 : -1;
      const canvases = info.isMain && info.appearance ? fighterFrames({ appearance: info.appearance, classId: info.defId as ClassId, originId: info.originId, level: info.level }) : [drawPet(info.defId)];
      const frames = canvases.map((canvas, f) => {
        const key = `unit-${idx}-${f}`;
        this.textures.addCanvas(key, canvas);
        return key;
      });
      const key = frames[0]!;

      let x: number;
      let y: number;
      if (info.isMain) {
        x = info.team === 0 ? MAIN_X : ARENA_W - MAIN_X;
        y = GROUND_Y + 2;
      } else {
        const k = sideCount[info.team]++;
        x = info.team === 0 ? MAIN_X - 34 - k * 22 : ARENA_W - MAIN_X + 34 + k * 22;
        y = GROUND_Y + 12 + (k % 2) * 6;
      }
      const sprite = this.add.image(x, y, key).setOrigin(0.5, 1).setScale(SCALE).setFlipX(dir === -1).setDepth(y);
      if (info.summoned) sprite.setAlpha(0);
      // Legend rank: a soft gold aura (WebGL only; the canvas renderer has no FX).
      if (info.isMain && rankOf(info.level ?? 1).id === 'legend') sprite.preFX?.addGlow(num(PAL.yellow), 2, 0, false, 0.1, 6);

      const view: UnitView = {
        sprite,
        homeX: x,
        homeY: y,
        dir,
        team: info.team === 0 ? 0 : 1,
        name: info.name,
        isMain: info.isMain,
        hp: info.summoned ? 0 : info.maxHp,
        maxHp: info.maxHp,
        // Fighters start below full stamina; the first 'res' event confirms the exact value.
        stamina: Math.min(START_STAMINA, info.maxStamina),
        maxStamina: info.maxStamina,
        mana: info.maxMana,
        maxMana: info.maxMana,
        bar: this.add.graphics().setDepth(1000),
        ring: this.add.graphics().setDepth(y + 2),
        weapon: null,
        frames,
        pose: 'idle',
        knockedOut: false,
      };
      this.views.push(view);
      this.drawBars(view);
    });
  }

  /** Pets get a small health bar over their head; main fighters are shown outside the canvas. */
  private drawBars(v: UnitView): void {
    if (v.isMain) {
      this.hooks.onFighter(v.team, this.stateOf(v));
      return;
    }
    const g = v.bar.clear();
    if (v.hp <= 0) return;
    const bx = v.homeX - 10;
    const by = v.homeY - v.sprite.displayHeight - 6;
    g.fillStyle(num(PAL.black)).fillRect(bx - 1, by - 1, 22, 4);
    g.fillStyle(num(PAL.green)).fillRect(bx, by, Math.round((20 * v.hp) / v.maxHp), 2);
  }

  private stateOf(v: UnitView): FighterState {
    return { name: v.name, hp: v.hp, maxHp: v.maxHp, stamina: v.stamina, maxStamina: v.maxStamina, mana: v.mana, maxMana: v.maxMana };
  }

  /** Shows a fighter's frame for a pose; `step` picks which frame of it (it wraps around). */
  private setPose(v: UnitView, pose: Pose, step = 0): void {
    if (v.knockedOut) return;
    v.pose = pose;
    if (v.frames.length <= 1) return;
    const list = fighterAnimation(pose);
    v.sprite.setTexture(v.frames[list[step % list.length]!] ?? v.frames[0]!);
  }

  private drawWard(v: UnitView, amount: number): void {
    v.ring.clear();
    if (amount <= 0) return;
    v.ring.lineStyle(1.5, num(PAL.cyan), 0.9).strokeEllipse(v.homeX, v.homeY - v.sprite.displayHeight / 2, 17 * SCALE, v.sprite.displayHeight + 10);
  }

  private view(idx: number): UnitView {
    return this.views[idx]!;
  }

  private snapshot(team: 0 | 1): FighterState {
    return this.stateOf(this.views.find((u) => u.isMain && u.team === team)!);
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => this.time.delayedCall(ms, resolve));
  }

  private tween(config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return new Promise((resolve) => this.tweens.add({ ...config, onComplete: () => resolve() }));
  }

  private floatText(x: number, y: number, text: string, color: string, size = 10): void {
    const t = this.add
      .text(x, y, text, { ...STICKER, fontSize: `${size}px`, color, strokeThickness: 4 })
      .setShadow(1, 1, PAL.black, 0, true, true)
      .setOrigin(0.5)
      .setDepth(2000);
    this.tweens.add({ targets: t, y: y - 18, alpha: 0, duration: 750, ease: 'Quad.easeOut', onComplete: () => t.destroy() });
  }

  private async banner(text: string, color: string, ms: number): Promise<void> {
    const label = this.add
      .text(ARENA_W / 2, ARENA_H * 0.4, text, { ...STICKER, fontSize: '22px', color, strokeThickness: 6 })
      .setShadow(2, 2, PAL.pink, 0, true, true)
      .setOrigin(0.5)
      .setAngle(-3)
      .setDepth(3001);
    // Slapped on like a sticker.
    this.tweens.add({ targets: label, scale: { from: 1.5, to: 1 }, duration: 220, ease: 'Back.easeOut' });
    await this.wait(ms);
    label.destroy();
  }

  /** A few puffs of dust at someone's feet. */
  private dust(x: number, y: number): void {
    for (const side of [-1, 1]) {
      const puff = this.add.circle(x + side * 4, y - 1, 2.5, num(PAL.mist), 0.8).setDepth(y + 1);
      this.tweens.add({ targets: puff, x: x + side * 14, y: y - 5, scale: 1.8, alpha: 0, duration: 320, ease: 'Quad.easeOut', onComplete: () => puff.destroy() });
    }
  }

  private headY(v: UnitView): number {
    return v.sprite.y - v.sprite.displayHeight - 4;
  }

  private placeWeapon(v: UnitView): void {
    if (!v.weapon) return;
    v.weapon.setPosition(v.sprite.x + v.dir * 6 * SCALE, v.sprite.y - 11 * SCALE).setDepth(v.sprite.depth + 1);
  }

  private async play(): Promise<void> {
    await this.wait(400);
    for (let i = 0; i < this.log.events.length; i++) {
      let e = this.log.events[i]!;
      if (e.t === 'break' && e.choices[0] === null) {
        await this.hooks.requestBreak(e, [this.snapshot(0), this.snapshot(1)]);
        this.log = this.hooks.resimulate();
        e = this.log.events[i]!;
      }
      if (e.t === 'tick' && this.queued) {
        const { card, getQuality } = this.queued;
        this.queued = null;
        const quality = getQuality ? await getQuality() : undefined;
        this.hooks.recordPlay({ tick: e.n, card, quality });
        this.log = this.hooks.resimulate();
        e = this.log.events[i]!;
      }
      await this.handle(e, i);
    }
    await this.wait(400);
    const won = this.log.winner === 0;
    // Back to normal speed, so the result banner stays up even after Skip.
    this.setSpeed(1);
    void this.banner(won ? 'VICTORY' : 'DEFEAT', won ? PAL.yellow : PAL.coral, 60_000);
    this.hooks.onFinished(this.log);
  }

  private teamOf(idx: number): 0 | 1 {
    return this.views[idx]!.team;
  }

  /** True when this fighter's special strike really hit: its attack follows in the same tick. */
  private specialLanded(from: number, actor: number): boolean {
    for (let j = from + 1; j < this.log.events.length; j++) {
      const next = this.log.events[j]!;
      if (next.t === 'tick') return false;
      if ((next.t === 'hit' || next.t === 'block' || next.t === 'dodge') && next.kind === 'special' && next.actor === actor) return true;
    }
    return false;
  }

  private handle(e: FightEvent, index: number): Promise<void> {
    switch (e.t) {
      case 'round':
        this.hooks.onRound(e.round);
        return this.banner(`Round ${e.round}`, PAL.paper, 700);
      case 'break':
        return this.wait(200);
      case 'draw':
        return this.onDraw(e.actor, e.weapon);
      case 'hit':
      case 'block':
        return this.onStrike(e.actor, e.target, e.kind, e.damage, e.hp, e.t === 'block');
      case 'dodge':
        return this.onDodge(e.actor, e.target, e.kind);
      case 'miss':
        return this.onMiss(e.actor);
      case 'disarm':
        return this.onDisarm(e.target);
      case 'heal':
        return this.onHeal(e.actor, e.amount, e.hp);
      case 'cast':
        return this.onCast(e.actor, e.spell, e.target);
      case 'ward':
        return this.onWard(e.actor, e.absorbed, e.left);
      case 'summon':
        this.hooks.onUnitAlive(e.actor, true);
        return this.onSummon(e.actor, e.hp);
      case 'unsummon':
        this.hooks.onUnitAlive(e.actor, false);
        return this.onUnsummon(e.actor);
      case 'rest':
        return this.onRest(e.actor);
      case 'res':
        return this.onResources(e.actor, e.stamina, e.mana);
      case 'tick':
        this.hooks.onTick(e.n);
        return Promise.resolve();
      case 'energy':
        this.hooks.onEnergy(this.teamOf(e.actor), e.energy);
        return Promise.resolve();
      case 'card':
        return this.onCard(e.actor, e.card);
      case 'special':
        return this.onSpecial(e.actor, e.quality, this.specialLanded(index, e.actor));
      case 'scrap':
        return this.onScrap(e.actor, e.absorbed);
      case 'poison':
        return this.onPoison(e.actor, e.damage, e.hp);
      case 'stunned':
        return this.onStunned(e.actor);
      case 'death':
        this.hooks.onUnitAlive(e.actor, false);
        return this.onDeath(e.actor);
    }
  }

  private async onResources(actor: number, stamina: number, mana: number): Promise<void> {
    const v = this.view(actor);
    v.stamina = stamina;
    v.mana = mana;
    this.drawBars(v);
  }

  private async onCard(actor: number, card: string): Promise<void> {
    const v = this.view(actor);
    this.hooks.onCard(v.team, card);
    this.floatText(v.sprite.x, this.headY(v) - 10, CARDS[card]?.name ?? card, PAL.yellow, 12);
    await this.wait(250);
  }

  /** Too weak a timing or a too tired fighter: the special does not land and a normal turn follows. */
  private async onSpecial(actor: number, quality: number, landed: boolean): Promise<void> {
    const v = this.view(actor);
    const [text, color] = !landed ? ['MISSED', PAL.fog] : quality >= 90 ? ['PERFECT!', PAL.yellow] : ['SPECIAL!', PAL.orange];
    this.floatText(v.sprite.x, this.headY(v) - 8, text, color);
    if (landed) {
      this.cameras.main.flash(120, 255, 220, 120);
      await this.tween({ targets: v.sprite, scaleX: SCALE * 1.15, scaleY: SCALE * 1.15, duration: 120, yoyo: true });
    } else {
      await this.wait(250);
    }
  }

  private async onDraw(actor: number, weaponId: string): Promise<void> {
    const v = this.view(actor);
    v.weapon?.destroy();
    const key = `weapon-${weaponId}`;
    if (!this.textures.exists(key)) this.textures.addCanvas(key, drawWeapon(weaponId));
    v.weapon = this.add.image(0, 0, key).setScale(SCALE).setFlipX(v.dir === -1).setAngle(-35 * v.dir);
    this.placeWeapon(v);
    v.weapon.setAlpha(0);
    await this.tween({ targets: v.weapon, alpha: 1, duration: 200 });
    await this.wait(150);
  }

  /** Moves the attacker next to the target, runs `impact`, then walks back. */
  private async melee(att: UnitView, def: UnitView, fast: boolean, impact: () => Promise<void>): Promise<void> {
    const duration = fast ? 90 : 150;
    const targetX = def.sprite.x - att.dir * (att.isMain ? 13 : 9) * SCALE;
    this.setPose(att, 'attack', 0);
    await this.tween({ targets: att.sprite, x: targetX, duration, ease: 'Quad.easeIn', onUpdate: () => this.placeWeapon(att) });
    this.setPose(att, 'attack', 1);
    if (att.weapon) {
      const swing = this.tween({ targets: att.weapon, angle: 60 * att.dir, duration: 80, yoyo: true });
      await impact();
      await swing;
    } else {
      await impact();
    }
    await this.tween({ targets: att.sprite, x: att.homeX, duration, ease: 'Quad.easeOut', onUpdate: () => this.placeWeapon(att) });
    this.setPose(att, 'idle');
  }

  private async throwAt(att: UnitView, def: UnitView, impact: () => Promise<void>): Promise<void> {
    const projectile = att.weapon;
    att.weapon = null;
    this.setPose(att, 'attack', 1);
    if (projectile) {
      await this.tween({ targets: projectile, x: def.sprite.x, y: def.sprite.y - 10 * SCALE, angle: 720 * att.dir, duration: 280 });
      projectile.destroy();
    }
    await impact();
    this.setPose(att, 'idle');
  }

  /** A glowing orb from the caster to the target (or past it, on a dodge). */
  private async orb(att: UnitView, def: UnitView, past: boolean, impact: () => Promise<void>): Promise<void> {
    this.setPose(att, 'attack', 1);
    const orb = this.add.circle(att.sprite.x + att.dir * 5 * SCALE, att.sprite.y - 13 * SCALE, 4, num(PAL.purple)).setStrokeStyle(1, num(PAL.lilac)).setDepth(1500);
    await this.tween({ targets: orb, x: def.sprite.x + (past ? def.dir * -30 : 0), y: def.sprite.y - 11 * SCALE, duration: 260, ease: 'Sine.easeIn' });
    orb.destroy();
    this.setPose(att, 'idle');
    await impact();
  }

  private async impactHit(def: UnitView, damage: number, hp: number, blocked: boolean, magic: boolean): Promise<void> {
    def.sprite.setTintFill(blocked ? num(PAL.sky) : magic ? num(PAL.lilac) : num(PAL.white));
    const color = blocked ? PAL.sky : magic ? PAL.lilac : PAL.coral;
    if (damage > 0) this.floatText(def.sprite.x, this.headY(def), blocked ? `BLOCK ${damage}` : `-${damage}`, color, blocked ? 10 : 13);
    def.hp = hp;
    this.drawBars(def);
    // Hit-stop: everything freezes for a moment on a landed hit; big hits also shake the screen.
    if (damage > 0 && !blocked) {
      this.setPose(def, 'hurt');
      if (damage >= def.maxHp * BIG_HIT) this.cameras.main.shake(140, 0.012);
      await this.wait(HIT_STOP);
    }
    await this.tween({ targets: def.sprite, x: def.sprite.x - def.dir * 4, duration: 50, yoyo: true });
    def.sprite.clearTint();
    if (def.pose === 'hurt') this.wait(140).then(() => def.pose === 'hurt' && this.setPose(def, 'idle'));
  }

  private async onStrike(actor: number, target: number, kind: HitKind, damage: number, hp: number, blocked: boolean): Promise<void> {
    const att = this.view(actor);
    const def = this.view(target);
    const label = KIND_LABEL[kind];
    if (label) this.floatText(att.sprite.x, this.headY(att), label, PAL.yellow);
    const impact = () => this.impactHit(def, damage, hp, blocked, kind === 'spell');
    if (kind === 'spell') await this.orb(att, def, false, impact);
    else if (kind === 'throw') await this.throwAt(att, def, impact);
    else await this.melee(att, def, kind === 'combo' || kind === 'double', impact);
  }

  private async onDodge(actor: number, target: number, kind: HitKind): Promise<void> {
    const att = this.view(actor);
    const def = this.view(target);
    const hop = async () => {
      this.floatText(def.sprite.x, this.headY(def), 'DODGE', PAL.white);
      this.dust(def.homeX, def.homeY);
      await this.tween({ targets: def.sprite, x: def.homeX - def.dir * 14, y: def.homeY - 8, duration: 100, yoyo: true, onUpdate: () => this.placeWeapon(def) });
      this.dust(def.homeX, def.homeY);
    };
    if (kind === 'spell') await this.orb(att, def, true, hop);
    else if (kind === 'throw') await this.throwAt(att, def, hop);
    else await this.melee(att, def, kind === 'combo' || kind === 'double', hop);
  }

  private async onMiss(actor: number): Promise<void> {
    const v = this.view(actor);
    this.floatText(v.sprite.x, this.headY(v), 'BLINDED', PAL.paper);
    await this.tween({ targets: v.sprite, x: v.homeX + v.dir * 6, duration: 120, yoyo: true });
  }

  private async onCast(actor: number, spell: string, target: number | null): Promise<void> {
    const v = this.view(actor);
    this.floatText(v.sprite.x, this.headY(v) - 6, SKILLS[spell]?.name ?? CARDS[spell]?.name ?? spell, PAL.lilac);
    v.sprite.setTint(num(PAL.lilac));
    await this.tween({ targets: v.sprite, y: v.homeY - 4, duration: 120, yoyo: true });
    v.sprite.clearTint();
    if (spell === 'flash' && target !== null) {
      const t = this.view(target);
      this.cameras.main.flash(90, 255, 255, 255);
      t.sprite.setTintFill(num(PAL.white));
      await this.wait(160);
      t.sprite.clearTint();
    }
  }

  private async onWard(actor: number, absorbed: number, left: number): Promise<void> {
    const v = this.view(actor);
    this.drawWard(v, left);
    if (absorbed === 0) this.floatText(v.sprite.x, this.headY(v), 'WARD', PAL.cyan);
    else this.floatText(v.sprite.x + 10, this.headY(v) + 8, `-${absorbed}`, PAL.cyan);
    await this.wait(absorbed === 0 ? 250 : 120);
  }

  /** Scrap Shield: raised (absorbed is 0) or soaking up a hit. */
  private async onScrap(actor: number, absorbed: number): Promise<void> {
    const v = this.view(actor);
    if (absorbed === 0) this.floatText(v.sprite.x, this.headY(v), 'SCRAP SHIELD', PAL.orange);
    else this.floatText(v.sprite.x + 10, this.headY(v) + 8, `-${absorbed}`, PAL.orange);
    await this.wait(absorbed === 0 ? 250 : 120);
  }

  /** Toxic Spit hurts at the start of the poisoned fighter's turn. */
  private async onPoison(actor: number, damage: number, hp: number): Promise<void> {
    const v = this.view(actor);
    v.sprite.setTint(num(PAL.lime));
    this.floatText(v.sprite.x, this.headY(v), `-${damage}`, PAL.lime);
    v.hp = hp;
    this.drawBars(v);
    await this.wait(350);
    v.sprite.clearTint();
  }

  /** Power Surge: the fighter loses this turn. */
  private async onStunned(actor: number): Promise<void> {
    const v = this.view(actor);
    this.floatText(v.sprite.x, this.headY(v), 'STUNNED', PAL.yellow);
    await this.tween({ targets: v.sprite, x: v.homeX + v.dir * 6, duration: 120, yoyo: true });
  }

  private async onSummon(actor: number, hp: number): Promise<void> {
    const v = this.view(actor);
    v.hp = hp;
    v.sprite.setPosition(v.homeX, v.homeY).setAngle(0).clearTint();
    // A spirit is see-through; the Stray Dog is a real dog.
    const dog = this.log.roster[actor]!.defId === 'dog';
    this.floatText(v.homeX, this.headY(v), dog ? 'STRAY DOG!' : 'SPIRIT!', PAL.ice);
    await this.tween({ targets: v.sprite, alpha: dog ? 1 : 0.85, duration: 300 });
    this.drawBars(v);
  }

  private async onUnsummon(actor: number): Promise<void> {
    const v = this.view(actor);
    v.hp = 0;
    this.drawBars(v);
    await this.tween({ targets: v.sprite, alpha: 0, y: v.homeY - 10, duration: 300 });
    v.sprite.setY(v.homeY);
  }

  private async onRest(actor: number): Promise<void> {
    const v = this.view(actor);
    this.floatText(v.sprite.x, this.headY(v), 'catching breath', PAL.mist);
    await this.tween({ targets: v.sprite, scaleY: SCALE * 0.92, duration: 200, yoyo: true });
  }

  private async onDisarm(target: number): Promise<void> {
    const v = this.view(target);
    const weapon = v.weapon;
    v.weapon = null;
    if (!weapon) return;
    this.floatText(v.sprite.x, this.headY(v), 'DISARMED', PAL.orange);
    await this.tween({ targets: weapon, y: GROUND_Y + 8, x: weapon.x - v.dir * 20, angle: 180, alpha: 0, duration: 350 });
    weapon.destroy();
  }

  private async onHeal(actor: number, amount: number, hp: number): Promise<void> {
    const v = this.view(actor);
    v.sprite.setTint(num(PAL.lime));
    this.floatText(v.sprite.x, this.headY(v), `+${amount}`, PAL.lime);
    v.hp = hp;
    this.drawBars(v);
    await this.wait(350);
    v.sprite.clearTint();
  }

  private async onDeath(actor: number): Promise<void> {
    const v = this.view(actor);
    v.hp = 0;
    this.drawBars(v);
    this.drawWard(v, 0);
    v.weapon?.destroy();
    v.weapon = null;
    v.sprite.setTint(num(PAL.smoke));
    this.setPose(v, 'hurt');
    v.knockedOut = true;
    if (v.isMain) {
      // Knock-out: one heavy fall, a small bump on landing and a light shake.
      v.sprite.setOrigin(0.5, 0.9);
      await this.tween({ targets: v.sprite, angle: -90 * v.dir, duration: 450, ease: 'Quad.easeIn' });
      this.cameras.main.shake(150, 0.006);
      this.dust(v.sprite.x, v.homeY);
      await this.tween({ targets: v.sprite, angle: -84 * v.dir, duration: 90, yoyo: true, ease: 'Quad.easeOut' });
    } else {
      await this.tween({ targets: v.sprite, alpha: 0, y: v.sprite.y + 4, duration: 350 });
    }
  }
}
