import Link from 'next/link';
import type { Metadata } from 'next';
import { ArticleCards, Empty, Pager, SurveyCta } from '../../../components/blocks';
import { getArticles, getCategories } from '../../../lib/cms';
import { buildMetadata } from '../../../lib/metadata';

export const metadata: Metadata = buildMetadata('/kien-thuc', 'Kiến thức & tin tức');

export default async function KnowledgePage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page } = await searchParams;
  const [categories, result] = await Promise.all([getCategories(), getArticles({ page: Number(page) })]);
  return (
    <>
      <section className="container hero">
        <div className="hero-card">
          <h1>Kiến thức & tin tức</h1>
        </div>
      </section>
      <section className="container section">
        {categories.length ? (
          <ul className="chips">
            {categories.map((c) => (
              <li key={c.id}>
                <Link href={c.href}>{c.name}</Link>
              </li>
            ))}
          </ul>
        ) : null}
        {result.articles.length ? (
          <ArticleCards items={result.articles} />
        ) : (
          <Empty>Chưa có bài viết được công bố.</Empty>
        )}
        <Pager base="/kien-thuc" page={result.page} totalPages={result.totalPages} />
      </section>
      <SurveyCta />
    </>
  );
}
