// Rides Oga Tunde can climb into: a green-and-white okada (motorbike) and a yellow
// Keke Maruwa (tricycle). Both are drawn empty; the game sits Oga on or in them.
import { Pix } from './pix.mjs';

function bike(frame, parked) {
  const p = new Pix(32, 24);
  p.rect(4, 12, 5, 1, 'n');
  p.rect(6, 14, 18, 3, 'G').rect(6, 15, 18, 1, 'W');
  p.rect(9, 12, 9, 2, 'k');
  p.rect(20, 11, 5, 4, 'G').rect(21, 12, 3, 1, 'l');
  p.line(24, 10, 26, 18, 'N').line(25, 10, 27, 18, 'N');
  p.rect(21, 9, 4, 1, 'k');
  p.rect(2, 16, 7, 2, 'N');
  if (parked) p.line(12, 17, 10, 21, 'k');
  for (const cx of [7, 25]) {
    p.disc(cx, 19, 4, 'k');
    p.disc(cx, 19, 2, 'n');
  }
  p.outline('K');
  p.rect(26, 12, 2, 2, 'Y');
  for (const cx of [7, 25]) {
    p.set(cx, 19, 'N');
    if (frame === 0) p.set(cx - 1, 18, 'N').set(cx + 1, 20, 'N');
    else p.set(cx + 1, 18, 'N').set(cx - 1, 20, 'N');
  }
  return p;
}

function keke(frame) {
  const p = new Pix(36, 28);
  p.rect(5, 2, 22, 2, 'k').rect(6, 4, 1, 10, 'k').rect(26, 4, 1, 9, 'k');
  p.rect(27, 5, 3, 7, 'c');
  p.rect(8, 8, 4, 5, 'n');
  p.rect(3, 13, 27, 8, 'Y').rect(28, 11, 5, 10, 'Y').rect(31, 13, 3, 7, 'Y');
  p.rect(3, 19, 31, 1, 'G');
  for (const cx of [9, 30]) p.disc(cx, 23.5, 3.5, 'k');
  p.outline('K');
  p.text(8, 13, 'KEKE', 'G').set(33, 15, 'A').set(28, 6, 'W');
  for (const cx of [9, 30]) {
    p.disc(cx, 23.5, 1.5, 'N');
    p.set(frame ? cx + 1 : cx - 1, 22, 'n');
  }
  return p;
}

export function rideFrames() {
  return {
    bike1: bike(0, false),
    bike2: bike(1, false),
    bike_parked: bike(0, true),
    keke1: keke(0),
    keke2: keke(1),
  };
}
