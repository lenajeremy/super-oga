/* SUPER OGA - the World: tile map, collisions, block bumps, the people and things on the
 * road, and drawing. */
'use strict';

const SOLID = new Set(['#', 'B', '?', 'M', 'U', 'S', 'L', 'X', 'P', 'u']);
// Slow enough that a 480px backdrop covers the widest level without wrapping:
// 400 (view) + 4976 (camera travel on a 336-tile stage) * 0.015 = 475px used of 480.
const BACKDROP_PARALLAX = 0.015;
const CRATES = new Set(['?', 'M', 'U', 'S', 'L', 'h']);

// Stalls that come with a seller: [sheet, sprite, x offset where the seller stands].
const STALLS = {
  suya: ['people', 'suya_stand', 34],
  water: ['people', 'water_stand', 36],
  nurse: ['people', 'clinic', 28],
  mamaput: ['decor', 'mamaput', 42],
};

class World {
  constructor(game, levelIndex, fromCheckpoint = false) {
    this.game = game;
    this.def = LEVELS[levelIndex];
    this.theme = THEMES[this.def.theme];
    const map = this.def.map;
    this.rows = map.length;
    this.cols = map[0].length;
    this.width = this.cols * TILE;
    this.height = this.rows * TILE;
    this.tiles = [];
    this.coinsLeft = new Map();
    this.bumps = [];
    this.entities = [];
    this.particles = [];
    this.texts = [];
    this.triggers = [];
    this.decor = [];
    this.frame = 0;
    this.shake = 0;
    this.camera = { x: 0 };
    this.lookAhead = 0;
    this.checkpoint = null;
    this.goal = null;
    this.blackout = null;

    let start = { x: 2 * TILE, y: 11 * TILE };
    for (let ty = 0; ty < this.rows; ty++) {
      for (let tx = 0; tx < this.cols; tx++) {
        const ch = map[ty][tx];
        const px = tx * TILE;
        const py = ty * TILE;
        this.tiles.push('#BX?MUSLhP=~'.includes(ch) ? ch : '.');
        if (ch === 'M') this.coinsLeft.set(ty * this.cols + tx, 8);
        else if (ch === 'o') this.add(new Coin(this, px, py));
        else if (ch === '@') start = { x: px, y: py };
        else if (ch === 'C') this.checkpoint = this.add(new Checkpoint(this, px, py));
        else if (ch === 'F') this.goal = this.add(new Goal(this, px, py));
        else if (ch === 'r') this.add(new Rat(this, px, py));
        else if (ch === 'g') this.add(new Goat(this, px, py));
        else if (ch === 'm') this.add(new Mosquito(this, px, py));
        else if (ch === 'a') this.add(new Agbero(this, px, py));
        else if (ch === 'k') this.triggers.push({ x: px, y: py, kind: 'okada', dir: -1, fired: false });
        else if (ch === 'K') this.triggers.push({ x: px, y: py, kind: 'okada', dir: 1, fired: false });
        else if (ch === 'N') this.triggers.push({ x: px, y: py, kind: 'nepa', fired: false });
        else if (ch === '_') this.add(new Platform(this, px, py, 'canoe'));
        else if (ch === '|') this.add(new Platform(this, px, py, 'lift'));
        else if (ch === 'f') this.add(new Platform(this, px, py, 'raft'));
      }
    }

    if (fromCheckpoint && this.checkpoint) {
      this.checkpoint.active = true;
      start = { x: this.checkpoint.x, y: this.checkpoint.tileY };
    }
    this.player = new Player(this, start.x + 3, start.y + TILE);
    this.camera.x = clamp(this.player.x - VIEW_W * 0.4, 0, this.width - VIEW_W);

    for (const [tx, name, photo] of this.def.decor) {
      const { w, h } = Assets.size('decor', name);
      const ground = this.groundTop(tx + Math.floor(w / TILE / 2));
      if (ground !== null) this.decor.push({ x: tx * TILE, y: ground - h, w, sheet: 'decor', name, photo });
    }
    for (const [tx, kind] of this.def.npcs || []) this.spawnPerson(tx, kind);
    if (this.checkpoint) this.add(new Npc(this, this.checkpoint.x + 30, this.checkpoint.tileY + TILE, 'conductor'));
    if (this.goal && this.def.host) this.add(new Npc(this, this.goal.x + this.goal.w * 0.7, this.goal.bottom, this.def.host));

    this.buildings = [];
    let bx = 12;
    for (let i = 0; this.def.buildings.length && bx < this.width * 0.5 + VIEW_W; i++) {
      const name = this.def.buildings[i % this.def.buildings.length];
      const { w, h } = Assets.size('decor', name);
      this.buildings.push({ x: bx, w, h, name });
      bx += w + 20 + ((i * 37) % 44);
    }
  }

