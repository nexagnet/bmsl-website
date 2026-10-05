import type { Metadata } from 'next';
import { Empty, ServiceCards, SurveyCta } from '../../../components/blocks';
import { getServices } from '../../../lib/cms';
import { buildMetadata } from '../../../lib/metadata';

export const metadata: Metadata = buildMetadata('/dich-vu', 'Dịch vụ');

export default async function ServicesPage() {
  const services = await getServices();
  return (
    <>
      <section className="container hero">
        <h1>Dịch vụ</h1>
        {services.length ? <ServiceCards items={services} /> : <Empty>Nội dung đang được cập nhật.</Empty>}
      </section>
      <SurveyCta />
    </>
  );
}
