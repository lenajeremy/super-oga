#!/usr/bin/env node
/*
 * Downloads the free stock photos used in SUPER OGA (all from Pexels, under the
 * Pexels License: free to use, attribution not required, credited anyway), keeps
 * the originals in assets/photos/original/ and writes game-sized JPGs to assets/photos/.
 * The game copies are deliberately small - roughly one screen wide - because the game
 * draws them into its 400x224 canvas, which then scales up with hard pixel edges. That
 * chunky, blocky backdrop is the look. Also writes credits.js and CREDITS.md.
 * Re-running skips photos that were already downloaded at the needed size.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ORIGINAL_DIR = path.join(root, 'assets/photos/original');
const OUT_DIR = path.join(root, 'assets/photos');

// size: [width, height] of the processed JPG; position: crop gravity.
const PHOTOS = [
  {
    name: 'title_danfo', id: 5409303, author: 'Richard Badejo', use: 'Title screen',
    title: 'Yellow van terminal on the roadside',
    page: 'https://www.pexels.com/photo/yellow-van-terminal-on-the-roadside-5409303/',
    size: [400, 224], position: 'centre',
  },
  {
    name: 'bg_oshodi', id: 11390779, author: 'Daniel Sikpi', use: 'Stage 1 backdrop',
    title: 'People on the road',
    page: 'https://www.pexels.com/photo/people-on-the-road-11390779/',
    size: [480, 224], position: 'centre',
  },
  {
    name: 'bg_market', id: 30583818, author: 'Bamidele Olamilekan', use: 'Stage 2 backdrop',
    title: 'Bustling Lagos street market scene at sunset',
    page: 'https://www.pexels.com/photo/bustling-lagos-street-market-scene-at-sunset-30583818/',
    // The lower crop is the market itself - umbrellas, traders, danfos - rather than sky.
    size: [480, 224], position: 'bottom',
  },
  {
    name: 'bg_lagoon', id: 37405043, author: 'Fawaz Onakoya', use: 'Stage 3 backdrop',
    title: 'Modern Lagos skyline with watercraft in lagoon',
    page: 'https://www.pexels.com/photo/modern-lagos-skyline-with-watercraft-in-lagoon-37405043/',
    size: [480, 224], position: 'top',
  },
  {
    name: 'victory_sunset', id: 36602313, author: 'Fera', use: 'Victory screen',
    title: 'Skyline of Lagos at sunset captured from water',
    page: 'https://www.pexels.com/photo/skyline-of-lagos-at-sunset-captured-from-water-36602313/',
    size: [400, 224], position: 'centre',
  },
  {
    name: 'food_jollof', id: 13915043, author: "Keesha's Kitchen", use: 'Jollof billboard',
    title: 'Rice with fish and vegetables on a serving dish',
    page: 'https://www.pexels.com/photo/rice-with-fish-and-vegetables-on-a-serving-dish-13915043/',
    size: [72, 42], position: 'bottom',
  },
  {
    name: 'food_suya', id: 31120524, author: 'The Northern Lense', use: 'Suya billboard',
    title: 'Street vendor grilling meat skewers in Africa',
    page: 'https://www.pexels.com/photo/street-vendor-grilling-meat-skewers-in-africa-31120524/',
    size: [72, 42], position: 'centre',
  },
  {
    name: 'food_puffpuff', id: 13915068, author: "Keesha's Kitchen", use: 'Puff-puff billboard',
    title: 'Close-up shot of delicious puff puff on white ceramic bowl',
    page: 'https://www.pexels.com/photo/close-up-shot-of-delicious-puff-puff-on-white-ceramic-bowl-13915068/',
    size: [72, 42], position: 'centre',
  },
];

async function download(photo) {
  const width = 1600;
  const file = path.join(ORIGINAL_DIR, `${photo.name}@${width}w.jpg`);
  if (fs.existsSync(file)) return { file, fresh: false };
  const url = `https://images.pexels.com/photos/${photo.id}/pexels-photo-${photo.id}.jpeg?auto=compress&cs=tinysrgb&w=${width}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'SuperOgaGameBuilder/1.0 (local hobby game project)' } });
  if (!res.ok) throw new Error(`${photo.name}: HTTP ${res.status} from ${url}`);
  const type = res.headers.get('content-type') || '';
  if (!type.startsWith('image/')) throw new Error(`${photo.name}: expected an image but got "${type}"`);
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  // Drop copies downloaded at other sizes by earlier runs of this script.
  for (const old of fs.readdirSync(ORIGINAL_DIR)) {
    if ((old === `${photo.name}.jpg` || old.startsWith(`${photo.name}@`)) && old !== path.basename(file)) {
      fs.rmSync(path.join(ORIGINAL_DIR, old));
    }
  }
  return { file, fresh: true };
}

fs.mkdirSync(ORIGINAL_DIR, { recursive: true });
for (const photo of PHOTOS) {
  const { file, fresh } = await download(photo);
  const meta = await sharp(file).metadata();
  const out = path.join(OUT_DIR, `${photo.name}.jpg`);
  await sharp(file)
    .resize(photo.size[0], photo.size[1], { fit: 'cover', position: photo.position })
    .modulate({ saturation: 1.12 })
    .jpeg({ quality: 88, chromaSubsampling: '4:4:4' })
    .toFile(out);
  const kb = (f) => Math.round(fs.statSync(f).size / 1024);
  console.log(
    `${photo.name.padEnd(15)} ${fresh ? 'downloaded' : 'cached    '} ${meta.width}x${meta.height} ${kb(file)}KB` +
      ` -> ${photo.size.join('x')} ${kb(out)}KB  (${photo.author}, Pexels)`,
  );
}

const credits = PHOTOS.map(({ name, title, author, page, use }) => ({ name, title, author, page, use, license: 'Pexels License' }));
fs.writeFileSync(
  path.join(OUT_DIR, 'credits.js'),
  `// Generated by tools/fetch-photos.mjs - do not edit by hand.\nwindow.PHOTO_CREDITS = ${JSON.stringify(credits, null, 2)};\n`,
);
fs.writeFileSync(
  path.join(root, 'CREDITS.md'),
  [
    '# Credits',
    '',
    '## Photos',
    '',
    'All photos come from [Pexels](https://www.pexels.com) and are used under the',
    '[Pexels License](https://www.pexels.com/license/) (free to use, attribution not required).',
    'Originals are in `assets/photos/original/`; the game uses resized copies from `assets/photos/`.',
    '',
    '| In game | Photo | Photographer |',
    '| --- | --- | --- |',
    ...credits.map((c) => `| ${c.use} | [${c.title}](${c.page}) | ${c.author} |`),
    '',
    '## Everything else',
    '',
    'Sprites, tiles, fonts, sound effects and music are original and generated by code in this repo',
    '(`tools/build-sprites.mjs`, `tools/art/`, `src/pixelfont.js`, `src/audio.js`).',
    '',
  ].join('\n'),
);
console.log('wrote assets/photos/credits.js and CREDITS.md');
