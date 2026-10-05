import { Empty } from '../../../components/blocks';
import { SingletonPage, singletonMetadata } from '../../../components/SingletonPage';

export const generateMetadata = () => singletonMetadata('contact-page', '/lien-he', 'Liên hệ');

// Information shell only: no form and no POST here (ContactLead submission is a separate task).
// Hotline, Zalo, address and map stay hidden until BMSL confirms them (CONTACT_DETAILS_REQUIRES_BMSL_CONFIRMATION).
export default function ContactPage() {
  return (
    <SingletonPage slug="contact-page" fallbackTitle="Liên hệ">
      <section className="container section" aria-labelledby="contact-form-title">
        <h2 id="contact-form-title">Gửi yêu cầu</h2>
        <Empty>Biểu mẫu liên hệ sẽ sớm được cung cấp.</Empty>
      </section>
    </SingletonPage>
  );
}
