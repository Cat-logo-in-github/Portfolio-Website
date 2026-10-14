# Parshwa's World of Work

A small, replayable RPG portfolio built with React, TypeScript, Vite, and Canvas. Each meaningful résumé section becomes a house; its content determines the house's size. A real Prüfer code defines the village tree, and a separate layout algorithm turns that tree into walkable paths. Version 2 adds enterable procedural interiors, contextual object choices, discoveries, a short quest, persistent progress, and optional tactical sparring.

The included résumé produces **14 destinations and 51 records**: profile, education, languages, creative skills, technical skills, activities, teaching experience, summer school, content creation, projects, leadership, other work, research, and contact. These counts describe the supplied PDF, not fixed requirements. Updating the PDF can change the count, sizes, default sequence, layout, and displayed content.

All PDF extraction, résumé normalization, and default village generation happen before deployment. Visitors receive static HTML, JavaScript, CSS, JSON, local sprites, and the original PDF. The browser generates interiors and custom configurations locally from that structured data. There is no server, database, API service, authentication, AI parsing service, or secret to configure. Local generation never changes résumé content.

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
- Press **E** or **Space** near a door, NPC, sign, or object to open its context-specific actions.
- Press **Escape** or select **Menu** to pause. Escape also closes an open panel.
- On touch screens, hold the directional buttons and select the interaction button near a usable object.
- **Journal** tracks discovered field notes. Select **Read complete portfolio** to switch to the reading view, or open the complete portfolio from the title/pause screen without requiring exploration or battles.
- **Village map** lists destinations and offers fast travel; houses in its overview are also keyboard accessible.
- **Forge** configures the village or one selected interior, with manual/random valid codes, independent layout/decoration seeds, defaults, and versioned configuration import/export.
- Select the name in the header, or the pause menu's return action, to return to the title screen.
- **Résumé** downloads the original PDF. `portfolio.html` offers the complete conventional reading view and works without JavaScript.

Movement stops while a panel is open. Leaving browser focus clears held controls. Diagonal movement is normalized, collisions use substeps to prevent passing through buildings at low frame rates, and the camera follows the explorer. Gameplay suppresses movement-key scrolling only while the game canvas receives input. Reduced-motion settings remove walking bob and camera easing.

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

### Optional tactical sparring

Talk to the sparring mentor to choose **Guard**, **Skirmisher**, or **Ranger**. The match uses a small **7 × 7** arena with obstacles, a visible enemy intention, health, legal movement highlights, and a short action log.

Each player turn permits **one move of up to two reachable tiles** and **one action**, in either order. Select **End turn** to resolve the opponent's move/action and begin the next player turn.

- **Attack:** 3 damage to an adjacent opponent.
- **Guard:** reduces the next enemy hit by 2, then expires.
- **Focus:** 2 damage within three tiles with clear line of sight; two charges per match.
- **Retreat:** immediately leaves practice safely.

The Guard holds position and advances when approached; the Skirmisher closes distance; the Ranger seeks a clear shot from a distance. Opponents cannot occupy your tile or pass through obstacles. Victory awards an optional sparring badge once per opponent type; replaying or rerolling seeds cannot farm rewards. Defeat and retreat cause **no permanent health, inventory, discovery, or quest loss**. The practice battle ends and you recover before returning to exploration.

### Saves and regeneration

Exploration uses a **version 2 localStorage save** in the visitor's browser. It retains discoveries, visited houses, opened containers, one-time actions, inventory, quests, optional wins, position, and stored village/interior configurations. Interiors are reconstructed from configuration instead of saving a large map snapshot.

Saves are local to that browser and origin; they are not uploaded to GitHub or synchronized between devices. Malformed or old-version saves start a fresh journey with a warning. If the source résumé's **PDF hash changes**, the save resets explicitly so old geometry and records are not applied to a new résumé. Normalized world generation can stay identical across PDF encoding-only changes, but save identity deliberately follows the source PDF hash.

