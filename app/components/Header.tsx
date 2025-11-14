"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "../utils/authContext";

type HeaderProps = {
  signedIn?: boolean;
  onLogin?: () => void;
  onLogout?: () => void;
};

type Notification = {
  id: number;
  notification_type: string;
  notification_type_display: string;
  actor_username: string;
  actor_icon_url: string;
  post_id: number | null;
  post_title: string;
  comment_id: number | null;
  comment_body: string;
  community_slug: string | null;
  community_name: string;
  link: string;
  is_read: boolean;
  created_at: string;
};

// Createボタンコンポーネント（デスクトップ版）
function CreateButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [authChecked, setAuthChecked] = useState<boolean>(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
  
  // 投稿作成ページではスレッド作成ボタンを非表示
  const isPostDetailPage = pathname?.startsWith("/p/");
  const showCreatePost = !isPostDetailPage;
  
  // 認証状態を確認
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch(`${API}/api/accounts/me/`, {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          const isGuest = data.is_guest || (data.username && data.username.startsWith('Anonium-'));
          setIsAuthenticated(!isGuest && data.username && !data.username.startsWith('Anonium-'));
        } else {
          setIsAuthenticated(false);
        }
      } catch {
        setIsAuthenticated(false);
      } finally {
        setAuthChecked(true);
      }
    }
    checkAuth();
  }, [API]);
  
  // メニュー外をクリックしたら閉じる
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [isOpen]);
  
  // モーダルが開いている時はスクロールを無効化
  useEffect(() => {
    if (isModalOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isModalOpen]);
  
  if (!authChecked) {
    return null;
  }
  
  return (
    <>
      <div className="relative hidden md:block" ref={menuRef}>
        {/* 展開メニュー */}
        <div 
          className={`absolute right-0 top-full mt-2 flex flex-col gap-2 transition-all duration-200 ease-out min-w-[160px] z-[51] ${
            isOpen 
              ? 'opacity-100 translate-y-0 pointer-events-auto' 
              : 'opacity-0 translate-y-2 pointer-events-none'
          }`}
        >
          {showCreatePost && (
            <Link
              href="/post"
              className="flex items-center gap-3 px-4 py-3 bg-black/95 backdrop-blur-sm border border-subtle rounded-lg shadow-lg hover:bg-white/10 transition-colors"
              onClick={() => setIsOpen(false)}
            >
              <span className="material-symbols-rounded text-lg">edit</span>
              <span className="text-sm font-medium">スレッドを作成</span>
            </Link>
          )}
          {isAuthenticated && (
            <Link
              href="/community/new"
              className="flex items-center gap-3 px-4 py-3 bg-black/95 backdrop-blur-sm border border-subtle rounded-lg shadow-lg hover:bg-white/10 transition-colors"
              onClick={() => setIsOpen(false)}
            >
              <span className="material-symbols-rounded text-lg">add_circle</span>
              <span className="text-sm font-medium">アノニウムを作成</span>
            </Link>
          )}
          <Link
            href="/about"
            className="flex items-center justify-center gap-2 px-3 py-2 text-xs text-subtle hover:text-white border border-subtle rounded-lg hover:bg-white/5 transition-colors bg-black/95 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          >
            <span className="material-symbols-rounded text-sm">help_outline</span>
            <span>アノニウムの使い方</span>
          </Link>
        </div>
        
        {/* メインボタン */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`w-9 h-9 rounded-md bg-accent text-white hover:bg-accent/90 transition-all duration-200 flex items-center justify-center ${
            isOpen ? "rotate-45" : "rotate-0"
          }`}
          aria-label="作成メニュー"
          aria-expanded={isOpen}
        >
          <span className="material-symbols-rounded text-xl">
            {isOpen ? "close" : "add"}
          </span>
        </button>
      </div>
      
      {/* モーダル */}
      {isModalOpen && (
        <>
          {/* オーバーレイ */}
          <div
            className="fixed inset-0 bg-black/60 z-[70]"
            onClick={() => setIsModalOpen(false)}
          />
          {/* モーダルコンテンツ */}
          <div className="fixed inset-0 z-[71] flex items-center justify-center p-4">
            <div
              className="bg-black border border-subtle rounded-lg shadow-lg max-w-md w-full p-6 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">アノニウムとは</h2>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-subtle hover:text-white transition-colors"
                  aria-label="閉じる"
                >
                  <span className="material-symbols-rounded">close</span>
                </button>
              </div>
              <div className="space-y-3 text-sm">
                <p className="text-white">
                  このサービスではユーザはアノニウムというコミュニティを作成できます。
                </p>
                <p className="text-subtle">
                  Anonium(アノニウム)はインターネットの匿名性を構成する元素という意味で、アノニマス(anonymous : 匿名)と元素(~ium)から取った言葉です。
                </p>
                <p className="text-subtle">
                  このサービスは基本的に原則匿名であり、我々はインターネットを構成する匿名性の元素の集合体なのです。
                </p>
                <div className="pt-2 border-t border-subtle">
                  <Link
                    href="/about"
                    onClick={() => setIsModalOpen(false)}
                    className="inline-flex items-center gap-2 text-accent hover:text-accent/80 transition-colors"
                  >
                    <span className="material-symbols-rounded text-base" style={{ fontSize: 16 }}>help_outline</span>
                    <span>アノニウムの使い方を見る</span>
                  </Link>
                </div>
              </div>
              <div className="flex justify-end pt-4">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors"
                >
                  閉じる
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

export default function Header({ signedIn: propSignedIn, onLogin: propOnLogin, onLogout: propOnLogout }: HeaderProps) {
  const { signedIn: contextSignedIn, checkAuth } = useAuth();
  // propsが提供されている場合はそれを優先、 otherwise コンテキストから取得
  const signedIn = propSignedIn !== undefined ? propSignedIn : contextSignedIn;
  
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement | null>(null);
  const [me, setMe] = useState<{ username: string; display_name?: string; icon_url?: string; score?: number } | null>(null);
  const [guestName, setGuestName] = useState<string>("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationTab, setNotificationTab] = useState<'all' | 'replies' | 'reports'>('all');
  const API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [searchTerm, setSearchTerm] = useState<string>("");

  // ログアウト処理（認証コンテキストを更新）
  const handleLogout = async () => {
    if (propOnLogout) {
      propOnLogout();
    } else {
      // デフォルトのログアウト処理
      try {
        await fetch(`${API}/api/accounts/logout/`, {
          method: 'POST',
          credentials: 'include',
        });
      } catch (err) {
        console.error('Logout error:', err);
      }
      await checkAuth();
    }
  };

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(e.target as Node)) {
        setNotificationOpen(false);
      }
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setNotificationOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, []);

  const fetchMe = useCallback(async () => {
    // セキュリティ対策: JWTトークンとゲストトークンはCookieのみで送信
    // credentials: 'include'により、Cookieが自動的に送信される
    // Authorizationヘッダーは不要（後方互換性のためバックエンドでサポートされているが、使用しない）
    try {
      const res = await fetch(`${API}/api/accounts/me/`, { 
        credentials: 'include'
      });
      if (!res.ok) { 
        setMe(null); 
        return; 
      }
      const data = await res.json();
      if (data && data.username) {
        setMe({ username: data.username, display_name: data.display_name, icon_url: data.icon_url, score: data.score || 0 });
        try { 
          localStorage.setItem('accessUsername', data.username);
          // ゲストユーザーの場合（Anonium-で始まる場合）、guestNameも設定
          if (data.username.startsWith('Anonium-')) {
            setGuestName(data.username);
            // セキュリティ対策: ゲスト名のみlocalStorageに保存（トークンは保存しない）
            localStorage.setItem('guestUsername', data.username);
          }
        } catch {}
      }
    } catch {
      setMe(null);
    }
  }, [API]);

  // コンポーネントマウント時にlocalStorageからゲスト名を読み込む（トークンはCookieから自動取得）
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const storedUsername = localStorage.getItem('guestUsername');
      // セキュリティ対策: ゲスト名のみlocalStorageから読み込む（トークンは読み込まない）
      if (storedUsername && /^Anonium-/.test(storedUsername)) {
        setGuestName(storedUsername);
      }
    } catch (err) {
      console.error('Failed to load guest name from localStorage:', err);
    }
  }, []);

  useEffect(() => {
    // ログインしている場合のみfetchMeを実行（ゲストの場合は後で実行）
    if (signedIn) {
      fetchMe();
    }
    
    // localStorageの変更を監視
    function handleStorageChange(e: StorageEvent) {
      if (e.key === 'accessToken') {
        fetchMe();
      }
    }
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [fetchMe, signedIn]);

  useEffect(() => {
    if (!searchParams) return;
    const q = searchParams.get("q") || "";
    if (pathname === "/search") {
      setSearchTerm((prev) => (prev === q ? prev : q));
    }
  }, [pathname, searchParams]);

  // 未読通知数を取得
  const fetchUnreadCount = useCallback(async () => {
    if (!signedIn) return;
    // セキュリティ対策: JWTトークンはCookieから自動的に送信される
    try {
      const res = await fetch(`${API}/api/accounts/notifications/unread-count/`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.unread_count || 0);
      }
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    }
  }, [signedIn, API]);

  // 通知一覧を取得
  const fetchNotifications = useCallback(async () => {
    if (!signedIn) return;
    // セキュリティ対策: JWTトークンはCookieから自動的に送信される
    setNotificationsLoading(true);
    try {
      const res = await fetch(`${API}/api/accounts/notifications/?limit=20`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data || []);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setNotificationsLoading(false);
    }
  }, [signedIn, API]);

  // リロード時（コンポーネントマウント時）のみ未読通知数を取得
  useEffect(() => {
    if (!signedIn) return;
    fetchUnreadCount();
  }, [signedIn, fetchUnreadCount]);

  // 通知ドロップダウンを開いたときに通知一覧を取得し、全て既読にする
  useEffect(() => {
    if (notificationOpen && signedIn) {
      // セキュリティ対策: JWTトークンはCookieから自動的に送信される
      // 通知ボックスを開いたときに全て既読にする
      fetch(`${API}/api/accounts/notifications/mark-all-read/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      }).then(res => {
        if (res.ok) {
          setUnreadCount(0);
        }
      }).catch(error => {
        console.error('Failed to mark notifications as read:', error);
      }).finally(() => {
        // 既読化リクエストの後、通知一覧を取得（既読状態が反映される）
        fetchNotifications();
      });
    } else if (!notificationOpen) {
      // 通知ボックスを閉じたときにタブをリセット
      setNotificationTab('all');
    }
  }, [notificationOpen, signedIn, fetchNotifications, API]);

  // ゲストユーザーの場合、トークンを取得してme情報を取得
  useEffect(() => {
    if (signedIn) return;
    
    let mounted = true;
    let hasFetched = false;
    
    // サーバーからゲストトークンを取得（Cookieで自動保存される）
    const fetchGuestToken = async () => {
      if (hasFetched) return;
      hasFetched = true;
      
      // まず、/api/accounts/me/を呼び出して、JWTトークンがあるか確認
      try {
        const meRes = await fetch(`${API}/api/accounts/me/`, { credentials: 'include' });
        if (meRes.ok) {
          const meData = await meRes.json().catch(() => null);
          // JWTトークンがある場合（ゲストユーザーでない場合）は、ゲストトークンを発行しない
          if (meData && !meData.is_guest && meData.username && !meData.username.startsWith('Anonium-')) {
            // ログイン済みユーザーの場合、ゲストトークンは発行しない
            return;
          }
        }
      } catch {
        // エラーが発生した場合は続行
      }
      
      try {
        const res = await fetch(`${API}/api/accounts/guest/issue/`, { method: 'POST', credentials: 'include' });
        if (res.ok && mounted) {
          const data = await res.json().catch(() => null);
          const gid = data && typeof data.gid === 'string' ? data.gid : '';
          
          if (gid) {
            const uname = `Anonium-${gid}`;
            try { 
              // セキュリティ対策: ゲスト名のみlocalStorageに保存（トークンはCookieのみ）
              localStorage.setItem('guestUsername', uname);
              setGuestName(uname);
              
              // ゲストトークンはCookieに自動保存されるため、localStorageには保存しない
              // 少し遅延してからme情報を取得（Cookieが確実に設定されるまで待つ）
              setTimeout(() => {
                if (mounted) {
                  fetchMe();
                }
              }, 100);
            } catch (err) {
              console.error('Failed to save guest name:', err);
              // エラーが発生してもme情報を取得
              if (mounted) {
                fetchMe();
              }
            }
          } else {
            // gidが取得できなかった場合、Cookieからme情報を取得
            if (mounted) {
              fetchMe();
            }
          }
        } else if (mounted) {
          // リクエストが失敗した場合、Cookieからme情報を取得
          fetchMe();
        }
      } catch (err) {
        console.error('Failed to fetch guest token:', err);
        // エラーが発生した場合でも、Cookieからme情報を取得を試みる
        if (mounted) {
          fetchMe();
        }
      }
    };
    
    // 既にゲスト名がある場合はすぐに表示、なければ取得
    if (!guestName) {
      const existingUsername = localStorage.getItem('guestUsername');
      if (existingUsername && /^Anonium-/.test(existingUsername)) {
        setGuestName(existingUsername);
      }
    }
    
    // ゲストトークンを取得（Cookieで自動保存される）
    fetchGuestToken();
    
    return () => {
      mounted = false;
    };
  }, [signedIn, API, fetchMe, guestName]);

  function handleSearchSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const term = searchTerm.trim();
    const query = term ? `?q=${encodeURIComponent(term)}` : "";
    router.push(`/search${query}`);
  }

  return (
    <header className="bg-black text-white border-b border-subtle sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center gap-3">
        <div className="flex items-center gap-3 flex-shrink-0">
          <Link href="/" className="flex flex-col items-center leading-tight">
            <span className="font-semibold tracking-wide whitespace-nowrap text-center">
              Anonium
            </span>
            <span className="text-xs text-subtle whitespace-nowrap text-center">
              インターネットの匿名元素
            </span>
          </Link>
        </div>
        <div className="flex-1 flex justify-center min-w-0">
          <form
            onSubmit={handleSearchSubmit}
            className="hidden md:flex w-full max-w-xl"
            role="search"
          >
            <label htmlFor="global-search" className="sr-only">
              アノニウムを検索
            </label>
            <div className="flex items-center w-full gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 shadow-inner">
              <span className="material-symbols-rounded text-subtle text-base" aria-hidden>
                search
              </span>
              <input
                id="global-search"
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="検索(準備中)"
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-subtle/70 focus:outline-none"
                autoComplete="off"
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 transition-colors"
                aria-label="検索(準備中)"
              >
                <span className="material-symbols-rounded text-[18px]" aria-hidden>
                  search
                </span>
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                aria-label="音声入力 (モック)"
              >
                <span className="material-symbols-rounded text-[18px]" aria-hidden>
                  mic
                </span>
              </button>
            </div>
          </form>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => router.push("/search")}
            className="md:hidden inline-flex items-center justify-center w-9 h-9 rounded-full border border-subtle surface-1 text-subtle"
            aria-label="検索ページへ"
          >
            <span className="material-symbols-rounded">search</span>
          </button>
          {/* Createボタン（デスクトップ版） */}
          <CreateButton />
          {signedIn && (
            <div className="relative" ref={notificationRef}>
              <button
                className="relative px-2.5 py-1.5 rounded-md bg-white/10 hover:bg-white/15 flex items-center justify-center"
                onClick={() => setNotificationOpen((v) => !v)}
                aria-label="通知"
                aria-expanded={notificationOpen}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute top-0 right-0 bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center transform translate-x-1/2 -translate-y-1/2">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              {notificationOpen && (
                <div
                  className="absolute right-0 mt-2 w-72 sm:w-96 md:w-[28rem] rounded-md bg-black shadow-lg z-50 max-h-[36rem] sm:max-h-[32rem] md:max-h-[48rem] flex flex-col"
                  role="menu"
                >
                  <div className="px-4 py-3 border-b border-gray-600/50 flex items-center justify-between flex-shrink-0">
                    <h3 className="font-semibold text-sm">通知</h3>
                  </div>
                  {/* タブ */}
                  <div className="flex border-b border-gray-600/50 flex-shrink-0">
                    {(() => {
                      // 各タブの未読数を計算
                      const repliesUnreadCount = notifications.filter(
                        (n) => !n.is_read && ['comment_reply', 'post_comment', 'followed_post_comment'].includes(n.notification_type)
                      ).length;
                      const reportsUnreadCount = notifications.filter(
                        (n) => !n.is_read && n.notification_type === 'report_created'
                      ).length;

                      return (
                        <>
                          <button
                            onClick={() => setNotificationTab('all')}
                            className={`flex-1 px-4 py-2 text-xs font-medium transition-colors relative ${
                              notificationTab === 'all'
                                ? 'text-blue-400 border-b-2 border-blue-400'
                                : 'text-gray-400 hover:text-gray-300'
                            }`}
                          >
                            すべて
                            {unreadCount > 0 && (
                              <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-4.5 px-1.5 text-[10px] font-bold text-white bg-red-500 rounded-full">
                                {unreadCount > 9 ? '9+' : unreadCount}
                              </span>
                            )}
                          </button>
                          <button
                            onClick={() => setNotificationTab('replies')}
                            className={`flex-1 px-4 py-2 text-xs font-medium transition-colors relative ${
                              notificationTab === 'replies'
                                ? 'text-blue-400 border-b-2 border-blue-400'
                                : 'text-gray-400 hover:text-gray-300'
                            }`}
                          >
                            返信
                            {repliesUnreadCount > 0 && (
                              <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-4.5 px-1.5 text-[10px] font-bold text-white bg-red-500 rounded-full">
                                {repliesUnreadCount > 9 ? '9+' : repliesUnreadCount}
                              </span>
                            )}
                          </button>
                          <button
                            onClick={() => setNotificationTab('reports')}
                            className={`flex-1 px-4 py-2 text-xs font-medium transition-colors relative ${
                              notificationTab === 'reports'
                                ? 'text-blue-400 border-b-2 border-blue-400'
                                : 'text-gray-400 hover:text-gray-300'
                            }`}
                          >
                            報告
                            {reportsUnreadCount > 0 && (
                              <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-4.5 px-1.5 text-[10px] font-bold text-white bg-red-500 rounded-full">
                                {reportsUnreadCount > 9 ? '9+' : reportsUnreadCount}
                              </span>
                            )}
                          </button>
                        </>
                      );
                    })()}
                  </div>
                  <div className="divide-y divide-gray-600/50 overflow-y-auto flex-1">
                    {notificationsLoading ? (
                      <div className="px-4 py-8 text-center text-sm text-gray-400">
                        読み込み中...
                      </div>
                    ) : (() => {
                      // タブに応じて通知をフィルタリング
                      const filteredNotifications = notifications.filter((notification) => {
                        if (notificationTab === 'all') return true;
                        if (notificationTab === 'replies') {
                          return ['comment_reply', 'post_comment', 'followed_post_comment'].includes(notification.notification_type);
                        }
                        if (notificationTab === 'reports') {
                          return notification.notification_type === 'report_created';
                        }
                        return true;
                      });

                      if (filteredNotifications.length === 0) {
                        return (
                          <div key="empty" className="px-4 py-8 text-center text-sm text-gray-400">
                            {notificationTab === 'all' && '通知はありません'}
                            {notificationTab === 'replies' && '返信の通知はありません'}
                            {notificationTab === 'reports' && '報告の通知はありません'}
                          </div>
                        );
                      }

                      return filteredNotifications.map((notification) => {
                        // 通知メッセージを生成
                        let message = '';
                        if (notification.notification_type === 'post_comment') {
                          message = `${notification.actor_username}さんがあなたの投稿にコメントしました`;
                        } else if (notification.notification_type === 'followed_post_comment') {
                          message = `フォローしたスレッドにコメントがつきました`;
                        } else if (notification.notification_type === 'comment_reply') {
                          message = `${notification.actor_username}さんがあなたのコメントに返信しました`;
                        } else if (notification.notification_type === 'comment_deleted') {
                          message = 'あなたのコメントが削除されました';
                        } else if (notification.notification_type === 'admin_notification') {
                          message = '運営からのお知らせ';
                        } else if (notification.notification_type === 'report_created') {
                          message = `${notification.actor_username}さんが報告を投稿しました`;
                        } else {
                          message = notification.notification_type_display;
                        }

                        // 時間をフォーマット
                        const timeAgo = (dateString: string) => {
                          const date = new Date(dateString);
                          const now = new Date();
                          const diffMs = now.getTime() - date.getTime();
                          const diffMins = Math.floor(diffMs / 60000);
                          const diffHours = Math.floor(diffMs / 3600000);
                          const diffDays = Math.floor(diffMs / 86400000);
                          
                          if (diffMins < 1) return 'たった今';
                          if (diffMins < 60) return `${diffMins}分前`;
                          if (diffHours < 24) return `${diffHours}時間前`;
                          if (diffDays < 7) return `${diffDays}日前`;
                          return date.toLocaleDateString('ja-JP');
                        };

                        return (
                          <div
                            key={notification.id}
                            className={`px-4 py-3 hover:bg-white/5 cursor-pointer ${
                              !notification.is_read ? "bg-white/5" : ""
                            }`}
                            onClick={() => {
                              // 通知をクリックしたらリンクに遷移
                              if (notification.link) {
                                router.push(notification.link);
                                setNotificationOpen(false);
                              } else if (notification.post_id) {
                                // フォールバック: linkがない場合はpost_idを使用
                                router.push(`/p/${notification.post_id}`);
                                setNotificationOpen(false);
                              }
                            }}
                          >
                            <div className="flex items-start gap-2">
                              {notification.actor_icon_url && (
                                <img
                                  src={notification.actor_icon_url}
                                  alt={notification.actor_username}
                                  className="w-8 h-8 rounded-full border border-subtle object-cover flex-shrink-0"
                                />
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm">{message}</p>
                                {notification.community_name && notification.notification_type === 'report_created' && (
                                  <p className="text-xs text-gray-500 mt-1 truncate">
                                    {notification.community_name}
                                  </p>
                                )}
                                {notification.post_title && (
                                  <p className="text-xs text-gray-500 mt-1 truncate">
                                    {notification.post_title}
                                  </p>
                                )}
                                {notification.comment_body && (
                                  <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                                    {notification.comment_body}
                                  </p>
                                )}
                                <p className="text-xs text-gray-400 mt-1">
                                  {timeAgo(notification.created_at)}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                  {notifications.length > 0 && (
                    <div className="px-4 py-3 border-t border-gray-600/50 text-center">
                      <button
                        className="text-sm text-blue-400 hover:text-blue-300"
                        onClick={() => {
                          // 通知一覧ページに遷移（将来的に実装）
                          router.push('/notifications');
                        }}
                      >
                        すべての通知を表示
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          <div className="relative" ref={menuRef}>
            {signedIn && me ? (
              <button
                className="w-9 h-9 rounded-full border border-subtle bg-white/10 hover:bg-white/15 flex items-center justify-center"
                onClick={() => setMenuOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                title={me.username}
              >
                {me.icon_url ? (
                  <img src={me.icon_url} alt={me.username} className="w-8 h-8 rounded-full border border-subtle object-cover" />
                ) : (
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/20 text-lg">👤</span>
                )}
              </button>
            ) : (
              <button
                className="w-9 h-9 rounded-full border border-subtle bg-white/10 hover:bg-white/15 flex items-center justify-center"
                onClick={() => setMenuOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                title={guestName || 'ゲスト'}
              >
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/20 text-[11px] font-medium text-white/80">
                  G
                </span>
              </button>
            )}
            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-2 min-w-[13rem] rounded-md border border-subtle bg-black shadow-lg z-50"
              >
                {signedIn && me && (
                  <Link
                    href="/u"
                    className="block px-3 py-3 border-b border-subtle hover:bg-white/5"
                    onClick={() => setMenuOpen(false)}
                  >
                    <div className="flex items-center gap-2">
                      {me.icon_url ? (
                        <img src={me.icon_url} alt={me.username} className="w-10 h-10 rounded-full border border-subtle object-cover flex-shrink-0" />
                      ) : (
                        <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-white/20 text-lg flex-shrink-0">👤</span>
                      )}
                      <div className="flex-1 min-w-0">
                        {me.display_name ? (
                          <>
                            <p className="text-base font-semibold truncate">{me.display_name}</p>
                            <p className="text-xs text-subtle truncate">{me.username}</p>
                          </>
                        ) : (
                          <p className="text-base font-semibold truncate">{me.username}</p>
                        )}
                        <p className="text-xs text-subtle truncate">スコア: {me.score ?? 0}</p>
                      </div>
                    </div>
                  </Link>
                )}
                {!signedIn && (
                  <>
                    <Link
                      href="/u"
                      className="block px-3 py-3 border-b border-subtle hover:bg-white/5"
                      onClick={() => setMenuOpen(false)}
                    >
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-white/20 text-[11px] font-medium text-white/80 flex-shrink-0">
                        G
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-semibold truncate">ゲスト</p>
                        <p className="text-xs text-subtle truncate">{guestName || 'Anonium-???????'}</p>
                        {me && (
                          <p className="text-xs text-subtle truncate">スコア: {me.score ?? 0}</p>
                        )}
                      </div>
                    </div>
                    </Link>
                    <div className="px-3 py-3 border-b border-subtle space-y-2">
                      <p className="text-xs text-subtle leading-relaxed">
                        登録すると全ての機能が利用できます。
                      </p>
                      <p className="text-xs text-subtle leading-relaxed">
                        登録なしでも許可されたアノニウムでは自由にコメントできます。
                      </p>
                  </div>
                  </>
                )}
                {signedIn && (
                  <>
                    <Link
                      href="/u/edit"
                      className="block px-3 py-2 text-sm hover:bg-white/10"
                      onClick={() => setMenuOpen(false)}
                    >
                      プロフィールを編集
                    </Link>
                    <button
                      className="w-full text-left block px-3 py-2 text-sm hover:bg-white/10"
                      onClick={() => {
                        setMenuOpen(false);
                        handleLogout();
                      }}
                    >
                      ログアウト
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
