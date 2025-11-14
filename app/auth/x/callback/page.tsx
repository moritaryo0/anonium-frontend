"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/utils/authContext";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export default function XOAuthCallbackPage() {
  const router = useRouter();
  const { checkAuth } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    // 少し遅延してから処理を開始（URLパラメータが完全に読み込まれるのを待つ）
    const timer = setTimeout(async () => {
      try {
        // URLパラメータから認証コードとstateを取得
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");
        const state = params.get("state");
        const errorParam = params.get("error");

        // エラーがある場合はエラーを表示
        if (errorParam) {
          setError(`X認証エラー: ${errorParam}`);
          setLoading(false);
          setInitialized(true);
          return;
        }

        // 認証コードがない場合はエラー
        if (!code) {
          setError("認証コードが取得できませんでした。");
          setLoading(false);
          setInitialized(true);
          return;
        }

        // セッションストレージからstateとcode_verifierを取得
        const savedState = sessionStorage.getItem("x_oauth_state");
        const codeVerifier = sessionStorage.getItem("x_oauth_code_verifier");

        // stateを検証（CSRF対策）
        if (!state || !savedState || state !== savedState) {
          setError("認証状態の検証に失敗しました。");
          setLoading(false);
          setInitialized(true);
          return;
        }

        if (!codeVerifier) {
          setError("認証情報が見つかりませんでした。");
          setLoading(false);
          setInitialized(true);
          return;
        }

        // バックエンドに認証コードを送信
        const res = await fetch(`${API}/api/accounts/oauth/x/callback/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code,
            state,
            code_verifier: codeVerifier,
          }),
          credentials: "include",
        });

        const data = await res.json();

        if (!res.ok) {
          const message = data?.detail || "X認証に失敗しました。";
          setError(String(message));
          setLoading(false);
          setInitialized(true);
          return;
        }

        // セッションストレージから認証情報を削除
        sessionStorage.removeItem("x_oauth_state");
        sessionStorage.removeItem("x_oauth_code_verifier");

        // 認証コンテキストを更新
        await checkAuth();

        // 新規ユーザーでディスプレイネーム設定が必要な場合はプロフィール編集ページにリダイレクト
        if (data?.needs_display_name_setup) {
          router.replace("/u/edit");
        } else {
          // ホームページにリダイレクト
          router.replace("/");
        }
      } catch (err) {
        setError("ネットワークエラーが発生しました。");
        setLoading(false);
        setInitialized(true);
      }
    }, 100); // 100ms待機してから処理を開始

    return () => clearTimeout(timer);
  }, [router, checkAuth]);

  // 初期化が完了していない場合はローディング画面を表示
  if (!initialized || loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4 py-8">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-accent/20 flex items-center justify-center animate-spin">
            <span className="material-symbols-rounded text-3xl text-accent">
              refresh
            </span>
          </div>
          <p className="text-lg font-semibold mb-2">X認証を処理中...</p>
          <p className="text-sm text-subtle">しばらくお待ちください</p>
        </div>
      </div>
    );
  }

  // エラーが発生した場合のみエラー画面を表示
  if (error && initialized) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="rounded-lg border border-subtle surface-1 p-6">
            <div className="text-center mb-4">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
                <span className="material-symbols-rounded text-3xl text-red-500">
                  error
                </span>
              </div>
              <h2 className="text-lg font-semibold mb-2">認証エラー</h2>
              <p className="text-sm text-subtle mb-4">{error}</p>
            </div>
            <button
              onClick={() => router.replace("/login")}
              className="w-full rounded-md px-4 py-2 bg-accent text-white hover:opacity-90 transition-colors"
            >
              ログインページに戻る
            </button>
          </div>
        </div>
      </div>
    );
  }

  // フォールバック: ローディング画面を表示（リダイレクト処理中）
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4 py-8">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-accent/20 flex items-center justify-center animate-spin">
          <span className="material-symbols-rounded text-3xl text-accent">
            refresh
          </span>
        </div>
        <p className="text-lg font-semibold mb-2">X認証を処理中...</p>
        <p className="text-sm text-subtle">しばらくお待ちください</p>
      </div>
    </div>
  );
}

