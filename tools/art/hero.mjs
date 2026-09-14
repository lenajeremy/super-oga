// Oga Tunde, the hero: green agbada with gold embroidery, fila cap, sokoto trousers
// and sandals. Frames are assembled from head / body / legs parts, facing right.
import { Pix } from './pix.mjs';

function compose(w, h, parts) {
  const p = new Pix(w, h);
  for (const { rows, y = 0 } of parts) {
    rows.forEach((row, i) => {
      if (row.length !== w) throw new Error(`hero part row ${i} is ${row.length} wide, expected ${w}: "${row}"`);
    });
    p.map(0, y, rows);
  }
  return p;
}

// ---------- small form: 16x24 ----------
const S_HEAD = [
  '................',
  '.....KKKKKK.....',
  '...KKGGGGlGK....',
  '..KgGGGGGGGGK...',
  '.KgKGGGGGGGGGK..',
  '.KK.KYYYyYYYYK..',
  '....KsSSSSSSSK..',
  '....KtSSSSKSSK..',
  '....KsSSSSKSSSK.',
  '....KsSSSSSSSK..',
  '.....KsSSSKKSK..',
  '......KddddKK...',
];
const S_BODY = [
  '....KKGYYYGKK...',
  '...KGGGYWYGGGK..',
  '..KGGGGGYGGGGGK.',
  '..KGgGGGYGGGGgGK',
  '.KGGgGGGGGGGGgSK',
  '.KSgGGGGGGGGGgKK',
  '..KgGGGGGGGGGgK.',
  '..KgggggggggggK.',
];
// Punching: the agbada sleeve pulls back and the fist drives out past it.
const S_BODY_PUNCH = [
  '....KKGYYYGKK...',
  '...KGGGYWYGGGK..',
  '..KGGGGGYGGGGGK.',
  '.KKgGGGGYGGGGgKK',
  'KSSgGGGGGGGGgSSK',
  'KKKgGGGGGGGGgKKK',
  '..KgGGGGGGGGgK..',
  '..KggggggggggK..',
];
const S_BODY_JUMP = [
  '....KKGYYYGKK...',
  'KK.KGGGYWYGGGK.K',
  'KGKGGGGGYGGGGKGK',
  'KGGGgGGGYGGGgGGK',
  '.KGGgGGGGGGGgGK.',
  '..KKgGGGGGGGgKK.',
  '...KgGGGGGGGgK..',
  '...KgggggggggK..',
];
const S_LEGS = {
  stand: ['....KWWKKWWK....', '....KWwKKWwK....', '...KDDDKKDDDK...', '...KKKKKKKKKK...'],
  step: ['...KWWK..KWWK...', '..KWwK....KWwK..', '.KDDDK....KDDDK.', '.KKKKK....KKKKK.'],
  pass: ['....KWWKWWK.....', '.....KWwWK......', '.....KDDDDK.....', '.....KKKKKK.....'],
  jump: ['...KWWKKWWWK....', '..KWwK..KWwK....', '..KDDK...KDDDK..', '..KKK.....KKKK..'],
  skid: ['.....KWWK.KWWK..', '....KWwK...KWwK.', '...KDDDK...KDDDK', '...KKKKK...KKKKK'],
  brace: ['...KWWK..KWWK...', '..KWwK....KWwK..', '.KDDDK....KDDDDK', '.KKKKK....KKKKKK'],
};
const S_DEAD = [
  '................',
  '.....KKKKKK.....',
  '....KGGGGlGK....',
  '...KGGGGGGGGK...',
  '...KYYYyYYYYK...',
  '.KKKSSSSSSSSKKK.',
  'KSKsSKSSSSKSsKSK',
  'KSKsSKSSSSKSsKSK',
  'KGKsSSSSSSSSsKGK',
  'KGGKsSSKKSSsKGGK',
  '.KGKKsSKKSsKKGK.',
  '.KGGGKKddKKGGGK.',
  '..KGGGYYYYGGGK..',
  '..KGGGGYWYGGGK..',
  '..KGGGGGYGGGGK..',
  '..KGgGGGYGGgGK..',
  '..KGgGGGGGGgGK..',
  '..KGgGGGGGGgGK..',
  '..KgGGGGGGGGgK..',
  '..KggggggggggK..',
  '....KWWKKWWK....',
  '....KWwKKWwK....',
  '...KDDDKKDDDK...',
  '...KKKKKKKKKK...',
];

