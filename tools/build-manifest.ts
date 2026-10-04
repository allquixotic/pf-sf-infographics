/**
 * Regenerates content/manifest.json's file index (path, size, sha256 of every content file) and validates the
 * content. With --check it only verifies: CI fails if the index is stale or the content is invalid.
 *
 *   bun run content:manifest        # update the index
 *   bun run content:check           # verify (used by CI and the build)
 */
import { readdir } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { ContentValidationError, loadContent, type Manifest } from '@pfsf/engine';
import { FsContentSource } from '../packages/cli/src/fs-source';

const root = join(import.meta.dir, '..', 'content');
const check = Bun.argv.includes('--check');
const strict = Bun.argv.includes('--strict') || check;

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else out.push(relative(root, p).split(sep).join('/'));
  }
  return out;
}

const manifestPath = join(root, 'manifest.json');
const manifest = (await Bun.file(manifestPath).json()) as Manifest;

const paths = (await walk(root)).filter((p) => p !== 'manifest.json').sort();
const files = await Promise.all(
  paths.map(async (path) => {
    const bytes = await Bun.file(join(root, path)).bytes();
    const sha256 = new Bun.CryptoHasher('sha256').update(bytes).digest('hex');
    return { path, size: bytes.byteLength, sha256 };
  }),
);

const fresh = `${JSON.stringify({ ...manifest, files }, null, 2)}\n`;
const current = await Bun.file(manifestPath).text();

if (check) {
  if (fresh !== current) {
    console.error(
      'content/manifest.json is out of date. Run `bun run content:manifest` and commit the result.',
    );
    process.exit(1);
  }
} else if (fresh !== current) {
  await Bun.write(manifestPath, fresh);
  console.log(`Updated ${manifestPath} (${files.length} files)`);
} else {
  console.log(`${manifestPath} is up to date (${files.length} files)`);
}

try {
  const content = await loadContent(new FsContentSource(root));
  for (const w of content.warnings) console.warn(`warning: ${w}`);
  for (const [id, g] of content.games) console.log(`${id}: ${g.classes.length} classes valid`);
  if (strict && content.warnings.length) {
    console.error('Content has warnings (treated as errors in --check mode).');
    process.exit(1);
  }
} catch (err) {
  if (err instanceof ContentValidationError) {
    console.error(err.message);
    process.exit(1);
  }
  throw err;
}
