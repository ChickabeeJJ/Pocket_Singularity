# Pocket Singularity

A cozy pixel-art idle tycoon / clicker for CrazyGames. Name your own tiny, hungry black hole (it defaults to **Singu**) and feed it: tap or hold to pulse cosmic bits into it and build a combo, buy 15 kinds of harvesters, unlock 260 upgrades, hatch 48 pets across 5 rarities, forge push-your-luck relics, open skin crates for 18 black hole skins, collect 171 trophies, and grow through 12 forms from a Speck to an Omniverse Maw. A Rewards tab brings players back every day (login calendar, daily quests, play gifts, a free capsule every 4 hours), and Singu's level is submitted to the CrazyGames leaderboard.

**Play locally:** open `index.html` in a browser, or serve the folder (`npx http-server .`) and open it there. There is no build step needed to play.

The original design brief is [`docs/POCKET_SINGULARITY_GAME_BIBLE.md`](docs/POCKET_SINGULARITY_GAME_BIBLE.md). What was built, the balance, and where the game now deliberately departs from the brief (pixel art, gacha, luck mechanics) are in [`docs/DESIGN_NOTES.md`](docs/DESIGN_NOTES.md).

## Controls

| Input | Action |
|---|---|
| Click / tap the universe, hold it down, or `Space` | Gravity pulse (fast pulses build combo) |
| `1`–`7` | Switch tab (Harvest, Upgrades, Pets, Relics, Rewards, Skins, Trophies) |
| `M` | Mute |
| `Esc` | Close dialog |

## Project layout

```
index.html          page shell (loads the files below + the optional CrazyGames SDK)
css/style.css       pixel UI (Sweetie 16 palette, notched panels, press buttons)
fonts/              Pixelify Sans + Silkscreen (digits), both SIL OFL, licences included
js/content.js       content tables: 15 harvesters, 12 forms, 260 upgrades, 171 trophies, relics, 48 pets, skins and crates
js/core.js          all rules and balance: economy, gacha, relic forge, Star Reel, saves, world simulation (no DOM; runs in Node)
js/sprites.js       palette, hand-made sprites, the pet painter (25 species), capsules, machine, icons
js/render.js        the scene: layered sky, planet horizon, parallax stars, Singu, orbiting harvesters and pets, effects
js/game.js          UI (HUD, six panel tabs, modals), input, saving, away income
js/audio.js         chiptune sound effects (Web Audio) and the looping soundtrack
assets/music/       soundtrack (a softened, quieter mix of "The Quiet Between Stars"), shipped next to index.html
js/platform.js      CrazyGames SDK v3 adapter + storage; every call is safe without the SDK
tools/sim.js        pacing simulator: plays the real rules with a scripted player
tools/build.js      production build → dist/index.html (single file, fonts inlined) + dist/pocket-singularity.zip + public/index.html
tools/covers.js     renders store art from the live game → store/
tools/spritesheet.html  every sprite at 6×, for art review
tests/core.test.js  rule tests (Node's built-in test runner)
tests/browser.qa.js browser QA in Chromium via Playwright (desktop 907×510, 1920×1080, phone portrait/landscape)
vercel.json         Vercel deploy: runs the build and serves public/
```

Tuning values live in `CONFIG` at the top of `js/core.js`; content lists live in `js/content.js`.

## Commands

Node 18+ is needed. The browser QA and cover scripts also need Playwright (`npm i -D playwright`, then `npx playwright install chromium`).

```
npm test                 # rule tests
npm run qa               # browser QA against the source files (pass a folder to save screenshots)
npm run build            # dist/index.html + music + dist/pocket-singularity.zip
npm run qa:dist          # the same browser QA against the production build
npm run covers           # store/cover-*.png
npm run sim -- 40 smart  # pacing report: minutes, policy (smart | spam | idle), seed, collapse-at-Stardust
```

Add `?debug` to the URL to see playtest timings (first pulse, first purchase, each sector) in Settings.

## Deploying

**Vercel:** `npm run build` writes the site to both `dist/` and `public/` (Vercel's default folder), and `vercel.json` points Vercel at `public/`, so the deploy works whatever the project settings say. Make sure Vercel deploys the latest commit on the branch: the failing log was from the older commit `a724d9f`, which had no deploy config.

**CrazyGames:**
1. `npm run build`.
2. Upload `dist/pocket-singularity.zip` (`index.html` plus the soundtrack, about 2.1 MB).
3. Use `store/` for the listing: three covers, two preview videos, and the description, tags and controls in [`store/LISTING.md`](store/LISTING.md).
4. Category **Clicker**, secondary tag **Idle**. Mobile/touch is supported.

`index.html` loads the CrazyGames SDK v3 from `sdk.crazygames.com`. The game starts without waiting for it and works the same if it fails to load. When it does load, the game:

- calls `loadingStop`, `gameplayStart`/`gameplayStop` (stopped while dialogs are open or the tab is hidden), and `happytime` on sector reveals, comet Surges, jackpots, Legendary hatches and Collapse;
- respects the platform's mute setting;
- mirrors saves into the SDK data module, and adopts a synced save only when it is further along than the local one;
- offers one rewarded ad, **double away income**, on the Welcome back screen. It appears only when the SDK reports the `crazygames` environment and ads are available, so it stays hidden during Basic Launch. Ads are never tied to capsules or relics;
- submits the player's **Singu level** to the leaderboard (on load and on every level-up) with `SDK.user.submitScore({ encryptedScore, score })`.

**Leaderboard setup:** create the leaderboard in the CrazyGames developer portal, copy its encryption key, and paste it into `leaderboardKey` in `js/platform.js`. The score is encrypted with AES-GCM (random 12-byte IV, sent as base64 of IV + ciphertext). Without a key, or outside CrazyGames, nothing is submitted and the in-game Leaderboard button just explains the score. Test it in the portal's preview before release.

The SDK integration was written from the v3 API and has **not** been tested against the live SDK, which this build environment could not reach. Test it in the CrazyGames QA tool before submitting.
