import Link from 'next/link';
import type { Metadata } from 'next';
import { ArticleCards, Empty, Overline, ProjectCards, SectionHeading, ServiceCards, SurveyCta } from '../../components/blocks';
import { HeroSection } from '../../components/HeroSection';
import { getArticles, getPage, getProjects, getServices } from '../../lib/cms';
import { buildMetadata } from '../../lib/metadata';
import { richTextToPlain } from '../../lib/public-content';
import { HOME_PROFILE_CTA, SITE_NAME } from '../../lib/site';

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
      <section className="section" aria-labelledby="home-services">
        <div className="container">
          <SectionHeading
            id="home-services"
            overline="Dịch vụ"
            title="Dịch vụ"
            action={{ label: 'Xem tất cả dịch vụ →', href: '/dich-vu' }}
          />
          {services.length ? <ServiceCards items={services} /> : <Empty>Nội dung đang được cập nhật.</Empty>}
        </div>
      </section>
      {projects.length ? (
        <section className="section" aria-labelledby="home-projects">
          <div className="container">
            <SectionHeading
              id="home-projects"
              overline="Dự án"
              title="Dự án"
              action={{ label: 'Xem tất cả dự án →', href: '/du-an' }}
            />
            <ProjectCards items={projects} />
          </div>
        </section>
      ) : null}
      <section className="band-navy" aria-labelledby="home-process">
        <div className="container band-navy-inner">
          <Overline tone="gold">Quy trình & Minh bạch</Overline>
          <h2 id="home-process">Quy trình & Minh bạch</h2>
          <p>
            <Link className="button button-on-dark" href="/quy-trinh-minh-bach">
              Xem quy trình & minh bạch
            </Link>
          </p>
        </div>
      </section>
      {latest.articles.length ? (
        <section className="section" aria-labelledby="home-articles">
          <div className="container">
            <SectionHeading
              id="home-articles"
              overline="Tin tức"
              title="Tin tức"
              action={{ label: 'Xem tất cả tin tức →', href: '/kien-thuc' }}
            />
            <ArticleCards items={latest.articles} />
          </div>
        </section>
      ) : null}
      <SurveyCta
        title="Liên hệ khảo sát thực tế"
        description="Để lại thông tin để BMSL tư vấn và sắp lịch khảo sát."
        cta={HOME_PROFILE_CTA}
      />
    </>
  );
}
