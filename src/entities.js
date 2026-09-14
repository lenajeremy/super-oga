/* SUPER OGA - everything that moves: Oga Tunde and his rides, the people on the road,
 * the street wahala, pick-ups and effects. */
'use strict';

// A ride is hired, not owned: fifteen seconds and the man wants his machine back.
const RIDE_SECONDS = 15;
const RIDES = {
  okada: { max: 3.6, accel: 0.14, jump: -7.2 },
  keke: { max: 2.3, accel: 0.08, jump: -5.8 },
};

class Particle {
  constructor(x, y, { vx = 0, vy = 0, gravity = 0, life = 30, frames = ['sparkle1'], rate = 6, sheet = 'items', flipX = false } = {}) {
    Object.assign(this, { x, y, vx, vy, gravity, life, frames, rate, sheet, flipX, t: 0 });
  }

  update() {
    this.t++;
    this.life--;
    this.vy += this.gravity;
    this.x += this.vx;
    this.y += this.vy;
  }

  draw(ctx, camX) {
    const name = this.frames[Math.floor(this.t / this.rate) % this.frames.length];
    Assets.draw(ctx, this.sheet, name, this.x - camX, this.y, this.flipX);
  }
}

class Entity {
  constructor(world, x, y, w, h) {
    Object.assign(this, { world, x, y, w, h, vx: 0, vy: 0, facing: 1, onGround: false, dead: false, t: 0 });
  }

  get cx() {
    return this.x + this.w / 2;
  }

  get bottom() {
    return this.y + this.h;
  }

  update() {}

  draw() {}

  // Draw a sprite centred on the hitbox with its bottom on the hitbox bottom.
  sprite(ctx, camX, sheet, name, { flipX = this.facing < 0, flipY = false, dx = 0 } = {}) {
    const [, , w, h] = Assets.frame(sheet, name);
    Assets.draw(ctx, sheet, name, Math.round(this.cx - w / 2 + dx) - camX, Math.round(this.bottom - h), flipX, flipY);
  }

  fall(gravity = 0.35) {
    this.vy = Math.min(this.vy + gravity, 5);
    const hit = this.world.moveY(this, this.vy);
    this.onGround = hit === 1 || this.world.grounded(this);
    if (hit) this.vy = 0;
    if (this.y > this.world.height + 16) this.dead = true;
    return hit;
  }
}

// ---------------------------------------------------------------- Oga Tunde
class Player extends Entity {
  constructor(world, x, bottom) {
    super(world, x, bottom - 20, 10, 20);
    Object.assign(this, {
      form: 'small', state: 'play', invuln: 0, odogwu: 0, coyote: 0, jumpBuffer: 0, freeze: 0, throwTimer: 0,
      anim: 0, crouching: false, skidding: false, ride: null, deathTimer: 0, cause: null, vehicle: null, mountCooldown: 0,
    });
    this.prevBottom = this.bottom;
    // Last spot Oga stood on solid ground - where cheat mode puts him back.
    this.safe = { x, bottom: this.bottom };
  }

  get big() {
    return this.form !== 'small';
  }

  // The hitbox depends on form and on what Oga is riding; feet and centre stay put.
  resize() {
    const { bottom, cx } = this;
    if (this.vehicle) {
      this.w = this.vehicle.kind === 'keke' ? 28 : 22;
      this.h = this.vehicle.kind === 'keke' ? 28 : this.big ? 30 : 26;
    } else {
      this.w = this.big ? 12 : 10;
      this.h = this.big ? 29 : 20;
    }
    this.x = cx - this.w / 2;
    this.y = bottom - this.h;
  }

  setForm(form) {
    this.form = form;
    this.resize();
  }

  powerUp(kind) {
    const game = this.world.game;
    if (kind === 'puffpuff') {
      game.addLife(this.cx, this.y);
      return;
    }
    game.addScore(1000, this.cx, this.y - 8);
    if (kind === 'jollof' && this.form === 'small') {
      this.setForm('big');
      this.freeze = 24;
      Sound.play('grow');
      game.say('JOLLOF DON ENTER! BIG OGA MODE!');
    } else if (kind === 'water') {
      this.setForm('water');
      this.freeze = 24;
      Sound.play('power');
      game.say('PURE WATER POWER! PRESS RUN (X) TO THROW SACHET!');
    } else if (kind === 'beads') {
      this.odogwu = 600;
      Sound.play('power');
      Sound.setSpeed(1.2);
      game.say('ODOGWU MODE! NOTHING FIT TOUCH YOU!');
    } else {
      Sound.play('power');
    }
  }

  mount(ride) {
    if (this.vehicle || this.state !== 'play') return;
    this.vehicle = { kind: ride.kind, hp: ride.kind === 'keke' ? 3 : 1, owner: ride.owner, time: RIDE_SECONDS * 60 };
    ride.dead = true;
    this.resize();
    this.x = ride.cx - this.w / 2;
    this.y = ride.bottom - this.h;
    Object.assign(this, { vx: 0, vy: 0, facing: ride.facing, jumpBuffer: 0, crouching: false, mountCooldown: 20 });
    Sound.play('rev');
    Sound.startEngine();
    this.world.float(ride.kind === 'keke' ? 'KEKE MARUWA! NO SHAKING!' : 'OKADA! HOLD BODY!', this.cx, this.y - 8, '#ffcd3a');
  }

  dismount() {
    const v = this.vehicle;
    if (!v) return;
    const { bottom, cx } = this;
    this.vehicle = null;
    Sound.stopEngine();
    const ride = this.world.add(new ParkedRide(this.world, 0, bottom, v.kind));
    ride.x = cx - ride.w / 2;
    Object.assign(ride, { facing: this.facing, paid: true, owner: v.owner });
    if (v.owner) v.owner.ride = ride;
    this.resize();
    this.world.moveX(this, -this.facing * 14);
    this.vy = -3;
    this.mountCooldown = 30;
    this.world.float('PARK WELL!', this.cx, this.y - 8);
  }

