# Mecha Simultactics: Catatumbo Protocol — Build Spec

> **Portable brief.** Keep this at the repo root next to the template's `AGENTS.md` (do **not**
> overwrite that file — it carries the official rules), or paste it as the first message to any
> AI model. It contains everything needed to continue the project with **zero prior context**.

---

## 0. One-paragraph brief

Build a **2.5D isometric, simultaneous-turn tactics game** in **Phaser 3.87**, fully procedural
(no image/audio files), written as a **single vanilla `game.js` ≤ 50 KB minified** for the
**Platanus Hack 26 "Arcade Challenge"**, played on a **physical arcade cabinet (joystick + buttons,
no mouse)**. One mecha unit per side (P1 cyan, CPU magenta). Each turn both sides secretly
program a Move + Action; actions resolve **simultaneously** with sword-clashes and a "Catatumbo
lightning" visual effect over a neon re-imagining of Lake Maracaibo.
**Mode:** `single_player` only (vs CPU). Local 2P is **out of scope**: on a shared screen each
player sees the other's programmed plan, which breaks the simultaneous hidden-information core.

---

## 1. Hackathon rules (HARD — verified against the official template)

Source: official starter repo `platanus-hack/platanus-hack-26-venezuela-arcade` (our fork:
`erracode/platanus-hack-26-venezuela-arcade`). Its `AGENTS.md` / `README.md` are the authority;
this table is a summary.

| Rule | Detail |
|------|--------|
| Library | **Phaser 3 v3.87.0**, loaded by the platform via CDN — **not** counted in the size limit |
| Code | **One file: `game.js`**. Pure vanilla JS — **no `import` / `require`**, no build step of ours |
| Size | **≤ 50 KB after minification** (before gzip). Check with `npm run check-restrictions` |
| Network | No `fetch` / `XMLHttpRequest`; no `http://`, `https://` **or `//` anywhere in strings** (except `data:` URIs) |
| Sandbox | Runs in an iframe without internet. Canvas **800×600**, `parent: 'game-root'` |
| Assets | Allowed: `Graphics`, generated audio, base64 `data:` URIs. Our choice: **0 embedded assets** |
| Editable files | **Only** `game.js`, `metadata.json`, `cover.png`. Do not touch `index.html`, `vite.config.ts`, `package.json` |
| Dev server | The **user** runs `npm run dev` (port 3001). Agents must not start it |
| Input | Physical cabinet — see **§1.1**. **No mouse, no touch** |
| Storage | `window.platanusArcadeStorage.get/set/remove` (optional, e.g. win streak) |
| Submission | `metadata.json` (`game_name`, `description`, `player_mode`) + `cover.png` **exactly 800×600, ≤ 500 KB** → Submit in the dev UI |
| Deadline | **21 Oct 2026, 23:59 (UTC−4, Caracas)**. Popular vote until 23 Oct |
| Prizes | $150 USDC + hackathon slot + cabinet feature — Best Game and Most Popular |

### 1.1 Cabinet controls

The cabinet sends fixed key codes. **Never modify `CABINET_KEYS`** in `game.js`; only *append*
local testing keys. Game logic reads arcade codes (`P1_U`, `P1_1`, …), never raw keys.

| Code | P1 (local key) | P2 (local key) |
|------|----------------|----------------|
| Joystick | `P1_U/D/L/R` (W/S/A/D) | `P2_U/D/L/R` (arrows) |
| Top buttons | `P1_1/2/3` (U/I/O) | `P2_1/2/3` (R/T/Y) |
| Bottom buttons | `P1_4/5/6` (J/K/L) | `P2_4/5/6` (F/G/H) |
| Start | `START1` (Enter) | `START2` (2) |

