import type { Metadata } from 'next';
import { Empty, JobCards, SurveyCta } from '../../../components/blocks';
import { getJobs } from '../../../lib/cms';
import { buildMetadata } from '../../../lib/metadata';

export const metadata: Metadata = buildMetadata('/tuyen-dung', 'Tuyển dụng');

export default async function JobsPage() {
  const jobs = await getJobs();
  return (
    <>
      <section className="container hero">
        <div className="hero-card">
          <div className="kicker">CƠ HỘI NGHỀ NGHIỆP</div>
          <h1>Tuyển dụng</h1>
          <p className="lead" style={{ marginBottom: 0 }}>
            Gia nhập đội ngũ BMSL để phát triển sự nghiệp trong môi trường quản lý vận hành bất động sản chuyên nghiệp và chuẩn mực.
          </p>
        </div>
      </section>
      <section className="container section" style={{ paddingTop: '1rem' }}>
        {jobs.length ? <JobCards items={jobs} /> : <Empty>Hiện chưa có vị trí tuyển dụng được công bố.</Empty>}
      </section>
      <SurveyCta />
    </>
  );
}
