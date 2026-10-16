# The Missing Room · World of Work

A small, replayable mystery RPG portfolio built with React, TypeScript, Vite, and Canvas. Every generated village has the same strange omission: an archive that the maps insist should not exist. Follow connected clues, repair machines, reconstruct routes, meet the Quiet Indexer, and leave room for unfinished ideas. Real résumé projects remain optional discoveries inside the adventure.

Version 4 builds on the existing village, interiors, six connected CS tasks, discovery journal, Forge, expedition saves, battles, sprites, and original music/SFX. It corrects boundary doors and connection geometry, makes random battles rare by default, opens a physical Glitch Garden after repairing its bridge, adds four optional CS activities, and brings in roaming creatures, a caretaker and cozy village objects using existing licensed assets. No proprietary game characters, music, or story content are used.

The included résumé produces **14 destinations and 51 records**: profile, education, languages, creative skills, technical skills, activities, teaching experience, summer school, content creation, projects, leadership, other work, research, and contact. These counts describe the supplied PDF, not fixed requirements. Updating the PDF can change the count, sizes, default sequence, layout, and displayed content.

All PDF extraction, résumé normalization, and default village generation happen before deployment. Visitors receive static HTML, JavaScript, CSS, JSON, local sprites, and the original PDF. The browser generates interiors and custom configurations locally from that structured data. There is no server, database, API service, authentication, AI parsing service, or secret to configure. Local generation never changes résumé content.

## Begin an expedition

Start with the generated shareable seed, or enter your own seed in the expedition interface. A new expedition creates another save slot, preserving the previous journey. You can return to a saved expedition or replay a seed; the same seed and generator version reproduce its topology and puzzle instances. Up to **12 expeditions** are retained before the interface asks you to export/back up rather than overwrite a journey.

The **mystery journal** links collected pages, missing clues, the current objective, and the next house to visit. NPC dialogue and device results change as the mystery advances. The main sequence is authored and validated; the seed changes puzzle values, location choices, layouts, encounter rolls, and optional details around it. Quiet stretches, optional margins, and existing professional field notes remain available between story beats.

### Six connected CS devices

| Device | What you do | What changes |
| --- | --- | --- |
| Caesar margin | Use the calibration pair and decoding wheel to recover the shifted note. | Reveals the damaged transmission's clue. |
| Hamming(7,4) console | Inspect even-parity groups, compute the syndrome, and flip the promised single damaged bit. | Restores a signal/page and the route sketch. |
| Prüfer route sketch | Select each smallest current leaf and its next neighbor, drawing the actual decoded tree. | Reveals the omitted archive route. |
| Network repair | Choose a bridge reconnecting two islands, then trace a shortest route. | Restores access to the archive clue. |
| XOR/AND relay | Toggle four switches until both target outputs match. | Releases the Quiet Indexer's final protocol. |
| Vigenère afterword | Apply the repeating-key clue and inspect the changing plaintext preview. | Adds an optional page and deepens the ending. |

Every device has state-aware explanations, graduated hints, retries, a known valid generated answer, and a visible effect on the mystery. A correct solution opens “What you proved,” explaining the CS concept with your exact values. Click/tap graph nodes directly or use the labeled keyboard controls. Hamming uses even parity with positions 1, 2 and 4 as parity bits; correction is valid under the explicitly promised single-error condition. The classical ciphers are educational historical puzzles, not secure encryption. You never need to read a long résumé description to solve the story.

### Four optional experiments and a physical secret

The six existing tasks remain intact. Four additional activity families bring the total to **ten**: **Packet Post** routes a packet by rotating arrows while detecting loops and hop limits; **One Busy Processor** schedules jobs around prerequisites and deadlines; **Glitch Garden Testbed** diagnoses one wrong machine operator against every finite input case; **The Patient Seed Shelf** teaches stable insertion sorting by comparing, sliding and inserting seed packets while preserving equal-value order. Homes host the sorting shelf, libraries routing, studios scheduling and workshops debugging. Each offers immediate simulation feedback, retry, optional hints, and a generated valid answer. Calm, Balanced, and Chaotic profiles change their bounded challenge sizes and constraints. Completion and its cosmetic reward are recorded once per stable site/activity identity, so rerolling an instance cannot farm rewards.

