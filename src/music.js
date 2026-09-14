/* SUPER OGA - the soundtrack data: original Afrobeat / Afrobeats grooves.
 *
 * Shared by src/audio.js (WebAudio playback in the game) and tools/preview-music.mjs
 * (renders a WAV so the groove can be auditioned without opening the game).
 *
 * Patterns are 16 steps per bar. A pattern is either one string (same every bar) or an
 * array of strings, one per bar of the song.
 *
 * Drums    'X' accent, 'x' normal, '-' ghost/soft, '.' rest
 * Pitched  '0'-'9' index into the track's scale (low to high), '-' hold the last note,
 *          '.' rest. Chord tracks play the scale note plus the extra offsets in `stack`.
 *
 * `bars` lists the semitone offset of each bar's root: the chord progression.
 * `swing` pushes the odd 16ths late, which is where the shuffle in the groove comes from.
 */
(function (root, factory) {
  const music = factory();
  if (typeof module === 'object' && module.exports) module.exports = music;
  else root.MUSIC = music;
})(typeof self !== 'undefined' ? self : this, function () {
  // Two octaves of pentatonic, so a single digit reaches anywhere in the riff's range.
  const MINOR_PENT = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22];
  const MAJOR_PENT = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
  const DORIAN = [0, 2, 3, 5, 7, 9, 10, 12, 14, 15];

  const SONGS = {
    // Title screen: the Fela-style horn hook, loose and swaggering.
    title: {
      bpm: 102, swing: 0.2, root: 45, bars: [0, 0, 5, 3], scale: MINOR_PENT,
      drums: {
        kick:   'X..x..x...X..x..',
        snare:  '....X.......X...',
        rim:    '..-..-.x..-...-.',
        shaker: 'x.X.x.X.x.X.x.X.',
        conga:  '..x.x..x..x.x..x',
        bell:   'x..x..x...x.x...',
      },
      bass:   { scale: MINOR_PENT, octave: -12, pattern: '0---.0.3.2--0.2.', vol: 0.27 },
      guitar: { pattern: '..4.4..5.4..2.4.', vol: 0.12, dur: 0.11 },
      keys:   { pattern: ['................', '............3-2-', '................', '....2-0-........'], stack: [3, 7], vol: 0.075 },
      horn:   { pattern: ['................', '......5-4-..2---', '................', '....5-..4-2-0---'], stack: [4, 7], vol: 0.14, octave: 12 },
    },

    // Stage 1-1 Oshodi: classic Afrobeat engine room - bell, shekere, choppy tenor guitar.
    eko: {
      bpm: 106, swing: 0.18, root: 45, bars: [0, 0, 5, 7], scale: MINOR_PENT,
      drums: {
        kick:   'X..x..X...x.....',
        snare:  '....X.......X..x',
        rim:    '..-.-..x.-..x.-.',
        shaker: 'x.X.x.X.x.X.x.X.',
        conga:  '..x.x..x.x..x.x.',
        bell:   'x..x..x...x.x...',
      },
      bass:   { scale: MINOR_PENT, octave: -12, pattern: '0...0.3.5...3.0.', vol: 0.28 },
      guitar: { pattern: '..4.4.2..4.2.0..', vol: 0.12, dur: 0.1 },
      keys:   { pattern: ['................', '................', '..2-..3-........', '..4-..3-..2-....'], stack: [3, 7], vol: 0.07 },
      horn:   { pattern: ['................', '............4-5-', '................', '............7-5-'], stack: [3, 7], vol: 0.13, octave: 12 },
    },

    // Stage 1-2 Balogun Market: brighter, faster highlife - palm-wine guitar and claps.
    balogun: {
      bpm: 118, swing: 0.16, root: 48, bars: [0, 5, 7, 5], scale: MAJOR_PENT,
      drums: {
        kick:   'X.....x.X.....x.',
        snare:  '....X.......X...',
        clap:   '....X.......X..X',
        rim:    '..x...x...x...x.',
        shaker: 'xXxXxXxXxXxXxXxX',
        conga:  'x..x.x..x..x.x.x',
        bell:   'x..x..x.x..x..x.',
      },
      bass:   { scale: MAJOR_PENT, octave: -12, pattern: '0.0.3...2.0.4...', vol: 0.27 },
      guitar: { pattern: '5.4.2.4.5.7.5.4.', vol: 0.125, dur: 0.09 },
      keys:   { pattern: ['....2-..........', '................', '....4-..2-......', '................'], stack: [4, 7], vol: 0.075 },
      horn:   { pattern: ['................', '..........7-5-4-', '................', '..........5-4-2-'], stack: [3, 7], vol: 0.125, octave: 12 },
    },

    // Stage 1-3 Third Mainland Bridge: modern Afrobeats - 3-3-2 kick and a log-drum bass.
    lagoon: {
      bpm: 104, swing: 0.1, root: 46, bars: [0, 0, 3, 5], scale: DORIAN,
      drums: {
        kick:   'X..X..X...X..X..',
        snare:  '........X.......',
        rim:    '....x.......x...',
        shaker: '..x...x...x...x.',
        conga:  '..............x.',
        clap:   '........X.......',
      },
      log:    { scale: DORIAN, octave: -12, pattern: 'X..X..X...X..X..', riff: '0..0..3...5..0..', vol: 0.34 },
      guitar: { pattern: '....5...4...5.7.', vol: 0.1, dur: 0.16, soft: true },
      keys:   { pattern: ['0-2-3-..........', '................', '3-2-0-..........', '................'], stack: [3, 7], vol: 0.08 },
      horn:   { pattern: ['................', '................', '................', '........7-5-3---'], stack: [4, 7], vol: 0.115, octave: 12 },
    },

    // Victory: everybody plays. Full horns, claps on the two and four, party tempo.
    odogwu: {
      bpm: 112, swing: 0.18, root: 48, bars: [0, 5, 3, 7], scale: MAJOR_PENT,
      drums: {
        kick:   'X..x..X...X.x...',
        snare:  '....X.......X..x',
        clap:   '....X.......X...',
        rim:    '..x.-..x..x.-.x.',
        shaker: 'xXxXxXxXxXxXxXxX',
        conga:  'x.x.x..x.x.x..x.',
        bell:   'x..x..x...x.x...',
      },
      bass:   { scale: MAJOR_PENT, octave: -12, pattern: '0.0.4.3.2.0.4.5.', vol: 0.28 },
      guitar: { pattern: '7.5.4.5.7.9.7.5.', vol: 0.125, dur: 0.09 },
      keys:   { pattern: '..4-..2-..4-..5-', stack: [4, 7], vol: 0.075 },
      horn:   { pattern: ['....7-5-4---....', '....5-4-2---....', '....4-5-7---....', '7-5-4-2-0-------'], stack: [4, 7], vol: 0.14, octave: 12 },
    },
  };

  const barsOf = (song) => song.bars.length;

  // Pattern for a given bar: one string repeats, an array gives a string per bar.
  const patternAt = (pattern, bar) => (Array.isArray(pattern) ? pattern[bar % pattern.length] : pattern);

  // Read step `i` of a pitched pattern. Returns null for rest/hold, else the scale index.
  function noteAt(pattern, bar, i) {
    const ch = patternAt(pattern, bar)[i];
    return ch >= '0' && ch <= '9' ? Number(ch) : null;
  }

  // How long a note lasts in steps: itself plus any '-' holds after it.
  function holdLength(pattern, bar, i) {
    const row = patternAt(pattern, bar);
    let n = 1;
    while (i + n < row.length && row[i + n] === '-') n++;
    return n;
  }

  const semitone = (scale, index) => scale[Math.min(index, scale.length - 1)];
  const freqOf = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

  return { SONGS, MINOR_PENT, MAJOR_PENT, DORIAN, barsOf, patternAt, noteAt, holdLength, semitone, freqOf };
});
