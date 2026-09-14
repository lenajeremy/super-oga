/* SUPER OGA - keyboard, touch buttons and gamepad, mapped to game actions. */
'use strict';

const Input = {
  actions: ['left', 'right', 'up', 'down', 'jump', 'run', 'start', 'pause', 'mute', 'credits', 'cheat'],
  bindings: {
    ArrowLeft: ['left'], KeyA: ['left'],
    ArrowRight: ['right'], KeyD: ['right'],
    // Up is both jump and talk: the player code checks for somebody to talk to first,
    // so the game can be played one-handed on the arrow keys alone.
    ArrowUp: ['up', 'jump'], KeyW: ['up', 'jump'],
    ArrowDown: ['down'], KeyS: ['down'],
    Space: ['jump'], KeyZ: ['jump'], KeyK: ['jump'],
    KeyX: ['run'], KeyJ: ['run'], ShiftLeft: ['run'], ShiftRight: ['run'],
    Enter: ['start'], NumpadEnter: ['start'],
    Escape: ['pause'], KeyP: ['pause'],
    KeyM: ['mute'],
    KeyC: ['credits'],
    KeyI: ['cheat'],
  },
  down: {},
  pressed: {},
  prev: {},
  keys: new Set(),
  touches: new Map(),
  tapped: false,
  tap: false,
  tapPos: null,
  pendingTapPos: null,
  // Some keyboards and automation tools leave KeyboardEvent.code empty, so fall back to key.
  keyNames: {
    ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight', ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown',
    ' ': 'Space', Enter: 'Enter', Escape: 'Escape', Shift: 'ShiftLeft',
    a: 'KeyA', d: 'KeyD', w: 'KeyW', s: 'KeyS', z: 'KeyZ', x: 'KeyX', j: 'KeyJ', k: 'KeyK', p: 'KeyP', m: 'KeyM', c: 'KeyC', i: 'KeyI',
  },

  codeOf(e) {
    if (e.code) return e.code;
    const key = e.key && e.key.length === 1 ? e.key.toLowerCase() : e.key;
    return this.keyNames[key] || '';
  },

  init(onGesture) {
    addEventListener('keydown', (e) => {
      const code = this.codeOf(e);
      if (this.bindings[code]) {
        e.preventDefault();
        this.keys.add(code);
      }
      onGesture();
    });
    addEventListener('keyup', (e) => this.keys.delete(this.codeOf(e)));
    addEventListener('blur', () => this.reset());

    for (const el of document.querySelectorAll('[data-action]')) {
      const action = el.dataset.action;
      const ids = new Set();
      this.touches.set(action, ids);
      const release = (e) => {
        ids.delete(e.pointerId);
        el.classList.toggle('on', ids.size > 0);
      };
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        ids.add(e.pointerId);
        el.classList.add('on');
        onGesture();
      });
      for (const type of ['pointerup', 'pointercancel', 'pointerleave']) el.addEventListener(type, release);
    }

    // Taps on the canvas are also a "confirm", and dialogue choices can be tapped
    // directly, so remember where the tap landed in 400x224 game coordinates.
    addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') document.body.classList.add('touch-on');
      this.tapped = true;
      const canvas = document.getElementById('game');
      const box = canvas && canvas.getBoundingClientRect();
      this.pendingTapPos = box && box.width
        ? { x: ((e.clientX - box.left) / box.width) * VIEW_W, y: ((e.clientY - box.top) / box.height) * VIEW_H }
        : null;
      onGesture();
    });
  },

  reset() {
    this.keys.clear();
    for (const ids of this.touches.values()) ids.clear();
    for (const el of document.querySelectorAll('[data-action]')) el.classList.remove('on');
  },

  update() {
    const now = {};
    for (const code of this.keys) for (const action of this.bindings[code] || []) now[action] = true;
    for (const [action, ids] of this.touches) if (ids.size) now[action] = true;
    this.pollGamepads(now);
    for (const action of this.actions) {
      this.pressed[action] = !!now[action] && !this.prev[action];
      this.down[action] = !!now[action];
      this.prev[action] = !!now[action];
    }
    this.tap = this.tapped;
    this.tapPos = this.tapped ? this.pendingTapPos : null;
    this.tapped = false;
  },

  pollGamepads(now) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const pad of pads) {
      if (!pad) continue;
      const held = (i) => pad.buttons[i] && pad.buttons[i].pressed;
      const [ax = 0, ay = 0] = pad.axes;
      if (ax < -0.4 || held(14)) now.left = true;
      if (ax > 0.4 || held(15)) now.right = true;
      if (ay > 0.5 || held(13)) now.down = true;
      if (held(12)) now.up = true;
      if (held(0) || held(3)) now.jump = true;
      if (held(1) || held(2)) now.run = true;
      if (held(9)) now.start = true;
      if (held(8)) now.pause = true;
    }
  },

  // Any "go" input: Enter, jump, or a tap/click.
  confirm() {
    return this.pressed.start || this.pressed.jump || this.tap;
  },
};
