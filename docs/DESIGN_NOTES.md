# Pocket Singularity — design notes

What was built, why, and what is still unproven.

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
- `npm test`: 32 rule tests. The newest cover login once per day with no reset on missed days and week scaling, deterministic quests that pay once, play gifts in order, the free-capsule timer and clock-back guard, goal tiers, reward granting, and badge counts. Earlier ones cover costs, max levels, save sanitising (including forged Singu levels, tickets and critters), v1 migration, Collapse exactly once, the away cap, mutation determinism and no repeats, first pulse always catches, cooldown buffering, payout maths, pacing targets, first hatch Rare, Epic and Legendary pity across 40 seeds × 400 hatches, ten-pulls always Rare+, odds summing to 1, star scaling, reel result mapping, the reel paying out, and Overcharge resolving once.
- `npm run qa` and `npm run qa:dist`: 35 browser checks (now including login, free capsule, play gift, quest and goal claims, the badge and gift chip, and Rewards by touch on a phone) in headless Chromium, all passing on both the source and the build. New ones cover hatch ×1 and ×10 (skip), the daily gift across reload, Star Reel spin and payout, Overcharge, critters orbiting, and capsules by touch on a phone.
- The production build works without `zip` installed, as on Vercel.
- Several real-time Chromium sessions with human-like clicking and buying (up to 3 minutes), plus screenshot review at every sector, modal and viewport.

## Not verified / risks
- **Platform policy.** The gacha and Overcharge are designed to stay inside PEGI 12 and CrazyGames' rules, but I could not read the official pages. Confirm before submitting, and be ready to turn Overcharge off (`CONFIG.overcharge.minChain = Infinity`) if QA objects.
- **No human playtests.** The `?debug` timings in Settings help with the bible's five-tester plan.
- **Sound was not listened to.** Check volume balance and repetition fatigue by ear.
- **The CrazyGames SDK is untested** against the live service.
- **Real devices.** Touch was tested only in Chromium's mobile emulation. Check iOS Safari and a mid-range Android phone, especially frame rate during sector dissolves and big reel wins.
- **Late-game balance** past about 30 minutes, or many Collapses, has only been simulated.
