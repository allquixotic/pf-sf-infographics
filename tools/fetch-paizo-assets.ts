/**
 * Downloads the Paizo Community Use Package portrait zips referenced by the content into local-assets/paizo/.
 * Same as `pfsf fetch-art`. The files are git-ignored and must never be committed; see docs/paizo-assets.md.
 */
import { join } from 'node:path';
import { loadContent } from '@pfsf/engine';
import { fetchPaizoPacks } from '../packages/cli/src/art';
import { FsContentSource } from '../packages/cli/src/fs-source';

const root = join(import.meta.dir, '..');
const content = await loadContent(new FsContentSource(join(root, 'content')));
const report = await fetchPaizoPacks(join(root, 'local-assets'), content, {
  force: Bun.argv.includes('--force'),
  log: console.log,
});
console.log(`Downloaded ${report.downloaded.length}, already present ${report.skipped.length}.`);
