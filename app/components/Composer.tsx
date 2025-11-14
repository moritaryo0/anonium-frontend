"use client";

import { useEffect, useRef, useState } from "react";
import CodeBlockEditor from "./CodeBlockEditor";
import ListEditor from "./ListEditor";
import QuoteEditor from "./QuoteEditor";
import PollEditor from "./PollEditor";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

type CommunityInfo = {
  slug?: string;
  name?: string;
  is_member?: boolean;
  join_policy?: string;
};

type Props = {
  accessToken?: string; // 後方互換性のためオプショナル、クッキーベースの認証を使用
  postId?: number; // コメント用（既存）
  uploadUrl?: string; // 任意アップロード先（投稿作成など）
  videoUploadUrl?: string; // 任意動画アップロード先（投稿作成など）
  parentId?: number | null;
  placeholder?: string;
  onSubmitted?: () => void; // 内部submit時
  // Controlled text (外部制御用): 指定時は内部stateの代わりに使用
  value?: string;
  onChange?: (v: string) => void;
  onAttachmentChange?: (url: string | null) => void;
  onAttachmentsChange?: (urls: string[]) => void; // 複数画像用
  onAttachmentsVideoChange?: (urls: string[]) => void; // 複数動画用
  getAttachedUrls?: () => string[]; // 投稿送信時に状態を取得するためのコールバック（画像用）
  getAttachedVideoUrls?: () => string[]; // 投稿送信時に状態を取得するためのコールバック（動画用）
  onAttachedImageFilesChange?: (files: File[]) => void; // ファイルオブジェクトの変更を通知（画像用）
  onAttachedVideoFilesChange?: (files: File[]) => void; // ファイルオブジェクトの変更を通知（動画用）
  buttonLabel?: string;
  hideSubmitButton?: boolean;
  onSubmit?: () => void; // 外部submitハンドラ
  multiple?: boolean; // 複数画像許可（投稿本文向け）
  community?: CommunityInfo | null; // コミュニティ情報
  onJoinCommunity?: () => void; // コミュニティ参加ハンドラ
  enablePollMode?: boolean; // 投票モードを有効化（投稿作成時のみ）
  pollTitle?: string; // 投票タイトル（controlled）
  pollOptions?: string[]; // 投票項目（controlled）
  onPollTitleChange?: (title: string) => void;
  onPollOptionsChange?: (options: string[]) => void;
  onPollExpiresChange?: (isoOrNull: string | null) => void;
  postType?: 'text' | 'poll' | 'image' | 'video'; // 投稿タイプ（controlled）
  onPostTypeChange?: (type: 'text' | 'poll' | 'image' | 'video') => void;
};

