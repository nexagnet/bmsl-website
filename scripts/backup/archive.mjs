// BMSL archive format ("BMSLARC1"), the only container used for source and media inside a backup bundle.
//
// Why not tar/zip: extracting those means trusting an external parser with absolute paths, `..`, symlinks and
// hardlinks. This format cannot even REPRESENT a link: it holds regular files only, every path is validated by
// `validateEntryPath` on write AND on read, and extraction writes with O_EXCL into a directory this invocation just
// created. A hostile or corrupt archive is rejected before anything is written.
//
// Layout: 8 bytes magic "BMSLARC1" | uint32 big-endian index length | index JSON (UTF-8) | file bytes, concatenated in
// index order. Index: { version: 1, entries: [{ type: 'file', path, size, sha256, exec? }] }. Paths are relative,
// '/'-separated, case-insensitively unique.
/* global process, Buffer */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const MAGIC = 'BMSLARC1';
export const MAX_INDEX_BYTES = 16 * 1024 * 1024;
export const MAX_ENTRIES = 100_000;
const CHUNK = 1024 * 1024;

export class ArchiveError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ArchiveError';
  }
}

/** Throws unless `p` is a safe relative archive path. Backslashes are refused outright (Windows separators/UNC). */
export function validateEntryPath(p) {
  if (typeof p !== 'string' || p.length === 0) throw new ArchiveError('entry path must be a non-empty string');
  if (p.length > 1024) throw new ArchiveError('entry path is too long');
  if (p.includes('\0')) throw new ArchiveError('entry path contains NUL');
  if (p.includes('\\')) throw new ArchiveError(`entry path uses a backslash: ${JSON.stringify(p)}`);
  if (p.startsWith('/')) throw new ArchiveError(`absolute or UNC entry path: ${JSON.stringify(p)}`);
  if (/^[A-Za-z]:/.test(p)) throw new ArchiveError(`drive-letter entry path: ${JSON.stringify(p)}`);
  for (const segment of p.split('/')) {
    if (segment === '' || segment === '.' || segment === '..') {
      throw new ArchiveError(`unsafe path segment in ${JSON.stringify(p)}`);
    }
    if (segment.length > 255) throw new ArchiveError('entry path segment is too long');
    if ([...segment].some((c) => c.charCodeAt(0) < 0x20 || c.charCodeAt(0) === 0x7f)) throw new ArchiveError('entry path contains a control character');
  }
}

/** Validates a parsed index object. Returns the entries. */
export function validateIndex(index) {
  if (!index || typeof index !== 'object' || index.version !== 1 || !Array.isArray(index.entries)) {
    throw new ArchiveError('unsupported archive index');
  }
  if (index.entries.length > MAX_ENTRIES) throw new ArchiveError('too many archive entries');
  const seen = new Set();
  const files = new Set();
  const dirs = new Set();
  for (const entry of index.entries) {
    if (!entry || typeof entry !== 'object') throw new ArchiveError('malformed archive entry');
    if (entry.type !== 'file') {
      throw new ArchiveError(`archive entry of type ${JSON.stringify(entry.type)} is not allowed (regular files only)`);
    }
    validateEntryPath(entry.path);
    if (!Number.isSafeInteger(entry.size) || entry.size < 0) throw new ArchiveError('invalid entry size');
    if (typeof entry.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(entry.sha256)) throw new ArchiveError('invalid entry digest');
    const key = entry.path.toLowerCase();
    if (seen.has(key)) throw new ArchiveError(`duplicate (case-insensitive) entry path ${JSON.stringify(entry.path)}`);
    seen.add(key);
    files.add(key);
    const parts = key.split('/');
    for (let i = 1; i < parts.length; i += 1) dirs.add(parts.slice(0, i).join('/'));
  }
  for (const d of dirs) if (files.has(d)) throw new ArchiveError(`entry path used both as file and directory: ${d}`);
  return index.entries;
}

/** Deterministic digest over the file list (path, size, sha256). */
export function treeHash(entries) {
  const h = createHash('sha256');
  for (const e of [...entries].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))) {
    h.update(`${e.path}\0${e.size}\0${e.sha256}\n`);
  }
  return h.digest('hex');
}

/** Builds raw archive bytes from an index object and payload (also used by the negative tests to craft hostile input). */
export function encodeArchive(index, payload) {
  const json = Buffer.from(JSON.stringify(index), 'utf8');
  const header = Buffer.alloc(12);
  header.write(MAGIC, 0, 'latin1');
  header.writeUInt32BE(json.length, 8);
  return Buffer.concat([header, json, payload]);
}

