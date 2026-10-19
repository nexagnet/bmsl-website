import Link from 'next/link';
import { SingletonPage, singletonMetadata } from '../../../components/SingletonPage';
import { ABOUT_CTA } from '../../../lib/site';

export const generateMetadata = () => singletonMetadata('about-page', '/gioi-thieu', 'Giới thiệu');

export default function AboutPage() {
  return (
    <SingletonPage slug="about-page" fallbackTitle="Giới thiệu">
      <section className="container section" aria-label="Dự án">
        <p>
          <Link className="button" href={ABOUT_CTA.href}>
            {ABOUT_CTA.label}
          </Link>
        </p>
      </section>
    </SingletonPage>
  );
}
