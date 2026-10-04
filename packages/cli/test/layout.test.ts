import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { ArtLibrary, Engine, loadContent } from '@pfsf/engine';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import { FsContentSource } from '../src/fs-source';
import { bunRuntime } from '../src/runtime';

const content = await loadContent(new FsContentSource(join(import.meta.dir, '../../../content')));
const engine = new Engine(bunRuntime);
async function textPages(data: Uint8Array): Promise<TextItem[][]> {
  const pdf = await getDocument({ data: data.slice(), useSystemFonts: false }).promise;
  try {
    const pages: TextItem[][] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const text = await page.getTextContent();
      pages.push(text.items.filter((item): item is TextItem => 'str' in item && !!item.str.trim()));
    }
    return pages;
  } finally {
    await pdf.destroy();
  }
}

describe('export layout regressions', () => {
  test('V2: enlarged Animist features stay above the HP/source footer', async () => {
    for (const fontScale of [1.3, 1.5]) {
      for (const art of ['generic', 'none'] as const) {
        const result = await engine.render({
          content,
          options: {
            only: ['animist'],
            format: 'pdf',
            legend: false,
            attribution: false,
            fontScale,
            art,
          },
        });
        const [page] = await textPages(result.files[0]!.data);
        const footer = page!.find((item) => item.str.includes('HP/level'))!;
        expect(footer).toBeDefined();
        const firstFeature = page!.findIndex((item) => item.str.includes('Speaker for spirits'));
        expect(firstFeature).toBeGreaterThan(-1);
        for (const item of page!.slice(firstFeature)) {
          expect(item.transform[5] - item.height * 0.25).toBeGreaterThan(footer.transform[5] + footer.height);
        }
        expect(page!.map((item) => item.str).join(' ')).toContain('magic that changes along with it.');
      }
    }
  }, 60_000);

  test('booklet repeats headings only when enabled', async () => {
    for (const repeatSectionTitles of [true, false]) {
      const result = await engine.render({
        content,
        options: {
          layout: 'booklet',
          format: 'pdf',
          fontScale: 1.3,
          legend: false,
          attribution: false,
          only: [
            'animist',
            'bard',
            'cleric',
            'druid',
            'necromancer',
            'oracle',
            'psychic',
            'sorcerer',
            'witch',
            'wizard',
          ],
          repeatSectionTitles,
        },
      });
      const pages = await textPages(result.files[0]!.data);
      const classPages = pages.filter((page) => page.some((item) => item.str.includes('HP/level')));
      expect(classPages.length).toBeGreaterThan(1);
      const headings = classPages.filter((page) => page.some((item) => item.str === 'HIGH MAGIC ABILITY'));
      expect(headings.length).toBe(repeatSectionTitles ? classPages.length : 1);
    }
  }, 60_000);

  test('output colors reach vector export, including text and background', async () => {
    const result = await engine.render({
      content,
      options: {
        only: ['animist'],
        format: 'svg',
        legend: false,
        backgroundColor: '#edcba9',
        fontColor: '#123456',
      },
    });
    const svg = new TextDecoder().decode(result.files[0]!.data);
    expect(svg).toContain('#edcba9');
    expect(svg).toContain('#123456');
  }, 60_000);

  test('uploaded WebP and GIF images render in PDF and SVG', async () => {
    const fixtures = {
      gif: 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
      webp: 'UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA',
    };
    for (const [ext, data] of Object.entries(fixtures)) {
      const art = new ArtLibrary();
      art.addLocal('pf2e', `animist.${ext}`, new Uint8Array(Buffer.from(data, 'base64')));
      for (const format of ['pdf', 'svg'] as const) {
        const result = await engine.render({
          content,
          art,
          options: {
            only: ['animist'],
            art: 'paizo',
            format,
            legend: false,
          },
        });
        expect(result.warnings).toEqual([]);
        expect(result.files[0]!.data.length).toBeGreaterThan(1000);
        if (format === 'pdf') {
          const pages = await textPages(result.files[0]!.data);
          expect(
            pages
              .flat()
              .map((item) => item.str)
              .join(' '),
          ).not.toContain('Wayne Reynolds');
        }
      }
    }
  }, 60_000);
});

test('Auto chooses a fitted poster size that improves printed class text', async () => {
  const options = { game: 'pf2e', size: 'poster-24x36', format: 'pdf' as const };
  const auto = await engine.autoSize({ content, options });
  expect(auto.fontScale).toBeGreaterThan(1);
  expect(auto.fontScale).toBeLessThan(1.3);
  expect(auto.coverage).toBeGreaterThan(0.9);
  const sizes: number[] = [];
  for (const fontScale of [1, auto.fontScale]) {
    const result = await engine.render({ content, options: { ...options, fontScale } });
    const pages = await textPages(result.files[0]!.data);
    expect(pages.length).toBe(1);
    const feature = pages[0]!.find((item) => item.str.includes('Speaker for spirits'));
    expect(feature).toBeDefined();
    sizes.push(feature!.height);
  }
  expect(sizes[1]!).toBeGreaterThan(sizes[0]!);
}, 60_000);

test('explicit Paizo upload credits survive legend removal, without crediting ordinary custom art', async () => {
  for (const paizoCredit of [false, true]) {
    const art = new ArtLibrary();
    art.addLocal(
      'pf2e',
      'necromancer.svg',
      new TextEncoder().encode(
        '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><circle cx="10" cy="10" r="9"/></svg>',
      ),
      'User supplied portrait',
      paizoCredit,
    );
    const result = await engine.render({
      content,
      art,
      options: {
        only: ['necromancer'],
        art: 'paizo',
        format: 'pdf',
        legend: false,
        attribution: true,
      },
    });
    const pages = await textPages(result.files[0]!.data);
    const text = pages
      .flat()
      .map((item) => item.str)
      .join(' ');
    expect(text.includes('Wayne Reynolds')).toBe(paizoCredit);
    expect(text.includes('Artwork © Paizo Inc.')).toBe(paizoCredit);
  }
}, 60_000);
