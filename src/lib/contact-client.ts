// Browser-side submit flow for the contact form, kept free of React/DOM so the analytics ordering is unit-testable.

export type ContactState = 'sent' | 'invalid' | 'error';
export type ContactOutcome = { state: ContactState; fields: string[] };

type FetchLike = (input: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}>;

/**
 * Posts the lead and reports the outcome. `onPersisted` (the form_submit analytics hook) is called only when the
 * server answered 200 with `persisted: true`, i.e. after the ContactLead row is durably stored. Invalid input,
 * honeypot hits (200 without `persisted`), server failures and network errors never call it. It receives no lead data.
 */
export async function postContact(
  fetchFn: FetchLike,
  payload: Record<string, unknown>,
  onPersisted: () => void,
): Promise<ContactOutcome> {
  try {
    const response = await fetchFn('/lien-he/gui', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (response.ok) {
      const body = (await response.json().catch(() => null)) as { persisted?: unknown } | null;
      if (body?.persisted === true) {
        try {
          onPersisted();
        } catch {
          // Analytics must never affect the visitor's result.
        }
      }
      return { state: 'sent', fields: [] };
    }
    if (response.status === 400) {
      const body = (await response.json().catch(() => ({}))) as { fields?: string[] };
      return { state: 'invalid', fields: body.fields ?? [] };
    }
    return { state: 'error', fields: [] };
  } catch {
    return { state: 'error', fields: [] };
  }
}
