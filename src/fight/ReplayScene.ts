import Phaser from 'phaser';
import { Rng, SPECIAL_MIN_QUALITY, type ClassId, type FightEvent, type FightLog, type HitKind } from '../core';
import { artImage, artManifest } from '../ui/art';
import { drawFighter, drawPet, drawWeapon } from '../ui/sprites';

export const ARENA_W = 320;
export const ARENA_H = 200;
const GROUND_Y = 165;
const SCALE = 2;
const FONT = '"Press Start 2P", monospace';

interface UnitView {
  sprite: Phaser.GameObjects.Image;
  homeX: number;
  homeY: number;
  /** 1 faces right (team 0), -1 faces left (team 1). */
  dir: 1 | -1;
  maxHp: number;
  isMain: boolean;
  bar: Phaser.GameObjects.Graphics;
  drawBar: (hp: number) => void;
  weapon: Phaser.GameObjects.Image | null;
}

const KIND_LABEL: Partial<Record<HitKind, string>> = { combo: 'COMBO', counter: 'COUNTER', double: 'x2' };

export interface ReplayHooks {
  /** Asks the player to perform a special strike; resolves with its timing quality (0-100). */
  requestSpecial: () => Promise<number>;
  /** Re-runs the deterministic simulation with the special inputs collected so far. */
  resimulate: (specials: number[]) => FightLog;
  onFinished: (log: FightLog, specials: number[]) => void;
}

