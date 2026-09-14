#!/usr/bin/env node
// Sanity checks for src/levels.js against the sprite manifest and photo list:
// map shape, start/goal/checkpoint counts, things standing on solid ground,
// jumpable gaps, pillar pairs, and decor that points at real sprites and photos.
import fs from 'node:fs';
import vm from 'node:vm';

const read = (rel) => fs.readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const scope = { window: {} };
vm.runInNewContext(`${read('src/levels.js')}\nthis.LEVELS = LEVELS; this.THEMES = THEMES;`, scope);
vm.runInNewContext(read('assets/sprites/manifest.js'), scope);
vm.runInNewContext(read('assets/photos/credits.js'), scope);
const { LEVELS, THEMES } = scope;
const decorFrames = scope.window.SPRITE_ATLAS.sheets.decor.frames;
const photos = new Set(scope.window.PHOTO_CREDITS.map((p) => p.name));

const SOLID = new Set(['#', 'B', '?', 'M', 'U', 'S', 'L', 'X', 'P', 'D']);
// How far Oga can actually jump, measured by tools/measure-jump.mjs. Re-run that after
// touching the jump physics in src/entities.js and update these.
const STAND_RISE = 83;   // px gained by a standing jump, button held
const RUN_RISE = 98;     // px gained by a running jump
const RUN_REACH = 8;     // tiles of horizontal travel in that running jump
const NPC_KINDS = ['suya', 'mamaput', 'nurse', 'water', 'okadaman', 'kekeman'];
const HOSTS = ['mum', 'tailor', 'fashe', 'risi', 'ebun', 'bride'];
const MAX_GAP = 5;
let failures = 0;
const fail = (level, msg) => {
  failures++;
  console.log(`  FAIL ${level.id}: ${msg}`);
};

