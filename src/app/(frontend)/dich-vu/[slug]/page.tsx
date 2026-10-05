import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Crumbs, SurveyCta } from '../../../../components/blocks';
import { RichText } from '../../../../components/RichText';
import { getService } from '../../../../lib/cms';
import { buildMetadata } from '../../../../lib/metadata';
import { paths } from '../../../../lib/site';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const service = await getService(slug);
  return service ? buildMetadata(paths.service(slug), service.name, service.seo, service.summary) : {};
}

export default async function ServiceDetailPage({ params }: Props) {
  const { slug } = await params;
  const service = await getService(slug);
  if (!service) notFound();
  return (
    <>
      <Crumbs items={[{ label: 'Dịch vụ', href: '/dich-vu' }, { label: service.name }]} />
      <article className="container hero">
        <h1>{service.name}</h1>
        {service.summary ? <p>{service.summary}</p> : null}
        <RichText data={service.body} />
      </article>
      <SurveyCta />
    </>
  );
}
