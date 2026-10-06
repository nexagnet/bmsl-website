import { describe, expect, it } from 'vitest';
import { decodeEntities, parseHtml } from './html';
import {
  cleanLinkUrl,
  EMAIL_PLACEHOLDER,
  htmlToLexical,
  isFilenameLikeAlt,
  lexicalPlainText,
  MEDIA_KEY_FIELD,
  PHONE_PLACEHOLDER,
  type ConvertOptions,
  type LexNode,
} from './lexical';

// Synthetic HTML only. These tests pin the generator's conversion rules; they say nothing about real legacy content.
const convert = (html: string, image?: ConvertOptions['image']) =>
  htmlToLexical(html, { idSeed: 'test', image: image ?? (() => ({ kind: 'pending' })) });
const types = (nodes: LexNode[]) => nodes.map((n) => n.type);

describe('html parser', () => {
  it('decodes named and numeric entities and keeps unknown ones verbatim', () => {
    expect(decodeEntities('a&nbsp;b &amp; &#8211; &#x2013; &unknown;')).toBe('a b & – – &unknown;');
  });

  it('builds a tree, ignores comments and drops script/style bodies', () => {
    const tree = parseHtml('<p>x<!-- c --><script>alert(1)</script><br>y</p>');
    expect(JSON.stringify(tree)).not.toContain('alert');
    expect(tree).toHaveLength(1);
  });
});