const sha256File = (fd, size) => {
  const hash = createHash('sha256');
  const buf = Buffer.allocUnsafe(Math.min(CHUNK, Math.max(size, 1)));
  let position = 0;
  while (position < size) {
    const n = fs.readSync(fd, buf, 0, Math.min(buf.length, size - position), position);
    if (n === 0) throw new ArchiveError('file shrank while it was being read');
    hash.update(buf.subarray(0, n));
    position += n;
  }
  return hash.digest('hex');
};

/**
 * Lists the regular files below `root` (relative posix paths). Symlinks, hardlinked files (nlink > 1), devices and any
 * other non-regular entry fail the whole listing: nothing is followed, nothing is silently skipped.
 */
export function listRegularFiles(root, { exclude = () => false } = {}) {
  const out = [];
  const walk = (dir, prefix) => {
    for (const name of fs.readdirSync(dir).sort()) {
      const rel = prefix ? `${prefix}/${name}` : name;
      if (exclude(rel)) continue;
      const full = path.join(dir, name);
      const st = fs.lstatSync(full);
      if (st.isSymbolicLink()) throw new ArchiveError(`refusing symbolic link: ${rel}`);
      if (st.isDirectory()) walk(full, rel);
      else if (st.isFile()) {
        if (st.nlink > 1) throw new ArchiveError(`refusing hardlinked file: ${rel}`);
        validateEntryPath(rel);
        out.push({ path: rel, full, size: st.size, ino: st.ino, dev: st.dev, exec: (st.mode & 0o111) !== 0 });
      } else throw new ArchiveError(`refusing non-regular file: ${rel}`);
    }
  };
  walk(root, '');
  return out;
}

