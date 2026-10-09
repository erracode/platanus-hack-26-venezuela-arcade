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
const DIR_KEYS = ['N', 'E', 'S', 'W'];
const OPPOSITE = { N: 'S', S: 'N', E: 'W', W: 'E' };

// Combat tuning (ROADMAP.md §4).
const HP_MAX = 100;
const SLASH_DMG = 25;
const BACK_MULT = 1.5;
const ENERGY_MAX = 3;
const CHARGED_MULT = 1.5; // a full energy bar makes the next SLASH charged (and empties it)

// Timing (ms).
const TURN_MS = 10000;
const CLASH_MS = 4000;
const STEP_MS = 280;
const HIT_PAUSE_MS = 550;
const CLASH_PAUSE_MS = 750;
const STUN_SHOW_MS = 900;
const ATTRACT_TURN_MS = 700;
const ATTRACT_OVER_MS = 2500;
const OVER_IDLE_MS = 20000;

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

  // Losing focus while a key is held would leave it stuck down (no keyup ever arrives).
  const onBlur = () => {
    for (const k in controls.held) controls.held[k] = false;
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  scene.events.once('shutdown', () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
  });

  return controls;
}

function consumePressed(controls, code) {
  if (!controls.pressed[code]) return false;
  controls.pressed[code] = false;
  return true;
}

// == RULES ==
// Pure functions only (no Phaser). A plan is { move: 'hold'|'move'|'pivot', dir, act: 'none'|'slash'|'parry' }.
// resolveTurn(state, plans) -> { state, events, clash }. Order follows ROADMAP.md §5.

const HOLD_PLAN = { move: 'hold', dir: 'N', act: 'none' };
const BEATS = { parry: 'thrust', feint: 'parry', thrust: 'feint' };
const CLASH_PICKS = ['thrust', 'parry', 'feint'];

function newUnit(start) {
  return { x: start.x, y: start.y, facing: start.facing, hp: HP_MAX, energy: 0, stunned: 0 };
}

function newState() {
  return { units: [newUnit(P1_START), newUnit(CPU_START)], turn: 1, over: null };
}

function cloneState(s) {
  return JSON.parse(JSON.stringify(s));
}

function step(p, dir) {
  const d = DIRS[dir];
  return { x: p.x + d.dx, y: p.y + d.dy };
}

function same(a, b) {
  return a.x === b.x && a.y === b.y;
}

function frontOf(u) {
  return step(u, u.facing);
}

function backOf(u) {
  return step(u, OPPOSITE[u.facing]);
}