  crash() {
    const v = this.vehicle;
    if (!v) return;
    this.vehicle = null;
    Sound.stopEngine();
    Sound.play('crash');
    this.world.add(new Wreck(this.world, this.cx, this.bottom, v.kind, this.facing));
    if (v.owner) v.owner.ride = null;
    this.resize();
    this.vy = -4;
    this.invuln = 90;
    this.world.shake = 8;
    this.world.float('E DON CRASH!', this.cx, this.y - 10, '#e3412f');
  }

  damageRide() {
    const v = this.vehicle;
    if (!v || this.invuln > 0) return;
    if (--v.hp <= 0) {
      this.crash();
      return;
    }
    this.invuln = 60;
    this.world.shake = 4;
    Sound.play('bump');
    this.world.float(`KEKE DON DENT! ${v.hp} MORE KNOCK`, this.cx, this.y - 10, '#ffcd3a');
  }

  hurt() {
    if (this.state !== 'play' || this.invuln > 0 || this.odogwu > 0 || this.world.game.cheat) return;
    if (this.vehicle) {
      this.crash();
      return;
    }
    if (this.form === 'small') {
      this.die('hit');
      return;
    }
    this.setForm('small');
    this.invuln = 120;
    this.freeze = 20;
    Sound.play('shrink');
    this.world.float(pick(['CHAI!', 'EHN EHN!', 'WAHALA!']), this.cx, this.y - 8, '#e3412f');
    this.world.game.dropAso(2, this);
  }

  die(cause) {
    if (this.state !== 'play') return;
    if (this.world.game.cheat) {
      this.rescue(cause);
      return;
    }
    if (this.vehicle) {
      this.vehicle = null;
      Sound.stopEngine();
    }
    this.state = 'dead';
    this.cause = cause;
    this.deathTimer = 0;
    this.vx = 0;
    this.vy = cause === 'hit' || cause === 'time' ? -5 : 0;
    this.odogwu = 0;
    this.setForm('small');
    Sound.stopMusic();
    Sound.play('die');
    if (cause === 'water') {
      Sound.play('splash');
      for (let i = 0; i < 4; i++) {
        this.world.particles.push(new Particle(this.cx - 6 + rand(-6, 6), this.bottom - 12, { vy: rand(-2.5, -1), gravity: 0.15, life: 30, frames: ['splash1', 'splash2'], rate: 8 }));
      }
    }
    this.world.game.onPlayerDied(cause);
  }

  // Cheat mode: instead of dying, get fished out and set back down on dry land.
  rescue(cause) {
    const game = this.world.game;
    if (cause === 'time') {
      game.time = Math.max(game.time, 150);
      game.hurry = false;
      Sound.setSpeed(1);
    } else if (cause === 'water' || cause === 'fall') {
      if (this.vehicle) {
        this.vehicle = null;
        Sound.stopEngine();
        this.resize();
      }
      this.x = this.safe.x;
      this.y = this.safe.bottom - this.h;
      this.vx = 0;
      this.vy = 0;
      Sound.play('appear');
    }
    this.invuln = 90;
    this.world.float(cause === 'time' ? 'CHEAT: TIME DON RESET' : 'CHEAT: GOD DEY!', this.cx, this.y - 10, '#63d68f');
  }

