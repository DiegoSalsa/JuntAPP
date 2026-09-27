import Link from 'next/link';

const TOKEN = /\{(\/[a-z0-9\-\/]+)\|([^}]+)\}/g;

export default function RichText({ text }: { text: string }) {
  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  for (const match of text.matchAll(TOKEN)) {
    const index = match.index ?? 0;
    if (index > cursor) nodes.push(text.slice(cursor, index));
    const href = match[1];
    const label = match[2];
    nodes.push(<Link href={href} key={`${href}-${index}`}>{label}</Link>);
    cursor = index + match[0].length;
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return <>{nodes}</>;
}
