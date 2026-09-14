/* SUPER OGA - core: constants, helpers, asset loading and pixel text. */
'use strict';

const TILE = 16;
const VIEW_W = 400;
const VIEW_H = 224;

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (lo, hi) => lo + Math.random() * (hi - lo);
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

const Store = {
  get(key, fallback) {
    try {
      const value = localStorage.getItem(`super-oga:${key}`);
      return value === null ? fallback : JSON.parse(value);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(`super-oga:${key}`, JSON.stringify(value));
    } catch {
      // Storage can be blocked (private mode, sandboxed previews); the game works without it.
    }
  },
};

// Asset URLs carry a ?v= content stamp so the CDN can cache them forever; the inlined
// file:// bundle is keyed on the plain path, so strip the stamp when looking there.
const assetKey = (src) => src.split('?')[0];

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${src}`));
    img.src = (window.ASSET_DATA && window.ASSET_DATA[assetKey(src)]) || src;
  });
}

// Sprite sheets are JPGs with every art pixel drawn as a scale x scale block and
// magenta where the sprite is see-through (see tools/build-sprites.mjs). Sample the
// centre of each block to rebuild the crisp 1x sprite with real transparency.
function keyOutMagenta(img, scale, radius) {
  const src = document.createElement('canvas');
  src.width = img.width;
  src.height = img.height;
  const sctx = src.getContext('2d', { willReadFrequently: true });
  sctx.drawImage(img, 0, 0);
  const data = sctx.getImageData(0, 0, img.width, img.height).data;
  const w = Math.round(img.width / scale);
  const h = Math.round(img.height / scale);
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const octx = out.getContext('2d');
  const pixels = octx.createImageData(w, h);
  const half = scale >> 1;
  const r2 = radius * radius;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = ((y * scale + half) * img.width + x * scale + half) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if ((255 - r) * (255 - r) + g * g + (255 - b) * (255 - b) < r2) continue;
      const o = (y * w + x) * 4;
      pixels.data[o] = r;
      pixels.data[o + 1] = g;
      pixels.data[o + 2] = b;
      pixels.data[o + 3] = 255;
    }
  }
  octx.putImageData(pixels, 0, 0);
  return out;
}

const Assets = {
  sheets: {},
  photos: {},
  voices: {},
  font: null,
  fontTints: new Map(),

  async load(onProgress) {
    const atlas = window.SPRITE_ATLAS;
    const jobs = [
      ...Object.entries(atlas.sheets).map(([name, sheet]) =>
        loadImage(sheet.src).then((img) => {
          this.sheets[name] = { canvas: keyOutMagenta(img, atlas.scale, atlas.keyRadius), frames: sheet.frames };
        }),
      ),
      ...window.PHOTO_CREDITS.map(({ name, src }) =>
        loadImage(src || `assets/photos/${name}.jpg`).then((img) => {
          this.photos[name] = img;
        }),
      ),
    ];
    // Spoken lines are optional: the game falls back to the synthesised hawker cry, so a
    // missing or slow clip must never hold up the loading screen.
    for (const [id, clip] of Object.entries(window.VOICE_CLIPS || {})) {
      jobs.push(
        new Promise((resolve) => {
          const el = new Audio();
          el.preload = 'auto';
          const settle = (ok) => {
            if (ok) this.voices[id] = el;
            resolve();
          };
          el.addEventListener('canplaythrough', () => settle(true), { once: true });
          el.addEventListener('error', () => settle(false), { once: true });
          setTimeout(() => settle(el.readyState >= 2), 4000);
          el.src = (window.ASSET_DATA && window.ASSET_DATA[assetKey(clip.src)]) || clip.src;
        }),
      );
    }
    let done = 0;
    await Promise.all(jobs.map((job) => job.then(() => onProgress && onProgress(++done / jobs.length))));
  },

  frame(sheet, name) {
    const f = this.sheets[sheet] && this.sheets[sheet].frames[name];
    if (!f) throw new Error(`Missing sprite ${sheet}/${name}`);
    return f;
  },

  size(sheet, name) {
    const f = this.frame(sheet, name);
    return { w: f[2], h: f[3] };
  },

  // Draw a frame with its top-left corner at (x, y).
  draw(ctx, sheet, name, x, y, flipX = false, flipY = false) {
    const canvas = this.sheets[sheet].canvas;
    const [fx, fy, fw, fh] = this.frame(sheet, name);
    x = Math.round(x);
    y = Math.round(y);
    if (!flipX && !flipY) {
      ctx.drawImage(canvas, fx, fy, fw, fh, x, y, fw, fh);
      return;
    }
    ctx.save();
    ctx.translate(x + (flipX ? fw : 0), y + (flipY ? fh : 0));
    ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
    ctx.drawImage(canvas, fx, fy, fw, fh, 0, 0, fw, fh);
    ctx.restore();
  },

  // Draw a frame scaled up, for the smooth full-resolution backdrop layer.
  drawScaled(ctx, sheet, name, x, y, scale) {
    const [fx, fy, fw, fh] = this.frame(sheet, name);
    ctx.drawImage(this.sheets[sheet].canvas, fx, fy, fw, fh, Math.round(x), Math.round(y), Math.round(fw * scale), Math.round(fh * scale));
  },

  buildFont() {
    const font = window.PIXEL_FONTS.big;
    const map = {};
    let x = 0;
    for (const [ch, g] of Object.entries(font.glyphs)) {
      map[ch] = { x, w: g.width };
      x += g.width + 1;
    }
    const canvas = document.createElement('canvas');
    canvas.width = x;
    canvas.height = font.height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    for (const [ch, g] of Object.entries(font.glyphs)) {
      g.rows.forEach((row, j) => {
        for (let i = 0; i < row.length; i++) if (row[i] === '#') ctx.fillRect(map[ch].x + i, j, 1, 1);
      });
    }
    this.font = { canvas, map, height: font.height, spacing: font.spacing };
  },

  fontIn(color) {
    let tinted = this.fontTints.get(color);
    if (!tinted) {
      tinted = document.createElement('canvas');
      tinted.width = this.font.canvas.width;
      tinted.height = this.font.canvas.height;
      const ctx = tinted.getContext('2d');
      ctx.drawImage(this.font.canvas, 0, 0);
      ctx.globalCompositeOperation = 'source-in';
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, tinted.width, tinted.height);
      this.fontTints.set(color, tinted);
    }
    return tinted;
  },

  textWidth(text, scale = 1) {
    const { map, spacing } = this.font;
    let w = 0;
    for (const ch of String(text).toUpperCase()) w += (map[ch] || map['?']).w + spacing;
    return Math.max(0, w - spacing) * scale;
  },
};

const INK = '#1a1423';

// Pixel-font text. align: 'left' | 'center' | 'right'. shadow/outline use a dark ink.
function drawText(ctx, text, x, y, { color = '#f8f4ea', scale = 1, align = 'left', shadow = INK, outline = false } = {}) {
  text = String(text).toUpperCase();
  const width = Assets.textWidth(text, scale);
  if (align === 'center') x -= width / 2;
  else if (align === 'right') x -= width;
  x = Math.round(x);
  y = Math.round(y);
  const { map, height, spacing } = Assets.font;
  const paint = (img, ox, oy) => {
    let cx = x + ox;
    for (const ch of text) {
      const g = map[ch] || map['?'];
      ctx.drawImage(img, g.x, 0, g.w, height, cx, y + oy, g.w * scale, height * scale);
      cx += (g.w + spacing) * scale;
    }
  };
  if (outline) {
    const ink = Assets.fontIn(shadow || INK);
    for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) paint(ink, ox, oy);
  } else if (shadow) {
    paint(Assets.fontIn(shadow), Math.max(1, scale >> 1), Math.max(1, scale >> 1));
  }
  paint(Assets.fontIn(color), 0, 0);
  return width;
}

function wrapText(text, maxWidth, scale = 1) {
  const lines = [];
  let line = '';
  for (const word of String(text).split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (line && Assets.textWidth(next, scale) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}
