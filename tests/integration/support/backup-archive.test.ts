import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  encodeArchive,
  extractArchive,
  listRegularFiles,
  readArchiveIndex,
  validateEntryPath,
  verifyArchive,
  writeArchive,
} from '../../../scripts/backup/archive.mjs';

// Pure (no database): the BMSL archive format used for source and media in a backup bundle. Negative tests craft
// hostile archives byte by byte, because the writer itself refuses to produce them.

let tmp: string;
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bmsl-archive-'));
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');
const craft = (files: { path: string; data: string; type?: string }[], name = 'hostile.bmslarc') => {
  const payload = Buffer.concat(files.map((f) => Buffer.from(f.data)));
  const entries = files.map((f) => ({ type: f.type ?? 'file', path: f.path, size: Buffer.byteLength(f.data), sha256: sha(Buffer.from(f.data)) }));
  const file = path.join(tmp, name);
  fs.writeFileSync(file, encodeArchive({ version: 1, entries }, payload));
  return file;
};
const tree = (root: string) => {
  const out: Record<string, string> = {};
  const walk = (d: string) => {
    for (const n of fs.readdirSync(d)) {
      const f = path.join(d, n);
      if (fs.statSync(f).isDirectory()) walk(f);
      else out[path.relative(root, f)] = sha(fs.readFileSync(f));
    }
  };
  walk(root);
  return out;
};

describe('archive round trip', () => {
  it('writes, verifies and extracts regular files byte for byte with private modes', () => {
    const src = path.join(tmp, 'src');
    fs.mkdirSync(path.join(src, 'nested'), { recursive: true });
    fs.writeFileSync(path.join(src, 'a.png'), Buffer.from([1, 2, 3, 4]));
    fs.writeFileSync(path.join(src, 'nested', 'b.pdf'), 'synthetic');
    fs.writeFileSync(path.join(src, 'empty.bin'), '');
    const archive = path.join(tmp, 'media.bmslarc');
    const written = writeArchive(archive, listRegularFiles(src));
    expect(written.fileCount).toBe(3);
    expect(fs.statSync(archive).mode & 0o077).toBe(0);
    expect(verifyArchive(archive).treeHash).toBe(written.treeHash);
    const dest = path.join(tmp, 'restored');
    const extracted = extractArchive(archive, dest);
    expect(extracted.treeHash).toBe(written.treeHash);
    expect(tree(dest)).toEqual(tree(src));
    expect(fs.statSync(path.join(dest, 'a.png')).mode & 0o077).toBe(0);
  });
});

describe('entry path rules', () => {
  it.each([
    '/etc/passwd',
    '//server/share/x',
    '\\\\server\\share\\x',
    'C:\\Windows\\x',
    'C:/Windows/x',
    'c:x',
    '../outside',
    'a/../../outside',
    'a/..',
    '..',
    './a',
    'a/./b',
    'a//b',
    'a/',
    '',
    'a\\b',
    'a\0b',
    'a/b\nc',
  ])('rejects %j', (p) => {
    expect(() => validateEntryPath(p)).toThrow();
  });

  it('accepts ordinary nested relative paths', () => {
    expect(() => validateEntryPath('uploads/2026/ảnh-dự-án.png')).not.toThrow();
  });
});

describe('hostile or damaged archives are rejected before anything is written', () => {
  const hostilePaths = ['/abs/file', 'C:\\x', 'C:/x', '\\\\srv\\share\\x', '../escape', 'ok/../../escape', 'a\\b'];

  it.each(hostilePaths)('refuses entry path %j on verify and extract', (p) => {
    const archive = craft([{ path: p, data: 'x' }]);
    const dest = path.join(tmp, 'dest');
    expect(() => verifyArchive(archive)).toThrow();
    expect(() => extractArchive(archive, dest)).toThrow();
    expect(fs.existsSync(dest)).toBe(false);
    expect(fs.existsSync(path.join(tmp, 'escape'))).toBe(false);
  });

  it.each(['symlink', 'hardlink', 'directory', 'fifo', 'device'])('refuses an entry of type %s', (type) => {
    const archive = craft([{ path: 'link', data: '/etc/passwd', type }]);
    const dest = path.join(tmp, 'dest');
    expect(() => extractArchive(archive, dest)).toThrow(/not allowed/);
    expect(fs.existsSync(dest)).toBe(false);
  });

  it('refuses duplicate, case-colliding and file/directory-conflicting paths', () => {
    expect(() => verifyArchive(craft([{ path: 'a.png', data: '1' }, { path: 'a.png', data: '2' }]))).toThrow(/duplicate/);
    expect(() => verifyArchive(craft([{ path: 'a.png', data: '1' }, { path: 'A.PNG', data: '2' }]))).toThrow(/duplicate/);
    expect(() => verifyArchive(craft([{ path: 'a', data: '1' }, { path: 'a/b', data: '2' }]))).toThrow(/file and directory/);
  });

  it('refuses bad magic, truncation, padding and corrupted bytes', () => {
    const good = path.join(tmp, 'good.bmslarc');
    const src = path.join(tmp, 'src');
    fs.mkdirSync(src);
    fs.writeFileSync(path.join(src, 'a.txt'), 'abcdef');
    writeArchive(good, listRegularFiles(src));
    const bytes = fs.readFileSync(good);
    const variants: [string, Buffer][] = [
      ['magic', Buffer.concat([Buffer.from('NOTBMSL!'), bytes.subarray(8)])],
      ['truncated', bytes.subarray(0, bytes.length - 2)],
      ['padded', Buffer.concat([bytes, Buffer.from('zz')])],
      ['corrupt', Buffer.concat([bytes.subarray(0, bytes.length - 1), Buffer.from('X')])],
      ['tiny', Buffer.from('BMSL')],
    ];
    for (const [name, data] of variants) {
      const bad = path.join(tmp, `${name}.bmslarc`);
      fs.writeFileSync(bad, data);
      const dest = path.join(tmp, `dest-${name}`);
      expect(() => extractArchive(bad, dest), name).toThrow();
      expect(fs.existsSync(dest), name).toBe(false);
    }
  });

  it('refuses an index that lies about the payload length', () => {
    const file = path.join(tmp, 'lie.bmslarc');
    fs.writeFileSync(file, encodeArchive({ version: 1, entries: [{ type: 'file', path: 'a', size: 1000, sha256: sha(Buffer.from('a')) }] }, Buffer.from('a')));
    expect(() => readArchiveIndex(file)).toThrow(/length/);
  });
});

