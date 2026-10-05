export type ArchiveEntry = { type: 'file'; path: string; size: number; sha256: string; exec?: boolean };
export type ListedFile = { path: string; full: string; size: number; ino: number; dev: number; exec: boolean };
export const MAGIC: string;
export class ArchiveError extends Error {}
export function validateEntryPath(p: unknown): void;
export function validateIndex(index: unknown): ArchiveEntry[];
export function treeHash(entries: { path: string; size: number; sha256: string }[]): string;
export function encodeArchive(index: unknown, payload: Buffer): Buffer;
export function listRegularFiles(root: string, options?: { exclude?: (rel: string) => boolean }): ListedFile[];
export function hashFiles(files: ListedFile[]): ArchiveEntry[];
export function writeArchive(archivePath: string, files: ListedFile[]): { entries: ArchiveEntry[]; treeHash: string; fileCount: number; bytes: number };
export function readArchiveIndex(archivePath: string): { entries: ArchiveEntry[]; payloadOffset: number };
export function verifyArchive(archivePath: string): { entries: ArchiveEntry[]; treeHash: string; fileCount: number };
export function extractArchive(
  archivePath: string,
  destDir: string,
  hooks?: { beforeWrite?: (entry: ArchiveEntry) => void },
): { dest: string; fileCount: number; treeHash: string };
export function directoryTree(root: string, options?: { exclude?: (rel: string) => boolean }): { entries: ArchiveEntry[]; treeHash: string; fileCount: number };
