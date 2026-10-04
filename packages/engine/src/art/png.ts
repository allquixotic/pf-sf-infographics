/**
 * Drops metadata chunks (text, XMP, EXIF, …) from PNG files. Some official portraits carry megabytes of editor
 * history in iTXt chunks, which bloats every output and makes resvg refuse to decode them.
 */

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

/** Chunks needed to draw the image correctly; everything else is discarded. */
const KEEP = new Set([
  'IHDR',
  'PLTE',
  'tRNS',
  'IDAT',
  'IEND',
  'gAMA',
  'cHRM',
  'sRGB',
  'iCCP',
  'sBIT',
  'pHYs',
]);

export function isPng(bytes: Uint8Array): boolean {
  return PNG_SIGNATURE.every((b, i) => bytes[i] === b);
}

export function stripPngMetadata(bytes: Uint8Array): Uint8Array {
  if (!isPng(bytes)) return bytes;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const parts: Uint8Array[] = [bytes.subarray(0, 8)];
  let removed = false;
  let pos = 8;
  while (pos + 12 <= bytes.length) {
    const length = view.getUint32(pos);
    const end = pos + 12 + length;
    if (end > bytes.length) return bytes; // Truncated file: leave it alone.
    const type = String.fromCharCode(bytes[pos + 4]!, bytes[pos + 5]!, bytes[pos + 6]!, bytes[pos + 7]!);
    if (KEEP.has(type)) parts.push(bytes.subarray(pos, end));
    else removed = true;
    pos = end;
    if (type === 'IEND') break;
  }
  if (!removed) return bytes;
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}
