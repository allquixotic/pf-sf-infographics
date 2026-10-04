# Architecture

```
packages/
  engine/   @pfsf/engine  UI-agnostic core: content loading, options, layout decisions, Typst, raster encoders
  cli/      @pfsf/cli     Bun command line + Bun runtime hooks (file-system content source, WASM loading)
  web/      @pfsf/web     Vue 3 + Vite browser app; the engine runs in a Web Worker
tools/                    TypeScript dev tools: launcher, manifest/schema generators, Paizo download
scripts/                  Bun bootstrap for the .sh / .bat launchers
content/                  the default content tree (see content-format.md)
```

## Pipeline

1. **Load** — `loadContent(source)` reads `manifest.json`, each `game.json`, theme, classes, icons and fonts, and
   validates them (zod). Sources: `HttpContentSource`, `GitHubContentSource`, `MemoryContentSource`, and the CLI's
   `FsContentSource`.
2. **Options** — `resolveOptions(input)` fills defaults and turns size presets into points.
3. **Model** — `buildModel()` filters and groups classes, resolves art (user-supplied official art, then our
   emblems), recolors icons for the theme and produces a plain JSON document model plus virtual files (icons, art).
4. **Layout decisions** — `computeLayout()` picks the poster arrangement (see below) or the booklet column count and
   card scale, and adds page geometry. All numbers live in `layout/geometry.ts`.
5. **Typst** — the model is written to `/data.json` in Typst's virtual file system and
   `typst/infographic.typ` draws it. Typst measures text, shrinks long card text to fit, equalizes band heights,
   scales the poster to the page and paginates booklets.
6. **Output** — PDF straight from Typst. SVG from the typst.ts renderer, cleaned up (interactive layers removed,
   embedded SVG icons inlined, multi-page output split per page). PNG via resvg; JPG and WebP by encoding resvg's
   pixels with MozJPEG / libwebp (jSquash).

Everything is WebAssembly, so the browser and the CLI produce the same result. The engine gets its WASM binaries
through an `EngineRuntime` supplied by the platform (URLs in the browser, bytes under Bun).

## Why Typst

The layout needs real typesetting (text measurement, wrapping, hyphenation, fitting), multi-page documents with
proper paper sizes, PDF with embedded fonts and selectable text, and identical output in the browser and on the
command line. Alternatives considered:

| Option | Why not |
| --- | --- |
| HTML/CSS in the browser | Great layout, but the CLI would need a headless browser, and SVG export would rely on `foreignObject`. |
| Satori (HTML/CSS subset to SVG) | Flexbox only, no pagination; PDF would need a separate SVG-to-PDF step with text as paths. |
| Hand-written SVG with a flexbox engine | Reinvents text layout. |
| Typst (chosen) | Real typesetting engine, native PDF/SVG, pagination, runs as WASM everywhere. Cost: a ~11 MB (gzipped) download the first time the web app renders. |

## Poster arrangement

Sections (e.g. the four magic groups) are stacked into side-by-side vertical *bands*, as in the original poster
where "high magic" and the legend share the left band. `layout/poster.ts` tries every split of the ordered sections
into contiguous bands, every band width in card columns and every position for the legend, and scores each by how
large it can be drawn on the page, penalized by empty space. Typst then measures the real bands and stretches the
last section of shorter bands so all bands end level.

## Web app

- `src/engine/worker.ts` hosts the engine; `client.ts` is a small promise wrapper.
- Settings are kept per game tab in `localStorage`; user-supplied art (Community Use Package zips, extra images) in
  IndexedDB. Nothing is uploaded anywhere.
- The preview is rendered as SVG (fast); the Download button renders the chosen format. Multi-page raster or SVG
  output is zipped.
- `vite.config.ts` serves `content/` live in development and copies it into the build. In development only it also
  exposes `local-assets/` so the local launcher finds downloaded art automatically.

## Launchers

`start.sh` / `start.bat` and `pfsf.sh` / `pfsf.bat` source `scripts/ensure-bun.*`, which keeps the latest stable Bun
in `.runtime/bun/` (checked once a day; SHA-256 verified; falls back to the `-baseline` build on CPUs without AVX2).
They then hand over to TypeScript: `tools/launch.ts` (install dependencies, offer the art download, start Vite, open
the browser) or the CLI.
