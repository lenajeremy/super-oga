#!/usr/bin/env node
/*
 * Renders a song from src/music.js to a WAV so the groove can be auditioned without
 * opening the game:  node tools/preview-music.mjs eko [bars] [out.wav]
 *
 * It runs the real src/audio.js against a small offline stand-in for WebAudio, so what
 * you hear is what the game schedules - same kit, same sequencer, same swing. The only
 * thing not modelled is the reverb send, so the render is a touch drier than the game.
 *
 * Two environment switches help when balancing the mix:
 *   ONLY_VOICE=shaker  render just that kit voice (kick, snare, rim, shaker, conga, bell,
 *                      clap, bassNote, guitarNote, keysNote, hornNote, logNote)
 *   NO_NORM=1          skip peak normalisation, so levels are comparable between renders
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

import { RATE, OfflineContext, render, writeWav } from './offline-audio.mjs';

// ---------------------------------------------------------------- run the real code
const [, , songName = 'eko', barsArg = '4', outArg] = process.argv;
const scope = {
  window: { AudioContext: OfflineContext },
  Store: { get: (k, d) => d, set: () => {} },
  setInterval: () => 0,
  clearInterval: () => {},
  console,
};
scope.self = scope;
vm.createContext(scope);
vm.runInContext(fs.readFileSync(path.join(root, 'src/music.js'), 'utf8'), scope);
vm.runInContext(`${fs.readFileSync(path.join(root, 'src/audio.js'), 'utf8')};this.Sound = Sound;`, scope);

const { Sound, MUSIC } = scope;
const def = MUSIC.SONGS[songName];
if (!def) {
  console.error(`Unknown song "${songName}". Try: ${Object.keys(MUSIC.SONGS).join(', ')}`);
  process.exit(1);
}
const loops = Math.max(1, Math.ceil(Number(barsArg) / MUSIC.barsOf(def)));
const bars = loops * MUSIC.barsOf(def);
const seconds = bars * 4 * (60 / def.bpm) + 1.2;

Sound.unlock();
// Diagnostics hook: ONLY_VOICE=kick renders that one kit voice, for checking the mix.
if (process.env.ONLY_VOICE) {
  for (const v of ['kick', 'snare', 'rim', 'shaker', 'conga', 'bell', 'clap', 'bassNote', 'guitarNote', 'keysNote', 'hornNote', 'logNote']) {
    if (v !== process.env.ONLY_VOICE) Sound[v] = () => {};
  }
}
const ctx = Sound.ctx;
Sound.startMusic(songName);
// Drive the real scheduler forward instead of waiting on a timer.
for (let t = 0; t < seconds; t += 0.02) {
  ctx.currentTime = t;
  Sound.schedule();
}

const out = path.resolve(outArg || path.join(root, `${songName}.wav`));
const peak = writeWav(out, render(ctx, seconds));
console.log(
  `${songName}: ${def.bpm} BPM, ${bars} bars, swing ${def.swing}, ${seconds.toFixed(1)}s, ` +
    `${ctx.sources.length} voices, peak ${peak.toFixed(2)} -> ${path.relative(process.cwd(), out)}`,
);