  update() {
    this.t++;
    if (this.state === 'dead') {
      this.deathTimer++;
      if (this.vy !== 0 && this.deathTimer > 30) {
        this.vy = Math.min(this.vy + 0.25, 6);
        this.y += this.vy;
      }
      return;
    }
    if (this.state === 'win') {
      this.updateWin();
      return;
    }
    if (this.freeze > 0) {
      this.freeze--;
      return;
    }
    const world = this.world;
    for (const key of ['invuln', 'throwTimer', 'mountCooldown']) if (this[key] > 0) this[key]--;
    // The hire runs out. Warn near the end, then hand the machine back.
    if (this.vehicle && this.onGround) {
      this.vehicle.time--;
      if (this.vehicle.time === 180) {
        Sound.play('warn');
        world.float('TIME DEY GO! 3 SECONDS!', this.cx, this.y - 12, '#e3412f');
      }
      if (this.vehicle.time <= 0) {
        const kind = this.vehicle.kind;
        this.dismount();
        world.float(kind === 'keke' ? 'KEKE TIME DON FINISH!' : 'OKADA TIME DON FINISH!', this.cx, this.y - 10, '#ffcd3a');
        return;
      }
    }
    if (this.odogwu > 0) {
      this.odogwu--;
      if (this.t % 6 === 0) {
        world.particles.push(new Particle(this.x + rand(-3, this.w), this.y + rand(0, this.h), { vy: -0.4, life: 18, frames: ['sparkle1', 'sparkle2'] }));
      }
      if (this.odogwu === 0) Sound.setSpeed(world.game.hurry ? 1.15 : 1);
    }

    // Up is jump, except when there is somebody in front of you - then it talks, buys,
    // haggles or climbs aboard. Checked before the jump below so it wins, and the jump
    // buffer is cleared so the press does not leak into a hop on the way out.
    if (Input.pressed.up && this.onGround && !this.mountCooldown) {
      const target = world.interactable(this);
      if (target) {
        this.jumpBuffer = 0;
        this.coyote = 0;
        target.interact(this);
        return;
      }
    }
    if (this.vehicle && this.onGround && Input.pressed.down) {
      this.dismount();
      return;
    }

    // Walking, running, or driving.
    const ride = this.vehicle && RIDES[this.vehicle.kind];
    const dir = (Input.down.right ? 1 : 0) - (Input.down.left ? 1 : 0);
    const running = !ride && Input.down.run;
    this.crouching = !ride && this.big && this.onGround && Input.down.down;
    const max = ride ? ride.max : running ? 2.7 : 1.6;
    if (dir && !this.crouching) {
      this.facing = dir;
      const turning = this.onGround && Math.sign(this.vx) === -dir;
      let accel = ride ? ride.accel * (this.onGround ? 1 : 0.7) : !this.onGround ? 0.08 : running ? 0.1 : 0.08;
      if (turning) accel = Math.max(accel, 0.22);
      this.vx += dir * accel;
      if (Math.abs(this.vx) > max) this.vx = Math.sign(this.vx) * Math.max(max, Math.abs(this.vx) - 0.08);
    } else {
      const friction = this.onGround ? (this.crouching ? 0.05 : ride ? 0.07 : 0.12) : 0.02;
      this.vx = Math.abs(this.vx) <= friction ? 0 : this.vx - Math.sign(this.vx) * friction;
    }
    this.skidding = !ride && this.onGround && dir !== 0 && Math.sign(this.vx) === -dir && Math.abs(this.vx) > 0.9;
    if (this.skidding && this.t % 5 === 0) {
      world.particles.push(new Particle(this.cx - 4, this.bottom - 7, { vy: -0.3, life: 14, frames: ['dust1', 'dust2'], rate: 7 }));
    }

    // Jumping: buffered presses, coyote time, lighter gravity while the button is held.
    this.jumpBuffer = Input.pressed.jump ? 8 : Math.max(0, this.jumpBuffer - 1);
    this.coyote = this.onGround ? 6 : Math.max(0, this.coyote - 1);
    if (this.jumpBuffer && this.coyote) {
      this.vy = ride ? ride.jump : Math.abs(this.vx) > 2 ? -6.85 : -6.3;
      this.jumpBuffer = 0;
      this.coyote = 0;
      this.onGround = false;
      this.ride = null;
      Sound.play(this.big || ride ? 'bigJump' : 'jump');
    }
    this.vy = Math.min(this.vy + (this.vy < 0 ? (Input.down.jump ? 0.23 : 0.62) : 0.5), 5.8);

    if (ride && Input.pressed.run) {
      Sound.play('horn');
      world.float('PIM PIM!', this.cx + this.facing * 16, this.y - 4, '#ffcd3a');
    } else if (!ride && this.form === 'water' && Input.pressed.run && world.entities.filter((e) => e instanceof Sachet).length < 2) {
      world.add(new Sachet(world, this.cx + this.facing * 6 - 3, this.y + 8, this.facing));
      this.throwTimer = 12;
      Sound.play('throw');
    }

    this.prevBottom = this.bottom;
    if (world.moveX(this, this.vx)) this.vx = 0;
    const hit = world.moveY(this, this.vy);
    this.onGround = hit === 1 || (this.vy >= 0 && world.grounded(this));
    if (hit) this.vy = 0;
    this.landOnPlatforms();
    this.x = clamp(this.x, 0, world.width - this.w);

    if (this.onGround && !this.ride && world.solidAt(this.cx, this.bottom + 2)) {
      this.safe = { x: this.x, bottom: this.bottom };
    }

    const feet = world.tileAt(Math.floor(this.cx / TILE), Math.floor((this.bottom - 3) / TILE));
    if (feet === '~') this.die('water');
    else if (this.y > world.height + 8) this.die('fall');
    if (ride) Sound.updateEngine(Math.abs(this.vx) / ride.max);
    if (this.onGround) this.anim += Math.abs(this.vx) * (ride ? 0.22 : 0.09);
  }

  landOnPlatforms() {
    const was = this.ride;
    this.ride = null;
    if (this.vy < 0) return;
    for (const e of this.world.entities) {
      if (!(e instanceof Platform) || this.x + this.w <= e.x + 1 || this.x >= e.x + e.w - 1) continue;
      const landing = this.prevBottom <= e.y - e.dy + 2 && this.bottom >= e.y;
      // A platform sinking under you drops away faster than you fall, so the plain
      // landing test loses contact the moment it starts descending. Stay stuck to the
      // one you were already standing on while it is still under your feet.
      const staying = was === e && this.bottom <= e.y + Math.abs(e.dy) + 3;
      if (landing || staying) {
        this.y = e.y - this.h;
        this.vy = 0;
        this.onGround = true;
        this.ride = e;
        return;
      }
    }
  }

  updateWin() {
    const goal = this.world.goal;
    const target = goal.x + 40 - this.w / 2;
    this.facing = 1;
    this.vx = this.x < target ? 1.2 : 0;
    this.vy = Math.min(this.vy + 0.5, 5.8);
    this.world.moveX(this, this.vx);
    const hit = this.world.moveY(this, this.vy);
    this.onGround = hit === 1;
    if (hit) this.vy = 0;
    if (this.onGround && !this.vx && this.t % 36 === 0) this.vy = -3.2;
    if (this.onGround) this.anim += Math.abs(this.vx) * 0.09;
  }

