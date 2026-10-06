import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArticleCards, Crumbs, Empty, Pager, SurveyCta } from '../../../../components/blocks';
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
      <Crumbs items={[{ label: 'Kiến thức', href: '/kien-thuc' }, { label: category.name }]} />
      <JsonLd
        data={breadcrumbLd(getSiteUrl(), [
          { name: 'Kiến thức', path: '/kien-thuc' },
          { name: category.name, path: category.href },
        ])}
      />
      <section className="container hero">
        <div className="hero-card">
          <h1>{category.name}</h1>
        </div>
      </section>
      <section className="container section">
        <ul className="chips">
          {categories.map((c) => (
            <li key={c.id}>
              <Link href={c.href} aria-current={c.id === category.id ? 'page' : undefined}>
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
        {result.articles.length ? (
          <ArticleCards items={result.articles} />
        ) : (
          <Empty>Chưa có bài viết trong chuyên mục này.</Empty>
        )}
        <Pager base={category.href} page={result.page} totalPages={result.totalPages} />
      </section>
      <SurveyCta />
    </>
  );
}
