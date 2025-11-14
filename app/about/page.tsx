"use client";

import Header from "@/app/components/Header";
import { useEffect, useState, Suspense } from "react";
import Link from "next/link";

type TabType = "guide" | "terms";

export default function AboutPage() {
  const [access, setAccess] = useState<string>("");
  const [vw, setVw] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<TabType>("guide");

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
          <h1 className="text-3xl font-bold text-white">アノニウムについて</h1>
          
          {/* タブ */}
          <div className="flex border-b border-subtle">
            <button
              onClick={() => setActiveTab("guide")}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === "guide"
                  ? "text-white border-b-2 border-accent"
                  : "text-subtle hover:text-white"
              }`}
            >
              アノニウムの使い方
            </button>
            <button
              onClick={() => setActiveTab("terms")}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === "terms"
                  ? "text-white border-b-2 border-accent"
                  : "text-subtle hover:text-white"
              }`}
            >
              利用規約
            </button>
            <Link
              href="/about/qa"
              className="px-6 py-3 font-medium transition-colors text-white hover:text-white/80"
            >
              Q&A
            </Link>
          </div>

          {/* タブコンテンツ */}
          <div className="rounded-lg border border-subtle p-6 surface-1">
            {activeTab === "guide" && (
              <div className="space-y-6 text-white prose prose-invert max-w-none">
                <div>
                  <h2 className="text-2xl font-bold mb-4">Anonium 利用ガイドライン</h2>
                  <p className="text-subtle mb-6">
                    Anonium を安心して楽しむための基本的なルールや考え方をまとめています。
                    利用規約よりも具体的で、利用者の方向けに読みやすく整理したものです。
                  </p>
                </div>

                <div className="border-t border-subtle pt-6">
                  <h3 className="text-xl font-semibold mb-3">1. Anonium(アノニウム) のコンセプト</h3>
                  <p className="text-subtle mb-4">
                    Anonium は 匿名でコミュニティを作り、語り合うための場 です。
                    ユーザー・コミュニティ・投稿、そのすべてが「ひとつのアノニウム」という世界観でつながっています。
                    AnoniumはTwitterやinstagramのような既存のSNS文化とは違い、個々のユーザーをフォローしたり投稿を追ったりする機能を有しません。
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-subtle mb-4">
                    <li>個人のプロフィールを重視しない</li>
                    <li>立場や既存のフォロワーに縛られず、自由に話せる</li>
                    <li>コミュニティ内で文化を育てる</li>
                  </ul>
                  <div className="bg-white/5 border border-subtle rounded-lg p-4 mb-4">
                    <h4 className="font-semibold mb-2">匿名性コンセプト</h4>
                    <p className="text-subtle text-sm leading-relaxed">
                      このサービスは匿名で利用することを前提としています。<br />
                      そのためこのサービスのアカウントでは、実名（ペンネームも含む）の使用、Twitter、Instagram、公式LINEなど他のSNSサービスのアカウントとアカウントを紐づけるような行為は禁止とします。
                      これはこのサービスがあくまで匿名コミュニティの集合体として運営するためで、個人アカウント単位での注目度を出来る限り減らさなくてはならないと考えているからです。
                      しかし長い時間をかけて規模が大きくなれば、個々のアカウント同士では形骸化してくる面はあるかと思いますが、このルールの本質はこのサービスが個人単位でのインフルエンサー化やインプレッション稼ぎにはないということを示しています。
                    </p>
                    <div className="mt-3 pt-3 border-t border-subtle">
                      <Link
                        href="/about/qa"
                        className="text-white hover:text-white/80 text-sm underline inline-flex items-center gap-1"
                      >
                        具体的なQ&Aはこちら
                        <span className="material-symbols-rounded text-base" style={{ fontSize: 16 }}>arrow_forward</span>
                      </Link>
                    </div>
                  </div>
                </div>

                <div className="border-t border-subtle pt-6">
                  <h3 className="text-xl font-semibold mb-3">2. 禁止されている主な行為</h3>
                  <p className="text-subtle mb-3">
                    以下のような内容は、投稿・コメント・名前・画像など、すべての形式で禁止しています：
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-subtle mb-4">
                    <li>利用規約に違反する行為（主に違法な行為）</li>
                    <li>外部アカウントで自分のアカウントが明確にわかる形で投稿する行為（利用している上で知り合いなどがその人とわかってしまう分には特に問題ありません。）</li>
                  </ul>
                  <p className="text-subtle text-sm">
                    これらは違反した場合は投稿やアカウントを削除します。
                    <br />
                    ※判断は最終的に運営側（人間）が行います。
                  </p>
                </div>

                <div className="border-t border-subtle pt-6">
                  <h3 className="text-xl font-semibold mb-3">3. 法律に関わる内容について</h3>
                  <ul className="list-disc list-inside space-y-2 text-subtle">
                    <li>違法性が疑われる投稿は、運営が独自に判断したうえで対応します。</li>
                    <li>運営側が「合法」と判断した場合でも、最終的な法的判断は裁判所が行うもの とします。</li>
                  </ul>
                </div>

                <div className="border-t border-subtle pt-6">
                  <h3 className="text-xl font-semibold mb-3">4. オーナー、モデレーターについて</h3>
                  <ul className="list-disc list-inside space-y-2 text-subtle">
                    <li>メールアドレスを登録したユーザーはAnoniumというコミュニティを作成できます。作成したユーザーはオーナーとなり、Anoniumの削除はオーナーだけが行えます。</li>
                    <li>オーナーはAnoniumにコンセプトとルールを制定して運営することができます。そしてこのルールのもとに運営するためのモデレーターを任命できます。</li>
                    <li>モデレーターには二種類あり、管理モデレーターとモデレーターが存在します。管理モデレーターはユーザーを追放、ブロックするなどの権限を持ち、オーナーと共にコミュニティを運営します。通常のモデレーターは投稿とコメントの削除の権限を持ち、コミュニティ内で警察のような役割も持ちます。</li>
                    <li>Anoniumではモデレーター専用のグループチャットがあり、そこで投稿が具体的にルールに違反するかどうかの話し合いが行えます。</li>
                    <li>ただしオーナーとモデレーターがコミュニティのルールに反しないとした場合も、Anoniumのルールに反する場合は個別に削除対応を行います。</li>
                  </ul>
                </div>

                <div className="border-t border-subtle pt-6">
                  <h3 className="text-xl font-semibold mb-3">5. ガイドラインの更新</h3>
                  <p className="text-subtle">
                    サービスの成長や文化の変化に合わせ、ガイドラインは随時更新します。
                    変更後はお知らせを行い、それ以降の利用に適用されます。
                  </p>
                </div>
              </div>
            )}

            {activeTab === "terms" && (
              <div className="space-y-6 text-white prose prose-invert max-w-none">
                <div>
                  <h2 className="text-2xl font-bold mb-4">Anonium 利用規約</h2>
                  <p className="text-subtle mb-6">
                    本規約は、Anonium（以下「本サービス」といいます）の利用条件を定めるものです。本サービスをご利用になる方（以下「利用者」といいます）は、本規約に同意したものとみなされます。
                  </p>
                </div>

                <div className="border-t border-subtle pt-6">
                  <h3 className="text-xl font-semibold mb-3">第1条（適用）</h3>
                  <ol className="list-decimal list-inside space-y-2 text-subtle">
                    <li>本規約は、利用者の本サービス利用に関する一切の行為に適用されます。</li>
                    <li>運営（以下「当社」といいます）は、本規約の他にガイドライン等を定める場合があり、これらは本規約の一部を構成するものとします。</li>
                  </ol>
                </div>

                <div className="border-t border-subtle pt-6">
                  <h3 className="text-xl font-semibold mb-3">第2条（利用資格）</h3>
                  <ol className="list-decimal list-inside space-y-2 text-subtle">
                    <li>本サービスは、未成年者を含むすべての方が利用できます。</li>
                    <li>未成年の利用者は、保護者等の法定代理人の同意を得た上で利用するものとします。</li>
                  </ol>
                </div>

                <div className="border-t border-subtle pt-6">
                  <h3 className="text-xl font-semibold mb-3">第3条（禁止事項）</h3>
                  <p className="text-subtle mb-3">利用者は、以下の行為を行ってはなりません。</p>
                  <ol className="list-decimal list-inside space-y-2 text-subtle">
                    <li>法令または公序良俗に違反する行為</li>
                    <li>コミュニティガイドラインに違反する行為</li>
                    <li>他者への誹謗中傷、差別、著しく不快感を与える行為</li>
                    <li>プライバシー侵害、個人情報の投稿</li>
                    <li>知的財産権を侵害する行為</li>
                    <li>違法行為（著作権侵害、脅迫、詐欺、薬物犯罪等）を具体的に示唆・助長する投稿</li>
                    <li>自殺、自傷、薬物乱用等を具体的かつ現実的に助長し、自殺幇助などに該当すると考えられる投稿</li>
                    <li>過度に暴力的な内容、性的搾取（児童ポルノ、リベンジポルノ）を含む内容、または未成年者による不適切な内容の投稿</li>
                    <li>サービスの機能を妨害する行為（攻撃、意図的な負荷、バグ悪用、スパム運用等）</li>
                    <li>当社が不適当と判断する行為</li>
                  </ol>
                </div>

                <div className="border-t border-subtle pt-6">
                  <h3 className="text-xl font-semibold mb-3">第4条（投稿の削除・アカウント制限）</h3>
                  <ol className="list-decimal list-inside space-y-2 text-subtle">
                    <li>当社は、利用者が本規約に違反したと判断した場合、投稿の削除、警告、利用制限等の措置を講じることができます。</li>
                    <li>投稿の最終判断は人間の担当者が行います。</li>
                    <li>違法性が疑われる投稿について、当社が合法と判断したとしても、最終的な判断は裁判所の判決に従います。</li>
                  </ol>
                </div>

                <div className="border-t border-subtle pt-6">
                  <h3 className="text-xl font-semibold mb-3">第5条（免責事項）</h3>
                  <ol className="list-decimal list-inside space-y-2 text-subtle">
                    <li>当社は、利用者の投稿内容について一切の責任を負いません。</li>
                    <li>本サービスの利用により生じた損害について、当社は責任を負いません。ただし、当社に故意または重過失がある場合を除きます。</li>
                  </ol>
                </div>

                <div className="border-t border-subtle pt-6">
                  <h3 className="text-xl font-semibold mb-3">第6条（サービス内容の変更・終了）</h3>
                  <p className="text-subtle">
                    当社は、事前の予告なく本サービスの内容変更・停止・終了を行うことがあります。
                  </p>
                </div>

                <div className="border-t border-subtle pt-6">
                  <h3 className="text-xl font-semibold mb-3">第7条（規約変更）</h3>
                  <p className="text-subtle">
                    当社は、必要に応じて本規約を変更できます。変更後の規約は、公開時点より効力を発生します。
                  </p>
                </div>

                <div className="border-t border-subtle pt-6">
                  <h3 className="text-xl font-semibold mb-3">第8条（準拠法・管轄）</h3>
                  <p className="text-subtle">
                    本規約の解釈および適用については日本法を準拠法とし、本サービスに関する紛争は当社所在地を管轄する裁判所を専属的合意管轄とします。
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

