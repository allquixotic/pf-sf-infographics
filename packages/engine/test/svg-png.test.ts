import { describe, expect, test } from 'bun:test';
import { stripPngMetadata } from '../src/art/png';
import { inlineSvgImages, splitSvgPages } from '../src/render/svg';

const b64 = (s: string) => Buffer.from(s).toString('base64');

describe('inlineSvgImages', () => {
  const icon =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#123456"><mask id="cut"><rect/></mask><circle mask="url(#cut)" onclick="evil()"/><script>alert(1)</script></svg>';
  const doc = `<svg><image width="10" height="10" xlink:href="data:image/svg+xml;base64,${b64(icon)}"/><image width="5" height="5" xlink:href="data:image/svg+xml;base64,${b64(icon)}"/></svg>`;
  const out = inlineSvgImages(doc);

  test('replaces image elements with nested svg', () => {
    expect(out).not.toContain('<image');
    expect(out).toContain('viewBox="0 0 24 24"');
    expect(out).toContain('width="10"');
  });

  test('prefixes ids per instance', () => {
    expect(out).toContain('id="i0-cut"');
    expect(out).toContain('id="i1-cut"');
    expect(out).toContain('url(#i1-cut)');
  });

  test('keeps root presentation attributes and strips scripts and handlers', () => {
    expect(out).toContain('fill="#123456"');
    expect(out).not.toContain('<script');
    expect(out).not.toContain('onclick');
  });

  test('leaves raster images alone', () => {
    const png = '<svg><image width="1" height="1" xlink:href="data:image/png;base64,AAAA"/></svg>';
    expect(inlineSvgImages(png)).toBe(png);
  });
});

describe('splitSvgPages', () => {
  test('splits typst.ts output into pages', () => {
    const raw =
      '<svg class="typst-doc" viewBox="0 0 10 30" width="10" height="30"><defs><path id="g"/></defs>' +
      '<g class="typst-page" transform="translate(0, 0)" data-tid="a" data-page-width="10" data-page-height="10"><use href="#g"/></g>' +
      '<g class="typst-page" transform="translate(0, 10)" data-tid="b" data-page-width="10" data-page-height="20"><rect/></g></svg>';
    const pages = splitSvgPages(raw);
    expect(pages).toHaveLength(2);
    expect(pages[1]!.height).toBe(20);
    expect(pages[0]!.svg).toContain('<path id="g"/>');
    expect(pages[1]!.svg).toContain('<rect/>');
    expect(pages[1]!.svg).not.toContain('class=');
  });
});

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  new DataView(out.buffer).setUint32(0, data.length);
  out.set(new TextEncoder().encode(type), 4);
  out.set(data, 8);
  return out; // CRC left as zero; the stripper does not validate it.
}

describe('stripPngMetadata', () => {
  test('drops text chunks and keeps image chunks', () => {
    const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    const parts = [
      sig,
      chunk('IHDR', new Uint8Array(13)),
      chunk('iTXt', new Uint8Array(1000)),
      chunk('IDAT', new Uint8Array(5)),
      chunk('IEND', new Uint8Array()),
    ];
    const png = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let o = 0;
    for (const p of parts) {
      png.set(p, o);
      o += p.length;
    }
    const out = stripPngMetadata(png);
    expect(out.length).toBe(png.length - 1012);
    expect(new TextDecoder().decode(out)).not.toContain('iTXt');
  });

  test('ignores non-PNG data', () => {
    const jpg = new Uint8Array([0xff, 0xd8, 0xff]);
    expect(stripPngMetadata(jpg)).toBe(jpg);
  });
});
