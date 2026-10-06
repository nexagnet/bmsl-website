import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Crumbs } from '../../../../components/blocks';
import { JsonLd } from '../../../../components/JsonLd';
import { RichText } from '../../../../components/RichText';
import { getJob } from '../../../../lib/cms';
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
  const job = await getJob(slug);
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
      <article className="container hero">
        <div className="hero-card" style={{ maxWidth: '52rem' }}>
          <div className="kicker">VỊ TRÍ TUYỂN DỤNG</div>
          <h1>{job.title}</h1>
          {/* Salary, benefits and deadline are UNCONFIRMED optional fields: rendered only when present. */}
          {job.salary ? <p className="muted" style={{ fontWeight: 600, margin: '0.25rem 0' }}>Mức lương: {job.salary}</p> : null}
          {deadline ? <p className="muted" style={{ fontWeight: 600, margin: '0.25rem 0 1.5rem' }}>Hạn nộp: {deadline}</p> : null}
          <div className="prose">
            <RichText data={job.description} />
            {hasRichText(job.requirements) ? (
              <section style={{ marginTop: '2rem' }}>
                <h2>Yêu cầu</h2>
                <RichText data={job.requirements} />
              </section>
            ) : null}
            {hasRichText(job.benefits) ? (
              <section style={{ marginTop: '2rem' }}>
                <h2>Quyền lợi</h2>
                <RichText data={job.benefits} />
              </section>
            ) : null}
            {job.applyInstruction ? (
              <section style={{ marginTop: '2rem' }}>
                <h2>Cách ứng tuyển</h2>
                <p>{job.applyInstruction}</p>
              </section>
            ) : null}
          </div>
        </div>
      </article>
    </>
  );
}
