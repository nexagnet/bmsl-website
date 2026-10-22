import type { Metadata } from 'next';
import { Empty } from '../../../components/blocks';
import { CtaBand, JobGrid, PageHero } from '../../../components/content-ui';
import { getJobs, getSiteSettings } from '../../../lib/cms';
import { buildMetadata } from '../../../lib/metadata';

export const metadata: Metadata = buildMetadata('/tuyen-dung', 'Tuyển dụng');

export default async function JobsPage() {
  const [jobs, settings] = await Promise.all([getJobs(), getSiteSettings()]);
  return (
    <>
      <PageHero overline="TUYỂN DỤNG" title="Cùng làm việc với BMSL" />
      <section className="pg-section">
        <div className="container">
          {jobs.length ? <JobGrid items={jobs} /> : <Empty>Hiện chưa có vị trí tuyển dụng được công bố.</Empty>}
        </div>
      </section>
      {/* The Zalo apply CTA appears only once a validated Zalo contact is published in SiteSettings. */}
      {settings.zalo ? (
        <CtaBand title="Ứng tuyển nhanh qua Zalo">
          <a
            className="button gold"
            href={settings.zalo.href}
            rel="noopener"
            data-analytics-event="zalo_click"
            data-link-location="jobs_cta"
          >
            Nộp hồ sơ qua Zalo
          </a>
        </CtaBand>
      ) : null}
    </>
  );
}
