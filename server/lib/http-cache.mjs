import crypto from 'node:crypto';

/** ETag lemah dari potongan stabil. BigInt dan Date ikut. */
export function weakEtag(parts) {
  const raw = (Array.isArray(parts) ? parts : [parts]).map((part) => {
    if (part == null) return '';
    if (part instanceof Date) return String(part.getTime());
    if (typeof part === 'bigint') return part.toString();
    return String(part);
  }).join('|');
  const hex = crypto.createHash('sha1').update(raw).digest('hex').slice(0, 16);
  return `W/"${hex}"`;
}

export function clientHasEtag(req, etag) {
  const inm = req?.headers?.['if-none-match'];
  if (!inm || !etag) return false;
  return String(inm).split(',').some((part) => {
    const tag = part.trim();
    return tag === '*' || tag === etag || tag === etag.replace(/^W\//, '') || `W/${tag.replace(/^W\//, '')}` === etag;
  });
}

/**
 * Pasang ETag. Jika klien sudah memegang salinan yang sama, jawab 304
 * tanpa body. Mengembalikan true bila respons sudah selesai.
 */
export function finishIfMatch(req, res, etag) {
  if (!etag) return false;
  res.setHeader('ETag', etag);
  res.setHeader('Cache-Control', 'private, no-cache');
  if (!clientHasEtag(req, etag)) return false;
  res.status(304).end();
  return true;
}
