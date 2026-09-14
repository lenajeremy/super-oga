/* SUPER OGA - the story, the cast, and every conversation you can have on the road. */
'use strict';

const NAIRA_PER_COIN = 20;

const PEOPLE_IDS = ['suya', 'mamaput', 'nurse', 'water', 'okadaman', 'kekeman', 'conductor', 'mum', 'tailor', 'bride'];
const CAST = {
  tunde: { name: 'OGA TUNDE', sheet: 'hero', idle: 's_idle', talk: 's_idle' },
  agbero: { name: 'AGBERO SCATTER', sheet: 'enemies', idle: 'agbero_walk1', talk: 'agbero_walk2' },
};
const CAST_NAMES = {
  suya: 'MALLAM SULE', mamaput: 'MAMA NKECHI', nurse: 'NURSE BISI', water: 'IYA SIKIRAT', okadaman: 'BROS EMMY',
  kekeman: 'ALHAJI MUSA', conductor: 'DANLADI', mum: 'IYA RONKE', tailor: 'TAILOR KUNLE', bride: 'RONKE',
};
for (const id of PEOPLE_IDS) CAST[id] = { name: CAST_NAMES[id], sheet: 'people', idle: `${id}_1`, talk: `${id}_talk` };

// What the floating prompt says when you can press up next to someone.
const PROMPTS = {
  suya: 'BUY SUYA', mamaput: 'CHOP', nurse: 'CLINIC', water: 'BUY WATER', okadaman: 'HIRE OKADA',
  kekeman: 'HIRE KEKE', conductor: 'TALK', agbero: 'TALK', mum: 'TALK', tailor: 'TALK', bride: 'TALK',
};

// What people shout as you come near. `vowels` drives the formant voice in src/audio.js -
// the words are carried by the text; the sound just has to read as somebody hawking.
const CALLS = {
  suya: { text: 'SUYA! COME BUY SUYA!', vowels: 'ua-o-ai-ua', pitch: 118 },
  mamaput: { text: 'COME CHOP! FOOD DEY HOT!', vowels: 'o-o-u-ei', pitch: 190 },
  water: { text: 'PURE WATER! COLD PURE WATER O!', vowels: 'ua-ea-o-ua', pitch: 205 },
  nurse: { text: 'CLINIC DEY OPEN!', vowels: 'ii-e-oe', pitch: 198 },
  okadaman: { text: 'OKADA! WHERE YOU DEY GO?', vowels: 'oaa-e-ou-o', pitch: 128 },
  kekeman: { text: 'KEKE MARUWA! ENTER!', vowels: 'ee-aa-ee', pitch: 124 },
  conductor: { text: 'ENTER WITH YOUR CHANGE!', vowels: 'ee-i-o-ae', pitch: 132 },
};

const PROLOGUE = [
  'NA SATURDAY FOR EKO.',
  'OGA TUNDE COUSIN, RONKE, DEY MARRY TODAY FOR LAGOS ISLAND.',
  'TUNDE PROMISE TO BRING THE FAMILY ASO-EBI... BUT HIM MOTOR DON KNOCK FOR OSHODI.',
  'NO SHAKING. WITH HIM BEST AGBADA AND SMALL CHANGE FOR POCKET, TUNDE GO HUSTLE AM.',
  'WAKA, OKADA, KEKE, ANYHOW! OYA, HELP AM REACH THE OWAMBE BEFORE DEM CUT CAKE!',
];

const CONDUCTOR_CALLS = [
  'OSHODI! OSHODI! ENTER WITH YOUR CHANGE O!',
  'BALOGUN! BALOGUN! NO STANDING, NO STORY!',
  'CMS! OBALENDE! ENTER, E REMAIN ONE PERSON!',
];

// Things a conversation can do. Returning a node name sends the conversation there.
const EFFECTS = {
  grow({ player, game }) {
    if (player.form === 'small') {
      player.setForm('big');
      player.freeze = 24;
      Sound.play('grow');
    } else {
      game.addScore(500);
      Sound.play('power');
    }
  },
  heal(ctx) {
    EFFECTS.grow(ctx);
    ctx.player.invuln = 90;
  },
  water({ player }) {
    player.setForm('water');
    player.freeze = 24;
    Sound.play('power');
  },
  odogwu({ player }) {
    player.odogwu = 600;
    Sound.play('power');
    Sound.setSpeed(1.2);
  },
  life({ game }) {
    game.addLife();
  },
  hire({ npc, player }) {
    if (!npc.ride) return;
    npc.ride.paid = true;
    player.mount(npc.ride);
  },
  settle({ npc, game }) {
    npc.makePeace();
    game.addScore(100);
  },
  anger({ npc }) {
    npc.makeAngry();
  },
  beg({ npc }) {
    if (Math.random() < 0.5) {
      npc.makePeace();
      return 'begOk';
    }
    npc.makeAngry();
    return 'begNo';
  },
  reward({ game }) {
    game.earn(LEVELS[game.levelIndex].reward || 0);
  },
};

