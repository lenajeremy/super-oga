// Street furniture and vehicles: danfo, keke, solar street lamp, palm tree, food
// billboards (the photo is drawn into the hole at runtime), bus-stop checkpoint,
// road signs, generator, and the moving platforms (canoe, lift).
import { Pix } from './pix.mjs';

const measure = (text) => new Pix(1, 1).textWidth(text);

function danfo() {
  const p = new Pix(56, 30);
  p.rect(2, 4, 50, 19, 'Y').rect(4, 2, 44, 2, 'Y').rect(48, 5, 4, 3, 'Y').rect(52, 8, 3, 15, 'Y');
  for (const x of [6, 17, 28, 39]) p.rect(x, 6, 9, 5, 'b');
  p.rect(49, 6, 4, 5, 'b');
  p.rect(2, 12, 53, 2, 'K').rect(2, 21, 53, 1, 'K');
  p.outline('K');
  for (const x of [6, 17, 28, 39, 49]) p.set(x + 1, 7, 'c').set(x + 2, 7, 'c').set(x + 1, 8, 'c');
  p.text(28 - Math.floor(measure('NO SHAKING') / 2), 15, 'NO SHAKING', 'K');
  p.rect(53, 16, 2, 2, 'A').rect(50, 22, 6, 1, 'n');
  for (const cx of [13, 43]) p.disc(cx, 25, 4, 'k').disc(cx, 25, 2, 'N').set(cx, 25, 'n');
  return p;
}

function keke() {
  const p = new Pix(36, 28);
  p.rect(5, 2, 22, 2, 'k').rect(6, 4, 1, 10, 'k').rect(26, 4, 1, 9, 'k');
  p.rect(27, 5, 3, 7, 'c');
  p.disc(22, 8, 2, 'S').rect(20, 10, 5, 4, 'B');
  p.rect(3, 13, 27, 8, 'Y').rect(28, 11, 5, 10, 'Y').rect(31, 13, 3, 7, 'Y');
  p.rect(3, 17, 31, 1, 'G');
  p.outline('K');
  p.set(33, 15, 'A');
  for (const cx of [9, 30]) p.disc(cx, 23.5, 3.5, 'k').disc(cx, 23.5, 1.5, 'N');
  return p;
}

function lamp() {
  const p = new Pix(14, 64);
  p.rect(5, 6, 2, 54, 'n').rect(6, 4, 5, 2, 'n').rect(9, 5, 4, 2, 'k').rect(1, 1, 6, 3, 'b').rect(3, 60, 6, 4, 'k');
  p.outline('K');
  return p.rect(10, 7, 2, 1, 'A').rect(1, 1, 6, 1, 'c');
}

function palm() {
  const p = new Pix(44, 60);
  for (let i = 0; i <= 44; i++) {
    const t = i / 44;
    const x = 20 + Math.sin(t * 1.6) * 4;
    const y = 59 - t * 44;
    p.disc(x, y, 1.6, i % 4 === 0 ? 'd' : 'D');
  }
  const fronds = [[-19, 7], [-15, -5], [-6, -12], [6, -12], [15, -5], [19, 7], [-11, 12], [11, 12]];
  for (const [dx, dy] of fronds) {
    for (let s = 0; s <= 1; s += 0.04) {
      p.disc(23 + dx * s, 15 + dy * s - Math.sin(s * Math.PI) * 3 + s * s * 5, s < 0.75 ? 1.2 : 0.6, 'G');
    }
  }
  p.disc(21, 17, 2, 'd').disc(25, 18, 2, 'd');
  p.outline('K');
  for (const [dx, dy] of fronds) p.set(23 + Math.round(dx * 0.4), 15 + Math.round(dy * 0.4) - 3, 'l');
  return p;
}

