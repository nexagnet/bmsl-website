import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Crumbs, SurveyCta } from '../../../../components/blocks';
import { JsonLd } from '../../../../components/JsonLd';
import { RichText } from '../../../../components/RichText';
import { getService } from '../../../../lib/cms';
import { buildMetadata } from '../../../../lib/metadata';
import { getSiteUrl } from '../../../../lib/site';
import { breadcrumbLd } from '../../../../lib/structured-data';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const service = await getService(slug);
  return service ? buildMetadata(service.href, service.name, service.seo, service.summary) : {};
}

export default async function ServiceDetailPage({ params }: Props) {
  const { slug } = await params;
  const service = await getService(slug);
  if (!service) notFound();
  return (
    <>
      <Crumbs items={[{ label: 'Dịch vụ', href: '/dich-vu' }, { label: service.name }]} />
      <JsonLd
        data={breadcrumbLd(getSiteUrl(), [
          { name: 'Dịch vụ', path: '/dich-vu' },
          { name: service.name, path: service.href },
        ])}
      />
      <article className="container hero">
        <div className="hero-card">
          <div className="kicker">DỊCH VỤ CHUYÊN SÂU</div>
          <h1>{service.name}</h1>
          {service.summary ? <p className="lead">{service.summary}</p> : null}
          <div className="prose">
            <RichText data={service.body} />
          </div>
        </div>
      </article>
      <SurveyCta />
    </>
  );
}
