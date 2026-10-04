import encodeJpeg, { init as initJpeg } from '@jsquash/jpeg/encode';
import encodeWebp, { init as initWebp } from '@jsquash/webp/encode';
import { initWasm, Resvg } from '@resvg/resvg-wasm';
import type { EngineRuntime } from './runtime';

let resvgReady: Promise<void> | undefined;
let jpegReady: Promise<void> | undefined;
let webpReady: Promise<unknown> | undefined;

export interface RasterResult {
  width: number;
  height: number;
  /** RGBA pixels, not premultiplied. */
  pixels: Uint8Array;
  png: Uint8Array;
}

async function ensureResvg(runtime: EngineRuntime): Promise<void> {
  resvgReady ??= Promise.resolve(runtime.resvgWasm()).then((w) => initWasm(w));
  return resvgReady;
}

/** Renders one SVG page at the requested width in pixels. */
export async function rasterize(runtime: EngineRuntime, svg: string, widthPx: number): Promise<RasterResult> {
  await ensureResvg(runtime);
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: Math.max(1, Math.round(widthPx)) },
    font: { loadSystemFonts: false },
    imageRendering: 0,
    shapeRendering: 2,
    textRendering: 1,
  });
  const img = resvg.render();
  const out = { width: img.width, height: img.height, pixels: img.pixels, png: img.asPng() };
  img.free();
  resvg.free();
  return out;
}

/** Flattens transparent pixels onto a solid color (JPEG has no alpha channel). */
export function flatten(pixels: Uint8Array, hex: string): Uint8ClampedArray {
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  const out = new Uint8ClampedArray(pixels.length);
  for (let i = 0; i < pixels.length; i += 4) {
    const a = pixels[i + 3]! / 255;
    out[i] = pixels[i]! * a + r * (1 - a);
    out[i + 1] = pixels[i + 1]! * a + g * (1 - a);
    out[i + 2] = pixels[i + 2]! * a + b * (1 - a);
    out[i + 3] = 255;
  }
  return out;
}

function imageData(data: Uint8ClampedArray, width: number, height: number): ImageData {
  return { data, width, height, colorSpace: 'srgb' } as ImageData;
}

export async function encodeJpg(
  runtime: EngineRuntime,
  r: RasterResult,
  background: string,
  quality: number,
): Promise<Uint8Array> {
  jpegReady ??= (async () => {
    const mod = await runtime.jpegEncoderModule?.();
    await (mod ? initJpeg(mod as never) : initJpeg());
  })();
  await jpegReady;
  const buf = await encodeJpeg(imageData(flatten(r.pixels, background), r.width, r.height), { quality });
  return new Uint8Array(buf);
}

export const WEBP_MAX_DIMENSION = 16383;

export async function encodeWebpImage(
  runtime: EngineRuntime,
  r: RasterResult,
  quality: number,
): Promise<Uint8Array> {
  webpReady ??= (async () => {
    const mod = await runtime.webpEncoderModule?.();
    return mod ? initWebp(mod as never) : initWebp();
  })();
  await webpReady;
  const data = new Uint8ClampedArray(r.pixels.buffer, r.pixels.byteOffset, r.pixels.byteLength);
  const buf = await encodeWebp(imageData(data, r.width, r.height), { quality });
  return new Uint8Array(buf);
}
