import type { EngineRuntime } from '@pfsf/engine';

async function wasmBytes(specifier: string): Promise<Uint8Array> {
  const url = import.meta.resolve(specifier);
  return Bun.file(new URL(url)).bytes();
}

/** Bun runtime: WebAssembly binaries are read from node_modules. */
export const bunRuntime: EngineRuntime = {
  typstCompilerWasm: () => wasmBytes('@myriaddreamin/typst-ts-web-compiler/wasm'),
  typstRendererWasm: () => wasmBytes('@myriaddreamin/typst-ts-renderer/wasm'),
  resvgWasm: () => wasmBytes('@resvg/resvg-wasm/index_bg.wasm'),
  jpegEncoderModule: async () =>
    WebAssembly.compile(await wasmBytes('@jsquash/jpeg/codec/enc/mozjpeg_enc.wasm')),
  webpEncoderModule: async () =>
    WebAssembly.compile(await wasmBytes('@jsquash/webp/codec/enc/webp_enc.wasm')),
};
