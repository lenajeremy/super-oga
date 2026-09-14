#!/usr/bin/env node
/*
 * Proves every platform can actually be landed on, by running the real game physics.
 *
 * tools/check-levels.mjs checks that a platform is within jump HEIGHT. That is not the
 * same as reachable: the jump arc also has to put you over the platform while you are
 * falling past its top edge. A plank can be well within reach and still be impossible,
 * which is exactly the bug this was written for.
 *
 * For each platform it sweeps approach side, walk/run, launch distance and hold length,
 * and reports any platform that no combination can land on.
 *
 *   node tools/check-reach.mjs [--verbose]
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const verbose = process.argv.includes('--verbose');

const noop = () => {};
const ctxStub = () => new Proxy({
  canvas: { width: 400, height: 224 },
  getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4).fill(60), width: w, height: h }),
  createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
  createLinearGradient: () => ({ addColorStop: noop }),
  createRadialGradient: () => ({ addColorStop: noop }),
  measureText: () => ({ width: 10 }),
}, { get: (t, k) => (k in t ? t[k] : noop), set: (t, k, v) => ((t[k] = v), true) });
const canvasStub = (w = 400, h = 224) => {
  const c = { width: w, height: h, style: {}, classList: { add: noop, remove: noop, toggle: noop, contains: () => false } };
  c.getContext = () => (c._ctx ||= ctxStub());
  c.getBoundingClientRect = () => ({ left: 0, top: 0, width: w, height: h });
  c.addEventListener = noop;
  return c;
};
const audioParam = () => new Proxy({ value: 0 }, { get: (t, k) => (k in t ? t[k] : noop), set: (t, k, v) => ((t[k] = v), true) });
const audioNode = () => new Proxy({ gain: audioParam(), frequency: audioParam(), detune: audioParam(), Q: audioParam(),
  threshold: audioParam(), ratio: audioParam(), attack: audioParam(), release: audioParam(), buffer: null, type: 'sine', loop: false },
  { get: (t, k) => (k in t ? t[k] : k === 'connect' ? (x) => x : noop), set: (t, k, v) => ((t[k] = v), true) });

const scope = {
  console, setInterval: () => 0, clearInterval: noop, setTimeout: (fn) => { fn(); return 0; },
  requestAnimationFrame: () => 0, queueMicrotask, innerWidth: 1200, innerHeight: 672, devicePixelRatio: 1,
  location: { protocol: 'http:', search: '' }, navigator: { getGamepads: () => [] },
  localStorage: { store: {}, getItem(k) { return this.store[k] ?? null; }, setItem(k, v) { this.store[k] = v; } },
  addEventListener: noop,
  document: { hidden: false, getElementById: () => canvasStub(), createElement: () => canvasStub(),
    querySelectorAll: () => [], addEventListener: noop,
    body: { classList: { add: noop, remove: noop, toggle: noop, contains: () => false } } },
};
scope.window = scope;
scope.self = scope;
scope.Audio = class { constructor() { this.volume = 1; this.readyState = 4; } addEventListener(t, f) { if (t === 'canplaythrough') queueMicrotask(f); } cloneNode() { return new scope.Audio(); } play() { return Promise.resolve(); } set src(v) { this._s = v; } get src() { return this._s; } };
scope.Image = class { constructor() { this.width = 512; this.height = 512; } set src(v) { this._s = v; queueMicrotask(() => this.onload && this.onload()); } get src() { return this._s; } };
scope.AudioContext = class {
  constructor() { this.sampleRate = 44100; this.currentTime = 0; this.state = 'running'; this.destination = audioNode(); }
  createGain() { return audioNode(); } createOscillator() { return audioNode(); }
  createBiquadFilter() { return audioNode(); } createBufferSource() { return audioNode(); }
  createConvolver() { return audioNode(); } createDynamicsCompressor() { return audioNode(); }
  createBuffer(c, l) { return { getChannelData: () => new Float32Array(l) }; } resume() {} suspend() {}
};

vm.createContext(scope);
for (const src of fs.readFileSync(path.join(root, 'index.html'), 'utf8')
  .match(/<script src="([^"]+)"><\/script>/g).map((t) => t.match(/src="([^"]+)"/)[1])) {
  vm.runInContext(fs.readFileSync(path.join(root, src), 'utf8'), scope, { filename: src });
}
vm.runInContext('this.api = { Game, Input, LEVELS };', scope);
const { Game, Input, LEVELS } = scope.api;
await new Promise((r) => setTimeout(r, 250));

const press = (...c) => { Input.keys.clear(); c.forEach((k) => Input.keys.add(k)); };
const tick = (n = 1) => { for (let i = 0; i < n; i++) Game.update(); };
const confirm = () => { press('Enter'); tick(1); press(); tick(1); };
tick(30); confirm();
for (let i = 0; i < 80 && Game.state === 'story'; i++) confirm();
while (Game.state === 'intro') tick(1);
tick(10);

// Nothing must interfere with a geometry test: in cheat mode enemies cannot touch him.
Game.cheat = true;

let failures = 0;
for (let i = 0; i < LEVELS.length; i++) {
  Game.levelIndex = i;
  Game.fromCheckpoint = false;
  Game.beginPlay();
  tick(3);
  const w = Game.world;
  const p = w.player;
  // Clear anything that moves, so a wandering goat cannot fail an attempt.
  w.entities = w.entities.filter((e) => e.constructor.name === 'Platform' || e.constructor.name === 'Goal');

  // every one-way plank run, and every ledge you are meant to climb
  const targets = [];
  for (let y = 0; y < w.rows; y++) {
    for (let x = 0; x < w.cols; x++) {
      if (w.tileAt(x, y) !== '=' || w.tileAt(x - 1, y) === '=') continue;
      let e = x;
      while (w.tileAt(e, y) === '=') e++;
      targets.push({ y, x0: x, x1: e - 1 });
    }
  }

  const solidGround = (col) => { for (let y = 0; y < w.rows; y++) if (w.tileAt(col, y) === '#') return y * 16; return null; };

  for (const t of targets) {
    let reachable = false;
    let bestGap = Infinity;
    outer:
    for (const dir of [1, -1]) {
      for (const run of [true, false]) {
        for (let launch = 0; launch <= 11 && !reachable; launch += 0.5) {
          for (const hold of [6, 9, 12, 16, 20, 26, 40]) {
            const edge = dir > 0 ? t.x0 : t.x1;
            const startCol = edge - dir * 11;
            const groundY = solidGround(startCol);
            if (groundY === null) continue;
            Object.assign(p, { state: 'play', vy: 0, invuln: 0, jumpBuffer: 0, coyote: 0, ride: null, vehicle: null, mountCooldown: 0 });
            p.setForm('small');
            p.x = startCol * 16;
            p.y = groundY - p.h;
            p.vx = 0;
            p.onGround = true;
            const keys = dir > 0 ? ['ArrowRight'] : ['ArrowLeft'];
            if (run) keys.push('KeyX');
            let jumpedAt = -1;
            for (let f = 0; f < 200; f++) {
              const k = [...keys];
              const reached = dir > 0 ? p.x >= (edge - launch) * 16 : p.x <= (edge + launch) * 16;
              if (jumpedAt < 0 && reached) jumpedAt = f;
              if (jumpedAt >= 0 && f - jumpedAt < hold) k.push('Space');
              press(...k);
              tick(1);
              const onTop = Math.abs(p.bottom - t.y * 16) <= 2;
              const over = p.x + p.w > t.x0 * 16 && p.x < (t.x1 + 1) * 16;
              if (p.onGround && onTop && over) { reachable = true; break; }
              if (p.onGround && p.bottom > t.y * 16 + 8) bestGap = Math.min(bestGap, p.bottom - t.y * 16);
              if (p.state !== 'play' || p.bottom > w.height) break;
            }
            press();
            if (reachable) break outer;
          }
        }
      }
    }
    if (!reachable) {
      failures++;
      const drop = Number.isFinite(bestGap) ? `, best attempt fell ${Math.round(bestGap)}px short` : '';
      console.log(`  FAIL ${LEVELS[i].id}: cannot land on the platform at row ${t.y}, cols ${t.x0}-${t.x1}${drop}`);
    } else if (verbose) {
      console.log(`  ok   ${LEVELS[i].id}: row ${t.y} cols ${t.x0}-${t.x1}`);
    }
  }
  console.log(`${LEVELS[i].id}: ${targets.length} platform(s) simulated`);
}

console.log(failures ? `\n${failures} unreachable platform(s)` : '\nEvery platform can be landed on');
process.exit(failures ? 1 : 0);
