'use client';

import { type FormEvent, useEffect, useRef, useState } from 'react';
import { emitAnalyticsEvent, formSubmitParams } from '../lib/analytics';
import { DEFAULT_REQUEST_TYPE, requestTypeFromSearch } from '../lib/request-type';

type State = 'idle' | 'sending' | 'sent' | 'invalid' | 'error';

const FIELD_LABELS: Record<string, string> = {
  name: 'Họ và tên',
  phone: 'Số điện thoại',
  email: 'Email',
  requestType: 'Loại yêu cầu',
  message: 'Nội dung',
  consent: 'Đồng ý xử lý thông tin',
};

export function ContactForm() {
  const [state, setState] = useState<State>('idle');
  const [invalid, setInvalid] = useState<string[]>([]);
  const [requestType, setRequestType] = useState<string>(DEFAULT_REQUEST_TYPE);
  const formRef = useRef<HTMLFormElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);

  // Read after hydration so the page stays statically rendered; unknown values keep the safe default.
  useEffect(() => {
    setRequestType(requestTypeFromSearch(window.location.search));
  }, []);

  // Move focus to the outcome so keyboard and screen-reader users land on it (invalid: first bad field).
  useEffect(() => {
    if (state === 'sent' || state === 'error') alertRef.current?.focus();
    else if (state === 'invalid') formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [state]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const params = new URLSearchParams(window.location.search);
    const utm = Object.fromEntries([...params].filter(([key]) => key.startsWith('utm_')));
    setState('sending');
    try {
      const response = await fetch('/lien-he/gui', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: data.get('name'),
          phone: data.get('phone'),
          email: data.get('email'),
          requestType: data.get('requestType'),
          message: data.get('message'),
          consent: data.get('consent') === 'on',
          website: data.get('website'),
          sourcePage: window.location.pathname,
          utm,
        }),
      });
      if (response.ok) {
        // form_submit only after the server confirms a durable write; honeypot responses lack `persisted`.
        const body: unknown = await response.json().catch(() => null);
        const submitParams = formSubmitParams(response.status, body, data.get('requestType'));
        if (submitParams) emitAnalyticsEvent('form_submit', submitParams);
        form.reset();
        setRequestType(DEFAULT_REQUEST_TYPE);
        setInvalid([]);
        setState('sent');
      } else if (response.status === 400) {
        const body = (await response.json()) as { fields?: string[] };
        setInvalid(body.fields ?? []);
        setState('invalid');
      } else {
        setState('error');
      }
    } catch {
      setState('error');
    }
  }

  const bad = (field: string) => (invalid.includes(field) ? true : undefined);

  return (
    <div className="contact-form-container">
      <form className="contact-form" ref={formRef} onSubmit={onSubmit} noValidate>
        <div className="contact-form-row">
          <label>
            Họ và tên
            <input name="name" required maxLength={120} autoComplete="name" aria-invalid={bad('name')} />
          </label>
          <label>
            Số điện thoại
            <input name="phone" type="tel" required maxLength={20} autoComplete="tel" aria-invalid={bad('phone')} />
          </label>
        </div>
        <label>
          Email (không bắt buộc)
          <input name="email" type="email" maxLength={254} autoComplete="email" aria-invalid={bad('email')} />
        </label>
        <label>
          Loại yêu cầu
          <select name="requestType" required value={requestType} onChange={(e) => setRequestType(e.target.value)} aria-invalid={bad('requestType')}>
            <option value="khao-sat">Khảo sát</option>
            <option value="bao-gia">Báo giá</option>
            <option value="tham-quan">Tham quan</option>
            <option value="khac">Khác</option>
          </select>
        </label>
        <label>
          Nội dung
          <textarea name="message" required maxLength={4000} rows={5} aria-invalid={bad('message')} />
        </label>
        {/* Honeypot: hidden from people and assistive tech; bots that fill it are discarded server-side. */}
        <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px' }}>
          <label>
            Website
            <input name="website" tabIndex={-1} autoComplete="off" />
          </label>
        </div>
        <label className="consent">
          <input name="consent" type="checkbox" required aria-invalid={bad('consent')} />
          Tôi đồng ý để BMSL lưu và sử dụng thông tin này nhằm liên hệ lại về yêu cầu của tôi.
        </label>
        <button type="submit" disabled={state === 'sending'}>
          {state === 'sending' ? 'Đang gửi…' : 'Gửi yêu cầu'}
        </button>
        {/* Typed values are kept on invalid and server-error states so nothing has to be re-entered. */}
        <div className="contact-alert-slot" role="status" aria-live="polite" ref={alertRef} tabIndex={-1}>
          {state === 'sent' && (
            <div className="contact-alert success">
              <strong>Đã nhận yêu cầu của bạn</strong>
              <p>BMSL sẽ phản hồi qua thông tin bạn đã cung cấp.</p>
            </div>
          )}
          {state === 'invalid' && <p className="contact-alert error">{`Vui lòng kiểm tra: ${invalid.map((f) => FIELD_LABELS[f] ?? f).join(', ')}.`}</p>}
          {state === 'error' && <p className="contact-alert error">Chưa gửi được yêu cầu. Nội dung bạn đã nhập vẫn được giữ, vui lòng thử lại sau.</p>}
        </div>
      </form>
    </div>
  );
}
