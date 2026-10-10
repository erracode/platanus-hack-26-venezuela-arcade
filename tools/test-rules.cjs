// Rule tests + CPU soak. Run: node tools/test-rules.cjs
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const assert = require('assert');

const src = fs.readFileSync(process.argv[2] || path.join(__dirname, '..', 'game.js'), 'utf8');
const ctx = {
  console, Math, JSON, Object, Promise, setTimeout, Map, Set,
  window: { addEventListener() {} },
  Phaser: { AUTO: 0, Scale: { FIT: 0, CENTER_BOTH: 0 }, Game: class {} },
};
vm.createContext(ctx);
vm.runInContext(
  src + '\n;globalThis.__api = { resolveTurn, resolveClash, resolveThrow, resolveZone, newState, cpuPlan, cpuClashPick, cpuThrowDir, isWalkable, reach, tileAt, gainGuts, advanceStance, ZONE_TILES, ZONE_CHANCE, ZONE_VERDIN_DMG };',
  ctx,
);
const { resolveTurn, resolveClash, resolveThrow, resolveZone, newState, cpuPlan, cpuClashPick, cpuThrowDir, isWalkable, reach, tileAt, gainGuts, advanceStance, ZONE_TILES, ZONE_CHANCE, ZONE_VERDIN_DMG } = ctx.__api;

const S = (a, b) => {
  const s = newState();
  Object.assign(s.units[0], a);
  Object.assign(s.units[1], b);
  return s;
};
const T = (name, fn) => {
  try {
    fn();
    console.log('ok   ', name);
  } catch (e) {
    console.log('FAIL ', name, '\n', e.message);
    process.exitCode = 1;
  }
};
const has = (r, t) => r.events.some((e) => e.t === t);
const C = (x, y) => ({ x, y });
// Cells used below: row 10 spans x 2..10, all water.

