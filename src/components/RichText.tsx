import { type JSXConvertersFunction, RichText as LexicalRichText } from '@payloadcms/richtext-lexical/react';
import { hasRichText, safeLinkHref } from '../lib/public-content';

type LinkNode = {
  children: unknown[];
  fields: { url?: string; newTab?: boolean; linkType?: string };
};

// Embedded uploads/relationships would bypass the MediaAsset rights gate and the published-only
// rule, so they are never rendered from rich text. Internal doc links are not resolved either, and a link whose
// target is not an http(s)/mailto/tel URL or a same-site path (for example javascript:) is rendered as plain text.
const converters: JSXConvertersFunction = ({ defaultConverters }) => {
  const link = ({ node, nodesToJSX }: { node: LinkNode; nodesToJSX: (args: { nodes: unknown[] }) => React.ReactNode }) => {
    const children = nodesToJSX({ nodes: node.children });
    const href = node.fields.linkType === 'internal' ? undefined : safeLinkHref(node.fields.url);
    if (!href) return <>{children}</>;
    return (
      <a href={href} rel="noopener noreferrer" target={node.fields.newTab ? '_blank' : undefined}>
        {children}
      </a>
    );
  };
  return {
    ...defaultConverters,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    link: link as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    autolink: link as any,
    upload: () => null,
    relationship: () => null,
  };
};

export function RichText({ data }: { data: unknown }) {
  if (!hasRichText(data)) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <LexicalRichText className="prose" data={data as any} converters={converters} />;
}
