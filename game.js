// Mecha Simultactics: Catatumbo Protocol — Platanus Hack 26 Arcade Challenge
// Simultaneous-turn mecha duel vs CPU over Lake Maracaibo. See SPEC.md / ROADMAP.md.

// Everything lives in an IIFE so the minifier can mangle top-level names (~5KB saved).
(() => {
// == CONSTANTS ==

const W = 800;
const H = 600;

// Palette as standalone consts so the minifier can mangle them.
const C_bg = 0x071019;
const C_p1 = 0x35e9f2;
const C_cpu = 0xff315f;
const C_coast = 0xe2c990;
const C_bolt = 0xffe45c;
const C_white = 0xf4f2e7;
const C_ink = 0x050b12;
const C_water = 0x07556a;
const C_waterHi = 0x08788c;
const C_waterLo = 0x042f41;
const C_land = 0x294c35;
const C_landMid = 0x183426;
const C_landDark = 0x0b211a;
const C_concrete = 0xc8c9c3;
const C_wood = 0x75452f;
const C_rust = 0xb65e3d;

// Iso tile size (px) and vertical extrusions.
const TW = 44;
const TH = 22;
const SLAB_H = 14;
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

// Zone events (P8).
const ZONE_CHANCE = { cat: 0.35, verdin: 0.4 }; // probability per turn
const ZONE_VERDIN_DMG = 8; // slip damage

// Stance ladder: NORMAL→STAGGERED→KNOCKBACK→DOWN
const ST_NORMAL = 0;
const ST_STAGGERED = 1;
const ST_KNOCKBACK = 2;
const ST_DOWN = 3;
const ST_NAME = ['', 'STAGGERED', 'KNOCKBACK', 'DOWN'];

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

const P1_START = { x: 4, y: 8, facing: 'E' }; // Costa occidental: Maracaibo
const CPU_START = { x: 20, y: 8, facing: 'W' }; // Costa oriental: Cabimas

// 0 water · 1 land · 2 bridge · 3 palafito · 4 Catatumbo · 5 void · 6 verdín · 7 oil
// Deterministic 26×26 Maracaibo silhouette: gulf, northern neck, broad body and southern tip.
const LAKE_HALF = [4, 4, 3, 2, 1, 2, 8, 8, 7, 7, 8, 8, 9, 9, 9, 9, 8, 8, 7, 7, 6, 5, 4, 2, 0, -1];
const LAGO_MAP = Array.from({ length: 26 }, (_, y) => Array.from({ length: 26 }, (_, x) => (Math.abs(x - 12) <= LAKE_HALF[y] ? 0 : 1)));
for (const [t, ...p] of [
  [2, 10, 4, 11, 4, 12, 4, 13, 4, 14, 4],
  [3, 18, 9, 19, 9, 20, 12, 21, 12, 20, 15, 21, 15],
  [4, 3, 15, 4, 16, 5, 17],
  [5, 1, 10],
  [6, 4, 6, 9, 8, 16, 11, 8, 18],
  [7, 4, 13, 13, 10, 10, 16, 14, 19],
]) for (let i = 0; i < p.length; i += 2) LAGO_MAP[p[i + 1]][p[i]] = t;
const ROWS = LAGO_MAP.length;
const COLS = LAGO_MAP[0].length;

// Void outside the board is never traversable.
function tileAt(x, y) {
  return x < 0 || y < 0 || x >= COLS || y >= ROWS || x % 1 || y % 1 ? 5 : LAGO_MAP[y][x];
}

function isWalkable(x, y) {
  const t = tileAt(x, y);
  return t !== 3 && t !== 5;
}

function isLake(x, y) {
  const t = tileAt(x, y);
  return t !== 1 && t !== 5;
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
  move: { name: 'MOVE', spd: 100, target: 'tile', range: 3, info: ['FORWARD 3 // SIDE 2 // BACK 1', 'FORWARD 3 = MOMENTUM // FACE MOVE'] },
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

// Classify an attacker relative to a defender's facing at any distance.
// Diagonals read as sides; only a dominant forward/back component is front/back.
function relativeSide(defender, attacker) {
  const f = DIRS[defender.facing];
  const rx = attacker.x - defender.x;
  const ry = attacker.y - defender.y;
  const dot = rx * f.dx + ry * f.dy;
  const cross = rx * f.dy - ry * f.dx;
  return dot > Math.abs(cross) ? 'front' : -dot > Math.abs(cross) ? 'back' : 'side';
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

// Straight cardinal reach. MOVE (range 3) uses facing: forward 3, sides 2, back 1.
// DODGE keeps a uniform one-tile cross.
function reach(s, i, range) {
  const me = s.units[i];
  const foe = s.units[1 - i];
  const out = new Map();
  for (const k of DIR_KEYS) {
    const path = [];
    let c = me;
    const max = range === 3 ? (k === me.facing ? 3 : k === OPPOSITE[me.facing] ? 1 : 2) : range;
    for (let n = 0; n < max; n++) {
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

// Beginning of a turn: DOWN wakes into STAGGERED. Recovery is completed only
// after that unit has spent the turn unable to act and has not been hit again.
function resolveStanceRecovery(u) {
  if (u.st === ST_DOWN) u.st = ST_STAGGERED;
}

// Zone event tiles: 4=Catatumbo, 6=verdín, 7=oil.
const ZONE_TILES = { '4': 'cat', '6': 'verdin', '7': 'oil' };
const ZONE_COLOR = { cat: 0xffff00, verdin: 0x00ff88, oil: 0xff8800 };

// Check a unit's tile, trigger the zone effect. Mutates the unit.
function resolveZone(s, i, events, rnd = Math.random) {
  const u = s.units[i];
  const t = tileAt(u.x, u.y);
  const zone = ZONE_TILES[t];
  if (!zone) return;
  const tag = zone.toUpperCase();
  const color = ZONE_COLOR[zone];
  if (zone === 'cat' && rnd() < ZONE_CHANCE.cat) {
    u.hp = Math.max(0, u.hp - Math.round(SLASH_DMG * 0.5));
    advanceStance(u);
    events.push({ t: 'zone', who: i, zone: tag, dmg: Math.round(SLASH_DMG * 0.5), st: u.st, color });
    return;
  }
  if (zone === 'verdin' && rnd() < ZONE_CHANCE.verdin) {
    u.hp = Math.max(0, u.hp - ZONE_VERDIN_DMG);
    // Push back 1 tile if possible.
    const back = step(u, OPPOSITE[u.facing]);
    let path = [];
    if (isWalkable(back.x, back.y) && !same(back, s.units[1 - i])) {
      u.x = back.x;
      u.y = back.y;
      path = [back];
    }
    events.push({ t: 'zone', who: i, zone: tag, dmg: ZONE_VERDIN_DMG, push: path.length > 0, path, color });
    return;
  }
  if (zone === 'oil') {
    gainGuts(u, 1);
    events.push({ t: 'zone', who: i, zone: tag, dmg: 0, guts: true, color });
  }
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

// H-SLASH: three independent lanes, each stopping at its first solid tile.
function hslashTiles(u) {
  const d = DIRS[u.facing];
  const side = u.facing === 'N' || u.facing === 'S' ? DIRS.E : DIRS.N;
  const out = [];
  for (let lane = -1; lane <= 1; lane++) {
    for (let depth = 1; depth <= 2; depth++) {
      const c = { x: u.x + side.dx * lane + d.dx * depth, y: u.y + side.dy * lane + d.dy * depth };
      if (!isWalkable(c.x, c.y)) break;
      out.push(c);
    }
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
  const start = U.map((u) => ({ x: u.x, y: u.y, facing: u.facing }));
  const events = [];
  const enteredSt = U.map((u) => u.st);
  U.forEach((u, i) => {
    if (u.st === ST_DOWN) {
      resolveStanceRecovery(u);
      events.push({ t: 'stance', who: i, st: u.st });
    }
  });
  const turnSt = U.map((u) => u.st);
  const recovering = enteredSt.map((st) => st !== ST_NORMAL);
  const p = plans.map((plan, i) => {
    plan = plan || WAIT_PLAN;
    const burstEscape = plan.act === 'burst' && canUse(U[i], 'burst');
    return (U[i].st === ST_NORMAL || burstEscape) && canUse(U[i], plan.act) ? plan : WAIT_PLAN;
  });
  const spd = p.map((plan, i) => (plan.act === 'wait' ? 0 : speedOf(U[i], plan)));
  const momentum = [false, false];
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
          events.push({ t: 'move', who: i, path: end[i].path, facing: u.facing, act: p[i].act });
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

  const strike = (i, dmg, flankMult) => {
    const foe = U[1 - i];
    const relation = relativeSide(foe, U[i]);
    const flank = relation !== 'front';
    const total = Math.round(dmg * (flank ? flankMult : 1));
    foe.hp = Math.max(0, foe.hp - total);
    gainGuts(U[i], 1);
    const prevSt = foe.st;
    advanceStance(foe);
    if (prevSt !== foe.st) events.push({ t: 'stance', who: 1 - i, st: foe.st });
    events.push({ t: 'hit', who: 1 - i, dmg: total, flank: flank && flankMult > 1, relation, prevSt });
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
      const path = [], cells = p[i].path || [], dir = dirBetween(U[i], cells[0]);
      const max = a === 'move' ? (dir === start[i].facing ? 3 : dir === OPPOSITE[start[i].facing] ? 1 : 2) : 1;
      let c = U[i];
      for (const t of cells) {
        if (!dir || path.length >= max || !same(t, step(c, dir)) || same(t, U[1 - i]) || !isWalkable(t.x, t.y)) break;
        path.push(t);
        c = t;
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
      if (p[i].act !== 'dodge') U[i].facing = dirBetween(U[i], path[0]);
      U[i].x = last.x;
      U[i].y = last.y;
      if (p[i].act === 'move' && path.length === 3) {
        let c = start[i];
        momentum[i] = path.every((t) => same(t, (c = step(c, start[i].facing))));
      }
      events.push({ t: 'move', who: i, path, facing: U[i].facing, act: p[i].act });
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
      if (guard[1 - i] && relativeSide(foe, u) === 'front') {
        gainGuts(foe, 1);
        advanceStance(u); // parried → staggered
        events.push({ t: 'stance', who: i, st: u.st });
        events.push({ t: 'parry', who: 1 - i });
        continue;
      }
      if (p[i].act === 'vslash' || p[i].act === 'hslash') strike(i, SLASH_DMG, 2);
      else {
        strike(i, LUNGE_DMG, LUNGE_FLANK);
        const to = step(foe, u.facing);
        if (isWalkable(to.x, to.y) && !same(to, u)) {
          foe.x = to.x;
          foe.y = to.y;
          events.push({ t: 'knock', who: 1 - i, path: [to] });
        }
      }
    }

    // Equal-speed mutual GRAB has no player-order bias: both collide and fail.
    const mutualGrab = acting.length === 2 && acting.every((i) => p[i].act === 'grab') && same(frontOf(U[0]), U[1]) && same(frontOf(U[1]), U[0]);
    if (mutualGrab) {
      acting.forEach((i) => {
        const f = frontOf(U[i]);
        events.push({ t: 'grab', who: i, x: f.x, y: f.y });
        events.push({ t: 'bump', who: i });
      });
    } else {
      // Grab ignores parry; the throw direction is chosen next (resolveThrow).
      for (const i of acting) {
        if (p[i].act !== 'grab' || cancelled[i]) continue;
        const f = frontOf(U[i]);
        events.push({ t: 'grab', who: i, x: f.x, y: f.y });
        if (!same(f, U[1 - i])) {
          events.push({ t: 'miss', who: i });
          continue;
        }
        strike(i, GRAB_DMG, 1);
        grab = i;
        events.push({ t: 'caught', who: 1 - i });
        break;
      }
    }

    g.forEach((i) => (done[i] = true));
    if (grab !== null || U.some((u) => u.hp <= 0)) break;
  }

  U.forEach((u, i) => {
    // Only a stance carried into this turn may recover, and only if no new hit
    // advanced it. Newly applied stance always survives this resolve.
    if (recovering[i] && u.st === turnSt[i] && p[i].act !== 'burst') {
      u.st = ST_NORMAL;
      events.push({ t: 'stance', who: i, st: ST_NORMAL });
    }
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
  const prevSt = foe.st;
  foe.st = ST_DOWN;
  gainGuts(me, 1);
  const events = [
    { t: 'throw', who, dir },
    { t: 'knock', who: 1 - who, path },
    { t: 'stance', who: 1 - who, st: ST_DOWN },
    { t: 'hit', who: 1 - who, dmg, slam, prevSt },
  ];
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

function checkOutcome(s) {
  const [a, b] = s.units;
  if (a.hp <= 0 && b.hp <= 0) s.over = 'draw';
  else if (a.hp <= 0) s.over = 'cpu';
  else if (b.hp <= 0) s.over = 'p1';
}

function finishTurn(s) {
  checkOutcome(s);
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
  const paths = [...reach(s, i, 3).values()];
  if (!paths.length) return { act: 'pivot', dir: me.facing };
  const foeReach = reach(s, 1 - i, 3);
  const scored = paths.map((path) => {
    const t = path[path.length - 1];
    const contested = foeReach.has(t.x + ',' + t.y) ? 8 : 0;
    const zoneBonus = tileAt(t.x, t.y) === 7 ? -10 : tileAt(t.x, t.y) === 4 ? 8 : tileAt(t.x, t.y) === 6 ? 6 : 0;
    return { path, score: dist(t, foe) * 10 + (same(t, frontOf(foe)) ? 15 : 0) + contested + zoneBonus + rnd() * 10 };
  });
  scored.sort((a, b) => a.score - b.score);
  const pickIndex = rnd() < 0.7 ? 0 : Math.min(scored.length - 1, 1 + Math.floor(rnd() * 2));
  return { act: 'move', path: scored[pickIndex].path };
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

// Positive world coordinates leave room for the 25×25 plate, pylons and mechas.
const WORLD_W = 1200;
const WORLD_H = 740;
const ISO_OX = WORLD_W / 2 - ((COLS + ROWS - 2) * TW) / 4;
const ISO_OY = 340;

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

// Solid extruded rhombus with a fixed upper-left key light.
function drawPrism(g, cx, cy, hw, hh, h, color, mid = C_landMid, dark = C_landDark) {
  const top = rhombus(cx, cy - h, hw, hh);
  const left = [top[3], top[2], { x: cx, y: cy + hh }, { x: cx - hw, y: cy }];
  const right = [top[2], top[1], { x: cx + hw, y: cy }, { x: cx, y: cy + hh }];
  [[left, mid], [right, dark], [top, color]].forEach(([face, fill]) => {
    g.fillStyle(fill, 1);
    g.fillPoints(face, true);
    g.lineStyle(1, C_ink, 0.9);
    g.strokePoints(face, true);
  });
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
  for (let k = 0; k < edges.length; k++) {
    const [a, b] = edges[k];
    const quad = [a, b, { x: b.x, y: b.y + SLAB_H }, { x: a.x, y: a.y + SLAB_H }];
    g.fillStyle(a.x < b.x ? 0x102b25 : 0x081a1d, 1);
    g.fillPoints(quad, true);
    g.lineStyle(1.5, C_ink, 1);
    g.strokePoints(quad, true);
    g.lineStyle(1, 0x376153, 0.42);
    g.lineBetween(a.x, a.y + 4, b.x, b.y + 4);
    if (k % 3 === 0) {
      const x = (a.x + b.x) / 2;
      const y = (a.y + b.y) / 2 + 9;
      g.fillStyle(0x668071, 0.55);
      g.fillCircle(x, y, 1.2);
    }
  }
}

function drawTiles(g) {
  const landTones = [C_land, 0x31583b, 0x3a5235, 0x24442f];
  const waterTones = [C_water, 0x075f72, 0x08687a, C_waterHi];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const t = tileAt(x, y);
      const pts = cellPts(x, y);
      const c = toIso(x, y);
      const water = t !== 1;
      const hash = (x * 37 + y * 61 + x * y * 7) & 15;
      let color = water ? waterTones[hash & 3] : landTones[hash & 3];
      if (t === 4) color = 0x164957;
      if (t === 6) color = 0x22664a;
      if (t === 7) color = 0x174956;
      g.fillStyle(color, 1);
      g.fillPoints(pts, true);
      g.lineStyle(1, water ? C_waterLo : C_landDark, water ? 0.48 : 0.72);
      g.strokePoints(pts, true);

      // Deterministic micro-texture: short ripples, tiny facets and sparse dither.
      if (water) {
        const ox = (hash % 5) - 2;
        const oy = ((hash * 3) % 5) - 2;
        g.lineStyle(1, hash & 1 ? 0x31a0aa : 0x0a8494, 0.25 + (hash % 3) * 0.08);
        g.lineBetween(c.x - 8 + ox, c.y - 2 + oy, c.x - 1 + ox, c.y - 4 + oy);
        if (hash % 3 === 0) g.lineBetween(c.x + 3, c.y + 3, c.x + 9, c.y + 1);
        if (hash % 5 === 0) {
          g.fillStyle(0xa7d8d2, 0.16);
          g.fillRect(c.x + ox, c.y + oy, 2, 1);
        }
      } else {
        g.lineStyle(1, hash & 1 ? 0x58704b : 0x1d3928, 0.35);
        g.lineBetween(c.x - 7, c.y + (hash % 4) - 2, c.x - 1, c.y + (hash % 4) - 4);
        if (hash % 4 === 0) {
          g.fillStyle(0x75553a, 0.3);
          g.fillTriangle(c.x + 4, c.y - 2, c.x + 9, c.y, c.x + 5, c.y + 2);
        }
      }
      if (t === 4) {
        g.fillStyle(0x1c2638, 0.38);
        g.fillCircle(c.x - 3, c.y - 2, 5);
      } else if (t === 6) {
        g.fillStyle(0x5b9d59, 0.66);
        g.fillCircle(c.x - 5, c.y, 4);
        g.fillCircle(c.x + 5, c.y - 2, 3);
      } else if (t === 7) {
        g.fillStyle(0xd58339, 0.92);
        g.fillCircle(c.x, c.y, 3);
        g.lineStyle(1, C_bolt, 0.55);
        g.strokeCircle(c.x, c.y, 5);
      }
    }
  }
}

// Carved shoreline: charcoal cut with a restrained sunlit rim.
function drawShore(g) {
  for (let pass = 0; pass < 3; pass++) {
    g.lineStyle(pass === 0 ? 5 : pass === 1 ? 2.5 : 1, pass === 0 ? C_ink : pass === 1 ? C_coast : C_white, pass === 2 ? 0.55 : 1);
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (!isLake(x, y)) continue;
        const pts = cellPts(x, y);
        for (const [key, d] of Object.entries(DIRS)) {
          const nx = x + d.dx;
          const ny = y + d.dy;
          if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS || isLake(nx, ny)) continue;
          const [i, j] = EDGE[key];
          const a = pts[i];
          const b = pts[j];
          if (pass < 2) g.lineBetween(a.x, a.y, b.x, b.y);
          else {
            g.lineBetween(a.x, a.y, a.x + (b.x - a.x) * 0.34, a.y + (b.y - a.y) * 0.34);
            g.lineBetween(a.x + (b.x - a.x) * 0.56, a.y + (b.y - a.y) * 0.56, b.x, b.y);
          }
        }
      }
    }
  }
}

function drawHut(g, cx, cy) {
  const hut = (x, y, scale) => {
    const hw = 8 * scale;
    const hh = 4 * scale;
    g.lineStyle(3 * scale, 0x2a1713, 1);
    for (const p of rhombus(x, y, hw, hh)) g.lineBetween(p.x, p.y, p.x, p.y - 10 * scale);
    g.fillStyle(0x02070a, 0.45);
    g.fillPoints(rhombus(x + 5, y + 4, hw + 3, hh + 2), true);
    const base = y - 10 * scale;
    drawPrism(g, x, base, hw, hh, 8 * scale, C_rust, C_wood, 0x3d241f);
    const roof = rhombus(x, base - 8 * scale, hw + 4, hh + 3);
    const apex = { x: x - 2, y: base - 21 * scale };
    g.fillStyle(0xd4774a, 1);
    g.fillPoints([roof[3], roof[2], apex], true);
    g.fillStyle(0x783c32, 1);
    g.fillPoints([roof[2], roof[1], apex], true);
    g.lineStyle(1.5, C_ink, 1);
    g.strokePoints([roof[3], apex, roof[1], roof[2]], true);
    g.fillStyle(0xffc76a, 0.75);
    g.fillRect(x - 2, base - 6 * scale, 4, 3);
  };
  hut(cx - 6, cy, 1);
  hut(cx + 13, cy + 2, 0.72);
  g.lineStyle(2, 0x3d2a21, 1);
  g.lineBetween(cx - 12, cy - 7, cx + 19, cy - 3);
}

// Solid cable-stayed Puente General Rafael Urdaneta across the northern strait.
function drawBridge(g) {
  const row = LAGO_MAP.findIndex((r) => r.includes(2));
  if (row < 0) return;
  const xs = [];
  LAGO_MAP[row].forEach((t, x) => t === 2 && xs.push(x));
  const a = toIso(xs[0] - 1, row);
  const b = toIso(xs[xs.length - 1] + 1, row);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const n = Math.hypot(dx, dy);
  const nx = (-dy / n) * 7;
  const ny = (dx / n) * 7;
  const deck = [
    { x: a.x + nx, y: a.y + ny - DECK_H }, { x: b.x + nx, y: b.y + ny - DECK_H },
    { x: b.x - nx, y: b.y - ny - DECK_H }, { x: a.x - nx, y: a.y - ny - DECK_H },
  ];
  g.fillStyle(0x02070b, 0.5);
  g.fillPoints(deck.map((p) => ({ x: p.x + 8, y: p.y + 11 })), true);
  g.fillStyle(0x46545b, 1);
  g.fillPoints([deck[1], deck[2], { x: deck[2].x, y: deck[2].y + 7 }, { x: deck[1].x, y: deck[1].y + 7 }], true);
  g.fillStyle(C_concrete, 1);
  g.fillPoints(deck, true);
  g.lineStyle(2, C_ink, 1);
  g.strokePoints(deck, true);
  g.lineStyle(1, 0xf2e7c5, 0.85);
  g.lineBetween(a.x, a.y - DECK_H, b.x, b.y - DECK_H);

  for (const x of xs) {
    const t = toIso(x, row);
    g.fillStyle(0x26363d, 0.7);
    g.fillPoints([{ x: t.x - 5, y: t.y + 2 }, { x: t.x + 2, y: t.y - 1 }, { x: t.x + 4, y: t.y + 21 }, { x: t.x - 3, y: t.y + 23 }], true);
    g.lineStyle(1.5, C_ink, 1);
    g.strokePoints([{ x: t.x - 5, y: t.y + 2 }, { x: t.x + 2, y: t.y - 1 }, { x: t.x + 4, y: t.y + 21 }, { x: t.x - 3, y: t.y + 23 }], true);
  }
  for (const x of [xs[0], xs[xs.length - 1]]) {
    const t = toIso(x, row);
    const deckY = t.y - DECK_H;
    const topY = deckY - TOWER_H;
    // Distinct A-frame pylon, cross braces and bright stay cables.
    g.lineStyle(7, 0x596970, 1);
    g.lineBetween(t.x - 9, deckY + 2, t.x, topY);
    g.lineBetween(t.x + 9, deckY + 2, t.x, topY);
    g.lineStyle(3, C_concrete, 1);
    g.lineBetween(t.x - 8, deckY, t.x, topY);
    g.lineBetween(t.x + 8, deckY, t.x, topY);
    g.lineBetween(t.x - 5, topY + 22, t.x + 5, topY + 22);
    g.lineStyle(1.4, 0xf7f2db, 0.92);
    for (let k = 1; k <= 4; k++) {
      const off = (k * TW) / 5;
      g.lineBetween(t.x, topY + 3, t.x - off, deckY + off / 2);
      g.lineBetween(t.x, topY + 3, t.x + off, deckY - off / 2);
    }
    g.fillStyle(C_bolt, 0.9);
    g.fillCircle(t.x, topY, 2);
  }
}

function drawCatatumboLandmark(g) {
  const c = toIso(4, 16);
  g.fillStyle(0x172235, 0.82);
  g.fillCircle(c.x - 9, c.y - 22, 9);
  g.fillCircle(c.x + 3, c.y - 27, 12);
  g.fillCircle(c.x + 15, c.y - 21, 8);
  g.fillStyle(0x263a50, 0.65);
  g.fillEllipse(c.x + 2, c.y - 19, 40, 13);
}

// Static layer: drawn once.
function drawMap(g) {
  drawSlab(g);
  drawTiles(g);
  drawShore(g);
  drawBridge(g);
  drawCatatumboLandmark(g);
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
  g.fillStyle(C_bg, 1);
  g.fillRect(0, 0, WORLD_W, WORLD_H);
  g.fillStyle(0x0b1b27, 1);
  g.fillRect(0, 0, WORLD_W, 390);
  g.fillStyle(0x102633, 1);
  g.fillPoints([{ x: 0, y: 300 }, { x: 220, y: 220 }, { x: 430, y: 290 }, { x: 650, y: 200 }, { x: 900, y: 285 }, { x: WORLD_W, y: 220 }, { x: WORLD_W, y: 430 }, { x: 0, y: 430 }], true);
  g.fillStyle(0x040a10, 1);
  g.fillRect(0, 650, WORLD_W, 90);
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

// Shared 18-piece volumetric model: x=lateral, y=height, z=front.
// Piece = centre xyz, width/height/depth, top x/z scale, material.
const MECH_MODEL = [
  [-7, 3, 3, 13, 6, 15, 0.8, 0.72, 1], [7, 3, 3, 13, 6, 15, 0.8, 0.72, 1],
  [-7, 13, 0, 8, 16, 8, 0.72, 0.8, 0], [7, 13, 0, 8, 16, 8, 0.72, 0.8, 0],
  [-6, 27, 0, 9, 12, 9, 0.82, 0.8, 1], [6, 27, 0, 9, 12, 9, 0.82, 0.8, 1],
  [0, 36, 0, 22, 8, 11, 0.7, 0.78, 0],
  [0, 48, 0, 28, 18, 13, 0.66, 0.72, 1], [0, 50, 7, 23, 9, 4, 0.78, 0.7, 2],
  [0, 49, -8, 19, 18, 6, 0.8, 0.82, 0],
  [-18, 53, 0, 12, 10, 14, 0.72, 0.68, 1], [18, 53, 0, 12, 10, 14, 0.72, 0.68, 1],
  [-18, 43, 0, 7, 11, 7, 0.8, 0.8, 0], [18, 43, 0, 7, 11, 7, 0.8, 0.8, 0],
  [-18, 33, 2, 9, 12, 9, 0.72, 0.76, 1], [18, 33, 2, 9, 12, 9, 0.72, 0.76, 1],
  [0, 64, 1, 14, 11, 12, 0.66, 0.72, 2],
  [18, 31, 15, 3, 4, 26, 0.7, 0.82, 3],
];
const MECH_FACES = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]];
const MECH_PALS = [[0x0c2440, 0x347ab4, 0xdce9ec, 0x36efff], [0x3b1022, 0x9d1e3d, 0xef5571, 0xffd7e0]];

function mechTone(c, k, flash) {
  let r = Math.min(255, (c >> 16) * k), q = Math.min(255, ((c >> 8) & 255) * k), b = Math.min(255, (c & 255) * k);
  flash = Math.min(1, flash * 1.5);
  r = (r + (255 - r) * flash) & 248;
  q = (q + (255 - q) * flash) & 248;
  b = (b + (255 - b) * flash) & 248;
  return (r << 16) | (q << 8) | b;
}

// Tiny orthographic software renderer: transform, pose, back-face cull, light and painter-sort.
function drawMecha(g, gx, gy, facing, color, alpha, flash, stance, pose = 'idle', frame = 0) {
  const c = toIso(gx, gy), d = DIRS[facing], pal = MECH_PALS[color === C_cpu ? 1 : 0];
  const st = stance || 0, tilt = st === ST_STAGGERED ? -0.15 : st === ST_KNOCKBACK ? 0.17 : 0;
  const sn = Math.sin(tilt), co = Math.cos(tilt), down = st === ST_DOWN;
  const lift = pose === 'move' ? [4, 12, 3][frame] : 0;
  const blade = pose === 'hslash'
    ? [[[20, 35, -2], [34, 43, -24]], [[-27, 43, 13], [31, 43, 17]], [[16, 36, 2], [-31, 39, -14]]][frame]
    : pose === 'vslash'
    ? [[[16, 60, 4], [0, 91, 8]], [[17, 46, 4], [1, 20, 34]], [[18, 33, 4], [2, 20, 33]]][frame]
    : null;
  const part = (i, x, y, z) => {
    if (pose === 'move') {
      const leg = i < 6, arm = (i > 11 && i < 16) || i === 17;
      const pivot = leg ? 36 : arm ? 53 : 36;
      const a = leg ? [0.16, 0.42, 0.2][frame] + (i & 1) * 0.04 : arm ? 0.52 : [0.12, 0.3, 0.16][frame];
      const yy = y - pivot, si = Math.sin(a), cs = Math.cos(a);
      y = pivot + yy * cs - z * si + lift;
      z = yy * si + z * cs;
    } else if (blade && i === 17) {
      const a = blade[0], b = blade[1], t = (z - 3) / 25, ox = x - 18, oy = y - 31;
      x = a[0] + (b[0] - a[0]) * t + ox * 0.4;
      y = a[1] + (b[1] - a[1]) * t + oy;
      z = a[2] + (b[2] - a[2]) * t + ox * 0.2;
    } else if (blade && (i === 11 || i === 13 || i === 15)) {
      const q = (i - 9) / 6;
      const a = (pose === 'hslash' ? [[5, -2, -12], [-12, 1, 10], [-20, -4, -6]] : [[-2, 14, -2], [-4, 2, 10], [-5, -6, 12]])[frame];
      x += a[0] * q; y += a[1] * q; z += a[2] * q;
    }
    return [x, y, z];
  };
  const snap = pose === 'idle' ? 2 : 3;
  const project = (x, y, z) => {
    const oy = y;
    if (down) { y *= 0.5; z += oy * 0.08; }
    else [y, z] = [y * co - z * sn, y * sn + z * co];
    const wx = z * d.dx - x * d.dy, wz = z * d.dy + x * d.dx;
    const sx = c.x + (wx + wz) * 0.82, sy = c.y + (wz - wx) * 0.42 - y * 1.06 + (down ? 8 : 0);
    return [wx, y, wz, Math.round(sx / snap) * snap, Math.round(sy / snap) * snap];
  };
  const P = (i, x, y, z) => project(...part(i, x, y, z));
  g.fillStyle(0x010509, 0.7 * alpha);
  g.fillEllipse(c.x + 4, c.y + 5, pose === 'move' ? 34 : 48, pose === 'move' ? 8 : 14);
  const faces = [];
  for (let pi = 0; pi < MECH_MODEL.length; pi++) {
    if (pi === 17 && !blade) continue;
    const p = MECH_MODEL[pi], [x, y, z, w, h, depth, tx, tz, mat] = p, verts = [];
    for (let i = 0; i < 8; i++) {
      const top = i > 3, j = i & 3;
      verts.push(P(pi, x + (j === 0 || j === 3 ? -1 : 1) * w * (top ? tx : 1) / 2, y + (top ? h : -h) / 2, z + (j < 2 ? -1 : 1) * depth * (top ? tz : 1) / 2));
    }
    for (const f of MECH_FACES) {
      const a = verts[f[0]], b = verts[f[1]], e = verts[f[2]];
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = e[0] - a[0], vy = e[1] - a[1], vz = e[2] - a[2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      if (-nx + ny * 0.75 + nz <= 0) continue;
      const len = Math.hypot(nx, ny, nz), light = Math.max(0, (-nx * 0.45 + ny * 0.85 + nz * 0.65) / len);
      const grain = (pi + f[0]) & 1 ? -0.06 : 0.04;
      faces.push({ d: f.reduce((s, i) => s - verts[i][0] + verts[i][1] * 0.75 + verts[i][2], 0) / 4, p: f.map((i) => ({ x: verts[i][3], y: verts[i][4] })), c: mechTone(pal[mat], 0.38 + light * 0.68 + grain, flash) });
    }
  }
  faces.sort((a, b) => a.d - b.d);
  for (const f of faces) {
    g.fillStyle(f.c, alpha); g.fillPoints(f.p, true);
    g.lineStyle(1.35, C_ink, alpha * 0.9); g.strokePoints(f.p, true);
  }
  const energy = flash ? C_white : pal[3];
  if (pose === 'move') for (const x of [-7, 7]) {
    const a = P(9, x, 49, -11), b = P(9, x, 46, -34 - frame * 6);
    g.lineStyle(10, C_ink, alpha); g.lineBetween(a[3], a[4], b[3], b[4]);
    g.lineStyle(6, energy, alpha); g.lineBetween(a[3], a[4], b[3], b[4]);
    g.lineStyle(2, C_white, alpha); g.lineBetween(a[3], a[4], b[3], b[4]);
  }
  // Visor is permanent; the energy blade exists only during an attack pose.
  const va = P(16, -5, 64, 7.3), vb = P(16, 5, 64, 7.3);
  g.lineStyle(4, C_ink, alpha); g.lineBetween(va[3], va[4], vb[3], vb[4]);
  g.lineStyle(2.5, energy, alpha); g.lineBetween(va[3], va[4], vb[3], vb[4]);
  if (blade) {
    const sa = P(17, 18, 31, 3), sb = P(17, 18, 31, 28);
    g.lineStyle(3, energy, alpha); g.lineBetween(sa[3], sa[4], sb[3], sb[4]);
    g.lineStyle(1, C_white, alpha); g.lineBetween(sa[3], sa[4], sb[3], sb[4]);
  }
}

// Angular tactical plate with opposing cuts and a functional accent rail.
function drawLabelSlab(g, x, y, w, h, color, selected) {
  const cut = Math.min(12, h * 0.35);
  const pts = [{ x: x + cut, y }, { x: x + w, y }, { x: x + w - cut, y: y + h }, { x, y: y + h }, { x: x + 5, y: y + 5 }];
  g.fillStyle(0x04090f, 0.94);
  g.fillPoints(pts.map((p) => ({ x: p.x + 3, y: p.y + 4 })), true);
  g.fillStyle(selected ? 0x142d38 : 0x0d1720, 0.96);
  g.fillPoints(pts, true);
  g.lineStyle(selected ? 2.5 : 1.2, selected ? color : 0x50616a, selected ? 1 : 0.72);
  g.strokePoints(pts, true);
  g.lineStyle(selected ? 4 : 2, color, selected ? 1 : 0.5);
  g.lineBetween(x + cut, y, x + Math.min(w * 0.42, 78), y);
}

function drawBolt(g, fx) {
  const life = (fx.until - fx.now) / fx.dur;
  g.lineStyle(3, C_bolt, life);
  g.strokePoints(fx.pts, false);
  g.lineStyle(1, C_white, life);
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

const unitColor = (i) => (i ? C_cpu : C_p1);

// "Locked in" check mark above a unit.
function drawCheck(g, x, y, color) {
  g.fillStyle(0x000000, 0.85);
  g.fillCircle(x, y, 9);
  g.lineStyle(2, color, 1);
  g.strokeCircle(x, y, 9);
  g.lineStyle(2.5, C_white, 1);
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

function drawSweep(g, gx, gy, facing, color, a, kind) {
  const c = toIso(gx, gy), v = dirVec(facing);
  let arc;
  if (kind === 'hslash') {
    const side = dirVec(facing === 'N' || facing === 'S' ? 'E' : 'N');
    arc = [
      { x: c.x + v.x * 0.9 + side.x * 1.55, y: c.y + v.y * 0.9 + side.y * 1.55 - 20 },
      { x: c.x + v.x * 1.8, y: c.y + v.y * 1.8 - 27 },
      { x: c.x + v.x * 0.9 - side.x * 1.55, y: c.y + v.y * 0.9 - side.y * 1.55 - 20 },
    ];
  } else arc = [
    { x: c.x + v.x * 0.25, y: c.y + v.y * 0.25 - 42 },
    { x: c.x + v.x * 1.55, y: c.y + v.y * 1.55 - 26 },
    { x: c.x + v.x * 3, y: c.y + v.y * 3 - 10 },
  ];
  g.lineStyle(12, C_ink, 0.72 * a);
  g.strokePoints(arc, false);
  g.lineStyle(7, color, 0.7 * a);
  g.strokePoints(arc, false);
  g.lineStyle(2.5, C_white, a);
  g.strokePoints(arc, false);
  const q = arc[2];
  g.fillStyle(C_white, a);
  g.fillTriangle(q.x, q.y, q.x - 7, q.y - 5, q.x - 2, q.y + 6);
}

function drawGuard(g, gx, gy, facing, a) {
  const [p, q] = frontEdge(gx, gy, facing, 0.52);
  const shield = [{ x: p.x, y: p.y - 7 }, { x: q.x, y: q.y - 7 }, { x: q.x + 3, y: q.y - 28 }, { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 - 38 }, { x: p.x - 3, y: p.y - 28 }];
  g.fillStyle(0x143c54, 0.38 * a);
  g.fillPoints(shield, true);
  g.lineStyle(7, C_ink, 0.8 * a);
  g.strokePoints(shield, false);
  g.lineStyle(3, C_p1, a);
  g.strokePoints(shield, false);
  g.lineStyle(1.5, C_white, 0.9 * a);
  g.lineBetween(shield[0].x + 3, shield[0].y - 3, shield[3].x, shield[3].y + 5);
  g.lineBetween(shield[3].x, shield[3].y + 5, shield[1].x - 3, shield[1].y - 3);
}

function drawShards(g, x, y, color, a) {
  for (let k = 0; k < 8; k++) {
    const ang = k * 2.399 + 0.3;
    const r = 19 + (k % 3) * 9;
    const sx = x + Math.cos(ang) * r;
    const sy = y + Math.sin(ang) * r * 0.65;
    g.lineStyle(2, k & 1 ? color : C_white, a * 0.7);
    g.lineBetween(x, y, sx, sy);
    g.fillStyle(k & 1 ? color : C_white, a * (0.55 + (k % 2) * 0.35));
    g.fillTriangle(sx, sy, sx - Math.cos(ang + 0.7) * 9, sy - Math.sin(ang + 0.7) * 6, sx - Math.cos(ang - 0.5) * 4, sy - Math.sin(ang - 0.5) * 4);
  }
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
  const arp = (notes) => notes.forEach((f, i) => trackDelay(scene, i * 130, () => tone(f, 0.16, 'square', 0.05)));
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
  backgroundColor: '#071019',
  pixelArt: true,
  antialias: false,
  roundPixels: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: { create, update },
};

new Phaser.Game(config);

const hex = (n) => '#' + n.toString(16).padStart(6, '0');
const MENU_TITLES = ['MOVEMENT', 'COMBAT'];

// Dynamic menu: adds a BURST row to COMBAT when the unit is KNOCKBACK with full guts.
function buildMenu(u) {
  const combat = [...COMBAT_ACTS];
  if (u.st === ST_KNOCKBACK && u.guts >= GUTS_MAX) combat.push('burst');
  return [MOVE_ACTS, combat];
}
const CARDS = [
  ['CATATUMBO PROTOCOL', 'MECHA DUEL // LAKE MARACAIBO'],
  ['PROGRAM', 'PICK ONE ACTION\nSPEED RESOLVES FIRST'],
  ['SWORD CLASH', 'PARRY > THRUST > FEINT > PARRY'],
];

function txt(scene, x, y, size, color, originX = 0) {
  return scene.add
    .text(x, y, '', { fontFamily: 'Arial Black, Impact, monospace', fontSize: size + 'px', fontStyle: 'bold', color, align: 'center', stroke: '#050b12', strokeThickness: size > 15 ? 2 : 1 })
    .setOrigin(originX, 0.5)
    .setDepth(10);
}

function setT(t, s) {
  if (t.text !== s) t.setText(s);
}

function createUi(scene) {
  return {
    names: [txt(scene, 30, 24, 14, hex(C_p1)), txt(scene, W - 30, 24, 14, hex(C_cpu), 1)],
    status: [txt(scene, 100, 58, 11, '#ffffff'), txt(scene, W - 100, 58, 11, '#ffffff', 1)],
    tags: [txt(scene, 0, 0, 10, hex(C_p1), 0.5), txt(scene, 0, 0, 10, hex(C_cpu), 0.5)],
    info: [txt(scene, W / 2, 22, 13, '#ffffff', 0.5), txt(scene, W / 2, 42, 10, '#c8ccd8', 0.5), txt(scene, W / 2, 56, 10, '#c8ccd8', 0.5)],
    phase: txt(scene, W / 2, H - 56, 16, '#ffffff', 0.5),
    hint: txt(scene, W / 2, H - 34, 11, '#9aa0b0', 0.5),
    menu: Array.from({ length: 11 }, () => txt(scene, 0, 0, 12, '#ffffff', 0.5)),
    title: txt(scene, W / 2, 140, 26, '#ffffff', 0.5).setDepth(11),
    sub: txt(scene, W / 2, 196, 13, '#ffffff', 0.5).setDepth(11),
  };
}

function setupCameras(s) {
  const main = s.cameras.main;
  s.camFocus = { x: WORLD_W / 2, y: ISO_OY };
  s.hudCam = s.cameras.add ? s.cameras.add(0, 0, W, H) : { ignore() {} };
  if (!s.cameras.add) return;
  main.setBounds(0, 0, WORLD_W, WORLD_H).setDeadzone(64, 44).startFollow(s.camFocus, false, 0.09, 0.09);
  const fixed = Object.values(s.ui).flat().filter((o) => !s.ui.tags.includes(o));
  main.ignore([s.gUi, ...fixed]);
  s.hudCam.ignore([s.gBg, s.gMap, s.gFx, s.gUnits, s.gTop, ...s.ui.tags]);
}

function updateCamera(s, snap) {
  const cam = s.cameras.main;
  if (!cam.setZoom) return;
  let p, zoom;
  if (s.mode === 'attract') {
    p = toIso(12, 13);
    zoom = 0.65;
  } else if (s.phase === 'clash') {
    p = toIso((s.view[0].gx + s.view[1].gx) / 2, (s.view[0].gy + s.view[1].gy) / 2);
    zoom = 1.5;
  } else {
    const u = s.view[0], d = dirVec(u.facing);
    p = toIso(u.gx, u.gy);
    p.x += d.x * 2;
    p.y += d.y * 2 - 32;
    zoom = 1.42;
  }
  s.camFocus.x = p.x;
  s.camFocus.y = p.y;
  cam.setZoom(snap ? zoom : cam.zoom + (zoom - cam.zoom) * 0.08);
  if (snap) cam.centerOn(p.x, p.y);
}

function screenPoint(s, p) {
  const c = s.cameras.main;
  return c.worldView ? { x: (p.x - c.worldView.x) * c.zoom, y: (p.y - c.worldView.y) * c.zoom } : p;
}

function create() {
  this.controls = createControls(this);
  this.gBg = this.add.graphics();
  drawBackground(this.gBg);
  this.gMap = this.add.graphics();
  drawMap(this.gMap);
  this.gFx = this.add.graphics();
  this.gUnits = this.add.graphics();
  this.gTop = this.add.graphics();
  this.gUi = this.add.graphics();
  this.ui = createUi(this);
  setupCameras(this);
  this.ownTimers = [];
  this.ownTweens = [];
  this.floaters = [];
  this.sfx = createAudio(this);
  this.token = 0;
  this.attractStart = 0;
  resetMatch(this, 'attract');
}

function update(time, delta) {
  handleInput(this, time);
  updateCamera(this);
  drawWorld(this, time, delta);
  drawHud(this, time);
}

// --- Match flow ---

function clearPressed(controls) {
  for (const k in controls.pressed) controls.pressed[k] = false;
}

function trackDelay(s, ms, fn, onCancel) {
  const entry = { done: false, ev: null };
  const remove = () => {
    const i = s.ownTimers.indexOf(entry);
    if (i >= 0) s.ownTimers.splice(i, 1);
  };
  entry.run = () => {
    if (entry.done) return;
    entry.done = true;
    remove();
    fn();
  };
  entry.cancel = () => {
    if (entry.done) return;
    entry.done = true;
    if (entry.ev && entry.ev.remove) entry.ev.remove(false);
    remove();
    if (onCancel) onCancel();
  };
  entry.ev = s.time.delayedCall(ms, entry.run);
  s.ownTimers.push(entry);
  return entry;
}

function wait(s, ms) {
  return new Promise((res) => trackDelay(s, ms, res, res));
}

function clearAsync(s) {
  (s.ownTimers || []).slice().forEach((e) => e.cancel());
  (s.ownTweens || []).slice().forEach((e) => e.cancel());
  (s.floaters || []).slice().forEach((t) => t.destroy && t.destroy());
  s.ownTimers = [];
  s.ownTweens = [];
  s.floaters = [];
}

function resetMatch(s, mode) {
  clearAsync(s);
  s.token++;
  s.mode = mode;
  s.state = newState();
  s.view = s.state.units.map((u) => ({ gx: u.x, gy: u.y, facing: u.facing, st: 0, flash: 0, pose: 'idle', frame: 0 }));
  s.dispHp = [HP_MAX, HP_MAX];
  s.fx = [];
  s.lastP1Pick = null;
  s.clashResolve = null;
  s.throwResolve = null;
  s.menuPos = { col: 0, row: 0 };
  if (mode === 'attract') s.attractStart = s.time.now;
  beginTurn(s);
  updateCamera(s, true);
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
  const menu = buildMenu(s.state.units[0]);
  s.menuPos.col = Math.max(0, Math.min(1, s.menuPos.col));
  s.menuPos.row = Math.max(0, Math.min(menu[s.menuPos.col].length - 1, s.menuPos.row));
  s.sel = { act: menu[s.menuPos.col][s.menuPos.row], dir: s.state.units[0].facing, cur: null };
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
  if (!a || (me.st !== ST_NORMAL && s.sel.act !== 'burst') || !canUse(me, s.sel.act)) return s.sfx.tick();
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

  const canBurst = s.state.units[0].st === ST_KNOCKBACK && canUse(s.state.units[0], 'burst');
  if (s.state.units[0].st !== ST_NORMAL && !canBurst) {
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

  // Zone events: check both final tiles, then adjudicate without advancing twice.
  if (!s.state.over) {
    const zEvents = [];
    resolveZone(s.state, 0, zEvents);
    resolveZone(s.state, 1, zEvents);
    checkOutcome(s.state);
    if (zEvents.length && !(await playEvents(s, zEvents, token))) return;
  }

  s.dispHp = s.state.units.map((u) => u.hp);
  s.view.forEach((v, i) => {
    const u = s.state.units[i];
    Object.assign(v, { gx: u.x, gy: u.y, facing: u.facing, st: u.st, pose: 'idle', frame: 0 });
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

function tweenTo(s, o, x, y, ms) {
  return new Promise((res) => {
    const entry = { done: false, tw: null };
    const finish = () => {
      if (entry.done) return;
      entry.done = true;
      const i = s.ownTweens.indexOf(entry);
      if (i >= 0) s.ownTweens.splice(i, 1);
      res();
    };
    entry.cancel = () => {
      if (entry.tw && entry.tw.stop) entry.tw.stop();
      finish();
    };
    entry.tw = s.tweens.add({ targets: o, gx: x, gy: y, duration: ms, ease: 'Sine.easeInOut', onComplete: finish });
    s.ownTweens.push(entry);
  });
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
  s.hudCam.ignore(t);
  s.floaters.push(t);
  const entry = { done: false, tw: null };
  const finish = () => {
    if (entry.done) return;
    entry.done = true;
    let i = s.ownTweens.indexOf(entry);
    if (i >= 0) s.ownTweens.splice(i, 1);
    i = s.floaters.indexOf(t);
    if (i >= 0) s.floaters.splice(i, 1);
    t.destroy();
  };
  entry.cancel = () => {
    if (entry.tw && entry.tw.stop) entry.tw.stop();
    finish();
  };
  entry.tw = s.tweens.add({ targets: t, y: t.y - 26, alpha: 0, delay: life * 0.4, duration: life * 0.6, onComplete: finish });
  s.ownTweens.push(entry);
}

const actLabel = (i) => (i ? 'CPU ' : 'P1 ');

// Play one resolution step by step so the order of actions reads clearly.
async function playEvents(s, events, token) {
  const v = s.view;
  const shake = (ms, k) => s.cameras.main.shake(ms, k);
  for (let ei = 0; ei < events.length; ei++) {
    const e = events[ei];
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
      // Consecutive moves in a beat animate together.
      let end = ei;
      while (end < events.length && events[end].t === 'move') end++;
      const batch = events.slice(ei, end);
      batch.forEach(() => s.sfx.move());
      await Promise.all(batch.map(async (m) => {
        const mover = v[m.who], thrust = m.act === 'move' || m.act === 'lunge';
        const steps = m.path.length * 3;
        let n = 0;
        if (thrust) { mover.pose = 'move'; mover.facing = m.facing; }
        for (const c of m.path) {
          const x = mover.gx, y = mover.gy;
          for (let f = 0; f < 3; f++, n++) {
            if (thrust) mover.frame = n === 0 ? 0 : n === steps - 1 ? 2 : 1;
            await tweenTo(s, mover, x + (c.x - x) * (f + 1) / 3, y + (c.y - y) * (f + 1) / 3, STEP_MS / 3);
          }
        }
        mover.facing = m.facing;
        mover.pose = 'idle'; mover.frame = 0;
      }));
      ei = end - 1;
    } else if (e.t === 'bump') {
      floatText(s, u, 'BLOCKED', C_white, 12);
      await wait(s, 300);
    } else if (e.t === 'guard') {
      addFx(s, { kind: 'guard', who: e.who, dur: 4000 });
      s.sfx.blip();
      await wait(s, 250);
    } else if (e.t === 'vslash' || e.t === 'hslash' || e.t === 'lunge' || e.t === 'grab') {
      (e.tiles && e.tiles.length ? e.tiles : [{ x: e.x, y: e.y }]).forEach((t) =>
        addFx(s, { kind: 'cell', x: t.x, y: t.y, color: unitColor(e.who), dur: 450 }),
      );
      const slash = e.t === 'vslash' || e.t === 'hslash', attack = slash || e.t === 'lunge';
      if (attack) {
        u.pose = slash ? e.t : 'vslash'; u.frame = 0;
        await wait(s, slash ? 140 : 90);
        u.frame = 1;
        addFx(s, { kind: 'sweep', who: e.who, act: e.t, dur: slash ? 220 : 200 });
        s.sfx.swing();
        await wait(s, 90);
        u.frame = 2;
        await wait(s, slash ? 110 : 70);
        u.pose = 'idle'; u.frame = 0;
      } else await wait(s, 260);
    } else if (e.t === 'miss') {
      floatText(s, u, 'MISS', 0x9aa0b0, 14);
      await wait(s, 350);
    } else if (e.t === 'hit') {
      u.flash = 1;
      const hitAt = toIso(u.gx, u.gy);
      addFx(s, { kind: 'shards', x: hitAt.x, y: hitAt.y - 30, color: e.who ? C_cpu : C_p1, dur: 380 });
      s.dispHp[e.who] = Math.max(0, s.dispHp[e.who] - e.dmg);
      const dmgText = 'HIT!! -' + e.dmg + (e.flank ? ' FLANK!' : '') + (e.slam ? ' SLAM!' : '');
      floatText(s, u, dmgText, C_white, 17);
      // Combo bonus: if the target was in a non-normal stance, shout it.
      const targetSt = e.prevSt || ST_NORMAL;
      if (targetSt > ST_NORMAL) floatText(s, u, 'COMBO!', C_bolt, 14);
      shake(140, 0.008);
      s.sfx.hit();
      await wait(s, HIT_PAUSE_MS);
    } else if (e.t === 'parry') {
      floatText(s, u, 'PARRY! +1', C_coast, 17);
      addFx(s, { kind: 'flash', dur: 120 });
      s.sfx.parry();
      await wait(s, HIT_PAUSE_MS);
    } else if (e.t === 'interrupt') {
      floatText(s, u, ACTIONS[e.act].name + ' LOST', C_bolt, 13, 1300);
      await wait(s, 450);
    } else if (e.t === 'knock') {
      for (const c of e.path) await tweenTo(s, u, c.x, c.y, STEP_MS * 0.7);
    } else if (e.t === 'caught') {
      floatText(s, u, 'CAUGHT!', C_bolt, 17);
      s.sfx.hit();
      await wait(s, 400);
    } else if (e.t === 'throw') {
      floatText(s, u, 'THROW!', unitColor(e.who), 17);
      await wait(s, 200);
    } else if (e.t === 'momentum') {
      floatText(s, u, 'MOMENTUM', C_bolt, 13);
    } else if (e.t === 'burst') {
      u.st = ST_NORMAL;
      floatText(s, u, 'BURST!', C_bolt, 17);
      addFx(s, { kind: 'flash', dur: 120 });
      s.sfx.clash();
      await wait(s, 300);
    } else if (e.t === 'stance') {
      u.st = e.st;
      const stColors = [C_coast, C_bolt, C_cpu, C_white];
      const stLabel = ['RECOVERED', 'STAGGERED', 'KNOCKBACK', 'DOWN'][e.st];
      addFx(s, { kind: 'flash', color: stColors[e.st] || C_white, dur: 180 });
      if (stLabel) floatText(s, u, stLabel, stColors[e.st] || C_white, 16);
      await wait(s, 250);
    } else if (e.t === 'zone') {
      const zLabel = e.zone + (e.dmg ? ' -' + e.dmg : '') + (e.guts ? ' +1 GUTS' : '') + (e.push ? ' SLIP!' : '') + (e.st ? ' ' + ST_NAME[e.st] : '');
      if (e.zone === 'CAT') {
        const strike = toIso(u.gx, u.gy);
        addFx(s, { kind: 'bolt', pts: makeBoltPoints(strike.x, strike.y - 22), dur: 500 });
        addFx(s, { kind: 'shards', x: strike.x, y: strike.y - 20, color: C_bolt, dur: 420 });
      }
      floatText(s, u, zLabel, e.color || C_bolt, 14);
      if (e.dmg) {
        s.dispHp[e.who] = Math.max(0, s.dispHp[e.who] - e.dmg);
        u.flash = 0.6;
        shake(100, 0.006);
        s.sfx.hit();
      }
      if (e.st !== undefined) u.st = e.st;
      if (e.path && e.path.length) {
        for (const c of e.path) await tweenTo(s, u, c.x, c.y, STEP_MS * 0.7);
      }
      if (e.guts) s.sfx.blip();
      addFx(s, { kind: 'flash', color: e.color || C_bolt, dur: 100 });
      await wait(s, 400);
    } else if (e.t === 'clash' || e.t === 'mirror') {
      const m = toIso((v[0].gx + v[1].gx) / 2, (v[0].gy + v[1].gy) / 2);
      addFx(s, { kind: 'bolt', pts: makeBoltPoints(m.x, m.y - 24), dur: 550 });
      addFx(s, { kind: 'shards', x: m.x, y: m.y - 24, color: C_cpu, dur: 520 });
      addFx(s, { kind: 'flash', dur: 180 });
      shake(220, 0.012);
      s.sfx.clash();
      s.banner = e.t === 'clash' ? 'CLASH!!' : 'MIRROR!  BOTH KNOCKED BACK';
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
      const zone = ZONE_TILES[tileAt(x, y)];
      if (!zone) continue;
      const pulse = zone === 'cat' ? flicker : 0.07 + 0.06 * Math.sin(time / 250 + x + y);
      g.fillStyle(ZONE_COLOR[zone], pulse);
      g.fillPoints(cellPts(x, y), true);
    }
  }

  // Planning previews: reachable tiles, aim arrows, ghost, attack tile.
  let ghost = null;
  const me = s.state.units[0];
  const play = s.mode === 'play';
  const blink = 0.5 + 0.5 * Math.sin(time / 90);
  const planning = me.st === ST_NORMAL || (me.st === ST_KNOCKBACK && canUse(me, 'burst'));
  if (play && (s.phase === 'choose' || s.phase === 'aim') && planning) {
    const sel = s.sel;
    const a = ACTIONS[sel.act];
    if (s.phase === 'aim' && a.target === 'tile') {
      for (const path of sel.valid.values()) {
        const t = path[path.length - 1];
        drawCell(g, t.x, t.y, 0x43f08a, 0.14, 0.65);
      }
      const path = sel.valid.get(sel.cur.x + ',' + sel.cur.y);
      if (path) {
        g.lineStyle(2, C_white, 0.8);
        g.strokePoints([me, ...path].map((c) => toIso(c.x, c.y)), false);
      }
      drawCell(g, sel.cur.x, sel.cur.y, C_white, 0.15 + 0.15 * blink, 1);
    }
    if (s.phase === 'aim' && a.target === 'dir') {
      for (const [stick, dir] of Object.entries(STICK_TO_DIR)) {
        const n = step(me, dir);
        const p = toIso(n.x, n.y);
        drawArrow(g, p.x, p.y, stick, dir === sel.dir ? C_white : 0x5a6070);
      }
      if (sel.act === 'lunge') {
        const path = dashPath(me, sel.dir, LUNGE_DASH, s.state.units[1]);
        path.forEach((c) => drawCell(g, c.x, c.y, C_bolt, 0.1, 0.5));
      }
      if (sel.act !== 'pivot') {
        const end = previewPlan(me, { act: sel.act, dir: sel.dir }, s.state.units[1]);
        const col = sel.act === 'parry' ? C_white : C_cpu;
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
      drawArrow(g, p.x, p.y, stick, dir === s.throwDir ? C_white : 0x5a6070);
    }
    const path = dashPath(foe, s.throwDir, THROW_DIST, me);
    path.forEach((c) => drawCell(g, c.x, c.y, C_bolt, 0.15 + 0.15 * blink, 0.8));
  }

  const gu = s.gUnits;
  gu.clear();
  const order = s.view.map((v, i) => ({ v, i })).sort((a, b) => a.v.gy - a.v.gx - (b.v.gy - b.v.gx));
  for (const { v, i } of order) {
    v.flash = Math.max(0, v.flash - delta / 250);
    if (i === 0 && ghost) drawMecha(gu, ghost.x, ghost.y, ghost.facing, C_p1, 0.35, 0, 0, 'idle', 0);
    drawMecha(gu, v.gx, v.gy, v.facing, unitColor(i), 1, v.flash, v.st, v.pose, v.frame);
    const p = toIso(v.gx, v.gy);
    const n = s.view[1 - i];
    const near = Math.abs(v.gx - n.gx) + Math.abs(v.gy - n.gy) < 3;
    const off = near ? Math.sign(v.gx + v.gy - n.gx - n.gy || i * 2 - 1) * 22 : 0;
    drawMiniBar(gu, p.x + off, p.y + 12, s.dispHp[i] / HP_MAX, unitColor(i));
    s.ui.tags[i].setPosition(p.x + off, p.y + 25);
    const stName = ['P1', 'CPU'][i] + (v.st ? '  ' + ST_NAME[v.st] : '');
    setT(s.ui.tags[i], stName);
    const ready = i === 0 ? !!s.p1Plan && s.phase === 'locked' : s.phase === 'locked' || (play && (s.phase === 'choose' || s.phase === 'aim') && time > s.cpuReadyAt);
    if (ready) drawCheck(gu, p.x + 16, p.y - 50, unitColor(i));
  }

  const gt = s.gTop;
  gt.clear();
  if (play) {
    const p = toIso(s.view[1].gx, s.view[1].gy);
    const r = 27 + blink * 3;
    gt.lineStyle(2, C_cpu, 0.4 + blink * 0.5);
    gt.strokeCircle(p.x, p.y - 30, r);
    gt.lineBetween(p.x - r - 7, p.y - 30, p.x - r + 5, p.y - 30);
    gt.lineBetween(p.x + r - 5, p.y - 30, p.x + r + 7, p.y - 30);
  }
  s.fx = s.fx.filter((f) => f.until > time);
  for (const f of s.fx) {
    const a = Math.min(1, (f.until - time) / Math.min(f.dur, 400));
    if (f.kind === 'bolt') drawBolt(gt, { pts: f.pts, until: f.until, now: time, dur: f.dur });
    else if (f.kind === 'cell') drawCell(gt, f.x, f.y, f.color, 0.4 * a, a);
    else if (f.kind === 'sweep') drawSweep(gt, s.view[f.who].gx, s.view[f.who].gy, s.view[f.who].facing, unitColor(f.who), a, f.act);
    else if (f.kind === 'guard') drawGuard(gt, s.view[f.who].gx, s.view[f.who].gy, s.view[f.who].facing, a);
    else if (f.kind === 'shards') drawShards(gt, f.x, f.y, f.color, a);
    else if (f.kind === 'flash') {
      gt.fillStyle(f.color || C_white, 0.35 * a);
      gt.fillRect(0, 0, W, H);
    }
  }
}

function drawHud(s, time) {
  const g = s.gUi;
  const ui = s.ui;
  g.clear();
  const units = s.state.units;
  const play = s.mode === 'play';
  const arc = (x, y, r, a, b, color, width, alpha = 1) => {
    g.lineStyle(width, color, alpha);
    g.beginPath();
    g.arc(x, y, r, a, b, false);
    g.strokePath();
  };

  // Compact opposing pilot panels with one thick, legible HP rail.
  [0, 1].forEach((i) => {
    const color = unitColor(i);
    const x0 = i ? W - 234 : 12;
    const u = units[i];
    drawLabelSlab(g, x0, 9, 222, 56, color, false);
    const bx = x0 + 12;
    const bw = 198;
    const hp = Math.max(0, s.dispHp[i]) / HP_MAX;
    g.fillStyle(0x02070c, 1);
    g.fillRect(bx, 34, bw, 11);
    g.fillStyle(color, 0.95);
    if (i) g.fillRect(bx + bw * (1 - hp), 35, bw * hp, 9);
    else g.fillRect(bx, 35, bw * hp, 9);
    g.lineStyle(1, C_ink, 0.9);
    for (let k = 1; k < 10; k++) g.lineBetween(bx + (bw * k) / 10, 35, bx + (bw * k) / 10, 44);
    for (let k = 0; k < GUTS_MAX; k++) {
      const px = i ? x0 + 202 - k * 14 : x0 + 18 + k * 14;
      g.fillStyle(C_bolt, u.guts > k ? 1 : 0.16);
      g.fillPoints(rhombus(px, 56, 5, 5), true);
      g.lineStyle(1, C_bolt, 0.55);
      g.strokePoints(rhombus(px, 56, 5, 5), true);
    }
    ui.names[i].setPosition(i ? W - 28 : 28, 21);
    ui.status[i].setPosition(i ? W - 84 : 84, 57);
    setT(ui.names[i], (i ? 'CPU CABIMAS' : 'P1 MARACAIBO') + ' // HP ' + Math.max(0, s.dispHp[i]));
    const stLabel = ST_NAME[u.st] || '';
    setT(ui.status[i], [stLabel, u.momentum && 'MOMENTUM', u.guts >= GUTS_MAX && 'BURST READY'].filter(Boolean).join(' // '));
  });

  // Reserved top-centre action telemetry, clear of both HP panels.
  let info = ['', '', ''];
  const canBurstNow = units[0].st === ST_KNOCKBACK && canUse(units[0], 'burst');
  const aiming = play && (s.phase === 'choose' || s.phase === 'aim') && (units[0].st === ST_NORMAL || canBurstNow);
  if (aiming) {
    const a = ACTIONS[s.sel.act];
    const plan = selPlan(s) || { act: s.sel.act, dir: units[0].facing };
    const available = (units[0].st === ST_NORMAL || s.sel.act === 'burst') && canUse(units[0], s.sel.act);
    info = available
      ? [a.name + '  //  SPD ' + speedOf(units[0], plan), a.info[0], a.info[1]]
      : [a.name + '  //  LOCKED', units[0].st === ST_NORMAL ? 'NEEDS MOMENTUM' : 'ONLY BURST BREAKS KNOCKBACK', units[0].st === ST_NORMAL ? 'MOVE FORWARD 3 TILES THE TURN BEFORE' : 'FULL GUTS REQUIRED'];
    drawLabelSlab(g, 244, 9, 312, 56, C_p1, false);
  }
  info.forEach((t, k) => setT(ui.info[k], t));

  // Phase/hint copy remains input-accurate; the rail keeps it off the board.
  let phase = '';
  let hint = '';
  if (play && aiming && s.phase === 'choose') {
    phase = 'TURN ' + s.state.turn + '  //  PICK AN ACTION';
    hint = 'LEFT/RIGHT CATEGORY   UP/DOWN ACTION   B1 SELECT';
  } else if (play && aiming) {
    phase = 'AIM // ' + ACTIONS[s.sel.act].name;
    hint = 'STICK AIM   B1 CONFIRM   B2 BACK';
  } else if (play && s.phase === 'choose' && units[0].st !== ST_NORMAL) {
    phase = ST_NAME[units[0].st];
    hint = 'CANNOT ACT THIS TURN';
  } else if (play && s.phase === 'locked') {
    phase = 'COMMAND LOCKED';
    hint = time > s.cpuReadyAt ? 'BOTH PILOTS READY' : 'ENEMY COMMAND ENCRYPTED...';
  } else if (play && s.phase === 'clash') {
    phase = 'SWORD CLASH // PICK FAST';
    hint = 'PARRY > THRUST > FEINT > PARRY   BURST BEATS THRUST + FEINT';
  } else if (play && s.phase === 'throw') {
    phase = 'TARGET CAPTURED // THROW';
    hint = 'STICK AIM   B1 THROW   IMPACT LAND FOR +10';
  } else if (s.phase === 'resolve') phase = s.banner;
  setT(ui.phase, play ? phase : '');
  setT(ui.hint, hint);

  const items = [];
  if (play && aiming && s.phase === 'choose') {
    const p = screenPoint(s, toIso(s.view[0].gx, s.view[0].gy));
    const cx = Math.max(170, Math.min(W - 170, p.x));
    const cy = Math.max(160, Math.min(H - 165, p.y - 34));
    // Compact tactical dial; labels carry the command hierarchy.
    const fullMenu = buildMenu(units[0]);
    items.push({ kind: 'cat', x: cx - 112, y: cy - 76, label: MENU_TITLES[0], on: s.menuPos.col === 0 });
    items.push({ kind: 'cat', x: cx + 112, y: cy - 76, label: MENU_TITLES[1], on: s.menuPos.col === 1 });
    const col = fullMenu[s.menuPos.col];
    const side = s.menuPos.col ? 1 : -1;
    const ax = Math.max(68, Math.min(W - 68, cx + side * 128));
    const y0 = Math.max(118, Math.min(H - 177 - col.length * 22, cy - ((col.length - 1) * 22) / 2));
    arc(cx, cy - 8, 112, side > 0 ? -1 : 2.1, side > 0 ? 1 : 4.2, C_p1, 2, 0.4);
    col.forEach((act, ri) => {
      const d = ri - (col.length - 1) / 2;
      items.push({ kind: 'act', x: ax - side * d * d * 4, y: y0 + ri * 24, label: ACTIONS[act].name, on: s.menuPos.row === ri, off: !canUse(units[0], act) });
    });
  } else if (play && s.phase === 'clash') {
    const p = screenPoint(s, toIso((s.view[0].gx + s.view[1].gx) / 2, (s.view[0].gy + s.view[1].gy) / 2));
    const cx = Math.max(120, Math.min(W - 120, p.x));
    const cy = Math.max(150, Math.min(H - 170, p.y - 26));
    arc(cx, cy, 62, -2.8, 0.35, 0x2d0713, 16, 0.82);
    arc(cx, cy, 62, -2.8, 0.35, C_cpu, 4, 1);
    arc(cx, cy, 79, -0.15, 2.65, C_cpu, 3, 0.65);
    drawShards(g, cx, cy, C_cpu, 0.9);
    const opts = units[0].guts >= GUTS_MAX ? ['THRUST', 'PARRY', 'FEINT', 'BURST'] : ['THRUST', 'PARRY', 'FEINT'];
    const side = cx < 530 ? 1 : -1;
    const cardX = side > 0 ? Math.min(W - 174, cx + 88) : Math.max(14, cx - 262);
    const cardY = Math.max(100, Math.min(H - 170 - opts.length * 43, cy - 83));
    opts.forEach((name, k) => {
      const x = cardX + (k % 2 ? 13 : 0) * side;
      const y = cardY + k * 43;
      const w = 160;
      const cut = 17 + (k % 2) * 8;
      const card = side > 0
        ? [{ x: x + cut, y }, { x: x + w, y: y + 4 }, { x: x + w - 12, y: y + 38 }, { x, y: y + 34 }]
        : [{ x, y: y + 4 }, { x: x + w - cut, y }, { x: x + w, y: y + 34 }, { x: x + 12, y: y + 38 }];
      g.fillStyle(0x010308, 0.97);
      g.fillPoints(card, true);
      g.lineStyle(4, C_cpu, 1);
      g.strokePoints(card, true);
      g.lineStyle(1.5, 0xff91a9, 0.8);
      g.lineBetween(x + 15, y + 32, x + 113, y + 35);
      items.push({ kind: 'clash', x: x + 76, y: y + 18, label: name });
      items.push({ kind: 'key', x: x + 137, y: y + 20, label: 'B' + (k + 1) });
    });
  }

  ui.menu.forEach((t, k) => {
    const it = items[k];
    t.setVisible(!!it);
    if (!it) return;
    // Pool objects stay API-minimal for the cabinet harness; geometry carries hierarchy.
    if (it.kind === 'cat') drawLabelSlab(g, it.x - 47, it.y - 11, 94, 22, C_p1, it.on);
    if (it.kind === 'act') drawLabelSlab(g, it.x - (it.on ? 59 : 52), it.y - 10, it.on ? 118 : 104, 20, C_p1, it.on);
    t.setColor(it.on || it.kind === 'clash' ? '#ffffff' : it.kind === 'key' ? '#ff9ab1' : it.off ? '#53616a' : it.kind === 'cat' ? hex(C_coast) : '#dce5e5');
    t.setPosition(it.x, it.y);
    setT(t, it.label);
  });

  // Cohesive lower phase rail and time pressure meter.
  if (play && phase) {
    g.fillStyle(0x03080e, 0.9);
    g.fillPoints([{ x: 0, y: 530 }, { x: 145, y: 530 }, { x: 165, y: 538 }, { x: 635, y: 538 }, { x: 655, y: 530 }, { x: W, y: 530 }, { x: W, y: H }, { x: 0, y: H }], true);
    g.lineStyle(2, s.phase === 'clash' ? C_cpu : C_p1, 0.75);
    g.lineBetween(145, 530, 655, 530);
  }
  if (play && ['choose', 'aim', 'clash', 'throw'].includes(s.phase)) {
    const total = s.phase === 'clash' || s.phase === 'throw' ? CLASH_MS : TURN_MS;
    const left = Math.max(0, s.deadline - time) / total;
    const barW = 430;
    const barX = W / 2 - barW / 2;
    const barColor = left > 0.5 ? C_p1 : left > 0.25 ? C_bolt : C_cpu;
    g.fillStyle(0x17232c, 1);
    g.fillRect(barX, H - 11, barW, 5);
    g.fillStyle(barColor, 1);
    g.fillRect(barX, H - 11, barW * left, 5);
  }

  // Attract/game-over title treatment: one decisive plate, no generic modal stack.
  let title = '';
  let sub = '';
  let titleColor = C_p1;
  const blinkOn = Math.floor(time / 450) % 2 === 0;
  if (!play) {
    const card = CARDS[Math.floor((time - s.attractStart) / CARD_MS) % CARDS.length];
    title = card[0];
    sub = card[1] + '\n\n' + (blinkOn ? 'PRESS START' : ' ');
  } else if (s.phase === 'over') {
    const o = s.state.over;
    title = o === 'p1' ? 'VICTORY' : o === 'cpu' ? 'DEFEATED' : 'DRAW';
    titleColor = o === 'p1' ? C_p1 : o === 'cpu' ? C_cpu : C_bolt;
    sub = time > s.phaseStart + ATTRACT_OVER_MS && blinkOn ? 'PRESS START' : ' ';
  }
  if (title) {
    drawLabelSlab(g, W / 2 - 222, 112, 444, 52, titleColor, true);
    const lines = sub.split('\n').length;
    g.fillStyle(0x03070d, 0.88);
    g.fillPoints([{ x: 215, y: 174 }, { x: 585, y: 174 }, { x: 568, y: 186 + lines * 16 }, { x: 232, y: 186 + lines * 16 }], true);
    g.lineStyle(2, titleColor, 0.55);
    g.lineBetween(250, 174, 550, 174);
    ui.sub.setY(180 + (lines * 16) / 2);
  }
  setT(ui.title, title);
  setT(ui.sub, title ? sub : '');
}
})();
