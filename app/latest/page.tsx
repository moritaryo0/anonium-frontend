"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import Header from "../components/Header";
import SidebarTabs from "../components/SidebarTabs";
import PostCard from "../components/PostCard";
import RightSidebar from "../components/RightSidebar";
import MobileNav from "../components/MobileNav";
import { useAuth } from "../utils/authContext";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

type Post = {
  id: number;
  title: string;
  body?: string;
  author: number;
  created_at: string;
  community_slug?: string;
  community_name?: string;
  community_id?: number;
  community_join_policy?: string;
  community_karma?: number;
  user_vote?: number | null;
  is_following?: boolean;
  community_is_member?: boolean;
  community_membership_role?: string | null;
  can_moderate?: boolean;
};

type PaginatedResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export default function LatestPage() {
  const { signedIn, checkAuth } = useAuth();
  const [tab, setTab] = useState<string>("hot");
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [overlayMode, setOverlayMode] = useState<boolean>(false);
  const [vw, setVw] = useState<number>(0);
  const asideWidth = vw >= 1200 ? 300 : (vw > 1000 ? Math.round(200 + (vw - 1000) * 0.5) : undefined);
  const [nextPage, setNextPage] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const observerTarget = useRef<HTMLDivElement>(null);

  const [currentUsername, setCurrentUsername] = useState<string>("");
  const [mutedCommunitySlugs, setMutedCommunitySlugs] = useState<Set<string>>(new Set());
  const [filterMuted, setFilterMuted] = useState<boolean>(true); // デフォルトでミュートフィルタをON
  const [guestScore, setGuestScore] = useState<number | null>(null);

  useEffect(() => {
    // ローカルストレージから保存された設定を読み込む
    try {
      const savedUsername = localStorage.getItem("accessUsername");
      if (savedUsername) setCurrentUsername(savedUsername);
    } catch {}
    const savedTab = localStorage.getItem("homeTab");
    if (savedTab) setTab(savedTab);
    const savedFilterMuted = localStorage.getItem("filterMutedCommunities");
    if (savedFilterMuted !== null) {
      setFilterMuted(savedFilterMuted === 'true');
    }
    function compute() {
      const w = typeof window !== 'undefined' ? window.innerWidth : 0;
      setOverlayMode(w <= 1200);
      setVw(w);
    }
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, []);

  // 認証状態からユーザー名を取得
  useEffect(() => {
    async function fetchCurrentUsername() {
      try {
        const res = await fetch(`${API}/api/accounts/me/`, {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.username) {
            setCurrentUsername(data.username);
            try {
              localStorage.setItem('accessUsername', data.username);
            } catch {}
          }
          // ゲストユーザーのスコアも取得
          if (data.score !== undefined) {
            setGuestScore(data.score ?? 0);
          } else {
            setGuestScore(null);
          }
        } else {
          // 認証されていない場合はユーザー名をクリア
          setCurrentUsername("");
          setGuestScore(null);
        }
      } catch {
        // エラーは無視
        setGuestScore(null);
      }
    }
    // 認証状態が変更されたときにユーザー名を取得
    fetchCurrentUsername();
  }, [signedIn]);

  useEffect(() => {
    async function fetchMutedCommunities() {
      // セキュリティ対策: JWTトークンはCookieから自動的に送信される
      try {
        const res = await fetch(`${API}/api/communities/mutes/`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          const results = Array.isArray(data) ? data : (Array.isArray(data?.results) ? data.results : []);
          const slugs = new Set<string>(results.map((c: { slug: string }) => c.slug));
          setMutedCommunitySlugs(slugs);
        }
      } catch {
        setMutedCommunitySlugs(new Set());
      }
    }
    fetchMutedCommunities();
    setPosts([]);
    setNextPage(null);
    fetchPosts(true);
    // ゲストユーザーのスコアを取得（ログインしていない場合）
    if (!signedIn) {
      async function fetchGuestScore() {
        try {
          const res = await fetch(`${API}/api/accounts/me/`, { credentials: 'include' });
          if (res.ok) {
            const data = await res.json();
            setGuestScore(data.score ?? 0);
          } else {
            setGuestScore(null);
          }
        } catch {
          setGuestScore(null);
        }
      }
      fetchGuestScore();
    } else {
      setGuestScore(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, signedIn]);

  // Intersection Observer で無限スクロールを実装
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && nextPage && !loading) {
          loadNextPage();
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [nextPage, loading]);

  const loadNextPage = useCallback(async () => {
    if (!nextPage || loading) return;
    setLoading(true);
    try {
      // セキュリティ対策: JWTトークンはCookieから自動的に送信される
      const res = await fetch(nextPage, { credentials: 'include' });
      if (!res.ok) return;
      const data: PaginatedResponse<Post> = await res.json();
      let sorted = data.results;
      if (tab === "new") sorted = [...data.results].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
      if (tab === "top") sorted = data.results;
      setPosts(prev => [...prev, ...sorted]);
      setNextPage(data.next);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [nextPage, loading, tab]);

  async function fetchPosts(reset: boolean = false) {
    if (reset) {
      setPosts([]);
      setNextPage(null);
    }
    setLoading(true);
    try {
      // セキュリティ対策: JWTトークンはCookieから自動的に送信される
      const url = `${API}/api/posts/`;

      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) {
        setPosts([]);
        setNextPage(null);
        return;
      }
      const data: PaginatedResponse<Post> = await res.json();
      let sorted = data.results;
      if (tab === "new") sorted = [...data.results].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
      if (tab === "top") sorted = data.results;
      setPosts(sorted);
      setNextPage(data.next);

      // ユーザー固有情報を取得してマージ
      // セキュリティ対策: JWTトークンはCookieから自動的に送信される
      // 認証されていない場合はサーバー側で401が返されるが、エラーは無視される
      if (sorted.length > 0) {
        // 投稿データには既にユーザー依存データが含まれています
        setPosts(sorted);
      }
    } catch {
      setPosts([]);
      setNextPage(null);
    } finally {
      setLoading(false);
    }
  }


  async function handleLogout() {
    // セキュリティ対策: Cookieからトークンを削除
    try {
      await fetch(`${API}/api/accounts/logout/`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (err) {
      console.error('Logout error:', err);
    }
    // 認証コンテキストを更新
    await checkAuth();
    // localStorageからも削除（後方互換性のため）
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("accessUsername");
    setCurrentUsername("");
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header
        signedIn={signedIn}
        onLogin={() => {}}
        onLogout={handleLogout}
      />
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
              <div className="flex items-center justify-between gap-2 border-b border-subtle">
                <div className="flex gap-2">
                  <Link
                    href="/"
                    className="px-4 py-2 font-medium transition-colors text-white hover:text-accent"
                  >
                    参加コミュ
                  </Link>
                  <div className="px-4 py-2 font-medium text-white border-b-2 border-accent">
                    最新
                  </div>
                </div>
                <label className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filterMuted}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setFilterMuted(checked);
                      localStorage.setItem("filterMutedCommunities", String(checked));
                    }}
                    className="rounded border-subtle"
                  />
                  <span className="text-subtle">ミュート</span>
                </label>
              </div>
              {!signedIn && (
                <div className="rounded-lg border border-subtle p-4 surface-1">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Link
                      href="/login"
                      className="flex-1 rounded-md px-4 py-2 bg-white/10 hover:bg-white/15 text-center transition-colors"
                    >
                      ログイン
                    </Link>
                    <Link
                      href="/signup"
                      className="flex-1 rounded-md px-4 py-2 bg-accent text-white hover:opacity-90 text-center transition-colors"
                    >
                      新規登録
                    </Link>
                  </div>
                </div>
              )}

              {posts.length === 0 && loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="flex items-center justify-center gap-2 text-subtle text-sm">
                    <div className="w-5 h-5 border-2 border-subtle border-t-accent rounded-full animate-spin"></div>
                    <span>読み込み中...</span>
                  </div>
                </div>
              ) : posts.length === 0 && !loading ? (
                <div className="rounded-lg border border-subtle p-6 surface-1 text-subtle">
                  No posts yet.
                </div>
              ) : (
                <>
                  {posts
                    .filter(p => {
                      // フィルタがONの場合、ミュート中のコミュニティの投稿を非表示
                      if (filterMuted && p.community_slug && mutedCommunitySlugs.has(p.community_slug)) {
                        return false;
                      }
                      return true;
                    })
                    .map(p => (
                      <PostCard
                        key={p.id}
                        post={p}
                        inVillage={false}
                        showAuthor={false}
                        onVoted={() => fetchPosts(true)}
                        canModerate={!!p.can_moderate}
                        community={p.community_slug ? {
                          slug: p.community_slug,
                          is_member: p.community_is_member,
                          membership_role: p.community_membership_role ?? null,
                          clip_post_id: null,
                          join_policy: p.community_join_policy,
                          karma: p.community_karma,
                        } : null}
                        currentUsername={currentUsername}
                        guestScore={guestScore}
                        isAuthenticated={signedIn}
                      />
                    ))}
                  {nextPage && (
                    <div ref={observerTarget} className="py-4 text-center">
                      {loading ? (
                        <div className="flex items-center justify-center gap-2 text-subtle text-sm">
                          <div className="w-4 h-4 border-2 border-subtle border-t-accent rounded-full animate-spin"></div>
                          <span>読み込み中...</span>
                        </div>
                      ) : null}
                    </div>
                  )}
                  {!nextPage && posts.length > 0 && (
                    <div className="py-4 text-center text-subtle text-sm">
                      すべての投稿を表示しました
                    </div>
                  )}
                </>
              )}

              </div>
            </section>

            {(vw > 1000) && (
              <aside className="hidden md:block space-y-4" style={{ width: asideWidth, maxWidth: 300 }}>
                <RightSidebar community={null} />
              </aside>
            )}
          </div>
        </div>
      </main>
      {vw > 0 && vw < 500 && (
        <MobileNav current={tab} onChange={(v) => { setTab(v); localStorage.setItem('homeTab', v); }} />
      )}
    </div>
  );
}
