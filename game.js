// Mecha Simultactics: Catatumbo Protocol — Platanus Hack 26 Arcade Challenge
// Simultaneous-turn mecha duel vs CPU over Lake Maracaibo. See SPEC.md / ROADMAP.md.

// == CONSTANTS ==

const W = 800;
const H = 600;

const COLORS = {
  bg: 0x05060a,
  band: 0x0b0d14,
  p1: 0x00ffff,
  cpu: 0xff0055,
  coast: 0x00ff88,
  bolt: 0xffff00,
  white: 0xffffff,
};

// 0 water · 1 outside/void · 2 bridge · 3 palafito · 4 Catatumbo
// 9 wide × 11 tall, north at the top. Shape = Lake Maracaibo silhouette.
const LAGO_MAP = [
  [1, 1, 1, 1, 2, 2, 1, 1, 1],
  [1, 1, 1, 0, 0, 0, 0, 1, 1],
  [1, 1, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 3],
  [1, 0, 0, 0, 0, 0, 0, 0, 3],
  [0, 0, 0, 0, 0, 0, 0, 0, 1],
  [0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 4, 0, 0, 0, 0, 0, 0, 1],
  [1, 1, 0, 0, 0, 0, 0, 0, 1],
  [1, 1, 1, 0, 0, 0, 1, 1, 1],
];

// == INPUT ==

// DO NOT replace existing keys — they match the physical arcade cabinet wiring.
// To add local testing shortcuts, append extra keys to any array.
const CABINET_KEYS = {
  P1_U: ['w'],
  P1_D: ['s'],
  P1_L: ['a'],
  P1_R: ['d'],
  P1_1: ['u'],
  P1_2: ['i'],
  P1_3: ['o'],
  P1_4: ['j'],
  P1_5: ['k'],
  P1_6: ['l'],
  P2_U: ['ArrowUp'],
  P2_D: ['ArrowDown'],
  P2_L: ['ArrowLeft'],
  P2_R: ['ArrowRight'],
  P2_1: ['r'],
  P2_2: ['t'],
  P2_3: ['y'],
  P2_4: ['f'],
  P2_5: ['g'],
  P2_6: ['h'],
  START1: ['Enter'],
  START2: ['2'],
};

const KEYBOARD_TO_ARCADE = {};
for (const [arcadeCode, keys] of Object.entries(CABINET_KEYS)) {
  for (const key of keys) {
    KEYBOARD_TO_ARCADE[normalizeIncomingKey(key)] = arcadeCode;
  }
}

function normalizeIncomingKey(key) {
  if (typeof key !== 'string' || key.length === 0) return '';
  if (key === ' ') return 'space';
  return key.toLowerCase();
}

// held[code] = currently down; pressed[code] = went down since last consume (edge).
function createControls(scene) {
  const controls = { held: Object.create(null), pressed: Object.create(null) };

  const onKeyDown = (event) => {
    const code = KEYBOARD_TO_ARCADE[normalizeIncomingKey(event.key)];
    if (!code) return;
    if (!controls.held[code]) controls.pressed[code] = true;
    controls.held[code] = true;
  };
  const onKeyUp = (event) => {
    const code = KEYBOARD_TO_ARCADE[normalizeIncomingKey(event.key)];
    if (code) controls.held[code] = false;
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  scene.events.once('shutdown', () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
  });

  return controls;
}

function consumePressed(controls, code) {
  if (!controls.pressed[code]) return false;
  controls.pressed[code] = false;
  return true;
}

// == RULES ==
// Pure functions only (no Phaser): resolveTurn(state, planP1, planCpu) -> events[]. (P3)

// == CONTROLLERS ==
// humanController('P1'), cpuController(state). (P2 / P5)

// == RENDER ==
// Iso projection, map, mecha, ghost, threat tiles, HUD, radial, clash prompt. (P1 / P2)

// == AUDIO ==
// Web Audio synth: oscillators + noise. (P6)

// == SCENE ==

const config = {
  type: Phaser.AUTO,
  width: W,
  height: H,
  parent: 'game-root',
  backgroundColor: '#05060a',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: { create, update },
};

new Phaser.Game(config);

function create() {
  this.controls = createControls(this);

  this.add
    .text(W / 2, H / 2 - 20, 'CATATUMBO PROTOCOL', {
      fontFamily: 'monospace',
      fontSize: '32px',
      color: '#00ffff',
    })
    .setOrigin(0.5);

  this.prompt = this.add
    .text(W / 2, H / 2 + 30, 'PRESS START', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#ffffff',
    })
    .setOrigin(0.5);
}

function update() {
  if (consumePressed(this.controls, 'START1')) {
    this.prompt.setText('START OK');
  }
}
