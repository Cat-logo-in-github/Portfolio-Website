# Verification record

## Completed checks

- `npm test`: **27 passed, 0 failed** (11 ingestion, 11 world generation, 5 movement/collision tests).
- `npm run build`: **passed**, including résumé extraction, normalization, deterministic world generation, TypeScript checking, Vite production build, and static-output validation.
- The supplied résumé generates **14 destinations and 51 records**. Embedded email, GitHub, Instagram and YouTube links are preserved.
- Prüfer encoding/decoding round trips cover every sequence through six vertices. Geometry checks cover every labeled tree through five vertices, plus larger stars/chains and mixed house sizes.
- Movement simulation traversed every path in the actual default world, a custom star, and a custom chain without building collisions.
- Static validation confirms the deployed PDF is byte-for-byte identical to the source, the generated world matches the normalized résumé, all record references are valid, and the no-JavaScript portfolio contains every record/detail.
- All essential assets are local. HTML/CSS references were validated under a simulated GitHub Pages repository subpath. The production output contains exactly one PDF copy.
- Official workflow action tags were verified against GitHub: checkout v7, setup-node v7, configure-pages v5, upload-pages-artifact v4 and deploy-pages v4.

## Browser review and deployment

Browser gameplay and mobile visual review were **not completed**. Local preview connections were blocked by the execution environment; further preview attempts were stopped at the owner's request. No browser gameplay pass is claimed.

No GitHub account access was used, and **no deployment was performed**. This is a source repository ZIP for the owner to upload. Preserve `.github/workflows/deploy.yml`, place source files at the repository root, and select **Settings > Pages > GitHub Actions**. The workflow builds and deploys after a relevant push to the repository's configured default branch.

## Practical limitations

- OCR is not bundled. Scanned/image-only PDFs fail clearly and require a searchable PDF.
- Unusual headings/columns may need documented alias/layout configuration. Complex text boxes/tables may require a parser rule.
- The supplied PDF has no explicit professional title; its display label is derived from its education and creative content.
- Existing character artwork is a static front-view sprite with mirroring and optional walking bob. Houses open journal panels; there are no playable interiors or audio.
- Very large or chain-shaped trees can create wide/tall maps; the camera, map and fast travel support navigation.
- Custom visitor maps are temporary. There is no offline service worker.
- Publishing exposes the original résumé and its extracted content, including the supplied contact information.
