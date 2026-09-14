/* SUPER OGA - the three stages.
 *
 * Maps are 14 rows tall and built from chunks. Each chunk starts as air with two rows of
 * ground (rows 12-13); `gaps` cut holes in the ground (open gutters, or lagoon water when
 * `water` is set) and `put` writes tiles at [row, column, text] (spaces are skipped).
 *
 * Legend
 *   #  ground            B  cement block        X  solid block      P  flyover pillar (2 wide)
 *   =  plank (one-way)   ~  lagoon water        o  naira coin
 *   ?  crate: coin       M  crate: many coins   U  crate: jollof / pure water
 *   S  crate: coral beads (Odogwu mode)          L  crate: puff-puff (extra life)
 *   h  hidden puff-puff crate
 *   r  gutter rat        g  goat (ewure)        m  mosquito         a  agbero
 *   k  okada trigger     N  NEPA takes the light  _  canoe platform   |  lift platform
 *   @  start             C  bus-stop checkpoint (Danladi the conductor waits there)
 *   F  Owambe (goal; the level's `host` waits inside)
 *
 * `npcs` puts people by column: suya, mamaput, nurse (clinic), water, okadaman, kekeman.
 * Ride owners come with their okada or keke parked beside them.
 */
'use strict';

function chunk(w, { gaps = [], water = false, put = [] } = {}) {
  const rows = Array.from({ length: 14 }, () => Array(w).fill('.'));
  for (let x = 0; x < w; x++) {
    const open = gaps.some(([a, b]) => x >= a && x <= b);
    rows[12][x] = open ? '.' : '#';
    rows[13][x] = open ? (water ? '~' : '.') : '#';
  }
  for (const [row, col, text] of put) {
    if (col + text.length > w) throw new Error(`Level chunk overflow at row ${row}, col ${col}: "${text}"`);
    [...text].forEach((ch, i) => {
      if (ch !== ' ') rows[row][col + i] = ch;
    });
  }
  return rows.map((r) => r.join(''));
}

const pillar = (col, top, bottom = 11) => Array.from({ length: bottom - top + 1 }, (_, i) => [top + i, col, 'PP']);
const stairs = (col, heights) => heights.flatMap((h, i) => Array.from({ length: h }, (_, j) => [11 - j, col + i, 'X']));
const joinChunks = (...chunks) => Array.from({ length: 14 }, (_, r) => chunks.map((c) => c[r]).join(''));

// `dark` lays a night wash over the whole stage; `rail` draws the bridge parapet.
const THEMES = {
  street: { ground: 'street', sky: ['#8fd0f5', '#fdf1dc'], haze: 'rgba(250, 238, 214, 0.30)' },
  market: { ground: 'market', sky: ['#f7b267', '#f4845f'], haze: 'rgba(247, 178, 103, 0.28)' },
  bridge: { ground: 'bridge', sky: ['#7cc6f2', '#e0f4ff'], haze: 'rgba(224, 244, 255, 0.25)', rail: true },
  night: { ground: 'street', sky: ['#0d1030', '#241a3a'], haze: 'rgba(16, 14, 40, 0.42)', dark: 0.5 },
  makoko: { ground: 'deck', sky: ['#5d7f9c', '#b9c6c4'], haze: 'rgba(150, 168, 175, 0.30)' },
  island: { ground: 'island', sky: ['#a9d7e8', '#f3e7cf'], haze: 'rgba(243, 231, 207, 0.26)' },
};

