import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Crumbs, SectionHeading, SurveyCta } from '../../../../components/blocks';
import { PageHero, RelatedServices } from '../../../../components/catalog';
import { JsonLd } from '../../../../components/JsonLd';
import { RichText } from '../../../../components/RichText';
import { getService, getServices } from '../../../../lib/cms';
import { buildMetadata } from '../../../../lib/metadata';
import { getSiteUrl, SERVICE_CTA } from '../../../../lib/site';
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
  const related = (await getServices()).filter((s) => s.slug !== service.slug).slice(0, 3);
  return (
    <>
      <Crumbs items={[{ label: 'Dịch vụ', href: '/dich-vu' }, { label: service.name }]} />
      <JsonLd
        data={breadcrumbLd(getSiteUrl(), [
          { name: 'Dịch vụ', path: '/dich-vu' },
          { name: service.name, path: service.href },
        ])}
      />
      <article>
        <PageHero overline="Dịch vụ" title={service.name} lead={service.summary} />
        <section className="detail-section">
          <div className="container">
            <div className="prose">
              <RichText data={service.body} />
            </div>
          </div>
        </section>
      </article>
      {related.length ? (
        <section className="detail-section tinted">
          <div className="container">
            <SectionHeading id="related-title" overline="Dịch vụ khác" title="Các dịch vụ liên quan" />
            <RelatedServices items={related} />
          </div>
        </section>
      ) : null}
      <SurveyCta title="Đặt lịch khảo sát cho dịch vụ này" cta={SERVICE_CTA} />
    </>
  );
}
