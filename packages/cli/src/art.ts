/**
 * Local art: Paizo Community Use Package zips and loose images live in local-assets/ (git-ignored), never in the
 * repository. See docs/paizo-assets.md.
 */
import { mkdir, readdir, rename, stat } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { ArtLibrary, ArtPack, allGameBundles, type ContentBundle } from '@pfsf/engine';

export const DEFAULT_ASSET_DIR = 'local-assets';

async function exists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

/** Loads every art pack found in `<dir>/paizo/` and loose images in `<dir>/art/<game>/`. */
export async function loadLocalArt(
  dir: string,
  content: ContentBundle,
  log: (msg: string) => void = () => {},
): Promise<ArtLibrary> {
  const lib = new ArtLibrary();
  const looseGames = new Set<string>();
  for (const bundle of allGameBundles(content)) {
    for (const pack of bundle.game.artPacks) {
      if (!pack.fileName || lib.hasPack(pack.id)) continue;
      const path = join(dir, 'paizo', pack.fileName);
      if (await exists(path)) {
        lib.addPack(ArtPack.fromZip(pack.id, pack.label, await Bun.file(path).bytes()));
        log(`Using ${path}`);
      }
    }
    if (looseGames.has(bundle.game.id)) continue;
    looseGames.add(bundle.game.id);
    const looseDir = join(dir, 'art', bundle.game.id);
    if (await exists(looseDir)) {
      for (const name of await readdir(looseDir)) {
        if (/\.zip$/i.test(name)) {
          lib.addCustomPack(
            bundle.game.id,
            ArtPack.fromZip(name, name, await Bun.file(join(looseDir, name)).bytes()),
          );
          continue;
        }
        if (!/\.(png|jpe?g|svg|webp|gif)$/i.test(name)) continue;
        lib.addLocal(
          bundle.game.id,
          name,
          await Bun.file(join(looseDir, name)).bytes(),
          join(looseDir, name),
        );
      }
    }
  }
  return lib;
}

export interface FetchReport {
  downloaded: string[];
  skipped: string[];
}

/** Downloads the Community Use Package zips referenced by the content into `<dir>/paizo/`. */
export async function fetchPaizoPacks(
  dir: string,
  content: ContentBundle,
  opts: { force?: boolean; log?: (msg: string) => void } = {},
): Promise<FetchReport> {
  const log = opts.log ?? (() => {});
  const target = join(dir, 'paizo');
  await mkdir(target, { recursive: true });
  const report: FetchReport = { downloaded: [], skipped: [] };
  const seen = new Set<string>();
  for (const bundle of allGameBundles(content)) {
    for (const pack of bundle.game.artPacks) {
      if (pack.kind !== 'zip' || !pack.url || !pack.fileName || seen.has(pack.url)) continue;
      seen.add(pack.url);
      const dest = join(target, basename(pack.fileName));
      if (!opts.force && (await exists(dest))) {
        report.skipped.push(dest);
        log(`Already present: ${dest}`);
        continue;
      }
      log(`Downloading ${pack.url}`);
      const res = await fetch(pack.url);
      if (!res.ok) throw new Error(`Download failed (${res.status}) for ${pack.url}`);
      const tmp = `${dest}.part`;
      await Bun.write(tmp, res);
      await rename(tmp, dest);
      report.downloaded.push(dest);
      log(`Saved ${dest} (${((await stat(dest)).size / 1e6).toFixed(1)} MB)`);
    }
  }
  return report;
}