// ---------- big form: 24x32 ----------
const B_HEAD = [
  '..........KKKKKK........',
  '........KKGGGGlGKK......',
  '......KKGGGGGGGGllK.....',
  '....KKgGGGGGGGGGGGGK....',
  '...KgggGGGGGGGGGGGGK....',
  '..KggKKGGGGGGGGGGGGGK...',
  '..KgK.KYYyYYYyYYYyYYK...',
  '...K..KyYYYyYYYyYYYyK...',
  '......KsSSSSSSSSSSSSK...',
  '......KsSSSSSSSKKSSSK...',
  '.....KtsSSSSSSSSSSSSK...',
  '.....KtsSSSSSSSSWKSSSK..',
  '.....KssSSSSSSSSSKSSSSK.',
  '......KsSSSSSSSSSSSSSK..',
  '......KsSSSSSSSSKKKKSK..',
  '.......KsSSSSSSSSSSSK...',
  '........KKKddddddKKK....',
];
const B_BODY = [
  '.......KKGYYYYYGKK......',
  '.....KKGGGYWWWYGGGKK....',
  '...KKGGGGGGYWYGGGGGGKK..',
  '..KGGGGGGGYYGYYGGGGGGGK.',
  '.KGGgGGGGGGYYYGGGGGGgGGK',
  '.KGGgGGGGGGGYGGGGGGGgGGK',
  '.KGGgGGGGGGGGGGGGGGGgGSK',
  '.KSSgGGGGGGGGGGGGGGGgKK.',
  '.KKKgGGGGGGGGGGGGGGGgK..',
  '...KgGGGGGGGGGGGGGGGgK..',
  '...KggggggggggggggggggK.',
];
const B_BODY_JUMP = [
  '.......KKGYYYYYGKK......',
  'KK...KKGGGYWWWYGGGKK..KK',
  'KGKKKGGGGGGYWYGGGGGGKKGK',
  'KGGGGGGGGGYYGYYGGGGGGGGK',
  '.KGGgGGGGGGYYYGGGGGGgGK.',
  '..KGgGGGGGGGYGGGGGGGgK..',
  '..KKgGGGGGGGGGGGGGGGgK..',
  '...KgGGGGGGGGGGGGGGgK...',
  '...KgGGGGGGGGGGGGGGgK...',
  '...KgGGGGGGGGGGGGGGgK...',
  '...KgggggggggggggggggK..',
];
const B_BODY_THROW = [
  '.......KKGYYYYYGKK......',
  '.....KKGGGYWWWYGGGKK....',
  '...KKGGGGGGYWYGGGGGGKKK.',
  '..KGGGGGGGYYGYYGGGGGGGGK',
  '.KGGgGGGGGGYYYGGGGGGGGSK',
  '.KGGgGGGGGGGYGGGGGGGKKK.',
  '.KGGgGGGGGGGGGGGGGGgK...',
  '.KSSgGGGGGGGGGGGGGGgK...',
  '.KKKgGGGGGGGGGGGGGGgK...',
  '...KgGGGGGGGGGGGGGGgK...',
  '...KggggggggggggggggK...',
];
const B_BODY_PUNCH = [
  '.......KKGYYYYYGKK......',
  '.....KKGGGYWWWYGGGKK....',
  '...KKGGGGGGYWYGGGGGGKK..',
  '..KGGGGGGGYYGYYGGGGGGGK.',
  '.KGgGGGGGGGYYYGGGGGGGgK.',
  'KSSgGGGGGGGGYGGGGGGGgSSK',
  'KKKgGGGGGGGGGGGGGGGGgKKK',
  '..KgGGGGGGGGGGGGGGGGgK..',
  '..KgGGGGGGGGGGGGGGGGgK..',
  '...KgGGGGGGGGGGGGGGgK...',
  '...KggggggggggggggggK...',
];
const B_CROUCH_BODY = [
  '..KKGGGGGGYYYGGGGGGGKK..',
  '.KGGgGGGGGGYGGGGGGGgGGK.',
  '.KSSgGGGGGGGGGGGGGGgSSK.',
  '.KKgGGGGGGGGGGGGGGGGgKK.',
  '..KDDDDKgggggggggKDDDDK.',
  '..KKKKKKKKKKKKKKKKKKKKK.',
];
const B_LEGS = {
  stand: ['.......KWWWKKWWWK.......', '.......KWwWKKWwWK.......', '......KDDDDKKDDDDK......', '......KKKKKKKKKKKK......'],
  step: ['......KWWWK..KWWWK......', '.....KWwWK....KWwWK.....', '....KDDDDK....KDDDDK....', '....KKKKKK....KKKKKK....'],
  pass: ['.........KWWWWK.........', '.........KWwWWK.........', '.........KDDDDDK........', '.........KKKKKKK........'],
  jump: ['......KWWWKKWWWWK.......', '.....KWwWK..KWwWK.......', '.....KDDDK...KDDDDK.....', '.....KKKK.....KKKKK.....'],
  skid: ['........KWWWK.KWWWK.....', '.......KWwWK...KWwWK....', '......KDDDDK...KDDDDK...', '......KKKKKK...KKKKKK...'],
  brace: ['......KWWWK..KWWWK......', '.....KWwWK....KWwWK.....', '....KDDDDK....KDDDDDK...', '....KKKKKK....KKKKKKK...'],
};

