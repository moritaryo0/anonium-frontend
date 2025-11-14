# 環境変数の設定例

## ローカル開発環境

`.env.local`ファイルを作成して以下を設定：

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

## Cloudflare Pages環境変数

Cloudflare Pagesダッシュボードの「設定」→「環境変数」で設定してください。

### 本番環境

```env
NEXT_PUBLIC_API_BASE_URL=https://api.yourdomain.com
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

### プレビュー環境

```env
NEXT_PUBLIC_API_BASE_URL=https://api-staging.yourdomain.com
ALLOWED_ORIGINS=https://preview.yourdomain.com
```

## 環境変数の説明

- `NEXT_PUBLIC_API_BASE_URL`: バックエンドAPIのベースURL
- `ALLOWED_ORIGINS`: CORSで許可するオリジン（カンマ区切り）

