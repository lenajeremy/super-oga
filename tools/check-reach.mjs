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
// A platform should be forgiving, not a stunt: at least this share of the swept approaches
// (side, walk/run, launch distance, hold length) has to put you on it AND hold you there.
const MIN_SUCCESS_RATE = 12;

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
  .match(/<script src="([^"]+)"><\/script>/g).map((t) => t.match(/src="([^"]+)"/)[1].split('?')[0])) {
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

  // Everything you could jump FROM: the street, and every plank. A plank high above the
  // ground is often meant to be reached from the plank below it, not from the street, so
  // launching only from ground would call a perfectly good staircase unreachable.
  const surfaces = targets.map((t) => ({ ...t }));
  for (let x = 0; x < w.cols; x++) {
    const g = solidGround(x);
    if (g === null) continue;
    const y = g / 16;
    const prev = surfaces[surfaces.length - 1];
    if (prev && prev.ground && prev.y === y && prev.x1 === x - 1) prev.x1 = x;
    else surfaces.push({ y, x0: x, x1: x, ground: true });
  }

  // Anywhere a manhole drops you out is reachable by definition, not by jumping.
  const warpCols = new Set((LEVELS[i].warps || []).flat());
  for (const t of targets) {
    if ([...warpCols].some((c) => c >= t.x0 - 12 && c <= t.x1 + 12)) continue;
    let reachable = false;
    let bestGap = Infinity;
    let tried = 0;
    let landed = 0;
    // Only surfaces below the target and near enough to jump from are worth trying.
    const from = surfaces.filter((sf) => sf.y > t.y && sf !== t
      && (sf.x0 - t.x1) < 14 && (t.x0 - sf.x1) < 14 && (sf.y - t.y) * 16 <= 110);
    for (const sf of from) {
      for (const dir of [1, -1]) {
        for (const run of [true, false]) {
          for (let launch = 0; launch <= 11; launch += 0.5) {
            const edge = dir > 0 ? t.x0 : t.x1;
            // stand on the launch surface, at the end nearest the target
            const startCol = dir > 0 ? Math.max(sf.x0, Math.min(sf.x1, edge - 11)) : Math.min(sf.x1, Math.max(sf.x0, edge + 11));
            const groundY = sf.y * 16;
            if (startCol < sf.x0 || startCol > sf.x1) continue;
          for (const hold of [6, 9, 12, 16, 20, 26, 40]) {
            Object.assign(p, { state: 'play', vy: 0, invuln: 0, jumpBuffer: 0, coyote: 0, ride: null, vehicle: null, mountCooldown: 0 });
            p.setForm('small');
            p.x = startCol * 16;
            p.y = groundY - p.h;
            p.vx = 0;
            p.onGround = true;
            const keys = dir > 0 ? ['ArrowRight'] : ['ArrowLeft'];
            if (run) keys.push('KeyX');
            let jumpedAt = -1;
            let hit = false;
            tried++;
            for (let f = 0; f < 200; f++) {
              const k = [...keys];
              const reached = dir > 0 ? p.x >= (edge - launch) * 16 : p.x <= (edge + launch) * 16;
              if (jumpedAt < 0 && reached) jumpedAt = f;
              if (jumpedAt >= 0 && f - jumpedAt < hold) k.push('Space');
              press(...k);
              tick(1);
              const onTop = Math.abs(p.bottom - t.y * 16) <= 2;
              const over = p.x + p.w > t.x0 * 16 && p.x < (t.x1 + 1) * 16;
              // Touching down is not enough: you have to still be up there a moment later.
              // A one-frame landing followed by sinking through is exactly the bug this
              // check exists for, so hold still and confirm the platform holds you.
              if (p.onGround && onTop && over) {
                let stayed = true;
                for (let s = 0; s < 30; s++) {
                  press();
                  tick(1);
                  if (Math.abs(p.bottom - t.y * 16) > 2) { stayed = false; break; }
                }
                if (stayed) { reachable = true; hit = true; }
                break;
              }
              if (p.onGround && p.bottom > t.y * 16 + 8) bestGap = Math.min(bestGap, p.bottom - t.y * 16);
              if (p.state !== 'play' || p.bottom > w.height) break;
            }
            press();
            if (hit) landed++;
          }
          }
        }
      }
    }
    // Reachable is not the same as doable. If only a sliver of the possible approaches
    // works, the platform is a coin-flip in real play - which is what it felt like.
    const rate = tried ? (landed / tried) * 100 : 0;
    const comfortable = rate >= MIN_SUCCESS_RATE;
    if (!reachable || !comfortable) {
      failures++;
      const why = !reachable
        ? (Number.isFinite(bestGap) ? `no approach lands on it (best fell ${Math.round(bestGap)}px short)` : 'no approach lands on it')
        : `only ${rate.toFixed(1)}% of approaches land on it (want ${MIN_SUCCESS_RATE}%)`;
      console.log(`  FAIL ${LEVELS[i].id}: platform at row ${t.y}, cols ${t.x0}-${t.x1} - ${why}`);
    } else if (verbose) {
      console.log(`  ok   ${LEVELS[i].id}: row ${t.y} cols ${t.x0}-${t.x1} (${rate.toFixed(1)}% of approaches land)`);
    }
  }
  console.log(`${LEVELS[i].id}: ${targets.length} platform(s) simulated`);
}

console.log(failures ? `\n${failures} unreachable platform(s)` : '\nEvery platform can be landed on');
process.exit(failures ? 1 : 0);
