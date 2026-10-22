import Link from 'next/link';
import type { ReactNode } from 'react';
import type { ArticleView, DocumentView, JobView } from '../lib/public-content';
import { formatDate } from '../lib/public-content';
import { Img } from './blocks';

/** Figma "Overline row": short gold rule + small caps label. */
export const Overline = ({ children }: { children: ReactNode }) => (
  <p className="overline">
    <span className="overline-rule" aria-hidden="true" />
    {children}
  </p>
);

/** Flat hero of the Figma content pages. The lead is optional: it is only rendered when real text is given. */
export function PageHero({ overline, title, lead }: { overline: string; title: string; lead?: ReactNode }) {
  return (
    <section className="pg-hero">
      <div className="container">
        <Overline>{overline}</Overline>
        <h1>{title}</h1>
        {lead ? <p className="pg-lead">{lead}</p> : null}
      </div>
    </section>
  );
}

/** Navy closing band (Figma "CTA band"). The action is passed in so each page keeps its own contract CTA. */
export function CtaBand({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="cta-band" aria-labelledby="cta-band-title">
      <div className="container">
        <Overline>KẾT NỐI CÙNG BMSL</Overline>
        <h2 id="cta-band-title">{title}</h2>
        <div className="cta-band-actions">{children}</div>
      </div>
    </section>
  );
}

const NewsPlaceholder = () => <div className="news-ph" aria-hidden="true" />;

const metaLine = (a: ArticleView) => formatDate(a.publishedAt);

export function NewsGrid({ items }: { items: ArticleView[] }) {
  return (
    <ul className="news-grid">
      {items.map((a) => (
        <li key={a.id} className="news-card">
          <Link href={a.href}>
            {a.cover ? <Img image={a.cover} sizes="(min-width: 64rem) 33vw, 100vw" /> : <NewsPlaceholder />}
            <span className="news-body">
              {a.category ? <span className="news-cat">{a.category.name}</span> : null}
              <span className="news-title">{a.title}</span>
              {a.excerpt ? <span className="news-excerpt">{a.excerpt}</span> : null}
              {metaLine(a) ? <span className="news-date">{metaLine(a)}</span> : null}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** First article of the first page, shown large (Figma "Featured"). */
export function NewsFeatured({ article: a }: { article: ArticleView }) {
  return (
    <article className="news-featured">
      <div className="news-featured-media">
        {a.cover ? <Img image={a.cover} sizes="(min-width: 64rem) 50vw, 100vw" /> : <NewsPlaceholder />}
      </div>
      <div className="news-featured-text">
        {a.category ? <p className="news-cat">{a.category.name}</p> : null}
        <h2>
          <Link href={a.href}>{a.title}</Link>
        </h2>
        {a.excerpt ? <p>{a.excerpt}</p> : null}
        {metaLine(a) ? <p className="news-date">{metaLine(a)}</p> : null}
        <Link className="link-cta" href={a.href}>
          Đọc bài viết →
        </Link>
      </div>
    </article>
  );
}

export function JobGrid({ items }: { items: JobView[] }) {
  return (
    <ul className="job-grid">
      {items.map((j) => {
        const deadline = formatDate(j.deadline);
        return (
          <li key={j.id} className="job-card">
            <Link href={j.href}>
              <span className="job-title">{j.title}</span>
              {j.salary || deadline ? (
                <span className="pills">
                  {j.salary ? <span className="pill">Lương: {j.salary}</span> : null}
                  {deadline ? <span className="pill">Hạn nộp: {deadline}</span> : null}
                </span>
              ) : null}
              <span className="link-cta">Xem chi tiết →</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

const fileKind = (url: string): string => {
  const ext = /\.([a-z0-9]{2,5})(?:[?#]|$)/i.exec(url)?.[1];
  return ext ? ext.toUpperCase() : 'TẢI';
};

export function DocumentGrid({ items }: { items: DocumentView[] }) {
  return (
    <ul className="doc-grid">
      {items.map((d) => (
        <li key={d.id} className="doc-card">
          <div className="doc-head">
            <span className="doc-kind" aria-hidden="true">
              {fileKind(d.url)}
            </span>
            <h3>{d.title}</h3>
          </div>
          {d.description ? <p>{d.description}</p> : null}
          {/* Hook is inert unless the opt-in analytics provider is mounted and consented; only the id is sent. */}
          <a
            className="link-cta"
            href={d.url}
            data-analytics-event="document_download"
            data-link-location="documents"
            data-document-id={d.id}
          >
            Tải xuống ↓<span className="sr-only">: {d.title}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
