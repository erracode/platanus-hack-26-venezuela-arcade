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

// Combat tuning (ROADMAP.md §3–§4).
const HP_MAX = 100;
const SLASH_DMG = 34; // 3 clean hits to KO
const BACK_MULT = 1.5;
const LUNGE_DMG = 25;
const LUNGE_FLANK = 2; // lunge damage multiplier when hitting a side or the back
const LUNGE_DASH = 2;
const GRAB_DMG = 10;
const THROW_DMG = 15;
const SLAM_DMG = 10; // extra when the throw hits land / the edge
const THROW_DIST = 2;
const GUTS_MAX = 3; // full guts unlock BURST in a clash
const TURN_PENALTY = 40; // speed lost when a strike/parry/grab must turn first
const CLASH_WINDOW = 40; // strikes at each other within this speed gap clash

// Stance ladder: NORMAL→STAGGERED→KNOCKBACK→DOWN
const ST_NORMAL = 0;
const ST_STAGGERED = 1;
const ST_KNOCKBACK = 2;
const ST_DOWN = 3;

// Timing (ms).
const TURN_MS = 15000;
const CLASH_MS = 4000;
const STEP_MS = 180;
const HIT_PAUSE_MS = 550;
const CLASH_PAUSE_MS = 750;
const STUN_SHOW_MS = 900;
const ATTRACT_TURN_MS = 1200;
const CARD_MS = 3500; // attract-mode how-to-play card rotation
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
// Pure functions only (no Phaser). Each side picks ONE action per turn. Faster actions land first;
// a unit hit before it acts loses its action. Strikes aimed at each other with close speeds clash.
// A plan is { act, dir } or { act, path }.

const ACTIONS = {
  move: { name: 'MOVE', spd: 100, target: 'tile', range: 2, info: ['WALK UP TO 2 TILES', '2 TILES = MOMENTUM (UNLOCKS LUNGE)'] },
  dodge: { name: 'DODGE', spd: 220, target: 'tile', range: 1, info: ['HOP 1 TILE, KEEP FACING', 'VERY FAST: ESCAPE AN ATTACK'] },
  pivot: { name: 'PIVOT', spd: 250, target: 'dir', info: ['TURN TO FACE ANOTHER SIDE', 'FASTEST ACTION'] },
  vslash: { name: 'V-SLASH', spd: 150, target: 'dir', strike: true, info: ['3 TILES FORWARD: 34 DMG', 'X2 ON FLANK'] },
  hslash: { name: 'H-SLASH', spd: 130, target: 'dir', strike: true, info: ['WIDE SWEEP 3X2: 34 DMG', 'REACHES DIAGONALS'] },
  lunge: { name: 'LUNGE', spd: 200, target: 'dir', strike: true, info: ['DASH 2 TILES + STAB: 25 DMG', 'X2 ON FLANK  NEEDS MOMENTUM'] },
  parry: { name: 'PARRY', spd: 170, target: 'dir', info: ['BLOCKS STRIKES FROM THE FRONT', '+1 GUTS ON A BLOCK'] },
  grab: { name: 'GRAB', spd: 120, target: 'dir', info: ['CATCH + THROW: 25 DMG', 'IGNORES PARRY  SLOW'] },
  burst: { name: 'BURST', spd: 300, target: 'none', info: ['ESCAPE KNOCKBACK: RESET STANCE', 'CONSUMES ALL GUTS'] },
  wait: { name: 'WAIT', spd: 0, target: 'none', info: [] },
};
const MOVE_ACTS = ['move', 'dodge', 'pivot'];
const COMBAT_ACTS = ['vslash', 'hslash', 'lunge', 'parry', 'grab'];
const STRIKE_ACTS = ['vslash', 'hslash', 'lunge'];
const WAIT_PLAN = { act: 'wait' };
// Clash picks: parry > thrust > feint > parry; burst beats thrust and feint, loses to parry.
const CLASH_PICKS = ['thrust', 'parry', 'feint', 'burst'];
const CLASH_WINS = { parry: ['thrust', 'burst'], thrust: ['feint'], feint: ['parry'], burst: ['thrust', 'feint'] };

