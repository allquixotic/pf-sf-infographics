# Release invariants

## §V

- V1: Bundled content paths must avoid Windows device names, including names with extensions. Verify with `packages/cli/test/content.test.ts` and Windows CI checkout.

- V2: At every supported text size, card features stay above the HP/source footer; text fitting must respect both dimensions. Verify PDF text positions in `packages/cli/test/layout.test.ts`.
- V3: Artwork messages and help tooltips remain within a 390 px viewport. Verify browser upload and tooltip flows at desktop and phone widths.
- V4: Custom artwork matches class names across case, separators and nested folders; games remain isolated. Verify `packages/engine/test/source-art.test.ts` and browser ZIP reload.
- V5: Booklet continuation pages repeat section titles exactly when enabled. Verify exported PDF text in `packages/cli/test/layout.test.ts`.

## §B

| id | date | cause | fix |
| --- | --- | --- | --- |
| B1 | 2026-10-04 | Constitution icon named `con.svg`; Windows checkout rejected reserved device name. | V1; rename to `constitution.svg`, update game references and manifest. |
| B2 | 2026-10-04 | Card features shared footer space; minimum font fitting could still overflow. | V2; reserve footer space, grow cards with text scale, enforce final fit. |
| B3 | 2026-10-04 | Long upload filenames had no wrapping rule and could widen grid tracks. | V3; allow wrapping and shrinkable grid tracks. |
| B4 | 2026-10-04 | Original design incorrectly described as CC BY; permission was granted by email. | Remove unsupported design-license claims; preserve permission notice and project-content license. |
| B5 | 2026-10-04 | Necromancer summary called thralls blocking minions; witchwarper summary implied a spatial restriction on warp spells. | Correct against Archives of Nethys; retain ratings and unrelated class text. |
| B6 | 2026-10-04 | All supplied images triggered official-artist credits, including custom artwork. | Track official pack provenance; show official-artist credits only when that pack supplies an image. |