T('front vslash hits for 34 (facing each other, no flank)', () => {
  const r = resolveTurn(S({ x: 5, y: 10, facing: 'E' }, { x: 6, y: 10, facing: 'W' }), [
    { act: 'vslash', dir: 'E' },
    { act: 'pivot', dir: 'W' },
  ]);
  assert.strictEqual(r.state.units[1].hp, 66);
});
T('vsash from behind = flank x2 (68)', () => {
  const r = resolveTurn(S({ x: 5, y: 10, facing: 'E' }, { x: 6, y: 10, facing: 'E' }), [{ act: 'vslash', dir: 'E' }, { act: 'wait' }]);
  assert.strictEqual(r.state.units[1].hp, 32);
});
T('DODGE (220) escapes a V-SLASH (150) and keeps facing', () => {
  const r = resolveTurn(S({ x: 5, y: 10, facing: 'E' }, { x: 6, y: 10, facing: 'W' }), [
    { act: 'vslash', dir: 'E' },
    { act: 'dodge', path: [C(6, 9)] },
  ]);
  assert.strictEqual(r.state.units[1].hp, 100);
  assert.ok(has(r, 'miss'));
  assert.strictEqual(r.state.units[1].facing, 'W');
});
T('MOVE (100) is too slow: hit first and interrupted', () => {
  const r = resolveTurn(S({ x: 5, y: 10, facing: 'E' }, { x: 6, y: 10, facing: 'W' }), [
    { act: 'vslash', dir: 'E' },
    { act: 'move', path: [C(7, 10), C(8, 10)] },
  ]);
  assert.strictEqual(r.state.units[1].hp, 66);
  assert.deepStrictEqual([r.state.units[1].x, r.state.units[1].y], [6, 10]);
  assert.ok(has(r, 'interrupt'));
});
T('PARRY already facing (170) blocks V-SLASH (150) from the front', () => {
  const r = resolveTurn(S({ x: 5, y: 10, facing: 'E' }, { x: 6, y: 10, facing: 'W' }), [
    { act: 'vslash', dir: 'E' },
    { act: 'parry', dir: 'W' },
  ]);
  assert.strictEqual(r.state.units[1].hp, 100);
  assert.strictEqual(r.state.units[1].guts, 1);
});
T('PARRY that must turn (130) is too slow vs V-SLASH (150): takes flank x2 (68)', () => {
  const r = resolveTurn(S({ x: 5, y: 10, facing: 'E' }, { x: 6, y: 10, facing: 'N' }), [
    { act: 'vslash', dir: 'E' },
    { act: 'parry', dir: 'W' },
  ]);
  assert.strictEqual(r.state.units[1].hp, 32, 'flanking vslash from E vs turning to W = ×2');
  assert.ok(has(r, 'interrupt'));
});
T('face-to-face V-SLASH at equal speed → clash', () => {
  const r = resolveTurn(S({ x: 5, y: 10, facing: 'E' }, { x: 6, y: 10, facing: 'W' }), [
    { act: 'vslash', dir: 'E' },
    { act: 'vslash', dir: 'W' },
  ]);
  assert.ok(r.clash);
  assert.strictEqual(r.state.units[0].hp + r.state.units[1].hp, 200);
});
T('turning V-SLASH (110) vs ready V-SLASH (150) still clashes (within window 40)', () => {
  const r = resolveTurn(S({ x: 5, y: 10, facing: 'E' }, { x: 6, y: 10, facing: 'N' }), [
    { act: 'vslash', dir: 'E' },
    { act: 'vslash', dir: 'W' },
  ]);
  assert.ok(r.clash);
});
T('LUNGE needs momentum (otherwise WAIT)', () => {
  const r = resolveTurn(S({ x: 4, y: 10, facing: 'E' }, { x: 7, y: 10, facing: 'N' }), [{ act: 'lunge', dir: 'E' }, { act: 'wait' }]);
  assert.deepStrictEqual([r.state.units[0].x, r.state.units[1].hp], [4, 100]);
});
T('MOVE 2 tiles grants momentum; LUNGE dashes 2 and stabs the flank x2', () => {
  let r = resolveTurn(S({ x: 2, y: 10, facing: 'E' }, { x: 7, y: 10, facing: 'N' }), [
    { act: 'move', path: [C(3, 10), C(4, 10)] },
    { act: 'wait' },
  ]);
  assert.ok(r.state.units[0].momentum);
  r = resolveTurn(r.state, [{ act: 'lunge', dir: 'E' }, { act: 'wait' }]);
  assert.deepStrictEqual([r.state.units[0].x, r.state.units[1].hp], [6, 50]);
  assert.ok(!r.state.units[0].momentum, 'lunge spends momentum');
});
T('GRAB ignores PARRY, then the grabber picks the throw (slam into land = +10)', () => {
  const r = resolveTurn(S({ x: 3, y: 10, facing: 'W' }, { x: 2, y: 10, facing: 'E' }), [
    { act: 'grab', dir: 'W' },
    { act: 'parry', dir: 'E' },
  ]);
  assert.strictEqual(r.grab, 0);
  assert.strictEqual(r.state.units[1].hp, 90);
  const t = resolveThrow(r.state, 0, 'W');
  assert.strictEqual(t.state.units[1].hp, 90 - 25, 'thrown into land at x=1 → slam');
  const o = resolveThrow(r.state, 0, 'S');
  assert.deepStrictEqual([o.state.units[1].x, o.state.units[1].y, o.state.units[1].hp], [2, 12, 75]);
});
T('BURST beats THRUST and FEINT, loses to PARRY, spends guts', () => {
  const s = S({ x: 5, y: 10, facing: 'E', guts: 3 }, { x: 6, y: 10, facing: 'W' });
  let c = resolveClash(s, ['burst', 'thrust']);
  assert.deepStrictEqual([c.state.units[1].hp, c.state.units[1].x, c.state.units[0].guts], [66, 7, 1]);
  c = resolveClash(s, ['burst', 'parry']);
  assert.strictEqual(c.state.units[0].hp, 66);
});
T('zoning: a faster DODGE into the vslash tile gets hit', () => {
  const r = resolveTurn(S({ x: 5, y: 10, facing: 'E' }, { x: 7, y: 10, facing: 'W' }), [
    { act: 'vslash', dir: 'E' },
    { act: 'dodge', path: [C(6, 10)] },
  ]);
  assert.strictEqual(r.state.units[1].hp, 66);
});
T('MOVE path stops before the other unit', () => {
  const r = resolveTurn(S({ x: 4, y: 10, facing: 'E' }, { x: 6, y: 10, facing: 'W' }), [
    { act: 'move', path: [C(5, 10), C(6, 10)] },
    { act: 'pivot', dir: 'N' },
  ]);
  assert.deepStrictEqual([r.state.units[0].x, r.state.units[0].y], [5, 10]);
});
T('equal-speed MOVEs to the same tile: nobody moves', () => {
  const r = resolveTurn(S({ x: 4, y: 10, facing: 'E' }, { x: 6, y: 10, facing: 'W' }), [
    { act: 'move', path: [C(5, 10)] },
    { act: 'move', path: [C(5, 10)] },
  ]);
  assert.deepStrictEqual([r.state.units[0].x, r.state.units[1].x], [4, 6]);
});
T('reach never crosses land or the foe', () => {
  const s = S({ x: 2, y: 10, facing: 'E' }, { x: 3, y: 10, facing: 'W' });
  for (const p of reach(s, 0, 2).values()) {
    for (const c of p) {
      assert.ok(isWalkable(c.x, c.y));
      assert.ok(!(c.x === 3 && c.y === 10));
    }
  }
});
T('clash win: loser takes 34 and enters STAGGERED', () => {
  const c = resolveClash(S({ x: 5, y: 10, facing: 'E' }, { x: 6, y: 10, facing: 'W' }), ['parry', 'thrust']);
  assert.deepStrictEqual([c.state.units[1].hp, c.state.units[1].st], [66, 1]);
  const n = resolveTurn(c.state, [{ act: 'vslash', dir: 'E' }, { act: 'parry', dir: 'W' }]);
  assert.strictEqual(n.state.units[1].hp, 32, 'staggered unit cannot parry');
});
T('mirror clash knocks both back', () => {
  const c = resolveClash(S({ x: 5, y: 10, facing: 'E' }, { x: 6, y: 10, facing: 'W' }), ['feint', 'feint']);
  assert.deepStrictEqual([c.state.units[0].x, c.state.units[1].x], [4, 7]);
});
T('GRAB beats PARRY', () => {
  const r = resolveTurn(S({ x: 5, y: 10, facing: 'E' }, { x: 6, y: 10, facing: 'W' }), [
    { act: 'grab', dir: 'E' },
    { act: 'parry', dir: 'W' },
  ]);
  assert.strictEqual(r.state.units[1].hp, 90);
  assert.strictEqual(r.grab, 0);
});
T('V-SLASH (150) beats GRAB (120): grab interrupted', () => {
  const r = resolveTurn(S({ x: 5, y: 10, facing: 'E' }, { x: 6, y: 10, facing: 'W' }), [
    { act: 'grab', dir: 'E' },
    { act: 'vslash', dir: 'W' },
  ]);
  assert.deepStrictEqual([r.state.units[0].hp, r.state.units[1].hp], [66, 100]);
  assert.ok(has(r, 'interrupt'));
});
T('DODGE escapes a GRAB', () => {
  const r = resolveTurn(S({ x: 5, y: 10, facing: 'E' }, { x: 6, y: 10, facing: 'W' }), [
    { act: 'grab', dir: 'E' },
    { act: 'dodge', path: [C(6, 9)] },
  ]);
  assert.strictEqual(r.state.units[1].hp, 100);
});
T('KO ends the match', () => {
  const r = resolveTurn(S({ x: 5, y: 10, facing: 'E' }, { x: 6, y: 10, facing: 'N', hp: 20 }), [
    { act: 'vslash', dir: 'E' },
    { act: 'wait' },
  ]);
  assert.strictEqual(r.state.over, 'p1');
});