The **Glitch Garden** is a separate fictional destination beyond a solid canal and sealed crossing. Solve the Prüfer route sketch and the bridge repair to make the actual bridge passable and unlock the garden entrance and map action. Its conservatory, nursery, glasshouse, and observatory contain an optional debugging activity, a margin note, and local fauna. Restoring its regulator changes the garden's powered state. Entering, leaving, map travel, save restoration, and the lock all use the same destination identity; this extra location adds no invented professional records to the original 14 résumé houses.

### Route encounters and command battles

Walking can reveal a **Copper Automaton**, **Ink Ambusher**, **Corrupted Signal**, **Signal Wisp**, or **Footnote Mimic**. Encounter tables depend on the region and seed. The default **Calm** profile targets roughly **12 minutes of eligible movement** between surprise battles; a reproducible 100-seed calibration averaged about **11.65 minutes** to the first encounter. This is a probability baseline, not a fixed deadline. Balanced targets about six minutes and Chaotic about two. Walking and running count the same actual movement time; blocked input, menus, puzzles, battles, pause, and teleports count nothing. Cooldowns protect the first stretch and every completed encounter, while a separate entrance warmup protects each new area, including another interior of the same type. Immediate repeat opponents are excluded.

Ordinary wins award cosmetic **signal tokens**; rare variants award **prismatic tokens**. Random encounters are not prerequisites for the main story. The pause menu's **Surprise encounters while walking** checkbox disables surprise battles while leaving scripted, explicitly initiated, and story guardian battles available. Existing encounter history migrates to the new pacing without turning old travel distance into an overdue battle.

Ordinary encounters use a composed sprite battle scene with health bars, enemy intention, messages, and fast commands. **Attack** deals 4 damage. **Guard** blocks 5 damage from the response. **Analyze** records the repeating pattern, exposes the next strike for 2 bonus damage, and weakens the next two incoming attacks. **Technique** interrupts a response and spends a limited charge; solved clues improve its strength/charges. Each encounter supplies one **practice tonic**, and **Escape always works**, including retreating from the story boss to retry later. Defeat never erases exploration progress.

The **Quiet Indexer** uses patterns introduced by ordinary encounters. Solving the five main devices enables the final protocol; understanding its charges, heavy strikes, pulses, and recovery openings is more useful than grinding. The existing optional tactical grid sparring remains available separately; its older turn rules are documented below.

### Sound and animation

Audio begins only after a user gesture. The **audio settings** offer master, music, SFX, mute, an enable/resume button, and a test effect. Seven original ambient tracks use slow pads and felt-key motifs: village, interior and puzzle tracks run **192 seconds each**, mystery **144 seconds**, and battle, boss and victory **96 seconds each**, totaling **16 minutes 48 seconds**. The manager resumes each track's saved playhead when returning to its context and caps decoded music caching at two tracks. Fourteen local WAV effects cover movement, interactions, collection, pages, puzzle success, doors, encounters, attacks, guard, and outcomes. The manager fades changes, bounds effect overlap, handles failed assets, and suspends for pause/inactive tabs. Settings persist with the expedition save book. Audio is optional for understanding every clue; no listening-quality assessment is claimed.

Existing CC0 action sheets supply distinct directional movement frames plus authored sword, shield, holding, and fall frames. Run reuses the authored gait at a faster cadence; interact/victory and hurt/defeat reuse compatible authored poses. These are not claims of independently drawn frame sets for every state. Battle attack/hit/guard/reveal effects stay below 300 ms and do not lock input; reduced motion disables decorative effects. Audio-manager behavior and actual WAV files are tested, while listening quality, browser autoplay, and visual feel still need device/browser verification.

## Run locally

Install **Node.js 22.13 or newer**. From the repository root:

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. Development first extracts the source PDF and regenerates the data. After replacing the PDF during development, restart the development command or run `npm run generate-world`, then refresh.

| Command | Purpose |
| --- | --- |
| `npm ci` | Install the exact versions recorded in `package-lock.json`. |
| `npm run dev` | Generate résumé/world data and start the local development site. |
| `npm run extract-resume` | Extract, normalize, and validate the PDF; write résumé JSON. |
| `npm run generate-world` | Rebuild résumé JSON, world JSON, original public PDF, and fallback portfolio. |
| `npm test` | Run ingestion, Prüfer, village/interior geometry, movement, actions, saves, quests, and combat tests. |
| `npm run typecheck` | Check TypeScript application types. |
| `npm run build` | Generate data, check types, build with Vite, and validate the static output. |
| `npm run preview` | Serve the existing production `dist/` build locally. |