**Our mapping (keep it to joystick + top row, per the organizers' tip):**

| Planning step | Joystick | `_1` | `_2` | `_3` | `_4` |
|---------------|----------|------|------|------|------|
| 1. Movement ring | pick direction (ghost previews it; see stick ↔ grid below) | `MOVE` there | `PIVOT` to face it | *hold* | — |
| 2. Combat ring | — | `SLASH` (locks turn) | `PARRY` (locks turn) | none (locks turn) | back to step 1 |
| Clash prompt | — | `THRUST` | `PARRY` | `FEINT` | — |
| Menus / game over | navigate | confirm | — | — | — |

`START1` starts / restarts a match.

**Stick ↔ grid (decided, iso board):** projection `screenX = (x + y)`, `screenY = (y − x)` puts
grid **N = up-left** (strait/bridge at the back-left), **E = up-right** (palafitos), **S = down-right**,
**W = down-left**; the lake body faces the viewer. The stick is rotated 45° clockwise on screen:
`P1_U` → up-right (grid E) · `P1_R` → down-right (S) · `P1_D` → down-left (W) · `P1_L` → up-left (N).
During the Movement step the 4 neighbour cells show ↑ → ↓ ← arrow glyphs so the player sees
exactly where each stick direction goes.

**Turn timing:** programming window `TURN_MS` (default 15 s, constant). On timeout, whatever is
selected so far is locked; anything unselected defaults to *hold* / *none*. Clash window
`CLASH_MS` (default 4 s); timeout → random pick. The CPU plans from the **state only** — it never
reads the player's plan.

---

## 2. Game design

- **Working name:** *Mecha Simultactics: Catatumbo Protocol*
- **Genre:** simultaneous-turn tactics, 2.5D isometric
- **Setting:** neon/futuristic over the **Lago de Maracaibo**
- **Board:** the playable grid **is the silhouette of the Lake** (oval + northern strait); outside
  the lake is void. See **§2.1 Lake Maracaibo map** for the exact matrix, tile codes and
  walkability. Board is **14×20** (land slab with the lake carved in — see §2.1).
- **Units:** one mecha per side. P1 = `#00FFFF` (cyan); CPU = `#FF0055` (magenta).
  Start: P1 at `(7, 15)` facing N (south of the lake, nearer the viewer); CPU at `(6, 8)`
  facing S (north of the lake). Both water cells, 8 steps apart.
- **Field:** the bridge row and the lake south of it. Gulf + strait are scenery.
- **Facing:** every mecha faces N/E/S/W (grid directions). Facing decides what `SLASH` hits and
  what `PARRY` covers.
- **Turn loop:**
  1. Both sides *secretly* program **1 movement** (`MOVE` / `PIVOT` / hold) + **1 combat**
     (`SLASH` / `PARRY` / none) via a **two-level radial menu** (`Movement`, `Combat`).
  2. **Ghost projection** — a semi-transparent clone previews your planned cell + facing; **red
     threat tiles** show the cell your `SLASH` will hit.
  3. Timer expires / both lock → **simultaneous resolution** via parallel Phaser `tweens`.
- **Actions:** `MOVE`, `PIVOT`, `SLASH`, `PARRY` — **MVP** set. Full action list, meters, statuses
  and the deterministic resolution order are in **`ROADMAP.md` §3–§6** (source of truth).

### Combat resolution table

| A vs B | Outcome |
|--------|---------|
| `SLASH` vs `SLASH`, face-to-face adjacent | **Clash** → RPS sub-menu `THRUST`/`PARRY`/`FEINT`; winner deals 25, loser `Stunned`; mirror → both knocked back + Catatumbo lightning |
| `SLASH` into enemy's **front** while enemy `PARRY` | Blocked, 0 dmg; parrier +1 `ENERGY` |
| `SLASH` into enemy's **back** | 25 × 1.5 dmg (parry does not cover the back) |
| `SLASH` into enemy's side / non-parrying front | 25 dmg |
| `SLASH` at a cell the enemy left | Miss (dodge) |
| `MOVE` vs `MOVE` | Same destination → both stay; swap → both stay; non-walkable → stay |

### 2.1 Lake Maracaibo map (procedural, ~0 KB)

The board **is the lake**: the board is a rectangular **land slab** (green wire grid, not walkable) with
the **Zulia layout** carved into it: Gulf of Venezuela across the north, a long narrow strait, the
bridge at the strait's south end, and a kite-shaped lake body (narrow north, widest to the south,
pointed south tip) shifted east, with most land to the west. One integer per tile keeps the whole map **well under 1 KB**.

Tile codes:

| Code | Tile | Walkable | Notes |
|------|------|:--------:|-------|
| `0` | Lake water | ✅ | the playable body; base isometric diamond |
| `1` | Land | ❌ | flat green wire tiles; the board's front faces are an extruded slab (§3.1) |
| `2` | Puente Gral. Rafael Urdaneta | ✅ | spans the northern strait; MVP: plain walkable (buff = stretch idea) |
| `3` | Palafito / pilote (stilt) | ❌ | MVP: obstacle; stretch: blocks `RANGED` line-of-sight; east coast |
| `4` | Catatumbo zone | ✅ | SW river mouth; MVP: plain walkable + yellow flicker; strikes = stretch |
| `5` | Scenery water | ❌ | Gulf + strait north of the bridge: drawn dim, **not part of the field** |

