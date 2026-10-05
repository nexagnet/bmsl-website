import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { MEDIA_DIR_ENV, resolveMediaDir } from './media-dir';

const fallback = path.resolve('/srv/app/media');

describe('resolveMediaDir', () => {
  it('uses the default when unset or blank', () => {
    expect(resolveMediaDir({}, fallback)).toBe(fallback);
    expect(resolveMediaDir({ [MEDIA_DIR_ENV]: '   ' }, fallback)).toBe(fallback);
  });

  it('uses an absolute override', () => {
    const dir = path.resolve('/mnt/media-volume/bmsl');
    expect(resolveMediaDir({ [MEDIA_DIR_ENV]: dir }, fallback)).toBe(dir);
  });

  it('refuses a relative override', () => {
    expect(() => resolveMediaDir({ [MEDIA_DIR_ENV]: 'media' }, fallback)).toThrow(/absolute/);
    expect(() => resolveMediaDir({ [MEDIA_DIR_ENV]: '../media' }, fallback)).toThrow(/absolute/);
  });
});
