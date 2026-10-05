import { serializeJsonLd } from '../lib/structured-data';

/** Renders already-built JSON-LD; renders nothing when a builder declined to emit (undefined). */
export function JsonLd({ data }: { data: Record<string, unknown> | undefined }) {
  if (!data) return null;
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}
