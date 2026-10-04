import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { loadContent } from '@pfsf/engine';
import { FsContentSource } from '../src/fs-source';

const content = await loadContent(new FsContentSource(join(import.meta.dir, '../../../content')));

describe('bundled content', () => {
  test('has no warnings (every icon and emblem exists)', () => {
    expect(content.warnings).toEqual([]);
  });

  test('has both games', () => {
    expect([...content.games.keys()].sort()).toEqual(['pf2e', 'sf2e']);
  });

  for (const [id, bundle] of content.games) {
    test(`${id}: every class has two or three features with short text`, () => {
      for (const c of bundle.classes) {
        expect(c.features.length).toBeGreaterThanOrEqual(2);
        const chars = c.features.reduce((n, f) => n + f.title.length + f.text.length, 0);
        // Cards have room for roughly 450 characters at the default size.
        expect(chars).toBeLessThan(450);
      }
    });

    test(`${id}: class ids match file names`, () => {
      for (const c of bundle.classes) expect(c.path.endsWith(`/${c.id}.json`)).toBe(true);
    });

    test(`${id}: casters list a tradition and a casting type`, () => {
      for (const c of bundle.classes) {
        if (c.casting) expect(c.traditions.length).toBeGreaterThan(0);
      }
    });
  }
});
