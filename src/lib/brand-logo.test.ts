import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { NAV_ITEMS, SURVEY_CTA } from './site';

// Issue #74: the authentic BMSL logo (docs/brand/logo.md) replaces the placeholder building icon. These checks pin the
// shipped bytes and the shared header/footer source; they do not (and cannot) prove how the page looks.
const ROOT = path.resolve(import.meta.dirname, '../..');
const read = (rel: string) => readFileSync(path.join(ROOT, rel));

/** Width/height from the first JPEG start-of-frame marker (no image library needed). */
function jpegSize(buf: Buffer): { width: number; height: number } {
  expect([buf[0], buf[1], buf[2]]).toEqual([0xff, 0xd8, 0xff]);
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) throw new Error('corrupt JPEG marker stream');
    const marker = buf[i + 1];
    const len = buf.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    i += 2 + len;
  }
  throw new Error('no JPEG SOF marker');
}

const sha256 = (buf: Buffer) => createHash('sha256').update(buf).digest('hex');

describe('BMSL logo assets (Issue #74)', () => {
  it('ships the bounded, aspect-preserving logo derived from the legacy header image', () => {
    const buf = read('src/assets/brand/bmsl-logo.jpg');
    expect(sha256(buf)).toBe('320882307b7342f0f21f78acd4946c5632183729b026283650c655422141e5d7');
    expect(jpegSize(buf)).toEqual({ width: 640, height: 508 });
    expect(buf.length).toBeLessThan(100 * 1024);
  });

  it('uses the original WordPress favicon and apple-touch icon files unchanged', () => {
    const icon = read('src/app/(frontend)/icon.jpg');
    const apple = read('src/app/(frontend)/apple-icon.jpg');
    expect(sha256(icon)).toBe('8febbd5311ba47cd66ad0c7426a934838addb8865e743453775568c181f414c1');
    expect(jpegSize(icon)).toEqual({ width: 192, height: 192 });
    expect(sha256(apple)).toBe('73f6806d1174f8c16118c3ccbac5c083495863e7c2d54b4c4578949736924e2f');
    expect(jpegSize(apple)).toEqual({ width: 180, height: 180 });
  });

  it('is not stored under public/ (the production image copies src only)', () => {
    expect(() => statSync(path.join(ROOT, 'public'))).toThrow();
  });
});

describe('shared header and footer use the logo', () => {
  const shell = read('src/components/SiteShell.tsx').toString('utf8');

  it('imports the local asset, renders it in header and footer, and has no placeholder badge or remote logo URL', () => {
    expect(shell).toContain("from '../assets/brand/bmsl-logo.jpg'");
    expect(shell).toContain('<BrandLogo priority />');
    expect(shell).toContain('className="footer-logo"');
    expect(shell).not.toMatch(/wordmark/);
    expect(shell).not.toContain('<svg width="16" height="16"');
    expect(shell).not.toMatch(/binhminhsonglo\.vn|wp-content/);
  });

  it('gives the logo an accessible name that identifies BMSL', () => {
    expect(shell).toMatch(/LOGO_ALT = `\$\{SITE_NAME\} — Bình Minh Sông Lô`/);
    expect(shell).toContain('alt={LOGO_ALT}');
  });

  it('keeps the 8 navigation destinations and the survey CTA', () => {
    expect(NAV_ITEMS.map((i) => i.href)).toEqual([
      '/',
      '/gioi-thieu',
      '/dich-vu',
      '/du-an',
      '/quy-trinh-minh-bach',
      '/kien-thuc',
      '/tuyen-dung',
      '/lien-he',
    ]);
    expect(SURVEY_CTA.href).toBe('/lien-he?requestType=khao-sat');
    expect(shell).toContain('<Nav label="Điều hướng chính" />');
    expect(shell).toContain('<Nav label="Điều hướng chân trang" />');
    expect(shell).toContain('className="skip-link"');
  });
});