  spawnPerson(tx, kind) {
    const ground = this.groundTop(tx + 1);
    if (ground === null) return;
    const x = tx * TILE;
    if (kind === 'okadaman' || kind === 'kekeman') {
      const ride = this.add(new ParkedRide(this, x, ground, kind === 'kekeman' ? 'keke' : 'okada'));
      const owner = this.add(new Npc(this, ride.x + ride.w + 4, ground, kind));
      ride.owner = owner;
      owner.ride = ride;
      return;
    }
    let standAt = 20;
    if (STALLS[kind]) {
      const [sheet, name, offset] = STALLS[kind];
      const { w, h } = Assets.size(sheet, name);
      this.decor.push({ x, y: ground - h, w, sheet, name });
      standAt = offset;
    }
    this.add(new Npc(this, x + standAt, ground, kind));
  }

  add(entity) {
    this.entities.push(entity);
    return entity;
  }

  groundTop(tx) {
    for (let ty = 0; ty < this.rows; ty++) if (this.tileAt(tx, ty) === '#') return ty * TILE;
    return null;
  }

  tileAt(tx, ty) {
    if (tx < 0 || tx >= this.cols) return ty < 0 ? '.' : 'X';
    if (ty < 0 || ty >= this.rows) return '.';
    return this.tiles[ty * this.cols + tx];
  }

  setTile(tx, ty, ch) {
    this.tiles[ty * this.cols + tx] = ch;
  }

  isSolidTile(tx, ty) {
    return SOLID.has(this.tileAt(tx, ty));
  }

  solidAt(px, py) {
    return this.isSolidTile(Math.floor(px / TILE), Math.floor(py / TILE));
  }

  // Is there something solid directly under this entity's feet? Landing snaps the feet
  // exactly onto a tile boundary, and the next frame's gravity nudges them a fraction of
  // a pixel into it, so asking "did I just land?" flickers on and off. Probing the ground
  // instead gives a steady answer, which crouching, coyote time and ledge checks rely on.
  grounded(e) {
    const ty = Math.floor((e.y + e.h + 1) / TILE);
    const left = Math.floor(e.x / TILE);
    const right = Math.floor((e.x + e.w - 1) / TILE);
    for (let tx = left; tx <= right; tx++) {
      const ch = this.tileAt(tx, ty);
      if (SOLID.has(ch)) return true;
      if (ch === '=' && Math.abs(e.y + e.h - ty * TILE) < 2) return true;
    }
    return false;
  }

  // Horizontal move with tile collision. Returns 1 / -1 when blocked on that side.
  moveX(e, dx) {
    if (!dx) return 0;
    e.x += dx;
    const top = Math.floor(e.y / TILE);
    const bottom = Math.floor((e.y + e.h - 1) / TILE);
    const tx = Math.floor((dx > 0 ? e.x + e.w - 1 : e.x) / TILE);
    for (let ty = top; ty <= bottom; ty++) {
      if (!this.isSolidTile(tx, ty)) continue;
      e.x = dx > 0 ? tx * TILE - e.w : (tx + 1) * TILE;
      return dx > 0 ? 1 : -1;
    }
    return 0;
  }

