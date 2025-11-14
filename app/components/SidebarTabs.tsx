"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getRecentPosts, clearRecentPosts, removeRecentPost, RecentPost } from "@/app/utils/recentPosts";
import { getRecentCommunities, clearRecentCommunities, removeRecentCommunity, RecentCommunity } from "@/app/utils/recentCommunities";
import AtomIcon from "@/app/components/AtomIcon";

type SidebarTabsProps = {
  open: boolean;
  current: string;
  onChange: (val: string) => void;
  setOpen: (open: boolean) => void;
};

export default function SidebarTabs({ open, current, onChange, setOpen }: SidebarTabsProps) {
  const [vw, setVw] = useState<number>(0);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [recentPosts, setRecentPosts] = useState<RecentPost[]>([]);
  const [communityTab, setCommunityTab] = useState<'recent'|'joined'>('joined');
  const [recentCommunities, setRecentCommunities] = useState<RecentCommunity[]>([]);
  const [joinedCommunities, setJoinedCommunities] = useState<Array<{ id: number; name: string; icon_url?: string; is_favorite?: boolean }>>([]);
  const [recentOpen, setRecentOpen] = useState<boolean>(false);
  const [communitiesOpen, setCommunitiesOpen] = useState<boolean>(false);
  const API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

  useEffect(() => {
    function onResize() { setVw(window.innerWidth); }
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // オーバーレイモードでESCキーを押したら閉じる（必ず他のフックと同階層で宣言）
  useEffect(() => {
    // isOverlayは後で定義されるため、ここでは条件を直接記述
    if (vw >= 1200 ? !isExpanded : !open) return;
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (vw >= 1200) {
          setIsExpanded(false);
        } else {
          setOpen(false);
        }
      }
    }
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [vw, open, setOpen, isExpanded]);

  // 最近見た投稿を読み込む（ガードreturnより前に配置）
  useEffect(() => {
    setRecentPosts(getRecentPosts());
    setRecentCommunities(getRecentCommunities());
    if (communitiesOpen) {
      fetchJoinedCommunities();
    }
  }, [current, communitiesOpen]);

  // ディスクロージャーが開いている場合はサイドバーも開く
  useEffect(() => {
    if (recentOpen || communitiesOpen) {
      ensureExpanded();
    }
  }, [recentOpen, communitiesOpen]);

  async function fetchJoinedCommunities() {
    try {
      // セキュリティ対策: JWTトークンはCookieから自動的に送信される
      const res = await fetch(`${API}/api/communities/me/`, { credentials: 'include' });
      if (!res.ok) { setJoinedCommunities([]); return; }
      const data = await res.json();
      // ページネーション対応: レスポンスが {count, next, previous, results} の形式の場合と配列の場合の両方に対応
      const items = Array.isArray(data) ? data : (data.results || []);
      const list = items.map((c: any) => ({ id: c.id, name: c.name, icon_url: c.icon_url, is_favorite: !!c.is_favorite }));
      // お気に入り優先（true を先頭）、次に名前順
      list.sort((a: any, b: any) => (Number(!!b.is_favorite) - Number(!!a.is_favorite)) || a.name.localeCompare(b.name));
      setJoinedCommunities(list);
    } catch {
      setJoinedCommunities([]);
    }
  }

  async function toggleFavorite(id: number, next: boolean) {
    // セキュリティ対策: JWTトークンはCookieから自動的に送信される
    try {
      const res = await fetch(`${API}/api/communities/${id}/favorite/`, { method: next ? 'POST' : 'DELETE', credentials: 'include' });
      if (res.ok) {
        setJoinedCommunities(prev => {
          const updated = prev.map(c => c.id === id ? { ...c, is_favorite: next } : c);
          updated.sort((a, b) => (Number(!!b.is_favorite) - Number(!!a.is_favorite)) || a.name.localeCompare(b.name));
          return [...updated];
        });
      }
    } catch {}
  }

  if (vw > 0 && vw < 500) {
    return null;
  }

  const items = [
    { key: "home", label: "ホーム", icon: "home", href: "/" },
    { key: "search", label: "探す", icon: "search", href: "/search" },
    { key: "recent", label: "最近見た", icon: "history" },
    { key: "communities", label: "アノニウム", icon: "science" },
    { key: "unreal", label: "UnReal", icon: "image" },
    { key: "message", label: "メッセージ", icon: "chat", href: "/messages" },
  ];

  // 時間表示ヘルパー関数
  function formatTimeAgo(timestamp: number): string {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (minutes < 1) return 'たった今';
    if (minutes < 60) return `${minutes}分前`;
    if (hours < 24) return `${hours}時間前`;
    if (days < 7) return `${days}日前`;
    return new Date(timestamp).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
  }

  const railWidth = 60;
  const isOverlay = vw >= 1200 ? isExpanded : open;
  const handleCloseOverlay = () => {
    if (vw >= 1200) {
      setIsExpanded(false);
    } else {
      setOpen(false);
    }
  };

  const toggleExpanded = () => {
    const next = !isExpanded;
    setIsExpanded(next);
    localStorage.setItem('sidebarExpanded', String(next));
  };

  function ensureExpanded() {
    if (vw >= 1200) {
    setIsExpanded(true);
    } else {
      setOpen(true);
    }
  }

  return (
    <>
      {/* overlay for mobile */}
      {isOverlay && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={handleCloseOverlay}
          />
          {/* オーバーレイ詳細パネル */}
          <aside
            className="fixed top-14 left-0 w-60 h-[calc(100vh-56px)] bg-background border-r border-subtle z-50"
          >
            <div className="h-full flex flex-col items-stretch overflow-auto hover-scroll">
              <div className="flex items-center justify-between p-2 border-b border-subtle">
                <button
                  onClick={handleCloseOverlay}
                  className="w-8 h-8 inline-flex items-center justify-center rounded-md hover:bg-white/10 text-white"
                  title="閉じる"
                  aria-label="閉じる"
                >
                  <span className="material-symbols-rounded text-base" aria-hidden>
                    close
                  </span>
                </button>
              </div>
              <nav className="flex-1 flex flex-col gap-1 p-2">
                {items.map((t) => {
                  if (t.key === 'recent') {
                    return (
                      <div key={t.key}>
                        <button
                          className={`flex items-center justify-between gap-2 rounded-md px-2 py-2 text-left text-white hover:bg-white/15 w-full`}
                          onClick={() => setRecentOpen(v => !v)}
                          aria-expanded={recentOpen}
                          aria-controls="overlay-recent"
                          title={t.label}
                        >
                          <span className="inline-flex items-center gap-2">
                            <span className="material-symbols-rounded" aria-hidden>{t.icon}</span>
                            <span className="text-sm">{t.label}</span>
                          </span>
                          <span className="material-symbols-rounded text-sm" aria-hidden>{recentOpen ? 'expand_less' : 'expand_more'}</span>
                        </button>
                        <div id="overlay-recent" className="overflow-hidden transition-all" style={{ maxHeight: recentOpen ? 480 : 0 }}>
                          <div className="border-t border-subtle p-2">
                            <div className="flex items-center justify-between mb-2">
                              <div className="text-xs text-subtle">最近見た投稿</div>
                              {recentPosts.length > 0 && (
                                <button
                                  className="text-xs text-subtle hover:text-white px-2 py-1 rounded hover:bg-white/10 transition-colors"
                                  onClick={() => {
                                    if (window.confirm('最近見た投稿をすべて削除しますか？')) {
                                      clearRecentPosts();
                                      setRecentPosts([]);
                                    }
                                  }}
                                  title="クリア"
                                >
                                  クリア
                                </button>
                              )}
                            </div>
                            <div className="space-y-1 max-h-[60vh] overflow-y-auto hover-scroll">
                              {recentPosts.length === 0 ? (
                                <div className="text-xs text-subtle text-center py-4">
                                  まだ閲覧履歴がありません
                                </div>
                              ) : (
                                recentPosts.map((post) => (
                                  <div key={post.id} className="group">
                                    <Link
                                      href={`/p/${post.id}`}
                                      className="block p-2 rounded-md hover:bg-white/10 transition-colors border border-transparent hover:border-subtle"
                                      onClick={handleCloseOverlay}
                                    >
                                      <div className="text-xs font-medium text-white line-clamp-2 mb-1">
                                        {post.title}
                                      </div>
                                      <div className="text-[10px] text-subtle flex items-center gap-1.5">
                                        {post.community_name && (
                                          <>
                                            <span>{post.community_name}</span>
                                            <span className="opacity-50">・</span>
                                          </>
                                        )}
                                        <span className="truncate">
                                          {formatTimeAgo(post.viewed_at)}
                                        </span>
                                      </div>
                                    </Link>
                                    <button
                                      className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/20 transition-all"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        removeRecentPost(post.id);
                                        setRecentPosts(getRecentPosts());
                                      }}
                                      title="削除"
                                    >
                                      <span className="material-symbols-rounded text-xs">close</span>
                                    </button>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  if (t.key === 'communities') {
                    return (
                      <div key={t.key}>
                        <button
                          className={`flex items-center justify-between gap-2 rounded-md px-2 py-2 text-left text-white hover:bg-white/15 w-full`}
                          onClick={() => setCommunitiesOpen(v => !v)}
                          aria-expanded={communitiesOpen}
                          aria-controls="overlay-communities"
                          title={t.label}
                        >
                          <span className="inline-flex items-center gap-2">
                            {t.key === 'communities' ? (
                              <AtomIcon size={24} className="flex-shrink-0" />
                            ) : (
                              <span className="material-symbols-rounded" aria-hidden>{t.icon}</span>
                            )}
                            <span className="text-sm">{t.label}</span>
                          </span>
                          <span className="material-symbols-rounded text-sm" aria-hidden>{communitiesOpen ? 'expand_less' : 'expand_more'}</span>
                        </button>
                        <div id="overlay-communities" className="overflow-hidden transition-all" style={{ maxHeight: communitiesOpen ? 520 : 0 }}>
                          <div className="border-t border-subtle p-2">
                            <div className="flex items-center justify-between mb-2">
                              <div className="text-xs text-subtle">アノニウム</div><br />
                              <div className="inline-flex items-center gap-1 rounded-md border border-subtle overflow-hidden">
                                <button className={`px-2 py-1 text-xs ${communityTab==='joined' ? 'bg-white/10' : 'hover:bg-white/10'}`} onClick={() => { setCommunityTab('joined'); fetchJoinedCommunities(); }}>参加中</button>
                                <button className={`px-2 py-1 text-xs ${communityTab==='recent' ? 'bg-white/10' : 'hover:bg-white/10'}`} onClick={() => setCommunityTab('recent')}>最近</button>
                              </div>
                            </div>
                            {communityTab === 'recent' ? (
                              <div className="space-y-1 max-h-[60vh] overflow-y-auto hover-scroll">
                                {recentCommunities.length === 0 ? (
                                  <div className="text-xs text-subtle text-center py-4">履歴がありません</div>
                                ) : (
                                  recentCommunities.map((c) => (
                                    <div key={c.id} className="group">
                                      <Link href={`/v/${c.id}`} className="flex items-center gap-2 p-2 rounded-md hover:bg-white/10 transition-colors border border-transparent hover:border-subtle" onClick={handleCloseOverlay}>
                                        {c.icon_url ? (
                                          <img src={c.icon_url} alt={c.name} className="w-6 h-6 rounded-full border border-subtle object-cover" />
                                        ) : (
                                          <span className="w-6 h-6 rounded-full border border-subtle surface-1 inline-flex items-center justify-center text-[10px]">#</span>
                                        )}
                                        <span className="text-xs truncate">{c.name}</span>
                                      </Link>
                                      <button className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/20 transition-all" onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeRecentCommunity(c.id); setRecentCommunities(getRecentCommunities()); }} title="削除">
                                        <span className="material-symbols-rounded text-xs">close</span>
                                      </button>
                                    </div>
                                  ))
                                )}
                                {recentCommunities.length > 0 && (
                                  <div className="pt-1 flex justify-end">
                                    <button className="text-xs text-subtle hover:text-white px-2 py-1 rounded hover:bg-white/10 transition-colors" onClick={() => { if (window.confirm('最近訪れたアノニウムをすべて削除しますか？')) { clearRecentCommunities(); setRecentCommunities([]); } }}>クリア</button>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="space-y-1 max-h-[60vh] overflow-y-auto hover-scroll">
                                {joinedCommunities.length === 0 ? (
                                  <div className="text-xs text-subtle text-center py-4">参加中のアノニウムがありません</div>
                                ) : (
                                  joinedCommunities.map((c) => (
                                    <div key={c.id} className="group relative flex items-center gap-2 p-2 rounded-md hover:bg-white/10 transition-colors border border-transparent hover:border-subtle">
                                      <Link href={`/v/${c.id}`} className="flex items-center gap-2 min-w-0 flex-1" onClick={handleCloseOverlay}>
                                        {c.icon_url ? (
                                          <img src={c.icon_url} alt={c.name} className="w-6 h-6 rounded-full border border-subtle object-cover" />
                                        ) : (
                                          <span className="w-6 h-6 rounded-full border border-subtle surface-1 inline-flex items-center justify-center text-[10px]">#</span>
                                        )}
                                        <span className="text-xs truncate">{c.name}</span>
                                      </Link>
                                      <button
                                        className="ml-auto text-xs px-1.5 py-0.5 rounded-md border border-subtle surface-1 hover:bg-white/5"
                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavorite(c.id, !c.is_favorite); }}
                                        title={c.is_favorite ? 'お気に入り解除' : 'お気に入り'}
                                      >
                                        <span style={{ color: '#1e3a8a' }}>{c.is_favorite ? '★' : '☆'}</span>
                                      </button>
                                    </div>
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return t.href ? (
                    <Link
                      key={t.key}
                      href={t.href}
                      className={`flex items-center gap-2 rounded-md px-2 py-2 text-white ${current===t.key ? 'bg-white/20' : 'hover:bg-white/15'}`}
                      onClick={() => { onChange(t.key); handleCloseOverlay(); }}
                      title={t.label}
                    >
                      <span className="material-symbols-rounded" aria-hidden>{t.icon}</span>
                      <span className="text-sm">{t.label}</span>
                    </Link>
                  ) : (
                    <button
                      key={t.key}
                      className={`flex items-center gap-2 rounded-md px-2 py-2 text-left text-white ${current===t.key ? 'bg-white/20' : 'hover:bg-white/15'}`}
                      onClick={() => { onChange(t.key); handleCloseOverlay(); }}
                      title={t.label}
                      aria-label={t.label}
                    >
                      <span className="material-symbols-rounded" aria-hidden>{t.icon}</span>
                      <span className="text-sm">{t.label}</span>
                    </button>
                  );
                })}
              </nav>
              {/* 使い方リンク（オーバーレイモード） */}
              <div className="border-t border-subtle p-2">
                <Link
                  href="/about"
                  className="flex items-center gap-2 rounded-md px-2 py-2 text-white hover:bg-white/15 transition-colors"
                  onClick={handleCloseOverlay}
                  title="使い方"
                >
                  <span className="material-symbols-rounded" aria-hidden>help_outline</span>
                  <span className="text-sm">使い方</span>
                </Link>
              </div>
            </div>
          </aside>
        </>
      )}
      {/* spacer to avoid layout overlap with fixed rail */}
      <div aria-hidden className="shrink-0" style={{ width: railWidth }} />
    <aside
      className="shrink-0 border-r border-subtle bg-background fixed top-14 left-0 z-40"
      style={{ width: railWidth, height: 'calc(100vh - 56px)' }}
    >
      <div className="h-full flex flex-col items-stretch overflow-auto hover-scroll">
        <div className="flex items-center justify-between p-2 border-b border-subtle">
          <button
            onClick={vw >= 1200 ? toggleExpanded : () => setOpen(true)}
            className="w-8 h-8 inline-flex items-center justify-center rounded-md hover:bg-white/10 text-white"
            title="メニュー"
            aria-label="メニュー"
          >
            <span className="material-symbols-rounded text-base" aria-hidden>
              menu
            </span>
          </button>
        </div>
        <nav className="flex-1 flex flex-col gap-1 p-2">
          {items.map((t) => {
            if (t.key === 'recent') {
              return (
                <div key={t.key}>
                  <button
                    className={`flex items-center justify-between gap-2 rounded-md px-2 py-2 text-left text-white hover:bg-white/15 w-full`}
                    onClick={() => { ensureExpanded(); setRecentOpen(v => !v); }}
                    aria-expanded={recentOpen}
                    aria-controls="aside-recent"
                    title={t.label}
                  >
                    <span className="inline-flex items-center gap-2">
                      <span className="material-symbols-rounded" aria-hidden>{t.icon}</span>
                      {isExpanded && railWidth >= 200 && <span className="text-sm">{t.label}</span>}
                    </span>
                    {isExpanded && railWidth >= 200 && (
                      <span className="material-symbols-rounded text-sm" aria-hidden>{recentOpen ? 'expand_less' : 'expand_more'}</span>
                    )}
                  </button>
                  <div id="aside-recent" className="overflow-hidden transition-all" style={{ maxHeight: recentOpen && isExpanded ? 480 : 0 }}>
                    <div className="border-t border-subtle p-2">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-xs text-subtle">最近見た投稿</div>
                        {recentPosts.length > 0 && (
                          <button
                            className="text-xs text-subtle hover:text-white px-2 py-1 rounded hover:bg-white/10 transition-colors"
                            onClick={() => {
                              if (window.confirm('最近見た投稿をすべて削除しますか？')) {
                                clearRecentPosts();
                                setRecentPosts([]);
                              }
                            }}
                            title="クリア"
                          >
                            クリア
                          </button>
                        )}
                      </div>
                      <div className="space-y-1 max-h-[60vh] overflow-y-auto hover-scroll">
                        {recentPosts.length === 0 ? (
                          <div className="text-xs text-subtle text-center py-4">
                            まだ閲覧履歴がありません
                          </div>
                        ) : (
                          recentPosts.map((post) => (
                            <div key={post.id} className="group relative">
                              <Link
                                href={`/p/${post.id}`}
                                className="block p-2 rounded-md hover:bg-white/10 transition-colors border border-transparent hover:border-subtle"
                              >
                                <div className="text-xs font-medium text-white line-clamp-2 mb-1">
                                  {post.title}
                                </div>
                                <div className="text-[10px] text-subtle flex items-center gap-1.5">
                                  {post.community_name && (
                                    <>
                                      <span>{post.community_name}</span>
                                      <span className="opacity-50">・</span>
                                    </>
                                  )}
                                  <span className="truncate">
                                    {formatTimeAgo(post.viewed_at)}
                                  </span>
                                </div>
                              </Link>
                              <button
                                className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/20 transition-all"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  removeRecentPost(post.id);
                                  setRecentPosts(getRecentPosts());
                                }}
                                title="削除"
                              >
                                <span className="material-symbols-rounded text-xs">close</span>
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            }
            if (t.key === 'communities') {
              return (
                <div key={t.key}>
                  <button
                    className={`flex items-center justify-between gap-2 rounded-md px-2 py-2 text-left text-white hover:bg-white/15 w-full`}
                    onClick={() => { ensureExpanded(); setCommunitiesOpen(v => !v); }}
                    aria-expanded={communitiesOpen}
                    aria-controls="aside-communities"
                    title={t.label}
                  >
                    <span className="inline-flex items-center gap-2">
                      <AtomIcon size={24} className="flex-shrink-0" />
                      {isExpanded && railWidth >= 200 && <span className="text-sm">{t.label}</span>}
                    </span>
                    {isExpanded && railWidth >= 200 && (
                      <span className="material-symbols-rounded text-sm" aria-hidden>{communitiesOpen ? 'expand_less' : 'expand_more'}</span>
                    )}
                  </button>
                  <div id="aside-communities" className="overflow-hidden transition-all" style={{ maxHeight: communitiesOpen && isExpanded ? 520 : 0 }}>
                    <div className="border-t border-subtle p-2">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-xs text-subtle">アノニウム</div>
                        <div className="inline-flex items-center gap-1 rounded-md border border-subtle overflow-hidden">
                          <button className={`px-2 py-1 text-xs ${communityTab==='joined' ? 'bg-white/10' : 'hover:bg-white/10'}`} onClick={() => { setCommunityTab('joined'); fetchJoinedCommunities(); }}>参加中</button>
                          <button className={`px-2 py-1 text-xs ${communityTab==='recent' ? 'bg-white/10' : 'hover:bg-white/10'}`} onClick={() => setCommunityTab('recent')}>最近</button>
                        </div>
                      </div>
                      {communityTab === 'recent' ? (
                        <div className="space-y-1 max-h-[60vh] overflow-y-auto hover-scroll">
                          {recentCommunities.length === 0 ? (
                            <div className="text-xs text-subtle text-center py-4">履歴がありません</div>
                          ) : (
                            recentCommunities.map((c) => (
                              <div key={c.id} className="group relative">
                                <Link href={`/v/${c.id}`} className="flex items-center gap-2 p-2 rounded-md hover:bg-white/10 transition-colors border border-transparent hover:border-subtle">
                                  {c.icon_url ? (
                                    <img src={c.icon_url} alt={c.name} className="w-6 h-6 rounded-full border border-subtle object-cover" />
                                  ) : (
                                    <span className="w-6 h-6 rounded-full border border-subtle surface-1 inline-flex items-center justify-center text-[10px]">#</span>
                                  )}
                                  <span className="text-xs truncate">{c.name}</span>
                                </Link>
                                <button className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/20 transition-all" onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeRecentCommunity(c.id); setRecentCommunities(getRecentCommunities()); }} title="削除">
                                  <span className="material-symbols-rounded text-xs">close</span>
                                </button>
                              </div>
                            ))
                          )}
                          {recentCommunities.length > 0 && (
                            <div className="pt-1 flex justify-end">
                              <button className="text-xs text-subtle hover:text-white px-2 py-1 rounded hover:bg-white/10 transition-colors" onClick={() => { if (window.confirm('最近訪れたアノニウムをすべて削除しますか？')) { clearRecentCommunities(); setRecentCommunities([]); } }}>クリア</button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-1 max-h-[60vh] overflow-y-auto hover-scroll">
                          {joinedCommunities.length === 0 ? (
                            <div className="text-xs text-subtle text-center py-4">参加中のアノニウムがありません</div>
                          ) : (
                            joinedCommunities.map((c) => (
                              <div key={c.id} className="group relative flex items-center gap-2 p-2 rounded-md hover:bg-white/10 transition-colors border border-transparent hover:border-subtle">
                                <Link href={`/v/${c.id}`} className="flex items-center gap-2 min-w-0 flex-1">
                                  {c.icon_url ? (
                                    <img src={c.icon_url} alt={c.name} className="w-6 h-6 rounded-full border border-subtle object-cover" />
                                  ) : (
                                    <span className="w-6 h-6 rounded-full border border-subtle surface-1 inline-flex items-center justify-center text-[10px]">#</span>
                                  )}
                                  <span className="text-xs truncate">{c.name}</span>
                                </Link>
                                <button
                                  className="ml-auto text-xs px-1.5 py-0.5 rounded-md border border-subtle surface-1 hover:bg-white/5"
                                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavorite(c.id, !c.is_favorite); }}
                                  title={c.is_favorite ? 'お気に入り解除' : 'お気に入り'}
                                >
                                  {c.is_favorite ? '★' : '☆'}
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            }
            return t.href ? (
              <Link
                key={t.key}
                href={t.href}
                className={`flex items-center gap-2 rounded-md px-2 py-2 text-white ${current===t.key ? 'bg-white/20' : 'hover:bg-white/15'}`}
                onClick={() => onChange(t.key)}
                title={t.label}
              >
                {t.key === 'communities' ? (
                  <AtomIcon size={32} className="flex-shrink-0" />
                ) : (
                  <span className="material-symbols-rounded" aria-hidden>{t.icon}</span>
                )}
                {isExpanded && railWidth >= 200 && <span className="text-sm">{t.label}</span>}
              </Link>
            ) : (
              <button
                key={t.key}
                className={`flex items-center gap-2 rounded-md px-2 py-2 text-left text-white ${current===t.key ? 'bg-white/20' : 'hover:bg-white/15'}`}
                onClick={() => onChange(t.key)}
                title={t.label}
                aria-label={t.label}
              >
                {t.key === 'communities' ? (
                  <AtomIcon size={32} className="flex-shrink-0" />
                ) : (
                  <span className="material-symbols-rounded" aria-hidden>{t.icon}</span>
                )}
                {isExpanded && railWidth >= 200 && <span className="text-sm">{t.label}</span>}
              </button>
            );
          })}
        </nav>
        {/* 使い方リンク */}
        <div className="border-t border-subtle p-2">
          <Link
            href="/about"
            className="flex items-center gap-2 rounded-md px-2 py-2 text-white hover:bg-white/15 transition-colors"
            onClick={vw >= 1200 ? undefined : handleCloseOverlay}
            title="使い方"
          >
            <span className="material-symbols-rounded" aria-hidden>help_outline</span>
            {isExpanded && railWidth >= 200 && <span className="text-sm">使い方</span>}
          </Link>
        </div>
      </div>
    </aside>
    </>
  );
}
