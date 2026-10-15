# Asset sources and licenses

Game sprites use existing **Kenney** and **OpenGameArt** assets from the creators credited below. No generated artwork is included. The PNG sheets are unchanged copies from their respective downloads and are stored locally, so the game does not depend on an external asset server.

| File | Creator's source | License | Used for |
| --- | --- | --- | --- |
| `public/assets/tiny-town.png` | [Tiny Town 1.1](https://kenney.nl/assets/tiny-town) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Grass, paths, houses, trees, flowers, fences, signs |
| `public/assets/tiny-dungeon.png` | [Tiny Dungeon 1.0](https://kenney.nl/assets/tiny-dungeon) | CC0 1.0 | Explorer and companion character sprites, props |
| `public/assets/tiny-battle.png` | [Tiny Battle 1.0](https://kenney.nl/assets/tiny-battle) | CC0 1.0 | Water and shore tiles |
| `public/assets/PressStart2P-Regular.ttf` | [Google Fonts: Press Start 2P](https://github.com/google/fonts/tree/main/ofl/pressstart2p) | SIL Open Font License 1.1 | Pixel headings and in-game labels |

Original license notices are retained beside the sheets as `LICENSE-tiny-town.txt`, `LICENSE-tiny-dungeon.txt`, and `LICENSE-tiny-battle.txt`. Kenney's CC0 notices permit personal, educational, and commercial use. Attribution is optional; it is included here to credit the creator.

Press Start 2P is by Cody Boisclair (CodeMan38). Its original license and font log are included as `LICENSE-press-start-2p.txt` and `FONTLOG-press-start-2p.txt`. The font is also hosted locally.

## Packed atlas reference

All tiles are 16 × 16 pixels with no spacing in the packed sheets. Tiny Town and Tiny Dungeon have 12 columns and 11 rows (192 × 176 pixels). Tiny Battle has 18 columns and 11 rows (288 × 176 pixels). For tile number `i`, source coordinates are `x = (i % columns) * 16`, `y = floor(i / columns) * 16`.

### Tiny Town

- Grass: 0 plain, 1 textured, 2 flowers.
- Dirt path: top row 12/13/14; middle 24/25/26; bottom row 36/37/38.
- Trees: 3 autumn conifer, 4 green conifer, 5 round green tree, 15 autumn round tree, 16 green round tree. Shrubs: 27/28, mushrooms: 29.
- Stone path: 43. Fence segments: 44–47, 56, 58–59, 68–71, 80–82. Sign: 83.
- Blue roof: top 48/49/50; lower 60/61/62. Orange roof: top 52/53/54; lower 64/65/66. Center pieces can repeat to build wider houses.
- Replace the lower roof tile directly above a door with 63 (blue) or 67 (orange) for a triangular gable. A complete small blue house is three rows: `[48,49,50]`, `[60,63,62]`, `[72,85,75]`.
- Wooden wall: 72 left, 73 middle, 75 right; open door 74; window 84; closed doors 85–87.
- Stone wall: 76 left, 77 middle, 79 right; open door 78; window 88; closed doors 89–91.
- Well: 104. Log: 106. Tools: 115–119 and 127–129.

### Tiny Dungeon

- Explorer: 98 (brown hair, blue shirt), 85 (brown tunic), or 88 (orange tunic).
- Companions: 84 wizard, 86 bald adventurer, 87 helmeted adventurer, 99/100 other villagers.
- Treasure chests: 89–92. Coin stack: 82. Potions: 113–116.

These original Tiny Dungeon character tiles are static front views and remain useful for enemy/NPC fallback art. Version 3 uses the separate directional action sheets described below for the explorer and animated villagers.

### Tiny Battle water

- Water center: 37 (waves). Rectangular shore: top-left 18, top 19, top-right 20; left 36, right 38; bottom-left 54, bottom 55, bottom-right 56.
- Additional curved corners: 3/4,21/22; inner shoreline corners 72/74,90/91,92/93.


## Version 2 interior furnishings

`public/assets/roguelike-indoors.png` is the original transparent tilesheet from [Kenney Roguelike Indoors](https://kenney.nl/assets/roguelike-indoors), an existing **CC0** pack. The creator's original license is included in `LICENSE-roguelike-indoors.txt`. This pack adds recognizable beds, bookshelves, reading desks, counters, lamps, framed documents and furniture without generated artwork. Existing dungeon props supply computers, treasure chests and trophies; existing town props supply workshop tools, notices, wells and fences.

The Indoors sheet is 458 × 305 pixels: **27 columns × 18 rows**, 16 × 16 pixels per tile with **1 pixel between tiles**. For index `i`, source position is `(i % 27) × 17, floor(i / 27) × 17`; crop only 16 × 16 pixels. Do not use the spacing-free Tiny Town atlas formula for this sheet.

The renderer uses semantic furniture types so layouts remain independent of the artwork. Main references: square table 5, wide table 0/1/2, bookshelf 479, paper/book 475, bed head 197 and foot 230, counter 365, framed document 344, candlestick 178. Source sheets are unchanged and all assets are hosted locally.

## Version 3 character animation

- `public/assets/explorer-actions.png`: the unchanged [Basic 16×16 character sprites, 4 directional](https://opengameart.org/content/basic-16x16-character-sprites-4-directional) sheet by **Bennyboi_hack**, released as **CC0 1.0**. It contains genuine, distinct front/back/left/right walking frames, holding/interacting poses, sword attacks, shields, and falling/tumbling poses. The file is 170 × 153 pixels, with 10 columns and 9 rows; source cells are 16 × 16 with a 17-pixel stride. Its original magenta background key is removed only while decoding into an offscreen canvas at runtime. The distributed PNG is unchanged. Running uses the authored walking gait at a faster cadence; it is not a separately drawn run sheet. Victory reuses the raised-arm holding frames, and hurt/defeat use the authored fall frames. Exact state timing and frame coordinates are defined in `src/game/animation.mjs`.
- `public/assets/villager-actions.png`: the unchanged [Man Sprite 16×16](https://opengameart.org/content/man-sprite-16x16) sheet by **dutzy**, based on work by **russpuppy**, released as **CC0 1.0**. This 128 × 64 sheet uses 16-pixel cells without gaps. Existing blink and arm/working frames provide simple, distinct NPC idle behaviors.

Source and license records are retained in `LICENSE-explorer-actions.txt` and `LICENSE-villager-actions.txt`. No generated artwork is included. Animation is independent of collision geometry, and reduced-motion mode selects fixed, direction-correct poses.

## Version 3 audio

Seven original music loops and fourteen sound effects are stored locally in `public/audio/`. Their CC0 dedication, format, composition notes and filename inventory are recorded in `public/audio/README.md`. They use original oscillator/noise synthesis and do not contain proprietary samples or game melodies.
