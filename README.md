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

このプロジェクトはCloudflare Pagesにデプロイできます。

### ビルド設定

Cloudflare Pagesのダッシュボードで以下の設定を行ってください：

- **Build command**: `npm run pages:build`
- **Build output directory**: `.vercel/output/static`
- **Root directory**: `/frontend` (プロジェクトのルートがリポジトリのルートの場合)

または、自動検出を使用する場合は、ビルドコマンドを空にして、Cloudflare Pagesに自動検出させることができます。その場合、`package.json`に`@cloudflare/next-on-pages`と`vercel`が依存関係として追加されているため、自動的に正しいバージョンが使用されます。

### 注意事項

- `@cloudflare/next-on-pages@1.13.16`は非推奨です。将来的には[OpenNext adapter](https://opennext.js.org/cloudflare)への移行を検討してください。
- 現在の設定では、`vercel@48.10.2`が明示的に追加されています。これにより、ビルド時の依存関係エラーを回避できます。
