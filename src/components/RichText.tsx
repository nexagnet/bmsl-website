import { type JSXConvertersFunction, RichText as LexicalRichText } from '@payloadcms/richtext-lexical/react';
import { hasRichText } from '../lib/public-content';

// Embedded uploads/relationships would bypass the MediaAsset rights gate and the published-only
// rule, so they are never rendered from rich text. Internal doc links are not resolved either.
const converters: JSXConvertersFunction = ({ defaultConverters }) => ({
  ...defaultConverters,
  upload: () => null,
  relationship: () => null,
});

export function RichText({ data }: { data: unknown }) {
  if (!hasRichText(data)) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <LexicalRichText className="prose" data={data as any} converters={converters} />;
}
