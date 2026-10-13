// Mecha Simultactics: Catatumbo Protocol — Platanus Hack 26 Arcade Challenge
// Simultaneous-turn mecha duel vs CPU over Lake Maracaibo. See SPEC.md / ROADMAP.md.

// Everything lives in an IIFE so the minifier can mangle top-level names (~5KB saved).
(() => {
// Math members as locals so the minifier can mangle every call site.
const { max: M_max, min: M_min, abs: M_abs, random: M_random, sin: M_sin, floor: M_floor, cos: M_cos, sign: M_sign, round: M_round, hypot: M_hypot } = Math;
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
const C_grid = 0x2bff7a; // M.S.B.S.-style CRT green
const C_gold = 0xffd23c;

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
const HP_MAX = 160;
const STAGE_HP = 20; // each gauntlet stage gives the CPU more max HP
const STAGE_HEAL = 40; // P1 carries HP between stages and heals this much
const TOP_KEY = 'catatumbo/top5';
const SLASH_DMG = 22; // ~7 clean frontal hits to KO
const LUNGE_DMG = 18;
const JAB_DMG = 8; // quick poke: never advances stance
const LUNGE_FLANK = 2; // lunge damage multiplier when hitting a side or the back
const LUNGE_DASH = 2;
const GRAB_DMG = 10;
const THROW_DMG = 15;
const SLAM_DMG = 10; // extra when the throw hits land / the edge
const THROW_DIST = 6; // flying knockback
const CRASH_DMG = 15; // thrown into a palafito or the bridge: it breaks
const OIL_DMG = 10; // thrown over oil: it explodes and is consumed
const GUTS_MAX = 80; // melee damage fills it; a full meter refreshes the BURST charge
const GUTS_BONUS = 10; // parry, throw and oil
const BURST_DMG = 15;
const OD_TURNS = 5; // overdrive after a burst, counting the burst step itself
const OD_SPD = 5; // overdrive strikes win trades instead of clashing
// Speed = when an action starts (Mecha Simultactics Speed Guide). Higher lands first.
const PIVOT_PENALTY = 60; // per 90° turn a strike/parry/grab needs first (180° = 2 pivots)
const STAGGER_PENALTY = 10; // staggered units still act, just too slow to clash or trade
const MOVE_SPD = [160, 160, 90, 30]; // by tiles walked: further = slower
const CLASH_WINDOW = 0; // only strikes of equal speed clash

// Zone events (P8).
const ZONE_CHANCE = { cat: 0.35, verdin: 0.4 }; // probability per turn
const ZONE_VERDIN_DMG = 8; // slip damage
const ZONE_CAT_DMG = 12; // Catatumbo lightning

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
const INTRO_MS = 3200; // NEXT ENEMY briefing: input waits and the turn clock starts after it
const CARD_MS = 3500; // attract-mode how-to-play card rotation
const ATTRACT_OVER_MS = 2500;
const OVER_IDLE_MS = 20000;

const P1_START = { x: 4, y: 8, fc: 'E' }; // Costa occidental: Maracaibo
const CPU_START = { x: 20, y: 8, fc: 'W' }; // Costa oriental: Cabimas

// 0 water · 1 land · 2 bridge · 3 palafito · 4 Catatumbo · 5 void · 6 verdín · 7 oil
// Deterministic 26×26 Maracaibo silhouette: gulf, northern neck, broad body and southern tip.
const LAKE_HALF = [4, 4, 3, 2, 1, 2, 8, 8, 7, 7, 8, 8, 9, 9, 9, 9, 8, 8, 7, 7, 6, 5, 4, 2, 0, -1];
const LAGO_MAP = Array.from({ length: 26 }, (_, y) => Array.from({ length: 26 }, (_, x) => (M_abs(x - 12) <= LAKE_HALF[y] ? 0 : 1)));
for (const [t, ...p] of [
  [2, 10, 4, 11, 4, 12, 4, 13, 4, 14, 4],
  [3, 18, 9, 19, 9, 20, 12, 21, 12, 20, 15, 21, 15],
  [4, 3, 15, 4, 16, 5, 17],
  [5, 1, 10],
  [6, 4, 6, 9, 8, 16, 11, 8, 18],
  [7, 4, 13, 13, 10, 10, 16, 14, 19],
]) for (let i = 0; i < p.length; i += 2) LAGO_MAP[p[i + 1]][p[i]] = t;
// Pristine copy: thrown mechas break tiles, every match starts from this.
const MAP0 = LAGO_MAP.map((r) => [...r]);
const BRIDGE_ROW = MAP0.findIndex((r) => r.includes(2));
const BRIDGE_XS = MAP0[BRIDGE_ROW].flatMap((t, x) => (t === 2 ? [x] : []));
const ROWS = LAGO_MAP.length;
const COLS = LAGO_MAP[0].length;

// Void outside the board is never traversable.
const tileAt = (x, y) => {
  return x < 0 || y < 0 || x >= COLS || y >= ROWS || x % 1 || y % 1 ? 5 : LAGO_MAP[y][x];
};

const isWalkable = (x, y) => {
  const t = tileAt(x, y);
  return t !== 3 && t !== 5;
};

const isLake = (x, y) => {
  const t = tileAt(x, y);
  return t !== 1 && t !== 5;
};

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
const createControls = (scene) => {
  const controls = { held: Object.create(null), pressed: Object.create(null) };

  // Single-player: the P2 stick also steers P1. The cabinet key table itself is untouched.
  const codeOf = (event) => {
    const code = KEYBOARD_TO_ARCADE[normalizeIncomingKey(event.key)];
    return code && code[1] === '2' && 'UDLR'.includes(code[3]) ? 'P1_' + code[3] : code;
  };
  const onKeyDown = (event) => {
    const code = codeOf(event);
    if (!code) return;
    if (!controls.held[code]) controls.pressed[code] = true;
    controls.held[code] = true;
  };
  const onKeyUp = (event) => {
    const code = codeOf(event);
    if (code) controls.held[code] = false;
  };

  // Losing focus while a key is held would leave it stuck down (no keyup ever arrives).
  const onBlur = () => {
    for (const k in controls.held) controls.held[k] = false;
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  // Grab keyboard focus at boot: the dev dashboard only forwards keys typed inside the game frame.
  window.focus();
  scene.events.once('shutdown', () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
  });

  return controls;
};

const consumePressed = (controls, code) => {
  if (!controls.pressed[code]) return false;
  controls.pressed[code] = false;
  return true;
};

// == RULES ==
// Pure functions only (no Phaser). Each side picks ONE action per turn. Faster actions land first;
// a unit hit before it acts loses its action. Strikes aimed at each other with close speeds clash.
// A plan is { act, dir } or { act, path }.

const ACTIONS = {
  move: { name: 'MOVE', spd: 160, target: 'tile', range: 3, info: ['FORWARD 3 // SIDE 2 // BACK 1', 'FURTHER = SLOWER  FWD 3 = MOMENTUM'] },
  dodge: { name: 'DODGE', spd: 215, target: 'tile', range: 1, info: ['HOP 1 TILE, KEEP FACING', 'VERY FAST: ESCAPE AN ATTACK'] },
  tele: { name: 'TELEPORT', spd: 215, target: 'tile', range: 3, info: ['BLINK UP TO 3 TILES, ANY ANGLE', '1 CHARGE  INTO AN ATTACK = LAUNCHED'] },
  pivot: { name: 'PIVOT', spd: 215, target: 'dir', info: ['TURN TO FACE ANOTHER SIDE', 'ATTACKS LOSE 60 SPD PER TURN'] },
  vslash: { name: 'V-SLASH', spd: 150, target: 'dir', strike: true, info: ['3 TILES FORWARD: 22 DMG', 'X2 ON FLANK'] },
  hslash: { name: 'H-SLASH', spd: 150, target: 'dir', strike: true, info: ['WIDE SWEEP 3X2: 22 DMG', 'X2 ON FLANK  REACHES DIAGONALS'] },
  jab: { name: 'JAB', spd: 176, target: 'dir', strike: true, info: ['QUICK POKE: 8 DMG', 'NO COMBO  STOPS SLOWER ACTIONS'] },
  lunge: { name: 'LUNGE', spd: 210, target: 'dir', strike: true, info: ['DASH 2 TILES + STAB: 18 DMG', 'X2 ON FLANK  NEEDS MOMENTUM'] },
  parry: { name: 'PARRY', spd: 215, target: 'dir', info: ['BLOCKS STRIKES FROM THE FRONT', 'WHIFF = OPEN NEXT TURN'] },
  grab: { name: 'GRAB', spd: 180, target: 'dir', info: ['CATCH + THROW: 25+ DMG', 'IGNORES PARRY  WHIFF = OPEN'] },
  burst: { name: 'BURST', spd: 210, target: 'none', info: ['ESCAPE KNOCKBACK: PUSH + OVERDRIVE', '1 CHARGE // REFILLS ON FULL GUTS'] },
  wait: { name: 'WAIT', spd: 0, target: 'none', info: [] },
};
const MOVE_ACTS = ['move', 'dodge', 'tele', 'pivot'];
const COMBAT_ACTS = ['vslash', 'hslash', 'jab', 'lunge', 'parry', 'grab'];
const STRIKE_ACTS = ['vslash', 'hslash', 'jab', 'lunge'];
const WAIT_PLAN = { act: 'wait' };
// Clash picks: parry > thrust > feint > parry; burst beats thrust and feint, loses to parry.
const CLASH_PICKS = ['thrust', 'parry', 'feint', 'burst'];
const CLASH_WINS = { parry: ['thrust', 'burst'], thrust: ['feint'], feint: ['parry'], burst: ['thrust', 'feint'] };

const newUnit = (start, hp, mx) => {
  // open: whiffed a parry/grab and must skip the next turn.
  return { x: start.x, y: start.y, fc: start.fc, hp, mx, guts: 0, bursts: 1, tp: 1, od: 0, momentum: false, st: ST_NORMAL, open: false };
};

const newState = (stage = 1, hp = HP_MAX) => {
  MAP0.forEach((r, y) => (LAGO_MAP[y] = [...r]));
  const mx = HP_MAX + STAGE_HP * (stage - 1);
  return { us: [newUnit(P1_START, hp, HP_MAX), newUnit(CPU_START, mx, mx)], turn: 1, over: null };
};

const cloneState = (s) => {
  return JSON.parse(JSON.stringify(s));
};

const step = (p, dir) => {
  const d = DIRS[dir];
  return { x: p.x + d.dx, y: p.y + d.dy };
};

const same = (a, b) => {
  return !!a && !!b && a.x === b.x && a.y === b.y;
};

const frontOf = (u) => {
  return step(u, u.fc);
};

// Classify an attacker relative to a defender's facing at any distance.
// Diagonals read as sides; only a dominant forward/back component is front/back.
const relativeSide = (defender, attacker) => {
  const f = DIRS[defender.fc];
  const rx = attacker.x - defender.x;
  const ry = attacker.y - defender.y;
  const dot = rx * f.dx + ry * f.dy;
  const cross = rx * f.dy - ry * f.dx;
  return dot > M_abs(cross) ? 'front' : -dot > M_abs(cross) ? 'back' : 'side';
};

const dist = (a, b) => {
  return M_abs(a.x - b.x) + M_abs(a.y - b.y);
};

// Direction from a to an orthogonally adjacent b, or null.
const dirBetween = (a, b) => {
  return DIR_KEYS.find((k) => same(step(a, k), b)) || null;
};

const canUse = (u, act) => {
  if (act === 'lunge') return u.momentum || u.od > 0;
  if (act === 'tele') return u.tp > 0;
  if (act === 'burst') return u.st === ST_KNOCKBACK && u.bursts > 0;
  return true;
};

// NORMAL and STAGGERED units pick actions; KNOCKBACK/DOWN or an open unit cannot.
const canAct = (u) => {
  return !u.open && u.st < ST_KNOCKBACK;
};

// Each 90° pivot before a strike/parry/grab costs speed; stagger slows everything.
const speedOf = (u, plan) => {
  const a = ACTIONS[plan.act];
  const pivots = a.target !== 'dir' || plan.act === 'pivot' || plan.dir === u.fc ? 0 : plan.dir === OPPOSITE[u.fc] ? 2 : 1;
  const base = plan.act === 'move' ? MOVE_SPD[plan.wp ? plan.wp.length : 1] : a.spd;
  return base - pivots * PIVOT_PENALTY - (u.st === ST_STAGGERED ? STAGGER_PENALTY : 0) + (u.od ? OD_SPD : 0);
};

// Straight cardinal reach. MOVE (range 3) uses facing: forward 3, sides 2, back 1.
// DODGE keeps a uniform one-tile cross.
const reach = (s, i, range) => {
  const me = s.us[i];
  const foe = s.us[1 - i];
  const out = new Map();
  for (const k of DIR_KEYS) {
    const wp = [];
    let c = me;
    const max = range === 3 ? (k === me.fc ? 3 : k === OPPOSITE[me.fc] ? 1 : 2) : range;
    for (let n = 0; n < max; n++) {
      const t = step(c, k);
      if (!isWalkable(t.x, t.y) || same(t, foe)) break;
      wp.push(t);
      out.set(t.x + ',' + t.y, [...wp]);
      c = t;
    }
  }
  return out;
};

// TELEPORT targets: any free walkable tile within 3 steps, at any angle.
const tpReach = (s, i) => {
  const me = s.us[i];
  const out = new Map();
  for (let dy = -3; dy <= 3; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      const t = { x: me.x + dx, y: me.y + dy };
      const d = dist(t, me);
      if (d && d <= 3 && isWalkable(t.x, t.y) && !same(t, s.us[1 - i])) out.set(t.x + ',' + t.y, [t]);
    }
  }
  return out;
};

// Dominant grid direction from a toward b.
const faceTo = (a, b) => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return M_abs(dx) >= M_abs(dy) ? (dx > 0 ? 'E' : 'W') : dy > 0 ? 'S' : 'N';
};

// Straight dash of up to n tiles, stopping before land or the other unit.
const dashPath = (from, dir, n, other) => {
  const wp = [];
  let c = from;
  for (let k = 0; k < n; k++) {
    const t = step(c, dir);
    if (!isWalkable(t.x, t.y) || same(t, other)) break;
    wp.push(t);
    c = t;
  }
  return wp;
};

// Where a plan would leave a unit if nothing interfered (ghost preview).
const previewPlan = (u, plan, other) => {
  const a = ACTIONS[plan.act];
  if (a.target === 'tile' && plan.wp && plan.wp.length) {
    const last = plan.wp[plan.wp.length - 1];
    const prev = plan.wp.length > 1 ? plan.wp[plan.wp.length - 2] : u;
    return { x: last.x, y: last.y, fc: plan.act === 'dodge' ? u.fc : plan.act === 'tele' ? faceTo(last, u) : dirBetween(prev, last) };
  }
  if (plan.act === 'lunge') {
    const wp = dashPath(u, plan.dir, LUNGE_DASH, other);
    const end = wp.length ? wp[wp.length - 1] : u;
    return { x: end.x, y: end.y, fc: plan.dir };
  }
  return { x: u.x, y: u.y, fc: a.target === 'dir' ? plan.dir : u.fc };
};

