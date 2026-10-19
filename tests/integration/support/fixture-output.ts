// Parsing of the one result line a `payload run` fixture subprocess prints. runInGroup() returns stdout and stderr
// merged chunk by chunk, so the marker is not guaranteed to start a line: an unterminated stderr/log fragment that
// arrives just before it would be glued in front of it. The marker is therefore searched for anywhere in the output.

export const FIXTURE_RESULT_MARKER = 'FIXTURE_RESULT:';

/** Returns the parsed result object, or undefined when no complete marker + JSON object is present. */
export function parseFixtureResult(output: string): Record<string, unknown> | undefined {
  const lines = output.split(/\r?\n/);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const at = lines[i]!.indexOf(FIXTURE_RESULT_MARKER);
    if (at < 0) continue;
    try {
      const value: unknown = JSON.parse(lines[i]!.slice(at + FIXTURE_RESULT_MARKER.length));
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
    } catch {
      // not a complete result line; keep looking at earlier lines
    }
  }
  return undefined;
}