// Seated on a ride: arms forward on the handlebar, knees up.
const S_SIT_BODY = [
  '....KKGYYYGKK...',
  '...KGGGYWYGGGK..',
  '..KGGGGGYGGGGGKK',
  '..KGgGGGYGGGGSSK',
  '..KGgGGGGGGGGKK.',
  '..KgggggggggK...',
  '...KWWWWWWWWK...',
  '...KKKKKKKDDK...',
];
const B_SIT_BODY = [
  '.......KKGYYYYYGKK......',
  '.....KKGGGYWWWYGGGKK....',
  '...KKGGGGGGYWYGGGGGGKKK.',
  '..KGGGGGGGYYGYYGGGGGGSSK',
  '..KGgGGGGGGYYYGGGGGGKKK.',
  '..KGgGGGGGGGYGGGGGgK....',
  '..KggggggggggggggggK....',
  '...KWWWWWWWWWWWWWWWK....',
  '...KKKKKKKKKKKKKKDDK....',
];

const VARIANTS = {
  // Pure-water power: white agbada with sachet-blue embroidery.
  water: { G: 'W', g: 'w', l: 'c', Y: 'B', y: 'b' },
  // Odogwu mode flashes between the normal colours and this gold agbada with coral trim.
  gold: { G: 'Y', g: 'y', l: 'A', Y: 'R', y: 'r' },
};

export function heroFrames() {
  const small = {
    idle: compose(16, 24, [{ rows: S_HEAD }, { rows: S_BODY, y: 12 }, { rows: S_LEGS.stand, y: 20 }]),
    walk1: compose(16, 24, [{ rows: S_HEAD }, { rows: S_BODY, y: 12 }, { rows: S_LEGS.step, y: 20 }]),
    walk2: compose(16, 24, [
      { rows: S_LEGS.pass.slice(0, 1), y: 19 },
      { rows: S_HEAD, y: -1 },
      { rows: S_BODY, y: 11 },
      { rows: S_LEGS.pass, y: 20 },
    ]),
    jump: compose(16, 24, [{ rows: S_HEAD }, { rows: S_BODY_JUMP, y: 12 }, { rows: S_LEGS.jump, y: 20 }]),
    skid: compose(16, 24, [{ rows: S_HEAD }, { rows: S_BODY, y: 12 }, { rows: S_LEGS.skid, y: 20 }]),
    dead: compose(16, 24, [{ rows: S_DEAD }]),
    punch: compose(16, 24, [{ rows: S_HEAD }, { rows: S_BODY_PUNCH, y: 12 }, { rows: S_LEGS.brace, y: 20 }]),
    sit: compose(16, 20, [{ rows: S_HEAD }, { rows: S_SIT_BODY, y: 12 }]),
  };
  const big = {
    idle: compose(24, 32, [{ rows: B_HEAD }, { rows: B_BODY, y: 17 }, { rows: B_LEGS.stand, y: 28 }]),
    walk1: compose(24, 32, [{ rows: B_HEAD }, { rows: B_BODY, y: 17 }, { rows: B_LEGS.step, y: 28 }]),
    walk2: compose(24, 32, [
      { rows: B_LEGS.pass.slice(0, 1), y: 27 },
      { rows: B_HEAD, y: -1 },
      { rows: B_BODY, y: 16 },
      { rows: B_LEGS.pass, y: 28 },
    ]),
    jump: compose(24, 32, [{ rows: B_HEAD }, { rows: B_BODY_JUMP, y: 17 }, { rows: B_LEGS.jump, y: 28 }]),
    skid: compose(24, 32, [{ rows: B_HEAD }, { rows: B_BODY, y: 17 }, { rows: B_LEGS.skid, y: 28 }]),
    crouch: compose(24, 32, [{ rows: B_HEAD, y: 9 }, { rows: B_CROUCH_BODY, y: 26 }]),
    throw: compose(24, 32, [{ rows: B_HEAD }, { rows: B_BODY_THROW, y: 17 }, { rows: B_LEGS.step, y: 28 }]),
    sit: compose(24, 26, [{ rows: B_HEAD }, { rows: B_SIT_BODY, y: 17 }]),
    punch: compose(24, 32, [{ rows: B_HEAD }, { rows: B_BODY_PUNCH, y: 17 }, { rows: B_LEGS.brace, y: 28 }]),
  };

  const frames = {};
  for (const [name, pix] of Object.entries(small)) {
    frames[`s_${name}`] = pix;
    frames[`s_${name}_gold`] = pix.clone().recolor(VARIANTS.gold);
  }
  for (const [name, pix] of Object.entries(big)) {
    frames[`b_${name}`] = pix;
    frames[`b_${name}_water`] = pix.clone().recolor(VARIANTS.water);
    frames[`b_${name}_gold`] = pix.clone().recolor(VARIANTS.gold);
  }
  // HUD icon: the small head.
  frames.icon_head = compose(16, 12, [{ rows: S_HEAD }]);
  return frames;
}
