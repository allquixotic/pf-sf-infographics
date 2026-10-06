# Content format

A *content tree* is a folder (in this repository: [`content/`](../content)) that holds everything the infographic
says and looks like. The engine reads it through a `ContentSource`: a local folder (CLI, local launcher), a URL, or a
GitHub repository and branch (`owner/repo@ref:dir`, read from `raw.githubusercontent.com`). Paths inside the tree are
relative, POSIX-style, and may not escape the tree.

JSON Schemas for every file type are generated into [`content/schema/`](../content/schema) from the zod schemas in
[`packages/engine/src/content/schema.ts`](../packages/engine/src/content/schema.ts), which are the authority.

```
content/
  manifest.json              entry point: games + index of every file
  schema/                    JSON Schemas (generated)
  shared/
    fonts/                   font files and their licenses
    themes/classic.json      fonts and light/dark palettes
    icons/attributes/*.svg   key attribute badges (str, dex, con, int, wis, cha)
    icons/traditions/*.svg   magic tradition icons (arcane, divine, occult, primal)
  pf2e/
    game.json                everything game-wide: groups, ratings, legend text, credits, art packs, class list
    classes/<id>.json        one file per class
    emblems/<id>.svg         generic emblem per class
  sf2e/ …                    same layout
```

## manifest.json

```jsonc
{
  "schemaVersion": 1,
  "name": "Pathfinder & Starfinder class infographics",
  "games": [{ "id": "pf2e", "path": "pf2e/game.json" }, { "id": "sf2e", "path": "sf2e/game.json" }],
  "files": [{ "path": "pf2e/classes/alchemist.json", "size": 1234, "sha256": "…" }]
}
```

`files` lists every file with its size and SHA-256 so a repository can be mirrored or cached without directory
listings. It is generated: run `bun run content:manifest` after changing anything. CI fails if it is stale.

## game.json

| Field | Meaning |
| --- | --- |
| `id`, `title`, `system`, `shortName`, `asOf` | Identity and the poster's title and "Content updated" text. |
| `theme` | Path to a theme file (fonts and colors). |
| `attributes`, `traditions` | `{ id, label, icon }` lists used by classes and the legend. |
| `ratings` | The rating rows (offense, defense, …): `{ id, label, description, color, colorblind }`. |
| `groups` | Poster sections in display order, e.g. Martial / Spellcasters / Hybrid & specialist. |
| `castingTypes` | `{ id, label, description }`, e.g. prepared, spontaneous. |
| `statuses` | Labels for `core`, `expansion`, `playtest`, `legacy`. Playtest and legacy cards get a badge. |
| `legend` | Titles and text of the legend boxes. Text supports `**bold**` and `*italic*`; blank lines split paragraphs. |
| `artPacks` | Downloadable art such as Paizo's Community Use Package zips: `{ id, label, kind, url, fileName, license, credit }`. Never hotlinked; users supply the files. |
| `credits` | `{ role, names, when }`; `when` is `always`, `paizo-art` or `generic-art`. |
| `notices` | `cup` (Paizo Community Use notice), `design` (original design credit), `license`. |
| `classes` | Paths of the class files. |
| `methodology` | Optional plain-text rubric, assumptions and limitations shown under About these ratings. |
| `ratingSets` | Optional named perspectives; see below. |

## Multiple rating sets in one repository

Add `ratingSets` to the manifest's main `game.json`:

```json
"ratingSets": [
  {
    "id": "revised",
    "name": "Revised role estimates",
    "description": "Editorial estimates for standard rules and ordinary builds."
  },
  {
    "id": "my-table",
    "name": "Our table's perspective",
    "description": "A low-level campaign with frequent social encounters.",
    "path": "rating-sets/my-table/game.json"
  }
]
```

The first entry is the default and **must omit `path`**: it uses the enclosing game file and its class list.
Every later entry **must include `path`**, pointing to a complete game file. Each set can supply its own class
roster, details, ratings, families, rubric, legend, theme and artwork references. There is no implicit merging
or score inheritance. Share unchanged class files or assets with relative paths, or copy classes that differ.

For example, `pf2e/rating-sets/my-table/game.json` can use `../../../shared/themes/classic.json` as its theme,
`classes/oracle.json` for an independent Oracle, and `../../classes/fighter.json` to reuse the default Fighter.
An alternate class at `rating-sets/my-table/classes/oracle.json` can reference `../../../emblems/oracle.svg`.
All paths resolve relative to the file containing them and must stay inside the content tree.

Set IDs must be unique within a game. Alternate game files must keep the same game `id` and must not contain
nested `ratingSets`. A source without `ratingSets` still works: it receives one set called Default (`default`).
Explicit unknown IDs fail in the engine/CLI. The browser falls back to the default if a previously saved set
has disappeared from a reloaded source.

