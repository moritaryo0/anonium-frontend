import { createRequestHandler } from '@cloudflare/next-on-pages/dist/handler.js';
import manifest from '__STATIC_CONTENT_MANIFEST';

/**
 * Next.js on Cloudflare Pages の拡張 Worker
 * - Next.js SSR / Middleware / RSC を createRequestHandler で処理
 * - 追加のセキュリティヘッダー
 * - CORS 設定
 * - JWT Cookie 認証 / OAuth を阻害しない
 */

export default {
  async fetch(request, env, ctx) {
    // まず Next.js の SSR を実行する（必須）
    const response = await createRequestHandler({
      request,
      env,
      ctx,
      manifest,
    });

    // レスポンスを編集可能な形でコピー
    const newResponse = new Response(response.body, response);

    // ----------- セキュリティヘッダー -----------
    newResponse.headers.set('X-Content-Type-Options', 'nosniff');
    newResponse.headers.set('X-Frame-Options', 'DENY');
    newResponse.headers.set('X-XSS-Protection', '1; mode=block');
    newResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

    // ----------- CORS 設定 -----------
    const origin = request.headers.get('Origin');
    
    // 自分のフロントエンドだけ許可したいならここを固定する：
    // const allowed = ["https://example.com"];
    // if (allowed.includes(origin)) ...

    if (origin) {
      newResponse.headers.set('Access-Control-Allow-Origin', origin);
      newResponse.headers.set('Access-Control-Allow-Credentials', 'true');
      newResponse.headers.set(
        'Access-Control-Allow-Methods',
        'GET, POST, PUT, DELETE, OPTIONS'
      );
      newResponse.headers.set(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization'
      );
    }

    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: newResponse.headers,
      });
    }

    return newResponse;
  },
};
