import { Empty, Overline } from '../../../components/blocks';
import { CtaBand, DocumentGrid, PageHero } from '../../../components/content-ui';
import { RichText } from '../../../components/RichText';
import { singletonMetadata } from '../../../components/SingletonPage';
import { getDocuments, getPage } from '../../../lib/cms';
import { hasRichText } from '../../../lib/public-content';

export const generateMetadata = () =>
  singletonMetadata('process-page', '/quy-trinh-minh-bach', 'Quy trình & Minh bạch');

export default async function ProcessPage() {
  const [page, documents] = await Promise.all([getPage('process-page'), getDocuments()]);
  // The contract CTA is "Tải báo cáo mẫu": offered only for an approved document that is actually titled as a report.
  const sampleReport = documents.find((d) => /báo cáo/i.test(d.title));
  return (
    <>
      <PageHero overline="QUY TRÌNH & MINH BẠCH" title={page?.title ?? 'Quy trình & Minh bạch'} />
      <section className="pg-prose">
        <div className="container">
          {page && hasRichText(page.body) ? (
            <div className="prose">
              <RichText data={page.body} />
            </div>
          ) : (
            <Empty>Nội dung đang được cập nhật.</Empty>
          )}
        </div>
      </section>
      {page?.steps.length ? (
        <section className="pg-section white" id="quy-trinh" aria-labelledby="steps-title">
          <div className="container">
            <Overline>QUY TRÌNH</Overline>
            <h2 className="pg-title" id="steps-title">
              Các bước thực hiện
            </h2>
            <ol className="process-steps">
              {page.steps.map((step, i) => (
                <li key={`${i}-${step.title}`}>
                  <h3>{step.title}</h3>
                  {step.duration ? <p className="process-step-duration">{step.duration}</p> : null}
                  {step.description ? <p>{step.description}</p> : null}
                </li>
              ))}
            </ol>
          </div>
        </section>
      ) : null}
      <section className="pg-section pale" id="tai-lieu" aria-labelledby="docs-title">
        <div className="container">
          <Overline>TÀI LIỆU</Overline>
          <h2 className="pg-title" id="docs-title">
            Tài liệu tải về
          </h2>
          {documents.length === 0 ? <Empty>Chưa có tài liệu được công bố.</Empty> : <DocumentGrid items={documents} />}
        </div>
      </section>
      {sampleReport ? (
        <CtaBand title="Xem báo cáo mẫu">
          <a
            className="button gold"
            href={sampleReport.url}
            data-analytics-event="document_download"
            data-link-location="cta_band"
            data-document-id={sampleReport.id}
          >
            Tải báo cáo mẫu
          </a>
        </CtaBand>
      ) : null}
    </>
  );
}
