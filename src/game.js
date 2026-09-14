/* SUPER OGA - game states, story screens, HUD, and the main loop. */
'use strict';

const DEATH_LINES = {
  hit: 'E DON CAST!',
  fall: 'GUTTER DON SWALLOW YOU!',
  water: 'LAGOON DON CARRY YOU!',
  time: 'TIME DON FINISH! SAPA DON CATCH YOU.',
};

const STARTING_LIVES = 5;

const Game = {
  state: 'loading', // loading | error | title | credits | story | intro | play | clear | gameover | victory
  stateTime: 0,
  paused: false,
  levelIndex: 0,
  lives: 5,
  score: 0,
  naira: 100,
  // Is Tunde carrying the family cloth, and how much of it is left? The whole story is
  // this changing hands, and pieces spill every time he takes a hit.
  aso: false,
  asoPieces: 0,
  coinsFound: 0,
  // How the agberos on this road feel about him: settle with them and word spreads.
  reputation: 0,
  time: 0,
  timeTick: 0,
  form: 'small',
  hurry: false,
  fromCheckpoint: false,
  clearStep: 0,
  advance: 1,
  storyIndex: 0,
  storyChars: 0,
  world: null,
  dialog: null,
  banner: null,
  toast: null,
  confetti: [],
  progress: 0,
  error: null,
  touchFlags: '',
  // Cheat mode: nothing can kill Oga. Off unless the page is opened with ?cheat,
  // and toggled any time with I, so an ordinary game is never affected.
  cheat: typeof location !== 'undefined' && /[?&]cheat\b/.test(location.search || ''),
  hiscore: Store.get('hiscore', 0),

  boot() {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d');
    Assets.buildFont();
    this.fit();
    addEventListener('resize', () => this.fit());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'play' && !this.paused && !this.dialog) this.togglePause();
    });
    Input.init(() => Sound.unlock());
    requestAnimationFrame((t) => this.frame(t));
    Assets.load((p) => (this.progress = p))
      .then(() => this.setState('title'))
      .catch((err) => {
        console.error(err);
        this.error = err;
        this.setState('error');
      });
  },

  // One 400x224 canvas, scaled up by CSS with hard pixel edges.
  fit() {
    const scale = Math.min(innerWidth / VIEW_W, innerHeight / VIEW_H);
    this.canvas.style.width = `${Math.floor(VIEW_W * scale)}px`;
    this.canvas.style.height = `${Math.floor(VIEW_H * scale)}px`;
  },

  // Fixed 60 updates per second, drawing once per animation frame.
  frame(now) {
    // Queue the next frame before doing any work: an error while updating or drawing
    // should show up in the console, not silently stop the whole game.
    requestAnimationFrame((t) => this.frame(t));
    this.acc = Math.min((this.acc || 0) + (now - (this.last ?? now)), 250);
    this.last = now;
    while (this.acc >= 1000 / 60) {
      this.update();
      this.acc -= 1000 / 60;
    }
    this.render();
  },

  setState(state) {
    this.state = state;
    this.stateTime = 0;
  },

  // ------------------------------------------------------------ updates
  update() {
    Input.update();
    this.stateTime++;
    if (this.toast && ++this.toast.t > 90) this.toast = null;
    if (Input.pressed.mute) this.toast = { text: Sound.toggleMute() ? 'GBEDU DON OFF (M)' : 'GBEDU DON ON (M)', t: 0 };
    if (Input.pressed.cheat) {
      this.cheat = !this.cheat;
      Sound.play('select');
      this.toast = { text: this.cheat ? 'CHEAT MODE ON: NOTHING FIT KILL YOU (I)' : 'CHEAT MODE OFF (I)', t: 0 };
    }

    switch (this.state) {
      case 'title': this.updateTitle(); break;
      case 'credits': if (Input.confirm() || Input.pressed.credits || Input.pressed.pause) this.setState('title'); break;
      case 'story': this.updateStory(); break;
      case 'intro': if (this.stateTime > 180 || (this.stateTime > 30 && Input.confirm())) this.beginPlay(); break;
      case 'play': this.updatePlay(); break;
      case 'clear': this.updateClear(); break;
      case 'gameover': if (this.stateTime > 90 && Input.confirm()) this.setState('title'); break;
      case 'victory': this.updateVictory(); break;
      default: break;
    }
    this.syncTouchButtons();
  },

  // Show the contextual ENTER / COMOT touch buttons only when they do something.
  syncTouchButtons() {
    const player = this.state === 'play' && !this.dialog && this.world ? this.world.player : null;
    const riding = !!(player && player.vehicle);
    const near = !!(player && player.state === 'play' && this.world.interactable(player));
    const flags = `${riding}|${near}`;
    if (flags === this.touchFlags) return;
    this.touchFlags = flags;
    document.body.classList.toggle('riding', riding);
    document.body.classList.toggle('near-ride', near);
  },

  updateTitle() {
    if (Sound.ctx && !Sound.song) Sound.startMusic('title');
    if (Input.pressed.credits) {
      Sound.play('select');
      this.setState('credits');
    } else if (this.stateTime > 20 && Input.confirm()) {
      Sound.unlock();
      Sound.play('select');
      Object.assign(this, { levelIndex: 0, lives: STARTING_LIVES, score: 0, naira: 100, aso: false, asoPieces: 0, coinsFound: 0, reputation: 0, form: 'small', storyIndex: 0, storyChars: 0 });
      this.setState('story');
    }
  },

  updateStory() {
    if (Sound.ctx && !Sound.song) Sound.startMusic('title');
    if (Input.pressed.pause) {
      this.startLevel(false);
      return;
    }
    const text = PROLOGUE[this.storyIndex];
    if (this.storyChars < text.length) {
      this.storyChars = Input.confirm() ? text.length : this.storyChars + 1;
      if (this.stateTime % 3 === 0) Sound.play('blip');
    } else if (Input.confirm()) {
      this.storyIndex++;
      this.storyChars = 0;
      if (this.storyIndex >= PROLOGUE.length) this.startLevel(false);
    }
  },

  startLevel(fromCheckpoint) {
    this.fromCheckpoint = fromCheckpoint;
    Sound.stopMusic();
    Sound.stopEngine();
    Sound.stopAmbience();
    this.setState('intro');
  },

  beginPlay() {
    const level = LEVELS[this.levelIndex];
    this.world = new World(this, this.levelIndex, this.fromCheckpoint);
    this.world.player.setForm(this.form);
    Object.assign(this, { time: level.time, timeTick: 0, hurry: false, banner: null, paused: false, dialog: null, clearStep: 0 });
    Input.reset();
    Sound.startMusic(level.song);
    Sound.duckMusic(false);
    Sound.setAmbience(level.ambience);
    this.setState('play');
  },

  openDialog(kind, ctx = {}) {
    if (this.dialog) return;
    const world = this.world;
    world.player.vx = 0;
    this.banner = null;
    this.dialog = new Dialog(kind, { game: this, world, player: world.player, ...ctx });
  },

  updatePlay() {
    if (this.dialog) {
      this.dialog.update();
      if (this.dialog.closed) this.dialog = null;
      return;
    }
    // Enter both skips the stage intro and pauses, so ignore it for a moment after the
    // stage starts - otherwise tapping through the intro drops you straight into PAUSE.
    if (this.stateTime > 12 && (Input.pressed.pause || Input.pressed.start)) this.togglePause();
    if (this.paused) return;
    const world = this.world;
    world.update();
    if (this.banner && ++this.banner.t > 150) this.banner = null;
    const player = world.player;
    if (player.state === 'play' && ++this.timeTick >= 40) {
      this.timeTick = 0;
      this.time = Math.max(0, this.time - 1);
      if (this.time === 100) {
        this.hurry = true;
        Sound.setSpeed(1.15);
        Sound.play('warn');
        this.say('TIME DEY GO O! SHARP SHARP!', '#ffcd3a');
      }
      if (this.time === 0) player.die('time');
    } else if (player.state === 'dead' && player.deathTimer > 160) {
      this.lives--;
      if (this.lives <= 0) {
        this.saveHiscore();
        Sound.stopAmbience();
        Sound.play('gameOver');
        this.setState('gameover');
      } else {
        this.startLevel(!!(world.checkpoint && world.checkpoint.active));
      }
    }
  },

  togglePause() {
    this.paused = !this.paused;
    Sound.play('pause');
    Sound.pauseMusic(this.paused);
    Input.reset();
  },

  onPlayerDied(cause) {
    this.form = 'small';
    this.hurry = false;
    this.say(DEATH_LINES[cause] || DEATH_LINES.hit, '#e3412f');
  },

  levelClear(height = 0, advance = 1) {
    const player = this.world.player;
    if (player.vehicle) player.dismount();
    Object.assign(player, { state: 'win', invuln: 0, odogwu: 0 });
    this.form = player.form;
    this.clearStep = 0;
    this.advance = advance;
    Sound.stopMusic();
    Sound.stopAmbience();
    Sound.duckMusic(false);
    Sound.play('clear');
    this.say(height > 0.75
      ? 'TOP OF THE POLE! OSHEY BABA!'
      : pick(['YOU DON REACH! CHOP LIFE!', 'E CHOKE! STAGE DON CLEAR!', 'OSHEY! ONE DOWN!']), '#63d68f');
    this.setState('clear');
  },

  // Walk in, count the time bonus, hear from the family, then move on.
  updateClear() {
    this.world.update();
    if (this.dialog) {
      this.dialog.update();
      if (this.dialog.closed) {
        this.dialog = null;
        this.clearStep = 3;
        this.stateTime = 0;
      }
      return;
    }
    if (this.clearStep === 0 && this.stateTime > 90) {
      if (this.time > 0) {
        const chunk = Math.min(this.time, 3);
        this.time -= chunk;
        this.score += chunk * 50;
        if (this.stateTime % 3 === 0) Sound.play('tick');
      } else {
        this.clearStep = 1;
        this.stateTime = 0;
      }
    } else if (this.clearStep === 1 && this.stateTime > 40) {
      this.clearStep = 2;
      const level = LEVELS[this.levelIndex];
      const host = this.world.entities.find((e) => e instanceof Npc && e.kind === level.host);
      this.openDialog(level.host, { npc: host });
    } else if (this.clearStep === 3 && this.stateTime > 30) {
      this.saveHiscore();
      if (this.levelIndex === LEVELS.length - 1) {
        this.confetti = [];
        Sound.play('victory');
        this.setState('victory');
      } else {
        this.levelIndex = Math.min(LEVELS.length - 1, this.levelIndex + (this.advance || 1));
        this.startLevel(false);
      }
    }
  },

  updateVictory() {
    if (this.stateTime % 3 === 0) {
      const frames = pick([['note1', 'note2'], ['sparkle1', 'sparkle2'], ['coin1', 'coin2', 'coin3', 'coin4']]);
      this.confetti.push(new Particle(rand(0, VIEW_W), -10, { vx: rand(-0.5, 0.5), vy: rand(0.6, 1.4), life: 260, frames, rate: 8 }));
    }
    for (const c of this.confetti) c.update();
    this.confetti = this.confetti.filter((c) => c.life > 0);
    if (Sound.ctx && !Sound.song && this.stateTime > 150) Sound.startMusic('odogwu');
    if (this.stateTime > 120 && Input.confirm()) {
      Sound.stopMusic();
      this.setState('title');
    }
  },

  addScore(points, x, y, text) {
    this.score += points;
    if (x !== undefined && this.world) this.world.float(text || String(points), x, y, text ? '#ffcd3a' : '#f8f4ea');
  },

  addCoin() {
    this.naira += NAIRA_PER_COIN;
    this.score += 50;
    Sound.play('coin');
    // A hundred coins is a life, counted on what you pick up, not what you still hold.
    if (++this.coinsFound % 100 === 0) this.addLife();
  },

  spend(amount) {
    this.naira -= amount;
    Sound.play('cash');
    const p = this.world.player;
    this.world.float(`-₦${amount}`, p.cx, p.y - 14, '#ffcd3a');
  },

  earn(amount) {
    if (!amount) return;
    this.naira += amount;
    Sound.play('cash');
    const p = this.world.player;
    this.world.float(`+₦${amount}`, p.cx, p.y - 14, '#63d68f');
  },

  // Pieces of the cloth knock loose when he is hit, and can be picked back up.
  dropAso(count, from) {
    if (!this.aso || this.asoPieces <= 0) return;
    const lost = Math.min(count, this.asoPieces);
    this.asoPieces -= lost;
    for (let i = 0; i < lost; i++) this.world.add(new AsoPiece(this.world, from.cx - 6, from.y + 4));
    this.world.float(`-${lost} ASO-EBI!`, from.cx, from.y - 18, '#e3412f');
  },

  addAso(count) {
    this.asoPieces = Math.min(25, this.asoPieces + count);
  },

  addLife(x, y) {
    this.lives++;
    Sound.play('oneUp');
    const p = this.world.player;
    this.world.float('1UP! GOD DEY!', x ?? p.cx, (y ?? p.y) - 8, '#63d68f');
  },

  say(text, color = '#f8f4ea') {
    this.banner = { text, color, t: 0 };
  },

  saveHiscore() {
    if (this.score <= this.hiscore) return;
    this.hiscore = this.score;
    Store.set('hiscore', this.score);
  },

  // ------------------------------------------------------------ drawing
  render() {
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    switch (this.state) {
      case 'loading': this.clearScreen(ctx); this.drawLoading(ctx); break;
      case 'error': this.clearScreen(ctx); this.drawError(ctx); break;
      case 'title': this.photoScreen(ctx, 'title_danfo', [0.3, 0.5, 0.92]); this.drawTitle(ctx); break;
      case 'story': this.photoScreen(ctx, 'title_danfo', [0.78, 0.84, 0.95]); this.drawStory(ctx); break;
      case 'credits': this.clearScreen(ctx); this.drawCredits(ctx); break;
      case 'intro': this.clearScreen(ctx); this.drawIntro(ctx); break;
      case 'gameover': this.clearScreen(ctx); this.drawGameOver(ctx); break;
      case 'victory': this.photoScreen(ctx, 'victory_sunset', [0.3, 0.4, 0.7]); this.drawVictory(ctx); break;
      default:
        this.world.draw(ctx);
        this.drawHud(ctx);
        if (this.dialog) this.dialog.draw(ctx);
        else this.drawBanner(ctx);
        if (this.paused) this.drawPause(ctx);
    }
    if (this.toast) {
      const w = Assets.textWidth(this.toast.text) + 12;
      this.shade(ctx, (VIEW_W - w) / 2, VIEW_H - 22, w, 13, 0.8);
      drawText(ctx, this.toast.text, VIEW_W / 2, VIEW_H - 19, { align: 'center' });
    }
  },

  clearScreen(ctx, color = INK) {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  },

  // A full-screen photo, darkened top-to-bottom so the pixel text stays readable.
  photoScreen(ctx, name, [top, middle, bottom]) {
    const photo = Assets.photos[name];
    ctx.drawImage(photo, Math.round((VIEW_W - photo.width) / 2), 0);
    const fade = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    fade.addColorStop(0, `rgba(26, 20, 35, ${top})`);
    fade.addColorStop(0.5, `rgba(26, 20, 35, ${middle})`);
    fade.addColorStop(1, `rgba(26, 20, 35, ${bottom})`);
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  },

  shade(ctx, x, y, w, h, alpha) {
    ctx.fillStyle = `rgba(26, 20, 35, ${alpha})`;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  },

  centered(ctx, lines, y, options = {}) {
    lines.forEach((line, i) => drawText(ctx, line, VIEW_W / 2, y + i * (options.gap || 11), { align: 'center', ...options }));
  },

  blink(period = 32) {
    return Math.floor(this.stateTime / period) % 2 === 0;
  },

  drawLoading(ctx) {
    drawText(ctx, 'LOADING...', VIEW_W / 2, 84, { align: 'center', scale: 2, color: '#ffcd3a' });
    drawText(ctx, 'ABEG EXERCISE PATIENCE', VIEW_W / 2, 108, { align: 'center' });
    ctx.fillStyle = '#3a3142';
    ctx.fillRect(100, 128, 200, 8);
    ctx.fillStyle = '#1f9d57';
    ctx.fillRect(100, 128, Math.round(200 * this.progress), 8);
  },

  drawError(ctx) {
    drawText(ctx, 'WAHALA DEY!', VIEW_W / 2, 44, { align: 'center', scale: 2, color: '#e3412f' });
    const lines = location.protocol === 'file:' && !window.ASSET_DATA
      ? ['THIS GAME NO FIT LOAD FROM FILE:// YET.', 'RUN  NPM RUN BUILD  AND OPEN INDEX.HTML AGAIN,', 'OR RUN  NPM START  THEN OPEN', 'HTTP://LOCALHOST:5055']
      : ['SOMETHING NO GREE LOAD:', ...wrapText(String(this.error && this.error.message), 360)];
    this.centered(ctx, lines, 84, { gap: 14 });
  },

  drawTitle(ctx) {
    const bob = Math.round(Math.sin(this.stateTime * 0.05) * 2);
    const sup = Assets.size('ui', 'logo_super');
    const oga = Assets.size('ui', 'logo_oga');
    Assets.draw(ctx, 'ui', 'logo_super', (VIEW_W - sup.w) / 2, 10 + bob);
    Assets.draw(ctx, 'ui', 'logo_oga', (VIEW_W - oga.w) / 2, 8 + sup.h + bob);
    const subY = 10 + sup.h + oga.h;
    drawText(ctx, 'WAHALA FOR EKO!', VIEW_W / 2, subY, { align: 'center', scale: 2, color: '#ffcd3a' });

    const touch = document.body.classList.contains('touch-on');
    if (this.blink()) drawText(ctx, touch ? 'TAP MAKE WE START!' : 'OYA, PRESS ENTER!', VIEW_W / 2, subY + 24, { align: 'center' });
    drawText(ctx, touch ? '◀ ▶ WAKA  JUMP  RUN  ENTER  COMOT' : '← → WAKA  Z JUMP  X RUN/THROW  ↑ TALK  ↓ COMOT', VIEW_W / 2, subY + 40, { align: 'center', color: '#a8a2b4' });
    drawText(ctx, `HI ${this.hiscore}`, VIEW_W - 6, 6, { align: 'right', color: '#ffcd3a' });
    if (!touch) drawText(ctx, 'C: CREDITS   M: GBEDU', 6, 6, { color: '#a8a2b4' });

    const ground = VIEW_H - TILE;
    for (let x = -(this.stateTime % TILE); x < VIEW_W; x += TILE) Assets.draw(ctx, 'tiles', 'street_top', x, ground);
    const spin = Math.floor(this.stateTime / 5) % 2;
    Assets.draw(ctx, 'hero', 'b_sit', 204, ground - 36);
    Assets.draw(ctx, 'rides', spin ? 'bike2' : 'bike1', 200, ground - 24);
    Assets.draw(ctx, 'enemies', spin ? 'goat_charge' : 'goat_walk2', 140 + Math.round(Math.sin(this.stateTime * 0.04) * 10), ground - 18);
  },

  drawStory(ctx) {
    Assets.drawScaled(ctx, 'hero', 'b_idle', 20, 58, 3);
    let y = 30;
    PROLOGUE.slice(0, this.storyIndex + 1).forEach((full, i) => {
      let budget = i === this.storyIndex ? this.storyChars : Infinity;
      for (const line of wrapText(full, 272)) {
        drawText(ctx, line.slice(0, Math.max(0, budget)), 112, y, { color: i === this.storyIndex ? '#f8f4ea' : '#a8a2b4' });
        budget -= line.length;
        y += 11;
      }
      y += 5;
    });
    const typing = this.storyChars < PROLOGUE[this.storyIndex].length;
    if (!typing && this.blink(24)) drawText(ctx, 'ENTER >>', VIEW_W - 10, VIEW_H - 16, { align: 'right', color: '#ffcd3a' });
    drawText(ctx, 'ESC: SKIP STORY', 10, VIEW_H - 16, { color: '#6b6275' });
  },

  drawCredits(ctx) {
    drawText(ctx, 'CREDITS', VIEW_W / 2, 10, { align: 'center', scale: 2, color: '#ffcd3a' });
    drawText(ctx, 'PHOTOS FROM PEXELS (PEXELS LICENSE)', VIEW_W / 2, 34, { align: 'center', color: '#63d68f' });
    this.centered(ctx, window.PHOTO_CREDITS.map((c) => `${c.use}: ${c.author}`), 50, { gap: 12 });
    this.centered(ctx, ['STORY, CHARACTERS & SPRITES: ORIGINAL, DRAWN IN CODE (SVG -> JPG)', 'MUSIC & SOUND: ORIGINAL, SYNTHESISED LIVE WITH WEBAUDIO'], 158, { gap: 12, color: '#86d7ff' });
    if (this.blink()) drawText(ctx, 'PRESS ENTER TO GO BACK', VIEW_W / 2, 200, { align: 'center', color: '#a8a2b4' });
  },

  drawIntro(ctx) {
    const level = LEVELS[this.levelIndex];
    drawText(ctx, `WORLD ${level.id}`, VIEW_W / 2, 24, { align: 'center', scale: 3, color: '#ffcd3a' });
    drawText(ctx, level.name, VIEW_W / 2, 56, { align: 'center', scale: 2 });
    Assets.draw(ctx, 'hero', 'icon_head', VIEW_W / 2 - 40, 80);
    drawText(ctx, `× ${this.lives}`, VIEW_W / 2 - 20, 83);
    drawText(ctx, `₦${this.naira}`, VIEW_W / 2 + 14, 83, { color: '#ffcd3a' });
    if (this.aso) drawText(ctx, `CARRYING ${this.asoPieces} PIECES OF ASO-EBI`, VIEW_W / 2, 94, { align: 'center', color: '#63d68f' });
    this.centered(ctx, wrapText(level.story, 340), 106);
    this.centered(ctx, wrapText(`TIP: ${level.tip}`, 340), 146, { color: '#a8a2b4' });
    if (this.fromCheckpoint) drawText(ctx, 'YOU GO START FROM THE BUS STOP', VIEW_W / 2, 186, { align: 'center', color: '#63d68f' });
    if (this.stateTime > 30 && this.blink(24)) drawText(ctx, 'ENTER >>', VIEW_W - 10, VIEW_H - 16, { align: 'right', color: '#ffcd3a' });
  },

  drawHud(ctx) {
    this.shade(ctx, 0, 0, VIEW_W, 24, 0.35);
    drawText(ctx, 'OGA TUNDE', 8, 4);
    drawText(ctx, String(this.score).padStart(7, '0'), 8, 13);
    Assets.draw(ctx, 'items', 'coin1', 100, 5);
    drawText(ctx, `₦${this.naira}`, 116, 9, { color: '#ffcd3a' });
    drawText(ctx, 'WORLD', 196, 4, { align: 'center' });
    drawText(ctx, LEVELS[this.levelIndex].id, 196, 13, { align: 'center' });
    Assets.draw(ctx, 'hero', 'icon_head', 236, 6);
    drawText(ctx, `×${this.lives}`, 254, 9);
    if (this.aso) drawText(ctx, `ASO-EBI ${this.asoPieces}`, 284, 4, { color: this.asoPieces < 20 ? '#e3412f' : '#ffcd3a' });
    const ride = this.world.player.vehicle;
    if (ride) {
      const secs = Math.ceil(ride.time / 60);
      const label = ride.kind === 'keke' ? `KEKE ${'♥'.repeat(ride.hp)}` : 'OKADA';
      drawText(ctx, `${label} ${secs}`, 284, 13, { color: secs <= 3 && this.world.frame % 16 < 8 ? '#e3412f' : '#63d68f' });
    }
    if (this.cheat) drawText(ctx, 'CHEAT', 196, 21, { align: 'center', color: '#63d68f' });
    drawText(ctx, 'TIME', VIEW_W - 8, 4, { align: 'right' });
    const warn = this.hurry && Math.floor(this.world.frame / 16) % 2 === 0;
    drawText(ctx, String(this.time).padStart(3, '0'), VIEW_W - 8, 13, { align: 'right', color: warn ? '#e3412f' : '#f8f4ea' });
  },

  drawBanner(ctx) {
    if (!this.banner) return;
    const lines = wrapText(this.banner.text, 300);
    const w = Math.max(...lines.map((l) => Assets.textWidth(l))) + 16;
    this.shade(ctx, (VIEW_W - w) / 2, 34, w, lines.length * 11 + 8, 0.72);
    this.centered(ctx, lines, 39, { color: this.banner.color });
  },

  drawPause(ctx) {
    this.shade(ctx, 0, 0, VIEW_W, VIEW_H, 0.6);
    drawText(ctx, 'PAUSE', VIEW_W / 2, 74, { align: 'center', scale: 3, color: '#ffcd3a' });
    drawText(ctx, 'ABEG REST SMALL...', VIEW_W / 2, 108, { align: 'center' });
    drawText(ctx, 'PRESS ENTER TO CONTINUE', VIEW_W / 2, 132, { align: 'center', color: '#a8a2b4' });
  },

  drawGameOver(ctx) {
    drawText(ctx, 'E DON CAST!', VIEW_W / 2, 48, { align: 'center', scale: 3, color: '#e3412f' });
    drawText(ctx, 'GAME OVER', VIEW_W / 2, 84, { align: 'center', scale: 2 });
    Assets.draw(ctx, 'hero', 's_dead', VIEW_W / 2 - 8, 104);
    drawText(ctx, `SCORE ${this.score}`, VIEW_W / 2, 138, { align: 'center', color: '#ffcd3a' });
    drawText(ctx, `HI ${this.hiscore}`, VIEW_W / 2, 150, { align: 'center', color: '#a8a2b4' });
    drawText(ctx, 'RONKE STILL DEY WAIT FOR HER ASO-EBI...', VIEW_W / 2, 168, { align: 'center', color: '#a8a2b4' });
    if (this.stateTime > 90 && this.blink()) drawText(ctx, 'NO SHAKING. PRESS ENTER, TRY AGAIN!', VIEW_W / 2, 190, { align: 'center' });
  },

  drawVictory(ctx) {
    for (const c of this.confetti) c.draw(ctx, 0);
    drawText(ctx, 'YOU BE ODOGWU!', VIEW_W / 2, 24, { align: 'center', scale: 3, color: '#ffcd3a', outline: true });
    drawText(ctx, 'RONKE WEDDING DON SWEET, AND THE ASO-EBI REACH ON TIME.', VIEW_W / 2, 58, { align: 'center', outline: true });
    drawText(ctx, 'EKO O NI BAJE!', VIEW_W / 2, 74, { align: 'center', scale: 2, color: '#63d68f', outline: true });
    drawText(ctx, `ASO-EBI DELIVERED ${this.asoPieces} / 25`, VIEW_W / 2, 90, { align: 'center', color: this.asoPieces >= 25 ? '#63d68f' : '#ffcd3a', outline: true });
    drawText(ctx, `FINAL SCORE ${this.score}`, VIEW_W / 2, 102, { align: 'center', outline: true });
    drawText(ctx, `MONEY LEFT ₦${this.naira}   HI ${this.hiscore}`, VIEW_W / 2, 114, { align: 'center', color: '#ffcd3a', outline: true });
    const hop = Math.abs(Math.sin(this.stateTime * 0.08)) * 10;
    Assets.draw(ctx, 'people', 'bride_1', VIEW_W / 2 + 20, 158);
    Assets.draw(ctx, 'hero', Math.floor(this.stateTime / 30) % 2 ? 'b_jump_gold' : 'b_jump', VIEW_W / 2 - 16, 150 - hop);
    if (this.stateTime > 120 && this.blink()) drawText(ctx, 'PRESS ENTER TO PLAY AGAIN', VIEW_W / 2, 200, { align: 'center', outline: true });
  },
};

Game.boot();
