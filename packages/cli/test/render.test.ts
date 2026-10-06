import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { Engine, loadContent } from '@pfsf/engine';
import { FsContentSource } from '../src/fs-source';
import { bunRuntime } from '../src/runtime';

const content = await loadContent(new FsContentSource(join(import.meta.dir, '../../../content')));
const engine = new Engine(bunRuntime);
const ascii = (b: Uint8Array, n: number) => new TextDecoder().decode(b.subarray(0, n));

describe('rendering', () => {
  test('PF2e poster PDF', async () => {
    const r = await engine.render({ content, options: { game: 'pf2e', format: 'pdf' } });
    expect(r.files).toHaveLength(1);
    expect(ascii(r.files[0]!.data, 5)).toBe('%PDF-');
  }, 60_000);

  test('SF2e dark transparent SVG with playtests', async () => {
    const r = await engine.render({
      content,
      options: { game: 'sf2e', format: 'svg', theme: 'dark', background: false, includePlaytest: true },
    });
    const svg = new TextDecoder().decode(r.files[0]!.data);
    expect(svg).toContain('<svg');
    expect(svg).not.toContain('<script');
    expect(svg).not.toContain('data:image/svg+xml');
  }, 60_000);

  test('booklet renders several pages', async () => {
    const r = await engine.render({ content, options: { game: 'pf2e', layout: 'booklet', format: 'svg' } });
    expect(r.files.length).toBeGreaterThan(3);
    expect(r.files[0]!.name).toBe('pf2e-revised-booklet-p01.svg');
  }, 60_000);

  test('raster formats', async () => {
    for (const format of ['png', 'jpg', 'webp'] as const) {
      const r = await engine.render({
        content,
        options: { game: 'sf2e', format, intent: 'screen', size: 'fhd', scale: 0.5 },
      });
      const d = r.files[0]!.data;
      if (format === 'png') expect(ascii(d.subarray(1), 3)).toBe('PNG');
      if (format === 'jpg') expect([d[0], d[1]]).toEqual([0xff, 0xd8]);
      if (format === 'webp') expect(ascii(d.subarray(8), 4)).toBe('WEBP');
      expect(r.files[0]!.width).toBe(960);
    }
  }, 120_000);

  test('class filters', async () => {
    const r = await engine.render({
      content,
      options: { game: 'pf2e', only: ['fighter'], format: 'svg', legend: false },
    });
    const svg = new TextDecoder().decode(r.files[0]!.data);
    expect(svg.length).toBeGreaterThan(1000);
  }, 60_000);
});
