# POCKET SINGULARITY
## Master Game Bible for Claude Code
**Version 1.0 · Genre: Clicker / Idle / Incremental · Target: CrazyGames**

> **North star:** Make one tiny universe feel unbelievably satisfying to operate. Do not build a large game. Build one excellent action, a constant stream of visible payoff, and progression that makes the player curious about the next five minutes.

## 0. Read this first

The folder includes `pocket_singularity.html`, a playable, dependency-free browser prototype. Treat it as the visual and mechanical reference. Preserve its best parts, test it, and improve it in controlled milestones. Do not throw it away and replace it with a generic clicker template.

This is intentionally a *small* idea that does not need hand-painted art, elaborate character animation, or a large asset pipeline. The visual identity comes from carefully composed space, orbital motion, crisp geometric objects, a dark palette, tight motion timing, and restrained glow.

## 1. Genre decision and launch strategy

**Primary genre:** Clicker / Incremental. Secondary tag: Idle, if the finished game's passive-production loop is substantial enough to justify it.

Do not mislabel the game to chase a supposedly easier scoring category. The launch cohort has to match what the game actually does; a category mismatch can cause players to leave before they understand the game.

CrazyGames does not publish a definitive chart of the lowest per-genre score threshold for Full Launch. The Basic Launch decision uses comparative engagement data, and public reports show that a score around 9/15 is not a guaranteed pass. Treat genre choice as a development-risk decision, not a loophole.

Our production target is to **beat our own first-play, session-length, and return-session goals**, with 11+/15 as an internal aspiration rather than a promise of approval. Current official guidance discusses 10+ minutes average playtime, 10–15% Day 1 retention, and 80%+ conversion to at least one minute as useful benchmarks, not universal pass thresholds.

Reference links to recheck before submission:
- https://docs.crazygames.com/resources/basic-launch-metrics/
- https://docs.crazygames.com/requirements/intro/
- https://docs.crazygames.com/requirements/gameplay/

## 2. One-sentence pitch

**Pocket Singularity** is an incremental game where every click sends a beautiful gravity pulse through a miniature universe, swallowing drifting cosmic fragments and helping a tiny black hole grow into a universe-eating machine.

## 3. The hook

The player does not click a flat number button. They trigger a physical-looking pulse that bends orbiting fragments into a black hole. Capturing several fragments in one pulse creates a chain bonus. The core grows, its accretion ring changes, the field gets denser, and new cosmic sectors appear as progress increases.

The emotional beat is: **pulse → pull → swallow → satisfying payout → buy an upgrade → see the universe change → do it again.**

The first pulse should be understandable without a tutorial screen. The first successful pulse must produce a visible result immediately.

## 4. Core loop

1. Cosmic fragments drift around the core.
2. The player clicks/taps the playfield or the large `PULSE GRAVITY` control.
3. A ring expands; fragments in range bend inward and disappear into the core.
4. Each fragment grants Matter. Multiple fragments captured in a single pulse create an increasing chain bonus.
5. The player spends Matter on upgrades.
6. Upgrades improve the pulse, increase the fragment supply, improve chain rewards, or automate Matter collection.
7. Run progress unlocks new colour palettes and cosmic object types.
8. Eventually, the player may perform an optional Collapse reset to earn permanent Stardust.

No lives. No energy meter. No long cooldowns. No waiting for an animation to finish before the next useful input. No punishments for making a small mistake.

## 5. Controls

- Mouse click in the universe: trigger gravity pulse.
- Touch tap in the universe: trigger gravity pulse.
- Large pulse button: alternate, obvious control for players who do not infer canvas interaction.
- Spacebar: trigger a pulse on desktop.
- Escape: close modal dialogs.

The pulse has a short anti-spam cooldown (roughly 0.36 seconds in the prototype). Do not raise it without playtest evidence. Avoid requiring precision aiming: the center of the universe is the consistent gravity well.

## 6. Objects and rewards

Only four fragment classes in the first version:

| Type | Look | Relative reward | Job |
|---|---|---:|---|
| Dust | Small muted-blue dot | 1× | Common, satisfying steady income |
| Ice | Cyan dot with a fine edge | ~1.35× | A little more valuable and easy to recognize |
| Star crystal | Gold diamond | ~2.5× | Rare visual treat and a discovery moment |
| Unstable shard | Coral hexagon | ~1.8× | Introduce after the player has learned the basic loop; feels volatile, but never destroys progress |

Use both colour and shape; colour alone cannot communicate object type. Avoid adding dozens of object types just to inflate the collection. Each new type must be immediately legible and have a gameplay purpose.

## 7. Upgrade system

Use **Matter** as the only normal currency. Stardust is a separate permanent-reset reward, not a second routine shop currency.

The first five upgrades are the full MVP upgrade set:

