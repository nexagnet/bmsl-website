'use client';

import { type FormEvent, useState } from 'react';
import { trackEvent } from '../lib/analytics-client';
import { postContact } from '../lib/contact-client';

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

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const params = new URLSearchParams(window.location.search);
    const utm = Object.fromEntries([...params].filter(([key]) => key.startsWith('utm_')));
    setState('sending');
    const requestType = data.get('requestType');
    const outcome = await postContact(
      fetch,
      {
        name: data.get('name'),
        phone: data.get('phone'),
        email: data.get('email'),
        requestType,
        message: data.get('message'),
        consent: data.get('consent') === 'on',
        website: data.get('website'),
        sourcePage: window.location.pathname,
        utm,
      },
      // Analytics only after the server confirmed durable persistence; the payload is the request type alone.
      () => trackEvent('form_submit', { request_type: requestType }),
    );
    if (outcome.state === 'sent') form.reset();
    setInvalid(outcome.fields);
    setState(outcome.state);
  }

  const bad = (field: string) => (invalid.includes(field) ? true : undefined);

  return (
    <form className="contact-form" onSubmit={onSubmit} noValidate>
      <label>
        Họ và tên
        <input name="name" required maxLength={120} autoComplete="name" aria-invalid={bad('name')} />
      </label>
      <label>
        Số điện thoại
        <input name="phone" type="tel" required maxLength={20} autoComplete="tel" aria-invalid={bad('phone')} />
      </label>
      <label>
        Email (không bắt buộc)
        <input name="email" type="email" maxLength={254} autoComplete="email" aria-invalid={bad('email')} />
      </label>
      <label>
        Loại yêu cầu
        <select name="requestType" required defaultValue="khao-sat" aria-invalid={bad('requestType')}>
          <option value="khao-sat">Khảo sát</option>
          <option value="bao-gia">Báo giá</option>
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
      <p role="status" aria-live="polite">
        {state === 'sent' && 'Đã nhận yêu cầu. BMSL sẽ liên hệ lại.'}
        {state === 'invalid' && `Vui lòng kiểm tra: ${invalid.map((f) => FIELD_LABELS[f] ?? f).join(', ')}.`}
        {state === 'error' && 'Chưa gửi được yêu cầu. Vui lòng thử lại sau.'}
      </p>
    </form>
  );
}
