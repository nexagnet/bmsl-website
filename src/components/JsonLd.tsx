import { type JsonLd as JsonLdData, serializeJsonLd } from '../lib/seo';

/** Inline structured data; serializeJsonLd escapes `<`, `>`, `&` and line separators so values cannot break out of the script. */
export function JsonLd({ data }: { data: JsonLdData | null | undefined }) {
  if (!data) return null;
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}
