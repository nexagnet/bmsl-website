import Link from 'next/link';
import type { Metadata } from 'next';
import { ArticleCards, Empty, ProjectCards, ServiceCards, SurveyCta } from '../../components/blocks';
import { RichText } from '../../components/RichText';
import { getArticles, getPage, getProjects, getServices } from '../../lib/cms';
import { buildMetadata } from '../../lib/metadata';
import { SITE_NAME, SURVEY_CTA } from '../../lib/site';

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
      <section className="container hero">
        <div className="hero-card">
          <div className="kicker">TIÊU CHUẨN VẬN HÀNH BẤT ĐỘNG SẢN</div>
          <h1>{page?.title ?? SITE_NAME}</h1>
          <div className="prose">
            <RichText data={page?.body} />
          </div>
          <p style={{ marginTop: '1.75rem', marginBottom: 0 }}>
            <Link className="button" href={SURVEY_CTA.href}>
              {SURVEY_CTA.label}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </Link>
          </p>
        </div>
      </section>
      <section className="container section" aria-labelledby="home-services">
        <div className="section-header">
          <div className="kicker">LĨNH VỰC HOẠT ĐỘNG</div>
          <h2 id="home-services">Dịch vụ</h2>
        </div>
        {services.length ? <ServiceCards items={services} /> : <Empty>Nội dung đang được cập nhật.</Empty>}
      </section>
      {projects.length ? (
        <section className="container section alt" aria-labelledby="home-projects">
          <div className="section-header">
            <div className="kicker">HỒ SƠ NĂNG LỰC</div>
            <h2 id="home-projects">Dự án</h2>
          </div>
          <ProjectCards items={projects} />
        </section>
      ) : null}
      <section className="container section" aria-labelledby="home-process">
        <div className="section-header">
          <div className="kicker">CAM KẾT CHẤT LƯỢNG</div>
          <h2 id="home-process">Quy trình & Minh bạch</h2>
        </div>
        <p style={{ maxWidth: '42rem', marginBottom: '1.5rem', color: 'var(--color-text-secondary)' }}>
          Hệ thống tiêu chuẩn quản lý đồng bộ, công khai và minh bạch trong mọi hoạt động vận hành kỹ thuật, an ninh và vệ sinh.
        </p>
        <p>
          <Link className="button secondary" href="/quy-trinh-minh-bach">
            Xem quy trình & minh bạch →
          </Link>
        </p>
      </section>
      {latest.articles.length ? (
        <section className="container section alt" aria-labelledby="home-articles">
          <div className="section-header">
            <div className="kicker">THÔNG TIN CHUYÊN NGÀNH</div>
            <h2 id="home-articles">Kiến thức</h2>
          </div>
          <ArticleCards items={latest.articles} />
        </section>
      ) : null}
      <SurveyCta />
    </>
  );
}
