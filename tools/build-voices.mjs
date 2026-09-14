#!/usr/bin/env node
/*
 * Records the spoken lines and writes them to assets/voice/, plus a manifest the game
 * loads. Two providers:
 *
 *   yarngpt  Nigerian voices from https://yarngpt.ai - the right accents for this game.
 *            Needs YARNGPT_API_KEY, read from the environment or from a local .env file
 *            (which is gitignored; the key never goes near the repo).
 *   say      macOS built-in speech. No Nigerian voice exists, so this is the fallback.
 *
 *   node tools/build-voices.mjs                 # record whatever changed
 *   node tools/build-voices.mjs --force         # record everything again
 *   node tools/build-voices.mjs --provider=say  # use macOS voices instead
 *   node tools/build-voices.mjs --sample "line" # try every YarnGPT voice on one line
 *
 * Clips are cached by a hash of provider + voice + text, so re-running costs nothing.
 * If a line has no recording the game falls back to the synthesised hawker cry in
 * src/audio.js, so this step is optional and the game runs fine without it.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, 'assets/voice');
const args = process.argv.slice(2);
const force = args.includes('--force');
const sampleAt = args.findIndex((a) => a === '--sample');
const wanted = (args.find((a) => a.startsWith('--provider=')) || '').split('=')[1];

// .env is for local secrets only and is gitignored.
for (const line of fs.existsSync(path.join(root, '.env')) ? fs.readFileSync(path.join(root, '.env'), 'utf8').split('\n') : []) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const KEY = process.env.YARNGPT_API_KEY;
const provider = wanted || (KEY ? 'yarngpt' : 'say');
if (provider === 'yarngpt' && !KEY) {
  console.error('YARNGPT_API_KEY is not set. Put it in .env or the environment, or pass --provider=say.');
  process.exit(1);
}

const YARNGPT_VOICES = ['Idera', 'Emma', 'Zainab', 'Osagie', 'Wura', 'Jude', 'Chinenye', 'Tayo',
  'Regina', 'Femi', 'Adaora', 'Umar', 'Mary', 'Nonso', 'Remi', 'Adam'];

// The cast, and who speaks for them with each provider.
const CAST = {
  sule:    { yarngpt: 'Umar',     say: ['Rocko', 168, 34] },   // Mallam Sule, suya spot
  nkechi:  { yarngpt: 'Chinenye', say: ['Tessa', 172, 52] },   // Mama Nkechi, mama put
  sikirat: { yarngpt: 'Wura',     say: ['Tessa', 178, 60] },   // Iya Sikirat, pure water
  bisi:    { yarngpt: 'Regina',   say: ['Moira', 172, 54] },   // Nurse Bisi, the clinic
  emmy:    { yarngpt: 'Nonso',    say: ['Daniel', 190, 38] },  // Bros Emmy, okada
  musa:    { yarngpt: 'Adam',     say: ['Rocko', 162, 30] },   // Alhaji Musa, keke
  danladi: { yarngpt: 'Jude',     say: ['Daniel', 205, 42] },  // Danladi, bus conductor
  scatter: { yarngpt: 'Osagie',   say: ['Rocko', 176, 32] },   // Agbero Scatter
  adaora:  { yarngpt: 'Adaora',   say: ['Tessa', 170, 56] },   // a trader across the market
  fashe:   { yarngpt: 'Tayo',     say: ['Rocko', 182, 28] },   // the one-chance conductor
};

// id -> [speaker, line]. The id is what src/entities.js and the market ambience ask for.
const LINES = {
  suya: ['sule', 'Suya! Come buy suya! E sweet die!'],
  mamaput: ['nkechi', 'Come chop! The food dey hot!'],
  water: ['sikirat', 'Pure water! Cold pure water o!'],
  nurse: ['bisi', 'Clinic dey open! Come make we check you!'],
  okadaman: ['emmy', 'Okada! Oga, where you dey go?'],
  kekeman: ['musa', 'Keke Maruwa dey! Enter with your change!'],
  conductor: ['danladi', 'Oshodi! Balogun! Enter with your change o!'],
  agbero: ['scatter', 'Oga! Stop there! Where your ticket?'],
  fashe: ['fashe', 'Oga! Na one chance you enter! Drop everything!'],
  market1: ['adaora', 'Come buy something! Customer, come!'],
  market2: ['sule', 'Fine fine things dey here! Come look!'],
  market3: ['sikirat', 'Buy your own! E remain small!'],
};

// YarnGPT hands back audio that stops dead on the last phoneme, with no decay, which
// sounds like the line was cut off. Ease the tail down and leave a beat of silence.
function softenTail(wav, fadeMs = 70, tailMs = 140) {
  let off = 12;
  while (off < wav.length - 8 && wav.toString('latin1', off, off + 4) !== 'data') off += 8 + wav.readUInt32LE(off + 4);
  if (off >= wav.length - 8) return wav;                       // not a WAV we understand
  const rate = wav.readUInt32LE(24);
  const channels = wav.readUInt16LE(22);
  const dataAt = off + 8;
  const bytes = wav.readUInt32LE(off + 4);
  const samples = bytes / 2;
  const fade = Math.min(samples, Math.floor((fadeMs / 1000) * rate) * channels);
  for (let i = 0; i < fade; i++) {
    const at = dataAt + (samples - fade + i) * 2;
    wav.writeInt16LE(Math.round(wav.readInt16LE(at) * (1 - i / fade)), at);
  }
  const silence = Buffer.alloc(Math.floor((tailMs / 1000) * rate) * channels * 2);
  const out = Buffer.concat([wav.subarray(0, dataAt), wav.subarray(dataAt, dataAt + bytes), silence]);
  out.writeUInt32LE(bytes + silence.length, off + 4);           // data chunk size
  out.writeUInt32LE(out.length - 8, 4);                         // RIFF size
  return out;
}

async function yarn(text, voice, format = 'mp3') {
  const res = await fetch('https://yarngpt.ai/api/v1/tts', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice, response_format: format }),
  });
  if (!res.ok) throw new Error(`YarnGPT ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const type = res.headers.get('content-type') || '';
  if (!type.startsWith('audio/')) throw new Error(`YarnGPT returned "${type}", not audio`);
  return Buffer.from(await res.arrayBuffer());
}

fs.mkdirSync(OUT, { recursive: true });

// --sample "some line": hear every Nigerian voice say the same thing, to cast the parts.
if (sampleAt >= 0) {
  const text = args[sampleAt + 1] || 'Suya! Come buy suya! E sweet die!';
  const dir = path.join(OUT, 'samples');
  fs.mkdirSync(dir, { recursive: true });
  for (const voice of YARNGPT_VOICES) {
    const file = path.join(dir, `${voice}.mp3`);
    if (!force && fs.existsSync(file)) { console.log(`  ${voice.padEnd(9)} cached`); continue; }
    fs.writeFileSync(file, await yarn(text, voice));
    console.log(`  ${voice.padEnd(9)} ${Math.round(fs.statSync(file).size / 1024)}KB`);
  }
  console.log(`\n${YARNGPT_VOICES.length} samples of "${text}" -> ${path.relative(process.cwd(), dir)}`);
  process.exit(0);
}

const manifest = {};
let made = 0;
let kept = 0;

for (const [id, [speaker, text]] of Object.entries(LINES)) {
  const cast = CAST[speaker];
  const voice = provider === 'yarngpt' ? cast.yarngpt : cast.say[0];
  const ext = 'm4a';
  const stamp = crypto.createHash('sha1').update(`${provider}|${JSON.stringify(cast[provider])}|${text}`).digest('hex').slice(0, 8);
  const file = path.join(OUT, `${id}.${ext}`);
  const marker = path.join(OUT, `.${id}.${stamp}`);

  if (!force && fs.existsSync(file) && fs.existsSync(marker)) {
    kept++;
  } else {
    if (provider === 'yarngpt') {
      // Fetch as WAV so the tail can be eased off, then encode.
      const wav = path.join(OUT, `.${id}.wav`);
      fs.writeFileSync(wav, softenTail(await yarn(text, voice, 'wav')));
      execFileSync('afconvert', ['-f', 'mp4f', '-d', 'aac', '-b', '96000', wav, file]);
      fs.rmSync(wav);
    } else {
      const [sayVoice, rate, pitch] = cast.say;
      const txt = path.join(OUT, `.${id}.txt`);
      const wav = path.join(OUT, `.${id}.wav`);
      fs.writeFileSync(txt, `[[pbas ${pitch}]] ${text}`);
      execFileSync('say', ['-v', sayVoice, '-r', String(rate), '-f', txt, '-o', wav, '--data-format=LEI16@44100']);
      execFileSync('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', '96000', wav, file]);
      fs.rmSync(txt);
      fs.rmSync(wav);
    }
    // drop stale markers and any clip left over from the other provider
    for (const old of fs.readdirSync(OUT)) {
      if (old.startsWith(`.${id}.`)) fs.rmSync(path.join(OUT, old));
    }
    for (const other of ['mp3', 'm4a']) {
      const stale = path.join(OUT, `${id}.${other}`);
      if (other !== ext && fs.existsSync(stale)) fs.rmSync(stale);
    }
    fs.writeFileSync(marker, '');
    made++;
  }
  manifest[id] = { src: `assets/voice/${id}.${ext}`, text, voice, speaker };
}

fs.writeFileSync(
  path.join(OUT, 'manifest.js'),
  `// Generated by tools/build-voices.mjs - do not edit by hand.\nwindow.VOICE_CLIPS = ${JSON.stringify(manifest, null, 2)};\n`,
);
const kb = Object.values(manifest).reduce((n, m) => n + fs.statSync(path.join(root, m.src)).size, 0) / 1024;
console.log(`${provider}: ${made} recorded, ${kept} unchanged, ${Object.keys(manifest).length} clips, ${Math.round(kb)}KB total`);
for (const [id, m] of Object.entries(manifest)) console.log(`  ${id.padEnd(10)} ${m.voice.padEnd(9)} "${m.text}"`);
