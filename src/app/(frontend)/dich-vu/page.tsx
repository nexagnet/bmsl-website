import type { Metadata } from 'next';
import { Empty } from '../../../components/blocks';
import { CtaBand, PageHero, ServiceRows } from '../../../components/catalog';
import { getServices } from '../../../lib/cms';
import { buildMetadata } from '../../../lib/metadata';
import { SERVICE_CTA } from '../../../lib/site';

export const metadata: Metadata = buildMetadata('/dich-vu', 'Dịch vụ');

export default async function ServicesPage() {
  const services = await getServices();
  return (
    <>
      <PageHero overline="Dịch vụ" title="Dịch vụ" lead="Phạm vi, quy trình và cam kết của từng nhóm dịch vụ." />
      {services.length ? (
        <ServiceRows items={services} />
      ) : (
        <section className="container section">
          <Empty>Nội dung đang được cập nhật.</Empty>
        </section>
      )}
      <CtaBand title="Cần khảo sát hiện trạng toà nhà?" text="Để lại thông tin để BMSL liên hệ sắp lịch khảo sát." {...SERVICE_CTA} />
    </>
  );
}
