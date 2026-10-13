# Parshwa's World of Work

A playable, top-down résumé portfolio built with React, TypeScript, Vite, and Canvas. Each meaningful résumé section becomes a house; its content determines the house's size. A real Prüfer code defines the village tree, and a separate layout algorithm turns that tree into walkable paths.

The included résumé produces **14 destinations and 51 records**: profile, education, languages, creative skills, technical skills, activities, teaching experience, summer school, content creation, projects, leadership, other work, research, and contact. These counts describe the supplied PDF, not fixed requirements. Updating the PDF can change the count, sizes, default sequence, layout, and displayed content.

All extraction and initial generation happen before deployment. Visitors receive static HTML, JavaScript, CSS, JSON, local sprites, and the original PDF. There is no server, database, API service, authentication, AI parsing service, or secret to configure. Visitors can regenerate the map locally using a custom code; their résumé content remains unchanged.

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
| `npm test` | Run ingestion, Prüfer, map geometry, and movement tests. |
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
- Press **E** or **Space** near a house entrance to read its field notes.
- Press **Escape** or select **Menu** to pause. Escape also closes an open panel.
- On touch screens, hold the directional buttons and select **Read** near an entrance.
- **Journal** exposes every résumé section without requiring movement.
- **Village map** lists destinations and offers fast travel; houses in its overview are also keyboard accessible.
- **World code** accepts a custom Prüfer sequence and provides **Restore default world**.
- Select the name in the header, or the pause menu's return action, to return to the title screen.
- **Résumé** downloads the original PDF. `portfolio.html` offers the complete conventional reading view and works without JavaScript.

Movement stops while a panel is open. Leaving browser focus clears held controls. Diagonal movement is normalized, collisions use substeps to prevent passing through buildings at low frame rates, and the camera follows the explorer. Gameplay suppresses movement-key scrolling only while the game canvas receives input. Reduced-motion settings remove walking bob and camera easing.

## Update the résumé

1. Replace **`resume.pdf`** at the repository root with a searchable, text-based PDF.
2. Optionally run `npm test` and `npm run build` locally.
3. Commit and push the replacement to the repository's **default branch**.

GitHub Actions installs locked dependencies, runs tests, extracts the PDF, validates the normalized data, generates a deterministic world, builds the site, validates the deployed files, and publishes the resulting `dist/` artifact. A successful deployment replaces the previous site with the new résumé content. A failed extraction or validation stops deployment and leaves the previously deployed site in place.

Routine updates require no edits to React components, coordinates, or generated JSON. Unusual PDF headings or layout can require a configuration adjustment described below.

**Public content:** the published original PDF and all extracted résumé data are public. Review contact details and other information in your PDF before publishing it to a public repository or Pages site.

## Résumé pipeline

`scripts/extract-resume.mjs` uses the build-only `pdfjs-dist` dependency to extract text and hyperlink annotations. It groups PDF runs by their coordinates, preserves useful ordering, and detects ordinary two-column pages. Embedded links are retained even when visible URLs wrap across lines or a label such as a GitHub username hides the URL. The PDF is treated as data; evaluation is disabled.

`scripts/normalize-resume.mjs` normalizes whitespace, matches configured heading aliases, collects identity/contact data, and groups numbered entries and wrapped bullets. It supports optional sections and keeps the source text for audit. Records have stable identifiers, dates, subtitles, details, and safe links. The supplied PDF has no separate professional title; the display label “Computer Science · Mathematics · Creative Practice” is derived from its education and creative content. The parser does not invent missing employers, dates, metrics, or links.

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

A visitor's valid custom code regenerates the tree, coordinates, routes, and decoration through the **same `src/core/world.mjs` generator** used at build time. Invalid input shows an error while preserving the current map. The default and custom modes are visibly identified. Custom maps are temporary and do not modify repository files or the résumé.

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

Automated coverage includes PDF wrapper errors and scanned-file detection; normalization and optional/configured headings; current-source integration; annotation links; safe HTML/URLs; wrapped bullets; stable identifiers; relative asset paths; Prüfer validation and encoding/decoding; edge count/connectivity/cycles; importance sizing; deterministic defaults; altered custom topology; bounds and house overlap; path endpoints; unrelated road crossings; decoration clearance; diagonal speed; collisions, wall sliding, tunneling prevention, and interaction range.

The production validator checks deployed JSON references, regenerates the world for an exact comparison, compares the deployed PDF byte-for-byte with the source, verifies every fallback portfolio record/detail, confirms local sprite/font files, checks HTML/CSS references under a simulated repository subpath, and ensures one deployed PDF copy.

See [`docs/VERIFICATION.md`](docs/VERIFICATION.md) for the executed checks and any remaining review items. Passing local tests/builds are separate from a live deployment; hosting requires the Pages steps above.

## Troubleshooting and practical limits

- **Too little extractable text / OCR required:** the PDF is scanned or image-only. Export a searchable PDF or apply OCR before replacing the source. OCR software is not bundled; the build fails clearly instead of fabricating content.
- **No recognized sections:** add the actual heading spellings to `sectionAliases`. The name must appear as plain text before the first section.
- **Mixed columns or odd record grouping:** inspect `public/generated/resume.json`, especially `sourceText`; try `pageColumns`/`columnMode` overrides. Complex tables, text boxes, and unusual layouts may need a parser rule in `scripts/normalize-resume.mjs`. The parser uses documented local heuristics rather than claiming to understand every PDF.
- **A malformed URL or duplicate identifier:** inspect the reported record and source document/configuration. Unsafe URLs are intentionally rejected.
- **Missing generated JSON during development:** use `npm run dev` or `npm run generate-world` from the repository root.
- **A Pages deployment is skipped:** confirm the selected branch is the repository's default branch. Confirm Pages publishing source is GitHub Actions.
- **Missing files or a blank deployed site:** confirm the source was uploaded at repository root, dotfolders were retained, and the Actions build uploaded `dist/`. Review the failed workflow step before rerunning it.

This is a portfolio explorer: houses open readable journals rather than playable building interiors. The imported character sprite is a static front view with movement, facing mirroring, and a small walking bob; it is not a full directional animation set. The layout prioritizes readable, noncrossing paths and can become wide or tall for unusually large résumés. Fast travel and the conventional portfolio remain available. No audio is required or included. Essential assets are local, but the application does not install an offline service worker.

## Source structure and artwork

```text
resume.pdf                  Original source of truth
config/resume.config.json   Heading/layout configuration
scripts/                    Build-time extraction, normalization and validation
src/core/world.mjs          Shared deterministic tree/world generator
src/game/                   Canvas renderer and movement/collision helpers
src/components/             Semantic journal, links and modal UI
public/assets/              Existing local sprite sheets, font and licenses
tests/                      Node test suites
.github/workflows/          Automatic static Pages deployment
docs/VERIFICATION.md        Verification record
```

The sprite sheets are existing **Kenney** assets. The locally hosted pixel font is **Press Start 2P** by Cody Boisclair. No AI-generated artwork is included. Source URLs, original licenses, and atlas details are documented in [`ASSETS.md`](ASSETS.md), with license notices retained in `public/assets/`. Local files avoid fragile asset hotlinks. The game's visual concept takes inspiration from the requested reference while its content, layout, and interface are an original implementation.