// A full meter resets and refreshes the BURST charge; while a charge is held it waits at max.
const gainGuts = (u, n, events, who) => {
  u.guts = M_min(GUTS_MAX, u.guts + n);
  if (u.guts < GUTS_MAX || u.bursts) return;
  u.guts = 0;
  u.bursts = u.tp = 1;
  events.push({ t: 'refresh', who });
};

// Advance stance when hit: N→S→K→D. Parry also sets the attacker to STAGGERED.
const advanceStance = (u) => {
  u.st = M_min(ST_DOWN, u.st + 1);
};

// Beginning of a turn: DOWN wakes into STAGGERED. Recovery is completed only
// after that unit has spent the turn unable to act and has not been hit again.
const resolveStanceRecovery = (u) => {
  if (u.st === ST_DOWN) u.st = ST_STAGGERED;
};

// Zone event tiles: 4=Catatumbo, 6=verdín, 7=oil.
const ZONE_TILES = { '4': 'cat', '6': 'verdin', '7': 'oil' };
const ZONE_COLOR = { cat: 0xffff00, verdin: 0x00ff88, oil: 0xff8800 };

// Check a unit's tile, trigger the zone effect. Mutates the unit.
const resolveZone = (s, i, events, rnd = M_random) => {
  const u = s.us[i];
  const t = tileAt(u.x, u.y);
  const zone = ZONE_TILES[t];
  if (!zone) return;
  const tag = zone.toUpperCase();
  const color = ZONE_COLOR[zone];
  if (zone === 'cat' && rnd() < ZONE_CHANCE.cat) {
    u.hp = M_max(0, u.hp - ZONE_CAT_DMG);
    advanceStance(u);
    events.push({ t: 'zone', who: i, zone: tag, dmg: ZONE_CAT_DMG, st: u.st, color });
    return;
  }
  if (zone === 'verdin' && rnd() < ZONE_CHANCE.verdin) {
    u.hp = M_max(0, u.hp - ZONE_VERDIN_DMG);
    // Push back 1 tile if possible.
    const back = step(u, OPPOSITE[u.fc]);
    let wp = [];
    if (isWalkable(back.x, back.y) && !same(back, s.us[1 - i])) {
      u.x = back.x;
      u.y = back.y;
      wp = [back];
    }
    events.push({ t: 'zone', who: i, zone: tag, dmg: ZONE_VERDIN_DMG, push: wp.length > 0, wp, color });
    return;
  }
  if (zone === 'oil') {
    gainGuts(u, GUTS_BONUS, events, i);
    events.push({ t: 'zone', who: i, zone: tag, dmg: 0, guts: true, color });
  }
};

// V-SLASH: up to 3 tiles in a straight line in facing direction.
const vslashTiles = (u) => {
  const out = [];
  let c = u;
  for (let n = 0; n < 3; n++) {
    c = step(c, u.fc);
    if (!isWalkable(c.x, c.y)) break;
    out.push(c);
  }
  return out;
};

// H-SLASH: three independent lanes, each stopping at its first solid tile.
const hslashTiles = (u) => {
  const d = DIRS[u.fc];
  const side = u.fc === 'N' || u.fc === 'S' ? DIRS.E : DIRS.N;
  const out = [];
  for (let lane = -1; lane <= 1; lane++) {
    for (let depth = 1; depth <= 2; depth++) {
      const c = { x: u.x + side.dx * lane + d.dx * depth, y: u.y + side.dy * lane + d.dy * depth };
      if (!isWalkable(c.x, c.y)) break;
      out.push(c);
    }
  }
  return out;
};

// Check if a position is in a list of tiles (within bounds).
const inTiles = (pos, tiles) => {
  return tiles.some(t => t.x === pos.x && t.y === pos.y);
};

