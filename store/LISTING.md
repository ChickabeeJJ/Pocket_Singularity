# Pocket Singularity — CrazyGames listing

## Assets (all in this folder)

| Asset | File | Size |
|---|---|---|
| Landscape cover | `cover-landscape-1920x1080.png` | 1920×1080 |
| Portrait cover | `cover-portrait-800x1200.png` | 800×1200 |
| Square cover | `cover-square-800x800.png` | 800×800 |
| Landscape preview video | `preview-landscape-1920x1080.mp4` | 1920×1080, 18 s, H.264, no audio |
| Portrait preview video | `preview-portrait-1080x1920.mp4` | 1080×1920, 18 s, H.264, no audio |

Check these sizes against the current requirements in the Developer Portal before uploading. The covers come from `npm run covers`; the videos are real gameplay recorded in Chromium and scaled up 2× with sharp pixels.

## Category

**Clicker** (secondary: Idle)

## Tags

Clicker, Idle, Incremental, Tycoon, Space, Pixel, Cute, Pets, Collecting, Upgrade, Casual, Relaxing, Mobile, 1 Player

## Title

Pocket Singularity

## Short description

Name your own tiny black hole and feed it the universe! Tap to pull in stardust, build harvesters, hatch cute cosmic pets and grow from a Speck into an Omniverse Maw.

## Description (plain text, ready to paste)

Pocket Singularity is a cozy pixel-art idle clicker about a tiny, hungry black hole, and it's yours to name.

Tap or hold to pulse gravity and pull stardust, ice and star crystals into your black hole. Pulse quickly to build a combo, catch whole chains of fragments at once, and snag passing comets for a golden Surge that triples everything you earn.

Then grow your cosmic empire:
- 15 harvesters that feed your black hole while you play and while you're away, each doubling at 25, 50, 100 and more owned
- 260 upgrades, from Gravity Gloves to Cosmic Catalysts
- 48 adorable pets to hatch from Cosmo Capsules, from Common to Mythic, each with its own bonus. Choose up to six to orbit your black hole
- The Relic Forge: forge a relic, then push your luck for a rarer one or keep what you've got
- 18 black hole skins in three crates, each with its own colours, animations and buffs
- 12 forms to evolve through, from a tiny Speck to an Omniverse Maw
- 171 trophies in bronze, silver, gold and spectral
- The Star Reel, Lucky Pulses, Overcharge, daily quests, a 7-day login calendar and free capsules
- Collapse your universe into Stardust and start again stronger

Everything is earned by playing, and all capsule, crate and forge odds are shown in the game. Climb the leaderboard by raising your black hole's level!

## Controls (plain text, ready to paste)

- Tap, click or hold the universe (or press Space): pulse gravity
- Tap a harvester, upgrade, pet or skin to use it; hold an upgrade to read what it does
- 1-7: switch tabs (Harvest, Upgrades, Pets, Relics, Rewards, Skins, Trophies)
- M: mute
- Esc: close a window
- Fully playable with touch on phones and tablets

## Before you submit

1. **Leaderboard:** create it in the Developer Portal, then paste its encryption key into `leaderboardKey` in `js/platform.js` and rebuild. Without the key, no scores are sent.
2. Run `npm run build` and upload `dist/pocket-singularity.zip` (index.html and the soundtrack).
3. Test in the Developer Portal preview: loading, gameplay start and stop, mute, the rewarded ad on the Welcome back screen, and score submission.
