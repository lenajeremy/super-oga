// Collects every sprite sheet for tools/build-sprites.mjs.
import { heroFrames } from './art/hero.mjs';
import { enemyFrames } from './art/enemies.mjs';
import { itemFrames } from './art/items.mjs';
import { tileFrames } from './art/tiles.mjs';
import { decorFrames } from './art/decor.mjs';
import { sceneryFrames } from './art/scenery.mjs';
import { uiFrames } from './art/ui.mjs';
import { rideFrames } from './art/rides.mjs';
import { peopleFrames } from './art/people.mjs';
import { shopFrames } from './art/shops.mjs';

export function buildSheets() {
  return {
    hero: heroFrames(),
    rides: rideFrames(),
    people: { ...peopleFrames(), ...shopFrames() },
    enemies: enemyFrames(),
    items: itemFrames(),
    tiles: tileFrames(),
    decor: { ...decorFrames(), ...sceneryFrames() },
    ui: uiFrames(),
  };
}
