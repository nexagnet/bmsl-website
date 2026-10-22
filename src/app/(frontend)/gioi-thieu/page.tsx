import { AboutSections } from '../../../components/AboutSections';
import { SingletonPage, singletonMetadata } from '../../../components/SingletonPage';

export const generateMetadata = () => singletonMetadata('about-page', '/gioi-thieu', 'Giới thiệu');

export default function AboutPage() {
  return (
    <SingletonPage
      slug="about-page"
      fallbackTitle="Giới thiệu"
      overline="Giới thiệu"
      cta={{
        title: 'Xem các dự án đã thực hiện',
        description: 'Tham khảo hồ sơ dự án được BMSL phê duyệt.',
        cta: { label: 'Xem dự án', href: '/du-an' },
      }}
    >
      <AboutSections />
    </SingletonPage>
  );
}