For the complete local check:

```sh
npm test
npm run build
npm run preview
```

Opening `index.html` directly through `file://` does not reproduce a hosted site: browsers restrict JSON loading. Use the development or preview command.

## Explore and read

- Select **Enter the village**; the game receives keyboard focus.
- Use **WASD** or **arrow keys** to walk, and hold **Shift** to move faster.
- Press **E**, **Enter**, or **Space** near a door, NPC, sign, or object to open its context-specific actions.
- Press **Escape** or select **Menu** to pause. Escape also closes an open panel.
- On touch devices, hold the directional buttons and select the interaction button near a usable object. Desktop keyboard/pointer play keeps the touch pad hidden.
- **Journal** opens the mystery's pages, connected clues and current objective. **Portfolio** opens the complete professional reading view immediately. The pause menu also offers the optional **Discovery journal** for source records found through exploration.
- **Village map** lists destinations and offers fast travel; houses in its overview are also keyboard accessible.
- **Forge** configures the village or one selected interior, with manual/random valid codes, independent layout/decoration seeds, defaults, and versioned configuration import/export.
- Select the name in the header, or the pause menu's return action, to return to the title screen.
- **Résumé** downloads the original PDF. `portfolio.html` offers the complete conventional reading view and works without JavaScript.

Movement stops while a panel is open. In menus, **WASD/arrows** navigate controls, **Enter/Space** activates them (including checkboxes), **Tab/Shift+Tab** cycles focus, and **Escape** closes the panel. Text fields, sliders and select controls retain their normal editing behavior. Leaving browser focus clears held controls. Diagonal movement is normalized, collisions use substeps to prevent passing through buildings at low frame rates, and the camera follows the explorer. Gameplay suppresses movement-key scrolling only while the game canvas receives input. Reduced-motion settings remove decorative motion and camera easing.

The opening prompt introduces the first objective once per journey. The compact footer's **Controls** disclosure and optional device help keep detailed guidance available without repeating it around every action. The bridge activity uses a wider interactive board with large node controls, a visible repair result, and the same keyboard/touch interaction model as the other devices.

### A short exploration loop

Visit the Archivist or notice board, accept the first field trip, then enter a house. Use its books, project terminals, desks, or displays to reveal actual résumé records. **Inspect** gives a clue; the explicit discovery choice records the associated field note. Different objects offer different menus. Leave by the marked exit to return to the village. Your discoveries survive transitions and configuration changes.

Find **three distinct records across at least two houses** to complete the field trip and receive one **field key**. The quest also starts automatically on your first discovery, so missing the notice board does not strand your progress. The key opens the village **Curiosity chest**, is consumed once, and awards a cosmetic badge. Opened containers and one-time rewards stay completed after revisiting or regenerating layouts.

The discovery journal is an optional exploration goal. The **complete reading view**, all professional links, contact details, and the original résumé PDF remain accessible independently of it; no résumé information requires a battle.

### Interiors and solid objects

The exterior houses retain their coherent village appearance. Their interiors use four reusable purposes:

| Interior | Functional objects and atmosphere |
| --- | --- |
| Home | Living/private areas and personal field notes. |
| Library | Shelves, reading/research areas, and discoverable documents. |
| Workshop | Workstations, project terminals, tools, and storage. |
| Studio | Creative work, performance/writing displays, and an open work area. |

Furniture, buildings, trees, rocks, signs, and suitable environmental props have solid footprints. Flowers and minor ground details remain passable. Objects expose a usable interaction side; a wall or solid prop between you and that side prevents interacting through it. Interior generation validates routes from entrance to exit and to functional objects. Lamps can be toggled, inspection can offer clues, and discovery actions unlock only their assigned source records.

Door thresholds now sit at room boundaries, with matching openings, collision and interaction zones. Four-neighbor adjacency masks describe horizontal/vertical routes, corners, ends, T-junctions and intersections; the renderer draws their actual connected arms. Curated room compositions add shelves, workstation groups, seating, plants, tools, rugs and wall details after reserving required routes. Decoration changes preserve functional location identities and requested topology.

