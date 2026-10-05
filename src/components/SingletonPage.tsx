import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { getPage, type PageSlug } from '../lib/cms';
import { buildMetadata } from '../lib/metadata';
import { hasRichText } from '../lib/public-content';
import { Empty, SurveyCta } from './blocks';
import { RichText } from './RichText';

/** Shared template for the CMS singleton pages (about, process, contact, home body). */
export const singletonMetadata = async (slug: PageSlug, path: string, fallbackTitle: string): Promise<Metadata> =>
  buildMetadata(path, fallbackTitle, (await getPage(slug))?.seo);

export async function SingletonPage({
  slug,
  fallbackTitle,
  children,
}: {
  slug: PageSlug;
  fallbackTitle: string;
  children?: ReactNode;
}) {
  const page = await getPage(slug);
  return (
    <>
      <section className="container hero">
        <h1>{page?.title ?? fallbackTitle}</h1>
        {page && hasRichText(page.body) ? (
          <RichText data={page.body} />
        ) : (
          <Empty>Nội dung đang được cập nhật.</Empty>
        )}
      </section>
      {children}
      <SurveyCta />
    </>
  );
}
