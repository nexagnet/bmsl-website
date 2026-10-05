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
        <h1>Dự án đang vận hành</h1>
        {projects.length ? <ProjectCards items={projects} /> : <Empty>Chưa có dự án được công bố.</Empty>}
      </section>
      <SurveyCta />
    </>
  );
}
