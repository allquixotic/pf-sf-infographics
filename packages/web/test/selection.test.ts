import { expect, test } from 'bun:test';
import type { ClassSummary } from '../src/engine/protocol';
import { defaultUiOptions, splitOptions, toRenderOptions } from '../src/state/options';
import { eligibleClass, presetExclusions, selectionKey } from '../src/state/selection';

const c = (id: string, source: string, status = 'core', complexity: number | null = 3): ClassSummary => ({
  id,
  name: id,
  source,
  status,
  complexity,
  group: 'a',
  iconic: null,
  hasArt: false,
});
const classes = [
  c('fighter', 'Player Core'),
  c('oracle', 'Player Core 2'),
  c('kineticist', 'Rage of Elements', 'expansion'),
  c('slayer', 'Playtest', 'playtest'),
];

test('book presets select exact books and exclude unreleased classes', () => {
  expect(presetExclusions(classes, 'core1')).toEqual(['oracle', 'kineticist', 'slayer']);
  expect(presetExclusions(classes, 'core12')).toEqual(['kineticist', 'slayer']);
  expect(presetExclusions(classes, 'published')).toEqual(['slayer']);
});
test('class eligibility matches status and upper complexity filtering', () => {
  expect(eligibleClass(classes[3]!, false, false, '')).toBe(false);
  expect(eligibleClass(classes[3]!, true, false, '2')).toBe(false);
  expect(eligibleClass(classes[3]!, true, false, '3')).toBe(true);
  expect(eligibleClass(c('unknown', 'Test', 'core', null), true, false, '5')).toBe(false);
});
test('perspective selections are isolated by source, game and set', () => {
  const bundled = { kind: 'bundled' } as const;
  const keys = [
    selectionKey(bundled, 'pf2e', 'revised'),
    selectionKey(bundled, 'pf2e', 'original'),
    selectionKey(bundled, 'sf2e', 'revised'),
    selectionKey({ kind: 'github', spec: 'owner/repo@branch' }, 'pf2e', 'revised'),
  ];
  expect(new Set(keys).size).toBe(4);
  const ui = { ...defaultUiOptions(), ratingSet: 'original', maxComplexity: '2.5' };
  expect(splitOptions(ui).game.ratingSet).toBe('original');
  expect(splitOptions(ui).shared).not.toHaveProperty('ratingSet');
  expect(toRenderOptions('pf2e', ui, 'pdf')).toMatchObject({ ratingSet: 'original', maxComplexity: 2.5 });
});