function rideScript(ride, price, deal, pitch, haggleLine, hiredLine) {
  return ({ npc }) =>
    npc.ride && npc.ride.paid
      ? { start: `THE ${ride} NA YOUR OWN TODAY. STAND BESIDE AM, PRESS ↑ TO CLIMB.` }
      : {
          start: {
            text: pitch,
            choices: [
              { label: `HIRE ${ride} - ₦${price}`, pay: price, effect: 'hire', next: 'hired' },
              { label: 'ABEG REDUCE AM', next: 'haggle' },
              { label: 'I GO WAKA', next: 'bye' },
            ],
          },
          haggle: {
            text: haggleLine,
            choices: [
              { label: `OK, ₦${deal}`, pay: deal, effect: 'hire', next: 'hired' },
              { label: 'E STILL COST', next: 'bye' },
            ],
          },
          hired: hiredLine,
          bye: 'WAKA DEY TIRE PERSON O. I DEY HERE IF YOU CHANGE MIND.',
          broke: `NO MONEY? ${ride} NO BE CHARITY WORK.`,
        };
}

const SCRIPTS = {
  suya: () => ({
    start: {
      text: 'SANNU OGA! FRESH SUYA DEY HERE, HOT HOT, YAJI PLENTY.',
      choices: [
        { label: 'SUYA - ₦200 (BIG OGA POWER)', pay: 200, effect: 'grow', next: 'ate' },
        { label: 'EXTRA YAJI - ₦400 (ODOGWU MODE)', pay: 400, effect: 'odogwu', next: 'spicy' },
        { label: 'I NO WAN BUY', next: 'bye' },
      ],
    },
    ate: 'CHOP AM WELL. YOUR BODY GO STRONG LIKE IRON ROD!',
    spicy: 'THAT YAJI GO MAKE YOU RUN LIKE OKADA. NOBODY FIT TOUCH YOU NOW!',
    bye: 'NO WAHALA. SUYA GO DEY HERE WHEN YOU COME BACK.',
    broke: 'OGA, NO MONEY NO SUYA. GO GATHER COINS COME.',
  }),

  mamaput: () => ({
    start: {
      text: 'MY PIKIN, YOU DON CHOP? JOLLOF DEY, DODO DEY, PUFF-PUFF DEY.',
      choices: [
        { label: 'JOLLOF & DODO - ₦300 (BIG OGA)', pay: 300, effect: 'grow', next: 'ate' },
        { label: 'PUFF-PUFF - ₦600 (+1 LIFE)', pay: 600, effect: 'life', next: 'puff' },
        { label: 'I DON CHOP, THANK YOU MA', next: 'bye' },
      ],
    },
    ate: 'NA PARTY JOLLOF BE THAT O. GO WELL, GREET RONKE FOR ME!',
    puff: 'THAT PUFF-PUFF GO GIVE YOU EXTRA LIFE. NO TELL ANYBODY!',
    bye: 'OK O. NO FORGET TO CHOP BEFORE DEM FINISH THE FOOD FOR OWAMBE.',
    broke: 'HMM. MAMA PUT NO DEY GIVE CREDIT, MY PIKIN.',
  }),

  nurse: () => ({
    start: {
      text: 'WELCOME TO OUR CLINIC. WETIN DEY WORRY YOU?',
      choices: [
        { label: 'CHECK-UP - ₦200 (BIG OGA AGAIN)', pay: 200, effect: 'heal', next: 'healed' },
        { label: 'FULL TREATMENT - ₦600 (+1 LIFE)', pay: 600, effect: 'life', next: 'treated' },
        { label: 'I DEY KAMPE', next: 'bye' },
      ],
    },
    healed: 'YOU DON STRONG AGAIN. TAKE AM EASY FOR ROAD.',
    treated: 'DOCTOR SAY YOU GET EXTRA LIFE NOW. NO DEY JUMP ENTER GUTTER!',
    bye: 'OK. IF WAHALA CATCH YOU, COME BACK.',
    broke: 'THIS NA PRIVATE CLINIC O. NO MONEY, NO CARD.',
  }),

  water: () => ({
    start: {
      text: 'PURE WATER! COLD PURE WATER! E GO COOL YOUR BODY.',
      choices: [
        { label: 'PURE WATER - ₦100 (SACHET POWER)', pay: 100, effect: 'water', next: 'bought' },
        { label: 'NO, THANK YOU MA', next: 'bye' },
      ],
    },
    bought: 'DRINK SMALL, THROW THE REST FOR WAHALA. PRESS RUN (X) TO THROW AM!',
    bye: 'SUN DEY HOT O. YOU GO COME BACK.',
    broke: 'EVEN PURE WATER NA MONEY, MY BROTHER.',
  }),

  okadaman: rideScript('OKADA', 200, 150, 'OGA, WHERE YOU DEY GO? MY OKADA FAST PASS DANFO!', 'OYA ₦150, LAST PRICE. NA BECAUSE OF YOUR FINE AGBADA.', 'HOLD BODY O! PRESS ↓ TO COMOT. NO CRASH MY MACHINE!'),

  kekeman: rideScript('KEKE', 300, 240, 'KEKE MARUWA DEY! E NO FAST LIKE OKADA, BUT E STRONG LIKE TANK.', 'ALRIGHT, ₦240. MY PIKIN SCHOOL FEES DEY WAIT.', 'KEKE GO CLEAR ROAD FOR YOU. PRESS ↓ TO COMOT.'),

  conductor: ({ game }) => ({
    start: { text: CONDUCTOR_CALLS[game.levelIndex] || CONDUCTOR_CALLS[0], next: 'save' },
    save: { text: 'THIS BUS STOP DON SAVE YOUR PROGRESS. IF WAHALA HAPPEN, YOU GO START FROM HERE.', next: 'tip' },
    tip: 'IF AGBERO STOP YOU, SETTLE AM OR BEG AM. NO FIGHT AM IF YOU NO GET STRENGTH.',
  }),

  agbero: ({ player }) => ({
    start: {
      text: player.vehicle
        ? `OGA! ${player.vehicle.kind === 'keke' ? 'KEKE' : 'OKADA'} MUST PAY TICKET. UNION LEVY NA ₦100!`
        : 'OGA! STOP THERE! WHERE YOUR TICKET? UNION LEVY NA ₦100.',
      choices: [
        { label: 'SETTLE AM - ₦100', pay: 100, effect: 'settle', next: 'settled' },
        { label: 'ABEG, NA WEDDING I DEY GO', effect: 'beg' },
        { label: 'I NO DEY PAY ANYTHING', effect: 'anger', next: 'angry' },
      ],
    },
    settled: 'OGA NA BOSS! PASS. GOD GO BLESS YOUR POCKET.',
    begOk: 'WEDDING? AH, CONGRATS TO UNA! OYA PASS... BUT BRING JOLLOF COME FOR ME.',
    begNo: 'WEDDING NA YOUR PROBLEM! OYA COME COLLECT!',
    angry: 'YOU DEY WHINE ME? OYA COME!',
    broke: { text: 'YOU NO GET ₦100?! YOU DEY WHINE ME? COME HERE!', effect: 'anger' },
  }),

  mum: () => ({
    start: { text: 'TUNDE! YOU DON REACH? THANK GOD. MOTOR DON SPOIL AGAIN, ABI?', next: 'b' },
    b: { text: 'THE ASO-EBI DEY WITH TAILOR KUNLE FOR BALOGUN MARKET. GO COLLECT AM SHARP SHARP.', next: 'c' },
    c: { text: 'TAKE THIS ₦200 FOR TRANSPORT. NO SPEND AM ALL FOR SUYA O!', effect: 'reward' },
  }),

  tailor: () => ({
    start: { text: 'OGA TUNDE! YOUR ASO-EBI DON READY. TWENTY-FIVE PIECES, SEW WELL WELL.', next: 'b' },
    b: { text: 'BUT THE WEDDING DEY LAGOS ISLAND. YOU GO CROSS 3RD MAINLAND BRIDGE.', next: 'c' },
    c: { text: 'OKADA DEY FLY FOR THAT BRIDGE, SHINE YOUR EYE! TAKE ₦200 CHANGE FOR ROAD.', effect: 'reward' },
  }),

  bride: () => ({
    start: { text: 'BROTHER TUNDE!!! YOU REACH! AND YOU BRING THE ASO-EBI!', next: 'b' },
    b: { text: 'EVERYBODY DON WEAR AM. WE DON CUT CAKE... BUT WE KEEP YOUR OWN PIECE.', next: 'c' },
    c: 'OYA COME, MAKE WE DANCE! YOU BE ODOGWU!',
  }),
};