```javascript
// 0 water · 1 land · 2 bridge · 3 palafito · 4 Catatumbo · 5 scenery water (not walkable)
// 14 wide × 20 tall, north at the top (drawn top-left). Traced from the real lake outline with the
// gulf + strait compressed into scenery; the field is the bridge and everything south of it.
// Plain script: no `export` (game.js is not a module). 114 walkable cells, all connected.
const LAGO_MAP = [
  [1, 1, 1, 1, 1, 5, 5, 5, 5, 5, 5, 5, 5, 5], //  0  Gulf of Venezuela (scenery)
  [1, 1, 1, 1, 1, 5, 5, 5, 5, 5, 5, 5, 5, 5],
  [1, 1, 1, 1, 1, 5, 5, 5, 1, 1, 1, 1, 1, 1], //  2  strait (scenery)
  [1, 1, 1, 1, 1, 5, 5, 5, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1], //  4  bridge = north edge of the field
  [1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1],
  [1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1],
  [1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1], //  8  lake body
  [1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1],
  [1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1],
  [1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1],
  [1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 1, 1], // 12  east coast palafito
  [1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1],
  [1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 1, 1],
  [1, 1, 1, 4, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1], // 15  SW Catatumbo mouth
  [1, 1, 1, 4, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1],
  [1, 1, 1, 1, 4, 0, 0, 0, 0, 0, 0, 1, 1, 1],
  [1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 1, 1, 1, 1], // 18  rounded south tip
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
];
```

Rendering of each code follows the art direction in **§3.1** (wireframe). The map is static and
drawn **once**; only `4` (Catatumbo flicker) animates, on the FX layer. **No images.**

> **Feature placement (verified against sources):** oval body with a narrow **north** strait; the
> **bridge** spans that strait (top); the **Catatumbo** river mouth + lightning sit on the
> **southwest**; **palafitos** line the **east** coast.

> **Size (decided):** **14×20 board, TW×TH = 44×22** (≈ 748 px wide) — fills 800×600 with room
> for HUD; 114 walkable tiles.

> **Projection (decided): isometric**, north (strait + bridge) at the **top-left**, lake body toward
> the viewer (matches the approved concept sketch). Joystick mapping in §1.1 compensates.

### 2.2 Zone events — idea parking lot (NOT committed)

> **Purpose:** brainstorm dump. Nothing here is locked. Pick **only** what fits the time budget and
> the 50 KB limit. All effects must be **data-driven** (`{ tile, trigger, chance, effect }`) and use
> **procedural VFX only** — no new art.

**Proposed extra tile codes (reserved):** `6` = verdín / duckweed patch, `7` = oil slick.

| Tile / zone | Trigger | Idea (RNG) | Status |
|-------------|---------|-----------|--------|
| `4` Catatumbo | end your move/action on it | `P%` chance a lightning bolt strikes → extra dmg or stun | idea |
| `2` Puente | move onto | +DEF **or** +SPD | spec'd |
| `3` Palafito | line-of-sight through it | blocks shots (cover) | spec'd |
| `6` Verdín (duckweed) | start/end move on it | `P%` the move **fails** / you slip 1 cell / lose the turn | idea |
| `7` Oil slick | stand on it | **refuel** → +1 energy / extra action charge | idea |

**More ideas (loose):**
- **Storm cycle:** every N turns the Catatumbo "fires" as a *global* event (flashes all across the
  map), not just per-tile.
- **Safe cover:** palafitos / the bridge are safe from Catatumbo strikes.
- **Currents:** on certain turns, water pushes every unit 1 cell in a fixed direction.
- **Risk/reward bait:** the strongest buff (oil) sits in the most dangerous zone (Catatumbo's
  neighbour) so players gamble.

