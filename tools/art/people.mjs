// The people Oga Tunde meets: sellers, a nurse, ride owners, the bus conductor and family.
// Everyone is built from shared head and body templates. Placeholder letters get recoloured
// per person: H/h/J headwear, C/c/J/j clothes, T/t trousers, S/s skin. 16x24, facing right.
import { Pix } from './pix.mjs';

const FACE = [
  '....KSSSSSSSK...',
  '....KSSSSSSSSK..',
  '....KSSSSSKSSK..',
  '....KsSSSSSSSSK.',
  '....KsSSSSSSSK..',
  '.....KsSSKKSK...',
  '......KKSSKK....',
];

const HATS = {
  kufi: ['................', '................', '.....KKKKKKK....', '....KHHHHHHHK...', '....KHJHJHJHK...'],
  gele: ['..KKK....KKKK...', '.KHHHKKKKHHHHK..', 'KHhHHHHHHHHJHHK.', 'KHHJHHHHHHHHHhK.', '.KKHHHhHHHHHHK..'],
  nurse: ['................', '................', '................', '.....KKKKKKK....', '....KHHHJHHHK...'],
  cap: ['................', '................', '.....KKKKKK.....', '....KHHHHHHK....', '....KHHHHHHHKKK.'],
  hair: ['................', '................', '................', '.....KKKKKKK....', '....KkkkkkkkK...'],
};

const BODIES = {
  kaftan: [
    '.....KKCCCKK....', '....KCCCCCCCK...', '...KCCCCJCCCCK..', '...KCcCCJCCcCK..',
    '...KSCCCCCCCSK..', '...KKCCCCCCCKK..', '....KCCCCCCCK...', '....KCcCCCcCK...',
    '....KCCCCCCCK...', '....KcCCCCCcK...', '....KKDKKKDKK...', '....KKKK.KKKK...',
  ],
  dress: [
    '.....KKCCCKK....', '....KCCCCCCCK...', '...KCCCCCCCCCK..', '...KSCCCCCCCSK..',
    '...KKJJJJJJJKK..', '....KJjJJJjJK...', '....KJJJjJJJK...', '...KJJjJJJjJJK..',
    '...KJJJJJjJJJK..', '...KjJJJJJJJjK..', '....KKDKKKDKK...', '....KKKK.KKKK...',
  ],
  shirt: [
    '.....KKCCCKK....', '....KCCCCCCCK...', '...KCCCJCCCCCK..', '...KSCCCJCCCSK..',
    '...KSKCCCCCKSK..', '....KKTTTTTKK...', '.....KTTTTTK....', '.....KTtKTtK....',
    '.....KTTKTTK....', '.....KTtKTtK....', '....KKkKKKkK....', '....KKKK.KKKK...',
  ],
};

const DARK = { S: '#6b3f23', s: '#4a2a17' };
const LIGHT = { S: '#a86b40', s: '#7a4a2a' };

export const PEOPLE = {
  suya: { hat: 'kufi', body: 'kaftan', pal: { H: 'W', h: 'w', J: 'G', C: 'W', c: 'w', ...DARK } },
  mamaput: { hat: 'gele', body: 'dress', apron: true, pal: { H: 'R', h: 'r', J: 'Y', C: 'O', c: 'E', j: 'r' } },
  nurse: { hat: 'nurse', body: 'dress', pal: { H: 'W', J: 'G', C: 'W', c: 'w', j: 'w', ...LIGHT } },
  water: { hat: 'gele', body: 'dress', pal: { H: 'B', h: 'b', J: 'c', C: 'c', c: 'B', j: 'b', ...DARK } },
  okadaman: { hat: 'cap', body: 'shirt', pal: { H: 'k', h: 'k', C: 'O', J: 'Y', T: 'b', t: 'k' } },
  kekeman: { hat: 'kufi', body: 'kaftan', pal: { H: 'P', h: 'p', J: 'Y', C: 'l', c: 'G', ...LIGHT } },
  conductor: { hat: 'hair', body: 'shirt', pal: { C: 'b', J: 'W', T: 'D', t: 'd', ...DARK } },
  mum: { hat: 'gele', body: 'dress', pal: { H: 'P', h: 'p', J: 'Y', C: 'P', c: 'p', j: 'y' } },
  tailor: { hat: 'hair', body: 'shirt', pal: { C: 'W', J: 'Y', T: 'k', t: 'z', ...LIGHT } },
  bride: { hat: 'gele', body: 'dress', pal: { H: 'W', h: 'w', J: 'Y', C: 'W', c: 'w', j: 'y' } },
};

function person({ hat, body, pal, apron }, bob, talking) {
  const p = new Pix(16, 24);
  p.map(0, 12, BODIES[body], pal);
  if (apron) p.rect(6, 15, 4, 6, 'W').rect(6, 15, 4, 1, 'w');
  p.map(0, bob + 5, FACE, pal).map(0, bob, HATS[hat], pal);
  if (talking) p.set(9, 10 + bob, 'K').set(10, 10 + bob, 'r').set(9, 11 + bob, 'K');
  return p;
}

export function peopleFrames() {
  const frames = {};
  for (const [id, look] of Object.entries(PEOPLE)) {
    frames[`${id}_1`] = person(look, 0, false);
    frames[`${id}_2`] = person(look, 1, false);
    frames[`${id}_talk`] = person(look, 0, true);
  }
  return frames;
}
