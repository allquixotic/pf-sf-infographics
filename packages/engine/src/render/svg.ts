/**
 * The typst.ts renderer emits SVG meant for interactive web viewing (selection layers, CSS classes, data
 * attributes). These helpers turn it into plain, portable SVG and split multi-page documents into one SVG per page.
 */

export interface SvgPage {
  svg: string;
  width: number;
  height: number;
}

function stripInteractive(svg: string): string {
  return svg
    .replace(/<foreignObject\b[\s\S]*?<\/foreignObject>/g, '')
    .replace(/<script\b[\s\S]*?<\/script>/g, '')
    .replace(/<style\b[\s\S]*?<\/style>/g, '')
    .replace(/\s(?:data-[\w-]+|class)="[^"]*"/g, '')
    .replace(/\sxmlns:h5="[^"]*"/, '')
    .replace(/\sstyle="overflow: visible;"/, '');
}

/**
 * Glyph outlines rely on the renderer's CSS (`fill: var(--glyph_fill)`) for their color when the CSS is dropped, so
 * we make sure paths inside <defs class="glyph"> inherit fill from the <use> that references them instead.
 */
function fixGlyphFills(svg: string): string {
  return svg.replace(/<path id="([^"]+)" class="outline_glyph"/g, '<path id="$1"');
}

const PAGE_RE =
  /<g class="typst-page" transform="translate\(([-\d.]+), ([-\d.]+)\)"[^>]*data-page-width="([\d.]+)" data-page-height="([\d.]+)">/g;

/** Splits renderer output into pages and cleans each one. */
export function splitSvgPages(raw: string): SvgPage[] {
  const headEnd = raw.indexOf('>') + 1;
  const openings = [...raw.matchAll(PAGE_RE)];
  if (openings.length === 0) {
    const w = Number(/width="([\d.]+)"/.exec(raw)?.[1] ?? 0);
    const h = Number(/height="([\d.]+)"/.exec(raw)?.[1] ?? 0);
    return [{ svg: finish(raw), width: w, height: h }];
  }
  // Everything before the first page group (defs, styles) is shared by all pages.
  const firstPage = openings[0]!.index!;
  const shared = raw.slice(headEnd, firstPage);
  const closeTag = '</svg>';
  const bodyEnd = raw.lastIndexOf(closeTag);
  return openings.map((m, i) => {
    const start = m.index! + m[0].length;
    const end = i + 1 < openings.length ? openings[i + 1]!.index! : bodyEnd;
    // Drop the closing </g> of this page group (the last one before `end`).
    let inner = raw.slice(start, end);
    inner = inner.slice(0, inner.lastIndexOf('</g>'));
    const width = Number(m[3]);
    const height = Number(m[4]);
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
      `viewBox="0 0 ${width} ${height}" width="${width}pt" height="${height}pt">` +
      `${shared}<g>${inner}</g></svg>`;
    return { svg: finish(svg), width, height };
  });
}

function finish(svg: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n${inlineSvgImages(stripInteractive(fixGlyphFills(svg)))}`;
}

function decodeBase64(b64: string): string {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/** Removes anything executable from an embedded SVG before it is inlined. */
function sanitize(svg: string): string {
  return svg
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<foreignObject\b[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*')/gi, '')
    .replace(/<\?xml[^>]*\?>/g, '')
    .replace(/<!DOCTYPE[^>]*>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');
}

/**
 * Typst embeds SVG icons as `<image href="data:image/svg+xml;base64,…">`. Rasterizers re-parse every such image
 * (slow: ~65 ms each in resvg) and some editors cannot edit them, so we inline each one as a nested <svg>, prefixing
 * its ids so that several copies of the same icon cannot collide.
 */
export function inlineSvgImages(svg: string): string {
  let n = 0;
  return svg.replace(
    /<image\b([^>]*?)(?:xlink:)?href="data:image\/svg\+xml;base64,([^"]+)"([^>]*)\/>/g,
    (whole, before: string, b64: string, after: string) => {
      let inner: string;
      try {
        inner = sanitize(decodeBase64(b64));
      } catch {
        return whole;
      }
      const root = /<svg\b([^>]*)>([\s\S]*)<\/svg>\s*$/.exec(inner.trim());
      if (!root) return whole;
      const attrs = `${before} ${after}`;
      const get = (name: string, src: string) => new RegExp(`\\s${name}="([^"]*)"`).exec(src)?.[1];
      const prefix = `i${n++}-`;
      const body = root[2]!
        .replace(/\sid="([^"]+)"/g, ` id="${prefix}$1"`)
        .replace(/url\(#([^)]+)\)/g, `url(#${prefix}$1)`)
        .replace(/(\s(?:xlink:)?href)="#([^"]+)"/g, `$1="#${prefix}$2"`);
      const viewBox = get('viewBox', root[1]!);
      // Presentation attributes on the icon's root (fill, stroke, …) move to a wrapping group.
      const inherited = root[1]!
        .replace(/\s(?:xmlns(?::\w+)?|viewBox|width|height|x|y|version|id)="[^"]*"/g, '')
        .trim();
      const out = [
        '<svg',
        ...['x', 'y', 'width', 'height', 'preserveAspectRatio', 'transform']
          .map((a) => [a, get(a, attrs)] as const)
          .filter(([, val]) => val !== undefined)
          .map(([a, val]) => ` ${a}="${val}"`),
        viewBox ? ` viewBox="${viewBox}"` : '',
        ` overflow="hidden">`,
        inherited ? `<g ${inherited}>${body}</g>` : body,
        '</svg>',
      ];
      return out.join('');
    },
  );
}