// A conversation box with a portrait, typewriter text and (sometimes) choices.
class Dialog {
  constructor(kind, ctx, onClose) {
    this.kind = kind;
    this.ctx = ctx;
    this.onClose = onClose;
    this.closed = false;
    this.script = SCRIPTS[kind](ctx);
    this.show('start');
  }

  show(key) {
    const raw = key && this.script[key];
    if (!raw) {
      this.closed = true;
      if (this.onClose) this.onClose();
      return;
    }
    this.node = typeof raw === 'string' ? { text: raw } : raw;
    this.speaker = CAST[this.node.who || this.kind];
    this.lines = wrapText(this.node.text, 300);
    this.length = this.lines.reduce((n, line) => n + line.length, 0);
    this.shown = 0;
    this.selected = 0;
    this.t = 0;
    if (this.node.effect) EFFECTS[this.node.effect](this.ctx);
  }

  get typing() {
    return this.shown < this.length;
  }

  choiceTop(i) {
    return 150 + this.lines.length * 10 + i * 10;
  }

  update() {
    this.t++;
    // One-handed: up and down pick an option, right confirms it, and up alone advances
    // plain text where there is nothing to pick. Enter and the jump key work throughout.
    const choosing = !!this.node.choices;
    const confirm =
      Input.pressed.start ||
      Input.tap ||
      Input.pressed.right ||
      (Input.pressed.jump && !Input.pressed.up) ||
      (Input.pressed.up && !choosing);
    if (this.typing) {
      this.shown = confirm ? this.length : this.shown + 1;
      if (this.t % 3 === 0) Sound.play('blip');
      return;
    }
    const choices = this.node.choices;
    if (!choices) {
      if (confirm && this.t > 6) this.show(this.node.next);
      return;
    }
    const move = (Input.pressed.down ? 1 : 0) - (Input.pressed.up ? 1 : 0);
    if (move) {
      this.selected = (this.selected + move + choices.length) % choices.length;
      Sound.play('select');
      return;
    }
    if (Input.tap && Input.tapPos) {
      const i = choices.findIndex((_, n) => Input.tapPos.y >= this.choiceTop(n) - 2 && Input.tapPos.y < this.choiceTop(n) + 8);
      if (i >= 0) this.choose(choices[i]);
      return;
    }
    if (confirm && this.t > 6) this.choose(choices[this.selected]);
  }

