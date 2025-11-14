import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // パフォーマンス最適化
  compress: true, // Gzip圧縮を有効化
  poweredByHeader: false, // X-Powered-Byヘッダーを無効化（セキュリティ）
  
  // Cloudflare Pages最適化
  // output: 'standalone' は Cloudflare Pages では不要（@cloudflare/next-on-pages が自動処理）
  
  // 画像最適化
  images: {
    // リモート画像のドメインを設定（必要に応じて）
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**', // すべてのHTTPSドメインを許可（本番環境では制限推奨）
      },
    ],
    // Cloudflare Pagesでの画像最適化
    unoptimized: false, // 画像最適化を有効化
  },
  
  // 実験的機能（Next.js 15の新機能）
  experimental: {
    // 必要に応じて実験的機能を有効化
  },
  
  // リダイレクト・リライト設定（必要に応じて）
  // async redirects() {
  //   return [
  //     {
  //       source: '/old-path',
  //       destination: '/new-path',
  //       permanent: true,
  //     },
  //   ];
  // },
};

export default nextConfig;
