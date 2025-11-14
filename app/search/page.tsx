"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Header from "../components/Header";
import SidebarTabs from "../components/SidebarTabs";
import MobileNav from "../components/MobileNav";
import PostCard from "../components/PostCard";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

type Community = {
  id: number;
  name: string;
  slug: string;
  description?: string;
  icon_url?: string;
  banner_url?: string;
  members_count?: number;
  tags?: Array<{ name: string; color?: string }>;
  join_policy?: string;
  is_nsfw?: boolean;
  allow_repost?: boolean;
};

type TrendingPost = {
  id: number;
  title: string;
  body?: string;
  author: number;
  author_username?: string;
  author_icon_url?: string;
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
  votes_total?: number;
  user_vote?: number | null;
  comments_count?: number;
  can_moderate?: boolean;
  is_deleted?: boolean;
  is_edited?: boolean;
  tag?: { name: string; color?: string } | null;
  post_type?: string;
  poll?: {
    id: number;
    title: string;
    options: Array<{ id: number; text: string; vote_count: number }>;
    user_vote_id?: number | null;
    expires_at?: string | null;
  } | null;
  trending_score?: number | null;
};

export default function SearchCommunitiesPage() {
  const pathname = usePathname();
  const [signedIn, setSignedIn] = useState<boolean>(false);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [tab, setTab] = useState<string>("search");
  const [vw, setVw] = useState<number>(0);

  // パスに基づいてサイドバー/モバイルナビの選択状態を決定
  const sidebarTab = pathname === '/' ? 'home' : pathname === '/search' ? 'search' : 'home';

  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [trendingPosts, setTrendingPosts] = useState<TrendingPost[]>([]);
  const [trendingLoading, setTrendingLoading] = useState<boolean>(false);
  const [trendingError, setTrendingError] = useState<string>("");
  const [trendingDisplayCount, setTrendingDisplayCount] = useState<number>(() => {
    // スマホ表示時は6件、PC表示時は12件
    if (typeof window !== "undefined") {
      return window.innerWidth < 1024 ? 6 : 12;
    }
    return 6;
  });
  const [selectedFilters, setSelectedFilters] = useState<Set<string>>(new Set());
  const [displayCount, setDisplayCount] = useState<number>(() => {
    // スマホ表示時は3件、PC表示時は9件（3行分）
    if (typeof window !== "undefined") {
      return window.innerWidth < 1024 ? 3 : 9;
    }
    return 3;
  });
  const [recommendedDisplayCount, setRecommendedDisplayCount] = useState<number>(() => {
    // 初期値を画面サイズに応じて設定
    if (typeof window !== "undefined") {
      return window.innerWidth < 1024 ? 3 : 9;
    }
    return 3;
  });
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [communityTab, setCommunityTab] = useState<"recommended" | "popular">("recommended");
  const [guestScore, setGuestScore] = useState<number | null>(null);
  const [currentUsername, setCurrentUsername] = useState<string>("");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth < 1024;
    }
    return true;
  });

  useEffect(() => {
    // セキュリティ対策: JWTトークンはCookieから自動的に送信される
    // 認証状態を確認（ゲストスコアも同時に取得）
    async function checkAuth() {
      try {
        const res = await fetch(`${API}/api/accounts/me/`, {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          // ゲストユーザーかどうかを確認
          const isGuest = data.is_guest || (data.username && data.username.startsWith('Anonium-'));
          const authenticated = !isGuest && data.username && !data.username.startsWith('Anonium-');
          setSignedIn(authenticated);
          if (data && data.username) {
            try { localStorage.setItem('accessUsername', data.username); } catch {}
            setCurrentUsername(data.username);
          }
          // ゲストユーザーのスコアも同時に設定
          if (!authenticated) {
            setGuestScore(data.score ?? 0);
          } else {
            setGuestScore(null);
          }
        } else {
          setSignedIn(false);
          setGuestScore(null);
        }
      } catch {
        setSignedIn(false);
        setGuestScore(null);
      }
    }
    checkAuth();
    function handleResize() {
      const width = typeof window !== "undefined" ? window.innerWidth : 0;
      setVw(width);
      const mobile = width < 1024; // lg breakpoint
      const prevMobile = isMobile;
      setIsMobile(mobile);
      
      // 画面サイズ切り替え時に表示件数を調整
      if (prevMobile !== mobile) {
        if (mobile) {
          // PCからスマホに切り替わった場合
          setRecommendedDisplayCount((prev) => {
            if (prev <= 3) return prev;
            return Math.min(3, Math.floor(prev / 3) * 3);
          });
          setDisplayCount((prev) => {
            if (prev <= 3) return prev;
            return Math.min(3, Math.floor(prev / 3) * 3);
          });
          setTrendingDisplayCount((prev) => {
            if (prev <= 6) return prev;
            return Math.min(6, Math.floor(prev / 6) * 6);
          });
        } else {
          // スマホからPCに切り替わった場合
          setRecommendedDisplayCount((prev) => {
            if (prev >= 9) {
              return Math.floor(prev / 9) * 9;
            }
            return 9;
          });
          setDisplayCount((prev) => {
            if (prev >= 9) {
              return Math.floor(prev / 9) * 9;
            }
            return 9;
          });
          setTrendingDisplayCount((prev) => {
            if (prev >= 12) {
              return Math.floor(prev / 12) * 12;
            }
            return 12;
          });
        }
      } else if (!mobile && displayCount === 3) {
        // 初期読み込み時、PC表示の場合は9件に設定
        setDisplayCount(9);
      }
      if (!mobile && trendingDisplayCount === 6) {
        // 初期読み込み時、PC表示の場合は12件に設定
        setTrendingDisplayCount(12);
      }
    }
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isMobile]);

  useEffect(() => {
    const q = searchParams?.get("q") || "";
    setSearchTerm(q);
  }, [searchParams]);

  useEffect(() => {
    async function fetchCommunities() {
      setLoading(true);
      setError("");
      try {
        // セキュリティ対策: JWTトークンはCookieから自動的に送信される
        const res = await fetch(`${API}/api/communities/`, {
          credentials: "include",
        });
        if (!res.ok) {
          setError("アノニウムの取得に失敗しました。");
          setCommunities([]);
          return;
        }
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data?.results ?? []);
        setCommunities(list);
      } catch {
        setError("コミュニティの取得に失敗しました。");
        setCommunities([]);
      } finally {
        setLoading(false);
      }
    }
    fetchCommunities();
  }, []);

  useEffect(() => {
    async function fetchTrending() {
      setTrendingLoading(true);
      setTrendingError("");
      try {
        // セキュリティ対策: JWTトークンはCookieから自動的に送信される
        const res = await fetch(`${API}/api/posts/trending/?limit=50`, {
          credentials: "include",
        });
        if (!res.ok) {
          setTrendingError("勢いのある投稿の取得に失敗しました。");
          setTrendingPosts([]);
          return;
        }
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data?.results ?? []);
        setTrendingPosts(list as TrendingPost[]);
      } catch {
        setTrendingError("勢いのある投稿の取得に失敗しました。");
        setTrendingPosts([]);
      } finally {
        setTrendingLoading(false);
      }
    }
    fetchTrending();
  }, []);

  function handleSearchSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const term = searchTerm.trim();
    const query = term ? `?q=${encodeURIComponent(term)}` : "";
    router.push(`/search${query}`);
  }

  // 全てのユニークなタグを取得
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    communities.forEach((community) => {
      if (community.tags) {
        community.tags.forEach((tag) => {
          tagSet.add(tag.name);
        });
      }
    });
    return Array.from(tagSet).sort();
  }, [communities]);

  // フィルタリングされたコミュニティ
  const filteredCommunities = useMemo(() => {
    if (selectedFilters.size === 0) {
      return communities;
    }
    return communities.filter((community) => {
      // 固定フィルタのチェック
      if (selectedFilters.has("guest") && community.join_policy !== "open") {
        return false;
      }
      if (selectedFilters.has("login") && community.join_policy !== "login") {
        return false;
      }
      if (selectedFilters.has("nsfw") && !community.is_nsfw) {
        return false;
      }
      if (selectedFilters.has("repost") && !community.allow_repost) {
        return false;
      }
      // タグフィルタのチェック
      const tagFilters = Array.from(selectedFilters).filter(
        (f) => !["guest", "login", "nsfw", "repost"].includes(f)
      );
      if (tagFilters.length > 0) {
        const communityTags = (community.tags || []).map((t) => t.name);
        const hasMatchingTag = tagFilters.some((tag) => communityTags.includes(tag));
        if (!hasMatchingTag) {
          return false;
        }
      }
      return true;
    });
  }, [communities, selectedFilters]);

  const popularCommunities = useMemo(() => {
    return [...filteredCommunities]
      .sort((a, b) => (b.members_count || 0) - (a.members_count || 0));
  }, [filteredCommunities]);

  // おすすめのコミュニティ（テスト用に人気のコミュニティと同じ内容）
  const recommendedCommunities = useMemo(() => {
    return popularCommunities;
  }, [popularCommunities]);

  const handleFilterToggle = (filter: string) => {
    setSelectedFilters((prev) => {
      const next = new Set(prev);
      if (next.has(filter)) {
        next.delete(filter);
      } else {
        next.add(filter);
      }
      return next;
    });
  };

  // おすすめのコミュニティの表示用（スマホ: 3件ずつ、PC: 9件ずつ）
  const displayedRecommendedCommunities = useMemo(() => {
    return recommendedCommunities.slice(0, recommendedDisplayCount);
  }, [recommendedCommunities, recommendedDisplayCount]);

  // おすすめのコミュニティでさらに表示可能か（PC: 3行 = 9件ごと）
  const hasMoreRecommended = recommendedDisplayCount < recommendedCommunities.length;
  const shouldShowRecommendedButton = useMemo(() => {
    if (!hasMoreRecommended) return false;
    // PCでは9件、18件、27件...のタイミングで表示（初期値9件を表示後）
    // スマホでは3件、6件、9件...のタイミングで表示（初期値3件を表示後）
    if (isMobile) {
      return recommendedDisplayCount >= 3 && recommendedDisplayCount % 3 === 0;
    } else {
      return recommendedDisplayCount >= 9 && recommendedDisplayCount % 9 === 0;
    }
  }, [hasMoreRecommended, recommendedDisplayCount, isMobile]);

  const handleLoadMoreRecommended = () => {
    if (isMobile) {
      setRecommendedDisplayCount((prev) => prev + 3);
    } else {
      setRecommendedDisplayCount((prev) => prev + 9);
    }
  };

  const displayedCommunities = useMemo(() => {
    return popularCommunities.slice(0, displayCount);
  }, [popularCommunities, displayCount]);

  const hasMore = displayCount < popularCommunities.length;
  const shouldShowPopularButton = useMemo(() => {
    if (!hasMore) return false;
    // PCでは9件、18件、27件...のタイミングで表示（初期値9件を表示後）
    // スマホでは3件、6件、9件...のタイミングで表示（初期値3件を表示後）
    if (isMobile) {
      return displayCount >= 3 && displayCount % 3 === 0;
    } else {
      return displayCount >= 9 && displayCount % 9 === 0;
    }
  }, [hasMore, displayCount, isMobile]);

  const handleLoadMore = () => {
    if (isMobile) {
      setDisplayCount((prev) => prev + 3);
    } else {
      setDisplayCount((prev) => prev + 9);
    }
  };

  const remainingCommunities = useMemo(() => {
    const popularSlugs = new Set(popularCommunities.map((c) => c.slug));
    return filteredCommunities.filter((c) => !popularSlugs.has(c.slug));
  }, [filteredCommunities, popularCommunities]);

  function formatMembers(count?: number) {
    return (count ?? 0).toLocaleString("ja-JP");
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-16 md:pb-0">
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
          localStorage.removeItem("accessUsername");
          setSignedIn(false);
          router.push("/");
        }}
      />

      <main className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-6">
        <div className="flex items-start gap-4 md:gap-6">
          <SidebarTabs
            open={sidebarOpen}
            current={sidebarTab}
            onChange={(next) => setTab(next)}
            setOpen={setSidebarOpen}
          />

          <section className="flex-1 space-y-6" style={{ maxWidth: vw >= 1200 ? 860 : "100%" }}>
            {/* スマホ表示時の検索バー */}
            <div className="md:hidden">
              <form
                onSubmit={handleSearchSubmit}
                className="w-full"
                role="search"
              >
                <label htmlFor="mobile-search" className="sr-only">
                  アノニウムを検索
                </label>
                <div className="flex items-center w-full gap-2 rounded-full border border-subtle surface-1 px-3 py-2 shadow-inner">
                  <span className="material-symbols-rounded text-subtle text-base" aria-hidden>
                    search
                  </span>
                  <input
                    id="mobile-search"
                    type="search"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="検索(準備中)"
                    className="flex-1 bg-transparent text-sm text-foreground placeholder:text-subtle/70 focus:outline-none"
                    autoComplete="off"
                  />
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                    aria-label="検索(準備中)"
                  >
                    <span className="material-symbols-rounded text-[18px]" aria-hidden>
                      search
                    </span>
                  </button>
                </div>
              </form>
            </div>

            <div className="rounded-lg border border-subtle surface-1 p-4 sm:p-6">
              <div className="bg-gradient-to-r from-gray-800/95 via-gray-700/95 to-gray-800/95 text-white p-8 sm:p-12 md:p-16">
                <div className="text-sm sm:text-base uppercase tracking-wide opacity-80 mb-4">イベントスペース (仮)</div>
                <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">広告スペース</h2>
                <p className="mt-4 text-base sm:text-lg text-white/90 leading-relaxed max-w-3xl">
                  いつかこのアプリが人気になった日には、ここでタイアップイベントや、リアルタイムイベントをやりたいと思っている。。
                </p>
                <div className="mt-6 inline-flex items-center gap-2 text-base sm:text-lg font-medium text-white">
                  <span className="material-symbols-rounded text-xl sm:text-2xl" aria-hidden>
                    calendar_month
                  </span>
                  仮です。
                </div>
              </div>
            </div>

            <div
              className="overflow-x-auto -mx-2 sm:-mx-3"
              style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.25) transparent" }}
            >
              <div className="flex items-center gap-2 px-2 sm:px-3 py-2">
                <button
                  onClick={() => handleFilterToggle("guest")}
                  className={`flex-shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                    selectedFilters.has("guest")
                      ? "border-blue-500 bg-blue-500/20 text-blue-300"
                      : "border-gray-600/40 bg-transparent text-subtle hover:border-gray-500 hover:bg-gray-700/40"
                  }`}
                >
                  ゲスト参加可
                </button>
                <button
                  onClick={() => handleFilterToggle("login")}
                  className={`flex-shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                    selectedFilters.has("login")
                      ? "border-blue-500 bg-blue-500/20 text-blue-300"
                      : "border-gray-600/40 bg-transparent text-subtle hover:border-gray-500 hover:bg-gray-700/40"
                  }`}
                >
                  ログインのみ
                </button>
                <button
                  onClick={() => handleFilterToggle("nsfw")}
                  className={`flex-shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                    selectedFilters.has("nsfw")
                      ? "border-blue-500 bg-blue-500/20 text-blue-300"
                      : "border-gray-600/40 bg-transparent text-subtle hover:border-gray-500 hover:bg-gray-700/40"
                  }`}
                >
                  年齢制限
                </button>
                <button
                  onClick={() => handleFilterToggle("repost")}
                  className={`flex-shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                    selectedFilters.has("repost")
                      ? "border-blue-500 bg-blue-500/20 text-blue-300"
                      : "border-gray-600/40 bg-transparent text-subtle hover:border-gray-500 hover:bg-gray-700/40"
                  }`}
                >
                  転載可
                </button>
                {allTags.map((tagName) => {
                  const tagColor = communities
                    .flatMap((c) => c.tags || [])
                    .find((t) => t.name === tagName)?.color || "#1e3a8a";
                  const isSelected = selectedFilters.has(tagName);
                  return (
                    <button
                      key={tagName}
                      onClick={() => handleFilterToggle(tagName)}
                      className={`flex-shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                        isSelected
                          ? "border-blue-500 bg-blue-500/20 text-blue-300"
                          : "border-gray-600/40 bg-transparent text-subtle hover:border-gray-500 hover:bg-gray-700/40"
                      }`}
                      style={
                        isSelected
                          ? undefined
                          : {
                              borderColor: `${tagColor}80`,
                              backgroundColor: `${tagColor}22`,
                            }
                      }
                    >
                      #{tagName}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* コミュニティタブ */}
            <div>
              <div className="flex gap-2 mb-4 border-b border-subtle">
                <button
                  onClick={() => setCommunityTab("recommended")}
                  className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                    communityTab === "recommended"
                      ? "border-blue-500 text-blue-300"
                      : "border-transparent text-subtle hover:text-foreground"
                  }`}
                >
                  おすすめ
                </button>
                <button
                  onClick={() => setCommunityTab("popular")}
                  className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                    communityTab === "popular"
                      ? "border-blue-500 text-blue-300"
                      : "border-transparent text-subtle hover:text-foreground"
                  }`}
                >
                  人気
                </button>
              </div>
            </div>

            {/* おすすめのコミュニティ */}
            <div className={`rounded-lg border border-subtle surface-1 p-4 sm:p-6 ${communityTab !== "recommended" ? "hidden" : ""}`}>
              {loading ? (
                <div className="text-sm text-subtle">読み込み中...</div>
              ) : recommendedCommunities.length === 0 ? (
                <div className="text-sm text-subtle">表示できるアノニウムがありません。</div>
              ) : (
                <>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {displayedRecommendedCommunities.map((community) => (
                      <Link
                        key={community.id}
                        href={`/v/${community.id}`}
                        className="rounded-2xl border-2 border-gray-700/80 surface-2 hover:border-gray-600 transition-colors p-4"
                      >
                        <div className="space-y-3">
                          <div className="flex items-center gap-3">
                            {community.icon_url ? (
                              <img src={community.icon_url} alt={community.name} className="w-12 h-12 rounded-full border border-subtle object-cover flex-shrink-0" />
                            ) : (
                              <span className="w-12 h-12 rounded-full border border-subtle surface-1 inline-flex items-center justify-center text-base font-semibold flex-shrink-0">
                                #
                              </span>
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="text-base font-semibold truncate">{community.name}</div>
                              <div className="text-xs text-subtle truncate">メンバー {formatMembers(community.members_count)}</div>
                            </div>
                          </div>
                          {community.description && (
                            <p className="text-sm text-subtle line-clamp-2 leading-relaxed">
                              {community.description}
                            </p>
                          )}
                          {community.tags && community.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {community.tags.slice(0, 3).map((tag) => (
                                <span
                                  key={tag.name}
                                  className="inline-flex items-center rounded-full border border-subtle/70 px-2 py-0.5 text-xs text-subtle"
                                >
                                  #{tag.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                  {shouldShowRecommendedButton && (
                    <div className="flex justify-center mt-4">
                      <button
                        onClick={handleLoadMoreRecommended}
                        className="rounded-md border border-gray-600/50 bg-gray-700/30 hover:bg-gray-700/50 text-gray-300 hover:text-gray-200 px-4 py-2 text-sm font-normal transition-colors"
                      >
                        さらに表示
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* 人気のコミュニティ */}
            <div className={`rounded-lg border border-subtle surface-1 p-4 sm:p-6 ${communityTab !== "popular" ? "hidden" : ""}`}>
              {loading ? (
                <div className="text-sm text-subtle">読み込み中...</div>
              ) : popularCommunities.length === 0 ? (
                <div className="text-sm text-subtle">表示できるアノニウムがありません。</div>
              ) : (
                <>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {displayedCommunities.map((community) => (
                      <Link
                        key={community.id}
                        href={`/v/${community.id}`}
                        className="rounded-2xl border-2 border-gray-700/80 surface-2 hover:border-gray-600 transition-colors p-4"
                      >
                        <div className="space-y-3">
                          <div className="flex items-center gap-3">
                            {community.icon_url ? (
                              <img src={community.icon_url} alt={community.name} className="w-12 h-12 rounded-full border border-subtle object-cover flex-shrink-0" />
                            ) : (
                              <span className="w-12 h-12 rounded-full border border-subtle surface-1 inline-flex items-center justify-center text-base font-semibold flex-shrink-0">
                                #
                              </span>
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="text-base font-semibold truncate">{community.name}</div>
                              <div className="text-xs text-subtle truncate">メンバー {formatMembers(community.members_count)}</div>
                            </div>
                          </div>
                          {community.description && (
                            <p className="text-sm text-subtle line-clamp-2 leading-relaxed">
                              {community.description}
                            </p>
                          )}
                          {community.tags && community.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {community.tags.slice(0, 3).map((tag) => (
                                <span
                                  key={tag.name}
                                  className="inline-flex items-center rounded-full border border-subtle/70 px-2 py-0.5 text-xs text-subtle"
                                >
                                  #{tag.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                  {shouldShowPopularButton && (
                    <div className="flex justify-center mt-4">
                      <button
                        onClick={handleLoadMore}
                        className="rounded-md border border-gray-600/50 bg-gray-700/30 hover:bg-gray-700/50 text-gray-300 hover:text-gray-200 px-4 py-2 text-sm font-normal transition-colors"
                      >
                        さらに表示
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">勢いのあるスレッド</h2>
                  <p className="text-xs text-subtle">半減期6時間・直近7日間の投稿をソートしています</p>
                </div>
                <div className="text-xs text-subtle">
                  {trendingPosts.length > 0 ? `${Math.min(trendingDisplayCount, trendingPosts.length)} / ${trendingPosts.length} 件表示中` : ""}
                </div>
              </div>
              {trendingLoading ? (
                <div className="text-sm text-subtle">読み込み中...</div>
              ) : trendingError ? (
                <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                  {trendingError}
                </div>
              ) : trendingPosts.length === 0 ? (
                <div className="text-sm text-subtle">表示できる投稿がありません。</div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {trendingPosts.slice(0, trendingDisplayCount).map((post) => (
                      <div key={post.id} className="flex flex-col gap-2">
                        <div className="flex items-center justify-between text-[11px] text-subtle px-1">
                          <span className="inline-flex items-center gap-1">
                            <span className="material-symbols-rounded text-[14px]" aria-hidden>
                              trending_up
                            </span>
                            勢いスコア
                          </span>
                          <span className="tabular-nums">
                            {typeof post.trending_score === "number" ? post.trending_score.toFixed(3) : "-"}
                          </span>
                        </div>
                        <PostCard
                          post={post}
                          onVoted={() => {}}
                          isAuthenticated={signedIn}
                          community={post.community_slug ? {
                            slug: post.community_slug,
                            is_member: post.community_is_member,
                            membership_role: post.community_membership_role ?? null,
                            clip_post_id: null,
                            join_policy: post.community_join_policy,
                            karma: post.community_karma ?? undefined,
                          } : null}
                          currentUsername={currentUsername}
                          guestScore={guestScore}
                        />
                      </div>
                    ))}
                  </div>
                  {trendingDisplayCount < trendingPosts.length && (
                    <div className="flex justify-center mt-4">
                      <button
                        onClick={() => {
                          if (isMobile) {
                            setTrendingDisplayCount((prev) => prev + 6);
                          } else {
                            setTrendingDisplayCount((prev) => prev + 12);
                          }
                        }}
                        className="rounded-md border border-gray-600/50 bg-gray-700/30 hover:bg-gray-700/50 text-gray-300 hover:text-gray-200 px-4 py-2 text-sm font-normal transition-colors"
                      >
                        さらに表示
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            {remainingCommunities.length > 0 && (
              <div className="rounded-lg border border-subtle surface-1 p-4 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <h2 className="text-lg font-semibold">その他のアノニウム</h2>
                  <div className="text-xs text-subtle">{remainingCommunities.length.toLocaleString("ja-JP")} 件表示中</div>
                </div>

                {error && (
                  <div className="mb-4 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                    {error}
                  </div>
                )}

                <div className="grid gap-3">
                  {remainingCommunities.map((community) => (
                    <Link
                      key={community.slug}
                      href={`/v/${community.slug}`}
                      className="rounded-lg border border-subtle/60 surface-2 hover:border-blue-500/60 transition-colors p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                    >
                      <div className="flex items-start gap-3 sm:gap-4 min-w-0">
                        {community.icon_url ? (
                          <img src={community.icon_url} alt={community.name} className="w-12 h-12 rounded-full border border-subtle object-cover" />
                        ) : (
                          <span className="w-12 h-12 rounded-full border border-subtle surface-1 inline-flex items-center justify-center text-base font-semibold">
                            #
                          </span>
                        )}
                        <div className="space-y-1 min-w-0">
                          <div className="text-base font-semibold truncate">{community.name}</div>
                          <div className="text-xs text-subtle">メンバー {formatMembers(community.members_count)}</div>
                          {community.description && (
                            <p className="text-sm text-subtle line-clamp-2 leading-relaxed">
                              {community.description}
                            </p>
                          )}
                          {community.tags && community.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-1">
                              {community.tags.slice(0, 4).map((tag) => (
                                <span
                                  key={tag.name}
                                  className="inline-flex items-center rounded-full border border-subtle/70 px-2 py-0.5 text-[11px] text-subtle"
                                >
                                  #{tag.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="self-start sm:self-center text-xs text-subtle hidden sm:block">
                        最近の更新をチェック
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      </main>

      <MobileNav current={sidebarTab} onChange={(next) => setTab(next)} />
    </div>
  );
}


