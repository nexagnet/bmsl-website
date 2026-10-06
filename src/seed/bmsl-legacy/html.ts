// Minimal, dependency-free HTML parser for the seed-pack GENERATOR (never used at seed time or by the website).
// It reads WordPress "classic editor" output: well-formed tags, a few entities, no scripting. Anything it does not
// understand is returned as an ordinary element so the converter can report it instead of silently dropping it.

export type HText = { text: string };
export type HElement = { tag: string; attrs: Record<string, string>; children: HNode[] };
export type HNode = HText | HElement;

export const isElement = (n: HNode): n is HElement => 'tag' in n;

const VOID = new Set(['img', 'br', 'hr', 'meta', 'input', 'link', 'source', 'wbr']);
const RAW_TEXT = new Set(['script', 'style']);

const NAMED: Record<string, string> = {
  nbsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  hellip: '…',
  ndash: '–',
  mdash: '—',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  laquo: '«',
  raquo: '»',
  bull: '•',
  middot: '·',
};

export function decodeEntities(input: string): string {
  return input.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z][a-zA-Z0-9]*);/g, (match, body: string) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return NAMED[body] ?? match;
  });
}

function parseAttrs(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const m of raw.matchAll(/([a-zA-Z_:][-\w:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g)) {
    attrs[m[1]!.toLowerCase()] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? '');
  }
  return attrs;
}

export function parseHtml(html: string): HNode[] {
  const root: HElement = { tag: '#root', attrs: {}, children: [] };
  const stack: HElement[] = [root];
  const top = () => stack[stack.length - 1]!;
  const token = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>|[^<]+|</g;
  let m: RegExpExecArray | null;
  let rawUntil: string | undefined;
  while ((m = token.exec(html))) {
    const [whole, closing, rawTag, rawAttrs] = m;
    if (whole.startsWith('<!--')) continue;
    if (rawUntil) {
      if (closing && rawTag!.toLowerCase() === rawUntil) rawUntil = undefined;
      continue;
    }
    if (!rawTag) {
      top().children.push({ text: decodeEntities(whole) });
      continue;
    }
    const tag = rawTag.toLowerCase();
    if (closing) {
      const at = stack.map((e) => e.tag).lastIndexOf(tag);
      if (at > 0) stack.length = at;
      continue;
    }
    const element: HElement = { tag, attrs: parseAttrs(rawAttrs ?? ''), children: [] };
    top().children.push(element);
    if (RAW_TEXT.has(tag)) rawUntil = tag;
    else if (!VOID.has(tag) && !whole.endsWith('/>')) stack.push(element);
  }
  return root.children;
}

/** Concatenated visible text of a node (no tags); `<br>` becomes a newline. */
export function textOf(node: HNode): string {
  if (!isElement(node)) return node.text;
  if (node.tag === 'br') return '\n';
  return node.children.map(textOf).join('');
}
