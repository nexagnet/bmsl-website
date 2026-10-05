import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Crumbs, Img, SurveyCta } from '../../../../../components/blocks';
import { RichText } from '../../../../../components/RichText';
import { getArticle } from '../../../../../lib/cms';
import { buildMetadata } from '../../../../../lib/metadata';
import { formatDate } from '../../../../../lib/public-content';
import { paths } from '../../../../../lib/site';

type Props = { params: Promise<{ category: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category, slug } = await params;
  const article = await getArticle(category, slug);
  return article ? buildMetadata(paths.article(category, slug), article.title, article.seo, article.excerpt) : {};
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
      <article className="container hero">
        <h1>{article.title}</h1>
        {date ? <p className="muted">{date}</p> : null}
        {article.cover ? <Img image={article.cover} /> : null}
        <RichText data={article.body} />
      </article>
      <SurveyCta />
    </>
  );
}