  // Vertical move with tile collision. Returns 1 when landing, -1 when hitting a ceiling.
  moveY(e, dy) {
    if (!dy) return 0;
    const prevTop = e.y;
    const prevBottom = e.y + e.h;
    e.y += dy;
    const left = Math.floor(e.x / TILE);
    const right = Math.floor((e.x + e.w - 1) / TILE);
    if (dy > 0) {
      // The tile the feet are in, and whether they are actually inside it rather than
      // resting exactly on its top edge. Measuring from (bottom - 1) instead used to point
      // at the tile ABOVE once gravity nudged the feet a fraction of a pixel in - so a
      // plank stopped being seen the frame after you landed on it, vy was never cleared,
      // and you sank straight through the thing you were standing on.
      const ty = Math.floor((e.y + e.h) / TILE);
      if (e.y + e.h > ty * TILE) {
        for (let tx = left; tx <= right; tx++) {
          const ch = this.tileAt(tx, ty);
          if (SOLID.has(ch) || (ch === '=' && prevBottom <= ty * TILE && !e.dropping)) {
            e.y = ty * TILE - e.h;
            return 1;
          }
        }
      }
      return 0;
    }
    const ty = Math.floor(e.y / TILE);
    let hit = null;
    for (let tx = left; tx <= right; tx++) {
      const ch = this.tileAt(tx, ty);
      const hiddenCrate = ch === 'h' && e === this.player && prevTop >= (ty + 1) * TILE;
      if (!SOLID.has(ch) && !hiddenCrate) continue;
      const dist = Math.abs(tx * TILE + TILE / 2 - (e.x + e.w / 2));
      if (!hit || dist < hit.dist) hit = { tx, dist };
    }
    if (!hit) return 0;
    e.y = (ty + 1) * TILE;
    if (e === this.player) this.bump(hit.tx, ty);
    return -1;
  }

  // The player's head hit tile (tx, ty) from below.
  bump(tx, ty) {
    const ch = this.tileAt(tx, ty);
    const player = this.player;
    const px = tx * TILE;
    const py = ty * TILE;
    if (ch === 'B' && player.big) {
      this.setTile(tx, ty, '.');
      for (const [ox, oy, vx, vy] of [[0, 0, -1.3, -5.5], [8, 0, 1.3, -5.5], [0, 8, -1, -3.5], [8, 8, 1, -3.5]]) {
        this.particles.push(new Particle(px + ox, py + oy, { vx, vy, gravity: 0.3, life: 70, frames: ['debris'] }));
      }
      Sound.play('break');
      this.game.addScore(50);
      this.shake = 6;
    } else if (ch === 'B') {
      this.bumps.push({ tx, ty, t: 0 });
      Sound.play('bump');
    } else if (CRATES.has(ch)) {
      this.bumps.push({ tx, ty, t: 0 });
      if (ch === '?' || ch === 'M') {
        this.add(new CoinPop(this, px, py));
        const i = ty * this.cols + tx;
        const left = ch === 'M' ? this.coinsLeft.get(i) - 1 : 0;
        this.coinsLeft.set(i, left);
        if (left <= 0) this.setTile(tx, ty, 'u');
      } else {
        const kind = ch === 'U' ? (player.big ? 'water' : 'jollof') : ch === 'S' ? 'beads' : 'puffpuff';
        this.add(new PowerItem(this, px, py, kind));
        this.setTile(tx, ty, 'u');
        Sound.play('appear');
        if (ch === 'h') this.float('AWOOF!', px + 8, py - 8, '#ffcd3a');
      }
    } else {
      Sound.play('bump');
      return;
    }
    for (const e of this.entities) {
      if (e.dead || e.x >= px + TILE || e.x + e.w <= px || Math.abs(e.y + e.h - py) > 3) continue;
      if (e instanceof Enemy) e.knockOut();
      else if (e instanceof Coin) e.collect();
    }
  }

