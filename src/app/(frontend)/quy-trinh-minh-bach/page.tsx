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
        <h2 id="docs-title">Tài liệu</h2>
        {documents.length === 0 ? (
          <Empty>Chưa có tài liệu được công bố.</Empty>
        ) : (
          <ul className="grid">
            {documents.map((d) => (
              <li key={d.id} className="card">
                <h3>
                  <a href={d.url} data-analytics-event="document_download" data-analytics-document-id={d.id}>
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
