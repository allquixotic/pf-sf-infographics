#!/usr/bin/env bun
/**
 * pfsf — render Pathfinder 2e / Starfinder 2e class infographics from the command line.
 * Run `bun run cli --help` (or ./pfsf.sh / pfsf.bat) for usage.
 */
import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import {
  type ContentBundle,
  ContentValidationError,
  Engine,
  loadContent,
  OUTPUT_FORMATS,
  type OutputFormat,
  prepareDocument,
  type RenderOptionsInput,
  resolveOptions,
  SIZE_PRESETS,
  selectClasses,
} from '@pfsf/engine';
import { DEFAULT_ASSET_DIR, fetchPaizoPacks, loadLocalArt } from './art';
import { bunRuntime } from './runtime';
import { contentSourceFor, REPO_ROOT } from './source';

const HELP = `pfsf — Pathfinder 2e / Starfinder 2e class infographic generator

Usage:
  pfsf [render] [options]      Render an infographic (default command)
  pfsf list                    List games, classes and size presets
  pfsf check                   Validate a content tree
  pfsf fetch-art [--force]     Download the Paizo Community Use Package portraits into local-assets/paizo/

Content and art:
  --content <src>        Folder, URL, or GitHub repo (owner/repo[@ref][:dir]). Default: ./content
  --assets <dir>         Folder with Paizo zips (paizo/) and extra images (art/<game>/). Default: local-assets
  --out <dir>            Output folder. Default: out
  --name <base>          Output file name without extension

What to draw:
  --game <id>            pf2e | sf2e (default pf2e)
  --layout <l>           poster | booklet (default poster)
  --art <a>              paizo | generic | none (default generic)
  --playtest             Include playtest classes
  --legacy               Include legacy classes
  --only <ids>           Comma-separated class ids to include
  --exclude <ids>        Comma-separated class ids to leave out
  --grouping <g>         groups | alphabetical
  --no-legend            Leave out the how-to-use and key boxes
  --no-stats             Hide hit points and source lines
  --no-attribution       Leave out credits and notices (please keep them when sharing!)
  --title <text>         Replace the title
  --as-of <text>         Replace the "accurate as of" text

Look:
  --theme <t>            light | dark
  --background-color <hex>  Output background, e.g. #ffffff
  --font-color <hex>        Output text, e.g. #111111
  --transparent          Transparent background
  --palette <p>          classic | colorblind | grayscale
  --font-scale <n>       0.7 – 1.5

Output:
  --format <f[,f…]>      ${OUTPUT_FORMATS.join(' | ')} (default pdf; several allowed)
  --intent <i>           print | screen (default print)
  --size <s>             Preset id, fit, or WxH with unit (e.g. 24x36in, 1920x1080px, 297x420mm)
  --orientation <o>      auto | portrait | landscape
  --dpi <n>              Raster DPI for print intent (default 200)
  --scale <n>            Raster multiplier for screen intent (default 1)
  --quality <n>          JPG/WebP quality 1–100 (default 90)
  --margin <pt>          Page margin in points
  --bleed <mm>           Print bleed in millimetres
  --no-page-numbers      Booklet without page numbers
  --no-repeat-section-titles  Hide section titles on continuation pages
  --emit-typst           Also write the Typst source and data.json (for template debugging)

  -h, --help             Show this help
`;

function parseSize(v: string | undefined): RenderOptionsInput['size'] {
  if (!v) return undefined;
  const m = /^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)(pt|in|mm|px)$/i.exec(v.trim());
  if (m)
    return {
      width: Number(m[1]),
      height: Number(m[2]),
      unit: m[3]!.toLowerCase() as 'pt' | 'in' | 'mm' | 'px',
    };
  return v;
}

const list = (v: string | undefined) =>
  v
    ?.split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const num = (v: string | undefined) => (v === undefined ? undefined : Number(v));

async function load(spec: string | undefined): Promise<ContentBundle> {
  const source = contentSourceFor(spec);
  try {
    const content = await loadContent(source);
    for (const w of content.warnings) console.warn(`warning: ${w}`);
    return content;
  } catch (err) {
    if (err instanceof ContentValidationError) {
      console.error(err.message);
      process.exit(2);
    }
    throw err;
  }
}

