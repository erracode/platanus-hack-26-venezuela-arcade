# ROADMAP — Mecha Simultactics: Catatumbo Protocol

> Companion to `SPEC.md`. **SPEC = the _what_** (rules, map, architecture).
> **This file = the _how / when_** (scope, attacks, phases, milestones).
> Everything stays **lean**: target is a **< 50 KB**, **0-asset**, **Phaser 3** game for
> Platanus Hack 26. When in doubt, cut features — not polish on the core loop.

---

## 0. North star

- Reproduce the **feel** of the reference *Mecha Simultactics* (CLOBBER / RJ Arcade), reduced to a
  **1v1 duel vs CPU** on our Lake Maracaibo map.
- Core fantasy, in order: **program → simultaneous resolve → sword clash → Catatumbo lightning.**
- If the core loop (move + pivot + slash + parry + clash) is not fun by itself, no amount of extra
  mechanics saves it. Ship the loop first.

---

## 1. Reference game → our scope (mechanic mapping)

Observed in the reference (trailer + screenshots):

- **Two-level radial menu** around the unit: `Movement` / `Combat` / `Special` → each opens a sub-ring.
  - Movement: `Move`, `Strafe`, `Pivot`, `Jump`.
  - Combat: `Slash`, `Lunge`, `Parry`, `Block`, `Barrage`, `Charge Shot`, `Launch Missile`.
- **Facing matters** (`Pivot`, `Strafe` only make sense with a direction).
- **Energy pips** under each action = cost (`Barrage` 1, `Charge Shot` 2, `Missile` 3).
- **Melee clash prompt** `THRUST` / `PARRY` / `FEINT` when two mechs collide in melee.
- **Red threat tiles** preview the attack area; floating damage numbers.
- **HUD** per unit: HP (e.g. 82/160), energy bar, status (`Stunned`, `KnockBack`), planned action.

| Reference | Keep? | Our simplified version |
|-----------|:-----:|------------------------|
| Simultaneous-turn resolution | ✅ CORE | Both sides lock, resolve in parallel tweens (< 3 s) |
| Two-level radial menu | ✅ CORE | `Movement` + `Combat` rings in MVP; `Special` ring is STRETCH |
| Facing + `Pivot` | ✅ CORE | 4 facings (grid N/E/S/W); `Pivot` turns in place |
| `Move` | ✅ CORE | 1 tile, 4-dir; facing follows the step |
| `Strafe` / `Jump` | ❌ OUT | — |
| `Slash` | ✅ CORE | Melee hit on the **front** cell |
| `Parry` | ✅ CORE | Blocks a `Slash` coming **from the front** only |
| Melee clash (Thrust / Parry / Feint) | ✅ CORE | Face-to-face `Slash` vs `Slash` → RPS sub-menu (§6) |
| Red threat tiles + damage numbers | ✅ CORE | Procedural red rhombi + floating text |
| Status `Stunned` | ✅ CORE | Loser of a clash skips next turn |
| Energy pips | 🔸 MVP meter, STRETCH spenders | `ENERGY` 0–3 shown in HUD; spent by stretch specials |
| `Lunge` (momentum + knockback) | 🔸 STRETCH | Dash 2 straight + slash; knockback 1 |
| `Block`, `Barrage`, `Missile` | ❌ OUT | — |
| `Charge Shot` | 🔸 STRETCH | Our `RANGED`: straight line, blocked by palafitos |
| Vent (repair while pushing) | 🔸 STRETCH | `VENT` = heal self + push adjacent enemy 1 tile |
| 8-player online PvP | ❌ OUT | Local **1v1 vs CPU** |
| Replay Studio, mech customization, map editor | ❌ OUT | — |
| Pixel-art sprites, buildings, lava, elevation | ❌ OUT | 0 assets → neon vector `Graphics`, flat lake |

---

## 2. Scope tiers

**MVP — must ship (the loop must be fun):**
1. Isometric lake map rendered procedurally.
2. One mecha per side (P1 cyan vs CPU magenta), each with a visible **facing**.
3. Turn loop: program **1 movement** (`MOVE` / `PIVOT` / hold) + **1 combat** (`SLASH` / `PARRY` /
   none), hidden ghost, simultaneous resolve.
