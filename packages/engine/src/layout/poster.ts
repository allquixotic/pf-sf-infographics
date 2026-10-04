/**
 * Poster arrangement: sections are stacked into side-by-side vertical bands (as in the original design, where
 * "high magic" and the legend share the left band). We search every way of splitting the ordered sections into
 * contiguous bands, every band width (in card columns) and every band for the legend, and keep the arrangement
 * that can be drawn largest on the page.
 */
import {
  type CardGeometry,
  estimateLegendHeight,
  POSTER,
  SECTION,
  sectionHeight,
  sectionWidth,
} from './geometry';

export interface BandBlock {
  kind: 'section' | 'legend';
  /** Index into DocModel.sections for section blocks. */
  index: number;
  cols: number;
}

export interface Band {
  cols: number;
  width: number;
  blocks: BandBlock[];
}

export interface PosterArrangement {
  bands: Band[];
  /** Natural size before scaling, including the title row. */
  width: number;
  height: number;
  scale: number;
}

export interface PosterInput {
  sectionSizes: number[];
  legend: boolean;
  card: CardGeometry;
  /** Available area (page minus margins). For "fit" pass the aspect ratio you want as width/height with height 1. */
  availWidth: number;
  availHeight: number;
  /** Extra height below the bands (notices). */
  footerHeight: number;
}

const MAX_COLS = 5;

function* partitions(n: number): Generator<number[][]> {
  // Contiguous splits of [0..n): each bit of mask marks a cut after that index.
  const cuts = n - 1;
  for (let mask = 0; mask < 1 << cuts; mask++) {
    const groups: number[][] = [];
    let cur: number[] = [0];
    for (let i = 1; i < n; i++) {
      if (mask & (1 << (i - 1))) {
        groups.push(cur);
        cur = [i];
      } else cur.push(i);
    }
    groups.push(cur);
    yield groups;
  }
}

/** Every combination of band widths with 1 ≤ width ≤ limit. */
function* widthChoices(limits: number[]): Generator<number[]> {
  const cur = limits.map(() => 1);
  while (true) {
    yield [...cur];
    let k = 0;
    while (k < cur.length && cur[k] === limits[k]) cur[k++] = 1;
    if (k === cur.length) return;
    cur[k]!++;
  }
}

export function arrangePoster(input: PosterInput): PosterArrangement {
  const { sectionSizes, card } = input;
  const n = sectionSizes.length;
  let best: (PosterArrangement & { score: number }) | undefined;

  const evaluate = (bandIdx: number[][], widths: number[], legendBand: number) => {
    const bands: Band[] = [];
    let totalW = 0;
    let maxH = 0;
    let used = 0;
    bandIdx.forEach((idx, b) => {
      const cols = widths[b]!;
      const width = sectionWidth(card, cols);
      const blocks: BandBlock[] = idx.map((i) => ({ kind: 'section', index: i, cols }));
      let h = 0;
      for (const i of idx) {
        const size = sectionSizes[i]!;
        const rows = Math.ceil(size / cols);
        used += size * card.width * card.height;
        h += sectionHeight(card, rows);
      }
      if (b === legendBand) {
        blocks.push({ kind: 'legend', index: -1, cols });
        const legendH = estimateLegendHeight(width);
        used += legendH * width * 0.8;
        h += legendH + (idx.length ? SECTION.between : 0);
      }
      h += Math.max(0, idx.length - 1) * SECTION.between;
      bands.push({ cols, width, blocks });
      totalW += width;
      maxH = Math.max(maxH, h);
    });
    totalW += (bands.length - 1) * SECTION.between;
    const height = POSTER.titleSize + POSTER.titleGap + maxH + input.footerHeight;
    const scale = Math.min(input.availWidth / totalW, input.availHeight / height);
    // Prefer arrangements that are drawn large, but penalise empty space (short bands get stretched sections).
    const efficiency = used / (totalW * maxH);
    const score = scale * Math.sqrt(efficiency);
    if (!best || score > best.score) best = { bands, width: totalW, height, scale, score };
  };

  if (n === 0) {
    const width = sectionWidth(card, 2);
    return {
      bands: input.legend ? [{ cols: 2, width, blocks: [{ kind: 'legend', index: -1, cols: 2 }] }] : [],
      width,
      height: POSTER.titleSize + POSTER.titleGap + estimateLegendHeight(width),
      scale: 1,
    };
  }

  for (const split of partitions(n)) {
    // The legend may also get a band of its own, appended after the section bands.
    const legendOptions = input.legend ? [...split.keys(), split.length] : [-1];
    for (const legendBand of legendOptions) {
      const bandIdx = legendBand === split.length ? [...split, []] : split;
      // A band never needs more columns than its largest section has cards; a legend-only band gets up to 3.
      const limits = bandIdx.map((b) =>
        b.length ? Math.min(MAX_COLS, Math.max(...b.map((i) => sectionSizes[i]!))) : 3,
      );
      for (const widths of widthChoices(limits)) evaluate(bandIdx, widths, legendBand);
    }
  }
  const { score: _score, ...result } = best!;
  return result;
}
