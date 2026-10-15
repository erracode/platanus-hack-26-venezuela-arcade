// Catatumbo Protocol — Platanus Hack 26 Arcade Challenge
// Simultaneous-turn mecha duel vs CPU over Lake Maracaibo. See SPEC.md / ROADMAP.md.

// Everything lives in an IIFE so the minifier can mangle top-level names (~5KB saved).
(() => {
// Math members as locals so the minifier can mangle every call site.
const { max: M_max, min: M_min, abs: M_abs, random: M_random, sin: M_sin, floor: M_floor, cos: M_cos, sign: M_sign, round: M_round, hypot: M_hypot } = Math;
// == CONSTANTS ==

// Hot string literals as consts: the minifier gives each a one-letter name.
const S_MOVE = 'move', S_CLASH = 'clash', S_DIR = 'dir', S_GRAB = 'grab', S_IDLE = 'idle', S_PLAY = 'play', S_STANCE = 'stance', S_KNOCK = 'knock', S_BLOCK = 'block', S_TELE = 'tele', S_WAIT = 'wait', S_AIM = 'aim', S_CHOOSE = 'choose', S_ZONE = 'zone';
const Q_NONE = 'none', Q_FLASH = 'flash', Q_SHARDS = 'shards', Q_TILE = 'tile', Q_VENT = 'vent', Q_RAYO = 'rayo', Q_CAT = 'cat', Q_LOCKED = 'locked', Q_DODGE = 'dodge', Q_THROW = 'throw', Q_RESOLVE = 'resolve', Q_JAB = 'jab', Q_HIT = 'hit', Q_ORBE = 'orbe', Q_SQUARE = 'square', Q_SAWTOOTH = 'sawtooth';
const A_BURST = 'burst', A_VSLASH = 'vslash', A_LUNGE = 'lunge', A_HSLASH = 'hslash', A_PARRY = 'parry', MD_ATTRACT = 'attract';

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
const C_grid = 0x2bff7a; // CRT green
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
const STAGE_HP = 25; // each gauntlet stage gives the CPU more max HP
const TOP_KEY = 'catatumbo/top5';
const SLASH_DMG = 22; // ~7 clean frontal hits to KO
const LUNGE_DMG = 18;
const JAB_DMG = 8; // quick poke: never advances stance
const LUNGE_FLANK = 2; // lunge damage multiplier when hitting a side or the back
const TP_RANGE = 5; // teleport reach (Manhattan tiles)
const BLOCK_MAX = 5; // shield durability; refills with a full GUTS meter
const GRAB_DMG = 10;
const THROW_DMG = 15;
const SLAM_DMG = 10; // extra when the throw hits land / the edge
const THROW_DIST = 6; // flying knockback
const CRASH_DMG = 8; // thrown into a palafito or the bridge: it breaks
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
const CLASH_WINDOW = 30; // strikes this close in speed clash

// Zone events (P8).
const ZONE_CHANCE = { cat: 0.35, verdin: 0.4 }; // probability per turn
const ZONE_VERDIN_DMG = 8; // slip damage
const ZONE_CAT_DMG = 12; // Catatumbo lightning
// Specials spend energy (GUTS): the orb half a bar, the aimed bolt more. Storm: chance per turn
// that the Catatumbo marks a tile near the fight (much higher, and on P1, against the boss).
const SP_COST = 40;
const BOLT_COST = 60;
const SPECIALS = [Q_RAYO, Q_ORBE];
const BOLT_DMG = 25;
const ORB_DMG = 20;
const STORM_CHANCE = 0.06;

// Stance ladder: NORMAL→STAGGERED→KNOCKBACK→DOWN
const ST_NORMAL = 0;
const ST_STAGGERED = 1;
const ST_KNOCKBACK = 2;
const ST_DOWN = 3;
const ST_NAME = ['', 'ATURDIDO', 'RETROCESO', 'DERRIBADO'];

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

// Spawns per stage, 6 chars each: P1 x, y, CPU x, y (base 36), P1 facing, CPU facing.
// Coast to coast, southern lake, bridge ends, gulf vs southern tip, mid-lake oil, boss by the
// Catatumbo. Aggressive rivals (odd stages, boss) start closer.
const SPAWNS = '48k8EW6kijEW84g4EWc1clSN9dfcEWec6dWE';

// 0 water · 1 land · 2 bridge · 3 palafito · 4 Catatumbo · 5 void · 6 verdín · 7 oil
// Deterministic 26×26 Maracaibo silhouette: gulf, northern neck, broad body and southern tip.
const LAKE_HALF = [4, 4, 3, 2, 1, 2, 8, 8, 7, 7, 8, 8, 9, 9, 9, 9, 8, 8, 7, 7, 6, 5, 4, 2, 0, -1];
const LAGO_MAP = Array.from({ length: 26 }, (_, y) => Array.from({ length: 26 }, (_, x) => (M_abs(x - 12) <= LAKE_HALF[y] ? 0 : 1)));
for (const [t, ...p] of [
  [2, 10, 4, 11, 4, 12, 4, 13, 4, 14, 4],
  [3, 5, 6, 19, 16, 20, 17],
  [4, 3, 14, 4, 14, 3, 15, 4, 15, 5, 15, 4, 16, 5, 16, 6, 16, 4, 17, 5, 17],
  [5, 1, 10],
  [6, 4, 6, 9, 8, 16, 11, 8, 18, 11, 7, 17, 9, 7, 10],
  [7, 4, 13, 13, 10, 10, 16, 14, 19, 15, 7, 9, 11, 12, 9],
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
  // n counts every press (used or not) so the idle watchdog sees any activity exactly once.
  const controls = { h: Object.create(null), p: Object.create(null), n: 0 };

  // Single-player: the P2 stick also steers P1. The cabinet key table itself is untouched.
  const codeOf = (event) => {
    const code = KEYBOARD_TO_ARCADE[normalizeIncomingKey(event.key)];
    return code && code[1] === '2' && 'UDLR'.includes(code[3]) ? 'P1_' + code[3] : code;
  };
  const onKeyDown = (event) => {
    const code = codeOf(event);
    if (!code) return;
    if (!controls.h[code]) controls.p[code] = true, controls.n++;
    controls.h[code] = true;
  };
  const onKeyUp = (event) => {
    const code = codeOf(event);
    if (code) controls.h[code] = false;
  };

  // Losing focus while a key is held would leave it stuck down (no keyup ever arrives).
  const onBlur = () => {
    for (const k in controls.h) controls.h[k] = false;
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
  if (!controls.p[code]) return false;
  controls.p[code] = false;
  return true;
};

// == RULES ==
// Pure functions only (no Phaser). Each side picks ONE action per turn. Faster actions land first;
// a unit hit before it acts loses its action. Strikes aimed at each other with close speeds clash.
// A plan is { act, dir } or { act, path }.

const ACTIONS = {
  move: { n: 'MOVER', v: 160, t: Q_TILE, r: 3, i: ['FRENTE 3 // LADO 2 // ATRAS 1', 'MAS LEJOS = MAS LENTO  3 = IMPULSO'] },
  dodge: { n: 'ESQUIVA', v: 215, t: Q_TILE, r: 1, i: ['SALTA 1 CASILLA SIN GIRAR', 'MUY RAPIDO: EVITA UN ATAQUE'] },
  tele: { n: 'TELEPORTE', v: 215, t: Q_TILE, r: 3, i: ['SALTA HASTA 5 CASILLAS', '1 CARGA  SI TE GOLPEAN, VUELAS'] },
  pivot: { n: 'GIRAR', v: 215, t: S_DIR, i: ['GIRA HACIA OTRO LADO', 'GIRAR RESTA 60 VEL AL ATAQUE'] },
  vslash: { n: 'CORTE V', v: 150, t: S_DIR, k: true, i: ['3 CASILLAS AL FRENTE: 22 DMG', 'X2 DE FLANCO'] },
  hslash: { n: 'CORTE H', v: 150, t: S_DIR, k: true, i: ['BARRIDO 3X2: 22 DMG', 'X2 DE FLANCO  ALCANZA DIAGONALES'] },
  jab: { n: 'JAB', v: 176, t: S_DIR, k: true, i: ['GOLPE RAPIDO: 8 DMG', 'SIN COMBO  CORTA LO MAS LENTO'] },
  lunge: { n: 'EMBESTIDA', v: 210, t: S_DIR, k: true, i: ['CRUZA 3 CASILLAS GOLPEANDO: 18', 'X2 DE FLANCO  REQUIERE IMPULSO'] },
  block: { n: 'ESCUDO', v: 215, t: S_DIR, i: ['BLOQUEA TODO LO FRONTAL', 'TE EMPUJA 1 ATRAS  SIN CASTIGO'] },
  vent: { n: 'REPARAR', v: 165, t: Q_NONE, i: ['ENERGIA A VIDA (4:1)', 'EMPUJA AL RIVAL CERCANO'] },
  parry: { n: 'PARRY', v: 215, t: S_DIR, i: ['DESVIA ATAQUES FRONTALES', 'SI FALLA: EXPUESTO 1 TURNO'] },
  grab: { n: 'AGARRE', v: 180, t: S_DIR, i: ['ATRAPA Y LANZA: 25+ DMG', 'IGNORA PARRY  FALLAR = EXPUESTO'] },
  burst: { n: 'BURST', v: 210, t: Q_NONE, i: ['ROMPE EL RETROCESO + OVERDRIVE', '1 CARGA // SE RECARGA CON ENERGIA'] },
  wait: { n: 'PASAR', v: 0, t: Q_NONE, i: ['NO HACER NADA', ''] },
  rayo: { n: 'RAYO OCULTO', v: 140, t: Q_TILE, i: ['60 ENERGIA: ELIGE DONDE CAE', 'EN 2 TURNOS: 25 DMG  NO LO VEN'] },
  orbe: { n: 'ORBE', v: 130, t: Q_NONE, i: ['40 ENERGIA: PERSIGUE AL RIVAL', '3 TURNOS: 20 DMG'] },
};
const MOVE_ACTS = [S_MOVE, Q_DODGE, S_TELE, 'pivot', ...SPECIALS];
const COMBAT_ACTS = [A_VSLASH, A_HSLASH, Q_JAB, A_LUNGE, A_PARRY, S_BLOCK, S_GRAB, Q_VENT];
const STRIKE_ACTS = [A_VSLASH, A_HSLASH, Q_JAB, A_LUNGE];
const WAIT_PLAN = { a: S_WAIT };
// Clash picks: parry > thrust > feint > parry; burst beats thrust and feint, loses to parry.
const CLASH_PICKS = ['thrust', A_PARRY, 'feint', A_BURST];
const CLASH_NAMES = ['ESTOCADA', 'PARRY', 'FINTA', 'BURST'];
const CLASH_WINS = { parry: ['thrust', A_BURST], thrust: ['feint'], feint: [A_PARRY], burst: ['thrust', 'feint'] };

const newUnit = (x, y, fc, hp, mx) => {
  // open: whiffed a parry/grab and must skip the next turn. Energy starts at half: the orb is ready.
  return { x, y, fc, hp, mx, g: SP_COST, b: 1, tp: 1, bk: BLOCK_MAX, od: 0, m: false, st: ST_NORMAL, o: false };
};

const newState = (stage = 1, hp = HP_MAX) => {
  MAP0.forEach((r, y) => (LAGO_MAP[y] = [...r]));
  const mx = HP_MAX + STAGE_HP * (stage - 1);
  const [a, b, c, d, e, f] = SPAWNS.substr((stage - 1) % 6 * 6, 6), n = (k) => parseInt(k, 36);
  const us = [newUnit(n(a), n(b), e, hp, HP_MAX), newUnit(n(c), n(d), f, mx, mx)];
  if (stage > 5) us[1].g = GUTS_MAX - 1; // the boss starts fully charged
  return { us, t: 1, v: null, k: [], j: stage };
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
  if (act === A_LUNGE) return u.m || u.od > 0;
  if (act === S_TELE) return u.tp > 0;
  if (act === S_BLOCK) return u.bk > 0;
  if (act === Q_VENT) return u.g >= 20;
  if (act === Q_RAYO) return u.g >= BOLT_COST;
  if (act === Q_ORBE) return u.g >= SP_COST;
  if (act === A_BURST) return u.st === ST_KNOCKBACK && u.b > 0;
  return true;
};

// NORMAL and STAGGERED units pick actions; KNOCKBACK/DOWN or an open unit cannot.
const canAct = (u) => {
  return !u.o && u.st < ST_KNOCKBACK;
};

// Each 90° pivot before a strike/parry/grab costs speed; stagger slows everything.
const speedOf = (u, plan) => {
  const a = ACTIONS[plan.a];
  const pivots = a.t !== S_DIR || plan.a === 'pivot' || plan.d === u.fc ? 0 : plan.d === OPPOSITE[u.fc] ? 2 : 1;
  const base = plan.a === S_MOVE ? MOVE_SPD[plan.wp ? plan.wp.length : 1] : a.v;
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
const tpReach = (s, i, any) => {
  const me = s.us[i];
  const out = new Map();
  for (let dy = -TP_RANGE; dy <= TP_RANGE; dy++) {
    for (let dx = -TP_RANGE; dx <= TP_RANGE; dx++) {
      const t = { x: me.x + dx, y: me.y + dy };
      const d = dist(t, me);
      if (d && d <= TP_RANGE && isWalkable(t.x, t.y) && (any || !same(t, s.us[1 - i]))) out.set(t.x + ',' + t.y, [t]);
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

// Where a plan would leave a unit if nothing interfered (ghost preview).
const previewPlan = (u, plan, other) => {
  const a = ACTIONS[plan.a];
  if (a.t === Q_TILE && plan.a !== Q_RAYO && plan.wp && plan.wp.length) {
    const last = plan.wp[plan.wp.length - 1];
    const prev = plan.wp.length > 1 ? plan.wp[plan.wp.length - 2] : u;
    return { x: last.x, y: last.y, fc: plan.a === Q_DODGE ? u.fc : plan.a === S_TELE ? faceTo(last, u) : dirBetween(prev, last) };
  }
  if (plan.a === A_LUNGE) {
    const wp = lungePath(u, plan.d, other);
    const end = wp.length ? wp[wp.length - 1] : u;
    return { x: end.x, y: end.y, fc: plan.d };
  }
  return { x: u.x, y: u.y, fc: a.t === S_DIR ? plan.d : u.fc };
};

// A full meter resets and refreshes every charge (BURST, TELEPORT, shield durability).
const gainGuts = (u, n, events, who) => {
  u.g = M_min(GUTS_MAX, u.g + n);
  if (u.g < GUTS_MAX) return;
  u.g = 0;
  u.b = u.tp = 1;
  u.bk = BLOCK_MAX;
  events.push({ t: 'refresh', w:who });
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
const ZONE_TILES = { '4': Q_CAT, '6': 'verdin', '7': 'oil' };
const ZONE_COLOR = { cat: 0xffff00, verdin: 0x00ff88, oil: 0xff8800 };

// Check a unit's tile, trigger the zone effect. Mutates the unit.
const resolveZone = (s, i, events, rnd = M_random) => {
  const u = s.us[i];
  const t = tileAt(u.x, u.y);
  const zone = ZONE_TILES[t];
  if (!zone) return;
  const tag = zone === Q_CAT ? 'RAYO' : zone === 'oil' ? 'CRUDO' : 'VERDIN';
  const color = ZONE_COLOR[zone];
  if (zone === Q_CAT && rnd() < ZONE_CHANCE.cat) {
    u.hp = M_max(0, u.hp - ZONE_CAT_DMG);
    advanceStance(u);
    events.push({ t: S_ZONE, w: i, z: tag, dm: ZONE_CAT_DMG, st: u.st, color });
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
    events.push({ t: S_ZONE, w: i, z: tag, dm: ZONE_VERDIN_DMG, push: wp.length > 0, wp, color });
    return;
  }
  if (zone === 'oil') {
    // Collected: the slick is gone for the rest of the match.
    gainGuts(u, GUTS_BONUS, events, i);
    LAGO_MAP[u.y][u.x] = 0;
    events.push({ t: S_ZONE, w: i, z: tag, dm: 0, g: true, color }, { t: 'break', x: u.x, y: u.y });
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

// LUNGE charges the 3-tile lane straight through the foe; it can't end on the foe's tile.
const lungePath = (u, dir, other) => {
  const wp = vslashTiles({ x: u.x, y: u.y, fc: dir });
  if (same(wp[wp.length - 1], other)) wp.pop();
  return wp;
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
      events.push({ t: S_STANCE, w: i, st: u.st });
    }
  });
  const turnSt = U.map((u) => u.st);
  const recovering = enteredSt.map((st) => st !== ST_NORMAL && st !== ST_DOWN);
  const p = plans.map((plan, i) => {
    plan = plan || WAIT_PLAN;
    const burstEscape = plan.a === A_BURST && canUse(U[i], A_BURST);
    const ok = (canAct(U[i]) || burstEscape) && canUse(U[i], plan.a);
    U[i].o = false; // an open unit spends exactly this turn recovering
    return ok ? plan : WAIT_PLAN;
  });
  const spd = p.map((plan, i) => (plan.a === S_WAIT ? 0 : speedOf(U[i], plan)));
  const momentum = [false, false];
  U.forEach((u, i) => p[i].a === A_LUNGE && !u.od && (u.m = false));
  events.push({ t: 'order', a: p.map((x) => x.a), v:spd });

  // Clash: equal-speed strikes that reach each other, decided before anyone moves.
  if (STRIKE_ACTS.includes(p[0].a) && STRIKE_ACTS.includes(p[1].a) && M_abs(spd[0] - spd[1]) <= CLASH_WINDOW) {
    const hitTiles = (i) => {
      const src = { x: U[i].x, y: U[i].y, fc: p[i].d };
      if (p[i].a === A_VSLASH || p[i].a === A_LUNGE) return vslashTiles(src);
      if (p[i].a === A_HSLASH) return hslashTiles(src);
      return [step(src, src.fc)];
    };
    if (inTiles(U[1], hitTiles(0)) && inTiles(U[0], hitTiles(1))) {
      U.forEach((u, i) => {
        u.fc = p[i].d;
        events.push({ t: 'face', w: i, fc: u.fc });
      });
      events.push({ t: S_CLASH });
      U.forEach((u, i) => (u.m = momentum[i]));
      s.rec = U.map((u, i) => (recovering[i] ? u.st : -1));
      return { q: s, events, clash: true };
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
  const inv = [false, false]; // bursting units cannot be hit for the whole turn (reference rule)
  const hurt = [false, false];
  const cast = [];
  const strike = (i, dmg, flankMult, combo = true, from = U[i]) => {
    const foe = U[1 - i];
    hurt[1 - i] = true;
    const relation = relativeSide(foe, from);
    const flank = relation !== 'front';
    const total = M_round(dmg * (flank ? flankMult : 1));
    foe.hp = M_max(0, foe.hp - total);
    const prevSt = foe.st;
    if (combo) advanceStance(foe);
    if (prevSt !== foe.st) events.push({ t: S_STANCE, w: 1 - i, st: foe.st });
    events.push({ t: Q_HIT, w: 1 - i, dm: total, f: flank && flankMult > 1, r:relation, p:prevSt, c:combo });
    gainGuts(U[i], total, events, i);
    if (blinked[1 - i] && p[i].a !== S_GRAB) {
      // Teleported into an attack: launched along the attacker's facing like a throw (a grab just catches).
      blinked[1 - i] = false;
      launched = 1 - i;
      const f = flightOf(foe, faceTo(U[i], foe), U[i], 1 - i);
      f.b.forEach((b) => (LAGO_MAP[b.y][b.x] = 0));
      const last = f.wp[f.wp.length - 1] || foe;
      foe.x = last.x;
      foe.y = last.y;
      foe.hp = M_max(0, foe.hp - (f.dm - THROW_DMG));
      foe.st = ST_DOWN;
      events.push({ t: 'launch', w: 1 - i }, ...f.events);
      events.push({ t: S_STANCE, w: 1 - i, st: ST_DOWN });
      if (f.s) events.push({ t: Q_HIT, w: 1 - i, dm: SLAM_DMG, s: true, c: false });
    }
    if (!done[1 - i] && !groups.find((g) => g.includes(i)).includes(1 - i) && p[1 - i].a !== S_WAIT && !cancelled[1 - i]) {
      cancelled[1 - i] = true;
      events.push({ t: 'interrupt', w: 1 - i, a: p[1 - i].a });
    }
  };

  for (const g of groups) {
    const acting = g.filter((i) => !cancelled[i] && p[i].a !== S_WAIT);
    if (acting.length) events.push({ t: 'beat', w: acting });

    for (const i of acting) {
      if (ACTIONS[p[i].a].t === S_DIR && U[i].fc !== p[i].d) {
        U[i].fc = p[i].d;
        events.push({ t: 'face', w: i, fc: U[i].fc });
      }
    }

    // Movement (walks, hops and lunge dashes). Paths stop before the other unit;
    // equal final tiles or a swap → nobody moves.
    const walk = {};
    for (const i of acting) {
      const a = p[i].a;
      if (a === A_LUNGE) walk[i] = lungePath(U[i], p[i].d, U[1 - i]);
      if (a === S_TELE) {
        const t = (p[i].wp || [])[0];
        U[i].tp = 0;
        walk[i] = t && dist(t, U[i]) <= TP_RANGE && isWalkable(t.x, t.y) && !same(t, U[1 - i]) ? [t] : [];
        continue;
      }
      if (ACTIONS[a].t !== Q_TILE || a === Q_RAYO) continue;
      const wp = [], cells = p[i].wp || [], dir = dirBetween(U[i], cells[0]);
      const max = a === S_MOVE ? (dir === start[i].fc ? 3 : dir === OPPOSITE[start[i].fc] ? 1 : 2) : 1;
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
        if (p[i].a !== A_LUNGE) events.push({ t: 'bump', w: i });
        continue;
      }
      const last = wp[wp.length - 1];
      if (p[i].a === S_TELE) {
        U[i].fc = faceTo(last, U[i]);
        blinked[i] = true;
      } else if (p[i].a !== Q_DODGE) U[i].fc = dirBetween(U[i], wp[0]);
      U[i].x = last.x;
      U[i].y = last.y;
      if (p[i].a === S_MOVE && wp.length === 3) {
        let c = start[i];
        momentum[i] = wp.every((t) => same(t, (c = step(c, start[i].fc))));
      }
      events.push({ t: S_MOVE, w: i, wp, fc: U[i].fc, a: p[i].a });
    }

    acting.forEach((i) => p[i].a === A_BURST && (inv[i] = true));
    for (const i of acting) {
      if (p[i].a === A_PARRY || p[i].a === S_BLOCK) {
        guard[i] = p[i].a === A_PARRY ? 1 : 2;
        events.push({ t: 'guard', w: i });
      }
      const me = U[i];
      const foe = U[1 - i];
      if (p[i].a === A_BURST) {
        me.b = 0;
        me.st = ST_NORMAL;
        me.od = OD_TURNS;
        inv[i] = true;
        events.push({ t: A_BURST, w: i });
      }
      if (SPECIALS.includes(p[i].a)) {
        me.g -= p[i].a === Q_RAYO ? BOLT_COST : SP_COST;
        cast.push(i);
      }
      if (p[i].a === Q_VENT) {
        const heal = M_min(me.mx - me.hp, M_floor(me.g / 4));
        me.hp += heal;
        me.g = 0;
        events.push({ t: Q_VENT, w: i, h:heal });
      }
      // Shockwave (BURST hurts, VENT only shoves): an adjacent foe is pushed away and loses its action.
      const reachS = p[i].a === Q_VENT ? 2 : p[i].a === A_BURST ? 1 : 0;
      if (!inv[1 - i] && M_abs(foe.x - me.x) <= reachS && M_abs(foe.y - me.y) <= reachS) {
        if (p[i].a === A_BURST) {
          foe.hp = M_max(0, foe.hp - BURST_DMG);
          hurt[1 - i] = true;
          events.push({ t: Q_HIT, w: 1 - i, dm: BURST_DMG, c: false });
          gainGuts(me, BURST_DMG, events, i);
        }
        const to = { x: foe.x + M_sign(foe.x - me.x), y: foe.y + M_sign(foe.y - me.y) };
        if (isWalkable(to.x, to.y)) {
          foe.x = to.x;
          foe.y = to.y;
          events.push({ t: S_KNOCK, w: 1 - i, wp: [to] });
        }
        if (!g.includes(1 - i) && !done[1 - i] && p[1 - i].a !== S_WAIT && !cancelled[1 - i]) {
          cancelled[1 - i] = true;
          events.push({ t: 'interrupt', w: 1 - i, a: p[1 - i].a });
        }
      }
    }

    // Strikes: hitbox depends on the attack type. V-SLASH = 3 forward, H-SLASH = 3×2 block.
    for (const i of acting) {
      if (!ACTIONS[p[i].a].k) continue;
      const u = U[i];
      const foe = U[1 - i];
      const tiles = p[i].a === A_VSLASH ? vslashTiles(u) : p[i].a === A_HSLASH ? hslashTiles(u) : p[i].a === A_LUNGE ? vslashTiles({ ...start[i], fc: p[i].d }) : [frontOf(u)];
      const f = tiles[0] || frontOf(u);
      const at = p[i].a === A_LUNGE ? start[i] : u;
      events.push({ t: p[i].a, w: i, x: f.x, y: f.y, l:tiles });
      if (!inTiles(foe, tiles) || inv[1 - i]) {
        events.push({ t: 'miss', w: i });
        continue;
      }
      if (guard[1 - i] === 2 && relativeSide(foe, at) === 'front') {
        foe.bk--;
        events.push({ t: S_BLOCK, w: 1 - i });
        const to = step(foe, OPPOSITE[foe.fc]);
        if (isWalkable(to.x, to.y) && !same(to, u)) {
          foe.x = to.x;
          foe.y = to.y;
          events.push({ t: S_KNOCK, w: 1 - i, wp: [to] });
        }
        continue;
      }
      if (guard[1 - i] && relativeSide(foe, at) === 'front') {
        gainGuts(foe, GUTS_BONUS, events, 1 - i);
        parried[1 - i] = true;
        advanceStance(u); // parried → staggered
        events.push({ t: S_STANCE, w: i, st: u.st });
        events.push({ t: A_PARRY, w: 1 - i });
        continue;
      }
      if (p[i].a === A_VSLASH || p[i].a === A_HSLASH) strike(i, SLASH_DMG, 2);
      else if (p[i].a === Q_JAB) strike(i, JAB_DMG, 1, false);
      else {
        strike(i, LUNGE_DMG, LUNGE_FLANK, true, at);
        const to = step(foe, u.fc);
        // Only a charge that stopped in front of the foe shoves it onward.
        if (launched !== 1 - i && same(frontOf(u), foe) && isWalkable(to.x, to.y)) {
          foe.x = to.x;
          foe.y = to.y;
          events.push({ t: S_KNOCK, w: 1 - i, wp: [to] });
        }
      }
    }

    // Equal-speed mutual GRAB has no player-order bias: both collide and fail.
    const mutualGrab = acting.length === 2 && acting.every((i) => p[i].a === S_GRAB) && same(frontOf(U[0]), U[1]) && same(frontOf(U[1]), U[0]);
    if (mutualGrab) {
      acting.forEach((i) => {
        const f = frontOf(U[i]);
        events.push({ t: S_GRAB, w: i, x: f.x, y: f.y });
        events.push({ t: 'bump', w: i });
      });
    } else {
      // Grab ignores parry; the throw direction is chosen next (resolveThrow).
      for (const i of acting) {
        if (p[i].a !== S_GRAB || cancelled[i]) continue;
        const f = frontOf(U[i]);
        events.push({ t: S_GRAB, w: i, x: f.x, y: f.y });
        if (!same(f, U[1 - i]) || inv[1 - i]) {
          events.push({ t: 'miss', w: i });
          U[i].o = true;
          events.push({ t: 'open', w: i });
          continue;
        }
        strike(i, GRAB_DMG, 1);
        grab = i;
        events.push({ t: 'caught', w: 1 - i });
        break;
      }
    }

    g.forEach((i) => (done[i] = true));
    if (grab !== null || U.some((u) => u.hp <= 0)) break;
  }

  U.forEach((u, i) => {
    // A parry that blocked nothing leaves the unit open, unless it was already punished this turn.
    if (guard[i] === 1 && !parried[i] && !hurt[i]) {
      u.o = true;
      events.push({ t: 'open', w: i });
    }
    // Only a stance carried into this turn may recover, and only if no new hit
    // advanced it. Newly applied stance always survives this resolve.
    if (recovering[i] && u.st === turnSt[i] && p[i].a !== A_BURST) {
      u.st = ST_NORMAL;
      events.push({ t: S_STANCE, w: i, st: ST_NORMAL });
    }
    if (p[i].a !== A_LUNGE) u.m = momentum[i];
    if (momentum[i]) events.push({ t: 'momentum', w: i });
  });
  // Hazards: hidden bolts (shown only to their owner), the chasing orb and the
  // storm's announced bolts (owner 2, they hit anyone).
  const zap = (j, dm, z) => {
    const u = U[j];
    u.hp = M_max(0, u.hp - dm);
    advanceStance(u);
    events.push({ t: S_ZONE, w: j, z, dm, st: u.st, color: ZONE_COLOR.cat });
  };
  const hz = [];
  for (const h of s.k) {
    const f = U[1 - h.w];
    if (h.k === Q_RAYO) {
      if (h.n--) { hz.push(h); continue; }
      events.push({ t: 'bolt', x: h.x, y: h.y });
      U.forEach((u, j) => same(u, h) && zap(j, BOLT_DMG, 'CATATUMBO!'));
    } else {
      let hit = 0;
      for (let k = 0; k < 2 && !hit; k++) {
        if (M_abs(f.x - h.x) >= M_abs(f.y - h.y)) h.x += M_sign(f.x - h.x);
        else h.y += M_sign(f.y - h.y);
        const t = tileAt(h.x, h.y);
        hit = same(h, f) ? 1 : t === 2 || t === 3 ? 2 : 0;
      }
      if (hit === 1) zap(1 - h.w, ORB_DMG, 'ORBE!');
      else if (!hit && --h.n) hz.push(h);
    }
  }
  cast.forEach((i) => {
    const a = p[i].a, o = a === Q_RAYO ? (p[i].wp || [U[1 - i]])[0] : U[i];
    hz.push({ k: a, x: o.x, y: o.y, w: i, n: a === Q_ORBE ? 3 : 0 });
  });
  const boss = s.j > 5, near = (v, r) => v + M_round((M_random() * 2 - 1) * r);
  if (M_random() < (boss ? 0.12 : STORM_CHANCE)) {
    const o = U[boss || M_random() < 0.5 ? 0 : 1], r = boss ? 2 : 4;
    hz.push({ k: Q_RAYO, x: near(o.x, r), y: near(o.y, r), w: 2, n: 0 });
  }
  if (boss && M_random() < 0.08) hz.push({ k: Q_ORBE, x: U[1].x, y: U[1].y, w: 1, n: 3 });
  s.k = hz;
  if (grab === null) finishTurn(s);
  return { q: s, events, clash: false, grab, j:launched };
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
    events.push({ t: S_KNOCK, w: fw, wp: [t], y: true });
    c = t;
    if (k === 2 || k === 3) {
      dmg += CRASH_DMG;
      breaks.push(t);
      events.push({ t: 'break', w: fw, x: t.x, y: t.y, k, dm: CRASH_DMG });
      break;
    }
    if (k === 4) {
      dmg += ZONE_CAT_DMG;
      events.push({ t: S_ZONE, w: fw, z: 'RAYO', dm: ZONE_CAT_DMG, color: ZONE_COLOR.cat });
    } else if (k === 7) {
      dmg += OIL_DMG;
      breaks.push(t);
      events.push({ t: S_ZONE, w: fw, z: 'CRUDO!', dm: OIL_DMG, color: ZONE_COLOR.oil }, { t: 'break', w: fw, x: t.x, y: t.y, k });
    } else if (k === 6) {
      left++;
      events.push({ t: S_ZONE, w: fw, z: 'VERDIN', push: true, color: ZONE_COLOR.verdin });
    }
  }
  if (slam) dmg += SLAM_DMG;
  return { wp, events, b:breaks, dm:dmg, s:slam };
};

// Grabber `who` throws the foe in `dir`. Broken tiles turn into open water for the rest of the match.
const resolveThrow = (state, who, dir) => {
  const s = cloneState(state);
  const me = s.us[who];
  const foe = s.us[1 - who];
  const f = flightOf(me, dir, {}, 1 - who);
  f.b.forEach((b) => (LAGO_MAP[b.y][b.x] = 0));
  const last = f.wp[f.wp.length - 1] || foe;
  foe.x = last.x;
  foe.y = last.y;
  foe.hp = M_max(0, foe.hp - f.dm);
  const prevSt = foe.st;
  foe.st = ST_DOWN;
  // Zone and break events carry their own damage; the final hit carries the rest.
  const extra = f.events.reduce((n, e) => n + (e.dm || 0), 0);
  const events = [
    { t: Q_THROW, w:who, d:dir },
    // The foe is swung through the thrower's tile, then flies from there.
    { t: S_KNOCK, w: 1 - who, wp: [{ x: me.x, y: me.y }], y: true },
    ...f.events,
    { t: S_STANCE, w: 1 - who, st: ST_DOWN },
    { t: Q_HIT, w: 1 - who, dm: f.dm - extra, s: f.s, p:prevSt },
  ];
  gainGuts(me, GUTS_BONUS, events, who);
  finishTurn(s);
  return { q: s, events };
};

const resolveClash = (state, picks) => {
  const s = cloneState(state);
  const events = [];
  picks.forEach((pk, i) => pk === A_BURST && (s.us[i].b = 0));
  const [pa, pb] = picks;
  if (pa === pb) {
    events.push({ t: 'mirror', k:picks });
    s.us.forEach((u, i) => {
      const to = step(u, OPPOSITE[u.fc]);
      if (isWalkable(to.x, to.y) && !same(to, s.us[1 - i])) {
        u.x = to.x;
        u.y = to.y;
        events.push({ t: S_KNOCK, w: i, wp: [to] });
      }
    });
  } else {
    const winner = CLASH_WINS[pa].includes(pb) ? 0 : 1;
    const w = s.us[winner];
    const loser = s.us[1 - winner];
    loser.hp = M_max(0, loser.hp - SLASH_DMG);
    const prevSt = loser.st;
    advanceStance(loser);
    if (prevSt !== loser.st) events.push({ t: S_STANCE, w: 1 - winner, st: loser.st });
    events.push({ t: 'clashWin', w: winner, k:picks });
    events.push({ t: Q_HIT, w: 1 - winner, dm: SLASH_DMG });
    gainGuts(w, SLASH_DMG, events, winner);
    if (picks[winner] === A_BURST) {
      const to = step(loser, w.fc);
      if (isWalkable(to.x, to.y)) {
        loser.x = to.x;
        loser.y = to.y;
        events.push({ t: S_KNOCK, w: 1 - winner, wp: [to] });
      }
    }
  }
  // Stances carried into the clash recover unless the clash itself advanced them.
  s.us.forEach((u, i) => {
    if (u.st === (s.rec || [])[i]) {
      u.st = ST_NORMAL;
      events.push({ t: S_STANCE, w: i, st: ST_NORMAL });
    }
  });
  delete s.rec;
  finishTurn(s);
  return { q: s, events };
};

const checkOutcome = (s) => {
  const [a, b] = s.us;
  if (a.hp <= 0 && b.hp <= 0) s.v = 'draw';
  else if (a.hp <= 0) s.v = 'cpu';
  else if (b.hp <= 0) s.v = 'p1';
};

const finishTurn = (s) => {
  checkOutcome(s);
  s.us.forEach((u) => u.od && u.od--);
  s.t++;
};

// == CONTROLLERS ==
// The CPU only sees the state, never the opponent's plan.

const aggro = (j) => j & 1 || j > 5;
const cpuPlan = (s, i, rnd = M_random) => {
  const me = s.us[i];
  const foe = s.us[1 - i];
  // BURST escape when knocked back with a full bar.
  if (canUse(me, A_BURST) && rnd() < 0.8) return { a: A_BURST };
  if (!canAct(me)) return WAIT_PLAN;
  // Aggressive rivals roll low (strike branches), defensive ones high (guard branches).
  const r = (aggro(s.j) ? 0 : 0.2) + rnd() * 0.8;
  const pick = (arr) => arr[M_floor(rnd() * arr.length)];
  const toFoe = dirBetween(me, foe);
  const outs = () => [...reach(s, i, 1).values()].filter((wp) => !same(wp[0], frontOf(foe)));

  // Staggered: too slow to trade, so step out or guard.
  if (me.st === ST_STAGGERED && dist(me, foe) <= 3 && rnd() < 0.7) {
    const o = outs();
    if (o.length && r < 0.55) return { a: Q_DODGE, wp: pick(o) };
    if (toFoe) return { a: r < 0.8 ? A_PARRY : Q_JAB, d: toFoe };
  }

  // Step off an announced storm mark (hidden bolts stay unseen).
  if (s.k.some((h) => h.w > 1 && same(h, me)) && rnd() < 0.8) {
    const o = outs();
    if (o.length) return { a: Q_DODGE, wp: pick(o) };
  }

  // Blink behind a foe that is squaring up, to flank it next turn.
  if (canUse(me, S_TELE) && same(frontOf(foe), me) && rnd() < 0.2) {
    const back = step(foe, OPPOSITE[foe.fc]);
    if (tpReach(s, i).has(back.x + ',' + back.y)) return { a: S_TELE, wp: [back] };
  }

  if (canUse(me, Q_VENT) && me.g >= 40 && me.hp < me.mx * 0.6 && rnd() < 0.5) return { a: Q_VENT };
  // Specials, more often deeper in the gauntlet: an aimed bolt on or next to the foe, or an orb.
  const fd = dist(me, foe);
  if (me.g >= SP_COST && rnd() < (s.j > 5 ? 0.3 : 0.1 + s.j * 0.04)) {
    if (me.g >= BOLT_COST && fd < 6) return { a: Q_RAYO, wp: [rnd() < 0.5 ? foe : step(foe, pick(DIR_KEYS))] };
    if (fd > 2) return { a: Q_ORBE };
  }

  // Chain the combo: if the foe is staggered/knocked/down/open and in vslash range, press it.
  if (foe.st !== ST_NORMAL || foe.o) {
    const lane = DIR_KEYS.find((k) => {
      const hit = step(me, k);
      return inTiles(foe, [hit, step(hit, k), step(step(hit, k), k)]);
    });
    if (lane && rnd() < 0.85) return { a: A_VSLASH, d: lane };
    if (toFoe && rnd() < 0.7) return { a: A_HSLASH, d: toFoe };
  }

  if (toFoe) {
    const threatened = same(frontOf(foe), me);
    if (!threatened) return { a: r < 0.45 ? A_VSLASH : r < 0.65 ? Q_JAB : r < 0.85 ? S_GRAB : A_PARRY, d: toFoe };
    if (r < 0.2) return { a: A_VSLASH, d: toFoe };
    if (r < 0.4) return { a: Q_JAB, d: toFoe };
    if (r < 0.6) return { a: r < 0.5 || !canUse(me, S_BLOCK) ? A_PARRY : S_BLOCK, d: toFoe };
    if (r < 0.75) return { a: S_GRAB, d: toFoe };
    const o = outs();
    if (o.length) return { a: Q_DODGE, wp: pick(o) };
    return { a: A_PARRY, d: toFoe };
  }

  // Momentum: lunge whenever the foe sits in a 3-tile lane.
  const line = DIR_KEYS.find((k) => same(step(step(me, k), k), foe));
  if (canUse(me, A_LUNGE)) {
    const lane = DIR_KEYS.find((k) => inTiles(foe, vslashTiles({ x: me.x, y: me.y, fc: k })));
    if (lane && r < 0.75) return { a: A_LUNGE, d: lane };
  }

  // Two apart in a line: zone the middle tile or guard it.
  if (line && r < 0.4) return { a: A_VSLASH, d: line };
  if (line && r < 0.55) return { a: A_PARRY, d: line };

  // Diagonal neighbours: wait on one of the two tiles the foe can step into.
  if (M_abs(me.x - foe.x) === 1 && M_abs(me.y - foe.y) === 1 && r < 0.6) {
    const k = pick(DIR_KEYS.filter((d) => dist(step(me, d), foe) === 1));
    return { a: r < 0.4 ? A_VSLASH : A_PARRY, d: k };
  }

  // Approach: closest reachable tile, avoiding the foe's front tile and tiles the foe can also
  // reach this turn (both walking into the same tile bumps forever). Vary among the best few.
  const paths = [...reach(s, i, 3).values()];
  if (!paths.length) return { a: 'pivot', d: me.fc };
  const foeReach = reach(s, 1 - i, 3);
  const scored = paths.map((wp) => {
    const t = wp[wp.length - 1];
    const contested = foeReach.has(t.x + ',' + t.y) ? 8 : 0;
    const zoneBonus = tileAt(t.x, t.y) === 7 ? -10 : tileAt(t.x, t.y) === 4 ? 8 : tileAt(t.x, t.y) === 6 ? 6 : 0;
    return { wp, z: dist(t, foe) * 10 + (same(t, frontOf(foe)) ? 15 : 0) + contested + zoneBonus + rnd() * 10 };
  });
  scored.sort((a, b) => a.z - b.z);
  const pickIndex = rnd() < 0.7 ? 0 : M_min(scored.length - 1, 1 + M_floor(rnd() * 2));
  return { a: S_MOVE, wp: scored[pickIndex].wp };
};

// Throw where the flight hurts most (crashes, lightning, oil), random among ties.
const cpuThrowDir = (s, i, rnd = M_random) => {
  const me = s.us[i];
  const dmg = (k) => flightOf(me, k, {}, 1 - i).dm;
  const best = M_max(...DIR_KEYS.map(dmg));
  const pool = DIR_KEYS.filter((k) => dmg(k) === best);
  return pool[M_floor(rnd() * pool.length)];
};

// Light weighting: often counter the opponent's last clash pick; burst when a charge is left.
const cpuClashPick = (lastFoePick, canBurst, rnd = M_random) => {
  if (canBurst && rnd() < 0.4) return A_BURST;
  if (lastFoePick && rnd() < 0.5) return CLASH_PICKS.find((k) => k !== A_BURST && CLASH_WINS[k].includes(lastFoePick));
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
  for (let pass = 0; pass < 2; pass++) {
    g.lS(pass ? 2.5 : 5, pass ? C_coast : C_ink, 1);
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (!isLake(x, y)) continue;
        const pts = cellPts(x, y);
        for (const [key, d] of Object.entries(DIRS)) {
          const nx = x + d.dx;
          const ny = y + d.dy;
          if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS || isLake(nx, ny)) continue;
          const [i, j] = EDGE[key];
          g.lB(pts[i].x, pts[i].y, pts[j].x, pts[j].y);
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
  };
  hut(cx - 6, cy, 1);
  hut(cx + 13, cy + 2, 0.72);
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
    g.fS(0x46545b, 1);
    g.fP([deck[1], deck[2], { x: deck[2].x, y: deck[2].y + 7 }, { x: deck[1].x, y: deck[1].y + 7 }], true);
    g.fS(C_concrete, 1);
    g.fP(deck, true);
    g.lS(2, C_ink, 1);
    g.sP(deck, true);
  }

  for (const x of xs) {
    if (tileAt(x, row) !== 2) continue;
    const t = toIso(x, row);
    g.lS(6, 0x26363d, 1);
    g.lB(t.x - 1, t.y + 1, t.x, t.y + 22);
  }
  for (const x of [xs[0], xs[xs.length - 1]]) {
    if (tileAt(x, row) !== 2) continue;
    const t = toIso(x, row);
    const deckY = t.y - DECK_H;
    const topY = deckY - TOWER_H;
    // A-frame pylon and bright stay cables.
    g.lS(4, C_concrete, 1);
    g.lB(t.x - 8, deckY, t.x, topY);
    g.lB(t.x + 8, deckY, t.x, topY);
    g.lS(1.4, 0xf7f2db, 0.92);
    for (let k = 1; k <= 2; k++) {
      const off = (k * TW) / 3;
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
  [-8, 4, 3, 12, 8, 20, 0.7, 0.6, 1], [8, 4, 3, 12, 8, 20, 0.7, 0.6, 1],
  [-8, 19, 0, 11, 22, 12, 0.72, 0.75, 2], [8, 19, 0, 11, 22, 12, 0.72, 0.75, 2],
  [-7, 39, 0, 10, 18, 11, 1.1, 1, 2], [7, 39, 0, 10, 18, 11, 1.1, 1, 2],
  [0, 51, 0, 13, 7, 9, 0.85, 0.8, 0],
  [0, 63, 1, 22, 16, 13, 1.15, 0.8, 1], [0, 49, 5.5, 5, 5, 2, 1, 1, 4],
  [0, 63, -8, 16, 16, 6, 0.8, 0.8, 0],
  [-21, 66, 0, 14, 11, 15, 0.85, 0.8, 1], [21, 66, 0, 14, 11, 15, 0.85, 0.8, 1],
  [-23, 58, 0, 6, 10, 6, 0.8, 0.8, 0], [23, 58, 0, 6, 10, 6, 0.8, 0.8, 0],
  [-23, 47, 1, 9, 13, 9, 0.8, 0.85, 2], [23, 47, 1, 9, 13, 9, 0.8, 0.85, 2],
  [0, 80, 1.5, 11, 10, 11, 0.75, 0.75, 2],
  [23, 38, 22, 2, 3, 40, 0.5, 0.9, 2],
  [-29.5, 66, 0, 4, 10, 13, 0.6, 0.8, 4], [29.5, 66, 0, 4, 10, 13, 0.6, 0.8, 4],
  [-3, 89, 0, 1.5, 9, 1.5, 0.2, 0.3, 2], [3, 89, 0, 1.5, 9, 1.5, 0.2, 0.3, 2],
  [-7, 40, 5.6, 3, 4, 1, 1, 1, 3], [7, 40, 5.6, 3, 4, 1, 1, 1, 3],
  [-23, 38, 2, 6, 6, 6, 0.9, 0.9, 0], [23, 38, 2, 6, 6, 6, 0.9, 0.9, 0],
  [-8, 2.5, 16, 11, 5, 7, 0.5, 0.2, 1], [8, 2.5, 16, 11, 5, 7, 0.5, 0.2, 1],
  [-8, 30, 6, 10, 7, 4, 0.8, 0.6, 1], [8, 30, 6, 10, 7, 4, 0.8, 0.6, 1],
];
const MECH_FACES = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]];
// Gauntlet rivals: one lakeside municipality per stage, each with its own armour colour; the
// sixth is the Catatumbo boss and beating it ends the run.
const RIVALS = 'CABIMAS,SAN FRANCISCO,CIUDAD OJEDA,SANTA RITA,MENE GRANDE,CATATUMBO'.split(',');
const RIVAL_COLS = [0xd8232f, 0x7a2fd0, 0x23a04a, 0xd02f9a, 0x5a6270, 0xd4a020];
const rival = (s) => RIVALS[(s.j - 1) % 6];
const MECH_PALS = [[0x1d3a42, 0x3046d0, 0xe6dcc0, 0x4ff3ff, 0xff8a1e], [0x1d3a3a, 0xd8232f, 0xe6dcc0, 0x4ff3ff, 0xff8a1e]];

const mechTone = (c, k, flash) => {
  let r = M_min(255, (c >> 16) * k), q = M_min(255, ((c >> 8) & 255) * k), b = M_min(255, (c & 255) * k);
  flash = M_min(1, flash * 1.5);
  r = (r + (255 - r) * flash) & 248;
  q = (q + (255 - q) * flash) & 248;
  b = (b + (255 - b) * flash) & 248;
  return (r << 16) | (q << 8) | b;
};

// Tiny orthographic software renderer: transform, pose, back-face cull, light and painter-sort.
const drawMecha = (g, gx, gy, fc, color, alpha, flash, stance, pose = S_IDLE, frame = 0, wire = 0) => {
  const c = toIso(gx, gy), d = DIRS[fc], pal = MECH_PALS[color === C_cpu ? 1 : 0];
  const st = stance || 0, tilt = st === ST_STAGGERED ? -0.15 : st === ST_KNOCKBACK ? 0.17 : st === ST_DOWN ? -1.5 : 0;
  const sn = M_sin(tilt), co = M_cos(tilt), down = st === ST_DOWN;
  if (down) pose = S_IDLE;
  const lift = pose === S_MOVE ? [4, 12, 3][frame] : 0;
  // Attack poses swing the whole right arm (upper arm, forearm, fist, blade) about the shoulder,
  // per frame: [raise forward, raise sideways, yaw, blade pitch in the fist].
  const swing = pose === A_VSLASH ? [[2.7, 0, 0, -0.9], [1.5, 0, 0, -0.9], [0.5, 0, 0, -0.9]][frame]
    : pose === A_HSLASH ? [[0, 1.5, 0.3, 0], [0, 1.5, -0.5, 0], [0, 1.5, -2.1, 0]][frame]
    : null;
  const rot = (u, v, a) => [u * M_cos(a) + v * M_sin(a), v * M_cos(a) - u * M_sin(a)];
  const part = (i, x, y, z) => {
    if (pose === S_MOVE) {
      const leg = i < 6 || i === 22 || i === 23 || i > 25, arm = (i > 11 && i < 16) || i === 17 || i === 24 || i === 25;
      const pivot = leg ? 50 : arm ? 67 : 50;
      const a = leg ? [0.16, 0.42, 0.2][frame] + (i & 1) * 0.04 : arm ? 0.52 : [0.12, 0.3, 0.16][frame];
      const yy = y - pivot, si = M_sin(a), cs = M_cos(a);
      y = pivot + yy * cs - z * si + lift;
      z = yy * si + z * cs;
    } else if (swing && (i === 13 || i === 15 || i === 17 || i === 25)) {
      if (i === 17) [y, z] = rot(y - 38, z - 2, swing[3]), y += 38, z += 2;
      let u = x - 23, v = y - 63;
      [v, z] = rot(v, z, swing[0]);
      [u, v] = rot(u, v, -swing[1]);
      [u, z] = rot(u, z, swing[2]);
      x = 23 + u;
      y = 63 + v;
    }
    return [x, y, z];
  };
  const snap = pose === S_IDLE ? 2 : 3;
  const project = (x, y, z) => {
    // DOWN lies on its back: lifted off the floor and slid forward so it stays on its tile.
    [y, z] = [y * co - z * sn + (down ? 9 : 0), y * sn + z * co + (down ? 42 : 0)];
    const wx = z * d.dx - x * d.dy, wz = z * d.dy + x * d.dx;
    const sx = c.x + (wx + wz) * 0.82, sy = c.y + (wz - wx) * 0.42 - y * 1.06;
    return [wx, y, wz, M_round(sx / snap) * snap, M_round(sy / snap) * snap];
  };
  const P = (i, x, y, z) => project(...part(i, x, y, z));
  g.fS(0x010509, 0.7 * alpha);
  g.fillEllipse(c.x + 4, c.y + 5, pose === S_MOVE ? 34 : 48, pose === S_MOVE ? 8 : 14);
  const faces = [];
  for (let pi = 0; pi < MECH_MODEL.length; pi++) {
    if (pi === 17 && !swing) continue;
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
  if (pose === S_MOVE) for (const x of [-7, 7]) {
    const a = P(9, x, 63, -11), b = P(9, x, 60, -34 - frame * 6);
    g.lS(10, C_ink, alpha); g.lB(a[3], a[4], b[3], b[4]);
    g.lS(6, energy, alpha); g.lB(a[3], a[4], b[3], b[4]);
    g.lS(2, C_white, alpha); g.lB(a[3], a[4], b[3], b[4]);
  }
  // Visor is permanent; the energy blade exists only during an attack pose.
  const va = P(16, -3.5, 81, 7.2), vb = P(16, 3.5, 81, 7.2);
  g.lS(4, C_ink, alpha); g.lB(va[3], va[4], vb[3], vb[4]);
  g.lS(2.5, energy, alpha); g.lB(va[3], va[4], vb[3], vb[4]);
  if (swing) {
    const sa = P(17, 23, 38, 3), sb = P(17, 23, 38, 42);
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

// CRT grid over the whole screen.
const crtGrid = (g, color) => {
  g.lS(1, color, 0.13);
  for (let k = 0; k <= 25; k++) {
    g.lB(k * 32, 0, k * 32, H);
    g.lB(0, k * 32, W, k * 32);
  }
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
  const life = (fx.u - fx.now) / fx.dur;
  g.lS(16, C_bolt, life * 0.25);
  g.sP(fx.pts, false);
  g.lS(6, C_bolt, life);
  g.sP(fx.pts, false);
  g.lS(2, C_white, life);
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

// Z-saber style crescent: a vertical arc for V-SLASH, a wide horizontal arc for H-SLASH.
const drawSweep = (g, gx, gy, fc, color, a, kd) => {
  const c = toIso(gx, gy), v = dirVec(fc), sd = dirVec(fc === 'N' || fc === 'S' ? 'E' : 'N');
  const h = kd === A_HSLASH;
  const at = (k, w) => {
    const t = k / 10, th = h ? -1.7 + t * 3.4 : -0.5 + t * 3.1, r = 1 - w * M_sin(t * 3.14);
    return h
      ? { x: c.x + (v.x * M_cos(th) + sd.x * M_sin(th)) * r * 1.6, y: c.y - 30 + (v.y * M_cos(th) + sd.y * M_sin(th)) * r * 1.6 }
      : { x: c.x + v.x * M_sin(th) * r * 1.5, y: c.y - 30 + v.y * M_sin(th) * r * 1.5 - M_cos(th) * r * 42 };
  };
  const band = (w) => [...Array(11).keys()].map((k) => at(k, 0)).concat([...Array(11).keys()].reverse().map((k) => at(k, w)));
  g.fS(color, 0.55 * a);
  g.fP(band(0.5), true);
  g.fS(C_white, a);
  g.fP(band(0.2), true);
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
// Web Audio synth: oscillators + noise. SFX are silent in attract mode; music is not.

const createAudio = (scene) => {
  const ctx = scene.sound && scene.sound.context;
  const ready = () => {
    if (!ctx || scene.md !== S_PLAY) return false;
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  };
  // Music bus sits under the SFX, which go straight to the destination.
  // mel feeds the bus dry and through a 0-3 ms delay swept by a 0.6 Hz LFO: a phaser/flanger sheen
  // on the arpeggio and cuatro only, so drums and bass stay dry.
  const bus = ctx && ctx.createGain(), mel = ctx && ctx.createGain();
  if (bus) {
    bus.gain.value = 0.6;
    bus.connect(ctx.destination);
    const dl = ctx.createDelay(), lfo = ctx.createOscillator(), dep = ctx.createGain();
    dep.gain.value = 0.003;
    lfo.frequency.value = 0.6;
    lfo.connect(dep).connect(dl.delayTime);
    mel.connect(bus);
    mel.connect(dl).connect(bus);
    lfo.start();
  }
  let nb;
  const TRI = 'triangle', xr = (p, v, t) => p.exponentialRampToValueAtTime(v, t);
  const env = (vol, when, dur, d) => {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    xr(g.gain, vol, when + 0.006);
    xr(g.gain, 0.0001, when + dur);
    g.connect(d);
    return g;
  };
  // cut > 0 routes the oscillator through a resonant low-pass sweeping down from cut (acid squelch).
  const voice = (f, dur, type, vol, when, f2, cut, d = bus) => {
    const o = ctx.createOscillator();
    let n = env(vol, when, dur, d);
    o.type = type;
    o.frequency.setValueAtTime(f, when);
    if (f2) xr(o.frequency, f2, when + dur);
    if (cut) {
      const q = ctx.createBiquadFilter();
      q.Q.value = 14;
      q.frequency.setValueAtTime(cut, when);
      xr(q.frequency, 160, when + dur);
      q.connect(n);
      n = q;
    }
    o.connect(n);
    o.start(when);
    o.stop(when + dur + 0.02);
  };
  // One shared second of white noise, sliced per hit (no per-note buffer allocation).
  const perc = (dur, vol, when, d = bus) => {
    if (!nb) {
      nb = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const a = nb.getChannelData(0);
      for (let i = 0; i < a.length; i++) a[i] = M_random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = nb;
    src.connect(env(vol, when, dur, d));
    src.start(when, M_random() * 0.5, dur + 0.02);
  };
  function tone(f, dur, type, vol, f2) {
    if (ready()) voice(f, dur, type, vol, ctx.currentTime, f2, 0, ctx.destination);
  }
  function noise(dur, vol) {
    if (ready()) perc(dur, vol, ctx.currentTime, ctx.destination);
  }
  const arp = (notes) => notes.forEach((f, i) => trackDelay(scene, i * 130, () => tone(f, 0.16, Q_SQUARE, 0.05)));

  // --- Music: "Coquivacoa Steel" (Coquivacoa: the ancestral name of Lake Maracaibo).
  // Gaita-techno at 185 BPM on a 12-step triplet grid, so the 6/8 gaita (tambora,
  // charrasca, cuatro strum) rides over a four-on-the-floor kick: the 3-against-2 polyrhythm.
  // A triplet arpeggio climbs the chord on every step and drives the whole loop. Attract and
  // briefing: gaita vamp. Combat: 8-bar cycle 0 intro (gaita + bass riff, no drums), 1-2 verse
  // (kick, snare, dark octave bass), 3-4 chorus (open bass, rave stabs), 5 battle break (jungle
  // roll), 6 build, 7 chorus.
  const STEP = 60 / 185 / 3; // triplet eighth (~108 ms)
  const ROOTS = [110, 146.83, 164.81, 110]; // i - iv - V - i in A minor (gaita cadence)
  let mStep = 0, mBar = 0, mNext = 0, mInt = 0;
  const schedStep = (i, when) => {
    const root = ROOTS[mBar & 3], bar = mInt ? mBar : -1, beat = i % 3 === 0, six = i % 6, third = mBar % 4 === 2 ? 1.26 : 1.19;
    const chorus = bar === 3 || bar === 4 || bar === 7, brk = bar === 5, kick = bar > 0 && !brk;
    // Furruco: a moaning friction-drum drone on each 6/8 pulse.
    if (!six) voice(root / 2, STEP * 5.5, TRI, 0.22, when, root * 0.53);
    // Tambora 6/8 pattern (X . X X . X) and charrasca scraping every step, accented per beat.
    if (six % 3 !== 1) voice(six % 3 ? 180 : 95, 0.09, 'sine', 0.2, when, 60);
    perc(0.03, beat ? 0.06 : 0.025, when);
    // Cuatro rasgueo: open strum on the beat, muted chas on the offbeat; minor third except on V.
    if (i % 3 !== 1) [1, third, 1.5].forEach((r, k) => voice(root * 2 * r, beat ? 0.2 : 0.05, TRI, 0.035, when + k * 0.012, 0, 0, mel));
    // Driving arpeggio: root, third, fifth on every step, an octave higher in the second half-beat pair.
    voice(root * 4 * [1, third, 1.5][i % 3] * (six > 2 ? 2 : 1), STEP * 1.1, mInt ? Q_SAWTOOTH : TRI, 0.04, when, 0, 0, mel);
    if (!mInt) return;
    // Four-on-the-floor kick, snare on the backbeats, jungle roll in the break.
    if (kick && beat) voice(170, 0.18, 'sine', 0.7, when, 40), perc(0.015, 0.2, when);
    if (kick && (i === 3 || i === 9 || (bar === 6 && i > 7))) perc(0.14, 0.2, when);
    if (brk) perc(0.04, 0.1, when), perc(0.04, 0.07, when + STEP / 2);
    // Bass jumping octaves (root on the beat, octave on the other steps) through the resonant
    // low-pass squelch, darker in verses, wide open in choruses.
    voice(beat ? root / 2 : root, STEP * 0.9, Q_SAWTOOTH, 0.1, when, 0, chorus || brk ? 3500 : 1500);
    // Rave stab with the gang response on the chorus backbeat.
    if (chorus && (i === 3 || i === 9)) voice(root * 4, STEP, Q_SAWTOOTH, 0.05, when, 0, 3500);
  };
  const music = (intensity) => {
    if (!ctx || ctx.state !== 'running') return;
    if (intensity !== mInt) mBar = 0; // restart the section cycle on every mode change
    mInt = intensity;
    const now = ctx.currentTime;
    // Re-sync if the loop stalled (tab backgrounded): never flush a backlog of notes at once.
    if (mNext < now) mNext = now + 0.1;
    // Look-ahead: schedule anything due within the next 150 ms, then let update() poll again.
    while (mNext < now + 0.15) {
      schedStep(mStep, mNext);
      if (++mStep === 12) mStep = 0, mBar = (mBar + 1) % 8;
      mNext += STEP;
    }
  };

  return {
    music,
    tick: () => tone(440, 0.04, Q_SQUARE, 0.03),
    blip: () => tone(660, 0.07, Q_SQUARE, 0.04, 990),
    lock: () => tone(880, 0.12, TRI, 0.06, 1320),
    move: () => tone(160, 0.12, TRI, 0.05, 90),
    swing: () => noise(0.08, 0.05),
    hit: () => {
      noise(0.18, 0.15);
      tone(140, 0.2, Q_SAWTOOTH, 0.06, 50);
    },
    parry: () => tone(1500, 0.15, Q_SQUARE, 0.05, 2200),
    clash: () => {
      noise(0.35, 0.2);
      tone(90, 0.4, Q_SAWTOOTH, 0.08, 40);
    },
    win: () => arp([523, 659, 784, 1047]),
    start: () => arp([392, 587, 784, 1175]),
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
const MENU_TITLES = ['TACTICA', 'COMBATE'];

// Dynamic menu: adds a BURST row to COMBAT when the unit is KNOCKBACK with a charge left.
const buildMenu = (u) => {
  if (!canAct(u)) return [[A_BURST, S_WAIT], [A_BURST, S_WAIT]];
  const combat = [...COMBAT_ACTS];
  if (canUse(u, A_BURST)) combat.push(A_BURST);
  return [MOVE_ACTS, combat];
};
const CARDS = [
  ['PROGRAMA', 'ELIGE UNA ACCION\nLA MAS RAPIDA VA PRIMERO'],
  ['CONTROLES', 'PALANCA: MENU / APUNTAR\nB1 CONFIRMAR   B2 VOLVER'],
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
  const BI = 'bold italic';
  return {
    names: [txt(scene, 30, 24, 14, hex(C_p1)), txt(scene, W - 30, 24, 14, hex(C_cpu), 1)],
    status: [txt(scene, 100, 58, 11, '#fff'), txt(scene, W - 100, 58, 11, '#fff', 1)],
    tags: [txt(scene, 0, 0, 10, hex(C_p1), 0.5), txt(scene, 0, 0, 10, hex(C_cpu), 0.5)],
    i: [txt(scene, W / 2, 22, 13, '#fff', 0.5), txt(scene, W / 2, 42, 10, '#c8ccd8', 0.5), txt(scene, W / 2, 56, 10, '#c8ccd8', 0.5)],
    ph: txt(scene, W / 2, H - 56, 16, '#fff', 0.5),
    hint: txt(scene, W / 2, H - 34, 11, '#9aa0b0', 0.5),
    menu: Array.from({ length: 11 }, () => txt(scene, 0, 0, 12, '#fff', 0.5)),
    title: txt(scene, W / 2, 140, 26, '#fff', 0.5).setDepth(11),
    sub: txt(scene, W / 2, 196, 13, '#fff', 0.5).setDepth(11),
    // Title screen / stage intro lettering (italic, Virtual-On style).
    big: txt(scene, W / 2, 0, 64, hex(C_gold), 0.5).setFontStyle(BI).setPadding(48, 0),
    big2: txt(scene, W / 2, 0, 36, hex(C_p1), 0.5).setFontStyle(BI).setPadding(32, 0),
    // Attract-only texts: the VS line, the event tag under the title bar and the soundtrack corner.
    vs: [txt(scene, 175, 284, 17, '#fff', 0.5), txt(scene, W / 2, 284, 30, hex(C_gold), 0.5).setFontStyle(BI), txt(scene, 625, 284, 17, '#fff', 0.5), txt(scene, W / 2, 54, 12, '#02140a', 0.5), txt(scene, W - 9, H - 9, 10, hex(C_grid), 1)],
    cardT: txt(scene, 263, 340, 12, '#02140a', 0.5),
    card: txt(scene, W / 2, 410, 15, hex(C_grid), 0.5),
    press: txt(scene, W / 2, 520, 30, hex(C_gold), 0.5).setFontStyle(BI),
    // NEXT ENEMY briefing column: code, weapons, arena, mission.
    ne: [txt(scene, 560, 150, 20, hex(C_grid), 0.5), txt(scene, 560, 290, 17, hex(C_grid), 0.5), txt(scene, 560, 400, 17, hex(C_gold), 0.5), txt(scene, 560, 470, 26, hex(C_grid), 0.5).setFontStyle(BI).setPadding(24, 0)],
    // Big italic turn clock, seconds plus small hundredths (Virtual-On style).
    tm: txt(scene, 690, 555, 40, hex(C_grid), 1).setFontStyle(BI).setPadding(16, 0),
    tc: txt(scene, 676, 545, 17, hex(C_grid), 0).setFontStyle(BI),
  };
};

const setupCameras = (s) => {
  const main = s.cameras.main;
  s.cf = { x: WORLD_W / 2, y: ISO_OY };
  s.hc = s.cameras.add(0, 0, W, H);
  main.setBounds(0, 0, WORLD_W, WORLD_H).setDeadzone(64, 44).startFollow(s.cf, false, 0.09, 0.09);
  const fixed = Object.values(s.ui).flat().filter((o) => !s.ui.tags.includes(o));
  main.ignore([s.gUi, s.gWire, ...fixed]);
  s.hc.ignore([s.gBg, s.gMap, s.gFx, s.gUnits, s.gTop, ...s.ui.tags]);
};

const updateCamera = (s, snap) => {
  const cam = s.cameras.main;
  let p, zoom;
  if (s.md === MD_ATTRACT || s.ph === S_CLASH) {
    p = toIso((s.vw[0].gx + s.vw[1].gx) / 2, (s.vw[0].gy + s.vw[1].gy) / 2);
    zoom = s.md === MD_ATTRACT ? 1.1 : 1.5;
  } else {
    const u = s.vw[0], d = dirVec(u.fc);
    p = toIso(u.gx, u.gy);
    p.x += d.x * 2;
    p.y += d.y * 2 - 32;
    zoom = 1.42;
  }
  s.cf.x = p.x;
  s.cf.y = p.y;
  cam.setZoom(snap ? zoom : cam.zoom + (zoom - cam.zoom) * 0.08);
  if (snap) cam.centerOn(p.x, p.y);
};

const screenPoint = (s, p) => {
  const c = s.cameras.main;
  return { x: (p.x - c.worldView.x) * c.zoom, y: (p.y - c.worldView.y) * c.zoom };
};

function create() {
  this.c = createControls(this);
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
  this.tk = 0;
  this.as = 0;
  this.top = [];
  // Storage persists across releases and may be missing or slow: validate entries, merge with
  // anything saved meanwhile, and never let it break the scene.
  try {
    Promise.resolve(window.platanusArcadeStorage.get(TOP_KEY)).then((r) => {
      const ok = r && r.found && Array.isArray(r.value) ? r.value.filter((e) => e && /^[A-Z]{3}$/.test(e.n) && Number.isFinite(e.s) && e.s >= 0) : [];
      this.top = [...this.top, ...ok].sort((a, b) => b.s - a.s).slice(0, 5);
    }).catch(() => {});
  } catch (e) {}
  resetMatch(this, MD_ATTRACT);
}

function update(time, delta) {
  handleInput(this, time);
  updateCamera(this);
  drawWorld(this, time, delta);
  drawHud(this, time);
  // Adaptive BGM: full intensity during live combat, calmer in attract / briefing / game over.
  const combat = this.md === S_PLAY && this.ph !== 'over' && time - this.ms >= INTRO_MS;
  this.sfx.music(combat ? 1 : 0);
}

// --- Match flow ---

const clearPressed = (controls) => {
  for (const k in controls.p) controls.p[k] = false;
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

// next = continue the gauntlet: same run, next stage, P1 keeps its HP (topped up to 20% if lower).
const resetMatch = (s, mode, next) => {
  clearAsync(s);
  s.tk++;
  s.md = mode;
  const hp = next ? M_max(HP_MAX / 5, s.q.us[0].hp) : HP_MAX;
  if (!next) {
    s.j = 1;
    s.z = s.rt = 0;
  }
  MECH_PALS[1][1] = RIVAL_COLS[(s.j - 1) % 6];
  s.q = newState(s.j, hp);
  s.gMap.clear();
  drawMap(s.gMap);
  s.vw = s.q.us.map((u) => ({ gx: u.x, gy: u.y, fc: u.fc, st: 0, f: 0, p: S_IDLE, r: 0 }));
  s.dH = s.q.us.map((u) => u.hp);
  s.fx = [];
  s.lp = null;
  s.clR = null;
  s.thR = null;
  s.mp = { col: 0, row: 0 };
  s.wa = 0;
  if (mode === MD_ATTRACT) s.as = s.time.now;
  s.ms = s.time.now;
  beginTurn(s);
  if (mode === S_PLAY) {
    s.dl += INTRO_MS;
    s.cRdy += INTRO_MS;
    if (!s.tl) s.id += INTRO_MS;
  }
  updateCamera(s, true);
};

const turnMs = (s) => (s.rt > 4 ? TURN_MS : 0);

const idleGuard = (s, time) => {
  const active = s.c.n !== s.ln;
  s.ln = s.c.n;
  if (active) {
    s.id = time + 45000;
    if (s.wa) {
      s.wa = 0;
      clearPressed(s.c);
      return true;
    }
  }
  if (time <= s.id) return false;
  if (s.wa) resetMatch(s, MD_ATTRACT);
  else {
    s.wa = 1;
    s.id = time + 10000;
  }
  return true;
};

const beginTurn = (s) => {
  clearPressed(s.c);
  const now = s.time.now;
  s.phS = now;
  s.bn = '';
  s.wa = s.tl = 0;
  s.fx = s.fx.filter((f) => f.kd !== 'guard');
  if (s.q.v) {
    s.ph = 'over';
    s.dl = now + (s.md === S_PLAY ? OVER_IDLE_MS : ATTRACT_OVER_MS);
    const [a, b] = s.q.us;
    const won = s.q.v === 'p1';
    if (s.md === S_PLAY) {
      const pts = (b.mx - b.hp) * 10 + (won ? 1000 * s.j + a.hp * 10 + (s.j > 5 ? 5000 : 0) : 0);
      s.z += pts;
    }
    if (won) s.sfx.win();
    else s.sfx.lose();
    return;
  }
  const play = s.md === S_PLAY;
  s.tl = play ? turnMs(s) : TURN_MS;
  s.cp = cpuPlan(s.q, 1);
  s.cRdy = now + (play ? 700 + M_random() * 1800 : ATTRACT_TURN_MS);
  s.pp = play ? null : cpuPlan(s.q, 0);
  s.ph = s.pp ? Q_LOCKED : S_CHOOSE;
  s.dl = s.tl ? now + s.tl + 0 : Infinity;
  if (play && !s.tl) s.id = now + 45000;
  const menu = buildMenu(s.q.us[0]);
  s.mp.col = M_max(0, M_min(1, s.mp.col));
  s.mp.row = M_max(0, M_min(menu[s.mp.col].length - 1, s.mp.row));
  s.sel = { a: menu[s.mp.col][s.mp.row], d: s.q.us[0].fc, cur: null };
};

const lockP1 = (s, plan) => {
  s.pp = plan;
  s.ph = Q_LOCKED;
  s.sfx.lock();
};

// Start aiming the highlighted action.
const startAim = (s) => {
  const me = s.q.us[0];
  const a = ACTIONS[s.sel.a];
  if (!a || (!canAct(me) && a.t !== Q_NONE) || !canUse(me, s.sel.a)) return s.sfx.tick();
  // BURST / PASS have no aim step — lock immediately.
  if (a.t === Q_NONE) return lockP1(s, { a: s.sel.a });
  s.sel.d = me.fc;
  s.sel.cur = null;
  if (a.t === Q_TILE) {
    s.sel.v = s.sel.a === S_TELE ? tpReach(s.q, 0) : s.sel.a === Q_RAYO ? tpReach(s.q, 0, 1) : reach(s.q, 0, a.r);
    const foe = s.q.us[1];
    let best = null;
    for (const wp of s.sel.v.values()) {
      const t = wp[wp.length - 1];
      if (!best || dist(t, foe) < dist(best, foe)) best = t;
    }
    if (!best) return s.sfx.tick();
    s.sel.cur = { x: best.x, y: best.y };
  }
  s.ph = S_AIM;
  s.sfx.blip();
};

// The plan the current selection describes (also drives the ghost preview).
const selPlan = (s) => {
  const a = ACTIONS[s.sel.a];
  if (a.t === Q_TILE) {
    const wp = s.sel.cur && s.sel.v.get(s.sel.cur.x + ',' + s.sel.cur.y);
    return wp ? { a: s.sel.a, wp } : null;
  }
  return { a: s.sel.a, d: s.sel.d };
};

const handleInput = (s, time) => {
  const c = s.c;
  const start = () => consumePressed(c, 'START1') || consumePressed(c, 'P1_1');

  if (s.md === MD_ATTRACT) {
    if (start()) {
      resetMatch(s, S_PLAY);
      return s.sfx.start();
    }
    if (s.ph === Q_LOCKED && time > s.cRdy) lockTurn(s);
    if (s.ph === 'over' && time > s.dl) resetMatch(s, MD_ATTRACT);
    return;
  }
  if (time - s.ms < INTRO_MS) return clearPressed(c);
  if (s.ph === 'over') {
    if (time < s.phS + ATTRACT_OVER_MS) return clearPressed(c);
    if (!start() && time < s.dl) return;
    if (s.q.v !== 'p1' || s.j > 5) return endRun(s);
    s.j++;
    return resetMatch(s, S_PLAY, true);
  }
  if (s.ph === 'name') {
    const k = s.ini;
    if (consumePressed(c, 'P1_U')) k[s.ip] = (k[s.ip] + 1) % 26;
    if (consumePressed(c, 'P1_D')) k[s.ip] = (k[s.ip] + 25) % 26;
    if ((consumePressed(c, 'P1_1') && ++s.ip > 2) || time > s.dl) saveScore(s);
    return;
  }
  // Clash: the stick moves through the cards like the menu, B1 (or the clock) commits the highlighted one.
  if (s.ph === S_CLASH) {
    const n = s.q.us[0].b ? 4 : 3;
    if (consumePressed(c, 'P1_U')) s.ci = (s.ci + n - 1) % n;
    if (consumePressed(c, 'P1_D')) s.ci = (s.ci + 1) % n;
    if (consumePressed(c, 'P1_1') || time > s.dl) {
      s.sfx.blip();
      s.clR(CLASH_PICKS[s.ci]);
    }
    return;
  }
  if (s.ph === Q_THROW) {
    for (const [stick, dir] of Object.entries(STICK_TO_DIR)) {
      if (consumePressed(c, 'P1_' + stick)) {
        s.thD = dir;
        s.sfx.tick();
      }
    }
    if (consumePressed(c, 'P1_1') || time > s.dl) s.thR(s.thD);
    return;
  }
  if (s.ph === Q_LOCKED) {
    if (time > s.cRdy + 300) lockTurn(s);
    return;
  }
  if (s.ph !== S_CHOOSE && s.ph !== S_AIM) return;
  if (!s.tl && idleGuard(s, time)) return;

  const canBurst = s.q.us[0].st === ST_KNOCKBACK && canUse(s.q.us[0], A_BURST);
  if (!canAct(s.q.us[0]) && !canBurst) {
    if (time > s.phS + STUN_SHOW_MS) lockP1(s, WAIT_PLAN);
    return;
  }
  if (time > s.dl) return lockP1(s, WAIT_PLAN);

  const sel = s.sel;
  if (s.ph === S_CHOOSE) {
    const me = s.q.us[0];
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
    sel.a = fullMenu[m.col][m.row];
    s.sfx.tick();
    return;
  }

  // Aiming.
  if (consumePressed(c, 'P1_2')) {
    s.ph = S_CHOOSE;
    s.sfx.tick();
    return;
  }
  for (const [stick, dir] of Object.entries(STICK_TO_DIR)) {
    if (!consumePressed(c, 'P1_' + stick)) continue;
    s.sfx.tick();
    if (ACTIONS[sel.a].t === S_DIR) {
      sel.d = dir;
    } else {
      const n = step(sel.cur, dir);
      const me = s.q.us[0];
      if (sel.v.has(n.x + ',' + n.y) || same(n, me)) sel.cur = n;
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
  if (s.z > 0 && (s.top.length < 5 || s.z > s.top[4].s)) {
    s.ph = 'name';
    s.ini = [0, 0, 0];
    s.ip = 0;
    s.dl = s.time.now + OVER_IDLE_MS; // an abandoned cabinet still saves and returns to attract
    clearPressed(s.c);
  } else resetMatch(s, MD_ATTRACT);
};

const initials = (k) => k.map((n) => String.fromCharCode(65 + n)).join('');

const saveScore = (s) => {
  s.top = [...s.top, { n: initials(s.ini), s: s.z }].sort((a, b) => b.s - a.s).slice(0, 5);
  resetMatch(s, MD_ATTRACT);
  try {
    Promise.resolve(window.platanusArcadeStorage.set(TOP_KEY, s.top)).catch(() => {});
  } catch (e) {}
};

const lockTurn = async (s) => {
  const token = s.tk;
  let thrown = -1;
  s.ph = Q_RESOLVE;
  const r = resolveTurn(s.q, [s.pp, s.cp]);
  if (!(await playEvents(s, r.events, token))) return;
  s.q = r.q;
  if (r.j >= 0) thrown = r.j;

  if (r.grab !== null && r.grab !== undefined && !s.q.v) {
    const dir = await askThrow(s, r.grab);
    if (token !== s.tk) return;
    const t = resolveThrow(s.q, r.grab, dir);
    thrown = 1 - r.grab;
    if (!(await playEvents(s, t.events, token))) return;
    s.q = t.q;
  }

  if (r.clash) {
    const picks = await askClash(s);
    if (token !== s.tk) return;
    s.lp = picks[0];
    s.bn = picks.map((p) => CLASH_NAMES[CLASH_PICKS.indexOf(p)]).join('  VS  ');
    const c = resolveClash(s.q, picks);
    if (!(await playEvents(s, c.events, token))) return;
    s.q = c.q;
  }

  // Zone events: check both final tiles, then adjudicate without advancing twice.
  if (!s.q.v) {
    // A thrown unit already triggered every zone it flew over.
    const zEvents = [];
    [0, 1].forEach((i) => i !== thrown && resolveZone(s.q, i, zEvents));
    checkOutcome(s.q);
    if (zEvents.length && !(await playEvents(s, zEvents, token))) return;
  }

  s.dH = s.q.us.map((u) => u.hp);
  s.vw.forEach((v, i) => {
    const u = s.q.us[i];
    Object.assign(v, { gx: u.x, gy: u.y, fc: u.fc, st: u.st });
  });
  await wait(s, 450);
  if (token === s.tk) {
    if (s.md === S_PLAY) s.rt++;
    beginTurn(s);
  }
};

const askThrow = (s, who) => {
  if (s.md !== S_PLAY || who !== 0) return wait(s, 400).then(() => cpuThrowDir(s.q, who));
  s.thD = s.q.us[0].fc;
  s.ph = Q_THROW;
  s.dl = s.time.now + CLASH_MS;
  clearPressed(s.c);
  return new Promise((res) => {
    s.thR = (dir) => {
      s.ph = Q_RESOLVE;
      res(dir);
    };
  });
};

const askClash = (s) => {
  const cpu = cpuClashPick(s.lp, s.q.us[1].b);
  if (s.md !== S_PLAY) return wait(s, 600).then(() => [cpuClashPick(null, s.q.us[0].b), cpu]);
  s.ph = S_CLASH;
  s.ci = 0;
  s.phS = s.time.now;
  s.dl = s.time.now + CLASH_MS;
  clearPressed(s.c);
  return new Promise((res) => {
    s.clR = (pick) => {
      s.clR = null;
      s.ph = Q_RESOLVE;
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
  fx.u = s.time.now + fx.dur;
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
  s.hc.ignore(t);
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
    if (token !== s.tk) return false;
    const u = v[e.w];
    if (e.t === 'order') {
      // Both actions are revealed together; speed decides what lands first. Held poses drop here.
      v.forEach((x) => (x.p = S_IDLE));
      const nm = (a, i) => (i && a === Q_RAYO ? '???' : ACTIONS[a].n);
      s.bn = e.a.map((a, i) => actLabel(i) + nm(a, i) + (a === S_WAIT || (i && a === Q_RAYO) ? '' : ' ' + e.v[i])).join('  VS  ');
      e.a.forEach((a, i) => floatText(s, v[i], nm(a, i), unitColor(i), 18, 1100));
      s.sfx.tick();
      await wait(s, 650);
    } else if (e.t === 'beat') {
      await wait(s, 80);
    } else if (e.t === 'face') {
      u.fc = e.fc;
      await wait(s, 120);
    } else if (e.t === S_MOVE) {
      // Consecutive moves in a beat animate together.
      let end = ei;
      while (end < events.length && events[end].t === S_MOVE) end++;
      const batch = events.slice(ei, end);
      batch.forEach(() => s.sfx.move());
      await Promise.all(batch.map(async (m) => {
        const mover = v[m.w], thrust = m.a === S_MOVE || m.a === A_LUNGE;
        if (m.a === S_TELE) {
          const from = toIso(mover.gx, mover.gy);
          addFx(s, { kd: Q_SHARDS, x: from.x, y: from.y - 30, color: unitColor(m.w), dur: 300 });
          Object.assign(mover, { gx: m.wp[0].x, gy: m.wp[0].y, fc: m.fc, f: 1 });
          s.sfx.parry();
          return wait(s, 250);
        }
        const steps = m.wp.length * 3;
        let n = 0;
        mover.p = thrust ? S_MOVE : S_IDLE;
        if (thrust) mover.fc = m.fc;
        for (const c of m.wp) {
          const x = mover.gx, y = mover.gy;
          for (let f = 0; f < 3; f++, n++) {
            if (thrust) mover.r = n === 0 ? 0 : n === steps - 1 ? 2 : 1;
            await tweenTo(s, mover, x + (c.x - x) * (f + 1) / 3, y + (c.y - y) * (f + 1) / 3, STEP_MS / 3);
          }
        }
        mover.fc = m.fc;
        mover.p = S_IDLE; mover.r = 0;
      }));
      ei = end - 1;
    } else if (e.t === 'bump') {
      floatText(s, u, 'BLOQUEADO', C_white, 12);
      await wait(s, 300);
    } else if (e.t === S_BLOCK) {
      floatText(s, u, 'ESCUDO!', C_p1, 17);
      ring(s, u, C_p1, 20, 340);
      s.sfx.parry();
      await wait(s, 300);
    } else if (e.t === Q_VENT) {
      s.dH[e.w] += e.h;
      floatText(s, u, 'REPARA +' + e.h + ' HP', C_grid, 17);
      ring(s, u, C_grid, 26, 480);
      s.sfx.lock();
      await wait(s, 400);
    } else if (e.t === 'guard') {
      addFx(s, { kd: 'guard', w: e.w, dur: 4000 });
      u.p = A_HSLASH;
      u.r = 0;
      s.sfx.blip();
      await wait(s, 250);
    } else if (STRIKE_ACTS.includes(e.t) || e.t === S_GRAB) {
      (e.l && e.l.length ? e.l : [{ x: e.x, y: e.y }]).forEach((t) =>
        addFx(s, { kd: 'cell', x: t.x, y: t.y, color: unitColor(e.w), dur: 450 }),
      );
      const slash = e.t === A_VSLASH || e.t === A_HSLASH, attack = e.t !== S_GRAB;
      if (attack) {
        u.p = slash ? e.t : A_VSLASH; u.r = 0;
        await wait(s, slash ? 140 : 90);
        u.r = 1;
        addFx(s, { kd: 'sweep', w: e.w, a: e.t, dur: slash ? 220 : 200 });
        s.sfx.swing();
        await wait(s, 90);
        u.r = 2;
        await wait(s, slash ? 110 : 70);
      } else await wait(s, 260);
    } else if (e.t === 'miss') {
      floatText(s, u, 'FALLO', 0x9aa0b0, 14);
      await wait(s, 350);
    } else if (e.t === Q_HIT) {
      u.f = 1;
      u.p = S_IDLE;
      const hitAt = toIso(u.gx, u.gy);
      addFx(s, { kd: Q_SHARDS, x: hitAt.x, y: hitAt.y - 30, color: e.w ? C_cpu : C_p1, dur: 380 });
      s.dH[e.w] = M_max(0, s.dH[e.w] - e.dm);
      const dmgText = 'GOLPE! -' + e.dm + (e.f ? ' FLANCO!' : '') + (e.s ? ' IMPACTO!' : '');
      floatText(s, u, dmgText, C_white, 17);
      // Combo bonus: if the target was in a non-normal stance, shout it.
      const targetSt = e.p || ST_NORMAL;
      if (targetSt > ST_NORMAL && e.c !== false) floatText(s, u, 'COMBO!', C_bolt, 14);
      const ko = !s.dH[e.w];
      ring(s, u, ko ? C_white : unitColor(e.w), ko ? 40 : 18, ko ? 900 : 320);
      shake(ko ? 600 : 140, ko ? 0.02 : 0.008);
      s.sfx.hit();
      await wait(s, ko ? HIT_PAUSE_MS * 2 : HIT_PAUSE_MS);
    } else if (e.t === A_PARRY) {
      floatText(s, u, 'PARRY! +' + GUTS_BONUS, C_coast, 17);
      addFx(s, { kd: Q_FLASH, dur: 120 });
      ring(s, u, C_p1, 22, 380);
      s.sfx.parry();
      await wait(s, HIT_PAUSE_MS);
    } else if (e.t === 'interrupt') {
      floatText(s, u, ACTIONS[e.a].n + ' PERDIDO', C_bolt, 13, 1300);
      await wait(s, 450);
    } else if (e.t === S_KNOCK) {
      u.p = S_IDLE;
      for (const c of e.wp) await tweenTo(s, u, c.x, c.y, STEP_MS * (e.y ? 0.45 : 0.7));
    } else if (e.t === 'break') {
      LAGO_MAP[e.y][e.x] = 0;
      s.gMap.clear();
      drawMap(s.gMap);
      const p = toIso(e.x, e.y);
      addFx(s, { kd: Q_SHARDS, x: p.x, y: p.y - 12, color: e.k === 3 ? C_rust : C_concrete, dur: 520 });
      if (e.dm) {
        s.dH[e.w] = M_max(0, s.dH[e.w] - e.dm);
        u.f = 1;
        floatText(s, u, (e.k === 2 ? 'PUENTE CAIDO! -' : 'PALAFITO DESTRUIDO! -') + e.dm, C_white, 16, 1300);
        shake(240, 0.014);
        s.sfx.clash();
        await wait(s, 500);
      }
    } else if (e.t === 'caught') {
      floatText(s, u, 'ATRAPADO!', C_bolt, 17);
      s.sfx.hit();
      await wait(s, 400);
    } else if (e.t === Q_THROW) {
      floatText(s, u, 'LANZA!', unitColor(e.w), 17);
      await wait(s, 200);
    } else if (e.t === 'launch') {
      floatText(s, u, 'LANZADO!', C_bolt, 17);
      shake(160, 0.01);
      await wait(s, 250);
    } else if (e.t === 'refresh') {
      floatText(s, u, 'ENERGIA LLENA! CARGAS LISTAS', C_bolt, 14, 1300);
      s.sfx.lock();
      await wait(s, 300);
    } else if (e.t === 'open') {
      floatText(s, u, 'FALLO! EXPUESTO', C_cpu, 15, 1200);
      await wait(s, 350);
    } else if (e.t === 'momentum') {
      floatText(s, u, 'IMPULSO', C_bolt, 13);
    } else if (e.t === A_BURST) {
      u.st = ST_NORMAL;
      floatText(s, u, 'BURST!', C_bolt, 17);
      addFx(s, { kd: Q_FLASH, dur: 120 });
      ring(s, u, C_bolt, 34, 520);
      s.sfx.clash();
      await wait(s, 300);
    } else if (e.t === S_STANCE) {
      u.st = e.st;
      const stColors = [C_coast, C_bolt, C_cpu, C_white];
      const stLabel = ['RECUPERADO', 'ATURDIDO', 'RETROCESO', 'DERRIBADO'][e.st];
      addFx(s, { kd: Q_FLASH, color: stColors[e.st] || C_white, dur: 180 });
      if (stLabel) floatText(s, u, stLabel, stColors[e.st] || C_white, 16);
      await wait(s, 250);
    } else if (e.t === 'bolt') {
      const b = toIso(e.x, e.y);
      addFx(s, { kd: 'bolt', pts: makeBoltPoints(b.x, b.y - 10), dur: 650 });
      addFx(s, { kd: Q_SHARDS, x: b.x, y: b.y - 8, color: C_bolt, dur: 500 });
      addFx(s, { kd: Q_FLASH, color: C_bolt, dur: 140 });
      shake(160, 0.01);
      s.sfx.clash();
      await wait(s, 350);
    } else if (e.t === S_ZONE) {
      const zLabel = e.z + (e.dm ? ' -' + e.dm : '') + (e.g ? ' +' + GUTS_BONUS + ' ENERGIA' : '') + (e.push ? ' RESBALA!' : '') + (e.st ? ' ' + ST_NAME[e.st] : '');
      if (e.z === 'RAYO') {
        const strike = toIso(u.gx, u.gy);
        addFx(s, { kd: 'bolt', pts: makeBoltPoints(strike.x, strike.y - 22), dur: 500 });
        addFx(s, { kd: Q_SHARDS, x: strike.x, y: strike.y - 20, color: C_bolt, dur: 420 });
      }
      floatText(s, u, zLabel, e.color || C_bolt, 14);
      if (e.dm) {
        s.dH[e.w] = M_max(0, s.dH[e.w] - e.dm);
        u.f = 0.6;
        shake(100, 0.006);
        s.sfx.hit();
      }
      if (e.st !== undefined) u.st = e.st;
      if (e.wp && e.wp.length) {
        for (const c of e.wp) await tweenTo(s, u, c.x, c.y, STEP_MS * 0.7);
      }
      if (e.g) s.sfx.blip();
      addFx(s, { kd: Q_FLASH, color: e.color || C_bolt, dur: 100 });
      await wait(s, 400);
    } else if (e.t === S_CLASH || e.t === 'mirror') {
      const m = toIso((v[0].gx + v[1].gx) / 2, (v[0].gy + v[1].gy) / 2);
      addFx(s, { kd: 'bolt', pts: makeBoltPoints(m.x, m.y - 24), dur: 550 });
      addFx(s, { kd: Q_SHARDS, x: m.x, y: m.y - 24, color: C_cpu, dur: 520 });
      const mid = { gx: (v[0].gx + v[1].gx) / 2, gy: (v[0].gy + v[1].gy) / 2 };
      ring(s, mid, C_white, 30, 520);
      ring(s, mid, C_cpu, 16, 420);
      addFx(s, { kd: Q_FLASH, dur: 180 });
      shake(220, 0.012);
      s.sfx.clash();
      s.bn = e.t === S_CLASH ? 'CLASH!!' : 'ESPEJO! AMBOS RETROCEDEN';
      await wait(s, CLASH_PAUSE_MS);
    } else if (e.t === 'clashWin') {
      floatText(s, u, 'GANA EL CLASH', unitColor(e.w), 17);
      await wait(s, 300);
    }
  }
  return token === s.tk;
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
      const pulse = zone === Q_CAT ? flicker : 0.07 + 0.06 * M_sin(time / 250 + x + y);
      g.fS(ZONE_COLOR[zone], pulse);
      g.fP(cellPts(x, y), true);
    }
  }

  // Live specials: own bolt marks and traps, storm marks, and the orb.
  for (const h of s.q.k) {
    if (h.k === Q_ORBE) {
      const o = toIso(h.x, h.y);
      g.fS(C_bolt, 0.35);
      g.fC(o.x, o.y - 18, 13 + 3 * M_sin(time / 80));
      g.fS(C_white, 0.9);
      g.fC(o.x, o.y - 18, 6);
    } else if (h.w !== 1) drawCell(g, h.x, h.y, C_bolt, flicker * 3, 0.9);
  }

  // Planning previews: reachable tiles, aim arrows, ghost, attack tile.
  let ghost = null;
  const me = s.q.us[0];
  const play = s.md === S_PLAY;
  const blink = 0.5 + 0.5 * M_sin(time / 90);
  const planning = canAct(me) || canUse(me, A_BURST);
  if (play && (s.ph === S_CHOOSE || s.ph === S_AIM) && planning) {
    const sel = s.sel;
    const a = ACTIONS[sel.a];
    if (s.ph === S_AIM && a.t === Q_TILE) {
      for (const wp of sel.v.values()) {
        const t = wp[wp.length - 1];
        drawCell(g, t.x, t.y, 0x43f08a, 0.14, 0.65);
      }
      const wp = sel.v.get(sel.cur.x + ',' + sel.cur.y);
      if (wp) {
        g.lS(2, C_white, 0.8);
        g.sP([me, ...wp].map((c) => toIso(c.x, c.y)), false);
      }
      drawCell(g, sel.cur.x, sel.cur.y, C_white, 0.15 + 0.15 * blink, 1);
    }
    if (s.ph === S_AIM && a.t === S_DIR) {
      if (sel.a !== 'pivot') {
        const end = previewPlan(me, { a: sel.a, d: sel.d }, s.q.us[1]);
        const col = ACTIONS[sel.a].k ? C_cpu : C_white;
        const atkTiles =
          sel.a === A_VSLASH || sel.a === A_LUNGE
            ? vslashTiles(sel.a === A_LUNGE ? { x: me.x, y: me.y, fc: sel.d } : { x: end.x, y: end.y, fc: sel.d })
            : sel.a === A_HSLASH
            ? hslashTiles({ x: end.x, y: end.y, fc: sel.d })
            : [step(end, sel.d)];
        atkTiles.forEach((c) => drawCell(g, c.x, c.y, col, 0.15 + 0.2 * blink, 0.5 + 0.5 * blink));
      }
    }
    if (s.ph === S_AIM) {
      const plan = selPlan(s);
      if (plan && !(a.k && plan.a !== A_LUNGE)) ghost = previewPlan(me, plan, s.q.us[1]);
    }
  }
  if (play && s.ph === Q_THROW) {
    const f = flightOf(me, s.thD, {}, 1);
    f.wp.forEach((c, k) => drawCell(g, c.x, c.y, k === f.wp.length - 1 && f.b.length ? C_cpu : C_bolt, 0.15 + 0.15 * blink, 0.8));
  }

  const gu = s.gUnits;
  gu.clear();
  const order = s.vw.map((v, i) => ({ v, i })).sort((a, b) => a.v.gy - a.v.gx - (b.v.gy - b.v.gx));
  for (const { v, i } of order) {
    v.f = M_max(0, v.f - delta / 250);
    if (i === 0 && ghost) drawMecha(gu, ghost.x, ghost.y, ghost.fc, C_p1, 0.35, 0, 0, S_IDLE, 0);
    const pl = s.ph === S_AIM ? s.sel : s.ph === Q_LOCKED && s.pp;
    const guard = !i && play && pl && STRIKE_ACTS.includes(pl.a) && (pl.a === A_HSLASH ? A_HSLASH : A_VSLASH);
    const stance = guard || (s.ph === S_CLASH && A_VSLASH);
    drawMecha(gu, v.gx, v.gy, guard ? pl.d : v.fc, unitColor(i), 1, v.f, v.st, stance || v.p, stance ? 0 : v.r);
    const p = toIso(v.gx, v.gy);
    const n = s.vw[1 - i];
    const near = M_abs(v.gx - n.gx) + M_abs(v.gy - n.gy) < 3;
    const off = near ? M_sign(v.gx + v.gy - n.gx - n.gy || i * 2 - 1) * 22 : 0;
    drawMiniBar(gu, p.x + off, p.y + 12, s.dH[i] / s.q.us[i].mx, unitColor(i));
    s.ui.tags[i].setPosition(p.x + off, p.y + 25);
    const stName = ['P1', 'CPU'][i] + (v.st ? '  ' + ST_NAME[v.st] : '') + (s.q.us[i].o ? '  EXPUESTO' : '');
    setT(s.ui.tags[i], stName);
    const ready = i === 0 ? !!s.pp && s.ph === Q_LOCKED : s.ph === Q_LOCKED || (play && (s.ph === S_CHOOSE || s.ph === S_AIM) && time > s.cRdy);
    if (ready) drawCheck(gu, p.x + 16, p.y - 50, unitColor(i));
  }

  const gt = s.gTop;
  gt.clear();
  s.fx = s.fx.filter((f) => f.u > time);
  for (const f of s.fx) {
    const a = M_min(1, (f.u - time) / M_min(f.dur, 400));
    if (f.kd === 'bolt') drawBolt(gt, { pts: f.pts, u: f.u, now: time, dur: f.dur });
    else if (f.kd === 'cell') drawCell(gt, f.x, f.y, f.color, 0.4 * a, a);
    else if (f.kd === 'sweep') drawSweep(gt, s.vw[f.w].gx, s.vw[f.w].gy, s.vw[f.w].fc, 0x3dff9c, a, f.a);
    else if (f.kd === 'guard') drawGuard(gt, s.vw[f.w].gx, s.vw[f.w].gy, s.vw[f.w].fc, a);
    else if (f.kd === Q_SHARDS) drawShards(gt, f.x, f.y, f.color, a);
    else if (f.kd === 'ring') {
      const q = (f.u - time) / f.dur; // continuous over the whole ring life
      const k = f.r * (2 - q * q);
      gt.lS(1 + 5 * q, f.color, q);
      gt.strokeEllipse(f.x, f.y, k * 2, k);
    }
    else if (f.kd === Q_FLASH) {
      gt.fS(f.color || C_white, 0.35 * a);
      gt.fR(0, 0, W, H);
    }
  }
};

const drawHud = (s, time) => {
  const g = s.gUi;
  const ui = s.ui;
  g.clear();
  const us = s.q.us;
  const play = s.md === S_PLAY;
  const arc = (x, y, r, a, b, color, width, alpha = 1) => {
    g.lS(width, color, alpha);
    g.beginPath();
    g.arc(x, y, r, a, b, false);
    g.strokePath();
  };

  // Compact opposing pilot panels with one thick, legible HP rail.
  [0, 1].forEach((i) => {
    if (!play || time - s.ms < INTRO_MS) {
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
    const gw = (60 * u.g) / GUTS_MAX;
    g.fS(0x02070c, 1);
    g.fR(gx, 52, 60, 7);
    g.fS(C_bolt, 1);
    g.fR(i ? gx + 60 - gw : gx, 53, gw, 5);
    ui.names[i].setPosition(i ? W - 28 : 28, 21);
    ui.status[i].setPosition(i ? W - 84 : 84, 57);
    setT(ui.names[i], (i ? 'CPU LV' + s.j : 'P1 MARACAIBO') + ' // HP ' + M_max(0, s.dH[i]));
    const stLabel = ST_NAME[u.st] || '';
    setT(ui.status[i], [stLabel, u.o && 'EXPUESTO', u.od && 'OVERDRIVE ' + u.od, u.m && 'IMPULSO', canUse(u, A_BURST) && 'BURST LISTO'].filter(Boolean).join(' // '));
  });

  // Reserved top-centre action telemetry, clear of both HP panels.
  let info = ['', '', ''];
  const me = us[0];
  const intro = play && time - s.ms < INTRO_MS;
  const aiming = play && !intro && (s.ph === S_CHOOSE || s.ph === S_AIM) && (canAct(me) || canUse(me, A_BURST));
  if (aiming) {
    const a = ACTIONS[s.sel.a];
    const plan = selPlan(s) || { a: s.sel.a, d: me.fc };
    const available = (canAct(me) || a.t === Q_NONE) && canUse(me, s.sel.a);
    info = available
      ? [a.n + '  //  VEL ' + speedOf(me, plan) + (s.sel.a === S_BLOCK ? '  ' + me.bk + '/' + BLOCK_MAX : ''), a.i[0], a.i[1]]
      : [a.n + '  //  BLOQUEADO', s.sel.a === A_LUNGE ? 'REQUIERE IMPULSO: AVANZA 3 ANTES' : 'SIN CARGA: LLENA ENERGIA', ''];
    drawLabelSlab(g, 244, 9, 312, 56, C_p1, false);
  }
  info.forEach((t, k) => setT(ui.i[k], t));

  // Phase/hint copy remains input-accurate; the rail keeps it off the board.
  let ph = '';
  let hint = '';
  if (play && aiming && s.ph === S_CHOOSE) {
    ph = 'TURNO ' + s.q.t + '  //  ELIGE ACCION';
  } else if (play && aiming) {
    ph = 'APUNTA // ' + ACTIONS[s.sel.a].n;
    hint = 'PALANCA APUNTA   B1 CONFIRMA   B2 VOLVER';
  } else if (play && s.ph === S_CHOOSE && !canAct(me)) {
    ph = me.o ? 'EXPUESTO // RECUPERANDO' : ST_NAME[me.st];
    hint = 'NO PUEDES ACTUAR';
  } else if (play && s.ph === Q_LOCKED) {
    ph = 'ORDEN FIJADA';
    hint = time > s.cRdy ? 'AMBOS PILOTOS LISTOS' : 'ENEMIGO CIFRADO...';
  } else if (play && s.ph === S_CLASH) {
    ph = 'CHOQUE // PALANCA ELIGE  B1 CONFIRMA';
    hint = 'PARRY > ESTOCADA > FINTA > PARRY   BURST VENCE ESTOCADA Y FINTA';
  } else if (play && s.ph === Q_THROW) {
    ph = 'OBJETIVO ATRAPADO // LANZA';
    hint = 'PALANCA APUNTA   B1 LANZA';
  } else if (s.ph === Q_RESOLVE) ph = s.bn;
  if (play && !s.tl && s.wa) {
    ph = 'SIGUES AHI?';
    hint = 'PULSA PARA SEGUIR';
  } else if (play && aiming) {
    const a = s.sel.a;
    hint = s.ph === S_CHOOSE
      ? s.rt ? 'MAS VELOCIDAD GOLPEA PRIMERO' : 'PALANCA: ELIGE  B1: CONFIRMA'
      : STRIKE_ACTS.includes(a) ? 'EL ROJO MARCA TU ALCANCE'
      : a === A_PARRY ? 'PARRY BLOQUEA DE FRENTE'
      : a === S_GRAB ? 'EL ESCENARIO TAMBIEN ES UN ARMA' : hint;
  }
  setT(ui.ph, play ? ph : '');
  setT(ui.hint, hint);

  const items = [];
  if (play && aiming && s.ph === S_CHOOSE) {
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
      items.push({ kd: Q_CAT, x: cx - 78, y: cy - 128, l: MENU_TITLES[0], n: s.mp.col === 0 });
      items.push({ kd: Q_CAT, x: cx + 78, y: cy - 128, l: MENU_TITLES[1], n: s.mp.col === 1 });
    }
    const stepA = M_min(0.42, 2.5 / col.length);
    col.forEach((act, ri) => {
      const a = 0.25 + (ri - (col.length - 1) / 2) * stepA;
      items.push({ kd: 'act', x: cx + side * M_cos(a) * 132, y: cy + M_sin(a) * 110, l: ACTIONS[act].n, n: s.mp.row === ri, o: !canUse(us[0], act) });
    });
  } else if (play && s.ph === S_CLASH) {
    const p = screenPoint(s, toIso((s.vw[0].gx + s.vw[1].gx) / 2, (s.vw[0].gy + s.vw[1].gy) / 2));
    const cx = M_max(120, M_min(W - 120, p.x));
    const cy = M_max(150, M_min(H - 170, p.y - 26));
    arc(cx, cy, 62, -2.8, 0.35, 0x2d0713, 16, 0.82);
    arc(cx, cy, 62, -2.8, 0.35, C_cpu, 4, 1);
    arc(cx, cy, 79, -0.15, 2.65, C_cpu, 3, 0.65);
    drawShards(g, cx, cy, C_cpu, 0.9);
    const opts = CLASH_NAMES.slice(0, us[0].b ? 4 : 3);
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
      g.fS(k === s.ci ? 0x8a1430 : 0x010308, 0.97);
      g.fP(card, true);
      g.lS(4, k === s.ci ? C_white : C_cpu, 1);
      g.sP(card, true);
      g.lS(1.5, 0xff91a9, 0.8);
      g.lB(x + 15, y + 32, x + 113, y + 35);
      items.push({ kd: S_CLASH, x: x + 76, y: y + 18, l: name });
    });
  }

  ui.menu.forEach((t, k) => {
    const it = items[k];
    t.setVisible(!!it);
    if (!it) return;
    // Pool objects stay API-minimal for the cabinet harness; geometry carries hierarchy.
    if (it.kd === Q_CAT) drawLabelSlab(g, it.x - 54, it.y - 11, 108, 22, C_p1, it.n);
    if (it.kd === 'act') drawLabelSlab(g, it.x - (it.n ? 59 : 52), it.y - 10, it.n ? 118 : 104, 20, C_p1, it.n);
    t.setColor(it.n || it.kd === S_CLASH ? '#fff' : it.o ? '#53616a' : it.kd === Q_CAT ? hex(C_coast) : '#dce5e5');
    t.setPosition(it.x, it.y);
    setT(t, it.l);
  });

  // Cohesive lower phase rail and time pressure meter.
  if (play && ph) {
    g.fS(0x03080e, 0.9);
    g.fP([{ x: 0, y: 530 }, { x: 145, y: 530 }, { x: 165, y: 538 }, { x: 635, y: 538 }, { x: 655, y: 530 }, { x: W, y: 530 }, { x: W, y: H }, { x: 0, y: H }], true);
    g.lS(2, s.ph === S_CLASH ? C_cpu : C_p1, 0.75);
    g.lB(145, 530, 655, 530);
  }
  let clock = '';
  let cs = '';
  if (play && !intro && (s.ph === S_CLASH || s.ph === Q_THROW || (s.tl && (s.ph === S_CHOOSE || s.ph === S_AIM)))) {
    const total = s.ph === S_CLASH || s.ph === Q_THROW ? CLASH_MS : s.tl;
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
    // Title screen: the demo duel runs dimmed behind a CRT grid (arcade VS screen homage).
    g.fS(0x010806, 0.62);
    g.fR(0, 0, W, H);
    crtGrid(g, C_grid);
    g.fS(C_grid, 1);
    g.fR(255, 45, 290, 19);
    g.fR(160, 331, 206, 19);
    drawChevron(g, 30, 262, 300, 44, C_p1, 1);
    drawChevron(g, 470, 262, 300, 44, C_cpu, -1);
    g.lS(3, C_grid, 0.9);
    g.sP([{ x: 150, y: 340 }, { x: 650, y: 340 }, { x: 650, y: 470 }, { x: 170, y: 470 }, { x: 150, y: 450 }], true);
    const cards = s.top.length ? [...CARDS, ['MEJORES PILOTOS', s.top.map((e, k) => k + 1 + '. ' + e.n + '  ' + e.s).join('\n')]] : CARDS;
    card = cards[M_floor((time - s.as) / CARD_MS) % cards.length];
    big = 'CATATUMBO';
    big2 = 'PROTOCOL';
    tint(ui.big, C_gold);
    ui.big.setY(122).setScale(1);
    ui.big2.setPosition(W / 2, 184);
  } else if (intro) {
    // NEXT ENEMY briefing: CRT grid, spinning wireframe of the rival, its spec sheet and the arena.
    g.fS(0x01060a, 0.97);
    g.fR(0, 0, W, H);
    crtGrid(g, C_p1);
    g.fS(C_cpu, 1);
    g.fillTriangle(122, 38, 122, 66, 138, 52);
    g.fillTriangle(678, 38, 678, 66, 662, 52);
    const c = toIso(0, 0);
    s.gWire.setPosition(200 - c.x * 3.2, 515 - c.y * 3.2);
    drawMecha(s.gWire, 0, 0, DIR_KEYS[M_floor(time / 450) % 4], C_cpu, 1, 0, 0, S_IDLE, 0, 1);
    const n = s.j;
    big = 'PROXIMO RIVAL';
    big2 = rival(s);
    tint(ui.big, C_cpu);
    ui.big.setY(52).setScale(0.8);
    ui.big2.setPosition(560, 205);
    ne = ['UNIDAD LV' + n, 'VIDA ' + s.q.us[1].mx + '  //  ' + (aggro(n) ? 'AGRESIVO' : 'DEFENSIVO'), '- LAGO DE MARACAIBO -', n > 5 ? 'MISION FINAL' : n + 'A MISION'];
  } else if (s.ph === 'over') {
    const o = s.q.v;
    title = o === 'p1' ? (s.j > 5 ? 'PROTOCOLO COMPLETADO' : 'ETAPA ' + s.j + ' SUPERADA') : o === 'cpu' ? 'DERROTA' : 'EMPATE';
    titleColor = o === 'p1' ? C_p1 : o === 'cpu' ? C_cpu : C_bolt;
    sub = 'PUNTOS ' + s.z + '\n' + (time > s.phS + ATTRACT_OVER_MS && blinkOn ? (o === 'p1' && s.j < 6 ? 'PULSA START: SIGUIENTE' : 'PULSA START') : ' ');
  } else if (s.ph === 'name') {
    title = 'NUEVO RECORD';
    titleColor = C_bolt;
    sub = 'PUNTOS ' + s.z + '\n' + initials(s.ini).split('').map((ch, k) => (k === s.ip ? '[' + ch + ']' : ' ' + ch + ' ')).join(' ') + '\nARR/ABA LETRA   B1 SIGUIENTE';
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
  ['P1 MARACAIBO', 'VS', 'CPU ' + rival(s), 'PLATANUS HACK 26  CARACAS', 'BGM: COQUIVACOA STEEL'].forEach((t, k) => setT(ui.vs[k], play ? '' : t));
  ne.forEach((t, k) => setT(ui.ne[k], t));
  setT(ui.cardT, card[0]);
  setT(ui.card, card[1]);
  setT(ui.press, !play && blinkOn ? 'PULSA START' : '');
};

// Boot last: every helper above is initialised before Phaser can call create().
new Phaser.Game(config);
})();
