#!/usr/bin/env node
/*
 * Renders a sound effect, a hawker's call, or a stretch of ambience to a WAV, so the
 * audio can be heard without opening the game:
 *
 *   node tools/preview-sound.mjs suya            # what Mallam Sule shouts
 *   node tools/preview-sound.mjs night 12        # 12s of blackout insects
 *   node tools/preview-sound.mjs market 12
 *   node tools/preview-sound.mjs nepaOff         # any effect name from Sound.play
 *   node tools/preview-sound.mjs list            # everything available
 *
 * It runs the real src/audio.js against the offline stand-in, so this is what the game
 * plays, not a re-implementation.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { OfflineContext, render, writeWav } from './offline-audio.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [, , what = 'list', secondsArg, outArg] = process.argv;

// The ambience scheduler runs on setInterval; capture it so it can be driven by hand.
const intervals = [];
const scope = {
  window: { AudioContext: OfflineContext },
  Store: { get: (k, d) => d, set: () => {} },
  setInterval: (fn, ms) => { intervals.push({ fn, ms, next: 0 }); return intervals.length; },
  clearInterval: (id) => { if (intervals[id - 1]) intervals[id - 1].dead = true; },
  console,
  Math,
};
scope.self = scope;
vm.createContext(scope);
for (const f of ['src/music.js', 'src/audio.js', 'src/story.js']) {
  try {
    vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), scope, { filename: f });
  } catch (err) {
    if (f !== 'src/story.js') throw err;   // story.js is only needed for the CALLS table
  }
}
vm.runInContext('this.api = { Sound, CALLS: typeof CALLS === "undefined" ? {} : CALLS };', scope);
const { Sound, CALLS } = scope.api;

const AMBIENCE = ['street', 'market', 'bridge', 'night'];
const EFFECTS = [...new Set([...fs.readFileSync(path.join(root, 'src/audio.js'), 'utf8').matchAll(/case '(\w+)':/g)].map((m) => m[1]))];

if (what === 'list') {
  console.log('voices   :', Object.keys(CALLS).join(', ') || '(none found)');
  console.log('ambience :', AMBIENCE.join(', '));
  console.log('effects  :', EFFECTS.join(', '));
  process.exit(0);
}

const isAmbience = AMBIENCE.includes(what);
const seconds = Number(secondsArg) || (isAmbience ? 12 : CALLS[what] ? 3 : 3);
const out = path.resolve(outArg || path.join(root, `${what}.wav`));

Sound.unlock();
const ctx = Sound.ctx;

let label;
if (CALLS[what]) {
  const call = CALLS[what];
  label = `"${call.text}"`;
  Sound.callOut(call.vowels, { pitch: call.pitch, vol: 0.3 });
} else if (isAmbience) {
  label = `${what} ambience`;
  Sound.setAmbience(what);
} else if (EFFECTS.includes(what)) {
  label = `effect ${what}`;
  Sound.play(what);
} else {
  console.error(`Unknown sound "${what}". Run "node tools/preview-sound.mjs list" to see what there is.`);
  process.exit(1);
}

// Walk time forward, firing the ambience scheduler as the game's timer would.
for (let t = 0; t < seconds; t += 1 / 60) {
  ctx.currentTime = t;
  for (const iv of intervals) {
    if (iv.dead) continue;
    if (t >= iv.next) {
      iv.next = t + iv.ms / 1000;
      iv.fn();
    }
  }
}
ctx.currentTime = seconds;

const peak = writeWav(out, render(ctx, seconds));
console.log(`${label}: ${seconds.toFixed(1)}s, ${ctx.sources.length} voices, peak ${peak.toFixed(3)} -> ${path.relative(process.cwd(), out)}`);
