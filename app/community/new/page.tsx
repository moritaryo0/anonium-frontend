"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Header from "@/app/components/Header";
import SidebarTabs from "@/app/components/SidebarTabs";
import MobileNav from "@/app/components/MobileNav";
import CropEditor from "@/app/components/CropEditor";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

type RuleItem = {
  title: string;
  description: string;
};

type CreatePayload = {
  name: string;
  description: string;
  tags?: Array<{ name: string; color?: string; permission_scope?: 'all'|'moderator'|'owner' }>;
  tag_permission_scope?: 'all'|'moderator'|'owner';
  rules: RuleItem[];
  visibility: "public" | "restricted" | "private";
  join_policy: "open" | "approval" | "invite" | "login";
  is_nsfw: boolean;
  allow_repost: boolean;
  karma?: number;
};

const DEFAULT_BANNER_ASPECT = 7 / 2;

export default function CreateCommunityPage() {
  const router = useRouter();
  const [access, setAccess] = useState<string>("");
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [tab, setTab] = useState<string>("home");

  const [form, setForm] = useState<CreatePayload>({
    name: "",
    description: "",
    tags: [],
    tag_permission_scope: 'all',
    rules: [],
    visibility: "public",
    join_policy: "open",
    is_nsfw: false,
    allow_repost: false,
    karma: 0,
  });
  const iconInputRef = useRef<HTMLInputElement | null>(null);
  const bannerInputRef = useRef<HTMLInputElement | null>(null);
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [iconPreviewUrl, setIconPreviewUrl] = useState<string | null>(null);
  const [bannerPreviewUrl, setBannerPreviewUrl] = useState<string | null>(null);
  const [editorTarget, setEditorTarget] = useState<"icon" | "banner" | null>(null);
  const [iconCrop, setIconCrop] = useState<{ crop_x: number; crop_y: number; crop_w: number; crop_h: number } | null>(null);
  const [bannerCrop, setBannerCrop] = useState<{ crop_x: number; crop_y: number; crop_w: number; crop_h: number } | null>(null);
  const bannerPreviewRef = useRef<HTMLDivElement | null>(null);
  const [bannerAspect, setBannerAspect] = useState<number>(DEFAULT_BANNER_ASPECT);

  // カラーパレットは廃止（RGBカラーピッカーのみ）

  async function buildCroppedPreview(imgUrl: string, crop: { crop_x: number; crop_y: number; crop_w: number; crop_h: number }, kind: 'icon' | 'banner', aspect: number = DEFAULT_BANNER_ASPECT) {
    return await new Promise<string | null>((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        if (kind === 'icon') { canvas.width = 256; canvas.height = 256; }
        else {
          const targetWidth = 1200;
          const targetHeight = Math.round(targetWidth / aspect);
          canvas.width = targetWidth; canvas.height = targetHeight;
        }
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(null);
        const { crop_x, crop_y, crop_w, crop_h } = crop;
        ctx.drawImage(img, crop_x, crop_y, crop_w, crop_h, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (!blob) return resolve(null);
          resolve(URL.createObjectURL(blob));
        }, 'image/jpeg', 0.9);
      };
      img.src = imgUrl;
    });
  }
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");
  const [overlayMode, setOverlayMode] = useState<boolean>(false);
  const [vw, setVw] = useState<number>(0);
  const [authChecked, setAuthChecked] = useState<boolean>(false);

  useEffect(() => {
    // セキュリティ対策: JWTトークンはCookieから自動的に送信される
    // 認証状態を確認するために/meエンドポイントを呼び出す
    async function checkAuth() {
      try {
        const res = await fetch(`${API}/api/accounts/me/`, {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          // ゲストユーザーかどうかを確認
          const isGuest = data.is_guest || (data.username && data.username.startsWith('Anonium-'));
          if (isGuest || !data.username || data.username.startsWith('Anonium-')) {
            setAccess("");
          } else {
            setAccess("authenticated"); // トークン自体は保持しない
          }
        } else {
          setAccess("");
        }
      } catch {
        setAccess("");
      } finally {
        setAuthChecked(true);
      }
    }
    checkAuth();
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
    const el = bannerPreviewRef.current;
    if (!el) return;
    if (typeof ResizeObserver === 'undefined') {
      setBannerAspect(DEFAULT_BANNER_ASPECT);
      return;
    }
    const updateAspect = () => {
      const rect = el.getBoundingClientRect();
      if (rect.height > 0) {
        const next = rect.width / rect.height;
        if (!Number.isNaN(next) && next > 0) setBannerAspect(next);
      }
    };
    updateAspect();
    const ro = new ResizeObserver(updateAspect);
    ro.observe(el);
    return () => ro.disconnect();
  }, [vw]);

  function update<K extends keyof CreatePayload>(key: K, val: CreatePayload[K]) {
    setForm(prev => ({ ...prev, [key]: val }));
  }

  function updateRule(index: number, field: 'title' | 'description', value: string) {
    setForm(prev => {
      const rules = [...prev.rules];
      if (!rules[index]) return prev;
      rules[index] = { ...rules[index], [field]: value };
      return { ...prev, rules };
    });
  }

  function addRule() {
    setForm(prev => ({
      ...prev,
      rules: [...prev.rules, { title: '', description: '' }]
    }));
  }

  function removeRule(index: number) {
    setForm(prev => {
      const rules = [...prev.rules];
      rules.splice(index, 1);
      return { ...prev, rules };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    if (!access) {
      setMessage("アノニウム作成にはログインが必要です。");
      return;
    }
    if (!form.name.trim()) {
      setMessage("名前は必須です。");
      return;
    }
    setSubmitting(true);
    try {
      // 1) コミュニティを先に作成（画像は後でアップロード）
      // rulesを配列形式に正規化（空のタイトル/説明を除外）
      const normalizedRules = form.rules.filter(rule => rule.title?.trim() || rule.description?.trim());
      
      const payload: any = {
        name: form.name,
        description: form.description,
        tags: (form.tags || []).filter(t => (t.name||'').trim()).map(t => ({ name: t.name.trim(), color: t.color || '#1e3a8a' })),
        tag_permission_scope: form.tag_permission_scope || 'all',
        rules: normalizedRules,
        visibility: form.visibility,
        join_policy: form.join_policy,
        is_nsfw: form.is_nsfw,
        allow_repost: form.allow_repost,
      };
      // 参加ポリシーがopenの場合のみkarmaを送信
      if (form.join_policy === 'open') {
        payload.karma = form.karma || 0;
      }
      const res = await fetch(`${API}/api/communities/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        // セキュリティ対策: JWTトークンはCookieから自動的に送信される
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const text = await res.text();
      if (!res.ok) {
        setMessage(`エラー ${res.status}: ${text}`);
        return;
      }
      const data = JSON.parse(text);
      const slug = data?.slug;
      const communityId = data?.id;
      if (!slug) {
        setMessage("作成に成功しましたが、遷移できませんでした。");
        return;
      }
      if (!communityId) {
        setMessage("作成に成功しましたが、IDが取得できませんでした。");
        return;
      }

      // 2) 選択済みの画像があればアップロード
      if (iconFile) {
        const fd = new FormData();
        fd.append('image', iconFile);
        if (iconCrop) {
          fd.append('crop_x', String(iconCrop.crop_x));
          fd.append('crop_y', String(iconCrop.crop_y));
          fd.append('crop_w', String(iconCrop.crop_w));
          fd.append('crop_h', String(iconCrop.crop_h));
        }
        await fetch(`${API}/api/communities/${communityId}/icon/`, {
          method: 'POST',
          // セキュリティ対策: JWTトークンはCookieから自動的に送信される
          credentials: 'include',
          body: fd,
        });
      }
      if (bannerFile) {
        const fd = new FormData();
        fd.append('image', bannerFile);
        if (bannerCrop) {
          fd.append('crop_x', String(bannerCrop.crop_x));
          fd.append('crop_y', String(bannerCrop.crop_y));
          fd.append('crop_w', String(bannerCrop.crop_w));
          fd.append('crop_h', String(bannerCrop.crop_h));
        }
        await fetch(`${API}/api/communities/${communityId}/banner/`, {
          method: 'POST',
          // セキュリティ対策: JWTトークンはCookieから自動的に送信される
          credentials: 'include',
          body: fd,
        });
      }

      router.push(`/v/${slug}`);
    } catch (err) {
      setMessage("作成に失敗しました。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header
        signedIn={!!access}
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
          setAccess("");
          router.push("/");
        }}
      />

      <main className="max-w-none mx-auto px-2 sm:px-2 md:px-3 py-6">
        <div className="mx-auto" style={{ maxWidth: vw >= 1200 ? 1200 : '100%' }}>
          <div className="flex items-start gap-4 md:gap-6">
            <SidebarTabs
              open={sidebarOpen}
              current={tab}
              onChange={(v) => { setTab(v); }}
              setOpen={setSidebarOpen}
            />
            <section className="flex-1 space-y-4" style={{ maxWidth: 700 }}>
          <div className="rounded-lg border border-subtle p-4 surface-1">
            <h1 className="text-lg font-semibold mb-4">アノニウムを作成</h1>

            {!authChecked ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex items-center justify-center gap-2 text-subtle text-sm">
                  <div className="w-5 h-5 border-2 border-subtle border-t-accent rounded-full animate-spin"></div>
                  <span>読み込み中...</span>
                </div>
              </div>
            ) : !access ? (
              <div className="space-y-4 py-8">
                <div className="text-sm text-subtle text-center">アノニウムを作成するにはログインが必要です。</div>
                <div className="flex gap-3 justify-center">
                  <Link
                    href="/login"
                    className="inline-flex items-center justify-center rounded-md px-4 py-2 bg-accent text-white hover:opacity-90 transition-colors"
                  >
                    ログイン
                  </Link>
                  <Link
                    href="/signup"
                    className="inline-flex items-center justify-center rounded-md px-4 py-2 border border-subtle surface-1 hover:bg-white/5 transition-colors"
                  >
                    新規登録
                  </Link>
                </div>
              </div>
            ) : (
              <>
            {/* 編集ページのレイアウトに合わせたヘッダープレビュー */}
            <div className="rounded-lg border border-subtle surface-1 overflow-hidden mb-4">
              {/* Banner */}
              <div ref={bannerPreviewRef} className="relative w-full" style={{ aspectRatio: "7 / 2", minHeight: 96 }}>
                {bannerPreviewUrl ? (
                  <img src={bannerPreviewUrl} alt="banner" className="absolute inset-0 w-full h-full object-cover" />
                ) : <div className="absolute inset-0 w-full h-full bg-white/5" />}
                <div className="absolute left-1/2 -translate-x-1/2 top-2 flex items-center gap-2">
                  <button
                    type="button"
                    className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-black/60 hover:bg-black/70 border border-white/20 text-white"
                    title="バナーを選択"
                    onClick={() => bannerInputRef.current?.click()}
                  >
                    <span className="material-symbols-rounded" aria-hidden>photo_camera</span>
                  </button>
                  {bannerPreviewUrl && (
                    <button
                      type="button"
                      className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-black/60 hover:bg-black/70 border border-white/20 text-white"
                      title="バナーをクリア"
                      onClick={() => { setBannerFile(null); if (bannerPreviewUrl) URL.revokeObjectURL(bannerPreviewUrl); setBannerPreviewUrl(null); }}
                    >
                      <span className="material-symbols-rounded" aria-hidden>close</span>
                    </button>
                  )}
                </div>
                <input
                  ref={bannerInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    if (f) {
                      if (f.size > MAX_IMAGE_SIZE) {
                        setMessage("画像のサイズが10MBを超えています。より小さい画像を選択してください。");
                        if (bannerInputRef.current) bannerInputRef.current.value = '';
                        return;
                      }
                      setMessage("");
                    }
                    if (bannerPreviewUrl) URL.revokeObjectURL(bannerPreviewUrl);
                    setBannerFile(f);
                    if (f) { const url = URL.createObjectURL(f); setBannerPreviewUrl(url); setEditorTarget('banner'); }
                  }}
                />
              </div>
              {/* Row: icon + name */}
              <div className="flex items-center justify-between gap-3 p-3 md:p-4">
                <div className="flex items-center gap-3 md:gap-4">
                  <div className="relative">
                    {iconPreviewUrl ? (
                      <img src={iconPreviewUrl} alt="icon" className="w-16 h-16 md:w-20 md:h-20 object-cover rounded-full border border-subtle" />
                    ) : (
                      <div className="w-16 h-16 md:w-20 md:h-20 rounded-full border border-subtle surface-1" />
                    )}
                    <button
                      type="button"
                      className="absolute -bottom-1 -right-1 inline-flex items-center justify-center w-8 h-8 rounded-full bg-black/70 hover:bg-black/80 border border-white/20 text-white"
                      title="アイコンを選択"
                      onClick={() => iconInputRef.current?.click()}
                    >
                      <span className="material-symbols-rounded" aria-hidden>photo_camera</span>
                    </button>
                  </div>
                  <input
                    ref={iconInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0] || null;
                      if (f) {
                        if (f.size > MAX_IMAGE_SIZE) {
                          setMessage("画像のサイズが10MBを超えています。より小さい画像を選択してください。");
                          if (iconInputRef.current) iconInputRef.current.value = '';
                          return;
                        }
                        setMessage("");
                      }
                      if (iconPreviewUrl) URL.revokeObjectURL(iconPreviewUrl);
                      setIconFile(f);
                      if (f) { const url = URL.createObjectURL(f); setIconPreviewUrl(url); setEditorTarget('icon'); }
                    }}
                  />
                  <div>
                    <div className="text-xl md:text-2xl font-semibold leading-tight">{form.name || 'アノニウム名'}</div>
                    <div className="text-xs text-subtle mt-1">0 メンバー</div>
                  </div>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-sm mb-1">名前</label>
                <input
                  className="w-full rounded-md border border-subtle bg-transparent px-3 py-2"
                  placeholder="アノニウム名"
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                />
              </div>

              {/* タグ */}
              <div>
                <label className="block text-sm mb-1">タグ</label>
                <div className="space-y-2">
                  {(form.tags || []).map((t, i) => (
                    <div key={i} className="grid grid-cols-1 sm:grid-cols-5 gap-2 items-center">
                      <input
                        className="sm:col-span-2 rounded-md border border-subtle bg-transparent px-3 py-2 text-sm"
                        placeholder={`タグ名 #${i+1}`}
                        value={t.name || ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value.length <= 15) {
                            setForm(prev => { const tags = [...(prev.tags||[])]; tags[i] = { ...tags[i], name: value }; return { ...prev, tags }; });
                          }
                        }}
                        maxLength={15}
                      />
                      <div className="flex items-center gap-2 flex-wrap">
                        <input
                          type="color"
                          className="w-8 h-8 p-0 border border-subtle rounded cursor-pointer"
                          value={t.color || '#1e3a8a'}
                          onChange={(e) => setForm(prev => { const tags = [...(prev.tags||[])]; tags[i] = { ...tags[i], color: e.target.value }; return { ...prev, tags }; })}
                          title="色を選択"
                        />
                      </div>
                      {/* per-tag permission removed; now community-wide */}
                      <button
                        type="button"
                        className="text-xs px-2 py-1 rounded-md border border-subtle surface-1 hover:bg-white/5"
                        onClick={() => setForm(prev => { const tags = [...(prev.tags||[])]; tags.splice(i,1); return { ...prev, tags }; })}
                      >削除</button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="px-3 py-1.5 text-sm rounded-md border border-subtle surface-1 hover:bg-white/5"
                    onClick={() => setForm(prev => ({ ...prev, tags: [...(prev.tags||[]), { name: '', color: '#1e3a8a', permission_scope: 'all' }] }))}
                  >タグを追加</button>
                </div>
              </div>

              {/* タグ付け許可範囲（コミュニティ全体） */}
              <div>
                <label className="block text-sm mb-1">タグ付け許可範囲</label>
                <select
                  className="w-full rounded-md border border-subtle bg-transparent px-3 py-2"
                  value={form.tag_permission_scope || 'all'}
                  onChange={(e) => setForm(prev => ({ ...prev, tag_permission_scope: e.target.value as any }))}
                >
                  <option value="all">参加者全員</option>
                  <option value="moderator">モデレーター</option>
                  <option value="owner">オーナー</option>
                </select>
              </div>

              <div>
                <label className="block text-sm mb-1">説明</label>
                <textarea
                  className="w-full rounded-md border border-subtle bg-transparent px-3 py-2"
                  placeholder="説明（任意）"
                  rows={4}
                  value={form.description}
                  onChange={(e) => update("description", e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm mb-1">ルール</label>
                <div className="space-y-3">
                  {form.rules.map((rule, index) => (
                    <div key={index} className="rounded-md border border-subtle p-3 surface-1">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">項目 {index + 1}</span>
                        <button
                          type="button"
                          className="text-xs px-2 py-1 rounded-md border border-subtle surface-1 hover:bg-white/5 text-subtle"
                          onClick={() => removeRule(index)}
                        >
                          削除
                        </button>
                      </div>
                      <div className="space-y-2">
                        <div>
                          <label className="block text-xs text-subtle mb-1">タイトル</label>
                          <input
                            type="text"
                            className="w-full rounded-md border border-subtle bg-transparent px-3 py-2 text-sm"
                            value={rule.title || ''}
                            onChange={(e) => updateRule(index, 'title', e.target.value)}
                            placeholder={`${index + 1}のタイトル`}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-subtle mb-1">説明</label>
                          <textarea
                            className="w-full rounded-md border border-subtle bg-transparent px-3 py-2 text-sm"
                            rows={3}
                            value={rule.description || ''}
                            onChange={(e) => updateRule(index, 'description', e.target.value)}
                            placeholder={`${index + 1}の説明`}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="w-full px-3 py-2 rounded-md border border-subtle surface-1 hover:bg-white/5 text-sm"
                    onClick={addRule}
                  >
                    項目をさらに追加
                  </button>
                </div>
              </div>

              {/* URL フィールドは廃止（ファイル選択に移行） */}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm mb-1">表示ポリシー</label>
                  <select
                    className="w-full rounded-md border border-subtle bg-transparent px-3 py-2"
                    value={form.visibility}
                    onChange={(e) => update("visibility", e.target.value as CreatePayload["visibility"])}
                  >
                    <option value="public">公開</option>
                    <option value="private">非公開</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm mb-1">参加ポリシー</label>
                  <select
                    className="w-full rounded-md border border-subtle bg-transparent px-3 py-2"
                    value={form.join_policy}
                    onChange={(e) => update("join_policy", e.target.value as CreatePayload["join_policy"])}
                  >
                    <option value="open">自由参加</option>
                    <option value="login">ログインユーザーのみ</option>
                    <option value="approval">承認制</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-center gap-2">
                  <input
                    id="is_nsfw"
                    type="checkbox"
                    className="rounded border-subtle"
                    checked={form.is_nsfw}
                    onChange={(e) => update("is_nsfw", e.target.checked)}
                  />
                  <label htmlFor="is_nsfw" className="text-sm">年齢制限</label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="allow_repost"
                    type="checkbox"
                    className="rounded border-subtle"
                    checked={form.allow_repost}
                    onChange={(e) => update("allow_repost", e.target.checked)}
                  />
                  <label htmlFor="allow_repost" className="text-sm">転載許可</label>
                </div>
              </div>

              {/* ゲストユーザーの投票許可（カルマ）- 参加ポリシーがopenの場合のみ表示 */}
              {form.join_policy === 'open' && (
                <div>
                  <label className="block text-sm mb-1">ゲストユーザーの投票許可スコア</label>
                  <input
                    type="number"
                    min="0"
                    className="w-full rounded-md border border-subtle bg-transparent px-3 py-2"
                    value={form.karma || 0}
                    onChange={(e) => update("karma", parseInt(e.target.value) || 0)}
                    placeholder="0"
                  />
                  <p className="text-xs text-subtle mt-1">
                    ゲストユーザーが投票するために必要な最小スコア。ゲストによる投票はアカウントのスコアには影響しません。
                  </p>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  className="rounded-md px-4 py-2 bg-accent text-white hover:opacity-90 disabled:opacity-50"
                  disabled={!access || !form.name.trim() || submitting}
                >
                  {submitting ? "作成中..." : "作成する"}
                </button>
              </div>

              {message && (
                <div className="text-sm text-subtle whitespace-pre-wrap">{message}</div>
              )}
            </form>
              </>
            )}
          </div>
            </section>
          </div>
        </div>
      </main>
      {vw > 0 && vw < 500 && (
        <MobileNav current={tab} onChange={(v) => { setTab(v); }} />
      )}
      {editorTarget && ((editorTarget === 'icon' ? iconPreviewUrl : bannerPreviewUrl)) && (
        <CropEditor
          imageUrl={(editorTarget === 'icon' ? iconPreviewUrl! : bannerPreviewUrl!)}
          aspectRatio={editorTarget === 'icon' ? 1 : bannerAspect}
          title={editorTarget === 'icon' ? 'アイコンを調整' : 'バナーを調整'}
          onCancel={() => setEditorTarget(null)}
          onApply={async (crop) => {
            if (editorTarget === 'icon') {
              const c = { crop_x: crop.x, crop_y: crop.y, crop_w: crop.w, crop_h: crop.h };
              setIconCrop(c);
              if (iconPreviewUrl) {
                const pv = await buildCroppedPreview(iconPreviewUrl, c, 'icon');
                if (pv) { URL.revokeObjectURL(iconPreviewUrl); setIconPreviewUrl(pv); }
              }
            } else {
              const c = { crop_x: crop.x, crop_y: crop.y, crop_w: crop.w, crop_h: crop.h };
              setBannerCrop(c);
              if (bannerPreviewUrl) {
                const pv = await buildCroppedPreview(bannerPreviewUrl, c, 'banner', bannerAspect);
                if (pv) { URL.revokeObjectURL(bannerPreviewUrl); setBannerPreviewUrl(pv); }
              }
            }
            setEditorTarget(null);
          }}
        />
      )}
    </div>
  );
}


