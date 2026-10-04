/**
 * Platform hooks. The engine is shared by the browser app and the Bun CLI; each supplies its WebAssembly binaries
 * here (URLs in the browser, file bytes under Bun).
 */
export type WasmSource = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface EngineRuntime {
  typstCompilerWasm(): WasmSource | Promise<WasmSource>;
  typstRendererWasm(): WasmSource | Promise<WasmSource>;
  resvgWasm(): WasmSource | Promise<WasmSource>;
  /**
   * Compiled encoder modules. When omitted, the encoders fetch their own .wasm next to their JavaScript, which is
   * what bundlers such as Vite expect.
   */
  jpegEncoderModule?(): Promise<WebAssembly.Module>;
  webpEncoderModule?(): Promise<WebAssembly.Module>;
}
