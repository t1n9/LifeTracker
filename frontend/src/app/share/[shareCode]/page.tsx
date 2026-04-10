import SharePageClient from './SharePageClient';

export async function generateStaticParams() {
  return [{ shareCode: 'example' }];
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ shareCode: string }>;
}) {
  const { shareCode } = await params;

  return <SharePageClient shareCode={shareCode} />;
}
