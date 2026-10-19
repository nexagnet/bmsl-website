import { describe, expect, it } from 'vitest';
import { parseFixtureResult } from './fixture-output';

describe('parseFixtureResult', () => {
  const line = 'FIXTURE_RESULT:{"leadId":1,"projectMedia":["a.png"]}';

  it('reads a result on its own line', () => {
    expect(parseFixtureResult(`log\n${line}\n`)).toEqual({ leadId: 1, projectMedia: ['a.png'] });
  });

  it('reads a result glued after an unterminated stderr/log fragment (fails with a start-of-line match)', () => {
    expect(parseFixtureResult(`warn: partial fragment${line}\n`)).toEqual({ leadId: 1, projectMedia: ['a.png'] });
  });

  it('reads a CRLF-terminated result', () => {
    expect(parseFixtureResult(`${line}\r\n`)).toEqual({ leadId: 1, projectMedia: ['a.png'] });
  });

  it('still reports no result when none, or only a truncated one, was printed', () => {
    expect(parseFixtureResult('just logs\n')).toBeUndefined();
    expect(parseFixtureResult('FIXTURE_RESULT:{"leadId":1,"proj')).toBeUndefined();
    expect(parseFixtureResult('FIXTURE_RESULT:[1]')).toBeUndefined();
  });
});
