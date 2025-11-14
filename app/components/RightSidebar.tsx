"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import RulesCard from "@/app/components/RulesCard";
import PostCard from "@/app/components/PostCard";
import { useRouter } from "next/navigation";
import { getRecentPosts, RecentPost } from "@/app/utils/recentPosts";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

type Community = {
  id: number;
  name: string;
  slug: string;
  members_count?: number;
  icon_url?: string;
  is_member?: boolean;
};

type CommunityDetail = Community & {
  description?: string;
  rules?: string;
  icon_url?: string;
  banner_url?: string;
  visibility?: string;
  join_policy?: string;
  is_nsfw?: boolean;
  allow_repost?: boolean;
  karma?: number;
  is_member?: boolean;
  membership_status?: string | null;
  membership_role?: string | null;
  is_admin?: boolean;
  is_blocked?: boolean;
  is_favorite?: boolean;
  tags?: Array<{ name: string; color?: string }>;
  tag_permission_scope?: 'all'|'moderator'|'owner';
};

type Member = {
  id: number;
  username: string; // 表示名（後方互換性のため）
  username_id?: string; // 実際のユーザー名（ID）
  display_name?: string; // 表示名
  icon_url?: string;
  score?: number;
  role?: string | null;
};

type Post = {
  id: number;
  title: string;
  body?: string;
  author: number;
  author_username?: string;
  author_username_id?: string;
  author_icon_url?: string;
  created_at: string;
  community_id?: number;
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
  poll?: {
    id: number;
    title: string;
    options: Array<{ id: number; text: string; vote_count: number }>;
    user_vote_id?: number | null;
    expires_at?: string | null;
  } | null;
  media?: Array<{
    id: number;
    media_type: 'image' | 'video';
    url: string;
    thumbnail_url?: string;
    width?: number | null;
    height?: number | null;
    duration?: number | null;
    file_size?: number | null;
    order: number;
  }> | null;
  is_following?: boolean;
};

type Props = {
  accessToken?: string;
  community?: CommunityDetail | null;
  onCreated?: () => void;
};

