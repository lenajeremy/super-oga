#!/usr/bin/env node
/*
 * A small offline stand-in for WebAudio, enough to run src/audio.js outside a browser and
 * render what it schedules to a WAV. Shared by tools/preview-music.mjs (songs) and
 * tools/preview-sound.mjs (effects, voices and ambience).
 *
 * The reverb send is not modelled, so renders are a touch drier than the game.
 */
import fs from 'node:fs';

export const RATE = 44100;

class Param {
  constructor(value) {
    this.value = value;
    this.events = [];
    this.outs = [];          // an LFO may be connected here; it is modulation, not output
  }
  connect(target) { this.outs.push(target); return target; }
  setValueAtTime(v, t) { this.events.push({ type: 'set', t, v }); return this; }
  exponentialRampToValueAtTime(v, t) { this.events.push({ type: 'exp', t, v }); return this; }
  linearRampToValueAtTime(v, t) { this.events.push({ type: 'lin', t, v }); return this; }
  setTargetAtTime(v, t, tc) { this.events.push({ type: 'target', t, v, tc }); return this; }
  valueAt(t) {
    const evts = this.events;
    if (!evts.length) return this.value;
    if (t <= evts[0].t) return evts[0].type === 'set' ? evts[0].v : this.value;
    let prev = { t: evts[0].t, v: evts[0].type === 'set' ? evts[0].v : this.value };
    for (const e of evts) {
      if (t < e.t) {
        const span = e.t - prev.t;
        const k = span > 0 ? (t - prev.t) / span : 1;
        if (e.type === 'exp') return prev.v * Math.pow(Math.max(1e-9, e.v) / Math.max(1e-9, prev.v), k);
        if (e.type === 'lin') return prev.v + (e.v - prev.v) * k;
        return prev.v;
      }
      if (e.type === 'target') {
        const settled = e.v + (prev.v - e.v) * Math.exp(-(t - e.t) / e.tc);
        prev = { t, v: settled };
        continue;
      }
      prev = { t: e.t, v: e.v };
    }
    return prev.v;
  }
}

class Node {
  constructor() { this.outs = []; }
  connect(target) { this.outs.push(target); return target; }
  disconnect() { this.outs = []; }
}
class Destination extends Node {}
class GainNode extends Node { constructor() { super(); this.gain = new Param(1); } }
class BiquadNode extends Node {
  constructor() { super(); this.type = 'lowpass'; this.frequency = new Param(350); this.Q = new Param(1); }
}
class PassThrough extends Node {
  constructor(kind) { super(); this.kind = kind; this.threshold = new Param(0); this.ratio = new Param(1); this.attack = new Param(0); this.release = new Param(0); this.buffer = null; }
}
class OscNode extends Node {
  constructor() { super(); this.type = 'sine'; this.frequency = new Param(440); this.detune = new Param(0); }
  start(t = 0) { this.startT = t; }
  stop(t) { this.stopT = t; }
}
class BufferSourceNode extends Node {
  constructor() { super(); this.buffer = null; this.loop = false; }
  start(t = 0, offset = 0) { this.startT = t; this.offset = offset; }
  stop(t) { this.stopT = t; }
}

export class OfflineContext {
  constructor() {
    this.sampleRate = RATE;
    this.currentTime = 0;
    this.state = 'running';
    this.destination = new Destination();
    this.sources = [];
  }
  createGain() { return new GainNode(); }
  createBiquadFilter() { return new BiquadNode(); }
  createConvolver() { return new PassThrough('convolver'); }
  createDynamicsCompressor() { return new PassThrough('compressor'); }
  createOscillator() { const n = new OscNode(); this.sources.push(n); return n; }
  createBufferSource() { const n = new BufferSourceNode(); this.sources.push(n); return n; }
  createBuffer(channels, length) {
    const data = Array.from({ length: channels }, () => new Float32Array(length));
    return { length, numberOfChannels: channels, sampleRate: RATE, getChannelData: (i) => data[i] };
  }
  resume() {} suspend() {}
}

