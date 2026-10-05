import Link from 'next/link';
import type { ReactNode } from 'react';
import type { ArticleView, JobView, ProjectView, PublicImage, ServiceView } from '../lib/public-content';
import { formatDate } from '../lib/public-content';
import { SURVEY_CTA } from '../lib/site';

export const Empty = ({ children }: { children: ReactNode }) => <p className="empty">{children}</p>;

export function Crumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav className="container breadcrumb" aria-label="Đường dẫn">
      {items.map((item, i) => (
        <span key={item.label}>
          {i > 0 ? ' / ' : ''}
          {item.href ? <Link href={item.href}>{item.label}</Link> : <span aria-current="page">{item.label}</span>}
        </span>
      ))}
    </nav>
  );
}

export const Img = ({ image, sizes }: { image: PublicImage; sizes?: string }) => (
  <img src={image.url} alt={image.alt} width={image.width} height={image.height} loading="lazy" sizes={sizes} />
);

export function SurveyCta() {
  return (
    <section className="section alt" aria-labelledby="cta-title">
      <div className="container">
        <h2 id="cta-title">Liên hệ khảo sát</h2>
        <Link className="button" href={SURVEY_CTA.href}>
          {SURVEY_CTA.label}
        </Link>
      </div>
    </section>
  );
}

export const ServiceCards = ({ items }: { items: ServiceView[] }) => (
  <ul className="grid">
    {items.map((s) => (
      <li key={s.id} className="card">
        <h3>
          <Link href={s.href}>{s.name}</Link>
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
        {p.images[0] ? <Img image={p.images[0]} sizes="(min-width: 64rem) 25vw, 100vw" /> : null}
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
        {a.cover ? <Img image={a.cover} sizes="(min-width: 64rem) 25vw, 100vw" /> : null}
        <p className="muted">
          {a.category.name}
          {formatDate(a.publishedAt) ? ` · ${formatDate(a.publishedAt)}` : ''}
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
