const fs = require('fs'), vm = require('vm'), assert = require('assert');
const src = fs.readFileSync(process.argv[2] || require("path").join(__dirname, "..", "game.js"), 'utf8');
const ctx = { console, Math, JSON, Object, Promise, setTimeout,
  window: { addEventListener() {} },
  Phaser: { AUTO: 0, Scale: { FIT: 0, CENTER_BOTH: 0 }, Game: class {} } };
vm.createContext(ctx);
vm.runInContext(src + '\n;globalThis.__api = { resolveTurn, resolveClash, newState, cpuPlan, cpuClashPick, isWalkable, HOLD_PLAN };', ctx);
const { resolveTurn, resolveClash, newState, cpuPlan, cpuClashPick, isWalkable } = ctx.__api;
const P = (move, dir, act) => ({ move, dir, act });
const S = (a, b) => { const s = newState(); Object.assign(s.units[0], a); Object.assign(s.units[1], b); return s; };
const T = (name, fn) => { try { fn(); console.log('ok   ', name); } catch (e) { console.log('FAIL ', name, '\n', e.message); process.exitCode = 1; } };

T('move into land is blocked (bump)', () => {
  const r = resolveTurn(S({ x: 2, y: 8, facing: 'N' }, { x: 9, y: 12 }), [P('move', 'W', 'none'), P('hold', 'N', 'none')]);
  assert.deepStrictEqual([r.state.units[0].x, r.state.units[0].y, r.state.units[0].facing], [2, 8, 'W']);
  assert.ok(r.events.some((e) => e.t === 'bump'));
});
T('same destination: both stay', () => {
  const r = resolveTurn(S({ x: 5, y: 10 }, { x: 7, y: 10 }), [P('move', 'E', 'none'), P('move', 'W', 'none')]);
  assert.deepStrictEqual([r.state.units[0].x, r.state.units[1].x], [5, 7]);
});
T('swap: both stay', () => {
  const r = resolveTurn(S({ x: 5, y: 10 }, { x: 6, y: 10 }), [P('move', 'E', 'none'), P('move', 'W', 'none')]);
  assert.deepStrictEqual([r.state.units[0].x, r.state.units[1].x], [5, 6]);
});
T('move into standing unit is blocked', () => {
  const r = resolveTurn(S({ x: 5, y: 10 }, { x: 6, y: 10 }), [P('move', 'E', 'none'), P('hold', 'N', 'none')]);
  assert.strictEqual(r.state.units[0].x, 5);
});
T('follow into vacated cell is allowed', () => {
  const r = resolveTurn(S({ x: 5, y: 10 }, { x: 6, y: 10 }), [P('move', 'E', 'none'), P('move', 'E', 'none')]);
  assert.deepStrictEqual([r.state.units[0].x, r.state.units[1].x], [6, 7]);
});
T('front slash hits for 25', () => {
  const r = resolveTurn(S({ x: 5, y: 10, facing: 'E' }, { x: 6, y: 10, facing: 'N' }), [P('hold', 'E', 'slash'), P('hold', 'N', 'none')]);
  assert.strictEqual(r.state.units[1].hp, 75);
});
T('back slash hits for 38 (x1.5)', () => {
  const r = resolveTurn(S({ x: 5, y: 10, facing: 'E' }, { x: 6, y: 10, facing: 'E' }), [P('hold', 'E', 'slash'), P('hold', 'E', 'none')]);
  assert.strictEqual(r.state.units[1].hp, 100 - 38);
});
T('parry from the front blocks and grants energy', () => {
  const r = resolveTurn(S({ x: 5, y: 10, facing: 'E' }, { x: 6, y: 10, facing: 'W' }), [P('hold', 'E', 'slash'), P('hold', 'W', 'parry')]);
  assert.strictEqual(r.state.units[1].hp, 100);
  assert.strictEqual(r.state.units[1].energy, 1);
});
T('parry does not cover the side', () => {
  const r = resolveTurn(S({ x: 5, y: 10, facing: 'E' }, { x: 6, y: 10, facing: 'N' }), [P('hold', 'E', 'slash'), P('hold', 'N', 'parry')]);
  assert.strictEqual(r.state.units[1].hp, 75);
});
T('dodge: target moved away', () => {
  const r = resolveTurn(S({ x: 5, y: 10, facing: 'E' }, { x: 6, y: 10, facing: 'N' }), [P('hold', 'E', 'slash'), P('move', 'S', 'none')]);
  assert.strictEqual(r.state.units[1].hp, 100);
});
T('pivot then slash hits an adjacent foe', () => {
  const r = resolveTurn(S({ x: 5, y: 10, facing: 'N' }, { x: 6, y: 10, facing: 'N' }), [P('pivot', 'E', 'slash'), P('hold', 'N', 'none')]);
  assert.strictEqual(r.state.units[1].hp, 75);
});
T('charged slash: full energy x1.5 and empties bar', () => {
  const r = resolveTurn(S({ x: 5, y: 10, facing: 'E', energy: 3 }, { x: 6, y: 10, facing: 'N' }), [P('hold', 'E', 'slash'), P('hold', 'N', 'none')]);
  assert.strictEqual(r.state.units[1].hp, 100 - 38);
  assert.strictEqual(r.state.units[0].energy, 0);
});
T('face-to-face slash vs slash → clash, no damage yet', () => {
  const r = resolveTurn(S({ x: 5, y: 10, facing: 'E' }, { x: 6, y: 10, facing: 'W' }), [P('hold', 'E', 'slash'), P('hold', 'W', 'slash')]);
  assert.ok(r.clash);
  assert.strictEqual(r.state.units[0].hp + r.state.units[1].hp, 200);
});
T('clash win: loser takes 25 and is stunned next turn', () => {
  const s = S({ x: 5, y: 10, facing: 'E' }, { x: 6, y: 10, facing: 'W' });
  const c = resolveClash(s, ['parry', 'thrust']);
  assert.strictEqual(c.state.units[1].hp, 75);
  assert.strictEqual(c.state.units[1].stunned, 1);
  const n = resolveTurn(c.state, [P('hold', 'E', 'slash'), P('pivot', 'S', 'parry')]);
  assert.strictEqual(n.state.units[1].hp, 50, 'stunned unit cannot parry');
  assert.strictEqual(n.state.units[1].facing, 'W', 'stunned unit cannot pivot');
  assert.strictEqual(n.state.units[1].stunned, 0);
});
T('mirror clash knocks both back', () => {
  const c = resolveClash(S({ x: 5, y: 10, facing: 'E' }, { x: 6, y: 10, facing: 'W' }), ['feint', 'feint']);
  assert.deepStrictEqual([c.state.units[0].x, c.state.units[1].x], [4, 7]);
});
T('KO and simultaneous KO → draw', () => {
  let r = resolveTurn(S({ x: 5, y: 10, facing: 'E' }, { x: 6, y: 10, facing: 'N', hp: 20 }), [P('hold', 'E', 'slash'), P('hold', 'N', 'none')]);
  assert.strictEqual(r.state.over, 'p1');
});

// CPU vs CPU soak: every match must end, and plans must always be legal.
let turns = [], outcomes = { p1: 0, cpu: 0, draw: 0, timeout: 0 };
for (let m = 0; m < 500; m++) {
  let s = newState(), t = 0;
  while (!s.over && t < 200) {
    const r = resolveTurn(s, [cpuPlan(s, 0), cpuPlan(s, 1)]);
    s = r.state;
    if (r.clash) s = resolveClash(s, [cpuClashPick(null), cpuClashPick(null)]).state;
    for (const u of s.units) assert.ok(isWalkable(u.x, u.y), 'unit on non-walkable cell');
    assert.ok(!(s.units[0].x === s.units[1].x && s.units[0].y === s.units[1].y), 'units overlap');
    t++;
  }
  if (!s.over) outcomes.timeout++; else outcomes[s.over]++;
  turns.push(t);
}
turns.sort((a, b) => a - b);
console.log('soak 500 matches:', JSON.stringify(outcomes), 'turns median', turns[250], 'p90', turns[450], 'max', turns[499]);