> **Real-world basis (verified):** the lake is genuinely **infested with duckweed** ("green swirls
> seen from space") → thematic fit for the verdín hazard; the Maracaibo basin is one of the world's
> richest **oil-producing** regions → thematic fit for the fuel/energy tile.

---

## 3. Visual & audio technique (everything is code)

- **Graphics only:** `Phaser.GameObjects.Graphics` → `fillRect`, `fillCircle`, `fillTriangle`,
  `fillPoints`, `lineBetween`, `strokePath`, `fillPath`, `slice` (radial menu), `arc`.
- **Isometric projection:**
  `screenX = (x + y) * (TILE_W / 2)`, `screenY = (y - x) * (TILE_H / 2)`
  (no inverse needed — there is no mouse; selection is joystick-driven).
- **Joystick ↔ iso directions:** fixed 45° rotation, see §1.1.
- **Audio:** Web Audio API only — `OscillatorNode` (square/pulse for 8-bit timbre), `GainNode`
  ADSR envelopes, white noise via `AudioBuffer` + `Math.random()` for clashes and shots.
- **Signature VFX:** "Relámpago del Catatumbo" — a canvas lightning bolt on critical clashes.
- **Reference UI language (from the original game):** hexagonal-edged neon label boxes around a ring
  for the radial menu; red angular wedges for the clash prompt; red translucent rhombi for threat
  tiles; floating damage numbers; corner HUD panel with HP, energy pips and status text.

### 3.1 Art direction — vector wireframe (Operius / Battlezone) + Persona 5 slabs

- **Background:** near-black `#05060A` with a few wide, slow-moving darker diagonal bands (Operius).
- **Lines first:** world geometry is stroked (`lineStyle(1.5–2)`), no opaque fills. Exceptions:
  units get a faint body fill (alpha ≈ 0.15) so they pop over the grid; threat tiles and UI
  slabs may fill.
- **Palette:** P1 cyan `#00FFFF` · CPU/P2 magenta `#FF0055` · coast/land/bridge phosphor green
  `#00FF88` · Catatumbo/impacts yellow `#FFFF00` · UI white `#FFFFFF` on black.
- **Map:** one rectangular board; its two front edges are extruded as a green slab. Land (`1`) =
  flat green wire rhombi; water = cyan wire rhombi; a bright green **shoreline** is drawn on every
  lake/land edge. Bridge (`2`) = white cable-stayed A-towers + double deck + cables (Rafael Urdaneta
  is cable-stayed). Palafitos (`3`) = small wire huts on stilts. Catatumbo (`4`) = yellow flicker.
- **Mechas:** angular wire silhouette (diamond head, trapezoid torso, shoulder blocks, legs) +
  a bright **facing chevron** on the base tile — facing must read at a glance.
- **Ghost:** same mecha at alpha ≈ 0.35. **Threat tiles:** blinking red rhombi.
- **Menus & radial:** Persona-5-style **slanted slabs** (parallelograms via `fillPoints` +
  `strokePoints`). Idle = black fill + white outline + white text; selected = white fill +
  black text + slight scale pop. Radial = slabs fanned around the unit (not a full ring).
- **Typography:** custom **5×5 block pixel font** drawn with `fillRect` (glyphs encoded as 25-bit
  integers, ~0.5 KB) with a 1-step drop shadow, Operius-style. This avoids depending on fonts
  installed on the cabinet PC. Fallback: `Text` with `'Arial Black', Impact, sans-serif`.
- **Main menu = attract mode:** no separate menu scene. The live lake grid runs **CPU vs CPU**
  behind slanted title/menu slabs (`CATATUMBO PROTOCOL`, `PRESS START`).
  `START1` tweens the slabs out and hands P1 to the human controller.
- **HUD:** top-left P1 / top-right CPU: name, segmented HP bar, energy pips, status; bottom:
  phase label (`PROGRAM` / `RESOLVE` / `CLASH!`) + button hints. No "score" — it's a duel.
- **Graphics layers (perf):** `gMap` drawn **once** (static), `gUnits` + `gFx` redrawn per frame,
  `gUi` redrawn on state change. Never redraw the static map every frame.

---

## 4. Architecture

Everything lives in **one `game.js`** (rule). Modules become clearly delimited **sections**, in
this order:

```
game.js
  // == CONSTANTS ==   all numbers, colors, timings, LAGO_MAP (no magic numbers below)
  // == INPUT ==       CABINET_KEYS (untouched) + held/pressed edge detection
  // == RULES ==       pure functions, NO Phaser: resolveTurn(state, planP1, planP2) -> events[]
  // == CONTROLLERS == humanController('P1'), cpuController(state)
  // == RENDER ==      iso projection, map, mecha, ghost, threat tiles, HUD, radial, clash prompt
  // == AUDIO ==       Web Audio synth (oscillators + noise)
  // == SCENE ==       Phaser config + create/update; plays events[] as tweens
```

**Rules**
- **RULES section is pure** (plain data in → events out, no Phaser, no randomness except a passed
  RNG). The scene only *animates* the returned events. This keeps resolution deterministic and
  testable by hand in the console.
- **Controllers are interchangeable**: a side is driven by `{ plan(state) }`. Single player =
  `human('P1')` vs `cpu()`. Attract mode (main menu) = `cpu()` vs `cpu()` — same rules/render.
- Every magic number/color lives in the CONSTANTS section.
- Remove listeners/timers between matches (restart-safe).
- Never write `//` inside a string literal (fails the URL check).

> **Note on the `phaser` skill's "mandatory" conventions:** keep the *principles* (central state,
> constants file, event bus, scene cleanup), but stay **lean** — every extra abstraction costs
> bytes against the 50 KB cap. **Ignore the skill's asset pipeline, texture atlases, Preloader
> scene, and the Play.fun safe-zone code entirely** (Play.fun is a different platform; Platanus
> does not use it). Use the skill's `no-asset-design.md` for procedural visuals.

