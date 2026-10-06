import type { z } from 'zod';
import {
  type ClassDef,
  classSchema,
  type Game,
  gameSchema,
  type Manifest,
  manifestSchema,
  type Theme,
  themeSchema,
} from './schema';
import { type ContentSource, resolvePath } from './source';

export interface LoadedClass extends ClassDef {
  /** Path of the class JSON file inside the content tree. */
  path: string;
  /** Resolved path of the generic emblem SVG. */
  emblemPath: string;
}

export interface GameBundle {
  game: Game;
  ratingSet?: { id: string; name: string; description: string };
  path: string;
  theme: Theme;
  /** Raw font files for the theme, in declaration order (heading first). */
  fonts: Uint8Array[];
  classes: LoadedClass[];
  /**
   * SVG sources keyed by `attr:<id>`, `trad:<id>` and `emblem:<classId>`. Icons use `currentColor` for ink so the
   * engine can recolor them per theme.
   */
  icons: Map<string, string>;
}

export interface ContentBundle {
  sourceLabel: string;
  manifest: Manifest;
  games: Map<string, GameBundle>;
  ratingSets: Map<string, Map<string, GameBundle>>;
  /** Non-fatal problems (for example a manifest checksum mismatch). */
  warnings: string[];
}

export class ContentValidationError extends Error {
  constructor(readonly problems: string[]) {
    super(`Content is invalid:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    this.name = 'ContentValidationError';
  }
}

function formatIssues(path: string, error: z.ZodError): string[] {
  return error.issues.map((i) => `${path}${i.path.length ? ` → ${i.path.join('.')}` : ''}: ${i.message}`);
}

async function readJson<T>(
  source: ContentSource,
  path: string,
  schema: z.ZodType<T>,
  problems: string[],
): Promise<T | undefined> {
  let raw: unknown;
  try {
    raw = JSON.parse(await source.readText(path));
  } catch (err) {
    problems.push(`${path}: ${(err as Error).message}`);
    return undefined;
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    problems.push(...formatIssues(path, parsed.error));
    return undefined;
  }
  return parsed.data;
}

async function readIcon(
  source: ContentSource,
  path: string,
  problems: string[],
): Promise<string | undefined> {
  try {
    const text = await source.readText(path);
    if (!/<svg[\s>]/.test(text)) problems.push(`${path}: not an SVG file`);
    return text;
  } catch (err) {
    problems.push((err as Error).message);
    return undefined;
  }
}

function crossCheck(game: Game, gamePath: string, classes: LoadedClass[], problems: string[]): void {
  const has = (list: { id: string }[], v: string) => list.some((x) => x.id === v);
  const seen = new Set<string>();
  for (const c of classes) {
    const where = c.path;
    if (seen.has(c.id)) problems.push(`${where}: duplicate class id "${c.id}"`);
    seen.add(c.id);
    if (!has(game.groups, c.group)) problems.push(`${where}: unknown group "${c.group}"`);
    for (const a of c.keyAttributes)
      if (!has(game.attributes, a)) problems.push(`${where}: unknown attribute "${a}"`);
    for (const t of c.traditions)
      if (!has(game.traditions, t)) problems.push(`${where}: unknown tradition "${t}"`);
    if (c.casting !== null && !has(game.castingTypes, c.casting))
      problems.push(`${where}: unknown casting type "${c.casting}"`);
    for (const r of game.ratings)
      if (!(r.id in c.ratings)) problems.push(`${where}: missing rating "${r.id}"`);
    for (const r of Object.keys(c.ratings))
      if (!has(game.ratings, r)) problems.push(`${where}: unknown rating "${r}" (defined in ${gamePath})`);
    if (c.review) {
      for (const r of game.ratings)
        if (!c.review.ratings[r.id]) problems.push(`${where}: missing review rationale for "${r.id}"`);
      for (const r of Object.keys(c.review.ratings))
        if (!has(game.ratings, r)) problems.push(`${where}: unknown review rating "${r}"`);
    }
    if (c.art.paizo && !has(game.artPacks, c.art.paizo.pack))
      problems.push(`${where}: unknown art pack "${c.art.paizo.pack}"`);
  }
}

async function loadGame(
  source: ContentSource,
  gamePath: string,
  problems: string[],
  warnings: string[],
): Promise<GameBundle | undefined> {
  const game = await readJson(source, gamePath, gameSchema, problems);
  if (!game) return undefined;

  const themePath = resolvePath(gamePath, game.theme);
  const theme = await readJson(source, themePath, themeSchema, problems);

  const classResults = await Promise.all(
    game.classes.map(async (rel) => {
      const path = resolvePath(gamePath, rel);
      const def = await readJson(source, path, classSchema, problems);
      return def
        ? ({ ...def, path, emblemPath: resolvePath(path, def.art.emblem) } satisfies LoadedClass)
        : undefined;
    }),
  );
  const classes = classResults.filter((c): c is LoadedClass => c !== undefined);
  crossCheck(game, gamePath, classes, problems);

  const iconJobs: [string, string][] = [
    ...game.attributes.map((a): [string, string] => [`attr:${a.id}`, resolvePath(gamePath, a.icon)]),
    ...game.traditions.map((t): [string, string] => [`trad:${t.id}`, resolvePath(gamePath, t.icon)]),
    ...classes.map((c): [string, string] => [`emblem:${c.id}`, c.emblemPath]),
  ];
  // A missing emblem only degrades that card (it renders without art), so it is a warning, not an error.
  const icons = new Map<string, string>();
  await Promise.all(
    iconJobs.map(async ([key, path]) => {
      const svg = await readIcon(source, path, key.startsWith('emblem:') ? warnings : problems);
      if (svg) icons.set(key, svg);
    }),
  );

  if (!theme) return undefined;
  const fontPaths = [...theme.fonts.heading.files, ...theme.fonts.body.files].map((f) =>
    resolvePath(themePath, f),
  );
  const fonts: Uint8Array[] = [];
  for (const p of [...new Set(fontPaths)]) {
    try {
      fonts.push(await source.readBytes(p));
    } catch (err) {
      problems.push((err as Error).message);
    }
  }

  return { game, path: gamePath, theme, fonts, classes, icons };
}

/**
 * Loads and validates a whole content tree. Throws ContentValidationError listing every problem found, so authors
 * can fix them in one pass.
 */
export async function loadContent(
  source: ContentSource,
  opts: { games?: string[] } = {},
): Promise<ContentBundle> {
  // Perspectives commonly share fonts, icons and unchanged classes. Fetch each path once
  // per load, while allowing a subsequent reload to see edits to the content source.
  const original = source;
  const texts = new Map<string, Promise<string>>();
  const bytes = new Map<string, Promise<Uint8Array>>();
  source = {
    label: original.label,
    readText(path) {
      if (!texts.has(path)) texts.set(path, original.readText(path));
      return texts.get(path)!;
    },
    readBytes(path) {
      if (!bytes.has(path)) bytes.set(path, original.readBytes(path));
      return bytes.get(path)!;
    },
  };
  const problems: string[] = [];
  const warnings: string[] = [];
  const manifest = await readJson(source, 'manifest.json', manifestSchema, problems);
  if (!manifest) throw new ContentValidationError(problems);

  const wanted = manifest.games.filter((g) => !opts.games || opts.games.includes(g.id));
  const games = new Map<string, GameBundle>();
  const ratingSets = new Map<string, Map<string, GameBundle>>();
  for (const entry of wanted) {
    if (games.has(entry.id)) problems.push(`manifest.json: duplicate game id "${entry.id}"`);
    const bundle = await loadGame(source, entry.path, problems, warnings);
    if (bundle) {
      if (bundle.game.id !== entry.id)
        problems.push(`${entry.path}: game id "${bundle.game.id}" does not match manifest id "${entry.id}"`);
      games.set(entry.id, bundle);
      const sets = new Map<string, GameBundle>();
      const defs = bundle.game.ratingSets ?? [
        {
          id: 'default',
          name: 'Default',
          description: 'The ratings and class descriptions supplied by this content source.',
        },
      ];
      for (const [i, def] of defs.entries()) {
        if (sets.has(def.id)) problems.push(`${entry.path}: duplicate rating set "${def.id}"`);
        if ((i === 0 && def.path) || (i > 0 && !def.path)) {
          problems.push(`${entry.path}: first rating set must omit path; subsequent sets require a path`);
          continue;
        }
        const variant = def.path
          ? await loadGame(source, resolvePath(entry.path, def.path), problems, warnings)
          : bundle;
        if (!variant) continue;
        if (variant.game.id !== entry.id)
          problems.push(`${variant.path}: rating set must use game id "${entry.id}"`);
        if (def.path && variant.game.ratingSets)
          problems.push(`${variant.path}: nested ratingSets are not supported`);
        variant.ratingSet = { id: def.id, name: def.name, description: def.description };
        sets.set(def.id, variant);
      }
      ratingSets.set(entry.id, sets);
    }
  }
  if (problems.length) throw new ContentValidationError(problems);
  return { sourceLabel: source.label, manifest, games, ratingSets, warnings };
}

/** Select a complete perspective; explicit unknown ids are errors, never silent score substitutions. */
export function getGameBundle(content: ContentBundle, game: string, ratingSet?: string): GameBundle {
  const bundle = content.games.get(game);
  if (!bundle) throw new Error(`Unknown game "${game}". Available: ${[...content.games.keys()].join(', ')}`);
  if (!ratingSet) return bundle;
  const selected = content.ratingSets.get(game)?.get(ratingSet);
  if (!selected)
    throw new Error(
      `Unknown rating set "${ratingSet}" for ${game}. Available: ${[...(content.ratingSets.get(game)?.keys() ?? [])].join(', ')}`,
    );
  return selected;
}

export function allGameBundles(content: ContentBundle): GameBundle[] {
  return [...content.ratingSets.values()].flatMap((sets) => [...sets.values()]);
}