1. **Wider Event Horizon** — expands pulse radius.
2. **Matter Density** — increases the frequency of fragments entering the field.
3. **Orbital Drones** — creates passive Matter income while the game is open.
4. **Resonance** — improves multi-fragment chain rewards.
5. **Pulse Focus** — increases the overall reward from captures.

Rules:
- Each upgrade has one understandable effect and a visible next-level cost.
- Prices rise predictably; never create a surprise 100× price wall.
- A purchase immediately updates its effect and gives clear feedback.
- Max levels must be visible; do not show a button that looks purchasable when it is not.
- Buying an upgrade must not trigger a pulse accidentally.
- One source of truth calculates prices, costs, levels, and effects.
- Balance the first 10 minutes before adding any additional upgrade categories.

Starting price and growth values in the prototype are tuning values, not sacred constants. Use player testing and simple telemetry to make them better.

## 8. Run progression and sector reveals

Each sector changes the palette, ambient details, fragment mix, and the feeling of space. Keep the layout and controls the same so the player gets novelty without relearning the game.

Initial planned sectors:
1. Dust Cloud — muted blue/cyan.
2. Shattered Belt — colder blue/violet.
3. Frozen Moon — brighter icy cyan.
4. Nebula Engine — violet/magenta accents.
5. Star Nursery — warm gold accents.

A sector change must visibly alter the universe in at least three ways: palette, fragment variety, and ambient/background treatment. A text label changing by itself is not enough.

Sector thresholds in the prototype are provisional. Adjust them to reach the following *experience targets* rather than arbitrary grind:
- first upgrade: ideally within 30–60 seconds;
- first automation: roughly 1–3 minutes;
- first sector reveal: roughly 3–6 minutes;
- first major progression decision: within 5 minutes;
- first optional Collapse: after a substantial first run, not immediately.

These are design goals to test, not guarantees of retention.

## 9. Prestige: Collapse

At a substantial run milestone, offer the player an optional Collapse. It resets run Matter and normal upgrade levels, awarding permanent Stardust based on run progress. Stardust grants a modest production multiplier, making the next run faster.

Rules:
- Never force the player to Collapse.
- Explain exactly what resets and what stays before the confirmation.
- Show the proposed reward before confirmation.
- Make the first Collapse feel like a choice that unlocks a new speed of play, not a punishment.
- Do not require prestige to complete the first 10 minutes.
- Prevent malformed saves or repeated clicks from granting unearned Stardust.

## 10. Retention design: reasons to return

Do not bolt on daily rewards as a substitute for fun. Return hooks must extend the core loop.

### MVP return hooks
- **Auto-save:** upgrades and run state survive refreshes.
- **Visible next milestone:** always show the next upgrade, sector, or Collapse target.
- **Collection discoveries:** record the first time a player captures each rare fragment or anomaly.
- **New sector reveals:** new colours and fragment patterns are visible rewards.
- **Offline income:** optional, capped at two hours and paid at a reduced rate; it should help but never replace playing. Clamp elapsed time and handle system-clock changes safely.

### Post-MVP return hooks — add only after playtesting
- **Daily Cosmic Mutation:** one deterministic modifier each day, such as “Ice fragments are worth more” or “Pulses reach further.” It should be a fresh challenge, not a mandatory login.
- **A small discovery atlas:** 12–20 genuinely distinct cosmic discoveries with short, skippable descriptions.
- **Permanent research nodes:** three or four meaningful branches unlocked by Stardust.
- **Milestone variants:** visual evolutions of the core at notable progression levels.

Do not add streak loss, a decaying universe, fake urgency, fake countdowns, loot boxes, forced waiting, login walls, or guilt-based copy. Players should want to come back, not fear leaving.

## 11. Visual design bible

### Style

**Minimalist cosmic vector art**, not pixel art and not AI-painterly art. The deliberate restriction is a strength: geometric forms, orbital rings, glowing fragments, high contrast, and clean type can look professional without an asset farm.

### Fixed palette

- Background: `#080B16`
- Secondary background: `#10162A`
- Elevated card: `#131C34`
- Divider: `#27314D`
- Primary text: `#F0F4FF`
- Secondary text: `#8D9ABA`
- Core/cyan accent: `#6CE8FF`
- Prestige/violet accent: `#A78BFA`
- Rare/gold accent: `#FFD783`
- Unstable/coral accent: `#FF8B98`
- Success/passive income: `#83F0C0`

Do not invent extra accent colours for individual buttons. Sector hues may shift the space background and particles while the UI palette stays consistent.