### Creatures and a roaming caretaker

The **Margin Mouse** is curious, the **Bookmark Bat** is shy, the **Jelly Byte** is playful, and the fictional **Clockwork Spider** stays near its workshop territory. A **Garden Mouse** forages at flower/grass patches, while the fictional **Lantern Moth** visits lamps and reading spots and faces the point of interest. These six fauna reuse existing mouse, bat, slime and spider artwork. Habitats choose eligible fauna. Each stable individual has seeded speed, roam radius, approach distance and rest tempo; occasional rare glimmers are cosmetic. A first animal and the **Roaming Caretaker** prefer safe habitat near the starting area, and the caretaker patrols short valid waypoints and offers an exploration tip.

Approach a creature and choose **Observe**, then offer its favorite snack: grain for Margin Mice; berries for Garden Mice, bats and slimes; sparks for clockwork spiders and Lantern Moths. One observation and one valid snack earn trust; a shy bat needs observation first. Invalid, distant, obstructed, out-of-area, repeated or unsuitable feed attempts spend no food. The village's **Community picnic basket** serves as a free pantry, refilling each snack to eight. A befriended animal can **Follow**, **Wait here**, or **Release to its routine**; one companion can accompany you, and friendship remains after release. Waiting and following survive saves, and followers arrive on safe ground in a new area. Living actors avoid static obstacles but never become solid barriers across essential paths. The population is bounded at nine, including the caretaker and companion.

A **quiet bench** offers a short resting moment, and the **Little village book exchange** holds a shared bookmark message. These optional village objects provide small encounters between larger tasks without adding new inventory chores or blocking professional reading.

### Optional tactical sparring

Talk to the sparring mentor to choose **Guard**, **Skirmisher**, or **Ranger**. The match uses a small **7 × 7** arena with obstacles, a visible enemy intention, health, legal movement highlights, and a short action log.

Each player turn permits **one move of up to two reachable tiles** and **one action**, in either order. Select **End turn** to resolve the opponent's move/action and begin the next player turn.

- **Attack:** 3 damage to an adjacent opponent.
- **Guard:** reduces the next enemy hit by 2, then expires.
- **Focus:** 2 damage within three tiles with clear line of sight; two charges per match.
- **Retreat:** immediately leaves practice safely.

The Guard holds position and advances when approached; the Skirmisher closes distance; the Ranger seeks a clear shot from a distance. Opponents cannot occupy your tile or pass through obstacles. Victory awards an optional sparring badge once per opponent type; replaying or rerolling seeds cannot farm rewards. Defeat and retreat cause **no permanent health, inventory, discovery, or quest loss**. The practice battle ends and you recover before returning to exploration.

### Saves and regeneration

Each exploration slot retains the existing **version 2 progress format**, wrapped by the **version 3 expedition save book** for compatibility. V4 extends validated flags with activity completion, garden repair and creature relationships/food/companion state; the encounter tracker retains its compatible wrapper with an explicit new pacing version. It also retains discoveries, visited houses, opened containers, one-time actions, inventory, quests, optional wins, position, stored village/interior configurations and mystery state. The save book stores expedition identities/seeds and audio/encounter/profile preferences. Existing version 2 journeys are retained as a legacy slot. Interiors are reconstructed from configuration instead of saving a large map snapshot.

Saves are local to that browser and origin; they are not uploaded to GitHub or synchronized between devices. If the source résumé's **PDF hash changes**, the session starts an updated résumé journey in a **separate slot**, preserving the previous saved text. If no slot is available, automatic writes are protected rather than overwriting the earlier journey. Malformed or incompatible save books show a warning and remain untouched in storage while automatic writes are disabled. Normalized world generation can stay identical across PDF encoding-only changes, but progress identity deliberately follows the source PDF hash.

Changing generation settings preserves discoveries and rewards. Stable object/action, activity and creature IDs keep one-time consequences and relationships when decoration positions change. Reload reconstruction uses the canonical entrance for seeded placement, then restores saved feet only if they are valid against the decorated scene; a necessary safe-position correction shows a warning and preserves discoveries. Returning to the village uses a safe exterior position. A locked garden cannot be restored as an accessible destination. Generation configuration sharing and personal save progress are separate: importing a configuration does not import someone else's inventory or quest rewards.

