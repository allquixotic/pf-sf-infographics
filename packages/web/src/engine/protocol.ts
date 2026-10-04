import type { RenderOptionsInput } from '@pfsf/engine';

export type SourceSpec =
  | { kind: 'bundled' }
  | { kind: 'url'; url: string }
  | { kind: 'github'; spec: string };

export interface ClassSummary {
  id: string;
  name: string;
  status: string;
  group: string;
  iconic: string | null;
  source: string;
  /** Whether official or locally supplied art is currently available for this class. */
  hasArt: boolean;
}

export interface GameSummary {
  id: string;
  title: string;
  shortName: string;
  system: string;
  asOf: string;
  groups: { id: string; label: string }[];
  classes: ClassSummary[];
  artPacks: { id: string; label: string; url?: string; fileName?: string; loaded: boolean }[];
}

export interface ContentSummary {
  sourceLabel: string;
  name: string;
  games: GameSummary[];
  warnings: string[];
}

export interface OutFile {
  name: string;
  mime: string;
  data: ArrayBuffer;
  page?: number;
  width?: number;
  height?: number;
}

export type Request =
  | { type: 'load'; source: SourceSpec }
  | { type: 'addZip'; name: string; bytes: ArrayBuffer }
  | { type: 'addImage'; game: string; name: string; bytes: ArrayBuffer }
  | { type: 'clearArt' }
  | { type: 'summary' }
  | { type: 'render'; options: RenderOptionsInput; baseName?: string };

export interface Responses {
  load: ContentSummary;
  addZip: { packs: string[] };
  addImage: { ok: true };
  clearArt: { ok: true };
  summary: ContentSummary;
  render: { files: OutFile[]; warnings: string[] };
}

export type WorkerMessage =
  | { id: number; ok: true; result: unknown }
  | { id: number; ok: false; error: string }
  | { id: number; progress: string };
