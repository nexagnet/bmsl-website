export const BUILD_PHASE: 'phase-production-build';
export type BuildStep = { name: string; script: string; args: string[]; env: Record<string, string> };
export type SpawnResult = { status: number | null; signal?: string | null; error?: Error };
export function buildSteps(rootDir?: string): BuildStep[];
export function runBuild(options?: {
  spawn?: (node: string, args: string[], opts: { cwd: string; env: Record<string, string | undefined>; stdio: 'inherit' }) => SpawnResult;
  env?: Record<string, string | undefined>;
  cwd?: string;
  steps?: BuildStep[];
  node?: string;
}): number;