export default function RightSidebar({ accessToken = "", community }: Props) {
  const router = useRouter();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [communityDetail, setCommunityDetail] = useState<CommunityDetail | null>(community || null);
  const [posts, setPosts] = useState<Post[]>([]);
  // セキュリティ対策: accessTokenプロップは後方互換性のため残すが、クッキーベースの認証を使用
  // accessTokenが空文字列の場合は、クッキーから認証状態を確認
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!!accessToken);
  const [authChecked, setAuthChecked] = useState<boolean>(!!accessToken);
  
  // 認証状態を確認（accessTokenが空文字列の場合のみ、一度だけ）
  useEffect(() => {
    if (accessToken === "" && !authChecked) {
      // セキュリティ対策: JWTトークンはCookieから自動的に送信される
      fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000"}/api/accounts/me/`, {
        credentials: 'include',
      }).then(res => {
        setAuthChecked(true);
        if (res.ok) {
          return res.json().then(data => {
            // ゲストユーザーかどうかを確認
            const isGuest = data.is_guest || (data.username && data.username.startsWith('Anonium-'));
            setIsAuthenticated(!isGuest && data.username && !data.username.startsWith('Anonium-'));
            // 認証済みユーザーの場合、usernameを設定
            if (!isGuest && data.username && !data.username.startsWith('Anonium-')) {
              setCurrentUsername(data.username);
            }
          });
        } else {
          setIsAuthenticated(false);
          setCurrentUsername("");
        }
      }).catch(() => {
        setAuthChecked(true);
        setIsAuthenticated(false);
        setCurrentUsername("");
      });
    } else if (accessToken) {
      // accessTokenが提供されている場合（後方互換性）
      setAuthChecked(true);
      setIsAuthenticated(true);
    }
  }, [accessToken, authChecked]);
  const [members, setMembers] = useState<Member[]>([]);
  const [isCommunityPage, setIsCommunityPage] = useState<boolean>(false);
  const [moderatorMenuOpen, setModeratorMenuOpen] = useState<number | null>(null);
  const [moderatorMenuMount, setModeratorMenuMount] = useState<boolean>(false);
  const [moderatorMenuVisible, setModeratorMenuVisible] = useState<boolean>(false);
  const [currentUsername, setCurrentUsername] = useState<string>("");
  const [memberListMenuOpen, setMemberListMenuOpen] = useState<number | null>(null);
  const [memberListMenuMount, setMemberListMenuMount] = useState<boolean>(false);
  const [memberListMenuVisible, setMemberListMenuVisible] = useState<boolean>(false);
  const [memberListMenuUp, setMemberListMenuUp] = useState<boolean>(false);
  const [guestScore, setGuestScore] = useState<number | null>(null);
  const [anoniumInfoHover, setAnoniumInfoHover] = useState<boolean>(false);
  const [recentPosts, setRecentPosts] = useState<RecentPost[]>([]);
  const [recentPostData, setRecentPostData] = useState<Post[]>([]);
  const [recentPostsDisplayCount, setRecentPostsDisplayCount] = useState<number>(5);
  const [loadingRecentPosts, setLoadingRecentPosts] = useState<boolean>(false);

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

  async function fetchCommunityUserStatus(id: number) {
    const headers: Record<string, string> = {};
    // セキュリティ対策: JWTトークンはCookieから自動的に送信される
    
    try {
      const res = await fetch(`${API}/api/communities/${id}/status/`, { headers, credentials: 'include' });
      if (res.ok) {
        const status = await res.json();
        setCommunityUserStatus(status);
        // コミュニティ詳細にユーザー状態をマージ
        setCommunityDetail(prev => prev ? { ...prev, ...status } : null);
      } else {
        // エラーの場合はデフォルト値を設定
        const defaultStatus = {
          is_member: false,
          membership_status: null,
          membership_role: null,
          is_admin: false,
          is_blocked: false,
          is_favorite: false,
        };
        setCommunityUserStatus(defaultStatus);
        setCommunityDetail(prev => prev ? { ...prev, ...defaultStatus } : null);
      }
    } catch (error) {
      // エラーの場合はデフォルト値を設定
      const defaultStatus = {
        is_member: false,
        membership_status: null,
        membership_role: null,
        is_admin: false,
        is_blocked: false,
        is_favorite: false,
      };
      setCommunityUserStatus(defaultStatus);
      setCommunityDetail(prev => prev ? { ...prev, ...defaultStatus } : null);
    }
  }

  useEffect(() => {
    // currentUsernameは認証状態確認時に設定されるため、ここでは設定しない
    if (community) {
      // props から受け取ったコミュニティデータにユーザー状態が含まれている場合
      if (community.is_member !== undefined || community.membership_status !== undefined) {
        setCommunityDetail(community);
        setCommunityUserStatus({
          is_member: community.is_member,
          membership_status: community.membership_status,
          membership_role: community.membership_role,
          is_admin: community.is_admin,
          is_blocked: community.is_blocked,
          is_favorite: community.is_favorite,
        });
      } else {
        setCommunityDetail(community);
      }
    } else {
      setCommunityDetail(null);
      setCommunityUserStatus(null);
    }
    try { setIsCommunityPage(typeof window !== 'undefined' && window.location.pathname.startsWith('/v/')); } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [community, isAuthenticated]);

  useEffect(() => {
    // ゲストユーザーのスコアを取得（ログインしていない場合、参加ポリシーがopenの場合）
    if (!isAuthenticated && communityDetail?.join_policy === 'open') {
      fetchGuestScore();
    } else {
      setGuestScore(null);
    }
  }, [isAuthenticated, communityDetail?.join_policy]);

  // 最近見た投稿を読み込む（ホームページの場合のみ）
  useEffect(() => {
    if (!communityDetail) {
      const allRecent = getRecentPosts();
      setRecentPosts(allRecent);
      // 初期表示分の投稿データを取得
      const initialRecent = allRecent.slice(0, 5);
      setRecentPostsDisplayCount(5);
      fetchRecentPostData(initialRecent, false);
    } else {
      setRecentPosts([]);
      setRecentPostData([]);
      setRecentPostsDisplayCount(5);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [communityDetail]);

  // 最近見たスレッドの詳細データを取得
  async function fetchRecentPostData(recent: RecentPost[], append: boolean = false) {
    if (recent.length === 0) {
      if (!append) {
        setRecentPostData([]);
      }
      return;
    }
    setLoadingRecentPosts(true);
    try {
      // 各投稿の詳細を並列で取得
      const promises = recent.map(post => 
        fetch(`${API}/api/posts/${post.id}/`, { credentials: 'include' })
          .then(res => res.ok ? res.json() : null)
          .catch(() => null)
      );
      const results = await Promise.all(promises);
      // nullを除外して有効な投稿のみを設定
      const validPosts = results.filter((post): post is Post => post !== null);
      if (append) {
        setRecentPostData(prev => [...prev, ...validPosts]);
      } else {
        setRecentPostData(validPosts);
      }
    } catch {
      if (!append) {
        setRecentPostData([]);
      }
    } finally {
      setLoadingRecentPosts(false);
    }
  }

  // さらに表示ボタンのハンドラ
  function handleLoadMoreRecentPosts() {
    const nextCount = recentPostsDisplayCount + 5;
    setRecentPostsDisplayCount(nextCount);
    // 新しく表示する分だけを取得（既に表示されている分を除く）
    const newRecent = recentPosts.slice(recentPostData.length, nextCount);
    fetchRecentPostData(newRecent, true);
  }

  useEffect(() => {
    async function fetchCommunities() {
      try {
        const headers: Record<string, string> = {};
        // セキュリティ対策: JWTトークンはCookieから自動的に送信される
        const res = await fetch(`${API}/api/communities/`, { headers, credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        // ページネーション対応: レスポンスが {count, next, previous, results} の形式の場合と配列の場合の両方に対応
        const communities = Array.isArray(data) ? data : (data.results || []);
        setCommunities(communities);
      } catch {
        // noop
      }
    }
    // 認証状態の確認が完了したら実行（ゲストユーザーでも表示可能）
    if (authChecked) {
      fetchCommunities();
    }
  }, [authChecked]);

  useEffect(() => {
    async function fetchCommunityPosts() {
      if (!communityDetail) return;
      try {
        const headers: Record<string, string> = {};
        // セキュリティ対策: JWTトークンはCookieから自動的に送信される
        const res = await fetch(`${API}/api/communities/${communityDetail.id}/posts/`, { headers, credentials: 'include' });
        if (!res.ok) { setPosts([]); return; }
        const data = await res.json();
        // ページネーション対応: レスポンスが {count, next, previous, results} の形式の場合と配列の場合の両方に対応
        const items = Array.isArray(data) ? data : (data.results || []);
        // PostCardで使用するために完全なPostオブジェクトを保持
        setPosts(items);
      } catch {
        setPosts([]);
      }
    }
    fetchCommunityPosts();
  }, [communityDetail?.id, isAuthenticated]);

  async function fetchMembers() {
    if (!communityDetail?.id) return;
    if (!isCommunityPage) return; // コミュニティページでない場合は取得しない
    try {
      const headers: Record<string, string> = {};
      // セキュリティ対策: JWTトークンはCookieから自動的に送信される
      const res = await fetch(`${API}/api/communities/${communityDetail.id}/members/?limit=100`, { headers, credentials: 'include' });
      if (!res.ok) { setMembers([]); return; }
      const data = await res.json();
      // ページネーション対応: レスポンスが {count, next, previous, results} の形式の場合と配列の場合の両方に対応
      const members = Array.isArray(data) ? data : (data.results || []);
      // ソート: オーナー、ログイン、ゲストの順
      const sortedMembers = [...members].sort((a, b) => {
        // オーナーを最優先
        if (a.role === 'owner' && b.role !== 'owner') return -1;
        if (a.role !== 'owner' && b.role === 'owner') return 1;
        
        // ログインユーザーかどうかを判定
        const aIsLoggedIn = (a.username_id && !a.username_id.startsWith('Anonium-')) || 
                            (a.username && !a.username.startsWith('Anonium-') && !a.username_id);
        const bIsLoggedIn = (b.username_id && !b.username_id.startsWith('Anonium-')) || 
                            (b.username && !b.username.startsWith('Anonium-') && !b.username_id);
        
        // ログインユーザーを次に優先
        if (aIsLoggedIn && !bIsLoggedIn) return -1;
        if (!aIsLoggedIn && bIsLoggedIn) return 1;
        
        // 同じカテゴリ内では名前順
        return (a.display_name || a.username || '').localeCompare(b.display_name || b.username || '');
      });
      setMembers(sortedMembers);
    } catch {
      setMembers([]);
    }
  }

  useEffect(() => {
    if (isCommunityPage && communityDetail?.id) {
      fetchMembers();
    } else {
      setMembers([]); // コミュニティページでない場合はメンバーリストをクリア
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [communityDetail?.id, isAuthenticated, isCommunityPage]);

  // オーナー/管理モデ/モデレーターのみをフィルタリング（Redditスタイル）
  const moderators = useMemo(() => {
    return members
      .filter(m => m.role === 'owner' || m.role === 'admin_moderator' || m.role === 'moderator')
      .sort((a, b) => {
        // オーナー → 管理モデ → モデレーター
        const rank = (r?: string | null) => (r === 'owner' ? 0 : r === 'admin_moderator' ? 1 : r === 'moderator' ? 2 : 3);
        const ra = rank(a.role);
        const rb = rank(b.role);
        if (ra !== rb) return ra - rb;
        // 同じロールの場合はスコア順（降順）
        const scoreA = a.score ?? 0;
        const scoreB = b.score ?? 0;
        return scoreB - scoreA;
      });
  }, [members]);

  // オーナー/管理モデ/モデレーター（スコア表示許可）
  const isAdmin = communityDetail?.membership_role === 'owner' || communityDetail?.membership_role === 'admin_moderator' || communityDetail?.membership_role === 'moderator';

  useEffect(() => {
    if (!moderatorMenuMount) return;
    function onDocClick() {
      setModeratorMenuVisible(false);
      setTimeout(() => { setModeratorMenuMount(false); setModeratorMenuOpen(null); }, 150);
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [moderatorMenuMount]);

  async function demoteModerator(userId: number) {
    // セキュリティ対策: JWTトークンはCookieから自動的に送信される
    // 認証状態はAPIレスポンスで確認（401または403が返される場合）
    if (!communityDetail) return;
    try {
      const res = await fetch(`${API}/api/communities/${communityDetail.id}/members/${userId}/demote/`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        // メンバーリストを再取得して更新
        await fetchMembers();
        // コミュニティページの場合はページを再読み込み
        if (typeof window !== 'undefined' && window.location.pathname.startsWith('/v/')) {
          router.refresh();
        }
      }
    } catch {
      // noop
    }
  }

  async function demoteAdminModerator(userId: number) {
    // セキュリティ対策: JWTトークンはCookieから自動的に送信される
    // 認証状態はAPIレスポンスで確認（401または403が返される場合）
    if (!communityDetail) return;
    try {
      const res = await fetch(`${API}/api/communities/${communityDetail.id}/members/${userId}/demote_admin/`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        // 連鎖で標準モデレーターも解除されうるので、再取得
        await fetchMembers();
        if (typeof window !== 'undefined' && window.location.pathname.startsWith('/v/')) {
          router.refresh();
        }
      }
    } catch {
      // noop
    }
  }

  async function promoteAdminModerator(userId: number) {
    // セキュリティ対策: JWTトークンはCookieから自動的に送信される
    // 認証状態はAPIレスポンスで確認（401または403が返される場合）
    if (!communityDetail) return;
    // オーナーのみ
    if (communityDetail.membership_role !== 'owner') return;
    try {
      const res = await fetch(`${API}/api/communities/${communityDetail.id}/members/${userId}/promote_admin/`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        await fetchMembers();
        if (typeof window !== 'undefined' && window.location.pathname.startsWith('/v/')) {
          router.refresh();
        }
      }
    } catch {
      // noop
    }
  }

  const [communityUserStatus, setCommunityUserStatus] = useState<{
    is_member?: boolean;
    membership_status?: string | null;
    membership_role?: string | null;
    is_admin?: boolean;
    is_blocked?: boolean;
    is_favorite?: boolean;
  } | null>(null);

  async function refreshCommunityDetail() {
    if (!communityDetail) return;
    try {
      const headers: Record<string, string> = {};
      // セキュリティ対策: JWTトークンはCookieから自動的に送信される
      const res = await fetch(`${API}/api/communities/${communityDetail.id}/`, { headers, credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      setCommunityDetail(data);
      // ユーザー状態を別途取得
      if (data.id) {
        await fetchCommunityUserStatus(data.id);
      }
    } catch {
      // noop
    }
  }

  async function joinCommunity() {
    // セキュリティ対策: JWTトークンはCookieから自動的に送信される
    // 認証状態はAPIレスポンスで確認（401が返される場合）
    if (!communityDetail) return;
    try {
      const res = await fetch(`${API}/api/communities/${communityDetail.id}/join/`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok || res.status === 202) {
        await refreshCommunityDetail();
      }
    } catch {
      // noop
    }
  }

  async function leaveCommunity() {
    // セキュリティ対策: JWTトークンはCookieから自動的に送信される
    // 認証状態はAPIレスポンスで確認（401が返される場合）
    if (!communityDetail) return;
    try {
      const res = await fetch(`${API}/api/communities/${communityDetail.id}/leave/`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        await refreshCommunityDetail();
      }
    } catch {
      // noop
    }
  }

  return (
    <div className="space-y-4">
      {communityDetail ? (
        <div className="rounded-lg border border-subtle surface-1 overflow-hidden">
          {communityDetail.banner_url ? (
            <div className="relative w-full" style={{ aspectRatio: "7 / 2", minHeight: 96 }}>
              <img src={communityDetail.banner_url} alt="banner" className="w-full h-full object-cover" />
              <Link
                href={`/post?id=${communityDetail.id}`}
                className="absolute top-2 right-2 inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-accent text-white hover:opacity-90"
                title="投稿"
                aria-label="投稿"
              >
                <span className="material-symbols-rounded text-base" aria-hidden>post_add</span>
                <span className="hidden sm:inline">投稿</span>
              </Link>
            </div>
          ) : null}
          <div className="p-4">
            <div className="flex items-start gap-3 mb-3">
              <div className="flex-shrink-0">
                <Link href={`/v/${communityDetail.id}`} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center overflow-hidden border border-subtle">
                  {communityDetail.icon_url ? (
                    <img src={communityDetail.icon_url} alt={communityDetail.name} className="w-10 h-10 object-cover rounded-full" />
                  ) : (
                    <span className="text-lg">#</span>
                  )}
                </Link>
              </div>
              <div>
                <Link href={`/v/${communityDetail.id}`} className="font-medium hover:underline">
                  {communityDetail.name}
                </Link>
                <div className="text-xs text-subtle">{communityDetail.members_count ?? 0} メンバー</div>
              </div>
            </div>
            {communityDetail.description && (
              <p className="text-sm text-subtle line-clamp-3 mb-3">{communityDetail.description}</p>
            )}
            {/* ステータス情報 */}
            <div className="text-xs space-y-1.5 border-t border-subtle pt-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-rounded text-xs text-subtle" style={{ fontSize: 16 }} aria-hidden>public</span>
                <span>
                  <span className="text-subtle">表示: </span>
                  {communityDetail.visibility === 'public' ? '公開' : communityDetail.visibility === 'restricted' ? '制限付き' : '非公開'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-rounded text-xs text-subtle" style={{ fontSize: 16 }} aria-hidden>
                  {communityDetail.join_policy === 'open' ? 'group_add' : communityDetail.join_policy === 'approval' ? 'approval' : 'login'}
                </span>
                <span>
                  <span className="text-subtle">参加: </span>
                  {communityDetail.join_policy === 'open' ? '誰でも参加可' : communityDetail.join_policy === 'approval' ? '承認制' : communityDetail.join_policy === 'invite' ? '招待制' : 'ログイン必須'}
                </span>
              </div>
              {communityDetail.is_nsfw && (
                <div className="flex items-center gap-2">
                  <span className="material-symbols-rounded text-xs text-subtle" style={{ fontSize: 16 }} aria-hidden>warning</span>
                  <span className="text-subtle">年齢制限あり</span>
                </div>
              )}
              {communityDetail.allow_repost && (
                <div className="flex items-center gap-2">
                  <span className="material-symbols-rounded text-xs text-subtle" style={{ fontSize: 16 }} aria-hidden>share</span>
                  <span className="text-subtle">転載許可</span>
                </div>
              )}
              {communityDetail.join_policy === 'open' && (
                <>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-rounded text-xs text-subtle" style={{ fontSize: 16 }} aria-hidden>how_to_vote</span>
                    <span>
                      <span className="text-subtle">ゲスト投票: </span>
                      {(() => {
                        const requiredKarma = communityDetail.karma || 0;
                        // ログイン済みユーザーは常に許可
                        if (isAuthenticated) {
                          return (
                            <>
                              <span className="text-green-400">許可</span>
                              {requiredKarma > 0 && (
                                <span className="text-xs text-subtle ml-1">（スコア{requiredKarma}以上）</span>
                              )}
                            </>
                          );
                        }
                        // ゲストユーザーの場合
                        if (requiredKarma === 0) {
                          return <span className="text-green-400">許可</span>;
                        }
                        const userScore = guestScore ?? 0;
                        if (userScore >= requiredKarma) {
                          return (
                            <>
                              <span className="text-green-400">許可</span>
                              <span className="text-xs text-subtle ml-1">（スコア{requiredKarma}以上）</span>
                            </>
                          );
                        }
                        return (
                          <>
                            <span className="text-yellow-400">不許可</span>
                            <span className="text-xs text-subtle ml-1">（スコア{requiredKarma}以上）</span>
                          </>
                        );
                      })()}
                    </span>
                  </div>
                  {communityDetail.join_policy === 'open' && communityDetail.karma !== 0 && (() => {
                    const requiredKarma = communityDetail.karma || 0;
                    if (isAuthenticated) {
                      return null; // ログイン済みユーザーには注釈不要
                    }
                    const userScore = guestScore ?? 0;
                    if (userScore < requiredKarma) {
                      return (
                        <div className="flex items-start gap-2">
                          <span className="material-symbols-rounded text-xs text-subtle mt-0.5" style={{ fontSize: 16 }} aria-hidden>info</span>
                          <span className="text-xs text-subtle">
                            より多くのいいねを集めると投票が解放されます。
                          </span>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </>
              )}
              {(() => {
                // ユーザー状態が読み込まれていない場合はスピナーを表示
                if (communityUserStatus === null && isAuthenticated) {
                  return (
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-rounded text-xs text-subtle animate-spin" style={{ fontSize: 16 }} aria-hidden>refresh</span>
                      <span className="text-subtle">読み込み中...</span>
                    </div>
                  );
                }
                // ユーザー状態が読み込まれている場合
                if (communityDetail.membership_role) {
                  return (
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-rounded text-xs text-subtle" style={{ fontSize: 16 }} aria-hidden>
                        {communityDetail.membership_role === 'owner' ? 'star' : communityDetail.membership_role === 'admin_moderator' ? 'build' : 'shield_person'}
                      </span>
                      <span>
                        <span className="text-subtle">あなたの役割: </span>
                        {communityDetail.membership_role === 'owner' ? 'オーナー' : communityDetail.membership_role === 'admin_moderator' ? '管理モデレーター' : communityDetail.membership_role === 'moderator' ? 'モデレーター' : 'メンバー'}
                      </span>
                    </div>
                  );
                }
                return null;
              })()}
              {(() => {
                // ユーザー状態が読み込まれていない場合はスピナーを表示
                if (communityUserStatus === null && isAuthenticated) {
                  return null; // 役割のスピナーが表示されているので、ここでは何も表示しない
                }
                // ユーザー状態が読み込まれている場合
                if (communityDetail.membership_status && communityDetail.membership_status === 'pending') {
                  return (
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-rounded text-xs text-subtle" style={{ fontSize: 16 }} aria-hidden>pending</span>
                      <span className="text-subtle">承認待ち</span>
                    </div>
                  );
                }
                return null;
              })()}
            </div>
            {/* 参加/退会ボタンは非表示にする */}
          </div>
        </div>
      ) : null}

      {communityDetail ? (
        <RulesCard rules={communityDetail.rules} />
      ) : null}

      {/* モデレーターカード - Redditスタイル */}
      {communityDetail && moderators.length > 0 && (
        <div className="rounded-lg border border-subtle p-4 surface-1">
          <h2 className="font-medium mb-3">モデレーター</h2>
          <ul className="space-y-3">
            {moderators.map(m => (
              <li key={m.id} className="flex items-center gap-2 min-w-0">
                {m.icon_url ? (
                  <img src={m.icon_url} alt={m.username} className="w-8 h-8 rounded-full border border-subtle object-cover flex-shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded-full border border-subtle surface-1 flex-shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm truncate" title={m.display_name || m.username}>
                        {m.display_name || m.username}
                      </div>
                      <div className="text-xs text-subtle truncate" title={m.username_id || m.username}>
                        {m.username_id || m.username}
                      </div>
                    </div>
                    {m.role === 'owner' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-rose-500/30 bg-rose-500/20 text-rose-300 flex-shrink-0">オーナー</span>
                    )}
                    {m.role === 'admin_moderator' && (
                      <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/20 text-amber-300 flex-shrink-0" title="管理モデレーター">
                        <span className="material-symbols-rounded" style={{ fontSize: 12 }} aria-hidden>build</span>
                        <span className="ml-0.5">管理モデ</span>
                      </span>
                    )}
                    {m.role === 'moderator' && (
                      <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full border border-sky-500/30 bg-sky-500/20 text-sky-300 flex-shrink-0" title="モデレーター">
                        <span className="material-symbols-rounded" style={{ fontSize: 12 }} aria-hidden>shield_person</span>
                        <span className="ml-0.5">モデ</span>
                      </span>
                    )}
                  </div>
                  {/* オーナーまたはモデレーターの場合のみスコアを表示 */}
                  {isAdmin && m.score !== undefined && (
                    <div className="text-xs text-subtle mt-0.5">
                      スコア: {m.score.toLocaleString()}
                    </div>
                  )}
                </div>
                {/* オーナー/管理モデが標準モデ操作、オーナーのみ管理モデ操作 */}
                {(communityDetail?.membership_role === 'owner' || communityDetail?.membership_role === 'admin_moderator') && (m.role === 'moderator' || m.role === 'admin_moderator') && (m.username_id || m.username) !== currentUsername && (
                  <div className="ml-auto relative inline-block">
                    <button
                      type="button"
                      className="w-7 h-7 inline-flex items-center justify-center rounded-md border border-subtle/50 surface-1 hover:bg-white/5 opacity-60 hover:opacity-100 transition-opacity"
                      title="詳細"
                      onClick={(e) => { e.stopPropagation(); e.preventDefault();
                        if (moderatorMenuOpen === m.id && moderatorMenuMount) {
                          setModeratorMenuVisible(false);
                          setTimeout(() => { setModeratorMenuMount(false); setModeratorMenuOpen(null); }, 150);
                        } else {
                          setModeratorMenuOpen(m.id);
                          setModeratorMenuMount(true);
                          requestAnimationFrame(() => setModeratorMenuVisible(true));
                        }
                      }}
                    >
                      <span className="material-symbols-rounded text-sm text-subtle" aria-hidden>more_vert</span>
                    </button>
                    {moderatorMenuMount && moderatorMenuOpen === m.id && (
                      <div className={`absolute right-0 top-full mt-1 min-w-48 rounded-md border border-subtle surface-1 shadow-lg z-30 transition-all duration-150 ease-out origin-top-right ${moderatorMenuVisible ? 'opacity-100 -translate-y-0 scale-100' : 'opacity-0 -translate-y-1 scale-95 pointer-events-none'}`}>
                        {m.role === 'admin_moderator' ? (
                          communityDetail?.membership_role === 'owner' ? (
                            <button className="w-full text-left px-3 py-2 text-sm hover:bg-white/10 flex items-center gap-2" onClick={(e) => { e.stopPropagation(); e.preventDefault(); setModeratorMenuVisible(false); setTimeout(() => { setModeratorMenuMount(false); setModeratorMenuOpen(null); }, 150); demoteAdminModerator(m.id); }}>
                              <span className="material-symbols-rounded" aria-hidden>shield_lock</span>
                              <span>管理モデ解除</span>
                            </button>
                          ) : null
                        ) : (
                          <>
                            {communityDetail?.membership_role === 'owner' && (
                              <button className="w-full text-left px-3 py-2 text-sm hover:bg-white/10 flex items-center gap-2" onClick={(e) => { e.stopPropagation(); e.preventDefault(); setModeratorMenuVisible(false); setTimeout(() => { setModeratorMenuMount(false); setModeratorMenuOpen(null); }, 150); promoteAdminModerator(m.id); }}>
                                <span className="material-symbols-rounded" aria-hidden>build</span>
                                <span>管理モデ任命</span>
                              </button>
                            )}
                            <button className="w-full text-left px-3 py-2 text-sm hover:bg-white/10 flex items-center gap-2" onClick={(e) => { e.stopPropagation(); e.preventDefault(); setModeratorMenuVisible(false); setTimeout(() => { setModeratorMenuMount(false); setModeratorMenuOpen(null); }, 150); demoteModerator(m.id); }}>
                              <span className="material-symbols-rounded" aria-hidden>shield</span>
                              <span>モデレーター解除</span>
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* メンバーカード（コミュニティページのみ表示） */}
      {isCommunityPage && communityDetail && members.length > 0 && (
        <div className="rounded-lg border border-subtle p-4 surface-1">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-medium">メンバー</h2>
            <button className="text-xs px-2 py-1 rounded-md border border-subtle surface-1 hover:bg-white/5" onClick={fetchMembers}>更新</button>
          </div>
          <ul className="space-y-3">
            {members.slice(0, 10).map(m => (
              <li key={m.id} className="flex items-center gap-2 min-w-0">
                {m.icon_url ? (
                  <img src={m.icon_url} alt={m.username} className="w-8 h-8 rounded-full border border-subtle object-cover flex-shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded-full border border-subtle surface-1 flex-shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm truncate" title={m.display_name || m.username}>
                        {m.display_name || m.username}
                      </div>
                      <div className="text-xs text-subtle truncate" title={m.username_id || m.username}>
                        {m.username_id || m.username}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {(() => {
                        const isLoggedInUser = (m.username_id && !m.username_id.startsWith('Anonium-')) || 
                                              (m.username && !m.username.startsWith('Anonium-') && !m.username_id);
                        return isLoggedInUser ? (
                          <span className="relative inline-flex items-center justify-center" title="ログイン済" aria-label="ログイン済">
                            <svg className="w-3 h-3 text-green-500" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                              <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.1"/>
                              <path d="M7 10l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                            </svg>
                          </span>
                        ) : null;
                      })()}
                      {m.role === 'owner' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-rose-500/30 bg-rose-500/20 text-rose-300">オーナー</span>
                      )}
                      {m.role === 'admin_moderator' && (
                        <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/20 text-amber-300" title="管理モデレーター">
                          <span className="material-symbols-rounded" style={{ fontSize: 12 }} aria-hidden>build</span>
                          <span className="ml-0.5">管理モデ</span>
                        </span>
                      )}
                      {m.role === 'moderator' && (
                        <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full border border-sky-500/30 bg-sky-500/20 text-sky-300" title="モデレーター">
                          <span className="material-symbols-rounded" style={{ fontSize: 12 }} aria-hidden>shield_person</span>
                          <span className="ml-0.5">モデ</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {(communityDetail?.membership_role === 'owner' || communityDetail?.membership_role === 'admin_moderator') && (m.username_id || m.username) !== currentUsername && (
                  <div className="ml-auto relative inline-block">
                    <button
                      type="button"
                      className="w-7 h-7 inline-flex items-center justify-center rounded-md border border-subtle/50 surface-1 hover:bg-white/5 opacity-60 hover:opacity-100 transition-opacity"
                      title="詳細"
                      onClick={(e) => { e.stopPropagation(); e.preventDefault();
                        if (memberListMenuOpen === m.id && memberListMenuMount) {
                          setMemberListMenuVisible(false);
                          setTimeout(() => { setMemberListMenuMount(false); setMemberListMenuOpen(null); }, 150);
                        } else {
                          try {
                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            const spaceBelow = (typeof window !== 'undefined' ? window.innerHeight : 0) - rect.bottom;
                            setMemberListMenuUp(spaceBelow < 220);
                          } catch {}
                          setMemberListMenuOpen(m.id);
                          setMemberListMenuMount(true);
                          requestAnimationFrame(() => setMemberListMenuVisible(true));
                        }
                      }}
                    >
                      <span className="material-symbols-rounded text-sm text-subtle" aria-hidden>more_vert</span>
                    </button>
                    {memberListMenuMount && memberListMenuOpen === m.id && (
                      <div className={`absolute right-0 ${memberListMenuUp ? 'bottom-full mb-1 origin-bottom-right' : 'top-full mt-1 origin-top-right'} min-w-44 rounded-md border border-subtle surface-1 shadow-lg z-30 transition-all duration-150 ease-out ${memberListMenuVisible ? 'opacity-100 -translate-y-0 scale-100' : 'opacity-0 -translate-y-1 scale-95 pointer-events-none'}`}>
                        <button className="w-full text-left px-3 py-2 text-sm hover:bg-white/10 flex items-center gap-2" onClick={(e) => { e.stopPropagation(); e.preventDefault(); setMemberListMenuVisible(false); setTimeout(() => { setMemberListMenuMount(false); setMemberListMenuOpen(null); }, 150);
                          fetch(`${API}/api/communities/${communityDetail.id}/members/${m.id}/promote/`, { method: 'POST', credentials: 'include' }).then(() => fetchMembers());
                        }}>
                          <span className="material-symbols-rounded" aria-hidden>shield_person</span>
                          <span>モデレーター任命</span>
                        </button>
                        {(communityDetail?.membership_role === 'owner') && (
                          <button className="w-full text-left px-3 py-2 text-sm hover:bg-white/10 flex items-center gap-2" onClick={(e) => { e.stopPropagation(); e.preventDefault(); setMemberListMenuVisible(false); setTimeout(() => { setMemberListMenuMount(false); setMemberListMenuOpen(null); }, 150);
                            fetch(`${API}/api/communities/${communityDetail.id}/members/${m.id}/promote_admin/`, { method: 'POST', credentials: 'include' }).then(() => fetchMembers());
                          }}>
                            <span className="material-symbols-rounded" aria-hidden>build</span>
                            <span>管理モデ任命</span>
                          </button>
                        )}
                        <button className="w-full text-left px-3 py-2 text-sm hover:bg-white/10 flex items-center gap-2" onClick={(e) => { e.stopPropagation(); e.preventDefault(); setMemberListMenuVisible(false); setTimeout(() => { setMemberListMenuMount(false); setMemberListMenuOpen(null); }, 150);
                          fetch(`${API}/api/communities/${communityDetail.id}/members/${m.id}/remove/`, { method: 'POST', credentials: 'include' }).then(() => fetchMembers());
                        }}>
                          <span className="material-symbols-rounded" aria-hidden>person_remove</span>
                          <span>除名</span>
                        </button>
                        <button className="w-full text-left px-3 py-2 text-sm hover:bg-white/10 flex items-center gap-2" onClick={(e) => { e.stopPropagation(); e.preventDefault(); setMemberListMenuVisible(false); setTimeout(() => { setMemberListMenuMount(false); setMemberListMenuOpen(null); }, 150);
                          fetch(`${API}/api/communities/${communityDetail.id}/members/${m.id}/block/`, { method: 'POST', credentials: 'include' }).then(() => fetchMembers());
                        }}>
                          <span className="material-symbols-rounded" aria-hidden>block</span>
                          <span>ブロック</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {communityDetail ? (
        <div>
          <h2 className="font-medium mb-3 text-white">最近の投稿</h2>
          {posts.length === 0 ? (
            <div className="text-sm text-subtle">投稿がありません。</div>
          ) : (
            <div className="space-y-4">
              {posts.slice(0, 6).map((p: any) => (
                <PostCard
                  key={p.id}
                  post={p}
                  inVillage={false}
                  community={{
                    id: communityDetail.id,
                    slug: communityDetail.slug,
                    is_member: communityDetail.is_member,
                    membership_role: communityDetail.membership_role,
                    join_policy: communityDetail.join_policy,
                    karma: communityDetail.karma,
                  }}
                />
              ))}
            </div>
          )}
        </div>
      ) : null}

      {/* 最近見たスレッド（ホームページの場合のみ） */}
      {!communityDetail && recentPosts.length > 0 && (
        <div>
          <h2 className="font-medium mb-3 text-white">最近見たスレッド</h2>
          {recentPostData.length === 0 && !loadingRecentPosts ? (
            <div className="text-sm text-subtle">読み込み中...</div>
          ) : (
            <>
              <div className="space-y-4">
                {recentPostData.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    inVillage={false}
                    showAuthor={false}
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
                    isAuthenticated={isAuthenticated}
                  />
                ))}
              </div>
              {recentPostsDisplayCount < recentPosts.length && (
                <div className="mt-4">
                  <button
                    onClick={handleLoadMoreRecentPosts}
                    disabled={loadingRecentPosts}
                    className="w-full px-4 py-2 text-sm rounded-md border border-subtle surface-1 hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {loadingRecentPosts ? '読み込み中...' : 'さらに表示'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <div className="rounded-lg border border-subtle p-4 surface-1">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="font-medium text-white">アノニウム一覧</h2>
          <div 
            className="relative inline-flex items-center"
            onMouseEnter={() => setAnoniumInfoHover(true)}
            onMouseLeave={() => setAnoniumInfoHover(false)}
          >
            <button
              type="button"
              className="text-subtle hover:text-white transition-colors"
              aria-label="アノニウムについて"
            >
              <span className="material-symbols-rounded text-base" style={{ fontSize: 16 }}>info</span>
            </button>
            {anoniumInfoHover && (
              <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-[calc(100vw-2rem)] max-w-[280px] p-3 rounded-lg border border-subtle bg-black shadow-lg z-50 text-sm">
                <p className="text-white mb-2">このサービスではユーザはアノニウムというコミュニティを作成できます。</p>
                <p className="text-subtle mb-2">
                  Anonium(アノニウム)はインターネットの匿名性を構成する元素という意味で、アノニマス(anonymous:匿名)と元素(~ium)から取った言葉です。
                </p>
                <p className="text-subtle">
                  このサービスは基本的に原則匿名であり、我々はインターネットを構成する匿名性の元素の集合体なのです。
                </p>
              </div>
            )}
          </div>
        </div>
        {communities.length === 0 ? (
          <div className="text-sm text-subtle">アノニウムがありません。</div>
        ) : (
          <ul className="space-y-1.5">
            {communities.filter(c => !!c.slug).map((c) => (
              <li key={c.id} className="group">
                <a href={`/v/${c.id}`} className="flex items-center gap-3 min-w-0 p-2 rounded-lg hover:bg-white/5 transition-colors">
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
                    <div className="flex items-center gap-1.5">
                      <div className="text-sm font-medium text-white truncate hover:underline">
                        {c.name || c.slug}
                      </div>
                      {isAuthenticated && c.is_member && (
                        <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-accent" title="参加中" aria-label="参加中"></span>
                      )}
                    </div>
                    <div className="text-xs text-subtle">{c.members_count ?? 0} メンバー</div>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
