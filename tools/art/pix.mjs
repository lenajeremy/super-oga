// A tiny pixel canvas for authoring sprites in code. Pixels hold '#rrggbb' strings
// (or null for transparent). Single-letter colour names resolve through PAL.
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const FONTS = require('../../src/pixelfont.js');

export const PAL = {
  K: '#1a1423', // outline / near-black
  k: '#3a3142', // dark grey
  n: '#6b6275', // grey
  N: '#a8a2b4', // light grey
  W: '#f8f4ea', // white
  w: '#d9d0bf', // cream shadow
  S: '#8c5431', // skin
  s: '#5f3522', // skin shadow
  t: '#b47548', // skin light
  G: '#1f9d57', // agbada green
  g: '#12683a', // dark green
  l: '#63d68f', // light green
  Y: '#ffcd3a', // gold
  y: '#c98f1c', // dark gold
  O: '#ff8d24', // orange
  R: '#e3412f', // red
  r: '#9d2a22', // dark red
  B: '#3b7fd9', // blue
  b: '#24518f', // dark blue
  c: '#86d7ff', // light blue
  D: '#7b4a26', // brown
  d: '#4e2d17', // dark brown
  e: '#c4703a', // laterite
  E: '#e39a5b', // light laterite
  P: '#8e44ad', // purple
  p: '#5a2a73', // dark purple
  A: '#ffe9a8', // pale yellow
  Z: '#26262c', // asphalt dark
  z: '#4a4a52', // asphalt
};

const resolve = (c, pal) => {
  if (!c) return null;
  if (c.length === 1) {
    const value = (pal && pal[c]) || PAL[c];
    if (!value) throw new Error(`Unknown colour "${c}"`);
    // A per-sprite palette may point at another palette letter (e.g. H: 'W').
    return value.length === 1 ? resolve(value) : value.toLowerCase();
  }
  return c.toLowerCase();
};

export class Pix {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.data = new Array(w * h).fill(null);
  }

  static fromMap(rows, pal) {
    const p = new Pix(rows[0].length, rows.length);
    return p.map(0, 0, rows, pal);
  }

  get(x, y) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.data[y * this.w + x] : null;
  }

  set(x, y, c, pal) {
    x = Math.round(x);
    y = Math.round(y);
    if (c && x >= 0 && y >= 0 && x < this.w && y < this.h) this.data[y * this.w + x] = resolve(c, pal);
    return this;
  }

  erase(x, y) {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.data[y * this.w + x] = null;
    return this;
  }

  rect(x, y, w, h, c) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
    return this;
  }

  box(x, y, w, h, c) {
    this.rect(x, y, w, 1, c).rect(x, y + h - 1, w, 1, c);
    return this.rect(x, y, 1, h, c).rect(x + w - 1, y, 1, h, c);
  }

  line(x0, y0, x1, y1, c) {
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) return this;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  ellipse(cx, cy, rx, ry, c) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const nx = (x - cx) / (rx + 0.5);
        const ny = (y - cy) / (ry + 0.5);
        if (nx * nx + ny * ny <= 1) this.set(x, y, c);
      }
    }
    return this;
  }

  disc(cx, cy, r, c) {
    return this.ellipse(cx, cy, r, r, c);
  }

  // Stamp an ASCII map. '.' and ' ' are transparent; other chars go through pal then PAL.
  map(x, y, rows, pal) {
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        if (ch !== '.' && ch !== ' ') this.set(x + i, y + j, ch, pal);
      }
    });
    return this;
  }

  blit(src, x, y) {
    for (let j = 0; j < src.h; j++) for (let i = 0; i < src.w; i++) this.set(x + i, y + j, src.get(i, j));
    return this;
  }

  textWidth(str, font = 'small') {
    const f = FONTS[font];
    let w = 0;
    for (const ch of str.toUpperCase()) w += (f.glyphs[ch] || f.glyphs['?'] || f.glyphs[' ']).width + f.spacing;
    return Math.max(0, w - f.spacing);
  }

  text(x, y, str, c, font = 'small') {
    const f = FONTS[font];
    let cx = x;
    for (const ch of str.toUpperCase()) {
      const g = f.glyphs[ch] || f.glyphs['?'] || f.glyphs[' '];
      g.rows.forEach((row, j) => {
        for (let i = 0; i < row.length; i++) if (row[i] === '#') this.set(cx + i, y + j, c);
      });
      cx += g.width + f.spacing;
    }
    return this;
  }

  // Grow a 1px border of colour c around every opaque pixel (4-neighbour, or 8 with diagonal).
  outline(c, diagonal = false) {
    const src = this.data.slice();
    const at = (x, y) => (x >= 0 && y >= 0 && x < this.w && y < this.h ? src[y * this.w + x] : null);
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    if (diagonal) dirs.push([1, 1], [1, -1], [-1, 1], [-1, -1]);
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (at(x, y)) continue;
        if (dirs.some(([dx, dy]) => at(x + dx, y + dy))) this.set(x, y, c);
      }
    }
    return this;
  }

  // Swap colours: { '#old': 'new' } using hex or palette letters on both sides.
  recolor(swaps) {
    const table = new Map(Object.entries(swaps).map(([a, b]) => [resolve(a), resolve(b)]));
    this.data = this.data.map((c) => (c && table.has(c) ? table.get(c) : c));
    return this;
  }

  clone() {
    const p = new Pix(this.w, this.h);
    p.data = this.data.slice();
    return p;
  }

  flipX() {
    const p = new Pix(this.w, this.h);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) p.data[y * this.w + x] = this.get(this.w - 1 - x, y);
    return p;
  }

  colors() {
    return new Set(this.data.filter(Boolean));
  }
}
