// Fashe, the one-chance conductor, at the size he deserves. Twice the height of an
// ordinary hawker, in a black jacket, with the stolen aso-ebi still slung on his back.
import { Pix } from './pix.mjs';

const SKIN = { S: '#6b3f23', s: '#4a2a17', t: '#875233' };

function body(p, lean) {
  // jacket
  p.rect(6 + lean, 16, 18, 20, 'k');
  p.rect(6 + lean, 16, 18, 2, 'z');
  p.rect(14 + lean, 18, 2, 16, 'z');
  // the stolen bundle on his back
  p.rect(1 + lean, 15, 7, 12, 'P');
  for (const y of [17, 21, 25]) p.rect(1 + lean, y, 7, 1, 'Y');
  p.rect(1 + lean, 15, 7, 1, 'p');
  // arms
  p.rect(2 + lean, 20, 5, 11, 'k');
  p.rect(23 + lean, 20, 5, 11, 'k');
  p.rect(3 + lean, 30, 4, 4, 'S', SKIN);
  p.rect(24 + lean, 30, 4, 4, 'S', SKIN);
  return p;
}

function head(p, x, y, angry) {
  p.rect(x + 2, y + 4, 13, 11, 'S', SKIN);
  p.rect(x + 2, y + 13, 13, 2, 's', SKIN);
  // backwards red cap
  p.rect(x, y, 17, 5, 'r');
  p.rect(x, y + 4, 17, 2, 'R');
  p.rect(x + 13, y + 5, 5, 3, 'r');
  // face
  p.rect(x + 4, y + 7, 3, 2, 'W').rect(x + 10, y + 7, 3, 2, 'W');
  p.set(x + 5, y + 8, 'K').set(x + 11, y + 8, 'K');
  if (angry) {
    p.rect(x + 3, y + 6, 4, 1, 'K').rect(x + 10, y + 6, 4, 1, 'K');
    p.rect(x + 5, y + 11, 8, 2, 'K').rect(x + 6, y + 11, 6, 1, 'r');
  } else {
    p.rect(x + 5, y + 11, 8, 1, 'K');
  }
  // scar
  p.set(x + 14, y + 7, 'r').set(x + 14, y + 8, 'r').set(x + 13, y + 9, 'r');
  return p;
}

function legs(p, pose, lean) {
  if (pose === 'jump') {
    p.rect(7 + lean, 34, 6, 6, 'b');
    p.rect(18 + lean, 34, 6, 6, 'b');
    p.rect(5 + lean, 39, 8, 4, 'K');
    p.rect(18 + lean, 39, 8, 4, 'K');
  } else if (pose === 'step') {
    p.rect(6 + lean, 34, 6, 8, 'b');
    p.rect(19 + lean, 34, 6, 8, 'b');
    p.rect(4 + lean, 41, 9, 3, 'K');
    p.rect(19 + lean, 41, 9, 3, 'K');
  } else {
    p.rect(8 + lean, 34, 6, 8, 'b');
    p.rect(17 + lean, 34, 6, 8, 'b');
    p.rect(6 + lean, 41, 9, 3, 'K');
    p.rect(17 + lean, 41, 9, 3, 'K');
  }
  return p;
}

function fashe(pose) {
  const p = new Pix(32, 44);
  const lean = pose === 'jump' ? 1 : 0;
  legs(p, pose, lean);
  body(p, lean);
  head(p, 8 + lean, pose === 'jump' ? 0 : 1, pose !== 'hurt');
  p.outline('K');
  if (pose === 'hurt') {
    // seeing stars
    for (const [x, y] of [[3, 2], [26, 3], [14, 0]]) p.set(x, y, 'Y').set(x + 1, y + 1, 'A');
  }
  return p;
}

function fallen() {
  const p = new Pix(32, 44);
  p.rect(2, 30, 26, 10, 'k');
  p.rect(2, 30, 26, 2, 'z');
  p.rect(20, 26, 10, 8, 'S', SKIN);
  p.rect(20, 24, 12, 4, 'r');
  p.rect(3, 27, 7, 10, 'P');
  for (const y of [29, 33]) p.rect(3, y, 7, 1, 'Y');
  p.rect(6, 40, 8, 3, 'K');
  p.rect(17, 40, 8, 3, 'K');
  p.outline('K');
  p.set(23, 29, 'K').set(27, 29, 'K');
  return p;
}

export function bossFrames() {
  return {
    fashe_big1: fashe('idle'),
    fashe_big2: fashe('step'),
    fashe_jump: fashe('jump'),
    fashe_hurt: fashe('hurt'),
    fashe_fallen: fallen(),
  };
}
