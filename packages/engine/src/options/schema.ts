import { z } from 'zod';
import { defaultSizeFor, findPreset, PT_PER, SIZE_PRESETS } from './presets';

export const OUTPUT_FORMATS = ['svg', 'png', 'jpg', 'webp', 'pdf'] as const;
export type OutputFormat = (typeof OUTPUT_FORMATS)[number];

export const MIME_TYPES: Record<OutputFormat, string> = {
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
  pdf: 'application/pdf',
};

const customSize = z.object({
  width: z.number().positive(),
  height: z.number().positive(),
  unit: z.enum(['pt', 'in', 'mm', 'px']),
});

/**
 * Everything a caller can choose. All fields are optional on input; `resolveOptions` fills defaults.
 * Keep this list in sync with the CLI flags (packages/cli) and the web UI (packages/web).
 */
export const renderOptionsSchema = z.object({
  game: z.string().default('pf2e').describe('Game id from the content manifest (pf2e, sf2e, …).'),
  layout: z.enum(['poster', 'booklet']).default('poster'),
  format: z.enum(OUTPUT_FORMATS).default('pdf'),
  intent: z
    .enum(['print', 'screen'])
    .default('print')
    .describe('print: physical page sizes, margins and high DPI; screen: pixel sizes.'),
  size: z
    .union([z.string(), customSize])
    .optional()
    .describe(`Preset id (${SIZE_PRESETS.map((p) => p.id).join(', ')}), "fit", or a custom size.`),
  orientation: z.enum(['auto', 'portrait', 'landscape']).default('auto'),
  theme: z.enum(['light', 'dark']).default('light'),
  background: z.boolean().default(true).describe('false renders a transparent background.'),
  art: z
    .enum(['paizo', 'generic', 'none'])
    .default('generic')
    .describe(
      'paizo: official iconic art where available (needs the Community Use Package); generic: our SVG emblems.',
    ),
  attribution: z.boolean().default(true).describe('Include credits, license and Community Use notices.'),
  includePlaytest: z.boolean().default(false),
  includeLegacy: z.boolean().default(false),
  only: z.array(z.string()).optional().describe('Class ids to include (everything else is dropped).'),
  exclude: z.array(z.string()).default([]).describe('Class ids to leave out.'),
  grouping: z.enum(['groups', 'alphabetical']).default('groups'),
  palette: z.enum(['classic', 'colorblind', 'grayscale']).default('classic'),
  legend: z.boolean().default(true).describe('Include the how-to-use and key boxes.'),
  stats: z.boolean().default(true).describe('Show hit points per level on each card.'),
  title: z.string().optional(),
  asOf: z.string().optional().describe('Override the "accurate as of" text.'),
  fontScale: z.number().min(0.7).max(1.5).default(1),
  dpi: z
    .number()
    .int()
    .min(36)
    .max(1200)
    .optional()
    .describe('Raster resolution for print intent (default 200).'),
  scale: z.number().min(0.25).max(8).default(1).describe('Raster multiplier for screen intent.'),
  quality: z.number().int().min(1).max(100).default(90).describe('JPG / WebP quality.'),
  margin: z
    .number()
    .min(0)
    .max(72)
    .optional()
    .describe('Page margin in points (default 0.4 in print, 24 px screen).'),
  bleed: z.number().min(0).max(18).default(0).describe('Print bleed in millimetres added around each page.'),
  cropMarks: z.boolean().default(false),
  pageNumbers: z.boolean().default(true).describe('Booklet page numbers.'),
  imposition: z
    .enum(['none', 'saddle-stitch'])
    .default('none')
    .describe('Booklet PDF only: reorder pages two-up for folding into a saddle-stitched booklet.'),
});

export type RenderOptionsInput = z.input<typeof renderOptionsSchema>;
export type RenderOptionsParsed = z.output<typeof renderOptionsSchema>;

export interface ResolvedOptions extends RenderOptionsParsed {
  /** Final trimmed page size in points (before bleed). `fit` sizes are 0 and resolved from content. */
  pageWidth: number;
  pageHeight: number;
  fit: boolean;
  sizeLabel: string;
  margin: number;
  /** Pixels per point for raster output. */
  pixelsPerPt: number;
}

export class OptionsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OptionsError';
  }
}

/** Largest raster we attempt; bigger requests are scaled down with a warning. */
export const MAX_RASTER_PIXELS = 100_000_000;

export function resolveOptions(input: RenderOptionsInput = {}): ResolvedOptions {
  const parsed = renderOptionsSchema.safeParse(input);
  if (!parsed.success) {
    throw new OptionsError(
      parsed.error.issues.map((i) => `${i.path.join('.') || 'options'}: ${i.message}`).join('; '),
    );
  }
  const o = parsed.data;
  const sizeInput = o.size ?? defaultSizeFor(o.layout, o.intent);

  let w = 0;
  let h = 0;
  let fit = false;
  let sizeLabel: string;
  if (typeof sizeInput === 'string') {
    if (sizeInput === 'fit') {
      fit = true;
      sizeLabel = 'fit to content';
    } else {
      const preset = findPreset(sizeInput);
      if (!preset) throw new OptionsError(`Unknown size preset "${sizeInput}"`);
      w = preset.width * PT_PER[preset.unit];
      h = preset.height * PT_PER[preset.unit];
      sizeLabel = preset.label;
    }
  } else {
    w = sizeInput.width * PT_PER[sizeInput.unit];
    h = sizeInput.height * PT_PER[sizeInput.unit];
    sizeLabel = `${sizeInput.width} × ${sizeInput.height} ${sizeInput.unit}`;
  }

  // Presets are stored portrait. With orientation "auto", posters turn landscape and booklets stay portrait;
  // custom sizes are kept exactly as given unless an orientation is requested.
  if (!fit) {
    let want: 'portrait' | 'landscape' | undefined;
    if (o.orientation !== 'auto') want = o.orientation;
    else if (typeof sizeInput === 'string') want = o.layout === 'poster' ? 'landscape' : 'portrait';
    if (want && (want === 'landscape') !== w > h) [w, h] = [h, w];
  }

  const margin = o.margin ?? (o.intent === 'print' ? 0.4 * 72 : 24 * PT_PER.px);
  const pixelsPerPt = o.intent === 'print' ? (o.dpi ?? 200) / 72 : o.scale / PT_PER.px;

  return { ...o, size: sizeInput, pageWidth: w, pageHeight: h, fit, sizeLabel, margin, pixelsPerPt };
}
