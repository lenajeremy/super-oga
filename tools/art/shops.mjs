// Places to spend your naira: the suya spot, the pure water stand and the clinic.
import { Pix } from './pix.mjs';

const measure = (text) => new Pix(1, 1).textWidth(text);

function suyaStand() {
  const p = new Pix(44, 40);
  p.rect(4, 0, 22, 9, 'R').rect(14, 9, 2, 12, 'n');
  p.rect(10, 27, 2, 13, 'k').rect(34, 27, 2, 13, 'k');
  p.rect(8, 22, 30, 5, 'k').rect(9, 20, 28, 2, 'O');
  for (let i = 0; i < 5; i++) p.rect(11 + i * 5, 18, 4, 2, 'D');
  p.rect(30, 16, 6, 2, 'r');
  p.outline('K');
  p.text(15 - Math.floor(measure('SUYA') / 2), 2, 'SUYA', 'W');
  for (let x = 10; x < 37; x += 3) p.set(x, 21, 'Y');
  for (const [x, y] of [[18, 14], [19, 12], [25, 15], [26, 13], [22, 10]]) p.set(x, y, 'w');
  return p;
}

function waterStand() {
  const p = new Pix(48, 36);
  p.rect(2, 0, 44, 9, 'B').rect(23, 9, 2, 9, 'n');
  p.rect(12, 18, 24, 4, 'W').rect(10, 22, 28, 14, 'B').rect(10, 22, 28, 3, 'c');
  p.outline('K');
  p.text(24 - Math.floor(measure('PURE WATER') / 2), 2, 'PURE WATER', 'W');
  for (let x = 13; x < 36; x += 4) p.set(x, 19, 'c');
  return p;
}

function clinic() {
  const p = new Pix(64, 64);
  p.rect(12, 0, 40, 10, 'W').rect(2, 10, 60, 4, 'N').rect(6, 14, 52, 50, 'W');
  p.rect(10, 22, 12, 10, 'c').rect(42, 22, 12, 10, 'c').rect(6, 35, 52, 2, 'l').rect(26, 40, 12, 24, 'b');
  p.outline('K');
  p.rect(15, 2, 2, 6, 'G').rect(13, 4, 6, 2, 'G');
  p.text(22, 3, 'CLINIC', 'G');
  for (const x of [10, 42]) p.rect(x + 5, 22, 1, 10, 'N').set(x + 2, 24, 'W').set(x + 3, 23, 'W');
  p.set(35, 52, 'Y');
  return p;
}

export function shopFrames() {
  return { suya_stand: suyaStand(), water_stand: waterStand(), clinic: clinic() };
}