const resolveTurn = (state, plans) => {
  const s = cloneState(state);
  const U = s.us;
  const start = U.map((u) => ({ x: u.x, y: u.y, fc: u.fc }));
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
    const ok = (canAct(U[i]) || burstEscape) && canUse(U[i], plan.act);
    U[i].open = false; // an open unit spends exactly this turn recovering
    return ok ? plan : WAIT_PLAN;
  });
  const spd = p.map((plan, i) => (plan.act === 'wait' ? 0 : speedOf(U[i], plan)));
  const momentum = [false, false];
  U.forEach((u, i) => p[i].act === 'lunge' && !u.od && (u.momentum = false));
  events.push({ t: 'order', acts: p.map((x) => x.act), spd });

  // Clash: both strike at each other (after their dashes) with speeds within the clash window.
  if (STRIKE_ACTS.includes(p[0].act) && STRIKE_ACTS.includes(p[1].act) && M_abs(spd[0] - spd[1]) <= CLASH_WINDOW) {
    const end = U.map((u, i) => {
      const wp = p[i].act === 'lunge' ? dashPath(u, p[i].dir, LUNGE_DASH, U[1 - i]) : [];
      return { wp, at: wp.length ? wp[wp.length - 1] : u, fc: p[i].dir };
    });
    const hitTiles = (i) => {
      const src = end[i];
      if (p[i].act === 'vslash') return vslashTiles({ x: src.at.x, y: src.at.y, fc: src.fc });
      if (p[i].act === 'hslash') return hslashTiles({ x: src.at.x, y: src.at.y, fc: src.fc });
      return [step(src.at, src.fc)];
    };
    if (!same(end[0].at, end[1].at) && inTiles(end[1].at, hitTiles(0)) && inTiles(end[0].at, hitTiles(1))) {
      U.forEach((u, i) => {
        u.fc = end[i].fc;
        if (end[i].wp.length) {
          u.x = end[i].at.x;
          u.y = end[i].at.y;
          events.push({ t: 'move', who: i, wp: end[i].wp, fc: u.fc, act: p[i].act });
        } else {
          events.push({ t: 'face', who: i, fc: u.fc });
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

  const parried = [false, false];
  const blinked = [false, false]; // teleported this turn: an incoming strike launches it
  let launched = -1;
  const inv = [false, false]; // bursting units cannot be hit this step
  const hurt = [false, false];
  const strike = (i, dmg, flankMult, combo = true) => {
    const foe = U[1 - i];
    hurt[1 - i] = true;
    const relation = relativeSide(foe, U[i]);
    const flank = relation !== 'front';
    const total = M_round(dmg * (flank ? flankMult : 1));
    foe.hp = M_max(0, foe.hp - total);
    const prevSt = foe.st;
    if (combo) advanceStance(foe);
    if (prevSt !== foe.st) events.push({ t: 'stance', who: 1 - i, st: foe.st });
    events.push({ t: 'hit', who: 1 - i, dmg: total, flank: flank && flankMult > 1, relation, prevSt, combo });
    gainGuts(U[i], total, events, i);
    if (blinked[1 - i] && p[i].act !== 'grab') {
      // Teleported into an attack: launched along the attacker's facing like a throw (a grab just catches).
      blinked[1 - i] = false;
      launched = 1 - i;
      const f = flightOf(foe, U[i].fc, U[i], 1 - i);
      f.breaks.forEach((b) => (LAGO_MAP[b.y][b.x] = 0));
      const last = f.wp[f.wp.length - 1] || foe;
      foe.x = last.x;
      foe.y = last.y;
      foe.hp = M_max(0, foe.hp - (f.dmg - THROW_DMG));
      foe.st = ST_DOWN;
      events.push({ t: 'launch', who: 1 - i }, ...f.events);
      events.push({ t: 'stance', who: 1 - i, st: ST_DOWN });
      if (f.slam) events.push({ t: 'hit', who: 1 - i, dmg: SLAM_DMG, slam: true, combo: false });
    }
    if (!done[1 - i] && !groups.find((g) => g.includes(i)).includes(1 - i) && p[1 - i].act !== 'wait' && !cancelled[1 - i]) {
      cancelled[1 - i] = true;
      events.push({ t: 'interrupt', who: 1 - i, act: p[1 - i].act });
    }
  };

  for (const g of groups) {
    const acting = g.filter((i) => !cancelled[i] && p[i].act !== 'wait');
    if (acting.length) events.push({ t: 'beat', who: acting });

    for (const i of acting) {
      if (ACTIONS[p[i].act].target === 'dir' && U[i].fc !== p[i].dir) {
        U[i].fc = p[i].dir;
        events.push({ t: 'face', who: i, fc: U[i].fc });
      }
    }

    // Movement (walks, hops and lunge dashes). Paths stop before the other unit;
    // equal final tiles or a swap → nobody moves.
    const walk = {};
    for (const i of acting) {
      const a = p[i].act;
      if (a === 'lunge') walk[i] = dashPath(U[i], p[i].dir, LUNGE_DASH, U[1 - i]);
      if (a === 'tele') {
        const t = (p[i].wp || [])[0];
        U[i].tp = 0;
        walk[i] = t && dist(t, U[i]) <= 3 && isWalkable(t.x, t.y) && !same(t, U[1 - i]) ? [t] : [];
        continue;
      }
      if (ACTIONS[a].target !== 'tile') continue;
      const wp = [], cells = p[i].wp || [], dir = dirBetween(U[i], cells[0]);
      const max = a === 'move' ? (dir === start[i].fc ? 3 : dir === OPPOSITE[start[i].fc] ? 1 : 2) : 1;
      let c = U[i];
      for (const t of cells) {
        if (!dir || wp.length >= max || !same(t, step(c, dir)) || same(t, U[1 - i]) || !isWalkable(t.x, t.y)) break;
        wp.push(t);
        c = t;
      }
      walk[i] = wp;
    }
    if (walk[0] && walk[1]) {
      const a = walk[0][walk[0].length - 1];
      const b = walk[1][walk[1].length - 1];
      if (same(a, b) || (same(a, U[1]) && same(b, U[0]))) walk[0] = walk[1] = [];
    }
    for (const i of acting) {
      if (!walk[i]) continue;
      const wp = walk[i];
      if (!wp.length) {
        if (p[i].act !== 'lunge') events.push({ t: 'bump', who: i });
        continue;
      }
      const last = wp[wp.length - 1];
      if (p[i].act === 'tele') {
        U[i].fc = faceTo(last, U[i]);
        blinked[i] = true;
      } else if (p[i].act !== 'dodge') U[i].fc = dirBetween(U[i], wp[0]);
      U[i].x = last.x;
      U[i].y = last.y;
      if (p[i].act === 'move' && wp.length === 3) {
        let c = start[i];
        momentum[i] = wp.every((t) => same(t, (c = step(c, start[i].fc))));
      }
      events.push({ t: 'move', who: i, wp, fc: U[i].fc, act: p[i].act });
    }

    for (const i of acting) {
      if (p[i].act === 'parry') {
        guard[i] = true;
        events.push({ t: 'guard', who: i });
      }
      if (p[i].act === 'burst') {
        const me = U[i];
        const foe = U[1 - i];
        me.bursts = 0;
        me.st = ST_NORMAL;
        me.od = OD_TURNS;
        inv[i] = true;
        events.push({ t: 'burst', who: i });
        // Shockwave: an adjacent foe (diagonals too) is hurt, pushed away and loses its action.
        if (M_abs(foe.x - me.x) <= 1 && M_abs(foe.y - me.y) <= 1) {
          foe.hp = M_max(0, foe.hp - BURST_DMG);
          hurt[1 - i] = true;
          events.push({ t: 'hit', who: 1 - i, dmg: BURST_DMG, combo: false });
          const to = { x: foe.x + M_sign(foe.x - me.x), y: foe.y + M_sign(foe.y - me.y) };
          if (isWalkable(to.x, to.y)) {
            foe.x = to.x;
            foe.y = to.y;
            events.push({ t: 'knock', who: 1 - i, wp: [to] });
          }
          if (!g.includes(1 - i) && !done[1 - i] && p[1 - i].act !== 'wait' && !cancelled[1 - i]) {
            cancelled[1 - i] = true;
            events.push({ t: 'interrupt', who: 1 - i, act: p[1 - i].act });
          }
        }
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
      if (!inTiles(foe, tiles) || inv[1 - i]) {
        events.push({ t: 'miss', who: i });
        continue;
      }
      if (guard[1 - i] && relativeSide(foe, u) === 'front') {
        gainGuts(foe, GUTS_BONUS, events, 1 - i);
        parried[1 - i] = true;
        advanceStance(u); // parried → staggered
        events.push({ t: 'stance', who: i, st: u.st });
        events.push({ t: 'parry', who: 1 - i });
        continue;
      }
      if (p[i].act === 'vslash' || p[i].act === 'hslash') strike(i, SLASH_DMG, 2);
      else if (p[i].act === 'jab') strike(i, JAB_DMG, 1, false);
      else {
        strike(i, LUNGE_DMG, LUNGE_FLANK);
        const to = step(foe, u.fc);
        if (launched !== 1 - i && isWalkable(to.x, to.y) && !same(to, u)) {
          foe.x = to.x;
          foe.y = to.y;
          events.push({ t: 'knock', who: 1 - i, wp: [to] });
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
        if (!same(f, U[1 - i]) || inv[1 - i]) {
          events.push({ t: 'miss', who: i });
          U[i].open = true;
          events.push({ t: 'open', who: i });
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
    // A parry that blocked nothing leaves the unit open, unless it was already punished this turn.
    if (guard[i] && !parried[i] && !hurt[i]) {
      u.open = true;
      events.push({ t: 'open', who: i });
    }
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
  return { state: s, events, clash: false, grab, launched };
};

// Pure flight of a thrown unit (index fw) in `dir`, tile by tile. Palafitos and the bridge stop
// it and break; Catatumbo strikes, oil explodes (and is consumed), verdín slides it one tile further;
// the board edge or the thrower is a hard slam. Returns path, total damage, events and broken tiles.
const flightOf = (foe, dir, me, fw) => {
  const wp = [];
  const events = [];
  const breaks = [];
  let c = foe;
  let left = THROW_DIST;
  let dmg = THROW_DMG;
  let slam = false;
  while (left-- > 0) {
    const t = step(c, dir);
    const k = tileAt(t.x, t.y);
    if (k === 5 || same(t, me)) {
      slam = true;
      break;
    }
    wp.push(t);
    events.push({ t: 'knock', who: fw, wp: [t], fly: true });
    c = t;
    if (k === 2 || k === 3) {
      dmg += CRASH_DMG;
      breaks.push(t);
      events.push({ t: 'break', who: fw, x: t.x, y: t.y, k, dmg: CRASH_DMG });
      break;
    }
    if (k === 4) {
      dmg += ZONE_CAT_DMG;
      events.push({ t: 'zone', who: fw, zone: 'CAT', dmg: ZONE_CAT_DMG, color: ZONE_COLOR.cat });
    } else if (k === 7) {
      dmg += OIL_DMG;
      breaks.push(t);
      events.push({ t: 'zone', who: fw, zone: 'OIL BLAST', dmg: OIL_DMG, color: ZONE_COLOR.oil }, { t: 'break', who: fw, x: t.x, y: t.y, k });
    } else if (k === 6) {
      left++;
      events.push({ t: 'zone', who: fw, zone: 'VERDIN', push: true, color: ZONE_COLOR.verdin });
    }
  }
  if (slam) dmg += SLAM_DMG;
  return { wp, events, breaks, dmg, slam };
};

// Grabber `who` throws the foe in `dir`. Broken tiles turn into open water for the rest of the match.
const resolveThrow = (state, who, dir) => {
  const s = cloneState(state);
  const me = s.us[who];
  const foe = s.us[1 - who];
  const f = flightOf(foe, dir, me, 1 - who);
  f.breaks.forEach((b) => (LAGO_MAP[b.y][b.x] = 0));
  const last = f.wp[f.wp.length - 1] || foe;
  foe.x = last.x;
  foe.y = last.y;
  foe.hp = M_max(0, foe.hp - f.dmg);
  const prevSt = foe.st;
  foe.st = ST_DOWN;
  // Zone and break events carry their own damage; the final hit carries the rest.
  const extra = f.events.reduce((n, e) => n + (e.dmg || 0), 0);
  const events = [
    { t: 'throw', who, dir },
    ...f.events,
    { t: 'stance', who: 1 - who, st: ST_DOWN },
    { t: 'hit', who: 1 - who, dmg: f.dmg - extra, slam: f.slam, prevSt },
  ];
  gainGuts(me, GUTS_BONUS, events, who);
  finishTurn(s);
  return { state: s, events };
};

const resolveClash = (state, picks) => {
  const s = cloneState(state);
  const events = [];
  picks.forEach((pk, i) => pk === 'burst' && (s.us[i].bursts = 0));
  const [pa, pb] = picks;
  if (pa === pb) {
    events.push({ t: 'mirror', picks });
    s.us.forEach((u, i) => {
      const to = step(u, OPPOSITE[u.fc]);
      if (isWalkable(to.x, to.y) && !same(to, s.us[1 - i])) {
        u.x = to.x;
        u.y = to.y;
        events.push({ t: 'knock', who: i, wp: [to] });
      }
    });
  } else {
    const winner = CLASH_WINS[pa].includes(pb) ? 0 : 1;
    const w = s.us[winner];
    const loser = s.us[1 - winner];
    loser.hp = M_max(0, loser.hp - SLASH_DMG);
    const prevSt = loser.st;
    advanceStance(loser);
    if (prevSt !== loser.st) events.push({ t: 'stance', who: 1 - winner, st: loser.st });
    events.push({ t: 'clashWin', who: winner, picks });
    events.push({ t: 'hit', who: 1 - winner, dmg: SLASH_DMG });
    gainGuts(w, SLASH_DMG, events, winner);
    if (picks[winner] === 'burst') {
      const to = step(loser, w.fc);
      if (isWalkable(to.x, to.y)) {
        loser.x = to.x;
        loser.y = to.y;
        events.push({ t: 'knock', who: 1 - winner, wp: [to] });
      }
    }
  }
  finishTurn(s);
  return { state: s, events };
};

const checkOutcome = (s) => {
  const [a, b] = s.us;
  if (a.hp <= 0 && b.hp <= 0) s.over = 'draw';
  else if (a.hp <= 0) s.over = 'cpu';
  else if (b.hp <= 0) s.over = 'p1';
};

const finishTurn = (s) => {
  checkOutcome(s);
  s.us.forEach((u) => u.od && u.od--);
  s.turn++;
};

// == CONTROLLERS ==
// The CPU only sees the state, never the opponent's plan.

const cpuPlan = (s, i, rnd = M_random) => {
  const me = s.us[i];
  const foe = s.us[1 - i];
  // BURST escape when knocked back with a full bar.
  if (canUse(me, 'burst') && rnd() < 0.8) return { act: 'burst' };
  if (!canAct(me)) return WAIT_PLAN;
  const r = rnd();
  const pick = (arr) => arr[M_floor(rnd() * arr.length)];
  const toFoe = dirBetween(me, foe);
  const outs = () => [...reach(s, i, 1).values()].filter((wp) => !same(wp[0], frontOf(foe)));

  // Staggered: too slow to trade, so step out or guard.
  if (me.st === ST_STAGGERED && dist(me, foe) <= 3 && rnd() < 0.7) {
    const o = outs();
    if (o.length && r < 0.55) return { act: 'dodge', wp: pick(o) };
    if (toFoe) return { act: r < 0.8 ? 'parry' : 'jab', dir: toFoe };
  }

  // Blink behind a foe that is squaring up, to flank it next turn.
  if (canUse(me, 'tele') && same(frontOf(foe), me) && rnd() < 0.2) {
    const back = step(foe, OPPOSITE[foe.fc]);
    if (tpReach(s, i).has(back.x + ',' + back.y)) return { act: 'tele', wp: [back] };
  }

  // Chain the combo: if the foe is staggered/knocked/down/open and in vslash range, press it.
  if (foe.st !== ST_NORMAL || foe.open) {
    const lane = DIR_KEYS.find((k) => {
      const hit = step(me, k);
      return inTiles(foe, [hit, step(hit, k), step(step(hit, k), k)]);
    });
    if (lane && rnd() < 0.85) return { act: 'vslash', dir: lane };
    if (toFoe && rnd() < 0.7) return { act: 'hslash', dir: toFoe };
  }

  if (toFoe) {
    const threatened = same(frontOf(foe), me);
    if (!threatened) return { act: r < 0.45 ? 'vslash' : r < 0.65 ? 'jab' : r < 0.85 ? 'grab' : 'parry', dir: toFoe };
    if (r < 0.2) return { act: 'vslash', dir: toFoe };
    if (r < 0.4) return { act: 'jab', dir: toFoe };
    if (r < 0.6) return { act: 'parry', dir: toFoe };
    if (r < 0.75) return { act: 'grab', dir: toFoe };
    const o = outs();
    if (o.length) return { act: 'dodge', wp: pick(o) };
    return { act: 'parry', dir: toFoe };
  }

  // Momentum: lunge if the foe is 2-3 tiles away in a straight line.
  const line = DIR_KEYS.find((k) => same(step(step(me, k), k), foe));
  if (canUse(me, 'lunge')) {
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
  if (M_abs(me.x - foe.x) === 1 && M_abs(me.y - foe.y) === 1 && r < 0.6) {
    const k = pick(DIR_KEYS.filter((d) => dist(step(me, d), foe) === 1));
    return { act: r < 0.4 ? 'vslash' : 'parry', dir: k };
  }

  // Approach: closest reachable tile, avoiding the foe's front tile and tiles the foe can also
  // reach this turn (both walking into the same tile bumps forever). Vary among the best few.
  const paths = [...reach(s, i, 3).values()];
  if (!paths.length) return { act: 'pivot', dir: me.fc };
  const foeReach = reach(s, 1 - i, 3);
  const scored = paths.map((wp) => {
    const t = wp[wp.length - 1];
    const contested = foeReach.has(t.x + ',' + t.y) ? 8 : 0;
    const zoneBonus = tileAt(t.x, t.y) === 7 ? -10 : tileAt(t.x, t.y) === 4 ? 8 : tileAt(t.x, t.y) === 6 ? 6 : 0;
    return { wp, score: dist(t, foe) * 10 + (same(t, frontOf(foe)) ? 15 : 0) + contested + zoneBonus + rnd() * 10 };
  });
  scored.sort((a, b) => a.score - b.score);
  const pickIndex = rnd() < 0.7 ? 0 : M_min(scored.length - 1, 1 + M_floor(rnd() * 2));
  return { act: 'move', wp: scored[pickIndex].wp };
};

// Throw where the flight hurts most (crashes, lightning, oil), random among ties.
const cpuThrowDir = (s, i, rnd = M_random) => {
  const foe = s.us[1 - i];
  const me = s.us[i];
  const open = DIR_KEYS.filter((k) => !same(step(foe, k), me));
  const dmg = (k) => flightOf(foe, k, me, 1 - i).dmg;
  const best = M_max(...open.map(dmg));
  const pool = open.filter((k) => dmg(k) === best);
  return pool[M_floor(rnd() * pool.length)];
};

// Light weighting: often counter the opponent's last clash pick; burst when a charge is left.
const cpuClashPick = (lastFoePick, canBurst, rnd = M_random) => {
  if (canBurst && rnd() < 0.4) return 'burst';
  if (lastFoePick && rnd() < 0.5) return CLASH_PICKS.find((k) => k !== 'burst' && CLASH_WINS[k].includes(lastFoePick));
  return CLASH_PICKS[M_floor(rnd() * 3)];
};

// == RENDER ==

// Positive world coordinates leave room for the 25×25 plate, pylons and mechas.
const WORLD_W = 1200;
const WORLD_H = 740;
const ISO_OX = WORLD_W / 2 - ((COLS + ROWS - 2) * TW) / 4;
const ISO_OY = 340;

// Grid cell → screen centre of its rhombus.
const toIso = (x, y) => {
  return { x: ISO_OX + ((x + y) * TW) / 2, y: ISO_OY + ((y - x) * TH) / 2 };
};

// Vertices in order: top, right, bottom, left.
const rhombus = (cx, cy, hw, hh) => {
  return [
    { x: cx, y: cy - hh },
    { x: cx + hw, y: cy },
    { x: cx, y: cy + hh },
    { x: cx - hw, y: cy },
  ];
};

const cellPts = (x, y) => {
  const c = toIso(x, y);
  return rhombus(c.x, c.y, TW / 2, TH / 2);
};

// Rhombus edge shared with the neighbour in each grid direction.
const EDGE = { N: [3, 0], E: [0, 1], S: [1, 2], W: [2, 3] };

// Solid extruded rhombus with a fixed upper-left key light.
const drawPrism = (g, cx, cy, hw, hh, h, color, mid = C_landMid, dark = C_landDark) => {
  const top = rhombus(cx, cy - h, hw, hh);
  const left = [top[3], top[2], { x: cx, y: cy + hh }, { x: cx - hw, y: cy }];
  const right = [top[2], top[1], { x: cx + hw, y: cy }, { x: cx, y: cy + hh }];
  [[left, mid], [right, dark], [top, color]].forEach(([face, fill]) => {
    g.fS(fill, 1);
    g.fP(face, true);
    g.lS(1, C_ink, 0.9);
    g.sP(face, true);
  });
};

// Front faces of the board slab: west column (down-left side) and south row (down-right side).
const drawSlab = (g) => {
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
    g.fS(a.x < b.x ? 0x102b25 : 0x081a1d, 1);
    g.fP(quad, true);
    g.lS(1.5, C_ink, 1);
    g.sP(quad, true);
    g.lS(1, 0x376153, 0.42);
    g.lB(a.x, a.y + 4, b.x, b.y + 4);
  }
};

const drawTiles = (g) => {
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
      g.fS(color, 1);
      g.fP(pts, true);
      g.lS(1, water ? C_waterLo : C_landDark, water ? 0.48 : 0.72);
      g.sP(pts, true);

      // Deterministic micro-texture: short ripples, tiny facets and sparse dither.
      if (water) {
        const ox = (hash % 5) - 2;
        const oy = ((hash * 3) % 5) - 2;
        g.lS(1, hash & 1 ? 0x31a0aa : 0x0a8494, 0.25 + (hash % 3) * 0.08);
        g.lB(c.x - 8 + ox, c.y - 2 + oy, c.x - 1 + ox, c.y - 4 + oy);
        if (hash % 3 === 0) g.lB(c.x + 3, c.y + 3, c.x + 9, c.y + 1);
        if (hash % 5 === 0) {
          g.fS(0xa7d8d2, 0.16);
          g.fR(c.x + ox, c.y + oy, 2, 1);
        }
      } else {
        g.lS(1, hash & 1 ? 0x58704b : 0x1d3928, 0.35);
        g.lB(c.x - 7, c.y + (hash % 4) - 2, c.x - 1, c.y + (hash % 4) - 4);
        if (hash % 4 === 0) {
          g.fS(0x75553a, 0.3);
          g.fillTriangle(c.x + 4, c.y - 2, c.x + 9, c.y, c.x + 5, c.y + 2);
        }
      }
      if (t === 4) {
        g.fS(0x1c2638, 0.38);
        g.fC(c.x - 3, c.y - 2, 5);
      } else if (t === 6) {
        g.fS(0x5b9d59, 0.66);
        g.fC(c.x - 5, c.y, 4);
        g.fC(c.x + 5, c.y - 2, 3);
      } else if (t === 7) {
        g.fS(0xd58339, 0.92);
        g.fC(c.x, c.y, 3);
        g.lS(1, C_bolt, 0.55);
        g.strokeCircle(c.x, c.y, 5);
      }
    }
  }
};

// Carved shoreline: charcoal cut with a restrained sunlit rim.
const drawShore = (g) => {
  for (let pass = 0; pass < 3; pass++) {
    g.lS(pass === 0 ? 5 : pass === 1 ? 2.5 : 1, pass === 0 ? C_ink : pass === 1 ? C_coast : C_white, pass === 2 ? 0.55 : 1);
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
          if (pass < 2) g.lB(a.x, a.y, b.x, b.y);
          else {
            g.lB(a.x, a.y, a.x + (b.x - a.x) * 0.34, a.y + (b.y - a.y) * 0.34);
            g.lB(a.x + (b.x - a.x) * 0.56, a.y + (b.y - a.y) * 0.56, b.x, b.y);
          }
        }
      }
    }
  }
};

const drawHut = (g, cx, cy) => {
  const hut = (x, y, scale) => {
    const hw = 8 * scale;
    const hh = 4 * scale;
    g.lS(3 * scale, 0x2a1713, 1);
    for (const p of rhombus(x, y, hw, hh)) g.lB(p.x, p.y, p.x, p.y - 10 * scale);
    g.fS(0x02070a, 0.45);
    g.fP(rhombus(x + 5, y + 4, hw + 3, hh + 2), true);
    const base = y - 10 * scale;
    drawPrism(g, x, base, hw, hh, 8 * scale, C_rust, C_wood, 0x3d241f);
    const roof = rhombus(x, base - 8 * scale, hw + 4, hh + 3);
    const apex = { x: x - 2, y: base - 21 * scale };
    g.fS(0xd4774a, 1);
    g.fP([roof[3], roof[2], apex], true);
    g.fS(0x783c32, 1);
    g.fP([roof[2], roof[1], apex], true);
    g.lS(1.5, C_ink, 1);
    g.sP([roof[3], apex, roof[1], roof[2]], true);
    g.fS(0xffc76a, 0.75);
    g.fR(x - 2, base - 6 * scale, 4, 3);
  };
  hut(cx - 6, cy, 1);
  hut(cx + 13, cy + 2, 0.72);
  g.lS(2, 0x3d2a21, 1);
  g.lB(cx - 12, cy - 7, cx + 19, cy - 3);
};

// Solid cable-stayed Puente General Rafael Urdaneta across the northern strait.
const drawBridge = (g) => {
  const row = BRIDGE_ROW;
  const xs = BRIDGE_XS;
  const o = toIso(0, row);
  const e = toIso(1, row);
  const n = M_hypot(e.x - o.x, e.y - o.y);
  const nx = (-(e.y - o.y) / n) * 7;
  const ny = ((e.x - o.x) / n) * 7;
  // One deck slab per intact tile; the end slabs reach the shore.
  for (const x of xs) {
    if (tileAt(x, row) !== 2) continue;
    const a = toIso(x - (x === xs[0] ? 1 : 0.5), row);
    const b = toIso(x + (x === xs[xs.length - 1] ? 1 : 0.5), row);
    const deck = [
      { x: a.x + nx, y: a.y + ny - DECK_H }, { x: b.x + nx, y: b.y + ny - DECK_H },
      { x: b.x - nx, y: b.y - ny - DECK_H }, { x: a.x - nx, y: a.y - ny - DECK_H },
    ];
    g.fS(0x02070b, 0.5);
    g.fP(deck.map((p) => ({ x: p.x + 8, y: p.y + 11 })), true);
    g.fS(0x46545b, 1);
    g.fP([deck[1], deck[2], { x: deck[2].x, y: deck[2].y + 7 }, { x: deck[1].x, y: deck[1].y + 7 }], true);
    g.fS(C_concrete, 1);
    g.fP(deck, true);
    g.lS(2, C_ink, 1);
    g.sP(deck, true);
    g.lS(1, 0xf2e7c5, 0.85);
    g.lB(a.x, a.y - DECK_H, b.x, b.y - DECK_H);
  }

  for (const x of xs) {
    if (tileAt(x, row) !== 2) continue;
    const t = toIso(x, row);
    g.fS(0x26363d, 0.7);
    g.fP([{ x: t.x - 5, y: t.y + 2 }, { x: t.x + 2, y: t.y - 1 }, { x: t.x + 4, y: t.y + 21 }, { x: t.x - 3, y: t.y + 23 }], true);
    g.lS(1.5, C_ink, 1);
    g.sP([{ x: t.x - 5, y: t.y + 2 }, { x: t.x + 2, y: t.y - 1 }, { x: t.x + 4, y: t.y + 21 }, { x: t.x - 3, y: t.y + 23 }], true);
  }
  for (const x of [xs[0], xs[xs.length - 1]]) {
    if (tileAt(x, row) !== 2) continue;
    const t = toIso(x, row);
    const deckY = t.y - DECK_H;
    const topY = deckY - TOWER_H;
    // Distinct A-frame pylon, cross braces and bright stay cables.
    g.lS(7, 0x596970, 1);
    g.lB(t.x - 9, deckY + 2, t.x, topY);
    g.lB(t.x + 9, deckY + 2, t.x, topY);
    g.lS(3, C_concrete, 1);
    g.lB(t.x - 8, deckY, t.x, topY);
    g.lB(t.x + 8, deckY, t.x, topY);
    g.lB(t.x - 5, topY + 22, t.x + 5, topY + 22);
    g.lS(1.4, 0xf7f2db, 0.92);
    for (let k = 1; k <= 4; k++) {
      const off = (k * TW) / 5;
      g.lB(t.x, topY + 3, t.x - off, deckY + off / 2);
      g.lB(t.x, topY + 3, t.x + off, deckY - off / 2);
    }
    g.fS(C_bolt, 0.9);
    g.fC(t.x, topY, 2);
  }
};

// Static layer: drawn once.
const drawMap = (g) => {
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
};

const drawBackground = (g) => {
  g.fS(C_bg, 1);
  g.fR(0, 0, WORLD_W, WORLD_H);
  g.fS(0x0b1b27, 1);
  g.fR(0, 0, WORLD_W, 390);
  g.fS(0x102633, 1);
  g.fP([{ x: 0, y: 300 }, { x: 220, y: 220 }, { x: 430, y: 290 }, { x: 650, y: 200 }, { x: 900, y: 285 }, { x: WORLD_W, y: 220 }, { x: WORLD_W, y: 430 }, { x: 0, y: 430 }], true);
  g.fS(0x040a10, 1);
  g.fR(0, 650, WORLD_W, 90);
};

// Screen vector from a cell centre to its neighbour in a grid direction.
const dirVec = (dir) => {
  const d = DIRS[dir];
  return { x: ((d.dx + d.dy) * TW) / 2, y: ((d.dy - d.dx) * TH) / 2 };
};

// Screen-space arrow showing which stick direction reaches a neighbour cell.
const STICK_ARROW = { U: [0, -1], R: [1, 0], D: [0, 1], L: [-1, 0] };

const drawArrow = (g, cx, cy, stick, color) => {
  const [ax, ay] = STICK_ARROW[stick];
  const s = 5;
  g.fS(color, 0.9);
  g.fillTriangle(
    cx + ax * s,
    cy + ay * s,
    cx - ax * s + ay * s,
    cy - ay * s - ax * s,
    cx - ax * s - ay * s,
    cy - ay * s + ax * s,
  );
};

const drawCell = (g, x, y, color, fillAlpha, lineAlpha) => {
  const pts = cellPts(x, y);
  g.fS(color, fillAlpha);
  g.fP(pts, true);
  g.lS(2, color, lineAlpha);
  g.sP(pts, true);
};

// Shared 28-piece volumetric model: x=lateral, y=height, z=front.
// Piece = centre xyz, width/height/depth, top x/z scale, material.
// Temjin-like silhouette: big angular shoulders, slim waist, white limbs, heavy boots, V antennae.
// Materials: 0 dark joint, 1 team armour, 2 white, 3 energy, 4 orange trim.
const MECH_MODEL = [
  [-6, 4, 4, 11, 8, 17, 0.75, 0.7, 1], [6, 4, 4, 11, 8, 17, 0.75, 0.7, 1],
  [-6, 16, 0, 7, 16, 8, 0.8, 0.85, 2], [6, 16, 0, 7, 16, 8, 0.8, 0.85, 2],
  [-5, 31, 0, 7, 14, 8, 0.9, 0.8, 2], [5, 31, 0, 7, 14, 8, 0.9, 0.8, 2],
  [0, 40, 0, 12, 6, 8, 0.8, 0.8, 0],
  [0, 52, 0, 21, 15, 12, 0.72, 0.75, 1], [0, 49, 6, 10, 8, 3, 0.7, 0.7, 0],
  [0, 52, -7, 15, 16, 5, 0.8, 0.8, 0],
  [-17, 57, 0, 13, 9, 15, 0.65, 0.6, 1], [17, 57, 0, 13, 9, 15, 0.65, 0.6, 1],
  [-17, 48, 0, 5, 9, 5, 0.8, 0.8, 0], [17, 48, 0, 5, 9, 5, 0.8, 0.8, 0],
  [-17, 38, 2, 7, 11, 8, 0.75, 0.8, 2], [17, 38, 2, 7, 11, 8, 0.75, 0.8, 2],
  [0, 67, 1, 9, 8, 9, 0.7, 0.75, 2],
  [18, 31, 22, 2, 3, 40, 0.5, 0.9, 2],
  [-25, 57, 0, 5, 8, 11, 0.4, 0.6, 4], [25, 57, 0, 5, 8, 11, 0.4, 0.6, 4],
  [-2.5, 76, 0, 1.5, 10, 1.5, 0.3, 0.3, 2], [2.5, 76, 0, 1.5, 10, 1.5, 0.3, 0.3, 2],
  [-5, 30, 4.2, 3, 4, 1, 1, 1, 3], [5, 30, 4.2, 3, 4, 1, 1, 1, 3],
  [-17, 30, 3, 6, 5, 6, 0.9, 0.9, 0], [17, 30, 3, 6, 5, 6, 0.9, 0.9, 0],
  [-6, 2.5, 15, 10, 5, 6, 0.5, 0.2, 1], [6, 2.5, 15, 10, 5, 6, 0.5, 0.2, 1],
];
const MECH_FACES = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]];
const MECH_PALS = [[0x1d3a42, 0x3046d0, 0xe4eaec, 0x3dff9c, 0xff8a1e], [0x1d3a3a, 0xd8232f, 0xe4eaec, 0x3dff9c, 0xff8a1e]];

const mechTone = (c, k, flash) => {
  let r = M_min(255, (c >> 16) * k), q = M_min(255, ((c >> 8) & 255) * k), b = M_min(255, (c & 255) * k);
  flash = M_min(1, flash * 1.5);
  r = (r + (255 - r) * flash) & 248;
  q = (q + (255 - q) * flash) & 248;
  b = (b + (255 - b) * flash) & 248;
  return (r << 16) | (q << 8) | b;
};

// Tiny orthographic software renderer: transform, pose, back-face cull, light and painter-sort.
const drawMecha = (g, gx, gy, fc, color, alpha, flash, stance, pose = 'idle', frame = 0, wire = 0) => {
  const c = toIso(gx, gy), d = DIRS[fc], pal = MECH_PALS[color === C_cpu ? 1 : 0];
  const st = stance || 0, tilt = st === ST_STAGGERED ? -0.15 : st === ST_KNOCKBACK ? 0.17 : st === ST_DOWN ? -1.5 : 0;
  const sn = M_sin(tilt), co = M_cos(tilt), down = st === ST_DOWN;
  if (down) pose = 'idle';
  const lift = pose === 'move' ? [4, 12, 3][frame] : 0;
  const blade = pose === 'hslash'
    ? [[[20, 35, -2], [34, 43, -24]], [[-27, 43, 13], [31, 43, 17]], [[16, 36, 2], [-31, 39, -14]]][frame]
    : pose === 'vslash'
    ? [[[16, 60, 4], [0, 91, 8]], [[17, 46, 4], [1, 20, 34]], [[18, 33, 4], [2, 20, 33]]][frame]
    : null;
  const part = (i, x, y, z) => {
    if (pose === 'move') {
      const leg = i < 6 || i === 22 || i === 23 || i > 25, arm = (i > 11 && i < 16) || i === 17 || i === 24 || i === 25;
      const pivot = leg ? 40 : arm ? 57 : 40;
      const a = leg ? [0.16, 0.42, 0.2][frame] + (i & 1) * 0.04 : arm ? 0.52 : [0.12, 0.3, 0.16][frame];
      const yy = y - pivot, si = M_sin(a), cs = M_cos(a);
      y = pivot + yy * cs - z * si + lift;
      z = yy * si + z * cs;
    } else if (blade && i === 17) {
      const a = blade[0], b = blade[1], t = (z - 3) / 25, ox = x - 18, oy = y - 31;
      x = a[0] + (b[0] - a[0]) * t + ox * 0.4;
      y = a[1] + (b[1] - a[1]) * t + oy;
      z = a[2] + (b[2] - a[2]) * t + ox * 0.2;
    } else if (blade && (i === 11 || i === 13 || i === 15 || i === 19 || i === 25)) {
      const q = ((i === 19 ? 11 : i === 25 ? 15 : i) - 9) / 6; // tip and fist follow their arm
      const a = (pose === 'hslash' ? [[5, -2, -12], [-12, 1, 10], [-20, -4, -6]] : [[-2, 14, -2], [-4, 2, 10], [-5, -6, 12]])[frame];
      x += a[0] * q; y += a[1] * q; z += a[2] * q;
    }
    return [x, y, z];
  };
  const snap = pose === 'idle' ? 2 : 3;
  const project = (x, y, z) => {
    // DOWN lies on its back: lifted off the floor and slid forward so it stays on its tile.
    [y, z] = [y * co - z * sn + (down ? 9 : 0), y * sn + z * co + (down ? 36 : 0)];
    const wx = z * d.dx - x * d.dy, wz = z * d.dy + x * d.dx;
    const sx = c.x + (wx + wz) * 0.82, sy = c.y + (wz - wx) * 0.42 - y * 1.06;
    return [wx, y, wz, M_round(sx / snap) * snap, M_round(sy / snap) * snap];
  };
  const P = (i, x, y, z) => project(...part(i, x, y, z));
  g.fS(0x010509, 0.7 * alpha);
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
      const len = M_hypot(nx, ny, nz), light = M_max(0, (-nx * 0.45 + ny * 0.85 + nz * 0.65) / len);
      const grain = (pi + f[0]) & 1 ? -0.06 : 0.04;
      faces.push({ d: f.reduce((s, i) => s - verts[i][0] + verts[i][1] * 0.75 + verts[i][2], 0) / 4, p: f.map((i) => ({ x: verts[i][3], y: verts[i][4] })), c: mechTone(pal[mat], 0.38 + light * 0.68 + grain, flash) });
    }
  }
  faces.sort((a, b) => a.d - b.d);
  for (const f of faces) {
    g.fS(wire ? 0x041820 : f.c, alpha); g.fP(f.p, true);
    g.lS(wire ? 0.6 : 1.35, wire ? C_p1 : C_ink, alpha * 0.9); g.sP(f.p, true);
  }
  const energy = flash ? C_white : pal[3];
  if (pose === 'move') for (const x of [-7, 7]) {
    const a = P(9, x, 52, -10), b = P(9, x, 49, -33 - frame * 6);
    g.lS(10, C_ink, alpha); g.lB(a[3], a[4], b[3], b[4]);
    g.lS(6, energy, alpha); g.lB(a[3], a[4], b[3], b[4]);
    g.lS(2, C_white, alpha); g.lB(a[3], a[4], b[3], b[4]);
  }
  // Visor is permanent; the energy blade exists only during an attack pose.
  const va = P(16, -3, 68, 5.8), vb = P(16, 3, 68, 5.8);
  g.lS(4, C_ink, alpha); g.lB(va[3], va[4], vb[3], vb[4]);
  g.lS(2.5, energy, alpha); g.lB(va[3], va[4], vb[3], vb[4]);
  if (blade) {
    const sa = P(17, 18, 31, 3), sb = P(17, 18, 31, 42);
    g.lS(3, energy, alpha); g.lB(sa[3], sa[4], sb[3], sb[4]);
    g.lS(1, C_white, alpha); g.lB(sa[3], sa[4], sb[3], sb[4]);
  }
};

// Angular tactical plate with opposing cuts and a functional accent rail.
const drawLabelSlab = (g, x, y, w, h, color, selected) => {
  const cut = M_min(12, h * 0.35);
  const pts = [{ x: x + cut, y }, { x: x + w, y }, { x: x + w - cut, y: y + h }, { x, y: y + h }, { x: x + 5, y: y + 5 }];
  g.fS(0x04090f, 0.94);
  g.fP(pts.map((p) => ({ x: p.x + 3, y: p.y + 4 })), true);
  g.fS(selected ? 0x142d38 : 0x0d1720, 0.96);
  g.fP(pts, true);
  g.lS(selected ? 2.5 : 1.2, selected ? color : 0x50616a, selected ? 1 : 0.72);
  g.sP(pts, true);
  g.lS(selected ? 4 : 2, color, selected ? 1 : 0.5);
  g.lB(x + cut, y, x + M_min(w * 0.42, 78), y);
};

// Virtual-On style arrow plate pointing toward the centre (dir 1 = right, -1 = left).
const drawChevron = (g, x, y, w, h, color, dir) => {
  const t = dir > 0 ? x + w : x;
  const pts = [{ x: t - dir * w, y }, { x: t - (dir * h) / 2, y }, { x: t, y: y + h / 2 }, { x: t - (dir * h) / 2, y: y + h }, { x: t - dir * w, y: y + h }];
  g.fS(0x020805, 0.92);
  g.fP(pts, true);
  g.lS(3, color, 1);
  g.sP(pts, true);
};

const drawBolt = (g, fx) => {
  const life = (fx.until - fx.now) / fx.dur;
  g.lS(3, C_bolt, life);
  g.sP(fx.pts, false);
  g.lS(1, C_white, life);
  g.sP(fx.pts, false);
};

const makeBoltPoints = (x, y) => {
  const pts = [{ x: x + (M_random() - 0.5) * 60, y: 0 }];
  const n = 9;
  for (let i = 1; i < n; i++) {
    const t = i / n;
    pts.push({ x: pts[0].x + (x - pts[0].x) * t + (M_random() - 0.5) * 30, y: y * t });
  }
  pts.push({ x, y });
  return pts;
};

const unitColor = (i) => (i ? C_cpu : C_p1);

// "Locked in" check mark above a unit.
const drawCheck = (g, x, y, color) => {
  g.fS(0x000000, 0.85);
  g.fC(x, y, 9);
  g.lS(2, color, 1);
  g.strokeCircle(x, y, 9);
  g.lS(2.5, C_white, 1);
  g.lB(x - 4, y, x - 1, y + 4);
  g.lB(x - 1, y + 4, x + 5, y - 4);
};

// Small HP bar under a unit.
const drawMiniBar = (g, x, y, frac, color) => {
  g.fS(0x000000, 0.8);
  g.fR(x - 21, y, 42, 5);
  g.fS(color, 1);
  g.fR(x - 20, y + 1, 40 * M_max(0, frac), 3);
};

// The two vertices of the front tile that run across the facing direction (blade streak / shield).
const frontEdge = (gx, gy, fc, at) => {
  const c = toIso(gx, gy);
  const v = dirVec(fc);
  const n = M_hypot(v.x, v.y);
  const px = (-v.y / n) * TW * 0.32;
  const py = (v.x / n) * TW * 0.32;
  const m = { x: c.x + v.x * at, y: c.y + v.y * at };
  return [
    { x: m.x + px, y: m.y + py * 0.5 },
    { x: m.x - px, y: m.y - py * 0.5 },
  ];
};

const drawSweep = (g, gx, gy, fc, color, a, kd) => {
  const c = toIso(gx, gy), v = dirVec(fc);
  let arc;
  if (kd === 'hslash') {
    const side = dirVec(fc === 'N' || fc === 'S' ? 'E' : 'N');
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
  g.lS(12, C_ink, 0.72 * a);
  g.sP(arc, false);
  g.lS(7, color, 0.7 * a);
  g.sP(arc, false);
  g.lS(2.5, C_white, a);
  g.sP(arc, false);
  const q = arc[2];
  g.fS(C_white, a);
  g.fillTriangle(q.x, q.y, q.x - 7, q.y - 5, q.x - 2, q.y + 6);
};

const drawGuard = (g, gx, gy, fc, a) => {
  const [p, q] = frontEdge(gx, gy, fc, 0.52);
  const shield = [{ x: p.x, y: p.y - 7 }, { x: q.x, y: q.y - 7 }, { x: q.x + 3, y: q.y - 28 }, { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 - 38 }, { x: p.x - 3, y: p.y - 28 }];
  g.fS(0x143c54, 0.38 * a);
  g.fP(shield, true);
  g.lS(7, C_ink, 0.8 * a);
  g.sP(shield, false);
  g.lS(3, C_p1, a);
  g.sP(shield, false);
  g.lS(1.5, C_white, 0.9 * a);
  g.lB(shield[0].x + 3, shield[0].y - 3, shield[3].x, shield[3].y + 5);
  g.lB(shield[3].x, shield[3].y + 5, shield[1].x - 3, shield[1].y - 3);
};

const drawShards = (g, x, y, color, a) => {
  for (let k = 0; k < 8; k++) {
    const ang = k * 2.399 + 0.3;
    const r = 19 + (k % 3) * 9;
    const sx = x + M_cos(ang) * r;
    const sy = y + M_sin(ang) * r * 0.65;
    g.lS(2, k & 1 ? color : C_white, a * 0.7);
    g.lB(x, y, sx, sy);
    g.fS(k & 1 ? color : C_white, a * (0.55 + (k % 2) * 0.35));
    g.fillTriangle(sx, sy, sx - M_cos(ang + 0.7) * 9, sy - M_sin(ang + 0.7) * 6, sx - M_cos(ang - 0.5) * 4, sy - M_sin(ang - 0.5) * 4);
  }
};

// == AUDIO ==
// Web Audio synth: oscillators + noise. Silent in attract mode.

const createAudio = (scene) => {
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
    const len = M_floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (M_random() * 2 - 1) * (1 - i / len);
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
};

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

// Short aliases for hot Graphics methods: property names survive minification (~1.4KB saved).
const GP = Phaser.GameObjects.Graphics.prototype;
for (const [k, v] of Object.entries({ fillStyle: 'fS', lineStyle: 'lS', lineBetween: 'lB', strokePoints: 'sP', fillPoints: 'fP', fillRect: 'fR', fillCircle: 'fC' })) GP[v] = GP[k];


const hex = (n) => '#' + n.toString(16).padStart(6, '0');
const MENU_TITLES = ['MOVEMENT', 'COMBAT'];

// Dynamic menu: adds a BURST row to COMBAT when the unit is KNOCKBACK with a charge left.
const buildMenu = (u) => {
  if (!canAct(u)) return [['burst'], ['burst']];
  const combat = [...COMBAT_ACTS];
  if (canUse(u, 'burst')) combat.push('burst');
  return [MOVE_ACTS, combat];
};
const CARDS = [
  ['CATATUMBO PROTOCOL', 'MECHA DUEL // LAKE MARACAIBO'],
  ['PROGRAM', 'PICK ONE ACTION\nSPEED RESOLVES FIRST'],
  ['SWORD CLASH', 'PARRY > THRUST > FEINT > PARRY'],
  ['CONTROLS', 'STICK  MENU / AIM\nB1  CONFIRM     B2  BACK\nCLASH  B1 THRUST  B2 PARRY  B3 FEINT'],
];

const txt = (scene, x, y, size, color, originX = 0) => {
  return scene.add
    .text(x, y, '', { fontFamily: 'Arial Black, Impact, monospace', fontSize: size + 'px', fontStyle: 'bold', color, align: 'center', stroke: '#050b12', strokeThickness: size > 15 ? 2 : 1 })
    .setOrigin(originX, 0.5)
    .setDepth(10);
};

const tint = (t, c) => t.kc !== c && t.setColor(hex((t.kc = c)));

const setT = (t, s) => {
  if (t.text !== s) t.setText(s);
};

const createUi = (scene) => {
  return {
    names: [txt(scene, 30, 24, 14, hex(C_p1)), txt(scene, W - 30, 24, 14, hex(C_cpu), 1)],
    status: [txt(scene, 100, 58, 11, '#ffffff'), txt(scene, W - 100, 58, 11, '#ffffff', 1)],
    tags: [txt(scene, 0, 0, 10, hex(C_p1), 0.5), txt(scene, 0, 0, 10, hex(C_cpu), 0.5)],
    info: [txt(scene, W / 2, 22, 13, '#ffffff', 0.5), txt(scene, W / 2, 42, 10, '#c8ccd8', 0.5), txt(scene, W / 2, 56, 10, '#c8ccd8', 0.5)],
    ph: txt(scene, W / 2, H - 56, 16, '#ffffff', 0.5),
    hint: txt(scene, W / 2, H - 34, 11, '#9aa0b0', 0.5),
    menu: Array.from({ length: 11 }, () => txt(scene, 0, 0, 12, '#ffffff', 0.5)),
    title: txt(scene, W / 2, 140, 26, '#ffffff', 0.5).setDepth(11),
    sub: txt(scene, W / 2, 196, 13, '#ffffff', 0.5).setDepth(11),
    // Title screen / stage intro lettering (italic, Virtual-On style).
    big: txt(scene, W / 2, 0, 64, hex(C_gold), 0.5).setFontStyle('bold italic').setPadding(48, 0),
    big2: txt(scene, W / 2, 0, 36, hex(C_p1), 0.5).setFontStyle('bold italic').setPadding(32, 0),
    tag: txt(scene, W / 2, 54, 12, '#02140a', 0.5),
    vs: [txt(scene, 175, 284, 17, '#ffffff', 0.5), txt(scene, W / 2, 284, 30, hex(C_gold), 0.5).setFontStyle('bold italic'), txt(scene, 625, 284, 17, '#ffffff', 0.5)],
    cardT: txt(scene, 250, 340, 12, '#02140a', 0.5),
    card: txt(scene, W / 2, 410, 15, hex(C_grid), 0.5),
    press: txt(scene, W / 2, 520, 30, hex(C_gold), 0.5).setFontStyle('bold italic'),
    // NEXT ENEMY briefing column: code, weapons, arena, mission.
    ne: [txt(scene, 560, 150, 20, hex(C_grid), 0.5), txt(scene, 560, 290, 17, hex(C_grid), 0.5), txt(scene, 560, 400, 17, hex(C_gold), 0.5), txt(scene, 560, 470, 26, hex(C_grid), 0.5).setFontStyle('bold italic').setPadding(24, 0)],
    // Big italic turn clock, seconds plus small hundredths (Virtual-On style).
    tm: txt(scene, 690, 555, 40, hex(C_grid), 1).setFontStyle('bold italic').setPadding(16, 0),
    tc: txt(scene, 676, 545, 17, hex(C_grid), 0).setFontStyle('bold italic'),
  };
};

const setupCameras = (s) => {
  const main = s.cameras.main;
  s.camFocus = { x: WORLD_W / 2, y: ISO_OY };
  s.hudCam = s.cameras.add(0, 0, W, H);
  main.setBounds(0, 0, WORLD_W, WORLD_H).setDeadzone(64, 44).startFollow(s.camFocus, false, 0.09, 0.09);
  const fixed = Object.values(s.ui).flat().filter((o) => !s.ui.tags.includes(o));
  main.ignore([s.gUi, s.gWire, ...fixed]);
  s.hudCam.ignore([s.gBg, s.gMap, s.gFx, s.gUnits, s.gTop, ...s.ui.tags]);
};

const updateCamera = (s, snap) => {
  const cam = s.cameras.main;
  let p, zoom;
  if (s.mode === 'attract' || s.ph === 'clash') {
    p = toIso((s.vw[0].gx + s.vw[1].gx) / 2, (s.vw[0].gy + s.vw[1].gy) / 2);
    zoom = s.mode === 'attract' ? 1.1 : 1.5;
  } else {
    const u = s.vw[0], d = dirVec(u.fc);
    p = toIso(u.gx, u.gy);
    p.x += d.x * 2;
    p.y += d.y * 2 - 32;
    zoom = 1.42;
  }
  s.camFocus.x = p.x;
  s.camFocus.y = p.y;
  cam.setZoom(snap ? zoom : cam.zoom + (zoom - cam.zoom) * 0.08);
  if (snap) cam.centerOn(p.x, p.y);
};

const screenPoint = (s, p) => {
  const c = s.cameras.main;
  return { x: (p.x - c.worldView.x) * c.zoom, y: (p.y - c.worldView.y) * c.zoom };
};

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
  this.gWire = this.add.graphics().setScale(3.2).setDepth(9);
  this.ui = createUi(this);
  setupCameras(this);
  this.oTi = [];
  this.oTw = [];
  this.flt = [];
  this.sfx = createAudio(this);
  this.token = 0;
  this.attractStart = 0;
  this.top = [];
  // Storage persists across releases and may be missing or slow: validate entries, merge with
  // anything saved meanwhile, and never let it break the scene.
  try {
    Promise.resolve(window.platanusArcadeStorage.get(TOP_KEY)).then((r) => {
      const ok = r && r.found && Array.isArray(r.value) ? r.value.filter((e) => e && /^[A-Z]{3}$/.test(e.n) && Number.isFinite(e.s) && e.s >= 0) : [];
      this.top = [...this.top, ...ok].sort((a, b) => b.s - a.s).slice(0, 5);
    }).catch(() => {});
  } catch (e) {}
  resetMatch(this, 'attract');
}

function update(time, delta) {
  handleInput(this, time);
  updateCamera(this);
  drawWorld(this, time, delta);
  drawHud(this, time);
}

// --- Match flow ---

const clearPressed = (controls) => {
  for (const k in controls.pressed) controls.pressed[k] = false;
};

const trackDelay = (s, ms, fn, onCancel) => {
  const entry = { done: false, ev: null };
  const remove = () => {
    const i = s.oTi.indexOf(entry);
    if (i >= 0) s.oTi.splice(i, 1);
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
    entry.ev.remove(false);
    remove();
    if (onCancel) onCancel();
  };
  entry.ev = s.time.delayedCall(ms, entry.run);
  s.oTi.push(entry);
  return entry;
};

const wait = (s, ms) => {
  return new Promise((res) => trackDelay(s, ms, res, res));
};

const clearAsync = (s) => {
  [...s.oTi, ...s.oTw].forEach((e) => e.cancel());
  s.flt.forEach((t) => t.destroy());
  s.oTi = [];
  s.oTw = [];
  s.flt = [];
};

// next = continue the gauntlet: same run, next stage, P1 keeps (and heals) its HP.
const resetMatch = (s, mode, next) => {
  clearAsync(s);
  s.token++;
  s.mode = mode;
  const hp = next ? M_min(HP_MAX, s.state.us[0].hp + STAGE_HEAL) : HP_MAX;
  if (!next) {
    s.stage = 1;
    s.score = 0;
  }
  s.state = newState(s.stage, hp);
  s.gMap.clear();
  drawMap(s.gMap);
  s.vw = s.state.us.map((u) => ({ gx: u.x, gy: u.y, fc: u.fc, st: 0, flash: 0, pose: 'idle', frame: 0 }));
  s.dH = s.state.us.map((u) => u.hp);
  s.fx = [];
  s.lastP1Pick = null;
  s.clR = null;
  s.thR = null;
  s.mp = { col: 0, row: 0 };
  if (mode === 'attract') s.attractStart = s.time.now;
  s.matchStart = s.time.now;
  beginTurn(s);
  if (mode === 'play') {
    s.dl += INTRO_MS;
    s.cRdy += INTRO_MS;
  }
  updateCamera(s, true);
};

const beginTurn = (s) => {
  clearPressed(s.controls);
  const now = s.time.now;
  s.phS = now;
  s.banner = '';
  s.fx = s.fx.filter((f) => f.kd !== 'guard');
  if (s.state.over) {
    s.ph = 'over';
    s.dl = now + (s.mode === 'play' ? OVER_IDLE_MS : ATTRACT_OVER_MS);
    const [a, b] = s.state.us;
    const won = s.state.over === 'p1';
    if (s.mode === 'play') s.score += (b.mx - b.hp) * 10 + (won ? 1000 * s.stage + a.hp * 10 : 0);
    if (won) s.sfx.win();
    else s.sfx.lose();
    return;
  }
  const play = s.mode === 'play';
  s.cpuPlanned = cpuPlan(s.state, 1);
  s.cRdy = now + (play ? 700 + M_random() * 1800 : ATTRACT_TURN_MS);
  s.p1Plan = play ? null : cpuPlan(s.state, 0);
  s.ph = s.p1Plan ? 'locked' : 'choose';
  s.dl = now + TURN_MS;
  const menu = buildMenu(s.state.us[0]);
  s.mp.col = M_max(0, M_min(1, s.mp.col));
  s.mp.row = M_max(0, M_min(menu[s.mp.col].length - 1, s.mp.row));
  s.sel = { act: menu[s.mp.col][s.mp.row], dir: s.state.us[0].fc, cur: null };
};

const lockP1 = (s, plan) => {
  s.p1Plan = plan;
  s.ph = 'locked';
  s.sfx.lock();
};

// Start aiming the highlighted action.
const startAim = (s) => {
  const me = s.state.us[0];
  const a = ACTIONS[s.sel.act];
  if (!a || (!canAct(me) && s.sel.act !== 'burst') || !canUse(me, s.sel.act)) return s.sfx.tick();
  // BURST / WAIT have no aim step — lock immediately.
  if (a.target === 'none') {
    if (s.sel.act === 'burst') {
      lockP1(s, { act: 'burst' });
      return;
    }
    return s.sfx.tick();
  }
  s.sel.dir = me.fc;
  s.sel.cur = null;
  if (a.target === 'tile') {
    s.sel.valid = s.sel.act === 'tele' ? tpReach(s.state, 0) : reach(s.state, 0, a.range);
    const foe = s.state.us[1];
    let best = null;
    for (const wp of s.sel.valid.values()) {
      const t = wp[wp.length - 1];
      if (!best || dist(t, foe) < dist(best, foe)) best = t;
    }
    if (!best) return s.sfx.tick();
    s.sel.cur = { x: best.x, y: best.y };
  }
  s.ph = 'aim';
  s.sfx.blip();
};

// The plan the current selection describes (also drives the ghost preview).
const selPlan = (s) => {
  const a = ACTIONS[s.sel.act];
  if (a.target === 'tile') {
    const wp = s.sel.cur && s.sel.valid.get(s.sel.cur.x + ',' + s.sel.cur.y);
    return wp ? { act: s.sel.act, wp } : null;
  }
  return { act: s.sel.act, dir: s.sel.dir };
};

const handleInput = (s, time) => {
  const c = s.controls;
  const start = () => consumePressed(c, 'START1') || consumePressed(c, 'P1_1');

  if (s.mode === 'attract') {
    if (start()) return resetMatch(s, 'play');
    if (s.ph === 'locked' && time > s.cRdy) lockTurn(s);
    if (s.ph === 'over' && time > s.dl) resetMatch(s, 'attract');
    return;
  }
  if (time - s.matchStart < INTRO_MS) return clearPressed(c);
  if (s.ph === 'over') {
    if (time < s.phS + ATTRACT_OVER_MS) return clearPressed(c);
    if (!start() && time < s.dl) return;
    if (s.state.over !== 'p1') return endRun(s);
    s.stage++;
    return resetMatch(s, 'play', true);
  }
  if (s.ph === 'name') {
    const k = s.ini;
    if (consumePressed(c, 'P1_U')) k[s.iniPos] = (k[s.iniPos] + 1) % 26;
    if (consumePressed(c, 'P1_D')) k[s.iniPos] = (k[s.iniPos] + 25) % 26;
    if ((consumePressed(c, 'P1_1') && ++s.iniPos > 2) || time > s.dl) saveScore(s);
    return;
  }
  if (s.ph === 'clash') {
    const keys = ['P1_1', 'P1_2', 'P1_3'];
    if (s.state.us[0].bursts) keys.push('P1_4');
    const i = keys.findIndex((k) => consumePressed(c, k));
    if (i >= 0) {
      s.sfx.blip();
      s.clR(CLASH_PICKS[i]);
    } else if (time > s.dl) {
      s.clR(CLASH_PICKS[M_floor(M_random() * 3)]);
    }
    return;
  }
  if (s.ph === 'throw') {
    for (const [stick, dir] of Object.entries(STICK_TO_DIR)) {
      if (consumePressed(c, 'P1_' + stick) && !same(step(s.state.us[1], dir), s.state.us[0])) {
        s.thD = dir;
        s.sfx.tick();
      }
    }
    if (consumePressed(c, 'P1_1') || time > s.dl) s.thR(s.thD);
    return;
  }
  if (s.ph === 'locked') {
    if (time > s.cRdy + 300) lockTurn(s);
    return;
  }
  if (s.ph !== 'choose' && s.ph !== 'aim') return;

  const canBurst = s.state.us[0].st === ST_KNOCKBACK && canUse(s.state.us[0], 'burst');
  if (!canAct(s.state.us[0]) && !canBurst) {
    if (time > s.phS + STUN_SHOW_MS) lockP1(s, WAIT_PLAN);
    return;
  }
  if (time > s.dl) return lockP1(s, WAIT_PLAN);

  const sel = s.sel;
  if (s.ph === 'choose') {
    const me = s.state.us[0];
    const m = s.mp;
    const fullMenu = buildMenu(me);
    const col = fullMenu[m.col];
    if (consumePressed(c, 'P1_U')) m.row = (m.row + col.length - 1) % col.length;
    else if (consumePressed(c, 'P1_D')) m.row = (m.row + 1) % col.length;
    else if (consumePressed(c, 'P1_L') || consumePressed(c, 'P1_R')) {
      m.col = 1 - m.col;
      m.row = M_min(m.row, fullMenu[m.col].length - 1);
    } else if (consumePressed(c, 'P1_1')) return startAim(s);
    else return;
    sel.act = fullMenu[m.col][m.row];
    s.sfx.tick();
    return;
  }

  // Aiming.
  if (consumePressed(c, 'P1_2')) {
    s.ph = 'choose';
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
      const me = s.state.us[0];
      if (sel.valid.has(n.x + ',' + n.y) || same(n, me)) sel.cur = n;
    }
  }
  if (consumePressed(c, 'P1_1')) {
    const plan = selPlan(s);
    if (plan) lockP1(s, plan);
    else s.sfx.tick();
  }
};

