"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Header from "@/app/components/Header";
import SidebarTabs from "@/app/components/SidebarTabs";
import MobileNav from "@/app/components/MobileNav";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

type Community = {
  id: number;
  name: string;
  slug: string;
  description?: string;
  icon_url?: string;
  banner_url?: string;
  members_count: number;
  visibility: string;
  join_policy: string;
  is_nsfw: boolean;
  membership_role?: string | null;
};

type LatestMessage = {
  id: number;
  body: string;
  sender: {
    id: number;
    username: string;
  };
  created_at: string;
};

type ChatRoom = {
  community: Community;
  latest_message: LatestMessage | null;
};

export default function MessagesPage() {
  const router = useRouter();
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [tab, setTab] = useState<string>("trending");
  const [overlayMode, setOverlayMode] = useState<boolean>(false);
  const [vw, setVw] = useState<number>(0);
  const asideWidth = vw >= 1200 ? 300 : (vw > 1000 ? Math.round(200 + (vw - 1000) * 0.5) : undefined);

  useEffect(() => {
    // セキュリティ対策: JWTトークンはCookieから自動的に認証されるため、localStorageのチェックは不要
    // 認証状態は/api/accounts/me/を呼び出して確認
    fetch(`${API}/api/accounts/me/`, {
      credentials: 'include',
    }).then(res => {
      if (res.ok) {
        setSignedIn(true);
      } else {
        setSignedIn(false);
      }
    }).catch(() => {
      setSignedIn(false);
    });
    
    function compute() {
      const w = typeof window !== 'undefined' ? window.innerWidth : 0;
      setOverlayMode(w <= 1200);
      setVw(w);
    }
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, []);

  useEffect(() => {
    const fetchChatRooms = async () => {
      try {
        // セキュリティ対策: JWTトークンはCookieから自動的に送信される
        const response = await fetch(`${API}/api/messages/chat-rooms/`, {
          credentials: 'include',
        });

        if (!response.ok) {
          if (response.status === 401) {
            router.push("/login");
            return;
          }
          setError("チャットルームの取得に失敗しました");
          setLoading(false);
          return;
        }

        const data = await response.json();
        setChatRooms(data);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching chat rooms:", err);
        setError("チャットルームの取得に失敗しました");
        setLoading(false);
      }
    };

    fetchChatRooms();
  }, [router, API]);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "たった今";
    if (minutes < 60) return `${minutes}分前`;
    if (hours < 24) return `${hours}時間前`;
    if (days < 7) return `${days}日前`;
    
    return date.toLocaleDateString("ja-JP", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleLogin = () => {
    router.push("/login");
  };

  const handleLogout = async () => {
    // セキュリティ対策: Cookieからトークンを削除
    try {
      await fetch(`${API}/api/accounts/logout/`, {
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
    setSignedIn(false);
    router.push("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Header signedIn={signedIn} onLogin={handleLogin} onLogout={handleLogout} />
        <main className="max-w-none mx-auto px-2 sm:px-2 md:px-3 py-6">
          <div className="mx-auto" style={{ maxWidth: vw >= 1200 ? 1200 : '100%' }}>
            <div className="flex items-start gap-4 md:gap-6 min-w-0">
              <SidebarTabs
                open={sidebarOpen}
                current={tab}
                onChange={(v) => { setTab(v); localStorage.setItem('homeTab', v); }}
                setOpen={setSidebarOpen}
              />
              <section className="flex-1 min-w-0" style={{ maxWidth: vw >= 1200 ? 800 : 700 }}>
                <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--accent)] mx-auto mb-4"></div>
                    <p>読み込み中...</p>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </main>
        <MobileNav current="message" onChange={() => {}} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Header signedIn={signedIn} onLogin={handleLogin} onLogout={handleLogout} />
        <main className="max-w-none mx-auto px-2 sm:px-2 md:px-3 py-6">
          <div className="mx-auto" style={{ maxWidth: vw >= 1200 ? 1200 : '100%' }}>
            <div className="flex items-start gap-4 md:gap-6 min-w-0">
              <SidebarTabs
                open={sidebarOpen}
                current={tab}
                onChange={(v) => { setTab(v); localStorage.setItem('homeTab', v); }}
                setOpen={setSidebarOpen}
              />
              <section className="flex-1 min-w-0" style={{ maxWidth: vw >= 1200 ? 800 : 700 }}>
                <div className="bg-[var(--surface-2)] rounded-lg p-6 text-center">
                  <p className="text-red-400 mb-4">{error}</p>
                  <button
                    onClick={() => router.push("/")}
                    className="text-[var(--accent)] hover:underline"
                  >
                    ホームに戻る
                  </button>
                </div>
              </section>
            </div>
          </div>
        </main>
        <MobileNav current="message" onChange={() => {}} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header signedIn={signedIn} onLogin={handleLogin} onLogout={handleLogout} />
      
      <main className="max-w-none mx-auto px-2 sm:px-2 md:px-3 py-6">
        <div className="mx-auto" style={{ maxWidth: vw >= 1200 ? 1200 : '100%' }}>
          <div className="flex items-start gap-4 md:gap-6 min-w-0">
            <SidebarTabs
              open={sidebarOpen}
              current={tab}
              onChange={(v) => { setTab(v); localStorage.setItem('homeTab', v); }}
              setOpen={setSidebarOpen}
            />

            <section className="flex-1 min-w-0" style={{ maxWidth: vw >= 1200 ? 800 : 700 }}>
              <div className={`space-y-4 pr-1 ${vw < 500 ? 'pb-16' : ''}`}>
                <div className="mb-4">
                  <h1 className="text-2xl font-bold mb-2">グループチャット</h1>
                  <p className="text-sm text-subtle">
                    モデレーター以上の権限を持つアノニウムのグループチャット一覧
                  </p>
                </div>

                {chatRooms.length === 0 ? (
                  <div className="bg-[var(--surface-2)] rounded-lg p-8 text-center">
                    <p className="text-gray-400 mb-4">
                      グループチャットに参加できるアノニウムがありません
                    </p>
                    <p className="text-sm text-gray-500">
                      モデレーター以上の権限を持つアノニウムにグループチャットが表示されます
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {chatRooms.map((room) => (
                      <Link
                        key={room.community.id}
                        href={`/v/${room.community.id}/chat`}
                        className="block bg-[var(--surface-2)] rounded-lg p-4 hover:bg-[var(--surface-1)] transition-colors border border-transparent hover:border-[var(--accent)]/20"
                      >
                        <div className="flex items-start gap-4">
                          {/* コミュニティアイコン */}
                          <div className="flex-shrink-0">
                            {room.community.icon_url ? (
                              <img
                                src={room.community.icon_url}
                                alt={room.community.name}
                                className="w-12 h-12 rounded-full border border-subtle object-cover"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-full border border-subtle bg-[var(--surface-1)] flex items-center justify-center">
                                <span className="text-lg">
                                  {room.community.name[0].toUpperCase()}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* コミュニティ情報と最後のメッセージ */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h2 className="font-semibold truncate">
                                {room.community.name}
                              </h2>
                              {room.community.membership_role === 'owner' && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-rose-500/30 bg-rose-500/20 text-rose-300">
                                  オーナー
                                </span>
                              )}
                              {room.community.membership_role === 'admin_moderator' && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/20 text-amber-300">
                                  管理モデ
                                </span>
                              )}
                              {room.community.membership_role === 'moderator' && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-sky-500/30 bg-sky-500/20 text-sky-300">
                                  モデ
                                </span>
                              )}
                            </div>
                            
                            {room.latest_message ? (
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-sm text-gray-300 font-medium">
                                    {room.latest_message.sender.username}
                                  </span>
                                  <span className="text-xs text-gray-500">
                                    {formatTime(room.latest_message.created_at)}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-400 line-clamp-2">
                                  {room.latest_message.body}
                                </p>
                              </div>
                            ) : (
                              <p className="text-sm text-gray-500">
                                メッセージがありません
                              </p>
                            )}
                          </div>

                          {/* 矢印アイコン */}
                          <div className="flex-shrink-0">
                            <span className="material-symbols-rounded text-gray-400">
                              chevron_right
                            </span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </main>
      {vw > 0 && vw < 500 && (
        <MobileNav current="message" onChange={() => {}} />
      )}
    </div>
  );
}

