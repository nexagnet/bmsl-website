// Publication gate for customer facts (W5B2). A project may carry unconfirmed legacy facts as a DRAFT, but it can only be
// published with address/scale/operating-since/BQT feedback once its sourceStatus is CONFIRMED by the owner/customer.
// The public mappers (public-content.ts) apply the same rule when rendering, as a second line of defence.

type Doc = Record<string, unknown>;

const asDoc = (v: unknown): Doc => (typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Doc) : {});
const filled = (v: unknown): boolean => typeof v === 'string' && v.trim() !== '';

export const customerFactFields = ['address', 'scale', 'operatingSince'] as const;

/** The document as it would be stored after the operation: the stored document overlaid with the incoming change. */
export const mergeForPublishCheck = (original: unknown, data: unknown): Doc => ({
  ...asDoc(original),
  ...asDoc(data),
  bqtFeedback: { ...asDoc(asDoc(original).bqtFeedback), ...asDoc(asDoc(data).bqtFeedback) },
});

/** Returns the reason publication must be refused, or undefined when it is allowed. */
export function publishGateProblem(doc: Doc): string | undefined {
  if (doc._status !== 'published' || doc.sourceStatus === 'CONFIRMED') return undefined;
  const hasFacts = customerFactFields.some((f) => filled(doc[f])) || filled(asDoc(doc.bqtFeedback).text);
  return hasFacts
    ? 'Không thể xuất bản thông tin khách hàng khi sourceStatus chưa là CONFIRMED: giữ ở trạng thái nháp cho tới khi nguồn xác nhận.'
    : undefined;
}
