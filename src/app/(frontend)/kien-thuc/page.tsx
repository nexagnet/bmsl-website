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
          <div className="kicker">TIN TỨC & CHUYÊN NGÀNH</div>
          <h1>Kiến thức & tin tức</h1>
          <p className="lead" style={{ marginBottom: 0 }}>
            Chia sẻ các thông tin chuyên sâu, quy định pháp luật và kiến thức thực tiễn trong công tác quản lý vận hành bất động sản.
          </p>
        </div>
      </section>
      <section className="container section" style={{ paddingTop: '0.5rem' }}>
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
