import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { HeroView } from '../lib/public-content';
import { HeroSection } from './HeroSection';

const render = (props: Parameters<typeof HeroSection>[0]) =>
  renderToStaticMarkup(createElement(HeroSection, props));

const baseHero = {
  enabled: true,
  headline: 'Tiêu đề từ CMS',
  primaryCta: { label: 'Khảo sát', href: '/khao-sat' },
  secondaryCta: { label: 'Dịch vụ', href: '/dich-vu' },
} as unknown as HeroView;

describe('HeroSection', () => {
  it('renders the text-first fallback without the dashboard matrix or invented content', () => {
    const html = render({ hero: baseHero });
    expect(html).toContain('text-first');
    expect(html).not.toContain('hero-fallback-matrix');
    expect(html).not.toContain('Đang cập nhật');
    expect(html).not.toContain('<img');
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain('Tiêu đề từ CMS');
  });

  it('renders an eager, high-priority, dimension-reserved image only when one is provided', () => {
    const hero = {
      ...baseHero,
      desktopImage: { url: '/media/a.jpg', alt: 'Mô tả', width: 1600, height: 900 },
    } as unknown as HeroView;
    const html = render({ hero });
    expect(html).toContain('has-media');
    expect(html).toContain('fetchPriority="high"');
    expect(html).toContain('width="1600"');
    expect(html).toContain('height="900"');
    expect(html).not.toContain('loading="lazy"');
    expect(html).toContain('alt="Mô tả"');
  });

  it('keeps a semantic H1 when the hero is disabled', () => {
    const html = render({ hero: { ...baseHero, enabled: false } as HeroView, defaultTitle: 'Trang chủ' });
    expect(html).toContain('<h1 class="sr-only">Trang chủ</h1>');
    expect(html).not.toContain('<img');
  });

  it('falls back to page title and survey CTA when hero is absent, and tolerates long text', () => {
    const long = 'Rất dài '.repeat(200);
    const html = render({ defaultTitle: 'Tiêu đề trang', defaultBodyText: long });
    expect(html).toContain('Tiêu đề trang');
    expect(html).toContain(long.trim().slice(0, 20));
    expect(html).toContain('href="/dich-vu"');
  });
});
