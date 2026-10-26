import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const dynamic = 'force-static';

/** Stable URL for the admin tab icon (`admin.meta.icons`): serves the same BMSL favicon file as the public site. */
export async function GET() {
  const file = path.join(process.cwd(), 'src', 'app', '(frontend)', 'icon.jpg');
  return new Response(await readFile(file), {
    headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=86400' },
  });
}
