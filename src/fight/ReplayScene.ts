import Phaser from 'phaser';
import { Rng, SKILLS, SPECIAL_MIN_QUALITY, type ClassId, type FightEvent, type FightLog, type HitKind } from '../core';
import { artImage, artManifest } from '../ui/art';
import { drawFighter, drawPet, drawWeapon } from '../ui/sprites';

export const ARENA_W = 320;
export const ARENA_H = 200;
/** The canvas renders at this multiple of the pixel-art size, so text stays sharp. */
export const ARENA_ZOOM = 3;
const GROUND_Y = 165;
const SCALE = 2;
const FONT = '"Shantell Sans Variable", sans-serif';
const BAR_W = 140;

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
}

const KIND_LABEL: Partial<Record<HitKind, string>> = { combo: 'COMBO', counter: 'COUNTER', double: 'x2' };

export interface ReplayHooks {
  /** Lets the player perform a special strike and records it. */
  requestSpecial: () => Promise<void>;
  /** Lets the player decide at a break and records it. */
  requestBreak: (event: BreakEvent, fighters: [FighterState, FighterState]) => Promise<void>;
  /** Re-runs the deterministic simulation with the inputs recorded so far. */
  resimulate: () => FightLog;
  onFinished: (log: FightLog) => void;
}

/**
 * Plays a FightLog event by event. Has no game logic: when the log stops at a
 * player input, it asks for it and continues with the re-simulated log, whose
 * earlier events are identical.
 */
export class ReplayScene extends Phaser.Scene {
  private views: UnitView[] = [];
  private log: FightLog;

  constructor(
    initialLog: FightLog,
    private readonly hooks: ReplayHooks,
  ) {
    super('replay');
    this.log = initialLog;
  }

  setSpeed(speed: number): void {
    this.tweens.timeScale = speed;
    this.time.timeScale = speed;
  }

  create(): void {
    this.cameras.main.setZoom(ARENA_ZOOM).centerOn(ARENA_W / 2, ARENA_H / 2);
    this.drawBackground();
    this.createUnits();
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
    g.fillStyle(0x222634).fillRect(0, 0, ARENA_W, GROUND_Y);
    // City skyline, seeded by the fight so a replay always looks the same.
    const rng = new Rng(this.log.seed);
    for (let x = -10; x < ARENA_W; ) {
      const w = rng.int(24, 48);
      const top = rng.int(48, 110);
      g.fillStyle(0x15171f).fillRect(x, top, w, GROUND_Y - top);
      g.fillStyle(0xffb347);
      for (let wy = top + 6; wy < GROUND_Y - 14; wy += 9) {
        for (let wx = x + 4; wx < x + w - 4; wx += 7) if (rng.chance(25)) g.fillRect(wx, wy, 3, 4);
      }
      x += w + rng.int(2, 8);
    }
    g.fillStyle(0x30333f).fillRect(0, GROUND_Y, ARENA_W, ARENA_H - GROUND_Y);
    g.fillStyle(0x4b4f5e).fillRect(0, GROUND_Y, ARENA_W, 3);
    g.fillStyle(0x5c6070);
    for (let x = 8; x < ARENA_W; x += 32) g.fillRect(x, GROUND_Y + 20, 16, 2);
  }

  private createUnits(): void {
    const sideCount: [number, number] = [0, 0];
    this.log.roster.forEach((info, idx) => {
      const dir: 1 | -1 = info.team === 0 ? 1 : -1;
      const key = `unit-${idx}`;
      const canvas = info.isMain && info.appearance ? drawFighter(info.appearance, info.defId as ClassId) : drawPet(info.defId);
      this.textures.addCanvas(key, canvas);

      let x: number;
      let y: number;
      if (info.isMain) {
        x = info.team === 0 ? 105 : ARENA_W - 105;
        y = GROUND_Y + 2;
      } else {
        const k = sideCount[info.team]++;
        x = info.team === 0 ? 65 - k * 26 : ARENA_W - 65 + k * 26;
        y = GROUND_Y + 12 + (k % 2) * 6;
      }
      const sprite = this.add.image(x, y, key).setOrigin(0.5, 1).setScale(SCALE).setFlipX(dir === -1).setDepth(y);
      if (info.summoned) sprite.setAlpha(0);

      const view: UnitView = {
        sprite,
        homeX: x,
        homeY: y,
        dir,
        name: info.name,
        isMain: info.isMain,
        hp: info.summoned ? 0 : info.maxHp,
        maxHp: info.maxHp,
        stamina: info.maxStamina,
        maxStamina: info.maxStamina,
        mana: info.maxMana,
        maxMana: info.maxMana,
        bar: this.add.graphics().setDepth(1000),
        ring: this.add.graphics().setDepth(y + 2),
        weapon: null,
      };
      this.views.push(view);
      this.drawBars(view);

      if (info.isMain) {
        this.add
          .text(info.team === 0 ? 8 : ARENA_W - 8, 3, info.name, { fontFamily: FONT, fontStyle: 'bold', fontSize: '10px', color: '#ffffff', resolution: ARENA_ZOOM })
          .setOrigin(info.team === 0 ? 0 : 1, 0)
          .setDepth(1000);
      }
    });
  }

