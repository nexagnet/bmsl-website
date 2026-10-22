import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { getPage, type PageSlug } from '../lib/cms';
import { buildMetadata } from '../lib/metadata';
import { hasRichText } from '../lib/public-content';
import { Empty, Overline, SurveyCta, type SurveyCtaProps } from './blocks';
import { RichText } from './RichText';

/** Shared template for the CMS singleton pages (about, process, contact, home body). */
export const singletonMetadata = async (slug: PageSlug, path: string, fallbackTitle: string): Promise<Metadata> =>
  buildMetadata(path, fallbackTitle, (await getPage(slug))?.seo);

export async function SingletonPage({
  slug,
  fallbackTitle,
  overline,
  cta,
  children,
}: {
  slug: PageSlug;
  fallbackTitle: string;
  overline?: string;
  cta?: SurveyCtaProps;
  children?: ReactNode;
}) {
  const page = await getPage(slug);
  return (
    <>
      <section className="page-hero">
        <div className="container">
          {overline ? <Overline>{overline}</Overline> : null}
          <h1>{page?.title ?? fallbackTitle}</h1>
        </div>
      </section>
      <section className="section section-white" aria-label={page?.title ?? fallbackTitle}>
        <div className="container">
          {page && hasRichText(page.body) ? (
            <div className="prose">
              <RichText data={page.body} />
            </div>
          ) : (
            <Empty>Nội dung đang được cập nhật.</Empty>
          )}
        </div>
      </section>
      {children}
      <SurveyCta {...cta} />
    </>
  );
}
