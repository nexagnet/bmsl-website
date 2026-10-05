import { SingletonPage, singletonMetadata } from '../../../components/SingletonPage';

export const generateMetadata = () => singletonMetadata('about-page', '/gioi-thieu', 'Giới thiệu');

export default function AboutPage() {
  return <SingletonPage slug="about-page" fallbackTitle="Giới thiệu" />;
}
