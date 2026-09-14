// 16x16 tiles: ground for each stage (Oshodi street, Balogun market, Third Mainland
// Bridge), cement blocks, Ghana-Must-Go crates, flyover pillars, planks and lagoon water.
import { Pix } from './pix.mjs';

const T = 16;

function rng(seed) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

function speckle(p, y0, y1, colors, count, seed) {
  const r = rng(seed);
  for (let i = 0; i < count; i++) {
    p.set(Math.floor(r() * T), y0 + Math.floor(r() * (y1 - y0)), colors[Math.floor(r() * colors.length)]);
  }
  return p;
}

const laterite = (p, y0, seed) => speckle(p.rect(0, y0, T, T - y0, 'e'), y0, T, ['E', 'D', 'D', 'E', 'd'], 14, seed);

function streetTop() {
  // Interlocking paving stones on a curb, red laterite soil underneath.
  const p = laterite(new Pix(T, T), 7, 7);
  p.rect(0, 0, T, 7, 'N');
  p.rect(9, 1, 7, 2, 'w').rect(0, 4, 4, 2, 'w').rect(13, 4, 3, 2, 'w');
  p.rect(0, 0, T, 1, 'W');
  p.rect(0, 3, T, 1, 'n');
  p.rect(0, 1, 1, 2, 'n').rect(8, 1, 1, 2, 'n').rect(4, 4, 1, 2, 'n').rect(12, 4, 1, 2, 'n');
  return p.rect(0, 6, T, 1, 'k');
}

function marketTop() {
  const p = speckle(new Pix(T, T).rect(0, 0, T, T, 'D'), 3, T, ['d', 'e', 'd'], 16, 3);
  p.rect(0, 0, T, 2, 'e').rect(0, 0, T, 1, 'E').rect(0, 2, T, 1, 'd');
  for (const x of [2, 9, 13]) p.set(x, 0, 'G').set(x + 1, 0, 'l').set(x, 1, 'g');
  return p.set(6, 1, 'N').set(11, 1, 'w');
}

function bridgeTop() {
  const p = new Pix(T, T).rect(0, 0, T, T, 'n');
  p.rect(0, 0, T, 1, 'W').rect(0, 1, T, 3, 'N').rect(2, 2, 6, 1, 'Y');
  p.rect(0, 4, T, 1, 'k').rect(0, 5, T, 1, 'z');
  p.rect(0, 6, 1, 10, 'z').rect(8, 6, 1, 10, 'z');
  speckle(p, 7, 15, ['z', 'N'], 8, 5);
  return p.rect(0, 15, T, 1, 'k');
}

function bridgeFill() {
  const p = new Pix(T, T).rect(0, 0, T, T, 'n');
  p.rect(0, 0, 1, T, 'z').rect(8, 0, 1, T, 'z');
  speckle(p, 0, T, ['z', 'N'], 8, 13);
  return p.rect(0, 15, T, 1, 'k');
}

function block() {
  // Sandcrete cement block: breakable when you're Big Oga.
  const p = speckle(new Pix(T, T).rect(0, 0, T, T, 'N'), 0, T, ['n', 'w'], 12, 21);
  p.rect(0, 7, T, 1, 'n').rect(7, 0, 1, 7, 'n').rect(3, 8, 1, 8, 'n').rect(11, 8, 1, 8, 'n');
  p.rect(1, 1, 5, 1, 'W').rect(9, 1, 5, 1, 'W').rect(1, 9, 2, 1, 'W').rect(5, 9, 5, 1, 'W');
  return p.box(0, 0, T, T, 'K');
}

function roundCorners(p) {
  return p.erase(0, 0).erase(T - 1, 0).erase(0, T - 1).erase(T - 1, T - 1);
}

function crate(shine) {
  // Ghana-Must-Go bag with a gold naira tag: bump it from below.
  const p = new Pix(T, T).rect(1, 1, 14, 14, 'W');
  for (const x of [3, 4, 11, 12]) p.rect(x, 1, 1, 14, x < 8 ? 'R' : 'B');
  for (const y of [3, 4, 11, 12]) p.rect(1, y, 14, 1, y < 8 ? 'B' : 'R');
  for (const x of [3, 4, 11, 12]) for (const y of [3, 4, 11, 12]) p.set(x, y, 'p');
  p.rect(5, 5, 6, 6, shine ? 'A' : 'Y').box(5, 5, 6, 6, 'y');
  p.text(6, 5, '₦', 'K');
  p.rect(1, 1, 14, 1, 'y');
  if (shine) p.set(13, 2, 'W').set(12, 1, 'W').set(2, 13, 'A');
  return roundCorners(p.box(0, 0, T, T, 'K'));
}

