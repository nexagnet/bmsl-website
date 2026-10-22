import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Crumbs } from '../../../../components/blocks';
import { JsonLd } from '../../../../components/JsonLd';
import { RichText } from '../../../../components/RichText';
import { getJob, getSiteSettings } from '../../../../lib/cms';
import { buildMetadata } from '../../../../lib/metadata';
import { formatDate, hasRichText } from '../../../../lib/public-content';
import { getSiteUrl } from '../../../../lib/site';
import { breadcrumbLd, confirmedJobPostingLd } from '../../../../lib/structured-data';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const job = await getJob(slug);
  return job ? buildMetadata(job.href, job.title, job.seo) : {};
}

export default async function JobDetailPage({ params }: Props) {
  const { slug } = await params;
  const [job, settings] = await Promise.all([getJob(slug), getSiteSettings()]);
  if (!job) notFound();
  const deadline = formatDate(job.deadline);
  return (
    <>
      <Crumbs items={[{ label: 'Tuyển dụng', href: '/tuyen-dung' }, { label: job.title }]} />
      <JsonLd
        data={breadcrumbLd(getSiteUrl(), [
          { name: 'Tuyển dụng', path: '/tuyen-dung' },
          { name: job.title, path: job.href },
        ])}
      />
      {/* JobPosting only with operator-entered datePosted and location (public jobs are CONFIRMED); otherwise none. */}
      <JsonLd data={confirmedJobPostingLd(getSiteUrl(), job)} />
      <article className="pg-section" style={{ paddingTop: '3rem' }}>
        <div className="container job-detail">
          <div>
            <h1>{job.title}</h1>
            <div className="prose">
              <RichText data={job.description} />
              {hasRichText(job.requirements) ? (
                <section>
                  <h2>Yêu cầu</h2>
                  <RichText data={job.requirements} />
                </section>
              ) : null}
              {hasRichText(job.benefits) ? (
                <section>
                  <h2>Quyền lợi</h2>
                  <RichText data={job.benefits} />
                </section>
              ) : null}
              {job.applyInstruction ? (
                <section>
                  <h2>Cách ứng tuyển</h2>
                  <p>{job.applyInstruction}</p>
                </section>
              ) : null}
            </div>
          </div>
          {/* Salary and deadline are UNCONFIRMED optional fields: rendered only when present. The Zalo CTA needs a published Zalo. */}
          {job.salary || deadline || settings.zalo ? (
            <aside className="apply-box" aria-label="Thông tin ứng tuyển">
              {job.salary || deadline ? (
                <dl className="meta-table">
                  {job.salary ? (
                    <div className="meta-row">
                      <dt>Lương</dt>
                      <dd>{job.salary}</dd>
                    </div>
                  ) : null}
                  {deadline ? (
                    <div className="meta-row">
                      <dt>Hạn nộp</dt>
                      <dd>{deadline}</dd>
                    </div>
                  ) : null}
                </dl>
              ) : null}
              {settings.zalo ? (
                <a
                  className="button"
                  href={settings.zalo.href}
                  rel="noopener"
                  data-analytics-event="zalo_click"
                  data-link-location="job_detail"
                >
                  Nộp hồ sơ qua Zalo
                </a>
              ) : null}
            </aside>
          ) : null}
        </div>
      </article>
    </>
  );
}
