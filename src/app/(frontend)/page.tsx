import Link from 'next/link';
import type { Metadata } from 'next';
import { ArticleCards, Empty, ProjectCards, ServiceCards, SurveyCta } from '../../components/blocks';
import { HeroSection } from '../../components/HeroSection';
import { getArticles, getPage, getProjects, getServices } from '../../lib/cms';
import { buildMetadata } from '../../lib/metadata';
import { richTextToPlain } from '../../lib/public-content';
import { SITE_NAME } from '../../lib/site';

export const generateMetadata = async (): Promise<Metadata> =>
  buildMetadata('/', SITE_NAME, (await getPage('home-page'))?.seo);

export default async function HomePage() {
  const [page, services, projects, latest] = await Promise.all([
    getPage('home-page'),
    getServices(),
    getProjects(6),
    getArticles({ limit: 3 }),
  ]);
  return (
    <>
      <HeroSection
        hero={page?.hero}
        defaultTitle={page?.title}
        defaultBodyText={page?.body ? richTextToPlain(page.body) : undefined}
      />
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
