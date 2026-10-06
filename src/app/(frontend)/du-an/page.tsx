import type { Metadata } from 'next';
import { Empty, ProjectCards, SurveyCta } from '../../../components/blocks';
import { getProjects } from '../../../lib/cms';
import { buildMetadata } from '../../../lib/metadata';

export const metadata: Metadata = buildMetadata('/du-an', 'Dự án đang vận hành');

export default async function ProjectsPage() {
  const projects = await getProjects();
  return (
    <>
      <section className="container hero">
        <div className="hero-card">
          <div className="kicker">HỒ SƠ NĂNG LỰC & KINH NGHIỆM</div>
          <h1>Dự án đang vận hành</h1>
          <p className="lead" style={{ marginBottom: 0 }}>
            Danh mục các dự án bất động sản được quản lý và vận hành với cam kết chất lượng, an toàn và minh bạch tối đa.
          </p>
        </div>
      </section>
      <section className="container section" style={{ paddingTop: '1rem' }}>
        {projects.length ? <ProjectCards items={projects} /> : <Empty>Chưa có dự án được công bố.</Empty>}
      </section>
      <SurveyCta />
    </>
  );
}
