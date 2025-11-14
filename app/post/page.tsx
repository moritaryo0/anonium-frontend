"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Header from "../components/Header";
import SidebarTabs from "../components/SidebarTabs";
import MobileNav from "../components/MobileNav";
import Composer from "../components/Composer";
import CodeBlockEditor from "../components/CodeBlockEditor";
import CreateFab from "../components/CreateFab";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

type Community = {
  id: number;
  name: string;
  slug: string;
};

type CommunityTag = { name: string; color?: string };

export default function CreatePostPage() {
  const router = useRouter();
  const [access, setAccess] = useState<string>("");
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [tab, setTab] = useState<string>("home");

  const [communities, setCommunities] = useState<Community[]>([]);
  const [communityId, setCommunityId] = useState<number | null>(null);
  const [title, setTitle] = useState<string>("");
  const [body, setBody] = useState<string>("");
  const [attachedUrls, setAttachedUrls] = useState<string[]>([]);
  const [codePanelOpen, setCodePanelOpen] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");
  const [overlayMode, setOverlayMode] = useState<boolean>(false);
  const [vw, setVw] = useState<number>(0);
  const [communityBlocked, setCommunityBlocked] = useState<boolean>(false);
  const [availableTags, setAvailableTags] = useState<CommunityTag[]>([]);
  const [selectedTag, setSelectedTag] = useState<string>("");
  const [postType, setPostType] = useState<'text' | 'poll' | 'image' | 'video'>('text');
  const [pollTitle, setPollTitle] = useState<string>("");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [pollExpiresAt, setPollExpiresAt] = useState<string | null>(null);
  const [attachedVideoUrls, setAttachedVideoUrls] = useState<string[]>([]);
  
  // Composerコンポーネントから状態を取得するためのref
  const composerAttachedUrlsRef = useRef<string[]>([]);
  const composerAttachedVideoUrlsRef = useRef<string[]>([]);
  const composerAttachedImageFilesRef = useRef<File[]>([]);
  const composerAttachedVideoFilesRef = useRef<File[]>([]);
  
  // コールバックをメモ化して、レンダリング中に状態更新が発生しないようにする
  const handleAttachmentsChange = useCallback((urls: string[]) => {
    composerAttachedUrlsRef.current = urls;
    setAttachedUrls(urls);
  }, []);
  
  const handleAttachmentsVideoChange = useCallback((urls: string[]) => {
    composerAttachedVideoUrlsRef.current = urls;
    setAttachedVideoUrls(urls);
  }, []);
  
  // ファイルオブジェクトの変更を監視
  const handleAttachedImageFilesChange = useCallback((files: File[]) => {
    composerAttachedImageFilesRef.current = files;
    // postTypeを自動的に更新
    if (postType !== 'poll') {
      if (files.length > 0) {
        setPostType('image');
      } else if (composerAttachedVideoFilesRef.current.length === 0) {
        setPostType('text');
      }
    }
  }, [postType]);
  
  const handleAttachedVideoFilesChange = useCallback((files: File[]) => {
    composerAttachedVideoFilesRef.current = files;
    // postTypeを自動的に更新
    if (postType !== 'poll') {
      if (files.length > 0) {
        setPostType('video');
      } else if (composerAttachedImageFilesRef.current.length === 0) {
        setPostType('text');
      }
    }
  }, [postType]);

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
        }
      } catch {
        setAccess("");
      }
    }
    checkAuth();
    // preselect community from query (?id= or ?slug= for backward compatibility)
    try {
      const sp = new URLSearchParams(window.location.search);
      const idParam = sp.get('id');
      const slugParam = sp.get('slug');
      if (idParam) {
        const id = parseInt(idParam, 10);
        if (!isNaN(id)) setCommunityId(id);
      } else if (slugParam) {
        // 後方互換性: slugが指定された場合、コミュニティ一覧から該当するコミュニティを探す
        // ただし、この時点ではコミュニティ一覧がまだ読み込まれていない可能性があるため、
        // fetchCommunities後に処理する
      }
    } catch {}
    function compute() {
      const w = typeof window !== 'undefined' ? window.innerWidth : 0;
      setOverlayMode(w <= 1200);
      setVw(w);
    }
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, []);

  // クエリパラメータからslugが指定された場合の処理
  useEffect(() => {
    async function resolveSlugFromQuery() {
      try {
        const sp = new URLSearchParams(window.location.search);
        const slugParam = sp.get('slug');
        if (!slugParam || communityId) return; // 既にIDが設定されている場合はスキップ
        
        // コミュニティ一覧から該当するslugのコミュニティを探す
        if (communities.length > 0) {
          const found = communities.find(c => c.slug === slugParam);
          if (found) {
            setCommunityId(found.id);
          }
        }
      } catch {}
    }
    resolveSlugFromQuery();
  }, [communities, communityId]);

  useEffect(() => {
    async function checkBlocked() {
      setCommunityBlocked(false);
      if (!communityId) return;
      try {
        // セキュリティ対策: JWTトークンはCookieから自動的に送信される
        const res = await fetch(`${API}/api/communities/${communityId}/`, { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        if (data && typeof data.is_blocked === 'boolean') setCommunityBlocked(!!data.is_blocked);
        // タグ候補の取得（コミュニティ詳細に tags が含まれている前提）
        const tags = Array.isArray(data?.tags) ? data.tags.map((t: any) => ({ name: String(t.name || ''), color: t.color || '#1e3a8a' })).filter((t: any) => t.name) : [];
        setAvailableTags(tags);
        // 切替時は選択リセット
        setSelectedTag("");
        setPostType('text');
        setPollTitle("");
        setPollOptions(["", ""]);
        setPollExpiresAt(null);
      } catch {}
    }
    checkBlocked();
  }, [communityId]);

  useEffect(() => {
    async function fetchCommunities() {
      try {
        // セキュリティ対策: JWTトークンはCookieから自動的に送信される
        // 参加しているコミュニティのみを取得
        const res = await fetch(`${API}/api/communities/me/`, {
          credentials: 'include',
        });
        if (!res.ok) return;
        const data = await res.json();
        // ページネーション対応: レスポンスが {count, next, previous, results} の形式の場合と配列の場合の両方に対応
        const communities = Array.isArray(data) ? data : (data.results || []);
        setCommunities(communities);
      } catch {
        // noop
      }
    }
    fetchCommunities();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    if (!communityId || !title) {
      setMessage("アノニウムとタイトルは必須です。");
      return;
    }
    
    // 投票の場合のバリデーション
    if (postType === 'poll') {
      if (!pollTitle.trim()) {
        setMessage("投票のタイトルを入力してください。");
        return;
      }
      const validOptions = pollOptions.filter(opt => opt.trim()).length;
      if (validOptions < 2) {
        setMessage("投票項目は最低2つ必要です。");
        return;
      }
    }
    
    setSubmitting(true);
    try {
      // ファイルオブジェクトを取得
      const imageFiles = composerAttachedImageFilesRef.current;
      const videoFiles = composerAttachedVideoFilesRef.current;
      
      // 投稿タイプを決定（画像が優先、次に動画、最後にpostType）
      let finalPostType = postType;
      if (imageFiles.length > 0) {
        finalPostType = 'image';
      } else if (videoFiles.length > 0) {
        finalPostType = 'video';
      }
      
      // メディアファイルをアップロード
      const mediaUrls: Array<{url: string, order: number, thumbnail_url?: string, width?: number, height?: number, duration?: number, file_size?: number}> = [];
      
      if (imageFiles.length > 0) {
        // 画像をアップロード
        for (let i = 0; i < imageFiles.length; i++) {
          const file = imageFiles[i];
          const fd = new FormData();
          fd.append('image', file);
          
          const res = await fetch(`${API}/api/posts/images/`, {
            method: 'POST',
            // セキュリティ対策: JWTトークンはCookieから自動的に送信される
            credentials: 'include',
            body: fd,
          });
          
          const textRes = await res.text();
          if (!res.ok) {
            setMessage(`画像アップロード失敗: ${res.status} ${textRes}`);
            setSubmitting(false);
            return;
          }
          
          const data = JSON.parse(textRes);
          if (data?.image_url) {
            mediaUrls.push({
              url: data.image_url,
              order: i,
              width: data.width,
              height: data.height,
              file_size: file.size
            });
          }
        }
      } else if (videoFiles.length > 0) {
        // 動画をアップロード
        for (let i = 0; i < videoFiles.length; i++) {
          const file = videoFiles[i];
          const fd = new FormData();
          fd.append('video', file);
          
          const res = await fetch(`${API}/api/posts/videos/`, {
            method: 'POST',
            // セキュリティ対策: JWTトークンはCookieから自動的に送信される
            credentials: 'include',
            body: fd,
          });
          
          const textRes = await res.text();
          if (!res.ok) {
            setMessage(`動画アップロード失敗: ${res.status} ${textRes}`);
            setSubmitting(false);
            return;
          }
          
          const data = JSON.parse(textRes);
          if (data?.video_url) {
            mediaUrls.push({
              url: data.video_url,
              order: i,
              thumbnail_url: data.thumbnail_url || '',
              duration: data.duration,
              file_size: file.size
            });
          }
        }
      }
      
      const payload: any = { 
        title, 
        body: body || '', // メディア投稿の場合は本文が空でも許可
        post_type: finalPostType,
        ...(selectedTag ? { tag: selectedTag } : {})
      };
      
      // 投票データの追加
      if (finalPostType === 'poll') {
        payload.poll_title = pollTitle;
        payload.poll_options = pollOptions.filter(opt => opt.trim());
        if (pollExpiresAt) payload.poll_expires_at = pollExpiresAt;
      }
      
      // メディアデータの追加
      if (mediaUrls.length > 0) {
        payload.media_urls = mediaUrls;
      }
      
      console.log('投稿送信:', { 
        payload, 
        imageFiles: imageFiles.length,
        videoFiles: videoFiles.length,
        mediaUrls,
        finalPostType
      });
      
      const res = await fetch(`${API}/api/communities/${communityId}/posts/`, {
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
      router.push(`/v/${communityId}`);
    } catch (err) {
      setMessage("投稿に失敗しました。");
    } finally {
      setSubmitting(false);
    }
  }

  function insertCodeToBody(code: string, lang?: string) {
    const fence = lang ? `\n\n\`\`\`${lang}\n` : `\n\n\`\`\`\n`;
    const tail = `\n\`\`\`\n`;
    const next = (body || "") + fence + code.replaceAll('\r\n', '\n') + tail;
    setBody(next);
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
            <h1 className="text-lg font-semibold mb-4">新規投稿</h1>

            {!access && (
              <div className="mb-4 text-sm text-subtle">ログインすると投稿できます。</div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-sm mb-1">アノニウム</label>
                <select
                  className="w-full rounded-md border border-subtle bg-transparent px-3 py-2"
                  value={communityId || ""}
                  onChange={(e) => {
                    const id = e.target.value ? parseInt(e.target.value, 10) : null;
                    setCommunityId(isNaN(id || 0) ? null : id);
                  }}
                  disabled={(!access && !communityId) || (!!access && communities.length === 0)}
                >
                  <option value="">選択してください</option>
                  {communities.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name || c.slug}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm mb-1">タイトル</label>
                <input
                  className="w-full rounded-md border border-subtle bg-transparent px-3 py-2"
                  placeholder="タイトル"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm mb-1">本文</label>
                {communityBlocked ? (
                  <div className="rounded-md border border-subtle p-3 surface-1 text-sm text-subtle">
                    ブロックされているため、このアノニウムでは投稿できません。
                  </div>
                ) : (
                  <>
                    <Composer
                      accessToken={access}
                      uploadUrl={`${API}/api/posts/images/`}
                      videoUploadUrl={`${API}/api/posts/videos/`}
                      placeholder="本文（任意）"
                      value={body}
                      onChange={setBody}
                      onAttachmentsChange={handleAttachmentsChange}
                      onAttachmentsVideoChange={handleAttachmentsVideoChange}
                      onAttachedImageFilesChange={handleAttachedImageFilesChange}
                      onAttachedVideoFilesChange={handleAttachedVideoFilesChange}
                      hideSubmitButton
                      multiple
                      enablePollMode={true}
                      postType={postType}
                      onPostTypeChange={(type) => {
                        setPostType(type);
                        if (type === 'text') {
                          setPollTitle("");
                          setPollOptions(["", ""]);
                          setPollExpiresAt(null);
                        } else if (type === 'poll') {
                          setBody("");
                          setAttachedUrls([]);
                          setAttachedVideoUrls([]);
                          composerAttachedImageFilesRef.current = [];
                          composerAttachedVideoFilesRef.current = [];
                        }
                      }}
                      pollTitle={pollTitle}
                      pollOptions={pollOptions}
                      onPollTitleChange={setPollTitle}
                      onPollOptionsChange={setPollOptions}
                      onPollExpiresChange={setPollExpiresAt}
                    />
                    {/* 投票期限（PollEditor側が計算してISO/Nullを通知） */}
                    {postType === 'poll' && (
                      <div className="px-3">
                        <div className="text-xs text-subtle">投票エディタ内の期限設定は投稿に反映されます。</div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {availableTags.length > 0 && (
                <div>
                  <label className="block text-sm mb-1">タグ</label>
                  <div className="flex flex-wrap gap-2">
                    {availableTags.map((t) => {
                      const active = selectedTag === t.name;
                      const bg = t.color || '#1e3a8a';
                      const fg = (() => {
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
                      })();
                      return (
                        <button
                          key={t.name}
                          type="button"
                          className={`inline-flex items-center text-xs px-2 py-1 rounded-full border ${active ? 'ring-2 ring-accent' : 'border-subtle'} hover:bg-white/5`}
                          style={{ backgroundColor: bg, color: fg }}
                          onClick={() => setSelectedTag((prev) => (prev === t.name ? "" : t.name))}
                          title={active ? '選択解除' : '選択'}
                        >
                          {t.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  className="rounded-md px-4 py-2 bg-accent text-white hover:opacity-90 disabled:opacity-50"
                  disabled={!communityId || !title || submitting || communityBlocked}
                >
                  {submitting ? "投稿中..." : "投稿する"}
                </button>
              </div>

              {message && (
                <div className="text-sm text-subtle whitespace-pre-wrap">{message}</div>
              )}
            </form>
          </div>
            </section>
          </div>
        </div>
      </main>
      {vw > 0 && vw < 500 && (
        <MobileNav current={tab} onChange={(v) => { setTab(v); }} />
      )}
      <CreateFab />
    </div>
  );
}


