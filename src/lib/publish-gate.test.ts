import { describe, expect, it } from 'vitest';
import { jobPublishGateProblem, mergeForPublishCheck, publishGateProblem } from './publish-gate';

describe('project publication gate (sourceStatus)', () => {
  it('refuses publishing ANY project while sourceStatus is not CONFIRMED, whatever fields it fills in', () => {
    const claims: Record<string, unknown>[] = [
      { address: 'Synthetic address' },
      { summary: 'Synthetic summary only' },
      { services: [1] },
      { name: 'Synthetic name only' },
      { bqtFeedback: { text: 'x' } },
      {},
    ];
    for (const claim of claims) {
      for (const sourceStatus of ['LEGACY-SOURCE', undefined, null, 'confirmed']) {
        expect(publishGateProblem({ _status: 'published', sourceStatus, ...claim }), JSON.stringify(claim)).toMatch(/CONFIRMED/);
      }
    }
  });

  it('allows drafts and CONFIRMED projects', () => {
    expect(publishGateProblem({ _status: 'draft', sourceStatus: 'LEGACY-SOURCE', address: 'x', summary: 'y' })).toBeUndefined();
    expect(publishGateProblem({ _status: 'published', sourceStatus: 'CONFIRMED', address: 'x' })).toBeUndefined();
    expect(publishGateProblem({ _status: 'published', sourceStatus: 'CONFIRMED' })).toBeUndefined();
  });

  it('judges the stored document overlaid with the change, so a partial publish cannot slip stored data through', () => {
    const stored = { _status: 'draft', sourceStatus: 'LEGACY-SOURCE', summary: 'stored' };
    expect(publishGateProblem(mergeForPublishCheck(stored, { _status: 'published' }))).toMatch(/CONFIRMED/);
    expect(publishGateProblem(mergeForPublishCheck(stored, { _status: 'published', sourceStatus: 'CONFIRMED' }))).toBeUndefined();
    expect(publishGateProblem(mergeForPublishCheck({ _status: 'published', sourceStatus: 'CONFIRMED' }, { sourceStatus: 'LEGACY-SOURCE' }))).toMatch(/CONFIRMED/);
    expect(mergeForPublishCheck(undefined, undefined)).toEqual({ bqtFeedback: {} });
  });
});

describe('job publication gate (sourceStatus)', () => {
  it('refuses publishing a job unless sourceStatus is CONFIRMED, including a stored published legacy job', () => {
    for (const sourceStatus of ['LEGACY-SOURCE', undefined, null, 'confirmed']) {
      expect(jobPublishGateProblem({ _status: 'published', sourceStatus }), String(sourceStatus)).toMatch(/CONFIRMED/);
    }
    const stored = { _status: 'published', sourceStatus: 'LEGACY-SOURCE' };
    expect(jobPublishGateProblem(mergeForPublishCheck(stored, { title: 'edit' }))).toMatch(/CONFIRMED/);
  });

  it('allows drafts and CONFIRMED jobs', () => {
    expect(jobPublishGateProblem({ _status: 'draft', sourceStatus: 'LEGACY-SOURCE' })).toBeUndefined();
    expect(jobPublishGateProblem({ _status: 'published', sourceStatus: 'CONFIRMED' })).toBeUndefined();
    expect(jobPublishGateProblem(mergeForPublishCheck({ _status: 'draft', sourceStatus: 'LEGACY-SOURCE' }, { _status: 'published', sourceStatus: 'CONFIRMED' }))).toBeUndefined();
  });
});