const LEVELS = [
  {
    id: '1-1',
    name: 'OSHODI UNDER BRIDGE',
    theme: 'street',
    photo: 'bg_oshodi',
    song: 'eko',
    ambience: 'street',
    time: 320,
    story: 'TUNDE MOTOR DON KNOCK FOR OSHODI. IYA RONKE DEY WAIT FOR AM UNDER THE FAMILY CANOPY.',
    tip: 'PRESS ↑ TO TALK: BUY SUYA, HIRE OKADA, SETTLE AGBERO. ↓ TO COMOT FROM RIDE.',
    host: 'mum',
    reward: 200,
    buildings: ['house_notforsale', 'mamaput', 'apartments', 'pos'],
    decor: [
      [4, 'sign_oshodi'], [12, 'lamp'], [22, 'billboard_jollof', 'food_jollof'], [36, 'lamp'], [44, 'palm'],
      [59, 'danfo'], [78, 'lamp'], [88, 'palm'], [118, 'lamp'], [136, 'billboard_suya', 'food_suya'],
      [147, 'generator'], [152, 'lamp'], [188, 'lamp'],
    ],
    npcs: [[30, 'okadaman'], [70, 'suya'], [92, 'kekeman'], [180, 'nurse']],
    map: joinChunks(
      chunk(40, { put: [[11, 2, '@'], [9, 6, 'ooo'], [8, 15, '?'], [8, 20, 'BUB?B'], [4, 22, '?'], [11, 26, 'r'], [11, 37, 'r']] }),
      chunk(40, {
        put: [...pillar(5, 10), ...pillar(14, 9), ...pillar(26, 8), [5, 25, 'oooo'], [9, 17, 'ooo'], [11, 2, 'N'], [11, 10, 'r'], [11, 20, 'r'], [11, 22, 'r'], [11, 34, 'a']],
      }),
      chunk(40, {
        gaps: [[4, 5], [29, 30]],
        put: [[8, 10, 'B?B?B'], [4, 12, 'M'], [8, 23, '===='], [6, 23, 'oooo'], [11, 20, 'a'], [11, 24, 'r'], [11, 36, 'C']],
      }),
      chunk(40, {
        gaps: [[6, 8], [33, 34]],
        put: [[8, 9, '====='], [6, 10, 'ooo'], [8, 20, '?U?'], [4, 21, 'h'], [9, 36, 'oo'], [11, 14, 'r'], [11, 22, 'g'], [11, 25, 'r']],
      }),
      chunk(56, {
        gaps: [[11, 13]],
        put: [...stairs(3, [1, 2, 3, 4, 5, 5, 5, 5]), ...stairs(14, [4, 3, 2, 1]), [4, 8, 'ooo'], [11, 28, 'r'], [11, 38, 'F']],
      }),
    ),
  },
  {
    id: '1-2',
    name: 'BALOGUN MARKET',
    theme: 'market',
    photo: 'bg_market',
    song: 'balogun',
    ambience: 'market',
    time: 320,
    story: 'THE ASO-EBI DEY WITH TAILOR KUNLE FOR BALOGUN. BALOGUN MARKET NO DEY SMALL O!',
    tip: 'EWURE DEY CHARGE LIKE DANFO WEY NO GET BRAKE. KEKE FIT CLEAR DEM FOR ROAD!',
    host: 'tailor',
    reward: 200,
    buildings: ['stall', 'mamaput', 'apartments', 'pos', 'stall'],
    decor: [
      [4, 'sign_balogun'], [15, 'stall'], [30, 'billboard_puffpuff', 'food_puffpuff'], [46, 'lamp'], [58, 'stall'],
      [71, 'generator'], [88, 'lamp'], [96, 'pos'], [124, 'billboard_suya', 'food_suya'], [140, 'lamp'], [150, 'stall'],
      [168, 'pos'], [184, 'stall'], [200, 'lamp'],
    ],
    npcs: [[5, 'kekeman'], [40, 'mamaput'], [82, 'water'], [120, 'okadaman'], [178, 'suya']],
    map: joinChunks(
      chunk(40, { put: [[11, 2, '@'], [8, 11, '?U?'], [9, 15, 'ooo'], [9, 19, '======='], [7, 20, 'ooooo'], [11, 28, 'g'], [9, 32, 'm']] }),
      chunk(40, {
        gaps: [[10, 12], [26, 29]],
        put: [[10, 7, '===='], [8, 14, '====='], [6, 15, 'ooo'], [10, 21, '===='], [8, 32, 'B?BMB'], [11, 8, 'a'], [9, 22, 'm'], [11, 34, 'r']],
      }),
      chunk(40, {
        put: [[8, 4, 'BBBBBBBBB'], [5, 10, 'h'], ...pillar(19, 8), [8, 27, 'oooo'], [10, 30, 'm'], [11, 2, 'N'], [11, 14, 'g'], [11, 25, 'a'], [11, 33, 'C'], [11, 39, 'g']],
      }),
      chunk(40, {
        gaps: [[8, 18]],
        put: [[10, 10, '===='], [10, 16, '=='], [8, 20, '====='], [6, 21, 'ooo'], [8, 31, 'S'], [9, 34, 'ooo'], [11, 24, 'r'], [8, 14, 'm']],
      }),
      chunk(56, {
        put: [[8, 14, '?M?'], [11, 4, 'a'], [11, 12, 'g'], [9, 22, 'm'], [9, 26, 'ooo'], ...stairs(31, [1, 2, 3, 4, 5, 5]), [3, 33, 'ooo'], [11, 44, 'F']],
      }),
    ),
  },
  {
    id: '1-3',
    name: '3RD MAINLAND BRIDGE',
    theme: 'bridge',
    photo: 'bg_lagoon',
    song: 'lagoon',
    ambience: 'bridge',
    time: 340,
    story: 'ASO-EBI DEY HAND. NA ONLY THIRD MAINLAND BRIDGE REMAIN BEFORE THE ISLAND.',
    tip: 'OKADA NO DEY BRAKE FOR ANYBODY. WHEN YOU SEE ! SIGN, JUMP SHARP SHARP!',
    host: 'fashe',
    reward: 0,
    buildings: [],
    decor: [
      [9, 'sign_bridge'], [24, 'lamp'], [30, 'billboard_jollof', 'food_jollof'], [44, 'lamp'], [72, 'lamp'], [84, 'lamp'],
      [112, 'lamp'], [128, 'lamp'], [138, 'billboard_puffpuff', 'food_puffpuff'], [150, 'danfo'], [162, 'lamp'],
      [196, 'lamp'], [214, 'lamp'], [236, 'lamp'],
    ],
    npcs: [[5, 'okadaman'], [66, 'water'], [134, 'kekeman'], [189, 'suya'], [223, 'nurse']],
    map: joinChunks(
      chunk(40, { put: [[11, 2, '@'], [8, 12, '?U?'], [9, 18, 'ooo'], [11, 28, 'r'], [11, 34, 'k']] }),
      chunk(40, {
        gaps: [[10, 23]], water: true,
        // A bridge pillar splits the crossing into two canoe rides, so one mistimed
        // hop is not a drowning, and the mosquito stays away from the water's edge.
        put: [...pillar(16, 10, 13), [12, 10, '_'], [12, 19, '_'], [7, 15, 'ooooo'], [9, 3, 'm']],
      }),
      chunk(40, { gaps: [[8, 25]], water: true, put: [[12, 10, '|'], [12, 18, '|'], [4, 11, 'oo'], [4, 19, 'oo'], [11, 30, 'k']] }),
      chunk(40, {
        put: [[11, 2, 'C'], [8, 5, 'B?B?B'], [9, 10, 'ooo'], [5, 26, 'M'], [8, 24, 'BBBBB'], [10, 14, 'm'], [10, 30, 'm'], [11, 18, 'N'], [11, 21, 'a'], [11, 33, 'k']],
      }),
      chunk(40, {
        // Two shorter canoe rides either side of the pillar island: the nine- and
        // eleven-tile versions drowned you far too often this close to the wedding.
        gaps: [[6, 12], [17, 24]],
        water: true,
        put: [...pillar(15, 9, 13), [12, 6, '_'], [12, 18, '_'], [6, 22, 'ooo'], [11, 3, 'r'], [11, 32, 'r']],
      }),
      chunk(56, {
        put: [...stairs(7, [1, 2, 3, 4, 5, 5, 5]), [3, 11, 'oo'], [10, 3, 'm'], [11, 20, 'k'], [11, 28, 'a'], [11, 42, 'F']],
      }),
    ),
  },
  {
    id: '1-4',
    name: 'OJUELEGBA AT NIGHT',
    theme: 'night',
    photo: 'bg_ojuelegba',
    song: 'ojuelegba',
    ambience: 'night',
    time: 340,
    story: 'ONE CHANCE DON SCATTER EVERYTHING. TUNDE WAKE FOR OJUELEGBA. NIGHT DON FALL, ASO-EBI DON GO.',
    tip: 'NIGHT NO GET EYE. FIND BABA RISI FOR THE JUNCTION - HIM SABI EVERY FACE FOR THIS ROAD.',
    host: 'risi',
    reward: 300,
    buildings: ['apartments', 'house_notforsale', 'pos', 'mamaput'],
    decor: [
      [4, 'sign_ojuelegba'], [14, 'lamp'], [30, 'generator'], [44, 'lamp'], [58, 'pos'],
      [76, 'generator'], [90, 'lamp'], [104, 'billboard_suya', 'food_suya'], [126, 'lamp'],
      [142, 'generator'], [158, 'lamp'], [180, 'pos'], [196, 'lamp'],
    ],
    npcs: [[24, 'suya'], [70, 'water'], [116, 'okadaman'], [188, 'nurse']],
    map: joinChunks(
      chunk(40, { put: [[11, 2, '@'], [9, 7, 'ooo'], [8, 16, '?U?'], [11, 25, 'r'], [11, 33, 'r'], [9, 36, 'm']] }),
      chunk(40, {
        gaps: [[13, 15]],
        put: [...pillar(4, 9), ...pillar(22, 8), [8, 9, 'B?B'], [6, 18, 'oooo'], [11, 7, 'a'], [10, 28, 'm'], [11, 34, 'r']],
      }),
      chunk(40, {
        put: [...pillar(10, 8), [8, 18, 'BB?BB'], [5, 20, 'M'], [9, 28, 'ooo'], [11, 2, 'N'], [11, 14, 'r'], [11, 25, 'a'], [11, 36, 'C']],
      }),
      chunk(40, {
        gaps: [[8, 10], [24, 27]],
        put: [[8, 12, '====='], [6, 13, 'ooo'], [8, 20, '?U?'], [4, 21, 'h'], [9, 30, '====='], [10, 34, 'm'], [11, 6, 'r']],
      }),
      chunk(56, {
        gaps: [[16, 18]],
        put: [...stairs(4, [1, 2, 3, 4, 5, 5]), [3, 8, 'ooo'], [11, 24, 'a'], [11, 30, 'r'], [8, 34, 'S'], [11, 42, 'F']],
      }),
    ),
  },
  {
    id: '1-5',
    name: 'MAKOKO WATERSIDE',
    theme: 'makoko',
    photo: 'bg_makoko',
    song: 'makoko',
    ambience: 'bridge',
    time: 360,
    story: 'BABA RISI SAY FASHE BOYS DEY SELL THE CLOTH FOR MAKOKO, FOR TOP WATER. NA CANOE GO CARRY YOU.',
    tip: 'THE BOARD DEY NARROW AND THE WATER DEY BELOW. WAIT FOR CANOE, NO RUSH.',
    host: 'ebun',
    reward: 200,
    buildings: [],
    decor: [
      [4, 'sign_makoko'], [20, 'lamp'], [58, 'lamp'], [96, 'lamp'], [132, 'billboard_jollof', 'food_jollof'],
      [150, 'lamp'], [186, 'lamp'],
    ],
    npcs: [[28, 'water'], [102, 'mamaput'], [166, 'suya']],
    map: joinChunks(
      chunk(40, { put: [[11, 2, '@'], [9, 8, 'ooo'], [8, 15, '?U?'], [10, 24, 'm'], [11, 30, 'r'], [9, 34, 'm']] }),
      chunk(40, {
        gaps: [[8, 14], [20, 26]],
        water: true,
        put: [[12, 9, '_'], [12, 21, '_'], [7, 10, 'ooo'], [7, 22, 'ooo'], [10, 17, 'm'], [11, 32, 'r']],
      }),
      chunk(40, {
        gaps: [[10, 16]],
        water: true,
        put: [[12, 11, '_'], [8, 22, 'B?B'], [9, 30, 'ooo'], [11, 2, 'N'], [10, 26, 'm'], [11, 35, 'a']],
      }),
      chunk(40, {
        gaps: [[6, 12], [18, 24], [30, 34]],
        water: true,
        put: [[12, 7, '_'], [12, 19, '_'], [12, 31, '_'], [6, 8, 'oo'], [6, 20, 'oo'], [10, 27, 'm'], [11, 15, 'C']],
      }),
      chunk(56, {
        gaps: [[8, 14]],
        water: true,
        put: [[12, 9, '_'], [8, 20, '?M?'], [9, 26, 'ooo'], [10, 32, 'm'], [11, 36, 'r'], [11, 44, 'F']],
      }),
    ),
  },
  {
    id: '1-6',
    name: 'LAGOS ISLAND GO-SLOW',
    theme: 'island',
    photo: 'bg_island',
    song: 'island',
    ambience: 'street',
    time: 380,
    story: 'ASO-EBI DON RETURN. NA ONLY ISALE EKO GO-SLOW REMAIN. DEM NEVER CUT CAKE - RUN!',
    tip: 'GO-SLOW MEAN OKADA EVERYWHERE. THE OWAMBE DEY THE END OF THIS ROAD.',
    host: 'bride',
    reward: 0,
    buildings: ['house_notforsale', 'apartments', 'mamaput', 'pos', 'stall'],
    decor: [
      [4, 'sign_island'], [16, 'lamp'], [30, 'palm'], [46, 'billboard_puffpuff', 'food_puffpuff'],
      [64, 'danfo'], [82, 'lamp'], [100, 'palm'], [118, 'keke'], [138, 'lamp'],
      [156, 'billboard_jollof', 'food_jollof'], [176, 'palm'], [196, 'lamp'], [222, 'danfo'], [238, 'lamp'],
    ],
    npcs: [[22, 'kekeman'], [60, 'suya'], [108, 'mamaput'], [150, 'okadaman'], [206, 'nurse']],
    map: joinChunks(
      chunk(40, { put: [[11, 2, '@'], [9, 9, 'ooo'], [8, 17, '?U?'], [11, 30, 'k'], [11, 36, 'r']] }),
      chunk(40, {
        gaps: [[18, 20]],
        put: [[8, 6, 'B?B?B'], [4, 8, 'M'], [9, 24, 'oooo'], [11, 12, 'a'], [11, 28, 'g'], [11, 34, 'k']],
      }),
      chunk(40, {
        put: [...pillar(8, 8), [8, 18, '======'], [6, 19, 'oooo'], [10, 28, 'm'], [11, 2, 'N'], [11, 25, 'r'], [11, 36, 'C']],
      }),
      chunk(40, {
        gaps: [[10, 13], [26, 28]],
        put: [[8, 16, '?S?'], [4, 17, 'h'], [9, 32, 'ooo'], [11, 6, 'g'], [11, 22, 'a'], [11, 36, 'k']],
      }),
      chunk(40, {
        put: [[8, 8, 'BBBBB'], [5, 10, 'M'], [9, 20, 'ooo'], [11, 4, 'r'], [10, 16, 'm'], [11, 28, 'a'], [11, 34, 'k']],
      }),
      chunk(56, {
        gaps: [[12, 14]],
        put: [...stairs(3, [1, 2, 3, 4, 5, 5, 5]), [3, 7, 'oooo'], [11, 26, 'r'], [11, 34, 'g'], [11, 42, 'F']],
      }),
    ),
  },
];