4. Two-level radial menu (`Movement`, `Combat`) driven by **joystick + buttons** (`SPEC.md` §1.1).
5. Red **threat tiles** for your planned `SLASH`; floating damage numbers.
6. **Sword clash** with `THRUST / PARRY / FEINT` sub-action (§6).
7. Deterministic resolution (§5).
8. Simple CPU AI (moves, pivots, slashes, parries).
9. HUD: HP, `ENERGY` pips, status (`Stunned`), turn timer, win/lose.
10. Catatumbo lightning VFX + procedural SFX.
11. `game.js` passes `npm run check-restrictions` (≤ 50 KB); `metadata.json` (`single_player`) +
    `cover.png` 800×600; submitted.

**STRETCH — only if MVP is locked and time remains (in this order):**
1. `Special` ring + `LUNGE` (first `ENERGY` spender) + `KnockBack` status.
2. Zone events: Catatumbo strike, verdín slowdown, oil refuel (see §7).
3. `RANGED` (charge shot) — line, blocked by palafitos.
4. `VENT` (self-repair + push).
5. CPU difficulty ramp (win streak → smarter CPU, saved via `platanusArcadeStorage`).

**OUT of scope (do NOT build):**
- Local 2P (shared screen leaks hidden plans), online multiplayer / netcode, mouse/touch input, replay editor, map editor, mech loadouts,
  multiple maps, 3D, elevation, `Strafe`, `Jump`, `Block`, `Barrage`, `Missile`.

---

## 3. Action set (v2 — one action per turn, speed order)

Redesigned on 2026-10-10 after the first playtest ("I didn't understand the game"): the reference
game uses **one action per turn** with **speed**, which is easier to read than move+act slots.

Each turn both sides secretly pick **one** action. Faster actions resolve first; a unit that is hit
**before** its own action resolves **loses that action** ("LOST"). Equal speeds resolve together.

| Ring | Action | SPD | Target | Effect |
|------|--------|:---:|--------|--------|
| Movement | `MOVE` | 100 | tile ≤ 2 steps | Walk; facing = last step. Walking the full 2 tiles grants **MOMENTUM** for next turn. |
| Movement | `DODGE` | 220 | tile 1 step | Hop, **keeps facing**. Escapes anything slower. |
| Movement | `PIVOT` | 250 | direction | Turn in place. |
| Combat | `SLASH` | 150 | direction | **34** dmg to the front tile; ×1.5 from behind. |
| Combat | `LUNGE` | 200 | direction | **Needs MOMENTUM.** Dash ≤ 2 tiles straight, then stab: 25 dmg, **×2 on a flank**. |
| Combat | `PARRY` | 170 | direction | Stance for the rest of the turn: blocks strikes from the front, +1 GUTS. |
| Combat | `GRAB` | 120 | direction | Catch (10 dmg, **ignores parry**) → the grabber picks a **THROW** direction: 15 dmg, +10 if slammed into land. |

Turning to strike/parry/grab (direction ≠ current facing) costs **−40 SPD**.

**Melee triangle:** `SLASH > GRAB > PARRY > SLASH`; `DODGE` escapes anything slower.
**Sword clash:** both mechs strike *at each other* (`SLASH`/`LUNGE`, after dashes) with speeds within
**40** of each other → clash RPS (§6). Otherwise the faster strike lands and cancels the slower one.
**GUTS (0–3):** +1 per landed melee hit, parry or throw. Full GUTS unlocks **BURST** in a clash.

Out (kept simple on purpose): Strafe, Jump, Teleport, Block, H/V-Slash, Jab, Overdrive, Stagger, missiles.

---

## 4. Meters & statuses (all tunable in the CONSTANTS section of `game.js`)

| Meter | Range | Purpose |
|-------|:-----:|---------|
| `HP` | 0–100 | Death at 0. `SLASH` 34 (×1.5 behind), `GRAB` 20. Three clean slashes KO. |
| `ENERGY` | 0–3 | Shown as pips. Gain: successful `PARRY` (+1), oil tile (stretch). Spend: full bar → next `SLASH` charged ×1.5 (MVP); specials (stretch). |
| `FACING` | N/E/S/W | Drawn as a chevron on the mecha + on the ghost. |

| Status | Source | Effect |
|--------|--------|--------|
| `Stunned` | Losing a clash | Next turn both slots are forced to *hold / none* (cannot parry → vulnerable). |
| `KnockBack` | `LUNGE` hit, mirror clash | Pushed 1 tile away from the attacker (blocked by void/palafito/unit → stay). |

