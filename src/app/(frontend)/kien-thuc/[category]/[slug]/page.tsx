import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Crumbs, Img, SurveyCta } from '../../../../../components/blocks';
import { NewsGrid, Overline } from '../../../../../components/content-ui';
import { JsonLd } from '../../../../../components/JsonLd';
import { RichText } from '../../../../../components/RichText';
import { getArticle, getArticles } from '../../../../../lib/cms';
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
  // Related reading: other published articles of the same category (none are invented when there are no siblings).
  const related = article.category
    ? (await getArticles({ categoryId: article.category.id, limit: 4 })).articles.filter((a) => a.id !== article.id).slice(0, 3)
    : [];
  return (
    <>
      <Crumbs
        items={[
          { label: 'Tin tức', href: '/kien-thuc' },
          ...(article.category ? [{ label: article.category.name, href: article.category.href }] : []),
          { label: article.title },
        ]}
      />
      <JsonLd
        data={breadcrumbLd(getSiteUrl(), [
          { name: 'Tin tức', path: '/kien-thuc' },
          ...(article.category ? [{ name: article.category.name, path: article.category.href }] : []),
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
      <article className="pg-section" style={{ paddingTop: '3rem' }}>
        <div className="container">
          <div className="article-col">
            {article.category ? <p className="news-cat">{article.category.name}</p> : null}
            <h1>{article.title}</h1>
            {/* No author or reading time is published, so none is invented. */}
            {date ? <p className="news-date">{date}</p> : null}
            {article.cover ? (
              <div className="article-cover">
                <Img image={article.cover} />
              </div>
            ) : null}
            <div className="prose">
              <RichText data={article.body} />
            </div>
            <div className="inline-cta">
              <p>Cần tư vấn thêm về nội dung này?</p>
              <Link className="button" href="/lien-he?requestType=khac">
                Tư vấn
              </Link>
            </div>
          </div>
        </div>
      </article>
      {related.length ? (
        <section className="pg-section white" aria-labelledby="related-title">
          <div className="container">
            <Overline>BÀI LIÊN QUAN</Overline>
            <h2 className="pg-title" id="related-title">
              Bài viết liên quan
            </h2>
            <NewsGrid items={related} />
          </div>
        </section>
      ) : null}
      <SurveyCta />
    </>
  );
}