// Run over: enter initials if the score makes the top 5, otherwise back to attract.
const endRun = (s) => {
  if (s.score > 0 && (s.top.length < 5 || s.score > s.top[4].s)) {
    s.ph = 'name';
    s.ini = [0, 0, 0];
    s.iniPos = 0;
    s.dl = s.time.now + OVER_IDLE_MS; // an abandoned cabinet still saves and returns to attract
    clearPressed(s.controls);
  } else resetMatch(s, 'attract');
};

const initials = (k) => k.map((n) => String.fromCharCode(65 + n)).join('');

const saveScore = (s) => {
  s.top = [...s.top, { n: initials(s.ini), s: s.score }].sort((a, b) => b.s - a.s).slice(0, 5);
  resetMatch(s, 'attract');
  try {
    Promise.resolve(window.platanusArcadeStorage.set(TOP_KEY, s.top)).catch(() => {});
  } catch (e) {}
};

const lockTurn = async (s) => {
  const token = s.token;
  let thrown = -1;
  s.ph = 'resolve';
  const r = resolveTurn(s.state, [s.p1Plan, s.cpuPlanned]);
  if (!(await playEvents(s, r.events, token))) return;
  s.state = r.state;
  if (r.launched >= 0) thrown = r.launched;

  if (r.grab !== null && r.grab !== undefined && !s.state.over) {
    const dir = await askThrow(s, r.grab);
    if (token !== s.token) return;
    const t = resolveThrow(s.state, r.grab, dir);
    thrown = 1 - r.grab;
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
    // A thrown unit already triggered every zone it flew over.
    const zEvents = [];
    [0, 1].forEach((i) => i !== thrown && resolveZone(s.state, i, zEvents));
    checkOutcome(s.state);
    if (zEvents.length && !(await playEvents(s, zEvents, token))) return;
  }

  s.dH = s.state.us.map((u) => u.hp);
  s.vw.forEach((v, i) => {
    const u = s.state.us[i];
    Object.assign(v, { gx: u.x, gy: u.y, fc: u.fc, st: u.st });
  });
  await wait(s, 450);
  if (token === s.token) beginTurn(s);
};