---

## 5. Resolution order (MUST be deterministic)

1. Stunned units are forced to `WAIT`.
2. Compute SPD per side (−40 if a strike/parry must turn). Higher SPD group first; ties = one group.
3. Per group: facing for directional actions → movement (path stops before the other mech; equal
   final tiles or a swap → nobody moves) → parry stances → slashes (face-to-face equal-speed slashes →
   clash, stop) → grabs. A hit on a unit whose group has not resolved yet cancels its action.
4. Stop early on a KO; simultaneous KO → draw. Clear stuns, advance turn.

Implemented in `resolveTurn` (pure); every branch has a test in `tools/test-rules.cjs`.

---

## 6. Clash sub-rules (rock-paper-scissors)

Triggered by mutual strikes within the clash window (§3). Both secretly pick (short timer, default = random):

| Pick | Beats | Loses to |
|------|-------|----------|
| `BURST` (full GUTS, spends them) | `THRUST`, `FEINT` | `PARRY` |
| `PARRY` | `THRUST`, `BURST` | `FEINT` |
| `FEINT` | `PARRY` | `THRUST` |
| `THRUST` | `FEINT` | `PARRY` |

- **Winner** deals 34 damage; **loser is `Stunned`** (forced `WAIT`) next turn. A winning BURST also knocks the loser back.
- **Mirror picks** → no damage, both `KnockBack` 1 tile. Big Catatumbo lightning flash.
- CPU picks with a light weighting (e.g. counter the player's last clash pick) so it feels alive.

---

## 7. Zone events (see `SPEC.md` §2.2 — idea parking lot)

Only after MVP is locked. Data-driven: `{ tile, trigger, chance, effect }`.

| Zone | Idea | Tier |
|------|------|------|
| `4` Catatumbo | `P%` lightning strike → extra dmg / stun | STRETCH |
| `6` Verdín (duckweed) | `P%` the move fails / you slip | STRETCH |
| `7` Oil slick | refuel `+1 ENERGY` | STRETCH |

All VFX procedural. No new art. Real-world basis: duckweed infestation + oil region (verified).

---

## 8. Phases (≈ 52 focused hours, any order across days)

| # | Phase | Deliverable | Acceptance | h |
|---|-------|-------------|------------|:-:|
| P0 | **Setup** | Fork cloned, `npm install`, starter `game.js` replaced by our section skeleton, docs moved in, agent junk dirs excluded via `.git/info/exclude` | `npm run dev` shows our empty scene; `check-restrictions` passes | 2 |
| P1 | **Isometric engine + map** | RENDER: projection + `LAGO_MAP`; joystick↔direction mapping decided | Lake silhouette reads correctly at 800×600; stick directions feel intuitive | 6 |
| P2 | **Mecha + UI** | Mecha with facing chevron, joystick-driven two-level radial, ghost, threat tiles, HUD | Program Move/Pivot + Slash/Parry with stick + buttons only; ghost and red tiles preview it | 6 |
| P3 | **Turn loop + resolution** | RULES `resolveTurn` (pure) + controllers + parallel-tween playback, steps 1–5 of §5 | Every §5 branch (blocked, same-cell, swap, dodge, back-hit, parry) behaves as written | 8 |
| P4 | **Combat + clash** | Clash sub-menu (RPS), damage numbers, `Stunned` | A clash plays out; loser skips a turn; mirror knocks both back | 6 |
| P5 | **CPU AI** | Simple weighted AI | CPU moves, pivots, flanks, parries; beatable but not passive | 4 |
| P6 | **Juice** | Catatumbo lightning VFX, procedural SFX, screen shake, hitstop | Clash feels punchy; lightning reads | 6 |
| P7 | **Special ring** *(stretch #1)* | `LUNGE` + `KnockBack`, energy spending | Lunge usable; energy pips drain/refill | 4 |
| P8 | **Zone events + more specials** *(stretch)* | Catatumbo / verdín / oil; `RANGED`, `VENT`; CPU difficulty ramp | Each fires with feedback | 4 |
| P9 | **Ship** | `check-restrictions`, `cover.png`, `metadata.json`, playtest with keyboard as cabinet, submit | ≤ 50 KB; submitted with buffer | 6 |

**Cut order if behind:** P8 → P7 → P5 (make CPU trivial) → P6 polish (keep only one VFX + one SFX).
**Ship 1P first:** P9 can run right after P6 (submit an MVP early), then resubmit with P7/P8.

---

## 8.1 Status (2026-10-10, after v2 turn redesign)

| Phase | State | Notes |
|-------|-------|-------|
| P0 | ✅ done | Fork wired in place, skeleton, checks pass |
| P1 | ✅ done | Traced 14×20 lake, wireframe board, stick mapping validated by user |
| P2 | 🟡 v2 built, needs visual review | Two-column action menu + info panel (SPD + description), aim step with reachable tiles / attack tile / arrows, ghost, ✓ when locked, HP bar + tag under each mech |
| P3 | ✅ rules tested | `resolveTurn` pure; `node tools/test-rules.cjs` covers every §5 branch |
| P4 | 🟡 built, needs visual review | Clash prompt (B1/B2/B3), RPS, stun, mirror knockback |
| P5 | ✅ soak-tested | v2 rules: 500/500 finish, ~50/50, median ~21 turns; `tools/smoke-scene.cjs` plays a full match headless |
| P6 | 🟡 v2 pass | Step-by-step resolution: order banner, action label per mech, blade sweep, parry shield, MISS / LOST / BLOCKED, damage numbers, shake, bolt |
| Attract | 🟡 built | CPU vs CPU demo + rotating title / 3 how-to-play cards; START or B1 starts |
| P7–P8 | ⬜ not started | |
| P9 | 🟡 cover done | `cover.png` generated by `python tools/make-cover.py` (reads `LAGO_MAP` from `game.js`); submission pending |

**CPU behaviour (P5):** never reads the player's plan. Adjacent → pivot+slash, parry, or sidestep.
Two apart in a line → zone (slash the middle cell), step in, flank, or parry. Diagonal → wait or zone
one entry cell. Otherwise approach, slashing if the step lands it facing the foe. Without the
line/diagonal rules CPU-vs-CPU stalemated 100% of the time (mutual bumps / orbiting).

## 9. Size & perf budget

- **Hard cap:** `game.js` ≤ 50 KB after the template's minification. Phaser is provided by the
  platform (not counted). Soft cap 40 KB before P9.
- Measure with `npm run check-restrictions` after **every** phase.
- No images/audio/fonts ever. All visuals = `Graphics`; all sound = Web Audio.
- Target 60 fps; resolve anims kept short (fast simultaneous turns are the point).

---

## 10. Milestones (calendar — today is 2026-10-09)

| Date | Milestone |
|------|-----------|
| Oct 09–10 | P0–P1: fork set up, lake map on screen |
| Oct 11–13 | P2–P3: mecha, joystick radial UI, simultaneous resolution |
| Oct 14–16 | P4–P5: clash + CPU |
| Oct 17 | P6 + first submission of the 1P MVP |
| Oct 18–19 | P7–P8: (stretch) specials & zone events |
| Oct 20 | P9: final size check, playtest, resubmit |
| **Oct 21** | **Deadline 23:59 America/Caracas** — submit with buffer |

---

## 11. Definition of Done

- A stranger at the cabinet can understand the controls (joystick + buttons only), play a full
  match vs CPU, and win/lose — with no console errors.
- `npm run check-restrictions` passes; `metadata.json` + `cover.png` valid; game submitted.
- `SPEC.md` + this `ROADMAP.md` reflect the shipped reality (no stale docs).
- Restart works (no leaked listeners/timers between matches).

---

## 12. Open decisions (resolve before the phase that needs them)

1. ~~Hackathon rules~~ — **RESOLVED** (`SPEC.md` §1): single `game.js`, joystick cabinet, no mouse.
2. ~~JS vs TS~~ — **RESOLVED**: plain JS.
3. ~~1P vs 2P~~ — **RESOLVED**: `single_player` only; local 2P out of scope.
4. ~~Projection + joystick mapping~~ — **RESOLVED**: iso, 45° stick rotation + arrows (`SPEC.md` §1.1).
5. ~~Grid size~~ — **RESOLVED**: 14×20 board (land slab + lake traced from the real outline), 44×22 tiles.
6. ~~ENERGY MVP use~~ — **DECIDED, pending review**: charged slash (`SPEC.md` §8.7).
