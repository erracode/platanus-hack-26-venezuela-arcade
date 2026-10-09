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

// Iso tile size (px) and vertical extrusions.
const TW = 44;
const TH = 22;
const SLAB_H = 14;
const HUT_STILT = 7;
const HUT_H = 8;
const TOWER_H = 64;
const DECK_H = 8;

// Grid directions. Stick → grid is a fixed 45° rotation (SPEC.md §1.1).
const DIRS = {
  N: { dx: 0, dy: -1 },
  E: { dx: 1, dy: 0 },
  S: { dx: 0, dy: 1 },
  W: { dx: -1, dy: 0 },
};
// Screen layout: N = up-left, E = up-right, S = down-right, W = down-left.
// Stick keeps the validated feel: up → up-right, right → down-right, etc.
const STICK_TO_DIR = { U: 'E', R: 'S', D: 'W', L: 'N' };

const P1_START = { x: 7, y: 15, facing: 'N' };
const CPU_START = { x: 6, y: 8, facing: 'S' };

// 0 water · 1 land · 2 bridge · 3 palafito · 4 Catatumbo · 5 scenery water (not walkable)
// 14 wide × 20 tall, north at the top (drawn top-left). Traced from the real lake outline with the
// gulf + strait compressed into scenery; the field is the bridge and everything south of it.
const LAGO_MAP = [
  [1, 1, 1, 1, 1, 5, 5, 5, 5, 5, 5, 5, 5, 5],
  [1, 1, 1, 1, 1, 5, 5, 5, 5, 5, 5, 5, 5, 5],
  [1, 1, 1, 1, 1, 5, 5, 5, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 5, 5, 5, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1],
  [1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1],
  [1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1],
  [1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1],
  [1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1],
  [1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1],
  [1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 1, 1],
  [1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1],
  [1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 1, 1],
  [1, 1, 1, 4, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1],
  [1, 1, 1, 4, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1],
  [1, 1, 1, 1, 4, 0, 0, 0, 0, 0, 0, 1, 1, 1],
  [1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
];
const ROWS = LAGO_MAP.length;
const COLS = LAGO_MAP[0].length;

// Out-of-bounds reads as land.
function tileAt(x, y) {
  return (LAGO_MAP[y] && LAGO_MAP[y][x]) ?? 1;
}

function isWalkable(x, y) {
  const t = tileAt(x, y);
  return t === 0 || t === 2 || t === 4;
}

// Lake = anything that is not land (palafitos stand in the water, scenery water included).
function isLake(x, y) {
  return tileAt(x, y) !== 1;
}

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

// Projection puts north (the strait) at the top-left and the lake body toward the viewer:
// +x (east) → screen up-right, +y (south) → screen down-right.
const ISO_OX = W / 2 - ((COLS + ROWS - 2) * TW) / 4;
const ISO_OY = H / 2 - ((ROWS - COLS) * TH) / 4 + 8;

// Grid cell → screen centre of its rhombus.
function toIso(x, y) {
  return { x: ISO_OX + ((x + y) * TW) / 2, y: ISO_OY + ((y - x) * TH) / 2 };
}

// Vertices in order: top, right, bottom, left.
function rhombus(cx, cy, hw, hh) {
  return [
    { x: cx, y: cy - hh },
    { x: cx + hw, y: cy },
    { x: cx, y: cy + hh },
    { x: cx - hw, y: cy },
  ];
}

function cellPts(x, y) {
  const c = toIso(x, y);
  return rhombus(c.x, c.y, TW / 2, TH / 2);
}

// Rhombus edge shared with the neighbour in each grid direction.
const EDGE = { N: [3, 0], E: [0, 1], S: [1, 2], W: [2, 3] };

// Extruded rhombus: dark faces occlude what is behind, wire edges on top.
function drawPrism(g, cx, cy, hw, hh, h, color) {
  const top = rhombus(cx, cy - h, hw, hh);
  const left = [top[3], top[2], { x: cx, y: cy + hh }, { x: cx - hw, y: cy }];
  const right = [top[2], top[1], { x: cx + hw, y: cy }, { x: cx, y: cy + hh }];
  for (const face of [left, right, top]) {
    g.fillStyle(COLORS.bg, 1);
    g.fillPoints(face, true);
    g.lineStyle(1.5, color, 0.9);
    g.strokePoints(face, true);
  }
}

// Front faces of the board slab: west column (down-left side) and south row (down-right side).
function drawSlab(g) {
  const edges = [];
  for (let y = 0; y < ROWS; y++) {
    const p = cellPts(0, y);
    edges.push([p[EDGE.W[0]], p[EDGE.W[1]]]);
  }
  for (let x = 0; x < COLS; x++) {
    const p = cellPts(x, ROWS - 1);
    edges.push([p[EDGE.S[0]], p[EDGE.S[1]]]);
  }
  for (const [a, b] of edges) {
    const quad = [a, b, { x: b.x, y: b.y + SLAB_H }, { x: a.x, y: a.y + SLAB_H }];
    g.fillStyle(COLORS.bg, 1);
    g.fillPoints(quad, true);
    g.lineStyle(1.5, COLORS.coast, 0.8);
    g.strokePoints(quad, true);
  }
}

function drawTiles(g) {
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const t = tileAt(x, y);
      const pts = cellPts(x, y);
      if (t === 1) {
        g.lineStyle(1, COLORS.coast, 0.4);
        g.strokePoints(pts, true);
        continue;
      }
      if (t === 5) {
        g.lineStyle(1, COLORS.p1, 0.2);
        g.strokePoints(pts, true);
        continue;
      }
      const color = t === 4 ? COLORS.bolt : COLORS.p1;
      g.fillStyle(color, 0.05);
      g.fillPoints(pts, true);
      g.lineStyle(1, color, 0.5);
      g.strokePoints(pts, true);
    }
  }
}

