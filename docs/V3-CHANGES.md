# Version 3: The Missing Room

This update extends the existing portfolio village into a small seeded mystery RPG. It preserves the static résumé extraction/build/deployment pipeline, accurate professional records and links, working interiors, discovery journal, Forge and optional tactical sparring. The adventure's characters and events are original fiction, separate from the author's real résumé.

## One connected loop

Every generated map omits an archive. A shifted note leads to a damaged transmission; its restored signal reveals an old route tree; a network repair reconnects the archive; a logic relay releases the Quiet Indexer's final protocol. The ending gives the guardian a better rule: unfinished does not mean unwanted. Optional marginalia and a repeating-key afterword deepen the ending.

The mystery journal records pages and unresolved clues, draws their relationships, names the current objective, and offers travel to the right house. NPC lines react to progress. Professionally relevant objects still reveal optional real field notes, while the complete portfolio and original PDF remain accessible without completing a puzzle or battle.

## Authored story, seeded variations

The central dependency chain and puzzle rules are authored. The expedition seed varies room/village topology, layouts, puzzle values, assigned clue locations, encounter rolls, and optional details. Validation checks known answers, prerequisite availability, destination reachability, and the boss/ending path. Decorative changes do not rewrite the requested Prüfer topology.

New expeditions use a generated seed by default and allow manual seed entry. The same seed/configuration/generator versions reproduce a journey. A version 3 save book preserves up to twelve expedition slots instead of overwriting the previous world when another seed is chosen. Each slot uses the existing version 2 progress payload, extended with story/encounter flags. Version 2 journeys can be retained as a legacy slot. Preferences include audio and ordinary encounter enablement.

Saves remain local to the browser/origin. Source-PDF hash changes are handled explicitly; the expedition/session layer preserves an older slot when starting an updated résumé journey where capacity permits. Invalid saved text receives a warning and preservation path rather than silent deletion. Generation configurations continue to use their own explicit algorithm version 2; save-book version 3 and room-generator version 2 are different contracts.

## Six playable CS device types

- **Caesar:** calibration pair, numeric wheel, and live decoded preview.
- **Hamming(7,4):** seven toggles, parity coverage, live syndrome, actual bit repair and emitted-word validation. Even parity; parity positions 1, 2, 4. The exercise promises exactly one error and explains why double errors cannot safely be corrected by this code alone.
- **Prüfer:** select the smallest current leaf and its neighbor to draw each real tree edge. A guided step changes the actual graph; the final tree is validated through the encoder/decoder convention.
- **Graph repair:** reconnect two components with a bridge and trace a valid shortest unweighted route.
- **Logic relay:** toggle A/B/C/D to satisfy XOR and AND outputs. Equivalent correct switch assignments are accepted.
- **Vigenère:** optional repeating-key cipher with an explicit key clue and live plaintext preview. Spaces do not advance the key.

Generated instances have known solutions and graduated hints. After a full correct submission, a “What you proved” panel explains the concept using that exact instance: modular reversal, parity/data recovery, degree-frequency relationships, connectivity versus shortest hops, equivalent gate outputs or periodic-key weaknesses. Graph nodes support pointer/touch selection as well as the labeled keyboard controls. Devices show missing prerequisites, allow safe retries/replay, and never consume permanent resources. Cipher exercises are historical educational examples, not modern-security advice.

## Encounters and battle presentation

Actual walking drives a deterministic encounter tracker. It protects the first 440 pixels, enforces at least 520 pixels after an encounter, checks on travel intervals, and requires a 128-pixel warmup in each newly entered area. Optional `areaId` identifies the actual scene separately from its region, so library A to library B receives entrance protection while both keep the library enemy table. Region-specific probability and a bounded drought breaker keep encounters present without triggering every few steps. Menus, puzzles, zero-distance callbacks and teleport-size deltas cannot produce encounters; the previous opponent is excluded from immediate selection. The pause-menu checkbox can disable surprise encounters without disabling the story guardian.

One visible optional challenge in each scene uses a stable reward key. Raised devices/challenges are solid; crowded scenes attach their actions to accessible existing furniture without removing professional actions. Archive shortcut stations are present from the start and unlock in place, avoiding materializing obstacles on the player.

The original Copper Automaton, Ink Ambusher, Corrupted Signal, Signal Wisp and Footnote Mimic use different authored patterns. The Quiet Indexer combines learned patterns in the finale. Ordinary command encounters use a composed battle scene with distinct sprite positions, health bars, intentions, a message log, clear commands and short effects. The V2 tactical grid remains available for optional sparring.

