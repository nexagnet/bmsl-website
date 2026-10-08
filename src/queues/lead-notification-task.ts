import type { TaskConfig } from 'payload';
import { deliverLeadNotification, TASK_SLUG } from '../lib/lead-notification';

// Payload Jobs Queue task for ContactLead e-mail (Issue #82). The input is only the lead id: no personal data is ever
// stored in the job row or its log. A transient failure throws a code-only error, so the queue's own exponential
// backoff retries it; every attempt first claims the lead's outbox row, so duplicate/stale jobs cannot send twice.
export const sendLeadNotificationTask: TaskConfig = {
  slug: TASK_SLUG,
  label: 'Gửi email thông báo yêu cầu liên hệ',
  inputSchema: [{ name: 'leadId', type: 'number', required: true }],
  outputSchema: [{ name: 'result', type: 'text' }],
  retries: { attempts: 6, backoff: { type: 'exponential', delay: 30_000 } },
  handler: async ({ input, req }) => {
    const result = await deliverLeadNotification(req.payload, (input as { leadId: number }).leadId);
    return { output: { result } };
  },
};
