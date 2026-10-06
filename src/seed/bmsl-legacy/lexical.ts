import { createHash } from 'node:crypto';
import { type HElement, type HNode, isElement, parseHtml, textOf } from './html';

// Converts WordPress body HTML into a Payload Lexical document for the seed pack (GENERATOR side only).
// Allowed output: paragraphs, h2-h4 headings, bullet/number lists, bold/italic/underline/strike text, safe http(s)
// links, line breaks and `upload` nodes whose `value` is a media KEY (`{ $mediaKey }`) that the offline loader replaces
// with the real media-assets id. Scripts, iframes, styles, shortcodes and unknown markup are dropped AND reported.

export type LexNode = Record<string, unknown>;
export type LexicalDoc = {
  root: { type: 'root'; format: ''; indent: 0; version: 1; direction: 'ltr'; children: LexNode[] };
};

export const MEDIA_KEY_FIELD = '$mediaKey';

export type ConvertNote = {
  kind:
    | 'iframe-dropped'
    | 'script-or-style-dropped'
    | 'shortcode-dropped'
    | 'unknown-element-flattened'
    | 'table-flattened'
    | 'heading-demoted'
    | 'link-dropped'
    | 'redacted-phone'
    | 'redacted-email'
    | 'image-inside-list-hoisted';
  detail?: string;
};

export type ImagePlacement = { kind: 'media'; key: string } | { kind: 'pending' };

export type ConvertOptions = {
  /** Stable seed for deterministic node ids (for example the record key). */
  idSeed: string;
  /** Decides what happens to an <img>: a committed asset, or pending (not imported, position still recorded). */
  image: (img: { src: string; alt: string; index: number }) => ImagePlacement;
};

export type ConvertResult = {
  doc: LexicalDoc;
  notes: ConvertNote[];
  /** Every <img> in source order with where it sits in the output (index of the block that follows/holds it). */
  images: { src: string; alt: string; placement: ImagePlacement; blockIndex: number }[];
};

export const PHONE_PLACEHOLDER = '[số điện thoại — chờ BMSL xác nhận]';
export const EMAIL_PLACEHOLDER = '[email — chờ BMSL xác nhận]';

const PHONE = /(?<![\d])(?:\+?84|0)(?:[\s.-]?\d){8,10}(?!\d)/g;
const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const SPACES = new RegExp(`[\\s${String.fromCharCode(0xa0)}]+`, 'g');
const LEGACY_HOST = /(^|\.)binhminhsonglo\.vn$/;
const SHORTCODE = /\[\/?[a-z_]+(?:\s[^\]]*)?\]/gi;

const FORMAT = { bold: 1, italic: 2, strike: 4, underline: 8 } as const;
const TRACKING_PARAMS = /^(utm_|fbclid|mibextid|igshid|gclid)/i;
const INLINE_TOP = new Set(['a', 'strong', 'b', 'em', 'i', 'u', 'span', 'br', 'font', 'small', 'mark']);

const asLexText = (text: string, format: number): LexNode => ({
  type: 'text',
  text,
  format,
  detail: 0,
  mode: 'normal',
  style: '',
  version: 1,
});

const blockBase = { format: '', indent: 0, version: 1, direction: 'ltr' } as const;

/** Safe link target or undefined: http(s) only (mailto/tel are contact data and are redacted instead). */
export function cleanLinkUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    for (const key of [...url.searchParams.keys()]) if (TRACKING_PARAMS.test(key)) url.searchParams.delete(key);
    return url.toString();
  } catch {
    return undefined;
  }
}

/** WordPress fills alt with the file name when nobody wrote one; such text is not a description. */
export function isFilenameLikeAlt(alt: string): boolean {
  const a = alt.trim();
  return (
    a === '' ||
    /^[A-Za-z]?\d{6,}[\s_-]/.test(a) ||
    /^(img|image|dsc|screenshot)[\s_-]?\d*$/i.test(a) ||
    /\.(jpe?g|png|gif|webp)$/i.test(a) ||
    /^[0-9a-f]{8}[\s-][0-9a-f]{4}/i.test(a)
  );
}

const nodeId = (seed: string, n: number) => createHash('sha256').update(`${seed}#${n}`).digest('hex').slice(0, 24);

const safeHost = (src?: string): string | undefined => {
  try {
    return src ? new URL(src, 'https://invalid.example').hostname : undefined;
  } catch {
    return undefined;
  }
};

type Run = LexNode[];