const askThrow = (s, who) => {
  if (s.mode !== 'play' || who !== 0) return wait(s, 400).then(() => cpuThrowDir(s.state, who));
  const foe = s.state.us[1];
  s.thD = DIR_KEYS.find((k) => !same(step(foe, k), s.state.us[0]));
  s.ph = 'throw';
  s.dl = s.time.now + CLASH_MS;
  clearPressed(s.controls);
  return new Promise((res) => {
    s.thR = (dir) => {
      s.ph = 'resolve';
      res(dir);
    };
  });
};

const askClash = (s) => {
  const cpu = cpuClashPick(s.lastP1Pick, s.state.us[1].bursts);
  if (s.mode !== 'play') return wait(s, 600).then(() => [cpuClashPick(null, s.state.us[0].bursts), cpu]);
  s.ph = 'clash';
  s.phS = s.time.now;
  s.dl = s.time.now + CLASH_MS;
  clearPressed(s.controls);
  return new Promise((res) => {
    s.clR = (pick) => {
      s.clR = null;
      s.ph = 'resolve';
      res([pick, cpu]);
    };
  });
};

const tweenTo = (s, o, x, y, ms) => {
  return new Promise((res) => {
    const entry = { done: false, tw: null };
    const finish = () => {
      if (entry.done) return;
      entry.done = true;
      const i = s.oTw.indexOf(entry);
      if (i >= 0) s.oTw.splice(i, 1);
      res();
    };
    entry.cancel = () => {
      entry.tw.stop();
      finish();
    };
    entry.tw = s.tweens.add({ targets: o, gx: x, gy: y, duration: ms, ease: 'Sine.easeInOut', onComplete: finish });
    s.oTw.push(entry);
  });
};

