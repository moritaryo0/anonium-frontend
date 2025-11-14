"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Header from "@/app/components/Header";
import SidebarTabs from "@/app/components/SidebarTabs";
import PostCard from "@/app/components/PostCard";
import MobileNav from "@/app/components/MobileNav";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

type Me = {
  username: string;
  display_name?: string;
  display_name_or_username?: string;
  icon_url?: string;
  is_guest?: boolean;
};

type Post = {
  id: number;
  title: string;
  body?: string;
  author: number;
  author_username?: string;
  created_at: string;
  community_slug?: string;
  community_name?: string;
  community_icon_url?: string;
  community_visibility?: string;
  community_is_member?: boolean;
  community_membership_role?: string | null;
  community_join_policy?: string;
  community_karma?: number | null;
  score?: number;
  user_vote?: number | null;
  comments_count?: number;
  can_moderate?: boolean;
  is_deleted?: boolean;
  is_edited?: boolean;
  tag?: { name: string; color?: string } | null;
  post_type?: string;
};

type MutedUser = {
  id: number;
  username: string;
  created_at?: string;
};

type MutedCommunity = {
  id: number;
  name: string;
  slug: string;
  icon_url?: string;
  created_at?: string;
};

type JoinedCommunity = {
  id: number;
  name: string;
  slug: string;
  icon_url?: string;
  members_count: number;
  description?: string;
};