describe('extraction destination', () => {
  const archiveWith = (files: Record<string, string>) => {
    const src = path.join(tmp, 'src');
    fs.mkdirSync(src, { recursive: true });
    for (const [n, d] of Object.entries(files)) fs.writeFileSync(path.join(src, n), d);
    const archive = path.join(tmp, 'a.bmslarc');
    writeArchive(archive, listRegularFiles(src));
    return archive;
  };

  it('refuses a pre-existing destination and leaves it untouched', () => {
    const archive = archiveWith({ 'a.txt': 'new' });
    const dest = path.join(tmp, 'exists');
    fs.mkdirSync(dest);
    fs.writeFileSync(path.join(dest, 'a.txt'), 'precious');
    expect(() => extractArchive(archive, dest)).toThrow(/already exists/);
    expect(fs.readFileSync(path.join(dest, 'a.txt'), 'utf8')).toBe('precious');
  });

  it('refuses a destination that is a symbolic link (also a dangling one) and never writes through it', () => {
    const archive = archiveWith({ 'a.txt': 'new' });
    const outside = path.join(tmp, 'outside');
    fs.mkdirSync(outside);
    const live = path.join(tmp, 'live-link');
    fs.symlinkSync(outside, live);
    const dangling = path.join(tmp, 'dangling-link');
    fs.symlinkSync(path.join(tmp, 'nowhere'), dangling);
    expect(() => extractArchive(archive, live)).toThrow(/already exists/);
    expect(() => extractArchive(archive, dangling)).toThrow(/already exists/);
    expect(fs.readdirSync(outside)).toEqual([]);
    expect(fs.existsSync(path.join(tmp, 'nowhere'))).toBe(false);
  });

  it('requires an existing parent and does not create it', () => {
    const archive = archiveWith({ 'a.txt': 'x' });
    expect(() => extractArchive(archive, path.join(tmp, 'missing-parent', 'dest'))).toThrow(/parent/);
    expect(fs.existsSync(path.join(tmp, 'missing-parent'))).toBe(false);
  });

  it('removes only its own partial output when a write fails part-way, leaving siblings alone', () => {
    const archive = archiveWith({ 'a.txt': '1', 'b.txt': '2', 'c.txt': '3' });
    const sibling = path.join(tmp, 'sibling.txt');
    fs.writeFileSync(sibling, 'keep');
    const dest = path.join(tmp, 'dest');
    let writes = 0;
    expect(() =>
      extractArchive(archive, dest, {
        beforeWrite: () => {
          writes += 1;
          if (writes === 2) throw new Error('simulated disk failure');
        },
      }),
    ).toThrow(/simulated disk failure/);
    expect(fs.existsSync(dest)).toBe(false);
    expect(fs.readFileSync(sibling, 'utf8')).toBe('keep');
    expect(fs.existsSync(archive)).toBe(true);
    expect(fs.readFileSync(path.join(tmp, 'src', 'a.txt'), 'utf8')).toBe('1');
  });
});

describe('listing the media directory', () => {
  it('refuses symbolic links, hardlinks and non-regular files instead of following or skipping them', () => {
    const src = path.join(tmp, 'src');
    fs.mkdirSync(src);
    fs.writeFileSync(path.join(src, 'real.txt'), 'x');
    fs.symlinkSync('/etc/passwd', path.join(src, 'link.txt'));
    expect(() => listRegularFiles(src)).toThrow(/symbolic link/);
    fs.rmSync(path.join(src, 'link.txt'));
    fs.linkSync(path.join(src, 'real.txt'), path.join(src, 'hard.txt'));
    expect(() => listRegularFiles(src)).toThrow(/hardlinked/);
  });

  it('detects a file that changed between hashing and copying', () => {
    const src = path.join(tmp, 'src');
    fs.mkdirSync(src);
    fs.writeFileSync(path.join(src, 'a.txt'), 'before');
    const files = listRegularFiles(src);
    fs.writeFileSync(path.join(src, 'a.txt'), 'AFTER!!!'); // size differs: caught at open
    expect(() => writeArchive(path.join(tmp, 'x.bmslarc'), files)).toThrow(/changed/);
  });
});
