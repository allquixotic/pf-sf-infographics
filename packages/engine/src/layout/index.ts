import type { DocModel } from '../model/build';
import type { ResolvedOptions } from '../options/schema';
import { type CardGeometry, cardGeometry, POSTER, SECTION } from './geometry';
import { arrangePoster, type PosterArrangement } from './poster';

export interface PageSetup {
  /** Page size in pt including bleed, or null for "fit to content". */
  width: number | null;
  height: number | null;
  margin: number;
  bleed: number;
}

export interface PosterLayout {
  kind: 'poster';
  page: PageSetup;
  card: CardGeometry;
  section: typeof SECTION;
  poster: typeof POSTER;
  arrangement: PosterArrangement;
}

export interface BookletLayout {
  kind: 'booklet';
  page: PageSetup;
  card: CardGeometry;
  section: typeof SECTION;
  poster: typeof POSTER;
  /** Card columns per page and the scale applied to each card. */
  cols: number;
  cardScale: number;
  legendCols: number;
}

export type Layout = PosterLayout | BookletLayout;

const MM = 72 / 25.4;
const FIT_ASPECT = { landscape: 16 / 9, portrait: 3 / 4 };

function pageSetup(o: ResolvedOptions): PageSetup {
  const bleed = o.intent === 'print' ? o.bleed * MM : 0;
  return o.fit
    ? { width: null, height: null, margin: o.margin, bleed: 0 }
    : { width: o.pageWidth + 2 * bleed, height: o.pageHeight + 2 * bleed, margin: o.margin + bleed, bleed };
}

export function computeLayout(model: DocModel, o: ResolvedOptions): Layout {
  const card = cardGeometry(o.art, o.fontScale);
  const page = pageSetup(o);
  const noticeLines = model.notices.length ? model.notices.length * 2 + 1 : 0;
  const footerHeight = noticeLines * POSTER.noticeSize * 1.35;

  if (o.layout === 'poster') {
    let availW: number;
    let availH: number;
    if (page.width === null || page.height === null) {
      const aspect = o.orientation === 'portrait' ? FIT_ASPECT.portrait : FIT_ASPECT.landscape;
      availW = aspect;
      availH = 1;
    } else {
      availW = page.width - 2 * page.margin;
      availH = page.height - 2 * page.margin;
    }
    const arrangement = arrangePoster({
      sectionSizes: model.sections.map((s) => s.cards.length),
      legend: model.legend !== null,
      card,
      availWidth: availW,
      availHeight: availH,
      footerHeight,
    });
    return { kind: 'poster', page, card, section: SECTION, poster: POSTER, arrangement };
  }

  // Booklet: fixed-width cards flowing down pages. Pick the column count that keeps cards 1.1×–2× natural size.
  const contentW = (page.width ?? 612) - 2 * page.margin;
  const cols = Math.max(1, Math.floor((contentW + SECTION.gapX) / (card.width * 1.25 + SECTION.gapX)));
  const cardScale = Math.min(2, (contentW - (cols - 1) * SECTION.gapX) / cols / card.width);
  const legendCols = Math.max(1, Math.min(3, Math.round(contentW / 260)));
  return { kind: 'booklet', page, card, section: SECTION, poster: POSTER, cols, cardScale, legendCols };
}
