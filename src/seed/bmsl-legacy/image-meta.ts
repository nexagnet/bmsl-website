// Image facts read from the BYTES (never from names or headers declared by a server): the real container type and
// the pixel size. Only the two raster formats present in the legacy corpus are understood; anything else is refused.

export type ImageFacts = { mime: 'image/jpeg' | 'image/png'; width: number; height: number };

const PNG_SIGNATURE = '89504e470d0a1a0a';

export function sniffImage(bytes: Buffer): ImageFacts | undefined {
  if (bytes.length >= 24 && bytes.subarray(0, 8).toString('hex') === PNG_SIGNATURE && bytes.subarray(12, 16).toString('latin1') === 'IHDR') {
    return { mime: 'image/png', width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    let i = 2;
    while (i + 9 < bytes.length) {
      if (bytes[i] !== 0xff) return undefined;
      const marker = bytes[i + 1]!;
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        i += 2;
        continue;
      }
      const length = bytes.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { mime: 'image/jpeg', height: bytes.readUInt16BE(i + 5), width: bytes.readUInt16BE(i + 7) };
      }
      i += 2 + length;
    }
  }
  return undefined;
}
