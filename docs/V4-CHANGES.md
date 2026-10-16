# Version 4 handoff

V4 extends the existing static React/Vite/Canvas project. The résumé ingestion pipeline, original PDF, professional links, 14 source houses and 51 supplied records remain intact. The six existing CS tasks keep their learning rules. The adventure's Glitch Garden, devices and creatures are fictional additions; the complete Portfolio and original Résumé remain directly available without solving or fighting.

## Structural fixes and room composition

Interior exits use intentional room-boundary thresholds with matching visible openings, foot collision, usable interaction points and safe spawn positions. The connection helper records all 16 cardinal adjacency masks: isolated tiles, ends, horizontal/vertical runs, corners, T-junctions and crosses. Roads and corridors render their actual connected arms using the existing art. Reachability tests exercise generated geometry and the same foot-circle rules used for movement.

Room roles now select curated compositions: reading nooks and shelves, prototype benches and parts racks, residences with keepsakes and plants, and studio seating/equipment. Large features and required clearances precede secondary decoration. Stable functional identities and independent decoration choices preserve requested room trees and essential routes. This is a refinement of the existing four archetypes, rather than a second generation system.

## Relaxed surprise encounters

The default is **Calm**, targeting approximately 12 minutes of **eligible active movement**, with no guaranteed deadline. A deterministic 100-seed first-encounter calibration measured a mean of 699.3 seconds (about 11.65 minutes). Individual rolls vary, and region weights can change the distribution.

| Profile | Nominal mean | Movement cooldown | Roll interval after cooldown | Fresh-area protection |
| --- | --- | --- | --- | --- |
| Calm | 12 minutes | 8 minutes | 30 seconds, 12.5% base probability | 20 seconds |
| Balanced | 6 minutes | 3.5 minutes | 20 seconds, 13.33% base probability | 15 seconds |
| Chaotic | 2 minutes | 1 minute | 10 seconds, 16.67% base probability | 10 seconds |

The Game reports successful displacement and the corresponding movement seconds. Partial movement scales eligible time; blocked frames, idle time, menus, conversations, puzzles, battles, pause and teleports do not advance the tracker. Running covers more ground without accelerating the encounter clock. Spawn and completed encounters receive the profile cooldown. Each actual scene identity receives entrance protection, so two libraries remain distinct areas while sharing their opponent table. There is no drought deadline that forces a battle. Immediate repeat opponent types are excluded.

The pause menu's **Exploration mood** changes the profile and optional activity/population settings. **Surprise encounters while walking** can disable random battles. Explicit challenges, tactical sparring and the story guardian remain available. Ordinary/rare victories retain cosmetic signal/prismatic tokens. Old distance histories retain their encounter counts and migrate with a fresh eligible-time cooldown instead of immediately triggering a battle.

## Repair a crossing and enter the Glitch Garden

The bridge task retains its connectivity and shortest-route concept, presented on a wider interactive board with visible link choices, route trace, repair feedback, optional help and large controls. Restoring the route tree and bridge changes the world: a solid canal crossing becomes passable, the garden entrance opens, and the map offers the unlocked destination. The lock is also checked by transitions and save restoration.

The garden uses stable building ID `secret:glitch-garden`. It is a separately generated four-room workshop destination with curated names: Arrival Conservatory, Relay Nursery, Debugging Glasshouse and Moonseed Observatory. It has local fauna, an unfinished notebook and a regulator testbed. Repairing the regulator marks it powered/restored. Enter/exit, map navigation and saves use the same identity. The garden is outside the original résumé tree and adds no source records.

## Ten activity families

The retained six are Caesar decoding, Hamming(7,4) single-error correction, smallest-leaf Prüfer decoding, bridge connectivity/shortest path, XOR/AND logic and the optional Vigenère afterword. Four new optional families add hands-on experiments:

| Activity | Interaction and validation |
| --- | --- |
| Packet Post | Rotate routers, send a packet, inspect its trace, and avoid broken tiles, loops and the hop limit. Higher profiles can require a relay checkpoint. |
| One Busy Processor | Queue non-preemptive jobs so dependencies finish first and deadlines hold. The timeline reports exact failing requirements. |
| Glitch Garden Testbed | Inspect intermediate values, replace one faulty operator and rerun every permitted finite input case, including boundaries where applicable. |
| The Patient Seed Shelf | Compare the held seed packet with its left neighbor, slide only strictly larger packets, then insert into the gap. Equal sprouting times preserve their original order, demonstrating stable insertion sort. |

Homes host sorting shelves, libraries packet routing, studios scheduling and workshops debugging, including the garden's regulator. Each family uses the expedition seed, profile and stable site identity, has concise help, graduated hints, retry, a known valid answer and a validated bounded fallback. Profiles alter instance size/constraints without changing the concept. Successful sites change their terminal/powered state and award their cosmetic badge once. Completion keys identify the site and activity type independently of rerolled instance values, so a new layout/profile cannot repeatedly grant the same reward. These activities are optional for reading professional content.

