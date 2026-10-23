import { describe, expect, it } from 'vitest';
import { toHomeLayout } from './home-sections';
import { toPage } from './public-content';

describe('home layout', () => {
  it('keeps the original order and limits when nothing is configured', () => {
    expect(toHomeLayout(undefined)).toEqual({
      order: ['stats', 'services', 'projects', 'process', 'articles'],
      projectsLimit: 6,
      articlesLimit: 3,
    });
  });

  it('follows the configured order, drops hidden, unknown and duplicate sections', () => {
    const l = toHomeLayout({
      sections: [
        { section: 'articles', visible: true },
        { section: 'projects', visible: false },
        { section: 'evil', visible: true },
        { section: 'articles', visible: true },
        { section: 'services' },
      ],
      projectsLimit: 4,
      articlesLimit: 99,
    });
    expect(l.order).toEqual(['articles', 'services']);
    expect(l.projectsLimit).toBe(4);
    expect(l.articlesLimit).toBe(3);
  });

  it('is exposed on the published home page together with the CTA band', () => {
    const p = toPage({ _status: 'published', ctaBand: { preset: 'glow' }, sections: [{ section: 'process', visible: true }] });
    expect(p?.ctaBand.preset).toBe('glow');
    expect(p?.layout.order).toEqual(['process']);
  });
});