  // The closest person or ride Oga can press up to talk to / climb into.
  interactable(player) {
    let best = null;
    let bestDx = Infinity;
    for (const e of this.entities) {
      if (e.dead || !e.interact || !e.prompt) continue;
      const dx = Math.abs(e.cx - player.cx);
      if (dx > e.w / 2 + 14 || Math.abs(e.bottom - player.bottom) > 20 || dx >= bestDx) continue;
      best = e;
      bestDx = dx;
    }
    return best;
  }

  // NEPA takes the light. The street goes black except for what Oga is carrying and
  // whatever is running on a generator, until they bring it back.
  startBlackout(duration = 520) {
    if (this.blackout) return;
    this.blackout = { t: 0, duration, flicker: 0 };
    Sound.play('nepaOff');
    Sound.duckMusic(true);
    Sound.setAmbience('night');
    this.game.say(pick(['NEPA DON TAKE LIGHT!', 'AH! NEPA DON DO AM AGAIN!', 'LIGHT DON GO! NA WA O!']), '#ffcd3a');
  }

  updateBlackout() {
    const b = this.blackout;
    if (!b) return;
    b.t++;
    // Every so often the light teases a comeback and dies again.
    b.flicker = b.flicker > 0 ? b.flicker - 1 : Math.random() < 0.006 ? 9 : 0;
    if (b.t >= b.duration) {
      this.blackout = null;
      Sound.play('nepaOn');
      Sound.duckMusic(false);
      Sound.setAmbience(this.def.ambience);
      this.game.say('UP NEPA!!!', '#63d68f');
    }
  }

  // Punch holes in the dark for Oga and for anything running on a generator.
  drawBlackout(ctx, camX) {
    const b = this.blackout;
    if (!b) return;
    const fade = Math.min(1, Math.min(b.t, b.duration - b.t) / 40);
    const dim = (b.flicker > 4 ? 0.72 : 0.985) * fade;
    if (!this.dark) {
      this.dark = document.createElement('canvas');
      this.dark.width = VIEW_W;
      this.dark.height = VIEW_H;
    }
    const d = this.dark.getContext('2d');
    d.globalCompositeOperation = 'source-over';
    d.clearRect(0, 0, VIEW_W, VIEW_H);
    d.fillStyle = `rgba(3, 2, 10, ${dim})`;
    d.fillRect(0, 0, VIEW_W, VIEW_H);
    d.globalCompositeOperation = 'destination-out';
    // Small, soft pools of light - enough to place your feet, not enough to see the street.
    const hole = (x, y, r, strength) => {
      if (x < -r || x > VIEW_W + r) return;
      const g = d.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(0,0,0,${strength})`);
      g.addColorStop(0.35, `rgba(0,0,0,${strength * 0.7})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      d.fillStyle = g;
      d.fillRect(x - r, y - r, r * 2, r * 2);
    };
    const p = this.player;
    hole(Math.round(p.cx - camX), Math.round(p.y + p.h / 2), 34 + Math.sin(b.t * 0.12) * 2, 0.92);
    for (const dec of this.decor) {
      if (dec.name !== 'generator' && dec.name !== 'mamaput' && dec.name !== 'pos') continue;
      hole(Math.round(dec.x + dec.w / 2 - camX), Math.round(dec.y + 20), dec.name === 'generator' ? 26 : 20, 0.75);
    }
    d.globalCompositeOperation = 'source-over';
    ctx.drawImage(this.dark, 0, 0);
  }

  float(text, x, y, color = '#f8f4ea') {
    // Repeating yourself (leaning on the horn) refreshes the line instead of piling up.
    const same = this.texts.find((t) => t.text === text && t.t < 30 && Math.abs(t.x - x) < 90);
    if (same) {
      same.t = 0;
      return;
    }
    // Several things can shout at once - mounting a keke, honking, scoring. Stack a new
    // line above any line it would land on top of rather than printing over it.
    for (let pass = 0; pass < 6; pass++) {
      const clash = this.texts.find((t) => Math.abs(t.x - x) < 90 && Math.abs(t.y - y) < 11);
      if (!clash) break;
      y = clash.y - 11;
    }
    this.texts.push({ text, x, y, color, t: 0 });
  }