// Bright line wherever lake meets land.
function drawShore(g) {
  g.lineStyle(2, COLORS.coast, 1);
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (!isLake(x, y)) continue;
      const pts = cellPts(x, y);
      for (const [key, d] of Object.entries(DIRS)) {
        const nx = x + d.dx;
        const ny = y + d.dy;
        const inside = nx >= 0 && ny >= 0 && nx < COLS && ny < ROWS;
        if (!inside || isLake(nx, ny)) continue;
        const [i, j] = EDGE[key];
        g.lineBetween(pts[i].x, pts[i].y, pts[j].x, pts[j].y);
      }
    }
  }
}

function drawHut(g, cx, cy) {
  const hw = TW / 4;
  const hh = TH / 4;
  g.lineStyle(1.5, COLORS.coast, 0.9);
  for (const p of rhombus(cx, cy, hw, hh)) g.lineBetween(p.x, p.y, p.x, p.y - HUT_STILT);
  const base = cy - HUT_STILT;
  drawPrism(g, cx, base, hw, hh, HUT_H, COLORS.coast);
  const roof = rhombus(cx, base - HUT_H, hw, hh);
  const apex = { x: cx, y: base - HUT_H - hh * 2 };
  g.lineStyle(1.5, COLORS.coast, 0.9);
  for (const p of roof) g.lineBetween(p.x, p.y, apex.x, apex.y);
}

// Cable-stayed bridge (Rafael Urdaneta) across the strait, shore to shore.
function drawBridge(g) {
  const row = LAGO_MAP.findIndex((r) => r.includes(2));
  if (row < 0) return;
  const xs = [];
  LAGO_MAP[row].forEach((t, x) => t === 2 && xs.push(x));
  const a = toIso(xs[0] - 1, row);
  const b = toIso(xs[xs.length - 1] + 1, row);
  g.lineStyle(2, COLORS.white, 0.9);
  g.lineBetween(a.x, a.y - DECK_H, b.x, b.y - DECK_H);
  g.lineBetween(a.x, a.y - DECK_H + 3, b.x, b.y - DECK_H + 3);
  for (const x of xs) {
    const t = toIso(x, row);
    g.lineStyle(1.5, COLORS.white, 0.7);
    g.lineBetween(t.x, t.y, t.x, t.y - DECK_H);
  }
  for (const x of [xs[0], xs[xs.length - 1]]) {
    const t = toIso(x, row);
    const deckY = t.y - DECK_H;
    const topY = deckY - TOWER_H;
    g.lineStyle(2, COLORS.white, 1);
    g.lineBetween(t.x - 4, t.y, t.x, topY);
    g.lineBetween(t.x + 4, t.y, t.x, topY);
    g.lineStyle(1, COLORS.white, 0.55);
    for (let k = 1; k <= 4; k++) {
      // The deck runs along grid +x, i.e. screen (+2, -1): cables fan along that slope.
      const off = (k * TW) / 5;
      g.lineBetween(t.x, topY + 6, t.x - off, deckY + off / 2);
      g.lineBetween(t.x, topY + 6, t.x + off, deckY - off / 2);
    }
  }
}

