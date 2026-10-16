# Version 4.0 verification

## Executed checks

- **179 automated tests passed; zero failures, skips or cancellations.** The full suite covers résumé ingestion, seeded Prüfer trees, village/interior generation, actual foot collision and reachability, source-linked actions, saved journeys, all ten CS activity families, battles, creatures, keyboard/pointer controls and audio.
- **TypeScript and the production build passed.** The static-output validator confirms the original PDF, complete no-JavaScript portfolio, résumé JSON references, local sprites/fonts, all 21 PCM WAV assets and relative references under a simulated GitHub Pages repository subpath.
- The original source still produces **14 professional houses and 51 records**. Its SHA-256 remains `4fa2b578c11797fd89951b15cc6209af309144ec81e91ff383c2e5cfee43fece`. The fictional garden adds no professional claims or records.
- Production output is **494.74 KB JavaScript / 163.99 KB gzip**, **64.96 KB CSS / 14.93 KB gzip**, plus the original PDF, JSON, existing licensed sprites/font and local audio.

## Clean source-ZIP rebuild

The candidate source ZIP was extracted into a new folder containing no dependencies, build output or generated résumé data. `npm ci --offline` installed all **109 locked packages** from the available package cache. All **179 tests passed again**, and `npm run build` completed with TypeScript and static-output validation. This verifies the archive's dependency lock and generated-data pipeline without relying on the working folder's installed packages.

The final archive contains identical tested code/assets, with only this verification note updated after the clean rebuild. ZIP validation checks entry integrity, version 4.0.0, the Pages workflow, all 21 WAV files and the original source-PDF hash. Dependencies, build output, generated data, temporary files and secrets are excluded. GitHub Actions regenerates the published files.

## V4 behavior checked

- Boundary exits have a real opening and usable floor on each side. All 16 cardinal road/corridor masks are represented. Generated compositions preserve requested room-tree edges, source records, furniture clearance and physical circulation through actual movement rules, including small-tree enumeration and larger stars/chains.
- The physical canal blocks crossing before its prerequisites, opens after the route tree and bridge repair, and cannot be bypassed around its ends. Garden entry, map actions and save restoration enforce the same lock; enter/leave use the stable secret destination identity. Garden/device placements are reachable across generated seeds.
- Calm encounter calibration across 100 seeds averages **699.3 seconds**, approximately **11.65 minutes** of eligible movement to the first encounter. Tests distinguish all three profiles and exclude idle, pause, blocked frames, menus and teleport time. Legacy distance histories migrate with a fresh cooldown.
- Retained cipher, Hamming, Prüfer, bridge and logic tasks keep their established rules. Four optional device families were exercised across **480 generated instances** (four families × three profiles × 40 seeds), with valid generated solutions and zero fallback use in that sample. Tests also check intentional invalid inputs, alternative correct behavior and bounded fallbacks.
- Actual DevicePanel DOM tests operate routing arrows, processor queues, debugging patches and stable insertion-sort packets. Activity rewards persist once per site through reloads and seed/profile changes; the sorting regression explicitly covers its completion whitelist and tied-value order.
- Six fauna and a caretaker use bounded seeded spawning/navigation. Tests cover static collision, safe interaction positions, real personality-trait effects, observation/favorite-food rules, no spending on invalid actions, free treat refills, one companion, follow/wait/release, scene changes and relationship persistence.
- Audio checks verify distinct real files, their PCM format, duration, headroom and gentle boundary bounds. Seven long tracks total **16:48**; exploration/interior/puzzle tracks are **3:12 each**. Fake-AudioContext tests cover gesture startup, context playhead resumption, paused time, the two-track decoded cache, crossfades, mute/gains, bounded effects, failures and StrictMode cleanup/reuse.
- Save tests preserve V2/V3 professional discoveries, inventory, quests, custom configurations and completed story state. Malformed/incompatible books are protected, and locked/invalid saved positions recover safely.

## Actual application integration and renderer inspection

A separate offline jsdom check mounted the actual bundled App with source résumé/world data and a seeded save. **Twelve checks passed**, including Journal pointer opening/WASD focus, Portfolio toggle/focus preservation, Escape pause/Enter resume, Calm/profile persistence, Sound checkbox activation, Enter house entry, click-to-walk/object inspection, an actual object action, locked secret denial, saved bridge unlock and actual Garden entry/return. No DOM runtime errors were captured. Rendering, image loading and audio were stubbed in this integration check.

Separately, the actual Canvas renderer ran offline with the shipped assets to produce **13 snapshots plus a contact sheet**, visually inspected for boundary doors, furnished archetypes, closed/open crossing, dormant/restored garden with fauna and all road masks. See [`qa-v4/README.md`](qa-v4/README.md). These renderer images do not demonstrate browser layout or device behavior.

## Hosting and practical limits

No browser/server preview, browser playthrough, mobile visual check, listening test or live deployment was performed. No GitHub account access was used. Upload the contents of the ZIP's `parshwa-world` folder at repository root, retain `.github/workflows/deploy.yml`, and use the existing GitHub Actions Pages publishing setup. Local build checks cannot guarantee every browser/device behavior.

The world has four interior archetypes, ten bounded activity families, an authored mystery and separate Glitch Garden, six fauna, one caretaker, one companion and compact optional battles. Creatures obey static geometry but remain non-solid to the player so essential routes cannot be closed. Existing sprites are reused; habitat variants do not claim new artwork. Roaming positions are transient, while relationships and companion commands persist. There is no extensive economy, full ecosystem, service worker or mid-battle save. All professional content and the exact original PDF remain directly accessible from Portfolio/Résumé without story or combat gating. Scanned PDFs still require searchable text/OCR outside the project.
