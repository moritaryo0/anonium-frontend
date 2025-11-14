"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../utils/authContext";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

type Step = 1 | 2;

export default function LoginPage() {
  const router = useRouter();
  const { signedIn, isLoading, checkAuth } = useAuth();

  const [step, setStep] = useState<Step>(1);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [verificationSent, setVerificationSent] = useState(false);

  // 認証状態が確定した後、ログイン済みユーザー（ゲスト以外）のみリダイレクト
  useEffect(() => {
    if (isLoading) return; // 認証確認中は何もしない
    
    if (signedIn) {
      // 通常の認証済みユーザーのみリダイレクト（ゲストユーザーはログインページに留まる）
      router.replace("/");
    }
  }, [signedIn, isLoading, router]);

  // ステップ1: ログイン情報を送信
  async function handleStep1Submit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/accounts/login/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        credentials: 'include', // クッキーを送信・受信するために必要
      });
      const data = await res.json();
      if (!res.ok) {
        const message = typeof data === "string" ? data : (data?.detail || data?.non_field_errors || data?.username || data?.password || "ログインに失敗しました。");
        setError(Array.isArray(message) ? message.join(" ") : String(message));
        setLoading(false);
        return;
      }

      // メール認証が必要な場合
      if (data.email_verification_required && data.email) {
        setEmail(data.email);
        setVerificationSent(true);
        setStep(2); // ステップ2に進む
      } else {
        // メール認証が不要な場合（既に認証済み）は直接ログイン完了
        await checkAuth();
        router.replace("/");
      }
    } catch (err) {
      setError("ネットワークエラーが発生しました。");
    } finally {
      setLoading(false);
    }
  }

  // ステップ2: メール認証コードを入力して認証
  async function handleStep2Submit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    
    // 6桁の数字コードを検証
    const trimmedCode = verificationCode.trim().replace(/\D/g, ''); // 数字以外を削除
    if (trimmedCode.length !== 6) {
      setError("6桁の数字コードを入力してください。");
      return;
    }
    
    setError("");
    setLoading(true);
    
    try {
      const res = await fetch(`${API}/api/accounts/verify-email/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: trimmedCode }),
        credentials: 'include',
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        setError(data?.detail || "認証に失敗しました。");
        setLoading(false);
        return;
      }
      
      // 認証成功、ログイン完了
      await checkAuth();
      router.replace("/");
    } catch (err) {
      setError("ネットワークエラーが発生しました。");
    } finally {
      setLoading(false);
    }
  }

  // ステップ2: メール認証コードを再送信
  async function handleResendVerification() {
    if (!email) {
      setError("メールアドレスがありません。");
      return;
    }
    setLoading(true);
    setError("");
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
      } else {
        setVerificationSent(true);
        setError("");
      }
    } catch (err) {
      setError("ネットワークエラーが発生しました。");
    } finally {
      setLoading(false);
    }
  }

  async function handleOAuthLogin(provider: 'google' | 'x') {
    if (loading) return;
    setError("");
    setLoading(true);
    try {
      // Google または X (Twitter) の場合は実際のOAuth 2.0フローを使用
      if (provider === 'google' || provider === 'x') {
        // バックエンドから認証URLを取得
        const endpoint = provider === 'google' 
          ? `${API}/api/accounts/oauth/google/authorize/`
          : `${API}/api/accounts/oauth/x/authorize/`;
        
        const res = await fetch(endpoint, {
          method: "GET",
          credentials: 'include',
        });
        
        const data = await res.json();
        
        if (!res.ok) {
          const message = data?.detail || `${provider === 'google' ? 'Google' : 'X'}認証URLの取得に失敗しました。`;
          setError(String(message));
          setLoading(false);
          return;
        }

        // stateをセッションストレージに保存
        const stateKey = provider === 'google' ? 'google_oauth_state' : 'x_oauth_state';
        sessionStorage.setItem(stateKey, data.state);

        // X (Twitter) の場合はcode_verifierも保存
        if (provider === 'x' && data.code_verifier) {
          sessionStorage.setItem("x_oauth_code_verifier", data.code_verifier);
        }

        // OAuth認証ページにリダイレクト
        window.location.href = data.authorize_url;
        return;
      }
    } catch (err) {
      setError("ネットワークエラーが発生しました。");
      setLoading(false);
    }
  }

  // ステップインジケーター
  const StepIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-6">
      {[1, 2].map((s) => (
        <div key={s} className="flex items-center">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
              step === s
                ? "bg-accent text-white"
                : step > s
                ? "bg-green-500 text-white"
                : "bg-white/10 text-subtle"
            }`}
          >
            {step > s ? "✓" : s}
          </div>
          {s < 2 && (
            <div
              className={`w-12 h-0.5 mx-2 transition-colors ${
                step > s ? "bg-green-500" : "bg-white/10"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="rounded-lg border border-subtle surface-1 p-6">
          <h1 className="text-xl font-semibold mb-2 text-center">ログイン</h1>
          <StepIndicator />

          {/* ステップ1: ログイン情報入力 */}
          {step === 1 && (
            <div className="animate-fade-in">
              <form className="space-y-4" onSubmit={handleStep1Submit}>
                <div>
                  <label className="block text-sm mb-1">ユーザー名（またはメール）</label>
                  <input
                    className="w-full rounded-md border border-subtle bg-transparent px-3 py-2"
                    placeholder="username or email"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">パスワード</label>
                  <input
                    type="password"
                    className="w-full rounded-md border border-subtle bg-transparent px-3 py-2"
                    placeholder="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </div>
                {error && (
                  <div className="text-sm text-red-500 whitespace-pre-wrap">{error}</div>
                )}
                <button
                  type="submit"
                  className="w-full rounded-md px-4 py-2 bg-accent text-white hover:opacity-90 disabled:opacity-60 transition-colors"
                  disabled={loading}
                >
                  {loading ? "ログイン中..." : "次へ"}
                </button>
              </form>

              <div className="mt-6">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-subtle"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-[var(--surface-1)] text-subtle">または</span>
                  </div>
                </div>
                
                <div className="mt-6 space-y-3">
                  <button
                    type="button"
                    onClick={() => handleOAuthLogin('google')}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-md border border-subtle hover:bg-white/5 disabled:opacity-60 transition-colors"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    <span>Googleでログイン</span>
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => handleOAuthLogin('x')}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-md border border-subtle hover:bg-white/5 disabled:opacity-60 transition-colors"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                    <span>Xでログイン</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ステップ2: メール認証コード入力 */}
          {step === 2 && (
            <div className="animate-fade-in">
              <div className="text-center mb-4">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-accent/20 flex items-center justify-center">
                  <span className="material-symbols-rounded text-3xl text-accent">mail</span>
                </div>
                <h2 className="text-lg font-semibold mb-2">メールアドレスを確認</h2>
                <p className="text-sm text-subtle mb-2">
                  <span className="font-medium text-foreground">{email}</span> に認証コードを送信しました。
                </p>
                <p className="text-sm text-subtle">
                  メールに記載された6桁の認証コードを入力してください。
                </p>
              </div>

              {verificationSent && (
                <div className="mb-4 p-3 rounded-md bg-green-500/10 border border-green-500/20 text-sm text-green-400">
                  ✓ 認証コードを送信しました
                </div>
              )}

              <form onSubmit={handleStep2Submit} className="space-y-4">
                <div>
                  <label className="block text-sm mb-1">認証コード（6桁）</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    className="w-full rounded-md border border-subtle bg-transparent px-3 py-2 text-center text-2xl tracking-widest font-mono"
                    placeholder="000000"
                    value={verificationCode}
                    onChange={(e) => {
                      // 数字のみを許可
                      const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setVerificationCode(value);
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
                  <div className="text-sm text-red-500 whitespace-pre-wrap">{error}</div>
                )}

                <button
                  type="submit"
                  disabled={loading || verificationCode.length !== 6}
                  className="w-full rounded-md px-4 py-2 bg-accent text-white hover:opacity-90 disabled:opacity-60 transition-colors"
                >
                  {loading ? "認証中..." : "ログイン完了"}
                </button>
              </form>

              <div className="mt-4 space-y-3">
                <button
                  onClick={handleResendVerification}
                  disabled={loading}
                  className="w-full rounded-md px-4 py-2 border border-subtle hover:bg-white/5 disabled:opacity-60 transition-colors"
                >
                  {loading ? "送信中..." : "認証コードを再送信"}
                </button>
                <button
                  onClick={() => setStep(1)}
                  className="w-full rounded-md px-4 py-2 border border-subtle hover:bg-white/5 transition-colors"
                >
                  戻る
                </button>
              </div>

              <div className="mt-6 pt-6 border-t border-subtle">
                <p className="text-xs text-subtle text-center">
                  メールが届かない場合は、迷惑メールフォルダもご確認ください。
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


