export type HeaderEntry = { key: string; value: string };
export function buildCsp(env?: Record<string, string | undefined>): string;
export function buildSecurityHeaders(env?: Record<string, string | undefined>): HeaderEntry[];
