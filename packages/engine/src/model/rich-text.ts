/** Minimal inline markup: **bold** and *italic*. Everything else is literal text. */
export interface Span {
  text: string;
  bold?: boolean;
  italic?: boolean;
}

export function parseRichText(input: string): Span[] {
  const spans: Span[] = [];
  const re = /\*\*(.+?)\*\*|\*(.+?)\*/gs;
  let last = 0;
  for (let m = re.exec(input); m; m = re.exec(input)) {
    if (m.index > last) spans.push({ text: input.slice(last, m.index) });
    if (m[1] !== undefined) spans.push({ text: m[1], bold: true });
    else spans.push({ text: m[2]!, italic: true });
    last = m.index + m[0].length;
  }
  if (last < input.length) spans.push({ text: input.slice(last) });
  return spans;
}

/** Splits text into paragraphs on blank lines, each parsed into spans. */
export function parseParagraphs(input: string): Span[][] {
  return input
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean)
    .map(parseRichText);
}
