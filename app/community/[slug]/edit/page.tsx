"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import CropEditor from "@/app/components/CropEditor";
import { useParams, useRouter } from "next/navigation";
import Header from "@/app/components/Header";
import SidebarTabs from "@/app/components/SidebarTabs";
import MobileNav from "@/app/components/MobileNav";

const DEFAULT_BANNER_ASPECT = 7 / 2;
const API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

  type RuleItem = {
    title: string;
    description: string;
  };

  type Community = {
  id: number;
  name: string;
  slug: string;
  description?: string;
  tags?: Array<{ name: string; color?: string; permission_scope?: 'all'|'moderator'|'owner' }>;
  tag_permission_scope?: 'all'|'moderator'|'owner';
  rules?: string | RuleItem[];
  icon_url?: string;
  banner_url?: string;
  visibility?: "public" | "restricted" | "private";
  join_policy?: "open" | "approval" | "invite" | "login";
  is_nsfw?: boolean;
  allow_repost?: boolean;
  karma?: number;
  is_admin?: boolean;
  membership_role?: 'owner' | 'admin_moderator' | 'moderator' | 'member' | null;
};

export default function EditCommunityPage() {
  const params = useParams<{ slug: string }>();
  const slugParam = params.slug;
  const router = useRouter();
  const [access, setAccess] = useState<string>("");
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [tab, setTab] = useState<string>("home");

  const [community, setCommunity] = useState<Community | null>(null);
  const [message, setMessage] = useState<string>("");
  const [saving, setSaving] = useState<boolean>(false);
  const [deleting, setDeleting] = useState<boolean>(false);
  const [overlayMode, setOverlayMode] = useState<boolean>(false);
  const [vw, setVw] = useState<number>(0);
  
  // コミュニティIDを取得（コミュニティデータから取得、またはslugが数値の場合はidとして扱う）
  const communityId = community?.id || (slugParam && !isNaN(Number(slugParam)) ? Number(slugParam) : null);

  // Upload & crop states
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconImg, setIconImg] = useState<HTMLImageElement | null>(null);
  const [iconZoom, setIconZoom] = useState<number>(1);
  const [iconX, setIconX] = useState<number>(0); // -0.5..0.5 center-based
  const [iconY, setIconY] = useState<number>(0);
  const [iconPreviewUrl, setIconPreviewUrl] = useState<string | null>(null);
  const [iconPreviewCroppedUrl, setIconPreviewCroppedUrl] = useState<string | null>(null);
  const [iconCrop, setIconCrop] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerImg, setBannerImg] = useState<HTMLImageElement | null>(null);
  const [bannerZoom, setBannerZoom] = useState<number>(1);
  const [bannerX, setBannerX] = useState<number>(0);
  const [bannerY, setBannerY] = useState<number>(0);
  const [bannerPreviewUrl, setBannerPreviewUrl] = useState<string | null>(null);
  const [bannerPreviewCroppedUrl, setBannerPreviewCroppedUrl] = useState<string | null>(null);
  const [bannerCrop, setBannerCrop] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  // カラーパレットは廃止（RGBカラーピッカーのみ）

  const [editorTarget, setEditorTarget] = useState<"icon" | "banner" | null>(null);
  const iconInputRef = useRef<HTMLInputElement | null>(null);
  const bannerInputRef = useRef<HTMLInputElement | null>(null);
  const bannerPreviewRef = useRef<HTMLDivElement | null>(null);
  const [bannerAspect, setBannerAspect] = useState<number>(DEFAULT_BANNER_ASPECT);

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
    async function fetchDetail() {
      try {
        // slugが数値の場合はidとして扱う、そうでない場合はslugとして扱う
        const identifier = slugParam && !isNaN(Number(slugParam)) ? Number(slugParam) : slugParam;
        if (!identifier) return;
        
        // セキュリティ対策: JWTトークンはCookieから自動的に送信される
        const res = await fetch(`${API}/api/communities/${identifier}/`, { credentials: 'include' });
        if (!res.ok) return;
        const data: Community = await res.json();
        // rulesを配列形式に正規化
        if (data.rules && typeof data.rules === 'string') {
          // 文字列の場合は空配列に変換（マイグレーション未適用の場合）
          data.rules = [];
        } else if (!Array.isArray(data.rules)) {
          data.rules = [];
        }
        setCommunity(data);
      } catch {}
    }
    if (slugParam) fetchDetail();
  }, [slugParam]);

  function update<K extends keyof Community>(key: K, val: Community[K]) {
    setCommunity(prev => prev ? { ...prev, [key]: val } : prev);
  }

  function updateRule(index: number, field: 'title' | 'description', value: string) {
    setCommunity(prev => {
      if (!prev) return prev;
      const rules = Array.isArray(prev.rules) ? [...prev.rules] : [];
      if (!rules[index]) return prev;
      rules[index] = { ...rules[index], [field]: value };
      return { ...prev, rules };
    });
  }

  function addRule() {
    setCommunity(prev => {
      if (!prev) return prev;
      const rules = Array.isArray(prev.rules) ? [...prev.rules] : [];
      rules.push({ title: '', description: '' });
      return { ...prev, rules };
    });
  }

  function removeRule(index: number) {
    setCommunity(prev => {
      if (!prev) return prev;
      const rules = Array.isArray(prev.rules) ? [...prev.rules] : [];
      rules.splice(index, 1);
      return { ...prev, rules: rules.length > 0 ? rules : [] };
    });
  }

  function loadPreview(file: File, onImage: (img: HTMLImageElement) => void, setUrl: (u: string) => void) {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { onImage(img); };
    img.src = url;
    setUrl(url);
  }

  // cleanup object URLs when files change/unmount
  useEffect(() => {
    return () => {
      if (iconPreviewUrl) URL.revokeObjectURL(iconPreviewUrl);
      if (iconPreviewCroppedUrl) URL.revokeObjectURL(iconPreviewCroppedUrl);
      if (bannerPreviewUrl) URL.revokeObjectURL(bannerPreviewUrl);
      if (bannerPreviewCroppedUrl) URL.revokeObjectURL(bannerPreviewCroppedUrl);
    };
  }, [iconPreviewUrl, bannerPreviewUrl, iconPreviewCroppedUrl, bannerPreviewCroppedUrl]);

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
        if (!Number.isNaN(next) && next > 0) {
          setBannerAspect(next);
        }
      }
    };
    updateAspect();
    const ro = new ResizeObserver(updateAspect);
    ro.observe(el);
    return () => {
      ro.disconnect();
    };
  }, [vw]);

  async function buildCroppedPreview(img: HTMLImageElement, crop: { crop_x: number; crop_y: number; crop_w: number; crop_h: number; }, kind: 'icon' | 'banner', aspect: number = DEFAULT_BANNER_ASPECT) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const sx = Math.max(0, Math.min(crop.crop_x, img.naturalWidth - 1));
    const sy = Math.max(0, Math.min(crop.crop_y, img.naturalHeight - 1));
    const sw = Math.max(1, Math.min(crop.crop_w, img.naturalWidth - sx));
    const sh = Math.max(1, Math.min(crop.crop_h, img.naturalHeight - sy));
    if (kind === 'icon') {
      const s = Math.min(sw, sh);
      canvas.width = 256; canvas.height = 256;
      ctx.drawImage(img, sx, sy, s, s, 0, 0, 256, 256);
    } else {
      // banner target - align to preview aspect
      const targetWidth = 1200;
      const targetHeight = Math.round(targetWidth / aspect);
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight);
    }
    return await new Promise<string | null>((resolve) => {
      canvas.toBlob((blob) => {
        if (!blob) return resolve(null);
        const url = URL.createObjectURL(blob);
        resolve(url);
      }, 'image/jpeg', 0.88);
    });
  }

  // Rebuild cropped previews when sliders or image change
  useEffect(() => {
    (async () => {
      if (iconImg) {
        const crop = iconCrop ? { crop_x: iconCrop.x, crop_y: iconCrop.y, crop_w: iconCrop.w, crop_h: iconCrop.h } : computeCropForIcon();
        if (crop) {
          if (iconPreviewCroppedUrl) URL.revokeObjectURL(iconPreviewCroppedUrl);
          const url = await buildCroppedPreview(iconImg, crop, 'icon');
          if (url) setIconPreviewCroppedUrl(url);
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iconImg, iconZoom, iconX, iconY, iconCrop]);

  useEffect(() => {
    (async () => {
      if (bannerImg) {
        const crop = bannerCrop ? { crop_x: bannerCrop.x, crop_y: bannerCrop.y, crop_w: bannerCrop.w, crop_h: bannerCrop.h } : computeCropForBanner();
        if (crop) {
          if (bannerPreviewCroppedUrl) URL.revokeObjectURL(bannerPreviewCroppedUrl);
          const url = await buildCroppedPreview(bannerImg, crop, 'banner', bannerAspect);
          if (url) setBannerPreviewCroppedUrl(url);
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bannerImg, bannerZoom, bannerX, bannerY, bannerCrop]);

  function computeCropForIcon() {
    if (!iconImg) return null;
    const W = iconImg.naturalWidth; const H = iconImg.naturalHeight;
    const z = Math.max(1, iconZoom);
    const size = Math.min(W, H) / z;
    const x0 = Math.max(0, Math.min((W - size) * (0.5 + iconX), W - size));
    const y0 = Math.max(0, Math.min((H - size) * (0.5 + iconY), H - size));
    return { crop_x: x0, crop_y: y0, crop_w: size, crop_h: size };
  }

  function computeCropForBanner() {
    if (!bannerImg) return null;
    const W = bannerImg.naturalWidth; const H = bannerImg.naturalHeight;
    const z = Math.max(1, bannerZoom);
    const targetAspect = bannerAspect || DEFAULT_BANNER_ASPECT;
    let w0 = W / z; let h0 = w0 / targetAspect;
    if (h0 > H / z) { h0 = H / z; w0 = h0 * targetAspect; }
    const x0 = Math.max(0, Math.min((W - w0) * (0.5 + bannerX), W - w0));
    const y0 = Math.max(0, Math.min((H - h0) * (0.5 + bannerY), H - h0));
    return { crop_x: x0, crop_y: y0, crop_w: w0, crop_h: h0 };
  }

  async function uploadIcon(): Promise<Community | null> {
    if (!access || !community || !iconFile) { setMessage('アイコン画像を選択してください。'); return null; }
    const fd = new FormData();
    fd.append('image', iconFile);
    const cropFixed = iconCrop ? { crop_x: iconCrop.x, crop_y: iconCrop.y, crop_w: iconCrop.w, crop_h: iconCrop.h } : computeCropForIcon();
    if (cropFixed) { fd.append('crop_x', String(cropFixed.crop_x)); fd.append('crop_y', String(cropFixed.crop_y)); fd.append('crop_w', String(cropFixed.crop_w)); fd.append('crop_h', String(cropFixed.crop_h)); }
    const res = await fetch(`${API}/api/communities/${community.id}/icon/`, { method: 'POST', credentials: 'include', body: fd });
    const txt = await res.text();
    if (!res.ok) { setMessage(`アイコンアップロード失敗: ${res.status} ${txt}`); return null; }
    try {
      const j = JSON.parse(txt) as Community;
      setCommunity(j);
      setMessage('アイコンを更新しました。');
      return j;
    } catch {
      setMessage('アイコン更新に失敗しました。');
      return null;
    }
  }

  async function uploadBanner(): Promise<Community | null> {
    if (!access || !community || !bannerFile) { setMessage('バナー画像を選択してください。'); return null; }
    const fd = new FormData();
    fd.append('image', bannerFile);
    const cropFixed = bannerCrop ? { crop_x: bannerCrop.x, crop_y: bannerCrop.y, crop_w: bannerCrop.w, crop_h: bannerCrop.h } : computeCropForBanner();
    if (cropFixed) { fd.append('crop_x', String(cropFixed.crop_x)); fd.append('crop_y', String(cropFixed.crop_y)); fd.append('crop_w', String(cropFixed.crop_w)); fd.append('crop_h', String(cropFixed.crop_h)); }
    const res = await fetch(`${API}/api/communities/${community.id}/banner/`, { method: 'POST', credentials: 'include', body: fd });
    const txt = await res.text();
    if (!res.ok) { setMessage(`バナーアップロード失敗: ${res.status} ${txt}`); return null; }
    try {
      const j = JSON.parse(txt) as Community;
      setCommunity(j);
      if (j.banner_url) {
        if (bannerPreviewCroppedUrl && bannerPreviewCroppedUrl.startsWith('blob:')) {
          URL.revokeObjectURL(bannerPreviewCroppedUrl);
        }
        setBannerPreviewCroppedUrl(j.banner_url);
      }
      setMessage('バナーを更新しました。');
      return j;
    }
    catch { setMessage('バナー更新に失敗しました。'); return null; }
  }

  async function save() {
    if (!access || !community) { setMessage("権限がありません。"); return; }
    if (!community.is_admin) { setMessage("管理者のみ編集できます。"); return; }
    setSaving(true); setMessage("");
    try {
      // 先にメディア（pendingがあれば）を保存
      let latestCommunity: Community | null = community;
      if (iconFile) {
        const updated = await uploadIcon();
        if (updated) {
          latestCommunity = updated;
        }
      }
      if (bannerFile) {
        const updated = await uploadBanner();
        if (updated) {
          latestCommunity = updated;
        }
      }
      if (!latestCommunity) {
        setMessage('保存に失敗しました。');
        return;
      }
      // rulesを配列形式に正規化（空のタイトル/説明を除外）
      const normalizedRules = Array.isArray(latestCommunity.rules)
        ? latestCommunity.rules.filter(rule => rule.title?.trim() || rule.description?.trim())
        : [];
      
      const payload: any = {
        name: latestCommunity.name,
        description: latestCommunity.description || "",
        tags: (latestCommunity.tags || []).filter(t => (t.name||'').trim()).map(t => ({ name: t.name.trim(), color: t.color || '#1e3a8a' })),
        tag_permission_scope: (latestCommunity.tag_permission_scope as any) || 'all',
        rules: normalizedRules,
        icon_url: latestCommunity.icon_url || "",
        banner_url: latestCommunity.banner_url || "",
        visibility: latestCommunity.visibility || "public",
        join_policy: latestCommunity.join_policy || "open",
        is_nsfw: !!latestCommunity.is_nsfw,
        allow_repost: !!latestCommunity.allow_repost,
      };
      // 参加ポリシーがopenの場合のみkarmaを送信
      if (latestCommunity.join_policy === 'open') {
        payload.karma = latestCommunity.karma || 0;
      }
      if (!communityId) {
        setMessage('コミュニティIDが取得できませんでした。');
        return;
      }
      
      const res = await fetch(`${API}/api/communities/${communityId}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        // セキュリティ対策: JWTトークンはCookieから自動的に送信される
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const text = await res.text();
      if (!res.ok) { setMessage(`エラー ${res.status}: ${text}`); return; }
      router.push(`/v/${communityId}`);
    } catch {
      setMessage("保存に失敗しました。");
    } finally {
      setSaving(false);
    }
  }

  async function deleteCommunity() {
    if (!access || !community) { setMessage("権限がありません。"); return; }
    if (community.membership_role !== 'owner') { setMessage("オーナーのみ削除できます。"); return; }
    
    // 確認ダイアログ
    const confirmed = window.confirm(
      `「${community.name}」を削除してもよろしいですか？\n\nこの操作は取り消せません。コミュニティとすべての投稿が削除されます。`
    );
    if (!confirmed) return;
    
    setDeleting(true); setMessage("");
    try {
      const res = await fetch(`${API}/api/communities/${community.id}/delete/`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const text = await res.text();
      if (!res.ok) { 
        try {
          const errorData = JSON.parse(text);
          setMessage(`エラー ${res.status}: ${errorData.detail || text}`);
        } catch {
          setMessage(`エラー ${res.status}: ${text}`);
        }
        return; 
      }
      // 削除成功後、ホームページにリダイレクト
      router.push('/');
    } catch {
      setMessage("削除に失敗しました。");
    } finally {
      setDeleting(false);
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
            <h1 className="text-lg font-semibold mb-4">アノニウムを編集</h1>
            {!community ? (
              <div className="text-sm text-subtle">読み込み中...</div>
            ) : !community.is_admin ? (
              <div className="text-sm text-subtle">管理者のみ編集できます。</div>
            ) : (
              <div className="space-y-3">
                {/* Header preview（現在のレイアウトに一致） - moved to top */}
                <div>
                  <label className="block text-sm mb-1">ヘッダープレビュー</label>
                  {/* hidden inputs for file pickers */}
                  <input ref={iconInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { 
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
                    setIconCrop(null);
                    if (f) { loadPreview(f, setIconImg, (u) => setIconPreviewUrl(u)); setEditorTarget('icon'); }
                  }} />
                  <input ref={bannerInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { 
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
                    setBannerCrop(null);
                    if (f) { loadPreview(f, setBannerImg, (u) => setBannerPreviewUrl(u)); setEditorTarget('banner'); }
                  }} />
                  <div className="rounded-lg border border-subtle surface-1 overflow-hidden">
                    {/* Banner */}
                    <div
                      ref={bannerPreviewRef}
                      className="relative w-full"
                      style={{ aspectRatio: "7 / 2", minHeight: 96 }}
                    >
                      {bannerPreviewCroppedUrl || community.banner_url ? (
                        <img
                          src={(bannerPreviewCroppedUrl ?? community.banner_url)!}
                          alt="banner"
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 w-full h-full bg-white/5" />
                      )}
                      {/* Banner overlay controls */}
                      <div className="absolute left-1/2 -translate-x-1/2 top-2 flex items-center gap-2">
                        <button
                          type="button"
                          className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-black/60 hover:bg-black/70 border border-white/20 text-white"
                          title="バナーを選択"
                          onClick={() => bannerInputRef.current?.click()}
                        >
                          <span className="material-symbols-rounded" aria-hidden>photo_camera</span>
                        </button>
                        <button
                          type="button"
                          className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-black/60 hover:bg-black/70 border border-white/20 text-white"
                          title="バナーをクリア"
                          onClick={() => { setBannerFile(null); if (bannerPreviewUrl) URL.revokeObjectURL(bannerPreviewUrl); setBannerPreviewUrl(null); setBannerPreviewCroppedUrl(null); setBannerCrop(null); }}
                        >
                          <span className="material-symbols-rounded" aria-hidden>close</span>
                        </button>
                      </div>
                    </div>

                    {/* Row: icon + name */}
                    <div className="flex items-center justify-between gap-3 p-3 md:p-4">
                      <div className="flex items-center gap-3 md:gap-4">
                        <div className="relative">
                          {iconPreviewCroppedUrl || community.icon_url ? (
                            <img src={iconPreviewCroppedUrl || community.icon_url || undefined} alt="icon" className="w-16 h-16 md:w-20 md:h-20 object-cover rounded-full border border-subtle" />
                          ) : (
                            <div className="w-16 h-16 md:w-20 md:h-20 rounded-full border border-subtle surface-1" />
                          )}
                          {/* Icon overlay */}
                          <button
                            type="button"
                            className="absolute -bottom-1 -right-1 inline-flex items-center justify-center w-8 h-8 rounded-full bg-black/70 hover:bg-black/80 border border-white/20 text-white"
                            title="アイコンを選択"
                            onClick={() => iconInputRef.current?.click()}
                          >
                            <span className="material-symbols-rounded" aria-hidden>photo_camera</span>
                          </button>
                        </div>
                        <div>
                          <div className="text-xl md:text-2xl font-semibold leading-tight">{community.name}</div>
                          <div className="text-xs text-subtle mt-1">{(community as any).members_count ?? 0} メンバー</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm mb-1">名前</label>
                  <input className="w-full rounded-md border border-subtle bg-transparent px-3 py-2" value={community.name} onChange={(e) => update('name', e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm mb-1">説明</label>
                  <textarea className="w-full rounded-md border border-subtle bg-transparent px-3 py-2" rows={4} value={community.description || ''} onChange={(e) => update('description', e.target.value)} />
                </div>
                {/* タグ */}
                <div>
                  <label className="block text-sm mb-1">タグ</label>
                  <div className="space-y-2">
                    {((community.tags || []) as any[]).map((t, i) => (
                      <div key={i} className="grid grid-cols-1 sm:grid-cols-5 gap-2 items-center">
                        <input
                          className="sm:col-span-2 rounded-md border border-subtle bg-transparent px-3 py-2 text-sm"
                          placeholder={`タグ名 #${i+1}`}
                          value={t.name || ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value.length <= 15) {
                              setCommunity(prev => prev ? { ...prev, tags: [...(prev.tags||[]).map((x, idx) => idx===i ? { ...x, name: value } : x)] } : prev);
                            }
                          }}
                          maxLength={15}
                        />
                        <div className="flex items-center gap-2 flex-wrap">
                          <input
                            type="color"
                            className="w-8 h-8 p-0 border border-subtle rounded cursor-pointer"
                            value={t.color || '#1e3a8a'}
                            onChange={(e) => setCommunity(prev => prev ? { ...prev, tags: [...(prev.tags||[]).map((x, idx) => idx===i ? { ...x, color: e.target.value } : x)] } : prev)}
                            title="色を選択"
                          />
                        </div>
                        {/* per-tag permission removed; now community-wide */}
                        <button
                          type="button"
                          className="text-xs px-2 py-1 rounded-md border border-subtle surface-1 hover:bg-white/5"
                          onClick={() => setCommunity(prev => prev ? { ...prev, tags: [...(prev.tags||[]).filter((_, idx) => idx!==i)] } : prev)}
                        >削除</button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="px-3 py-1.5 text-sm rounded-md border border-subtle surface-1 hover:bg-white/5"
                      onClick={() => setCommunity(prev => prev ? { ...prev, tags: [...(prev.tags||[]), { name: '', color: '#1e3a8a' }] } : prev)}
                    >タグを追加</button>
                  </div>
                </div>
                {/* タグ付け許可範囲（コミュニティ全体） */}
                <div>
                  <label className="block text-sm mb-1">タグ付け許可範囲</label>
                  <select
                    className="w-full rounded-md border border-subtle bg-transparent px-3 py-2"
                    value={(community.tag_permission_scope as any) || 'all'}
                    onChange={(e) => update('tag_permission_scope' as any, e.target.value as any)}
                  >
                    <option value="all">参加者全員</option>
                    <option value="moderator">モデレーター</option>
                    <option value="owner">オーナー</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm mb-1">ルール</label>
                  {Array.isArray(community.rules) ? (
                    <div className="space-y-3">
                      {(community.rules as RuleItem[]).map((rule, index) => (
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
                  ) : (
                    <div className="text-sm text-subtle">ルールを読み込み中...</div>
                  )}
                </div>
                {/* 旧: 選択/再編集の別セクションは廃止。選択はプレビュー上のカメラから行う */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm mb-1">表示ポリシー</label>
                    <select className="w-full rounded-md border border-subtle bg-transparent px-3 py-2" value={community.visibility || 'public'} onChange={(e) => update('visibility', e.target.value as any)}>
                      <option value="public">公開</option>
                      <option value="private">非公開</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm mb-1">参加ポリシー</label>
                    <select className="w-full rounded-md border border-subtle bg-transparent px-3 py-2" value={community.join_policy || 'open'} onChange={(e) => update('join_policy', e.target.value as any)}>
                      <option value="open">自由参加</option>
                      <option value="login">ログインユーザーのみ</option>
                      <option value="approval">承認制</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={!!community.is_nsfw} onChange={(e) => update('is_nsfw', e.target.checked)} className="rounded border-subtle" />
                    <span className="text-sm">年齢制限</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={!!community.allow_repost} onChange={(e) => update('allow_repost', e.target.checked)} className="rounded border-subtle" />
                    <span className="text-sm">転載許可</span>
                  </label>
                </div>

                {/* ゲストユーザーの投票許可（カルマ）- 参加ポリシーがopenの場合のみ表示 */}
                {community.join_policy === 'open' && (
                  <div>
                    <label className="block text-sm mb-1">ゲストユーザーの投票許可スコア</label>
                    <input
                      type="number"
                      min="0"
                      className="w-full rounded-md border border-subtle bg-transparent px-3 py-2"
                      value={community.karma || 0}
                      onChange={(e) => update('karma', parseInt(e.target.value) || 0)}
                      placeholder="0"
                    />
                    <p className="text-xs text-subtle mt-1">
                      ゲストユーザーが投票するために必要な最小スコア。ゲストによる投票はアカウントのスコアには影響しません。
                    </p>
                  </div>
                )}
                <div className="pt-2 flex gap-2 justify-end">
                  <button className="px-4 py-2 rounded-md border border-subtle hover:bg-white/5" onClick={() => communityId && router.push(`/v/${communityId}`)}>キャンセル</button>
                  <button className="px-4 py-2 rounded-md bg-accent text-white hover:opacity-90 disabled:opacity-50" onClick={save} disabled={saving}>保存</button>
                </div>
                {message && <div className="text-sm text-subtle">{message}</div>}
                
                {/* 削除セクション（オーナーのみ表示） */}
                {community.membership_role === 'owner' && (
                  <div className="pt-4 mt-4 border-t border-subtle">
                    <h2 className="text-lg font-semibold mb-2 text-red-500">危険な操作</h2>
                    <p className="text-sm text-subtle mb-4">
                      コミュニティを削除すると、すべての投稿、コメント、メンバーシップが完全に削除されます。この操作は取り消せません。
                    </p>
                    <button
                      className="px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={deleteCommunity}
                      disabled={deleting || saving}
                    >
                      {deleting ? '削除中...' : 'コミュニティを削除'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
            </section>
          </div>
        </div>
      </main>
      {vw > 0 && vw < 500 && (
        <MobileNav current={tab} onChange={(v) => { setTab(v); }} />
      )}

      {/* Crop editor overlay */}
      {editorTarget && (
        <CropEditor
          imageUrl={(editorTarget === 'icon' ? (iconPreviewUrl || '') : (bannerPreviewUrl || ''))}
          aspectRatio={editorTarget === 'icon' ? 1 : bannerAspect}
          title={editorTarget === 'icon' ? 'アイコンを編集' : 'バナーを編集'}
          onCancel={() => setEditorTarget(null)}
          onApply={(crop) => {
            if (editorTarget === 'icon') {
              setIconCrop(crop);
            } else {
              setBannerCrop(crop);
            }
            setEditorTarget(null);
          }}
        />
      )}
    </div>
  );
}


