# Pocket Singularity

A clicker / incremental game for CrazyGames. Every click sends a gravity pulse through a miniature universe, pulling fragments into a black hole that grows into a universe-eating machine.

**Play locally:** open `index.html` in a browser, or serve the folder (`npx http-server .`) and open it there. There is no build step needed to play.

The design source of truth is [`docs/POCKET_SINGULARITY_GAME_BIBLE.md`](docs/POCKET_SINGULARITY_GAME_BIBLE.md). What was built against it, the balance and the remaining risks are in [`docs/DESIGN_NOTES.md`](docs/DESIGN_NOTES.md).

## Controls

| Input | Action |
|---|---|
| Click / tap the universe, the **Pulse Gravity** button, or `Space` | Gravity pulse |
| `1`–`5` | Buy upgrade |
| `M` | Mute |
| `Esc` | Close dialog |

## Project layout

```
index.html          page shell (loads the files below + the optional CrazyGames SDK)
css/style.css       layout and the fixed bible palette
js/core.js          all rules and balance data — economy, saves, world simulation (no DOM; runs in Node)
js/game.js          rendering, UI, input, saving, away income
js/audio.js         synthesized Web Audio sound (no audio files)
js/platform.js      CrazyGames SDK v3 adapter + storage; every call is safe without the SDK
tools/sim.js        pacing simulator: plays the real rules with a scripted player
tools/build.js      production build → dist/index.html (single file) + dist/pocket-singularity.zip
tools/covers.js     renders store art from the live game → store/
tests/core.test.js  rule tests (Node's built-in test runner)
tests/browser.qa.js browser QA in Chromium via Playwright (desktop 907×510, 1920×1080, phone portrait/landscape)
```

All tuning values live in `CONFIG` at the top of `js/core.js`.

## Commands

Node 18+ is needed. The browser QA and cover scripts also need Playwright (`npm i -D playwright`, then `npx playwright install chromium`).

```
npm test                 # rule tests
npm run qa               # browser QA against the source files (pass a folder to save screenshots)
npm run build            # dist/index.html + dist/pocket-singularity.zip
npm run qa:dist          # the same browser QA against the production build
npm run covers           # store/cover-*.png
npm run sim -- 40 smart  # pacing report: minutes, policy (smart | spam | idle), seed, collapse-at-Stardust
```

Add `?debug` to the URL to see playtest timings (first pulse, first purchase, each sector) in Settings.

## Uploading to CrazyGames

1. `npm run build`.
2. Upload `dist/pocket-singularity.zip` (a single `index.html`, about 35 KB zipped).
3. Use the images in `store/` as covers (1920×1080, 800×1200, 800×800). Check them against the current size requirements in the developer portal first.
4. Category **Clicker**, secondary tag **Idle**. Mobile/touch is supported.

`index.html` loads the CrazyGames SDK v3 from `sdk.crazygames.com`. The game starts without waiting for it and works the same if it fails to load. When it does load, the game:

- calls `loadingStop`, `gameplayStart`/`gameplayStop` (stopped while dialogs are open or the tab is hidden), and `happytime` on sector reveals, comet Surges and Collapse;
- respects the platform's mute setting;
- mirrors saves into the SDK data module, and adopts a synced save only when it is further along than the local one;
- offers one rewarded ad, **double away income**, on the Welcome back screen. It appears only when the SDK reports the `crazygames` environment and ads are available, so it stays hidden during Basic Launch.

The SDK integration was written from the v3 API and has **not** been tested against the live SDK, which this build environment could not reach. Test it in the CrazyGames QA tool before submitting.
