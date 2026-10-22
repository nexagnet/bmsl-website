import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Crumbs, Empty, Pager } from '../../../../components/blocks';
import { CtaBand, NewsGrid, PageHero } from '../../../../components/content-ui';
import { JsonLd } from '../../../../components/JsonLd';
import { getArticles, getCategories, getCategory } from '../../../../lib/cms';
import { buildMetadata } from '../../../../lib/metadata';
import { getSiteUrl } from '../../../../lib/site';
import { breadcrumbLd } from '../../../../lib/structured-data';

type Props = { params: Promise<{ category: string }>; searchParams: Promise<{ page?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category: slug } = await params;
  const category = await getCategory(slug);
  return category ? buildMetadata(category.href, category.name) : {};
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const [{ category: slug }, { page }] = await Promise.all([params, searchParams]);
  const category = await getCategory(slug);
  if (!category) notFound();
  const [categories, result] = await Promise.all([
    getCategories(),
    getArticles({ categoryId: category.id, page: Number(page) }),
  ]);
  return (
    <>
      <Crumbs items={[{ label: 'Tin tức', href: '/kien-thuc' }, { label: category.name }]} />
      <JsonLd
        data={breadcrumbLd(getSiteUrl(), [
          { name: 'Tin tức', path: '/kien-thuc' },
          { name: category.name, path: category.href },
        ])}
      />
      <PageHero overline="TIN TỨC & KIẾN THỨC" title={category.name} />
      <section className="pg-section">
        <div className="container">
          <ul className="chips">
            <li>
              <Link href="/kien-thuc">Tất cả</Link>
            </li>
            {categories.map((c) => (
              <li key={c.id}>
                <Link href={c.href} aria-current={c.id === category.id ? 'page' : undefined}>
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
          {result.articles.length ? (
            <NewsGrid items={result.articles} />
          ) : (
            <Empty>Chưa có bài viết trong chuyên mục này.</Empty>
          )}
          <Pager base={category.href} page={result.page} totalPages={result.totalPages} />
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
