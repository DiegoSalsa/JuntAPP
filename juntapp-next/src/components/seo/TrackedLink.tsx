'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { trackSeoEvent, type SeoEventName } from '@/lib/seo/events';

export default function TrackedLink({
  href,
  className,
  children,
  event,
  cta,
  sourceSection,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
  event: SeoEventName;
  cta: string;
  sourceSection: string;
}) {
  const pathname = usePathname();
  return (
    <Link
      href={href}
      className={className}
      onClick={() => trackSeoEvent(event, { page: pathname, cta, source_section: sourceSection })}
    >
      {children}
    </Link>
  );
}
