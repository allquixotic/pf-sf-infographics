import { describe, expect, test } from 'bun:test';
import { cardGeometry } from '../src/layout/geometry';
import { arrangePoster } from '../src/layout/poster';

const card = cardGeometry('generic');

describe('arrangePoster', () => {
  const sizes = [10, 4, 3, 12];
  const result = arrangePoster({
    sectionSizes: sizes,
    legend: true,
    card,
    availWidth: 2520,
    availHeight: 1670,
    footerHeight: 40,
  });

  test('places every section exactly once and the legend once', () => {
    const blocks = result.bands.flatMap((b) => b.blocks);
    expect(blocks.filter((b) => b.kind === 'legend')).toHaveLength(1);
    const indexes = blocks
      .filter((b) => b.kind === 'section')
      .map((b) => b.index)
      .sort();
    expect(indexes).toEqual([0, 1, 2, 3]);
  });

  test('keeps section order within and across bands', () => {
    const order = result.bands.flatMap((b) =>
      b.blocks.filter((x) => x.kind === 'section').map((x) => x.index),
    );
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  test('scale fits the available area', () => {
    expect(result.width * result.scale).toBeLessThanOrEqual(2520 + 1e-6);
    expect(result.height * result.scale).toBeLessThanOrEqual(1670 + 1e-6);
  });

  test('portrait pages get fewer, narrower bands than landscape ones', () => {
    const portrait = arrangePoster({
      sectionSizes: sizes,
      legend: true,
      card,
      availWidth: 1670,
      availHeight: 2520,
      footerHeight: 40,
    });
    const cols = (r: typeof result) => r.bands.reduce((n, b) => n + b.cols, 0);
    expect(cols(portrait)).toBeLessThanOrEqual(cols(result));
  });

  test('handles no sections', () => {
    const r = arrangePoster({
      sectionSizes: [],
      legend: true,
      card,
      availWidth: 1000,
      availHeight: 1000,
      footerHeight: 0,
    });
    expect(r.bands[0]?.blocks[0]?.kind).toBe('legend');
  });
});