function billboard(tagline) {
  // 80x72: 72x42 photo hole at (4,4), tagline band underneath, two posts.
  const p = new Pix(80, 72);
  for (const x of [16, 60]) p.rect(x - 1, 56, 6, 16, 'K').rect(x, 56, 4, 16, 'n').rect(x, 56, 1, 16, 'N');
  p.rect(0, 0, 80, 56, 'N').rect(1, 1, 78, 1, 'W');
  for (let y = 4; y < 46; y++) for (let x = 4; x < 76; x++) p.erase(x, y);
  p.box(3, 3, 74, 44, 'k');
  p.rect(3, 47, 74, 7, 'Y').text(40 - Math.floor(measure(tagline) / 2), 48, tagline, 'K');
  return p.box(0, 0, 80, 56, 'K');
}

function busStop(active) {
  const p = new Pix(28, 48);
  p.rect(13, 13, 2, 33, 'n').rect(10, 45, 8, 3, 'k');
  p.rect(1, 1, 26, 13, active ? 'l' : 'Y');
  if (active) p.rect(15, 16, 3, 6, 'G').rect(18, 16, 3, 6, 'W').rect(21, 16, 3, 6, 'G');
  p.outline('K');
  p.text(14 - Math.floor(measure('BUS') / 2), 2, 'BUS', 'K').text(14 - Math.floor(measure('STOP') / 2), 8, 'STOP', 'K');
  return p;
}

function roadSign(text) {
  const w = Math.max(40, measure(text) + 12);
  const p = new Pix(w, 34);
  for (const x of [6, w - 8]) p.rect(x, 17, 2, 17, 'n');
  p.rect(1, 1, w - 2, 16, 'G');
  p.outline('K');
  return p.box(2, 2, w - 4, 14, 'W').text(Math.floor((w - measure(text)) / 2), 7, text, 'W');
}

function generator() {
  const p = new Pix(22, 16);
  p.rect(1, 0, 20, 2, 'n').rect(1, 0, 2, 14, 'n').rect(19, 0, 2, 14, 'n');
  p.rect(3, 3, 16, 10, 'R').rect(4, 4, 7, 7, 'k').rect(12, 5, 6, 3, 'Y');
  p.rect(2, 13, 3, 3, 'k').rect(17, 13, 3, 3, 'k');
  p.outline('K');
  for (let i = 0; i < 3; i++) p.rect(5, 5 + i * 2, 5, 1, 'n');
  return p;
}

function canoe() {
  const p = new Pix(48, 12);
  const rows = [[1, 46], [1, 46], [3, 44], [3, 44], [6, 41], [6, 41], [10, 37]];
  rows.forEach(([x0, x1], i) => p.rect(x0, 2 + i, x1 - x0 + 1, 1, i < 1 ? 'E' : 'D'));
  p.rect(5, 5, 38, 1, 'd').rect(12, 3, 2, 2, 'd').rect(34, 3, 2, 2, 'd');
  return p.outline('K');
}

function lift() {
  const p = new Pix(48, 10);
  p.rect(2, 0, 1, 4, 'w').rect(45, 0, 1, 4, 'w');
  p.rect(0, 4, 48, 4, 'E').rect(0, 7, 48, 1, 'D');
  for (const x of [11, 23, 35]) p.rect(x, 4, 1, 4, 'd');
  return p.outline('K');
}

export function decorFrames() {
  return {
    danfo: danfo(),
    keke: keke(),
    lamp: lamp(),
    palm: palm(),
    billboard_jollof: billboard('PARTY JOLLOF DEY!'),
    billboard_suya: billboard('SUYA: E SWEET DIE!'),
    billboard_puffpuff: billboard('PUFF-PUFF DEY O!'),
    busstop: busStop(false),
    busstop_on: busStop(true),
    sign_oshodi: roadSign('OSHODI'),
    sign_balogun: roadSign('BALOGUN MARKET'),
    sign_bridge: roadSign('3RD MAINLAND BRIDGE'),
    generator: generator(),
    canoe: canoe(),
    lift: lift(),
  };
}
