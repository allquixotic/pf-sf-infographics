import type { ArtLibrary } from '../art/library';
import type { ContentBundle } from '../content/load';
import { computeLayout } from '../layout';
import { buildModel, type DocModel, type VirtualFile } from '../model/build';
import {
  MAX_RASTER_PIXELS,
  MIME_TYPES,
  type OutputFormat,
  type RenderOptionsInput,
  type ResolvedOptions,
  resolveOptions,
} from '../options/schema';
import infographicTypst from '../typst/infographic.typ' with { type: 'text' };
import { encodeJpg, encodeWebpImage, rasterize, WEBP_MAX_DIMENSION } from './raster';
import type { EngineRuntime } from './runtime';
import { splitSvgPages } from './svg';
import { TypstSession } from './typst';

export interface RenderedFile {
  name: string;
  mime: string;
  data: Uint8Array;
  /** 1-based page number for multi-page raster/SVG output. */
  page?: number;
  width?: number;
  height?: number;
}

export interface RenderResult {
  files: RenderedFile[];
  warnings: string[];
  options: ResolvedOptions;
}

export interface PreparedDocument {
  options: ResolvedOptions;
  model: DocModel;
  main: string;
  files: VirtualFile[];
  fonts: Uint8Array[];
  warnings: string[];
}

export interface RenderRequest {
  content: ContentBundle;
  options?: RenderOptionsInput;
  art?: ArtLibrary;
  /** Base file name without extension; defaults to "<game>-<layout>". */
  baseName?: string;
  /** Called with progress messages for long renders. */
  onProgress?: (message: string) => void;
}

const enc = new TextEncoder();

/** Builds the Typst inputs without compiling anything. Useful for debugging templates (`--emit-typst`). */
export function prepareDocument(req: Omit<RenderRequest, 'baseName' | 'onProgress'>): PreparedDocument {
  const options = resolveOptions(req.options);
  const bundle = req.content.games.get(options.game);
  if (!bundle) {
    throw new Error(`Unknown game "${options.game}". Available: ${[...req.content.games.keys()].join(', ')}`);
  }
  if (options.layout === 'booklet' && options.fit) {
    // A booklet needs real pages; fall back to Letter.
    Object.assign(options, {
      fit: false,
      pageWidth: 612,
      pageHeight: 792,
      sizeLabel: 'US Letter (8.5 × 11 in)',
    });
  }
  const { model, files, warnings } = buildModel(bundle, options, req.art);
  model.layout = computeLayout(model, options);
  const data: VirtualFile = { path: '/data.json', bytes: enc.encode(JSON.stringify(model)) };
  return {
    options,
    model,
    main: infographicTypst,
    files: [...files, data],
    fonts: bundle.fonts,
    warnings,
  };
}

export class Engine {
  private session?: TypstSession;

  constructor(private readonly runtime: EngineRuntime) {}

  private async sessionFor(fonts: Uint8Array[]): Promise<TypstSession> {
    const key = fonts.map((f) => `${f.byteLength}:${f[100] ?? 0}:${f[f.byteLength >> 1] ?? 0}`).join('|');
    if (!this.session || this.session.fontKey !== key) {
      this.session = await TypstSession.create(this.runtime, fonts, key);
    }
    return this.session;
  }

  async render(req: RenderRequest): Promise<RenderResult> {
    const progress = req.onProgress ?? (() => {});
    const doc = prepareDocument(req);
    const o = doc.options;
    const warnings = [...doc.warnings];
    const base = req.baseName ?? `${o.game}-${o.layout}`;
    progress('Starting Typst');
    const session = await this.sessionFor(doc.fonts);

    if (o.format === 'pdf') {
      progress('Laying out PDF');
      const pdf = await session.pdf(doc.main, doc.files);
      return { files: [{ name: `${base}.pdf`, mime: MIME_TYPES.pdf, data: pdf }], warnings, options: o };
    }

    progress('Laying out pages');
    const pages = splitSvgPages(await session.svg(doc.main, doc.files));
    const multi = pages.length > 1;
    const nameFor = (i: number, ext: OutputFormat) =>
      multi ? `${base}-p${String(i + 1).padStart(2, '0')}.${ext}` : `${base}.${ext}`;

    if (o.format === 'svg') {
      return {
        files: pages.map((p, i) => ({
          name: nameFor(i, 'svg'),
          mime: MIME_TYPES.svg,
          data: enc.encode(p.svg),
          page: i + 1,
          width: p.width,
          height: p.height,
        })),
        warnings,
        options: o,
      };
    }

    const files: RenderedFile[] = [];
    for (const [i, p] of pages.entries()) {
      progress(`Rendering page ${i + 1} of ${pages.length}`);
      let widthPx = p.width * o.pixelsPerPt;
      let heightPx = p.height * o.pixelsPerPt;
      let limit = Math.min(1, Math.sqrt(MAX_RASTER_PIXELS / (widthPx * heightPx)));
      if (o.format === 'webp') limit = Math.min(limit, WEBP_MAX_DIMENSION / Math.max(widthPx, heightPx));
      if (limit < 1) {
        widthPx *= limit;
        heightPx *= limit;
        warnings.push(
          `Page ${i + 1} was reduced to ${Math.round(widthPx)} × ${Math.round(heightPx)} px to stay within raster limits; use PDF or SVG for full resolution.`,
        );
      }
      const raster = await rasterize(this.runtime, p.svg, widthPx);
      let data: Uint8Array;
      if (o.format === 'png') data = raster.png;
      else if (o.format === 'jpg') {
        const bg = doc.model.colors.transparent ? '#ffffff' : doc.model.colors.background;
        data = await encodeJpg(this.runtime, raster, bg, o.quality);
      } else data = await encodeWebpImage(this.runtime, raster, o.quality);
      files.push({
        name: nameFor(i, o.format),
        mime: MIME_TYPES[o.format],
        data,
        page: i + 1,
        width: raster.width,
        height: raster.height,
      });
    }
    return { files, warnings, options: o };
  }
}
