# Asset sources and licenses

All visual game sprites are existing **Kenney** assets downloaded from the creator's website. No generated artwork is included. The packed PNG sheets are unchanged copies from their respective downloads and are stored locally, so the game does not depend on an external asset server.

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

The character sprites are static front views. Walking is presented in the renderer through sprite movement and a small step bob.

### Tiny Battle water

- Water center: 37 (waves). Rectangular shore: top-left 18, top 19, top-right 20; left 36, right 38; bottom-left 54, bottom 55, bottom-right 56.
- Additional curved corners: 3/4,21/22; inner shoreline corners 72/74,90/91,92/93.