function dist(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

// Direction from a to an orthogonally adjacent b, or null.
function dirBetween(a, b) {
  return DIR_KEYS.find((k) => same(step(a, k), b)) || null;
}

// Where a plan would leave a unit if nothing blocked it (used for the ghost preview).
function previewPlan(u, plan) {
  const facing = plan.move === 'hold' ? u.facing : plan.dir;
  let pos = { x: u.x, y: u.y };
  if (plan.move === 'move') {
    const to = step(u, plan.dir);
    if (isWalkable(to.x, to.y)) pos = to;
  }
  return { x: pos.x, y: pos.y, facing };
}

function resolveTurn(state, plans) {
  const s = cloneState(state);
  const [a, b] = s.units;
  const events = [];
  const p = plans.map((plan, i) => (s.units[i].stunned ? HOLD_PLAN : plan));

  // 1. Facing (set even if the move ends up blocked).
  s.units.forEach((u, i) => {
    if (p[i].move !== 'hold') {
      u.facing = p[i].dir;
      events.push({ t: 'face', who: i, facing: u.facing });
    }
  });

  // 2. Movement: non-walkable, same destination, swap and moving into a standing unit all block.
  const dest = s.units.map((u, i) => (p[i].move === 'move' ? step(u, p[i].dir) : { x: u.x, y: u.y }));
  const blocked = s.units.map((u, i) => p[i].move === 'move' && !isWalkable(dest[i].x, dest[i].y));
  const moving = (i) => p[i].move === 'move' && !blocked[i];
  if (moving(0) && moving(1)) {
    if (same(dest[0], dest[1]) || (same(dest[0], b) && same(dest[1], a))) blocked[0] = blocked[1] = true;
  }
  for (const i of [0, 1]) {
    const other = s.units[1 - i];
    if (moving(i) && !moving(1 - i) && same(dest[i], other)) blocked[i] = true;
  }
  s.units.forEach((u, i) => {
    if (p[i].move !== 'move') return;
    if (blocked[i]) {
      events.push({ t: 'bump', who: i, x: dest[i].x, y: dest[i].y });
    } else {
      u.x = dest[i].x;
      u.y = dest[i].y;
      events.push({ t: 'move', who: i, x: u.x, y: u.y });
    }
  });

  // 3. Clash: both slash while face to face.
  const clash = p[0].act === 'slash' && p[1].act === 'slash' && same(frontOf(a), b) && same(frontOf(b), a);
  if (clash) {
    events.push({ t: 'clash' });
  } else {
    // 4. Slashes, evaluated on post-move positions and applied simultaneously.
    const damage = [0, 0];
    s.units.forEach((u, i) => {
      if (p[i].act !== 'slash') return;
      const charged = u.energy >= ENERGY_MAX;
      if (charged) u.energy = 0;
      const target = frontOf(u);
      const foe = s.units[1 - i];
      events.push({ t: 'slash', who: i, x: target.x, y: target.y, charged });
      if (!same(target, foe)) return;
      if (p[1 - i].act === 'parry' && same(frontOf(foe), u)) {
        foe.energy = Math.min(ENERGY_MAX, foe.energy + 1);
        events.push({ t: 'parry', who: 1 - i });
        return;
      }
      const back = same(backOf(foe), u);
      const dmg = Math.round(SLASH_DMG * (back ? BACK_MULT : 1) * (charged ? CHARGED_MULT : 1));
      damage[1 - i] += dmg;
      events.push({ t: 'hit', who: 1 - i, dmg, back, charged });
    });
    s.units.forEach((u, i) => (u.hp = Math.max(0, u.hp - damage[i])));
  }

  // 5. Stun lasts exactly one turn.
  s.units.forEach((u) => (u.stunned = 0));
  if (!clash) finishTurn(s);
  return { state: s, events, clash };
}

// Face-to-face slash vs slash → rock-paper-scissors (ROADMAP.md §6).
function resolveClash(state, picks) {
  const s = cloneState(state);
  const events = [];
  const [pa, pb] = picks;
  if (pa === pb) {
    events.push({ t: 'mirror', picks });
    s.units.forEach((u, i) => {
      const to = step(u, OPPOSITE[u.facing]);
      const other = s.units[1 - i];
      if (isWalkable(to.x, to.y) && !same(to, other)) {
        u.x = to.x;
        u.y = to.y;
        events.push({ t: 'knock', who: i, x: u.x, y: u.y });
      }
    });
  } else {
    const winner = BEATS[pa] === pb ? 0 : 1;
    const loser = s.units[1 - winner];
    loser.hp = Math.max(0, loser.hp - SLASH_DMG);
    loser.stunned = 1;
    events.push({ t: 'clashWin', who: winner, picks });
    events.push({ t: 'hit', who: 1 - winner, dmg: SLASH_DMG, back: false, charged: false });
  }
  finishTurn(s);
  return { state: s, events };
}

function finishTurn(s) {
  const [a, b] = s.units;
  if (a.hp <= 0 && b.hp <= 0) s.over = 'draw';
  else if (a.hp <= 0) s.over = 'cpu';
  else if (b.hp <= 0) s.over = 'p1';
  s.turn++;
}

// == CONTROLLERS ==
// The CPU only sees the state, never the opponent's plan.

function cpuPlan(s, i, rnd = Math.random) {
  const me = s.units[i];
  const foe = s.units[1 - i];
  if (me.stunned) return HOLD_PLAN;

  if (dist(me, foe) === 1) {
    const toFoe = dirBetween(me, foe);
    const foeFacesMe = same(frontOf(foe), me);
    const r = rnd();
    if (foeFacesMe && r < 0.35) return { move: 'pivot', dir: toFoe, act: 'parry' };
    if (foeFacesMe && r > 0.85) {
      const sides = DIR_KEYS.filter((k) => k !== toFoe && k !== OPPOSITE[toFoe]).filter((k) => {
        const t = step(me, k);
        return isWalkable(t.x, t.y);
      });
      if (sides.length) return { move: 'move', dir: sides[Math.floor(rnd() * sides.length)], act: 'none' };
    }
    return { move: 'pivot', dir: toFoe, act: 'slash' };
  }

  // Two cells apart in a line: both stepping in would bump forever, so mix the real options —
  // zone (slash the middle cell, it hits whoever walks in), step in, flank, or parry.
  const line = DIR_KEYS.find((k) => same(step(step(me, k), k), foe));
  if (line) {
    const r = rnd();
    if (r < 0.35) return { move: 'pivot', dir: line, act: 'slash' };
    if (r < 0.6) return { move: 'move', dir: line, act: 'slash' };
    if (r < 0.85) {
      const sides = [OPPOSITE[line] === 'N' || OPPOSITE[line] === 'S' ? 'E' : 'N'];
      sides.push(OPPOSITE[sides[0]]);
      const ok = sides.filter((k) => {
        const t = step(me, k);
        return isWalkable(t.x, t.y);
      });
      if (ok.length) return { move: 'move', dir: ok[Math.floor(rnd() * ok.length)], act: 'none' };
    }
    return { move: 'pivot', dir: line, act: 'parry' };
  }

  // Diagonal neighbours: stepping in only rotates both around each other, so mostly wait or
  // zone one of the two cells the foe can step into.
  const toward = DIR_KEYS.filter((k) => dist(step(me, k), foe) < dist(me, foe));
  if (Math.abs(me.x - foe.x) === 1 && Math.abs(me.y - foe.y) === 1) {
    const r = rnd();
    const k = toward[Math.floor(rnd() * toward.length)];
    if (r < 0.45) return { move: 'pivot', dir: k, act: 'slash' };
    if (r < 0.75) return { move: 'pivot', dir: k, act: 'parry' };
  }
  if (rnd() < 0.15) return { move: 'pivot', dir: toward[0] || me.facing, act: 'parry' };

  // Approach: prefer steps that shorten the distance; slash if the step lands us facing the foe.
  const options = DIR_KEYS.filter((k) => {
    const t = step(me, k);
    return isWalkable(t.x, t.y) && !same(t, foe) && dist(t, foe) < dist(me, foe);
  });
  if (!options.length) return { move: 'hold', dir: me.facing, act: rnd() < 0.3 ? 'parry' : 'none' };
  const aligned = options.filter((k) => same(step(step(me, k), k), foe));
  const dir = aligned.length && rnd() < 0.7 ? aligned[0] : options[Math.floor(rnd() * options.length)];
  const lands = same(step(step(me, dir), dir), foe);
  const act = lands && rnd() < 0.6 ? 'slash' : rnd() < 0.2 ? 'parry' : 'none';
  return { move: 'move', dir, act };
}

// Light weighting: often counter the opponent's last clash pick.
function cpuClashPick(lastFoePick, rnd = Math.random) {
  if (lastFoePick && rnd() < 0.5) return CLASH_PICKS.find((k) => BEATS[k] === lastFoePick);
  return CLASH_PICKS[Math.floor(rnd() * 3)];
}

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

// Screen vector from a cell centre to its neighbour in a grid direction.
function dirVec(dir) {
  const d = DIRS[dir];
  return { x: ((d.dx + d.dy) * TW) / 2, y: ((d.dy - d.dx) * TH) / 2 };
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

function drawCell(g, x, y, color, fillAlpha, lineAlpha) {
  const pts = cellPts(x, y);
  g.fillStyle(color, fillAlpha);
  g.fillPoints(pts, true);
  g.lineStyle(2, color, lineAlpha);
  g.strokePoints(pts, true);
}

// Wireframe mecha standing on a (possibly fractional) grid position.
function drawMecha(g, gx, gy, facing, color, alpha, flash) {
  const c = toIso(gx, gy);
  const v = dirVec(facing);
  const n = Math.hypot(v.x, v.y);
  const fx = v.x / n;
  const fy = v.y / n;
  const col = flash > 0 ? COLORS.white : color;

  // Facing chevron on the tile, pointing at the front edge.
  const tip = { x: c.x + v.x * 0.48, y: c.y + v.y * 0.48 };
  const base = { x: c.x + v.x * 0.22, y: c.y + v.y * 0.22 };
  g.fillStyle(col, 0.9 * alpha);
  g.fillTriangle(tip.x, tip.y, base.x - fy * 7, base.y + fx * 7, base.x + fy * 7, base.y - fx * 7);

  const x = c.x;
  const y = c.y;
  const torso = [
    { x: x - 8, y: y - 13 },
    { x: x + 8, y: y - 13 },
    { x: x + 11, y: y - 28 },
    { x: x - 11, y: y - 28 },
  ];
  g.fillStyle(col, 0.15 * alpha);
  g.fillPoints(torso, true);
  g.lineStyle(1.5, col, alpha);
  g.strokePoints(torso, true);
  g.lineBetween(x - 6, y - 1, x - 4, y - 13);
  g.lineBetween(x + 6, y - 1, x + 4, y - 13);
  g.strokeRect(x - 17, y - 30, 6, 8);
  g.strokeRect(x + 11, y - 30, 6, 8);
  g.strokePoints(rhombus(x, y - 34, 5, 5), true);
  // Visor + blade point the way the mecha faces.
  g.lineStyle(2, col, alpha);
  g.lineBetween(x, y - 34, x + fx * 6, y - 34 + fy * 4);
  g.lineBetween(x + fx * 9, y - 20, x + fx * 26, y - 20 + fy * 13);
}

// Persona-style slanted label slab.
function drawLabelSlab(g, x, y, w, h, color, selected) {
  const k = 8;
  const pts = [
    { x: x + k, y },
    { x: x + w + k, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ];
  g.fillStyle(0x000000, 0.8);
  g.fillPoints(
    pts.map((p) => ({ x: p.x + 3, y: p.y + 3 })),
    true,
  );
  g.fillStyle(selected ? color : 0x000000, selected ? 1 : 0.9);
  g.fillPoints(pts, true);
  g.lineStyle(1.5, selected ? COLORS.white : color, 1);
  g.strokePoints(pts, true);
}

function drawBolt(g, fx) {
  const life = (fx.until - fx.now) / fx.dur;
  g.lineStyle(3, COLORS.bolt, life);
  g.strokePoints(fx.pts, false);
  g.lineStyle(1, COLORS.white, life);
  g.strokePoints(fx.pts, false);
}

function makeBoltPoints(x, y) {
  const pts = [{ x: x + (Math.random() - 0.5) * 60, y: 0 }];
  const n = 9;
  for (let i = 1; i < n; i++) {
    const t = i / n;
    pts.push({ x: pts[0].x + (x - pts[0].x) * t + (Math.random() - 0.5) * 30, y: y * t });
  }
  pts.push({ x, y });
  return pts;
}

// == AUDIO ==
// Web Audio synth: oscillators + noise. Silent in attract mode.

function createAudio(scene) {
  const ctx = scene.sound && scene.sound.context;
  const ready = () => {
    if (!ctx || scene.mode !== 'play') return false;
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  };
  const out = (vol) => {
    const g = ctx.createGain();
    g.gain.value = vol;
    g.connect(ctx.destination);
    return g;
  };
  function tone(f, dur, type = 'square', vol = 0.05, f2 = f) {
    if (!ready()) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = out(vol);
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    o.start(t);
    o.stop(t + dur);
  }
  function noise(dur, vol = 0.12) {
    if (!ready()) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(out(vol));
    src.start();
  }
  const arp = (notes) => notes.forEach((f, i) => setTimeout(() => tone(f, 0.16, 'square', 0.05), i * 130));
  return {
    tick: () => tone(440, 0.04, 'square', 0.03),
    blip: () => tone(660, 0.07, 'square', 0.04, 990),
    lock: () => tone(880, 0.12, 'triangle', 0.06, 1320),
    move: () => tone(160, 0.12, 'triangle', 0.05, 90),
    swing: () => noise(0.08, 0.05),
    hit: () => {
      noise(0.18, 0.15);
      tone(140, 0.2, 'sawtooth', 0.06, 50);
    },
    parry: () => tone(1500, 0.15, 'square', 0.05, 2200),
    clash: () => {
      noise(0.35, 0.2);
      tone(90, 0.4, 'sawtooth', 0.08, 40);
    },
    win: () => arp([523, 659, 784, 1047]),
    lose: () => arp([392, 311, 233, 175]),
  };
}

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

const hex = (n) => '#' + n.toString(16).padStart(6, '0');

function txt(scene, x, y, size, color, originX = 0) {
  return scene.add
    .text(x, y, '', { fontFamily: 'monospace', fontSize: size + 'px', fontStyle: 'bold', color })
    .setOrigin(originX, 0.5)
    .setDepth(10);
}

function setT(t, s) {
  if (t.text !== s) t.setText(s);
}

function createUi(scene) {
  return {
    names: [txt(scene, 30, 24, 14, hex(COLORS.p1)), txt(scene, W - 30, 24, 14, hex(COLORS.cpu), 1)],
    status: [txt(scene, 100, 58, 11, '#ffffff'), txt(scene, W - 100, 58, 11, '#ffffff', 1)],
    phase: txt(scene, W / 2, H - 56, 16, '#ffffff', 0.5),
    hint: txt(scene, W / 2, H - 34, 11, '#9aa0b0', 0.5),
    opts: [0, 1, 2, 3].map(() => txt(scene, 0, 0, 12, '#ffffff')),
    title: txt(scene, W / 2, 140, 30, '#000000', 0.5).setDepth(11),
    sub: txt(scene, W / 2, 188, 14, '#ffffff', 0.5).setDepth(11),
  };
}

function create() {
  this.controls = createControls(this);
  drawBackground(this.add.graphics());
  drawMap(this.add.graphics());
  this.gFx = this.add.graphics();
  this.gUnits = this.add.graphics();
  this.gTop = this.add.graphics();
  this.gUi = this.add.graphics();
  this.ui = createUi(this);
  this.sfx = createAudio(this);
  this.token = 0;
  resetMatch(this, 'attract');
}

function update(time, delta) {
  handleInput(this, time);
  drawWorld(this, time, delta);
  drawHud(this, time);
}

// --- Match flow ---

function clearPressed(controls) {
  for (const k in controls.pressed) controls.pressed[k] = false;
}

function wait(s, ms) {
  return new Promise((res) => s.time.delayedCall(ms, res));
}

function resetMatch(s, mode) {
  s.token++;
  s.mode = mode;
  s.state = newState();
  s.view = s.state.units.map((u) => ({ gx: u.x, gy: u.y, facing: u.facing, flash: 0 }));
  s.dispHp = [HP_MAX, HP_MAX];
  s.fx = [];
  s.lastP1Pick = null;
  s.clashResolve = null;
  beginTurn(s);
}

function beginTurn(s) {
  clearPressed(s.controls);
  const now = s.time.now;
  s.phaseStart = now;
  if (s.state.over) {
    s.phase = 'over';
    s.deadline = now + (s.mode === 'play' ? OVER_IDLE_MS : ATTRACT_OVER_MS);
    if (s.state.over === 'p1') s.sfx.win();
    else s.sfx.lose();
    return;
  }
  s.phase = 'program';
  s.deadline = now + (s.mode === 'play' ? TURN_MS : ATTRACT_TURN_MS);
  s.sel = { step: 'move', dir: s.state.units[0].facing, move: 'hold' };
  s.banner = s.mode === 'play' ? 'TURN ' + s.state.turn : '';
}

function planOf(sel, act, holdMove) {
  return { move: holdMove ? 'hold' : sel.move, dir: sel.dir, act };
}

function handleInput(s, time) {
  const c = s.controls;
  const start = () => consumePressed(c, 'START1') || consumePressed(c, 'P1_1');

  if (s.mode === 'attract') {
    if (start()) return resetMatch(s, 'play');
    if (s.phase === 'program' && time > s.deadline) lockTurn(s, null);
    if (s.phase === 'over' && time > s.deadline) resetMatch(s, 'attract');
    return;
  }
  if (s.phase === 'over') {
    if (time < s.phaseStart + ATTRACT_OVER_MS) clearPressed(c);
    else if (start()) resetMatch(s, 'play');
    else if (time > s.deadline) resetMatch(s, 'attract');
    return;
  }
  if (s.phase === 'clash') {
    const i = ['P1_1', 'P1_2', 'P1_3'].findIndex((k) => consumePressed(c, k));
    if (i >= 0) {
      s.sfx.blip();
      s.clashResolve(CLASH_PICKS[i]);
    } else if (time > s.deadline) {
      s.clashResolve(CLASH_PICKS[Math.floor(Math.random() * 3)]);
    }
    return;
  }
  if (s.phase !== 'program') return;

  if (s.state.units[0].stunned) {
    if (time > s.phaseStart + STUN_SHOW_MS) lockTurn(s, HOLD_PLAN);
    return;
  }
  const sel = s.sel;
  if (sel.step === 'move') {
    for (const [stick, dir] of Object.entries(STICK_TO_DIR)) {
      if (consumePressed(c, 'P1_' + stick)) {
        sel.dir = dir;
        s.sfx.tick();
      }
    }
    const pick = [
      ['P1_1', 'move'],
      ['P1_2', 'pivot'],
      ['P1_3', 'hold'],
    ].find(([k]) => consumePressed(c, k));
    if (pick) {
      sel.move = pick[1];
      sel.step = 'act';
      s.sfx.blip();
    }
  } else {
    if (consumePressed(c, 'P1_4')) {
      sel.step = 'move';
      s.sfx.tick();
      return;
    }
    const pick = [
      ['P1_1', 'slash'],
      ['P1_2', 'parry'],
      ['P1_3', 'none'],
    ].find(([k]) => consumePressed(c, k));
    if (pick) return lockTurn(s, planOf(sel, pick[1]));
  }
  if (time > s.deadline) lockTurn(s, planOf(sel, 'none', sel.step === 'move'));
}

async function lockTurn(s, p1Plan) {
  const token = s.token;
  s.phase = 'resolve';
  s.banner = '';
  s.sfx.lock();
  const p0 = s.mode === 'play' ? p1Plan : cpuPlan(s.state, 0);
  const r = resolveTurn(s.state, [p0, cpuPlan(s.state, 1)]);
  if (!(await playEvents(s, r.events, token))) return;
  s.state = r.state;

  if (r.clash) {
    const picks = await askClash(s);
    if (token !== s.token) return;
    s.lastP1Pick = picks[0];
    s.banner = picks[0].toUpperCase() + '  VS  ' + picks[1].toUpperCase();
    const c = resolveClash(s.state, picks);
    if (!(await playEvents(s, c.events, token))) return;
    s.state = c.state;
  }

  s.dispHp = s.state.units.map((u) => u.hp);
  s.view.forEach((v, i) => {
    const u = s.state.units[i];
    Object.assign(v, { gx: u.x, gy: u.y, facing: u.facing });
  });
  await wait(s, 250);
  if (token === s.token) beginTurn(s);
}

function askClash(s) {
  const cpu = cpuClashPick(s.lastP1Pick);
  if (s.mode !== 'play') return wait(s, 500).then(() => [cpuClashPick(null), cpu]);
  s.phase = 'clash';
  s.phaseStart = s.time.now;
  s.deadline = s.time.now + CLASH_MS;
  clearPressed(s.controls);
  return new Promise((res) => {
    s.clashResolve = (pick) => {
      s.clashResolve = null;
      s.phase = 'resolve';
      res([pick, cpu]);
    };
  });
}

function tweenTo(s, o, x, y, frac) {
  return new Promise((res) =>
    s.tweens.add({
      targets: o,
      gx: o.gx + (x - o.gx) * frac,
      gy: o.gy + (y - o.gy) * frac,
      duration: frac < 1 ? STEP_MS / 2 : STEP_MS,
      yoyo: frac < 1,
      ease: 'Sine.easeInOut',
      onComplete: res,
    }),
  );
}

function addFx(s, fx) {
  fx.until = s.time.now + fx.dur;
  s.fx.push(fx);
}

function floatText(s, o, str, color) {
  const p = toIso(o.gx, o.gy);
  const t = s.add
    .text(p.x, p.y - 50, str, {
      fontFamily: 'monospace',
      fontSize: '15px',
      fontStyle: 'bold',
      color: hex(color),
      stroke: '#000000',
      strokeThickness: 4,
    })
    .setOrigin(0.5)
    .setDepth(12);
  s.tweens.add({ targets: t, y: t.y - 30, alpha: 0, duration: 1000, onComplete: () => t.destroy() });
}

// Animate one resolution: movement first (in parallel), then combat effects.
async function playEvents(s, events, token) {
  const v = s.view;
  const moves = [];
  for (const e of events) {
    if (e.t === 'face') v[e.who].facing = e.facing;
    else if (e.t === 'move' || e.t === 'knock') moves.push(tweenTo(s, v[e.who], e.x, e.y, 1));
    else if (e.t === 'bump') moves.push(tweenTo(s, v[e.who], e.x, e.y, 0.4));
  }
  if (moves.length) {
    s.sfx.move();
    await Promise.all(moves);
  }
  if (token !== s.token) return false;

  let pause = 0;
  const shake = (ms, k) => s.cameras.main.shake(ms, k);
  for (const e of events) {
    const u = v[e.who];
    if (e.t === 'slash') {
      addFx(s, { kind: 'cell', x: e.x, y: e.y, color: e.who ? COLORS.cpu : COLORS.p1, dur: 350 });
      s.sfx.swing();
      pause = Math.max(pause, HIT_PAUSE_MS);
    } else if (e.t === 'hit') {
      u.flash = 1;
      s.dispHp[e.who] = Math.max(0, s.dispHp[e.who] - e.dmg);
      floatText(s, u, '-' + e.dmg + (e.back ? ' BACK' : '') + (e.charged ? ' MAX' : ''), COLORS.white);
      shake(140, 0.008);
      s.sfx.hit();
      pause = Math.max(pause, HIT_PAUSE_MS);
    } else if (e.t === 'parry') {
      floatText(s, u, 'PARRY +1', COLORS.coast);
      s.sfx.parry();
      pause = Math.max(pause, HIT_PAUSE_MS);
    } else if (e.t === 'clash' || e.t === 'mirror') {
      const m = toIso((v[0].gx + v[1].gx) / 2, (v[0].gy + v[1].gy) / 2);
      addFx(s, { kind: 'bolt', pts: makeBoltPoints(m.x, m.y - 24), dur: 500 });
      addFx(s, { kind: 'flash', dur: 160 });
      shake(220, 0.012);
      s.sfx.clash();
      s.banner = e.t === 'clash' ? 'CLASH!' : 'MIRROR!';
      pause = Math.max(pause, CLASH_PAUSE_MS);
    } else if (e.t === 'clashWin') {
      floatText(s, u, 'WINS CLASH', e.who ? COLORS.cpu : COLORS.p1);
    }
  }
  if (pause) await wait(s, pause);
  return token === s.token;
}

// --- Drawing ---

function drawWorld(s, time, delta) {
  const g = s.gFx;
  g.clear();
  const flicker = Math.random() < 0.06 ? 0.35 : 0.08 + 0.05 * Math.sin(time / 300);
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (tileAt(x, y) !== 4) continue;
      g.fillStyle(COLORS.bolt, flicker);
      g.fillPoints(cellPts(x, y), true);
    }
  }

  // Planning previews: stick arrows, ghost, threat tile.
  let ghost = null;
  const me = s.state.units[0];
  if (s.mode === 'play' && s.phase === 'program' && !me.stunned) {
    const sel = s.sel;
    if (sel.step === 'move') {
      for (const [stick, dir] of Object.entries(STICK_TO_DIR)) {
        const n = step(me, dir);
        if (!isWalkable(n.x, n.y)) continue;
        if (dir === sel.dir) drawCell(g, n.x, n.y, COLORS.p1, 0.12, 0.6);
        const p = toIso(n.x, n.y);
        drawArrow(g, p.x, p.y, stick, COLORS.white);
      }
      ghost = previewPlan(me, { move: 'move', dir: sel.dir });
    } else {
      ghost = previewPlan(me, { move: sel.move, dir: sel.dir });
      const f = step(ghost, ghost.facing);
      const blink = 0.5 + 0.5 * Math.sin(time / 90);
      drawCell(g, f.x, f.y, COLORS.cpu, 0.15 + 0.2 * blink, 0.5 + 0.5 * blink);
    }
  }

  const gu = s.gUnits;
  gu.clear();
  const order = s.view
    .map((v, i) => ({ v, i }))
    .sort((a, b) => a.v.gy - a.v.gx - (b.v.gy - b.v.gx));
  for (const { v, i } of order) {
    v.flash = Math.max(0, v.flash - delta / 250);
    if (i === 0 && ghost) drawMecha(gu, ghost.x, ghost.y, ghost.facing, COLORS.p1, 0.35, 0);
    drawMecha(gu, v.gx, v.gy, v.facing, i ? COLORS.cpu : COLORS.p1, 1, v.flash);
  }

  const gt = s.gTop;
  gt.clear();
  s.fx = s.fx.filter((f) => f.until > time);
  for (const f of s.fx) {
    const a = (f.until - time) / f.dur;
    if (f.kind === 'bolt') drawBolt(gt, { pts: f.pts, until: f.until, now: time, dur: f.dur });
    else if (f.kind === 'cell') drawCell(gt, f.x, f.y, f.color, 0.4 * a, a);
    else if (f.kind === 'flash') {
      gt.fillStyle(COLORS.white, 0.35 * a);
      gt.fillRect(0, 0, W, H);
    }
  }
}

const MOVE_OPTS = [
  ['B1', 'MOVE'],
  ['B2', 'PIVOT'],
  ['B3', 'HOLD'],
];
const ACT_OPTS = [
  ['B1', 'SLASH'],
  ['B2', 'PARRY'],
  ['B3', 'NONE'],
  ['B4', 'BACK'],
];
const CLASH_OPTS = [
  ['B1', 'THRUST'],
  ['B2', 'PARRY'],
  ['B3', 'FEINT'],
];

function drawHud(s, time) {
  const g = s.gUi;
  const ui = s.ui;
  g.clear();
  const units = s.state.units;

  // Corner panels: name, segmented HP, energy pips, status.
  [0, 1].forEach((i) => {
    const color = i ? COLORS.cpu : COLORS.p1;
    const x0 = i ? W - 262 : 12;
    drawLabelSlab(g, x0, 10, 242, 62, color, false);
    const u = units[i];
    for (let k = 0; k < 10; k++) {
      const on = s.dispHp[i] > k * (HP_MAX / 10);
      const sx = i ? W - 50 - k * 20 : 30 + k * 20;
      g.fillStyle(color, on ? 1 : 0.15);
      g.fillRect(sx, 37, 16, 8);
    }
    for (let k = 0; k < ENERGY_MAX; k++) {
      const px = i ? W - 38 - k * 16 : 38 + k * 16;
      g.fillStyle(COLORS.bolt, u.energy > k ? 1 : 0.15);
      g.fillPoints(rhombus(px, 58, 6, 6), true);
    }
    setT(ui.names[i], (i ? 'CPU' : 'P1') + '  ' + Math.max(0, s.dispHp[i]));
    const st = u.stunned ? 'STUNNED' : u.energy >= ENERGY_MAX ? 'CHARGED' : '';
    setT(ui.status[i], st);
  });

  // Phase label + hints + timer.
  const play = s.mode === 'play';
  let phase = '';
  let hint = '';
  let opts = [];
  let anchor = null;
  let optColor = COLORS.p1;
  if (play && s.phase === 'program') {
    if (units[0].stunned) {
      phase = 'STUNNED';
      hint = 'YOU CANNOT ACT THIS TURN';
    } else if (s.sel.step === 'move') {
      phase = (s.banner ? s.banner + '  ' : '') + 'MOVEMENT';
      hint = 'STICK AIM   B1 MOVE   B2 PIVOT   B3 HOLD';
      opts = MOVE_OPTS;
    } else {
      phase = 'COMBAT';
      hint = 'B1 SLASH   B2 PARRY   B3 NONE   B4 BACK';
      opts = ACT_OPTS;
    }
    anchor = toIso(s.view[0].gx, s.view[0].gy);
  } else if (play && s.phase === 'clash') {
    phase = 'CLASH!  PICK FAST';
    hint = 'PARRY > THRUST > FEINT > PARRY';
    opts = CLASH_OPTS;
    optColor = COLORS.cpu;
    anchor = toIso((s.view[0].gx + s.view[1].gx) / 2, (s.view[0].gy + s.view[1].gy) / 2);
  } else if (play && s.phase === 'resolve') {
    phase = s.banner || 'RESOLVE';
  }
  setT(ui.phase, phase);
  setT(ui.hint, hint);

  ui.opts.forEach((t, k) => {
    const o = opts[k];
    t.setVisible(!!o);
    if (!o) return;
    const x = Math.min(anchor.x + 34, W - 150);
    const y = anchor.y - 72 + k * 24;
    drawLabelSlab(g, x, y - 10, 104, 20, optColor, false);
    setT(t, o[0] + ' ' + o[1]);
    t.setPosition(x + 12, y);
  });

  if (play && (s.phase === 'program' || s.phase === 'clash')) {
    const total = s.phase === 'clash' ? CLASH_MS : TURN_MS;
    const left = Math.max(0, s.deadline - time) / total;
    g.fillStyle(left < 0.25 ? COLORS.cpu : COLORS.p1, 0.9);
    g.fillRect(W / 2 - 150, H - 16, 300 * left, 4);
  }

  // Overlays: attract title / game over.
  const blink = Math.floor(time / 450) % 2 === 0;
  let title = '';
  let sub = '';
  let titleColor = COLORS.p1;
  if (!play) {
    title = 'CATATUMBO PROTOCOL';
    sub = blink ? 'PRESS START' : '';
  } else if (s.phase === 'over') {
    const o = s.state.over;
    title = o === 'p1' ? 'VICTORY' : o === 'cpu' ? 'DEFEATED' : 'DRAW';
    titleColor = o === 'p1' ? COLORS.p1 : o === 'cpu' ? COLORS.cpu : COLORS.bolt;
    sub = time > s.phaseStart + ATTRACT_OVER_MS && blink ? 'PRESS START' : '';
  }
  if (title) {
    drawLabelSlab(g, W / 2 - 200, 116, 400, 48, titleColor, true);
    if (sub) drawLabelSlab(g, W / 2 - 90, 176, 180, 24, COLORS.white, false);
  }
  setT(ui.title, title);
  setT(ui.sub, sub);
}