---

## 5. Build & size budget

- No build step of ours: the template's dev UI (`@platanus/arcade-dev-ui-26`) minifies and checks.
- Measure with `npm run check-restrictions` after **every** phase. Soft budget: **≤ 40 KB** minified
  before P9, leaving 10 KB of headroom for polish.
- Phaser is the global `Phaser` provided by the platform — never bundled, never imported.

---

## 6. Roadmap (~52 h)

> Full scope, action set, phase breakdown, milestones and Definition of Done live in
> **`ROADMAP.md`**. Summary below.

1. **Setup + isometric engine** — land slab + carved lake (`LAGO_MAP`, 14×20), shoreline, bridge, palafitos, `toIso`.
2. **Vector mecha + UI** — `drawMecha()` with facing, two-level radial menu, ghost + threat tiles.
3. **Simultaneous turns + combat** — basic CPU AI, parallel-tween resolution, clash, combat table.
4. **Effects + audio + HUD** — Catatumbo lightning, procedural SFX, HP bars, turn timer.
5. **Optimize + ship** — `check-restrictions`, cover.png, metadata, submit before deadline.
6. **Stretch** — specials ring (`LUNGE`, `RANGED`, `VENT`) and zone events.

---

## 7. Recommended AI skills

Installed globally for opencode at `~/.config/opencode/skills/` (other tools may not see them):

| Skill | Use it for |
|-------|-----------|
| `phaser` | Core Phaser 3 patterns *(judgment: skip its asset/Play.fun parts)* |
| `game-architecture` | Structuring systems, state, event bus |
| `quick-game` | Fast no-asset prototype scaffold — ideal for phase 1 |
| `add-feature` | Adding a specific mechanic |
| `design-game` | Juice, particles, screen-feel polish |
| `game-audio` | Procedural Web Audio SFX / music |
| `game-deploy` | Publishing the build |
| `review-game` | Read-only architecture/perf audit |
| `improve-game` | Find + implement highest-impact improvements |

Additionally, 60 skills are installed **locally in this folder** (`.agents/skills/`,
`.claude/skills/` — git-excluded, so a fresh clone won't have them) from
`phaserjs/phaser`, `gamedev-skills/awesome-gamedev-agent-skills` and `heygen-com/hyperframes`.

> ⚠️ **Version caveat (important):** all of those skill packages target **Phaser 4**, but this
> project is **Phaser 3**. Use them for **concepts only** (patterns, feel, structure) — their code
> samples may reference v4-only APIs (render nodes, filters, Camera matrix, etc.) that do **not**
> exist in v3. The `v3-to-v4-migration` skill is handy *in reverse*: it lists exactly which APIs are
> v4-only, so you know what to avoid. When unsure, trust the Phaser 3 docs, not the skill snippet.

Any tool that does not share these skills can still work from this document alone.

---

## 8. Open risks & decisions

1. ~~Hackathon rules~~ — **RESOLVED** (§1): single `game.js`, Phaser via CDN, joystick cabinet.
2. ~~JS vs TS~~ — **RESOLVED**: plain JS (no build step allowed).
3. ~~Joystick ↔ iso mapping~~ — **RESOLVED**: iso board, 45° rotation + arrow glyphs (§1.1).
4. **Simultaneous-resolution edge cases** — decided in `ROADMAP.md` §5 (same-cell, swap,
   non-walkable, dodge, back-hit, parry, clash). Implement exactly as written.
5. ~~Two-player~~ — **OUT OF SCOPE**: shared screen leaks each player's plan. If ever revisited,
   the only viable approach is *blind chord input* (stick + button in one press, screen shows only
   `LOCKED ✓`); the controller architecture keeps that door open at no cost.
6. **Fit 800×600** — 14×20 iso with 44×22 tiles ≈ 748×374 px + slab: fits with room for HUD.
7. **ENERGY has no MVP spender** — parry grants energy but nothing in the MVP spends it until
   `LUNGE` (stretch). Decide before P4 whether energy gets an MVP use or the pips wait for P7.
