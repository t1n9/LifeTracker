import SharePageClient from './SharePageClient';

// 为静态导出生成路径参数
export async function generateStaticParams() {
  // 返回一个示例路径，实际的分享码会在客户端动态处理
  return [{ shareCode: 'example' }];
}

export default function SharePage({ params }: { params: { shareCode: string } }) {
  return <SharePageClient shareCode={params.shareCode} />;
}