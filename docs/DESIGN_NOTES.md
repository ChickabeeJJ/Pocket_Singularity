# Pocket Singularity — design notes

What was built against the game bible, why, and what is still unproven.

The bible mentions a `pocket_singularity.html` prototype as a reference. It was not in the upload or the repository, so the game was built from scratch to the bible's rules (palette, layout, controls, milestones A–D).

## The engagement plan

The aim was more time played, more players coming back, and a fast first minute, without dark patterns. The bible bans streak loss, decaying universes, fake urgency, loot boxes, forced waiting and guilt copy. Those also tend to hurt the Basic Launch metrics they claim to improve, so none of them are used. Everything below makes the pulse more satisfying or the next goal more compelling.

### First 60 seconds (conversion)
- No title screen. The universe is live on the first frame, and a breathing hint says how to pulse.
- The first pulse always catches something. Six fragments are seeded inside the starting reach (tested across 50 random seeds), so the first click usually lands a 5+ chain and unlocks a discovery.
- Each discovery pops a toast with a permanent **+3% Matter**. The first few come within seconds.
- The first comet arrives at about 45 s. Catching it triggers a ×3 **Surge** for 20 s, and the gold range ellipse plus "Comet in range — pulse now!" teach the timing.
- First upgrade at about 18–36 s, depending on play style. Its card glows the first time it becomes affordable, and the milestone bar shows progress toward it before the first purchase.

### First 10–15 minutes (session length)
Times are from the simulator with an active player (`npm run sim`):

| Moment | Time | Bible target |
|---|---|---|
| First upgrade | 0:18–0:36 | 30–60 s |
| First automation (Orbital Drones) | 1:30–1:45 | 1–3 min |
| Sector 2 Shattered Belt (unstable shards appear) | ~4:55 | 3–6 min |
| Sector 3 Frozen Moon | ~8:15 | — |
| Sector 4 Nebula Engine, Collapse unlocks (≈3 ✦) | ~11:25 | "after a substantial run" |
| Sector 5 Star Nursery | ~15:40 | — |

- The goal is always visible. The milestone bar shows the first upgrade, then the next sector (log-scaled so it keeps moving).
- Each sector changes the palette, the fragment mix and the ambient scene (asteroid belt, a frozen moon, nebula filaments, young stars with diffraction spikes), and adds a ×1.5 value step. Sectors past five continue as *Dust Cloud II*, *III*… with hue-shifted art, so a run never hits a ceiling.
- The core visibly evolves: more disk rings, polar jets, a gold inner ring and a violet halo as lifetime Matter grows.
- Comets return every 70–140 s, which keeps players watching even late in a run.
- Unstable shards burst when swallowed and drag their neighbours into the same chain. That makes for big surprise chains.

### Coming back (Day 1 retention)
- **Collapse / Stardust.** Each ✦ adds +25% Matter forever. The first Collapse makes run 2 reach the same point in about 5 minutes instead of 12, which the simulator confirmed. The confirmation screen lists exactly what resets and what stays.
- **Stardust research.** Four nodes unlock automatically at lifetime Stardust thresholds, so Stardust is never a second shop currency: Echo Pulse (the core pulses by itself), Comet Lure, Deep Memory (better away income, start with drones), Horizon Anchor (keep reach and density through Collapse). The first Collapse usually unlocks Echo Pulse straight away, which delivers the bible's "new speed of play".
- **Daily Cosmic Mutation.** One deterministic, always-positive modifier per day, never the same two days running. It is a fresh twist, not a login requirement, and nothing is lost when it changes.
- **Discovery Atlas.** Sixteen distinct entries, each a permanent +3%. Locked entries show their description, so players know what to chase (Avalanche: 25 in one pulse; Golden Hour: a crystal during a Surge…).
- **Away income.** Drones keep working at 50% speed (80% with Deep Memory), capped at 2 hours, and the Welcome back screen shows the gain. The time is consumed before it is paid, so a refresh never pays twice, and a clock moved backwards pays nothing.

### Idle play
Drones, Echo Pulse and away income give a real passive loop, which justifies the secondary **Idle** tag.

## Systems summary

