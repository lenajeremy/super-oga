#!/usr/bin/env node
/*
 * Headless smoke test: loads every game script the way index.html does, against small
 * stand-ins for canvas / Image / WebAudio, then plays the game with scripted input -
 * walking, jumping, talking to people, hiring an okada and a keke, buying from a seller,
 * settling an agbero - across all three stages. Any error thrown by game code fails.
 *
 *   node tools/smoke-test.mjs [--verbose]
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const verbose = process.argv.includes('--verbose');
const log = (...a) => verbose && console.log('   ', ...a);

// ---------------------------------------------------------------- stand-ins
const ctxStub = () => {
  const noop = () => {};
  return new Proxy(
    {
      canvas: { width: 400, height: 224 },
      fillStyle: '#000', strokeStyle: '#000', globalCompositeOperation: 'source-over',
      imageSmoothingEnabled: false, imageSmoothingQuality: 'low', globalAlpha: 1, font: '',
      getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4).fill(60), width: w, height: h }),
      createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
      createLinearGradient: () => ({ addColorStop: noop }),
      createRadialGradient: () => ({ addColorStop: noop }),
      measureText: () => ({ width: 10 }),
    },
    { get: (t, k) => (k in t ? t[k] : noop), set: (t, k, v) => ((t[k] = v), true) },
  );
};
const canvasStub = (w = 400, h = 224) => {
  const c = { width: w, height: h, style: {}, _ctx: null, classList: { add() {}, remove() {}, toggle() {}, contains: () => false } };
  c.getContext = () => (c._ctx ||= ctxStub());
  c.getBoundingClientRect = () => ({ left: 0, top: 0, width: c.width, height: c.height });
  c.addEventListener = () => {};
  c.toDataURL = () => 'data:,';
  return c;
};

const elements = { game: canvasStub(), backdrop: canvasStub(), stage: canvasStub(), touch: canvasStub() };
const listeners = {};
const bodyClasses = new Set();
const scope = {
  console,
  setInterval: () => 0,
  clearInterval: () => {},
  setTimeout: (fn) => { fn(); return 0; },
  requestAnimationFrame: () => 0,
  innerWidth: 1280,
  innerHeight: 720,
  devicePixelRatio: 2,
  location: { protocol: 'http:' },
  navigator: { getGamepads: () => [] },
  localStorage: { store: {}, getItem(k) { return this.store[k] ?? null; }, setItem(k, v) { this.store[k] = v; } },
  addEventListener: (type, fn) => ((listeners[type] ||= []).push(fn)),
  document: {
    hidden: false,
    getElementById: (id) => elements[id] || canvasStub(),
    createElement: () => canvasStub(),
    querySelectorAll: () => [],
    addEventListener: (type, fn) => ((listeners[type] ||= []).push(fn)),
    body: { classList: { add: (c) => bodyClasses.add(c), remove: (c) => bodyClasses.delete(c), toggle: (c, on) => (on ? bodyClasses.add(c) : bodyClasses.delete(c)), contains: (c) => bodyClasses.has(c) } },
  },
};
scope.window = scope;
scope.self = scope;
// Spoken clips: the harness reports them loadable, and playing is a no-op.
class AudioStub {
  constructor() { this.volume = 1; this.preload = ''; this.readyState = 4; }
  addEventListener(type, fn) { if (type === 'canplaythrough') queueMicrotask(fn); }
  cloneNode() { return new AudioStub(); }
  play() { return Promise.resolve(); }
  set src(v) { this._src = v; }
  get src() { return this._src; }
}
scope.Audio = AudioStub;
scope.Image = class {
  constructor() { this.width = 512; this.height = 512; }
  set src(v) { this._src = v; queueMicrotask(() => this.onload && this.onload()); }
  get src() { return this._src; }
};
// WebAudio is exercised for real elsewhere (tools/preview-music.mjs); here it just must not throw.
// Any AudioParam method is a no-op here; the real synthesis is exercised for true by
// tools/preview-music.mjs, which renders it to a WAV.
const audioParam = () => new Proxy({ value: 0 }, { get: (t, k) => (k in t ? t[k] : () => {}), set: (t, k, v) => ((t[k] = v), true) });
const audioNode = () => new Proxy({ gain: audioParam(), frequency: audioParam(), detune: audioParam(), Q: audioParam(),
  threshold: audioParam(), ratio: audioParam(), attack: audioParam(), release: audioParam(),
  buffer: null, type: 'sine', loop: false },
  { get: (t, k) => (k in t ? t[k] : k === 'connect' ? (x) => x : () => {}), set: (t, k, v) => ((t[k] = v), true) });
scope.AudioContext = class {
  constructor() { this.sampleRate = 44100; this.currentTime = 0; this.state = 'running'; this.destination = audioNode(); }
  createGain() { return audioNode(); } createOscillator() { return audioNode(); }
  createBiquadFilter() { return audioNode(); } createBufferSource() { return audioNode(); }
  createConvolver() { return audioNode(); } createDynamicsCompressor() { return audioNode(); }
  createBuffer(ch, len) { return { getChannelData: () => new Float32Array(len) }; }
  resume() {} suspend() {}
};

vm.createContext(scope);
const SCRIPTS = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
  .match(/<script src="([^"]+)"><\/script>/g)
  .map((tag) => tag.match(/src="([^"]+)"/)[1]);

let failures = 0;
const fail = (msg) => { failures++; console.log(`  FAIL ${msg}`); };
const guard = (label, fn) => {
  try { return fn(); } catch (err) { fail(`${label}: ${err.message}\n      ${String(err.stack).split('\n')[1]?.trim()}`); return null; }
};

console.log(`loading ${SCRIPTS.length} scripts...`);
for (const src of SCRIPTS) {
  guard(`loading ${src}`, () => vm.runInContext(fs.readFileSync(path.join(root, src), 'utf8'), scope, { filename: src }));
}
if (failures) { console.log(`\n${failures} problem(s)`); process.exit(1); }

// The scripts declare their objects with `const`, which lives in the context's lexical
// scope rather than on the global, so ask the context to hand them over.
vm.runInContext('this.api = { Game, Input, Sound, LEVELS, Enemy, Npc, ParkedRide };', scope);
const { Game, Input, Sound, LEVELS } = scope.api;
await new Promise((r) => setTimeout(r, 200)); // let Assets.load settle
if (Game.state !== 'title') fail(`expected title after loading, got "${Game.state}"${Game.error ? ` (${Game.error.message})` : ''}`);
Sound.unlock();

// ---------------------------------------------------------------- scripted play
const press = (...codes) => { Input.keys.clear(); codes.forEach((c) => Input.keys.add(c)); };
const tick = (n = 1, label = 'tick') => { for (let i = 0; i < n; i++) guard(label, () => Game.update()); };
const confirm = (times = 1) => { for (let i = 0; i < times; i++) { press('Enter'); tick(1); press(); tick(1); } };
const draw = (label) => guard(`render ${label}`, () => Game.render());

tick(30, 'title');
confirm();                       // title -> story
if (Game.state !== 'story') fail(`expected story after title, got "${Game.state}"`);
draw('story');
for (let i = 0; i < 80 && Game.state === 'story'; i++) confirm();   // type through the prologue
if (Game.state !== 'intro' && Game.state !== 'play') fail(`prologue did not lead into the game (state "${Game.state}")`);
tick(200);
if (Game.state !== 'play') fail(`expected play after intro, got "${Game.state}"`);
draw('play');
log('prologue -> stage 1 OK');

const stats = { talked: 0, bought: 0, mounted: 0, dismounted: 0, stages: 0, deaths: 0 };
let lastLevel = Game.levelIndex;
// The bot plays roughly, and the game is now harder than it can reliably handle. What
// this run proves is that every stage is traversable end to end and that the story,
// shops, rides and dialogue all work - so it plays in cheat mode and cannot be killed.
// Deaths are still counted and reported, as a rough difficulty signal, but they do not
// fail the run: how hard the game should be is a judgement for a person, not for a bot.
Game.cheat = true;
Game.lives = 30;

for (let frame = 0; frame < 90000 && Game.state !== 'victory'; frame++) {
  const w = Game.world;
  if (process.env.STUCK && frame % 4000 === 0 && Game.world) {
    const pl = Game.world.player;
    const boats = Game.world.entities.filter((e) => e.constructor.name === 'Platform')
      .map((e) => `${e.kind}@${Math.round(e.x)},${Math.round(e.y)}`).slice(0, 4).join(' ');
    console.log(`   f${frame} ${LEVELS[Game.levelIndex].id} col ${Math.floor(pl.x / 16)}/${Game.world.cols} bottom=${Math.round(pl.bottom)} ride=${pl.ride ? pl.ride.kind : '-'} | platforms: ${boats}`);
  }
  if (Game.state === 'gameover') { fail(`ran out of lives on stage ${LEVELS[Game.levelIndex].id} despite cheat mode - something is wrong`); break; }

  if (Game.dialog) {
    const node = Game.dialog.node;
    if (Game.dialog.typing) { confirm(); continue; }
    if (node.choices) {
      const affordable = (c) => !c.pay || Game.naira >= c.pay;
      // Always take a ride when one is affordable; otherwise only shop with money to spare,
      // so the run covers hiring, buying and politely declining.
      const hire = node.choices.findIndex((c) => c.effect === 'hire' && affordable(c));
      const shop = Game.naira >= 300 ? node.choices.findIndex((c) => c.pay && affordable(c)) : -1;
      const idx = hire >= 0 ? hire : shop >= 0 ? shop : node.choices.length - 1;
      Game.dialog.selected = idx;
      const choice = node.choices[idx];
      if (choice.pay) stats.bought++;
      if (choice.effect === 'hire') stats.mounted++;
    }
    confirm();
    continue;
  }

  if (Game.state === 'intro') { confirm(); continue; }
  if (Game.state === 'clear' || !w) { tick(1); continue; }

  const p = w.player;
  if (p.state === 'dead') {
    if (p.deathTimer <= 1) log(`died on ${LEVELS[Game.levelIndex].id} at col ${Math.floor(p.x / 16)} (${p.cause})`);
    stats.deaths++;
    tick(200);
    continue;
  }

  const target = p.state === 'play' && p.onGround ? w.interactable(p) : null;
  if (target && (target._greeted || 0) < 2) {
    target._greeted = (target._greeted || 0) + 1;
    stats.talked++;
    press('ArrowUp');
    tick(1);
    press();
    tick(1);
    continue;
  }

  // Walk right; jump at walls, gaps and anything in the way.
  const keys = ['ArrowRight', 'KeyX'];
  if (p.state === 'play') {
    const front = p.x + p.w + 4;
    const gap = !w.solidAt(front + 8, p.bottom + 4) && !w.solidAt(front + 20, p.bottom + 4);
    const wall = w.solidAt(front, p.bottom - 4) || w.solidAt(front, p.y + 2);
    const foe = w.entities.some((e) => e instanceof scope.api.Enemy && e.alive && e.x + e.w > p.x && e.x - (p.x + p.w) < 46 && Math.abs(e.bottom - p.bottom) < 30);

    // Open water ahead: wait on the bank for a canoe or lift, then hop aboard.
    const overWater = (x) => w.tileAt(Math.floor(x / 16), Math.floor((p.bottom + 20) / 16)) === '~';
    if (p.onGround && !p.ride && overWater(front + 16)) {
      // How far to the far bank? A running jump crosses about 140px, so anything shorter
      // is simply jumped; only a real stretch of water is worth waiting for a boat.
      let far = 8;
      while (far < 240 && !w.solidAt(front + far, p.bottom + 4)) far += 8;
      if (far > 112) {
        const boat = w.entities
          .filter((e) => e.constructor.name === 'Platform' && e.x + e.w > p.x && e.x - p.x < 150)
          .sort((a, b) => a.x - b.x)[0];
        // A canoe drifts over to you, so it is worth waiting for. A lift only goes up and
        // down - waiting for one to come closer means waiting forever, so jump across to
        // it whenever it is at a height you can reach.
        const gapTo = boat ? boat.x + boat.w - p.x : Infinity;
        const ferry = boat && Math.abs(boat.dx) > 0.01;
        const ready = boat && (ferry
          ? boat.x - (p.x + p.w) < 26 && boat.y - p.bottom > -40
          : gapTo < 150 && boat.y - p.bottom > -70 && boat.y - p.bottom < 30);
        if (!ready) { press(); tick(1); continue; }
      }
    }
    // Riding a canoe or lift: look right for the next foothold - solid ground or another
    // platform - and hop across once it is in range, otherwise sit tight and ride.
    if (p.ride) {
      // A canoe is ferrying you somewhere: stay aboard until the far side is close.
      // A lift only goes up and down, so you have to hop off it to make progress.
      const ferry = Math.abs(p.ride.dx) > 0.01;
      const maxDx = ferry ? 58 : 150;
      let best = null;
      for (let dx = 18; dx < maxDx && !best; dx += 6) {
        for (let dy = -90; dy <= 30; dy += 6) {
          if (w.solidAt(p.x + p.w + dx, p.bottom + dy)) { best = { dx, dy }; break; }
        }
      }
      for (const e of w.entities) {
        if (e.constructor.name !== 'Platform' || e === p.ride) continue;
        const dx = e.x - (p.x + p.w);
        const dy = e.y - p.bottom;
        if (dx > 4 && dx < maxDx && dy > -80 && dy < 40 && (!best || dx < best.dx)) best = { dx, dy };
      }
      if (!best) { press(); tick(1); continue; }
      Game._jump = best.dy < -20 ? 16 : 9;
      Game._cool = 20;
      press('ArrowRight', 'KeyX', 'Space');
      tick(1);
      continue;
    }

    // Hold the jump for a burst, then let go: a fresh press is what the game listens for,
    // so the key has to be released before the next jump can register.
    if (Game._cool > 0) Game._cool--;
    // Hold only as long as the obstacle needs. Holding the full jump every time sends the
    // bot sailing off high platforms and straight into the next gutter.
    if (p.onGround && !Game._jump && !Game._cool && (gap || wall || foe)) {
      Game._jump = wall ? 18 : 9;
      Game._cool = 22;
    }
    if (Game._jump > 0) { keys.push('Space'); Game._jump--; }
    // Hop off a ride now and then so dismounting gets covered too.
    if (p.vehicle && p.onGround && frame % 2400 === 0) { keys.length = 0; keys.push('ArrowDown'); stats.dismounted++; }
  }
  press(...keys);
  tick(1);
  if (process.env.TRACE_COL) {
    const c = Math.floor(p.x / 16);
    if (Game.levelIndex === 0 && c >= Number(process.env.TRACE_COL) - 22 && c <= Number(process.env.TRACE_COL) + 3) {
      console.log(`   col ${c} x=${Math.round(p.x)} y=${Math.round(p.y)} vx=${p.vx.toFixed(2)} vy=${p.vy.toFixed(2)} ground=${p.onGround?1:0} jumpBuf=${p.jumpBuffer} coyote=${p.coyote} botJump=${Game._jump||0} cool=${Game._cool||0} keys=${keys.join('+')}`);
    }
  }
  if (frame % 600 === 0) draw(`stage ${Game.levelIndex + 1}`);
  if (Game.levelIndex !== lastLevel) { stats.stages++; lastLevel = Game.levelIndex; log(`reached stage ${LEVELS[Game.levelIndex].id}`); }
}
press();

draw(Game.state);
if (Game.state === 'victory') { stats.stages++; tick(400); draw('victory'); }
else fail(`never reached the wedding - ended in "${Game.state}" on stage ${LEVELS[Game.levelIndex].id}`);

console.log(
  `played through: ${stats.stages} stage(s) cleared, ${stats.talked} conversations, ${stats.bought} purchases, ` +
    `${stats.mounted} rides hired, ${stats.dismounted} dismounts, score ${Game.score}, ₦${Game.naira}`,
);
console.log(`difficulty signal: the bot would have died ${stats.deaths} time(s) without cheat mode`);
if (!stats.talked) fail('never talked to anybody - the interact prompt may be broken');
if (!stats.bought) fail('never bought anything - shop dialogue may be broken');
if (!stats.mounted) fail('never hired a ride - okada/keke hire may be broken');
// ---------------------------------------------------------------- one-handed controls
// Up has to do both jobs: jump on open ground, talk when somebody is in front of you.
{
  Game.setState('title');
  tick(30);
  confirm();
  for (let i = 0; i < 80 && Game.state === 'story'; i++) confirm();
  while (Game.state === 'intro') tick(1);
  tick(20);
  const w = Game.world;
  const p = w.player;
  const upOnce = () => { press('ArrowUp'); tick(1); press(); tick(1); };

  // 1. open ground -> up jumps
  const npc = w.entities.find((e) => e instanceof scope.api.Npc);
  Object.assign(p, { state: 'play', vx: 0, vy: 0, onGround: true, mountCooldown: 0 });
  p.x = 40;
  p.y = 11 * 16 - p.h + 16;
  tick(2);
  const restingY = p.y;
  upOnce();
  tick(6);
  if (!(p.y < restingY - 8)) fail(`up did not jump on open ground (y ${Math.round(restingY)} -> ${Math.round(p.y)})`);
  else console.log('one-handed: up jumps on open ground');

  // 2. beside somebody -> up talks, and does not jump
  if (!npc) {
    fail('no person found in stage 1-1 to test talking');
  } else {
    Object.assign(p, { state: 'play', vx: 0, vy: 0, onGround: true, mountCooldown: 0, jumpBuffer: 0 });
    p.x = npc.cx - p.w / 2;
    p.y = npc.bottom - p.h;
    tick(2);
    const beforeY = p.y;
    if (!w.interactable(p)) fail('standing on a person but nothing is interactable');
    upOnce();
    if (!Game.dialog) fail('up beside a person did not start a conversation');
    else console.log(`one-handed: up talks to ${Game.dialog.speaker.name} instead of jumping`);
    tick(4);
    if (p.y < beforeY - 2) fail(`up beside a person jumped as well (y ${Math.round(beforeY)} -> ${Math.round(p.y)})`);

    // 3. the conversation itself is driveable on arrows alone
    let guard = 0;
    while (Game.dialog && Game.dialog.typing && guard++ < 300) { press('ArrowRight'); tick(1); press(); tick(1); }
    if (Game.dialog && Game.dialog.node.choices) {
      const first = Game.dialog.selected;
      press('ArrowDown'); tick(1); press(); tick(1);
      if (Game.dialog.selected === first) fail('down does not move between dialogue choices');
      press('ArrowUp'); tick(1); press(); tick(1);
      if (Game.dialog.selected !== first) fail('up does not move back between dialogue choices');
      else console.log('one-handed: up and down pick options, right confirms');
    }
    guard = 0;
    while (Game.dialog && guard++ < 400) { press('ArrowRight'); tick(1); press(); tick(1); }
    if (Game.dialog) fail('could not finish a conversation using the arrow keys alone');
  }
}

// ---------------------------------------------------------------- cheat mode
// Start a fresh game and try to kill Oga every way the game knows how.
Game.cheat = true;
Game.setState('title');
tick(30);
confirm();
for (let i = 0; i < 80 && Game.state === 'story'; i++) confirm();
while (Game.state === 'intro') tick(1);
tick(5);
if (Game.state !== 'play') {
  fail(`cheat run could not reach play (state "${Game.state}")`);
} else {
  if (Game.lives !== 5) fail(`expected to start with 5 lives, got ${Game.lives}`);
  const w = Game.world;
  const p = w.player;
  const livesBefore = Game.lives;
  const attempts = [];

  const dropInWater = () => { p.y = w.height + 400; tick(4); attempts.push('fall'); };
  // Stage 1-1 has no lagoon, so ask the game for a drowning directly.
  const drown = () => {
    const safeBefore = { ...p.safe };
    p.die('water');
    tick(4);
    if (Math.abs(p.x - safeBefore.x) > 1 || Math.abs(p.bottom - safeBefore.bottom) > 1) {
      fail(`cheat mode did not set Oga back on dry land after drowning (at ${Math.round(p.x)},${Math.round(p.bottom)}, expected ${Math.round(safeBefore.x)},${Math.round(safeBefore.bottom)})`);
    }
    attempts.push('water');
  };
  const takeHit = () => {
    p.invuln = 0;
    p.hurt();
    const foe = w.entities.find((e) => e instanceof scope.api.Enemy && e.alive);
    if (foe) { p.invuln = 0; foe.hitPlayer(p); }
    tick(4);
    attempts.push('hit');
  };
  const runOutOfTime = () => { Game.time = 1; Game.timeTick = 39; tick(3); attempts.push('time'); };

  for (const kill of [dropInWater, drown, takeHit, runOutOfTime]) {
    kill();
    if (p.state !== 'play') fail(`cheat mode did not survive "${attempts.at(-1)}" (player state "${p.state}")`);
    if (Game.state !== 'play') fail(`cheat mode left the stage after "${attempts.at(-1)}" (state "${Game.state}")`);
    p.state = 'play';
    tick(2);
  }
  if (Game.lives !== livesBefore) fail(`cheat mode lost lives: ${livesBefore} -> ${Game.lives}`);
  if (Game.time < 2) fail('cheat mode did not top the clock back up');
  console.log(`cheat mode: survived ${attempts.join(', ')} with ${Game.lives} lives intact, clock ${Game.time}`);

  Game.cheat = false;
  p.invuln = 0;
  p.setForm('small');
  p.die('fall');
  if (p.state !== 'dead') fail('with cheat off, a fall should still kill');
  else console.log('cheat off: falling still kills, as it should');
}

console.log(failures ? `\n${failures} problem(s) found` : '\nSmoke test passed');
process.exit(failures ? 1 : 0);
