import Link from 'next/link';
import { Fragment, type ReactNode } from 'react';
import type { Metadata } from 'next';
import { ArticleCards, Empty, Overline, ProjectCards, SectionHeading, ServiceCards, SurveyCta } from '../../components/blocks';
import { HeroSection } from '../../components/HeroSection';
import { getArticles, getPage, getProjects, getServices } from '../../lib/cms';
import { backgroundProps } from '../../lib/backgrounds';
import { type HomeSectionId, toHomeLayout } from '../../lib/home-sections';
import { buildMetadata } from '../../lib/metadata';
import { richTextToPlain } from '../../lib/public-content';
import { HOME_PROFILE_CTA, SITE_NAME } from '../../lib/site';

export const generateMetadata = async (): Promise<Metadata> =>
  buildMetadata('/', SITE_NAME, (await getPage('home-page'))?.seo);

export default async function HomePage() {
  const page = await getPage('home-page');
  const layout = page?.layout ?? toHomeLayout(undefined);
  const [services, projects, latest] = await Promise.all([
    getServices(),
    getProjects(layout.projectsLimit),
    getArticles({ limit: layout.articlesLimit }),
  ]);
  // Curated featured projects (confirmed + published only, as mapped) win; otherwise the default list.
  const shownProjects = page?.featuredProjects.length ? page.featuredProjects : projects;
  const sections: Record<HomeSectionId, ReactNode> = {
    stats: page?.stats.length ? (
      <section className="section" aria-label="Số liệu năng lực">
        <div className="container">
          <ul className="home-stats">
            {page.stats.map((st, i) => (
              <li key={`${i}-${st.label}`}>
                <p className="home-stat-value">{st.value}</p>
                <p>{st.label}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    ) : null,
    services: (
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
    ),
    projects: shownProjects.length ? (
      <section className="section" aria-labelledby="home-projects">
        <div className="container">
          <SectionHeading
            id="home-projects"
            overline="Dự án"
            title="Dự án"
            action={{ label: 'Xem tất cả dự án →', href: '/du-an' }}
          />
          <ProjectCards items={shownProjects} />
        </div>
      </section>
    ) : null,
    process: (
      <section {...backgroundProps(page?.processBand, 'band-navy')} data-band="process" aria-labelledby="home-process">
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
    ),
    articles: latest.articles.length ? (
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
    ) : null,
  };
  return (
    <>
      <HeroSection
        hero={page?.hero}
        defaultTitle={page?.title}
        defaultBodyText={page?.body ? richTextToPlain(page.body) : undefined}
      />
      {layout.order.map((id) => (
        <Fragment key={id}>{sections[id]}</Fragment>
      ))}
      <SurveyCta
        title="Liên hệ khảo sát thực tế"
        description="Để lại thông tin để BMSL tư vấn và sắp lịch khảo sát."
        cta={HOME_PROFILE_CTA}
      />
    </>
  );
}
