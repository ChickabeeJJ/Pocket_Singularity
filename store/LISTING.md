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

Clicker, Idle, Incremental, Tycoon, Pixel, Space, Cute, Pets, Upgrade, Casual, Relaxing, Mobile, 1 Player

## Title

Pocket Singularity

## Short description

Name your own tiny black hole and feed it the universe. Tap, build harvesters, hatch cute cosmic pets and grow from a Speck into an Omniverse Maw!

## Description

Pocket Singularity is a cozy pixel-art idle clicker about a tiny, hungry black hole, and you get to name it!

Tap or hold to pulse gravity and pull stardust, ice and star crystals into your black hole. Pulse quickly to build a combo, chain big catches together, and catch passing comets for a golden Surge.

Then build your space empire:
- **15 harvesters** that feed your black hole while you play and while you are away, each doubling at 25, 50, 100 and more owned
- **260 upgrades**, from Gravity Gloves to Cosmic Catalysts
- **48 cute pets** to hatch from Cosmo Capsules, in five rarities from Common to Mythic, each with its own bonus
- **The Relic Forge**: forge relics and push your luck for a rarer one, or keep what you have
- **12 forms** to evolve through, from a Speck to an Omniverse Maw
- **163 trophies**, the Star Reel, Lucky Pulses, daily quests, a 7-day login calendar and free capsules
- **Collapse** your universe for Stardust and start again stronger

Every ticket and shard is earned by playing, and capsule and forge odds are always shown. Climb the leaderboard by growing your black hole's level!

## Controls

- **Tap / click / hold** the universe (or **Space**): pulse gravity
- **1–6**: switch tabs (Harvest, Upgrades, Pets, Relics, Rewards, Trophies)
- **M**: mute · **Esc**: close a window
- Works with touch on phones and tablets

## Before you submit

1. **Leaderboard:** create it in the Developer Portal, then paste its encryption key into `leaderboardKey` in `js/platform.js` and rebuild. Without the key, no scores are sent.
2. Run `npm run build` and upload `dist/pocket-singularity.zip` (index.html and the soundtrack).
3. Test in the Developer Portal preview: loading, gameplay start and stop, mute, the rewarded ad on the Welcome back screen, and score submission.
