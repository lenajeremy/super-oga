// Street wahala: gutter rat, stray goat (ewure), mosquito, agbero (bus-park tout) and okada.
// All face right; the game mirrors them when they move left.
import { Pix } from './pix.mjs';

function rat(step) {
  const p = new Pix(16, 16);
  p.disc(10, 6, 1, 't');
  p.ellipse(6.5, 10.5, 4.5, 2.5, 'n');
  p.ellipse(11.5, 9.5, 2.5, 2, 'n');
  p.rect(13, 10, 2, 1, 'n');
  p.rect(4, 12, 6, 1, 'N');
  for (const x of step ? [3, 5, 8, 10] : [4, 6, 7, 9]) p.set(x, 14, 'k');
  p.outline('K');
  p.set(12, 9, 'K').set(15, 10, 't');
  const tail = step ? [[1, 11], [0, 10], [0, 9], [1, 8]] : [[1, 11], [0, 11], [0, 10], [1, 9]];
  for (const [x, y] of tail) p.set(x, y, 't');
  return p;
}

function ratFlat() {
  const p = new Pix(16, 16);
  p.ellipse(8, 13, 6, 1, 'n');
  p.rect(5, 14, 6, 1, 'N');
  p.outline('K');
  p.set(11, 12, 'K').set(13, 12, 'K').set(1, 13, 't').set(0, 12, 't');
  return p;
}

function goat(frame) {
  const p = new Pix(22, 18);
  const charge = frame === 2;
  const hy = charge ? 8 : 4;
  const legs = [[4, 7, 11, 14], [5, 6, 12, 13], [3, 6, 11, 15]][frame];
  for (const x of legs) p.rect(x, 12, 1, 4, 'W');
  p.ellipse(9, 8.5, 6.5, 3.5, 'W');
  p.ellipse(6, 7, 2.5, 2, 'D');
  p.rect(14, hy + 2, 3, 5, 'W');
  p.ellipse(17.5, hy + 2, 2.5, 2, 'W');
  p.rect(19, hy + 3, 2, 2, 'W');
  p.outline('K');
  for (const x of legs) p.set(x, 16, 'k');
  p.set(18, hy + 1, 'K').set(20, hy + 4, 'k').set(15, hy + 2, 'w').set(14, hy + 3, 'w');
  p.line(16, hy, 14, hy - 2, 'k').line(17, hy, 16, hy - 3, 'k');
  p.set(19, hy + 5, 'w').set(19, hy + 6, 'w');
  p.set(2, 6, 'W').set(1, 5, 'W');
  return p;
}

function mosquito(frame) {
  const p = new Pix(16, 12);
  const up = frame === 0;
  p.ellipse(6, up ? 2.5 : 5, 3, up ? 2 : 1, 'c');
  p.ellipse(8.5, up ? 2 : 4.5, 2, up ? 1.5 : 1, 'W');
  p.outline('K');
  p.ellipse(6, 6.5, 3.5, 1, 'k');
  for (const x of [3, 5, 7]) p.set(x, 6, 'N');
  p.disc(11, 6, 1.4, 'k');
  p.set(12, 5, 'R');
  p.line(12, 7, 15, 9, 'k');
  p.line(5, 8, 3, 11, 'k').line(7, 8, 7, 11, 'k').line(9, 8, 11, 11, 'k');
  return p;
}

const AGBERO_HEAD = [
  '................',
  '.....KKKKKK.....',
  '....KRRRRRRK....',
  '...KRRRRWRRRK...',
  '.KKKrrrrrrrrK...',
  '.KkkKSSSSSSSK...',
  '....KSSSSSSSSK..',
  '....KSSSSKKKSK..',
  '....KsSSSSKSSSK.',
  '....KsSSSSSSSK..',
  '.....KsSSKRRK...',
  '......KKSSKK....',
];
const AGBERO_SCARED = [
  ...AGBERO_HEAD.slice(0, 7),
  '....KSSSSWWSSK..',
  '....KsSSSWKSSSK.',
  '....KsSSSSSSSK..',
  '.....KsSSKKKK...',
  '......KKSSKK....',
];
const AGBERO_BODY = [
  '.....KKWWWKK....',
  '....KSKWWWWKK...',
  '...KSSKWWWWKSK..',
  '...KSKWWWWWKSSK.',
  '...KSKWwWWWKKSK.',
  '...KSKWWWwWK.KK.',
  '...KKKbbbbbbK...',
  '.....KBBBBBBK...',
];
const AGBERO_BODY_FLEE = [
  '.KK..KKWWWKK.KK.',
  '.KSKKSKWWWWKKSK.',
  '..KSSKWWWWWKSK..',
  '...KKWWWWWWKK...',
  '....KWwWWWWK....',
  '....KWWWwWWK....',
  '....KbbbbbbK....',
  '....KBBBBBBK....',
];
const AGBERO_LEGS = {
  a: ['.....KBBKKBBK...', '.....KBbK.KBbK..', '....KkkkK.KkkkK.', '....KKKKK.KKKKK.'],
  b: ['....KBBK..KBBK..', '...KBbK....KBbK.', '..KkkkK....KkkkK', '..KKKKK....KKKKK'],
};

function agbero(head, body, legs) {
  const p = new Pix(16, 24);
  return p.map(0, 0, head).map(0, 12, body).map(0, 20, legs);
}

function okada(frame) {
  const p = new Pix(32, 24);
  const bob = frame;
  p.rect(12, 5 + bob, 6, 7, 'O');
  p.rect(12, 8 + bob, 6, 1, 'Y');
  p.ellipse(15.5, 3.5 + bob, 2.5, 2.5, 'k');
  p.rect(17, 3 + bob, 3, 3, 'S');
  p.line(17, 7 + bob, 22, 9, 'S').line(17, 8 + bob, 22, 10, 'S');
  p.rect(12, 11 + bob, 8, 3, 'b');
  p.rect(18, 12 + bob, 3, 4, 'b');
  p.rect(18, 16, 4, 1, 'k');
  p.rect(6, 14, 18, 3, 'R');
  p.rect(9, 13, 9, 2, 'k');
  p.rect(20, 11, 5, 4, 'R');
  p.line(24, 10, 26, 18, 'N').line(25, 10, 27, 18, 'N');
  p.rect(21, 9, 4, 1, 'k');
  p.rect(26, 12, 2, 2, 'Y');
  p.rect(2, 16, 7, 2, 'N');
  for (const cx of [7, 25]) {
    p.disc(cx, 19, 4, 'k');
    p.disc(cx, 19, 2, 'n');
    p.set(cx, 19, 'N');
    if (frame === 0) p.set(cx - 1, 18, 'N').set(cx + 1, 20, 'N');
    else p.set(cx + 1, 18, 'N').set(cx - 1, 20, 'N');
  }
  p.outline('K');
  return p;
}

export function enemyFrames() {
  return {
    rat_walk1: rat(0),
    rat_walk2: rat(1),
    rat_flat: ratFlat(),
    goat_walk1: goat(0),
    goat_walk2: goat(1),
    goat_charge: goat(2),
    mosquito_fly1: mosquito(0),
    mosquito_fly2: mosquito(1),
    agbero_walk1: agbero(AGBERO_HEAD, AGBERO_BODY, AGBERO_LEGS.a),
    agbero_walk2: agbero(AGBERO_HEAD, AGBERO_BODY, AGBERO_LEGS.b),
    agbero_flee: agbero(AGBERO_SCARED, AGBERO_BODY_FLEE, AGBERO_LEGS.b),
    okada_ride1: okada(0),
    okada_ride2: okada(1),
  };
}
