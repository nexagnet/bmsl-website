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
          <h1>Tuyển dụng</h1>
        </div>
      </section>
      <section className="container section">
        {jobs.length ? <JobCards items={jobs} /> : <Empty>Hiện chưa có vị trí tuyển dụng được công bố.</Empty>}
      </section>
      <SurveyCta />
    </>
  );
}
