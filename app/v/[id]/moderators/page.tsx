"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Header from "@/app/components/Header";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

type Community = {
  id: number;
  name: string;
  slug: string;
  icon_url?: string;
  banner_url?: string;
};

type Moderator = {
  id: number;
  username: string; // 表示名（後方互換性のため）
  username_id?: string; // 実際のユーザー名（ID）
  display_name?: string; // 表示名
  icon_url?: string;
  score?: number;
  role?: string | null;
};

export default function ModeratorsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = (Array.isArray(params.id) ? params.id[0] : params.id) || '';

  const [access, setAccess] = useState<string>("");
  const [community, setCommunity] = useState<Community | null>(null);
  const [moderators, setModerators] = useState<Moderator[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    // セキュリティ対策: JWTトークンはCookieから自動的に送信される
    // 認証状態を確認するために/meエンドポイントを呼び出す
    async function checkAuth() {
      try {
        const res = await fetch(`${API}/api/accounts/me/`, {
          credentials: 'include',
        });
        if (res.ok) {
          setAccess("authenticated"); // トークン自体は保持しない
        } else {
          setAccess("");
        }
      } catch {
        setAccess("");
      }
    }
    checkAuth();
  }, []);

  useEffect(() => {
    if (id) {
      fetchCommunity();
      fetchModerators();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function fetchCommunity() {
    if (!id) return;
    try {
      // セキュリティ対策: JWTトークンはCookieから自動的に送信される
      const res = await fetch(`${API}/api/communities/${id}/`, { credentials: 'include' });
      if (!res.ok) {
        setError('アノニウムが見つかりません');
        return;
      }
      const data: Community = await res.json();
      setCommunity(data);
    } catch {
      setError('アノニウムの読み込みに失敗しました');
    }
  }

  async function fetchModerators() {
    if (!id) return;
    setLoading(true);
    try {
      // セキュリティ対策: JWTトークンはCookieから自動的に送信される
      const res = await fetch(`${API}/api/communities/${id}/moderators/`, { credentials: 'include' });
      if (!res.ok) {
        setError('モデレーター一覧の読み込みに失敗しました');
        setLoading(false);
        return;
      }
      const data = await res.json();
      const moderators = Array.isArray(data) ? data : (data.results || []);
      setModerators(moderators);
    } catch {
      setError('モデレーター一覧の読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  }

  const roleLabel = (role?: string | null) => {
    if (role === 'owner') return 'オーナー';
    if (role === 'admin_moderator') return '管理モデレーター';
    if (role === 'moderator') return 'モデレーター';
    return '';
  };

  const roleBadgeClass = (role?: string | null) => {
    if (role === 'owner') return 'border-rose-500/30 bg-rose-500/20 text-rose-300';
    if (role === 'admin_moderator') return 'border-amber-500/30 bg-amber-500/20 text-amber-300';
    if (role === 'moderator') return 'border-sky-500/30 bg-sky-500/20 text-sky-300';
    return '';
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header
        signedIn={!!access}
        onLogin={() => {
          router.push('/login');
        }}
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
          setAccess("");
          router.push('/');
        }}
      />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link 
            href={`/v/${id}`}
            className="inline-flex items-center gap-2 text-sm text-subtle hover:text-foreground mb-4"
          >
            <span className="material-symbols-rounded text-base" aria-hidden>arrow_back</span>
            <span>アノニウムに戻る</span>
          </Link>
          <div className="flex items-center gap-4 mb-4">
            {community?.icon_url && (
              <img 
                src={community.icon_url} 
                alt={community.name} 
                className="w-16 h-16 rounded-full border border-subtle object-cover" 
              />
            )}
            <div>
              <h1 className="text-2xl font-semibold">{community?.name || id} - モデレーター</h1>
              <p className="text-sm text-subtle mt-1">アノニウムのモデレーター一覧</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 p-4 mb-6">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-subtle">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-foreground mb-4"></div>
            <p>読み込み中...</p>
          </div>
        ) : moderators.length === 0 ? (
          <div className="rounded-lg border border-subtle p-8 surface-1 text-center text-subtle">
            <span className="material-symbols-rounded text-4xl mb-4 block" aria-hidden>shield_person</span>
            <p>モデレーターはいません</p>
          </div>
        ) : (
          <div className="rounded-lg border border-subtle surface-1 overflow-hidden">
            <div className="p-4 border-b border-subtle">
              <h2 className="font-medium">モデレーター一覧 ({moderators.length})</h2>
            </div>
            <ul className="divide-y divide-subtle">
              {moderators.map((moderator) => (
                <li key={moderator.id} className="p-4 hover:bg-white/5 transition-colors">
                  <div className="flex items-center gap-4">
                    {moderator.icon_url ? (
                        <img 
                          src={moderator.icon_url} 
                          alt={moderator.display_name || moderator.username} 
                        className="w-12 h-12 rounded-full border border-subtle object-cover" 
                        />
                    ) : (
                      <div className="w-12 h-12 rounded-full border border-subtle surface-1" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="min-w-0 flex-1">
                          <div 
                            className="font-medium truncate block"
                            title={moderator.display_name || moderator.username}
                          >
                            {moderator.display_name || moderator.username}
                          </div>
                          <div 
                            className="text-xs text-subtle truncate block"
                            title={moderator.username_id || moderator.username}
                          >
                            {moderator.username_id || moderator.username}
                          </div>
                        </div>
                        {moderator.role && (
                          <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full border flex-shrink-0 ${roleBadgeClass(moderator.role)}`}>
                            {moderator.role === 'admin_moderator' && (
                              <span className="material-symbols-rounded text-xs mr-1" style={{ fontSize: 14 }} aria-hidden>build</span>
                            )}
                            {moderator.role === 'moderator' && (
                              <span className="material-symbols-rounded text-xs mr-1" style={{ fontSize: 14 }} aria-hidden>shield_person</span>
                            )}
                            {roleLabel(moderator.role)}
                          </span>
                        )}
                      </div>
                      {moderator.score !== undefined && (
                        <div className="text-xs text-subtle">
                          スコア: {moderator.score.toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </div>
  );
}
