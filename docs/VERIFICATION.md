# Version 2.0 verification

## Completed checks

- **65 automated tests passed; zero failures.** Coverage: 11 résumé-ingestion tests, 12 world/Prüfer tests, 11 interior-generation tests, 12 movement/solid-collision tests, 9 action/progress/save tests, and 10 tactical-combat tests.
- **TypeScript check and production build passed.** Static-output validation passed.
- **Clean ZIP rebuild passed:** extracted the source ZIP into a fresh folder with no node_modules, dist, or generated content; ran `npm ci`, `npm test`, and `npm run build` successfully. Tests extract the source PDF directly and do not depend on leftovers from another build.
- The supplied source still generates **14 houses and 51 résumé records**. Every default interior is generated and validated during the build; unsupported default scenes fail before deployment.
- Prüfer encoder/decoder round trips cover every sequence through six vertices. Interior tests cover every tree from two through five rooms across four archetypes (580 configurations), plus 81 larger seeded star/chain/random configurations with 2–10 rooms.
- All 14 actual résumé interiors passed physical floor/collision/interaction validation. All 119 furniture/record/exit interaction points are reachable and select their intended object. Corridor movement simulation used the actual movement code.
- Village checks covered 120 custom code/seed configurations; additional route checks reached 90 essential NPC/board/chest/well targets across 18 worlds. A retained regression test covers 40 configurations and walks every decoded road. Separate checks passed 15 one-, two-, and three-house worlds.
- Semantic record actions inspect without unlocking, then read/examine the related object to unlock only its actual source record IDs. Repeated rewards/actions, key consumption, quest completion, regeneration, and save/reload are tested.
- Combat tests verify legal movement, obstacles, attack/focus ranges and line of sight, explicit turns, defensive effects, distinct enemy behavior, fallback actions, victory/defeat/retreat, invalid-state handling and reward limits.
- The production PDF is **byte-for-byte identical** to the original. The static artifact contains exactly one PDF copy. The no-JavaScript portfolio retains every source record/detail and all embedded professional links.
- Essential sprites and fonts are local. HTML/CSS references passed project-subpath validation. The added indoor sprite sheet is an unchanged existing Kenney CC0 asset with its license retained.
- Final production bundle: approximately **322 KB JavaScript / 103 KB gzip** and **27 KB CSS / 6.5 KB gzip**, plus local sprites, font, JSON and the original PDF. No new runtime package dependency was added.

## Browser review and hosting

Browser gameplay and mobile visual review were **not performed**. The owner's earlier request to stop preview attempts was respected. Automated movement, interaction, generation and state checks are not presented as a browser play-test.

No GitHub account access was used and no deployment was performed. Replace the repository's source contents with this ZIP's `parshwa-world` contents, preserve `.github/workflows/deploy.yml`, and keep Pages publishing set to GitHub Actions. Push to the configured default branch to build and deploy.

## Practical limits

- Interiors support 2–10 rooms and four archetypes: home, library, workshop and studio. Very large sections or extreme graphs can reach bounded geometry/capacity limits; generation reports a clear error without dropping records or changing a requested tree.
- Character sprites are existing static front views with mirroring and optional movement bob. No audio or offline service worker is included.
- Mid-battle state is not saved. Completed battle rewards and exploration progress are saved; defeat/retreat have no lasting penalty.
- Journey saves are local to the browser/origin, with JSON export/import. Malformed/outdated saves reset with a warning; a changed source-PDF hash resets progress explicitly. Generation configuration changes preserve discoveries and rewards.
- OCR is not bundled. Scanned PDFs require a searchable export; unusual headings or columns may need the documented configuration/parser adjustments.
- The complete Reading view and unchanged résumé download are always available independently of discovery, quests and combat.
