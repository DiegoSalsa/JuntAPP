import HomeProductMap from '@/components/seo/HomeProductMap';
import JsonLd from '@/components/seo/JsonLd';
import OriginalPublicPage from '@/components/original/OriginalPublicPage';
import { publicMetadata } from '@/lib/seo/metadata';
import { softwareApplicationSchema } from '@/lib/seo/schema';
import { HOME_DESCRIPTION, HOME_TITLE } from '@/lib/seo/site';

export const metadata = publicMetadata({
  title: HOME_TITLE,
  description: HOME_DESCRIPTION,
  path: '/',
  absoluteTitle: true,
});

export default function HomePage() {
  return (
    <>
      <JsonLd data={softwareApplicationSchema()} />
      <OriginalPublicPage view="home">
        <HomeProductMap />
      </OriginalPublicPage>
    </>
  );
}
