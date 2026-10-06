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
        <div className="hero-card">
          <div className="kicker">GIẢI PHÁP VẬN HÀNH</div>
          <h1>Dịch vụ</h1>
          <p className="lead" style={{ marginBottom: 0 }}>
            Hệ thống giải pháp quản lý vận hành tòa nhà, bảo vệ an ninh, vệ sinh công nghiệp và an toàn PCCC theo chuẩn mực chuyên nghiệp.
          </p>
        </div>
      </section>
      <section className="container section" style={{ paddingTop: '1rem' }}>
        {services.length ? <ServiceCards items={services} /> : <Empty>Nội dung đang được cập nhật.</Empty>}
      </section>
      <SurveyCta />
    </>
  );
}
