/** Page and screen size presets. Print sizes are in points (1/72 in); screen sizes in CSS pixels. */

export type SizeUnit = 'pt' | 'in' | 'mm' | 'px';

export interface SizePreset {
  id: string;
  label: string;
  intent: 'print' | 'screen';
  /** Width and height in `unit`, portrait orientation for print (short side first). */
  width: number;
  height: number;
  unit: SizeUnit;
}

export const PT_PER: Record<SizeUnit, number> = {
  pt: 1,
  in: 72,
  mm: 72 / 25.4,
  // Screen sizes are treated as CSS pixels at 96 per inch.
  px: 0.75,
};

export const SIZE_PRESETS: SizePreset[] = [
  { id: 'letter', label: 'US Letter (8.5 × 11 in)', intent: 'print', width: 8.5, height: 11, unit: 'in' },
  { id: 'legal', label: 'US Legal (8.5 × 14 in)', intent: 'print', width: 8.5, height: 14, unit: 'in' },
  {
    id: 'tabloid',
    label: 'Tabloid / Ledger (11 × 17 in)',
    intent: 'print',
    width: 11,
    height: 17,
    unit: 'in',
  },
  { id: 'poster-18x24', label: 'Poster (18 × 24 in)', intent: 'print', width: 18, height: 24, unit: 'in' },
  { id: 'poster-24x36', label: 'Poster (24 × 36 in)', intent: 'print', width: 24, height: 36, unit: 'in' },
  { id: 'poster-36x48', label: 'Poster (36 × 48 in)', intent: 'print', width: 36, height: 48, unit: 'in' },
  { id: 'a5', label: 'A5 (148 × 210 mm)', intent: 'print', width: 148, height: 210, unit: 'mm' },
  { id: 'a4', label: 'A4 (210 × 297 mm)', intent: 'print', width: 210, height: 297, unit: 'mm' },
  { id: 'a3', label: 'A3 (297 × 420 mm)', intent: 'print', width: 297, height: 420, unit: 'mm' },
  { id: 'a2', label: 'A2 (420 × 594 mm)', intent: 'print', width: 420, height: 594, unit: 'mm' },
  { id: 'a1', label: 'A1 (594 × 841 mm)', intent: 'print', width: 594, height: 841, unit: 'mm' },
  { id: 'a0', label: 'A0 (841 × 1189 mm)', intent: 'print', width: 841, height: 1189, unit: 'mm' },
  { id: 'fhd', label: 'Full HD (1920 × 1080)', intent: 'screen', width: 1080, height: 1920, unit: 'px' },
  { id: 'qhd', label: 'QHD (2560 × 1440)', intent: 'screen', width: 1440, height: 2560, unit: 'px' },
  { id: 'uhd', label: '4K UHD (3840 × 2160)', intent: 'screen', width: 2160, height: 3840, unit: 'px' },
  { id: 'uhd8k', label: '8K UHD (7680 × 4320)', intent: 'screen', width: 4320, height: 7680, unit: 'px' },
  { id: 'tablet', label: 'Tablet (1668 × 2388)', intent: 'screen', width: 1668, height: 2388, unit: 'px' },
  { id: 'phone', label: 'Phone (1080 × 2340)', intent: 'screen', width: 1080, height: 2340, unit: 'px' },
];

export function findPreset(id: string): SizePreset | undefined {
  return SIZE_PRESETS.find((p) => p.id === id);
}

/** Sensible default size for each layout and intent. */
export function defaultSizeFor(layout: 'poster' | 'booklet', intent: 'print' | 'screen'): string {
  if (layout === 'poster') return intent === 'print' ? 'poster-24x36' : 'uhd';
  return intent === 'print' ? 'letter' : 'tablet';
}