  /** Health for everyone; stamina and mana under it for main fighters. */
  private drawBars(v: UnitView): void {
    const g = v.bar.clear();
    if (!v.isMain) {
      if (v.hp <= 0) return;
      const bx = v.homeX - 10;
      const by = v.homeY - v.sprite.displayHeight - 6;
      g.fillStyle(0x111111).fillRect(bx - 1, by - 1, 22, 4);
      g.fillStyle(0x22c55e).fillRect(bx, by, Math.round((20 * v.hp) / v.maxHp), 2);
      return;
    }
    const left = v.dir === 1;
    const bx = left ? 8 : ARENA_W - 8 - BAR_W;
    const meter = (y: number, h: number, value: number, max: number, color: number, back: number) => {
      const w = max > 0 ? Math.round((BAR_W * Math.max(0, value)) / max) : 0;
      g.fillStyle(0x111111).fillRect(bx - 1, y - 1, BAR_W + 2, h + 2);
      g.fillStyle(back).fillRect(bx, y, BAR_W, h);
      g.fillStyle(color).fillRect(left ? bx : bx + BAR_W - w, y, w, h);
    };
    meter(17, 6, v.hp, v.maxHp, 0x22c55e, 0x7f1d1d);
    meter(25, 2, v.stamina, v.maxStamina, v.stamina < 25 ? 0xff8a3d : 0x8bd450, 0x2a2f22);
    if (v.maxMana > 0) meter(29, 2, v.mana, v.maxMana, 0x5b8cff, 0x1c2340);
  }

  private drawWard(v: UnitView, amount: number): void {
    v.ring.clear();
    if (amount <= 0) return;
    v.ring.lineStyle(1.5, 0x7df9ff, 0.9).strokeEllipse(v.homeX, v.homeY - v.sprite.displayHeight / 2, 34, v.sprite.displayHeight + 10);
  }

  private view(idx: number): UnitView {
    return this.views[idx]!;
  }