| Command | Mechanical effect |
| --- | --- |
| Attack | 4 damage; analyzed exposure adds 2 and recovery openings add 1. |
| Guard | Reduces the immediate response by 5. |
| Analyze | Displays the full cycle, exposes the next strike, and reduces the next two damaging responses by 1. |
| Technique | 6 damage, or 7 with learned clues; interrupts the immediate response; one initial charge or two after knowledge is acquired. |
| Practice tonic | Restores up to 9 HP; one per encounter and cannot be wasted at full health. |
| Escape | Always succeeds, including leaving the boss to retry safely. |

Every command resolves one enemy response, except escape or a terminal victory. Victory/defeat/escape are terminal. Defeat does not remove discoveries, inventory or exploration progress. Ordinary encounters are short and are not required to unlock the main-story path. Ordinary wins award a cosmetic signal token; rare wins award a prismatic token. The victory text distinguishes these keepsakes from actual story clues; no grinding is needed.

## Real audio assets and a central manager

`public/audio/` contains **seven distinct original 7.68-second music loops and fourteen actual sound effects**. They are 16 kHz mono PCM16 WAVs composed from mathematical oscillators, deterministic noise, envelopes and original note sequences. No ripped samples or proprietary game themes are used. The files are offered under CC0; their details/license are in `public/audio/README.md`.

Music contexts are village, interior/archive, mystery, puzzle, ordinary battle, boss and victory. Effects cover footsteps, interaction, menus, confirmation, collection, pages, puzzle success, unlocking, encounter reveal, attack, hit, guard, win and loss.

`src/audio/audio.mjs` creates no AudioContext until a user gesture calls unlock. It loads requested assets lazily, keeps separate master/music/SFX gains, supports real mute, fades between tracks, caps effect overlap, throttles repetitive effects, suspends for pause/inactive tabs, and degrades safely if files or Web Audio are unavailable. Disposed managers can be unlocked again after React StrictMode cleanup. Audio settings provide sliders, mute, enable/resume and a test effect; preferences live with the existing expedition save book.

No clue depends on sound. Device/browser autoplay and listening quality have not been verified by the automated audio tests.

## Artwork and animation

Existing CC0 directional/action sheets add authored four-way movement, sword, shield, holding and fall frames. Run uses the gait at a faster cadence; interact/victory and hurt/defeat reuse compatible authored poses. NPC sheets include blink/working frames. The original keyed source sheet is retained; a cached runtime texture removes its exact key color. Battle character frames use that same texture/metadata, rather than shipping an altered sprite file.

The command battle adds short reveal, lunge, hit, guard and outcome effects with reduced-motion support and no input lock. It reuses existing enemy sprites. It does not claim independent custom frame sets for every enemy or state.

## New implementation areas

```text
src/core/mystery.mjs            Puzzles, story dependencies, pages, world decorations
src/core/expeditions.mjs        Seed/config derivation, save-book slots and preferences
src/core/session.mjs            Shared session restoration and validation
src/core/encounters.mjs         Actual-travel/region encounter pacing
src/core/duel.mjs               Command encounter state, patterns and outcomes
src/audio/audio.mjs             Central gesture-gated audio manager
src/components/PuzzlePanel.tsx  Interactive mathematical devices
src/components/MysteryJournal.tsx
src/components/EncounterBattle.tsx
src/components/AudioSettings.tsx
src/components/ExpeditionPanel.tsx
public/audio/                  Local original loops and effects
```

## Checks and limitations

The encounter/duel/audio suites currently contain **18 passing tests**: five pacing/area/region tests, six command-battle tests and seven audio tests. Audio tests use a fake AudioContext to verify lifecycle, duplicate-loop prevention, volume/mute, bounded effects, suspension, failure handling and StrictMode reuse. Separate file checks read every real WAV, verify its format and nonempty samples, and confirm all seven music loops differ. The production validator requires all 21 WAVs and the new directional/NPC atlases in the actual `dist/` artifact.

Other generation, puzzle, story, expedition, movement and existing regression tests are summarized with final executed counts in [`VERIFICATION.md`](VERIFICATION.md). Type checking was executed successfully after the new battle/audio components. No browser preview, gameplay play-test, listening test or deployment is claimed in this document.

Scope remains controlled: six puzzle types, one authored mystery/ending, four interior archetypes, a small recurring cast, short encounters, optional margins and retained sparring. No party system, creature capture, large crafting economy, offline service worker or mid-battle save is implemented. The visual composition and audio autoplay still need real-device review. The repository remains fully static, supports project-site subpaths, and deploys through the existing GitHub Actions Pages workflow after its owner uploads/pushes the ZIP source contents.