You can **Export journey save** from the menu or export every expedition together, then paste either valid journey JSON or a version 3 save book into the import control. Imports validate résumé identity, configurations and positions, and **append new slots** while preserving existing expeditions. Import is rejected if it would exceed the **12-slot limit**; it does not replace the current book silently.

## Update the résumé

1. Replace **`resume.pdf`** at the repository root with a searchable, text-based PDF.
2. Optionally run `npm test` and `npm run build` locally.
3. Commit and push the replacement to the repository's **default branch**.

GitHub Actions installs locked dependencies, runs tests, extracts the PDF, validates the normalized data, generates a deterministic world, builds the site, validates the deployed files, and publishes the resulting `dist/` artifact. A successful deployment replaces the previous site with the new résumé content. A failed extraction or validation stops deployment and leaves the previously deployed site in place.

Routine updates require no edits to React components, coordinates, or generated JSON. Unusual PDF headings or layout can require a configuration adjustment described below.

**Public content:** the published original PDF and all extracted résumé data are public. Review contact details and other information in your PDF before publishing it to a public repository or Pages site.

## Résumé pipeline

`scripts/extract-resume.mjs` uses the build-only `pdfjs-dist` dependency to extract text and hyperlink annotations. It groups PDF runs by their coordinates, preserves useful ordering, and detects ordinary two-column pages. Embedded links are retained even when visible URLs wrap across lines or a label such as a GitHub username hides the URL. The PDF is treated as data; evaluation is disabled.

`scripts/normalize-resume.mjs` normalizes whitespace, matches configured heading aliases, collects identity/contact data, and groups numbered entries and wrapped bullets. It supports optional sections and keeps the source text for audit. Records have stable identifiers, dates, subtitles, details, and safe links. The supplied PDF has no separate professional title; the display label “Computer Science · Mathematics · Creative Practice” is derived from its education and creative content. The parser does not invent missing employers, dates, metrics, or links. Default village props and every default interior are also generated and validated during the build, so an unsupported source cannot silently publish an unusable scene.

Validation rejects empty content, unrecognized section sets, missing identity, duplicate identifiers, malformed records, and unsafe URLs. Text in the no-JavaScript portfolio is HTML escaped; React renders résumé content as text. External web links use `noopener noreferrer`.

`scripts/build-data.mjs` uses the shared world generator and writes:

```text
public/generated/resume.json
public/generated/world.json
public/resume.pdf
public/portfolio.html
```

These generated files, `node_modules/`, and `dist/` are **ignored by Git**. GitHub Actions regenerates them from the source PDF and configuration. It never commits generated files back to the source branch. The original `resume.pdf` remains the source of truth, and the deployed artifact contains one PDF copy.

### Heading and column configuration

Edit `config/resume.config.json` when supporting a materially different PDF format. Most normal updates need no configuration changes.

- `resumeFile`: relative path to the source PDF; defaults to `resume.pdf`. If you relocate it, also add the new source path to the deployment workflow's `paths` filter.
- `sectionAliases`: heading spellings mapped to `{ id, type, label, aliases }`. Matching ignores capitalization, punctuation, and spacing.
- `columnMode`: `auto` normally; `single` forces ordinary full-width page ordering.
- `pageColumns`: optional per-page overrides, such as `{ "2": 2, "5": 1 }` for two columns on page 2 and one on page 5.
- `minimumTextCharacters`: extraction threshold; defaults to 80 characters.

To support another meaningful section, add an alias group, for example:

```json
{
  "id": "community",
  "type": "volunteering",
  "label": "Community",
  "aliases": ["Civic Contributions", "Community Projects"]
}
```

The generator automatically creates a destination for populated sections, including new types. Unknown types receive the general importance weight and a house. Add a custom weight in `scoreSection` only if you want different size semantics; it is not required for ingestion or rendering.

## Prüfer code and procedural layout

For **n** houses, vertex labels are **1 through n**, and the Prüfer sequence contains **n − 2** values. Repeated values are allowed. One or two houses use an empty sequence. A world with no meaningful content produces a clear build error.

