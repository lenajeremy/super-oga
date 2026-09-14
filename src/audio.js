/* SUPER OGA - sound.
 *
 * Everything here is synthesised live with WebAudio: no audio files ship with the game.
 * The kit is built for Afrobeat - shekere, congas, agogo bell, rim ghosts, a locked bass
 * ostinato, choppy tenor guitar and horn stabs. The grooves themselves live in
 * src/music.js; this file turns them into sound.
 */
'use strict';

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

// Rough formant pairs, enough to tell one vowel from another.
const VOWELS = {
  a: [760, 1200],
  e: [530, 1840],
  i: [320, 2300],
  o: [450, 820],
  u: [330, 870],
};

const Sound = {
  ctx: null,
  master: null,
  sfxBus: null,
  musicBus: null,
  verb: null,
  noiseBuffer: null,
  muted: Store.get('muted', false),
  song: null,
  timer: 0,
  engine: null,
  amb: null,
  ambTimer: 0,

  unlock() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      this.ctx = ctx;

      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.7;
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -8;
      limiter.ratio.value = 6;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.12;
      this.master.connect(limiter).connect(ctx.destination);

      this.sfxBus = ctx.createGain();
      this.sfxBus.gain.value = 0.55;
      this.sfxBus.connect(this.master);

      this.musicBus = ctx.createGain();
      this.musicBus.gain.value = 0.34;
      this.musicBus.connect(this.master);

      // A short room on the percussion: Afrobeat kits never sound bone dry.
      this.verb = ctx.createGain();
      this.verb.gain.value = 0.16;
      const convolver = ctx.createConvolver();
      convolver.buffer = this.impulse(1.1, 3.4);
      this.verb.connect(convolver).connect(this.master);

      this.noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  },

  impulse(seconds, decay) {
    const rate = this.ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = this.ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  },

  toggleMute() {
    this.muted = !this.muted;
    Store.set('muted', this.muted);
    if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.7, this.ctx.currentTime, 0.02);
    if (this.muted) {
      this.stopEngine();
      this.stopAmbience();
    }
    return this.muted;
  },

  suspend() {
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend();
  },

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },

  // ---------------------------------------------------------------- building blocks
  tone(freq, { type = 'square', dur = 0.1, vol = 0.2, delay = 0, when, slide = 0, vibrato = 0, bus, attack = 0.004, send = 0 } = {}) {
    if (!this.ctx) return;
    const t = when ?? this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
    if (vibrato) {
      const lfo = this.ctx.createOscillator();
      const depth = this.ctx.createGain();
      lfo.frequency.value = 7;
      depth.gain.value = vibrato;
      lfo.connect(depth).connect(osc.frequency);
      lfo.start(t);
      lfo.stop(t + dur);
    }
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(bus || this.sfxBus);
    if (send && this.verb) gain.connect(this.verb);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  },

  noise({ dur = 0.1, vol = 0.2, delay = 0, when, filter = 'bandpass', freq = 1000, q = 1, slide = 0, bus, send = 0 } = {}) {
    if (!this.ctx) return;
    const t = when ?? this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const biquad = this.ctx.createBiquadFilter();
    biquad.type = filter;
    biquad.frequency.setValueAtTime(freq, t);
    biquad.Q.value = q;
    if (slide) biquad.frequency.exponentialRampToValueAtTime(slide, t + dur);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(biquad).connect(gain);
    gain.connect(bus || this.sfxBus);
    if (send && this.verb) gain.connect(this.verb);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  },

  // ---------------------------------------------------------------- the kit
  kick(t, vol, bus) {
    this.tone(120, { type: 'sine', dur: 0.26, vol: vol * 0.9, slide: 44, when: t, bus, attack: 0.002 });
    this.noise({ dur: 0.02, vol: vol * 0.25, filter: 'lowpass', freq: 2600, when: t, bus });
  },

  snare(t, vol, bus) {
    this.noise({ dur: 0.13, vol: vol * 0.55, filter: 'bandpass', freq: 1900, q: 0.7, when: t, bus, send: 1 });
    this.tone(190, { type: 'triangle', dur: 0.09, vol: vol * 0.3, slide: 150, when: t, bus });
  },

  // Rim / ghost note: the little stick taps that keep an Afrobeat groove breathing.
  rim(t, vol, bus) {
    this.noise({ dur: 0.04, vol: vol * 0.55, filter: 'bandpass', freq: 2700, q: 3, when: t, bus, send: 1 });
    this.tone(430, { type: 'triangle', dur: 0.04, vol: vol * 0.28, when: t, bus });
  },

  shaker(t, vol, bus) {
    this.noise({ dur: 0.05, vol: vol * 0.5, filter: 'highpass', freq: 6200, when: t, bus, send: 1 });
  },

  conga(t, vol, bus, high) {
    const f = high ? 290 : 196;
    this.tone(f, { type: 'sine', dur: 0.19, vol: vol * 0.75, slide: f * 0.82, when: t, bus, attack: 0.002, send: 1 });
    this.noise({ dur: 0.028, vol: vol * 0.2, filter: 'bandpass', freq: f * 5, q: 1.4, when: t, bus });
  },

  // Agogo bell: two detuned squares through a tight bandpass.
  bell(t, vol, bus) {
    for (const f of [824, 1243]) {
      this.tone(f, { type: 'square', dur: 0.19, vol: vol * 0.16, when: t, bus, attack: 0.002, send: 1 });
    }
    this.noise({ dur: 0.05, vol: vol * 0.16, filter: 'bandpass', freq: 3600, q: 6, when: t, bus });
  },

  clap(t, vol, bus) {
    for (let i = 0; i < 3; i++) {
      this.noise({ dur: 0.05, vol: vol * (0.3 - i * 0.06), filter: 'bandpass', freq: 1500, q: 0.9, when: t + i * 0.011, bus, send: 1 });
    }
    this.noise({ dur: 0.16, vol: vol * 0.22, filter: 'bandpass', freq: 1200, q: 0.7, when: t + 0.03, bus, send: 1 });
  },

  // Tenor guitar: short, choppy, muted pluck.
  guitarNote(t, freq, dur, vol, bus, soft) {
    this.tone(freq, { type: soft ? 'triangle' : 'square', dur, vol, when: t, bus, attack: 0.003, send: 1 });
    this.tone(freq * 2.01, { type: 'triangle', dur: dur * 0.6, vol: vol * 0.3, when: t, bus });
  },

  bassNote(t, freq, dur, vol, bus) {
    this.tone(freq, { type: 'triangle', dur, vol, when: t, bus, attack: 0.006 });
    this.tone(freq, { type: 'square', dur: dur * 0.5, vol: vol * 0.12, when: t, bus, attack: 0.006 });
  },

  // Log drum: the sliding sine bass under modern Afrobeats.
  logNote(t, freq, dur, vol, bus) {
    this.tone(freq * 0.72, { type: 'sine', dur, vol, when: t, bus, slide: freq, attack: 0.012 });
  },

  keysNote(t, freq, dur, vol, bus) {
    this.tone(freq, { type: 'triangle', dur, vol, when: t, bus, attack: 0.02, send: 1 });
  },

  // Horn stab: detuned saws, fast attack, a little bite.
  hornNote(t, freq, dur, vol, bus) {
    for (const detune of [0.997, 1, 1.004]) {
      this.tone(freq * detune, { type: 'sawtooth', dur, vol: vol * 0.42, when: t, bus, attack: 0.012, send: 1 });
    }
  },

  // ---------------------------------------------------------------- voices
  // A hawker's cry, built by pushing a buzzy tone through vowel formants. You cannot make
  // out the words - the floating text does that - but it reads as a human calling out.
  voice(t, freq, vowel, dur, vol, bus) {
    if (!this.ctx) return;
    const [f1, f2] = VOWELS[vowel] || VOWELS.a;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.linearRampToValueAtTime(freq * 0.94, t + dur);
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(vol, t + 0.04);
    env.gain.setValueAtTime(vol, t + dur * 0.6);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(env);
    for (const [freqHz, q, gain] of [[f1, 8, 3.2], [f2, 11, 1.9], [2600, 7, 0.45]]) {
      const band = this.ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.value = freqHz;
      band.Q.value = q;
      const level = this.ctx.createGain();
      level.gain.value = gain;
      env.connect(band).connect(level);
      level.connect(bus || this.sfxBus);
      if (this.verb) level.connect(this.verb);
    }
    osc.start(t);
    osc.stop(t + dur + 0.05);
  },

  // phrase: a string of vowels, '-' for a short gap. Volume falls off with distance.
  callOut(phrase, { pitch = 140, rate = 0.15, vol = 0.22 } = {}) {
    if (!this.ctx || this.muted || vol < 0.01) return;
    let t = this.ctx.currentTime + 0.02;
    let step = 0;
    for (const ch of phrase) {
      if (ch === '-') {
        t += rate * 0.7;
        continue;
      }
      // Street cries rise and fall; nudge the pitch around so it sings rather than drones.
      const bend = [1, 1.12, 1.06, 0.94, 1.18, 1][step % 6];
      this.voice(t, pitch * bend, ch, rate * 1.25, vol, this.sfxBus);
      t += rate;
      step++;
    }
  },

  // Say a line out loud. Uses the recording from tools/build-voices.mjs when one exists,
  // and falls back to the synthesised cry so the game still talks without the recordings.
  speak(id, { vol = 0.9, fallback } = {}) {
    if (this.muted) return;
    const clip = Assets.voices[id];
    if (clip) {
      try {
        const take = clip.cloneNode();
        take.volume = Math.max(0, Math.min(1, vol));
        const played = take.play();
        if (played && played.catch) played.catch(() => {});
        return;
      } catch {
        // fall through to the synthesised cry
      }
    }
    if (fallback) this.callOut(fallback.vowels, { pitch: fallback.pitch, vol: 0.22 * vol });
  },

  // ---------------------------------------------------------------- sound effects
  play(name) {
    if (!this.ctx || this.muted) return;
    const T = (freq, opts) => this.tone(freq, opts);
    const N = (opts) => this.noise(opts);
    const arp = (freqs, type, step, vol, dur) => freqs.forEach((f, i) => T(f, { type, dur, vol, delay: i * step }));
    switch (name) {
      case 'jump': T(300, { dur: 0.14, vol: 0.11, slide: 640 }); break;
      case 'bigJump': T(220, { dur: 0.16, vol: 0.11, slide: 500 }); break;
      case 'coin':
        T(1568, { type: 'triangle', dur: 0.05, vol: 0.18 });
        T(2093, { type: 'triangle', dur: 0.22, vol: 0.18, delay: 0.05 });
        N({ dur: 0.03, vol: 0.05, filter: 'highpass', freq: 6000 });
        break;
      case 'cash':
        T(1245, { type: 'triangle', dur: 0.07, vol: 0.14 });
        T(1661, { type: 'triangle', dur: 0.16, vol: 0.12, delay: 0.06 });
        N({ dur: 0.18, vol: 0.06, filter: 'bandpass', freq: 3800, q: 1.4, delay: 0.02 });
        break;
      case 'blip': T(1320, { type: 'square', dur: 0.022, vol: 0.035 }); break;
      case 'stomp': N({ dur: 0.08, vol: 0.3, filter: 'lowpass', freq: 1400 }); T(170, { type: 'sine', dur: 0.12, vol: 0.35, slide: 55 }); break;
      case 'kick': T(520, { dur: 0.12, vol: 0.12, slide: 120 }); break;
      case 'bump': T(140, { dur: 0.08, vol: 0.16, slide: 90 }); break;
      case 'break': N({ dur: 0.3, vol: 0.35, freq: 900, q: 0.7, slide: 200 }); T(120, { type: 'sine', dur: 0.15, vol: 0.3, slide: 50 }); break;
      case 'appear': arp([523, 659, 784, 1047], 'triangle', 0.05, 0.14, 0.08); break;
      case 'grow': arp([392, 523, 659, 784, 1047, 1319], 'square', 0.055, 0.08, 0.07); break;
      case 'power': arp([659, 880, 1109, 1319], 'triangle', 0.06, 0.14, 0.12); N({ dur: 0.3, vol: 0.05, filter: 'highpass', freq: 5000, delay: 0.1 }); break;
      case 'shrink': T(620, { dur: 0.4, vol: 0.12, slide: 140 }); break;
      case 'die':
        [392, 370, 349, 330].forEach((f, i) => T(f, { dur: 0.2, vol: 0.12, delay: 0.25 + i * 0.22, vibrato: 6 }));
        T(262, { type: 'triangle', dur: 0.6, vol: 0.2, delay: 1.15, slide: 131 });
        break;
      case 'oneUp': arp([659, 784, 1319, 1047, 1175, 1568], 'triangle', 0.08, 0.16, 0.09); break;
      case 'throw': N({ dur: 0.12, vol: 0.18, filter: 'highpass', freq: 1500, slide: 5000 }); break;
      case 'splash': N({ dur: 0.25, vol: 0.25, filter: 'lowpass', freq: 3000, slide: 300 }); break;
      case 'horn': T(740, { dur: 0.1, vol: 0.1 }); T(740, { dur: 0.14, vol: 0.1, delay: 0.16 }); break;
      case 'rev':
        T(70, { type: 'sawtooth', dur: 0.45, vol: 0.12, slide: 190 });
        N({ dur: 0.45, vol: 0.06, filter: 'lowpass', freq: 500, slide: 1600 });
        break;
      case 'crash':
        N({ dur: 0.5, vol: 0.3, filter: 'bandpass', freq: 2400, q: 0.6, slide: 300 });
        T(150, { type: 'sine', dur: 0.3, vol: 0.3, slide: 45 });
        N({ dur: 0.7, vol: 0.12, filter: 'highpass', freq: 5000, delay: 0.04 });
        break;
      case 'nepaOff':
        // Everything winding down at once: the hum drops, the fan slows, silence.
        T(220, { type: 'sawtooth', dur: 1.1, vol: 0.09, slide: 42 });
        T(110, { type: 'triangle', dur: 1.2, vol: 0.12, slide: 28 });
        N({ dur: 0.9, vol: 0.05, filter: 'lowpass', freq: 1800, slide: 180 });
        break;
      case 'nepaOn':
        // And the whole street shouting "up NEPA!"
        arp([392, 523, 659, 784], 'triangle', 0.07, 0.13, 0.16);
        T(110, { type: 'sawtooth', dur: 0.5, vol: 0.07, slide: 230 });
        N({ dur: 0.5, vol: 0.05, filter: 'bandpass', freq: 900, q: 0.8, slide: 3000 });
        break;
      case 'goat': T(330, { type: 'sawtooth', dur: 0.45, vol: 0.07, vibrato: 25, slide: 290 }); break;
      case 'steal': T(700, { dur: 0.1, vol: 0.12, slide: 350 }); T(350, { dur: 0.18, vol: 0.12, delay: 0.1, slide: 175 }); break;
      case 'checkpoint': arp([523, 784, 1047], 'triangle', 0.09, 0.16, 0.12); break;
      case 'tick': T(1760, { type: 'triangle', dur: 0.03, vol: 0.07 }); break;
      case 'pause': T(880, { dur: 0.06, vol: 0.1 }); T(660, { dur: 0.08, vol: 0.1, delay: 0.07 }); break;
      case 'select': T(988, { type: 'triangle', dur: 0.08, vol: 0.14 }); break;
      case 'warn': T(880, { dur: 0.05, vol: 0.08 }); T(880, { dur: 0.05, vol: 0.08, delay: 0.1 }); break;
      case 'clear': this.jingle([[72, 0, 0.15], [76, 0.15, 0.15], [79, 0.3, 0.15], [81, 0.45, 0.3], [79, 0.75, 0.15], [81, 0.9, 0.15], [84, 1.05, 0.7]]); break;
      case 'gameOver': this.jingle([[67, 0, 0.3], [63, 0.35, 0.3], [60, 0.7, 0.3], [55, 1.05, 1]]); break;
      case 'victory': this.jingle([[72, 0, 0.12], [74, 0.12, 0.12], [76, 0.24, 0.12], [79, 0.36, 0.24], [76, 0.6, 0.12], [79, 0.72, 0.12], [84, 0.84, 0.5], [81, 1.4, 0.12], [84, 1.52, 0.9]]); break;
      default: break;
    }
  },

  jingle(notes) {
    for (const [note, at, dur] of notes) {
      this.tone(midi(note), { type: 'square', dur, vol: 0.09, delay: at });
      this.tone(midi(note - 12), { type: 'triangle', dur, vol: 0.14, delay: at });
    }
  },

  // ---------------------------------------------------------------- ambience
  // A quiet bed under everything - traffic, market crowd, water, or night insects - plus
  // occasional one-off sounds on top so a place never feels like a loop.
  setAmbience(kind) {
    if (!this.ctx) return;
    if (this.amb && this.amb.kind === kind) return;
    this.stopAmbience();
    if (!kind || this.muted) return;
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    gain.connect(this.master);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    const bed = {
      street: { type: 'lowpass', freq: 340, q: 0.7, vol: 0.05 },
      market: { type: 'bandpass', freq: 520, q: 0.5, vol: 0.055 },
      bridge: { type: 'lowpass', freq: 240, q: 0.8, vol: 0.045 },
      night: { type: 'lowpass', freq: 180, q: 0.8, vol: 0.03 },
    }[kind] || { type: 'lowpass', freq: 300, q: 0.7, vol: 0.04 };
    filter.type = bed.type;
    filter.frequency.value = bed.freq;
    filter.Q.value = bed.q;
    src.connect(filter).connect(gain);
    src.start();
    gain.gain.setTargetAtTime(bed.vol, ctx.currentTime, 0.6);

    // A slow swell so the bed breathes instead of sitting flat.
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.value = 0.07;
    depth.gain.value = bed.vol * 0.4;
    lfo.connect(depth).connect(gain.gain);
    lfo.start();

    this.amb = { kind, src, gain, lfo, vol: bed.vol };
    this.ambTimer = setInterval(() => this.ambienceTick(), 900);
  },

  stopAmbience() {
    clearInterval(this.ambTimer);
    this.ambTimer = 0;
    const a = this.amb;
    if (!a) return;
    this.amb = null;
    const t = this.ctx.currentTime;
    a.gain.gain.cancelScheduledValues(t);
    a.gain.gain.setTargetAtTime(0.0001, t, 0.25);
    a.src.stop(t + 1.2);
    a.lfo.stop(t + 1.2);
  },

  ambienceTick() {
    const a = this.amb;
    if (!a || this.muted || this.ctx.state !== 'running') return;
    const r = Math.random();
    if (a.kind === 'night') {
      // Crickets in pairs, and now and then a mosquito goes past your ear.
      if (r < 0.75) {
        const base = 4200 + Math.random() * 900;
        for (let i = 0; i < 3 + Math.floor(Math.random() * 3); i++) {
          this.noise({ dur: 0.035, vol: 0.05, filter: 'bandpass', freq: base, q: 22, delay: i * 0.09 });
        }
      }
      if (r > 0.62) this.mosquitoPass();
      if (r > 0.93) this.noise({ dur: 1.4, vol: 0.02, filter: 'bandpass', freq: 700, q: 1.2 });
      return;
    }
    if (a.kind === 'market' && r < 0.55) {
      // Somebody across the market hawking, at the volume of somebody across a market.
      const which = `market${1 + Math.floor(Math.random() * 3)}`;
      this.speak(which, {
        vol: 0.22 + Math.random() * 0.12,
        fallback: { vowels: ['a-oa', 'ua-a', 'oa-ai', 'e-au'][Math.floor(Math.random() * 4)], pitch: 110 + Math.random() * 70 },
      });
      return;
    }
    if (a.kind === 'street' && r < 0.4) {
      this.tone(600 + Math.random() * 300, { dur: 0.18, vol: 0.03, type: 'square' });
      if (r < 0.15) this.tone(520, { dur: 0.22, vol: 0.025, type: 'square', delay: 0.26 });
      return;
    }
    if (a.kind === 'bridge' && r < 0.3) {
      this.noise({ dur: 2.2, vol: 0.035, filter: 'bandpass', freq: 420, q: 0.6, slide: 260 });
    }
  },

  // One mosquito, arriving and leaving.
  mosquitoPass() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const dur = 1.6 + Math.random();
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    const base = 560 + Math.random() * 180;
    osc.frequency.setValueAtTime(base * 0.8, t);
    osc.frequency.linearRampToValueAtTime(base * 1.25, t + dur * 0.5);
    osc.frequency.linearRampToValueAtTime(base * 0.75, t + dur);
    const wob = this.ctx.createOscillator();
    const wobDepth = this.ctx.createGain();
    wob.frequency.value = 11;
    wobDepth.gain.value = 26;
    wob.connect(wobDepth).connect(osc.frequency);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.035, t + dur * 0.45);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2400;
    osc.connect(lp).connect(g).connect(this.master);
    osc.start(t);
    wob.start(t);
    osc.stop(t + dur + 0.1);
    wob.stop(t + dur + 0.1);
  },

  // Pull the music right down without stopping it, for the blackout.
  duckMusic(on) {
    if (!this.musicBus) return;
    this.musicBus.gain.setTargetAtTime(on ? 0.02 : 0.34, this.ctx.currentTime, 0.4);
  },

  // ---------------------------------------------------------------- okada / keke engine
  startEngine() {
    if (!this.ctx || this.engine || this.muted) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 58;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const grit = ctx.createGain();
    grit.gain.value = 0.35;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    filter.Q.value = 3;
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    osc.connect(filter);
    src.connect(grit).connect(filter);
    filter.connect(gain).connect(this.master);
    osc.start();
    src.start();
    gain.gain.setTargetAtTime(0.06, ctx.currentTime, 0.1);
    this.engine = { osc, src, filter, gain };
  },

  updateEngine(throttle) {
    if (!this.engine) return;
    const t = this.ctx.currentTime;
    this.engine.osc.frequency.setTargetAtTime(52 + throttle * 96, t, 0.09);
    this.engine.filter.frequency.setTargetAtTime(340 + throttle * 900, t, 0.09);
    this.engine.gain.gain.setTargetAtTime(0.045 + throttle * 0.05, t, 0.12);
  },

  stopEngine() {
    const e = this.engine;
    if (!e) return;
    this.engine = null;
    const t = this.ctx.currentTime;
    e.gain.gain.setTargetAtTime(0.0001, t, 0.05);
    e.osc.stop(t + 0.4);
    e.src.stop(t + 0.4);
  },

  // ---------------------------------------------------------------- the groove
  startMusic(name) {
    if (!this.ctx) return;
    this.stopMusic();
    const def = MUSIC.SONGS[name] || MUSIC.SONGS.eko;
    this.song = { name, def, step: 0, next: this.ctx.currentTime + 0.1, speed: 1, paused: false };
    this.timer = setInterval(() => this.schedule(), 25);
  },

  stopMusic() {
    clearInterval(this.timer);
    this.timer = 0;
    this.song = null;
  },

  setSpeed(speed) {
    if (this.song) this.song.speed = speed;
  },

  pauseMusic(paused) {
    if (!this.song) return;
    this.song.paused = paused;
    if (!paused) this.song.next = this.ctx.currentTime + 0.05;
  },

  schedule() {
    const song = this.song;
    if (!song || song.paused || this.ctx.state !== 'running') return;
    const def = song.def;
    const steps = 16 * MUSIC.barsOf(def);
    const stepDur = 60 / (def.bpm * song.speed) / 4;
    if (song.next < this.ctx.currentTime - 0.25) song.next = this.ctx.currentTime + 0.02;
    while (song.next < this.ctx.currentTime + 0.15) {
      // Swing: odd 16ths land late, which is where the shuffle comes from.
      const swung = song.step % 2 ? stepDur * def.swing * 0.5 : 0;
      this.playStep(def, song.step, song.next + swung, stepDur);
      song.next += stepDur;
      song.step = (song.step + 1) % steps;
    }
  },

  playStep(def, step, t, stepDur) {
    const bus = this.musicBus;
    const bar = Math.floor(step / 16);
    const i = step % 16;
    const root = def.root + def.bars[bar % def.bars.length];

    const hit = (name) => {
      const row = def.drums[name];
      return row ? MUSIC.patternAt(row, bar)[i] : '.';
    };
    const level = (ch) => (ch === 'X' ? 1 : ch === 'x' ? 0.72 : ch === '-' ? 0.32 : 0);

    let v = level(hit('kick'));
    if (v) this.kick(t, 0.4 * v, bus);
    v = level(hit('snare'));
    if (v) this.snare(t, 0.46 * v, bus);
    v = level(hit('rim'));
    if (v) this.rim(t, 0.7 * v, bus);
    v = level(hit('shaker'));
    if (v) this.shaker(t, 0.8 * v, bus);
    v = level(hit('conga'));
    if (v) this.conga(t, 0.5 * v, bus, hit('conga') === 'X');
    v = level(hit('bell'));
    if (v) this.bell(t, 0.8 * v, bus);
    v = level(hit('clap'));
    if (v) this.clap(t, 0.5 * v, bus);

    // Pitched tracks.
    for (const [track, play] of [
      ['bass', this.bassNote],
      ['guitar', this.guitarNote],
      ['keys', this.keysNote],
      ['horn', this.hornNote],
    ]) {
      const part = def[track];
      if (!part) continue;
      const index = MUSIC.noteAt(part.pattern, bar, i);
      if (index === null) continue;
      const scale = part.scale || def.scale;
      const base = root + (part.octave || 0) + MUSIC.semitone(scale, index);
      const dur = part.dur || MUSIC.holdLength(part.pattern, bar, i) * stepDur * 0.92;
      play.call(this, t, midi(base), dur, part.vol, bus, part.soft);
      for (const extra of part.stack || []) {
        play.call(this, t, midi(base + extra), dur, part.vol * 0.6, bus, part.soft);
      }
    }

    // Log drum follows the kick pattern with its own riff of pitches.
    const log = def.log;
    if (log && level(MUSIC.patternAt(log.pattern, bar)[i])) {
      const index = MUSIC.noteAt(log.riff, bar, i);
      if (index !== null) {
        const base = root + (log.octave || 0) + MUSIC.semitone(log.scale || def.scale, index);
        this.logNote(t, midi(base), stepDur * 2.4, log.vol, bus);
      }
    }
  },
};
