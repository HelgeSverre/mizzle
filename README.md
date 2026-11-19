# Mizzle

You are a small rain cloud on a tiny planet. Rain on turnips, ponds and villagers to finish their errands. Everything is modelled and scored in code.

**Play it:** https://mizzle-eight.vercel.app

## Made by Claude Fable 5.2

Mizzle was written by Claude Fable 5.2 (`claude-fable-5-2`) in Claude Code, from one prompt. Every assistant turn in the session was Fable 5.2. There were no follow-up prompts about the game itself; the only other message was "deploy to vercel", sent 33 minutes later.

The prompt, verbatim:

> I want you to go nuts and create me an impressive, quirkey/charming full game that pushes the envelope of what AI-developed games are, is visually impressive and NOT something that i have already done already in my code folder, it must be an original creative work, no lighthouses or boats allowed, other than that, go nuts, i wanna be wow-ed, put in fable-demo-game/

The game has no image, model or audio files. The planet, the villagers (Pips), the cloud and the score are generated at runtime with three.js and the Web Audio API.

Its sequel from the same session is [Busted](https://github.com/HelgeSverre/busted).

## How to play

You drift over a small round world as a cloud. Nine villagers each have an errand that needs weather: a turnip patch, a pond, a windmill, a campsite, moss, a rocket, a snowman, someone who wants shade, and a wedding. Finish an errand and you earn a heart.

- Rain empties your water. Hover over the sea or a pond to drink it back up.
- Over cold ground the rain turns to snow.
- One errand teaches you thunder. Charge a bolt and strike what needs striking. Hit a tree and it catches fire.
- Day turns to night as you play.

When all nine hearts are full, a sleeping bud wakes up. Water it, then strike it with lightning to end the game. The end screen shows your time.

## Controls

| Key | Action |
|---|---|
| <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> or arrow keys | Drift |
| <kbd>Space</kbd> (hold) | Rain |
| <kbd>E</kbd>, <kbd>F</kbd> or <kbd>Shift</kbd> (hold) | Charge and strike lightning, once unlocked |
| <kbd>M</kbd> | Mute |
| Any key or click | Start |

## Run locally

```sh
bun install
bun run build      # bundles src/ into dist/game.js
bunx serve .       # or any static server, then open the printed URL
```

`bun run dev` rebuilds `dist/game.js` on every change. `dist/game.js` is committed because the Vercel deploy serves the repo as static files with no build step (see `vercel.json`).

## Code

| File | What it does |
|---|---|
| `src/main.js` | Game loop, input, camera, day/night |
| `src/world.js` | The planet: terrain, water, trees, temperature |
| `src/cloud.js` | The player cloud: movement, water, charge |
| `src/quests.js` | The nine errands and the finale |
| `src/pips.js` | Villagers and their houses |
| `src/fx.js`, `src/post.js` | Rain, snow, lightning, particles, post-processing |
| `src/audio.js` | Generated sound effects and score |
| `src/ui.js` | HUD, hints, title and end screens |
| `src/noise.js`, `src/util.js` | Noise and the small modelling kit |

## License

[MIT](LICENSE)