  draw(ctx, camX) {
    if (this.state === 'play' && this.invuln > 0 && (this.invuln >> 2) % 2 === 0) return;
    const flash = (this.odogwu > 0 && (this.t >> 2) % 2 === 0) || (this.freeze > 0 && this.freeze % 6 < 3);
    const variant = flash ? '_gold' : this.form === 'water' ? '_water' : '';
    if (this.vehicle) {
      this.drawRiding(ctx, camX, variant);
      return;
    }
    let pose = 'idle';
    if (this.state === 'dead') pose = 'dead';
    else if (this.crouching) pose = 'crouch';
    else if (!this.onGround) pose = 'jump';
    else if (this.skidding) pose = 'skid';
    else if (this.throwTimer > 0 && this.big) pose = 'throw';
    else if (Math.abs(this.vx) > 0.15) pose = Math.floor(this.anim) % 2 ? 'walk2' : 'walk1';
    const name = pose === 'dead' ? 's_dead' : `${this.big ? 'b' : 's'}_${pose}${variant}`;
    this.sprite(ctx, camX, 'hero', name, { flipX: this.facing < 0 && pose !== 'dead' });
  }

  drawRiding(ctx, camX, variant) {
    const flip = this.facing < 0;
    const rider = `${this.big ? 'b' : 's'}_sit${variant}`;
    const [, , rw, rh] = Assets.frame('hero', rider);
    const bottom = Math.round(this.bottom);
    const spin = Math.floor(this.anim) % 2;
    if (this.vehicle.kind === 'okada') {
      const bx = Math.round(this.cx - 16) - camX;
      const by = bottom - 24;
      const seat = this.big ? 4 : 8;
      Assets.draw(ctx, 'hero', rider, flip ? bx + 32 - seat - rw : bx + seat, by + 15 - rh, flip);
      Assets.draw(ctx, 'rides', spin ? 'bike2' : 'bike1', bx, by, flip);
      return;
    }
    const kx = Math.round(this.cx - 18) - camX;
    const ky = bottom - 28;
    const seat = this.big ? 10 : 14;
    Assets.draw(ctx, 'rides', spin ? 'keke2' : 'keke1', kx, ky, flip);
    ctx.save();
    ctx.beginPath();
    ctx.rect(kx, ky, 36, 13);
    ctx.clip();
    Assets.draw(ctx, 'hero', rider, flip ? kx + 36 - seat - rw : kx + seat, ky + 3, flip);
    ctx.restore();
  }
}

// ---------------------------------------------------------------- people & rides
class Npc extends Entity {
  constructor(world, x, bottom, kind) {
    super(world, x, bottom - 24, 16, 24);
    this.kind = kind;
    this.ride = null;
    this.facing = -1;
    this.callCooldown = 60 + Math.floor(Math.random() * 120);
    this.phase = Math.floor(Math.random() * 64);
  }

  get prompt() {
    // No point hawking an okada at somebody already sitting on one.
    if (this.ride && this.world.player.vehicle) return null;
    return PROMPTS[this.kind];
  }

  update() {
    this.t++;
    this.facing = this.world.player.cx < this.cx ? -1 : 1;
    if (this.callCooldown > 0) this.callCooldown--;
    const call = CALLS[this.kind];
    const p = this.world.player;
    const dist = Math.abs(p.cx - this.cx);
    // Hawk at anybody who comes within earshot, then hold off so it does not nag.
    if (call && !this.callCooldown && !this.world.game.dialog && p.state === 'play' &&
        dist < 150 && Math.abs(p.bottom - this.bottom) < 44 && this.world.nearCamera(this, 0)) {
      this.callCooldown = 260 + Math.floor(Math.random() * 160);
      this.world.float(call.text, this.cx, this.y - 12, '#ffcd3a');
      Sound.speak(this.kind, { vol: 0.95 * (1 - dist / 200), fallback: call });
    }
  }

  interact(player) {
    this.world.game.openDialog(this.kind, { npc: this, player });
  }

  draw(ctx, camX) {
    const dialog = this.world.game.dialog;
    const talking = dialog && dialog.ctx.npc === this && dialog.typing && (dialog.t >> 3) % 2;
    const name = talking ? `${this.kind}_talk` : ((this.t + this.phase) >> 5) % 2 ? `${this.kind}_2` : `${this.kind}_1`;
    this.sprite(ctx, camX, 'people', name);
  }
}

class ParkedRide extends Entity {
  constructor(world, x, bottom, kind) {
    const w = kind === 'keke' ? 30 : 26;
    super(world, x, bottom - 20, w, 20);
    this.kind = kind;
    this.paid = false;
    this.owner = null;
  }

  get prompt() {
    if (this.world.player.vehicle) return null;
    if (this.paid || !this.owner) return this.kind === 'keke' ? 'ENTER KEKE' : 'CLIMB OKADA';
    return PROMPTS[this.owner.kind];
  }

  update() {
    this.fall(0.4);
  }

  interact(player) {
    if (this.paid || !this.owner) player.mount(this);
    else this.owner.interact(player);
  }

  draw(ctx, camX) {
    this.sprite(ctx, camX, 'rides', this.kind === 'keke' ? 'keke1' : 'bike_parked');
  }
}

class Wreck extends Entity {
  constructor(world, cx, bottom, kind, facing) {
    super(world, cx - 16, bottom - 24, 32, 24);
    Object.assign(this, { kind, facing, vx: -facing * 1.5, vy: -5, alwaysActive: true });
  }

  update() {
    this.vy += 0.3;
    this.x += this.vx;
    this.y += this.vy;
    if (this.y > this.world.height + 40) this.dead = true;
  }

  draw(ctx, camX) {
    Assets.draw(ctx, 'rides', this.kind === 'keke' ? 'keke1' : 'bike1', this.x - camX, this.y, this.facing < 0, true);
  }
}

// ---------------------------------------------------------------- street wahala
class Enemy extends Entity {
  constructor(world, x, y, w, h) {
    super(world, x, y, w, h);
    this.facing = -1;
    this.state = 'alive';
    this.points = 100;
  }

