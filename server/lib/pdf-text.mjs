import { extractText, getDocumentProxy } from 'unpdf';

/** Teks gabungan dari PDF (semua halaman). */
export async function extractPdfText(buffer) {
  const bytes = buffer instanceof Uint8Array && !Buffer.isBuffer(buffer) ? buffer : new Uint8Array(buffer);
  const pdf = await getDocumentProxy(bytes);
  const res = await extractText(pdf, { mergePages: true });
  const text = Array.isArray(res?.text) ? res.text.join('\n') : String(res?.text || '');
  return text.replace(/\u0000/g, '').trim();
}

export function decodeTextFile(buffer) {
  return Buffer.from(buffer).toString('utf8').replace(/^\uFEFF/, '').trim();
}
