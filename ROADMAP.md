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

## 3. Action set

A turn = **one Movement slot + one Combat slot**. Movement resolves before combat (§5).

| Ring | Action | Cost | Effect | Tier |
|------|--------|:----:|--------|------|
| Movement | `MOVE` | — | Step **1** tile (N/E/S/W). Facing becomes the step direction. | MVP |
| Movement | `PIVOT` | — | Turn to any facing without moving. | MVP |
| Movement | *(hold)* | — | Stay; keep facing. | MVP |
| Combat | `SLASH` | — | Hit the **front** cell (after movement). 25 dmg; **+50%** if it hits the target's **back**. | MVP |
| Combat | `PARRY` | — | Negates a `SLASH` coming from your **front** cell; on success **+1 ENERGY**. Does nothing vs side/back hits. | MVP |
| Clash | `THRUST`/`PARRY`/`FEINT` | — | Only on face-to-face `SLASH` vs `SLASH` (§6). | MVP |
| Special | `LUNGE` | 1 | Dash up to **2** tiles straight, then `SLASH`; on hit **knockback 1**. | STRETCH |
| Special | `RANGED` | 2 | Shot along facing line; blocked by palafitos / void. | STRETCH |
| Special | `VENT` | 1 | Repair **+15 HP** and push adjacent enemy **1** tile. | STRETCH |

> **Naming:** the base attack is `SLASH`; `THRUST` exists **only** as a clash sub-action. Never mix them.
>
> **Why facing fixes `PARRY`:** parry only covers the front, so it is not a free safe pick — the
> opponent can flank (step to your side and slash, or pivot-and-slash from behind).

---

## 4. Meters & statuses (all tunable in `constants.js`)

| Meter | Range | Purpose |
|-------|:-----:|---------|
| `HP` | 0–100 | Death at 0. `SLASH` 25 (×1.5 from behind). |
| `ENERGY` | 0–3 | Shown as pips. Gain: successful `PARRY` (+1), oil tile (stretch). Spend: specials (stretch). |
| `FACING` | N/E/S/W | Drawn as a chevron on the mecha + on the ghost. |

| Status | Source | Effect |
|--------|--------|--------|
| `Stunned` | Losing a clash | Next turn both slots are forced to *hold / none* (cannot parry → vulnerable). |
| `KnockBack` | `LUNGE` hit, mirror clash | Pushed 1 tile away from the attacker (blocked by void/palafito/unit → stay). |

---

## 5. Resolution order (MUST be deterministic)

Resolve in this fixed order every turn:

1. **Self-effects** (`VENT`, stretch).
2. **Facing**: apply `PIVOT`, and set facing from `MOVE` direction (even if the move is blocked).
3. **Movement** (`MOVE` / `LUNGE` dash) to destination cells:
   - Destination not walkable → stay.
   - Both to the **same** cell → both stay.
   - **Swap** (A→B's cell and B→A's cell) → both stay.
4. **Clash check**: both chose `SLASH` **and** each stands in the other's front cell (face-to-face,
   adjacent) → clash (§6). Skip step 5 for both.
5. **Slashes**: each `SLASH` targets the attacker's front cell **after movement**. If the enemy is there:
   - Enemy `PARRY` and attacker is in enemy's front cell → blocked, parrier +1 ENERGY.
   - Attacker is in enemy's back cell → 25 × 1.5.
   - Otherwise → 25.
   Moving away from the threatened cell is a valid dodge.
6. **Tile effects** (Catatumbo / verdín / oil, §7 — stretch).
7. **Win/lose** (simultaneous KO → draw); decrement statuses; advance turn.

---

## 6. Clash sub-rules (rock-paper-scissors)

Triggered by face-to-face `SLASH` vs `SLASH`. Both secretly pick (short timer, default = random):

| Pick | Beats | Loses to |
|------|-------|----------|
| `PARRY` | `THRUST` | `FEINT` |
| `FEINT` | `PARRY` | `THRUST` |
| `THRUST` | `FEINT` | `PARRY` |

- **Winner** deals 25 damage; **loser is `Stunned`** for 1 turn.
- **Mirror picks** → no damage, both `KnockBack` 1 tile. Big Catatumbo lightning flash.
- CPU picks with a light weighting (e.g. counter the player's last clash pick) so it feels alive.

---

## 7. Zone events (see `SPEC.md` §2.2 — idea parking lot)

Only after MVP is locked. Data-driven: `{ tile, trigger, chance, effect }`.

| Zone | Idea | Tier |
|------|------|------|
| `4` Catatumbo | `P%` lightning strike → extra dmg / stun | STRETCH |
| `5` Verdín (duckweed) | `P%` the move fails / you slip | STRETCH |
| `6` Oil slick | refuel `+1 ENERGY` | STRETCH |

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
4. **Projection + joystick mapping (P1)** — iso skews the lake and puts grid directions on screen
   diagonals; decide top-down vs iso together with how the stick maps to N/E/S/W.
5. **Grid size** — confirm 9×11 in P1 (fits 800×600).
