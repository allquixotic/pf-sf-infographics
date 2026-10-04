import {
  createTypstCompiler,
  createTypstRenderer,
  loadFonts,
  type TypstCompiler,
  type TypstRenderer,
} from '@myriaddreamin/typst.ts';
import type { EngineRuntime } from './runtime';

export interface TypstFile {
  path: string;
  bytes: Uint8Array;
}

export class TypstError extends Error {
  constructor(readonly diagnostics: unknown[]) {
    super(
      `Typst compilation failed:\n${diagnostics
        .map((d) => {
          const x = d as { path?: string; range?: string; message?: string; severity?: string };
          return `  ${x.severity ?? 'error'} ${x.path ?? ''}${x.range ? `:${x.range}` : ''} ${x.message ?? JSON.stringify(d)}`;
        })
        .join('\n')}`,
    );
    this.name = 'TypstError';
  }
}

// typst.ts enum values; importing the enum itself pulls in browser-only code paths in some bundlers.
const FORMAT_VECTOR = 0;
const FORMAT_PDF = 1;

/**
 * Owns one Typst compiler and renderer. Fonts are fixed at creation, so a new session is created when the theme's
 * fonts change (see Engine).
 */
export class TypstSession {
  private constructor(
    private readonly compiler: TypstCompiler,
    private readonly runtime: EngineRuntime,
    readonly fontKey: string,
  ) {}

  private renderer?: TypstRenderer;

  static async create(runtime: EngineRuntime, fonts: Uint8Array[], fontKey: string): Promise<TypstSession> {
    const compiler = createTypstCompiler();
    await compiler.init({
      getModule: () => runtime.typstCompilerWasm(),
      beforeBuild: [loadFonts(fonts, { assets: false })],
    });
    return new TypstSession(compiler, runtime, fontKey);
  }

  private load(main: string, files: TypstFile[]): void {
    this.compiler.resetShadow();
    for (const f of files) this.compiler.mapShadow(f.path, f.bytes);
    this.compiler.addSource('/main.typ', main);
  }

  private async compile(format: number): Promise<Uint8Array> {
    const res = await this.compiler.compile({
      mainFilePath: '/main.typ',
      format: format as never,
      diagnostics: 'full',
    });
    const errors = (res.diagnostics ?? []).filter((d) => (d as { severity?: string }).severity !== 'warning');
    if (!res.result || errors.length) throw new TypstError(errors.length ? errors : (res.diagnostics ?? []));
    return res.result;
  }

  async pdf(main: string, files: TypstFile[]): Promise<Uint8Array> {
    this.load(main, files);
    return this.compile(FORMAT_PDF);
  }

  /** Raw multi-page SVG from the typst.ts renderer (see svg.ts for cleanup). */
  async svg(main: string, files: TypstFile[]): Promise<string> {
    this.load(main, files);
    const vector = await this.compile(FORMAT_VECTOR);
    if (!this.renderer) {
      const renderer = createTypstRenderer();
      await renderer.init({ getModule: () => this.runtime.typstRendererWasm() });
      this.renderer = renderer;
    }
    return this.renderer.renderSvg({
      format: 'vector',
      artifactContent: vector,
      data_selection: { body: true, defs: true, css: false, js: false },
    } as never);
  }
}
