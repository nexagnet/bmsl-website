import Link from 'next/link';
import type { ReactNode } from 'react';
import type { ArticleView, JobView, ProjectView, PublicImage, ServiceView } from '../lib/public-content';
import { formatDate } from '../lib/public-content';
import { SURVEY_CTA } from '../lib/site';

export const Empty = ({ children }: { children: ReactNode }) => (
  <p className="empty">
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'block', margin: '0 auto 0.75rem', opacity: 0.6 }}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
    {children}
  </p>
);

export function Crumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav className="container breadcrumb" aria-label="Đường dẫn">
      {items.map((item, i) => (
        <span key={item.label} style={{ display: 'inline-flex', alignItems: 'center' }}>
          {i > 0 ? (
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ margin: '0 0.35rem', opacity: 0.4 }}
              aria-hidden="true"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          ) : null}
          {item.href ? <Link href={item.href}>{item.label}</Link> : <span aria-current="page">{item.label}</span>}
        </span>
      ))}
    </nav>
  );
}

export const Img = ({ image, sizes }: { image: PublicImage; sizes?: string }) => (
  // Plain <img>: Next's optimizer is disabled (next.config) until a rights-aware pipeline exists (W5B).
  // Dimensions are set only when both are known, so layout shift is reserved without distorting the ratio.
  <img
    src={image.url}
    alt={image.alt}
    {...(image.width && image.height ? { width: image.width, height: image.height } : {})}
    loading="lazy"
    decoding="async"
    sizes={sizes}
  />
);

export function SurveyCta() {
  return (
    <section className="survey-cta-section" aria-labelledby="cta-title">
      <div className="container">
        <div className="survey-cta-card">
          <h2 id="cta-title">Liên hệ khảo sát</h2>
          <Link className="button" href={SURVEY_CTA.href}>
            {SURVEY_CTA.label}
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}

export const ServiceCards = ({ items }: { items: ServiceView[] }) => (
  <ul className="grid">
    {items.map((s) => (
      <li key={s.id} className="card">
        <div className="service-icon-box" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
          </svg>
        </div>
        <h3>
          <Link href={s.href} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <span>{s.name}</span>
            <span style={{ opacity: 0.6, fontSize: '0.9em' }} aria-hidden="true">→</span>
          </Link>
        </h3>
        {s.summary ? <p>{s.summary}</p> : null}
      </li>
    ))}
  </ul>
);

export const ProjectCards = ({ items }: { items: ProjectView[] }) => (
  <ul className="grid">
    {items.map((p) => (
      <li key={p.id} className="card">
        {p.images[0] ? (
          <Img image={p.images[0]} sizes="(min-width: 64rem) 25vw, 100vw" />
        ) : (
          <div
            style={{
              width: '100%',
              aspectRatio: '16 / 10',
              borderRadius: 'var(--radius)',
              background: 'linear-gradient(135deg, var(--color-surface) 0%, var(--color-surface-subtle) 100%)',
              border: '1px solid var(--color-border-subtle)',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-muted)',
            }}
            aria-hidden="true"
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
              <path d="M3 21h18M5 21V7l8-4v18M13 21V3l6 4v14" />
            </svg>
          </div>
        )}
        <h3>
          <Link href={p.href}>{p.name}</Link>
        </h3>
        {p.summary ? <p>{p.summary}</p> : null}
      </li>
    ))}
  </ul>
);

export const ArticleCards = ({ items }: { items: ArticleView[] }) => (
  <ul className="grid">
    {items.map((a) => (
      <li key={a.id} className="card">
        {a.cover ? (
          <Img image={a.cover} sizes="(min-width: 64rem) 25vw, 100vw" />
        ) : (
          <div
            style={{
              width: '100%',
              aspectRatio: '16 / 10',
              borderRadius: 'var(--radius)',
              background: 'linear-gradient(135deg, var(--color-surface) 0%, var(--color-surface-subtle) 100%)',
              border: '1px solid var(--color-border-subtle)',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-muted)',
            }}
            aria-hidden="true"
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
          </div>
        )}
        <p className="muted" style={{ fontSize: '0.85rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span
            style={{
              background: 'var(--color-surface-subtle)',
              color: 'var(--color-brand-secondary)',
              padding: '0.15rem 0.5rem',
              borderRadius: 'var(--radius-sm)',
              fontWeight: 600,
              fontSize: '0.8rem',
            }}
          >
            {a.category.name}
          </span>
          {formatDate(a.publishedAt) ? <span>{formatDate(a.publishedAt)}</span> : null}
        </p>
        <h3>
          <Link href={a.href}>{a.title}</Link>
        </h3>
        {a.excerpt ? <p>{a.excerpt}</p> : null}
      </li>
    ))}
  </ul>
);

export const JobCards = ({ items }: { items: JobView[] }) => (
  <ul className="grid">
    {items.map((j) => (
      <li key={j.id} className="card">
        <h3>
          <Link href={j.href}>{j.title}</Link>
        </h3>
        {formatDate(j.deadline) ? <p className="muted">Hạn nộp: {formatDate(j.deadline)}</p> : null}
      </li>
    ))}
  </ul>
);

export function Pager({ base, page, totalPages }: { base: string; page: number; totalPages: number }) {
  if (totalPages <= 1) return null;
  const href = (p: number) => (p <= 1 ? base : `${base}?page=${p}`);
  return (
    <nav className="pager" aria-label="Phân trang">
      {page > 1 ? <Link href={href(page - 1)}>← Trang trước</Link> : null}
      <span>
        Trang {page}/{totalPages}
      </span>
      {page < totalPages ? <Link href={href(page + 1)}>Trang sau →</Link> : null}
    </nav>
  );
}
