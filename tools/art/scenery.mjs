// Bigger scenery: the Owambe party canopy (level goal), Lagos buildings for the
// parallax skyline, the Mama Put canteen, a POS stand and a market umbrella stall.
import { Pix } from './pix.mjs';

const measure = (text, font = 'small') => new Pix(1, 1).textWidth(text, font);

function canopy(p, cx, top, rows, colors) {
  for (let y = 0; y < rows; y++) {
    const half = Math.round(4 + y * 1.8);
    for (let x = cx - half; x <= cx + half; x++) {
      p.set(x, top + y, colors[Math.floor(((x - cx + half) / (half * 2 + 1)) * 6) % colors.length]);
    }
  }
  return p;
}

function canopyWith(banner) {
  const p = new Pix(104, 84);
  for (const x of [8, 94]) p.rect(x, 26, 2, 58, 'N');
  for (const x of [13, 79]) {
    p.rect(x, 58, 12, 26, 'k');
    p.disc(x + 6, 65, 3, 'n').disc(x + 6, 76, 4, 'n').disc(x + 6, 65, 1, 'k').disc(x + 6, 76, 1.5, 'k');
  }
  for (let y = 6; y < 25; y++) {
    const inset = Math.round((24 - y) * 1.6);
    for (let x = 2 + inset; x < 102 - inset; x++) p.set(x, y, Math.floor((x - 2) / 8) % 2 === 0 ? 'W' : 'Y');
  }
  for (let x = 2; x < 102; x += 8) p.ellipse(x + 3.5, 25, 3.5, 3, 'P');
  p.rect(24, 32, 56, 13, 'P');
  for (const [x, y, c] of [[4, 12, 'R'], [10, 6, 'Y'], [94, 6, 'G'], [100, 12, 'B']]) p.ellipse(x, y, 3, 3.5, c);
  p.outline('K');
  p.text(52 - Math.floor(measure(banner, 'big') / 2), 35, banner, 'Y', 'big');
  for (const [x, y] of [[4, 12], [10, 6], [94, 6], [100, 12]]) p.line(x, y + 5, x + (x < 50 ? 3 : -3), y + 14, 'w');
  for (const x of [30, 44, 58, 72]) p.set(x, 29, 'Y').set(x, 30, 'y');
  return p;
}

function houseNotForSale() {
  const p = new Pix(64, 88);
  p.rect(40, 2, 12, 12, 'k').rect(43, 14, 1, 5, 'n').rect(49, 14, 1, 5, 'n');
  p.ellipse(14, 13, 4, 3, 'W').rect(14, 15, 1, 4, 'n');
  p.rect(2, 18, 60, 4, 'N').rect(4, 22, 56, 66, 'w').rect(4, 46, 56, 2, 'N');
  for (const [x, y] of [[9, 28], [27, 28], [45, 28], [9, 64], [45, 64]]) {
    p.rect(x, y, 10, 12, 'b');
    for (let i = 1; i < 10; i += 3) p.rect(x + i, y, 1, 12, 'k');
    p.rect(x, y + 6, 10, 1, 'k');
  }
  p.rect(27, 64, 10, 24, 'D').rect(50, 38, 8, 5, 'W');
  p.outline('K');
  p.rect(40, 5, 12, 1, 'n').rect(40, 9, 12, 1, 'n').set(35, 76, 'Y');
  p.text(32 - Math.floor(measure('THIS HOUSE') / 2), 50, 'THIS HOUSE', 'R');
  p.text(32 - Math.floor(measure('NOT FOR SALE') / 2), 56, 'NOT FOR SALE', 'R');
  return p;
}

function apartments() {
  const p = new Pix(56, 104);
  p.rect(2, 8, 52, 96, 'e').rect(0, 4, 56, 5, 'b').rect(22, 92, 12, 12, 'd');
  for (let floor = 0; floor < 4; floor++) {
    const y = 14 + floor * 20;
    for (const x of [7, 23, 39]) p.rect(x, y, 10, 11, 'b');
    p.rect(2, y + 15, 52, 2, 'E');
    if (floor === 2) p.rect(40, y + 11, 8, 4, 'W');
  }
  p.outline('K');
  for (let floor = 0; floor < 4; floor++) {
    for (const x of [7, 23, 39]) p.set(x + 2, 17 + floor * 20, 'c').set(x + 3, 16 + floor * 20, 'c');
  }
  p.line(4, 46, 51, 46, 'w');
  for (const [x, c] of [[8, 'R'], [15, 'Y'], [22, 'G'], [30, 'B'], [38, 'P'], [45, 'O']]) p.rect(x, 47, 4, 5, c);
  return p;
}

function mamaPut() {
  const p = new Pix(72, 60);
  p.rect(10, 0, 52, 11, 'R').rect(0, 11, 72, 5, 'N').rect(4, 16, 64, 44, 'W');
  p.rect(8, 26, 22, 34, 'k').rect(38, 24, 26, 13, 'b').rect(36, 42, 30, 6, 'D');
  p.disc(45, 39, 3, 'n').disc(56, 39, 3, 'n');
  p.outline('K');
  for (let x = 1; x < 72; x += 4) p.rect(x, 12, 1, 4, 'n');
  p.text(36 - Math.floor(measure('MAMA PUT') / 2), 3, 'MAMA PUT', 'W');
  p.set(40, 26, 'c').set(41, 25, 'c').set(45, 33, 'w').set(46, 31, 'w').set(56, 33, 'w').set(55, 31, 'w');
  return p;
}

