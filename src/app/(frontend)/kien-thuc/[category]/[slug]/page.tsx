import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Crumbs, Img, SurveyCta } from '../../../../../components/blocks';
import { JsonLd } from '../../../../../components/JsonLd';
import { RichText } from '../../../../../components/RichText';
import { getArticle } from '../../../../../lib/cms';
import { buildMetadata } from '../../../../../lib/metadata';
import { formatDate } from '../../../../../lib/public-content';
import { getSiteUrl } from '../../../../../lib/site';
import { articleLd, breadcrumbLd } from '../../../../../lib/structured-data';

type Props = { params: Promise<{ category: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category, slug } = await params;
  const article = await getArticle(category, slug);
  return article ? buildMetadata(article.href, article.title, article.seo, article.excerpt) : {};
}

export default async function ArticlePage({ params }: Props) {
  const { category, slug } = await params;
  const article = await getArticle(category, slug);
  if (!article) notFound();
  const date = formatDate(article.publishedAt);
  return (
    <>
      <Crumbs
        items={[
          { label: 'Kiến thức', href: '/kien-thuc' },
          { label: article.category.name, href: article.category.href },
          { label: article.title },
        ]}
      />
      <JsonLd
        data={breadcrumbLd(getSiteUrl(), [
          { name: 'Kiến thức', path: '/kien-thuc' },
          { name: article.category.name, path: article.category.href },
          { name: article.title, path: article.href },
        ])}
      />
      {/* No author is published, so none is invented; Article is emitted only with a valid publish date. */}
      <JsonLd
        data={articleLd(getSiteUrl(), {
          title: article.title,
          path: article.href,
          publishedAt: article.publishedAt,
          description: article.seo.description ?? article.excerpt,
          imageUrl: article.cover?.url,
        })}
      />
      <article className="container hero">
        <div className="hero-card" style={{ maxWidth: '54rem' }}>
          <h1>{article.title}</h1>
          {date ? (
            <p className="muted" style={{ fontSize: '0.9rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span>{date}</span>
            </p>
          ) : null}
          {article.cover ? (
            <div style={{ marginBottom: '2rem', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
              <Img image={article.cover} />
            </div>
          ) : null}
          <div className="prose">
            <RichText data={article.body} />
          </div>
        </div>
      </article>
      <SurveyCta />
    </>
  );
}
