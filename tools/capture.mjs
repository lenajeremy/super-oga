#!/usr/bin/env node
/*
 * Renders real frames of the game to PNG, headlessly, so the artwork can be checked
 * without a browser:  node tools/capture.mjs [outDir] [--scale 3]
 *
 * It loads every game script the way index.html does, against a real Canvas2D
 * (@napi-rs/canvas) and real decoded JPGs, then plays with scripted input and snapshots
 * the title, prologue, each stage, a conversation, a ride, a stage clear and the ending.
 * Anything the game throws while drawing fails the run.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createCanvas, loadImage } from '@napi-rs/canvas';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const outDir = path.resolve(args.find((a) => !a.startsWith('--')) || path.join(root, 'shots'));
const scale = Number((args.find((a) => a.startsWith('--scale')) || '--scale=3').split('=')[1] || 3);
fs.mkdirSync(outDir, { recursive: true });

// ---------------------------------------------------------------- decode every JPG up front
const jpgs = [];
for (const dir of ['assets/sprites', 'assets/photos']) {
  for (const f of fs.readdirSync(path.join(root, dir))) if (f.endsWith('.jpg')) jpgs.push(`${dir}/${f}`);
}
const decoded = new Map();
for (const rel of jpgs) decoded.set(rel, await loadImage(path.join(root, rel)));

// The game holds Image objects; the native drawImage needs the decoded original, so keep
// a side table and unwrap on the way through.
const realFor = new WeakMap();
// Spoken clips: the harness reports them loadable, and playing is a no-op.
class AudioStub {
  constructor() { this.volume = 1; this.preload = ''; this.readyState = 4; }
  addEventListener(type, fn) { if (type === 'canplaythrough') queueMicrotask(fn); }
  cloneNode() { return new AudioStub(); }
  play() { return Promise.resolve(); }
  set src(v) { this._src = v; }
  get src() { return this._src; }
}
class GameImage {
  constructor() { this.onload = null; this.onerror = null; this.width = 0; this.height = 0; }
  set src(v) {
    const real = decoded.get(v);
    if (!real) { queueMicrotask(() => this.onerror && this.onerror(new Error(`no such image ${v}`))); return; }
    realFor.set(this, real);
    this.width = real.width;
    this.height = real.height;
    this._src = v;
    queueMicrotask(() => this.onload && this.onload());
  }
  get src() { return this._src; }
}

function makeCanvas(w = 400, h = 224) {
  const cv = createCanvas(w, h);
  const nativeGetContext = cv.getContext.bind(cv);
  cv.style = {};
  cv.classList = { add() {}, remove() {}, toggle() {}, contains: () => false };
  cv.addEventListener = () => {};
  cv.getBoundingClientRect = () => ({ left: 0, top: 0, width: cv.width, height: cv.height });
  cv.getContext = (kind, opts) => {
    const ctx = nativeGetContext(kind, opts);
    if (!ctx._patched) {
      const orig = ctx.drawImage.bind(ctx);
      ctx.drawImage = (src, ...rest) => orig(realFor.get(src) || src, ...rest);
      ctx._patched = true;
    }
    return ctx;
  };
  return cv;
}

const gameCanvas = makeCanvas();
const elements = { game: gameCanvas };
const bodyClasses = new Set();
const scope = {
  console,
  setInterval: () => 0,
  clearInterval: () => {},
  setTimeout: (fn) => { fn(); return 0; },
  requestAnimationFrame: () => 0,
  queueMicrotask,
  innerWidth: 1200,
  innerHeight: 672,
  devicePixelRatio: 1,
  location: { protocol: 'http:' },
  navigator: { getGamepads: () => [] },
  localStorage: { store: {}, getItem(k) { return this.store[k] ?? null; }, setItem(k, v) { this.store[k] = v; } },
  addEventListener: () => {},
  Image: GameImage,
  document: {
    hidden: false,
    getElementById: (id) => elements[id] || makeCanvas(),
    createElement: () => makeCanvas(),
    querySelectorAll: () => [],
    addEventListener: () => {},
    body: { classList: { add: (c) => bodyClasses.add(c), remove: (c) => bodyClasses.delete(c), toggle: (c, on) => (on ? bodyClasses.add(c) : bodyClasses.delete(c)), contains: (c) => bodyClasses.has(c) } },
  },
};
scope.window = scope;
scope.self = scope;
scope.Audio = AudioStub;
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
let failures = 0;
const fail = (msg) => { failures++; console.log(`  FAIL ${msg}`); };
const guard = (label, fn) => { try { return fn(); } catch (e) { fail(`${label}: ${e.message}`); return null; } };

const SCRIPTS = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
  .match(/<script src="([^"]+)"><\/script>/g).map((t) => t.match(/src="([^"]+)"/)[1]);
for (const src of SCRIPTS) guard(`loading ${src}`, () => vm.runInContext(fs.readFileSync(path.join(root, src), 'utf8'), scope, { filename: src }));
vm.runInContext('this.api = { Game, Input, Sound, LEVELS, Enemy, Npc, ParkedRide };', scope);
const { Game, Input, LEVELS } = scope.api;

await new Promise((r) => setTimeout(r, 300));
if (Game.state !== 'title') fail(`expected title, got "${Game.state}"${Game.error ? `: ${Game.error.message}` : ''}`);

// ---------------------------------------------------------------- snapshots
let shot = 0;
const saved = [];
function snap(name) {
  guard(`render ${name}`, () => Game.render());
  const out = makeCanvas(400 * scale, 224 * scale);
  const octx = out.getContext('2d');
  octx.imageSmoothingEnabled = false;
  octx.drawImage(gameCanvas, 0, 0, 400 * scale, 224 * scale);
  const file = path.join(outDir, `${String(++shot).padStart(2, '0')}-${name}.png`);
  fs.writeFileSync(file, out.toBuffer('image/png'));
  // A frame that is one flat colour means nothing actually drew.
  const d = gameCanvas.getContext('2d').getImageData(0, 0, 400, 224).data;
  const seen = new Set();
  for (let i = 0; i < d.length; i += 4 * 97) seen.add(`${d[i]},${d[i + 1]},${d[i + 2]}`);
  if (seen.size < 3) fail(`${name} rendered almost blank (${seen.size} distinct colours)`);
  saved.push(`${path.basename(file)}  ${seen.size} colours`);
  return file;
}

const press = (...c) => { Input.keys.clear(); c.forEach((k) => Input.keys.add(k)); };
const tick = (n = 1) => { for (let i = 0; i < n; i++) guard('update', () => Game.update()); };
const confirm = (n = 1) => { for (let i = 0; i < n; i++) { press('Enter'); tick(1); press(); tick(1); } };

tick(40);
snap('title');
confirm();
tick(30);
snap('story');
for (let i = 0; i < 80 && Game.state === 'story'; i++) confirm();
tick(20);
if (Game.state === 'intro') snap('stage-intro');
while (Game.state === 'intro') tick(1);

// This run exists to photograph every screen, so give it lives to spare.
Game.lives = 30;
const wanted = new Map([[0, 'stage1-oshodi'], [1, 'stage2-balogun'], [2, 'stage3-bridge']]);
let gotDialog = false;
let gotRide = false;
let gotClear = false;
let gotDark = false;
for (let f = 0; f < 40000 && Game.state !== 'victory'; f++) {
  if (Game.state === 'intro') { confirm(); continue; }
  if (Game.state === 'gameover') { fail('died out before the end'); break; }
  const w = Game.world;

  if (Game.dialog) {
    if (!gotDialog && !Game.dialog.typing && Game.dialog.node.choices) { snap('conversation'); gotDialog = true; }
    if (Game.dialog.typing) { confirm(); continue; }
    const node = Game.dialog.node;
    if (node.choices) {
      const ok = (c) => !c.pay || Game.naira >= c.pay;
      const hire = node.choices.findIndex((c) => c.effect === 'hire' && ok(c));
      const shop = Game.naira >= 300 ? node.choices.findIndex((c) => c.pay && ok(c)) : -1;
      Game.dialog.selected = hire >= 0 ? hire : shop >= 0 ? shop : node.choices.length - 1;
    }
    confirm();
    continue;
  }
  if (Game.state === 'clear') {
    if (!gotClear) { snap('stage-clear'); gotClear = true; }
    tick(1);
    continue;
  }
  if (!w) { tick(1); continue; }
  const p = w.player;

  if (wanted.has(Game.levelIndex) && p.x > 700 && p.state === 'play') {
    snap(wanted.get(Game.levelIndex));
    wanted.delete(Game.levelIndex);
  }
  if (!gotRide && p.vehicle && p.onGround && Math.abs(p.vx) > 1) { snap(`riding-${p.vehicle.kind}`); gotRide = true; }
  if (!gotDark && w.blackout && w.blackout.t > 60) { snap('nepa-blackout'); gotDark = true; }
  if (p.state === 'dead') { tick(200); continue; }

  const target = p.state === 'play' && p.onGround ? w.interactable(p) : null;
  if (target && (target._greeted || 0) < 2) {
    target._greeted = (target._greeted || 0) + 1;
    press('ArrowUp'); tick(1); press(); tick(1);
    continue;
  }
  const keys = ['ArrowRight', 'KeyX'];
  if (p.state === 'play') {
    const front = p.x + p.w + 4;
    const gap = !w.solidAt(front + 8, p.bottom + 4) && !w.solidAt(front + 20, p.bottom + 4);
    const wall = w.solidAt(front, p.bottom - 4) || w.solidAt(front, p.y + 2);
    const foe = w.entities.some((e) => e instanceof scope.api.Enemy && e.alive && e.x + e.w > p.x && e.x - (p.x + p.w) < 46 && Math.abs(e.bottom - p.bottom) < 30);
    const overWater = (x) => w.tileAt(Math.floor(x / 16), Math.floor((p.bottom + 20) / 16)) === '~';
    if (p.onGround && !p.ride && overWater(front + 16)) {
      const boat = w.entities.filter((e) => e.constructor.name === 'Platform' && e.x + e.w > p.x && e.x - p.x < 150).sort((a, b) => a.x - b.x)[0];
      if (!(boat && boat.x - (p.x + p.w) < 26 && boat.y - p.bottom > -40)) { press(); tick(1); continue; }
    }
    // Riding a canoe or lift: look right for the next foothold - solid ground or another
    // platform - and hop across once it is in range, otherwise sit tight and ride.
    if (p.ride) {
      let best = null;
      for (let dx = 18; dx < 130 && !best; dx += 6) {
        for (let dy = -78; dy <= 26; dy += 6) {
          if (w.solidAt(p.x + p.w + dx, p.bottom + dy)) { best = { dx, dy }; break; }
        }
      }
      for (const e of w.entities) {
        if (e.constructor.name !== 'Platform' || e === p.ride) continue;
        const dx = e.x - (p.x + p.w);
        const dy = e.y - p.bottom;
        if (dx > 4 && dx < 110 && dy > -78 && (!best || dx < best.dx)) best = { dx, dy };
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
  }
  press(...keys);
  tick(1);
  if (process.env.TRACE && f % 2000 === 0) {
    console.log(`  f${f} state=${Game.state} lvl=${Game.levelIndex} x=${Math.round(p.x)} y=${Math.round(p.y)} vx=${p.vx.toFixed(2)} onGround=${p.onGround} time=${Game.time} lives=${Game.lives}`);
  }
}
press();
if (Game.state === 'victory') { tick(200); snap('victory'); } else fail(`never reached victory (ended "${Game.state}")`);

console.log(`\n${saved.length} frames -> ${path.relative(process.cwd(), outDir)}`);
for (const s of saved) console.log('  ' + s);
console.log(failures ? `\n${failures} problem(s)` : '\nAll frames rendered');
process.exit(failures ? 1 : 0);