for (const level of LEVELS) {
  const map = level.map;
  const width = map[0].length;
  const at = (x, y) => (y >= 0 && y < map.length && x >= 0 && x < width ? map[y][x] : '.');
  const count = (chars) => map.join('').split('').filter((c) => chars.includes(c)).length;
  console.log(`${level.id} ${level.name}: ${width} columns, ${count('o')} coins, ${count('?MUSLh')} crates, ${count('rgmak')} enemies`);

  if (map.length !== 14) fail(level, `expected 14 rows, got ${map.length}`);
  map.forEach((row, y) => row.length !== width && fail(level, `row ${y} is ${row.length} wide, expected ${width}`));
  if (!THEMES[level.theme]) fail(level, `unknown theme ${level.theme}`);
  if (!photos.has(level.photo)) fail(level, `unknown backdrop photo ${level.photo}`);
  if (count('@') !== 1) fail(level, `needs exactly one start (@), found ${count('@')}`);
  if (count('F') !== 1) fail(level, `needs exactly one goal (F), found ${count('F')}`);
  if (count('C') > 1) fail(level, `at most one checkpoint (C), found ${count('C')}`);

  for (let y = 0; y < map.length; y++) {
    for (let x = 0; x < width; x++) {
      const ch = map[y][x];
      if ('@CFrgakKNbeZ'.includes(ch) && !SOLID.has(at(x, y + 1))) fail(level, `"${ch}" at col ${x}, row ${y} is not standing on solid ground`);
      if ('_|f'.includes(ch) && at(x, y + 1) !== '~') fail(level, `platform "${ch}" at col ${x} should sit just above water`);
      if (ch === 'h' && at(x, y + 1) !== '.') fail(level, `hidden crate at col ${x} needs empty space below it`);
      if (ch === 'P' && at(x - 1, y) !== 'P') {
        let run = 0;
        while (at(x + run, y) === 'P') run++;
        if (run % 2) fail(level, `pillar run at col ${x}, row ${y} is ${run} wide; pillars are 2 wide`);
      }
    }
  }

  // Every stretch without ground must be crossable: a plank, block, pillar or platform nearby.
  // A canoe ferries you across its whole stretch of open water; a lift only covers its own width.
  const ferried = new Set();
  map.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if ('|f'.includes(ch)) for (let k = 0; k < 3; k++) ferried.add(x + k);
      if (ch !== '_') return;
      let l = x;
      let r = x;
      while (l > 0 && !SOLID.has(at(l - 1, y))) l--;
      while (r < width - 1 && !SOLID.has(at(r + 1, y))) r++;
      for (let k = l; k <= r; k++) ferried.add(k);
    });
  });
  let gap = 0;
  for (let x = 0; x < width; x++) {
    // On a swim stage, open water is something you cross under your own steam.
    let support = ferried.has(x) || (level.swim && map.some((row) => row[x] === '~'));
    for (let y = 6; y < 14; y++) if (SOLID.has(at(x, y)) || at(x, y) === '=') support = true;
    gap = support ? 0 : gap + 1;
    if (gap === MAX_GAP + 1) fail(level, `gap wider than ${MAX_GAP} tiles ending near col ${x}`);
  }

  for (const [tx, name, photo] of level.decor) {
    if (!decorFrames[name]) fail(level, `decor "${name}" is not in the decor sprite sheet`);
    if (photo && !photos.has(photo)) fail(level, `decor photo "${photo}" is not in assets/photos`);
    if (tx < 0 || tx >= width) fail(level, `decor "${name}" at col ${tx} is outside the level`);
  }
  for (const name of level.buildings) if (!decorFrames[name]) fail(level, `building "${name}" is not in the decor sprite sheet`);

  const groundAt = (x) => map.some((row) => row[x] === '#');
  // Every platform has to be reachable: from the ground, from another platform, or from
  // a canoe or lift. An unreachable plank looks like a step and is really a tease.
  const standable = [];
  for (let y = 0; y < map.length; y++) {
    for (let x = 0; x < width; x++) {
      const ch = at(x, y);
      const isTop = SOLID.has(ch) && !SOLID.has(at(x, y - 1));
      // A manhole is just a lid on the street: part of the ground, not a platform.
      const kind = ch === 'D' ? '#' : ch;
      if (isTop || ch === '=' || '_|f'.includes(ch)) standable.push({ x, y, ch: kind });
    }
  }
  const runs = [];
  for (const cell of standable) {
    const prev = runs[runs.length - 1];
    if (prev && prev.y === cell.y && prev.x1 === cell.x - 1 && prev.ch === cell.ch) prev.x1 = cell.x;
    else runs.push({ y: cell.y, x0: cell.x, x1: cell.x, ch: cell.ch });
  }
  const groundRow = Math.max(...runs.filter((r) => r.ch === '#').map((r) => r.y), 12);
  for (const run of runs) {
    if (run.ch === '#' && run.y >= groundRow) continue;        // the street itself
    if ('_|f'.includes(run.ch)) continue;                        // boats carry you to them
    const from = standable.filter((c) => {
      if (c.y <= run.y) return false;                           // must be below the target
      const dx = c.x < run.x0 ? run.x0 - c.x : c.x > run.x1 ? c.x - run.x1 : 0;
      const rise = (c.y - run.y) * 16;
      return rise <= RUN_RISE && dx <= (rise <= STAND_RISE ? RUN_REACH : RUN_REACH - 2);
    });
    if (!from.length) {
      const below = standable
        .filter((c) => c.y > run.y)
        .map((c) => ({
          rise: (c.y - run.y) * 16,
          dx: c.x < run.x0 ? run.x0 - c.x : c.x > run.x1 ? c.x - run.x1 : 0,
        }))
        .sort((a, b) => a.rise + a.dx * 16 - (b.rise + b.dx * 16))[0];
      fail(level, `nothing can reach the platform at row ${run.y}, cols ${run.x0}-${run.x1}` +
        (below ? ` (closest foothold is ${below.rise}px below and ${below.dx} tiles sideways;` +
          ` a running jump gains ${RUN_RISE}px over ${RUN_REACH} tiles)` : ' (no foothold below it at all)'));
    }
  }

  for (const [tx, kind] of level.npcs || []) {
    if (!NPC_KINDS.includes(kind)) fail(level, `unknown person "${kind}" at col ${tx}`);
    if (!groundAt(tx + 1)) fail(level, `person "${kind}" at col ${tx} has no ground to stand on`);
  }
  if (!HOSTS.includes(level.host)) fail(level, `unknown Owambe host "${level.host}"`);
  for (const [a, b] of level.warps || []) {
    for (const col of [a, b]) {
      if (!map.some((row) => row[col] === 'D')) fail(level, `warp column ${col} has no manhole (D) on it`);
    }
  }
  if (!decorFrames[level.goal]) fail(level, `goal building "${level.goal}" is not in the decor sprite sheet`);
  for (const field of ['story', 'tip', 'song', 'ambience']) if (!level[field]) fail(level, `missing "${field}"`);
  if (!['street', 'market', 'bridge', 'night'].includes(level.ambience)) fail(level, `unknown ambience "${level.ambience}"`);
}

console.log(failures ? `\n${failures} problem(s) found` : '\nAll levels OK');
process.exit(failures ? 1 : 0);