  get alive() {
    return this.state === 'alive';
  }

  touch(player) {
    if (!this.alive) return;
    if (player.odogwu > 0) this.knockOut();
    else if (player.vy > 0 && player.prevBottom <= this.y + 6) this.stomped(player);
    else if (player.vehicle) this.rammed(player);
    else this.hitPlayer(player);
  }

  bounce(player) {
    player.vy = Input.down.jump ? -6.3 : -4.1;
    player.y = this.y - player.h;
    Sound.play('stomp');
  }

  stomped(player) {
    this.bounce(player);
    this.knockOut();
  }

  // A keke flattens anything; an okada needs speed or it's the okada that goes down.
  rammed(player) {
    if (player.invuln > 0) return;
    const keke = player.vehicle.kind === 'keke';
    if (keke || Math.abs(player.vx) > 1.4) this.knockOut(keke ? 'KEKE NO GET BRAKE!' : 'COMOT FOR ROAD!');
    else player.crash();
  }

  hitPlayer(player) {
    player.hurt();
  }

  hitBySachet() {
    this.knockOut();
  }

  knockOut(text) {
    if (!this.alive) return;
    this.state = 'ko';
    this.vy = -3.5;
    this.vx = (this.world.player.cx < this.cx ? 1 : -1) * 0.8;
    this.world.game.addScore(this.points, this.cx, this.y - 6, text);
    Sound.play('kick');
  }

  updateKO() {
    this.vy = Math.min(this.vy + 0.3, 6);
    this.x += this.vx;
    this.y += this.vy;
    if (this.y > this.world.height + 32) this.dead = true;
  }

  walk(speed, turnAtLedge) {
    this.vx = this.facing * speed;
    if (this.world.moveX(this, this.vx)) this.facing *= -1;
    this.fall();
    if (turnAtLedge && this.onGround && !this.world.solidAt(this.facing > 0 ? this.x + this.w + 1 : this.x - 1, this.bottom + 2)) {
      this.facing *= -1;
    }
    for (const o of this.world.entities) {
      if (o !== this && o instanceof Enemy && o.alive && !o.flying && overlaps(this, o) && (o.cx - this.cx) * this.facing > 0) {
        this.facing *= -1;
      }
    }
  }
}

class Rat extends Enemy {
  constructor(world, x, y) {
    super(world, x + 2, y + 6, 12, 10);
  }

  update() {
    this.t++;
    if (this.state === 'ko') this.updateKO();
    else if (this.state === 'flat') this.dead = ++this.flatTimer > 30;
    else this.walk(0.5, false);
  }

  stomped(player) {
    this.bounce(player);
    this.state = 'flat';
    this.flatTimer = 0;
    this.world.game.addScore(100, this.cx, this.y - 6, pick(['GBAM!', 'KPA!', 'WOSH!']));
  }

  draw(ctx, camX) {
    const name = this.state === 'flat' ? 'rat_flat' : (this.t >> 3) % 2 ? 'rat_walk2' : 'rat_walk1';
    this.sprite(ctx, camX, 'enemies', name, { flipY: this.state === 'ko' });
  }
}

class Goat extends Enemy {
  constructor(world, x, y) {
    super(world, x, y + 3, 18, 13);
    this.points = 200;
    this.mode = 'walk';
    this.timer = 0;
    this.cooldown = 60;
  }

  update() {
    this.t++;
    if (this.state === 'ko') {
      this.updateKO();
      return;
    }
    const p = this.world.player;
    if (this.cooldown > 0) this.cooldown--;
    if (this.mode === 'walk') {
      this.walk(0.35, true);
      if (!this.cooldown && p.state === 'play' && Math.abs(p.bottom - this.bottom) < 20 && Math.abs(p.cx - this.cx) < 120) {
        this.facing = Math.sign(p.cx - this.cx) || this.facing;
        this.mode = 'windup';
        this.timer = 30;
        Sound.play('goat');
        this.world.float('MEHHH!', this.cx, this.y - 8);
      }
    } else if (this.mode === 'windup') {
      this.fall();
      if (--this.timer <= 0) {
        this.mode = 'charge';
        this.timer = 100;
      }
    } else if (this.mode === 'charge') {
      const wall = this.world.moveX(this, this.facing * 2.4);
      const landed = this.fall() === 1;
      const ledge = landed && !this.world.solidAt(this.facing > 0 ? this.x + this.w + 1 : this.x - 1, this.bottom + 2);
      if (wall || ledge || --this.timer <= 0) {
        this.mode = 'rest';
        this.timer = 60;
        if (wall) {
          this.world.shake = 6;
          Sound.play('bump');
        }
      }
    } else {
      this.fall();
      if (--this.timer <= 0) {
        this.mode = 'walk';
        this.cooldown = 90;
      }
    }
  }

  stomped(player) {
    this.bounce(player);
    this.knockOut('EWURE DON JAPA!');
  }

  draw(ctx, camX) {
    let name = (this.t >> 4) % 2 ? 'goat_walk2' : 'goat_walk1';
    if (this.mode === 'windup') name = 'goat_charge';
    if (this.mode === 'charge') name = (this.t >> 2) % 2 ? 'goat_charge' : 'goat_walk2';
    const dx = this.mode === 'windup' ? ((this.t >> 1) % 2 ? 1 : -1) : 0;
    this.sprite(ctx, camX, 'enemies', name, { flipY: this.state === 'ko', dx });
  }
}

class Mosquito extends Enemy {
  constructor(world, x, y) {
    super(world, x + 3, y + 4, 10, 8);
    this.flying = true;
    this.homeX = this.x;
    this.homeY = this.y;
    this.phase = Math.random() * 6;
  }