Changing generation settings preserves discoveries and rewards. Stable object/action IDs keep opened containers and one-time consequences from resetting when their visuals or positions change. A newly generated scene uses a valid spawn; returning to the village restores a safe exterior position. Generation configuration sharing and personal save progress are separate: importing a configuration does not import someone else's inventory or quest rewards.

You can also **Export journey save** from the menu and restore that JSON using **Import a journey save**. Journey imports validate the résumé identity, procedural configurations and saved position before applying them.

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

See [`docs/VERIFICATION.md`](docs/VERIFICATION.md) for executed checks and [`docs/V2-CHANGES.md`](docs/V2-CHANGES.md) for the feature handoff. No browser preview or browser gameplay QA is claimed for this update; the user's request to skip previews was retained. Passing automated tests/builds are separate from a live deployment; hosting requires the Pages steps above.

## Troubleshooting and practical limits

- **Too little extractable text / OCR required:** the PDF is scanned or image-only. Export a searchable PDF or apply OCR before replacing the source. OCR software is not bundled; the build fails clearly instead of fabricating content.
- **No recognized sections:** add the actual heading spellings to `sectionAliases`. The name must appear as plain text before the first section.
- **Mixed columns or odd record grouping:** inspect `public/generated/resume.json`, especially `sourceText`; try `pageColumns`/`columnMode` overrides. Complex tables, text boxes, and unusual layouts may need a parser rule in `scripts/normalize-resume.mjs`. The parser uses documented local heuristics rather than claiming to understand every PDF.
- **A malformed URL or duplicate identifier:** inspect the reported record and source document/configuration. Unsafe URLs are intentionally rejected.
- **Missing generated JSON during development:** use `npm run dev` or `npm run generate-world` from the repository root.
- **A Pages deployment is skipped:** confirm the selected branch is the repository's default branch. Confirm Pages publishing source is GitHub Actions.
- **Missing files or a blank deployed site:** confirm the source was uploaded at repository root, dotfolders were retained, and the Actions build uploaded `dist/`. Review the failed workflow step before rerunning it.
- **A configuration is rejected:** check algorithm version 2, the target building ID, room count 2–10, exact sequence length, valid labels, and nonempty seeds. Village house count must match the current résumé.
- **A save resets:** older save versions, malformed content, and changed source-PDF hashes are handled by starting a fresh journey with a message. Personal progress exists only in the current browser's local storage.
- **An action is unavailable:** the menu explains required items or completed one-time actions. Inspect a chest for the clue to its key; there is no penalty for cancelling an interaction.
- **Focus or movement is unavailable:** use highlighted reachable arena tiles; Focus needs a remaining charge, range, clear sight, and an unused action this turn. End turn resets the move/action allowance.

The scope is deliberately compact: four interior archetypes, one discovery quest and one optional sparring goal, small inventory/cosmetic rewards, and three tactical opponent types. There is no large crafting tree, economy, or mandatory grind. The imported character sprite is a static front view with movement, facing mirroring, and a small walking bob; it is not a full directional animation set. Layouts prioritize readable, validated paths and can become wide or tall for unusually large résumés. Fast travel and the conventional portfolio remain available. No audio is required or included. Essential assets are local, but the application does not install an offline service worker. Mid-battle state is not saved; exploration progress and completed battle rewards are.

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
src/game/                   Canvas renderer and movement/collision helpers
src/components/             Semantic journal, links and modal UI
public/assets/              Existing local sprite sheets, font and licenses
tests/                      Node test suites
.github/workflows/          Automatic static Pages deployment
docs/VERIFICATION.md        Verification record
docs/V2-CHANGES.md          Version 2 feature and usage handoff
```

The sprite sheets are existing **Kenney** assets. The locally hosted pixel font is **Press Start 2P** by Cody Boisclair. No AI-generated artwork is included. Source URLs, original licenses, and atlas details are documented in [`ASSETS.md`](ASSETS.md), with license notices retained in `public/assets/`. Local files avoid fragile asset hotlinks. The game's visual concept takes inspiration from the requested reference while its content, layout, and interface are an original implementation.
