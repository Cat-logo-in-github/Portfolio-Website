# Version 2: a small résumé RPG

Version 2 extends the existing React/Vite/Canvas project without replacing its framework, résumé pipeline, default village generator, local artwork, or GitHub Pages deployment workflow. The portfolio remains useful without completing the game.

## What changed

- **Enterable interiors:** home, library, workshop, and studio purposes share a deterministic semantic-room generator. Enter via a house door; leave through the interior exit. Exterior state and discoveries remain intact.
- **Meaningful solid props:** buildings, furniture, suitable trees/rocks, NPCs, signs, and other objects have collision footprints. Usable interaction sides and line-of-sight checks stop actions through walls.
- **Reusable object choices:** each object declares its identity, sprite, footprint, range, interaction point, hint, records, actions, requirements, and consequences. Inspect gives feedback; explicit discovery choices reveal only the object's source record IDs. Menus can be cancelled safely.
- **Discovery journal and Reading view:** exploration tracks field notes as you find them. The complete conventional `portfolio.html`, professional/contact links, and original PDF remain available independently. Core portfolio content is never locked behind combat or quest completion.
- **A first field trip:** discover three distinct records across two houses. Receive one field key, unlock the Curiosity chest, and keep its cosmetic badge. Accept through the guide/board or begin automatically with your first discovery. Completion and rewards are idempotent.
- **Optional tactical sparring:** choose Guard, Skirmisher, or Ranger. Small arenas use obstacles, legal movement, ranges, clear intentions, health, a log, explicit turns, and safe victory/defeat/retreat outcomes.
- **Versioned browser saves:** discoveries, containers, quests, rewards, optional wins, player scene/location, and generation configurations persist locally. Invalid or old saves reset with a warning; a changed résumé-PDF hash also resets the save.
- **Shareable configuration:** configure the village or a building interior; edit a real Prüfer code; change independent layout/decoration seeds; choose 2–10 interior rooms; preview semantic room roles; generate a valid random code; restore defaults; export/import version 2 JSON.

## Try the exploration loop

1. Enter the village and speak to the Archivist or use the notice board.
2. Approach a house door and choose Enter.
3. Inspect suitable furniture, then use its discovery action to collect a field note.
4. Exit and visit another house. Three records across two houses earn a field key.
5. Inspect and open the village Curiosity chest. The key is consumed once and its reward stays collected.
6. Optionally challenge the sparring mentor, or open **Forge** to experiment with room topology.

The journal, save, and stable object IDs preserve progression when entering/leaving buildings or regenerating layouts. Settings changes do not erase discoveries or allow the same chest reward to be collected again. Reading view and the original PDF remain direct routes to the professional content.

## Procedural configuration

Village node count is fixed by the number of résumé-derived houses. Interior node count is configurable from **2 through 10**. A Prüfer sequence contains **n − 2** integers from **1 through n**; repeated labels are legal. A sequence is a room-connectivity definition, not a generic random seed.

The stages remain separate:

```text
Prüfer code → labeled tree → semantic room roles → spatial layout
→ doors/corridors → furniture/props → geometry and reachability validation
```

The requested tree is preserved. Semantics use compatible room roles and private leaf rooms; placement reserves circulation and usable sides of functional objects. Invalid inputs or unsupported constraints produce visible errors rather than silently altering topology. Independent layout and decoration seeds prevent decorative changes from changing the room graph.

Exported JSON includes **algorithmVersion 2**, scope, node count, sequence, layout seed, decoration seed, and interior building/archetype where relevant. Import validates the version and target before generation. Identical full valid configurations reproduce the same layout. Configuration JSON shares generation settings, not someone else's save progress.

## Tactical rules

On each turn, move once by up to **two reachable tiles** and take one action, in either order. Select **End turn** to resolve the opponent and refresh the next turn's allowances.

| Action | Effect |
| --- | --- |
| Attack | 3 adjacent melee damage. |
| Guard | Absorb 2 damage from the next enemy hit, then expire. |
| Focus | 2 damage within 3 Manhattan tiles, clear line of sight required; 2 charges per match. |
| Retreat | Safely end practice without losing exploration state. |

Guard holds/advances near the player, Skirmisher closes distance, and Ranger seeks a clear ranged position. Both sides use legal movement and cannot overlap. If an opponent has no path or attack, it waits safely and the turn still progresses. Health is confined to the match; defeat/retreat cause no permanent penalty. Victory badges are once per opponent type, so changing seeds cannot farm rewards. Completed optional wins persist; unfinished battles do not.

## Save behavior

The save format is **version 2** and is stored through localStorage in the current browser/origin. Restoration rebuilds record-to-section relationships from the actual résumé, removes unknown discovery IDs, rejects malformed state, bounds data, and discards prototype keys. Generation configurations are revalidated by their generator before restoring scenes.

A source-PDF hash change starts a new journey with a clear warning. Stable generation seeds still derive from normalized résumé content, so PDF-only formatting changes may leave the village unchanged while deliberately resetting an old save. Saves are not sent to GitHub or synchronized between devices.

## Architecture additions

| File | Responsibility |
| --- | --- |
| `src/core/interior.mjs` | Interior defaults/configuration, semantic graph, floor plan, furniture and validation. |
| `src/core/village.mjs` | Village doors, NPCs, board, chest and environment action definitions. |
| `src/core/progress.mjs` | Action availability/effects, source-linked discoveries, quests, inventory and save serialization/restoration. |
| `src/core/combat.mjs` | Battle setup, legal movement, ranges, player actions, enemy tactics and idempotent rewards. |
| `src/game/physics.mjs` | Solid scene collision and interaction line of sight. |
| `src/components/GenerationPanel.tsx` | Targeted settings, graph preview and validated JSON configuration sharing. |
| `src/components/Battle.tsx` | Accessible tactical arena, actions, status and feedback. |

No new remote runtime service or asset dependency is required. Existing local Kenney sprites and the local font are reused; see `ASSETS.md` for attribution and licenses.

## Checks and handoff

The new progress/action suite has **9 passing tests** and combat has **10 passing tests**. They cover requirements and failure feedback; discovery source relations; repeat input; field-trip completion; key consumption; one-time rewards; lamps and scene events; save/configuration/quest restoration; malformed/versioned save fallback; legal arena movement; explicit turns; melee/focus range and obstacles; guard/focus resources; AI differences/fallback; terminal states; invalid-state recovery; anti-farming rewards; and repeated deterministic rounds.

The final complete-suite count, production build, and output-validation results belong to [`VERIFICATION.md`](VERIFICATION.md). **Browser preview/gameplay QA is not claimed for this update**, in accordance with the request to skip previews. This document does not claim a live deployment.

Upload the extracted ZIP's source contents at repository root, preserving `.github/workflows/deploy.yml` and dotfiles. Keep GitHub Pages' publishing source set to **GitHub Actions**, then push to the default branch. The existing pipeline builds and deploys static `dist/` output; no GitHub login, token, or deployment was performed as part of preparing this ZIP. Full setup, résumé replacement, and troubleshooting remain in [`README.md`](../README.md).

The scope stays small: four interior archetypes, a discovery quest, an optional sparring goal, a few inventory/cosmetic items, and three enemy behaviors. There is no mandatory grind, large economy/crafting tree, mid-battle save, audio requirement, or offline service worker. Static character art is reused with movement/facing/bob rather than a new animation asset pack.
