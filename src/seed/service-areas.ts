import type { Payload } from 'payload';

// The four contracted ServiceArea records (AGENTS.md, blueprint 05/06). Names and slugs are confirmed;
// copy is not, so records are created as drafts with an UNCONFIRMED placeholder summary.
export const SERVICE_AREA_SEED = [
  { name: 'Quản lý vận hành', slug: 'quan-ly-van-hanh', order: 1 },
  { name: 'Bảo vệ', slug: 'bao-ve', order: 2 },
  { name: 'Vệ sinh', slug: 've-sinh', order: 3 },
  { name: 'PCCC', slug: 'pccc', order: 4 },
] as const;

export const SERVICE_AREA_PLACEHOLDER_SUMMARY = 'UNCONFIRMED: chờ BMSL xác nhận nội dung.';

/** Explicit, idempotent: existing records (matched by slug) are never modified. Returns created slugs. */
export async function seedServiceAreas(payload: Payload): Promise<string[]> {
  const created: string[] = [];
  for (const area of SERVICE_AREA_SEED) {
    const existing = await payload.find({
      collection: 'service-areas',
      where: { slug: { equals: area.slug } },
      draft: true,
      limit: 1,
      depth: 0,
    });
    if (existing.totalDocs > 0) continue;
    await payload.create({
      collection: 'service-areas',
      data: { ...area, summary: SERVICE_AREA_PLACEHOLDER_SUMMARY },
      draft: true,
    });
    created.push(area.slug);
  }
  return created;
}
