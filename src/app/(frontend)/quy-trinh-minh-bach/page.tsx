import { Empty } from '../../../components/blocks';
import { SingletonPage, singletonMetadata } from '../../../components/SingletonPage';
import { getDocuments } from '../../../lib/cms';

export const generateMetadata = () =>
  singletonMetadata('process-page', '/quy-trinh-minh-bach', 'Quy trình & Minh bạch');

export default async function ProcessPage() {
  const documents = await getDocuments();
  return (
    <SingletonPage slug="process-page" fallbackTitle="Quy trình & Minh bạch">
      <section className="container section" aria-labelledby="docs-title">
        <div className="section-header">
          <div className="kicker">CÔNG KHAI & MINH BẠCH</div>
          <h2 id="docs-title">Tài liệu</h2>
        </div>
        {documents.length === 0 ? (
          <Empty>Chưa có tài liệu được công bố.</Empty>
        ) : (
          <ul className="grid">
            {documents.map((d) => (
              <li key={d.id} className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', color: 'var(--color-brand-secondary)' }} aria-hidden="true">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, letterSpacing: '0.05em' }}>Tài liệu tải về</span>
                </div>
                <h3>
                  {/* Hook is inert unless the opt-in analytics provider is mounted and consented; only the id is sent. */}
                  <a href={d.url} data-analytics-event="document_download" data-link-location="documents" data-document-id={d.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                    {d.title}
                  </a>
                </h3>
                {d.description ? <p>{d.description}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </SingletonPage>
  );
}
