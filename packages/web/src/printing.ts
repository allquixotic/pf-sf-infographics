import type { OutFile } from './engine/protocol';

/** Print vector pages at their rendered physical size, without downloading a file or printing app controls. */
export async function printPages(files: OutFile[]): Promise<void> {
  if (!files.length) throw new Error('There are no pages to print.');
  if (files.some((f) => !f.width || !f.height || f.mime !== 'image/svg+xml'))
    throw new Error('The rendered print pages have invalid dimensions.');
  const previous = document.getElementById('infographic-print');
  previous?.dispatchEvent(new Event('dispose'));
  const frame = document.createElement('iframe');
  frame.id = 'infographic-print';
  frame.title = 'Printable class infographic';
  frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:800px;height:600px;border:0';
  const urls = files.map((f) => URL.createObjectURL(new Blob([f.data], { type: f.mime })));
  const dispose = () => {
    for (const url of urls) URL.revokeObjectURL(url);
    frame.remove();
  };
  frame.addEventListener('dispose', dispose, { once: true });
  document.body.append(frame);
  try {
    const doc = frame.contentDocument!;
    const win = frame.contentWindow!;
    doc.open();
    doc.write('<!doctype html><html><head><title>Class Infographics</title></head><body></body></html>');
    doc.close();
    const style = doc.createElement('style');
    style.textContent = `
      @page { size: ${files[0]!.width}pt ${files[0]!.height}pt; margin: 0; }
      html, body { margin: 0; padding: 0; }
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      .page { margin: 0; padding: 0; break-inside: avoid; break-after: page; overflow: hidden; }
      .page:last-child { break-after: auto; }
      img { display: block; width: 100%; height: 100%; }
      ${files
        .map(
          (f, i) => `@page sheet${i} { size: ${f.width}pt ${f.height}pt; margin: 0; }
        .sheet${i} { page: sheet${i}; width: ${f.width}pt; height: ${f.height}pt; }`,
        )
        .join('\n')}
    `;
    doc.head.append(style);
    await Promise.all(
      files.map(async (_f, i) => {
        const sheet = doc.createElement('div');
        sheet.className = `page sheet${i}`;
        const img = doc.createElement('img');
        img.alt = `Infographic page ${i + 1}`;
        img.src = urls[i]!;
        sheet.append(img);
        doc.body.append(sheet);
        await img.decode();
      }),
    );
    // Some browsers fire afterprint before their dialog has finished using the document.
    // Keep this one frame until the next print or navigation; replacing it revokes every URL.
    win.focus();
    win.print();
  } catch (error) {
    dispose();
    throw error;
  }
}
