import { expect, test } from 'bun:test';
import { join } from 'node:path';
import type { ContentSource } from '@pfsf/engine';
import {
  allGameBundles,
  getGameBundle,
  loadContent,
  prepareDocument,
  resolveOptions,
  selectClasses,
} from '@pfsf/engine';
import { FsContentSource } from '../src/fs-source';

const fs = new FsContentSource(join(import.meta.dir, '../../../content'));
const content = await loadContent(fs);
const root = JSON.parse(await fs.readText('pf2e/game.json'));
function overlay(files: Record<string, unknown>): ContentSource {
  return {
    label: 'fixture',
    readText: (path) => (path in files ? Promise.resolve(JSON.stringify(files[path])) : fs.readText(path)),
    readBytes: (path) => fs.readBytes(path),
  };
}

test('rating sets select complete rosters, summaries, scores, groups and legends', async () => {
  const alternate = JSON.parse(await fs.readText('pf2e/rating-sets/original/game.json'));
  alternate.classes = ['classes/oracle.json'];
  alternate.groups = [{ id: 'perspective', label: 'Different family' }];
  alternate.legend.howToUse = 'Independent perspective legend';
  const oracle = JSON.parse(await fs.readText('pf2e/rating-sets/original/classes/oracle.json'));
  oracle.name = 'Alternate Oracle';
  oracle.group = 'perspective';
  oracle.features = [{ title: 'Independent details', text: 'A complete custom description.' }];
  oracle.ratings.offense = 1;
  const loaded = await loadContent(
    overlay({
      'pf2e/rating-sets/original/game.json': alternate,
      'pf2e/rating-sets/original/classes/oracle.json': oracle,
    }),
  );
  const doc = prepareDocument({ content: loaded, options: { ratingSet: 'original' } });
  expect(doc.model.sections).toHaveLength(1);
  expect(doc.model.sections[0]?.label).toBe('Different family');
  expect(doc.model.sections[0]?.cards[0]?.name).toBe('Alternate Oracle');
  expect(doc.model.sections[0]?.cards[0]?.features[0]?.title).toBe('Independent details');
  expect(doc.model.sections[0]?.cards[0]?.ratings[0]?.hi).toBe(1);
  expect(JSON.stringify(doc.model.legend)).toContain('Independent perspective legend');
  expect(getGameBundle(loaded, 'pf2e').classes).toHaveLength(31);
});

test('old content without rating sets loads as one default perspective', async () => {
  const legacy = { ...root };
  delete legacy.ratingSets;
  const loaded = await loadContent(overlay({ 'pf2e/game.json': legacy }), { games: ['pf2e'] });
  expect([...loaded.ratingSets.get('pf2e')!.keys()]).toEqual(['default']);
  expect(getGameBundle(loaded, 'pf2e', 'default').classes).toHaveLength(31);
});

test('unknown rating set does not silently substitute default scores', () => {
  expect(() => prepareDocument({ content, options: { ratingSet: 'missing' } })).toThrow('Unknown rating set');
});

test('invalid alternate definitions fail validation', async () => {
  const invalid = [
    [
      { id: 'a', name: 'A', description: 'A' },
      { id: 'a', name: 'Duplicate', description: 'B', path: 'rating-sets/original/game.json' },
    ],
    [{ id: 'a', name: 'A', description: 'A', path: 'rating-sets/original/game.json' }],
    [
      { id: 'a', name: 'A', description: 'A' },
      { id: 'b', name: 'B', description: 'B' },
    ],
    [
      { id: 'a', name: 'A', description: 'A' },
      { id: 'b', name: 'B', description: 'B', path: '../../../outside.json' },
    ],
    [
      { id: 'a', name: 'A', description: 'A' },
      { id: 'b', name: 'B', description: 'B', path: 'missing.json' },
    ],
  ];
  for (const ratingSets of invalid) {
    await expect(
      loadContent(overlay({ 'pf2e/game.json': { ...root, ratingSets } }), { games: ['pf2e'] }),
    ).rejects.toThrow();
  }
  const alternate = JSON.parse(await fs.readText('pf2e/rating-sets/original/game.json'));
  await expect(
    loadContent(overlay({ 'pf2e/rating-sets/original/game.json': { ...alternate, id: 'wrong-game' } })),
  ).rejects.toThrow('rating set must use game id');
  await expect(
    loadContent(
      overlay({ 'pf2e/rating-sets/original/game.json': { ...alternate, ratingSets: root.ratingSets } }),
    ),
  ).rejects.toThrow('nested ratingSets');
});

test('all bundled perspectives have complete rationale, short cards and valid local artwork', () => {
  expect(allGameBundles(content)).toHaveLength(4);
  for (const bundle of allGameBundles(content)) {
    expect(bundle.ratingSet?.description.length).toBeGreaterThan(0);
    for (const c of bundle.classes) {
      expect(c.features.reduce((n, f) => n + f.title.length + f.text.length, 0)).toBeLessThan(450);
      expect(Object.keys(c.review!.ratings).sort()).toEqual(Object.keys(c.ratings).sort());
      expect(bundle.icons.has(`emblem:${c.id}`)).toBe(true);
    }
  }
});

test('complexity uses range upper endpoint, combines with exclusions and status', () => {
  const bundle = getGameBundle(content, 'pf2e');
  const chosen = selectClasses(bundle, resolveOptions({ maxComplexity: 2, exclude: ['fighter'] }));
  expect(chosen.some((c) => c.id === 'barbarian')).toBe(false);
  expect(chosen.some((c) => c.id === 'fighter')).toBe(false);
  const playtest = selectClasses(bundle, resolveOptions({ only: ['daredevil'], maxComplexity: 3 }));
  expect(playtest).toHaveLength(0);
});

test('shared assets load once per content source load, and refresh on the next load', async () => {
  const reads = new Map<string, number>();
  const source: ContentSource = {
    label: 'counted',
    readText: (path) => fs.readText(path),
    readBytes: (path) => {
      reads.set(path, (reads.get(path) ?? 0) + 1);
      return fs.readBytes(path);
    },
  };
  await loadContent(source);
  expect([...reads.values()]).toEqual([1, 1, 1]);
  await loadContent(source);
  expect([...reads.values()]).toEqual([2, 2, 2]);
});

test('review sources must be web links, not executable URLs', async () => {
  const oracle = JSON.parse(await fs.readText('pf2e/classes/oracle.json'));
  oracle.review.sources = ['javascript:alert(1)'];
  await expect(loadContent(overlay({ 'pf2e/classes/oracle.json': oracle }))).rejects.toThrow('sources');
});
