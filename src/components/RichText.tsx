import { type JSXConvertersFunction, RichText as LexicalRichText } from '@payloadcms/richtext-lexical/react';
import { hasRichText, safeLinkHref, toPublicImage } from '../lib/public-content';

type LinkNode = {
  children: unknown[];
  fields: { url?: string; newTab?: boolean; linkType?: string };
};

// Embedded relationships would bypass the published-only rule, so they are never rendered from rich text, and
// internal doc links are not resolved either. An embedded UPLOAD (an inline image) goes through the same gate as every
// other public image, toPublicImage(): it renders only when the media document was populated by the public read path
// (overrideAccess:false) AND its rightsStatus is APPROVED AND its URL is a same-site media path. An unconfirmed or
// unreadable image, a bare id or any other upload renders nothing, at the position where it sits in the text.
// A link whose target is not an http(s)/mailto/tel URL or a same-site path (for example javascript:) is plain text.
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
  const upload = ({ node }: { node: { value?: unknown } }) => {
    const image = toPublicImage(node.value);
    if (!image) return null;
    return (
      <figure>
        {/* Plain <img>: Next's optimizer is disabled until a rights-aware pipeline exists (see blocks.tsx Img). */}
        <img
          src={image.url}
          alt={image.alt}
          {...(image.width && image.height ? { width: image.width, height: image.height } : {})}
          loading="lazy"
          decoding="async"
        />
      </figure>
    );
  };
  return {
    ...defaultConverters,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    link: link as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    autolink: link as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    upload: upload as any,
    relationship: () => null,
  };
};

export function RichText({ data }: { data: unknown }) {
  if (!hasRichText(data)) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <LexicalRichText className="prose" data={data as any} converters={converters} />;
}