  nearCamera(e, margin) {
    return e.x + e.w > this.camera.x - margin && e.x < this.camera.x + VIEW_W + margin;
  }

  update() {
    this.frame++;
    const player = this.player;
    if (player.state === 'play') {
      for (const trigger of this.triggers) {
        if (trigger.fired || this.camera.x + VIEW_W < trigger.x) continue;
        trigger.fired = true;
        if (trigger.kind === 'nepa') this.startBlackout();
        else this.add(new OkadaWarning(this, trigger.y, trigger.dir));
      }
      this.updateBlackout();
      for (const e of this.entities) if (e instanceof Platform) e.update();
    }
    player.update();
    if (player.state === 'play') {
      const count = this.entities.length;
      for (let i = 0; i < count; i++) {
        const e = this.entities[i];
        if (!e.dead && !(e instanceof Platform) && (e.alwaysActive || this.nearCamera(e, 64))) e.update();
      }
      for (const e of this.entities) if (!e.dead && e.touch && !this.game.dialog && overlaps(player, e)) e.touch(player);
    } else if (player.state === 'win') {
      for (const e of this.entities) if (e instanceof Goal || e instanceof Coin || e instanceof Npc) e.update();
    }
    this.entities = this.entities.filter((e) => !e.dead);
    for (const p of this.particles) p.update();
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const t of this.texts) {
      t.t++;
      t.y -= 0.45;
    }
    this.texts = this.texts.filter((t) => t.t < 55);
    for (const b of this.bumps) b.t++;
    this.bumps = this.bumps.filter((b) => b.t <= 10);
    if (this.shake > 0) this.shake--;

