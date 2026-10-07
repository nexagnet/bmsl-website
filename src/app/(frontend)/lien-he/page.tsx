import { ContactForm } from '../../../components/ContactForm';
import { OfficeMap } from '../../../components/OfficeMap';
import { SingletonPage, singletonMetadata } from '../../../components/SingletonPage';
import { getSiteSettings } from '../../../lib/cms';

export const generateMetadata = () => singletonMetadata('contact-page', '/lien-he', 'Liên hệ');

// The form posts to /lien-he/gui, which persists a ContactLead before returning success.
// Address and map render only from published, validated SiteSettings; otherwise nothing is shown or requested
// (CONTACT_DETAILS_REQUIRES_BMSL_CONFIRMATION).
export default async function ContactPage() {
  const { address, map } = await getSiteSettings();
  return (
    <SingletonPage slug="contact-page" fallbackTitle="Liên hệ">
      {address || map ? (
        <section className="container section" aria-labelledby="contact-office-title">
          <h2 id="contact-office-title">Trụ sở</h2>
          {address ? <p>{address}</p> : null}
          {map ? <OfficeMap embedSrc={map.embedSrc} linkHref={map.linkHref} /> : null}
        </section>
      ) : null}
      <section className="container section" aria-labelledby="contact-form-title">
        <h2 id="contact-form-title">Gửi yêu cầu</h2>
        <ContactForm />
      </section>
    </SingletonPage>
  );
}