// Every route from a source to the destination, as an ordered list of gains and filters.
function paths(node, chain = [], seen = new Set()) {
  const out = [];
  for (const next of node.outs) {
    if (next instanceof Param) continue;      // modulation, not an audio path
    if (next instanceof Destination) { out.push(chain); continue; }
    if (seen.has(next)) continue;
    if (next instanceof PassThrough && next.kind === 'convolver') continue; // reverb not modelled
    const step = next instanceof GainNode || next instanceof BiquadNode ? [...chain, next] : chain;
    out.push(...paths(next, step, new Set([...seen, next])));
  }
  return out;
}

// RBJ biquad, recomputed as the cutoff moves.
function makeFilter(node) {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return (sample, t) => {
    const w0 = (2 * Math.PI * Math.max(20, Math.min(node.frequency.valueAt(t), RATE / 2 - 100))) / RATE;
    const cos = Math.cos(w0);
    const alpha = Math.sin(w0) / (2 * Math.max(0.0001, node.Q.valueAt(t)));
    let b0, b1, b2;
    const a0 = 1 + alpha;
    const a1 = -2 * cos;
    const a2 = 1 - alpha;
    if (node.type === 'highpass') { b0 = (1 + cos) / 2; b1 = -(1 + cos); b2 = b0; }
    else if (node.type === 'bandpass') { b0 = alpha; b1 = 0; b2 = -alpha; }
    else { b0 = (1 - cos) / 2; b1 = 1 - cos; b2 = b0; }
    const y = (b0 / a0) * sample + (b1 / a0) * x1 + (b2 / a0) * x2 - (a1 / a0) * y1 - (a2 / a0) * y2;
    x2 = x1; x1 = sample; y2 = y1; y1 = y;
    return y;
  };
}

function oscSample(type, phase) {
  const p = phase % 1;
  switch (type) {
    case 'square': return p < 0.5 ? 1 : -1;
    case 'sawtooth': return 2 * p - 1;
    case 'triangle': return 4 * Math.abs(p - 0.5) - 1;
    default: return Math.sin(2 * Math.PI * p);
  }
}

export function render(ctx, seconds) {
  const out = new Float32Array(Math.ceil(seconds * RATE));
  for (const src of ctx.sources) {
    if (src.startT === undefined) continue;
    const stop = Math.min(src.stopT ?? src.startT + 2, seconds);
    const from = Math.max(0, Math.floor(src.startT * RATE));
    const to = Math.min(out.length, Math.ceil(stop * RATE));
    if (to <= from) continue;
    for (const chain of paths(src)) {
      const filters = chain.map((n) => (n instanceof BiquadNode ? makeFilter(n) : null));
      const noise = src instanceof BufferSourceNode ? src.buffer.getChannelData(0) : null;
      const offset = Math.floor((src.offset || 0) * RATE);
      let phase = 0;
      for (let i = from; i < to; i++) {
        const t = i / RATE;
        let s;
        if (noise) {
          const idx = offset + (i - from);
          s = noise[src.loop ? idx % noise.length : Math.min(idx, noise.length - 1)];
        } else {
          phase += src.frequency.valueAt(t) / RATE;
          s = oscSample(src.type, phase);
        }
        for (let c = 0; c < chain.length; c++) {
          s = filters[c] ? filters[c](s, t) : s * chain[c].gain.valueAt(t);
        }
        out[i] += s;
      }
    }
  }
  return out;
}

export function writeWav(file, samples) {
  const peak = samples.reduce((m, v) => Math.max(m, Math.abs(v)), 0) || 1;
  const gain = process.env.NO_NORM ? 1 : Math.min(1, 0.89 / peak);
  const pcm = Buffer.alloc(samples.length * 2);
  samples.forEach((v, i) => pcm.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(v * gain * 32767))), i * 2));
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  fs.writeFileSync(file, Buffer.concat([header, pcm]));
  return peak;
}
