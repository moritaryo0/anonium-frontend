"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getRecentPosts, clearRecentPosts, removeRecentPost, RecentPost } from "@/app/utils/recentPosts";
import { getRecentCommunities, clearRecentCommunities, removeRecentCommunity, RecentCommunity } from "@/app/utils/recentCommunities";
import AtomIcon from "@/app/components/AtomIcon";

type MobileNavProps = {
  current: string;
  onChange: (val: string) => void;
};

export default function MobileNav({ current, onChange }: MobileNavProps) {
  const items = [
    { key: 'home', label: 'ホーム', icon: 'home', link: '/' },
    { key: 'search', label: '探す', icon: 'search', link: '/search' },
    { key: 'communities', label: 'アノニウム', icon: 'science' },
    { key: 'unreal', label: 'UnReal', icon: 'image' },
    { key: 'message', label: 'メッセージ', icon: 'chat', link: '/messages' },
  ];

  const [sheetOpen, setSheetOpen] = useState<boolean>(false);
  const [sheetTab, setSheetTab] = useState<'recent'|'communities'>('recent');
  const [recentPosts, setRecentPosts] = useState<RecentPost[]>([]);
  const [recentCommunities, setRecentCommunities] = useState<RecentCommunity[]>([]);
  const [communityTab, setCommunityTab] = useState<'recent'|'joined'>('joined');
  const [joinedCommunities, setJoinedCommunities] = useState<Array<{ id: number; name: string; icon_url?: string; is_favorite?: boolean }>>([]);
  const API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

  // swipe/drag states
  const [dragY, setDragY] = useState<number>(0); // current translateY(px)
  const [animating, setAnimating] = useState<boolean>(false); // enable transition
  const startYRef = useRef<number | null>(null);
  const lastYRef = useRef<number>(0);
  const lastTsRef = useRef<number>(0);

  useEffect(() => {
    if (!sheetOpen) return;
    setRecentPosts(getRecentPosts());
    setRecentCommunities(getRecentCommunities());
  }, [sheetOpen]);

  useEffect(() => {
    if (!sheetOpen) return;
    if (sheetTab === 'communities' && communityTab === 'joined') {
      fetchJoinedCommunities();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetOpen, sheetTab, communityTab]);

  async function fetchJoinedCommunities() {
    try {
      // セキュリティ対策: JWTトークンはCookieから自動的に送信される
      const res = await fetch(`${API}/api/communities/me/`, { credentials: 'include' });
      if (!res.ok) { setJoinedCommunities([]); return; }
      const data = await res.json();
      // ページネーション対応: レスポンスが {count, next, previous, results} の形式の場合と配列の場合の両方に対応
      const items = Array.isArray(data) ? data : (data.results || []);
      const list = items.map((c: any) => ({ id: c.id, name: c.name, icon_url: c.icon_url, is_favorite: !!c.is_favorite }));
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

  function openSheetFor(tab: 'recent'|'communities') {
    setSheetTab(tab);
    setSheetOpen(true);
    // animate from bottom
    setAnimating(true);
    setDragY(0);
  }

  function closeSheet() {
    // animate down then close
    setAnimating(true);
    setDragY(0);
    setSheetOpen(false);
  }

  // touch handlers
  function onTouchStart(e: React.TouchEvent<HTMLDivElement>) {
    const t = e.touches[0];
    startYRef.current = t.clientY;
    lastYRef.current = t.clientY;
    lastTsRef.current = e.timeStamp;
    setAnimating(false);
  }
  function onTouchMove(e: React.TouchEvent<HTMLDivElement>) {
    if (startYRef.current == null) return;
    const t = e.touches[0];
    const dy = Math.max(0, t.clientY - startYRef.current);
    setDragY(dy);
    lastYRef.current = t.clientY;
    lastTsRef.current = e.timeStamp;
  }
  function onTouchEnd(e: React.TouchEvent<HTMLDivElement>) {
    if (startYRef.current == null) return;
    const dy = Math.max(0, (lastYRef.current - startYRef.current));
    const dt = Math.max(1, e.timeStamp - lastTsRef.current);
    const velocity = dy / dt; // px per ms
    const shouldClose = dy > 120 || velocity > 0.6;
    setAnimating(true);
    if (shouldClose) {
      // snap down and close
      setDragY(0);
      setSheetOpen(false);
    } else {
      // snap back
      setDragY(0);
    }
    startYRef.current = null;
  }

  function formatTimeAgo(timestamp: number): string {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (minutes < 1) return 'たった今';
    if (minutes < 60) return `${minutes}分前`;
    if (hours < 24) return `${hours}時間前`;
    if (days < 7) return `${days}日前`;
    return new Date(timestamp).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' } as any);
  }

  return (
    <>
      {/* Bottom Sheet Overlay */}
      {sheetOpen && (
        <>
          <div className="fixed inset-0 bg-black/50 z-[70]" onClick={closeSheet} />
          <div className="fixed inset-x-0 bottom-0 z-[75]">
            <div className="mx-auto max-w-2xl">
              <div
                className={`rounded-t-2xl border border-subtle border-b-0 surface-1 overflow-hidden shadow-2xl translate-y-0 ${animating ? 'transition-transform duration-200 ease-out' : ''}`}
                style={{ transform: dragY ? `translateY(${dragY}px)` : undefined }}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
              >
                <div className="pt-2 pb-1 flex items-center justify-center">
                  <div className="w-10 h-1.5 rounded-full bg-white/20" />
                </div>
                <div className="p-3 flex items-center justify-between border-b border-subtle">
                  <div className="inline-flex items-center gap-1 rounded-md border border-subtle overflow-hidden">
                    <button className={`px-3 py-1.5 text-sm ${sheetTab==='recent' ? 'bg-white/10' : 'hover:bg-white/10'}`} onClick={() => setSheetTab('recent')}>最近見た</button>
                    <button className={`px-3 py-1.5 text-sm ${sheetTab==='communities' ? 'bg-white/10' : 'hover:bg-white/10'}`} onClick={() => setSheetTab('communities')}>アノニウム</button>
                  </div>
                  <button className="w-9 h-9 inline-flex items-center justify-center rounded-md hover:bg-white/10" onClick={closeSheet} aria-label="閉じる">
                    <span className="material-symbols-rounded">close</span>
                  </button>
                </div>
                <div className="max-h-[70vh] overflow-y-auto p-2 hover-scroll">
                  {sheetTab === 'recent' ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between px-1">
                        <div className="text-xs text-subtle">最近見た投稿</div>
                        {recentPosts.length > 0 && (
                          <button className="text-xs text-subtle hover:text-white px-2 py-1 rounded hover:bg-white/10" onClick={() => { if (window.confirm('最近見た投稿をすべて削除しますか？')) { clearRecentPosts(); setRecentPosts([]); } }}>クリア</button>
                        )}
                      </div>
                      <div className="space-y-1">
                        {recentPosts.length === 0 ? (
                          <div className="text-xs text-subtle text-center py-6">まだ閲覧履歴がありません</div>
                        ) : (
                          recentPosts.map((post) => (
                            <div key={post.id} className="group relative">
                              <Link href={`/p/${post.id}`} className="block p-2 rounded-md hover:bg-white/10 transition-colors border border-transparent hover:border-subtle" onClick={closeSheet}>
                                <div className="text-xs font-medium text-white line-clamp-2 mb-1">{post.title}</div>
                                <div className="text-[10px] text-subtle flex items-center gap-1.5">
                                  {post.community_name && (<><span>{post.community_name}</span><span className="opacity-50">・</span></>)}
                                  <span className="truncate">{formatTimeAgo(post.viewed_at)}</span>
                                </div>
                              </Link>
                              <button className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/20 transition-all" title="削除" onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeRecentPost(post.id); setRecentPosts(getRecentPosts()); }}>
                                <span className="material-symbols-rounded text-xs">close</span>
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between px-1">
                        <div className="text-xs text-subtle">アノニウム</div>
                        <div className="inline-flex items-center gap-1 rounded-md border border-subtle overflow-hidden">
                          <button className={`px-2 py-1 text-xs ${communityTab==='joined' ? 'bg-white/10' : 'hover:bg-white/10'}`} onClick={() => { setCommunityTab('joined'); fetchJoinedCommunities(); }}>参加中</button>
                          <button className={`px-2 py-1 text-xs ${communityTab==='recent' ? 'bg-white/10' : 'hover:bg-white/10'}`} onClick={() => setCommunityTab('recent')}>最近</button>
                        </div>
                      </div>
                      {communityTab === 'recent' ? (
                        <div className="space-y-1">
                          {recentCommunities.length === 0 ? (
                            <div className="text-xs text-subtle text-center py-6">履歴がありません</div>
                          ) : (
                            recentCommunities.map((c) => (
                              <div key={c.id} className="group relative">
                                <Link href={`/v/${c.id}`} className="flex items-center gap-2 p-2 rounded-md hover:bg-white/10 transition-colors border border-transparent hover:border-subtle" onClick={closeSheet}>
                                  {c.icon_url ? (
                                    <img src={c.icon_url} alt={c.name} className="w-6 h-6 rounded-full border border-subtle object-cover" />
                                  ) : (
                                    <span className="w-6 h-6 rounded-full border border-subtle surface-1 inline-flex items-center justify-center text-[10px]">#</span>
                                  )}
                                  <span className="text-xs truncate">{c.name}</span>
                                </Link>
                                <button className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/20 transition-all" title="削除" onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeRecentCommunity(c.id); setRecentCommunities(getRecentCommunities()); }}>
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
                        <div className="space-y-1">
                          {joinedCommunities.length === 0 ? (
                            <div className="text-xs text-subtle text-center py-6">参加中のアノニウムがありません</div>
                          ) : (
                            joinedCommunities.map((c) => (
                              <div key={c.id} className="group relative flex items-center gap-2 p-2 rounded-md hover:bg-white/10 transition-colors border border-transparent hover:border-subtle">
                                <Link href={`/v/${c.id}`} className="flex items-center gap-2 min-w-0 flex-1" onClick={closeSheet}>
                                  {c.icon_url ? (
                                    <img src={c.icon_url} alt={c.name} className="w-6 h-6 rounded-full border border-subtle object-cover" />
                                  ) : (
                                    <span className="w-6 h-6 rounded-full border border-subtle surface-1 inline-flex items-center justify-center text-[10px]">#</span>
                                  )}
                                  <span className="text-xs truncate">{c.name}</span>
                                </Link>
                                <button className="ml-auto text-xs px-1.5 py-0.5 rounded-md border border-subtle surface-1 hover:bg-white/5" onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavorite(c.id, !(c.is_favorite)); }} title={c.is_favorite ? 'お気に入り解除' : 'お気に入り'}>
                                  <span style={{ color: '#1e3a8a' }}>{c.is_favorite ? '★' : '☆'}</span>
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-subtle bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="max-w-7xl mx-auto px-3 py-1.5 flex items-center justify-between gap-1">
        {items.map(item => item.link ? (
          <Link
            key={item.key}
            href={item.link}
            className={`flex-1 flex flex-col items-center justify-center py-1 rounded-md ${current===item.key ? 'bg-white/10' : 'hover:bg-white/10'}`}
          >
            {item.key === 'communities' ? (
              <AtomIcon size={24} className="text-[24px] leading-none" />
            ) : (
              <span className="material-symbols-rounded text-[20px] leading-none" aria-hidden>{item.icon}</span>
            )}
            <span className="text-[11px] mt-0.5">{item.label}</span>
          </Link>
        ) : (
          <button
            key={item.key}
            className={`flex-1 flex flex-col items-center justify-center py-1 rounded-md ${current===item.key ? 'bg-white/10' : 'hover:bg-white/10'}`}
              onClick={() => {
                if (item.key === 'communities') {
                  openSheetFor('communities'); // アノニウムボタンを押したときはアノニウムタブから開く
                } else if (item.key === 'unreal') {
                  // UnRealボタンの処理（将来的に実装）
                  onChange(item.key);
                } else {
                  onChange(item.key);
                }
              }}
            aria-label={item.label}
            title={item.label}
          >
            {item.key === 'communities' ? (
              <AtomIcon size={24} className="text-[24px] leading-none" />
            ) : (
              <span className="material-symbols-rounded text-[20px] leading-none" aria-hidden>{item.icon}</span>
            )}
            <span className="text-[11px] mt-0.5">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
    </>
  );
}


