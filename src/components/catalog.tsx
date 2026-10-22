import Link from 'next/link';
import type { ReactNode } from 'react';
import type { ProjectView, ServiceView } from '../lib/public-content';
import { Img } from './blocks';

/** UI-03 building blocks (Figma HiFi: Dịch vụ, Dự án). Only CMS data is rendered; nothing here is sample content. */

export const PageHero = ({ overline, title, lead }: { overline: string; title: string; lead?: string }) => (
  <section className="page-hero">
    <div className="container">
      <p className="overline">{overline}</p>
      <h1>{title}</h1>
      {lead ? <p className="page-hero-lead">{lead}</p> : null}
    </div>
  </section>
);

export const SectionHeading = ({ overline, title }: { overline: string; title: string }) => (
  <div className="section-heading">
    <p className="overline">{overline}</p>
    <h2>{title}</h2>
  </div>
);

export const CtaBand = ({ title, text, label, href }: { title: string; text?: string; label: string; href: string }) => (
  <section className="survey-cta-section cta-band" aria-labelledby="cta-title">
    <div className="container">
      <p className="overline">Kết nối cùng BMSL</p>
      <h2 id="cta-title">{title}</h2>
      {text ? <p className="cta-band-text">{text}</p> : null}
      <Link className="button gold" href={href}>
        {label}
      </Link>
    </div>
  </section>
);

const Arrow = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

export const ServiceRows = ({ items }: { items: ServiceView[] }) => (
  <div>
    {items.map((s, i) => {
      const n = String(i + 1).padStart(2, '0');
      return (
        <section key={s.id} className={`service-row ${i % 2 ? 'alt' : ''}`}>
          <div className="container service-row-inner">
            <div className="service-row-text">
              <p className="overline">{n} / Dịch vụ</p>
              <h2>
                <Link href={s.href}>{s.name}</Link>
              </h2>
              {s.summary ? <p className="service-row-desc">{s.summary}</p> : null}
              <Link className="text-link" href={s.href}>
                Xem chi tiết <Arrow />
                <span className="visually-hidden"> {s.name}</span>
              </Link>
            </div>
            <div className="service-row-mark" aria-hidden="true">
              <span>{n}</span>
            </div>
          </div>
        </section>
      );
    })}
  </div>
);

export const RelatedServices = ({ items }: { items: ServiceView[] }) => (
  <ul className="tile-grid">
    {items.map((s) => (
      <li key={s.id} className="tile">
        <span className="tile-icon" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
          </svg>
        </span>
        <h3>{s.name}</h3>
        {s.summary ? <p>{s.summary}</p> : null}
        <Link className="text-link" href={s.href}>
          Xem chi tiết →<span className="visually-hidden"> {s.name}</span>
        </Link>
      </li>
    ))}
  </ul>
);

export const ProjectGrid = ({ items }: { items: ProjectView[] }) => (
  <ul className="tile-grid">
    {items.map((p) => {
      const facts = p.facts.filter((f) => f.label === 'Vị trí' || f.label === 'Quy mô');
      return (
        <li key={p.id} className="tile project-tile">
          <div className="project-tile-media">
            {p.images[0] ? (
              <Img image={p.images[0]} sizes="(min-width: 64rem) 33vw, (min-width: 48rem) 50vw, 100vw" />
            ) : (
              <span className="project-tile-empty" aria-hidden="true">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 21h18M5 21V7l8-4v18M13 21V3l6 4v14" />
                </svg>
              </span>
            )}
          </div>
          <div className="project-tile-body">
            {p.services.length ? <p className="tile-tag">{p.services.map((s) => s.name).join(' · ')}</p> : null}
            <h3>{p.name}</h3>
            {p.summary ? <p>{p.summary}</p> : null}
            {facts.length ? (
              <p className="tile-meta">
                {facts.map((f) => (
                  <span key={f.label}>
                    {f.label}: {f.value}
                  </span>
                ))}
              </p>
            ) : null}
            <Link className="text-link" href={p.href}>
              Xem dự án →<span className="visually-hidden"> {p.name}</span>
            </Link>
          </div>
        </li>
      );
    })}
  </ul>
);

export const FilterChips = ({ label, items }: { label: string; items: { key: string; label: ReactNode; href: string; active: boolean }[] }) => (
  <nav aria-label={label}>
    <ul className="chips">
      {items.map((c) => (
        <li key={c.key}>
          <Link href={c.href} aria-current={c.active ? 'page' : undefined}>
            {c.label}
          </Link>
        </li>
      ))}
    </ul>
  </nav>
);
