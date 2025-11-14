"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Header from "@/app/components/Header";
import SidebarTabs from "@/app/components/SidebarTabs";
import CropEditor from "@/app/components/CropEditor";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export default function EditProfilePage() {
  const router = useRouter();
  const [access, setAccess] = useState<string>("");
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [tab, setTab] = useState<string>("home");
  const [overlayMode, setOverlayMode] = useState<boolean>(false);
  const [vw, setVw] = useState<number>(0);

  const [me, setMe] = useState<{ username: string; display_name?: string; display_name_or_username?: string; icon_url?: string; is_guest?: boolean } | null>(null);
  const [formUsername, setFormUsername] = useState<string>("");
  const [formDisplayName, setFormDisplayName] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [usernameError, setUsernameError] = useState<string>("");
  const [displayNameError, setDisplayNameError] = useState<string>("");
  
  // Icon upload & crop
  const iconInputRef = useRef<HTMLInputElement | null>(null);
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconImg, setIconImg] = useState<HTMLImageElement | null>(null);
  const [iconPreviewUrl, setIconPreviewUrl] = useState<string | null>(null);
  const [iconPreviewCroppedUrl, setIconPreviewCroppedUrl] = useState<string | null>(null);
  const [iconCrop, setIconCrop] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [editorOpen, setEditorOpen] = useState<boolean>(false);

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
    async function fetchMe() {
      // セキュリティ対策: JWTトークンはCookieから自動的に送信される
      try {
        const res = await fetch(`${API}/api/accounts/me/`, { credentials: 'include' });
        if (!res.ok) {
          setMe(null);
          router.push('/u');
          return;
        }
        const data = await res.json();
        if (data && data.username) {
          setMe({ 
            username: data.username, 
            display_name: data.display_name || '',
            display_name_or_username: data.display_name_or_username || data.username,
            icon_url: data.icon_url, 
            is_guest: data.is_guest 
          });
          setAccess("authenticated"); // 認証済みであることを記録
        }
      } catch {
        setMe(null);
        router.push('/u');
      }
    }
    fetchMe();
  }, [router]);

  useEffect(() => {
    if (me) {
      setFormUsername(me.username || '');
      setFormDisplayName(me.display_name || '');
    }
  }, [me]);

  function loadPreview(file: File) {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { setIconImg(img); setEditorOpen(true); };
    img.src = url;
    setIconPreviewUrl(url);
  }

  useEffect(() => {
    return () => {
      if (iconPreviewUrl) URL.revokeObjectURL(iconPreviewUrl);
      if (iconPreviewCroppedUrl) URL.revokeObjectURL(iconPreviewCroppedUrl);
    };
  }, [iconPreviewUrl, iconPreviewCroppedUrl]);

  async function buildCroppedPreview(img: HTMLImageElement, crop: { crop_x: number; crop_y: number; crop_w: number; crop_h: number; }) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const sx = Math.max(0, Math.min(crop.crop_x, img.naturalWidth - 1));
    const sy = Math.max(0, Math.min(crop.crop_y, img.naturalHeight - 1));
    const sw = Math.max(1, Math.min(crop.crop_w, img.naturalWidth - sx));
    const sh = Math.max(1, Math.min(crop.crop_h, img.naturalHeight - sy));
    const s = Math.min(sw, sh);
    canvas.width = 256; canvas.height = 256;
    ctx.drawImage(img, sx, sy, s, s, 0, 0, 256, 256);
    return await new Promise<string | null>((resolve) => {
      canvas.toBlob((blob) => {
        if (!blob) return resolve(null);
        const url = URL.createObjectURL(blob);
        resolve(url);
      }, 'image/jpeg', 0.88);
    });
  }

  function computeCropForIcon() {
    if (!iconImg) return null;
    const W = iconImg.naturalWidth; const H = iconImg.naturalHeight;
    const size = Math.min(W, H);
    const x0 = (W - size) / 2;
    const y0 = (H - size) / 2;
    return { crop_x: x0, crop_y: y0, crop_w: size, crop_h: size };
  }

  // Rebuild cropped preview when crop changes
  useEffect(() => {
    (async () => {
      if (iconImg && iconCrop) {
        const crop = { crop_x: iconCrop.x, crop_y: iconCrop.y, crop_w: iconCrop.w, crop_h: iconCrop.h };
        if (iconPreviewCroppedUrl) URL.revokeObjectURL(iconPreviewCroppedUrl);
        const url = await buildCroppedPreview(iconImg, crop);
        if (url) setIconPreviewCroppedUrl(url);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iconImg, iconCrop]);


  async function handleSave(e?: React.FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    setMessage("");
    setUsernameError("");
    setDisplayNameError("");
    if (!me) {
      setMessage('ユーザー情報を取得できませんでした。');
      return;
    }
    if (!formUsername.trim()) {
      setUsernameError('ユーザーIDを入力してください。');
      return;
    }

    setIsSaving(true);
    try {
      let updatedUsername = me.username ?? '';
      let updatedDisplayName = me.display_name ?? '';
      let updatedIconUrl = me.icon_url ?? '';

      // アイコンアップロード（ログイン済みユーザーでアイコンファイルが選択されている場合）
      if (!me.is_guest && iconFile) {
        const fd = new FormData();
        fd.append('image', iconFile);
        const cropFixed = iconCrop ? { crop_x: iconCrop.x, crop_y: iconCrop.y, crop_w: iconCrop.w, crop_h: iconCrop.h } : computeCropForIcon();
        if (cropFixed) {
          fd.append('crop_x', String(cropFixed.crop_x));
          fd.append('crop_y', String(cropFixed.crop_y));
          fd.append('crop_w', String(cropFixed.crop_w));
          fd.append('crop_h', String(cropFixed.crop_h));
        }
        try {
          const iconRes = await fetch(`${API}/api/accounts/me/icon/`, {
            method: 'POST',
            credentials: 'include',
            body: fd
          });
          const iconTxt = await iconRes.text();
          if (!iconRes.ok) {
            setMessage(`アイコンアップロード失敗: ${iconRes.status} ${iconTxt}`);
            setIsSaving(false);
            return;
          }
          try {
            const iconData = JSON.parse(iconTxt);
            if (iconData?.icon_url) {
              updatedIconUrl = iconData.icon_url;
            }
          } catch {
            setMessage('アイコン更新に失敗しました。');
            setIsSaving(false);
            return;
          }
        } catch (error) {
          setMessage('アイコンアップロードに失敗しました。');
          setIsSaving(false);
          return;
        }
      }

      // usernameまたはdisplay_nameが変更された場合
      const usernameChanged = !me.is_guest && formUsername.trim() !== me.username;
      const displayNameChanged = formDisplayName.trim() !== (me.display_name || '');

      if (usernameChanged || displayNameChanged) {
        const updateData: { username?: string; display_name?: string } = {};
        if (usernameChanged) {
          updateData.username = formUsername.trim();
        }
        if (displayNameChanged) {
          updateData.display_name = formDisplayName.trim();
        }

        const resp = await fetch(`${API}/api/accounts/me/`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          // セキュリティ対策: JWTトークンはCookieから自動的に送信される
          credentials: 'include',
          body: JSON.stringify(updateData),
        });
        if (!resp.ok) {
          let errText = `プロフィールの更新に失敗しました (${resp.status})`;
          try {
            const data = await resp.json();
            if (data?.username) {
              const first = Array.isArray(data.username) ? data.username[0] : data.username;
              if (typeof first === 'string') {
                setUsernameError(first);
                errText = '';
              }
            }
            if (data?.display_name) {
              const first = Array.isArray(data.display_name) ? data.display_name[0] : data.display_name;
              if (typeof first === 'string') {
                setDisplayNameError(first);
                errText = '';
              }
            }
            if (data?.detail && typeof data.detail === 'string' && !errText) {
              errText = data.detail;
            }
          } catch {}
          if (errText) {
            setMessage(errText);
          }
          setIsSaving(false);
          return;
        }
        const respData = await resp.json();
        updatedUsername = respData?.username ?? formUsername.trim();
        updatedDisplayName = respData?.display_name ?? formDisplayName.trim();
      }

      // 成功したらプロフィールページにリダイレクト
      router.push('/u');
    } catch (error) {
      setMessage('保存に失敗しました。');
      setIsSaving(false);
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
          <div className="flex items-start gap-4 md:gap-6 min-w-0">
            <SidebarTabs
              open={sidebarOpen}
              current={tab}
              onChange={(v) => { setTab(v); setSidebarOpen(false); }}
              setOpen={setSidebarOpen}
            />

            <section className="flex-1 min-w-0" style={{ maxWidth: vw >= 1200 ? 800 : 700 }}>
              <div className={`space-y-4 pr-1 ${vw < 500 ? 'pb-16' : ''}`}>
          <div className="rounded-lg border border-subtle p-4 surface-1">
            <h1 className="text-lg font-semibold mb-4">プロフィールを編集</h1>

                  {!me && (
                    <div className="mb-4 text-sm text-subtle">ユーザー情報を取得中...</div>
                  )}

                  <form className="space-y-3" onSubmit={handleSave}>
                    <div>
                      <label className="block text-sm mb-1">ユーザーID</label>
                      <input
                        className="w-full rounded-md border border-subtle bg-transparent px-3 py-2"
                        value={formUsername}
                        onChange={(event) => setFormUsername(event.target.value)}
                        disabled={!me || isSaving || me.is_guest}
                        placeholder="user_xxxxxxxxxxxx"
                      />
                      {usernameError && <div className="mt-1 text-xs text-red-400">{usernameError}</div>}
                      {me?.is_guest ? (
                        <p className="mt-1 text-xs text-subtle">ゲストユーザーのユーザーIDは変更できません。</p>
                      ) : (
                        <p className="mt-1 text-xs text-subtle">ユーザーIDは変更可能です。英数字とアンダースコアが使用できます。</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm mb-1">表示名</label>
                      <input
                        className="w-full rounded-md border border-subtle bg-transparent px-3 py-2"
                        value={formDisplayName}
                        onChange={(event) => setFormDisplayName(event.target.value)}
                        disabled={!me || isSaving}
                        placeholder="表示名"
                      />
                      {displayNameError && <div className="mt-1 text-xs text-red-400">{displayNameError}</div>}
                      <p className="mt-1 text-xs text-subtle">表示名は投稿やコメントで表示される名前です。<br />
                      このサービスでは実名やペンネームも含む、他のSNSで利用している名前の使用は禁止です。</p>
                    </div>

                    {/* Icon upload - ログイン済みユーザーのみ */}
                    {me && !me.is_guest && (
                      <div>
                        <label className="block text-sm mb-1">アイコン</label>
                        <div className="flex items-center gap-4">
                          <div className="flex-shrink-0 relative group">
                            {iconPreviewCroppedUrl ? (
                              <img
                                src={iconPreviewCroppedUrl}
                                alt="アイコンフプレビュー"
                                className="w-20 h-20 rounded-full border border-subtle object-cover"
                              />
                            ) : me.icon_url ? (
                              <img
                                src={me.icon_url}
                                alt="現在のアイコン"
                                className="w-20 h-20 rounded-full border border-subtle object-cover"
                              />
                            ) : (
                              <div className="w-20 h-20 rounded-full border border-subtle surface-1 flex items-center justify-center">
                                <span className="text-2xl">#</span>
                              </div>
                            )}
                            <input
                              ref={iconInputRef}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  setIconFile(file);
                                  loadPreview(file);
                                }
                              }}
                              disabled={isSaving}
                            />
                            <button
                              type="button"
                              className="absolute inset-0 w-full h-full rounded-full bg-black/40 group-hover:bg-black/50 flex items-center justify-center transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                              onClick={() => iconInputRef.current?.click()}
                              disabled={isSaving}
                              title="画像を選択"
                              aria-label="画像を選択"
                            >
                              <span className="material-symbols-rounded text-white text-sm">edit</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <button
                        type="submit"
                        className="px-4 py-2 rounded-md bg-accent text-white hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
                        disabled={!me || isSaving}
                      >
                        {isSaving ? '保存中…' : '保存'}
                      </button>
                      <button
                        type="button"
                        className="px-4 py-2 rounded-md border border-subtle hover:bg-white/5 disabled:opacity-60 disabled:cursor-not-allowed"
                        onClick={() => {
                          if (me) {
                            setFormUsername(me.username || '');
                            setFormDisplayName(me.display_name || '');
                          }
                          setUsernameError("");
                          setDisplayNameError("");
                          setMessage("");
                        }}
                        disabled={isSaving}
                      >
                        リセット
                      </button>
                    </div>

                    {message && <div className="text-sm text-subtle whitespace-pre-wrap">{message}</div>}
                  </form>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>

      {/* Crop Editor Modal */}
      {editorOpen && iconPreviewUrl && iconImg && (
        <CropEditor
          imageUrl={iconPreviewUrl}
          aspectRatio={1}
          title="アイコンを編集"
          onCancel={() => {
            setEditorOpen(false);
            setIconFile(null);
            setIconImg(null);
            if (iconPreviewUrl) {
              URL.revokeObjectURL(iconPreviewUrl);
              setIconPreviewUrl(null);
            }
            if (iconPreviewCroppedUrl) {
              URL.revokeObjectURL(iconPreviewCroppedUrl);
              setIconPreviewCroppedUrl(null);
            }
            if (iconInputRef.current) {
              iconInputRef.current.value = '';
            }
          }}
          onApply={(crop) => {
            setIconCrop(crop);
            setEditorOpen(false);
          }}
        />
      )}
    </div>
  );
}

