// Pick-ups, projectiles and particles.
import { Pix } from './pix.mjs';

function coin(frame) {
  const p = new Pix(14, 14);
  const rx = [4.5, 3, 1, 3][frame];
  p.ellipse(7, 7, rx, 5, 'y');
  if (rx > 1.5) p.ellipse(7, 7, rx - 1.2, 3.8, 'Y');
  if (frame === 0) p.text(5, 5, '₦', 'y');
  if (rx > 1.5) p.set(Math.round(8 - rx), 4, 'A');
  return p.outline('K');
}

function jollof() {
  const p = new Pix(16, 16);
  p.ellipse(8, 11.5, 6, 2.5, 'W');
  p.ellipse(8, 12.5, 5, 1.2, 'w');
  p.ellipse(8, 8.5, 4.5, 3.5, 'O');
  p.ellipse(9, 7, 2.5, 1.5, 'E');
  for (const [x, y, c] of [[6, 7, 'R'], [9, 9, 'R'], [11, 8, 'l'], [5, 10, 'l'], [8, 5, 'Y'], [10, 11, 'R'], [4, 9, 'R']]) p.set(x, y, c);
  p.outline('K');
  p.set(6, 1, 'w').set(7, 2, 'w').set(10, 1, 'w').set(9, 2, 'w');
  return p;
}

function waterBag() {
  const p = new Pix(16, 16);
  p.rect(3, 3, 10, 11, 'W');
  p.rect(2, 5, 12, 7, 'W');
  p.rect(3, 7, 10, 3, 'B');
  p.rect(4, 5, 8, 1, 'c');
  p.rect(5, 11, 6, 1, 'c');
  p.set(4, 4, 'c');
  p.outline('K');
  for (let x = 3; x < 13; x += 2) p.set(x, 3, 'w').set(x + 1, 13, 'w');
  p.set(6, 8, 'W').set(8, 8, 'W').set(10, 8, 'W');
  return p;
}

function beads() {
  const p = new Pix(16, 16);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    p.disc(8 + Math.cos(a) * 5, 7 + Math.sin(a) * 4.5, 1, 'R');
  }
  p.disc(8, 13, 1.5, 'Y');
  p.outline('K');
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    p.set(Math.round(8 + Math.cos(a) * 5) - 1, Math.round(7 + Math.sin(a) * 4.5) - 1, 'O');
  }
  p.set(7, 12, 'A');
  return p;
}

function puffPuff() {
  const p = new Pix(16, 16);
  for (const [x, y] of [[5, 10.5], [11, 10.5], [8, 5.5]]) {
    p.disc(x, y, 3, 'E');
    p.disc(x + 0.7, y + 0.8, 2, 'O');
    p.disc(x - 0.5, y - 0.6, 1.2, 'E');
  }
  p.outline('K');
  for (const [x, y] of [[7, 4], [4, 9], [10, 9], [9, 6], [5, 12], [12, 12]]) p.set(x, y, 'A');
  return p;
}

function sachet(frame) {
  const p = new Pix(8, 8);
  if (frame === 0) p.rect(1, 2, 6, 4, 'W').rect(1, 3, 6, 2, 'B');
  else p.rect(2, 1, 4, 6, 'W').rect(3, 1, 2, 6, 'B');
  return p.outline('K');
}

function splash(frame) {
  const p = new Pix(12, 10);
  const drops = frame === 0
    ? [[5, 3], [6, 2], [3, 5], [8, 5], [2, 7], [9, 7], [6, 6]]
    : [[5, 1], [1, 4], [10, 4], [0, 8], [11, 8], [4, 6], [7, 6]];
  for (const [x, y] of drops) p.set(x, y, 'c').set(x, y + 1, 'W');
  return p;
}

function debris() {
  const p = new Pix(8, 8);
  p.rect(2, 2, 4, 4, 'N').rect(1, 3, 1, 2, 'N').set(3, 2, 'W').set(4, 4, 'n').set(5, 5, 'n');
  return p.outline('K');
}

function sparkle(frame) {
  const p = new Pix(7, 7);
  if (frame === 0) p.rect(3, 0, 1, 7, 'Y').rect(0, 3, 7, 1, 'Y').set(3, 3, 'W');
  else p.set(1, 1, 'Y').set(5, 1, 'Y').set(1, 5, 'Y').set(5, 5, 'Y').rect(2, 2, 3, 3, 'A').set(3, 3, 'W');
  return p;
}

function note(frame) {
  const p = new Pix(8, 6);
  if (frame === 0) p.rect(0, 1, 8, 4, 'G').rect(1, 2, 6, 2, 'l').set(3, 2, 'g').set(4, 3, 'g');
  else p.rect(2, 0, 4, 6, 'G').rect(3, 1, 2, 4, 'l');
  return p;
}

function dust(frame) {
  const p = new Pix(8, 8);
  if (frame === 0) p.disc(4, 4, 2, 'W').set(3, 3, 'w');
  else p.disc(2.5, 4, 1.4, 'w').disc(5.5, 3.5, 1.2, 'w');
  return p;
}

function warn() {
  const p = new Pix(15, 14);
  for (let y = 1; y < 13; y++) {
    const half = Math.floor(y / 2);
    p.rect(7 - half, y, half * 2 + 1, 1, 'Y');
  }
  p.outline('K');
  p.rect(7, 4, 1, 5, 'K').set(7, 10, 'K');
  return p;
}

function asoPiece() {
  const p = new Pix(12, 10);
  p.rect(1, 2, 10, 7, 'P').rect(1, 2, 10, 1, 'p');
  for (const y of [4, 6]) p.rect(1, y, 10, 1, 'Y');
  for (const x of [3, 7]) p.rect(x, 2, 1, 7, 'y');
  p.rect(1, 8, 10, 1, 'p');
  return p.outline('K');
}

// The crack where a punch lands: a hard little starburst, then a ring as it fades.
function impact(frame) {
  const p = new Pix(14, 14);
  if (frame === 0) {
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
      for (let r = 2; r <= 6; r++) p.set(7 + dx * r, 7 + dy * r, r > 4 ? 'Y' : 'W');
    }
    p.disc(7, 7, 2, 'W');
    p.disc(7, 7, 1, 'A');
  } else {
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
      p.set(7 + dx * 5, 7 + dy * 5, 'Y');
      p.set(7 + dx * 6, 7 + dy * 6, 'y');
    }
    p.disc(7, 7, 1, 'Y');
  }
  return p;
}

function star() {
  return new Pix(5, 5).set(2, 0, 'Y').rect(0, 2, 5, 1, 'Y').rect(1, 1, 3, 3, 'Y').set(1, 4, 'Y').set(3, 4, 'Y').set(2, 2, 'W');
}

export function itemFrames() {
  return {
    coin1: coin(0),
    coin2: coin(1),
    coin3: coin(2),
    coin4: coin(3),
    jollof: jollof(),
    water: waterBag(),
    beads: beads(),
    puffpuff: puffPuff(),
    sachet1: sachet(0),
    sachet2: sachet(1),
    splash1: splash(0),
    splash2: splash(1),
    debris: debris(),
    sparkle1: sparkle(0),
    sparkle2: sparkle(1),
    note1: note(0),
    note2: note(1),
    dust1: dust(0),
    dust2: dust(1),
    warn: warn(),
    star: star(),
    aso: asoPiece(),
    impact1: impact(0),
    impact2: impact(1),
  };
}