  update() {
    this.t++;
    if (this.state === 'ko') {
      this.updateKO();
      return;
    }
    const p = this.world.player;
    if (Math.abs(p.cx - this.homeX) < 140) this.homeX += Math.sign(p.cx - this.homeX) * 0.25;
    const nx = this.homeX + Math.sin(this.t * 0.03 + this.phase) * 20;
    this.facing = nx >= this.x ? 1 : -1;
    this.x = nx;
    this.y = this.homeY + Math.sin(this.t * 0.09 + this.phase) * 8;
  }

  stomped(player) {
    this.bounce(player);
    this.knockOut('PAH! ANOPHELES DON DIE');
  }

  rammed() {
    this.knockOut('PAH!');
  }

  draw(ctx, camX) {
    this.sprite(ctx, camX, 'enemies', (this.t >> 1) % 2 ? 'mosquito_fly2' : 'mosquito_fly1', { flipY: this.state === 'ko' });
  }
}

// Agberos stop you for "union levy". Settle them, beg them, or face their vex.
class Agbero extends Enemy {
  constructor(world, x, y) {
    super(world, x + 3, y - 5, 10, 21);
    this.points = 200;
    this.cooldown = 0;
    // Word travels on this road. Settle with a couple and the next one waves you past;
    // refuse a couple and he is already vexed when you arrive.
    const rep = world.game.reputation;
    this.mood = rep >= 2 ? 'peace' : rep <= -2 ? 'angry' : 'waiting';
    this.greeted = this.mood !== 'waiting';
  }

  get prompt() {
    return this.alive && this.mood === 'waiting' ? PROMPTS.agbero : null;
  }

  interact(player) {
    this.cooldown = 30;
    this.world.game.openDialog('agbero', { npc: this, player });
  }

  makePeace() {
    this.mood = 'peace';
    this.world.float('GO WELL, OGA!', this.cx, this.y - 8, '#63d68f');
  }

  makeAngry() {
    this.mood = 'angry';
    this.cooldown = 45;
    this.facing = Math.sign(this.world.player.cx - this.cx) || this.facing;
  }

  update() {
    this.t++;
    if (this.cooldown > 0) this.cooldown--;
    if (this.state === 'ko') {
      this.updateKO();
    } else if (this.mood === 'peace') {
      this.fall();
      this.facing = this.world.player.cx < this.cx ? -1 : 1;
    } else if (this.mood === 'angry') {
      if (!this.cooldown) this.facing = Math.sign(this.world.player.cx - this.cx) || this.facing;
      this.walk(0.9, true);
    } else {
      this.walk(0.45, true);
    }
  }

  touch(player) {
    if (this.mood !== 'peace') super.touch(player);
  }

  stopAndTalk(player) {
    if (this.cooldown || player.invuln > 0) return;
    player.vx = 0;
    this.world.moveX(player, player.cx < this.cx ? -3 : 3);
    this.interact(player);
  }

  hitPlayer(player) {
    if (this.mood === 'waiting') {
      this.stopAndTalk(player);
      return;
    }
    const game = this.world.game;
    if (player.invuln > 0 || this.cooldown > 0) return;
    if (game.naira <= 0) {
      this.world.float('NO MONEY? WAHALA!', this.cx, this.y - 8, '#e3412f');
      this.cooldown = 60;
      player.hurt();
      return;
    }
    const taken = Math.min(100, game.naira);
    game.naira -= taken;
    this.cooldown = 60;
    player.invuln = 60;
    player.vx = (player.cx < this.cx ? -1 : 1) * 2.8;
    player.vy = -3;
    Sound.play('steal');
    this.world.float(`OWO DA?! -₦${taken}`, this.cx, this.y - 8, '#ffcd3a');
    for (let i = 0; i < 5; i++) {
      this.world.particles.push(new Particle(player.cx - 7, player.y, { vx: (this.cx - player.cx) / 30 + rand(-0.5, 0.5), vy: rand(-3, -1.5), gravity: 0.15, life: 30, frames: ['coin1', 'coin2', 'coin3', 'coin4'], rate: 4 }));
    }
  }

  rammed(player) {
    if (this.mood === 'waiting') this.stopAndTalk(player);
    else super.rammed(player);
  }

  stomped(player) {
    this.bounce(player);
    this.knockOut('AGBERO DON RUN!');
  }

  draw(ctx, camX) {
    let name = (this.t >> (this.mood === 'angry' ? 3 : 4)) % 2 ? 'agbero_walk2' : 'agbero_walk1';
    if (this.state === 'ko') name = 'agbero_flee';
    else if (this.mood === 'peace') name = 'agbero_walk1';
    this.sprite(ctx, camX, 'enemies', name);
    if (this.alive && this.mood === 'angry' && (this.t >> 3) % 2) {
      drawText(ctx, '!', this.cx - camX, this.y - 10, { align: 'center', color: '#e3412f', outline: true });
    }
  }
}

class Okada extends Enemy {
  constructor(world, x, y, dir = -1) {
    super(world, x, y - 4, 26, 20);
    this.points = 400;
    this.alwaysActive = true;
    this.bounced = false;
    this.dir = dir;
    this.facing = dir;
  }

  update() {
    this.t++;
    if (this.state === 'ko') {
      this.updateKO();
      return;
    }
    if (this.world.moveX(this, this.dir * 2.8)) {
      this.knockOut('E DON CRASH!');
      this.world.shake = 8;
      return;
    }
    this.fall();
    const off = this.dir < 0 ? this.x + this.w < this.world.camera.x - 48 : this.x > this.world.camera.x + VIEW_W + 48;
    if (off) this.dead = true;
  }

