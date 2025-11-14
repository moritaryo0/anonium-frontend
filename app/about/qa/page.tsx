"use client";

import Header from "@/app/components/Header";
import { useEffect, useState, Suspense } from "react";
import Link from "next/link";

export default function QAPage() {
  const [access, setAccess] = useState<string>("");

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
  }, []);

  const faqs = [
    {
      question: "実名の使用は禁止されてる？",
      answer: "はい、実名の使用は禁止されています。ペンネームであっても使用は禁止です。Anoniumは匿名で利用することを前提としたサービスです。実名を使用すると、匿名性が損なわれ、個人アカウント単位での注目度が高まってしまいます。そういうのはTwitterとかインスタでやれば良いという話です。"
    },
    {
      question: "TwitterやInstagramなどのSNSアカウントと紐づけることはできる？",
      answer: "いいえ、他のSNSサービスのアカウントとアカウントを紐づけるような行為は禁止されています。これには、プロフィールにSNSアカウントのリンクを貼る、投稿内でSNSアカウントを明示するなどの行為が含まれます。ただし、利用している上で知り合いなどがその人とわかってしまう分には特に問題ありません。"
    },
    {
      question: "なぜ匿名性が重要なのでしょうか？",
      answer: "Anoniumは個人単位でのインフルエンサー化やインプレッション稼ぎを目的としていません。匿名性を保つことで、立場や既存のフォロワーに縛られず、自由に話せる環境を提供しています。想像してください、せっかく人が入ってきたのに有名人たちが参加してきて、結果Twitterの下位互換になり果てたかつてのSNSたちを。"
    },
    {
      question: "知り合いが自分だとわかってしまうのは問題ないの？",
      answer: "利用している上で知り合いなどがその人とわかってしまう分には特に問題ありません。ただし、外部アカウントで自分のアカウントが明確にわかる形で投稿する行為（例：Twitterで「Anoniumのユーザー名は○○です」と投稿する）は禁止されています。"
    },
    {
      question: "匿名性のルールに違反した場合、どうなりますか？",
      answer: "匿名性のルールに違反した場合、投稿の削除や編集、アカウントの削除などの対応が行われます。判断は最終的に運営側（人間）が行います。"
    },
    {
      question: "規模が大きくなったら、このルールは形骸化しますか？",
      answer: "長い時間をかけて規模が大きくなれば、個々のアカウント同士では形骸化してくる面はあるかもしれません。しかし、このルールの本質はこのサービスが個人単位でのインフルエンサー化やインプレッション稼ぎにはないということを示しています。"
    }
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Suspense fallback={<div className="h-16 bg-black border-b border-subtle" />}>
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
      </Suspense>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Link
              href="/about"
              className="text-subtle hover:text-white transition-colors"
            >
              ← アノニウムについてに戻る
            </Link>
          </div>

          <h1 className="text-3xl font-bold text-white">よくある質問（Q&A）</h1>
          
          <div className="rounded-lg border border-subtle p-6 surface-1 space-y-6">
            <p className="text-subtle">
              匿名性に関するよくある質問と回答をまとめています。
            </p>

            <div className="space-y-6">
              {faqs.map((faq, index) => (
                <div key={index} className="border-t border-subtle pt-6 first:border-t-0 first:pt-0">
                  <h3 className="text-lg font-semibold text-white mb-2">
                    Q{index + 1}. {faq.question}
                  </h3>
                  <p className="text-subtle leading-relaxed">
                    {faq.answer}
                  </p>
                </div>
              ))}
            </div>

            <div className="border-t border-subtle pt-6">
              <p className="text-subtle text-sm">
                その他のご質問については、<Link href="/about" className="text-accent hover:text-accent/80 underline">アノニウムについて</Link>ページの利用ガイドラインをご確認ください。
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

