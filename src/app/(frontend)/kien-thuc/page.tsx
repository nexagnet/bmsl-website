import Link from 'next/link';
import type { Metadata } from 'next';
import { Empty, Pager } from '../../../components/blocks';
import { CtaBand, NewsFeatured, NewsGrid, PageHero } from '../../../components/content-ui';
import { getArticles, getCategories } from '../../../lib/cms';
import { buildMetadata } from '../../../lib/metadata';

export const metadata: Metadata = buildMetadata('/kien-thuc', 'Kiến thức & tin tức');

export default async function KnowledgePage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page } = await searchParams;
  const [categories, result] = await Promise.all([getCategories(), getArticles({ page: Number(page) })]);
  // The first article of the first page is featured; the rest stay in the grid.
  const featured = result.page === 1 ? result.articles[0] : undefined;
  const rest = featured ? result.articles.slice(1) : result.articles;
  return (
    <>
      <PageHero overline="TIN TỨC & KIẾN THỨC" title="Kiến thức & tin tức" />
      <section className="pg-section">
        <div className="container">
          {categories.length ? (
            <ul className="chips">
              <li>
                <Link href="/kien-thuc" aria-current="page">
                  Tất cả
                </Link>
              </li>
              {categories.map((c) => (
                <li key={c.id}>
                  <Link href={c.href}>{c.name}</Link>
                </li>
              ))}
            </ul>
          ) : null}
          {result.articles.length ? (
            <>
              {featured ? <NewsFeatured article={featured} /> : null}
              {rest.length ? <NewsGrid items={rest} /> : null}
            </>
          ) : (
            <Empty>Chưa có bài viết được công bố.</Empty>
          )}
          <Pager base="/kien-thuc" page={result.page} totalPages={result.totalPages} />
        </div>
      </section>
      <CtaBand title="Cần tư vấn về vận hành, pháp lý, phí?">
        <Link className="button gold" href="/lien-he?requestType=khac">
          Tư vấn
        </Link>
      </CtaBand>
    </>
  );
}
