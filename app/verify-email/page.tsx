"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token"); // 後方互換性のため残す
  const email = searchParams.get("email") || "";

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  useEffect(() => {
    // 後方互換性: トークンがクエリパラメータにある場合は自動的に認証を試みる
    if (token) {
      // successパラメータがある場合は既に認証済み
      const success = searchParams.get("success");
      if (success === "true") {
        setSuccess(true);
        // トークンからユーザー情報を取得するためにAPIを呼び出す
        handleVerification(token);
      } else {
        handleVerification(token);
      }
    }
  }, [token, searchParams]);

  async function handleVerification(verificationToken: string) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/api/accounts/verify-email/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: verificationToken }),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.detail || "認証に失敗しました。");
        return;
      }
      // 認証成功
      setSuccess(true);
      // セキュリティ対策: JWTトークンはCookieに自動保存されるため、localStorageには保存しない
      // 3秒後にホームページにリダイレクト
      setTimeout(() => {
        router.replace("/");
      }, 3000);
    } catch (err) {
      setError("ネットワークエラーが発生しました。");
    } finally {
      setLoading(false);
    }
  }

  async function handleCodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    
    // 6桁の数字コードを検証
    const trimmedCode = code.trim().replace(/\D/g, ''); // 数字以外を削除
    if (trimmedCode.length !== 6) {
      setError("6桁の数字コードを入力してください。");
      return;
    }
    
    await handleVerification(trimmedCode);
  }

  async function handleResend() {
    if (!email) {
      setError("メールアドレスが指定されていません。");
      return;
    }
    setResendLoading(true);
    setError("");
    setResendSuccess(false);
    try {
      const res = await fetch(`${API}/api/accounts/resend-verification/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.detail || "メールの再送信に失敗しました。");
        return;
      }
      setResendSuccess(true);
    } catch (err) {
      setError("ネットワークエラーが発生しました。");
    } finally {
      setResendLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-lg border border-subtle surface-1 p-6">
        <h1 className="text-xl font-semibold mb-4">メールアドレス認証</h1>
        
        {success ? (
          <div className="space-y-4">
            <div className="text-green-500 text-sm">
              メールアドレスの認証が完了しました。3秒後にホームページにリダイレクトします。
            </div>
            <Link
              href="/"
              className="block w-full text-center rounded-md px-4 py-2 bg-accent text-white hover:opacity-90"
            >
              ホームページに戻る
            </Link>
          </div>
        ) : token ? (
          // 後方互換性: トークンがクエリパラメータにある場合
          <div className="space-y-4">
            {loading ? (
              <div className="text-sm">認証中...</div>
            ) : error ? (
              <div className="space-y-4">
                <div className="text-sm text-red-500">{error}</div>
                {email && (
                  <button
                    onClick={handleResend}
                    disabled={resendLoading}
                    className="w-full rounded-md px-4 py-2 bg-accent text-white hover:opacity-90 disabled:opacity-60"
                  >
                    {resendLoading ? "送信中..." : "認証メールを再送信"}
                  </button>
                )}
              </div>
            ) : (
              <div className="text-sm">認証を処理しています...</div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-sm text-foreground/70">
              {email ? (
                <>
                  {email} に認証メールを送信しました。
                  <br />
                  メールに記載された6桁の認証コードを入力してください。
                </>
              ) : (
                <>
                  メールアドレス認証が必要です。
                  <br />
                  登録時に送信されたメールに記載された6桁の認証コードを入力してください。
                </>
              )}
            </div>
            
            <form onSubmit={handleCodeSubmit} className="space-y-4">
              <div>
                <label className="block text-sm mb-1">認証コード（6桁）</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  className="w-full rounded-md border border-subtle bg-transparent px-3 py-2 text-center text-2xl tracking-widest font-mono"
                  placeholder="000000"
                  value={code}
                  onChange={(e) => {
                    // 数字のみを許可
                    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setCode(value);
                    setError("");
                  }}
                  autoComplete="one-time-code"
                  autoFocus
                  required
                />
                <p className="text-xs text-subtle mt-1">
                  メールに記載された6桁の数字コードを入力してください
                </p>
              </div>
              
              {error && (
                <div className="text-sm text-red-500">{error}</div>
              )}
              
              <button
                type="submit"
                disabled={loading || code.length !== 6}
                className="w-full rounded-md px-4 py-2 bg-accent text-white hover:opacity-90 disabled:opacity-60"
              >
                {loading ? "認証中..." : "認証する"}
              </button>
            </form>
            
            {email && (
              <div className="space-y-2">
                <button
                  onClick={handleResend}
                  disabled={resendLoading}
                  className="w-full rounded-md px-4 py-2 border border-subtle hover:bg-white/5 disabled:opacity-60"
                >
                  {resendLoading ? "送信中..." : "認証コードを再送信"}
                </button>
                {resendSuccess && (
                  <div className="text-sm text-green-500">
                    認証コードを再送信しました。
                  </div>
                )}
              </div>
            )}
            
            <div className="pt-4 border-t border-subtle">
              <Link
                href="/login"
                className="block w-full text-center rounded-md px-4 py-2 border border-subtle hover:bg-white/5"
              >
                ログインページに戻る
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-lg border border-subtle surface-1 p-6">
          <div className="text-sm">読み込み中...</div>
        </div>
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}

