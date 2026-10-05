// Publication gate for projects (W5B2). Every project claim (name, summary, services, images, address, scale,
// operating-since, BQT feedback) is a customer fact that stays UNCONFIRMED until the owner/customer confirmed its
// source. A project may therefore only be PUBLISHED with sourceStatus=CONFIRMED, whatever fields it fills in; the 17
// imported legacy profiles stay drafts. The public mapper (public-content.ts) and the REST read access
// (collections/content.ts) apply the same rule to data stored before this gate existed.

type Doc = Record<string, unknown>;

const asDoc = (v: unknown): Doc => (typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Doc) : {});

/** The document as it would be stored after the operation: the stored document overlaid with the incoming change. */
export const mergeForPublishCheck = (original: unknown, data: unknown): Doc => ({
  ...asDoc(original),
  ...asDoc(data),
  bqtFeedback: { ...asDoc(asDoc(original).bqtFeedback), ...asDoc(asDoc(data).bqtFeedback) },
});

/** Returns the reason publication must be refused, or undefined when it is allowed. */
export function publishGateProblem(doc: Doc): string | undefined {
  if (doc._status !== 'published' || doc.sourceStatus === 'CONFIRMED') return undefined;
  return 'Không thể xuất bản dự án khi sourceStatus chưa là CONFIRMED: giữ ở trạng thái nháp cho tới khi nguồn xác nhận.';
}
