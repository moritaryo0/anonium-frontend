"use client";

import Header from "@/app/components/Header";
import { useEffect, useState } from "react";

export default function AboutPage() {
  const [access, setAccess] = useState<string>("");
  const [vw, setVw] = useState<number>(0);

  useEffect(() => {
    // セキュリティ対策: JWTトークンはCookieから自動的に送信される
    // 認証状態を確認するために/meエンドポイントを呼び出す
    async function checkAuth() {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000"}/api/accounts/me/`, {
          credentials: 'include',
        });
        if (res.ok) {
          setAccess("authenticated"); // トークン自体は保持しない
        } else {
          setAccess("");
        }
      } catch {
        setAccess("");
      }
    }
    checkAuth();
    function compute() {
      const w = typeof window !== 'undefined' ? window.innerWidth : 0;
      setVw(w);
    }
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header
        signedIn={!!access}
        onLogin={() => {}}
        onLogout={async () => {
          // セキュリティ対策: Cookieからトークンを削除
          try {
            await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000"}/api/accounts/logout/`, {
              method: 'POST',
              credentials: 'include',
            });
          } catch (err) {
            console.error('Logout error:', err);
          }
          // localStorageからも削除（後方互換性のため）
          localStorage.removeItem("accessToken");
          localStorage.removeItem("refreshToken");
          localStorage.removeItem("accessUsername");
          setAccess("");
        }}
      />

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="space-y-6">
          <h1 className="text-3xl font-bold text-white">アノニウムの使い方</h1>
          
          <div className="rounded-lg border border-subtle p-6 surface-1 space-y-4">
            <p className="text-subtle">
              コンテンツは後で追加されます。
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

