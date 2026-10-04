/// <reference lib="webworker" />
/**
 * Runs the engine off the main thread: Typst, resvg and the image encoders are WebAssembly and can take a moment
 * on large posters.
 */
import jpegWasm from '@jsquash/jpeg/codec/enc/mozjpeg_enc.wasm?url';
import webpWasm from '@jsquash/webp/codec/enc/webp_enc.wasm?url';
import rendererWasm from '@myriaddreamin/typst-ts-renderer/wasm?url';
import compilerWasm from '@myriaddreamin/typst-ts-web-compiler/wasm?url';
import {
  ArtLibrary,
  ArtPack,
  type ContentBundle,
  type ContentSource,
  Engine,
  type EngineRuntime,
  GitHubContentSource,
  HttpContentSource,
  loadContent,
  parseGitHubLocation,
} from '@pfsf/engine';
import resvgWasm from '@resvg/resvg-wasm/index_bg.wasm?url';
import type { ContentSummary, OutFile, Request, SourceSpec, WorkerMessage } from './protocol';

declare const self: DedicatedWorkerGlobalScope;

const runtime: EngineRuntime = {
  typstCompilerWasm: () => fetch(compilerWasm),
  typstRendererWasm: () => fetch(rendererWasm),
  resvgWasm: () => fetch(resvgWasm),
  jpegEncoderModule: () => WebAssembly.compileStreaming(fetch(jpegWasm)),
  webpEncoderModule: () => WebAssembly.compileStreaming(fetch(webpWasm)),
};

const engine = new Engine(runtime);
let content: ContentBundle | undefined;
let art = new ArtLibrary();
/** Zips and images kept so they can be re-applied when content is reloaded. */
const zips = new Map<string, { name: string; game: string; paizoCredit?: boolean; bytes: Uint8Array }>();
const images: { game: string; name: string; paizoCredit?: boolean; bytes: Uint8Array }[] = [];

function sourceFor(spec: SourceSpec): ContentSource {
  switch (spec.kind) {
    case 'bundled':
      return new HttpContentSource(
        new URL(`${import.meta.env.BASE_URL}content/`, self.location.origin).toString(),
        fetch,
        {
          cache: 'no-cache',
        },
      );
    case 'url':
      return new HttpContentSource(spec.url, fetch, { cache: 'no-cache' });
    case 'github':
      return new GitHubContentSource(parseGitHubLocation(spec.spec));
  }
}

/** Works out which art pack a zip is, by its file name or by how many referenced files it contains. */
function registerZip(
  name: string,
  bytes: Uint8Array,
  game = 'pf2e',
  paizoCredit = false,
): { packs: string[]; matched: number } {
  if (!content) return { packs: [], matched: 0 };
  const found: string[] = [];
  let officialName = false;
  for (const bundle of content.games.values()) {
    for (const packDef of bundle.game.artPacks) {
      const pack = ArtPack.fromZip(packDef.id, packDef.label, bytes);
      const byName = packDef.fileName && name.toLowerCase() === packDef.fileName.toLowerCase();
      if (byName) officialName = true;
      const hits = bundle.classes.filter(
        (c) => c.art.paizo?.pack === packDef.id && pack.find(c.art.paizo.file),
      ).length;
      if (byName || hits > 0) {
        art.addPack(pack);
        found.push(packDef.id);
      }
    }
  }
  const custom = ArtPack.fromZip(`custom:${name}`, name, bytes);
  const matched =
    content.games
      .get(game)
      ?.classes.filter((c) => custom.findByClassName(c.id) || custom.findByClassName(c.name)).length ?? 0;
  // A custom archive can contain both official filenames and additional class images.
  if (!officialName && matched) art.addCustomPack(game, custom, paizoCredit);
  return { packs: found, matched };
}

function rebuildArt(): void {
  art = new ArtLibrary();
  for (const zip of zips.values()) registerZip(zip.name, zip.bytes, zip.game, zip.paizoCredit);
  for (const img of images) art.addLocal(img.game, img.name, img.bytes, img.name, img.paizoCredit);
}

