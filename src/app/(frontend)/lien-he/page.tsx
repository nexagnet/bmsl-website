import { ContactForm } from '../../../components/ContactForm';
import { SingletonPage, singletonMetadata } from '../../../components/SingletonPage';

export const generateMetadata = () => singletonMetadata('contact-page', '/lien-he', 'Liên hệ');

// The form posts to /lien-he/gui, which persists a ContactLead before returning success.
// Hotline, Zalo, address and map stay hidden until BMSL confirms them (CONTACT_DETAILS_REQUIRES_BMSL_CONFIRMATION).
export default function ContactPage() {
  return (
    <SingletonPage slug="contact-page" fallbackTitle="Liên hệ">
      <section className="container section" aria-labelledby="contact-form-title" style={{ paddingTop: '1rem' }}>
        <div className="section-header">
          <div className="kicker">TIẾP NHẬN THÔNG TIN</div>
          <h2 id="contact-form-title">Gửi yêu cầu</h2>
        </div>
        <ContactForm />
      </section>
    </SingletonPage>
  );
}
