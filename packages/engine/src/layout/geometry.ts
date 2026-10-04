/**
 * Natural-size geometry in points. Posters are laid out at this size and then scaled to fit the page, so these
 * numbers only fix proportions. The Typst templates read them from the model; nothing is duplicated there.
 */
export interface CardGeometry {
  width: number;
  height: number;
  /** Left and top edges of the outlined box (art overhangs to the left and above). */
  boxX: number;
  boxY: number;
  artW: number;
  contentX: number;
  labelW: number;
  square: number;
  squareGap: number;
  rowGap: number;
  textX: number;
  textPadRight: number;
  nameSize: number;
  iconSize: number;
  smallSize: number;
  bodySize: number;
  stroke: number;
}

export function cardGeometry(art: 'paizo' | 'generic' | 'none'): CardGeometry {
  const base = {
    width: 460,
    height: 166,
    boxY: 24,
    labelW: 30,
    square: 12,
    squareGap: 2.2,
    rowGap: 2.8,
    textPadRight: 14,
    nameSize: 15.5,
    iconSize: 14,
    smallSize: 6,
    bodySize: 8.2,
    stroke: 1.4,
  };
  if (art === 'none') return { ...base, width: 400, boxX: 0, artW: 0, contentX: 14, textX: 128 };
  return { ...base, boxX: 70, artW: 128, contentX: 132, textX: 250 };
}

export const SECTION = {
  pad: 18,
  header: 30,
  gapX: 22,
  gapY: 20,
  stroke: 2.4,
  bannerSize: 11,
  /** Space between sections stacked in a band, and between bands. */
  between: 22,
};

export const POSTER = {
  titleSize: 34,
  titleGap: 16,
  asOfSize: 12,
  noticeSize: 6.5,
};

export function sectionWidth(card: CardGeometry, cols: number): number {
  return 2 * SECTION.pad + cols * card.width + (cols - 1) * SECTION.gapX;
}

export function sectionHeight(card: CardGeometry, rows: number): number {
  return SECTION.header + 2 * SECTION.pad + rows * card.height + (rows - 1) * SECTION.gapY;
}

/** Rough legend height for a given width; only used to choose an arrangement, Typst measures the real one. */
export function estimateLegendHeight(width: number): number {
  const area = 900 * 340;
  return Math.max(300, area / width + 40);
}
