# Contributing

Thanks for helping! This project has two kinds of contributions, and most people only need the first.

1. **Content** — class summaries, ratings, groupings, new classes, icons and emblems. JSON and SVG only; no coding.
2. **Code** — the engine, the web UI, the CLI and the launch scripts (TypeScript, Vue, Typst templates).

By contributing you agree that your code is licensed under Apache-2.0 and your content (text, data, icons)
under CC BY 4.0, the same as the rest of the repository.

## Ground rules

- **Never commit Paizo material.** No official art, logos, scans or copied rules text. `local-assets/` is
  git-ignored for a reason. Paizo's Community Use Policy lets us *reference* names and let users load the Community
  Use Package themselves; it does not let us redistribute it. See [docs/paizo-assets.md](docs/paizo-assets.md).
- **Write summaries in your own words.** Short, neutral and accurate to the current (Remaster-era) rules. Don't paste
  text from rulebooks, Archives of Nethys or other fan charts.
- **Ratings are opinions.** Keep them consistent across classes, explain big changes in the pull request, and link a
  discussion or a source if you can.
- **Keep credits.** The design is Rachelle Willemsma's, used with permission; the attribution line stays in the defaults.

## Getting set up

You need Git; everything else is downloaded into the project folder.

```bash
./start.sh          # the web UI with live reload of content/ (start.bat on Windows)
./pfsf.sh --help    # the CLI (pfsf.bat on Windows)
```

With Bun installed you can use the scripts directly:

| Command | What it does |
| --- | --- |
| `bun install` | install dependencies |
| `bun start` | local web UI (same as `./start.sh`) |
| `bun run cli -- <args>` | CLI |
| `bun test` | unit, content and rendering tests |
| `bun run typecheck` | TypeScript and vue-tsc |
| `bun run lint` / `bun run format` | Biome |
| `bun run content:manifest` | update `content/manifest.json` after adding, removing or editing content files |
| `bun run content:check` | validate content and verify the manifest (CI runs this) |
| `bun run content:schema` | regenerate `content/schema/*.json` after changing the zod schemas |
| `bun run paizo:fetch` | download the Community Use Package zips into `local-assets/paizo/` |

## Changing content

Content lives in [`content/`](content/) and is described in [docs/content-format.md](docs/content-format.md). JSON
files point at `content/schema/*.schema.json`, so editors such as VS Code validate and autocomplete them.

### Edit a class

1. Open `content/<game>/classes/<id>.json`.
2. Change `ratings` (0–5 in steps of 0.5, or `[low, high]` for a build-dependent range) or `features`
   (two or three `{ "title", "text" }` entries, about 450 characters in total so they fit on the card).
3. Update `review` with the rules version, review date, source links and a rationale for every metric. Use
   [the rating guide](docs/ratings.md), and explain which ordinary builds support a range.
4. `bun run content:manifest`, then look at the result with `./start.sh` or `./pfsf.sh --format png`.

### Add a perspective

Use [rating sets](docs/content-format.md#multiple-rating-sets-in-one-repository) to offer another complete
perspective in the same repository. Name it clearly, explain its assumptions and credit its contributors.
Do not copy scores or prose from another chart without permission and attribution.

### Add a class

1. Copy an existing class file to `content/<game>/classes/<new-id>.json` and fill it in. `status` is `core`,
   `expansion`, `playtest` or `legacy`; `group` must be one of the game's groups.
2. Draw an emblem at `content/<game>/emblems/<new-id>.svg` (see below).
3. Add the class file to `classes` in `content/<game>/game.json`.
4. If Paizo's Community Use Package has a portrait for it, set `art.paizo.file` to the path inside the zip.
5. Update [docs/classes.md](docs/classes.md), run `bun run content:manifest` and `bun test`.

### Icons and emblems

- `viewBox="0 0 100 100"` for emblems, `0 0 24 24` for attribute and tradition icons.
- One color only: `currentColor`. Cut-outs with `fill-rule="evenodd"` or a `<mask>` in black and white. Prefix mask
  ids with the icon name. No text, gradients, filters, `<style>`, scripts, raster images or external references.
- Bold pictogram style: strokes at least 4 units wide on emblems, legible at 48 px.
- Original work only: don't trace Paizo art or copy icon sets.
- Start the file with a comment describing the motif.

### Try content from a branch

Push your branch to a fork, then open the published site with `?repo=<you>/<repo>@<branch>` (or use the Content
source panel) to render it straight from GitHub.

## Changing code

- TypeScript everywhere except the launcher shell/batch scripts; Vue 3 single-file components for the UI; Typst for
  the drawing templates (`packages/engine/src/typst/infographic.typ`).
- The engine (`packages/engine`) must stay UI-agnostic and platform-agnostic: no DOM, no Node or Bun APIs, no direct
  network access. Platform code goes in `packages/web` and `packages/cli`.
- Decisions belong in TypeScript (`model/`, `layout/`); the Typst template only draws what `/data.json` tells it.
- New render options go in `packages/engine/src/options/schema.ts`, then the CLI flags and the web options panel.
- Add or update tests next to the code you change; rendering changes should keep `packages/cli/test/render.test.ts`
  passing, and please attach before/after images to the pull request.
- Run `bun run lint`, `bun run typecheck` and `bun test` before pushing. CI runs the same checks plus the launch
  scripts on Linux, macOS and Windows.

## Pull requests

- One topic per pull request, with a short description of what changed and why.
- Screenshots for anything visual.
- Commit messages in the imperative mood ("Add runesmith emblem").

## Reporting problems

Use the [content correction form](https://github.com/allquixotic/pf-sf-infographics/issues/new?template=content-correction.yml)
for class text or ratings. Include the game, rating set, rules version and supporting evidence.

For other problems, open an issue with the options you used (the CLI command, or the settings from the web UI), what you expected and
what you got. For rules questions, link the relevant Archives of Nethys page.
