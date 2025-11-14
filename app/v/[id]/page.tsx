"use client";

import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Header from "@/app/components/Header";
import SidebarTabs from "@/app/components/SidebarTabs";
import PostCard from "@/app/components/PostCard";
import MobileNav from "@/app/components/MobileNav";
import RulesCard from "@/app/components/RulesCard";
import CreateFab from "@/app/components/CreateFab";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import { pushRecentCommunity } from "@/app/utils/recentCommunities";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

type PaginatedResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

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
  allow_repost?: boolean;
  karma?: number;
  rules?: string;
  is_member?: boolean;
  membership_status?: string | null;
  membership_role?: string | null;
  is_admin?: boolean;
  tags?: Array<{ name: string; color?: string; permission_scope?: 'all'|'moderator'|'owner' }>;
  tag_permission_scope?: 'all'|'moderator'|'owner';
  clip_post_id?: number | null;
  created_at?: string;
};

type Post = {
  id: number;
  title: string;
  body?: string;
  author: number;
  created_at: string;
  user_vote?: number | null;
  is_following?: boolean;
  community_is_member?: boolean;
  community_membership_role?: string | null;
  community_join_policy?: string;
  community_karma?: number;
  can_moderate?: boolean;
  community_id?: number;
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

type BlockedUser = {
  id: number;
  username: string;
  icon_url?: string;
  reason?: string;
  created_at: string;
};

type PendingRequest = {
  id: number;
  username: string;
  icon_url?: string;
  role?: string | null;
};

export default function VillagePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  // idを確実にstringとして扱う（undefinedの場合は空文字列）
  const id = (Array.isArray(params.id) ? params.id[0] : params.id) || '';
  
  const [signedIn, setSignedIn] = useState<boolean>(false);
  const [tab, setTab] = useState<string>("trending");
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [village, setVillage] = useState<Community | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [nextPage, setNextPage] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [villageLoading, setVillageLoading] = useState<boolean>(true);
  const [membersLoading, setMembersLoading] = useState<boolean>(true);
  const observerTarget = useRef<HTMLDivElement>(null);
  const [blocked, setBlocked] = useState<BlockedUser[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const sortedMembers = useMemo(() => {
    // ソート: オーナー、ログイン、ゲストの順
    return [...members].sort((a, b) => {
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
  }, [members]);
  
  // オーナーとモデレーターのみをフィルタリング（Redditスタイル）
  const moderators = useMemo(() => {
    return members.filter(m => m.role === 'owner' || m.role === 'admin_moderator' || m.role === 'moderator').sort((a, b) => {
      // オーナーを先に、次にモデレーター
      if (a.role === 'owner' && b.role !== 'owner') return -1;
      if (a.role !== 'owner' && b.role === 'owner') return 1;
      if (a.role === 'admin_moderator' && b.role !== 'admin_moderator') return -1;
      if (a.role !== 'admin_moderator' && b.role === 'admin_moderator') return 1;
      if (a.role === 'moderator' && b.role !== 'moderator') return -1;
      if (a.role !== 'moderator' && b.role === 'moderator') return 1;
      // 同じロールの場合はスコア順（降順）
      const scoreA = a.score ?? 0;
      const scoreB = b.score ?? 0;
      return scoreB - scoreA;
    });
  }, [members]);
  
  // オーナーまたはモデレーターかどうか（両方ともスコアを確認可能）
  const isAdmin = village?.membership_role === 'owner' || village?.membership_role === 'admin_moderator' || village?.membership_role === 'moderator';
  const [joined, setJoined] = useState<boolean>(false);
  const [favorite, setFavorite] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<string>("");
  const [overlayMode, setOverlayMode] = useState<boolean>(false);
  const [vw, setVw] = useState<number>(0);
  const asideWidth = vw >= 1200 ? 300 : (vw > 1000 ? Math.round(200 + (vw - 1000) * 0.5) : undefined);
  const [subTab, setSubTab] = useState<'posts' | 'details'>('posts');
  const [memberMenuOpen, setMemberMenuOpen] = useState<number | null>(null);
  const [memberMenuMount, setMemberMenuMount] = useState<boolean>(false);
  const [memberMenuVisible, setMemberMenuVisible] = useState<boolean>(false);
  const [memberMenuUp, setMemberMenuUp] = useState<boolean>(false);
  const [currentUsername, setCurrentUsername] = useState<string>("");
  const [moderatorMenuOpen, setModeratorMenuOpen] = useState<number | null>(null);
  const [moderatorMenuMount, setModeratorMenuMount] = useState<boolean>(false);
  const [moderatorMenuVisible, setModeratorMenuVisible] = useState<boolean>(false);
  const [moderatorMenuUp, setModeratorMenuUp] = useState<boolean>(false);
  const [memberTab, setMemberTab] = useState<'members' | 'blocks'>('members');
  const [tagFilter, setTagFilter] = useState<string>("");
  // タグ追加用の簡易フォーム状態
  const [newTagName, setNewTagName] = useState<string>("");
  const [newTagColor, setNewTagColor] = useState<string>("#1e3a8a");
  const [newTagOpen, setNewTagOpen] = useState<boolean>(false);
  const [guestScore, setGuestScore] = useState<number | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [authInitialized, setAuthInitialized] = useState<boolean>(false);
  function textColorFor(bg: string): string {
    // expects #rrggbb
    try {
      const hex = (bg || '').replace('#','');
      if (hex.length !== 6) return '#ffffff';
      const r = parseInt(hex.substring(0,2), 16) / 255;
      const g = parseInt(hex.substring(2,4), 16) / 255;
      const b = parseInt(hex.substring(4,6), 16) / 255;
      const srgb = [r,g,b].map(v => (v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4)));
      const L = 0.2126*srgb[0] + 0.7152*srgb[1] + 0.0722*srgb[2];
      return L > 0.5 ? '#000000' : '#ffffff';
    } catch { return '#ffffff'; }
  }
  
  useEffect(() => {
    try {
      const saved = localStorage.getItem('villageTagFilter') || '';
      setTagFilter(saved);
    } catch {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem('villageTagFilter', tagFilter || ''); } catch {}
  }, [tagFilter]);
  async function addTagQuickInline() {
    if (!village) return;
    const canAdd = (
      (village.tag_permission_scope === 'all' && village.is_member) ||
      village.membership_role === 'owner' || village.membership_role === 'admin_moderator' || village.membership_role === 'moderator'
    );
    if (!canAdd) { setStatusMsg('タグを追加する権限がありません。'); return; }
    const name = (newTagName || '').trim();
    const color = (newTagColor || '#1e3a8a').trim();
    if (!name) { setStatusMsg('タグ名を入力してください。'); return; }
    const tags = Array.isArray(village.tags) ? [...village.tags] : [];
    if (tags.find(t => (t.name||'') === name)) { setStatusMsg('同名のタグが存在します。'); return; }
    const next = [...tags, { name, color }];
    try {
      // セキュリティ対策: JWTトークンはCookieから自動的に送信される
      const res = await fetch(`${API}/api/communities/${id}/`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ tags: next }) });
      if (res.ok) {
        await fetchVillage(true);
        setStatusMsg('タグを追加しました。');
        setNewTagName("");
        setNewTagColor('#1e3a8a');
      } else {
        const t = await res.text(); setStatusMsg(t || `タグ追加に失敗しました (${res.status})`);
      }
    } catch { setStatusMsg('タグ追加に失敗しました。'); }
  }

  useEffect(() => {
    // セキュリティ対策: JWTトークンはCookieから自動的に認証されるため、localStorageのチェックは不要
    // setAccessは使用しない（Cookieから自動的に認証される）
    const savedTab = localStorage.getItem("villageTab");
    if (savedTab) {
      // 旧バージョンの'hot'を'trending'に変換
      const tabValue = savedTab === 'hot' ? 'trending' : savedTab;
      setTab(tabValue);
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

  // fetchVillageを先に定義（他の関数やuseEffectで使用されるため）
  const fetchVillage = useCallback(async (preserveJoinedState: boolean = false) => {
    if (!id) return;
    setVillageLoading(true);
    try {
      // セキュリティ対策: JWTトークンとゲストトークンはCookieから自動的に送信される
      const res = await fetch(`${API}/api/communities/${id}/`, { credentials: 'include' });
      if (!res.ok) {
        setVillageLoading(false);
        return;
      }
      const data: Community = await res.json();
      setVillage(data);
      
      // ユーザー状態を別途取得
      try {
        // セキュリティ対策: JWTトークンはCookieから自動的に送信される
        const statusRes = await fetch(`${API}/api/communities/${id}/status/`, { credentials: 'include' });
        if (statusRes.ok) {
          const status = await statusRes.json();
          // コミュニティデータにユーザー状態をマージ
          setVillage(prev => prev ? { ...prev, ...status } : null);
          // 参加成功直後など、状態を保持したい場合は、is_memberがtrueの場合のみ更新
          if (typeof status.is_member === 'boolean') {
            if (preserveJoinedState) {
              // 参加状態を保持する場合、関数形式で現在の値を確認
              setJoined(prevJoined => {
                // 参加状態が保持されている場合、APIがfalseを返しても保持
                if (prevJoined && status.is_member === false) {
                  return true; // 参加状態を保持
                }
                return status.is_member ?? false;
              });
            } else {
              setJoined(status.is_member ?? false);
            }
          }
        } else {
          // エラーの場合はデフォルト値を設定
          setJoined(false);
        }
      } catch (error) {
        // エラーの場合はデフォルト値を設定
        setJoined(false);
      }
    } finally {
      setVillageLoading(false);
    }
  }, [id, API]);

  // 認証状態が変更された場合（ログイン/ログアウト）に認証情報を再取得し、その後コミュニティ情報も再取得
  useEffect(() => {
    if (!authInitialized || !id) return;
    
    // セキュリティ対策: JWTトークンはCookieから自動的に送信される
    setAuthLoading(true);
    fetch(`${API}/api/accounts/me/`, {
      credentials: 'include', 
    }).then(res => {
      if (res.ok) {
        return res.json().then(data => {
          // ゲストユーザーかどうかを確認
          const isGuest = data.is_guest || (data.username && data.username.startsWith('Anonium-'));
          setSignedIn(!isGuest && data.username && !data.username.startsWith('Anonium-'));
          if (data && data.username) {
            try { localStorage.setItem('accessUsername', data.username); } catch {}
            setCurrentUsername(data.username);
          }
          // ゲストユーザーの場合もスコアを設定
          if (data.score !== undefined) {
            setGuestScore(data.score ?? 0);
          } else {
            setGuestScore(null);
          }
          // 認証情報が再取得された後、コミュニティ情報も再取得
          fetchVillage();
        });
      } else {
        setSignedIn(false);
        // ゲストトークンが存在しない場合は発行を試みる
        if (res.status === 404) {
          return fetch(`${API}/api/accounts/guest/issue/`, { method: 'POST', credentials: 'include' }).then(() => {
            // セキュリティ対策: JWTトークンはCookieから自動的に送信される
            return fetch(`${API}/api/accounts/me/`, { credentials: 'include' }).then(retryRes => {
              if (retryRes.ok) {
                return retryRes.json().then(data => {
                  const isGuest = data.is_guest || (data.username && data.username.startsWith('Anonium-'));
                  setSignedIn(!isGuest && data.username && !data.username.startsWith('Anonium-'));
                  if (data && data.username) {
                    try { localStorage.setItem('accessUsername', data.username); } catch {}
                    setCurrentUsername(data.username);
                  }
                  if (data.score !== undefined) {
                    setGuestScore(data.score ?? 0);
                  }
                  fetchVillage();
                });
              } else {
                setSignedIn(false);
              }
            });
          });
        }
      }
    }).catch(() => {
      setSignedIn(false);
      // エラー時もコミュニティ情報を再取得
      fetchVillage();
    }).finally(() => {
      setAuthLoading(false);
    });
  }, [id, authInitialized, fetchVillage, API]);

  useEffect(() => {
    if (!id) { setFavorite(false); return; }
    // APIのis_favoriteがあればそれを優先し、なければlocalStorageをフォールバック
    if (village && typeof (village as any).is_favorite === 'boolean') {
      setFavorite(!!(village as any).is_favorite);
    } else {
      if (village?.id) {
        setFavorite(!!localStorage.getItem(`favorite:community:${village.id}`));
      }
    }
  }, [id, village?.id, (village as any)?.is_favorite]);

  useEffect(() => {
    try { setCurrentUsername(localStorage.getItem('accessUsername') || ''); } catch {}
    if (!memberMenuMount) return;
    function onDocClick() {
      setMemberMenuVisible(false);
      setTimeout(() => { setMemberMenuMount(false); setMemberMenuOpen(null); }, 150);
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [memberMenuMount]);

  useEffect(() => {
    if (!moderatorMenuMount) return;
    function onDocClick() {
      setModeratorMenuVisible(false);
      setTimeout(() => { setModeratorMenuMount(false); setModeratorMenuOpen(null); }, 150);
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [moderatorMenuMount]);

  // 認証情報を確実に取得する関数
  const fetchAuthInfo = useCallback(async () => {
    setAuthLoading(true);
    try {
      // セキュリティ対策: JWTトークンはCookieから自動的に送信される
      const res = await fetch(`${API}/api/accounts/me/`, {
        credentials: 'include', 
      });
      
      if (res.ok) {
        const data = await res.json();
        // ゲストユーザーかどうかを確認
        const isGuest = data.is_guest || (data.username && data.username.startsWith('Anonium-'));
        setSignedIn(!isGuest && data.username && !data.username.startsWith('Anonium-'));
        if (data && data.username) {
          try { localStorage.setItem('accessUsername', data.username); } catch {}
          setCurrentUsername(data.username);
        }
        // ゲストユーザーの場合もスコアを設定
        if (data.score !== undefined) {
          setGuestScore(data.score ?? 0);
        } else {
          setGuestScore(null);
        }
        setAuthInitialized(true);
      } else {
        setSignedIn(false);
        // ゲストトークンが存在しない場合は発行を試みる
        if (res.status === 404) {
          try {
            await fetch(`${API}/api/accounts/guest/issue/`, { method: 'POST', credentials: 'include' });
            // ゲストトークン発行後、再度取得を試みる
            // セキュリティ対策: JWTトークンはCookieから自動的に送信される
            const retryRes = await fetch(`${API}/api/accounts/me/`, { credentials: 'include' });
            if (retryRes.ok) {
              const data = await retryRes.json();
              const isGuest = data.is_guest || (data.username && data.username.startsWith('Anonium-'));
              setSignedIn(!isGuest && data.username && !data.username.startsWith('Anonium-'));
              if (data && data.username) {
                try { localStorage.setItem('accessUsername', data.username); } catch {}
                setCurrentUsername(data.username);
              }
              if (data.score !== undefined) {
                setGuestScore(data.score ?? 0);
              }
            } else {
              setSignedIn(false);
            }
          } catch {
            setSignedIn(false);
          }
        }
        setAuthInitialized(true);
      }
    } catch {
      setSignedIn(false);
      setAuthInitialized(true);
    } finally {
      setAuthLoading(false);
    }
  }, [API]);

  const fetchGuestScore = useCallback(async () => {
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
  }, []);

  // 認証情報を最初に読み込む
  useEffect(() => {
    fetchAuthInfo();
  }, [fetchAuthInfo]);

  // 認証情報が読み込まれた後、またはアクセストークンが変更された後にコミュニティ情報を取得
  useEffect(() => {
    if (!id || !authInitialized) return;
    
    // 認証情報が確実に読み込まれた後にコミュニティ情報を取得
    setPosts([]);
    setNextPage(null);
    // 各セクションのローディング状態をリセット
    setVillageLoading(true);
    setMembersLoading(true);
    fetchVillage();
    fetchPosts(true);
    fetchMembers();
    // ゲストユーザーのスコアを取得（ログインしていない場合）
    if (!signedIn) {
      fetchGuestScore();
    } else {
      setGuestScore(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, tab, authInitialized, fetchVillage, fetchGuestScore, signedIn]);

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
      setPosts(prev => [...prev, ...data.results]);
      setNextPage(data.next || null);
    } catch {
      // noop
    } finally {
      setLoading(false);
    }
  }, [nextPage, loading]);

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
  }, [nextPage, loading, loadNextPage]);

  // 訪問履歴にコミュニティを追加
  useEffect(() => {
    if (village && village.id) {
      pushRecentCommunity({ id: village.id, name: village.name, icon_url: village.icon_url });
    }
  }, [village?.id]);

  useEffect(() => {
    if (village?.membership_role === 'owner' && village?.join_policy === 'approval') {
      fetchPendingRequests();
    } else {
      // 参加ポリシーがapprovalでなくなった場合、承認待ちリストをクリア
      setPendingRequests([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [village?.membership_role, village?.join_policy, id]);

  async function fetchPosts(reset: boolean = false) {
    if (!id) return;
    if (reset) {
      setPosts([]);
      setNextPage(null);
    }
    setLoading(true);
    try {
    // セキュリティ対策: JWTトークンはCookieから自動的に送信される
    const sortParam = tab === 'trending' ? 'trending' : tab === 'score' ? 'score' : tab === 'old' ? 'old' : 'new';
    const res = await fetch(`${API}/api/communities/${id}/posts/?sort=${sortParam}`, { credentials: 'include' });
      if (!res.ok) { 
        setPosts([]); 
        setNextPage(null);
        return; 
      }
      const data: PaginatedResponse<Post> = await res.json();
      setPosts(data.results);
      // 勢い順の場合はページネーションを無効化
      if (tab === 'trending') {
        setNextPage(null);
      } else {
        setNextPage(data.next || null);
      }

      // 投稿データには既にユーザー依存データが含まれています
    } catch {
      setPosts([]);
      setNextPage(null);
    } finally {
      setLoading(false);
    }
  }


  async function fetchMembers() {
    if (!id) return;
    setMembersLoading(true);
    try {
      // セキュリティ対策: JWTトークンはCookieから自動的に送信される
      const res = await fetch(`${API}/api/communities/${id}/members/?limit=12`, { credentials: 'include' });
      if (!res.ok) { 
        setMembers([]); 
        setMembersLoading(false);
        return; 
      }
      const data = await res.json();
      // ページネーション対応: レスポンスが {count, next, previous, results} の形式の場合と配列の場合の両方に対応
      const members = Array.isArray(data) ? data : (data.results || []);
      setMembers(members);
    } finally {
      setMembersLoading(false);
    }
  }

  async function fetchBlocks() {
    if (!village?.membership_role || (village.membership_role !== 'owner')) return;
    // セキュリティ対策: JWTトークンはCookieから自動的に送信される
    const res = await fetch(`${API}/api/communities/${id}/blocks/`, { credentials: 'include' });
    if (!res.ok) { setBlocked([]); return; }
    const data = await res.json();
    // ページネーション対応: レスポンスが {count, next, previous, results} の形式の場合と配列の場合の両方に対応
    const blocked = Array.isArray(data) ? data : (data.results || []);
    setBlocked(blocked);
  }

  async function fetchPendingRequests() {
    if (!village?.membership_role || village.membership_role !== 'owner') return;
    if (village?.join_policy !== 'approval') return;
    // セキュリティ対策: JWTトークンはCookieから自動的に送信される
    const res = await fetch(`${API}/api/communities/${id}/requests/`, { credentials: 'include' });
    if (!res.ok) { setPendingRequests([]); return; }
    const data = await res.json();
    // ページネーション対応: レスポンスが {count, next, previous, results} の形式の場合と配列の場合の両方に対応
    const requests = Array.isArray(data) ? data : (data.results || []);
    setPendingRequests(requests);
  }

  async function adminAction(endpoint: string, onOk: () => void) {
    // セキュリティ対策: JWTトークンはCookieから自動的に送信される
    // 認証状態はAPIレスポンスで確認（401または403が返される場合）
    // オーナーまたは管理モデレーターでUI表示を許可
    if (!(village?.membership_role === 'owner' || village?.membership_role === 'admin_moderator')) {
      setStatusMsg('権限がありません。');
      return;
    }
    try {
      const res = await fetch(endpoint, { method: 'POST', credentials: 'include' });
      const txt = await res.text();
      if (!res.ok) {
        if (res.status === 401) {
          setStatusMsg('ログインが必要です。');
        } else if (res.status === 403) {
          setStatusMsg('権限がありません。');
        } else {
          setStatusMsg(txt || `エラー ${res.status}`);
        }
        return;
      }
      onOk();
    } catch {
      setStatusMsg('操作に失敗しました。');
    }
  }

  function removeMember(userId: number, displayName: string) {
    if (!window.confirm(`${displayName} を除名しますか？`)) return;
    adminAction(`${API}/api/communities/${id}/members/${userId}/remove/`, () => {
      setMembers(ms => ms.filter(m => m.id !== userId));
      setVillage(v => v && v.members_count > 0 ? { ...v, members_count: v.members_count - 1 } : v);
      setStatusMsg('除名しました。');
    });
  }

  function blockMember(userId: number, displayName: string) {
    if (!window.confirm(`${displayName} をブロックし、参加からも外しますか？`)) return;
    adminAction(`${API}/api/communities/${id}/members/${userId}/block/`, () => {
      setMembers(ms => ms.filter(m => m.id !== userId));
      setVillage(v => v && v.members_count > 0 ? { ...v, members_count: v.members_count - 1 } : v);
      setStatusMsg('ブロックしました。');
    });
  }

  function unblockUser(userId: number) {
    // UIはオーナーのみブロック一覧表示だが、エンドポイントは管理モデレーターも許可
    adminAction(`${API}/api/communities/${id}/members/${userId}/unblock/`, () => {
      setBlocked(bs => bs.filter(b => b.id !== userId));
      setStatusMsg('ブロックを解除しました。');
    });
  }

  function promoteModerator(userId: number) {
    adminAction(`${API}/api/communities/${id}/members/${userId}/promote/`, () => {
      setMembers(ms => ms.map(m => m.id === userId ? { ...m, role: 'moderator' } : m));
      setStatusMsg('モデレーターに任命しました。');
    });
  }

  function demoteModerator(userId: number) {
    adminAction(`${API}/api/communities/${id}/members/${userId}/demote/`, () => {
      setMembers(ms => ms.map(m => m.id === userId ? { ...m, role: 'member' } : m));
      setStatusMsg('モデレーターを解除しました。');
    });
  }

  function promoteAdminModerator(userId: number) {
    if (village?.membership_role !== 'owner') { setStatusMsg('オーナー権限が必要です。'); return; }
    adminAction(`${API}/api/communities/${id}/members/${userId}/promote_admin/`, () => {
      setMembers(ms => ms.map(m => m.id === userId ? { ...m, role: 'admin_moderator' } : m));
      setStatusMsg('管理モデレーターに任命しました。');
    });
  }

  function demoteAdminModerator(userId: number) {
    if (village?.membership_role !== 'owner') { setStatusMsg('オーナー権限が必要です。'); return; }
    adminAction(`${API}/api/communities/${id}/members/${userId}/demote_admin/`, () => {
      // 連鎖で標準モデレーターも解除されるので、リストを再取得
      fetchMembers();
      setStatusMsg('管理モデレーターを解除しました。');
    });
  }

  function approveRequest(userId: number) {
    if (village?.membership_role !== 'owner') { setStatusMsg('オーナー権限が必要です。'); return; }
    adminAction(`${API}/api/communities/${id}/requests/${userId}/approve/`, () => {
      setPendingRequests(prs => prs.filter(pr => pr.id !== userId));
      setVillage(v => v ? { ...v, members_count: v.members_count + 1 } : v);
      setStatusMsg('参加申請を承認しました。');
      fetchMembers();
    });
  }

  function rejectRequest(userId: number, displayName: string) {
    if (!window.confirm(`${displayName} の参加申請を拒否しますか？`)) return;
    if (village?.membership_role !== 'owner') { setStatusMsg('オーナー権限が必要です。'); return; }
    adminAction(`${API}/api/communities/${id}/requests/${userId}/reject/`, () => {
      setPendingRequests(prs => prs.filter(pr => pr.id !== userId));
      setStatusMsg('参加申請を拒否しました。');
    });
  }

  // 明確に分離されたカードレンダラー（入れ子回避のため共通化）
  function ModeratorListCard() {
    if (membersLoading) {
      return (
        <div className="rounded-lg border border-subtle p-4 surface-1 flex items-center justify-center min-h-[120px]">
          <LoadingSpinner size={24} />
        </div>
      );
    }
    if (moderators.length === 0) return null;
    const isModerator = village?.membership_role === 'owner' || village?.membership_role === 'admin_moderator' || village?.membership_role === 'moderator';
    return (
      <div className="rounded-lg border border-subtle p-4 surface-1">
          <div className="flex items-center justify-between mb-3">
          <h2 className="font-medium">モデレーター</h2>
          <Link 
            href={`/v/${id}/moderators`}
            className="text-xs text-subtle hover:text-foreground flex items-center gap-1"
          >
            <span>すべて表示</span>
            <span className="material-symbols-rounded text-xs" aria-hidden>chevron_right</span>
          </Link>
        </div>
        <ul className="space-y-3">
          {moderators.map(m => (
            <li key={m.id} className="flex items-center gap-2 min-w-0">
              {m.icon_url ? (
                <img src={m.icon_url} alt={m.display_name || m.username} className="w-8 h-8 rounded-full border border-subtle object-cover flex-shrink-0" />
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
                {isAdmin && m.score !== undefined && (
                  <div className="text-xs text-subtle mt-0.5">スコア: {m.score.toLocaleString()}</div>
                )}
              </div>
              {(village?.membership_role === 'owner' || village?.membership_role === 'admin_moderator') && (m.role === 'moderator' || (m.role === 'admin_moderator' && village?.membership_role === 'owner')) && (m.username_id || m.username) !== currentUsername && (
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
                        try {
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                          const spaceBelow = (typeof window !== 'undefined' ? window.innerHeight : 0) - rect.bottom;
                          setModeratorMenuUp(spaceBelow < 220);
                        } catch {}
                        setModeratorMenuOpen(m.id);
                        setModeratorMenuMount(true);
                        requestAnimationFrame(() => setModeratorMenuVisible(true));
                      }
                    }}
                  >
                    <span className="material-symbols-rounded text-sm text-subtle" aria-hidden>more_vert</span>
                  </button>
                  {moderatorMenuMount && moderatorMenuOpen === m.id && (
                    <div className={`absolute right-0 ${moderatorMenuUp ? 'bottom-full mb-1 origin-bottom-right' : 'top-full mt-1 origin-top-right'} min-w-40 rounded-md border border-subtle surface-1 shadow-lg z-30 transition-all duration-150 ease-out ${moderatorMenuVisible ? 'opacity-100 -translate-y-0 scale-100' : 'opacity-0 -translate-y-1 scale-95 pointer-events-none'}`}>
                      {m.role === 'admin_moderator' ? (
                        village?.membership_role === 'owner' ? (
                          <button className="w-full text-left px-3 py-2 text-sm hover:bg-white/10 flex items-center gap-2" onClick={(e) => { e.stopPropagation(); e.preventDefault(); setModeratorMenuVisible(false); setTimeout(() => { setModeratorMenuMount(false); setModeratorMenuOpen(null); }, 150); demoteAdminModerator(m.id); }}>
                            <span className="material-symbols-rounded" aria-hidden>shield_lock</span>
                            <span>管理モデ解除</span>
                          </button>
                        ) : null
                      ) : (
                        <button className="w-full text-left px-3 py-2 text-sm hover:bg-white/10 flex items-center gap-2" onClick={(e) => { e.stopPropagation(); e.preventDefault(); setModeratorMenuVisible(false); setTimeout(() => { setModeratorMenuMount(false); setModeratorMenuOpen(null); }, 150); demoteModerator(m.id); }}>
                          <span className="material-symbols-rounded" aria-hidden>shield</span>
                          <span>モデレーター解除</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  function MembersListCard() {
    return (
      <div className="rounded-lg border border-subtle p-4 surface-1">
        <div className="flex items-center justify-between mb-3">
          <div className="inline-flex items-center gap-1 rounded-md border border-subtle overflow-hidden">
            <button className={`px-3 py-1.5 text-sm ${memberTab==='members' ? 'bg-white/10' : 'hover:bg-white/5'}`} onClick={() => setMemberTab('members')}>メンバー</button>
            {village?.membership_role === 'owner' && (
              <button className={`px-3 py-1.5 text-sm ${memberTab==='blocks' ? 'bg-white/10' : 'hover:bg-white/5'}`} onClick={() => { setMemberTab('blocks'); fetchBlocks(); }}>ブロック</button>
            )}
          </div>
          <div className="space-x-2">
            {memberTab==='members' ? (
              <button className="text-xs px-2 py-1 rounded-md border border-subtle surface-1 hover:bg-white/5" onClick={fetchMembers}>更新</button>
            ) : (
              village?.membership_role === 'owner' ? <button className="text-xs px-2 py-1 rounded-md border border-subtle surface-1 hover:bg-white/5" onClick={fetchBlocks}>更新</button> : null
            )}
          </div>
        </div>
        {membersLoading ? (
          <div className="flex items-center justify-center min-h-[120px]">
            <LoadingSpinner size={24} />
          </div>
        ) : memberTab === 'members' ? (
          members.length === 0 ? (
            <div className="text-sm text-subtle">まだメンバーがいません。</div>
          ) : (
            <ul className="space-y-3">
              {sortedMembers.map(m => (
                <li key={m.id} className="flex items-center gap-2 min-w-0">
                  {m.icon_url ? (
                    <img src={m.icon_url} alt={m.display_name || m.username} className="w-8 h-8 rounded-full border border-subtle object-cover flex-shrink-0" />
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
                    {(village?.membership_role === 'owner' || village?.membership_role === 'admin_moderator') && (typeof m.score === 'number') && (
                      <div className="text-xs text-subtle mt-0.5">スコア: {m.score.toLocaleString()}</div>
                    )}
                  </div>
                  {(village?.membership_role === 'owner' || village?.membership_role === 'admin_moderator') && m.role !== 'owner' && (m.username_id || m.username) !== currentUsername && (
                    <div className="ml-auto relative inline-block">
                      <button
                        type="button"
                        className="w-7 h-7 inline-flex items-center justify-center rounded-md border-subtle/50 surface-1 hover:bg-white/5 opacity-60 hover:opacity-100 transition-opacity"
                        title="詳細"
                        onClick={(e) => { e.stopPropagation(); e.preventDefault();
                          if (memberMenuOpen === m.id && memberMenuMount) {
                            setMemberMenuVisible(false);
                            setTimeout(() => { setMemberMenuMount(false); setMemberMenuOpen(null); }, 150);
                          } else {
                            try {
                              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                              const spaceBelow = (typeof window !== 'undefined' ? window.innerHeight : 0) - rect.bottom;
                              setMemberMenuUp(spaceBelow < 220);
                            } catch {}
                            setMemberMenuOpen(m.id);
                            setMemberMenuMount(true);
                            requestAnimationFrame(() => setMemberMenuVisible(true));
                          }
                        }}
                      >
                        <span className="material-symbols-rounded text-sm text-subtle" aria-hidden>more_vert</span>
                      </button>
                      {memberMenuMount && memberMenuOpen === m.id && (
                        <div className={`absolute right-0 ${memberMenuUp ? 'bottom-full mb-1 origin-bottom-right' : 'top-full mt-1 origin-top-right'} min-w-44 rounded-md border border-subtle surface-1 shadow-lg z-30 transition-all duration-150 ease-out ${memberMenuVisible ? 'opacity-100 -translate-y-0 scale-100' : 'opacity-0 -translate-y-1 scale-95 pointer-events-none'}`}>
                          <button className="w-full text-left px-3 py-2 text-sm hover:bg-white/10 flex items-center gap-2" onClick={(e) => { e.stopPropagation(); e.preventDefault(); setMemberMenuVisible(false); setTimeout(() => { setMemberMenuMount(false); setMemberMenuOpen(null); }, 150);
                            // セキュリティ対策: JWTトークンはCookieから自動的に送信される
                            fetch(`${API}/api/communities/${village?.id}/members/${m.id}/promote/`, { method: 'POST', credentials: 'include' }).then(() => fetchMembers());
                          }}>
                            <span className="material-symbols-rounded" aria-hidden>shield_person</span>
                            <span>モデレーター任命</span>
                          </button>
                          {(village?.membership_role === 'owner') && (
                            <button className="w-full text-left px-3 py-2 text-sm hover:bg-white/10 flex items-center gap-2" onClick={(e) => { e.stopPropagation(); e.preventDefault(); setMemberMenuVisible(false); setTimeout(() => { setMemberMenuMount(false); setMemberMenuOpen(null); }, 150);
                              // セキュリティ対策: JWTトークンはCookieから自動的に送信される
                              fetch(`${API}/api/communities/${village?.id}/members/${m.id}/promote_admin/`, { method: 'POST', credentials: 'include' }).then(() => fetchMembers());
                            }}>
                              <span className="material-symbols-rounded" aria-hidden>build</span>
                              <span>管理モデ任命</span>
                            </button>
                          )}
                          <button className="w-full text-left px-3 py-2 text-sm hover:bg-white/10 flex items-center gap-2" onClick={(e) => { e.stopPropagation(); e.preventDefault(); setMemberMenuVisible(false); setTimeout(() => { setMemberMenuMount(false); setMemberMenuOpen(null); }, 150);
                            removeMember(m.id, m.username);
                          }}>
                            <span className="material-symbols-rounded" aria-hidden>person_remove</span>
                            <span>除名</span>
                          </button>
                          <button className="w-full text-left px-3 py-2 text-sm hover:bg-white/10 flex items-center gap-2" onClick={(e) => { e.stopPropagation(); e.preventDefault(); setMemberMenuVisible(false); setTimeout(() => { setMemberMenuMount(false); setMemberMenuOpen(null); }, 150);
                            blockMember(m.id, m.username);
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
          )
        ) : (
          village?.membership_role === 'owner' ? (
            blocked.length === 0 ? (
              <div className="text-sm text-subtle">ブロック中のユーザーはいません。</div>
            ) : (
              <ul className="space-y-3">
                {blocked.map(b => (
                  <li key={b.id} className="flex items-center gap-2 min-w-0">
                    {b.icon_url ? (
                      <img src={b.icon_url} alt={b.username} className="w-8 h-8 rounded-full border border-subtle object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-full border border-subtle surface-1 flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="text-sm truncate" title={b.username}>{b.username}</div>
                      {b.reason ? <div className="text-xs text-subtle truncate" title={b.reason}>理由: {b.reason}</div> : null}
                    </div>
                    <div className="ml-auto">
                      <button className="text-xs px-2 py-1 rounded-md border border-subtle surface-1 hover:bg-white/5" onClick={() => unblockUser(b.id)}>解除</button>
                    </div>
                  </li>
                ))}
              </ul>
            )
          ) : null
        )}
      </div>
    );
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
          localStorage.removeItem("accessUsername");
          setSignedIn(false);
          setCurrentUsername("");
          router.push("/");
        }}
      />

      {/* Community header removed from full width; shown inside main column below */}
      <main className="max-w-none mx-auto px-2 sm:px-2 md:px-3 py-6">
        <div className="mx-auto" style={{ maxWidth: vw >= 1200 ? 1200 : '100%' }}>
          {!id ? (
            <div className="text-center text-subtle py-8">アノニウムが見つかりません</div>
          ) : authLoading ? (
            <div className="text-center text-subtle py-8">読み込み中...</div>
          ) : (
          <div className="flex items-start gap-4 md:gap-6 min-w-0">
            <SidebarTabs
              open={sidebarOpen}
              current={tab}
              onChange={(v) => { setTab(v); localStorage.setItem('villageTab', v); }}
              setOpen={setSidebarOpen}
            />

            <section className="flex-1 min-w-0" style={{ maxWidth: vw >= 1200 ? 800 : 700 }}>
              <div className={`space-y-4 pr-1 ${vw < 500 ? 'pb-16' : ''}`}>
                {/* Community header inside main column */}
                {villageLoading ? (
                  <div className="rounded-lg border border-subtle surface-1 p-8 flex items-center justify-center">
                    <LoadingSpinner size={32} />
                  </div>
                ) : (
                <div className="rounded-lg border border-subtle surface-1 overflow-hidden">
          {village?.banner_url ? (
                <div className="relative w-full" style={{ aspectRatio: '7 / 2', minHeight: 120 }}>
                    <img src={village.banner_url} alt="banner" className="absolute inset-0 w-full h-full object-cover" />
            </div>
          ) : null}
                <div className="flex items-center justify-between gap-3 p-3 md:p-4">
                  <div className="flex items-center gap-3 md:gap-4">
            {village?.icon_url ? (
                      <img src={village.icon_url} alt="icon" className="w-16 h-16 md:w-20 md:h-20 object-cover rounded-full border border-subtle" />
            ) : (
                      <div className="w-16 h-16 md:w-20 md:h-20 rounded-full border border-subtle surface-1" />
            )}
                    <div>
                      <h1 className="text-xl md:text-2xl font-semibold leading-tight">{village?.name || id}</h1>
                      <div className="text-xs text-subtle mt-1">{village?.members_count ?? 0} メンバー</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
              {!joined ? (
                <button
                  className={`${vw <= 500 ? 'w-9 h-9 p-0' : 'px-3 py-1.5'} inline-flex items-center justify-center rounded-full bg-accent text-white hover:opacity-90 disabled:opacity-50`}
                  disabled={village?.join_policy !== 'open' && !signedIn}
                  onClick={async () => {
                    setStatusMsg("");
                    try {
                            // セキュリティ対策: JWTトークンはCookieから自動的に送信される
                            const res = await fetch(`${API}/api/communities/${id}/join/`, {
                              method: 'POST', 
                              credentials: 'include',
                            });
                      const dataText = await res.text();
                            if (res.status === 201) {
                              setJoined(true);
                              setStatusMsg('参加しました。');
                              // レスポンスがJSONの場合はis_memberを確認し、そうでない場合は再取得
                              try {
                                const data = JSON.parse(dataText);
                                if (typeof data.is_member === 'boolean') {
                                  setVillage(v => v ? { ...v, is_member: data.is_member, members_count: v.members_count + 1 } : v);
                                } else {
                                  // 参加成功後、少し待ってからコミュニティ情報を再取得して状態を更新（セッション情報の反映を待つ）
                                  // preserveJoinedState=true で、参加状態を保持しながら再取得
                                  setTimeout(async () => {
                                    await fetchVillage(true);
                                  }, 300);
                                }
                              } catch {
                                // JSONでない場合は再取得（preserveJoinedState=true で状態を保持）
                                setTimeout(async () => {
                                  await fetchVillage(true);
                                }, 300);
                              }
                            } else if (res.status === 202) {
                              setJoined(false);
                              setStatusMsg('参加申請を受け付けました。');
                            } else {
                              setStatusMsg(dataText || `エラー ${res.status}`);
                            }
                          } catch { setStatusMsg('参加に失敗しました。'); }
                  }}
                  title="参加"
                  aria-label="参加"
                >
                  <span className="material-symbols-rounded text-base" aria-hidden>person_add</span>
                  {vw > 500 && <span className="ml-1 text-sm">参加</span>}
                </button>
              ) : (
                <button
                  className={`${vw <= 500 ? 'w-9 h-9 p-0' : 'px-3 py-1.5'} inline-flex items-center justify-center rounded-full bg-white/10 hover:bg-white/15 disabled:opacity-50`}
                  disabled={village?.join_policy !== 'open' && !signedIn}
                  onClick={async () => {
                    setStatusMsg("");
                    try {
                            // セキュリティ対策: JWTトークンはCookieから自動的に送信される
                            const res = await fetch(`${API}/api/communities/${id}/leave/`, {
                              method: 'POST',
                              credentials: 'include',
                            });
                      const dataText = await res.text();
                            if (res.ok) {
                              setJoined(false);
                              setStatusMsg('退会しました。');
                              // レスポンスがJSONの場合はis_memberを確認し、そうでない場合は再取得
                              try {
                                const data = JSON.parse(dataText);
                                if (typeof data.is_member === 'boolean') {
                                  setVillage(v => v ? { ...v, is_member: data.is_member, members_count: v && v.members_count > 0 ? v.members_count - 1 : v.members_count } : v);
                                } else {
                                  // 離脱成功後、少し待ってからコミュニティ情報を再取得して状態を更新（セッション情報の反映を待つ）
                                  setTimeout(async () => {
                                    await fetchVillage();
                                  }, 300);
                                }
                              } catch {
                                // JSONでない場合は再取得
                                setTimeout(async () => {
                                  await fetchVillage();
                                }, 300);
                              }
                            } else {
                              setStatusMsg(dataText || `エラー ${res.status}`);
                            }
                          } catch { setStatusMsg('退会に失敗しました。'); }
                  }}
                  title="離脱"
                  aria-label="離脱"
                >
                  <span className="material-symbols-rounded text-base" aria-hidden>person_remove</span>
                  {vw > 500 && <span className="ml-1 text-sm">離脱</span>}
                </button>
              )}

                    <Link href={`/post?id=${id}`} className={`${vw <= 500 ? 'w-9 h-9 p-0' : 'px-3 py-1.5'} inline-flex items-center justify-center rounded-full border border-subtle surface-1 hover:bg-white/5`} title="投稿を作成" aria-label="投稿を作成">
                <span className="material-symbols-rounded text-base" aria-hidden>post_add</span>
                {vw > 500 && <span className="ml-1 text-sm">投稿</span>}
              </Link>

              {village?.membership_role === 'owner' || village?.membership_role === 'admin_moderator' ? (
                      <Link href={`/community/${id}/edit`} className={`${vw <= 500 ? 'w-9 h-9 p-0' : 'px-3 py-1.5'} inline-flex items-center justify-center rounded-full border border-subtle surface-1 hover:bg-white/5`} title="アノニウムの設定" aria-label="アノニウムの設定">
                  <span className="material-symbols-rounded text-base" aria-hidden>settings</span>
                  {vw > 500 && <span className="ml-1 text-sm">設定</span>}
                </Link>
              ) : null}

              <button
                className={`w-9 h-9 inline-flex items-center justify-center rounded-full border border-subtle ${favorite ? 'bg-white/10' : 'surface-1 hover:bg-white/5'}`}
                onClick={async () => {
                  // セキュリティ対策: JWTトークンはCookieから自動的に送信される
                  // 認証状態はAPIレスポンスで確認（401が返される場合）
                  const next = !favorite;
                  setStatusMsg('');
                  try {
                    const res = await fetch(`${API}/api/communities/${id}/favorite/`, {
                      method: next ? 'POST' : 'DELETE',
                      credentials: 'include',
                    });
                    if (res.ok) {
                      setFavorite(next);
                    } else {
                      const t = await res.text();
                      setStatusMsg(t || `お気に入り操作に失敗しました (${res.status})`);
                    }
                  } catch {
                    setStatusMsg('お気に入り操作に失敗しました。');
                  }
                }}
                title={favorite ? 'お気に入り解除' : 'お気に入り'}
                aria-label="お気に入り"
              >
                <span style={{ color: '#ffffff' }}>{favorite ? '★' : '☆'}</span>
              </button>
                  </div>
                </div>
                {statusMsg && (
                  <div className="px-3 md:px-4 pb-3 text-right text-xs text-subtle">{statusMsg}</div>
                )}
                {!joined && village && !signedIn && village.join_policy === 'login' && (
                  <div className="px-3 md:px-4 pb-3 text-sm text-subtle">
                    このアノニウムに参加するにはログインが必要です。
                  </div>
                )}
                {!joined && village && village.join_policy === 'approval' && (
                  <div className="px-3 md:px-4 pb-3 text-sm text-subtle">
                    このアノニウムは承認制です。参加ボタンで申請してください。
                  </div>
                )}
                {/* タグ（ヘッダー内・小さめ＆横スクロール + 追加ボタン） */}
                <div className="px-3 md:px-4 pb-2 border-t border-subtle pt-2">
                  {(Array.isArray(village?.tags) && village!.tags!.length > 0) || ((village?.tag_permission_scope === 'all' && village?.is_member) || village?.membership_role === 'owner' || village?.membership_role === 'admin_moderator' || village?.membership_role === 'moderator') ? (
                    <>
                      <div className="overflow-x-auto">
                        <div className="flex items-center gap-1.5 whitespace-nowrap">
                        {Array.isArray(village?.tags) && village!.tags!.map((t, i) => {
                            const bg = t.color || '#1e3a8a';
                            const fg = textColorFor(bg);
                          const active = tagFilter === t.name;
                          return (
                            <button
                              key={i}
                              type="button"
                              className={`inline-flex items-center text-[11px] px-1.5 py-0.5 rounded-full border ${active ? 'ring-2 ring-accent' : 'border-subtle'} hover:bg-white/5`}
                              style={{ backgroundColor: bg, color: fg }}
                              onClick={() => setTagFilter(active ? '' : t.name)}
                              title={active ? 'フィルタ解除' : 'このタグで絞り込み'}
                            >
                              {t.name}
                            </button>
                          );
                          })}
                          {((village?.tag_permission_scope === 'all' && village?.is_member) || village?.membership_role === 'owner' || village?.membership_role === 'admin_moderator' || village?.membership_role === 'moderator') && !newTagOpen && (
                            <button
                              className="inline-flex items-center justify-center text-[11px] w-6 h-6 rounded-full border border-subtle surface-1 hover:bg-white/5 flex-shrink-0"
                              onClick={() => setNewTagOpen(true)}
                              title="タグを追加"
                              aria-label="タグを追加"
                            >
                              <span className="material-symbols-rounded text-[14px]" aria-hidden>add</span>
                            </button>
                          )}
                        </div>
                      </div>
                      {((village?.tag_permission_scope === 'all' && village?.is_member) || village?.membership_role === 'owner' || village?.membership_role === 'admin_moderator' || village?.membership_role === 'moderator') && newTagOpen && (
                        <div className="flex items-center gap-2 mt-2">
                          <input
                            className="flex-1 rounded-md border border-subtle bg-transparent px-2 py-1 text-[12px]"
                            placeholder="タグ名"
                            value={newTagName}
                            onChange={(e) => setNewTagName(e.target.value)}
                          />
                          <input
                            type="color"
                            className="w-8 h-8 p-0 border border-subtle rounded cursor-pointer"
                            value={newTagColor}
                            onChange={(e) => setNewTagColor(e.target.value)}
                            title="色を選択"
                          />
                          <button
                            className="px-2.5 py-1 rounded-md border border-subtle surface-1 hover:bg-white/5 text-[12px]"
                            onClick={addTagQuickInline}
                          >追加</button>
                          <button
                            className="px-2 py-1 rounded-md border border-subtle surface-1 hover:bg-white/5 text-[12px]"
                            onClick={() => { setNewTagOpen(false); setNewTagName(""); setNewTagColor('#1e3a8a'); }}
                          >×</button>
                        </div>
                      )}
                    </>
                  ) : null}
                </div>
                </div>
                )}

                {/* Mobile sub tabs: posts / details */}
                {vw > 0 && vw <= 1000 && (
                  <div className="rounded-lg border border-subtle p-1 surface-1 flex items-center gap-1">
                    <button
                      className={`flex-1 px-3 py-1.5 rounded-md text-sm ${subTab==='posts' ? 'bg-white/10' : 'hover:bg-white/10'}`}
                      onClick={() => setSubTab('posts')}
                    >投稿</button>
                    <button
                      className={`flex-1 px-3 py-1.5 rounded-md text-sm ${subTab==='details' ? 'bg-white/10' : 'hover:bg-white/10'}`}
                      onClick={() => setSubTab('details')}
                    >詳細</button>
                  </div>
                )}

                {/* Posts filter (moved from header) */}
                {(vw > 1000 || subTab === 'posts') && (
                  <div className="flex items-center justify-end gap-2">
                    <label htmlFor="postFilter" className="text-xs text-subtle">フィルタ</label>
                    <select
                      id="postFilter"
                      className="rounded-md border border-subtle bg-transparent px-2 py-1 text-sm"
                      value={tab}
                      onChange={(e) => { const v = e.target.value; setTab(v); localStorage.setItem('villageTab', v); }}
                    >
                      <option value="trending">人気(勢い)</option>
                      <option value="score">高評価</option>
                      <option value="new">新しい</option>
                      <option value="old">古い</option>
                    </select>
                  </div>
                )}
                {(vw > 1000 || subTab === 'posts') && (
                  <>
                    {village?.visibility === 'private' && !village?.is_member ? (
                      <div className="rounded-lg border border-subtle p-6 surface-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="material-symbols-rounded text-lg" aria-hidden>lock</span>
                          <h3 className="text-sm font-medium">このアノニウムは非公開です</h3>
                        </div>
                        <p className="text-sm text-subtle">閲覧するにはアノニウムに参加してください。</p>
                      </div>
                    ) : loading && posts.length === 0 ? (
                      <div className="rounded-lg border border-subtle surface-1 p-8 flex items-center justify-center">
                        <LoadingSpinner size={32} />
                      </div>
                    ) : (() => {
                      const filtered = tagFilter ? posts.filter((p:any) => (p?.tag && p.tag.name === tagFilter)) : posts;
                      return filtered.length === 0 && !loading ? (
                      <div className="rounded-lg border border-subtle p-6 surface-1 text-subtle">No posts yet.</div>
                      ) : (
                      <>
                        {filtered.map((p:any) => (
                        <PostCard
                          key={p.id}
                          post={p}
                          inVillage={true}
                          onVoted={() => fetchPosts(true)}
                          showAuthor={false}
                          canModerate={village?.membership_role === 'owner' || village?.membership_role === 'admin_moderator'}
                          onDeleted={() => fetchPosts(true)}
                          community={village ? {
                            id: village.id,
                            is_member: village.is_member,
                            membership_role: village.membership_role,
                            clip_post_id: village.clip_post_id ?? null,
                            join_policy: village.join_policy,
                            karma: village.karma,
                          } : (p.community_id ? {
                            id: p.community_id,
                            is_member: p.community_is_member,
                            membership_role: p.community_membership_role ?? null,
                            clip_post_id: null,
                            join_policy: p.community_join_policy,
                            karma: p.community_karma,
                          } : null)}
                          currentUsername={currentUsername}
                          guestScore={guestScore}
                          isAuthenticated={signedIn}
                          />
                        ))}
                        {!tagFilter && nextPage && (
                          <div ref={observerTarget} className="py-4 text-center text-subtle text-sm">
                            {loading ? "読み込み中..." : ""}
                          </div>
                        )}
                        {!tagFilter && !nextPage && posts.length > 0 && (
                          <div className="py-4 text-center text-subtle text-sm">
                            すべての投稿を表示しました
                          </div>
                        )}
                      </>
                    ); })()}
                  </>
                )}

                {(vw <= 1000 && subTab === 'details') && (
                  <>
                    <div className="rounded-lg border border-subtle p-4 surface-1">
                      <h2 className="font-medium mb-3">ステータス</h2>
                      <ul className="text-sm space-y-2">
                        <li className="flex items-center gap-2">
                          <span className="material-symbols-rounded icon-faint" aria-hidden>public</span>
                          <span>
                            <span className="text-subtle">表示ポリシー: </span>
                            {village?.visibility === 'public' ? '公開' : '非公開'}
                          </span>
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="material-symbols-rounded icon-faint" aria-hidden>{village?.join_policy === 'open' ? 'group_add' : (village?.join_policy === 'approval' ? 'approval' : 'login')}</span>
                          <span>
                            <span className="text-subtle">参加ポリシー: </span>
                            {village?.join_policy === 'open' ? '誰でも参加可' : village?.join_policy === 'approval' ? '承認制' : 'ログイン必須'}
                          </span>
                        </li>
                                                <li className="flex items-center gap-2">
                          <span className="material-symbols-rounded icon-faint" aria-hidden>warning</span>
                          <span>
                            <span className="text-subtle">年齢制限: </span>
                            {village?.is_nsfw ? 'あり' : 'なし'}
                          </span>
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="material-symbols-rounded icon-faint" aria-hidden>share</span>
                          <span>
                            <span className="text-subtle">転載: </span>
                            {village?.allow_repost ? '許可' : '不可'}
                          </span>
                        </li>
                        {village?.join_policy === 'open' && (
                          <>
                            <li className="flex items-center gap-2">
                              <span className="material-symbols-rounded icon-faint" aria-hidden>how_to_vote</span>
                              <span>
                                <span className="text-subtle">ゲスト投票: </span>
                                {(() => {
                                  const requiredKarma = village?.karma || 0;
                                  // ログイン済みユーザーは常に許可
                                  if (signedIn) {
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
                            </li>
                            {village?.join_policy === 'open' && village?.karma !== 0 && (() => {
                              const requiredKarma = village?.karma || 0;
                              if (signedIn) {
                                return null; // ログイン済みユーザーには注釈不要
                              }
                              const userScore = guestScore ?? 0;
                              if (userScore < requiredKarma) {
                                return (
                                  <li className="flex items-start gap-2">
                                    <span className="material-symbols-rounded icon-faint text-xs mt-0.5" aria-hidden>info</span>
                                    <span className="text-xs text-subtle">
                                      より多くのいいねを集めると投票が解放されます。
                                    </span>
                                  </li>
                                );
                              }
                              return null;
                            })()}
                          </>
                        )}
                        {village?.created_at && (
                          <li className="flex items-center gap-2">
                            <span className="material-symbols-rounded icon-faint" aria-hidden>calendar_today</span>
                            <span>
                              <span className="text-subtle">作成日: </span>
                              {new Date(village.created_at).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
                            </span>
                          </li>
                        )}
                      </ul>
                      {village?.description && (
                        <div className="mt-3">
                       <div className="text-sm font-medium mb-1">説明</div>
                       <div className="text-sm text-subtle whitespace-pre-wrap">{village.description}</div>
              </div>
            )}
            {isAdmin && (
              <div className="mt-3 pt-3 border-t border-subtle">
                <Link 
                  href={`/v/${id}/chat`}
                  className="inline-flex items-center gap-2 text-sm text-white hover:underline"
                >
                  <span className="material-symbols-rounded text-base" aria-hidden>chat</span>
                  <span>グループチャット</span>
                </Link>
              </div>
            )}
          </div>
                 <RulesCard rules={village?.rules} />
                    {/* タグカード */}
                    <div className="rounded-lg border border-subtle p-4 surface-1">
                      <div className="flex items-center justify-between mb-3">
                        <h2 className="font-medium">タグ</h2>
                      </div>
                      {Array.isArray(village?.tags) && village!.tags!.length > 0 ? (
                        <div className="flex flex-wrap gap-2 items-center">
                          {village!.tags!.map((t, i) => {
                            const bg = t.color || '#1e3a8a';
                            const fg = textColorFor(bg);
                            return (
                              <span key={i} className="inline-flex items-center text-xs px-2 py-1 rounded-full border border-subtle" style={{ backgroundColor: bg, color: fg }}>
                                {t.name}
                              </span>
                            );
                          })}
                          {( (village?.tag_permission_scope === 'all' && village?.is_member) || village?.membership_role === 'owner' || village?.membership_role === 'admin_moderator' || village?.membership_role === 'moderator') && !newTagOpen && (
                            <button
                              className="inline-flex items-center justify-center text-xs px-2 py-1 rounded-full border border-subtle surface-1 hover:bg-white/5"
                              onClick={() => setNewTagOpen(true)}
                              title="タグを追加"
                            >
                              <span className="material-symbols-rounded" aria-hidden>add</span>
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="text-sm text-subtle">タグはまだありません。</div>
                          {( (village?.tag_permission_scope === 'all' && village?.is_member) || village?.membership_role === 'owner' || village?.membership_role === 'admin_moderator' || village?.membership_role === 'moderator') && !newTagOpen && (
                            <button
                              className="inline-flex items-center justify-center text-xs px-2 py-1 rounded-full border border-subtle surface-1 hover:bg-white/5"
                              onClick={() => setNewTagOpen(true)}
                              title="タグを追加"
                            >
                              <span className="material-symbols-rounded" aria-hidden>add</span>
                            </button>
                          )}
                        </div>
                      )}
                      {( (village?.tag_permission_scope === 'all' && village?.is_member) || village?.membership_role === 'owner' || village?.membership_role === 'admin_moderator' || village?.membership_role === 'moderator') && newTagOpen && (
                        <div className="flex items-center gap-2 mt-3">
                          <input
                            className="flex-1 rounded-md border border-subtle bg-transparent px-3 py-1.5 text-sm"
                            placeholder="タグ名"
                            value={newTagName}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (value.length <= 15) setNewTagName(value);
                            }}
                            maxLength={15}
                          />
                          <input
                            type="color"
                            className="w-10 h-10 p-0 border border-subtle rounded cursor-pointer"
                            value={newTagColor}
                            onChange={(e) => setNewTagColor(e.target.value)}
                            title="色を選択"
                          />
                          <button
                            className="px-3 py-1.5 rounded-md border border-subtle surface-1 hover:bg-white/5 text-sm"
                            onClick={addTagQuickInline}
                          >追加</button>
                          <button
                            className="px-2 py-1.5 rounded-md border border-subtle surface-1 hover:bg-white/5 text-xs"
                            onClick={() => { setNewTagOpen(false); setNewTagName(""); setNewTagColor('#1e3a8a'); }}
                          >×</button>
                        </div>
                      )}
                    </div>
                    {/* モデレーターカード（共通化） */}
                    <ModeratorListCard />
                    {/* メンバーカード（共通化） */}
                    <MembersListCard />
                  </>
                )}
              </div>
            </section>

             {(vw > 1000) && (
               <aside className="hidden md:block space-y-4" style={{ width: asideWidth, maxWidth: 300 }}>
                 {villageLoading ? (
                   <div className="rounded-lg border border-subtle p-4 surface-1 flex items-center justify-center min-h-[200px]">
                     <LoadingSpinner size={24} />
                   </div>
                 ) : (
                   <>
                     <div className="rounded-lg border border-subtle p-4 surface-1">
                       <h2 className="font-medium mb-3">ステータス</h2>
                       <ul className="text-sm space-y-2">
                         <li className="flex items-center gap-2">
                           <span className="material-symbols-rounded icon-faint" aria-hidden>public</span>
                           <span>
                             <span className="text-subtle">表示ポリシー: </span>
                             {village?.visibility === 'public' ? '公開' : '非公開'}
                           </span>
                         </li>
                         <li className="flex items-center gap-2">
                           <span className="material-symbols-rounded icon-faint" aria-hidden>{village?.join_policy === 'open' ? 'group_add' : (village?.join_policy === 'approval' ? 'approval' : 'login')}</span>
                           <span>
                             <span className="text-subtle">参加ポリシー: </span>
                             {village?.join_policy === 'open' ? '誰でも参加可' : village?.join_policy === 'approval' ? '承認制' : 'ログイン必須'}
                           </span>
                         </li>
                         <li className="flex items-center gap-2">
                           <span className="material-symbols-rounded icon-faint" aria-hidden>warning</span>
                           <span>
                             <span className="text-subtle">年齢制限: </span>
                             {village?.is_nsfw ? 'あり' : 'なし'}
                           </span>
                         </li>
                         <li className="flex items-center gap-2">
                           <span className="material-symbols-rounded icon-faint" aria-hidden>share</span>
                           <span>
                             <span className="text-subtle">転載: </span>
                             {village?.allow_repost ? '許可' : '不可'}
                           </span>
                         </li>
                         {village?.join_policy === 'open' && (
                           <>
                             <li className="flex items-center gap-2">
                               <span className="material-symbols-rounded icon-faint" aria-hidden>how_to_vote</span>
                               <span>
                                 <span className="text-subtle">ゲスト投票: </span>
                                 {(() => {
                                   const requiredKarma = village?.karma || 0;
                                   // ログイン済みユーザーは常に許可
                                   if (signedIn) {
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
                             </li>
                             {village?.join_policy === 'open' && village?.karma !== 0 && (() => {
                               const requiredKarma = village?.karma || 0;
                               if (signedIn) {
                                 return null; // ログイン済みユーザーには注釈不要
                               }
                               const userScore = guestScore ?? 0;
                               if (userScore < requiredKarma) {
                                 return (
                                   <li className="flex items-start gap-2">
                                     <span className="material-symbols-rounded icon-faint text-xs mt-0.5" aria-hidden>info</span>
                                     <span className="text-xs text-subtle">
                                       より多くのいいねを集めると投票が解放されます。
                                     </span>
                                   </li>
                                 );
                               }
                               return null;
                             })()}
                           </>
                         )}
                         {village?.created_at && (
                           <li className="flex items-center gap-2">
                             <span className="material-symbols-rounded icon-faint" aria-hidden>calendar_today</span>
                             <span>
                               <span className="text-subtle">作成日: </span>
                               {new Date(village.created_at).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
                             </span>
                           </li>
                         )}
                       </ul>
                       {village?.description && (
                         <div className="mt-3">
                           <div className="text-sm font-medium mb-1">説明</div>
                           <div className="text-sm text-subtle whitespace-pre-wrap">{village.description}</div>
                         </div>
                       )}
                       {isAdmin && (
                         <div className="mt-3 pt-3 border-t border-subtle">
                           <Link 
                             href={`/v/${id}/chat`}
                             className="inline-flex items-center gap-2 text-sm text-white hover:underline"
                           >
                             <span className="material-symbols-rounded text-base" aria-hidden>chat</span>
                             <span>グループチャット</span>
                           </Link>
                         </div>
                       )}
                     </div>
                     <RulesCard rules={village?.rules} />
                     {/* モデレーターカード（共通化） */}
                     <ModeratorListCard />
                     {/* 参加申請カード - オーナーのみ、join_policyがapprovalの場合 */}
                     {village?.membership_role === 'owner' && village?.join_policy === 'approval' && (
                       <div className="rounded-lg border border-subtle p-4 surface-1">
                         <div className="flex items-center justify-between mb-3">
                           <h2 className="font-medium">参加申請</h2>
                           <button className="text-xs px-2 py-1 rounded-md border border-subtle surface-1 hover:bg-white/5" onClick={fetchPendingRequests}>更新</button>
                         </div>
                         {pendingRequests.length === 0 ? (
                           <div className="text-sm text-subtle">参加申請はありません。</div>
                         ) : (
                           <ul className="space-y-3">
                             {pendingRequests.map(pr => (
                               <li key={pr.id} className="flex items-center gap-2 min-w-0">
                                 {pr.icon_url ? (
                                   <img src={pr.icon_url} alt={pr.username} className="w-8 h-8 rounded-full border border-subtle object-cover flex-shrink-0" />
                                 ) : (
                                   <div className="w-8 h-8 rounded-full border border-subtle surface-1 flex-shrink-0" />
                                 )}
                                 <span className="text-sm truncate flex-1" title={pr.username}>{pr.username}</span>
                                 <div className="flex items-center gap-1 flex-shrink-0">
                                   <button
                                     className="text-xs px-2 py-1 rounded-md bg-accent text-white hover:opacity-90"
                                     onClick={() => approveRequest(pr.id)}
                                     title="承認"
                                   >
                                     承認
                                   </button>
                                   <button
                                     className="text-xs px-2 py-1 rounded-md border border-subtle surface-1 hover:bg-white/5"
                                     onClick={() => rejectRequest(pr.id, pr.username)}
                                     title="拒否"
                                   >
                                     拒否
                                   </button>
                                 </div>
                               </li>
                             ))}
                           </ul>
                         )}
                       </div>
                     )}
                     {/* メンバーカード（共通化） */}
                     <MembersListCard />
                   </>
                 )}
               </aside>
             )}
          </div>
          )}
        </div>
      </main>
      {vw > 0 && vw < 500 && (
        <MobileNav current={tab} onChange={(v) => { setTab(v); localStorage.setItem('villageTab', v); }} />
      )}
      <CreateFab />
    </div>
  );
}