The UI has one selector, with a question-mark description tooltip accessible by hover, keyboard focus or tap.
Set names and descriptions appear in the exported guide when its legend is enabled; output filenames always
include the set ID. Class selections and filters are saved separately for each source/game/set combination.
Shared layout and appearance settings remain shared. Custom artwork remains associated with game and class ID.

CLI: `--rating-set my-table`; `list --game pf2e` reports available sets, while
`list --game pf2e --rating-set my-table` lists that set's classes. `--max-complexity 2.5` filters on the upper
end of the `difficulty` range. New perspectives should describe their assumptions and avoid claiming
community approval without evidence. Regenerate the manifest after adding files.

## classes/&lt;id&gt;.json

```jsonc
{
  "$schema": "../../schema/class.schema.json",
  "id": "cleric",                          // lowercase, digits, hyphens; must match the file name
  "name": "Cleric",
  "status": "core",                        // core | expansion | playtest | legacy
  "source": { "title": "Player Core", "date": "2023-11" },
  "group": "spellcasters",                   // a group id from game.json
  "keyAttributes": ["wis"],                // several = "choose one"
  "traditions": ["divine"],                // magic traditions the class draws on
  "traditionsChosen": false,               // true if a subclass picks one of them
  "casting": "prepared",                   // a castingTypes id, or null
  "hp": 8,                                 // hit points per level
  "ratings": {                             // every rating from game.json; 0–5 in steps of 0.5
    "offense": [2, 3],                     // [low, high] draws hatched squares for a build-dependent range
    "defense": [1, 3],
    "support": [4, 5],
    "utility": 5,
    "difficulty": 3
  },
  "features": [                            // 2–3 entries, about 450 characters in total
    { "title": "Voice of a deity", "text": "…" },
    { "title": "Divine font", "text": "…" }
  ],
  "iconic": { "name": "Kyra", "ancestry": "human" },
  "art": {
    "emblem": "../emblems/cleric.svg",     // our generic art
    "paizo": { "pack": "cup-pf2e-iconics", "file": "PNG/Cleric - Kyra.png" },
    "local": "cleric"                      // name looked up in user-supplied images (local-assets/art/pf2e/)
  },
  "links": { "archivesOfNethys": "https://2e.aonprd.com/Classes.aspx?ID=33" }
}
```

### Review metadata

A class may include `review` with `reviewedOn` (ISO `YYYY-MM-DD`), `rulesVersion`, `sources` (URL array),
`notes`, and `ratings` (an explanation for every rating ID). When present, rationale keys must match the
game's metrics exactly. The bundled sets include this metadata for every class; it remains optional for older
content trees. Sources substantiate the mechanics, not the numerical judgment.

```json
"review": {
  "reviewedOn": "2026-10-05",
  "rulesVersion": "Player Core 2",
  "sources": ["https://2e.aonprd.com/Classes.aspx?ID=61"],
  "notes": "Standard rules; no Free Archetype. Scores are editorial judgments.",
  "ratings": {
    "offense": "Spell choices determine the available damage tools.",
    "defense": "Armor, saves and defensive magic inform this estimate.",
    "support": "Healing and protection are included.",
    "utility": "Noncombat spells and skills are included.",
    "difficulty": "Track spell choices and cursebound costs."
  }
}
```

`difficulty` remains the stable internal ID for compatibility; the bundled display label is **Complexity**.
A range represents different viable builds, not statistical uncertainty or all strengths available at once.

## Themes

```jsonc
{
  "id": "classic",
  "fonts": {
    "heading": { "family": "Ultra", "files": ["../fonts/Ultra-Regular.ttf"] },
    "body": { "family": "Lexend", "files": ["../fonts/Lexend-Regular.ttf", "../fonts/Lexend-Bold.ttf"] }
  },
  "light": { "background": "#ffffff", "ink": "#111111", "muted": "#5a5752", "cardFill": "#ffffff",
             "bannerFill": "#111111", "bannerInk": "#ffffff", "accent": "#b8452f" },
  "dark":  { … }
}
```

`family` must match the name inside the font files (TTF or OTF). Fonts must allow redistribution.

## Icons

SVG, single color via `currentColor` (the engine substitutes the theme's ink color, which is how dark mode works),
cut-outs via `fill-rule="evenodd"` or black-and-white masks. See [CONTRIBUTING.md](../CONTRIBUTING.md#icons-and-emblems).

## Validation

`loadContent()` validates every file against its schema and cross-checks references (groups, attributes, traditions,
casting types, ratings, art packs, duplicate ids). It reports all problems at once. A missing emblem is a warning
(the card renders without art); everything else is an error. `bun run content:check` treats warnings as errors.