  private snapshot(team: 0 | 1): FighterState {
    const v = this.views.find((u, i) => u.isMain && this.log.roster[i]!.team === team)!;
    return { name: v.name, hp: v.hp, maxHp: v.maxHp, stamina: v.stamina, maxStamina: v.maxStamina, mana: v.mana, maxMana: v.maxMana };
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => this.time.delayedCall(ms, resolve));
  }

  private tween(config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return new Promise((resolve) => this.tweens.add({ ...config, onComplete: () => resolve() }));
  }

  private floatText(x: number, y: number, text: string, color: string): void {
    const t = this.add
      .text(x, y, text, { fontFamily: FONT, fontStyle: 'bold', fontSize: '10px', color, stroke: '#000000', strokeThickness: 3, resolution: ARENA_ZOOM })
      .setOrigin(0.5)
      .setDepth(2000);
    this.tweens.add({ targets: t, y: y - 18, alpha: 0, duration: 750, ease: 'Quad.easeOut', onComplete: () => t.destroy() });
  }

  private async banner(text: string, color: string, ms: number): Promise<void> {
    const box = this.add.rectangle(ARENA_W / 2, 90, ARENA_W, 30, 0x000000, 0.65).setDepth(3000);
    const label = this.add
      .text(ARENA_W / 2, 90, text, { fontFamily: FONT, fontStyle: 'bold', fontSize: '18px', color, resolution: ARENA_ZOOM })
      .setOrigin(0.5)
      .setDepth(3001);
    await this.wait(ms);
    box.destroy();
    label.destroy();
  }

  private headY(v: UnitView): number {
    return v.sprite.y - v.sprite.displayHeight - 4;
  }

  private placeWeapon(v: UnitView): void {
    if (!v.weapon) return;
    v.weapon.setPosition(v.sprite.x + v.dir * 12, v.sprite.y - 22).setDepth(v.sprite.depth + 1);
  }

  private async play(): Promise<void> {
    await this.wait(400);
    for (let i = 0; i < this.log.events.length; i++) {
      let e = this.log.events[i]!;
      if (e.t === 'special' && e.quality === null) {
        await this.hooks.requestSpecial();
        this.log = this.hooks.resimulate();
        e = this.log.events[i]!;
      } else if (e.t === 'break' && e.choices[0] === null) {
        await this.hooks.requestBreak(e, [this.snapshot(0), this.snapshot(1)]);
        this.log = this.hooks.resimulate();
        e = this.log.events[i]!;
      }
      await this.handle(e);
    }
    await this.wait(400);
    const won = this.log.winner === 0;
    void this.banner(won ? 'VICTORY' : 'DEFEAT', won ? '#ffd23f' : '#ff6b6b', 60_000);
    this.hooks.onFinished(this.log);
  }

  private handle(e: FightEvent): Promise<void> {
    switch (e.t) {
      case 'round':
        return this.banner(`Round ${e.round}`, '#efe8d8', 700);
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
        return this.onSummon(e.actor, e.hp);
      case 'unsummon':
        return this.onUnsummon(e.actor);
      case 'rest':
        return this.onRest(e.actor);
      case 'res':
        return this.onResources(e.actor, e.stamina, e.mana);
      case 'special':
        return this.onSpecial(e.actor, e.quality ?? 0);
      case 'death':
        return this.onDeath(e.actor);
    }
  }

  private async onResources(actor: number, stamina: number, mana: number): Promise<void> {
    const v = this.view(actor);
    v.stamina = stamina;
    v.mana = mana;
    this.drawBars(v);
  }

  private async onSpecial(actor: number, quality: number): Promise<void> {
    const v = this.view(actor);
    const [text, color] =
      quality >= 90 ? ['PERFECT!', '#ffd23f'] : quality >= SPECIAL_MIN_QUALITY ? ['SPECIAL!', '#fb923c'] : ['MISSED', '#9ca3af'];
    this.floatText(v.sprite.x, this.headY(v) - 8, text, color);
    if (quality >= SPECIAL_MIN_QUALITY) {
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
    const targetX = def.sprite.x - att.dir * (att.isMain ? 26 : 18);
    await this.tween({ targets: att.sprite, x: targetX, duration, ease: 'Quad.easeIn', onUpdate: () => this.placeWeapon(att) });
    if (att.weapon) {
      const swing = this.tween({ targets: att.weapon, angle: 60 * att.dir, duration: 80, yoyo: true });
      await impact();
      await swing;
    } else {
      await impact();
    }
    await this.tween({ targets: att.sprite, x: att.homeX, duration, ease: 'Quad.easeOut', onUpdate: () => this.placeWeapon(att) });
  }

  private async throwAt(att: UnitView, def: UnitView, impact: () => Promise<void>): Promise<void> {
    const projectile = att.weapon;
    att.weapon = null;
    if (!projectile) return impact();
    await this.tween({ targets: projectile, x: def.sprite.x, y: def.sprite.y - 20, angle: 720 * att.dir, duration: 280 });
    projectile.destroy();
    await impact();
  }

  /** A glowing orb from the caster to the target (or past it, on a dodge). */
  private async orb(att: UnitView, def: UnitView, past: boolean, impact: () => Promise<void>): Promise<void> {
    const orb = this.add.circle(att.sprite.x + att.dir * 10, att.sprite.y - 26, 4, 0xb388ff).setStrokeStyle(1, 0xf1e6ff).setDepth(1500);
    await this.tween({ targets: orb, x: def.sprite.x + (past ? def.dir * -30 : 0), y: def.sprite.y - 22, duration: 260, ease: 'Sine.easeIn' });
    orb.destroy();
    await impact();
  }

  private async impactHit(def: UnitView, damage: number, hp: number, blocked: boolean, magic: boolean): Promise<void> {
    def.sprite.setTintFill(blocked ? 0x93c5fd : magic ? 0xd9c2ff : 0xffffff);
    const color = blocked ? '#93c5fd' : magic ? '#d0b3ff' : '#ff6b6b';
    if (damage > 0) this.floatText(def.sprite.x, this.headY(def), blocked ? `BLOCK ${damage}` : `-${damage}`, color);
    def.hp = hp;
    this.drawBars(def);
    await this.tween({ targets: def.sprite, x: def.sprite.x - def.dir * 4, duration: 50, yoyo: true });
    def.sprite.clearTint();
  }

  private async onStrike(actor: number, target: number, kind: HitKind, damage: number, hp: number, blocked: boolean): Promise<void> {
    const att = this.view(actor);
    const def = this.view(target);
    const label = KIND_LABEL[kind];
    if (label) this.floatText(att.sprite.x, this.headY(att), label, '#ffd23f');
    const impact = () => this.impactHit(def, damage, hp, blocked, kind === 'spell');
    if (kind === 'spell') await this.orb(att, def, false, impact);
    else if (kind === 'throw') await this.throwAt(att, def, impact);
    else await this.melee(att, def, kind === 'combo' || kind === 'double', impact);
  }

  private async onDodge(actor: number, target: number, kind: HitKind): Promise<void> {
    const att = this.view(actor);
    const def = this.view(target);
    const hop = async () => {
      this.floatText(def.sprite.x, this.headY(def), 'DODGE', '#ffffff');
      await this.tween({ targets: def.sprite, x: def.homeX - def.dir * 14, y: def.homeY - 8, duration: 100, yoyo: true, onUpdate: () => this.placeWeapon(def) });
    };
    if (kind === 'spell') await this.orb(att, def, true, hop);
    else if (kind === 'throw') await this.throwAt(att, def, hop);
    else await this.melee(att, def, kind === 'combo' || kind === 'double', hop);
  }

  private async onMiss(actor: number): Promise<void> {
    const v = this.view(actor);
    this.floatText(v.sprite.x, this.headY(v), 'BLINDED', '#efe8d8');
    await this.tween({ targets: v.sprite, x: v.homeX + v.dir * 6, duration: 120, yoyo: true });
  }

  private async onCast(actor: number, spell: string, target: number | null): Promise<void> {
    const v = this.view(actor);
    this.floatText(v.sprite.x, this.headY(v) - 6, SKILLS[spell]?.name ?? spell, '#d0b3ff');
    v.sprite.setTint(0xd9c2ff);
    await this.tween({ targets: v.sprite, y: v.homeY - 4, duration: 120, yoyo: true });
    v.sprite.clearTint();
    if (spell === 'flash' && target !== null) {
      const t = this.view(target);
      this.cameras.main.flash(90, 255, 255, 255);
      t.sprite.setTintFill(0xffffff);
      await this.wait(160);
      t.sprite.clearTint();
    }
  }

  private async onWard(actor: number, absorbed: number, left: number): Promise<void> {
    const v = this.view(actor);
    this.drawWard(v, left);
    if (absorbed === 0) this.floatText(v.sprite.x, this.headY(v), 'WARD', '#7df9ff');
    else this.floatText(v.sprite.x + 10, this.headY(v) + 8, `-${absorbed}`, '#7df9ff');
    await this.wait(absorbed === 0 ? 250 : 120);
  }

  private async onSummon(actor: number, hp: number): Promise<void> {
    const v = this.view(actor);
    v.hp = hp;
    v.sprite.setPosition(v.homeX, v.homeY).setAngle(0).clearTint();
    this.floatText(v.homeX, this.headY(v), 'SPIRIT!', '#a5f3fc');
    await this.tween({ targets: v.sprite, alpha: 0.85, duration: 300 });
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
    this.floatText(v.sprite.x, this.headY(v), 'catching breath', '#c9c2d6');
    await this.tween({ targets: v.sprite, scaleY: SCALE * 0.92, duration: 200, yoyo: true });
  }

  private async onDisarm(target: number): Promise<void> {
    const v = this.view(target);
    const weapon = v.weapon;
    v.weapon = null;
    if (!weapon) return;
    this.floatText(v.sprite.x, this.headY(v), 'DISARMED', '#fb923c');
    await this.tween({ targets: weapon, y: GROUND_Y + 8, x: weapon.x - v.dir * 20, angle: 180, alpha: 0, duration: 350 });
    weapon.destroy();
  }

  private async onHeal(actor: number, amount: number, hp: number): Promise<void> {
    const v = this.view(actor);
    v.sprite.setTint(0x86efac);
    this.floatText(v.sprite.x, this.headY(v), `+${amount}`, '#4ade80');
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
    v.sprite.setTint(0x777777);
    if (v.isMain) {
      v.sprite.setOrigin(0.5, 0.9);
      await this.tween({ targets: v.sprite, angle: -90 * v.dir, duration: 400, ease: 'Bounce.easeOut' });
    } else {
      await this.tween({ targets: v.sprite, alpha: 0, y: v.sprite.y + 4, duration: 350 });
    }
  }
}