    this.lookAhead = lerp(this.lookAhead, player.facing * 28, 0.04);
    const target = player.x + player.w / 2 - VIEW_W / 2 + this.lookAhead;
    this.camera.x = clamp(lerp(this.camera.x, target, 0.15), 0, this.width - VIEW_W);
  }

  bumpOffset(tx, ty) {
    for (const b of this.bumps) if (b.tx === tx && b.ty === ty) return -Math.round(Math.sin((b.t / 10) * Math.PI) * 5);
    return 0;
  }

  // The backdrop is drawn into the same 400x224 canvas as everything else, so the photo
  // ends up about one screen wide and scales up with hard pixel edges - blocky on purpose.
  drawBackdrop(ctx, camX) {
    if (!this.sky) {
      this.sky = ctx.createLinearGradient(0, 0, 0, VIEW_H);
      this.sky.addColorStop(0, this.theme.sky[0]);
      this.sky.addColorStop(1, this.theme.sky[1]);
    }
    ctx.fillStyle = this.sky;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    // Stock photo, far away. It drifts very slowly - slowly enough that one copy lasts a
    // whole level, so it never repeats and there is no seam. It used to scroll faster and
    // tile, with alternate copies mirrored to hide the join, but a mirrored street reads
    // as a glitch. Depth comes from the pixel buildings behind, which move at half speed.
    const photo = Assets.photos[this.def.photo];
    const pw = photo.width;
    const offset = camX * BACKDROP_PARALLAX;
    for (let x = Math.round(-(offset % pw)); x < VIEW_W; x += pw) ctx.drawImage(photo, x, 0);
    ctx.fillStyle = this.theme.haze;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    // Pixel-art buildings in the middle distance at half speed.
    if (!this.buildings.length) return;
    const shift = camX * 0.5;
    for (const b of this.buildings) {
      const x = Math.round(b.x - shift);
      if (x + b.w >= 0 && x <= VIEW_W) Assets.draw(ctx, 'decor', b.name, x, 12 * TILE - b.h + 6);
    }
    ctx.fillStyle = this.theme.haze;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  // Pixel-art layer on the 400x224 canvas.
  draw(ctx) {
    const camX = Math.round(this.camera.x);
    this.drawBackdrop(ctx, camX);
    ctx.save();
    if (this.shake) ctx.translate(0, this.shake % 4 < 2 ? 1 : -1);
    for (const d of this.decor) {
      if (d.x + d.w < camX || d.x > camX + VIEW_W) continue;
      if (d.photo) ctx.drawImage(Assets.photos[d.photo], d.x - camX + 4, d.y + 4);
      Assets.draw(ctx, d.sheet, d.name, d.x - camX, d.y);
    }
    for (const e of this.entities) if (e.behindTiles) e.draw(ctx, camX);
    this.drawTiles(ctx, camX);
    for (const e of this.entities) if (!e.behindTiles) e.draw(ctx, camX);
    this.player.draw(ctx, camX);
    for (const p of this.particles) p.draw(ctx, camX);
    for (const t of this.texts) {
      const color = t.t > 40 && t.t % 4 < 2 ? '#a8a2b4' : t.color;
      drawText(ctx, t.text, t.x - camX, t.y, { color, align: 'center', outline: true });
    }
    // Night stages sit under a wash; the NEPA blackout then goes on top of that.
    if (this.theme.dark) {
      ctx.fillStyle = `rgba(8, 8, 28, ${this.theme.dark})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    this.drawBlackout(ctx, camX);
    const target = this.player.state === 'play' && !this.game.dialog && this.interactable(this.player);
    if (target) {
      const bob = Math.round(Math.sin(this.frame * 0.15));
      drawText(ctx, `↑ ${target.prompt}`, target.cx - camX, target.y - 12 + bob, { align: 'center', color: '#ffcd3a', outline: true });
    }
    ctx.restore();
  }

  drawTiles(ctx, camX) {
    const x0 = Math.max(0, Math.floor(camX / TILE));
    const x1 = Math.min(this.cols - 1, Math.floor((camX + VIEW_W) / TILE));
    const ground = this.theme.ground;
    const crate = this.frame % 48 < 8 ? 'crate2' : 'crate1';
    const water = (this.frame >> 5) % 2 ? 'water_top2' : 'water_top1';
    for (let ty = 0; ty < this.rows; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const ch = this.tiles[ty * this.cols + tx];
        let name;
        switch (ch) {
          case '#': name = this.tileAt(tx, ty - 1) === '#' ? `${ground}_fill` : `${ground}_top`; break;
          case 'B': name = 'block'; break;
          case '?': case 'M': case 'U': case 'S': case 'L': name = crate; break;
          case 'u': name = 'crate_used'; break;
          case 'X': name = 'solid'; break;
          case 'P': {
            let run = 0;
            while (this.tileAt(tx - 1 - run, ty) === 'P') run++;
            const side = run % 2 ? 'r' : 'l';
            name = this.tileAt(tx, ty - 1) === 'P' ? `pillar_${side}` : `pillar_t${side}`;
            break;
          }
          case '=': {
            const l = this.tileAt(tx - 1, ty) === '=';
            const r = this.tileAt(tx + 1, ty) === '=';
            name = !l && r ? 'plank_l' : l && !r ? 'plank_r' : 'plank_m';
            break;
          }
          case '~': name = this.tileAt(tx, ty - 1) === '~' ? 'water_fill' : water; break;
          default: continue;
        }
        const x = tx * TILE - camX;
        const y = ty * TILE + (this.bumps.length ? this.bumpOffset(tx, ty) : 0);
        if (this.theme.rail && ch === '#' && this.tileAt(tx, ty - 1) === '.') Assets.draw(ctx, 'tiles', 'rail', x, y - TILE);
        Assets.draw(ctx, 'tiles', name, x, y);
      }
    }
  }
}
