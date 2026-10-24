# Pocket Singularity — design notes

What was built, why, and what is still unproven.

## Skins and crates

A **Skins** tab adds cosmetic gacha with real buffs. **Cosmic Keys** open crates and are earned only by playing:
- comets: 1
- new sectors: 1
- new forms: 2
- every 5 levels: 1
- gold and spectral trophies: 1
- Collapse: 3
- the quest bonus: 2
- login day 7: 5

New and existing players start with 3.

| Crate | Cost | Odds (C / R / E / L / M) | Pity | Skins |
|---|---|---|---|---|
| Stardust | 1 key | 60 / 28 / 10 / 2 / 0 | Legendary within 30 | Dusty, Mint Swirl, Peach Fizz · Frostbite, Ember · Candy Nebula · **Golden Hour** |
| Nebula | 4 keys | 0 / 55 / 33 / 10 / 2 | Mythic within 45 | Bubblegum, Aurora · Supernova, Deep Sea · **Prism** · ***Starforge*** |
| Event Horizon | 10 keys | 0 / 0 / 60 / 32 / 8 | Mythic within 20 | Void Walker, Solar Flare · **Quasar**, **Glitch** · ***Singularity Prime*** |

- **Unique pools:** each crate has its own skins, so every crate has different commons, rares and so on.
- **Look:** a skin recolours the halo, rim, swirl and accretion disk, and many add particles (snow, flames, hearts, bubbles, sparkles, orbiting stars, an inward void pull, a rainbow cycle, glitch flicker).
- **Buffs:** the equipped skin gives its buff (from +5% pulse value up to +100% all Matter for Singularity Prime). Every skin owned adds +1% Matter.
- **Duplicates:** they refund relic shards (2/4/8/16/40).
- **Transparency:** odds, per-skin chances and pity are always shown.

The tab bar now has seven tabs, the top-left counters are a 2×2 grid (tickets, shards, keys, Stardust) so numbers never clip, and trophies are listed bronze to spectral within each group. Eight new trophies cover crates opened and skins owned.

## Final polish before submission

- **Players name their black hole** on their first visit (it defaults to Singu, a Random button suggests names, and it can be renamed in Settings). Names are limited to 14 letters, digits, spaces and simple punctuation, and they replace "Singu" across the game text.
- **Soundtrack:** "The Quiet Between Stars", softened (treble rolled off, peaks compressed, about 13 dB quieter, fades at the loop seam). It has its own Music switch.
- **HUD:** one grid: stats top left, tap hint top centre, sector top right, and a bottom row where the buttons and the progress card share one height.
- **Effects:** screen flashes are smooth washes instead of dither dots, the pulse range is a soft ring that glows gold when a comet is inside it, the Star Reel opens centred on the black hole, and the hatch light rays fade out in a circle instead of being cut off.
- **Auto Pulse** power (20 levels).
- The store listing is in `store/LISTING.md`.
- **More polish:**
  - About 25% fewer background stars.
  - Tap a pet to see its bonus, stars and what the next star gives.
  - Press and hold an upgrade, power or harvester to read what it does; releasing after the tip appears never buys.
  - The Collapse card glows (with a one-time toast) once a Collapse is possible.
  - Trophies come in bronze, silver, gold and animated spectral tiers by difficulty within each series.
  - Comets are bigger: a glowing head, a long sparkling tail, an arrival callout, and a golden shockwave with screen shake when caught.
  - The digit 4 now uses Pixelify Sans, because Silkscreen's 4 was hard to read.

## Version 4: idle tycoon depth, new layout, relics, leaderboard

The owner found version 3 not fun ("no elements of a good tycoon idle game"), and disliked the background, capsules, pets and machine. They asked for dynamic animation, a huge number of upgrades, achievements, a relic tab with rarities and more inventive gambling, many more pets, a much better mobile UI, Muscle Titans' screen arrangement (layout only, not its style), and a CrazyGames leaderboard.

