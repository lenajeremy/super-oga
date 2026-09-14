// Title logo: "SUPER" in white and "OGA" in green (green-white-green), chunky
// pixel letters with an extruded shadow, black outline and a gold rim.
import { Pix } from './pix.mjs';

function scaleUp(src, n) {
  const p = new Pix(src.w * n, src.h * n);
  for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) if (src.get(x, y)) p.rect(x * n, y * n, n, n, src.get(x, y));
  return p;
}

function logoWord(text, n, face, light, shade) {
  const width = new Pix(1, 1).textWidth(text, 'big');
  const letters = scaleUp(new Pix(width, 7).text(0, 0, text, face, 'big'), n);
  const depth = Math.max(2, Math.round(n * 0.7));
  const p = new Pix(letters.w + depth + 4, letters.h + depth + 4);
  for (let d = depth; d >= 1; d--) {
    for (let y = 0; y < letters.h; y++) for (let x = 0; x < letters.w; x++) if (letters.get(x, y)) p.set(x + 2 + d, y + 2 + d, shade);
  }
  p.blit(letters, 2, 2);
  // Light edge along the top of every letter stroke.
  for (let y = 0; y < letters.h; y++) {
    for (let x = 0; x < letters.w; x++) if (letters.get(x, y) && !letters.get(x, y - 1)) p.set(x + 2, y + 2, light);
  }
  return p.outline('K').outline('Y');
}

export function uiFrames() {
  return {
    logo_super: logoWord('SUPER', 3, 'W', 'W', 'g'),
    logo_oga: logoWord('OGA', 6, 'G', 'l', 'g'),
  };
}