function summary(): ContentSummary {
  if (!content) throw new Error('No content loaded');
  return {
    sourceLabel: content.sourceLabel,
    name: content.manifest.name,
    warnings: content.warnings,
    games: [...content.games.values()].map((b) => ({
      id: b.game.id,
      title: b.game.title,
      shortName: b.game.shortName,
      system: b.game.system,
      asOf: b.game.asOf,
      groups: b.game.groups.map((g) => ({ id: g.id, label: g.label })),
      artPacks: b.game.artPacks.map((p) => ({
        id: p.id,
        label: p.label,
        url: p.url,
        fileName: p.fileName,
        loaded: art.hasPack(p.id),
      })),
      classes: b.classes.map((c) => ({
        id: c.id,
        name: c.name,
        status: c.status,
        group: c.group,
        iconic: c.iconic?.name ?? null,
        source: c.source.title,
        hasArt: !!art.resolve({
          game: b.game.id,
          classId: c.id,
          className: c.name,
          paizo: c.art.paizo,
          local: c.art.local,
        }),
      })),
    })),
  };
}

async function handle(id: number, req: Request): Promise<unknown> {
  switch (req.type) {
    case 'load':
      content = await loadContent(sourceFor(req.source));
      rebuildArt();
      return summary();
    case 'summary':
      return summary();
    case 'addZip': {
      const bytes = new Uint8Array(req.bytes);
      const game = req.game ?? 'pf2e';
      const result = registerZip(req.name, bytes, game, req.paizoCredit);
      if (result.packs.length || result.matched)
        zips.set(`${game}/${req.name}`, { name: req.name, game, bytes, paizoCredit: req.paizoCredit });
      return result;
    }
    case 'addImage':
      images.push({
        game: req.game,
        name: req.name,
        bytes: new Uint8Array(req.bytes),
        paizoCredit: req.paizoCredit,
      });
      art.addLocal(req.game, req.name, new Uint8Array(req.bytes), req.name, req.paizoCredit);
      return { ok: true };
    case 'clearArt':
      zips.clear();
      images.length = 0;
      art = new ArtLibrary();
      return { ok: true };
    case 'autoSize':
      if (!content) throw new Error('No content loaded');
      return engine.autoSize({
        content,
        art,
        options: req.options,
        onProgress: (m) => self.postMessage({ id, progress: m } satisfies WorkerMessage),
      });
    case 'render': {
      if (!content) throw new Error('No content loaded');
      const result = await engine.render({
        content,
        options: req.options,
        art,
        baseName: req.baseName,
        onProgress: (m) => self.postMessage({ id, progress: m } satisfies WorkerMessage),
      });
      const files: OutFile[] = result.files.map((f) => ({
        name: f.name,
        mime: f.mime,
        data: f.data.buffer.slice(f.data.byteOffset, f.data.byteOffset + f.data.byteLength) as ArrayBuffer,
        page: f.page,
        width: f.width,
        height: f.height,
      }));
      return { files, warnings: result.warnings };
    }
  }
}

async function processRequest(ev: MessageEvent<{ id: number; req: Request }>): Promise<void> {
  const { id, req } = ev.data;
  try {
    const result = await handle(id, req);
    const transfer =
      req.type === 'render'
        ? (result as { files: OutFile[] }).files.map((f) => f.data)
        : ([] as ArrayBuffer[]);
    self.postMessage({ id, ok: true, result } satisfies WorkerMessage, transfer);
  } catch (err) {
    self.postMessage({
      id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    } satisfies WorkerMessage);
  }
}

// Typst owns mutable compiler state: finish each request before starting the next.
let pending = Promise.resolve();
self.onmessage = (ev: MessageEvent<{ id: number; req: Request }>) => {
  pending = pending.then(() => processRequest(ev));
};
