import Link from 'next/link';
import type { Metadata } from 'next';
import { ArticleCards, Empty, ProjectCards, ServiceCards, SurveyCta } from '../../components/blocks';
import { RichText } from '../../components/RichText';
import { getArticles, getPage, getProjects, getServices, getSiteSettings } from '../../lib/cms';
import { JsonLd } from '../../components/JsonLd';
import { buildMetadata } from '../../lib/metadata';
import { organizationJsonLd } from '../../lib/seo';
import { getSiteUrl, SITE_NAME, SURVEY_CTA } from '../../lib/site';

export const generateMetadata = async (): Promise<Metadata> =>
  buildMetadata('/', SITE_NAME, (await getPage('home-page'))?.seo);

export default async function HomePage() {
  const [page, services, projects, latest, settings] = await Promise.all([
    getPage('home-page'),
    getServices(),
    getProjects(6),
    getArticles({ limit: 3 }),
    getSiteSettings(),
  ]);
  return (
    <>
      {/* Organization carries only name, URL and validated social profiles (no legal/address/phone facts). */}
      <JsonLd data={organizationJsonLd(getSiteUrl(), SITE_NAME, settings.socialUrls)} />
      <section className="container hero">
        <h1>{page?.title ?? SITE_NAME}</h1>
        <RichText data={page?.body} />
        <p>
          <Link className="button" href={SURVEY_CTA.href}>
            {SURVEY_CTA.label}
          </Link>
        </p>
      </section>
      <section className="container section" aria-labelledby="home-services">
        <h2 id="home-services">Dịch vụ</h2>
        {services.length ? <ServiceCards items={services} /> : <Empty>Nội dung đang được cập nhật.</Empty>}
      </section>
      {projects.length ? (
        <section className="container section" aria-labelledby="home-projects">
          <h2 id="home-projects">Dự án</h2>
          <ProjectCards items={projects} />
        </section>
      ) : null}
      <section className="container section" aria-labelledby="home-process">
        <h2 id="home-process">Quy trình & Minh bạch</h2>
        <Link href="/quy-trinh-minh-bach">Xem quy trình & minh bạch</Link>
      </section>
      {latest.articles.length ? (
        <section className="container section" aria-labelledby="home-articles">
          <h2 id="home-articles">Kiến thức</h2>
          <ArticleCards items={latest.articles} />
        </section>
      ) : null}
      <SurveyCta />
    </>
  );
}
