import type { ClassSummary, SourceSpec } from '../engine/protocol';

export function sourceKey(source: SourceSpec): string {
  return source.kind === 'bundled'
    ? 'bundled'
    : `${source.kind}:${source.kind === 'github' ? source.spec : source.url}`;
}

export function selectionKey(source: SourceSpec, game: string, set: string): string {
  return JSON.stringify([sourceKey(source), game, set]);
}

export function eligibleClass(
  c: ClassSummary,
  playtest: boolean,
  legacy: boolean,
  maxComplexity: string,
): boolean {
  return (
    (c.status !== 'playtest' || playtest) &&
    (c.status !== 'legacy' || legacy) &&
    (maxComplexity === '' || (c.complexity !== null && c.complexity <= Number(maxComplexity)))
  );
}

/** Presets select books; manual exclusions and the complexity filter remain explicit afterwards. */
export function presetExclusions(
  classes: ClassSummary[],
  preset: 'core1' | 'core12' | 'published',
): string[] {
  return classes
    .filter((c) =>
      preset === 'published'
        ? ['playtest', 'legacy'].includes(c.status)
        : !(c.source === 'Player Core' || (preset === 'core12' && c.source === 'Player Core 2')),
    )
    .map((c) => c.id);
}
