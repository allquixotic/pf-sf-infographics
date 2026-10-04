/**
 * Official art is never bundled with this project. Users supply it at runtime: the Paizo Community Use Package
 * zips (dropped into the web UI or downloaded by `bun run paizo:fetch` into local-assets/) and optional loose image
 * files for classes the package does not cover. ArtLibrary indexes whatever was supplied.
 */
import { unzipSync } from 'fflate';
import { stripPngMetadata } from './png';

export type ImageExt = 'png' | 'jpg' | 'svg';

export interface ArtImage {
  bytes: Uint8Array;
  ext: ImageExt;
  /** Where the image came from, for messages. */
  origin: string;
}

export interface ArtRequest {
  game: string;
  classId: string;
  className: string;
  paizo?: { pack: string; file: string } | undefined;
  local?: string | undefined;
}

const EXT_RE = /\.(png|jpe?g|svg)$/i;

function extOf(name: string): ImageExt | undefined {
  const m = EXT_RE.exec(name);
  if (!m) return undefined;
  const e = m[1]!.toLowerCase();
  return e === 'jpeg' ? 'jpg' : (e as ImageExt);
}

const norm = (s: string) => s.toLowerCase().replace(/\\/g, '/');
const basename = (s: string) => s.slice(s.lastIndexOf('/') + 1);
const stem = (s: string) => basename(s).replace(/\.[^.]+$/, '');

/** A set of images addressed by their path inside a zip or folder. Decompression is lazy. */
export class ArtPack {
  private readonly names: string[];
  private readonly cache = new Map<string, Uint8Array>();

  private constructor(
    readonly id: string,
    readonly label: string,
    private readonly read: (name: string) => Uint8Array | undefined,
    names: string[],
  ) {
    this.names = names.filter((n) => extOf(n) && !n.startsWith('__MACOSX/'));
  }

  static fromZip(id: string, label: string, zip: Uint8Array): ArtPack {
    const names: string[] = [];
    unzipSync(zip, {
      filter: (f) => {
        names.push(f.name);
        return false;
      },
    });
    const read = (name: string) => unzipSync(zip, { filter: (f) => f.name === name })[name];
    return new ArtPack(id, label, read, names);
  }

  static fromFiles(id: string, label: string, files: Map<string, Uint8Array>): ArtPack {
    return new ArtPack(id, label, (n) => files.get(n), [...files.keys()]);
  }

  get fileNames(): readonly string[] {
    return this.names;
  }

  /** Exact path, then case-insensitive path, then case-insensitive file name. */
  find(path: string): string | undefined {
    if (this.names.includes(path)) return path;
    const p = norm(path);
    return (
      this.names.find((n) => norm(n) === p) ?? this.names.find((n) => norm(basename(n)) === norm(basename(p)))
    );
  }

  /** Finds an image whose file name starts with the class name, e.g. "PNG/Alchemist - Fumbus.png". PNG preferred. */
  findByClassName(className: string): string | undefined {
    const prefix = norm(className);
    const hits = this.names.filter((n) => {
      const s = norm(stem(n));
      return s === prefix || s.startsWith(`${prefix} -`) || s.startsWith(`${prefix}_`);
    });
    return hits.find((n) => extOf(n) === 'png') ?? hits[0];
  }

  get(name: string): ArtImage | undefined {
    const ext = extOf(name);
    if (!ext) return undefined;
    let bytes = this.cache.get(name);
    if (!bytes) {
      const raw = this.read(name);
      if (!raw) return undefined;
      bytes = ext === 'png' ? stripPngMetadata(raw) : raw;
      this.cache.set(name, bytes);
    }
    return { bytes, ext, origin: `${this.label}: ${name}` };
  }
}

export class ArtLibrary {
  private readonly packs = new Map<string, ArtPack>();
  /** Loose images keyed by `${game}/${lowercase stem}`. */
  private readonly local = new Map<string, ArtImage>();

  addPack(pack: ArtPack): void {
    this.packs.set(pack.id, pack);
  }

  removePack(id: string): void {
    this.packs.delete(id);
  }

  hasPack(id: string): boolean {
    return this.packs.has(id);
  }

  get packIds(): string[] {
    return [...this.packs.keys()];
  }

  /** Registers a loose image for a game, addressed by file name without extension (usually the class id). */
  addLocal(game: string, fileName: string, bytes: Uint8Array, origin = fileName): void {
    const ext = extOf(fileName);
    if (!ext) throw new Error(`Unsupported image type: ${fileName} (use PNG, JPG or SVG)`);
    const clean = ext === 'png' ? stripPngMetadata(bytes) : bytes;
    this.local.set(`${game}/${norm(stem(fileName))}`, { bytes: clean, ext, origin });
  }

  get localCount(): number {
    return this.local.size;
  }

  /** Local override first, then the referenced Community Use Package image. */
  resolve(req: ArtRequest): ArtImage | undefined {
    const localKeys = [req.local, req.classId].filter((k): k is string => !!k).map((k) => norm(stem(k)));
    for (const k of localKeys) {
      const hit = this.local.get(`${req.game}/${k}`);
      if (hit) return hit;
    }
    if (req.paizo) {
      const pack = this.packs.get(req.paizo.pack);
      if (pack) {
        const name = pack.find(req.paizo.file) ?? pack.findByClassName(req.className);
        if (name) return pack.get(name);
      }
    }
    return undefined;
  }
}
