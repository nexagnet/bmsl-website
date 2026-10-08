import Link from 'next/link';
import type { Metadata } from 'next';
import { ArticleCards, Empty, ProjectCards, ServiceCards, SurveyCta } from '../../components/blocks';
import { RichText } from '../../components/RichText';
import { getArticles, getDocuments, getPage, getProjects, getServices } from '../../lib/cms';
import { buildMetadata } from '../../lib/metadata';
import { DOSSIER_CATEGORY, DOSSIER_REQUEST_CTA, SITE_NAME } from '../../lib/site';

export const generateMetadata = async (): Promise<Metadata> =>
  buildMetadata('/', SITE_NAME, (await getPage('home-page'))?.seo);

export default async function HomePage() {
  const [page, services, projects, latest, documents] = await Promise.all([
    getPage('home-page'),
    getServices(),
    getProjects(6),
    getArticles({ limit: 3 }),
    getDocuments(),
  ]);
  // Only a published Document with an APPROVED file is downloadable; otherwise an honest request via the contact flow.
  const dossier = documents.find((d) => d.category === DOSSIER_CATEGORY);
  return (
    <>
      <section className="container hero">
        <div className="hero-card">
          <h1>{page?.title ?? SITE_NAME}</h1>
          <div className="prose">
            <RichText data={page?.body} />
          </div>
          <p style={{ marginTop: '1.75rem', marginBottom: 0 }}>
            {dossier ? (
              <a className="button" href={dossier.url} data-analytics-event="document_download" data-link-location="home_hero" data-document-id={dossier.id}>
                {DOSSIER_REQUEST_CTA.label}
              </a>
            ) : (
              <Link className="button" href={DOSSIER_REQUEST_CTA.href}>
                {DOSSIER_REQUEST_CTA.label}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
              </Link>
            )}
          </p>
        </div>
      </section>
      <section className="container section" aria-labelledby="home-services">
        <h2 id="home-services">Dịch vụ</h2>
        {services.length ? <ServiceCards items={services} /> : <Empty>Nội dung đang được cập nhật.</Empty>}
      </section>
      {projects.length ? (
        <section className="container section alt" aria-labelledby="home-projects">
          <h2 id="home-projects">Dự án</h2>
          <ProjectCards items={projects} />
        </section>
      ) : null}
      <section className="container section" aria-labelledby="home-process">
        <h2 id="home-process">Quy trình & Minh bạch</h2>
        <p>
          <Link className="button secondary" href="/quy-trinh-minh-bach">
            Xem quy trình & minh bạch
          </Link>
        </p>
      </section>
      {latest.articles.length ? (
        <section className="container section alt" aria-labelledby="home-articles">
          <h2 id="home-articles">Kiến thức</h2>
          <ArticleCards items={latest.articles} />
        </section>
      ) : null}
      <SurveyCta />
    </>
  );
}
