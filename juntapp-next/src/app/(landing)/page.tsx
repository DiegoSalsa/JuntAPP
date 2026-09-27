import HomeProductMap from '@/components/seo/HomeProductMap';
import JsonLd from '@/components/seo/JsonLd';
import OriginalPublicPage from '@/components/original/OriginalPublicPage';
import { publicMetadata } from '@/lib/seo/metadata';
import { softwareApplicationSchema } from '@/lib/seo/schema';
import { DEFAULT_DESCRIPTION } from '@/lib/seo/site';

export const metadata = publicMetadata({
  title: 'JuntAPP | Software para juntas de vecinos en Chile',
  description: DEFAULT_DESCRIPTION,
  path: '/',
  absoluteTitle: true,
});

export default function HomePage() {
  return (
    <>
      <JsonLd data={softwareApplicationSchema('/', DEFAULT_DESCRIPTION)} />
      <OriginalPublicPage view="home">
        <HomeProductMap />
      </OriginalPublicPage>
    </>
  );
}