export default function MyPage() {
  const router = useRouter();
  const [signedIn, setSignedIn] = useState<boolean>(false);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [tab, setTab] = useState<string>("home");
  const [overlayMode, setOverlayMode] = useState<boolean>(false);
  const [vw, setVw] = useState<number>(0);
  const [subTab, setSubTab] = useState<'posts' | 'details'>('posts');
  const [postsTab, setPostsTab] = useState<'commented' | 'followed'>('commented');

  const [me, setMe] = useState<Me | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [followedPosts, setFollowedPosts] = useState<Post[]>([]);
  const [mutes, setMutes] = useState<MutedUser[]>([]);
  const [mutedCommunities, setMutedCommunities] = useState<MutedCommunity[]>([]);
  const [joinedCommunities, setJoinedCommunities] = useState<JoinedCommunity[]>([]);
  const [guestScore, setGuestScore] = useState<number | null>(null);
  const [currentUsername, setCurrentUsername] = useState<string>("");

  useEffect(() => {
    // セキュリティ対策: JWTトークンはCookieから自動的に認証されるため、localStorageのチェックは不要
    // setAccessは使用しない（Cookieから自動的に認証される）
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
    async function fetchMe() {
      // セキュリティ対策: JWTトークンとゲストトークンはCookieから自動的に送信される
      try {
        const res = await fetch(`${API}/api/accounts/me/`, { credentials: 'include' });
        if (!res.ok) {
          // JWTトークンがある場合は、ゲストトークンを発行しない
          // 404エラーの場合でも、JWTトークンが無効な可能性があるため、ゲストトークンは発行しない
          setMe(null);
          setSignedIn(false);
          return;
        }
        const data: Me = await res.json();
        setMe(data);
        // ゲストユーザーかどうかを確認
        const isGuest = data.is_guest || (data.username && data.username.startsWith('Anonium-'));
        const authenticated = !isGuest && !!data.username && !data.username.startsWith('Anonium-');
        setSignedIn(authenticated);
        if (data && data.username) {
          try { localStorage.setItem('accessUsername', data.username); } catch {}
          setCurrentUsername(data.username);
        }
        // ゲストユーザーのスコアも同時に設定
        if (!authenticated) {
          setGuestScore((data as any).score ?? 0);
        } else {
          setGuestScore(null);
        }
      } catch {
        setMe(null);
        setSignedIn(false);
      }
    }
    async function fetchCommentedPosts() {
      // セキュリティ対策: JWTトークンはCookieから自動的に送信される
      const headers: Record<string, string> = {};
      try {
        const res = await fetch(`${API}/api/users/me/commented-posts/`, { headers, credentials: 'include' });
        if (!res.ok) { setPosts([]); return; }
        const data = await res.json();
        // ページネーション対応: レスポンスが {count, next, previous, results} の形式の場合と配列の場合の両方に対応
        const posts = Array.isArray(data) ? data : (data.results || []);
        setPosts(posts);
      } catch {
        setPosts([]);
      }
    }
    async function fetchFollowedPosts() {
      // セキュリティ対策: JWTトークンはCookieから自動的に送信される
      // ログインユーザーのみフォローした投稿を取得可能
      if (!signedIn) {
        setFollowedPosts([]);
        return;
      }
      const headers: Record<string, string> = {};
      try {
        const res = await fetch(`${API}/api/users/me/followed-posts/`, { headers, credentials: 'include' });
        if (!res.ok) { setFollowedPosts([]); return; }
        const data = await res.json();
        // ページネーション対応: レスポンスが {count, next, previous, results} の形式の場合と配列の場合の両方に対応
        const posts = Array.isArray(data) ? data : (data.results || []);
        setFollowedPosts(posts);
      } catch {
        setFollowedPosts([]);
      }
    }
    async function fetchMutes() {
      const headers: Record<string, string> = {};
      // セキュリティ対策: JWTトークンはCookieから自動的に送信される
      try {
        const res = await fetch(`${API}/api/accounts/mutes/`, { credentials: 'include' });
        if (!res.ok) { setMutes([]); return; }
        const data = await res.json();
        const results = Array.isArray(data) ? data : (Array.isArray(data?.results) ? data.results : []);
        setMutes(results as MutedUser[]);
      } catch {
        setMutes([]);
      }
    }
    async function fetchMutedCommunities() {
      const headers: Record<string, string> = {};
      // セキュリティ対策: JWTトークンはCookieから自動的に送信される
      try {
        const res = await fetch(`${API}/api/communities/mutes/`, { credentials: 'include' });
        if (!res.ok) { setMutedCommunities([]); return; }
        const data = await res.json();
        const results = Array.isArray(data) ? data : (Array.isArray(data?.results) ? data.results : []);
        setMutedCommunities(results as MutedCommunity[]);
      } catch {
        setMutedCommunities([]);
      }
    }
    async function fetchJoinedCommunities() {
      // セキュリティ対策: JWTトークンはCookieから自動的に送信される
      try {
        const res = await fetch(`${API}/api/communities/me/`, { credentials: 'include' });
        if (!res.ok) { setJoinedCommunities([]); return; }
        const data = await res.json();
        const results = Array.isArray(data) ? data : (Array.isArray(data?.results) ? data.results : []);
        setJoinedCommunities(results as JoinedCommunity[]);
      } catch {
        setJoinedCommunities([]);
      }
    }
    fetchMe();
    fetchCommentedPosts();
    fetchFollowedPosts();
    fetchMutes();
    fetchMutedCommunities();
    fetchJoinedCommunities();
  }, [API, signedIn]);

  async function unmute(username: string) {
    // セキュリティ対策: JWTトークンはCookieから自動的に送信される
    try {
      const res = await fetch(`${API}/api/accounts/mute/${encodeURIComponent(username)}/`, { method: 'DELETE', credentials: 'include' });
      if (res.status === 204) {
        setMutes(prev => prev.filter(m => m.username !== username));
      }
    } catch {}
  }

  async function unmuteCommunity(id: number) {
    // セキュリティ対策: JWTトークンはCookieから自動的に送信される
    try {
      const res = await fetch(`${API}/api/communities/${id}/unmute/`, { method: 'DELETE', credentials: 'include' });
      if (res.status === 204) {
        setMutedCommunities(prev => prev.filter(c => c.id !== id));
      }
    } catch {}
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header
        signedIn={signedIn}
        onLogin={() => {}}
        onLogout={async () => {
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
          localStorage.removeItem('accessUsername');
          setSignedIn(false);
        }}
      />

      <main className="max-w-none mx-auto px-2 sm:px-2 md:px-3 py-6">
        <div className="mx-auto" style={{ maxWidth: vw >= 1200 ? 1200 : '100%' }}>
          <div className="flex items-start gap-4 md:gap-6 min-w-0">
            <SidebarTabs
              open={sidebarOpen}
              current={tab}
              onChange={(v) => { setTab(v); setSidebarOpen(false); }}
              setOpen={setSidebarOpen}
            />

            <section className="flex-1 min-w-0" style={{ maxWidth: vw >= 1200 ? 800 : 700 }}>
              <div className={`space-y-4 pr-1 ${vw < 500 ? 'pb-16' : ''}`}>
                {/* Header */}
                <div className="rounded-lg border border-subtle p-4 surface-1">
                  <div className="flex items-center justify-between gap-4 mb-4">
                    <h1 className="flex items-center gap-2 text-xl font-semibold">
                      <span className="material-symbols-rounded text-base" aria-hidden>manage_accounts</span>
                      <span>ユーザー設定</span>
                    </h1>
                    {me && (
                      <button className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-subtle hover:bg-white/5" onClick={() => router.push('/u/edit')}>
                        <span className="material-symbols-rounded text-base" aria-hidden>edit</span>
                        <span>編集</span>
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {me?.icon_url ? (
                      <img src={me.icon_url} alt={me.username} className="w-14 h-14 object-cover rounded-full border border-subtle" />
                    ) : (
                      <div className="w-14 h-14 rounded-full border border-subtle surface-1" />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="text-lg font-semibold">{me?.display_name_or_username || me?.display_name || me?.username || 'マイページ'}</div>
                        {me?.is_guest && (
                          <span className="px-2 py-0.5 text-xs rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                            ゲスト
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Mobile sub tabs: posts / details */}
                {vw > 0 && vw <= 1000 && (
                  <div className="rounded-lg border border-subtle p-1 surface-1 flex items-center gap-1">
                    <button
                      className={`flex-1 inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-sm ${subTab==='posts' ? 'bg-white/10' : 'hover:bg-white/10'}`}
                      onClick={() => setSubTab('posts')}
                    >
                      <span className="material-symbols-rounded text-sm" aria-hidden>forum</span>
                      <span>投稿</span>
                    </button>
                    <button
                      className={`flex-1 inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-sm ${subTab==='details' ? 'bg-white/10' : 'hover:bg-white/10'}`}
                      onClick={() => setSubTab('details')}
                    >
                      <span className="material-symbols-rounded text-sm" aria-hidden>info</span>
                      <span>詳細</span>
                    </button>
                  </div>
                )}

                {/* Posts tab with commented/followed tabs */}
                {(vw > 1000 || subTab === 'posts') && (
                  <div className="rounded-lg border border-subtle p-4 surface-1">
                    <div className={`mb-3 ${vw <= 1000 ? 'flex flex-col gap-2' : 'flex items-center justify-between'}`}>
                      <h2 className={`flex items-center gap-2 ${vw <= 1000 ? 'text-sm font-medium' : 'font-medium'}`}>
                        <span className={`material-symbols-rounded ${vw <= 1000 ? 'text-sm' : 'text-base'}`} aria-hidden>forum</span>
                        <span>投稿</span>
                      </h2>
                      {/* Tab selector for commented/followed */}
                      <div className={`inline-flex items-center gap-1 rounded-md border border-subtle overflow-hidden ${vw <= 1000 ? 'w-full' : ''}`}>
                        <button
                          className={`${vw <= 1000 ? 'px-2 py-1 text-xs flex-1' : 'px-3 py-1.5 text-sm'} ${postsTab==='commented' ? 'bg-white/10' : 'hover:bg-white/10'}`}
                          onClick={() => setPostsTab('commented')}
                        >
                          {vw <= 1000 ? 'コメント' : 'コメントした投稿'}
                        </button>
                        {signedIn && (
                          <button
                            className={`${vw <= 1000 ? 'px-2 py-1 text-xs flex-1' : 'px-3 py-1.5 text-sm'} ${postsTab==='followed' ? 'bg-white/10' : 'hover:bg-white/10'}`}
                            onClick={() => setPostsTab('followed')}
                          >
                            {vw <= 1000 ? 'フォロー' : 'フォローした投稿'}
                          </button>
                        )}
                      </div>
                    </div>
                    {postsTab === 'commented' ? (
                      posts.length === 0 ? (
                        <div className="text-sm text-subtle">まだありません。</div>
                      ) : (
                        <div className="space-y-4">
                          {posts.map(p => (
                            <PostCard
                              key={p.id}
                              post={p}
                              inVillage={false}
                              isAuthenticated={signedIn}
                              community={p.community_slug ? {
                                slug: p.community_slug,
                                is_member: p.community_is_member,
                                membership_role: p.community_membership_role ?? null,
                                clip_post_id: null,
                                join_policy: p.community_join_policy,
                                karma: p.community_karma ?? undefined,
                              } : null}
                              currentUsername={currentUsername}
                              guestScore={guestScore}
                            />
                          ))}
                        </div>
                      )
                    ) : (
                      !signedIn ? (
                        <div className="text-sm text-subtle">ログインすると表示されます。</div>
                      ) : followedPosts.length === 0 ? (
                        <div className="text-sm text-subtle">まだありません。</div>
                      ) : (
                        <div className="space-y-4">
                          {followedPosts.map(p => (
                            <PostCard
                              key={p.id}
                              post={p}
                              inVillage={false}
                              isAuthenticated={signedIn}
                              community={p.community_slug ? {
                                slug: p.community_slug,
                                is_member: p.community_is_member,
                                membership_role: p.community_membership_role ?? null,
                                clip_post_id: null,
                                join_policy: p.community_join_policy,
                                karma: p.community_karma ?? undefined,
                              } : null}
                              currentUsername={currentUsername}
                              guestScore={guestScore}
                            />
                          ))}
                        </div>
                      )
                    )}
                  </div>
                )}

                {/* Details tab content for mobile */}
                {(vw <= 1000 && subTab === 'details') && (
                  <>
                    {/* 参加しているコミュニティ */}
                    <div className="rounded-lg border border-subtle p-4 surface-1">
                      <h2 className="flex items-center gap-2 font-medium mb-3">
                        <span className="material-symbols-rounded text-base" aria-hidden>groups</span>
                        <span>参加しているアノニウム</span>
                      </h2>
                      {!signedIn ? (
                        <div className="text-sm text-subtle">ログインすると表示されます。</div>
                      ) : joinedCommunities.length === 0 ? (
                        <div className="text-sm text-subtle">参加しているアノニウムはありません。</div>
                      ) : (
                        <ul className="space-y-2">
                          {joinedCommunities.map((c) => (
                            <li key={c.id}>
                              <Link
                                href={`/v/${c.id}`}
                                className="flex items-center gap-3 min-w-0 p-2 rounded-lg hover:bg-white/5 transition-colors"
                              >
                                <div className="flex-shrink-0">
                                  {c.icon_url ? (
                                    <img src={c.icon_url} alt={c.name} className="w-10 h-10 rounded-full border border-subtle object-cover" />
                                  ) : (
                                    <div className="w-10 h-10 rounded-full border border-subtle surface-1 flex items-center justify-center">
                                      <span className="text-xs text-subtle">#</span>
                                    </div>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium text-white truncate">{c.name || c.id}</div>
                                  <div className="text-xs text-subtle">{c.members_count} メンバー</div>
                                </div>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* ミュート中のユーザー */}
                    <div className="rounded-lg border border-subtle p-4 surface-1">
                      <h2 className="flex items-center gap-2 font-medium mb-3">
                        <span className="material-symbols-rounded text-base" aria-hidden>voice_over_off</span>
                        <span>ミュート中のユーザー</span>
                      </h2>
                      {!signedIn ? (
                        <div className="text-sm text-subtle">ログインすると表示されます。</div>
                      ) : mutes.length === 0 ? (
                        <div className="text-sm text-subtle">ミュート中のユーザーはいません。</div>
                      ) : (
                        <ul className="space-y-2">
                          {mutes.map((u) => (
                            <li key={u.id} className="flex items-center gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="text-sm truncate">{u.username}</div>
                              </div>
                              <button
                                className="inline-flex items-center gap-1.5 px-2 py-1 text-xs rounded-md border border-subtle hover:bg-white/5"
                                onClick={() => unmute(u.username)}
                                title="ミュート解除"
                              >
                                <span className="material-symbols-rounded text-sm" aria-hidden>volume_up</span>
                                <span>解除</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* ミュート中のコミュニティ */}
                    <div className="rounded-lg border border-subtle p-4 surface-1">
                      <h2 className="flex items-center gap-2 font-medium mb-3">
                        <span className="material-symbols-rounded text-base" aria-hidden>notifications_off</span>
                        <span>ミュート中のアノニウム</span>
                      </h2>
                      {mutedCommunities.length === 0 ? (
                        <div className="text-sm text-subtle">ミュート中のアノニウムはありません。</div>
                      ) : (
                        <ul className="space-y-2">
                          {mutedCommunities.map((c) => (
                            <li key={c.id} className="flex items-center gap-2">
                              {c.icon_url ? (
                                <img src={c.icon_url} alt={c.name} className="w-8 h-8 rounded-full border border-subtle object-cover flex-shrink-0" />
                              ) : (
                                <div className="w-8 h-8 rounded-full border border-subtle surface-1 flex-shrink-0" />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="text-sm truncate">{c.name}</div>
                              </div>
                              <button
                                className="inline-flex items-center gap-1.5 px-2 py-1 text-xs rounded-md border border-subtle hover:bg-white/5"
                                onClick={() => unmuteCommunity(c.id)}
                                title="ミュート解除"
                              >
                                <span className="material-symbols-rounded text-sm" aria-hidden>volume_up</span>
                                <span>解除</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </>
                )}
              </div>
            </section>
            <aside className={vw >= 1000 ? 'block' : 'hidden'} style={{ width: 320 }}>
              <div className="space-y-4">
                {/* 参加しているコミュニティ */}
                <div className="rounded-lg border border-subtle p-4 surface-1">
                  <h2 className="flex items-center gap-2 font-medium mb-3">
                    <span className="material-symbols-rounded text-base" aria-hidden>groups</span>
                    <span>参加しているコミュニティ</span>
                  </h2>
                  {!signedIn ? (
                    <div className="text-sm text-subtle">ログインすると表示されます。</div>
                  ) : joinedCommunities.length === 0 ? (
                    <div className="text-sm text-subtle">参加しているコミュニティはありません。</div>
                  ) : (
                    <ul className="space-y-2">
                      {joinedCommunities.map((c) => (
                        <li key={c.id}>
                          <Link
                            href={`/v/${c.id}`}
                            className="flex items-center gap-3 min-w-0 p-2 rounded-lg hover:bg-white/5 transition-colors"
                          >
                            <div className="flex-shrink-0">
                              {c.icon_url ? (
                                <img src={c.icon_url} alt={c.name} className="w-10 h-10 rounded-full border border-subtle object-cover" />
                              ) : (
                                <div className="w-10 h-10 rounded-full border border-subtle surface-1 flex items-center justify-center">
                                  <span className="text-xs text-subtle">#</span>
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-white truncate">{c.name || c.id}</div>
                              <div className="text-xs text-subtle">{c.members_count} メンバー</div>
                            </div>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="rounded-lg border border-subtle p-4 surface-1">
                  <h2 className="flex items-center gap-2 font-medium mb-3">
                    <span className="material-symbols-rounded text-base" aria-hidden>voice_over_off</span>
                    <span>ミュート中のユーザー</span>
                  </h2>
                  {!signedIn ? (
                    <div className="text-sm text-subtle">ログインすると表示されます。</div>
                  ) : mutes.length === 0 ? (
                    <div className="text-sm text-subtle">ミュート中のユーザーはいません。</div>
                  ) : (
                    <ul className="space-y-2">
                      {mutes.map((u) => (
                        <li key={u.id} className="flex items-center gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm truncate">{u.username}</div>
                          </div>
                          <button
                            className="inline-flex items-center gap-1.5 px-2 py-1 text-xs rounded-md border border-subtle hover:bg-white/5"
                            onClick={() => unmute(u.username)}
                            title="ミュート解除"
                          >
                            <span className="material-symbols-rounded text-sm" aria-hidden>volume_up</span>
                            <span>解除</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="rounded-lg border border-subtle p-4 surface-1">
                  <h2 className="flex items-center gap-2 font-medium mb-3">
                    <span className="material-symbols-rounded text-base" aria-hidden>notifications_off</span>
                    <span>ミュート中のコミュニティ</span>
                  </h2>
                  {mutedCommunities.length === 0 ? (
                    <div className="text-sm text-subtle">ミュート中のコミュニティはありません。</div>
                  ) : (
                    <ul className="space-y-2">
                      {mutedCommunities.map((c) => (
                        <li key={c.id} className="flex items-center gap-2">
                          {c.icon_url ? (
                            <img src={c.icon_url} alt={c.name} className="w-8 h-8 rounded-full border border-subtle object-cover flex-shrink-0" />
                          ) : (
                            <div className="w-8 h-8 rounded-full border border-subtle surface-1 flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm truncate">{c.name}</div>
                          </div>
                          <button
                            className="inline-flex items-center gap-1.5 px-2 py-1 text-xs rounded-md border border-subtle hover:bg-white/5"
                            onClick={() => unmuteCommunity(c.id)}
                            title="ミュート解除"
                          >
                            <span className="material-symbols-rounded text-sm" aria-hidden>volume_up</span>
                            <span>解除</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>
      <MobileNav current={tab} onChange={(v) => { setTab(v); }} />
    </div>
  );
}