function posStand() {
  const p = canopy(new Pix(40, 44), 20, 0, 10, ['R', 'Y']);
  p.rect(19, 10, 2, 18, 'n').rect(6, 28, 28, 4, 'D').rect(8, 32, 3, 12, 'd').rect(29, 32, 3, 12, 'd');
  p.rect(12, 33, 16, 9, 'B').rect(24, 25, 5, 3, 'k');
  p.outline('K');
  return p.text(20 - Math.floor(measure('POS') / 2), 35, 'POS', 'W').set(26, 26, 'l');
}

function marketStall() {
  const p = canopy(new Pix(44, 40), 22, 0, 11, ['G', 'W']);
  p.rect(21, 11, 2, 16, 'n').rect(3, 26, 38, 4, 'D').rect(5, 30, 3, 10, 'd').rect(36, 30, 3, 10, 'd');
  p.ellipse(11, 24, 6, 2, 'n').ellipse(31, 24, 6, 2, 'n');
  for (const [x, y, c] of [[8, 22, 'R'], [11, 21, 'R'], [14, 22, 'R'], [10, 23, 'R'], [28, 22, 'O'], [31, 21, 'Y'], [34, 22, 'O'], [30, 23, 'l']]) {
    p.disc(x, y, 1.3, c);
  }
  return p.outline('K');
}

// Where each stage actually ends. Only the last one is the party; the others were all
// showing an OWAMBE canopy, which told you that you had arrived when you had not.
function tailorShop() {
  const p = new Pix(88, 80);
  p.rect(6, 0, 76, 12, 'P').rect(0, 12, 88, 6, 'N');
  p.rect(4, 18, 80, 62, 'W').rect(4, 18, 80, 2, 'w');
  p.rect(10, 28, 26, 24, 'c').rect(52, 28, 26, 24, 'c');
  p.rect(36, 52, 16, 28, 'D').rect(36, 52, 16, 2, 'd');
  // bolts of cloth stacked in the window, and a sewing machine
  for (const [i, col] of ['R', 'G', 'Y', 'B', 'O'].entries()) p.rect(12 + i * 5, 34, 4, 16, col);
  p.rect(56, 40, 18, 4, 'k').rect(60, 34, 4, 6, 'k').rect(58, 44, 14, 8, 'D');
  p.outline('K');
  for (let x = 1; x < 88; x += 4) p.rect(x, 13, 2, 5, 'n');
  p.text(44 - Math.floor(measure('TAILOR', 'big') / 2), 2, 'TAILOR', 'Y', 'big');
  return p;
}

function vulcanizerShed() {
  const p = new Pix(84, 76);
  p.rect(2, 10, 80, 8, 'z').rect(0, 8, 84, 3, 'k');
  p.rect(6, 18, 72, 58, 'e').rect(6, 18, 72, 2, 'E');
  p.rect(30, 46, 20, 30, 'k');
  // tyres stacked outside, and the compressor
  for (const [x, y] of [[12, 52], [12, 64], [62, 52], [62, 64], [70, 58]]) {
    p.disc(x + 6, y + 5, 6, 'k').disc(x + 6, y + 5, 2.5, 'n');
  }
  p.rect(54, 30, 16, 12, 'R').rect(56, 32, 6, 5, 'k');
  p.outline('K');
  p.text(42 - Math.floor(measure('VULCANIZER') / 2), 12, 'VULCANIZER', 'Y');
  return p;
}

function jetty() {
  const p = new Pix(96, 60);
  // a plank landing on stilts, with a canoe tied alongside
  p.rect(0, 20, 96, 8, 'D').rect(0, 20, 96, 2, 'E').rect(0, 26, 96, 2, 'd');
  for (const x of [8, 30, 54, 80]) p.rect(x, 28, 4, 32, 'd').rect(x, 28, 1, 32, 'D');
  p.rect(20, 4, 4, 16, 'D').rect(16, 0, 12, 5, 'W').rect(16, 0, 12, 2, 'w');
  p.rect(60, 8, 4, 12, 'D');
  const rows = [[34, 92], [34, 92], [37, 89], [40, 86]];
  rows.forEach(([a, b], i) => p.rect(a, 40 + i, b - a + 1, 1, i ? 'D' : 'E'));
  p.outline('K');
  for (let x = 2; x < 96; x += 6) p.set(x, 21, 'E');
  return p;
}

export function sceneryFrames() {
  return {
    owambe: canopyWith('OWAMBE'),
    canopy_family: canopyWith('FAMILY'),
    tailor_shop: tailorShop(),
    vulcanizer: vulcanizerShed(),
    jetty: jetty(),
    house_notforsale: houseNotForSale(),
    apartments: apartments(),
    mamaput: mamaPut(),
    pos: posStand(),
    stall: marketStall(),
  };
}
