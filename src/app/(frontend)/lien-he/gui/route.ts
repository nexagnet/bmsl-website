import config from '@payload-config';
import { getPayload } from 'payload';
import { submitContact } from '../../../../lib/contact-submission';

// Write-only public endpoint: it never returns lead data, and there is no GET/PUT/DELETE here.
const MAX_BODY_BYTES = 16_384;

export async function POST(request: Request) {
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > MAX_BODY_BYTES) return Response.json({ ok: false, fields: [] }, { status: 413 });

  let raw: unknown;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return Response.json({ ok: false, fields: [] }, { status: 413 });
    raw = JSON.parse(text);
  } catch {
    return Response.json({ ok: false, fields: [] }, { status: 400 });
  }

  const result = await submitContact(await getPayload({ config }), raw);
  return Response.json(result.body, { status: result.status });
}
