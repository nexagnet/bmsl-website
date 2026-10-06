import { describe, expect, it } from 'vitest';
import { MEDIA_KEY_FIELD, type LexicalDoc } from './lexical';
import { formatSeedReport, loadPack, resolveBody, type SeedReport } from './loader';

// Offline checks of the loader's pure parts (database behaviour is proven in tests/integration/legacy-seed.test.ts).
const body = (...children: unknown[]): LexicalDoc => ({
  root: { type: 'root', format: '', indent: 0, version: 1, direction: 'ltr', children: children as never },
});
const upload = (key: string) => ({ type: 'upload', relationTo: 'media-assets', value: { [MEDIA_KEY_FIELD]: key }, fields: null });

describe('resolveBody', () => {
  it('replaces every media key with the real id, keeps everything else, and does not touch its input', () => {
    const input = body({ type: 'paragraph', children: [{ type: 'text', text: 'a' }] }, upload('sha256:a'), upload('sha256:b'));
    const snapshot = JSON.stringify(input);
    const out = resolveBody(
      input,
      new Map<string, number | string>([
        ['sha256:a', 7],
        ['sha256:b', 'x9'],
      ]),
    );
    expect(out.root.children.map((n) => n.value ?? n.type)).toEqual(['paragraph', 7, 'x9']);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it('refuses a body that references media which was not loaded', () => {
    expect(() => resolveBody(body(upload('sha256:missing')), new Map())).toThrow(/not loaded/);
  });
});

describe('loadPack', () => {
  it('fails closed when the pack directory is missing or has no valid pack', () => {
    expect(() => loadPack('C:/definitely/not/a/pack')).toThrow(/could not be read/);
  });
});

describe('formatSeedReport', () => {
  const base: SeedReport = {
    mode: 'dry-run',
    pack: { id: 'bmsl-legacy', version: 1, observedAt: '2026-10-06', source: 'https://binhminhsonglo.vn' },
    created: [{ collection: 'projects', key: 'projects/a' }],
    skipped: [],
    conflicts: [{ collection: 'projects', key: 'projects/b', slug: 'b', reason: 'slug taken' }],
    media: { created: 3, existing: 1 },
    pendingImages: { total: 2, byClass: { PERSON: 2 } },
    notSeeded: [],
  };

  it('says nothing was written in a dry-run and lists conflicts without echoing content', () => {
    const text = formatSeedReport(base);
    expect(text).toContain('(dry-run)');
    expect(text).toContain('Dry-run: nothing was written');
    expect(text).toContain('CONFLICT projects/b: slug taken');
    expect(text).toContain('3 would be created');
    expect(text).toContain('PERSON=2');
  });

  it('reports created media as created in write mode', () => {
    const text = formatSeedReport({ ...base, mode: 'write' });
    expect(text).toContain('3 created');
    expect(text).not.toContain('Dry-run');
  });
});