The decoder initializes every degree to one, increments degrees for sequence appearances, repeatedly joins the smallest degree-one label to the next sequence value, decreases both degrees, and finally joins the last two leaves. This yields a connected, acyclic tree with exactly **n − 1** edges. The encoder applies the same smallest-leaf convention and validates input relationships. Tests round-trip every possible sequence through six vertices.

The default sequence uses a stable hash of normalized content and the generation version. It ignores PDF byte-format changes and source-text whitespace that do not change normalized content. A seeded pseudorandom generator selects valid labels, weighted by section importance. The same normalized résumé and generation configuration produce the same world.

Importance combines section type, entry count, accomplishment/detail count, links, and a bounded text contribution. Entry/detail counts have more effect than a long paragraph; word contribution is capped at ten points. Profile and skills/contact sections have additional caps. Four sprite-compatible sizes range from **48 × 64** to **96 × 96** world pixels. Every destination uses an existing house asset, with deterministic visual variations.

Coordinates are generated separately from connectivity. The layout roots the tree at the profile house when present, otherwise the most important house; traverses children in label order; assigns each subtree a disjoint horizontal interval; places houses by depth with deterministic small horizontal offsets; and connects entrances through courtyards and reserved side corridors. Orthogonal paths follow the actual tree edges, avoid buildings, and keep unrelated branches from crossing or touching. Nearby edges may share their own house's courtyard. The spawn point is near the root entrance.

Seeded trees, bushes, flowers, and rocks avoid roads, entrances, buildings, and the spawn zone. Buildings stay within computed world bounds. The camera and map menu support larger trees.

A visitor's valid custom village code regenerates the tree, coordinates, routes, and decoration through the **same `src/core/world.mjs` generator** used at build time. Invalid input shows an error while preserving the current map. Custom configurations are stored with local exploration progress and do not modify repository files or the résumé.

### Configure room topology separately

In **Forge**, select **Village** or a specific building interior. The village house count is read-only because it comes from the résumé. Interiors support **2–10 rooms** and configurable home/library/workshop/studio archetypes. A room graph describes semantic room connections; each node represents a room, not a floor tile.

Enter `n − 2` labels from `1` through `n`, or use **Generate valid random code**. Repeated labels are legal. Separate **layout seed** and **decoration seed** fields control independent streams: changing decoration does not change the requested room graph. The editor previews the room graph and names its assigned room roles. **Restore defaults** populates the editor; select Generate to apply them.

The interior pipeline decodes the tree, assigns archetype-compatible public and private functions, sizes and places rooms, connects boundaries with doorways/corridors, places furniture with usable adjacent spaces, then checks overlap, movement, exit/object reachability, and semantic requirements. Private roles are assigned to leaf nodes so they do not become mandatory routes to public functions. Invalid input or incompatible constraints produce feedback; the requested Prüfer tree is never silently rewritten.

**Download configuration** exports JSON; paste it under **Import a shared configuration** to validate and apply it. The compact configuration records `algorithmVersion: 2`, scope, building/archetype where relevant, node count, sequence, layout seed, and decoration seed. Identical valid full configurations reproduce the same interior. Old algorithm versions are rejected explicitly; reset or recreate them rather than silently obtaining different geometry.

Example interior configuration:

```json
{
  "algorithmVersion": 2,
  "scope": "interior",
  "buildingId": "location-projects",
  "archetype": "workshop",
  "nodeCount": 4,
  "sequence": [1, 2],
  "layoutSeed": "first-workshop",
  "decorationSeed": "quiet-afternoon"
}
```

Use a building ID from the current résumé. Imported settings are validated before generation, and the original portfolio content remains unchanged.

## Publish on GitHub Pages

1. Extract the ZIP and create a GitHub repository.
2. Upload the **contents of `parshwa-world/` to the repository root**, including `package.json`, `package-lock.json`, `resume.pdf`, `src/`, `public/assets/`, `scripts/`, `config/`, and **`.github/workflows/deploy.yml`**. Preserve dotfiles such as `.gitignore`. Do not upload only the unopened ZIP or place the entire source inside another folder.
3. In the repository's **Settings → Pages**, choose **GitHub Actions** as the publishing source.
4. Push/commit the source to the repository's default branch. Alternatively open **Actions → Build résumé village and deploy Pages → Run workflow**, selecting the default branch.
5. Wait for both build and deployment jobs to succeed, then use the Pages URL shown by GitHub.

