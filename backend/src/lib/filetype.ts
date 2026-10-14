export type DetectedType = { mime: 'image/jpeg' | 'image/png' | 'image/webp' | 'video/mp4' | 'video/quicktime'; ext: string; kind: 'IMAGE' | 'VIDEO' };

/** Validate by magic bytes, never by client-declared MIME type or filename. */
export function detectMediaType(buf: Buffer): DetectedType | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg', kind: 'IMAGE' };
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return { mime: 'image/png', ext: 'png', kind: 'IMAGE' };
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP')
    return { mime: 'image/webp', ext: 'webp', kind: 'IMAGE' };
  if (buf.subarray(4, 8).toString('ascii') === 'ftyp') {
    const brand = buf.subarray(8, 12).toString('ascii');
    if (brand === 'qt  ') return { mime: 'video/quicktime', ext: 'mov', kind: 'VIDEO' };
    return { mime: 'video/mp4', ext: 'mp4', kind: 'VIDEO' };
  }
  return null;
}
