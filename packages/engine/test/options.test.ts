import { describe, expect, test } from 'bun:test';
import { OptionsError, resolveOptions } from '../src/options/schema';

describe('resolveOptions', () => {
  test('defaults: landscape 24x36 poster PDF', () => {
    const o = resolveOptions();
    expect(o.layout).toBe('poster');
    expect(o.format).toBe('pdf');
    expect(o.pageWidth).toBe(36 * 72);
    expect(o.pageHeight).toBe(24 * 72);
  });

  test('booklets default to portrait letter', () => {
    const o = resolveOptions({ layout: 'booklet' });
    expect([o.pageWidth, o.pageHeight]).toEqual([612, 792]);
  });

  test('explicit orientation flips presets', () => {
    const o = resolveOptions({ size: 'a4', orientation: 'landscape', layout: 'booklet' });
    expect(o.pageWidth).toBeGreaterThan(o.pageHeight);
  });

  test('custom sizes are kept as given', () => {
    const o = resolveOptions({ size: { width: 1000, height: 2000, unit: 'px' } });
    expect([o.pageWidth, o.pageHeight]).toEqual([750, 1500]);
  });

  test('screen intent uses CSS pixels', () => {
    const o = resolveOptions({ intent: 'screen', size: 'fhd', scale: 2 });
    expect(Math.round(o.pageWidth * o.pixelsPerPt)).toBe(3840);
  });

  test('fit size', () => {
    expect(resolveOptions({ size: 'fit' }).fit).toBe(true);
  });

  test('invalid values throw OptionsError', () => {
    expect(() => resolveOptions({ size: 'nope' })).toThrow(OptionsError);
    expect(() => resolveOptions({ format: 'gif' as never })).toThrow(OptionsError);
  });
});
