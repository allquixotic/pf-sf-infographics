/**
 * Official art is never bundled with this project. Users supply it at runtime: the Paizo Community Use Package
 * zips (dropped into the web UI or downloaded by `bun run paizo:fetch` into local-assets/) and optional loose image
 * files for classes the package does not cover. ArtLibrary indexes whatever was supplied.
 */
import { unzipSync } from 'fflate';
import { stripPngMetadata } from './png';

export type ImageExt = 'png' | 'jpg' | 'svg' | 'webp' | 'gif';

export interface ArtImage {
  bytes: Uint8Array;
  ext: ImageExt;
  /** Where the image came from, for messages. */
  origin: string;
  /** Present only when resolved through a referenced official pack. */
  officialPack?: string;
  /** User identifies a supplied image as Paizo artwork, so its artist credit must be retained. */
  paizoCredit?: boolean;
}

export interface ArtRequest {
  game: string;
  classId: string;
  className: string;
  paizo?: { pack: string; file: string } | undefined;
  local?: string | undefined;
}

const EXT_RE = /\.(png|jpe?g|svg|webp|gif)$/i;

function extOf(name: string): ImageExt | undefined {
  const m = EXT_RE.exec(name);
  if (!m) return undefined;
  const e = m[1]!.toLowerCase();
  return e === 'jpeg' ? 'jpg' : (e as ImageExt);
}

const norm = (s: string) => s.toLowerCase().replace(/\\/g, '/');
const basename = (s: string) => norm(s).split('/').pop()!;
const stem = (s: string) => basename(s).replace(/\.[^.]+$/, '');
const classKey = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
function matchesClass(file: string, name: string): boolean {
  const value = stem(file).trim();
  const key = classKey(name);
  return (
    classKey(value) === key ||
    value
      .split(/[\s_.()—–-]+/)
      .some((_, i, words) => i < words.length - 1 && classKey(words.slice(0, i + 1).join('')) === key)
  );
}
function preferred(names: string[]): string | undefined {
  const order = ['png', 'svg', 'webp', 'jpg', 'gif'];
  return names.sort((a, b) => order.indexOf(extOf(a)!) - order.indexOf(extOf(b)!) || a.localeCompare(b))[0];
}

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
    this.names = names.filter(
      (n) =>
        extOf(n) &&
        !norm(n)
          .split('/')
          .some((part) => part.startsWith('.') || part === '__macosx'),
    );
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
    const exact = this.names.filter((n) => classKey(stem(n)) === classKey(className));
    return preferred(exact) ?? preferred(this.names.filter((n) => matchesClass(n, className)));
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
  private readonly customPacks = new Map<string, { game: string; pack: ArtPack; paizoCredit: boolean }>();

  addCustomPack(game: string, pack: ArtPack, paizoCredit = false): void {
    this.customPacks.delete(`${game}/${pack.id}`);
    this.customPacks.set(`${game}/${pack.id}`, { game, pack, paizoCredit });
  }
  /** Loose images keyed by `${game}/${normalized filename}`. */
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

  get customPackCount(): number {
    return this.customPacks.size;
  }

  /** Registers a loose image for a game, addressed by file name without extension (usually the class id). */
  addLocal(game: string, fileName: string, bytes: Uint8Array, origin = fileName, paizoCredit = false): void {
    const ext = extOf(fileName);
    if (!ext) throw new Error(`Unsupported image type: ${fileName} (use PNG, JPG, SVG, WebP or GIF)`);
    const clean = ext === 'png' ? stripPngMetadata(bytes) : bytes;
    this.local.set(`${game}/${norm(fileName)}`, { bytes: clean, ext, origin, paizoCredit });
  }

  get localCount(): number {
    return this.local.size;
  }

  /** Local override first, then the referenced Community Use Package image. */
  resolve(req: ArtRequest): ArtImage | undefined {
    const localNames = [...this.local.keys()].filter((key) => key.startsWith(`${req.game}/`));
    for (const name of [req.local, req.classId, req.className].filter((n): n is string => !!n)) {
      const key =
        preferred(localNames.filter((k) => classKey(stem(k)) === classKey(stem(name)))) ??
        preferred(localNames.filter((k) => matchesClass(k, stem(name))));
      if (key) return this.local.get(key);
    }
    for (const { game, pack, paizoCredit } of [...this.customPacks.values()].reverse()) {
      if (game !== req.game) continue;
      const name = pack.findByClassName(req.classId) ?? pack.findByClassName(req.className);
      if (name) {
        const image = pack.get(name);
        if (image) return { ...image, paizoCredit };
      }
    }
    if (req.paizo) {
      const pack = this.packs.get(req.paizo.pack);
      if (pack) {
        const name = pack.find(req.paizo.file) ?? pack.findByClassName(req.className);
        if (name) {
          const image = pack.get(name);
          if (image) return { ...image, officialPack: req.paizo.pack };
        }
      }
    }
    return undefined;
  }
}
