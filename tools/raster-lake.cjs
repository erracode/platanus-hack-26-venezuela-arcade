// v2: piecewise vertical mapping (gulf+strait compressed, lake body gets most rows) + scenery water.
const COLS = +process.argv[2] || 14, ROWS = +process.argv[3] || 20;
const [X0, XW] = (process.argv[4] || '62,104').split(',').map(Number);
// image-y → row, piecewise linear (control points [imgY, row]).
const CP = JSON.parse(process.argv[5] || '[[30,0],[80,1.5],[132,4],[280,20]]');
function rowOf(y) {
  for (let i = 1; i < CP.length; i++) {
    const [y0, r0] = CP[i - 1], [y1, r1] = CP[i];
    if (y <= y1 || i === CP.length - 1) return r0 + ((y - y0) * (r1 - r0)) / (y1 - y0);
  }
}
const P = (x, y) => [((x - X0) / XW) * COLS, rowOf(y)];
const GULF = [[105,0],[220,0],[220,40],[175,55],[145,68],[124,80],[100,80],[100,40]].map(([x,y])=>P(x,y));
const LAKE = [[100,72],[98,95],[95,118],[92,138],[82,158],[75,183],[73,205],[80,228],[92,246],[103,262],[114,272],[124,272],[134,262],[145,246],[155,228],[151,204],[142,180],[131,160],[121,140],[120,118],[121,95],[124,72]].map(([x,y])=>P(x,y));
function inside(poly, u, v) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > v) !== (yj > v) && u < ((xj - xi) * (v - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
const bridgeRow = Math.floor(rowOf(+process.argv[6] || 128));
const m = [];
for (let y = 0; y < ROWS; y++) {
  const row = [];
  for (let x = 0; x < COLS; x++) {
    const wet = inside(GULF, x + 0.5, y + 0.5) || inside(LAKE, x + 0.5, y + 0.5);
    row.push(!wet ? 1 : y < bridgeRow ? 5 : y === bridgeRow ? 2 : 0);
  }
  m.push(row);
}
const walk = (t) => t === 0 || t === 2 || t === 4;
let start = null, total = 0;
m.forEach((r, y) => r.forEach((t, x) => { if (walk(t)) { total++; start ??= [x, y]; } }));
const seen = new Set([start + '']), q = [start];
while (q.length) { const [x, y] = q.pop(); for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) { const nx = x + dx, ny = y + dy; if (m[ny] && walk(m[ny][nx]) && !seen.has(nx + ',' + ny)) { seen.add(nx + ',' + ny); q.push([nx, ny]); } } }
const ch = { 0: '~', 1: '.', 2: '=', 3: 'H', 4: '*', 5: '-' };
console.log(m.map((r, i) => r.map((t) => ch[t]).join(' ') + '  ' + i).join('\n'));
console.log(`walkable ${total}, connected ${seen.size}, bridgeRow ${bridgeRow}`);
console.log(JSON.stringify(m));
