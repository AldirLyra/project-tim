import { readFile } from 'node:fs/promises';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

export async function readPdf(file) {
  const document = await getDocument({ data: new Uint8Array(await readFile(file)), useSystemFonts: true }).promise;
  try {
    const pages = [];
    for (let i = 1; i <= document.numPages; i++) {
      const page = await document.getPage(i);
      const content = await page.getTextContent();
      pages.push(content.items.map(item => item.str + (item.hasEOL ? '\n' : ' ')).join(''));
    }
    return pages.join('\n');
  } finally { await document.destroy(); }
}