### Art rules
- Use CSS and Canvas for simple vector geometry; no external art required for the MVP.
- Use only a few glow sources: the core, active pulse, and rare fragments.
- Starfield must be subtle enough that text and particles remain readable.
- The core should be the visual focal point, with fragments readable at normal browser size.
- No default emoji for final UI icons. Use simple geometric symbols or custom inline SVG.
- Avoid excessive glassmorphism, random gradients, thick outlines on every card, and glowing text everywhere.
- Use a restrained motion curve and 120–420 ms motion for most interactions.
- Include a reduced-motion mode and mute control.

## 12. Screen layout and UI

Target desktop non-fullscreen size: **907 × 510**. Test that size first, plus a 16:9 fullscreen viewport and a narrow mobile viewport.

### Desktop layout
- Header: small emblem + game title on the left; sound and reset/settings controls on the right.
- Main column (~64% width): top stats, universe canvas, gravity pulse button, and milestone progress.
- Side column (~36% width): five upgrade cards, one short anomaly/collection hint, and Collapse panel.
- Keep the core and at least several fragments visible without scrolling.

### UI rules
- Keep the main action obvious on the first screen.
- Show one main currency and one passive-income rate.
- Upgrade cards share one layout and have consistent hover, active, disabled, and max states.
- Every number uses tabular figures where possible.
- Never reduce font size just to squeeze a new feature in.
- No title screen, account/sign-up flow, or long tutorial before the first pulse.
- If the viewport is narrow, stack the panels and retain the playfield before the shop. No overlapping controls.
- Do not allow the pulse control to be obscured by mobile browser bars or the shop panel.

## 13. Audio

Use short synthesized or properly licensed sound effects:
- soft low-frequency thump for the gravity pulse;
- crisp, quiet plink for each capture;
- brighter short tone for a rare crystal;
- gentle ascending chord for an upgrade or sector reveal;
- low, restrained swell for Collapse.

The capture sound should not become painful after 500 repetitions. Add one mute toggle. Never download unlicensed music or random sound packs. The prototype may use Web Audio synthesis to avoid asset weight.

## 14. Technical scope

### MVP technology

The included prototype is a self-contained HTML + Canvas + JavaScript file and intentionally has no dependencies. Keep the first public test this simple unless an existing project already has a stable Phaser foundation. A Phaser migration is not a feature by itself.

### Technical rules
- No backend, account, multiplayer, API keys, or third-party ad network.
- Core gameplay must work offline after the game loads.
- Store local progress in a versioned save object.
- Save after purchases, Collapse, and periodically during play.
- Validate saved values; recover gracefully from corrupted state.
- Cap offline progress and reject negative or infinite values.
- Do not award rewards twice after a refresh.
- Keep the render loop separate from game rules as the code is refactored.
- Use one authoritative `state` object; do not maintain duplicate currency copies in the UI.
- The game must remain responsive on mid-range devices and avoid unbounded arrays or per-frame DOM rebuilding.

### CrazyGames integration

During Basic Launch, prioritize the game loop and platform QA; the SDK is optional and monetization is disabled. When invited to Full Launch, integrate the required CrazyGames SDK and use its supported ad/save/settings APIs. Do not add external ads. Always recheck the current official integration docs before submission.

## 15. Production milestones

### Milestone A — Fun in 60 seconds
Deliver only:
- pulse interaction;
- drifting fragments;
- capture rewards;
- chain bonus;
- five upgrade cards;
- auto-save;
- responsive layout;
- sound toggle.

Exit condition: a new player can play immediately, understands the loop within seconds, and voluntarily continues for several minutes in an observed playtest.

### Milestone B — First progression arc
Add:
- five visually distinct sectors;
- clear milestone pacing;
- rare-fragment discovery;
- balanced passive income;
- capped offline income;
- optional Collapse and Stardust.

Exit condition: a tester sees multiple visible changes, understands prestige without help, and does not hit a dead economy.

### Milestone C — Retention content
Only after Milestones A and B are enjoyable:
- daily Cosmic Mutation;
- compact discovery atlas;
- small permanent research tree;
- additional object variants with distinct silhouettes;
- more sound and visual polish.

Exit condition: every new feature increases enjoyment or clarity; otherwise cut it.

### Milestone D — CrazyGames release prep
- verify 907×510 readability;
- test desktop and touch inputs;
- test fullscreen and resizing;
- test refresh/save/corrupted save;
- test no-audio and reduced-motion settings;
- run a production build and check console output;
- reduce load time and file size;
- prepare a readable thumbnail and cover;
- follow current CrazyGames submission requirements;
- integrate the official SDK only when appropriate for the launch stage.

## 16. KPI and playtest plan

The first session matters before any sophisticated retention feature does.

### Internal targets to test
- First valid pulse: under 5 seconds after load.
- First meaningful reward: within 5 seconds of input.
- First upgrade: target 30–60 seconds.
- First automation: target 1–3 minutes.
- Clear next goal always visible.
- A typical first session should have multiple upgrades or a sector reveal.
- Conversion to one minute should be protected by a tiny initial load and immediate gameplay.