async function main(argv: string[]): Promise<void> {
  const { values: v, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      help: { type: 'boolean', short: 'h' },
      content: { type: 'string' },
      assets: { type: 'string' },
      out: { type: 'string' },
      name: { type: 'string' },
      game: { type: 'string' },
      layout: { type: 'string' },
      art: { type: 'string' },
      playtest: { type: 'boolean' },
      legacy: { type: 'boolean' },
      only: { type: 'string' },
      exclude: { type: 'string' },
      grouping: { type: 'string' },
      'no-legend': { type: 'boolean' },
      'no-stats': { type: 'boolean' },
      'no-attribution': { type: 'boolean' },
      title: { type: 'string' },
      'as-of': { type: 'string' },
      theme: { type: 'string' },
      transparent: { type: 'boolean' },
      'background-color': { type: 'string' },
      'font-color': { type: 'string' },
      'no-repeat-section-titles': { type: 'boolean' },
      palette: { type: 'string' },
      'font-scale': { type: 'string' },
      format: { type: 'string' },
      intent: { type: 'string' },
      size: { type: 'string' },
      orientation: { type: 'string' },
      dpi: { type: 'string' },
      scale: { type: 'string' },
      quality: { type: 'string' },
      margin: { type: 'string' },
      bleed: { type: 'string' },
      'no-page-numbers': { type: 'boolean' },
      'emit-typst': { type: 'boolean' },
      force: { type: 'boolean' },
    },
  });
  if (v.help) {
    console.log(HELP);
    return;
  }
  const command = positionals[0] ?? 'render';
  const assets = resolve(v.assets ?? join(REPO_ROOT, DEFAULT_ASSET_DIR));

  if (command === 'check') {
    const content = await load(v.content);
    for (const [id, g] of content.games) console.log(`${id}: ${g.classes.length} classes OK`);
    return;
  }

  if (command === 'fetch-art') {
    const content = await load(v.content);
    const report = await fetchPaizoPacks(assets, content, { force: v.force ?? false, log: console.log });
    console.log(`Downloaded ${report.downloaded.length}, already present ${report.skipped.length}.`);
    return;
  }

  if (command === 'list') {
    const content = await load(v.content);
    for (const [id, g] of content.games) {
      console.log(`\n${id} — ${g.game.title} (${g.game.system})`);
      for (const c of g.classes) {
        console.log(
          `  ${c.id.padEnd(14)} ${c.name.padEnd(14)} ${c.status.padEnd(10)} ${c.group.padEnd(16)} ${c.source.title}`,
        );
      }
    }
    console.log('\nSize presets:');
    for (const p of SIZE_PRESETS) console.log(`  ${p.id.padEnd(14)} ${p.intent.padEnd(7)} ${p.label}`);
    return;
  }

  if (command !== 'render') {
    console.error(`Unknown command "${command}". Try --help.`);
    process.exit(1);
  }

  const content = await load(v.content);
  const formats = (list(v.format) ?? ['pdf']) as OutputFormat[];
  for (const f of formats) {
    if (!OUTPUT_FORMATS.includes(f)) throw new Error(`Unknown format "${f}"`);
  }
  const base: RenderOptionsInput = {
    game: v.game,
    layout: v.layout as RenderOptionsInput['layout'],
    art: v.art as RenderOptionsInput['art'],
    includePlaytest: v.playtest,
    includeLegacy: v.legacy,
    only: list(v.only),
    exclude: list(v.exclude),
    grouping: v.grouping as RenderOptionsInput['grouping'],
    legend: v['no-legend'] ? false : undefined,
    stats: v['no-stats'] ? false : undefined,
    attribution: v['no-attribution'] ? false : undefined,
    title: v.title,
    asOf: v['as-of'],
    theme: v.theme as RenderOptionsInput['theme'],
    background: v.transparent ? false : undefined,
    backgroundColor: v['background-color'],
    fontColor: v['font-color'],
    repeatSectionTitles: v['no-repeat-section-titles'] ? false : undefined,
    palette: v.palette as RenderOptionsInput['palette'],
    fontScale: num(v['font-scale']),
    intent: v.intent as RenderOptionsInput['intent'],
    size: parseSize(v.size),
    orientation: v.orientation as RenderOptionsInput['orientation'],
    dpi: num(v.dpi),
    scale: num(v.scale),
    quality: num(v.quality),
    margin: num(v.margin),
    bleed: num(v.bleed),
    pageNumbers: v['no-page-numbers'] ? false : undefined,
  };
  // Drop undefined keys so schema defaults apply.
  const options = Object.fromEntries(
    Object.entries(base).filter(([, x]) => x !== undefined),
  ) as RenderOptionsInput;

  const art =
    options.art === 'paizo' ? await loadLocalArt(assets, content, (m) => console.log(m)) : undefined;
  if (
    options.art === 'paizo' &&
    art &&
    art.packIds.length === 0 &&
    art.customPackCount === 0 &&
    art.localCount === 0
  ) {
    console.warn(
      `warning: no supplied art found in ${assets}. Add custom images or run "pfsf fetch-art" (or ./pfsf.sh fetch-art); using generic emblems.`,
    );
  }

  const outDir = resolve(v.out ?? 'out');
  await mkdir(outDir, { recursive: true });

  if (v['emit-typst']) {
    const doc = prepareDocument({ content, options, art });
    await Bun.write(join(outDir, 'main.typ'), doc.main);
    for (const f of doc.files) await Bun.write(join(outDir, 'typst-files', f.path), f.bytes);
    console.log(`Wrote Typst sources to ${outDir}`);
  }

  const bundle = content.games.get(options.game ?? 'pf2e');
  if (bundle) {
    const chosen = selectClasses(bundle, resolveOptions(options));
    console.log(`${chosen.length} classes: ${chosen.map((c) => c.id).join(', ')}`);
  }

  const engine = new Engine(bunRuntime);
  for (const format of formats) {
    const t0 = performance.now();
    const result = await engine.render({
      content,
      options: { ...options, format },
      art,
      baseName: v.name,
      onProgress: (m) => process.stderr.write(`  ${m}\n`),
    });
    for (const w of result.warnings) console.warn(`warning: ${w}`);
    for (const f of result.files) {
      const path = join(outDir, f.name);
      await Bun.write(path, f.data);
      const dims = f.width ? ` ${Math.round(f.width)}×${Math.round(f.height ?? 0)}` : '';
      console.log(`wrote ${path}${dims} (${(f.data.byteLength / 1024).toFixed(0)} KB)`);
    }
    console.log(`${format} done in ${((performance.now() - t0) / 1000).toFixed(1)} s`);
  }
}

main(Bun.argv.slice(2)).catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