const addFx = (s, fx) => {
  fx.until = s.time.now + fx.dur;
  s.fx.push(fx);
};

// Iso shockwave ring at a unit (r = start radius; it eases out to twice that while fading).
const ring = (s, o, color, r, dur) => {
  const p = toIso(o.gx, o.gy);
  addFx(s, { kd: 'ring', x: p.x, y: p.y - 26, color, r, dur });
};

const floatText = (s, o, str, color, size = 15, life = 1000) => {
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
  s.flt.push(t);
  const entry = { done: false, tw: null };
  const finish = () => {
    if (entry.done) return;
    entry.done = true;
    let i = s.oTw.indexOf(entry);
    if (i >= 0) s.oTw.splice(i, 1);
    i = s.flt.indexOf(t);
    if (i >= 0) s.flt.splice(i, 1);
    t.destroy();
  };
  entry.cancel = () => {
    entry.tw.stop();
    finish();
  };
  entry.tw = s.tweens.add({ targets: t, y: t.y - 26, alpha: 0, delay: life * 0.4, duration: life * 0.6, onComplete: finish });
  s.oTw.push(entry);
};

const actLabel = (i) => (i ? 'CPU ' : 'P1 ');

// Play one resolution step by step so the order of actions reads clearly.
const playEvents = async (s, events, token) => {
  const v = s.vw;
  // Broken tiles reappear until their impact plays (the rules already applied them).
  events.forEach((e) => e.t === 'break' && (LAGO_MAP[e.y][e.x] = MAP0[e.y][e.x]));
  const shake = (ms, k) => s.cameras.main.shake(ms, k);
  for (let ei = 0; ei < events.length; ei++) {
    const e = events[ei];
    if (token !== s.token) return false;
    const u = v[e.who];
    if (e.t === 'order') {
      // Both actions are revealed together; speed decides what lands first. Held poses drop here.
      v.forEach((x) => (x.pose = 'idle'));
      s.banner = e.acts.map((a, i) => actLabel(i) + ACTIONS[a].name + (a === 'wait' ? '' : ' ' + e.spd[i])).join('  VS  ');
      e.acts.forEach((a, i) => floatText(s, v[i], ACTIONS[a].name, unitColor(i), 18, 1100));
      s.sfx.tick();
      await wait(s, 650);
    } else if (e.t === 'beat') {
      await wait(s, 80);
    } else if (e.t === 'face') {
      u.fc = e.fc;
      await wait(s, 120);
    } else if (e.t === 'move') {
      // Consecutive moves in a beat animate together.
      let end = ei;
      while (end < events.length && events[end].t === 'move') end++;
      const batch = events.slice(ei, end);
      batch.forEach(() => s.sfx.move());
      await Promise.all(batch.map(async (m) => {
        const mover = v[m.who], thrust = m.act === 'move' || m.act === 'lunge';
        if (m.act === 'tele') {
          const from = toIso(mover.gx, mover.gy);
          addFx(s, { kd: 'shards', x: from.x, y: from.y - 30, color: unitColor(m.who), dur: 300 });
          Object.assign(mover, { gx: m.wp[0].x, gy: m.wp[0].y, fc: m.fc, flash: 1 });
          s.sfx.parry();
          return wait(s, 250);
        }
        const steps = m.wp.length * 3;
        let n = 0;
        mover.pose = thrust ? 'move' : 'idle';
        if (thrust) mover.fc = m.fc;
        for (const c of m.wp) {
          const x = mover.gx, y = mover.gy;
          for (let f = 0; f < 3; f++, n++) {
            if (thrust) mover.frame = n === 0 ? 0 : n === steps - 1 ? 2 : 1;
            await tweenTo(s, mover, x + (c.x - x) * (f + 1) / 3, y + (c.y - y) * (f + 1) / 3, STEP_MS / 3);
          }
        }
        mover.fc = m.fc;
        mover.pose = 'idle'; mover.frame = 0;
      }));
      ei = end - 1;
    } else if (e.t === 'bump') {
      floatText(s, u, 'BLOCKED', C_white, 12);
      await wait(s, 300);
    } else if (e.t === 'guard') {
      addFx(s, { kd: 'guard', who: e.who, dur: 4000 });
      u.pose = 'hslash';
      u.frame = 0;
      s.sfx.blip();
      await wait(s, 250);
    } else if (STRIKE_ACTS.includes(e.t) || e.t === 'grab') {
      (e.tiles && e.tiles.length ? e.tiles : [{ x: e.x, y: e.y }]).forEach((t) =>
        addFx(s, { kd: 'cell', x: t.x, y: t.y, color: unitColor(e.who), dur: 450 }),
      );
      const slash = e.t === 'vslash' || e.t === 'hslash', attack = e.t !== 'grab';
      if (attack) {
        u.pose = slash ? e.t : 'vslash'; u.frame = 0;
        await wait(s, slash ? 140 : 90);
        u.frame = 1;
        addFx(s, { kd: 'sweep', who: e.who, act: e.t, dur: slash ? 220 : 200 });
        s.sfx.swing();
        await wait(s, 90);
        u.frame = 2;
        await wait(s, slash ? 110 : 70);
      } else await wait(s, 260);
    } else if (e.t === 'miss') {
      floatText(s, u, 'MISS', 0x9aa0b0, 14);
      await wait(s, 350);
    } else if (e.t === 'hit') {
      u.flash = 1;
      u.pose = 'idle';
      const hitAt = toIso(u.gx, u.gy);
      addFx(s, { kd: 'shards', x: hitAt.x, y: hitAt.y - 30, color: e.who ? C_cpu : C_p1, dur: 380 });
      s.dH[e.who] = M_max(0, s.dH[e.who] - e.dmg);
      const dmgText = 'HIT!! -' + e.dmg + (e.flank ? ' FLANK!' : '') + (e.slam ? ' SLAM!' : '');
      floatText(s, u, dmgText, C_white, 17);
      // Combo bonus: if the target was in a non-normal stance, shout it.
      const targetSt = e.prevSt || ST_NORMAL;
      if (targetSt > ST_NORMAL && e.combo !== false) floatText(s, u, 'COMBO!', C_bolt, 14);
      const ko = !s.dH[e.who];
      ring(s, u, ko ? C_white : unitColor(e.who), ko ? 40 : 18, ko ? 900 : 320);
      shake(ko ? 600 : 140, ko ? 0.02 : 0.008);
      s.sfx.hit();
      await wait(s, ko ? HIT_PAUSE_MS * 2 : HIT_PAUSE_MS);
    } else if (e.t === 'parry') {
      floatText(s, u, 'PARRY! +' + GUTS_BONUS, C_coast, 17);
      addFx(s, { kd: 'flash', dur: 120 });
      ring(s, u, C_p1, 22, 380);
      s.sfx.parry();
      await wait(s, HIT_PAUSE_MS);
    } else if (e.t === 'interrupt') {
      floatText(s, u, ACTIONS[e.act].name + ' LOST', C_bolt, 13, 1300);
      await wait(s, 450);
    } else if (e.t === 'knock') {
      u.pose = 'idle';
      for (const c of e.wp) await tweenTo(s, u, c.x, c.y, STEP_MS * (e.fly ? 0.45 : 0.7));
    } else if (e.t === 'break') {
      LAGO_MAP[e.y][e.x] = 0;
      s.gMap.clear();
      drawMap(s.gMap);
      const p = toIso(e.x, e.y);
      addFx(s, { kd: 'shards', x: p.x, y: p.y - 12, color: e.k === 3 ? C_rust : C_concrete, dur: 520 });
      if (e.dmg) {
        s.dH[e.who] = M_max(0, s.dH[e.who] - e.dmg);
        u.flash = 1;
        floatText(s, u, (e.k === 2 ? 'BRIDGE DOWN! -' : 'PALAFITO WRECKED! -') + e.dmg, C_white, 16, 1300);
        shake(240, 0.014);
        s.sfx.clash();
        await wait(s, 500);
      }
    } else if (e.t === 'caught') {
      floatText(s, u, 'CAUGHT!', C_bolt, 17);
      s.sfx.hit();
      await wait(s, 400);
    } else if (e.t === 'throw') {
      floatText(s, u, 'THROW!', unitColor(e.who), 17);
      await wait(s, 200);
    } else if (e.t === 'launch') {
      floatText(s, u, 'LAUNCHED!', C_bolt, 17);
      shake(160, 0.01);
      await wait(s, 250);
    } else if (e.t === 'refresh') {
      floatText(s, u, 'GUTS FULL! CHARGES READY', C_bolt, 14, 1300);
      s.sfx.lock();
      await wait(s, 300);
    } else if (e.t === 'open') {
      floatText(s, u, 'WHIFF! OPEN', C_cpu, 15, 1200);
      await wait(s, 350);
    } else if (e.t === 'momentum') {
      floatText(s, u, 'MOMENTUM', C_bolt, 13);
    } else if (e.t === 'burst') {
      u.st = ST_NORMAL;
      floatText(s, u, 'BURST!', C_bolt, 17);
      addFx(s, { kd: 'flash', dur: 120 });
      ring(s, u, C_bolt, 34, 520);
      s.sfx.clash();
      await wait(s, 300);
    } else if (e.t === 'stance') {
      u.st = e.st;
      const stColors = [C_coast, C_bolt, C_cpu, C_white];
      const stLabel = ['RECOVERED', 'STAGGERED', 'KNOCKBACK', 'DOWN'][e.st];
      addFx(s, { kd: 'flash', color: stColors[e.st] || C_white, dur: 180 });
      if (stLabel) floatText(s, u, stLabel, stColors[e.st] || C_white, 16);
      await wait(s, 250);
    } else if (e.t === 'zone') {
      const zLabel = e.zone + (e.dmg ? ' -' + e.dmg : '') + (e.guts ? ' +' + GUTS_BONUS + ' GUTS' : '') + (e.push ? ' SLIP!' : '') + (e.st ? ' ' + ST_NAME[e.st] : '');
      if (e.zone === 'CAT') {
        const strike = toIso(u.gx, u.gy);
        addFx(s, { kd: 'bolt', pts: makeBoltPoints(strike.x, strike.y - 22), dur: 500 });
        addFx(s, { kd: 'shards', x: strike.x, y: strike.y - 20, color: C_bolt, dur: 420 });
      }
      floatText(s, u, zLabel, e.color || C_bolt, 14);
      if (e.dmg) {
        s.dH[e.who] = M_max(0, s.dH[e.who] - e.dmg);
        u.flash = 0.6;
        shake(100, 0.006);
        s.sfx.hit();
      }
      if (e.st !== undefined) u.st = e.st;
      if (e.wp && e.wp.length) {
        for (const c of e.wp) await tweenTo(s, u, c.x, c.y, STEP_MS * 0.7);
      }
      if (e.guts) s.sfx.blip();
      addFx(s, { kd: 'flash', color: e.color || C_bolt, dur: 100 });
      await wait(s, 400);
    } else if (e.t === 'clash' || e.t === 'mirror') {
      const m = toIso((v[0].gx + v[1].gx) / 2, (v[0].gy + v[1].gy) / 2);
      addFx(s, { kd: 'bolt', pts: makeBoltPoints(m.x, m.y - 24), dur: 550 });
      addFx(s, { kd: 'shards', x: m.x, y: m.y - 24, color: C_cpu, dur: 520 });
      const mid = { gx: (v[0].gx + v[1].gx) / 2, gy: (v[0].gy + v[1].gy) / 2 };
      ring(s, mid, C_white, 30, 520);
      ring(s, mid, C_cpu, 16, 420);
      addFx(s, { kd: 'flash', dur: 180 });
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
};

// --- Drawing ---

const drawWorld = (s, time, delta) => {
  const g = s.gFx;
  g.clear();
  const flicker = M_random() < 0.06 ? 0.35 : 0.08 + 0.05 * M_sin(time / 300);
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const zone = ZONE_TILES[tileAt(x, y)];
      if (!zone) continue;
      const pulse = zone === 'cat' ? flicker : 0.07 + 0.06 * M_sin(time / 250 + x + y);
      g.fS(ZONE_COLOR[zone], pulse);
      g.fP(cellPts(x, y), true);
    }
  }

  // Planning previews: reachable tiles, aim arrows, ghost, attack tile.
  let ghost = null;
  const me = s.state.us[0];
  const play = s.mode === 'play';
  const blink = 0.5 + 0.5 * M_sin(time / 90);
  const planning = canAct(me) || canUse(me, 'burst');
  if (play && (s.ph === 'choose' || s.ph === 'aim') && planning) {
    const sel = s.sel;
    const a = ACTIONS[sel.act];
    if (s.ph === 'aim' && a.target === 'tile') {
      for (const wp of sel.valid.values()) {
        const t = wp[wp.length - 1];
        drawCell(g, t.x, t.y, 0x43f08a, 0.14, 0.65);
      }
      const wp = sel.valid.get(sel.cur.x + ',' + sel.cur.y);
      if (wp) {
        g.lS(2, C_white, 0.8);
        g.sP([me, ...wp].map((c) => toIso(c.x, c.y)), false);
      }
      drawCell(g, sel.cur.x, sel.cur.y, C_white, 0.15 + 0.15 * blink, 1);
    }
    if (s.ph === 'aim' && a.target === 'dir') {
      for (const [stick, dir] of Object.entries(STICK_TO_DIR)) {
        const n = step(me, dir);
        const p = toIso(n.x, n.y);
        drawArrow(g, p.x, p.y, stick, dir === sel.dir ? C_white : 0x5a6070);
      }
      if (sel.act === 'lunge') {
        const wp = dashPath(me, sel.dir, LUNGE_DASH, s.state.us[1]);
        wp.forEach((c) => drawCell(g, c.x, c.y, C_bolt, 0.1, 0.5));
      }
      if (sel.act !== 'pivot') {
        const end = previewPlan(me, { act: sel.act, dir: sel.dir }, s.state.us[1]);
        const col = sel.act === 'parry' ? C_white : C_cpu;
        const atkTiles =
          sel.act === 'vslash'
            ? vslashTiles({ x: end.x, y: end.y, fc: sel.dir })
            : sel.act === 'hslash'
            ? hslashTiles({ x: end.x, y: end.y, fc: sel.dir })
            : [step(end, sel.dir)];
        atkTiles.forEach((c) => drawCell(g, c.x, c.y, col, 0.15 + 0.2 * blink, 0.5 + 0.5 * blink));
      }
    }
    if (s.ph === 'aim') {
      const plan = selPlan(s);
      if (plan && !(a.strike && plan.act !== 'lunge')) ghost = previewPlan(me, plan, s.state.us[1]);
    }
  }
  if (play && s.ph === 'throw') {
    const foe = s.state.us[1];
    for (const [stick, dir] of Object.entries(STICK_TO_DIR)) {
      const n = step(foe, dir);
      if (same(n, me)) continue;
      const p = toIso(n.x, n.y);
      drawArrow(g, p.x, p.y, stick, dir === s.thD ? C_white : 0x5a6070);
    }
    const f = flightOf(foe, s.thD, me, 1);
    f.wp.forEach((c, k) => drawCell(g, c.x, c.y, k === f.wp.length - 1 && f.breaks.length ? C_cpu : C_bolt, 0.15 + 0.15 * blink, 0.8));
  }

  const gu = s.gUnits;
  gu.clear();
  const order = s.vw.map((v, i) => ({ v, i })).sort((a, b) => a.v.gy - a.v.gx - (b.v.gy - b.v.gx));
  for (const { v, i } of order) {
    v.flash = M_max(0, v.flash - delta / 250);
    if (i === 0 && ghost) drawMecha(gu, ghost.x, ghost.y, ghost.fc, C_p1, 0.35, 0, 0, 'idle', 0);
    const pl = s.ph === 'aim' ? s.sel : s.ph === 'locked' && s.p1Plan;
    const guard = !i && play && pl && STRIKE_ACTS.includes(pl.act) && (pl.act === 'hslash' ? 'hslash' : 'vslash');
    const stance = guard || (s.ph === 'clash' && 'vslash');
    drawMecha(gu, v.gx, v.gy, guard ? pl.dir : v.fc, unitColor(i), 1, v.flash, v.st, stance || v.pose, stance ? 0 : v.frame);
    const p = toIso(v.gx, v.gy);
    const n = s.vw[1 - i];
    const near = M_abs(v.gx - n.gx) + M_abs(v.gy - n.gy) < 3;
    const off = near ? M_sign(v.gx + v.gy - n.gx - n.gy || i * 2 - 1) * 22 : 0;
    drawMiniBar(gu, p.x + off, p.y + 12, s.dH[i] / s.state.us[i].mx, unitColor(i));
    s.ui.tags[i].setPosition(p.x + off, p.y + 25);
    const stName = ['P1', 'CPU'][i] + (v.st ? '  ' + ST_NAME[v.st] : '') + (s.state.us[i].open ? '  OPEN' : '');
    setT(s.ui.tags[i], stName);
    const ready = i === 0 ? !!s.p1Plan && s.ph === 'locked' : s.ph === 'locked' || (play && (s.ph === 'choose' || s.ph === 'aim') && time > s.cRdy);
    if (ready) drawCheck(gu, p.x + 16, p.y - 50, unitColor(i));
  }

  const gt = s.gTop;
  gt.clear();
  if (play) {
    const p = toIso(s.vw[1].gx, s.vw[1].gy);
    const r = 27 + blink * 3;
    gt.lS(2, C_cpu, 0.4 + blink * 0.5);
    gt.strokeCircle(p.x, p.y - 30, r);
    gt.lB(p.x - r - 7, p.y - 30, p.x - r + 5, p.y - 30);
    gt.lB(p.x + r - 5, p.y - 30, p.x + r + 7, p.y - 30);
  }
  s.fx = s.fx.filter((f) => f.until > time);
  for (const f of s.fx) {
    const a = M_min(1, (f.until - time) / M_min(f.dur, 400));
    if (f.kd === 'bolt') drawBolt(gt, { pts: f.pts, until: f.until, now: time, dur: f.dur });
    else if (f.kd === 'cell') drawCell(gt, f.x, f.y, f.color, 0.4 * a, a);
    else if (f.kd === 'sweep') drawSweep(gt, s.vw[f.who].gx, s.vw[f.who].gy, s.vw[f.who].fc, unitColor(f.who), a, f.act);
    else if (f.kd === 'guard') drawGuard(gt, s.vw[f.who].gx, s.vw[f.who].gy, s.vw[f.who].fc, a);
    else if (f.kd === 'shards') drawShards(gt, f.x, f.y, f.color, a);
    else if (f.kd === 'ring') {
      const q = (f.until - time) / f.dur; // continuous over the whole ring life
      const k = f.r * (2 - q * q);
      gt.lS(1 + 5 * q, f.color, q);
      gt.strokeEllipse(f.x, f.y, k * 2, k);
    }
    else if (f.kd === 'flash') {
      gt.fS(f.color || C_white, 0.35 * a);
      gt.fR(0, 0, W, H);
    }
  }
};