/**
 * Plays a FightLog event by event. Has no game logic: when the log stops at a
 * special strike, it asks for the input and continues with the re-simulated log,
 * whose earlier events are identical.
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
      const top = rng.int(40, 110);
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
    const petCount: [number, number] = [0, 0];
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
        const k = petCount[info.team]++;
        x = info.team === 0 ? 65 - k * 26 : ARENA_W - 65 + k * 26;
        y = GROUND_Y + 12 + (k % 2) * 6;
      }
      const sprite = this.add.image(x, y, key).setOrigin(0.5, 1).setScale(SCALE).setFlipX(dir === -1).setDepth(y);

      const bar = this.add.graphics().setDepth(1000);
      const drawBar = info.isMain
        ? (hp: number) => {
            const bx = info.team === 0 ? 8 : ARENA_W - 8 - 140;
            bar.clear().fillStyle(0x111111).fillRect(bx - 1, 17, 142, 8);
            bar.fillStyle(0x7f1d1d).fillRect(bx, 18, 140, 6);
            bar.fillStyle(0x22c55e).fillRect(info.team === 0 ? bx : bx + 140 - Math.round((140 * hp) / info.maxHp), 18, Math.round((140 * hp) / info.maxHp), 6);
          }
        : (hp: number) => {
            const bx = x - 10;
            const by = y - sprite.displayHeight - 6;
            bar.clear().fillStyle(0x111111).fillRect(bx - 1, by - 1, 22, 4);
            bar.fillStyle(0x22c55e).fillRect(bx, by, Math.round((20 * hp) / info.maxHp), 2);
          };
      drawBar(info.maxHp);

      if (info.isMain) {
        this.add
          .text(info.team === 0 ? 8 : ARENA_W - 8, 6, info.name, { fontFamily: FONT, fontSize: '8px', color: '#ffffff' })
          .setOrigin(info.team === 0 ? 0 : 1, 0)
          .setDepth(1000);
      }
      this.views.push({ sprite, homeX: x, homeY: y, dir, maxHp: info.maxHp, isMain: info.isMain, bar, drawBar, weapon: null });
    });
  }

  private view(idx: number): UnitView {
    return this.views[idx]!;
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => this.time.delayedCall(ms, resolve));
  }

  private tween(config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return new Promise((resolve) => this.tweens.add({ ...config, onComplete: () => resolve() }));
  }

  private floatText(x: number, y: number, text: string, color: string): void {
    const t = this.add.text(x, y, text, { fontFamily: FONT, fontSize: '8px', color, stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5).setDepth(2000);
    this.tweens.add({ targets: t, y: y - 18, alpha: 0, duration: 700, ease: 'Quad.easeOut', onComplete: () => t.destroy() });
  }

  private headY(v: UnitView): number {
    return v.sprite.y - v.sprite.displayHeight - 4;
  }

  private placeWeapon(v: UnitView): void {
    if (!v.weapon) return;
    v.weapon.setPosition(v.sprite.x + v.dir * 12, v.sprite.y - 22).setDepth(v.sprite.depth + 1);
  }

  private async play(): Promise<void> {
    await this.wait(500);
    const specials: number[] = [];
    for (let i = 0; i < this.log.events.length; i++) {
      let e = this.log.events[i]!;
      if (e.t === 'special' && e.quality === null) {
        specials.push(await this.hooks.requestSpecial());
        this.log = this.hooks.resimulate(specials);
        e = this.log.events[i]!;
      }
      await this.handle(e);
    }
    await this.wait(400);
    this.showBanner();
    this.hooks.onFinished(this.log, specials);
  }

  private handle(e: FightEvent): Promise<void> {
    switch (e.t) {
      case 'draw':
        return this.onDraw(e.actor, e.weapon);
      case 'hit':
      case 'block':
        return this.onStrike(e.actor, e.target, e.kind, e.damage, e.hp, e.t === 'block');
      case 'dodge':
        return this.onDodge(e.actor, e.target, e.kind);
      case 'disarm':
        return this.onDisarm(e.target);
      case 'heal':
        return this.onHeal(e.actor, e.amount, e.hp);
      case 'special':
        return this.onSpecial(e.actor, e.quality ?? 0);
      case 'death':
        return this.onDeath(e.actor);
    }
  }

  private async onSpecial(actor: number, quality: number): Promise<void> {
    const v = this.view(actor);
    const [text, color] =
      quality >= 90 ? ['PERFECT!', '#facc15'] : quality >= SPECIAL_MIN_QUALITY ? ['SPECIAL!', '#fb923c'] : ['MISSED', '#9ca3af'];
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

  private async impactHit(def: UnitView, damage: number, hp: number, blocked: boolean): Promise<void> {
    def.sprite.setTintFill(blocked ? 0x93c5fd : 0xffffff);
    this.floatText(def.sprite.x, this.headY(def), blocked ? `BLOCK ${damage}` : `-${damage}`, blocked ? '#93c5fd' : '#f87171');
    def.drawBar(hp);
    await this.tween({ targets: def.sprite, x: def.sprite.x - def.dir * 4, duration: 50, yoyo: true });
    def.sprite.clearTint();
  }

  private async onStrike(actor: number, target: number, kind: HitKind, damage: number, hp: number, blocked: boolean): Promise<void> {
    const att = this.view(actor);
    const def = this.view(target);
    const label = KIND_LABEL[kind];
    if (label) this.floatText(att.sprite.x, this.headY(att), label, '#facc15');
    const impact = () => this.impactHit(def, damage, hp, blocked);
    if (kind === 'throw') await this.throwAt(att, def, impact);
    else await this.melee(att, def, kind === 'combo' || kind === 'double', impact);
  }

  private async onDodge(actor: number, target: number, kind: HitKind): Promise<void> {
    const att = this.view(actor);
    const def = this.view(target);
    const hop = async () => {
      this.floatText(def.sprite.x, this.headY(def), 'DODGE', '#ffffff');
      await this.tween({ targets: def.sprite, x: def.homeX - def.dir * 14, y: def.homeY - 8, duration: 100, yoyo: true, onUpdate: () => this.placeWeapon(def) });
    };
    if (kind === 'throw') await this.throwAt(att, def, hop);
    else await this.melee(att, def, kind === 'combo' || kind === 'double', hop);
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
    v.drawBar(hp);
    await this.wait(350);
    v.sprite.clearTint();
  }

  private async onDeath(actor: number): Promise<void> {
    const v = this.view(actor);
    v.drawBar(0);
    v.weapon?.destroy();
    v.weapon = null;
    v.sprite.setTint(0x777777);
    if (v.isMain) {
      v.sprite.setOrigin(0.5, 0.9);
      await this.tween({ targets: v.sprite, angle: -90 * v.dir, duration: 400, ease: 'Bounce.easeOut' });
    } else {
      v.bar.clear();
      await this.tween({ targets: v.sprite, alpha: 0, y: v.sprite.y + 4, duration: 350 });
    }
  }

  private showBanner(): void {
    const won = this.log.winner === 0;
    this.add.rectangle(ARENA_W / 2, 80, ARENA_W, 34, 0x000000, 0.7).setDepth(3000);
    this.add
      .text(ARENA_W / 2, 80, won ? 'VICTORY' : 'DEFEAT', { fontFamily: FONT, fontSize: '16px', color: won ? '#facc15' : '#f87171' })
      .setOrigin(0.5)
      .setDepth(3001);
  }
}
