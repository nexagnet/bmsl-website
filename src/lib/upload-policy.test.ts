import { describe, expect, it } from 'vitest';
import { uploadProblem } from './upload-policy';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const pdf = Buffer.from('%PDF-1.4\n%%EOF\n', 'latin1');
const html = Buffer.from('<!doctype html><script>alert(1)</script>');
const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

describe('upload policy (name, declared type and bytes must agree)', () => {
  it('accepts real PNG and PDF and the other approved kinds', () => {
    expect(uploadProblem('a.png', 'image/png', png)).toBeUndefined();
    expect(uploadProblem('A.PDF', 'application/pdf', pdf)).toBeUndefined();
    expect(uploadProblem('a.jpg', 'image/jpeg', Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0]))).toBeUndefined();
    expect(uploadProblem('a.gif', 'image/gif', Buffer.from('GIF89a....'))).toBeUndefined();
    expect(uploadProblem('a.webp', 'image/webp', Buffer.from('RIFF\0\0\0\0WEBPVP8 '))).toBeUndefined();
    expect(uploadProblem('a.avif', 'image/avif', Buffer.from('\0\0\0\x1cftypavif....'))).toBeUndefined();
  });

  it('rejects SVG, HTML and scripts by extension, type or bytes', () => {
    expect(uploadProblem('e.svg', 'image/svg+xml', svg)).toBeDefined();
    expect(uploadProblem('e.png', 'image/png', svg)).toBeDefined();
    expect(uploadProblem('e.png', 'image/png', html)).toBeDefined();
    expect(uploadProblem('e.jpg', 'image/jpeg', html)).toBeDefined();
    expect(uploadProblem('e.html', 'text/html', html)).toBeDefined();
    expect(uploadProblem('e.js', 'application/javascript', Buffer.from('alert(1)'))).toBeDefined();
    expect(uploadProblem('fake.pdf', 'application/pdf', html)).toBeDefined();
  });

  it('rejects valid raster bytes labelled with an active extension or a mismatching type, and double extensions', () => {
    expect(uploadProblem('p.html', 'text/html', png)).toBeDefined();
    expect(uploadProblem('p.html', 'image/png', png)).toBeDefined();
    expect(uploadProblem('p.png', 'text/html', png)).toBeDefined();
    expect(uploadProblem('p.png', 'application/pdf', png)).toBeDefined();
    expect(uploadProblem('p.html.png', 'image/png', png)).toBeDefined();
    expect(uploadProblem('noext', 'image/png', png)).toBeDefined();
    expect(uploadProblem(undefined, 'image/png', png)).toBeDefined();
    expect(uploadProblem('p.png', 'image/png', undefined)).toBeDefined();
  });
});