  choose(choice) {
    const { game } = this.ctx;
    if (choice.pay) {
      if (game.naira < choice.pay) {
        Sound.play('bump');
        this.show(this.script.broke ? 'broke' : null);
        return;
      }
      game.spend(choice.pay);
    }
    let next = choice.next;
    if (choice.effect) {
      const redirect = EFFECTS[choice.effect](this.ctx);
      if (typeof redirect === 'string') next = redirect;
    }
    this.show(next);
  }

  draw(ctx) {
    const top = 128;
    ctx.fillStyle = 'rgba(26, 20, 35, 0.94)';
    ctx.fillRect(6, top, VIEW_W - 12, VIEW_H - top - 4);
    ctx.fillStyle = '#ffcd3a';
    ctx.fillRect(6, top, VIEW_W - 12, 1);
    ctx.fillRect(6, VIEW_H - 5, VIEW_W - 12, 1);
    ctx.fillRect(6, top, 1, VIEW_H - top - 4);
    ctx.fillRect(VIEW_W - 7, top, 1, VIEW_H - top - 4);

    ctx.fillStyle = '#3a3142';
    ctx.fillRect(12, top + 8, 52, 68);
    const { sheet, idle, talk, name } = this.speaker;
    const [fx, fy] = Assets.frame(sheet, this.typing && (this.t >> 3) % 2 ? talk : idle);
    ctx.drawImage(Assets.sheets[sheet].canvas, fx, fy, 16, 21, 14, top + 11, 48, 63);

    drawText(ctx, name, 72, top + 7, { color: '#ffcd3a' });
    let budget = this.shown;
    this.lines.forEach((line, i) => {
      drawText(ctx, line.slice(0, Math.max(0, budget)), 72, top + 19 + i * 10);
      budget -= line.length;
    });
    if (this.typing) return;
    const blink = (this.t >> 4) % 2 === 0;
    if (!this.node.choices) {
      if (blink) drawText(ctx, '>>', VIEW_W - 16, VIEW_H - 18, { align: 'right', color: '#ffcd3a' });
      return;
    }
    this.node.choices.forEach((choice, i) => {
      const y = this.choiceTop(i);
      const selected = i === this.selected;
      const tooDear = choice.pay && this.ctx.game.naira < choice.pay;
      if (selected && blink) drawText(ctx, '>', 72, y, { color: '#ffcd3a' });
      drawText(ctx, choice.label, 82, y, { color: selected ? '#ffcd3a' : tooDear ? '#6b6275' : '#f8f4ea' });
    });
  }
}
