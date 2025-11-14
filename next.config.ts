import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // パフォーマンス最適化
  compress: true, // Gzip圧縮を有効化
  poweredByHeader: false, // X-Powered-Byヘッダーを無効化（セキュリティ）
  
  // 画像最適化（必要に応じて）
  images: {
    // 画像最適化を有効化（必要に応じて設定）
    // domains: ['your-image-domain.com'],
  },
};

export default nextConfig;
