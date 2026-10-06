/**
 * Turns validated content plus options into a plain JSON document model. The model is handed to the Typst
 * templates as /data.json, so Typst only does presentation and all decisions live here in TypeScript.
 */
import type { ArtLibrary } from '../art/library';
import type { GameBundle, LoadedClass } from '../content/load';
import type { Palette, Rating } from '../content/schema';
import type { ResolvedOptions } from '../options/schema';
import { parseParagraphs, parseRichText, type Span } from './rich-text';

export interface VirtualFile {
  path: string;
  bytes: Uint8Array;
}

export interface CardModel {
  id: string;
  name: string;
  status: string;
  /** Badge text for non-core statuses worth flagging (playtest, legacy); null otherwise. */
  badge: string | null;
  keyIcons: string[];
  keyLabel: string;
  tradIcons: string[];
  tradChosen: boolean;
  casting: string | null;
  hp: number;
  source: string;
  ratings: { id: string; label: string; lo: number; hi: number; color: string }[];
  features: { title: string; body: Span[] }[];
  art: { kind: 'image' | 'emblem' | 'none'; path: string | null };
  iconic: string | null;
}

export interface SectionModel {
  id: string;
  label: string;
  cards: CardModel[];
}

export interface LegendModel {
  howToUse: { title: string; body: Span[][] };
  ratings: { label: string; color: string; body: Span[] }[];
  attributes: { title: string; items: { icon: string; label: string }[] };
  traditions: { title: string; items: { icon: string; label: string }[] };
  casting: { title: string; items: { label: string; body: Span[] }[] };
  choice: { title: string; body: Span[][] };
  credits: { title: string; items: { role: string; names: string }[] } | null;
}

export interface DocModel {
  meta: { title: string; asOf: string; game: string; system: string };
  options: {
    layout: 'poster' | 'booklet';
    theme: 'light' | 'dark';
    art: string;
    legend: boolean;
    stats: boolean;
    attribution: boolean;
    pageNumbers: boolean;
    repeatSectionTitles: boolean;
    fontScale: number;
  };
  fonts: { heading: string; body: string };
  colors: Palette & { transparent: boolean };
  sections: SectionModel[];
  legend: LegendModel | null;
  notices: Span[][];
  /** Filled in by the layout step. */
  layout: unknown;
}

export interface BuildResult {
  model: DocModel;
  files: VirtualFile[];
  warnings: string[];
}

const GRAYS = ['#3a3a3a', '#5c5c5c', '#7d7d7d', '#9e9e9e', '#bdbdbd'];

function ratingRange(r: Rating): [number, number] {
  return typeof r === 'number' ? [r, r] : r;
}

/** Recolors a single-color icon by replacing `currentColor` (and the legacy black fills) with the ink color. */
export function recolorSvg(svg: string, ink: string): string {
  return svg.replace(/currentColor/g, ink);
}

const enc = new TextEncoder();

export function selectClasses(bundle: GameBundle, o: ResolvedOptions): LoadedClass[] {
  const only = o.only?.length ? new Set(o.only) : undefined;
  const exclude = new Set(o.exclude);
  return bundle.classes.filter((c) => {
    if (o.maxComplexity !== undefined) {
      const complexity = c.ratings.difficulty;
      if (complexity === undefined || ratingRange(complexity)[1] > o.maxComplexity) return false;
    }
    if (only && !only.has(c.id)) return false;
    if (exclude.has(c.id)) return false;
    if (c.status === 'playtest' && !o.includePlaytest && !only?.has(c.id)) return false;
    if (c.status === 'legacy' && !o.includeLegacy && !only?.has(c.id)) return false;
    return true;
  });
}