// Zone event tests.
T('oil zone gives +1 guts', () => {
  const ev = [];
  const s = S({ x: 4, y: 13, facing: 'N', guts: 0 }, { x: 6, y: 10, facing: 'W' });
  // Tile (4,13) is oil=7.
  assert.strictEqual(tileAt(4, 13), 7);
  resolveZone(s, 0, ev, () => 1);
  assert.strictEqual(s.units[0].guts, 1);
  assert.ok(ev.some((e) => e.zone === 'OIL'));
});
T('catatumbo zone damages with 100% rng', () => {
  const ev = [];
  const s = S({ x: 3, y: 15, facing: 'N', hp: 100, st: 0 }, { x: 6, y: 10, facing: 'W' });
  // Tile (3,15) is catatumbo=4.
  assert.strictEqual(tileAt(3, 15), 4);
  resolveZone(s, 0, ev, () => 0.01);
  assert.ok(s.units[0].hp < 100);
  assert.ok(s.units[0].st > 0);
  assert.ok(ev.some((e) => e.zone === 'CAT'));
});
T('catatumbo does not trigger with bad rng', () => {
  const ev = [];
  const s = S({ x: 3, y: 15, facing: 'N', hp: 100 }, { x: 6, y: 10, facing: 'W' });
  resolveZone(s, 0, ev, () => 0.99);
  assert.strictEqual(s.units[0].hp, 100);
  assert.strictEqual(ev.length, 0);
});
T('verdin zone pushes back on slip', () => {
  const ev = [];
  const s = S({ x: 4, y: 6, facing: 'W', hp: 100 }, { x: 6, y: 10, facing: 'W' });
  // Tile (4,6) is verdin=6.
  assert.strictEqual(tileAt(4, 6), 6);
  const prevX = s.units[0].x;
  resolveZone(s, 0, ev, () => 0.01);
  assert.ok(s.units[0].hp <= 100 - ZONE_VERDIN_DMG, 'took verdin damage');
  assert.ok(ev.some((e) => e.push));
});

// CPU vs CPU soak: every match must end; units never overlap or leave the water.
const turns = [];
const outcomes = { p1: 0, cpu: 0, draw: 0, timeout: 0 };
for (let m = 0; m < 500; m++) {
  let s = newState();
  let t = 0;
  while (!s.over && t < 200) {
    const r = resolveTurn(s, [cpuPlan(s, 0), cpuPlan(s, 1)]);
    s = r.state;
    if (r.clash) s = resolveClash(s, [cpuClashPick(null, s.units[0].guts), cpuClashPick(null, s.units[1].guts)]).state;
    if (r.grab !== null && r.grab !== undefined && !s.over) s = resolveThrow(s, r.grab, cpuThrowDir(s, r.grab)).state;
    for (const u of s.units) assert.ok(isWalkable(u.x, u.y), 'unit on non-walkable cell');
    assert.ok(!(s.units[0].x === s.units[1].x && s.units[0].y === s.units[1].y), 'units overlap');
    for (const u of s.units) assert.ok(u.hp >= 0 && u.guts <= 3);
    t++;
  }
  outcomes[s.over || 'timeout']++;
  turns.push(t);
}
turns.sort((a, b) => a - b);
console.log('soak 500:', JSON.stringify(outcomes), 'turns median', turns[250], 'p90', turns[450], 'max', turns[499]);
if (outcomes.timeout) process.exitCode = 1;