The workflow works with any default-branch name: pushes are filtered to relevant files, and its build guard compares the current branch with GitHub's configured repository default branch. Manual runs from other branches are intentionally skipped. No personal access token is needed. The workflow uses official checkout, Node setup, Pages configuration, artifact upload, and Pages deployment actions; deployment alone receives `pages: write` and `id-token: write` permissions.

Production files are fully static and come from **`dist/`**. GitHub Actions uploads that directory as a Pages artifact rather than deploying the source files. The repository name does not need to be `username.github.io`.

### Repository subpaths and custom domains

`vite.config.ts` uses **`base: './'`**, and data/PDF links are relative. Assets therefore work under a project URL such as `https://USERNAME.github.io/REPOSITORY/` as well as at a domain root. You do not need to edit source files to match your repository name. Avoid replacing relative paths with root paths such as `/resume.pdf`.

If you later add a custom domain, configure the chosen domain and DNS in GitHub Pages. Add a `public/CNAME` file containing your actual domain if GitHub's setup calls for it; Vite copies it into `dist/`. The relative base remains valid. This project does not assume or invent a custom domain.

## Tests and output checks

Automated coverage includes PDF wrapper errors and scanned-file detection; normalization and optional/configured headings; current-source integration; annotation links; safe HTML/URLs; wrapped bullets; stable identifiers; relative asset paths; Prüfer validation and encoding/decoding; edge count/connectivity/cycles; importance sizing; deterministic defaults; altered custom topology; village/interior bounds and overlap; path/door endpoints; unrelated road crossings; semantic room functions; furniture/decoration clearance; diagonal speed; solid-object collisions, wall sliding, tunneling prevention, and interaction line of sight.

Version 2 adds **19 passing action/progress/combat tests**: preconditions and feedback, source-linked discoveries, quest completion and one-time rewards, resource consumption, repeat input, scene events, save restoration, malformed/versioned saves, bounded legal combat movement, ranges/LOS, guard/focus costs, distinct AI behavior and safe fallback, all terminal outcomes, invalid-state recovery, and anti-farming rewards. The final complete-suite result is recorded separately in the verification document.

The production validator checks deployed JSON references, regenerates the world for an exact comparison, compares the deployed PDF byte-for-byte with the source, verifies every fallback portfolio record/detail, confirms local sprite/font files, checks HTML/CSS references under a simulated repository subpath, and ensures one deployed PDF copy.

Version 3 additionally tests duel patterns, safe terminal outcomes, audio bounds and gesture/context handling, bounded SFX, failed assets, StrictMode manager reuse, and actual nonempty distinct WAV files. Mystery/expedition tests validate puzzle answers, dependency chains, seed replay and save slots. V4 covers boundary exits and adjacency, active-time encounter calibration/migration, garden locks and transitions, generated optional device solutions and one-time rewards, safe creature simulation, individual traits, proximity/food rules and companion persistence. See [`docs/VERIFICATION.md`](docs/VERIFICATION.md) for final executed totals and [`docs/V4-CHANGES.md`](docs/V4-CHANGES.md) for this update. Historical [`V3`](docs/V3-CHANGES.md) and [`V2`](docs/V2-CHANGES.md) handoffs remain available. No browser preview, listening test, browser gameplay QA or deployment is claimed here; passing automated tests/builds are separate from those checks.

## Troubleshooting and practical limits