// Static layer: drawn once.
function drawMap(g) {
  drawSlab(g);
  drawTiles(g);
  drawShore(g);
  drawBridge(g);
  const huts = [];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) if (tileAt(x, y) === 3) huts.push({ x, y });
  }
  // Back-to-front = ascending screen y.
  huts.sort((a, b) => a.y - a.x - (b.y - b.x));
  for (const h of huts) {
    const c = toIso(h.x, h.y);
    drawHut(g, c.x, c.y);
  }
}

function drawBackground(g) {
  g.fillStyle(COLORS.bg, 1);
  g.fillRect(0, 0, W, H);
  g.fillStyle(COLORS.band, 1);
  for (let i = -1; i < 4; i++) {
    const x = i * 260;
    g.fillPoints(
      [
        { x, y: H },
        { x: x + 120, y: H },
        { x: x + 420, y: 0 },
        { x: x + 300, y: 0 },
      ],
      true,
    );
  }
}

// Screen-space arrow showing which stick direction reaches a neighbour cell.
const STICK_ARROW = { U: [0, -1], R: [1, 0], D: [0, 1], L: [-1, 0] };

function drawArrow(g, cx, cy, stick, color) {
  const [ax, ay] = STICK_ARROW[stick];
  const s = 5;
  g.fillStyle(color, 0.9);
  g.fillTriangle(
    cx + ax * s,
    cy + ay * s,
    cx - ax * s + ay * s,
    cy - ay * s - ax * s,
    cx - ax * s - ay * s,
    cy - ay * s + ax * s,
  );
}

function drawCellMarker(g, x, y, color) {
  const pts = cellPts(x, y);
  g.fillStyle(color, 0.25);
  g.fillPoints(pts, true);
  g.lineStyle(2, color, 1);
  g.strokePoints(pts, true);
}

// Per-frame FX layer: Catatumbo flicker + start markers + P1 test cursor with stick arrows.
function drawFx(g, scene, time) {
  g.clear();
  const flicker = Math.random() < 0.06 ? 0.35 : 0.08 + 0.05 * Math.sin(time / 300);
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (tileAt(x, y) !== 4) continue;
      g.fillStyle(COLORS.bolt, flicker);
      g.fillPoints(cellPts(x, y), true);
    }
  }

  drawCellMarker(g, CPU_START.x, CPU_START.y, COLORS.cpu);
  const cur = scene.cursor;
  drawCellMarker(g, cur.x, cur.y, COLORS.p1);

  for (const [stick, dirKey] of Object.entries(STICK_TO_DIR)) {
    const d = DIRS[dirKey];
    if (!isWalkable(cur.x + d.dx, cur.y + d.dy)) continue;
    const n = toIso(cur.x + d.dx, cur.y + d.dy);
    drawArrow(g, n.x, n.y, stick, COLORS.white);
  }
}

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

  drawBackground(this.add.graphics());
  drawMap(this.add.graphics());
  this.gFx = this.add.graphics();

  this.cursor = { x: P1_START.x, y: P1_START.y };

  this.add.text(16, 14, 'CATATUMBO PROTOCOL', {
    fontFamily: 'monospace',
    fontSize: '20px',
    color: '#00ffff',
  });
  this.add.text(16, H - 28, 'P1 TEST: STICK MOVES THE CURSOR', {
    fontFamily: 'monospace',
    fontSize: '12px',
    color: '#ffffff',
  });
}

function update(time) {
  for (const [stick, dirKey] of Object.entries(STICK_TO_DIR)) {
    if (!consumePressed(this.controls, 'P1_' + stick)) continue;
    const d = DIRS[dirKey];
    const nx = this.cursor.x + d.dx;
    const ny = this.cursor.y + d.dy;
    if (isWalkable(nx, ny)) this.cursor = { x: nx, y: ny };
  }
  drawFx(this.gFx, this, time);
}
