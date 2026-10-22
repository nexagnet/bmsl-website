import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Crumbs, Img } from '../../../../components/blocks';
import { JsonLd } from '../../../../components/JsonLd';
import { getProject } from '../../../../lib/cms';
import { buildMetadata } from '../../../../lib/metadata';
import { getSiteUrl, PROJECT_VISIT_LABEL, projectVisitHref } from '../../../../lib/site';
import { breadcrumbLd } from '../../../../lib/structured-data';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const project = await getProject(slug);
  return project ? buildMetadata(project.href, project.name, project.seo, project.summary) : {};
}

export default async function ProjectDetailPage({ params }: Props) {
  const { slug } = await params;
  const project = await getProject(slug);
  if (!project) notFound();
  return (
    <>
      <Crumbs items={[{ label: 'Dự án', href: '/du-an' }, { label: project.name }]} />
      <JsonLd
        data={breadcrumbLd(getSiteUrl(), [
          { name: 'Dự án', path: '/du-an' },
          { name: project.name, path: project.href },
        ])}
      />
      <article className="container hero">
        <div className="hero-card">
          <h1>{project.name}</h1>
          {project.summary ? <p className="lead" style={{ marginBottom: 0 }}>{project.summary}</p> : null}
        </div>
        {project.images.length ? (
          <div style={{ marginTop: '2rem' }}>
            <ul className="grid">
              {project.images.map((image) => (
                <li key={image.id} className="card" style={{ padding: '0.5rem' }}>
                  <Img image={image} sizes="(min-width: 64rem) 25vw, 100vw" />
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {project.facts.length ? (
          <dl className="facts">
            {project.facts.map((f) => (
              <div key={f.label} style={{ display: 'contents' }}>
                <dt>{f.label}</dt>
                <dd>{f.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {project.services.length ? (
          <p style={{ marginTop: '1.5rem', fontWeight: 500 }}>
            Dịch vụ:{' '}
            {project.services.map((s, i) => (
              <span key={s.href}>
                {i > 0 ? ', ' : ''}
                <Link href={s.href}>{s.name}</Link>
              </span>
            ))}
          </p>
        ) : null}
        {project.bqtFeedback ? (
          <section aria-labelledby="bqt-title" className="prose" style={{ marginTop: '2rem' }}>
            <h2 id="bqt-title">Phản hồi của Ban quản trị</h2>
            <blockquote>{project.bqtFeedback}</blockquote>
          </section>
        ) : null}
      </article>
      <section className="survey-cta-section" aria-labelledby="visit-cta-title">
        <div className="container">
          <div className="survey-cta-card">
            <h2 id="visit-cta-title">Tham quan dự án</h2>
            <Link className="button" href={projectVisitHref(project.slug)}>
              {PROJECT_VISIT_LABEL}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