### Ask five unbriefed testers
1. What do you think you should do without me explaining it?
2. Did the pulse feel satisfying?
3. When did you first want to buy an upgrade?
4. Was there a moment where nothing interesting happened?
5. What made you stop?

Watch them silently. Do not explain away confusion. Fix the confusion.

### Interpret metrics
- Low conversion: first screen, loading, touch interactions, or clarity are failing.
- Short average session: progression or the active pulse is not rewarding enough.
- Low Day 1 retention: no compelling long-term goal, weak saved progress, or the experience feels exhausted after one session.
- Strong playtime but weak return: add a meaningful next-run goal, not an arbitrary login reward.

No design bible can guarantee a launch score. Use Basic Launch data to diagnose the game; do not guess based on genre stereotypes.

## 17. Rules for Claude Code

1. Read the whole bible and inspect all existing files before editing.
2. Treat `pocket_singularity.html` as a working reference and keep a copy before major refactors.
3. Do not create a title screen, login, lore intro, extra currency, or new mechanic unless explicitly required here.
4. Do not rewrite the game from scratch to “clean up” a working prototype.
5. Work in small milestones and run the game after every meaningful change.
6. When art direction is ambiguous, follow the fixed palette, geometry, spacing, and layout above. Do not invent a second style.
7. Never claim a test passed unless it was run. Report any limitation honestly.
8. After a code change, verify the affected interactions, saves, and responsive layout.
9. Do not add daily systems until the core pulse loop is proven fun.
10. Prefer a polished five-upgrade prototype over a sprawling unbalanced economy.

## 18. Claude prompts — use in this order

### Prompt 1 — Audit and stabilize

> Read `POCKET_SINGULARITY_GAME_BIBLE.md` in full and inspect `pocket_singularity.html` and all existing project files. Do not start by rewriting anything. First identify the current architecture, what works, bugs, and gaps against Milestone A. Then fix only the highest-impact problems in the existing build. Preserve the core loop and exact visual direction. Test JavaScript syntax, pulse input, capture rewards, upgrade purchases, local saving, and resizing. Report what you actually tested and what remains unverified.

### Prompt 2 — Polish, don't redesign

> Improve the current Pocket Singularity build against the art and UI rules in the bible. Do not add features. Tune hierarchy, spacing, readability, contrast, object silhouettes, pulse timing, capture feedback, and upgrade states. Keep the fixed palette. Test at 907×510, widescreen fullscreen, and a narrow touch viewport. Fix clipping and overlap. Do not use generic UI kits or emoji icons. Keep the build lightweight.

### Prompt 3 — Complete the first progression arc

> Implement Milestone B only. Add five visually distinct sectors, clear progression milestones, rare-fragment discoveries, balanced passive income, capped offline income, and optional Collapse/Stardust. All balance values must be data-driven. Validate saves and ensure Collapse is confirmed, grants the correct reward exactly once, and preserves permanent Stardust. Do not add the daily system or research tree yet. Test a new save and an existing save.

### Prompt 4 — Retention content, only if the core is fun

> Implement Milestone C only after confirming Milestones A and B are stable. Add a compact daily Cosmic Mutation and a small discovery atlas; do not add login streaks, energy, timers that punish leaving, or extra currencies. Each feature must be optional and understandable without reading long instructions. Keep the first screen immediate. Test the reset boundary, date rollover, saves, and responsive layout.

### Prompt 5 — Independent QA pass

> Act as an independent QA reviewer, not the feature developer. Audit Pocket Singularity against the acceptance criteria in the bible. Test first input, capture timing, chain bonuses, costs, upgrade max levels, sector transitions, offline income cap, corrupted saves, Collapse reward calculations, repeated clicks, sound mute, reduced motion, resize, and touch. Fix reproducible high-impact bugs. Do not invent evidence or claim browser testing if it was not performed. End with a short pass/fail list and remaining risks.

## 19. Definition of done

- The game starts directly in the universe.
- A player can pulse within five seconds.
- The pulse visibly attracts and consumes fragments.
- Capturing multiple fragments gives clear bonus feedback.
- Upgrades change actual mechanics, not just labels.
- The first run offers several understandable goals.
- Sector changes are visually obvious.
- Progress survives refresh and corrupt saves fail safely.
- Desktop and touch input work.
- Controls remain legible at CrazyGames' common 907×510 desktop iframe size.
- No console errors or runaway particle/DOM growth.
- The production build is small and starts quickly.
- The game remains enjoyable before prestige, daily challenges, or any retention extras are added.

**Final rule:** If a feature makes the game harder to understand without making the pulse more satisfying or the next goal more compelling, cut it.