export default function Composer({ accessToken = "", postId, uploadUrl, videoUploadUrl, parentId = null, placeholder = "コメントを入力...", onSubmitted, value, onChange, onAttachmentChange, onAttachmentsChange, onAttachmentsVideoChange, onAttachedImageFilesChange, onAttachedVideoFilesChange, buttonLabel = "コメント", hideSubmitButton = false, onSubmit, multiple = false, community, onJoinCommunity, enablePollMode = false, pollTitle = "", pollOptions = ["", ""], onPollTitleChange, onPollOptionsChange, onPollExpiresChange, postType = 'text', onPostTypeChange }: Props) {
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
          });
        } else {
          setIsAuthenticated(false);
        }
      }).catch(() => {
        setAuthChecked(true);
        setIsAuthenticated(false);
      });
    }
  }, [accessToken, authChecked]);
  const isControlled = typeof value === 'string';
  const [textState, setTextState] = useState<string>("");
  const text = isControlled ? (value as string) : textState;
  const [uploadMsg, setUploadMsg] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);
  const [previewVideoUrls, setPreviewVideoUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState<boolean>(false);
  const [attachedUrl, setAttachedUrl] = useState<string | null>(null);
  const [attachedUrls, setAttachedUrls] = useState<string[]>([]);
  const [attachedVideoUrl, setAttachedVideoUrl] = useState<string | null>(null);
  const [attachedVideoUrls, setAttachedVideoUrls] = useState<string[]>([]);
  // ファイルオブジェクトを保持（投稿ボタンを押した後にアップロード）
  const [attachedImageFiles, setAttachedImageFiles] = useState<File[]>([]);
  const [attachedVideoFiles, setAttachedVideoFiles] = useState<File[]>([]);
  const [activeTool, setActiveTool] = useState<'code' | 'list' | 'quote' | 'poll' | null>(null);
  const [cursorPos, setCursorPos] = useState<number>(0);
  const activeMode = activeTool === 'list' ? 'list' : activeTool === 'quote' ? 'quote' : null;
  
  // コンポーネントの表示幅を取得してボタン表示を制御
  const [isNarrow, setIsNarrow] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  
  useEffect(() => {
    if (!containerRef.current) return;
    
    const checkWidth = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth;
        setIsNarrow(width < 450);
      }
    };
    
    checkWidth();
    
    const resizeObserver = new ResizeObserver(checkWidth);
    resizeObserver.observe(containerRef.current);
    
    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // 入力可能文字数（コメント: 10000, 投稿: 20000）
  const isCommentMode = !!postId;
  const maxChars = isCommentMode ? 10000 : 20000;
  const currentLen = (text || '').length;
  const remaining = Math.max(-999999, maxChars - currentLen); // 大きく負になるのを抑制
  const isOverLimit = currentLen > maxChars;

  function setText(next: string) {
    if (isControlled) {
      onChange && onChange(next);
    } else {
      setTextState(next);
    }
  }

  function insertAtCursor(insertText: string, caretOffset?: number) {
    const ta = textAreaRef.current;
    if (!ta) { setText((text || "") + insertText); return; }
    const start = ta.selectionStart ?? text.length;
    const end = ta.selectionEnd ?? text.length;
    const before = text.slice(0, start);
    const after = text.slice(end);
    const next = before + insertText + after;
    setText(next);
    requestAnimationFrame(() => {
      const pos = start + (typeof caretOffset === 'number' ? caretOffset : insertText.length);
      try {
        ta.focus();
        ta.setSelectionRange(pos, pos);
      } catch {}
    });
  }

  function insertFencedCode(code: string, lang?: string) {
    const header = lang ? `\n\n\`\`\`${lang}\n` : `\n\n\`\`\`\n`;
    const footer = `\n\`\`\`\n`;
    const block = header + code.replace(/\r\n/g, "\n").replace(/\r/g, "\n") + footer;
    insertAtCursor(block);
    setActiveTool(null);
  }

  function insertList(items: string[]) {
    const listText = items.map(item => `・ ${item}`).join('\n');
    insertAtCursor(`\n\n${listText}\n\n`);
    setActiveTool('list');
  }

  function insertQuote(text: string) {
    const quoteText = text.split('\n').map(line => `> ${line}`).join('\n');
    insertAtCursor(`\n\n${quoteText}\n\n`);
    setActiveTool('quote');
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter') {
      const ta = textAreaRef.current;
      if (!ta) return;
      
      const start = ta.selectionStart ?? text.length;
      const lines = text.slice(0, start).split('\n');
      const currentLine = lines[lines.length - 1] || '';
      
      // アクティブモードに応じて自動挿入
      if (activeMode === 'list') {
        e.preventDefault();
        // 行頭のインデント（スペース）を取得
        const indentMatch = currentLine.match(/^(\s*)/);
        const indent = indentMatch ? indentMatch[1] : '';
        // 改行と箇条書き記号のみを挿入
        const insertText = '\n' + indent + '・ ';
        const before = text.slice(0, start);
        const after = text.slice(start);
        const next = before + insertText + after;
        setText(next);
        requestAnimationFrame(() => {
          try {
            ta.focus();
            const newPos = start + insertText.length;
            ta.setSelectionRange(newPos, newPos);
            setCursorPos(newPos);
          } catch {}
        });
      } else if (activeMode === 'quote') {
        e.preventDefault();
        // 行頭のインデント（スペース）を取得
        const indentMatch = currentLine.match(/^(\s*)/);
        const indent = indentMatch ? indentMatch[1] : '';
        // 改行と引用記号のみを挿入
        const insertText = '\n' + indent + '> ';
        const before = text.slice(0, start);
        const after = text.slice(start);
        const next = before + insertText + after;
        setText(next);
        requestAnimationFrame(() => {
          try {
            ta.focus();
            const newPos = start + insertText.length;
            ta.setSelectionRange(newPos, newPos);
            setCursorPos(newPos);
          } catch {}
        });
      }
    }
  }


  function toggleListFormat() {
    // エディタを開く/閉じる
    if (activeTool === 'list') {
      setActiveTool(null);
    } else {
      setActiveTool('list');
    }
  }

  function toggleQuoteFormat() {
    // エディタを開く/閉じる
    if (activeTool === 'quote') {
      setActiveTool(null);
    } else {
      setActiveTool('quote');
    }
  }
  
  function togglePollFormat() {
    // 投票エディタを開く/閉じる（投稿タイプを切り替え）
    if (activeTool === 'poll') {
      // 投票エディタを閉じる
      setActiveTool(null);
      if (onPostTypeChange && enablePollMode) {
        onPostTypeChange('text');
      }
    } else {
      // 投票エディタを開く（他のツールを閉じる）
      setActiveTool('poll');
      if (onPostTypeChange && enablePollMode) {
        onPostTypeChange('poll');
      }
    }
  }

  async function submit() {
    if (onSubmit) { onSubmit(); return; }
    // ファイルオブジェクトまたは既にアップロード済みのURLをチェック
    const hasImageFiles = attachedImageFiles.length > 0;
    const hasVideoFiles = attachedVideoFiles.length > 0;
    const hasAttachment = multiple ? (attachedUrls.length > 0 || attachedVideoUrls.length > 0 || hasImageFiles || hasVideoFiles) : (!!attachedUrl || !!attachedVideoUrl || hasImageFiles || hasVideoFiles);
    if ((!text.trim() && !hasAttachment) || submitting) return;
    setSubmitting(true);
    try {
      // コメント投稿時（postIdがある場合）は、画像と動画をmedia_urlsとして送信
      let media_urls: Array<{url: string, media_type: string, order: number, thumbnail_url?: string, width?: number, height?: number, duration?: number, file_size?: number}> = [];
      let finalBody = text;
      
      if (postId) {
        // コメント投稿時: まずファイルをアップロードしてからmedia_urlsとして送信
        setUploading(true);
        try {
          // 画像ファイルをアップロード
          for (let i = 0; i < attachedImageFiles.length; i++) {
            const file = attachedImageFiles[i];
            const fd = new FormData();
            fd.append('image', file);
            const endpoint = uploadUrl || `${API}/api/posts/${postId}/comments/image/`;
            const res = await fetch(endpoint, {
              method: 'POST',
              headers: {},
              body: fd,
              credentials: 'include',
            });
            const textRes = await res.text();
            if (!res.ok) {
              setUploadMsg(`画像アップロード失敗: ${res.status} ${textRes}`);
              return;
            }
            const data = JSON.parse(textRes);
            if (data?.image_url) {
              media_urls.push({
                url: data.image_url,
                media_type: 'image',
                order: media_urls.length,
                width: data.width,
                height: data.height,
                file_size: file.size
              });
            }
          }
          
          // 動画ファイルをアップロード
          for (let i = 0; i < attachedVideoFiles.length; i++) {
            const file = attachedVideoFiles[i];
            const fd = new FormData();
            fd.append('video', file);
            const endpoint = videoUploadUrl || `${API}/api/posts/${postId}/comments/video/`;
            const res = await fetch(endpoint, {
              method: 'POST',
              headers: {},
              body: fd,
              credentials: 'include',
            });
            const textRes = await res.text();
            if (!res.ok) {
              setUploadMsg(`動画アップロード失敗: ${res.status} ${textRes}`);
              return;
            }
            const data = JSON.parse(textRes);
            if (data?.video_url) {
              media_urls.push({
                url: data.video_url,
                media_type: 'video',
                order: media_urls.length,
                thumbnail_url: data.thumbnail_url || '',
                duration: data.duration,
                file_size: file.size
              });
            }
          }
        } finally {
          setUploading(false);
        }
        
        // 既にアップロード済みのURLも追加（後方互換性のため）
        if (multiple) {
          attachedUrls.forEach((url) => {
            media_urls.push({ url, media_type: 'image', order: media_urls.length });
          });
          attachedVideoUrls.forEach((url) => {
            media_urls.push({ url, media_type: 'video', order: media_urls.length });
          });
        } else {
          if (attachedVideoUrl) {
            media_urls.push({ url: attachedVideoUrl, media_type: 'video', order: 0 });
          } else if (attachedUrl) {
            media_urls.push({ url: attachedUrl, media_type: 'image', order: 0 });
          }
        }
      } else {
        // 投稿作成時（postIdがない場合）は、従来通りbodyに埋め込む（親コンポーネントで処理）
        const linksMulti = [...attachedUrls, ...attachedVideoUrls];
        const linkSingle = attachedVideoUrl || attachedUrl || '';
        finalBody = multiple
          ? ((linksMulti.length > 0) ? (text.trim() ? `${text}\n\n${linksMulti.join("\n")}` : linksMulti.join("\n")) : text)
          : (linkSingle ? (text.trim() ? `${text}\n\n${linkSingle}` : linkSingle) : text);
      }
      
      const payload: any = parentId ? { body: finalBody || '', parent: parentId } : { body: finalBody || '' };
      if (postId && media_urls.length > 0) {
        payload.media_urls = media_urls;
      }
      await fetch(`${API}/api/posts/${postId}/comments/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (isControlled) onChange && onChange(""); else setTextState("");
      if (multiple) {
        setAttachedUrls([]);
        setAttachedVideoUrls([]);
        setAttachedImageFiles([]);
        setAttachedVideoFiles([]);
        onAttachmentsChange && onAttachmentsChange([]);
        previewUrls.forEach(u => { if (u.startsWith('blob:')) { try { URL.revokeObjectURL(u); } catch {} } });
        previewVideoUrls.forEach(u => { if (u.startsWith('blob:')) { try { URL.revokeObjectURL(u); } catch {} } });
        setPreviewUrls([]);
        setPreviewVideoUrls([]);
      } else {
        setAttachedUrl(null);
        setAttachedVideoUrl(null);
        setAttachedImageFiles([]);
        setAttachedVideoFiles([]);
        if (previewUrl && previewUrl.startsWith('blob:')) {
          try { URL.revokeObjectURL(previewUrl); } catch {}
        }
        if (previewVideoUrl && previewVideoUrl.startsWith('blob:')) {
          try { URL.revokeObjectURL(previewVideoUrl); } catch {}
        }
        setPreviewUrl(null);
        setPreviewVideoUrl(null);
      }
      if (onSubmitted) onSubmitted();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleImagePicked(file: File) {
    if (!file) return;
    
    // ファイルサイズチェック
    if (file.size > MAX_IMAGE_SIZE) {
      setUploadMsg("画像のサイズが10MBを超えています。より小さい画像を選択してください。");
      return;
    }
    
    setUploadMsg("");
    
    // ファイルオブジェクトを保持（投稿ボタンを押した後にアップロード）
    setAttachedImageFiles(prev => [...prev, file]);
    
    // ローカルプレビュー
    try {
      const url = URL.createObjectURL(file);
      if (multiple) setPreviewUrls(prev => [...prev, url]);
      else { if (previewUrl) URL.revokeObjectURL(previewUrl); setPreviewUrl(url); }
    } catch {}
    
    setUploadMsg("画像を追加しました。投稿時にアップロードされます。");
  }

  async function handleVideoPicked(file: File) {
    if (!file) return;
    if (file.size > 100 * 1024 * 1024) {
      setUploadMsg("動画のサイズが100MBを超えています。より小さい動画を選択してください。");
      return;
    }
    setUploadMsg("");
    
    // ファイルオブジェクトを保持（投稿ボタンを押した後にアップロード）
    setAttachedVideoFiles(prev => [...prev, file]);
    
    // ローカルプレビュー
    try {
      const url = URL.createObjectURL(file);
      if (multiple) setPreviewVideoUrls(prev => [...prev, url]);
      else { if (previewVideoUrl) URL.revokeObjectURL(previewVideoUrl); setPreviewVideoUrl(url); }
    } catch {}
    
    setUploadMsg("動画を追加しました。投稿時にアップロードされます。");
  }

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) { try { URL.revokeObjectURL(previewUrl); } catch {} }
      previewUrls.forEach(u => { if (u.startsWith('blob:')) { try { URL.revokeObjectURL(u); } catch {} } });
    };
  }, [previewUrl, previewUrls]);

  // attachedUrlsとattachedVideoUrlsをrefで保持して、投稿送信時に取得できるようにする
  const attachedUrlsRef = useRef<string[]>(attachedUrls);
  const attachedVideoUrlsRef = useRef<string[]>(attachedVideoUrls);
  const attachedImageFilesRef = useRef<File[]>(attachedImageFiles);
  const attachedVideoFilesRef = useRef<File[]>(attachedVideoFiles);
  
  // refを最新の状態に同期
  useEffect(() => {
    attachedUrlsRef.current = attachedUrls;
  }, [attachedUrls]);
  
  useEffect(() => {
    attachedVideoUrlsRef.current = attachedVideoUrls;
  }, [attachedVideoUrls]);
  
  // ファイル変更を監視してrefを更新し、親コンポーネントに通知
  useEffect(() => {
    attachedImageFilesRef.current = attachedImageFiles;
    // 親コンポーネントに通知（投稿作成モードの場合のみ）
    if (multiple && !postId && onAttachedImageFilesChange) {
      // 次のレンダリングサイクルで通知
      setTimeout(() => {
        onAttachedImageFilesChange(attachedImageFiles);
      }, 0);
    }
  }, [attachedImageFiles, multiple, postId, onAttachedImageFilesChange]);
  
  useEffect(() => {
    attachedVideoFilesRef.current = attachedVideoFiles;
    // 親コンポーネントに通知（投稿作成モードの場合のみ）
    if (multiple && !postId && onAttachedVideoFilesChange) {
      // 次のレンダリングサイクルで通知
      setTimeout(() => {
        onAttachedVideoFilesChange(attachedVideoFiles);
      }, 0);
    }
  }, [attachedVideoFiles, multiple, postId, onAttachedVideoFilesChange]);
  

  // 未参加の場合はロック（参加ボタンを表示）
  const isLocked = !!(community && !community.is_member);
  // ゲストユーザーの場合、join_policy === 'open'かつ未参加の場合のみ参加ボタンを表示
  const canShowJoinButton = !isAuthenticated 
    ? (community?.join_policy === 'open' && !community?.is_member)
    : !community?.is_member;

  return (
    <div ref={containerRef} className="rounded-lg border border-subtle surface-1">
      {isLocked && canShowJoinButton ? (
        <div className="p-4 flex flex-col items-center justify-center gap-3 text-center">
          <div className="text-sm text-subtle">
            {!isAuthenticated && community?.join_policy === 'open'
              ? `${community.name || community.slug}に参加してコメントする。`
              : community?.join_policy === 'approval' 
              ? 'このアノニウムに参加申請するとコメントできます' 
              : community?.join_policy === 'login' && !isAuthenticated
              ? 'このアノニウムにコメントするにはログインが必要です'
              : `${community?.name || community?.slug || 'このアノニウム'}に参加してコメントする。`}
          </div>
          {onJoinCommunity && (
            <button
              onClick={onJoinCommunity}
              className="px-4 py-2 rounded-md bg-accent text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {community?.join_policy === 'approval' ? '参加申請' : '参加する'}
            </button>
          )}
        </div>
      ) : isLocked && !canShowJoinButton ? (
        <div className="p-4 flex flex-col items-center justify-center gap-3 text-center">
          <div className="text-sm text-subtle">
            {community?.join_policy === 'login' && !isAuthenticated
              ? 'このアノニウムにコメントするにはログインが必要です'
              : 'このアノニウムに参加するとコメントできます'}
          </div>
        </div>
      ) : (
        <>
          {activeTool === 'poll' && enablePollMode ? (
            <div className="px-3 py-3">
              <PollEditor
                pollTitle={pollTitle}
                pollOptions={pollOptions}
                onTitleChange={(title) => onPollTitleChange && onPollTitleChange(title)}
                onOptionsChange={(options) => onPollOptionsChange && onPollOptionsChange(options)}
                onExpiresChange={(v) => onPollExpiresChange && onPollExpiresChange(v)}
              />
            </div>
          ) : (
            <div className="relative">
              <textarea
                className="w-full bg-transparent px-3 py-3 text-sm focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                rows={5}
                placeholder={placeholder}
                value={text}
                ref={textAreaRef}
                onChange={(e) => { 
                  isControlled ? (onChange && onChange(e.target.value)) : setTextState(e.target.value);
                  setCursorPos(e.target.selectionStart);
                }}
                onSelect={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  setCursorPos(target.selectionStart);
                }}
                onKeyDown={handleKeyDown}
                disabled={isLocked}
              />
            </div>
          )}
          {/* toolbar below the textarea */}
          <div className="px-3 py-2 md:pb-3 flex items-center gap-2 border-t border-subtle">
              <button
                type="button"
                className={`inline-flex items-center justify-center w-7 h-7 md:w-8 md:h-8 rounded-md border ${activeMode === 'list' ? 'border-white/40 bg-white/10 text-white' : 'border-subtle surface-2 text-subtle'} hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed`}
                title="箇条書きリスト"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleListFormat(); }}
                disabled={isLocked}
              >
                <span className="material-symbols-rounded text-base md:text-lg" aria-hidden>format_list_bulleted</span>
              </button>
              <button
                type="button"
                className={`inline-flex items-center justify-center w-7 h-7 md:w-8 md:h-8 rounded-md border ${activeMode === 'quote' ? 'border-white/40 bg-white/10 text-white' : 'border-subtle surface-2 text-subtle'} hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed`}
                title="引用"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleQuoteFormat(); }}
                disabled={isLocked}
              >
                <span className="material-symbols-rounded text-base md:text-lg" aria-hidden>format_quote</span>
              </button>
              <button
                type="button"
                className={`hidden md:inline-flex items-center justify-center w-7 h-7 md:w-8 md:h-8 rounded-md border ${activeTool === 'code' ? 'border-white/40 bg-white/10 text-white' : 'border-subtle surface-2 text-subtle'} hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed`}
                title={activeTool === 'code' ? "コードエディタを閉じる" : "コードエディタを開く"}
                onClick={() => {
                  if (activeTool === 'code') {
                    setActiveTool(null);
                  } else {
                    setActiveTool('code');
                  }
                }}
                disabled={isLocked}
              >
                <span className="material-symbols-rounded text-base md:text-lg" aria-hidden>code</span>
              </button>
              {enablePollMode && (
                <button
                  type="button"
                  className={`inline-flex items-center justify-center w-7 h-7 md:w-8 md:h-8 rounded-md border ${activeTool === 'poll' ? 'border-white/40 bg-white/10 text-white' : 'border-subtle surface-2 text-subtle'} hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed`}
                  title={activeTool === 'poll' ? "投票エディタを閉じる" : "投票エディタを開く"}
                  onClick={togglePollFormat}
                  disabled={isLocked}
                >
                  <span className="material-symbols-rounded text-base md:text-lg" aria-hidden>how_to_vote</span>
                </button>
              )}
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                multiple={multiple}
                className="hidden"
                onChange={(e) => {
                  const files = e.target.files ? Array.from(e.target.files) : [];
                  if (!files.length) return;
                  (async () => {
                    for (const f of files) {
                      await handleImagePicked(f);
                    }
                  })();
                  if (imageInputRef.current) imageInputRef.current.value = '';
                }}
                disabled={isLocked}
              />
              {(!videoUploadUrl && !postId) ? null : (
              <button
                type="button"
                className="inline-flex items-center justify-center w-7 h-7 md:w-8 md:h-8 rounded-md border border-subtle surface-2 text-subtle hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
                title="動画を挿入"
                onClick={() => videoInputRef.current?.click()}
                disabled={isLocked}
              >
                <span className="material-symbols-rounded text-base md:text-lg" aria-hidden>movie</span>
              </button>
              )}
              <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                multiple={multiple}
                className="hidden"
                onChange={(e) => {
                  const files = e.target.files ? Array.from(e.target.files) : [];
                  if (!files.length) return;
                  (async () => {
                    for (const f of files) {
                      await handleVideoPicked(f);
                    }
                  })();
                  if (videoInputRef.current) videoInputRef.current.value = '';
                }}
                disabled={isLocked}
              />
              {(!uploadUrl && !postId) ? null : (
              <button
                type="button"
                className="inline-flex items-center justify-center w-7 h-7 md:w-8 md:h-8 rounded-md border border-subtle surface-2 text-subtle hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
                title="画像を挿入"
                onClick={() => imageInputRef.current?.click()}
                disabled={isLocked}
              >
                <span className="material-symbols-rounded text-base md:text-lg" aria-hidden>image</span>
              </button>
              )}
              <button
                type="button"
                className="inline-flex items-center justify-center w-7 h-7 md:w-8 md:h-8 rounded-md border border-subtle surface-2 text-subtle hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
                title="スタンプ"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  // モック: スタンプツールの処理（今後実装予定）
                  console.log("スタンプツールを開く（モック）");
                }}
                disabled={isLocked}
              >
                <span className="material-symbols-rounded text-base md:text-lg" aria-hidden>emoji_emotions</span>
              </button>
              {/* 右側: 文字数カウンター */}
              <div className="ml-auto text-[10px] md:text-xs tabular-nums select-none">
                <span className={`${isOverLimit ? 'text-red-400' : (remaining <= 200 ? 'text-yellow-300' : 'text-subtle')}`}>
                  残り {remaining >= 0 ? remaining : 0} 文字{isOverLimit ? '（超過）' : ''}
                </span>
              </div>
              {hideSubmitButton ? null : (
              isNarrow ? (
                // 表示幅が狭い時はアイコン付き丸ボタン
                <button
                  type="button"
                  className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-accent text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={(!text.trim() && !attachedUrl && previewUrls.length===0 && previewVideoUrls.length===0 && !attachedVideoUrl && attachedImageFiles.length===0 && attachedVideoFiles.length===0) || submitting || isLocked || isOverLimit}
                  onClick={submit}
                  title={buttonLabel}
                >
                  <span className="material-symbols-rounded text-lg" aria-hidden>send</span>
                </button>
              ) : (
                // 表示幅が広い時は通常のボタン
                <button
                  type="button"
                  className="inline-flex items-center justify-center h-7 md:h-8 px-2 md:px-3 text-sm md:text-base rounded-md bg-accent text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={(!text.trim() && !attachedUrl && previewUrls.length===0 && previewVideoUrls.length===0 && !attachedVideoUrl && attachedImageFiles.length===0 && attachedVideoFiles.length===0) || submitting || isLocked || isOverLimit}
                  onClick={submit}
                >
                  {buttonLabel}
                </button>
              )
              )}
            </div>
          {(((multiple ? (previewUrls.length + previewVideoUrls.length) > 0 : (!!previewUrl || !!previewVideoUrl)) ) || uploadMsg) && (
        <div className="px-3 pb-2">
          {multiple ? (
            <div className="mt-2 grid grid-cols-3 gap-2">
              {[...previewUrls, ...previewVideoUrls].map((u, i) => (
                /(\.mp4|\.webm|\.mov)(\?.*)?$/i.test(u) ? (
                  <video key={`${u}-${i}`} src={u} className="rounded-md border border-subtle w-full" style={{ height: 100, objectFit: 'cover' }} controls muted={false} />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={`${u}-${i}`} src={u} alt={`preview-${i}`} className="rounded-md border border-subtle object-contain w-full" style={{ height: 100 }} />
                )
              ))}
            </div>
          ) : (
            previewVideoUrl ? (
              <video src={previewVideoUrl} className="mt-2 rounded-md border border-subtle" style={{ height: 150, width: 'auto' }} controls muted={false} />
            ) : (previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="preview" className="mt-2 rounded-md border border-subtle object-contain" style={{ height: 150, width: 'auto' }} />
            ) : null)
          )}
          {uploadMsg && (
            <div className="text-xs text-subtle mt-2">{uploadMsg}{uploading ? '（アップロード中）' : ''}</div>
            )}
          </div>
          )}
          {activeTool === 'code' && (
            <div className="px-3 pb-2">
              <CodeBlockEditor onInsert={(code, lang) => insertFencedCode(code, lang)} />
            </div>
          )}
          {activeTool === 'list' && (
            <div className="px-3 pb-2">
              <ListEditor onInsert={(items) => insertList(items)} />
            </div>
          )}
          {activeTool === 'quote' && (
            <div className="px-3 pb-2">
              <QuoteEditor onInsert={(text) => insertQuote(text)} />
            </div>
          )}
        </>
      )}
    </div>
  );
}


