import type { ReactNode } from 'react';
import { ContactForm } from '../../../components/ContactForm';
import { Overline } from '../../../components/blocks';
import { RichText } from '../../../components/RichText';
import { singletonMetadata } from '../../../components/SingletonPage';
import { getPage, getSiteSettings } from '../../../lib/cms';
import { hasRichText } from '../../../lib/public-content';

export const generateMetadata = () => singletonMetadata('contact-page', '/lien-he', 'Liên hệ');

// The form posts to /lien-he/gui, which persists a ContactLead before returning success.
// Hotline, Zalo, email, address and map link come only from published SiteSettings (UNCONFIRMED until BMSL fills
// them in the CMS); a missing value is simply not rendered, never replaced by a placeholder or a guess.
export default async function ContactPage() {
  const [page, settings] = await Promise.all([getPage('contact-page'), getSiteSettings()]);
  const candidates: ({ key: string; node: ReactNode } | undefined)[] = [
    settings.hotline ? { key: 'Hotline', node: <a href={settings.hotline.href} data-analytics-event="phone_click" data-link-location="contact">{settings.hotline.label}</a> } : undefined,
    settings.zalo ? { key: 'Zalo', node: <a href={settings.zalo.href} rel="noopener" data-analytics-event="zalo_click" data-link-location="contact">Nhắn tin qua Zalo</a> } : undefined,
    settings.email ? { key: 'Email', node: <a href={settings.email.href}>{settings.email.address}</a> } : undefined,
    settings.address ? {
      key: 'Địa chỉ',
      node: (
        <>
          <span>{settings.address.text}</span>
          <a className="contact-map-link" href={settings.address.mapHref} target="_blank" rel="noopener noreferrer">
            Xem bản đồ (mở trong tab mới)
          </a>
        </>
      ),
    } : undefined,
  ];
  const rows = candidates.filter((row) => row !== undefined);

  return (
    <>
      <section className="page-hero contact-hero">
        <div className="container">
          <Overline>Liên hệ</Overline>
          <h1>Gửi yêu cầu cho BMSL</h1>
          <p className="page-hero-lead">Điền form để BMSL liên hệ lại với bạn.</p>
        </div>
      </section>
      <section className="section section-white" aria-label="Gửi yêu cầu và thông tin liên hệ">
        <div className="container contact-layout">
          <div className="contact-form-col">
            <h2 className="visually-hidden">Gửi yêu cầu</h2>
            <ContactForm />
          </div>
          <aside className="contact-info" aria-labelledby="contact-info-title">
            <h2 id="contact-info-title" className="visually-hidden">
              Thông tin liên hệ
            </h2>
            {rows.length ? (
              <dl className="contact-info-list">
                {rows.map((row) => (
                  <div className="contact-info-row" key={row.key}>
                    <dt>{row.key}</dt>
                    <dd>{row.node}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="muted">Thông tin liên hệ trực tiếp sẽ được cập nhật tại đây. Trong lúc này, bạn có thể gửi yêu cầu bằng form.</p>
            )}
          </aside>
        </div>
      </section>
      {page && hasRichText(page.body) ? (
        <section className="section section-white" aria-label="Thông tin thêm">
          <div className="container prose">
            <RichText data={page.body} />
          </div>
        </section>
      ) : null}
    </>
  );
}