const openRegular = (file) => {
  const fd = fs.openSync(file.full, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
  const st = fs.fstatSync(fd);
  if (!st.isFile() || st.ino !== file.ino || st.dev !== file.dev || st.size !== file.size) {
    fs.closeSync(fd);
    throw new ArchiveError(`${file.path} changed while it was being archived`);
  }
  return fd;
};

/** Hashes a set of listed files (first pass). Returns index entries. */
export function hashFiles(files) {
  return files.map((file) => {
    const fd = openRegular(file);
    try {
      return { type: 'file', path: file.path, size: file.size, sha256: sha256File(fd, file.size), exec: file.exec || undefined };
    } finally {
      fs.closeSync(fd);
    }
  });
}

/**
 * Writes an archive of `files` (from listRegularFiles) to `archivePath` (must not exist; created 0600). Every file is
 * re-hashed while it is copied; a file that changed between the index pass and the copy fails the write, which is
 * what makes a concurrent media write visible instead of silently inconsistent.
 */
export function writeArchive(archivePath, files) {
  const entries = hashFiles(files);
  validateIndex({ version: 1, entries });
  const json = Buffer.from(JSON.stringify({ version: 1, entries }), 'utf8');
  if (json.length > MAX_INDEX_BYTES) throw new ArchiveError('archive index is too large');
  const header = Buffer.alloc(12);
  header.write(MAGIC, 0, 'latin1');
  header.writeUInt32BE(json.length, 8);
  const out = fs.openSync(archivePath, 'wx', 0o600);
  try {
    fs.writeSync(out, header);
    fs.writeSync(out, json);
    files.forEach((file, i) => {
      const entry = entries[i];
      const fd = openRegular(file);
      try {
        const hash = createHash('sha256');
        const buf = Buffer.allocUnsafe(Math.min(CHUNK, Math.max(file.size, 1)));
        let position = 0;
        while (position < file.size) {
          const n = fs.readSync(fd, buf, 0, Math.min(buf.length, file.size - position), position);
          if (n === 0) throw new ArchiveError(`${file.path} shrank while it was being archived`);
          hash.update(buf.subarray(0, n));
          fs.writeSync(out, buf, 0, n);
          position += n;
        }
        if (hash.digest('hex') !== entry.sha256) throw new ArchiveError(`${file.path} changed while it was being archived`);
      } finally {
        fs.closeSync(fd);
      }
    });
  } finally {
    fs.closeSync(out);
  }
  return { entries, treeHash: treeHash(entries), fileCount: entries.length, bytes: fs.statSync(archivePath).size };
}

/** Parses and validates header + index, and checks the file length is exactly header + index + sum of sizes. */
export function readArchiveIndex(archivePath) {
  const fd = fs.openSync(archivePath, 'r');
  try {
    const total = fs.fstatSync(fd).size;
    const header = Buffer.alloc(12);
    if (total < 12 || fs.readSync(fd, header, 0, 12, 0) !== 12 || header.toString('latin1', 0, 8) !== MAGIC) {
      throw new ArchiveError('not a BMSL archive (bad magic)');
    }
    const indexLength = header.readUInt32BE(8);
    if (indexLength > MAX_INDEX_BYTES || 12 + indexLength > total) throw new ArchiveError('archive index length is invalid');
    const json = Buffer.alloc(indexLength);
    if (fs.readSync(fd, json, 0, indexLength, 12) !== indexLength) throw new ArchiveError('truncated archive index');
    let index;
    try {
      index = JSON.parse(json.toString('utf8'));
    } catch {
      throw new ArchiveError('archive index is not valid JSON');
    }
    const entries = validateIndex(index);
    const payloadBytes = entries.reduce((sum, e) => sum + e.size, 0);
    if (12 + indexLength + payloadBytes !== total) throw new ArchiveError('archive length does not match its index (truncated or padded)');
    return { entries, payloadOffset: 12 + indexLength };
  } finally {
    fs.closeSync(fd);
  }
}

/** Streams every entry through `onEntry(entry, readChunk)` after verifying its digest; throws on any mismatch. */
function* iterateVerified(archivePath) {
  const { entries, payloadOffset } = readArchiveIndex(archivePath);
  const fd = fs.openSync(archivePath, 'r');
  try {
    let offset = payloadOffset;
    for (const entry of entries) {
      yield { entry, offset, fd };
      offset += entry.size;
    }
  } finally {
    fs.closeSync(fd);
  }
}

const digestRange = (fd, offset, size) => {
  const hash = createHash('sha256');
  const buf = Buffer.allocUnsafe(Math.min(CHUNK, Math.max(size, 1)));
  let position = 0;
  while (position < size) {
    const n = fs.readSync(fd, buf, 0, Math.min(buf.length, size - position), offset + position);
    if (n === 0) throw new ArchiveError('truncated archive payload');
    hash.update(buf.subarray(0, n));
    position += n;
  }
  return hash.digest('hex');
};

/** Full integrity check: structure, then every file digest. Writes nothing. */
export function verifyArchive(archivePath) {
  const entries = [];
  for (const { entry, offset, fd } of iterateVerified(archivePath)) {
    if (digestRange(fd, offset, entry.size) !== entry.sha256) throw new ArchiveError(`digest mismatch for ${entry.path}`);
    entries.push(entry);
  }
  return { entries, treeHash: treeHash(entries), fileCount: entries.length };
}

/**
 * Extracts into `destDir`, which must NOT exist (its parent must). The archive is fully verified first, so a corrupt or
 * hostile archive writes nothing. Files are created with O_EXCL (never overwrite, never follow a link). If extraction
 * fails part-way (corruption found late, I/O error), the directory created by THIS call is removed and nothing else is
 * touched; the pre-existing parent and every sibling stay as they were. `hooks.beforeWrite` exists for failure tests.
 */
export function extractArchive(archivePath, destDir, hooks = {}) {
  verifyArchive(archivePath);
  const dest = path.resolve(destDir);
  const parent = path.dirname(dest);
  if (!fs.existsSync(parent) || !fs.statSync(parent).isDirectory()) throw new ArchiveError('destination parent directory must already exist');
  if (fs.existsSync(dest) || isLink(dest)) throw new ArchiveError('destination already exists; refusing to extract into it');
  fs.mkdirSync(dest, { mode: 0o700 }); // non-recursive and without exist-ok: fails if it appeared in the meantime
  try {
    const rootPrefix = dest + path.sep;
    for (const { entry, offset, fd } of iterateVerified(archivePath)) {
      const target = path.join(dest, ...entry.path.split('/'));
      if (!target.startsWith(rootPrefix)) throw new ArchiveError(`entry escapes destination: ${entry.path}`);
      fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
      hooks.beforeWrite?.(entry);
      const out = fs.openSync(target, 'wx', entry.exec ? 0o700 : 0o600);
      try {
        const hash = createHash('sha256');
        const buf = Buffer.allocUnsafe(Math.min(CHUNK, Math.max(entry.size, 1)));
        let position = 0;
        while (position < entry.size) {
          const n = fs.readSync(fd, buf, 0, Math.min(buf.length, entry.size - position), offset + position);
          if (n === 0) throw new ArchiveError('truncated archive payload');
          hash.update(buf.subarray(0, n));
          fs.writeSync(out, buf, 0, n);
          position += n;
        }
        if (hash.digest('hex') !== entry.sha256) throw new ArchiveError(`digest mismatch for ${entry.path}`);
      } finally {
        fs.closeSync(out);
      }
    }
  } catch (error) {
    fs.rmSync(dest, { recursive: true, force: true });
    throw error;
  }
  const entries = readArchiveIndex(archivePath).entries;
  return { dest, fileCount: entries.length, treeHash: treeHash(entries) };
}

function isLink(p) {
  try {
    return fs.lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
}

/** Tree digest of a directory on disk (same function as an archive of it), for comparing restored files to the manifest. */
export function directoryTree(root, options) {
  const files = listRegularFiles(root, options);
  const entries = hashFiles(files);
  return { entries, treeHash: treeHash(entries), fileCount: entries.length };
}

export const isWindows = () => process.platform === 'win32';
