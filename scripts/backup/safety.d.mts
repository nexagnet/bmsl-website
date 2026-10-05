export type DatabaseConnection = { host: string; port: string; user: string; password: string; database: string; sslmode?: string };
export const LOCAL_HOSTS: string[];
export const RESTORE_DB_NAME: RegExp;
export class ToolError extends Error {}
export function assertPrivateOutputSupported(platform?: string): void;
export function parseDatabaseUrl(raw: string | undefined, options?: { requireLocal?: boolean }): DatabaseConnection;
export function connectionStringFor(conn: DatabaseConnection, database: string): string;
export function childEnv(conn: DatabaseConnection, database: string, parent?: Record<string, string | undefined>): Record<string, string>;
export function redact(text: string, secrets: (string | undefined)[]): string;
export function toPublicError(error: unknown, secrets?: (string | undefined)[]): string;
export function insideGitWorkTree(dir: string): boolean;
export function validatePrivateDestination(dir: string, options?: { repoRoot?: string; label?: string }): string;
export function createPrivateDirectory(dir: string, options?: { repoRoot?: string; label?: string }): string;
export function assertPrivate(p: string): void;
