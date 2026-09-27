import JsonLd from '@/components/seo/JsonLd';
import { organizationSchema, schemaGraph, websiteSchema } from '@/lib/seo/schema';

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={schemaGraph([organizationSchema(), websiteSchema()])} />
      {children}
    </>
  );
}