## Living actors and companions

Six data-driven fauna reuse existing Tiny Dungeon sprites: curious **Margin Mouse** (124), shy **Bookmark Bat** (120), playful **Jelly Byte** (108), territorial fictional **Clockwork Spider** (122), flower-foraging **Garden Mouse** (124) and fictional **Lantern Moth** (120). The last two are behavior/habitat variants using existing mouse/bat artwork, not new sprite sheets. Garden Mice seek safe flower/grass patches; Lantern Moths pause beside lamps/readable objects and face the point of interest. Habitats select suitable species. Stable individuals receive seeded speed, wander radius, approach distance and rest tempo that affect movement and decisions. Rare glimmers are cosmetic. The **Roaming Caretaker** (84) patrols valid village waypoints and offers a contextual exploration tip; it has no feeding/taming interface.

The first village animal and caretaker prefer safe habitat roughly 64–176 pixels from canonical spawn, avoiding roads, required interaction clearances and the locked canal side. Other fauna distribute through eligible ground. Spawning, local target selection, navigation searches and the total population are bounded; no more than nine living actors are simulated, including the caretaker and a companion. They follow static collision and pause with panels. They remain non-solid to the player so they cannot close an essential route or doorway.

One **Observe** plus one valid favorite snack earns full trust: Margin Mice prefer grain; Garden Mice, bats and slimes berries; clockwork spiders and Lantern Moths sparks. Shy bats require observation before accepting food. The action validates the current scene, area, proximity, legal positions and line of sight. Wrong food, empty stocks, repeated feeding and invalid reach spend nothing. The **Community picnic basket** is the village's free pantry and restores each food stock to eight; no harvesting or battle grind is required.

A friend can **Follow**, **Wait here**, or **Release to its routine**. Only one companion is active. Followers arrive near the player on safe ground after scene changes; waiting friends remain in their chosen area and cannot simultaneously respawn in their native area. Release keeps the friendship. Relationship IDs survive decoration changes. Ordinary roaming positions are transient; relationship, food and companion command/wait location state persist.

The village also has a **quiet bench** with a brief resting interaction and a **Little village book exchange** with a shared bookmark note. These existing-asset objects add small contextual moments between experiments without creating a new resource loop.

## Longer ambient music

Seven authored ambient tracks use slow pad and felt-key motifs: village, interior and puzzle run 192 seconds each; mystery 144 seconds; battle, boss and victory 96 seconds each. Together they provide 16 minutes 48 seconds of composed material. Context changes resume each track's saved playhead, with crossfades and a two-track decoded music cache to bound memory use. The existing 14 local sound effects, gesture-gated startup, mute/volume controls and pause/inactive-tab suspension remain. These descriptions document the composition and implementation, without claiming a listening test or browser autoplay verification.

## Controls and saved journeys

Walk with WASD/arrows, run with Shift and interact with E/Enter/Space or a nearby object click. Escape opens/closes panels; the compact footer provides expandable controls. Touch movement controls appear on touch devices and remain hidden in desktop keyboard/pointer use. Menus retain directional focus movement, Enter/Space activation and normal form editing. The first-objective prompt appears once per journey. Detailed puzzle instructions/hints are available through contextual disclosure.

The save book stays **schema version 3**, wrapping **version 2 progress**, so V3 expeditions remain compatible. New data is held in validated flags: `v4:devices`, `v4:garden-restored`, `v4:creatures` and onboarding state. Creature JSON has its own version and seed validation; the encounter wrapper keeps version 3 with `pacingVersion: 4`. Invalid creature data falls back to safe fresh actor state rather than executing imported data.

Session restoration reconstructs canonical seeded placement before checking saved feet against actual decorated geometry. Valid positions are retained; an invalid position moves to a safe entrance with a warning and preserves discoveries/rewards. A locked garden restores to a valid village position. Changed résumé hashes create a separate journey when space allows. Invalid/incompatible stored books are preserved with automatic writes protected, rather than silently replaced. Journey/book imports append slots up to the existing limit of 12.

## Build, upload and limits

Use Node.js 22.13 or newer, then `npm ci`, `npm test` and `npm run build`. The source ZIP is meant to be uploaded at repository root, preserving `.github/workflows/deploy.yml` and dotfiles. Choose **GitHub Actions** as the Pages publishing source and push to the repository's default branch. The workflow generates `dist/` and deploys it; generated data stays ignored in source. Relative `base: './'` supports repository subpaths. Custom domains remain optional through normal Pages/DNS setup and an actual `public/CNAME` if required. See the README for the unchanged PDF/configuration and complete publishing instructions.

This handoff does not claim a browser playthrough, live deployment, listening test or device visual check. Automated model/geometry/action tests and static build checks are recorded separately in [`VERIFICATION.md`](VERIFICATION.md). Actors use small local AI and existing sprites rather than a full ecology or bespoke animation set. Mid-battle state is not saved. All runtime features remain local and static, with no service, account, secret, API or database.