function crateUsed() {
  const p = new Pix(T, T).rect(1, 1, 14, 14, 'D');
  for (const x of [3, 4, 11, 12]) p.rect(x, 1, 1, 14, 'd');
  for (const y of [3, 4, 11, 12]) p.rect(1, y, 14, 1, 'd');
  p.rect(1, 1, 14, 1, 'e');
  return roundCorners(p.box(0, 0, T, T, 'K'));
}

function solid() {
  const p = new Pix(T, T).rect(0, 0, T, T, 'n');
  p.rect(1, 1, 14, 1, 'N').rect(1, 1, 1, 14, 'N').rect(2, 14, 13, 1, 'z').rect(14, 2, 1, 13, 'z');
  for (const [x, y] of [[3, 3], [12, 3], [3, 12], [12, 12]]) p.set(x, y, 'k').set(x - 1, y - 1, 'W');
  return p.box(0, 0, T, T, 'K');
}

function pillar(side, cap) {
  // Two-tile-wide flyover pillar, like the ones under Oshodi bridge.
  const L = side === 'l';
  const p = new Pix(T, T);
  if (L) p.rect(2, 0, 14, T, 'N').rect(4, 0, 1, T, 'W').rect(2, 0, 1, T, 'K').rect(10, 3, 1, 9, 'n');
  else p.rect(0, 0, 14, T, 'N').rect(8, 0, 5, T, 'n').rect(13, 0, 1, T, 'K').rect(3, 5, 1, 8, 'n');
  if (cap) {
    p.rect(0, 0, T, 7, 'N').rect(0, 0, T, 1, 'K').rect(0, 1, T, 1, 'W').rect(0, 5, T, 1, 'n').rect(0, 6, T, 1, 'K');
    p.rect(L ? 0 : 15, 0, 1, 7, 'K');
    if (!L) p.rect(10, 2, 4, 3, 'n');
  }
  return p;
}

function plank(part) {
  // Market-stall plank: you can jump up through it and stand on top.
  const p = new Pix(T, T).rect(0, 0, T, 6, 'D').rect(0, 1, T, 1, 'E').rect(0, 4, T, 1, 'd');
  p.rect(0, 0, T, 1, 'K').rect(0, 6, T, 1, 'K').rect(part === 'm' ? 5 : 8, 2, 3, 1, 'd');
  if (part === 'l') p.rect(0, 0, 1, 7, 'K').rect(2, 7, 3, 5, 'd').box(1, 7, 5, 6, 'K');
  if (part === 'r') p.rect(15, 0, 1, 7, 'K').rect(11, 7, 3, 5, 'd').box(10, 7, 5, 6, 'K');
  return p;
}

function waterTop(frame) {
  const p = new Pix(T, T).rect(0, 4, T, 12, 'b').rect(0, 1, T, 3, 'B');
  for (let i = 0; i < T; i++) {
    const x = (i + frame * 4) % T;
    if (i % 8 < 4) p.set(x, 0, 'c');
    if (i % 8 === 1) p.set(x, 1, 'W');
  }
  return speckle(p, 5, T, ['B'], 5, 9 + frame);
}

function waterFill() {
  return speckle(new Pix(T, T).rect(0, 0, T, T, 'b'), 0, T, ['B'], 6, 31);
}

function rail() {
  // Bridge parapet drawn behind the player on Third Mainland Bridge.
  const p = new Pix(T, T).rect(0, 5, T, 1, 'K').rect(0, 6, T, 2, 'N').rect(0, 6, T, 1, 'W').rect(0, 8, T, 1, 'K');
  for (const x of [2, 10]) p.rect(x, 9, 3, 7, 'N').rect(x, 9, 1, 7, 'W').rect(x + 3, 9, 1, 7, 'K');
  return p;
}

export function tileFrames() {
  return {
    street_top: streetTop(),
    street_fill: laterite(new Pix(T, T), 0, 11),
    market_top: marketTop(),
    market_fill: speckle(new Pix(T, T).rect(0, 0, T, T, 'D'), 0, T, ['d', 'e', 'd'], 16, 17),
    bridge_top: bridgeTop(),
    bridge_fill: bridgeFill(),
    block: block(),
    crate1: crate(false),
    crate2: crate(true),
    crate_used: crateUsed(),
    solid: solid(),
    pillar_tl: pillar('l', true),
    pillar_tr: pillar('r', true),
    pillar_l: pillar('l', false),
    pillar_r: pillar('r', false),
    plank_l: plank('l'),
    plank_m: plank('m'),
    plank_r: plank('r'),
    water_top1: waterTop(0),
    water_top2: waterTop(1),
    water_fill: waterFill(),
    rail: rail(),
  };
}
