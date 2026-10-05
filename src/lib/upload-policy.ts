// Upload policy for media-assets (W5B2). Payload sniffs the content type and, when it cannot, trusts the declared one,
// so metadata and bytes are checked here together and must agree: an approved extension, the declared MIME type that
// belongs to it, and the matching file signature. SVG, HTML, scripts and any extension/MIME/bytes mismatch are
// refused, so nothing executable can be stored and served from this origin under a harmless label.

type Kind = { mime: string; extensions: string[]; matches: (b: Buffer) => boolean };

const ascii = (b: Buffer, start: number, text: string) => b.subarray(start, start + text.length).toString('latin1') === text;

const KINDS: Kind[] = [
  { mime: 'image/png', extensions: ['png'], matches: (b) => b.subarray(0, 8).toString('hex') === '89504e470d0a1a0a' },
  { mime: 'image/jpeg', extensions: ['jpg', 'jpeg'], matches: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: 'image/gif', extensions: ['gif'], matches: (b) => ascii(b, 0, 'GIF87a') || ascii(b, 0, 'GIF89a') },
  { mime: 'image/webp', extensions: ['webp'], matches: (b) => ascii(b, 0, 'RIFF') && ascii(b, 8, 'WEBP') },
  { mime: 'image/avif', extensions: ['avif'], matches: (b) => ascii(b, 4, 'ftyp') && (ascii(b, 8, 'avif') || ascii(b, 8, 'avis')) },
  { mime: 'application/pdf', extensions: ['pdf'], matches: (b) => ascii(b, 0, '%PDF-') },
];

export const ALLOWED_UPLOAD_MIME_TYPES = KINDS.map((k) => k.mime);

/** Returns why the upload must be refused, or undefined when name, declared type and bytes agree on an approved kind. */
export function uploadProblem(name: unknown, mimetype: unknown, data: unknown): string | undefined {
  if (typeof name !== 'string' || typeof mimetype !== 'string') return 'Thiếu tên tệp hoặc loại tệp.';
  const parts = name.toLowerCase().split('.');
  const extension = parts.length > 1 ? parts[parts.length - 1] : '';
  const kind = KINDS.find((k) => k.extensions.includes(extension));
  if (!kind) return `Phần mở rộng tệp không được phép: .${extension}`;
  if (parts.length > 2 && parts.slice(1, -1).some((p) => ['html', 'htm', 'svg', 'js', 'mjs', 'xml', 'php'].includes(p))) {
    return 'Tên tệp có phần mở rộng kép không được phép.';
  }
  if (mimetype.toLowerCase().split(';')[0]!.trim() !== kind.mime) return 'Loại tệp khai báo không khớp phần mở rộng.';
  if (!Buffer.isBuffer(data) || !kind.matches(data)) return 'Nội dung tệp không khớp loại tệp khai báo.';
  return undefined;
}