  // Okadas don't stop for anybody: you just bounce off the rider.
  stomped(player) {
    player.vy = -7;
    player.y = this.y - player.h;
    Sound.play('bump');
    if (!this.bounced) {
      this.bounced = true;
      this.world.game.addScore(50, this.cx, this.y - 6, 'OKADA NO BE TRAMPOLINE!');
    }
  }

  rammed(player) {
    if (player.invuln > 0) return;
    this.knockOut('E DON CRASH!');
    player.damageRide();
  }

  hitBySachet() {
    this.world.float('E NO SEE AM', this.cx, this.y - 8);
  }

  draw(ctx, camX) {
    this.sprite(ctx, camX, 'enemies', (this.t >> 2) % 2 ? 'okada_ride2' : 'okada_ride1', { flipX: this.dir < 0, flipY: this.state === 'ko' });
  }
}

// Flashes a "!" at the screen edge, then sends an okada in from the right.
class OkadaWarning extends Entity {
  constructor(world, rowY, dir = -1) {
    super(world, world.camera.x + VIEW_W, rowY, 1, 1);
    this.alwaysActive = true;
    this.timer = 50;
    this.dir = dir;
    Sound.play('warn');
  }

  update() {
    if (--this.timer > 0) return;
    this.dead = true;
    const x = this.dir < 0 ? this.world.camera.x + VIEW_W + 8 : this.world.camera.x - 34;
    if (this.world.groundTop(Math.floor((x + 13) / TILE)) !== null) {
      this.world.add(new Okada(this.world, x, this.y, this.dir));
      Sound.play('horn');
    }
  }

  // The warning sits on the side the okada is coming from.
  draw(ctx) {
    if ((this.timer >> 2) % 2) Assets.draw(ctx, 'items', 'warn', this.dir < 0 ? VIEW_W - 22 : 6, this.y - 2);
  }
}

// ---------------------------------------------------------------- pick-ups & props
class Coin extends Entity {
  constructor(world, x, y) {
    super(world, x + 2, y + 2, 12, 12);
  }

  touch() {
    this.collect();
  }

  collect() {
    if (this.dead) return;
    this.dead = true;
    this.world.game.addCoin();
    this.world.particles.push(new Particle(this.x + 2, this.y + 2, { life: 12, frames: ['sparkle1', 'sparkle2'] }));
  }

  draw(ctx, camX) {
    Assets.draw(ctx, 'items', `coin${1 + (Math.floor(this.world.frame / 8) % 4)}`, this.x - 1 - camX, this.y - 1);
  }
}

class CoinPop extends Entity {
  constructor(world, x, y) {
    super(world, x + 2, y - 14, 12, 12);
    this.vy = -5;
    this.alwaysActive = true;
    world.game.addCoin();
  }

  update() {
    this.t++;
    this.vy += 0.3;
    this.y += this.vy;
    if (this.t > 26) {
      this.dead = true;
      this.world.particles.push(new Particle(this.x + 2, this.y + 2, { life: 12, frames: ['sparkle1', 'sparkle2'] }));
    }
  }

  draw(ctx, camX) {
    Assets.draw(ctx, 'items', `coin${1 + (Math.floor(this.t / 3) % 4)}`, this.x - 1 - camX, this.y - 1);
  }
}

class PowerItem extends Entity {
  constructor(world, x, y, kind) {
    super(world, x + 2, y + 2, 12, 14);
    this.kind = kind;
    this.rise = 16;
    this.behindTiles = true;
    this.alwaysActive = true;
  }

  update() {
    this.t++;
    if (this.rise > 0) {
      this.y--;
      if (--this.rise === 0) {
        this.behindTiles = false;
        this.vx = { water: 0, beads: 1.3 }[this.kind] ?? 1;
        this.vy = this.kind === 'beads' ? -3 : 0;
      }
      return;
    }
    if (this.kind === 'water') return;
    this.vy = Math.min(this.vy + (this.kind === 'beads' ? 0.25 : 0.35), 5);
    if (this.world.moveX(this, this.vx)) this.vx *= -1;
    const hit = this.world.moveY(this, this.vy);
    if (hit === 1) this.vy = this.kind === 'beads' ? -4.2 : 0;
    else if (hit === -1) this.vy = 0;
    if (this.y > this.world.height + 16) this.dead = true;
  }

  touch(player) {
    if (this.rise > 8) return;
    this.dead = true;
    player.powerUp(this.kind);
  }

  draw(ctx, camX) {
    const bob = this.kind === 'water' && !this.rise ? Math.round(Math.sin(this.t * 0.1)) : 0;
    Assets.draw(ctx, 'items', this.kind, this.x - 2 - camX, this.bottom - 16 + bob);
  }
}

class Sachet extends Entity {
  constructor(world, x, y, dir) {
    super(world, x, y, 6, 6);
    this.vx = dir * 3.6;
    this.vy = 1;
    this.life = 100;
    this.alwaysActive = true;
  }

  update() {
    this.t++;
    this.vy = Math.min(this.vy + 0.35, 5);
    if (this.world.moveX(this, this.vx)) {
      this.burst();
      return;
    }
    const hit = this.world.moveY(this, this.vy);
    if (hit === 1) this.vy = -2.8;
    else if (hit === -1) this.vy = 1;
    if (--this.life <= 0 || !this.world.nearCamera(this, 16)) {
      this.dead = true;
      return;
    }
    for (const e of this.world.entities) {
      if (e instanceof Enemy && e.alive && overlaps(this, e)) {
        e.hitBySachet();
        this.burst();
        return;
      }
    }
  }

  burst() {
    this.dead = true;
    Sound.play('splash');
    this.world.particles.push(new Particle(this.cx - 6, this.y - 4, { life: 16, frames: ['splash1', 'splash2'], rate: 8 }));
  }

