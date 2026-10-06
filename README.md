# Pathfinder 2e & Starfinder 2e Class Infographics

Make your own class-overview poster or printable booklet for **Pathfinder Second Edition** and **Starfinder Second
Edition**, in the style of [Rachelle Willemsma's Pathfinder 2E Classes Infographic](https://willemsma.design/pathfinder/).
Pick the classes, layout, paper or screen size, light or dark theme, official iconic art or our own emblems, and
download a PDF, SVG, PNG, JPG or WebP.

- **Web app:** [open the app](https://allquixotic.github.io/pf-sf-infographics/). Runs entirely in your browser (no server, nothing uploaded).
- **Local app:** `./start.sh` (macOS/Linux) or `start.bat` (Windows) runs the same UI from your own checkout, so you
  can edit the content on a fork and see it immediately, without committing.
- **CLI:** `./pfsf.sh` / `pfsf.bat` renders from the command line, handy for scripts and CI.

Covered as of October 5, 2026: all 29 printed Pathfinder 2e classes plus the daredevil and slayer playtest, and the
six Starfinder 2e Player Core classes plus the mechanic, technomancer and luminary playtests. See
[docs/classes.md](docs/classes.md).

## Quick start

You only need Git. The launch scripts download a private copy of the latest stable [Bun](https://bun.sh) into
`.runtime/` on first run (verified against Bun's published checksums) and never touch your system.

```bash
git clone https://github.com/allquixotic/pf-sf-infographics.git
cd pf-sf-infographics
./start.sh
```

On Windows, double-click `start.bat` or run it from a terminal. The first run offers to download Paizo's free
Community Use Package portraits into `local-assets/` (about 76 MB); say no to use our generic emblems instead.

### Command line

```bash
./pfsf.sh --help
./pfsf.sh --game pf2e --format pdf                            # 24×36 in poster PDF in ./out
./pfsf.sh --game sf2e --layout booklet --size a4 --playtest   # A4 booklet, including playtest classes
./pfsf.sh --game pf2e --intent screen --size uhd --format png --theme dark --art paizo
./pfsf.sh --content you/pf-sf-infographics@my-branch          # render a fork's content straight from GitHub
./pfsf.sh --game pf2e --rating-set original --max-complexity 2.5
./pfsf.sh fetch-art                                           # download the Community Use Package portraits
```

If you already have Bun, `bun install` then `bun run cli -- …`, `bun start` and `bun test` work too.

## Options

| Option | Choices |
| --- | --- |
| Game | Pathfinder 2e, Starfinder 2e (separate tabs / `--game`) |
| Rating set | one dropdown selects a complete perspective, with a description in its question-mark tooltip; CLI `--rating-set` |
| Class selection | Player Core / Player Core + 2 / All published presets, individual checkboxes, maximum complexity |
| Layout | poster (one sheet) or booklet (pages you can print on a home printer) |
| Intent and size | print: Letter, Legal, Tabloid, 18×24, 24×36, 36×48 in, A5–A0; screen: Full HD, QHD, 4K, 8K, tablet, phone; fit to content; or any custom size |
| Format | PDF (vector, selectable text), SVG (vector), PNG, JPG, WebP |
| Artwork | official iconic art (from Paizo's Community Use Package, supplied by you), custom images or ZIPs, our generic SVG emblems, or none |
| Look | light or dark, custom background and font colors, transparent output, classic / color-blind-safe / grayscale rating colors, text size |
| Contents | include or exclude playtest classes or any individual class, group by class family or alphabetically, legend, hit points and sources, custom title and date |
| Print | DPI for raster output, bleed, page numbers, repeat booklet section headings on continuation pages |
| Attribution | credits and notices can be switched off, but please keep them when you share an image |

The website has its own light/dark toggle (dark by default), separate from output colors. Hover over the preview
to expand it, or use the always-visible expand button on touch screens; click the image to zoom in either view.
Escape or the close button returns to the normal preview. Settings are saved in localStorage and uploaded art in
IndexedDB, when browser storage is available. Clearing site data removes them.

For custom art, choose **Official / custom art** and upload images or a ZIP containing names such as
`animist.png`, `Witchwarper.svg`, or `Fighter - Portrait.jpg`. PNG, JPEG, SVG, WebP and GIF are supported;
nested folders, case differences and common separators work. Custom uploads apply to the selected game;
unmatched classes fall back to emblems. See [artwork details](docs/paizo-assets.md#custom-artwork).

CLI equivalents include `--background-color '#f0eddc'`, `--font-color '#203040'`, and
`--no-repeat-section-titles` for booklets.

## How it works

```
content/ (JSON, SVG, fonts) ──► @pfsf/engine ──► Typst (WebAssembly) ──► PDF / SVG
                                                        └─► resvg ──► PNG ─► JPG / WebP
          web UI (Vue) and CLI (Bun) are thin shells around the engine
```

The layout is drawn by [Typst](https://typst.app) compiled to WebAssembly, so the browser and the CLI produce
identical output, PDFs have real text, and booklets paginate properly.

## Content from any repository

Everything the infographic says (class summaries, ratings, groupings, colors, fonts, icons) lives in
[`content/`](content/), described by [`content/manifest.json`](content/manifest.json). The web app can load content
from any GitHub repository or branch that follows [the content format](docs/content-format.md): open the
"Content source" panel, or add `?repo=owner/repo@branch` to the URL.

The bundled **Revised role estimates** use an explicit rubric and include sources and reasoning for all 40
classes. **Original ratings (September 2026)** preserves the previous scores for comparison, alongside corrected
class summaries. Scores are editorial judgments, not community consensus. Open **About these ratings** in the app
or read [the rating guide](docs/ratings.md).

## Contributing

Corrections to ratings and summaries, new classes, translations and better icons are all welcome. See
[CONTRIBUTING.md](CONTRIBUTING.md).

## Credits and licenses

- **Design:** based on the [Pathfinder 2E Classes Infographic](https://willemsma.design/pathfinder/) by
  **Rachelle Willemsma**, used with her permission. This project has been posted with permission of Rachelle Willemsma. The original chart concept was by u/Rednidedni.
- **Code** (`packages/`, `tools/`, scripts): [Apache License 2.0](LICENSE).
- **Content** (`content/`: class summaries, ratings, icons, emblems, data): [CC BY 4.0](LICENSES/CC-BY-4.0.txt),
  © pf-sf-infographics contributors. Fonts: Ultra (Apache-2.0) and Lexend (OFL-1.1), see `content/shared/fonts/`.
- **Paizo material** is not part of this repository. See [NOTICE.md](NOTICE.md) and
  [docs/paizo-assets.md](docs/paizo-assets.md).

This website uses trademarks and/or copyrights owned by Paizo Inc., used under Paizo's Community Use Policy
([paizo.com/licenses/communityuse](https://paizo.com/licenses/communityuse)). We are expressly prohibited from
charging you to use or access this content. This website is not published, endorsed, or specifically approved by
Paizo. For more information about Paizo Inc. and Paizo products, visit [paizo.com](https://paizo.com).

### Printing and saved settings

Layout, paper, appearance, artwork mode, text size and export settings are shared between game tabs. Class
selections, complexity limits and custom title/date text remain specific to each content source, game and rating set. Old saved settings migrate using the active
game’s common values. Browser storage is local to the current site address.

**Default** restores text size to 100%. **Auto** compares every 5% step from 80% through 130%, using the actual
fitted class text. Its score balances the smallest body text with page coverage (text size × square root of
coverage); booklet coverage counts class-card area on class pages. It keeps paper, margins and selected classes
unchanged. This is an optimization across the available slider settings, not a guarantee of zero whitespace.
Run it again after changing layout, paper or content.

**Print**, next to Download, opens the browser print dialog with fresh vector pages at the selected dimensions.
Choose the matching printer paper and 100% scale; browser/printer overrides still apply. No file is downloaded.

For Necromancer and Runesmith portraits, see [the Paizo source and permission notes](docs/paizo-assets.md#necromancer-and-runesmith-portraits).
