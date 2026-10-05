import { describe, expect, it } from 'vitest';
import { mergeForPublishCheck, publishGateProblem } from './publish-gate';

describe('customer-fact publication gate', () => {
  const facts = { address: 'Synthetic address', scale: '', operatingSince: null };

  it('refuses publishing facts or BQT feedback while sourceStatus is not CONFIRMED', () => {
    expect(publishGateProblem({ _status: 'published', sourceStatus: 'LEGACY-SOURCE', ...facts })).toMatch(/CONFIRMED/);
    expect(publishGateProblem({ _status: 'published', ...facts })).toMatch(/CONFIRMED/);
    expect(publishGateProblem({ _status: 'published', sourceStatus: 'LEGACY-SOURCE', bqtFeedback: { text: 'x' } })).toMatch(/CONFIRMED/);
  });

  it('allows drafts, CONFIRMED projects and fact-free published projects', () => {
    expect(publishGateProblem({ _status: 'draft', sourceStatus: 'LEGACY-SOURCE', ...facts })).toBeUndefined();
    expect(publishGateProblem({ _status: 'published', sourceStatus: 'CONFIRMED', ...facts })).toBeUndefined();
    expect(publishGateProblem({ _status: 'published', sourceStatus: 'LEGACY-SOURCE', address: '  ', bqtFeedback: { text: '' } })).toBeUndefined();
  });

  it('judges the stored document overlaid with the change, so a partial publish cannot slip stored facts through', () => {
    const stored = { _status: 'draft', sourceStatus: 'LEGACY-SOURCE', address: 'Synthetic address', bqtFeedback: { text: 'stored' } };
    expect(publishGateProblem(mergeForPublishCheck(stored, { _status: 'published' }))).toMatch(/CONFIRMED/);
    expect(publishGateProblem(mergeForPublishCheck(stored, { _status: 'published', sourceStatus: 'CONFIRMED' }))).toBeUndefined();
    expect(publishGateProblem(mergeForPublishCheck({ _status: 'draft', sourceStatus: 'LEGACY-SOURCE', bqtFeedback: { text: 'stored' } }, { _status: 'published', bqtFeedback: { approvedBySource: true } }))).toMatch(/CONFIRMED/);
    expect(mergeForPublishCheck(undefined, undefined)).toEqual({ bqtFeedback: {} });
  });
});
