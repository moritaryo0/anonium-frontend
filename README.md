This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Deploy on Cloudflare Pages

このプロジェクトはCloudflare Pagesに最適化されています。

### クイックスタート

1. **Cloudflare Pagesダッシュボードで設定**
   - **Build command**: `npm run pages:build`
   - **Build output directory**: `.vercel/output/static`
   - **Root directory**: `/frontend` (リポジトリのルートがプロジェクトルートの場合)
   - **Deploy command**: （**削除してください** - 自動デプロイでは不要です）

2. **環境変数を設定**
   ```
   NEXT_PUBLIC_API_BASE_URL=https://api.yourdomain.com
   ALLOWED_ORIGINS=https://yourdomain.com
   ```

3. **デプロイ**
   - GitHubにプッシュすると自動デプロイされます

詳細な設定方法は [`.cloudflare-pages.md`](./.cloudflare-pages.md) を参照してください。

### 最適化済み機能

✅ Edge Runtime対応（動的ルート）  
✅ セキュリティヘッダー自動追加  
✅ 画像最適化  
✅ Gzip圧縮  
✅ CORS設定  
✅ 互換性フラグ設定済み  

### 注意事項

- `@cloudflare/next-on-pages@1.13.16`は非推奨です。将来的には[OpenNext adapter](https://opennext.js.org/cloudflare)への移行を検討してください。
- `.npmrc`に`legacy-peer-deps=true`を設定して依存関係の競合を回避しています。
