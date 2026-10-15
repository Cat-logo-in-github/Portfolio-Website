# Version 3.0 verification

## Completed checks

- **122 automated tests passed; zero failures.** The full suite covers résumé ingestion, Prüfer/village/interior generation, solid collision, source-linked actions, legacy saves/quests/sparring, dialog navigation, puzzles/story, expedition slots, session restoration, encounters, command battles and audio.
- **TypeScript and production build passed.** The output validator verifies local sprites/fonts, all 21 real PCM WAV files, GitHub Pages project-subpath references, complete fallback portfolio content, and an exact copy of the original résumé.
- The source still produces **14 houses and 51 professional records**. The original PDF matches the supplied download by SHA-256: `4fa2b578c11797fd89951b15cc6209af309144ec81e91ff383c2e5cfee43fece`.
- The complete main clue chain through the boss ending is exercised through save/reload and seed switching. Puzzle checks cover all 16 Hamming payloads and all seven single-bit error positions, multiple-error miscorrection rejection, real smallest-leaf Prüfer reconstruction, graph connectivity/shortest routes, equivalent logic answers, and classical cipher rules.
- Story tests cover 60 solvable seeds, all 14 real interiors with default/two-room/ten-node-star configurations, crowded-station fallback, and one-building worlds. All seven story stages keep solid story objects at identical coordinates; portals are reserved before being unlocked. Existing résumé actions remain available.
- Session tests restore the saved feet against the decorated scene, retain canonical spawn/placement, recover malformed attempt counters, validate story dependencies, preserve V2 discoveries/inventory/custom rooms, and retain completed endings across new expeditions.
- DOM regression tests verify inspection focus, WASD/arrows, Enter/Space activation, repeat protection, checkbox/radio toggles, native text/select/slider editing, details, pointer clicks, SVG destinations, panel switching, disabled-node recovery and focus trapping. Click-to-walk uses the actual collision rules.
- Encounters count actual walking, protect new areas, respect pause/teleports, and vary by seed/region. Duel tests cover distinct intentions, guard/analyze/technique/item effects, safe escape/defeat and a winnable guardian without grinding.
- Audio tests use a fake AudioContext to check gesture-gated startup, context changes, duplicate-loop prevention, volumes/mute, bounded effects, suspension/resume, failed assets and StrictMode reuse. File tests verify nonempty, distinct real tracks. Runtime assets are local.
- Current production bundle: approximately **420 KB JavaScript / 138 KB gzip** and **49 KB CSS / 12 KB gzip**, plus the original PDF, JSON, local sprites, font and audio.

## ZIP validation

**Clean ZIP rebuild passed:** extracted a source archive into a new folder with no dependencies, build output or generated résumé data; installed all 109 locked packages with `npm ci`; ran all **122 tests successfully** and completed `npm run build`, including TypeScript and static-output validation. The final archive contains the identical verified code/assets plus this completed verification note. Generated files are rebuilt by GitHub Actions.

## Actual application DOM check

A separate offline jsdom check mounted the actual Vite-bundled App with source résumé/world data and a seeded save. It passed title load, Journal pointer opening and S navigation, Portfolio toggling/focus preservation, Escape pause, Enter resume/canvas focus, Sound checkbox Enter toggle/S navigation, Enter house entry, click-to-walk to generated interior furniture, and its actual Inspect action via Enter. No DOM runtime errors were captured. Canvas rendering, images and audio were stubbed; this is an application integration check, not a visual/browser play-test.

## Browser review and hosting

No browser preview, browser gameplay play-test, mobile visual review, or listening test was performed. The owner's earlier instruction to stop preview attempts was respected. DOM/state/physics checks do not establish visual polish, real-device autoplay behavior, or absence of every browser runtime issue.

No GitHub account access was used and nothing was deployed. Replace the repository source contents with this archive's `parshwa-world` contents, including `.github/workflows/deploy.yml`. Keep Pages publishing set to **GitHub Actions** and push to the repository's default branch. The workflow installs locked dependencies, runs tests, rebuilds the PDF-derived data/site and uploads `dist`.

## Practical limits

- A compact authored mystery, six puzzle types (five main and one optional), four interior archetypes, contextual recurring NPCs, visible optional challenges, paced surprise battles and one ending are implemented. There is no party/capture system, extensive economy, dynamic NPC schedule simulation, offline service worker or mid-battle save.
- Existing directional/action sprites are reused honestly: run speeds up the walk cycle; some compatible poses are reused for interaction/victory/hurt/defeat. Enemy sprites use short effects rather than complete custom animation sheets for every state.
- Interiors support 2–10 rooms. Unsupported or excessively crowded configurations report errors rather than dropping records or requested tree edges. Dense story placements attach actions to existing accessible solid furniture. Only explicitly flat paper notes and ground decoration are intentionally walkable.
- Main progression never depends on random encounters or optional collectibles. The unlocked archive route is a usable shortcut to the existing archive house; it does not rewrite the underlying tree geometry. Full portfolio reading and the original PDF remain accessible at any stage.
- Saves are browser/origin-local, with journey/book exports and imports. New seeds and imported journeys append slots; capacity is twelve. Incompatible stored books are protected from autosave and can be downloaded from the pause menu. Incompatible source journeys receive a new recovery slot when capacity permits; original saved text is retained.
- Custom Forge overrides reproduce with the **seed plus saved configuration**. Save-book/story generator version 3 and the retained geometry-configuration version 2 are separate contracts.
- OCR is not bundled. Scanned PDFs need a searchable export; unusual document layouts can require parser/configuration adjustments.