- **Too little extractable text / OCR required:** the PDF is scanned or image-only. Export a searchable PDF or apply OCR before replacing the source. OCR software is not bundled; the build fails clearly instead of fabricating content.
- **No recognized sections:** add the actual heading spellings to `sectionAliases`. The name must appear as plain text before the first section.
- **Mixed columns or odd record grouping:** inspect `public/generated/resume.json`, especially `sourceText`; try `pageColumns`/`columnMode` overrides. Complex tables, text boxes, and unusual layouts may need a parser rule in `scripts/normalize-resume.mjs`. The parser uses documented local heuristics rather than claiming to understand every PDF.
- **A malformed URL or duplicate identifier:** inspect the reported record and source document/configuration. Unsafe URLs are intentionally rejected.
- **Missing generated JSON during development:** use `npm run dev` or `npm run generate-world` from the repository root.
- **A Pages deployment is skipped:** confirm the selected branch is the repository's default branch. Confirm Pages publishing source is GitHub Actions.
- **Missing files or a blank deployed site:** confirm the source was uploaded at repository root, dotfolders were retained, and the Actions build uploaded `dist/`. Review the failed workflow step before rerunning it.
- **A configuration is rejected:** check algorithm version 2, the target building ID, room count 2–10, exact sequence length, valid labels, and nonempty seeds. Village house count must match the current résumé.
- **A save cannot be restored:** incompatible or malformed books show a warning and protect the original stored text from automatic writes. Changed source-PDF hashes start a separate updated journey where space permits. Valid imports add slots; the 12-slot limit rejects an overflow rather than replacing earlier saves. Personal progress exists only in the current browser's local storage.
- **An action is unavailable:** the menu explains required items or completed one-time actions. Inspect a chest for the clue to its key; there is no penalty for cancelling an interaction.
- **Focus or movement is unavailable:** use highlighted reachable arena tiles; Focus needs a remaining charge, range, clear sight, and an unused action this turn. End turn resets the move/action allowance.

The scope stays compact: four interior archetypes, six existing CS tasks plus four optional activity families, one connected main mystery and its separate Glitch Garden, six fauna, one roaming caretaker, simple command encounters, and optional tactical sparring. There is no large crafting tree, economy, or mandatory grind. Creatures use bounded local navigation rather than a full ecosystem; their simulated positions reset on scene reconstruction, while relationships and companion commands persist. Layouts prioritize validated paths and can become wide/tall for unusually large résumés. Fast travel and the complete portfolio remain available. Actual local music/effects are included; sound is not necessary for solving anything. No offline service worker is installed. Mid-battle state is not saved; completed outcomes and exploration progress are. Enemy battle art reuses existing sprites with restrained effects; it does not claim a separate newly authored animation sheet for every enemy.

## Source structure and artwork

```text
resume.pdf                  Original source of truth
config/resume.config.json   Heading/layout configuration
scripts/                    Build-time extraction, normalization and validation
src/core/world.mjs          Shared deterministic tree/world generator
src/core/interior.mjs       Semantic rooms, spatial layout and validation
src/core/village.mjs        Reusable village object/action definitions
src/core/progress.mjs       Discoveries, action rules, quests and versioned saves
src/core/combat.mjs         Tactical turns, range, AI and outcome rewards
src/core/duel.mjs           Fast command encounters and readable enemy patterns
src/core/encounters.mjs     Active-movement-time encounter pacing and profiles
src/core/creatures.mjs      Seeded fauna/caretaker movement, trust and companions
src/core/devices.mjs        Routing, scheduling, debugging and stable insertion sort
src/core/destinations.mjs   Glitch Garden crossing, destination and world effects
src/core/activity-progress.mjs Stable activity completion and one-time rewards
src/core/mystery.mjs        Authored clue chain, generated CS puzzles and journal state
src/core/expeditions.mjs    Shareable seeds, preserved slots and save-book preferences
src/core/session.mjs        Shared world/progress restoration path
src/audio/audio.mjs         Gesture-gated central music/SFX manager
src/game/                   Canvas renderer and movement/collision helpers
src/components/             Semantic journal, links and modal UI
public/assets/              Existing local sprite sheets, font and licenses
public/audio/               Original music loops and short PCM sound effects
tests/                      Node test suites
.github/workflows/          Automatic static Pages deployment
docs/VERIFICATION.md        Verification record
docs/V2-CHANGES.md          Version 2 feature and usage handoff
docs/V3-CHANGES.md          Version 3 mystery/encounter/audio handoff
docs/V4-CHANGES.md          Version 4 geometry, garden, activities and creatures
```

The environment and fauna sheets are existing **Kenney** assets; existing CC0 character/NPC action sheets are also retained. The locally hosted pixel font is **Press Start 2P** by Cody Boisclair. No AI-generated artwork is included. Source URLs, original licenses, and atlas details are documented in [`ASSETS.md`](ASSETS.md), with license notices retained in `public/assets/`. Local files avoid fragile asset hotlinks. The game's visual concept takes inspiration from the requested reference while its content, layout, and interface are an original implementation.