describe('htmlToLexical', () => {
  it('keeps paragraphs, bold/italic/underline, headings and lists with their text', () => {
    const { doc } = convert(
      '<p>Xin <strong>chào</strong> <em>các</em> <u>bạn</u></p><h3>Tiêu đề</h3><ul><li>Một</li><li>Hai</li></ul><ol><li>Số 1</li></ol>',
    );
    expect(types(doc.root.children)).toEqual(['paragraph', 'heading', 'list', 'list']);
    const para = doc.root.children[0]!.children as LexNode[];
    expect(para.map((n) => [n.text, n.format])).toEqual([
      ['Xin ', 0],
      ['chào', 1],
      [' ', 0],
      ['các', 2],
      [' ', 0],
      ['bạn', 8],
    ]);
    expect(doc.root.children[2]).toMatchObject({ listType: 'bullet', tag: 'ul' });
    expect(doc.root.children[3]).toMatchObject({ listType: 'number', tag: 'ol' });
    expect(lexicalPlainText(doc)).toBe('Xin chào các bạn\nTiêu đề\nMột\nHai\nSố 1');
  });

  it('demotes h1 to h2 (the page owns the h1) and reports it', () => {
    const { doc, notes } = convert('<h1>A</h1><h4>B</h4><h6>C</h6>');
    expect(doc.root.children.map((n) => n.tag)).toEqual(['h2', 'h4', 'h4']);
    expect(notes).toContainEqual({ kind: 'heading-demoted', detail: 'h1->h2' });
  });

  it('drops empty paragraphs made of spaces and &nbsp;', () => {
    const { doc } = convert('<p>&nbsp;</p><p> </p><p>Nội dung</p><p>&nbsp;&nbsp;</p>');
    expect(doc.root.children).toHaveLength(1);
  });

  it('keeps nested lists as a list item holding the nested list', () => {
    const { doc } = convert('<ul><li>Cha<ul><li>Con</li></ul></li></ul>');
    const items = doc.root.children[0]!.children as LexNode[];
    expect(items).toHaveLength(2);
    expect(items[1]!.children).toEqual([expect.objectContaining({ type: 'list' })]);
  });

  it('puts every list item, also nested ones, on its own line in the plain text used for fidelity checks', () => {
    const { doc } = convert('<ul><li>Cha<ul><li>Con một</li><li>Con hai</li></ul></li><li>Cha hai</li></ul>');
    expect(lexicalPlainText(doc)).toBe('Cha\nCon một\nCon hai\nCha hai');
  });

  it('places a committed image as an upload node at its original position and records pending ones by position', () => {
    const { doc, images } = convert(
      '<p>Trước</p><p><img src="https://x.test/a.jpg" alt="A"></p><p>Giữa</p><p><img src="https://x.test/b.jpg"></p><p>Sau</p>',
      ({ src }) => (src.endsWith('a.jpg') ? { kind: 'media', key: 'sha256:aaa' } : { kind: 'pending' }),
    );
    expect(types(doc.root.children)).toEqual(['paragraph', 'upload', 'paragraph', 'paragraph']);
    expect(doc.root.children[1]).toMatchObject({
      type: 'upload',
      relationTo: 'media-assets',
      value: { [MEDIA_KEY_FIELD]: 'sha256:aaa' },
      fields: null,
      version: 3,
    });
    expect(images.map((i) => [i.src.split('/').pop(), i.placement.kind, i.blockIndex])).toEqual([
      ['a.jpg', 'media', 1],
      ['b.jpg', 'pending', 3],
    ]);
  });

  it('gives upload nodes deterministic ids', () => {
    const run = () => convert('<p><img src="u"></p>', () => ({ kind: 'media', key: 'k' })).doc.root.children[0]!.id;
    expect(run()).toBe(run());
    expect(run()).toMatch(/^[0-9a-f]{24}$/);
  });

  it('treats an image-only anchor as the image and splits mixed text/image paragraphs', () => {
    const { doc, images } = convert('<p>Trước <a href="https://x.test/full.jpg"><img src="s"></a> sau</p>', () => ({
      kind: 'media',
      key: 'k',
    }));
    expect(types(doc.root.children)).toEqual(['paragraph', 'upload', 'paragraph']);
    expect(images).toHaveLength(1);
  });

  it('keeps a caption as an italic paragraph after its image', () => {
    const { doc } = convert('<figure><img src="s"><figcaption>Chú thích</figcaption></figure>', () => ({ kind: 'media', key: 'k' }));
    expect(types(doc.root.children)).toEqual(['upload', 'paragraph']);
    expect((doc.root.children[1]!.children as LexNode[])[0]).toMatchObject({ text: 'Chú thích', format: 2 });
  });

  it('drops scripts, styles, iframes and shortcodes and reports each one', () => {
    const { doc, notes } = convert(
      '<p>A [gallery ids="1"] B</p><iframe src="https://video.example/embed/1"></iframe><script>x()</script><style>p{}</style>',
    );
    expect(lexicalPlainText(doc)).toBe('A B');
    expect(notes.map((n) => n.kind)).toEqual(expect.arrayContaining(['shortcode-dropped', 'iframe-dropped']));
    expect(notes).toContainEqual({ kind: 'iframe-dropped', detail: 'video.example' });
  });

  it('flattens unknown block markup instead of losing its text, and reports the element', () => {
    const { doc, notes } = convert('<custom-box><p>Giữ lại</p></custom-box>');
    expect(lexicalPlainText(doc)).toBe('Giữ lại');
    expect(notes).toContainEqual({ kind: 'unknown-element-flattened', detail: 'custom-box' });
  });

  it('redacts phone numbers and e-mail addresses (also in mailto/tel links) and counts them', () => {
    const { doc, notes } = convert(
      '<p>M: 0965 943 250 | 0978.638.124 E: a.b@example.test <a href="mailto:a.b@example.test">mail</a> <a href="tel:0965943250">gọi</a></p>',
    );
    const text = lexicalPlainText(doc);
    expect(text).not.toMatch(/0965|0978|example\.test/);
    expect(text).toContain(PHONE_PLACEHOLDER);
    expect(text).toContain(EMAIL_PLACEHOLDER);
    expect(notes.filter((n) => n.kind === 'redacted-phone')).toHaveLength(2);
    expect(notes.filter((n) => n.kind === 'link-dropped')).toHaveLength(2);
  });

  it('does not mistake document numbers, years or dates for phone numbers', () => {
    const text = lexicalPlainText(
      convert('<p>Thông tư 28/2016/TT-BXD, giấy xác nhận số 101/GXN-PCCC ngày 04/05/2021, 630 căn hộ, năm 2024.</p>').doc,
    );
    expect(text).toContain('28/2016/TT-BXD');
    expect(text).toContain('04/05/2021');
    expect(text).not.toContain(PHONE_PLACEHOLDER);
  });

  it('keeps https links, strips tracking parameters and drops unsafe schemes', () => {
    expect(cleanLinkUrl('https://www.facebook.com/p/x/?mibextid=LQQJ4d&keep=1')).toBe('https://www.facebook.com/p/x/?keep=1');
    expect(cleanLinkUrl('javascript:alert(1)')).toBeUndefined();
    expect(cleanLinkUrl('data:text/html,x')).toBeUndefined();
    expect(cleanLinkUrl('not a url')).toBeUndefined();
    const { doc, notes } = convert('<p><a href="javascript:alert(1)">bad</a> <a href="https://ok.test/x">ok</a></p>');
    const kids = doc.root.children[0]!.children as LexNode[];
    expect(kids.some((n) => n.type === 'link')).toBe(true);
    expect(JSON.stringify(doc)).not.toContain('javascript:');
    expect(notes).toContainEqual({ kind: 'link-dropped', detail: 'unsafe-or-invalid' });
  });

  it('drops links back to the legacy site but keeps their text, and reports them', () => {
    const { doc, notes } = convert('<p>Xem <a href="https://binhminhsonglo.vn/bai-khac/">bài khác</a> và <a href="https://ok.test/x">nguồn</a></p>');
    expect(lexicalPlainText(doc)).toBe('Xem bài khác và nguồn');
    expect(JSON.stringify(doc)).not.toContain('binhminhsonglo.vn');
    expect(notes).toContainEqual({ kind: 'link-dropped', detail: 'legacy-site-link' });
  });

  it('recognises WordPress file-name alt text as "no description"', () => {
    expect(isFilenameLikeAlt('Z6128654384679 07dff50005ef35b3aef4226b52bcf854')).toBe(true);
    expect(isFilenameLikeAlt('IMG_7549')).toBe(true);
    expect(isFilenameLikeAlt('photo.jpg')).toBe(true);
    expect(isFilenameLikeAlt('')).toBe(true);
    expect(isFilenameLikeAlt('Toà nhà B-IA20 Ciputra Hà Nội')).toBe(false);
  });
});