export function buildModel(bundle: GameBundle, o: ResolvedOptions, art: ArtLibrary | undefined): BuildResult {
  const { game, theme } = bundle;
  const warnings: string[] = [];
  const files: VirtualFile[] = [];
  const palette = { ...(o.theme === 'dark' ? theme.dark : theme.light) };
  if (o.backgroundColor) {
    palette.background = o.backgroundColor;
    palette.cardFill = o.backgroundColor;
    palette.bannerInk = o.backgroundColor;
  }
  if (o.fontColor) {
    palette.ink = o.fontColor;
    palette.muted = o.fontColor;
    palette.bannerFill = o.fontColor;
  }
  const ink = palette.ink;

  const addIcon = (key: string, vpath: string): string => {
    const svg = bundle.icons.get(key);
    if (!svg) {
      warnings.push(`Missing icon ${key}`);
      return '';
    }
    if (!files.some((f) => f.path === vpath))
      files.push({ path: vpath, bytes: enc.encode(recolorSvg(svg, ink)) });
    return vpath;
  };

  const ratingDefs = game.ratings.map((r, i) => ({
    ...r,
    shown:
      o.palette === 'colorblind'
        ? r.colorblind
        : o.palette === 'grayscale'
          ? (GRAYS[i % GRAYS.length] ?? r.color)
          : r.color,
  }));

  const labelOf = <T extends { id: string; label: string }>(list: T[], id: string) =>
    list.find((x) => x.id === id)?.label ?? id;

  let usedPaizoArt = false;
  const cardFor = (c: LoadedClass): CardModel => {
    let artModel: CardModel['art'] = { kind: 'none', path: null };
    if (o.art === 'paizo') {
      const img = art?.resolve({
        game: game.id,
        classId: c.id,
        className: c.name,
        paizo: c.art.paizo,
        local: c.art.local,
      });
      if (img) {
        if (img.officialPack || img.paizoCredit) usedPaizoArt = true;
        const path = `/art/${c.id}.${img.ext}`;
        files.push({ path, bytes: img.bytes });
        artModel = { kind: 'image', path };
      } else {
        warnings.push(`No supplied art available for ${c.name}; using the generic emblem.`);
      }
    }
    if (artModel.kind === 'none' && o.art !== 'none') {
      artModel = { kind: 'emblem', path: addIcon(`emblem:${c.id}`, `/emblems/${c.id}.svg`) || null };
      if (!artModel.path) artModel = { kind: 'none', path: null };
    }
    const statusDef = game.statuses.find((s) => s.id === c.status);
    return {
      id: c.id,
      name: c.name,
      status: c.status,
      badge: c.status === 'playtest' || c.status === 'legacy' ? (statusDef?.label ?? c.status) : null,
      keyIcons: c.keyAttributes.map((a) => addIcon(`attr:${a}`, `/icons/attr-${a}.svg`)),
      keyLabel: c.keyAttributes.map((a) => labelOf(game.attributes, a)).join(' or '),
      tradIcons: c.traditions.map((t) => addIcon(`trad:${t}`, `/icons/trad-${t}.svg`)),
      tradChosen: c.traditionsChosen,
      casting: c.casting ? labelOf(game.castingTypes, c.casting).toLowerCase() : null,
      hp: c.hp,
      source: c.source.title,
      ratings: ratingDefs.map((r) => {
        const [lo, hi] = ratingRange(c.ratings[r.id] ?? 0);
        return { id: r.id, label: r.label, lo, hi, color: r.shown };
      }),
      features: c.features.map((f) => ({ title: f.title, body: parseRichText(f.text) })),
      art: artModel,
      iconic: c.iconic?.name ?? null,
    };
  };

  const selected = selectClasses(bundle, o);
  if (selected.length === 0) warnings.push('No classes match the current filters.');
  const byName = (a: LoadedClass, b: LoadedClass) => a.name.localeCompare(b.name);

  const sections: SectionModel[] =
    o.grouping === 'alphabetical'
      ? [{ id: 'all', label: 'Classes', cards: [...selected].sort(byName).map(cardFor) }]
      : game.groups
          .map((g) => ({
            id: g.id,
            label: g.label,
            cards: selected
              .filter((c) => c.group === g.id)
              .sort(byName)
              .map(cardFor),
          }))
          .filter((s) => s.cards.length > 0);

  const legend: LegendModel | null = o.legend
    ? {
        howToUse: { title: game.legend.howToUseTitle, body: parseParagraphs(game.legend.howToUse) },
        ratings: ratingDefs.map((r) => ({
          label: r.label,
          color: r.shown,
          body: parseRichText(r.description),
        })),
        attributes: {
          title: game.legend.attributesTitle,
          items: game.attributes.map((a) => ({
            icon: addIcon(`attr:${a.id}`, `/icons/attr-${a.id}.svg`),
            label: a.label,
          })),
        },
        traditions: {
          title: game.legend.traditionsTitle,
          items: game.traditions.map((t) => ({
            icon: addIcon(`trad:${t.id}`, `/icons/trad-${t.id}.svg`),
            label: t.label,
          })),
        },
        casting: {
          title: game.legend.castingTitle,
          items: game.castingTypes.map((t) => ({ label: t.label, body: parseRichText(t.description) })),
        },
        choice: { title: game.legend.choiceTitle, body: parseParagraphs(game.legend.choice) },
        credits: o.attribution
          ? {
              title: game.legend.creditsTitle,
              items: game.credits
                .filter(
                  (cr) =>
                    cr.when === 'always' ||
                    (cr.when === 'paizo-art' && usedPaizoArt) ||
                    (cr.when === 'generic-art' && o.art === 'generic'),
                )
                .map((cr) => ({ role: cr.role, names: cr.names.join(', ') })),
            }
          : null,
      }
    : null;

  if (legend && bundle.ratingSet) {
    legend.howToUse.body.push(
      ...parseParagraphs(`Rating set: **${bundle.ratingSet.name}**. ${bundle.ratingSet.description}`),
    );
  }

  // The Community Use notice is included whenever attribution is on: the game names themselves are Paizo
  // trademarks, whether or not official art is shown.
  const notices: Span[][] = o.attribution
    ? [game.notices.design, game.notices.cup, game.notices.license].map(parseRichText)
    : [];

  if (o.attribution && usedPaizoArt) {
    const artists = game.credits.filter((cr) => cr.when === 'paizo-art').flatMap((cr) => cr.names);
    notices.push(
      parseRichText(`Artwork © Paizo Inc.${artists.length ? ` Illustration: ${artists.join(', ')}.` : ''}`),
    );
  }

  const model: DocModel = {
    meta: {
      title: o.title ?? game.title,
      asOf: o.asOf ?? game.asOf,
      game: game.id,
      system: game.system,
    },
    options: {
      layout: o.layout,
      theme: o.theme,
      art: o.art,
      legend: o.legend,
      stats: o.stats,
      attribution: o.attribution,
      pageNumbers: o.pageNumbers,
      repeatSectionTitles: o.repeatSectionTitles,
      fontScale: o.fontScale,
    },
    fonts: { heading: theme.fonts.heading.family, body: theme.fonts.body.family },
    colors: { ...palette, transparent: !o.background },
    sections,
    legend,
    notices,
    layout: null,
  };
  return { model, files, warnings };
}