const drawHud = (s, time) => {
  const g = s.gUi;
  const ui = s.ui;
  g.clear();
  const us = s.state.us;
  const play = s.mode === 'play';
  const arc = (x, y, r, a, b, color, width, alpha = 1) => {
    g.lS(width, color, alpha);
    g.beginPath();
    g.arc(x, y, r, a, b, false);
    g.strokePath();
  };

  // Compact opposing pilot panels with one thick, legible HP rail.
  [0, 1].forEach((i) => {
    if (!play || time - s.matchStart < INTRO_MS) {
      setT(ui.names[i], '');
      setT(ui.status[i], '');
      return;
    }
    const color = unitColor(i);
    const x0 = i ? W - 234 : 12;
    const u = us[i];
    drawLabelSlab(g, x0, 9, 222, 56, color, false);
    const bx = x0 + 12;
    const bw = 198;
    const hp = M_max(0, s.dH[i]) / u.mx;
    g.fS(0x02070c, 1);
    g.fR(bx, 34, bw, 11);
    g.fS(color, 0.95);
    if (i) g.fR(bx + bw * (1 - hp), 35, bw * hp, 9);
    else g.fR(bx, 35, bw * hp, 9);
    g.lS(1, C_ink, 0.9);
    for (let k = 1; k < 10; k++) g.lB(bx + (bw * k) / 10, 35, bx + (bw * k) / 10, 44);
    // GUTS meter, filling toward the centre like the HP rail.
    const gx = i ? x0 + 150 : x0 + 12;
    const gw = (60 * u.guts) / GUTS_MAX;
    g.fS(0x02070c, 1);
    g.fR(gx, 52, 60, 7);
    g.fS(C_bolt, 1);
    g.fR(i ? gx + 60 - gw : gx, 53, gw, 5);
    ui.names[i].setPosition(i ? W - 28 : 28, 21);
    ui.status[i].setPosition(i ? W - 84 : 84, 57);
    setT(ui.names[i], (i ? 'CPU LV' + s.stage : 'P1 MARACAIBO') + ' // HP ' + M_max(0, s.dH[i]));
    const stLabel = ST_NAME[u.st] || '';
    setT(ui.status[i], [stLabel, u.open && 'OPEN', u.od && 'OVERDRIVE ' + u.od, u.momentum && 'MOMENTUM', canUse(u, 'burst') && 'BURST READY'].filter(Boolean).join(' // '));
  });

  // Reserved top-centre action telemetry, clear of both HP panels.
  let info = ['', '', ''];
  const me = us[0];
  const intro = play && time - s.matchStart < INTRO_MS;
  const aiming = play && !intro && (s.ph === 'choose' || s.ph === 'aim') && (canAct(me) || canUse(me, 'burst'));
  if (aiming) {
    const a = ACTIONS[s.sel.act];
    const plan = selPlan(s) || { act: s.sel.act, dir: me.fc };
    const available = (canAct(me) || s.sel.act === 'burst') && canUse(me, s.sel.act);
    info = available
      ? [a.name + '  //  SPD ' + speedOf(me, plan), a.info[0], a.info[1]]
      : [a.name + '  //  LOCKED', canAct(me) ? 'NEEDS MOMENTUM' : 'ONLY BURST BREAKS KNOCKBACK', canAct(me) ? 'MOVE FORWARD 3 FIRST' : 'NO CHARGE: FILL GUTS TO REFRESH'];
    drawLabelSlab(g, 244, 9, 312, 56, C_p1, false);
  }
  info.forEach((t, k) => setT(ui.info[k], t));

  // Phase/hint copy remains input-accurate; the rail keeps it off the board.
  let ph = '';
  let hint = '';
  if (play && aiming && s.ph === 'choose') {
    ph = 'TURN ' + s.state.turn + '  //  PICK AN ACTION';
    hint = 'L/R TYPE   U/D ACTION   B1 SELECT';
  } else if (play && aiming) {
    ph = 'AIM // ' + ACTIONS[s.sel.act].name;
    hint = 'STICK AIM   B1 CONFIRM   B2 BACK';
  } else if (play && s.ph === 'choose' && !canAct(me)) {
    ph = me.open ? 'OPEN // WHIFF RECOVERY' : ST_NAME[me.st];
    hint = 'CANNOT ACT THIS TURN';
  } else if (play && s.ph === 'locked') {
    ph = 'COMMAND LOCKED';
    hint = time > s.cRdy ? 'BOTH PILOTS READY' : 'ENEMY ENCRYPTED...';
  } else if (play && s.ph === 'clash') {
    ph = 'SWORD CLASH // PICK FAST';
    hint = 'PARRY > THRUST > FEINT > PARRY   BURST BEATS THRUST + FEINT';
  } else if (play && s.ph === 'throw') {
    ph = 'TARGET CAPTURED // THROW';
    hint = 'STICK AIM   B1 THROW   SMASH HUTS / BRIDGE';
  } else if (s.ph === 'resolve') ph = s.banner;
  setT(ui.ph, play ? ph : '');
  setT(ui.hint, hint);

  const items = [];
  if (play && aiming && s.ph === 'choose') {
    const p = screenPoint(s, toIso(s.vw[0].gx, s.vw[0].gy));
    const cx = M_max(195, M_min(W - 195, p.x));
    const cy = M_max(206, M_min(400, p.y - 30));
    // Radial dial: categories sit on the upper ring; actions spread along the active side,
    // ~32px apart so every plate breathes. The mecha stays visible in the centre.
    const fullMenu = buildMenu(us[0]);
    const col = fullMenu[s.mp.col];
    const side = s.mp.col ? 1 : -1;
    g.fS(0x02070c, 0.35);
    g.fC(cx, cy, 104);
    arc(cx, cy, 104, 0, 7, C_p1, 1.5, 0.3);
    arc(cx, cy, 116, side > 0 ? -1.2 : 1.6, side > 0 ? 1.55 : 4.35, C_p1, 4, 0.55);
    if (canAct(us[0])) {
      items.push({ kd: 'cat', x: cx - 78, y: cy - 128, label: MENU_TITLES[0], on: s.mp.col === 0 });
      items.push({ kd: 'cat', x: cx + 78, y: cy - 128, label: MENU_TITLES[1], on: s.mp.col === 1 });
    }
    const stepA = M_min(0.42, 2.5 / col.length);
    col.forEach((act, ri) => {
      const a = 0.25 + (ri - (col.length - 1) / 2) * stepA;
      items.push({ kd: 'act', x: cx + side * M_cos(a) * 132, y: cy + M_sin(a) * 110, label: ACTIONS[act].name, on: s.mp.row === ri, off: !canUse(us[0], act) });
    });
  } else if (play && s.ph === 'clash') {
    const p = screenPoint(s, toIso((s.vw[0].gx + s.vw[1].gx) / 2, (s.vw[0].gy + s.vw[1].gy) / 2));
    const cx = M_max(120, M_min(W - 120, p.x));
    const cy = M_max(150, M_min(H - 170, p.y - 26));
    arc(cx, cy, 62, -2.8, 0.35, 0x2d0713, 16, 0.82);
    arc(cx, cy, 62, -2.8, 0.35, C_cpu, 4, 1);
    arc(cx, cy, 79, -0.15, 2.65, C_cpu, 3, 0.65);
    drawShards(g, cx, cy, C_cpu, 0.9);
    const opts = us[0].bursts ? ['THRUST', 'PARRY', 'FEINT', 'BURST'] : ['THRUST', 'PARRY', 'FEINT'];
    const side = cx < 530 ? 1 : -1;
    const cardX = side > 0 ? M_min(W - 174, cx + 88) : M_max(14, cx - 262);
    const cardY = M_max(100, M_min(H - 170 - opts.length * 43, cy - 83));
    opts.forEach((name, k) => {
      const x = cardX + (k % 2 ? 13 : 0) * side;
      const y = cardY + k * 43;
      const w = 160;
      const cut = 17 + (k % 2) * 8;
      const card = side > 0
        ? [{ x: x + cut, y }, { x: x + w, y: y + 4 }, { x: x + w - 12, y: y + 38 }, { x, y: y + 34 }]
        : [{ x, y: y + 4 }, { x: x + w - cut, y }, { x: x + w, y: y + 34 }, { x: x + 12, y: y + 38 }];
      g.fS(0x010308, 0.97);
      g.fP(card, true);
      g.lS(4, C_cpu, 1);
      g.sP(card, true);
      g.lS(1.5, 0xff91a9, 0.8);
      g.lB(x + 15, y + 32, x + 113, y + 35);
      items.push({ kd: 'clash', x: x + 76, y: y + 18, label: name });
      items.push({ kd: 'key', x: x + 137, y: y + 20, label: 'B' + (k + 1) });
    });
  }

  ui.menu.forEach((t, k) => {
    const it = items[k];
    t.setVisible(!!it);
    if (!it) return;
    // Pool objects stay API-minimal for the cabinet harness; geometry carries hierarchy.
    if (it.kd === 'cat') drawLabelSlab(g, it.x - 47, it.y - 11, 94, 22, C_p1, it.on);
    if (it.kd === 'act') drawLabelSlab(g, it.x - (it.on ? 59 : 52), it.y - 10, it.on ? 118 : 104, 20, C_p1, it.on);
    t.setColor(it.on || it.kd === 'clash' ? '#ffffff' : it.kd === 'key' ? '#ff9ab1' : it.off ? '#53616a' : it.kd === 'cat' ? hex(C_coast) : '#dce5e5');
    t.setPosition(it.x, it.y);
    setT(t, it.label);
  });

  // Cohesive lower phase rail and time pressure meter.
  if (play && ph) {
    g.fS(0x03080e, 0.9);
    g.fP([{ x: 0, y: 530 }, { x: 145, y: 530 }, { x: 165, y: 538 }, { x: 635, y: 538 }, { x: 655, y: 530 }, { x: W, y: 530 }, { x: W, y: H }, { x: 0, y: H }], true);
    g.lS(2, s.ph === 'clash' ? C_cpu : C_p1, 0.75);
    g.lB(145, 530, 655, 530);
  }
  let clock = '';
  let cs = '';
  if (play && !intro && ['choose', 'aim', 'clash', 'throw'].includes(s.ph)) {
    const total = s.ph === 'clash' || s.ph === 'throw' ? CLASH_MS : TURN_MS;
    const ms = M_min(total, M_max(0, s.dl - time));
    const left = ms / total;
    clock = '' + M_floor(ms / 1000);
    cs = ('0' + M_floor((ms % 1000) / 10)).slice(-2);
    [ui.tm, ui.tc].forEach((t) => tint(t, left > 0.5 ? C_grid : left > 0.25 ? C_gold : C_cpu));
    const barW = 430;
    const barX = W / 2 - barW / 2;
    const barColor = left > 0.5 ? C_p1 : left > 0.25 ? C_bolt : C_cpu;
    g.fS(0x17232c, 1);
    g.fR(barX, H - 11, barW, 5);
    g.fS(barColor, 1);
    g.fR(barX, H - 11, barW * left, 5);
  }
  setT(ui.tm, clock);
  setT(ui.tc, cs);

  // Attract/game-over title treatment: one decisive plate, no generic modal stack.
  let title = '';
  let sub = '';
  let titleColor = C_p1;
  const blinkOn = M_floor(time / 450) % 2 === 0;
  let big = '';
  let big2 = '';
  let card = ['', ''];
  let ne = ['', '', '', ''];
  s.gWire.clear();
  if (!play) {
    // Title screen: the demo duel runs dimmed behind a CRT grid (M.S.B.S. / VS screen homage).
    g.fS(0x010806, 0.62);
    g.fR(0, 0, W, H);
    g.lS(1, C_grid, 0.14);
    for (let k = 0; k <= 25; k++) {
      g.lB(k * 32, 0, k * 32, H);
      g.lB(0, k * 32, W, k * 32);
    }
    g.fS(C_grid, 1);
    g.fR(255, 45, 290, 19);
    g.fR(160, 331, 180, 19);
    drawChevron(g, 30, 262, 300, 44, C_p1, 1);
    drawChevron(g, 470, 262, 300, 44, C_cpu, -1);
    g.lS(3, C_grid, 0.9);
    g.sP([{ x: 150, y: 340 }, { x: 650, y: 340 }, { x: 650, y: 470 }, { x: 170, y: 470 }, { x: 150, y: 450 }], true);
    const cards = s.top.length ? [...CARDS, ['TOP PILOTS', s.top.map((e, k) => k + 1 + '. ' + e.n + '  ' + e.s).join('\n')]] : CARDS;
    card = cards[M_floor((time - s.attractStart) / CARD_MS) % cards.length];
    big = 'CATATUMBO';
    big2 = 'PROTOCOL';
    tint(ui.big, C_gold);
    ui.big.setY(122).setScale(1);
    ui.big2.setPosition(W / 2, 184);
  } else if (intro) {
    // NEXT ENEMY briefing: CRT grid, spinning wireframe of the rival, its spec sheet and the arena.
    g.fS(0x01060a, 0.97);
    g.fR(0, 0, W, H);
    g.lS(1, C_p1, 0.12);
    for (let k = 0; k <= 25; k++) {
      g.lB(k * 32, 0, k * 32, H);
      g.lB(0, k * 32, W, k * 32);
    }
    g.fS(C_cpu, 1);
    g.fillTriangle(150, 38, 150, 66, 166, 52);
    g.fillTriangle(650, 38, 650, 66, 634, 52);
    const c = toIso(0, 0);
    s.gWire.setPosition(200 - c.x * 3.2, 515 - c.y * 3.2);
    drawMecha(s.gWire, 0, 0, DIR_KEYS[M_floor(time / 450) % 4], C_cpu, 1, 0, 0, 'idle', 0, 1);
    const n = s.stage;
    big = 'NEXT ENEMY';
    big2 = 'VR.CABIMAS';
    tint(ui.big, C_cpu);
    ui.big.setY(52).setScale(0.8);
    ui.big2.setPosition(560, 205);
    ne = ['RVR-26-C  LV' + n, 'V-SLASH    H-SLASH\nJAB    LUNGE    GRAB', '- LAKE MARACAIBO -', n + ([, 'st', 'nd', 'rd'][n] || 'th') + '. MISSION'];
  } else if (s.ph === 'over') {
    const o = s.state.over;
    title = o === 'p1' ? 'STAGE ' + s.stage + ' CLEAR' : o === 'cpu' ? 'DEFEATED' : 'DRAW';
    titleColor = o === 'p1' ? C_p1 : o === 'cpu' ? C_cpu : C_bolt;
    sub = 'SCORE ' + s.score + '\n' + (time > s.phS + ATTRACT_OVER_MS && blinkOn ? (o === 'p1' ? 'PRESS START: NEXT PILOT' : 'PRESS START') : ' ');
  } else if (s.ph === 'name') {
    title = 'NEW RECORD';
    titleColor = C_bolt;
    sub = 'SCORE ' + s.score + '\n' + initials(s.ini).split('').map((ch, k) => (k === s.iniPos ? '[' + ch + ']' : ' ' + ch + ' ')).join(' ') + '\nUP/DOWN LETTER   B1 NEXT';
  }
  if (title) {
    drawLabelSlab(g, W / 2 - 222, 112, 444, 52, titleColor, true);
    const lines = sub.split('\n').length;
    g.fS(0x03070d, 0.88);
    g.fP([{ x: 215, y: 174 }, { x: 585, y: 174 }, { x: 568, y: 186 + lines * 16 }, { x: 232, y: 186 + lines * 16 }], true);
    g.lS(2, titleColor, 0.55);
    g.lB(250, 174, 550, 174);
    ui.sub.setY(180 + (lines * 16) / 2);
  }
  setT(ui.title, title);
  setT(ui.sub, title ? sub : '');
  setT(ui.big, big);
  setT(ui.big2, big2);
  setT(ui.tag, play ? '' : 'M.S.B.S. VER 26  //  MECHA SIMULTACTICS');
  ['P1 MARACAIBO', 'VS', 'CPU CABIMAS'].forEach((t, k) => setT(ui.vs[k], play ? '' : t));
  ne.forEach((t, k) => setT(ui.ne[k], t));
  setT(ui.cardT, card[0]);
  setT(ui.card, card[1]);
  setT(ui.press, !play && blinkOn ? 'PRESS START' : '');
};

// Boot last: every helper above is initialised before Phaser can call create().
new Phaser.Game(config);
})();