| Upgrade | Effect | Base cost | Growth | Max |
|---|---|---:|---:|---:|
| Wider Event Horizon | pulse reach 46% → 100% of the field | 20 | ×1.55 | 12 |
| Matter Density | inflow 1.35/s ×1.12 per level, cap +2 | 22 | ×1.48 | 20 |
| Orbital Drones | +0.5 × value per drone per second, doubles every 25 | 45 | ×1.16 | 100 |
| Resonance | chain bonus +8% → +75% per extra fragment | 60 | ×1.62 | 15 |
| Pulse Focus | all value ×1.32 per level | 120 | ×1.9 | 40 |

| Fragment | Look | Value | Notes |
|---|---|---:|---|
| Dust | small blue dot | 1 | common |
| Ice | cyan dot with a white edge | 1.35 | |
| Star crystal | gold diamond with a glow | 2.5 | rare, bell sound |
| Unstable shard | coral hexagon, flickers | 1.8 | bursts and pulls neighbours into the chain; from sector 2 |

Chain payout = Σ fragment value × value multiplier × (1 + chain step × (n − 1)). Each fragment pays its base value as it lands; the chain bonus pays when the last one lands, shown as `+X` and `CHAIN ×n · ×m`.

Stardust = ⌊∛(run Matter / 36 000)⌋, available from sector 4. Waiting longer pays more, and the UI says there is no rush.

## Feel and presentation
- The pulse ring expands from the core, which is always the gravity well (no aiming needed). A dashed ellipse shows the current reach, brighter when a pulse is ready and gold when a comet is inside.
- Caught fragments spiral in with trails, the core gulps, sparks fly off the rim, and pitch climbs a pentatonic scale through a chain, so long chains sound musical rather than grating. Big chains (8+) add a small screen shake, which reduced-motion mode turns off.
- A click that arrives up to 0.16 s before the cooldown ends is queued rather than dropped.
- All sound is synthesized through a compressor, and there is one mute toggle (also `M`). The platform's mute setting is respected.
- Reduced motion follows the OS setting by default and can be toggled in Settings. It removes shake, cuts particles and slows motion.

## Technical notes
- One authoritative `state` object; `js/core.js` is the only place rules live. The renderer reads state and consumes an event list (`capture`, `payout`, `sector`, `discover`, …).
- Saves are a versioned JSON object written after purchases, Collapse, discoveries, every 5 s, on tab hide and on page hide. A backup is kept every 60 s. Damaged saves are stored aside, and the game restores the backup or starts fresh with a notice. Every field is validated and clamped: the sector is re-derived from progress, Matter is capped at lifetime Matter, and levels at their max.
- Bounded pools: at most 260 particles and 28 floating texts, fragments capped by Density, and no per-frame DOM rebuilding (text is written only when it changes).
- The production build is one inlined `index.html`: 124 KB, or 35 KB zipped, with no external assets.

## Verification done
- `npm test`: 15 rule tests (costs, bulk buy, max levels, save sanitising, Collapse exactly once, away cap and negative time, mutation determinism, first pulse always catches, cooldown buffering, payout maths, long-run stability, pacing targets).
- `npm run qa` and `npm run qa:dist`: 24 browser checks in headless Chromium, passing on both the source files and the production build. They cover first input, Space/button/tap, purchases that never pulse, keys 1–5, MAX state, buy-Max, refresh persistence, all sector transitions, comet → Surge, Collapse via double-click (granted once), the away-income cap paid once across refreshes, a clock moved backwards, corrupt-save recovery, mute and reduced-motion persistence, the Atlas, bounded object counts, 1920×1080, resize, phone portrait and phone landscape, and no console errors.
- A 75-second real-time session in Chromium with human-like clicking, plus screenshots at every sector, modal and viewport.

## Not verified / risks
- **No human playtests yet.** Run the bible's five unbriefed testers. The `?debug` timings in Settings record when each milestone happened.
- **The CrazyGames SDK is untested.** The sandbox could not reach `sdk.crazygames.com`. All calls are guarded, but check `gameplayStart`/`Stop`, the data module and the rewarded ad in the CrazyGames QA tool.
- **Audio was not heard.** The sound was checked for errors but not listened to, so tune the volume and the 500-repetition plink fatigue by ear.
- **Real devices.** Touch was tested only in Chromium's mobile emulation. Check iOS Safari (the hue-rotate for sectors 6+ is ignored there, which is harmless) and a mid-range Android phone.
- **Late-game balance** past roughly an hour, or 5+ Collapses, has only been simulated, not played.
