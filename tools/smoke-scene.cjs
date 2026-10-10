// Headless smoke test for the scene layer: fake Phaser, simulated clock and cabinet keys.
// Catches runtime errors (undefined refs, bad calls) in create/update/match flow.
// Run: node tools/smoke-scene.cjs
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'game.js'), 'utf8');
let now = 0;
const timers = [];
const listeners = {};
const chain = new Proxy(function () {}, { get: () => chain, apply: () => chain });

function gfx() {
  return new Proxy({}, { get: () => () => undefined });
}
function text() {
  const t = { text: '', y: 0 };
  for (const k of ['setOrigin', 'setDepth', 'setVisible', 'setPosition', 'setColor', 'setY', 'destroy']) t[k] = () => t;
  t.setText = (v) => ((t.text = v), t);
  return t;
}

let sceneDef = null;
class Game {
  constructor(cfg) {
    sceneDef = cfg.scene;
  }
}
const scene = {
  add: { graphics: gfx, text: () => text() },
  events: { once() {} },
  time: {
    get now() {
      return now;
    },
    delayedCall: (ms, fn) => timers.push({ at: now + ms, fn }),
  },
  tweens: { add: (cfg) => timers.push({ at: now + (cfg.duration || 0) * (cfg.yoyo ? 2 : 1) + (cfg.delay || 0), fn: () => cfg.onComplete && cfg.onComplete() }) },
  cameras: { main: { shake() {} } },
  sound: {},
};
const ctx = {
  console, Math, JSON, Object, Promise, Map, Set, setTimeout,
  window: { addEventListener: (k, fn) => (listeners[k] = fn), removeEventListener() {} },
  Phaser: { AUTO: 0, Scale: { FIT: 0, CENTER_BOTH: 0 }, Game },
};
vm.createContext(ctx);
vm.runInContext(src, ctx);

const press = (key) => {
  listeners.keydown({ key });
  listeners.keyup({ key });
};
async function tick(ms) {
  now += ms;
  for (const t of timers.splice(0).sort((a, b) => a.at - b.at)) {
    if (t.at <= now) t.fn();
    else timers.push(t);
  }
  await new Promise((r) => setImmediate(r));
  sceneDef.update.call(scene, now, ms);
}

(async () => {
  sceneDef.create.call(scene);
  for (let i = 0; i < 300; i++) await tick(16); // attract mode a few seconds
  const keys = ['w', 'a', 's', 'd'];
  const seen = new Set();
  let finished = 0;
  for (let m = 0; m < 30; m++) {
    press('Enter'); // start a match
    for (let i = 0; i < 20000 && scene.phase !== 'over'; i++) {
      seen.add(scene.phase);
      if (scene.phase === 'choose') {
        const [a, b] = scene.state.units;
        if (Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1 && Math.random() < 0.5) {
          scene.menuPos = { col: 1, row: 3 }; // force GRAB to exercise the throw prompt
          scene.sel.act = 'grab';
        } else {
          for (let k = Math.floor(Math.random() * 5); k > 0; k--) press(keys[Math.floor(Math.random() * 4)]);
        }
        press('u'); // B1 select
      } else if (scene.phase === 'aim') {
        press(keys[Math.floor(Math.random() * 4)]);
        press(Math.random() < 0.1 ? 'i' : 'u'); // sometimes back, mostly confirm
      } else if (scene.phase === 'clash') {
        press(['u', 'i', 'o', 'j'][Math.floor(Math.random() * 4)]);
      } else if (scene.phase === 'throw') {
        press(keys[Math.floor(Math.random() * 4)]);
        press('u');
      }
      await tick(50);
    }
    if (scene.phase === 'over') finished++;
    for (let i = 0; i < 80; i++) await tick(50); // wait out the game-over lockout
  }
  console.log('matches finished:', finished, '/ 30   phases seen:', [...seen].sort().join(' '));
})().catch((e) => {
  console.error('SMOKE FAIL', e);
  process.exitCode = 1;
});