### Layout
- **Scene fills the screen; a dark tabbed panel sits on the right** (Muscle Titans' arrangement). Top left: big Matter number, `+X per pulse`, `+X /sec`, a total income multiplier chip, the combo bar, and tickets, shards and Stardust. Top centre: a *TAP OR HOLD SINGU [SPACE]* pill that turns into the comet alert. Bottom centre: the **form progression bar**, plus next-sector and Star Reel meters. Bottom left: a gold **Leaderboard** pill, round settings, sound and Atlas buttons, and the gift timer.
- **Six tabs:** Harvest, Upgrades, Pets, Relics, Rewards, Trophies. Each has an icon and a badge for what is ready (affordable harvesters, upgrade count, tickets for a hatch, shards for a forge, claimable rewards and trophies).
- **Phones (portrait):** the scene sits on top, the panel scrolls beneath, and the tabs become a fixed bottom icon bar. **Phones (landscape):** a narrower panel with icon-only tabs. The pulse button is gone: you tap or **hold** the universe (hold pulses every time the cooldown allows).

### Tycoon systems
| System | Rule |
|---|---|
| **Harvesters** | 15 tiers, from Stardust Sweeper to Big Bang Loom. Cost ×1.15 each, buy ×1, ×10, ×100 or Max. Every owned milestone (25, 50, 100, 150 … 1000) **doubles** that tier. The next tier appears once you own the previous one; one locked "???" row always teases what is next. A *Next goals* strip shows the nearest milestone, the next upgrade and the next form. |
| **Upgrades** | **260** one-time upgrades. Each tier has 10 ×2 upgrades at owned counts; there are 15 Gravity Gloves (pulse ×2 plus 1% of /sec per pulse), 30 Cosmic Catalysts (+25% all Matter), and lines for ice, crystals, blasts, comets, luck, tickets, combo, Star Reel, pet synergy and trophy synergy. They unlock from play stats and are shown cheapest first, with *Buy all affordable* and a "Next unlock: X · Own 25 Comet Nets" line. The old levelled upgrades remain as *Singu powers*, joined by **Auto Pulse** (20 levels: Singu pulses by itself every 4 s at level 1, down to about 0.6 s at level 20; auto pulses reach 85% as far, pay half the tap value and do not build combo or charge the Star Reel). |
| **Combo** | Fast manual pulses fill a combo bar that multiplies everything a pulse earns (up to ×2, more with upgrades, pets and relics). It decays when you stop. A full combo fires flames around Singu. |
| **Forms** | 12 forms by lifetime Matter (Speck → Omniverse Maw). Each gives ×1.15 Matter, grows Singu and its disk, and is celebrated with a banner. Forms 5 and 8 add relic slots. |
| **Trophies** | **163** achievements in 9 categories. Each unlocked trophy gives +1.5% Matter forever, plus 3 tickets and a shard when claimed. *Claim all* is included. |
| **Pets** | **48** pets in **5 rarities** (Mythic added at 0.5%, with a 250-hatch pity and a soft pity from 180), drawn by a new painter across 25 species, with hue-shifted shading, selective outlines, blush and crowns for Legendary+. The six best orbit Singu. |
| **Relic Forge** | The new push-your-luck. 10 shards forge a relic (Common 55%, Rare 28%, Epic 12.5%, Legendary 4%, Mythic 0.5%). Then **Push** (55% / 40% / 25% / 12% to climb a rarity, or it shatters and refunds 3 shards) or **Keep**. Relics roll 1–4 affixes from 11 stats; equip 3–6, salvage for shards, or fuse three of a rarity into the next one. Shards come from comets, sectors, big reel wins, collapses, trophies, quests and the login calendar, **never from money or ads**. |
| **Leaderboard** | Singu level, submitted through the CrazyGames SDK (see the README for the key). |

The scene was redrawn as well: a smooth sector-tinted sky, soft drifting nebulae, a distant spiral galaxy, three layers of parallax stars, shooting stars, drifting asteroids, a huge lit planet horizon under Singu, and a vignette. Owned harvesters orbit Singu and drip matter into it, and payouts stream particles to the Matter counter. Taps squash Singu. The art buffer is finer than before (about 230+ art pixels tall).

**Pacing** (`npm run sim -- 45 smart`): first Sweeper at 0:14, first capsule at 0:35, sector 2 at 3:30, a new harvester tier every few minutes (Comet Net 4:27, Drone 6:59 … Dyson 30:49, Engine 42:04), and Collapse available at about 7:54.

**Saves:** version 3. v1 and v2 saves migrate: old drones become Orbital Drone harvesters, old critters map to the new pets, and everyone starts with 10 shards.

## Version 2: cozy pixel art + gacha

Version 1 followed the bible's minimalist vector style and its ban on loot boxes. The owner asked for a full restyle to cozy retro pixel art, plus addictive gacha and luck elements, proper scaling and a stronger hook, so version 2 deliberately overrides those parts of the bible. Everything else from the bible still holds: instant start, one clear action, always-visible next goal, safe saves, capped away income, no punishments for leaving.

### Platform limits that shaped the gacha
- CrazyGames requires games for its 13+ audience to be **PEGI 12** compliant.
- PEGI rates games that teach or glamorise *casino-style* gambling at 18. Fantasy-framed luck games (Balatro, Luck Be a Landlord) were moved to 12 in 2025, and PEGI has announced that *paid* random items will push games to 16 or higher.
- CrazyGames' in-game purchase rules single out loot boxes bought with money or purchasable currency.

So:
- **Tickets are only ever earned by playing.** There is no way to buy them, and ads never give tickets or capsules.
- **No casino imagery.** There are no coins, chips, cards, "bet" or "casino" words. The reel spins cosmic symbols, and Overcharge is framed as cosmic energy.
- **Odds and pity are always on screen**, every hatch adds progress (duplicates star up, and fully maxed critters refund tickets), and the Star Reel never costs anything.

Recheck the current CrazyGames and PEGI rules before submission. This environment could not open docs.crazygames.com, so the rules above come from search results.

## Version 3: daily rewards, faceless Singu

The owner asked for Singu's face to be removed and for daily rewards. Singu is now a plain black hole with a swirling event horizon. Its rim colour still reacts (pink after wins, gold in a Surge, grey on a fizzle), and a ripple runs inward when it swallows. A new **Rewards** tab collects every reason to come back. Its badge counts what is ready to claim, and a gift chip under the Singu level shows the next timer.

| System | Rule |
|---|---|
| **Daily login calendar** | 7 days: 20 tickets → 20 + 10 min of Matter → 30 + Surge → 20 + Rare+ capsule → 40 + 20 min → 50 + 60 s Surge → 60 + **Epic+ capsule**. Each finished week adds +25% tickets (up to +100%). Claim once per local day. **A missed day pauses the calendar; it never resets.** The calendar pops up for returning players, and for new players after 45 s and their first upgrade. |
| **Daily quests** | 3 a day, picked deterministically from 10 (pulse, swallow, spin, lucky, comets, hatch, buy, chain of 12, play 10 min, overcharge). 10–15 tickets each; finishing all three adds 25 tickets + a Rare+ capsule. A countdown shows when new quests arrive at midnight. |
| **Play gifts** | 5 chests at 2, 5, 10, 20 and 30 minutes of play each day: tickets, Matter, a Surge, and a Rare+ capsule at 30 min. They target session length directly. |
| **Free capsule** | A free hatch every 4 hours, counting toward pity. New players get one immediately. Moving the clock back cannot skip the wait. |
| **Goals** | 11 lifetime goals with 4–7 tiers each (pulses, captures, chains, hatches, sectors, Singu level, lucky pulses, spins, comets, collapses, discoveries), each paying 5–80 tickets. They are claimed manually for the payoff moment. |

All claims are pure functions in `core.js` that pay out once (tested), and rewards go through one `grantReward`. The old one-off "daily gift" button became Day 1 of the calendar.

## The hook

> Feed Singu. Spin the stars. Hatch the cosmos.

**Singu** is the black hole at the centre. Since version 3 it has no face, and its rim, swirl and swallow ripple carry the feedback instead. Your hatched critters orbit it, so your collection is always on screen.

### Reward loops, from seconds to days

| Loop | How often | What it does |
|---|---|---|
| Pulse → chain → payout | every second | pentatonic plinks, `+X / CHAIN ×n`, Singu munches |
| **Lucky Pulse** | 5% base, up to about 30% | the whole chain ×3 (stronger with Quasar Fox), green flash, "LUCKY!" |
| **Star Reel** | about every 30 catching pulses | 3-reel cosmic slot that stops one reel at a time; pairs, triples and a Singu Jackpot (Surge + 20 tickets); always pays something |
| **Overcharge** | after 10+ chains, at most every 25 s | optional push-your-luck: 50% doubles the chain, 50% loses half of it; odds shown, never forced |
| Comets | every 70–140 s | catch one in a pulse: Surge ×3 for 20 s + 5 tickets |
| **Capsules** (gacha) | first hatch at about 30–50 s, then about 1–2 per minute when active | 13 critters in 4 rarities, each a permanent bonus that stars up to ★5 |
| Singu levels | log scale on lifetime Matter | +3% Matter and 3 tickets per level; never resets |
| Sectors | about 3:50, 5:55, 7:30, 9:00, 10:40, then endless | new sky, ambient scene and fragment mix, plus 10 tickets each |
| Collapse / Stardust | optional from about 7:30 | +25% Matter per Stardust forever, plus 4 research unlocks |
| Daily | once per local day | Cosmic Mutation (always positive), login calendar, 3 quests, 5 play gifts; nothing is ever lost |

Times are from `npm run sim` with an active player. In 20 minutes it gets about 40 hatches, 90 reel spins and 500 lucky pulses; an idle-ish player gets about 10 hatches in 6 minutes.

### Gacha rules
- Single hatch 10 tickets; ×10 for 90 (one free) with a guaranteed Rare or better.
- Rarities: Common 62%, Rare 27%, Epic 9%, Legendary 2%. The first hatch ever is always Rare.
- Pity: Epic or better within 25 hatches. Legendary within 70, and its odds climb each hatch after 50.
- Duplicates star up (★1→★5 needs 1/2/3/4 extra copies), and each star adds +50% of the base bonus (★5 = ×3). Extra copies at ★5 refund 1/2/4/8 tickets by rarity.
- Tickets come from discoveries (2), Singu levels (3), big chains (18–35% chance, 12 s cooldown), comets (5), Star Reel prizes (1–20), sectors (10), and everything in the Rewards tab.

### Scaling
- Upgrades: Event Horizon (12 levels), Matter Density (25), Resonance (25), Lucky Charm (20), **Orbital Drones up to 1000** (×2 every 25 levels) and **Pulse Focus up to 200** (×1.32 per level). Costs grow exponentially, so the long caps act as soft walls broken by Collapse, critters and Singu levels.
- Multipliers stack: focus × sector × Stardust × Atlas × Singu level × critters × Surge × Lucky × chain.
- Sectors continue forever after the fifth (*Dust Cloud II, III…*), with thresholds ×20 and value ×1.5 each. Number formatting runs to QiDc (10^48) and then switches to exponents.
- Stardust = ⌊∛(run Matter / 150 000)⌋, available from sector 4.

## Art direction
- **Palette:** Sweetie 16 by GrafxKid, a popular cozy pixel palette, plus a blush pink, a lavender and a deep night tone. Cool, dark skies with warm accents (the accretion disk, crystals, the reel) follow the usual cozy-scene advice.
- **Real pixels:** the universe renders into a small buffer (about 200–300 art pixels across) and scales up by a whole number with no smoothing. Fullscreen also scales the whole UI.
- **Dithering is used sparingly:** flat sky bands with an ordered-dither seam, nebulae with solid cores and dithered rims, and dithered flashes and sector dissolves.
- **Sprites:** fragments, icons and the capsule machine are hand-made grids in `js/sprites.js`. The 13 critters come from a small generator (body shape + ears + extras, auto-outline, auto-shading, highlight, blush), so they share one style. `tools/spritesheet.html` shows them all.
- **UI:** chunky notched panels, buttons with a 3D press, Pixelify Sans for text and Silkscreen for digits (Pixelify's 2 and 5 read as Z and S, which a numbers game can't afford). Both fonts are SIL OFL, with licences in `fonts/`.
- **Sound:** square/triangle chiptune voices, stepped noise, arpeggio fanfares per rarity, reel ticks and stops. It has not been listened to; see risks.

## Retained from version 1
Versioned validated saves (v1 saves load and migrate), a backup slot, corrupt-save recovery, away income capped at 2 h at 50% (paid once, a clock moved backwards pays nothing), mute, reduced motion (no shake, fewer particles, no blinking UI), keyboard and touch input, layouts for 907×510, fullscreen and phone, store art rendered from the game, and the guarded SDK adapter.

## Verification done
- **Version 4:** `npm test` runs 38 rule tests, adding harvesters (bulk cost, max buy, milestones, locked tiers), the upgrade catalog, combo, the relic forge (push, shatter, keep, fuse, salvage), forms, trophies, 5-rarity odds and v2 migration. `npm run qa` and `npm run qa:dist` run 40 browser checks, all passing, including catalog buys, the forge, trophy claims, hold-to-pulse, the leaderboard dialog, the phone bottom tab bar, and the same save, away, collapse and reward checks as before. Screenshots were reviewed at 907×510, 1920×1080, 390×844 and 844×390. **The leaderboard submission has not been tested against the live SDK.**
- Earlier versions: `npm test` had 32 rule tests. The newest cover login once per day with no reset on missed days and week scaling, deterministic quests that pay once, play gifts in order, the free-capsule timer and clock-back guard, goal tiers, reward granting, and badge counts. Earlier ones cover costs, max levels, save sanitising (including forged Singu levels, tickets and critters), v1 migration, Collapse exactly once, the away cap, mutation determinism and no repeats, first pulse always catches, cooldown buffering, payout maths, pacing targets, first hatch Rare, Epic and Legendary pity across 40 seeds × 400 hatches, ten-pulls always Rare+, odds summing to 1, star scaling, reel result mapping, the reel paying out, and Overcharge resolving once.
- `npm run qa` and `npm run qa:dist`: 35 browser checks (now including login, free capsule, play gift, quest and goal claims, the badge and gift chip, and Rewards by touch on a phone) in headless Chromium, all passing on both the source and the build. New ones cover hatch ×1 and ×10 (skip), the daily gift across reload, Star Reel spin and payout, Overcharge, critters orbiting, and capsules by touch on a phone.
- The production build works without `zip` installed, as on Vercel.
- Several real-time Chromium sessions with human-like clicking and buying (up to 3 minutes), plus screenshot review at every sector, modal and viewport.

## Not verified / risks
- **Platform policy.** The gacha and Overcharge are designed to stay inside PEGI 12 and CrazyGames' rules, but I could not read the official pages. Confirm before submitting, and be ready to turn Overcharge off (`CONFIG.overcharge.minChain = Infinity`) if QA objects.
- **No human playtests.** The `?debug` timings in Settings help with the bible's five-tester plan.
- **Sound was not listened to.** Check volume balance and repetition fatigue by ear.
- **The CrazyGames SDK is untested** against the live service, including the leaderboard encryption. The key in `js/platform.js` is empty until the owner pastes theirs.
- **The relic forge's Push is a gamble on earned currency.** It is fantasy-framed with odds always shown, and shards can never be bought. If platform QA objects, remove the Push button in `forgeHTML` in `js/game.js` so relics become plain random drops.
- **Real devices.** Touch was tested only in Chromium's mobile emulation. Check iOS Safari and a mid-range Android phone, especially frame rate during sector dissolves and big reel wins.
- **Late-game balance** past about 30 minutes, or many Collapses, has only been simulated.