function newUnit(start) {
  return { x: start.x, y: start.y, facing: start.facing, hp: HP_MAX, guts: 0, momentum: false, st: ST_NORMAL };
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
  return !!a && !!b && a.x === b.x && a.y === b.y;
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

function canUse(u, act) {
  if (act === 'lunge') return u.momentum;
  if (act === 'burst') return u.st === ST_KNOCKBACK && u.guts >= GUTS_MAX;
  return true;
}

// Turning before a strike/parry/grab costs speed.
function speedOf(u, plan) {
  const a = ACTIONS[plan.act];
  const turns = a.target === 'dir' && plan.act !== 'pivot' && plan.dir !== u.facing;
  return a.spd - (turns ? TURN_PENALTY : 0);
}

// Tiles unit i can reach in up to `range` steps in a straight line (cardinal only, no diagonals).
// Returns Map "x,y" -> path (array of cells, start excluded).
function reach(s, i, range) {
  const me = s.units[i];
  const foe = s.units[1 - i];
  const out = new Map();
  for (const k of DIR_KEYS) {
    const path = [];
    let c = me;
    for (let n = 0; n < range; n++) {
      const t = step(c, k);
      if (!isWalkable(t.x, t.y) || same(t, foe)) break;
      path.push(t);
      out.set(t.x + ',' + t.y, [...path]);
      c = t;
    }
  }
  return out;
}

// Straight dash of up to n tiles, stopping before land or the other unit.
function dashPath(from, dir, n, other) {
  const path = [];
  let c = from;
  for (let k = 0; k < n; k++) {
    const t = step(c, dir);
    if (!isWalkable(t.x, t.y) || same(t, other)) break;
    path.push(t);
    c = t;
  }
  return path;
}

// Where a plan would leave a unit if nothing interfered (ghost preview).
function previewPlan(u, plan, other) {
  const a = ACTIONS[plan.act];
  if (a.target === 'tile' && plan.path && plan.path.length) {
    const last = plan.path[plan.path.length - 1];
    const prev = plan.path.length > 1 ? plan.path[plan.path.length - 2] : u;
    return { x: last.x, y: last.y, facing: plan.act === 'dodge' ? u.facing : dirBetween(prev, last) };
  }
  if (plan.act === 'lunge') {
    const path = dashPath(u, plan.dir, LUNGE_DASH, other);
    const end = path.length ? path[path.length - 1] : u;
    return { x: end.x, y: end.y, facing: plan.dir };
  }
  return { x: u.x, y: u.y, facing: a.target === 'dir' ? plan.dir : u.facing };
}

const gainGuts = (u, n) => (u.guts = Math.min(GUTS_MAX, u.guts + n));

// Advance stance when hit: N→S→K→D. Parry also sets the attacker to STAGGERED.
function advanceStance(u) {
  u.st = Math.min(ST_DOWN, u.st + 1);
}

// Beginning of a turn: DOWN → STAGGERED (wake up staggering). Staggered/Knockback remain.
function resolveStanceRecovery(u) {
  if (u.st === ST_DOWN) u.st = ST_STAGGERED;
}

// V-SLASH: up to 3 tiles in a straight line in facing direction.
function vslashTiles(u) {
  const out = [];
  let c = u;
  for (let n = 0; n < 3; n++) {
    c = step(c, u.facing);
    if (!isWalkable(c.x, c.y)) break;
    out.push(c);
  }
  return out;
}

// H-SLASH: 3×2 block forward (3 wide, 2 deep).
function hslashTiles(u) {
  const d = DIRS[u.facing];
  // Perpendicular axes: for N/S it's E/W. For E/W it's N/S.
  const perp = u.facing === 'N' || u.facing === 'S' ? ['E', 'W'] : ['N', 'S'];
  const p = perp.map(k => DIRS[k]);
  const out = [];
  for (let depth = 1; depth <= 2; depth++) {
    const row = { x: u.x + d.dx * depth, y: u.y + d.dy * depth };
    out.push(row);
    out.push({ x: row.x + p[0].dx, y: row.y + p[0].dy });
    out.push({ x: row.x + p[1].dx, y: row.y + p[1].dy });
  }
  return out;
}

// Check if a position is in a list of tiles (within bounds).
function inTiles(pos, tiles) {
  return tiles.some(t => t.x === pos.x && t.y === pos.y);
}

function resolveTurn(state, plans) {
  const s = cloneState(state);
  const U = s.units;
  const events = [];
  const p = plans.map((plan, i) => (U[i].st !== ST_NORMAL || !canUse(U[i], plan.act) ? WAIT_PLAN : plan));
  const spd = p.map((plan, i) => (plan.act === 'wait' ? 0 : speedOf(U[i], plan)));
  const momentum = U.map((u, i) => p[i].act === 'move' && (p[i].path || []).length === 2);
  U.forEach((u, i) => p[i].act === 'lunge' && (u.momentum = false));
  events.push({ t: 'order', acts: p.map((x) => x.act), spd });

  // Clash: both strike at each other (after their dashes) with speeds within the clash window.
  if (STRIKE_ACTS.includes(p[0].act) && STRIKE_ACTS.includes(p[1].act) && Math.abs(spd[0] - spd[1]) <= CLASH_WINDOW) {
    const end = U.map((u, i) => {
      const path = p[i].act === 'lunge' ? dashPath(u, p[i].dir, LUNGE_DASH, U[1 - i]) : [];
      return { path, at: path.length ? path[path.length - 1] : u, facing: p[i].dir };
    });
    const hitTiles = (i) => {
      const src = end[i];
      if (p[i].act === 'vslash') return vslashTiles({ x: src.at.x, y: src.at.y, facing: src.facing });
      if (p[i].act === 'hslash') return hslashTiles({ x: src.at.x, y: src.at.y, facing: src.facing });
      return [step(src.at, src.facing)];
    };
    if (!same(end[0].at, end[1].at) && inTiles(end[1].at, hitTiles(0)) && inTiles(end[0].at, hitTiles(1))) {
      U.forEach((u, i) => {
        u.facing = end[i].facing;
        if (end[i].path.length) {
          u.x = end[i].at.x;
          u.y = end[i].at.y;
          events.push({ t: 'move', who: i, path: end[i].path, facing: u.facing });
        } else {
          events.push({ t: 'face', who: i, facing: u.facing });
        }
      });
      events.push({ t: 'clash' });
      U.forEach((u, i) => (u.momentum = momentum[i]));
      return { state: s, events, clash: true };
    }
  }

  const groups = spd[0] === spd[1] ? [[0, 1]] : spd[0] > spd[1] ? [[0], [1]] : [[1], [0]];
  const cancelled = [false, false];
  const guard = [false, false];
  const done = [false, false];
  let grab = null;

  const strike = (i, dmg, back, flankMult) => {
    const foe = U[1 - i];
    const flank = !same(frontOf(foe), U[i]);
    const total = Math.round(dmg * (flank ? flankMult : 1));
    foe.hp = Math.max(0, foe.hp - total);
    gainGuts(U[i], 1);
    const prevSt = foe.st;
    advanceStance(foe);
    if (prevSt !== foe.st) events.push({ t: 'stance', who: 1 - i, st: foe.st });
    events.push({ t: 'hit', who: 1 - i, dmg: total, flank: flank && flankMult > 1 });
    if (!done[1 - i] && !groups.find((g) => g.includes(i)).includes(1 - i) && p[1 - i].act !== 'wait' && !cancelled[1 - i]) {
      cancelled[1 - i] = true;
      events.push({ t: 'interrupt', who: 1 - i, act: p[1 - i].act });
    }
  };

  for (const g of groups) {
    const acting = g.filter((i) => !cancelled[i] && p[i].act !== 'wait');
    if (acting.length) events.push({ t: 'beat', who: acting });

    for (const i of acting) {
      if (ACTIONS[p[i].act].target === 'dir' && U[i].facing !== p[i].dir) {
        U[i].facing = p[i].dir;
        events.push({ t: 'face', who: i, facing: U[i].facing });
      }
    }

    // Movement (walks, hops and lunge dashes). Paths stop before the other unit;
    // equal final tiles or a swap → nobody moves.
    const walk = {};
    for (const i of acting) {
      const a = p[i].act;
      if (a === 'lunge') walk[i] = dashPath(U[i], p[i].dir, LUNGE_DASH, U[1 - i]);
      if (ACTIONS[a].target !== 'tile') continue;
      const path = [];
      for (const c of p[i].path || []) {
        if (same(c, U[1 - i]) || !isWalkable(c.x, c.y)) break;
        path.push(c);
      }
      walk[i] = path;
    }
    if (walk[0] && walk[1]) {
      const a = walk[0][walk[0].length - 1];
      const b = walk[1][walk[1].length - 1];
      if (same(a, b) || (same(a, U[1]) && same(b, U[0]))) walk[0] = walk[1] = [];
    }
    for (const i of acting) {
      if (!walk[i]) continue;
      const path = walk[i];
      if (!path.length) {
        if (p[i].act !== 'lunge') events.push({ t: 'bump', who: i });
        continue;
      }
      const last = path[path.length - 1];
      const prev = path.length > 1 ? path[path.length - 2] : U[i];
      if (p[i].act !== 'dodge') U[i].facing = dirBetween(prev, last);
      U[i].x = last.x;
      U[i].y = last.y;
      events.push({ t: 'move', who: i, path, facing: U[i].facing });
    }

    for (const i of acting) {
      if (p[i].act === 'parry') {
        guard[i] = true;
        events.push({ t: 'guard', who: i });
      }
      if (p[i].act === 'burst') {
        U[i].guts = 0;
        U[i].st = ST_NORMAL;
        events.push({ t: 'burst', who: i });
      }
    }

    // Strikes: hitbox depends on the attack type. V-SLASH = 3 forward, H-SLASH = 3×2 block.
    for (const i of acting) {
      if (!ACTIONS[p[i].act].strike) continue;
      const u = U[i];
      const foe = U[1 - i];
      const tiles = p[i].act === 'vslash' ? vslashTiles(u) : p[i].act === 'hslash' ? hslashTiles(u) : [frontOf(u)];
      const f = tiles[0] || frontOf(u);
      events.push({ t: p[i].act, who: i, x: f.x, y: f.y, tiles });
      if (!inTiles(foe, tiles)) {
        events.push({ t: 'miss', who: i });
        continue;
      }
      if (guard[1 - i] && same(frontOf(foe), u)) {
        gainGuts(foe, 1);
        advanceStance(u); // parried → staggered
        events.push({ t: 'stance', who: i, st: u.st });
        events.push({ t: 'parry', who: 1 - i });
        continue;
      }
      if (p[i].act === 'vslash' || p[i].act === 'hslash') strike(i, SLASH_DMG, false, 2);
      else strike(i, LUNGE_DMG, false, LUNGE_FLANK);
    }

    // Grab ignores parry; the throw direction is chosen next (resolveThrow).
    for (const i of acting) {
      if (p[i].act !== 'grab' || cancelled[i]) continue;
      const f = frontOf(U[i]);
      events.push({ t: 'grab', who: i, x: f.x, y: f.y });
      if (!same(f, U[1 - i])) {
        events.push({ t: 'miss', who: i });
        continue;
      }
      strike(i, GRAB_DMG, false, 1);
      grab = i;
      events.push({ t: 'caught', who: 1 - i });
      break;
    }

    g.forEach((i) => (done[i] = true));
    if (grab !== null || U.some((u) => u.hp <= 0)) break;
  }

  U.forEach((u, i) => {
    resolveStanceRecovery(u);
    if (p[i].act !== 'lunge') u.momentum = momentum[i];
    if (momentum[i]) events.push({ t: 'momentum', who: i });
  });
  if (grab === null) finishTurn(s);
  return { state: s, events, clash: false, grab };
}

// Grabber `who` throws the foe up to 2 tiles in `dir`; slamming into land/the edge hurts more.
function resolveThrow(state, who, dir) {
  const s = cloneState(state);
  const me = s.units[who];
  const foe = s.units[1 - who];
  const path = dashPath(foe, dir, THROW_DIST, me);
  const slam = path.length < THROW_DIST;
  const dmg = THROW_DMG + (slam ? SLAM_DMG : 0);
  if (path.length) {
    const last = path[path.length - 1];
    foe.x = last.x;
    foe.y = last.y;
  }
  foe.hp = Math.max(0, foe.hp - dmg);
  gainGuts(me, 1);
  const events = [{ t: 'throw', who, dir }, { t: 'knock', who: 1 - who, path }, { t: 'hit', who: 1 - who, dmg, slam }];
  finishTurn(s);
  return { state: s, events };
}

function resolveClash(state, picks) {
  const s = cloneState(state);
  const events = [];
  picks.forEach((pk, i) => pk === 'burst' && (s.units[i].guts = 0));
  const [pa, pb] = picks;
  if (pa === pb) {
    events.push({ t: 'mirror', picks });
    s.units.forEach((u, i) => {
      const to = step(u, OPPOSITE[u.facing]);
      if (isWalkable(to.x, to.y) && !same(to, s.units[1 - i])) {
        u.x = to.x;
        u.y = to.y;
        events.push({ t: 'knock', who: i, path: [to] });
      }
    });
  } else {
    const winner = CLASH_WINS[pa].includes(pb) ? 0 : 1;
    const w = s.units[winner];
    const loser = s.units[1 - winner];
    loser.hp = Math.max(0, loser.hp - SLASH_DMG);
    const prevSt = loser.st;
    advanceStance(loser);
    if (prevSt !== loser.st) events.push({ t: 'stance', who: 1 - winner, st: loser.st });
    gainGuts(w, 1);
    events.push({ t: 'clashWin', who: winner, picks });
    events.push({ t: 'hit', who: 1 - winner, dmg: SLASH_DMG });
    if (picks[winner] === 'burst') {
      const to = step(loser, w.facing);
      if (isWalkable(to.x, to.y)) {
        loser.x = to.x;
        loser.y = to.y;
        events.push({ t: 'knock', who: 1 - winner, path: [to] });
      }
    }
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
  // BURST escape when knocked back with a full bar.
  if (me.st === ST_KNOCKBACK && me.guts >= GUTS_MAX && rnd() < 0.8) return { act: 'burst' };
  if (me.st !== ST_NORMAL) return WAIT_PLAN;
  const r = rnd();
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

  // Chain the combo: if the foe is staggered/knocked/down and in vslash range, press it.
  if (foe.st !== ST_NORMAL) {
    const lane = DIR_KEYS.find((k) => {
      const hit = step(me, k);
      return inTiles(foe, [hit, step(hit, k), step(step(hit, k), k)]);
    });
    if (lane && rnd() < 0.85) return { act: 'vslash', dir: lane };
    if (dist(me, foe) <= 2 && rnd() < 0.7) {
      const toFoe = dirBetween(me, foe);
      if (toFoe) return { act: 'hslash', dir: toFoe };
    }
  }

  if (dist(me, foe) === 1) {
    const toFoe = dirBetween(me, foe);
    const threatened = same(frontOf(foe), me);
    if (!threatened) return { act: r < 0.65 ? 'vslash' : r < 0.85 ? 'grab' : 'parry', dir: toFoe };
    if (r < 0.3) return { act: 'vslash', dir: toFoe };
    if (r < 0.55) return { act: 'parry', dir: toFoe };
    if (r < 0.75) return { act: 'grab', dir: toFoe };
    const outs = [...reach(s, i, 1).values()].filter((path) => !same(path[0], frontOf(foe)));
    if (outs.length) return { act: 'dodge', path: pick(outs) };
    return { act: 'parry', dir: toFoe };
  }

  // Momentum: lunge if the foe is 2-3 tiles away in a straight line.
  const line = DIR_KEYS.find((k) => same(step(step(me, k), k), foe));
  if (me.momentum) {
    const lane = DIR_KEYS.find((k) => {
      const end = dashPath(me, k, LUNGE_DASH, foe);
      return same(step(end.length ? end[end.length - 1] : me, k), foe);
    });
    if (lane && r < 0.75) return { act: 'lunge', dir: lane };
  }

  // Two apart in a line: zone the middle tile or guard it.
  if (line && r < 0.4) return { act: 'vslash', dir: line };
  if (line && r < 0.55) return { act: 'parry', dir: line };

  // Diagonal neighbours: wait on one of the two tiles the foe can step into.
  if (Math.abs(me.x - foe.x) === 1 && Math.abs(me.y - foe.y) === 1 && r < 0.6) {
    const k = pick(DIR_KEYS.filter((d) => dist(step(me, d), foe) === 1));
    return { act: r < 0.4 ? 'vslash' : 'parry', dir: k };
  }

  // Approach: closest reachable tile, avoiding the foe's front tile and tiles the foe can also
  // reach this turn (both walking into the same tile bumps forever). Vary among the best few.
  const paths = [...reach(s, i, 2).values()];
  if (!paths.length) return { act: 'pivot', dir: me.facing };
  const foeReach = reach(s, 1 - i, 2);
  const score = (path) => {
    const t = path[path.length - 1];
    const contested = foeReach.has(t.x + ',' + t.y) ? 8 : 0;
    return dist(t, foe) * 10 + (same(t, frontOf(foe)) ? 15 : 0) + contested + rnd() * 10;
  };
  paths.sort((a, b) => score(a) - score(b));
  return { act: 'move', path: paths[rnd() < 0.7 ? 0 : Math.min(paths.length - 1, 1 + Math.floor(rnd() * 2))] };
}

// Throw toward land if it slams, otherwise any open direction.
function cpuThrowDir(s, i, rnd = Math.random) {
  const foe = s.units[1 - i];
  const me = s.units[i];
  const slams = DIR_KEYS.filter((k) => dashPath(foe, k, THROW_DIST, me).length < THROW_DIST && !same(step(foe, k), me));
  const open = DIR_KEYS.filter((k) => !same(step(foe, k), me));
  const pool = slams.length ? slams : open;
  return pool[Math.floor(rnd() * pool.length)];
}

// Light weighting: often counter the opponent's last clash pick; burst when guts are full.
function cpuClashPick(lastFoePick, guts = 0, rnd = Math.random) {
  if (guts >= GUTS_MAX && rnd() < 0.4) return 'burst';
  if (lastFoePick && rnd() < 0.5) return CLASH_PICKS.find((k) => k !== 'burst' && CLASH_WINS[k].includes(lastFoePick));
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

// Wireframe mecha standing on a (possibly fractional) grid position. `stance` (0-3) changes the
// posture: 0 normal, 1 staggered (lean back), 2 knockback (tilt forward), 3 down (kneeling small).
function drawMecha(g, gx, gy, facing, color, alpha, flash, stance) {
  const c = toIso(gx, gy);
  const v = dirVec(facing);
  const n = Math.hypot(v.x, v.y);
  const fx = v.x / n;
  const fy = v.y / n;
  const col = flash > 0 ? COLORS.white : color;

  // Posture transforms.
  const s = stance || ST_NORMAL;
  let squeeze = 1; // vertical squash (1 = full height)
  let yOff = 0; // additional sink
  let tx = 0; // lean along facing (positive = toward facing)
  if (s === ST_STAGGERED) tx = -6;
  else if (s === ST_KNOCKBACK) tx = 5;
  else if (s === ST_DOWN) {
    squeeze = 0.62;
    yOff = 8;
  }

  // Facing chevron on the tile, pointing at the front edge.
  const tip = { x: c.x + v.x * 0.48, y: c.y + v.y * 0.48 };
  const base = { x: c.x + v.x * 0.22, y: c.y + v.y * 0.22 };
  g.fillStyle(col, 0.9 * alpha);
  g.fillTriangle(tip.x, tip.y, base.x - fy * 7, base.y + fx * 7, base.x + fy * 7, base.y - fx * 7);

  const x = c.x + tx;
  const y = c.y + yOff;
  // Torso: pull the top toward the ground when down (squash) to show kneeling.
  const topY = y - 28 * squeeze;
  const torso = [
    { x: x - 8, y: y - 13 * squeeze },
    { x: x + 8, y: y - 13 * squeeze },
    { x: x + 11, y: topY },
    { x: x - 11, y: topY },
  ];
  g.fillStyle(col, 0.15 * alpha);
  g.fillPoints(torso, true);
  g.lineStyle(1.5, col, alpha);
  g.strokePoints(torso, true);
  g.lineBetween(x - 6, y - 1, x - 4, y - 13 * squeeze);
  g.lineBetween(x + 6, y - 1, x + 4, y - 13 * squeeze);
  g.strokeRect(x - 17, y - 30 * squeeze, 6, 8 * squeeze);
  g.strokeRect(x + 11, y - 30 * squeeze, 6, 8 * squeeze);
  g.strokePoints(rhombus(x, y - 34 * squeeze, 5, 5), true);
  // Visor + blade point the way the mecha faces.
  g.lineStyle(2, col, alpha);
  g.lineBetween(x, y - 34 * squeeze, x + fx * 6, y - 34 * squeeze + fy * 4);
  g.lineBetween(x + fx * 9, y - 20 * squeeze, x + fx * 26, y - 20 * squeeze + fy * 13);
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

const unitColor = (i) => (i ? COLORS.cpu : COLORS.p1);

// "Locked in" check mark above a unit.
function drawCheck(g, x, y, color) {
  g.fillStyle(0x000000, 0.85);
  g.fillCircle(x, y, 9);
  g.lineStyle(2, color, 1);
  g.strokeCircle(x, y, 9);
  g.lineStyle(2.5, COLORS.white, 1);
  g.lineBetween(x - 4, y, x - 1, y + 4);
  g.lineBetween(x - 1, y + 4, x + 5, y - 4);
}

// Small HP bar under a unit.
function drawMiniBar(g, x, y, frac, color) {
  g.fillStyle(0x000000, 0.8);
  g.fillRect(x - 21, y, 42, 5);
  g.fillStyle(color, 1);
  g.fillRect(x - 20, y + 1, 40 * Math.max(0, frac), 3);
}

// The two vertices of the front tile that run across the facing direction (blade streak / shield).
function frontEdge(gx, gy, facing, at) {
  const c = toIso(gx, gy);
  const v = dirVec(facing);
  const n = Math.hypot(v.x, v.y);
  const px = (-v.y / n) * TW * 0.32;
  const py = (v.x / n) * TW * 0.32;
  const m = { x: c.x + v.x * at, y: c.y + v.y * at };
  return [
    { x: m.x + px, y: m.y + py * 0.5 },
    { x: m.x - px, y: m.y - py * 0.5 },
  ];
}

function drawSweep(g, gx, gy, facing, color, a) {
  const [p, q] = frontEdge(gx, gy, facing, 0.9);
  const lift = 18;
  g.lineStyle(6, color, 0.5 * a);
  g.lineBetween(p.x, p.y - lift, q.x, q.y - lift);
  g.lineStyle(2, COLORS.white, a);
  g.lineBetween(p.x, p.y - lift, q.x, q.y - lift);
}

function drawGuard(g, gx, gy, facing, a) {
  const [p, q] = frontEdge(gx, gy, facing, 0.5);
  const quad = [p, q, { x: q.x, y: q.y - 30 }, { x: p.x, y: p.y - 30 }];
  g.fillStyle(COLORS.white, 0.18 * a);
  g.fillPoints(quad, true);
  g.lineStyle(2, COLORS.white, a);
  g.strokePoints(quad, true);
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
const MENU = [MOVE_ACTS, COMBAT_ACTS];
const MENU_TITLES = ['MOVEMENT', 'COMBAT'];

// Dynamic menu: adds a BURST row to COMBAT when the unit is KNOCKBACK with full guts.
function buildMenu(u) {
  const combat = [...COMBAT_ACTS];
  if (u.st === ST_KNOCKBACK && u.guts >= GUTS_MAX) combat.push('burst');
  return [MOVE_ACTS, combat];
}
const CARDS = [
  ['CATATUMBO PROTOCOL', 'MECHA DUEL ON LAKE MARACAIBO'],
  ['HOW TO PLAY  1/3', 'BOTH MECHS SECRETLY PICK\nONE ACTION AT THE SAME TIME'],
  ['HOW TO PLAY  2/3', 'FASTER ACTIONS LAND FIRST\nGET HIT BEFORE YOU ACT = ACTION LOST\nTURNING TO STRIKE COSTS 40 SPEED'],
  ['HOW TO PLAY  3/3', 'STRIKE EACH OTHER = SWORD CLASH\nPARRY > THRUST > FEINT > PARRY\nPARRY OPENS COMBO: STAGGER→KNOCK→DOWN'],
];

function txt(scene, x, y, size, color, originX = 0) {
  return scene.add
    .text(x, y, '', { fontFamily: 'monospace', fontSize: size + 'px', fontStyle: 'bold', color, align: 'center' })
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
    tags: [txt(scene, 0, 0, 10, hex(COLORS.p1), 0.5), txt(scene, 0, 0, 10, hex(COLORS.cpu), 0.5)],
    info: [txt(scene, W / 2, 22, 13, '#ffffff', 0.5), txt(scene, W / 2, 42, 10, '#c8ccd8', 0.5), txt(scene, W / 2, 56, 10, '#c8ccd8', 0.5)],
    phase: txt(scene, W / 2, H - 56, 16, '#ffffff', 0.5),
    hint: txt(scene, W / 2, H - 34, 11, '#9aa0b0', 0.5),
    menu: [0, 1, 2, 3, 4, 5, 6, 7, 8].map(() => txt(scene, 0, 0, 12, '#ffffff', 0.5)),
    title: txt(scene, W / 2, 140, 26, '#000000', 0.5).setDepth(11),
    sub: txt(scene, W / 2, 196, 13, '#ffffff', 0.5).setDepth(11),
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
  this.attractStart = 0;
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
  s.view = s.state.units.map((u) => ({ gx: u.x, gy: u.y, facing: u.facing, st: 0, flash: 0 }));
  s.dispHp = [HP_MAX, HP_MAX];
  s.fx = [];
  s.lastP1Pick = null;
  s.clashResolve = null;
  s.menuPos = { col: 0, row: 0 };
  if (mode === 'attract') s.attractStart = s.time.now;
  beginTurn(s);
}

function beginTurn(s) {
  clearPressed(s.controls);
  const now = s.time.now;
  s.phaseStart = now;
  s.banner = '';
  s.fx = s.fx.filter((f) => f.kind !== 'guard');
  if (s.state.over) {
    s.phase = 'over';
    s.deadline = now + (s.mode === 'play' ? OVER_IDLE_MS : ATTRACT_OVER_MS);
    if (s.state.over === 'p1') s.sfx.win();
    else s.sfx.lose();
    return;
  }
  const play = s.mode === 'play';
  s.cpuPlanned = cpuPlan(s.state, 1);
  s.cpuReadyAt = now + (play ? 700 + Math.random() * 1800 : ATTRACT_TURN_MS);
  s.p1Plan = play ? null : cpuPlan(s.state, 0);
  s.phase = s.p1Plan ? 'locked' : 'choose';
  s.deadline = now + TURN_MS;
  s.sel = { act: buildMenu(s.state.units[0])[s.menuPos.col][s.menuPos.row], dir: s.state.units[0].facing, cur: null };
}

function lockP1(s, plan) {
  s.p1Plan = plan;
  s.phase = 'locked';
  s.sfx.lock();
}

// Start aiming the highlighted action.
function startAim(s) {
  const me = s.state.units[0];
  const a = ACTIONS[s.sel.act];
  if (!a || !canUse(me, s.sel.act)) return s.sfx.tick();
  // BURST / WAIT have no aim step — lock immediately.
  if (a.target === 'none') {
    if (s.sel.act === 'burst') {
      lockP1(s, { act: 'burst' });
      return;
    }
    return s.sfx.tick();
  }
  s.sel.dir = me.facing;
  s.sel.cur = null;
  if (a.target === 'tile') {
    s.sel.valid = reach(s.state, 0, a.range);
    const foe = s.state.units[1];
    let best = null;
    for (const path of s.sel.valid.values()) {
      const t = path[path.length - 1];
      if (!best || dist(t, foe) < dist(best, foe)) best = t;
    }
    if (!best) return s.sfx.tick();
    s.sel.cur = { x: best.x, y: best.y };
  }
  s.phase = 'aim';
  s.sfx.blip();
}

// The plan the current selection describes (also drives the ghost preview).
function selPlan(s) {
  const a = ACTIONS[s.sel.act];
  if (a.target === 'tile') {
    const path = s.sel.cur && s.sel.valid.get(s.sel.cur.x + ',' + s.sel.cur.y);
    return path ? { act: s.sel.act, path } : null;
  }
  return { act: s.sel.act, dir: s.sel.dir };
}

function handleInput(s, time) {
  const c = s.controls;
  const start = () => consumePressed(c, 'START1') || consumePressed(c, 'P1_1');

  if (s.mode === 'attract') {
    if (start()) return resetMatch(s, 'play');
    if (s.phase === 'locked' && time > s.cpuReadyAt) lockTurn(s);
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
    const keys = ['P1_1', 'P1_2', 'P1_3'];
    if (s.state.units[0].guts >= GUTS_MAX) keys.push('P1_4');
    const i = keys.findIndex((k) => consumePressed(c, k));
    if (i >= 0) {
      s.sfx.blip();
      s.clashResolve(CLASH_PICKS[i]);
    } else if (time > s.deadline) {
      s.clashResolve(CLASH_PICKS[Math.floor(Math.random() * 3)]);
    }
    return;
  }
  if (s.phase === 'throw') {
    for (const [stick, dir] of Object.entries(STICK_TO_DIR)) {
      if (consumePressed(c, 'P1_' + stick) && !same(step(s.state.units[1], dir), s.state.units[0])) {
        s.throwDir = dir;
        s.sfx.tick();
      }
    }
    if (consumePressed(c, 'P1_1') || time > s.deadline) s.throwResolve(s.throwDir);
    return;
  }
  if (s.phase === 'locked') {
    if (time > s.cpuReadyAt + 300) lockTurn(s);
    return;
  }
  if (s.phase !== 'choose' && s.phase !== 'aim') return;

  if (s.state.units[0].st !== ST_NORMAL) {
    if (time > s.phaseStart + STUN_SHOW_MS) lockP1(s, WAIT_PLAN);
    return;
  }
  if (time > s.deadline) return lockP1(s, WAIT_PLAN);

  const sel = s.sel;
  if (s.phase === 'choose') {
    const me = s.state.units[0];
    const m = s.menuPos;
    const fullMenu = buildMenu(me);
    const col = fullMenu[m.col];
    if (consumePressed(c, 'P1_U')) m.row = (m.row + col.length - 1) % col.length;
    else if (consumePressed(c, 'P1_D')) m.row = (m.row + 1) % col.length;
    else if (consumePressed(c, 'P1_L') || consumePressed(c, 'P1_R')) {
      m.col = 1 - m.col;
      m.row = Math.min(m.row, fullMenu[m.col].length - 1);
    } else if (consumePressed(c, 'P1_1')) return startAim(s);
    else return;
    sel.act = fullMenu[m.col][m.row];
    s.sfx.tick();
    return;
  }

  // Aiming.
  if (consumePressed(c, 'P1_2')) {
    s.phase = 'choose';
    s.sfx.tick();
    return;
  }
  for (const [stick, dir] of Object.entries(STICK_TO_DIR)) {
    if (!consumePressed(c, 'P1_' + stick)) continue;
    s.sfx.tick();
    if (ACTIONS[sel.act].target === 'dir') {
      sel.dir = dir;
    } else {
      const n = step(sel.cur, dir);
      const me = s.state.units[0];
      if (sel.valid.has(n.x + ',' + n.y) || same(n, me)) sel.cur = n;
    }
  }
  if (consumePressed(c, 'P1_1')) {
    const plan = selPlan(s);
    if (plan) lockP1(s, plan);
    else s.sfx.tick();
  }
}

async function lockTurn(s) {
  const token = s.token;
  s.phase = 'resolve';
  const r = resolveTurn(s.state, [s.p1Plan, s.cpuPlanned]);
  if (!(await playEvents(s, r.events, token))) return;
  s.state = r.state;

  if (r.grab !== null && r.grab !== undefined && !s.state.over) {
    const dir = await askThrow(s, r.grab);
    if (token !== s.token) return;
    const t = resolveThrow(s.state, r.grab, dir);
    if (!(await playEvents(s, t.events, token))) return;
    s.state = t.state;
  }

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
    Object.assign(v, { gx: u.x, gy: u.y, facing: u.facing, st: u.st });
  });
  await wait(s, 450);
  if (token === s.token) beginTurn(s);
}

function askThrow(s, who) {
  if (s.mode !== 'play' || who !== 0) return wait(s, 400).then(() => cpuThrowDir(s.state, who));
  const foe = s.state.units[1];
  s.throwDir = DIR_KEYS.find((k) => !same(step(foe, k), s.state.units[0]));
  s.phase = 'throw';
  s.deadline = s.time.now + CLASH_MS;
  clearPressed(s.controls);
  return new Promise((res) => {
    s.throwResolve = (dir) => {
      s.phase = 'resolve';
      res(dir);
    };
  });
}

function askClash(s) {
  const cpu = cpuClashPick(s.lastP1Pick, s.state.units[1].guts);
  if (s.mode !== 'play') return wait(s, 600).then(() => [cpuClashPick(null, s.state.units[0].guts), cpu]);
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

function tweenTo(s, o, x, y, ms, yoyo) {
  return new Promise((res) =>
    s.tweens.add({ targets: o, gx: x, gy: y, duration: ms, yoyo: !!yoyo, ease: 'Sine.easeInOut', onComplete: res }),
  );
}

function addFx(s, fx) {
  fx.until = s.time.now + fx.dur;
  s.fx.push(fx);
}

function floatText(s, o, str, color, size = 15, life = 1000) {
  const p = toIso(o.gx, o.gy);
  const t = s.add
    .text(p.x, p.y - 62, str, {
      fontFamily: 'monospace',
      fontSize: size + 'px',
      fontStyle: 'bold',
      color: hex(color),
      stroke: '#000000',
      strokeThickness: 4,
    })
    .setOrigin(0.5)
    .setDepth(12);
  s.tweens.add({ targets: t, y: t.y - 26, alpha: 0, delay: life * 0.4, duration: life * 0.6, onComplete: () => t.destroy() });
}

const actLabel = (i) => (i ? 'CPU ' : 'P1 ');

// Play one resolution step by step so the order of actions reads clearly.
async function playEvents(s, events, token) {
  const v = s.view;
  const shake = (ms, k) => s.cameras.main.shake(ms, k);
  for (const e of events) {
    if (token !== s.token) return false;
    const u = v[e.who];
    if (e.t === 'order') {
      // Both actions are revealed together; speed decides what lands first.
      s.banner = e.acts.map((a, i) => actLabel(i) + ACTIONS[a].name + (a === 'wait' ? '' : ' ' + e.spd[i])).join('  VS  ');
      e.acts.forEach((a, i) => floatText(s, v[i], ACTIONS[a].name, unitColor(i), 18, 1100));
      s.sfx.tick();
      await wait(s, 650);
    } else if (e.t === 'beat') {
      await wait(s, 80);
    } else if (e.t === 'face') {
      u.facing = e.facing;
      await wait(s, 120);
    } else if (e.t === 'move') {
      s.sfx.move();
      for (const c of e.path) await tweenTo(s, u, c.x, c.y, STEP_MS);
      u.facing = e.facing;
    } else if (e.t === 'bump') {
      floatText(s, u, 'BLOCKED', COLORS.white, 12);
      await wait(s, 300);
    } else if (e.t === 'guard') {
      addFx(s, { kind: 'guard', who: e.who, dur: 4000 });
      s.sfx.blip();
      await wait(s, 250);
    } else if (e.t === 'vslash' || e.t === 'hslash' || e.t === 'lunge' || e.t === 'grab') {
      (e.tiles && e.tiles.length ? e.tiles : [{ x: e.x, y: e.y }]).forEach((t) =>
        addFx(s, { kind: 'cell', x: t.x, y: t.y, color: unitColor(e.who), dur: 450 }),
      );
      if (e.t !== 'grab') addFx(s, { kind: 'sweep', who: e.who, dur: 350 });
      s.sfx.swing();
      await wait(s, 260);
    } else if (e.t === 'miss') {
      floatText(s, u, 'MISS', 0x9aa0b0, 14);
      await wait(s, 350);
    } else if (e.t === 'hit') {
      u.flash = 1;
      s.dispHp[e.who] = Math.max(0, s.dispHp[e.who] - e.dmg);
      const dmgText = '-' + e.dmg + (e.flank ? ' FLANK!' : '') + (e.slam ? ' SLAM!' : '');
      floatText(s, u, dmgText, COLORS.white, 17);
      // Combo bonus: if the target was in a non-normal stance, shout it.
      const targetSt = s.state && s.state.units[e.who] ? s.state.units[e.who].st : 0;
      if (targetSt > ST_NORMAL) floatText(s, u, 'COMBO!', COLORS.bolt, 14);
      shake(140, 0.008);
      s.sfx.hit();
      await wait(s, HIT_PAUSE_MS);
    } else if (e.t === 'parry') {
      floatText(s, u, 'PARRY! +1', COLORS.coast, 17);
      addFx(s, { kind: 'flash', dur: 120 });
      s.sfx.parry();
      await wait(s, HIT_PAUSE_MS);
    } else if (e.t === 'interrupt') {
      floatText(s, u, ACTIONS[e.act].name + ' LOST', COLORS.bolt, 13, 1300);
      await wait(s, 450);
    } else if (e.t === 'knock') {
      for (const c of e.path) await tweenTo(s, u, c.x, c.y, STEP_MS * 0.7);
    } else if (e.t === 'caught') {
      floatText(s, u, 'CAUGHT!', COLORS.bolt, 17);
      s.sfx.hit();
      await wait(s, 400);
    } else if (e.t === 'throw') {
      floatText(s, u, 'THROW!', unitColor(e.who), 17);
      await wait(s, 200);
    } else if (e.t === 'momentum') {
      floatText(s, u, 'MOMENTUM', COLORS.bolt, 13);
    } else if (e.t === 'burst') {
      floatText(s, u, 'BURST!', COLORS.bolt, 17);
      addFx(s, { kind: 'flash', dur: 120 });
      s.sfx.clash();
      await wait(s, 300);
    } else if (e.t === 'stance') {
      const stColors = [0, COLORS.bolt, COLORS.cpu, COLORS.white];
      const stLabel = ['', 'STAGGERED', 'KNOCKBACK', 'DOWN'][e.st];
      addFx(s, { kind: 'flash', color: stColors[e.st] || COLORS.white, dur: 180 });
      if (stLabel) floatText(s, u, stLabel, stColors[e.st] || COLORS.white, 16);
      await wait(s, 250);
    } else if (e.t === 'clash' || e.t === 'mirror') {
      const m = toIso((v[0].gx + v[1].gx) / 2, (v[0].gy + v[1].gy) / 2);
      addFx(s, { kind: 'bolt', pts: makeBoltPoints(m.x, m.y - 24), dur: 550 });
      addFx(s, { kind: 'flash', dur: 180 });
      shake(220, 0.012);
      s.sfx.clash();
      s.banner = e.t === 'clash' ? 'SWORD CLASH!' : 'MIRROR!  BOTH KNOCKED BACK';
      await wait(s, CLASH_PAUSE_MS);
    } else if (e.t === 'clashWin') {
      floatText(s, u, 'WINS CLASH', unitColor(e.who), 17);
      await wait(s, 300);
    }
  }
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

  // Planning previews: reachable tiles, aim arrows, ghost, attack tile.
  let ghost = null;
  const me = s.state.units[0];
  const play = s.mode === 'play';
  const blink = 0.5 + 0.5 * Math.sin(time / 90);
  if (play && (s.phase === 'choose' || s.phase === 'aim') && me.st === ST_NORMAL) {
    const sel = s.sel;
    const a = ACTIONS[sel.act];
    if (s.phase === 'aim' && a.target === 'tile') {
      for (const path of sel.valid.values()) {
        const t = path[path.length - 1];
        drawCell(g, t.x, t.y, COLORS.coast, 0.12, 0.45);
      }
      const path = sel.valid.get(sel.cur.x + ',' + sel.cur.y);
      if (path) {
        g.lineStyle(2, COLORS.white, 0.8);
        g.strokePoints([me, ...path].map((c) => toIso(c.x, c.y)), false);
      }
      drawCell(g, sel.cur.x, sel.cur.y, COLORS.white, 0.15 + 0.15 * blink, 1);
    }
    if (s.phase === 'aim' && a.target === 'dir') {
      for (const [stick, dir] of Object.entries(STICK_TO_DIR)) {
        const n = step(me, dir);
        const p = toIso(n.x, n.y);
        drawArrow(g, p.x, p.y, stick, dir === sel.dir ? COLORS.white : 0x5a6070);
      }
      if (sel.act === 'lunge') {
        const path = dashPath(me, sel.dir, LUNGE_DASH, s.state.units[1]);
        path.forEach((c) => drawCell(g, c.x, c.y, COLORS.bolt, 0.1, 0.5));
      }
      if (sel.act !== 'pivot') {
        const end = previewPlan(me, { act: sel.act, dir: sel.dir }, s.state.units[1]);
        const col = sel.act === 'parry' ? COLORS.white : COLORS.cpu;
        const atkTiles =
          sel.act === 'vslash'
            ? vslashTiles({ x: end.x, y: end.y, facing: sel.dir })
            : sel.act === 'hslash'
            ? hslashTiles({ x: end.x, y: end.y, facing: sel.dir })
            : [step(end, sel.dir)];
        atkTiles.forEach((c) => drawCell(g, c.x, c.y, col, 0.15 + 0.2 * blink, 0.5 + 0.5 * blink));
      }
    }
    if (s.phase === 'aim') {
      const plan = selPlan(s);
      if (plan) ghost = previewPlan(me, plan, s.state.units[1]);
    }
  }
  if (play && s.phase === 'throw') {
    const foe = s.state.units[1];
    for (const [stick, dir] of Object.entries(STICK_TO_DIR)) {
      const n = step(foe, dir);
      if (same(n, me)) continue;
      const p = toIso(n.x, n.y);
      drawArrow(g, p.x, p.y, stick, dir === s.throwDir ? COLORS.white : 0x5a6070);
    }
    const path = dashPath(foe, s.throwDir, THROW_DIST, me);
    path.forEach((c) => drawCell(g, c.x, c.y, COLORS.bolt, 0.15 + 0.15 * blink, 0.8));
  }

  const gu = s.gUnits;
  gu.clear();
  const order = s.view.map((v, i) => ({ v, i })).sort((a, b) => a.v.gy - a.v.gx - (b.v.gy - b.v.gx));
  for (const { v, i } of order) {
    v.flash = Math.max(0, v.flash - delta / 250);
    if (i === 0 && ghost) drawMecha(gu, ghost.x, ghost.y, ghost.facing, COLORS.p1, 0.35, 0, 0);
    drawMecha(gu, v.gx, v.gy, v.facing, unitColor(i), 1, v.flash, v.st);
    const p = toIso(v.gx, v.gy);
    drawMiniBar(gu, p.x, p.y + 12, s.dispHp[i] / HP_MAX, unitColor(i));
    s.ui.tags[i].setPosition(p.x, p.y + 25);
    const stName = ['P1', 'CPU'][i] + (v.st ? '  ' + ['', 'STAGGERED', 'KNOCKBACK', 'DOWN'][v.st] : '');
    setT(s.ui.tags[i], stName);
    const ready = i === 0 ? !!s.p1Plan && s.phase === 'locked' : s.phase === 'locked' || (play && (s.phase === 'choose' || s.phase === 'aim') && time > s.cpuReadyAt);
    if (ready) drawCheck(gu, p.x + 16, p.y - 50, unitColor(i));
  }

  const gt = s.gTop;
  gt.clear();
  s.fx = s.fx.filter((f) => f.until > time);
  for (const f of s.fx) {
    const a = Math.min(1, (f.until - time) / Math.min(f.dur, 400));
    if (f.kind === 'bolt') drawBolt(gt, { pts: f.pts, until: f.until, now: time, dur: f.dur });
    else if (f.kind === 'cell') drawCell(gt, f.x, f.y, f.color, 0.4 * a, a);
    else if (f.kind === 'sweep') drawSweep(gt, s.view[f.who].gx, s.view[f.who].gy, s.view[f.who].facing, unitColor(f.who), a);
    else if (f.kind === 'guard') drawGuard(gt, s.view[f.who].gx, s.view[f.who].gy, s.view[f.who].facing, a);
    else if (f.kind === 'flash') {
      gt.fillStyle(f.color || COLORS.white, 0.35 * a);
      gt.fillRect(0, 0, W, H);
    }
  }
}

const CLASH_OPTS = ['B1 THRUST', 'B2 PARRY', 'B3 FEINT'];

function drawHud(s, time) {
  const g = s.gUi;
  const ui = s.ui;
  g.clear();
  const units = s.state.units;
  const play = s.mode === 'play';

  // Corner panels: name + HP, segmented HP, energy pips, status.
  [0, 1].forEach((i) => {
    const color = unitColor(i);
    const x0 = i ? W - 262 : 12;
    drawLabelSlab(g, x0, 10, 242, 62, color, false);
    const u = units[i];
    for (let k = 0; k < 10; k++) {
      const on = s.dispHp[i] > k * (HP_MAX / 10);
      const sx = i ? W - 50 - k * 20 : 30 + k * 20;
      g.fillStyle(color, on ? 1 : 0.15);
      g.fillRect(sx, 37, 16, 8);
    }
    for (let k = 0; k < GUTS_MAX; k++) {
      const px = i ? W - 38 - k * 16 : 38 + k * 16;
      g.fillStyle(COLORS.bolt, u.guts > k ? 1 : 0.15);
      g.fillPoints(rhombus(px, 58, 6, 6), true);
    }
    setT(ui.names[i], (i ? 'CPU' : 'P1') + '  HP ' + Math.max(0, s.dispHp[i]));
    const stLabel = ['', 'STAGGERED', 'KNOCKBACK', 'DOWN'][u.st] || '';
    const tags = [stLabel, u.momentum && 'MOMENTUM', u.guts >= GUTS_MAX && 'BURST READY'];
    setT(ui.status[i], (stLabel ? 'GUTS  ' : '') + tags.filter(Boolean).join('  '));
  });

  // Info panel (top centre): what the highlighted action does.
  let info = ['', '', ''];
  const aiming = play && (s.phase === 'choose' || s.phase === 'aim') && !units[0].stunned;
  if (aiming) {
    const a = ACTIONS[s.sel.act];
    const plan = selPlan(s) || { act: s.sel.act, dir: units[0].facing };
    info = canUse(units[0], s.sel.act)
      ? [a.name + '   SPD ' + speedOf(units[0], plan), a.info[0], a.info[1]]
      : [a.name + '   LOCKED', 'NEEDS MOMENTUM:', 'MOVE 2 TILES THE TURN BEFORE'];
    drawLabelSlab(g, W / 2 - 134, 10, 260, 58, COLORS.white, false);
  }
  info.forEach((t, k) => setT(ui.info[k], t));

  // Phase label + hints + timer.
  let phase = '';
  let hint = '';
  if (play && aiming && s.phase === 'choose') {
    phase = 'TURN ' + s.state.turn + '  PICK AN ACTION';
    hint = 'STICK CHOOSE   B1 SELECT';
  } else if (play && aiming) {
    phase = 'AIM ' + ACTIONS[s.sel.act].name;
    hint = 'STICK AIM   B1 CONFIRM   B2 BACK';
  } else if (play && s.phase === 'choose' && units[0].st !== ST_NORMAL) {
    const stName = ['', 'STAGGERED', 'KNOCKBACK', 'DOWN'][units[0].st];
    phase = stName;
    hint = 'CANNOT ACT THIS TURN';
  } else if (play && s.phase === 'locked') {
    phase = 'LOCKED IN';
    hint = time > s.cpuReadyAt ? 'BOTH READY' : 'WAITING FOR CPU...';
  } else if (play && s.phase === 'clash') {
    phase = 'SWORD CLASH!  PICK FAST';
    hint = 'PARRY > THRUST > FEINT > PARRY   BURST BEATS THRUST + FEINT';
  } else if (play && s.phase === 'throw') {
    phase = 'CAUGHT!  THROW';
    hint = 'STICK AIM   B1 THROW   (INTO LAND = +10)';
  } else if (s.phase === 'resolve') {
    phase = s.banner;
  }
  setT(ui.phase, play ? phase : '');
  setT(ui.hint, hint);

  // Menu slabs (two columns around P1) or clash slabs.
  const items = [];
  if (play && aiming && s.phase === 'choose') {
    const p = toIso(s.view[0].gx, s.view[0].gy);
    const fullMenu = buildMenu(units[0]);
    fullMenu.forEach((col, ci) => {
      const x = Math.max(70, Math.min(W - 70, p.x + (ci ? 90 : -90)));
      items.push({ x, y: p.y - 112, label: MENU_TITLES[ci], header: true });
      col.forEach((act, ri) => {
        const on = s.menuPos.col === ci && s.menuPos.row === ri;
        items.push({ x, y: p.y - 86 + ri * 26, label: ACTIONS[act].name, on, off: !canUse(units[0], act) });
      });
    });
  } else if (play && s.phase === 'clash') {
    const p = toIso((s.view[0].gx + s.view[1].gx) / 2, (s.view[0].gy + s.view[1].gy) / 2);
    const opts = units[0].guts >= GUTS_MAX ? [...CLASH_OPTS, 'B4 BURST'] : CLASH_OPTS;
    opts.forEach((label, k) => items.push({ x: Math.min(W - 70, p.x + 110), y: p.y - 90 + k * 28, label, clash: true }));
  }
  ui.menu.forEach((t, k) => {
    const it = items[k];
    t.setVisible(!!it);
    if (!it) return;
    if (!it.header) drawLabelSlab(g, it.x - 52, it.y - 10, 100, 20, it.clash ? COLORS.cpu : COLORS.p1, !!it.on);
    t.setColor(it.on ? '#000000' : it.header ? hex(COLORS.p1) : it.off ? '#5a6070' : '#ffffff');
    t.setPosition(it.x, it.y);
    setT(t, it.label);
  });

  if (play && (s.phase === 'choose' || s.phase === 'aim' || s.phase === 'clash' || s.phase === 'throw')) {
    const total = s.phase === 'clash' || s.phase === 'throw' ? CLASH_MS : TURN_MS;
    const left = Math.max(0, s.deadline - time) / total;
    const barW = 300;
    const barX = W / 2 - barW / 2;
    const barY = H - 16;
    // Border.
    g.lineStyle(1.5, COLORS.white, 0.6);
    g.strokeRect(barX - 1, barY - 1, barW + 2, 6);
    // Fill: green→yellow→red as time runs out.
    const barColor = left > 0.5 ? COLORS.p1 : left > 0.25 ? COLORS.bolt : COLORS.cpu;
    g.fillStyle(barColor, 0.9);
    g.fillRect(barX, barY, barW * left, 4);
  }

  // Overlays: attract title + how-to-play cards, or game over.
  let title = '';
  let sub = '';
  let titleColor = COLORS.p1;
  const blinkOn = Math.floor(time / 450) % 2 === 0;
  if (!play) {
    const card = CARDS[Math.floor((time - s.attractStart) / CARD_MS) % CARDS.length];
    title = card[0];
    sub = card[1] + '\n\n' + (blinkOn ? 'PRESS START' : ' ');
  } else if (s.phase === 'over') {
    const o = s.state.over;
    title = o === 'p1' ? 'VICTORY' : o === 'cpu' ? 'DEFEATED' : 'DRAW';
    titleColor = o === 'p1' ? COLORS.p1 : o === 'cpu' ? COLORS.cpu : COLORS.bolt;
    sub = time > s.phaseStart + ATTRACT_OVER_MS && blinkOn ? 'PRESS START' : ' ';
  }
  if (title) {
    drawLabelSlab(g, W / 2 - 210, 116, 420, 46, titleColor, true);
    const lines = sub.split('\n').length;
    g.fillStyle(0x000000, 0.8);
    g.fillRect(W / 2 - 200, 172, 400, lines * 16 + 12);
    ui.sub.setY(178 + (lines * 16) / 2);
  }
  setT(ui.title, title);
  setT(ui.sub, title ? sub : '');
}