export function htmlToLexical(html: string, options: ConvertOptions): ConvertResult {
  const notes: ConvertNote[] = [];
  const images: ConvertResult['images'] = [];
  const blocks: LexNode[] = [];
  const hoisted: HElement[] = [];
  let uploadCount = 0;
  const note = (kind: ConvertNote['kind'], detail?: string) => notes.push(detail === undefined ? { kind } : { kind, detail });

  const pushText = (run: Run, raw: string, format: number) => {
    let text = raw.replace(SPACES, ' ');
    text = text.replace(SHORTCODE, () => {
      note('shortcode-dropped');
      return '';
    });
    text = text.replace(EMAIL, () => {
      note('redacted-email');
      return EMAIL_PLACEHOLDER;
    });
    text = text.replace(PHONE, () => {
      note('redacted-phone');
      return PHONE_PLACEHOLDER;
    });
    text = text.replace(/ {2,}/g, ' ');
    if (text === '') return;
    const last = run[run.length - 1];
    if (last && last.type === 'text' && last.format === format) last.text = `${last.text as string}${text}`;
    else run.push(asLexText(text, format));
  };

  const trimRun = (run: Run): Run => {
    while (run.length && run[0]!.type === 'linebreak') run.shift();
    while (run.length && run[run.length - 1]!.type === 'linebreak') run.pop();
    const first = run[0];
    if (first && first.type === 'text') first.text = (first.text as string).replace(/^ +/, '');
    const last = run[run.length - 1];
    if (last && last.type === 'text') last.text = (last.text as string).replace(/ +$/, '');
    return run.filter((n) => n.type !== 'text' || (n.text as string) !== '');
  };

  const hasContent = (run: Run) =>
    run.some((n) => n.type !== 'linebreak' && (n.type !== 'text' || (n.text as string).trim() !== ''));

  const isImageOnlyAnchor = (el: HElement) =>
    el.tag === 'a' && el.children.some((c) => isElement(c) && c.tag === 'img') && !textOf(el).trim();

  const emitParagraph = (run: Run, tag?: 'h2' | 'h3' | 'h4') => {
    const children = trimRun(run);
    if (!hasContent(children)) return;
    blocks.push(
      tag ? { type: 'heading', tag, ...blockBase, children } : { type: 'paragraph', ...blockBase, textFormat: 0, children },
    );
  };

  const emitImage = (img: HElement) => {
    const src = img.attrs.src ?? '';
    const alt = (img.attrs.alt ?? '').trim();
    const placement = options.image({ src, alt, index: images.length });
    images.push({ src, alt, placement, blockIndex: blocks.length });
    if (placement.kind !== 'media') return;
    blocks.push({
      type: 'upload',
      version: 3,
      format: '',
      id: nodeId(options.idSeed, uploadCount++),
      relationTo: 'media-assets',
      value: { [MEDIA_KEY_FIELD]: placement.key },
      fields: null,
    });
  };

  /** Walks inline nodes into `run`. Block-level children flush the current run first. */
  const inline = (nodes: HNode[], format: number, run: Run, flush: () => void): void => {
    for (const node of nodes) {
      if (!isElement(node)) {
        pushText(run, node.text, format);
        continue;
      }
      switch (node.tag) {
        case 'br':
          run.push({ type: 'linebreak', version: 1 });
          break;
        case 'strong':
        case 'b':
          inline(node.children, format | FORMAT.bold, run, flush);
          break;
        case 'em':
        case 'i':
          inline(node.children, format | FORMAT.italic, run, flush);
          break;
        case 'u':
          inline(node.children, format | FORMAT.underline, run, flush);
          break;
        case 'del':
        case 's':
        case 'strike':
          inline(node.children, format | FORMAT.strike, run, flush);
          break;
        case 'img':
          flush();
          emitImage(node);
          break;
        case 'a': {
          if (isImageOnlyAnchor(node)) {
            // The anchor of an image-only link points at the full-size file: the image itself is the content.
            inline(node.children, format, run, flush);
            break;
          }
          const cleaned = cleanLinkUrl(node.attrs.href);
          // A link back to the legacy site would break once the old URLs are gone (only 46 of them redirect): the text
          // stays, the link is dropped and reported so staff can re-link it to the new page.
          const legacyLink = !!cleaned && LEGACY_HOST.test(new URL(cleaned).hostname);
          const url = legacyLink ? undefined : cleaned;
          const children: Run = [];
          inline(node.children, format, children, flush);
          if (!url) {
            const href = node.attrs.href;
            if (href) note('link-dropped', legacyLink ? 'legacy-site-link' : /^(mailto|tel):/i.test(href) ? 'contact-link' : 'unsafe-or-invalid');
            run.push(...children);
          } else if (children.length) {
            run.push({
              type: 'link',
              ...blockBase,
              version: 3,
              fields: { linkType: 'custom', url, newTab: false },
              children,
            });
          }
          break;
        }
        case 'iframe':
          flush();
          note('iframe-dropped', safeHost(node.attrs.src));
          break;
        case 'script':
        case 'style':
          note('script-or-style-dropped', node.tag);
          break;
        case 'span':
        case 'font':
        case 'small':
        case 'mark':
        case 'sup':
        case 'sub':
          inline(node.children, format, run, flush);
          break;
        default:
          flush();
          blockElement(node);
      }
    }
  };

  const listNode = (el: HElement): LexNode => {
    const ordered = el.tag === 'ol';
    const items: LexNode[] = [];
    let value = 1;
    for (const child of el.children) {
      if (!isElement(child) || child.tag !== 'li') continue;
      const run: Run = [];
      const nested: LexNode[] = [];
      for (const n of child.children) {
        if (isElement(n) && (n.tag === 'ul' || n.tag === 'ol')) nested.push(listNode(n));
        else if (isElement(n) && n.tag === 'img') {
          // Lexical list items hold text only: the image is kept and emitted right after the list.
          note('image-inside-list-hoisted');
          hoisted.push(n);
        } else inline([n], 0, run, () => undefined);
      }
      const children = trimRun(run);
      if (hasContent(children)) items.push({ type: 'listitem', value: value++, ...blockBase, children });
      for (const sub of nested) items.push({ type: 'listitem', value: value++, ...blockBase, children: [sub] });
    }
    return { type: 'list', listType: ordered ? 'number' : 'bullet', start: 1, tag: ordered ? 'ol' : 'ul', ...blockBase, children: items };
  };

  function blockElement(el: HElement): void {
    switch (el.tag) {
      case 'p':
      case 'div':
      case 'section':
      case 'article':
      case 'center':
      case 'figure':
      case 'figcaption':
      case 'blockquote':
      case 'main':
      case 'td':
      case 'th':
      case 'li': {
        if (el.tag === 'blockquote') note('unknown-element-flattened', 'blockquote');
        const run: Run = [];
        const flush = () => emitParagraph(run.splice(0));
        // A caption stays visible as an italic paragraph next to its image.
        inline(el.children, el.tag === 'figcaption' ? FORMAT.italic : 0, run, flush);
        flush();
        break;
      }
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
      case 'h5':
      case 'h6': {
        const level = Number(el.tag[1]);
        if (el.tag === 'h1') note('heading-demoted', 'h1->h2');
        const run: Run = [];
        inline(el.children, 0, run, () => undefined);
        emitParagraph(run, level <= 2 ? 'h2' : level === 3 ? 'h3' : 'h4');
        break;
      }
      case 'ul':
      case 'ol': {
        const list = listNode(el);
        if ((list.children as LexNode[]).length) blocks.push(list);
        for (const img of hoisted.splice(0)) emitImage(img);
        break;
      }
      case 'table':
        note('table-flattened');
        for (const child of el.children) if (isElement(child)) blockElement(child);
        break;
      case 'thead':
      case 'tbody':
      case 'tfoot':
      case 'tr':
        for (const child of el.children) if (isElement(child)) blockElement(child);
        break;
      case 'hr':
        break;
      case 'img':
        emitImage(el);
        break;
      case 'iframe':
        note('iframe-dropped', safeHost(el.attrs.src));
        break;
      case 'script':
      case 'style':
        note('script-or-style-dropped', el.tag);
        break;
      default: {
        note('unknown-element-flattened', el.tag);
        const run: Run = [];
        const flush = () => emitParagraph(run.splice(0));
        inline(el.children, 0, run, flush);
        flush();
      }
    }
  }

  // Top level: loose text/inline nodes gather into paragraphs; block elements convert one by one.
  const run: Run = [];
  const flushTop = () => emitParagraph(run.splice(0));
  for (const node of parseHtml(html)) {
    if (!isElement(node) || INLINE_TOP.has(node.tag)) inline([node], 0, run, flushTop);
    else {
      flushTop();
      blockElement(node);
    }
  }
  flushTop();

  return { doc: { root: { type: 'root', ...blockBase, children: blocks } }, notes, images };
}

/** Plain text of a converted document (headings, paragraphs, list items on their own lines), used for fidelity checks. */
export function lexicalPlainText(doc: LexicalDoc): string {
  const walk = (n: LexNode): string => {
    if (n.type === 'text') return n.text as string;
    if (n.type === 'linebreak') return '\n';
    const kids = ((n.children as LexNode[] | undefined) ?? []).map(walk);
    return kids.join(n.type === 'list' ? '\n' : '');
  };
  return doc.root.children
    .filter((block) => block.type !== 'upload')
    .map(walk)
    .join('\n');
}
