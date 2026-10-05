import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Crumbs, Img, SurveyCta } from '../../../../components/blocks';
import { getProject } from '../../../../lib/cms';
import { buildMetadata } from '../../../../lib/metadata';
import { breadcrumbJsonLd } from '../../../../lib/seo';
import { getSiteUrl, paths } from '../../../../lib/site';
import { JsonLd } from '../../../../components/JsonLd';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const project = await getProject(slug);
  return project ? buildMetadata(paths.project(slug), project.name, project.seo, project.summary) : {};
}

export default async function ProjectDetailPage({ params }: Props) {
  const { slug } = await params;
  const project = await getProject(slug);
  if (!project) notFound();
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd(getSiteUrl(), [
          { name: 'Dự án', path: '/du-an' },
          { name: project.name, path: project.href },
        ])}
      />
      <Crumbs items={[{ label: 'Dự án', href: '/du-an' }, { label: project.name }]} />
      <article className="container hero">
        <h1>{project.name}</h1>
        {project.summary ? <p>{project.summary}</p> : null}
        {project.images.length ? (
          <ul className="grid">
            {project.images.map((image) => (
              <li key={image.id}>
                <Img image={image} sizes="(min-width: 64rem) 25vw, 100vw" />
              </li>
            ))}
          </ul>
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
          <p>
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
          <section aria-labelledby="bqt-title">
            <h2 id="bqt-title">Phản hồi của Ban quản trị</h2>
            <blockquote>{project.bqtFeedback}</blockquote>
          </section>
        ) : null}
      </article>
      <SurveyCta />
    </>
  );
}