  draw(ctx, camX) {
    Assets.draw(ctx, 'items', (this.t >> 2) % 2 ? 'sachet2' : 'sachet1', this.x - 1 - camX, this.y - 1);
  }
}

// A piece of the family cloth, knocked loose. Scatters, then sits there to be picked up.
class AsoPiece extends Entity {
  constructor(world, x, y) {
    super(world, x, y, 12, 10);
    this.vx = rand(-2, 2);
    this.vy = rand(-4, -2.5);
    this.life = 600;
    this.alwaysActive = true;
  }

  update() {
    this.t++;
    if (--this.life <= 0) {
      this.dead = true;
      return;
    }
    this.vy = Math.min(this.vy + 0.3, 5);
    if (this.world.moveX(this, this.vx)) this.vx *= -0.4;
    const hit = this.world.moveY(this, this.vy);
    if (hit === 1) {
      this.vy = 0;
      this.vx *= 0.7;
    } else if (hit === -1) {
      this.vy = 0;
    }
    if (this.y > this.world.height + 16) this.dead = true;
  }

  touch(player) {
    if (this.t < 20) return;
    this.dead = true;
    this.world.game.addAso(1);
    Sound.play('coin');
  }

  draw(ctx, camX) {
    if (this.life < 120 && (this.life >> 2) % 2 === 0) return;
    Assets.draw(ctx, 'items', 'aso', this.x - camX, this.y);
  }
}

class Checkpoint extends Entity {
  constructor(world, x, y) {
    super(world, x, y + TILE - 48, 28, 48);
    this.tileY = y;
    this.active = false;
  }

  touch() {
    if (this.active) return;
    this.active = true;
    Sound.play('checkpoint');
    this.world.float('OWA O! BUS STOP DON SAVE YOU', this.cx, this.y - 6, '#63d68f');
  }

  draw(ctx, camX) {
    Assets.draw(ctx, 'decor', this.active ? 'busstop_on' : 'busstop', this.x - camX, this.y);
  }
}

// Where the stage ends. Which building that is comes from the level - the tailor's shop,
// a vulcanizer's shed, Mama Ebun's jetty - and only the last stage is the party itself.
class Goal extends Entity {
  constructor(world, x, y) {
    const name = world.def.goal || 'owambe';
    const { w, h } = Assets.size('decor', name);
    super(world, x, y + TILE - h, w, h);
    this.name = name;
    this.reached = false;
  }

  update() {
    this.t++;
    // Only the Owambe throws music into the air.
    if (this.reached && this.name === 'owambe' && this.t % 4 === 0) {
      this.world.particles.push(new Particle(this.x + rand(10, this.w - 10), this.y + 26, { vx: rand(-0.4, 0.4), vy: rand(0.3, 0.9), life: 80, frames: ['note1', 'note2'], rate: 10 }));
    }
  }

  touch(player) {
    if (this.reached || player.cx < this.x + Math.min(24, this.w / 3)) return;
    this.reached = true;
    this.world.game.levelClear();
  }

  draw(ctx, camX) {
    Assets.draw(ctx, 'decor', this.name, this.x - camX, this.y);
  }
}

class Platform extends Entity {
  constructor(world, x, y, kind) {
    super(world, x, kind === 'canoe' ? y + 4 : y + 2, 48, 6);
    this.kind = kind;
    this.dx = 0;
    this.dy = 0;
    this.homeY = this.y;
    this.vx = kind === 'canoe' ? 0.8 : 0;
    this.vy = 0;
    if (kind === 'lift') {
      this.maxY = this.y;
      this.minY = this.y - 6 * TILE;
      const liftsSoFar = world.entities.filter((e) => e instanceof Platform && e.kind === 'lift').length;
      if (liftsSoFar % 2) this.y = this.minY;
      this.vy = liftsSoFar % 2 ? 0.7 : -0.7;
    }
  }

  update() {
    const px = this.x;
    const py = this.y;
    if (this.kind === 'raft') {
      // Stand on it and it settles into the water; step off and it floats back up. The
      // sink is slow on purpose: you get about two seconds to cross and jump off before
      // your feet go under, which is the whole point of the thing.
      const carrying = this.world.player.ride === this;
      this.y += carrying ? 0.14 : -0.5;
      this.y = clamp(this.y, this.homeY, this.homeY + 26);
    } else if (this.kind === 'canoe') {
      this.x += this.vx;
      if (this.world.solidAt(this.vx > 0 ? this.x + this.w : this.x - 1, this.y + 2)) {
        this.x = px;
        this.vx *= -1;
      }
    } else {
      this.y += this.vy;
      if (this.y <= this.minY || this.y >= this.maxY) {
        this.y = clamp(this.y, this.minY, this.maxY);
        this.vy *= -1;
      }
    }
    this.dx = this.x - px;
    this.dy = this.y - py;
    const p = this.world.player;
    if (p.ride === this && p.state === 'play') {
      if (this.dx) this.world.moveX(p, this.dx);
      p.y = this.y - p.h;
    }
  }

  draw(ctx, camX) {
    const x = Math.round(this.x) - camX;
    if (this.kind === 'canoe' || this.kind === 'raft') {
      Assets.draw(ctx, 'decor', 'canoe', x, this.y - 2);
      return;
    }
    ctx.fillStyle = '#d9d0bf';
    ctx.fillRect(x + 2, 0, 1, Math.round(this.y) - 2);
    ctx.fillRect(x + 45, 0, 1, Math.round(this.y) - 2);
    Assets.draw(ctx, 'decor', 'lift', x, this.y - 4);
  }
}
