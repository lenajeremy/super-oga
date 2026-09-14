#!/usr/bin/env node
/*
 * Records the game playing itself to an MP4, with its own soundtrack.
 *
 *   node tools/record.mjs                      # 60s of stage 1-1
 *   node tools/record.mjs 2-2 75 boss.mp4      # 75s of the Fashe fight
 *   node tools/record.mjs 1-2 45 market.mp4 --scale 4
 *
 * It runs the real game against a real Canvas2D and pipes every frame to ffmpeg, so what
 * is recorded is what the game draws. The audio is the stage's own song, rendered by the
 * same offline engine as tools/preview-music.mjs, then muxed on.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createCanvas, loadImage } from '@napi-rs/canvas';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const positional = args.filter((a) => !a.startsWith('--'));
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const stageId = positional[0] || '1-1';
const seconds = Number(positional[1] || 60);
const outFile = path.resolve(positional[2] || path.join(root, `super-oga-${stageId}.mp4`));
const scale = Number(flag('scale', 3));
const FPS = 60;
const frames = Math.round(seconds * FPS);

// ---------------------------------------------------------------- browser stand-ins
const jpgs = [];
for (const dir of ['assets/sprites', 'assets/photos']) {
  for (const f of fs.readdirSync(path.join(root, dir))) if (f.endsWith('.jpg')) jpgs.push(`${dir}/${f}`);
}
const decoded = new Map();
for (const rel of jpgs) decoded.set(rel, await loadImage(path.join(root, rel)));
const realFor = new WeakMap();

class GameImage {
  constructor() { this.onload = null; this.onerror = null; this.width = 0; this.height = 0; }
  set src(v) {
    const real = decoded.get(String(v).split('?')[0]);
    if (!real) { queueMicrotask(() => this.onerror && this.onerror(new Error(`no image ${v}`))); return; }
    realFor.set(this, real);
    this.width = real.width;
    this.height = real.height;
    queueMicrotask(() => this.onload && this.onload());
  }
}
function makeCanvas(w = 400, h = 224) {
  const cv = createCanvas(w, h);
  const native = cv.getContext.bind(cv);
  cv.style = {};
  cv.classList = { add() {}, remove() {}, toggle() {}, contains: () => false };
  cv.addEventListener = () => {};
  cv.getBoundingClientRect = () => ({ left: 0, top: 0, width: cv.width, height: cv.height });
  cv.getContext = (kind, opts) => {
    const ctx = native(kind, opts);
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
const noop = () => {};
const audioParam = () => new Proxy({ value: 0 }, { get: (t, k) => (k in t ? t[k] : noop), set: (t, k, v) => ((t[k] = v), true) });
const audioNode = () => new Proxy({ gain: audioParam(), frequency: audioParam(), detune: audioParam(), Q: audioParam(),
  threshold: audioParam(), ratio: audioParam(), attack: audioParam(), release: audioParam(), buffer: null, type: 'sine', loop: false },
  { get: (t, k) => (k in t ? t[k] : k === 'connect' ? (x) => x : noop), set: (t, k, v) => ((t[k] = v), true) });

const scope = {
  console, setInterval: () => 0, clearInterval: noop, setTimeout: (fn) => { fn(); return 0; },
  requestAnimationFrame: () => 0, queueMicrotask, innerWidth: 1200, innerHeight: 672, devicePixelRatio: 1,
  location: { protocol: 'http:', search: `?stage=${stageId}` },
  navigator: { getGamepads: () => [] },
  localStorage: { store: {}, getItem(k) { return this.store[k] ?? null; }, setItem(k, v) { this.store[k] = v; } },
  addEventListener: noop, Image: GameImage,
  document: {
    hidden: false, getElementById: (id) => (id === 'game' ? gameCanvas : makeCanvas()),
    createElement: () => makeCanvas(), querySelectorAll: () => [], addEventListener: noop,
    body: { classList: { add: noop, remove: noop, toggle: noop, contains: () => false } },
  },
};
scope.window = scope;
scope.self = scope;
scope.Audio = class { constructor() { this.volume = 1; this.readyState = 4; } addEventListener(t, f) { if (t === 'canplaythrough') queueMicrotask(f); } cloneNode() { return new scope.Audio(); } play() { return Promise.resolve(); } set src(v) { this._s = v; } get src() { return this._s; } };
scope.AudioContext = class {
  constructor() { this.sampleRate = 44100; this.currentTime = 0; this.state = 'running'; this.destination = audioNode(); }
  createGain() { return audioNode(); } createOscillator() { return audioNode(); }
  createBiquadFilter() { return audioNode(); } createBufferSource() { return audioNode(); }
  createConvolver() { return audioNode(); } createDynamicsCompressor() { return audioNode(); }
  createBuffer(c, l) { return { getChannelData: () => new Float32Array(l) }; } resume() {} suspend() {}
};

vm.createContext(scope);
for (const src of fs.readFileSync(path.join(root, 'index.html'), 'utf8')
  .match(/<script src="([^"]+)"><\/script>/g).map((t) => t.match(/src="([^"]+)"/)[1].split('?')[0])) {
  vm.runInContext(fs.readFileSync(path.join(root, src), 'utf8'), scope, { filename: src });
}
vm.runInContext('this.api = { Game, Input, LEVELS, Enemy };', scope);
const { Game, Input, LEVELS } = scope.api;
await new Promise((r) => setTimeout(r, 300));

const level = LEVELS.find((l) => l.id === stageId);
if (!level) {
  console.error(`Unknown stage "${stageId}". Try: ${LEVELS.map((l) => l.id).join(', ')}`);
  process.exit(1);
}
Game.cheat = true;                       // a recording should not end in a game over
while (Game.state === 'intro') Game.update();

// ---------------------------------------------------------------- the player
const press = (...c) => { Input.keys.clear(); c.forEach((k) => Input.keys.add(k)); };
let jump = 0;
let cool = 0;

function playOneFrame(f) {
  if (Game.dialog) {
    // read the line, take the first affordable option, move on
    if (!Game.dialog.typing && Game.dialog.node.choices) {
      const ok = (c) => !c.pay || Game.naira >= c.pay;
      const hire = Game.dialog.node.choices.findIndex((c) => c.effect === 'hire' && ok(c));
      Game.dialog.selected = hire >= 0 ? hire : Math.max(0, Game.dialog.node.choices.findIndex(ok));
    }
    if (f % 24 === 0) { press('Enter'); Game.update(); press(); }
    Game.update();
    return;
  }
  if (Game.state !== 'play' || !Game.world) { Game.update(); return; }
  const w = Game.world;
  const p = w.player;
  if (p.state !== 'play') { press(); Game.update(); return; }

  const keys = ['ArrowRight', 'KeyX'];
  const front = p.x + p.w + 4;
  const boss = w.boss;

  // At the boss: stand and fight rather than running past him.
  if (boss && boss.alive && Math.abs(p.cx - boss.cx) < 150) {
    const over = p.cx > boss.cx;
    keys.length = 0;
    keys.push(over ? 'ArrowLeft' : 'ArrowRight');
    if (p.onGround && !cool) { jump = 14; cool = 40; }
    if (f % 30 < 2) keys.push('KeyX');           // jab
    if (jump > 0) { keys.push('Space'); jump--; }
    if (cool > 0) cool--;
    press(...keys);
    Game.update();
    return;
  }

  const target = p.onGround && w.interactable(p);
  if (target && !target._met) { target._met = true; press('Enter'); Game.update(); press(); Game.update(); return; }

  if (p.swimming) { press('ArrowRight', ...(f % 14 < 3 ? ['Space'] : [])); Game.update(); return; }
  const gap = !w.solidAt(front + 8, p.bottom + 4) && !w.solidAt(front + 20, p.bottom + 4);
  const wall = w.solidAt(front, p.bottom - 4) || w.solidAt(front, p.y + 2);
  const foe = w.entities.some((e) => e instanceof scope.api.Enemy && e.alive && e.x + e.w > p.x && e.x - (p.x + p.w) < 46 && Math.abs(e.bottom - p.bottom) < 30);
  if (cool > 0) cool--;
  if (p.onGround && !jump && !cool && (gap || wall || foe)) { jump = wall ? 18 : 9; cool = 22; }
  if (jump > 0) { keys.push('Space'); jump--; }
  press(...keys);
  Game.update();
}

// ---------------------------------------------------------------- the soundtrack
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'super-oga-'));
const wav = path.join(tmp, 'track.wav');
const bars = Math.ceil((seconds * (level.song ? 1 : 1)) / 4);
execFileSync('node', [path.join(root, 'tools/preview-music.mjs'), level.song, String(bars * 4), wav], { stdio: 'pipe' });

// ---------------------------------------------------------------- record
const W = 400 * scale;
const H = 224 * scale;
const out = makeCanvas(W, H);
const octx = out.getContext('2d');
octx.imageSmoothingEnabled = false;

const ff = spawn('ffmpeg', [
  '-loglevel', 'error', '-y',
  '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(FPS), '-i', 'pipe:0',
  '-i', wav,
  '-map', '0:v', '-map', '1:a',
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
  '-c:a', 'aac', '-b:a', '160k', '-shortest',
  outFile,
]);
ff.stderr.on('data', (d) => process.stderr.write(d));

console.log(`recording ${seconds}s of ${stageId} "${level.name}" at ${W}x${H}...`);
for (let f = 0; f < frames; f++) {
  playOneFrame(f);
  Game.render();
  octx.drawImage(gameCanvas, 0, 0, W, H);
  const raw = octx.getImageData(0, 0, W, H).data;
  if (!ff.stdin.write(Buffer.from(raw.buffer, raw.byteOffset, raw.byteLength))) {
    await new Promise((r) => ff.stdin.once('drain', r));
  }
  if (f % (FPS * 10) === 0 && f) console.log(`  ${f / FPS}s...`);
}
ff.stdin.end();
await new Promise((r) => ff.on('close', r));
fs.rmSync(tmp, { recursive: true, force: true });

const mb = (fs.statSync(outFile).size / 1024 / 1024).toFixed(1);
console.log(`wrote ${path.relative(process.cwd(), outFile)}  ${seconds}s, ${W}x${H}, ${mb}MB`);
