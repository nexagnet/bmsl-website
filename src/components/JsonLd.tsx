import { serializeJsonLd } from '../lib/seo';

/** Inline JSON-LD. The payload is escaped by serializeJsonLd, so CMS text cannot close the script tag or inject markup. */
export function JsonLd({ data }: { data: Record<string, unknown> | undefined }) {
  if (!data) return null;
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}
