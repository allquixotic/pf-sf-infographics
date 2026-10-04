/**
 * @pfsf/engine — everything needed to turn a content repository into an infographic, with no UI and no direct
 * file-system or network access. The browser app and the CLI are thin shells around this package.
 */
export { type ArtImage, ArtLibrary, ArtPack, type ArtRequest } from './art/library';
export {
  type ContentBundle,
  ContentValidationError,
  type GameBundle,
  type LoadedClass,
  loadContent,
} from './content/load';
export * from './content/schema';
export {
  ContentFetchError,
  type ContentSource,
  type FetchLike,
  GitHubContentSource,
  type GitHubLocation,
  githubRawBaseUrl,
  HttpContentSource,
  MemoryContentSource,
  parseGitHubLocation,
  resolvePath,
} from './content/source';
export { computeLayout, type Layout } from './layout';
export { arrangePoster } from './layout/poster';
export { buildModel, type CardModel, type DocModel, selectClasses } from './model/build';
export { parseRichText, type Span } from './model/rich-text';
export { defaultSizeFor, findPreset, PT_PER, SIZE_PRESETS, type SizePreset } from './options/presets';
export {
  MIME_TYPES,
  OptionsError,
  OUTPUT_FORMATS,
  type OutputFormat,
  type RenderOptionsInput,
  type ResolvedOptions,
  renderOptionsSchema,
  resolveOptions,
} from './options/schema';
export {
  Engine,
  type PreparedDocument,
  prepareDocument,
  type RenderedFile,
  type RenderRequest,
  type RenderResult,
} from './render';
export type { EngineRuntime, WasmSource } from './render/runtime';
export { splitSvgPages } from './render/svg';
export { TypstError } from './render/typst';
