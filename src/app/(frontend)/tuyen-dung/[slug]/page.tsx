import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Crumbs } from '../../../../components/blocks';
import { RichText } from '../../../../components/RichText';
import { getJob } from '../../../../lib/cms';
import { buildMetadata } from '../../../../lib/metadata';
import { formatDate, hasRichText } from '../../../../lib/public-content';
import { JsonLd } from '../../../../components/JsonLd';
import { breadcrumbLd } from '../../../../lib/seo';
import { getSiteUrl, paths } from '../../../../lib/site';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const job = await getJob(slug);
  return job ? buildMetadata(paths.job(slug), job.title, job.seo) : {};
}

export default async function JobDetailPage({ params }: Props) {
  const { slug } = await params;
  const job = await getJob(slug);
  if (!job) notFound();
  const deadline = formatDate(job.deadline);
  return (
    <>
      <JsonLd
        data={breadcrumbLd(getSiteUrl(), [
          { name: 'Tuyển dụng', path: '/tuyen-dung' },
          { name: job.title, path: job.href },
        ])}
      />
      {/* JobPosting is not emitted: published jobs have no datePosted/jobLocation (jobPostingLd requires them). */}
      <Crumbs items={[{ label: 'Tuyển dụng', href: '/tuyen-dung' }, { label: job.title }]} />
      <article className="container hero">
        <h1>{job.title}</h1>
        {/* Salary, benefits and deadline are UNCONFIRMED optional fields: rendered only when present. */}
        {job.salary ? <p>Mức lương: {job.salary}</p> : null}
        {deadline ? <p>Hạn nộp: {deadline}</p> : null}
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
      </article>
    </>
  );
}
