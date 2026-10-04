import type { OutputFormat, RenderOptionsInput } from '@pfsf/engine';
import { defaultSizeFor } from '@pfsf/engine/presets';

/** Flat, JSON-friendly settings; only class selections and custom headings are game-specific. */
export interface UiOptions {
  layout: 'poster' | 'booklet';
  intent: 'print' | 'screen';
  size: string;
  customW: number;
  customH: number;
  customUnit: 'in' | 'mm' | 'px';
  orientation: 'auto' | 'portrait' | 'landscape';
  theme: 'light' | 'dark';
  background: boolean;
  backgroundColor: string;
  fontColor: string;
  repeatSectionTitles: boolean;
  art: 'paizo' | 'generic' | 'none';
  attribution: boolean;
  includePlaytest: boolean;
  includeLegacy: boolean;
  exclude: string[];
  grouping: 'groups' | 'alphabetical';
  palette: 'classic' | 'colorblind' | 'grayscale';
  legend: boolean;
  stats: boolean;
  title: string;
  asOf: string;
  fontScale: number;
  format: OutputFormat;
  dpi: number;
  scale: number;
  quality: number;
  bleed: number;
  pageNumbers: boolean;
}

export function defaultUiOptions(): UiOptions {
  return {
    layout: 'poster',
    intent: 'print',
    size: defaultSizeFor('poster', 'print'),
    customW: 24,
    customH: 36,
    customUnit: 'in',
    orientation: 'auto',
    theme: 'light',
    background: true,
    backgroundColor: '',
    fontColor: '',
    repeatSectionTitles: true,
    art: 'generic',
    attribution: true,
    includePlaytest: false,
    includeLegacy: false,
    exclude: [],
    grouping: 'groups',
    palette: 'classic',
    legend: true,
    stats: true,
    title: '',
    asOf: '',
    fontScale: 1,
    format: 'pdf',
    dpi: 200,
    scale: 1,
    quality: 90,
    bleed: 0,
    pageNumbers: true,
  };
}

export function toRenderOptions(game: string, ui: UiOptions, format: OutputFormat): RenderOptionsInput {
  return {
    game,
    layout: ui.layout,
    format,
    intent: ui.intent,
    size: ui.size === 'custom' ? { width: ui.customW, height: ui.customH, unit: ui.customUnit } : ui.size,
    orientation: ui.orientation,
    theme: ui.theme,
    background: ui.background,
    backgroundColor: ui.backgroundColor || undefined,
    fontColor: ui.fontColor || undefined,
    repeatSectionTitles: ui.repeatSectionTitles,
    art: ui.art,
    attribution: ui.attribution,
    includePlaytest: ui.includePlaytest,
    includeLegacy: ui.includeLegacy,
    exclude: ui.exclude,
    grouping: ui.grouping,
    palette: ui.palette,
    legend: ui.legend,
    stats: ui.stats,
    title: ui.title.trim() || undefined,
    asOf: ui.asOf.trim() || undefined,
    fontScale: ui.fontScale,
    dpi: ui.dpi,
    scale: ui.scale,
    quality: ui.quality,
    bleed: ui.bleed,
    pageNumbers: ui.pageNumbers,
  };
}

export type GameOptions = Pick<UiOptions, 'exclude' | 'title' | 'asOf'>;
export type SharedOptions = Omit<UiOptions, keyof GameOptions>;

export function splitOptions({ exclude, title, asOf, ...shared }: UiOptions): {
  shared: SharedOptions;
  game: GameOptions;
} {
  return { shared, game: { exclude: [...exclude], title, asOf } };
}

/** Migrate old per-game preferences using the currently selected game's common settings. */
export function restoreOptions(
  activeGame: string,
  legacy: Record<string, Partial<UiOptions>>,
  shared: Partial<SharedOptions>,
  games: Record<string, GameOptions>,
): { ui: UiOptions; games: Record<string, GameOptions> } {
  const migrated = Object.fromEntries(
    Object.entries(legacy).map(([id, saved]) => [id, splitOptions({ ...defaultUiOptions(), ...saved }).game]),
  );
  const perGame = { ...migrated, ...games };
  return {
    ui: {
      ...defaultUiOptions(),
      ...splitOptions({ ...defaultUiOptions(), ...legacy[activeGame] }).shared,
      ...shared,
      ...(perGame[activeGame] ?? splitOptions(defaultUiOptions()).game),
    },
    games: perGame,
  };
}
