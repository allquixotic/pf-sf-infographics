import { expect, test } from 'bun:test';
import { defaultUiOptions, restoreOptions, splitOptions } from '../src/state/options';

test('V6: migrate common settings from the active game and retain each game selection', () => {
  const legacy = {
    pf2e: { fontScale: 1.2, size: 'a3', title: 'Pathfinder picks', exclude: ['animist'] },
    sf2e: { fontScale: 0.8, size: 'letter', title: 'Starfinder picks', exclude: ['soldier'] },
  };
  const pf = restoreOptions('pf2e', legacy, {}, {});
  expect(pf.ui.fontScale).toBe(1.2);
  expect(pf.ui.size).toBe('a3');
  const sf = restoreOptions('sf2e', legacy, splitOptions(pf.ui).shared, pf.games);
  expect(sf.ui.fontScale).toBe(1.2);
  expect(sf.ui.size).toBe('a3');
  expect(sf.ui.title).toBe('Starfinder picks');
  expect(sf.ui.exclude).toEqual(['soldier']);
  expect(sf.games.pf2e?.exclude).toEqual(['animist']);
});

test('saved common preferences override stale legacy values; new games inherit them', () => {
  const saved = splitOptions({ ...defaultUiOptions(), layout: 'booklet', art: 'none', fontScale: 1.1 });
  const restored = restoreOptions('new-game', { pf2e: { fontScale: 0.8 } }, saved.shared, {});
  expect(restored.ui.layout).toBe('booklet');
  expect(restored.ui.art).toBe('none');
  expect(restored.ui.fontScale).toBe(1.1);
  expect(restored.ui.exclude).toEqual([]);
  expect(restored.ui.title).toBe('');
});
