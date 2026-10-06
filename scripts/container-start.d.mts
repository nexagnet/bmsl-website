export function planStart(env?: Record<string, string | undefined>): { port: number; mediaDir: string; args: string[] };
export function assertMediaWritable(
  dir: string,
  fsApi?: { mkdirSync: (p: string, o: { recursive: boolean }) => unknown; accessSync: (p: string, mode: number) => void },
): void;
export function main(env?: Record<string, string | undefined>): number | undefined;
