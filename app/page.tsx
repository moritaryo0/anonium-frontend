"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Header from "./components/Header";
import SidebarTabs from "./components/SidebarTabs";
import PostCard from "./components/PostCard";
import RightSidebar from "./components/RightSidebar";
import MobileNav from "./components/MobileNav";
import CreateFab from "./components/CreateFab";
import { useAuth } from "./utils/authContext";
import AtomSpinner from "./components/AtomSpinner";

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
  user_vote?: number | null;
  is_following?: boolean;
  community_is_member?: boolean;
  community_membership_role?: string | null;
  community_join_policy?: string;
  community_karma?: number;
  can_moderate?: boolean;
};

type PaginatedResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export default function Home() {
  const pathname = usePathname();
  const { signedIn, checkAuth } = useAuth();
  const [username, setUsername] = useState("member");
  const [password, setPassword] = useState("DemoPass123!");
  const [tab, setTab] = useState<string>("hot");

  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [log, setLog] = useState<string>("");
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
  const [trendingPosts, setTrendingPosts] = useState<Post[]>([]);
  const [loadingTrending, setLoadingTrending] = useState<boolean>(false);
  const [hasNoCommunities, setHasNoCommunities] = useState<boolean>(false);

  // パスに基づいてサイドバー/モバイルナビの選択状態を決定
  const sidebarTab = pathname === '/' ? 'home' : pathname === '/search' ? 'search' : 'home';

  useEffect(() => {
    // セキュリティ対策: JWTトークンはCookieから自動的に認証されるため、localStorageのチェックは不要
    // setAccessは使用しない（Cookieから自動的に認証される）
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
        }
      } catch {
        // エラーは無視
      }
    }
    // 認証コンテキストで認証状態は既に確認済みなので、ユーザー名のみ取得
    if (!signedIn) {
      fetchCurrentUsername();
    }
  }, [signedIn, API]);

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
      fetchGuestScore();
    } else {
      setGuestScore(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, signedIn]);

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
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const data: PaginatedResponse<Post> = await res.json();
      let sorted = data.results;
      if (tab === "new") sorted = [...data.results].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
      setPosts(prev => [...prev, ...sorted]);
      setNextPage(data.next);
    } catch {
      // noop
    } finally {
      setLoading(false);
    }
  }, [nextPage, loading, tab]);

  async function login() {
    setLog("");
    const res = await fetch(`${API}/api/accounts/login/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
      credentials: 'include', // クッキーを送信・受信するために必要
    });
    const data = await res.json();
    if (!res.ok) {
      setLog(`Login failed: ${JSON.stringify(data)}`);
      return;
    }
    // セキュリティ対策: JWTトークンはCookieに自動保存されるため、localStorageには保存しない
    // ログイン状態を更新（認証コンテキストを更新）
    await checkAuth();
    try {
      const meRes = await fetch(`${API}/api/accounts/me/`, {
        credentials: 'include',
      });
      if (meRes.ok) {
        const meData = await meRes.json();
        if (meData?.username) {
          setCurrentUsername(meData.username);
          try {
            localStorage.setItem('accessUsername', meData.username);
          } catch {}
        }
      }
    } catch {
      // エラーは無視
    }
    setLog("Login success");
  }

  async function logout() {
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

  async function fetchPosts(reset: boolean = false) {
    if (reset) {
      setPosts([]);
      setNextPage(null);
    }
    setLoading(true);
    try {
      // セキュリティ対策: JWTトークンはCookieから自動的に送信される
      // ホームページでは常に参加コミュニティの投稿を取得
      const url = `${API}/api/posts/me/communities/`;

      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) {
        setPosts([]);
        setNextPage(null);
        setHasNoCommunities(true);
        // 参加コミュニティがない場合は勢いランキングを取得
        if (res.status === 404 || res.status === 200) {
          fetchTrendingPosts();
        }
        return;
      }
      const data: PaginatedResponse<Post> = await res.json();
      let sorted = data.results;
      if (tab === "new") sorted = [...data.results].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
      if (tab === "top") sorted = data.results;
      setPosts(sorted);
      setNextPage(data.next);
      
      // 投稿が0件の場合は勢いランキングを表示
      if (sorted.length === 0) {
        setHasNoCommunities(true);
        fetchTrendingPosts();
      } else {
        setHasNoCommunities(false);
        setTrendingPosts([]);
      }
    } catch {
      setPosts([]);
      setNextPage(null);
      setHasNoCommunities(true);
      fetchTrendingPosts();
    } finally {
      setLoading(false);
    }
  }

  async function fetchTrendingPosts() {
    setLoadingTrending(true);
    try {
      // セキュリティ対策: JWTトークンはCookieから自動的に送信される
      const url = `${API}/api/posts/trending/?limit=20`;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) {
        setTrendingPosts([]);
        return;
      }
      const data: Post[] = await res.json();
      // 投稿データには既にユーザー依存データが含まれています
      setTrendingPosts(data);
    } catch {
      setTrendingPosts([]);
    } finally {
      setLoadingTrending(false);
    }
  }


  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header
        signedIn={signedIn}
        onLogin={login}
        onLogout={logout}
      />

      <main className="max-w-none mx-auto px-2 sm:px-2 md:px-3 py-6">
        <div className="mx-auto" style={{ maxWidth: vw >= 1200 ? 1200 : '100%' }}>
          <div className="flex items-start gap-4 md:gap-6 min-w-0">
            <SidebarTabs
              open={sidebarOpen}
              current={sidebarTab}
              onChange={(v) => { setTab(v); localStorage.setItem('homeTab', v); }}
              setOpen={setSidebarOpen}
            />

            <section className="flex-1 min-w-0" style={{ maxWidth: vw >= 1200 ? 800 : 700 }}>
              <div className={`space-y-4 pr-1 ${vw < 500 ? 'pb-16' : ''}`}>
          {/* メイン部のタブUI（ゲスト含め常に表示） */}
          <div className="flex items-center justify-between gap-2 border-b border-subtle">
            <div className="flex gap-2">
              <div className="px-4 py-2 font-medium text-white border-b-2 border-accent">
                アノニウム
              </div>
              <Link
                href="/latest"
                className="px-4 py-2 font-medium transition-colors text-white hover:text-accent"
              >
                新しい順
              </Link>
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

          {posts.length === 0 && loading && !hasNoCommunities ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center justify-center gap-2 text-subtle text-sm">
                <AtomSpinner size={20} />
                <span>読み込み中...</span>
              </div>
            </div>
          ) : hasNoCommunities ? (
            <div className="space-y-4">
              {/* アノニウムに参加しましょう */}
              <div className="rounded-lg border border-subtle p-6 surface-1">
                <h2 className="text-lg font-semibold text-white mb-2">アノニウムに参加しましょう</h2>
                <p className="text-sm text-subtle mb-4">
                  興味のあるアノニウムに参加して、スレッドを作成したりコメントしたりできます。
                </p>
                <Link
                  href="/search"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors"
                >
                  <span className="material-symbols-rounded text-base" style={{ fontSize: 18 }}>search</span>
                  <span>アノニウムを探す</span>
                </Link>
              </div>
              
              {/* 勢いのあるスレッドランキング */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">勢いのあるスレッド</h3>
                {loadingTrending ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="flex items-center justify-center gap-2 text-subtle text-sm">
                      <AtomSpinner size={16} />
                      <span>読み込み中...</span>
                    </div>
                  </div>
                ) : trendingPosts.length === 0 ? (
                  <div className="text-sm text-subtle py-4 text-center">
                    勢いのあるスレッドはありません
                  </div>
                ) : (
                  <div className="space-y-4">
                    {trendingPosts
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
                          onVoted={() => fetchTrendingPosts()}
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
                  </div>
                )}
              </div>
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
                      <AtomSpinner size={16} />
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

          {log && (
            <pre className="whitespace-pre-wrap rounded-lg border border-subtle p-3 surface-1 text-sm">{log}</pre>
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
        <MobileNav current={sidebarTab} onChange={(v) => { setTab(v); localStorage.setItem('homeTab', v); }} />
      )}
      <CreateFab />
    </div>
  );
}

