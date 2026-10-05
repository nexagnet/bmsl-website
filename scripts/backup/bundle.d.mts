export type Fingerprint = {
  schemaHash: string;
  contentHash: string;
  sequencesHash: string;
  migrationsHash: string;
  tables: Record<string, { rows: number; md5: string }>;
  migrations: { name: string; batch: string }[];
  tableCount: number;
};
export type Manifest = {
  formatVersion: number;
  createdAt: string;
  source: { commit: string; tree: string; sha256: string; bytes: number; fileCount: number; treeHash: string; excludedSecretPaths: number };
  media: { sha256: string; bytes: number; fileCount: number; treeHash: string };
  database: Fingerprint & { sha256: string; bytes: number; format: string; pgDump: string; serverMajor: number };
  capture: { writesPausedAttested: boolean; mediaTreeStable: boolean; databaseFingerprintStable: boolean };
};
export const BUNDLE_FILES: { manifest: string; source: string; media: string; database: string };
export const FORMAT_VERSION: number;
export function runTool(command: string, args: string[], options: { env: Record<string, string>; timeoutMs?: number; secrets?: (string | undefined)[] }): Promise<{ stdout: string }>;
export function toolMajor(command: string, env: Record<string, string>): Promise<{ major: number; text: string }>;
export function fingerprintDatabase(client: { query: (sql: string) => Promise<{ rows: Record<string, string>[] }> }): Promise<Fingerprint>;
export function compareFingerprints(expected: Fingerprint, actual: Fingerprint): void;
export function isSecretEnvPath(p: string): boolean;
export function readCommitFiles(repoRoot: string, commit: string): { treeSha: string; files: { path: string; oid: string; exec: boolean; data: Buffer }[]; excluded: string[] };
export function createBackup(options: {
  outDir: string;
  sourceCommit: string;
  mediaDir: string;
  databaseUrl: string;
  confirmWritesPaused: boolean;
  repoRoot: string;
  timeoutMs?: number;
  now?: () => Date;
}): Promise<{ bundleDir: string; manifest: Manifest }>;
export function verifyBundle(bundleDir: string): Manifest;
export function newRestoreDatabaseName(): string;
export function restoreBundle(options: {
  bundleDir: string;
  targetDir: string;
  databaseName: string;
  adminDatabaseUrl: string;
  timeoutMs?: number;
  hooks?: { afterDatabaseCreated?: () => void; afterDirectoryCreated?: () => void; extract?: { beforeWrite?: (entry: { path: string }) => void } };
}): Promise<{
  databaseName: string;
  databaseUrl: string;
  sourceDir: string;
  mediaDir: string;
  targetDir: string;
  resources: { database: string | undefined; directory: string | undefined };
  verification: { schema: boolean; content: boolean; sequences: boolean; migrations: number; mediaFiles: number; sourceFiles: number };
  manifest: Manifest;
  cleanup: () => Promise<void>;
}>;
