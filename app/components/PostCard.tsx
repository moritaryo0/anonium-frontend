import { useState, useEffect, useRef, useCallback, MouseEvent, useMemo } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import LinkPreview from "./LinkPreview";
import ImageModal from "./ImageModal";
import ReportModal from "./ReportModal";
import { linkify } from "./Linkify";
import RichText from "./RichText";
import PostMenu, { MenuItem } from "./PostMenu";

type PostMedia = {
  id: number;
  media_type: 'image' | 'video';
  url: string;
  thumbnail_url?: string;
  width?: number | null;
  height?: number | null;
  duration?: number | null;
  file_size?: number | null;
  order: number;
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
  media?: PostMedia[] | null;
  is_following?: boolean;
};

function timeAgo(iso: string): string {
  const now = Date.now();
  const past = new Date(iso).getTime();
  const diff = Math.max(0, now - past);
  const m = 60 * 1000;
  const h = 60 * m;
  const d = 24 * h;
  if (diff < m) return `${Math.floor(diff / 1000)}秒前`;
  if (diff < h) return `${Math.floor(diff / m)}分前`;
  if (diff < d) return `${Math.floor(diff / h)}時間前`;
  return `${Math.floor(diff / d)}日前`;
}

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

function remainingText(expiresIso?: string | null): { text: string; expired: boolean } {
  if (!expiresIso) return { text: "期限: 無制限", expired: false };
  const now = Date.now();
  const end = new Date(expiresIso).getTime();
  const diff = end - now;
  if (diff <= 0) return { text: "締切", expired: true };
  const s = Math.floor(diff / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}日`);
  if (h > 0 || d > 0) parts.push(`${h}時間`);
  if (m > 0 || h > 0 || d > 0) parts.push(`${m}分`);
  parts.push(`${sec}秒`);
  return { text: `残り ${parts.join(' ')}`, expired: false };
}

type CommunityInfo = {
  id?: number;
  slug?: string;
  membership_role?: string | null;
  is_member?: boolean;
  clip_post_id?: number | null;
  join_policy?: string;
  karma?: number;
};

export default function PostCard({ post: initialPost, inVillage = false, accessToken, onVoted, showAuthor = true, canModerate = false, onDeleted, disableLink = false, community, currentUsername, guestScore, isAuthenticated: propIsAuthenticated }: { post: Post; inVillage?: boolean; accessToken?: string; onVoted?: () => void; showAuthor?: boolean; canModerate?: boolean; onDeleted?: () => void; disableLink?: boolean; community?: CommunityInfo | null; currentUsername?: string; guestScore?: number | null; isAuthenticated?: boolean }) {
  const pathname = usePathname();
  // ホームページまたはサーチページの場合はコミュニティ情報を表示、それ以外は投稿者情報を表示
  const isHomeOrSearchPage = pathname === '/' || pathname === '/search';
  
  const [post, setPost] = useState<Post>(initialPost);
  useEffect(() => {
    setPost(initialPost);
  }, [initialPost]);

  const isAuthenticated = propIsAuthenticated !== undefined ? propIsAuthenticated : !!accessToken;
  const postId = initialPost.id;
  // 参加状態をローカルで管理（参加ボタンクリック後に即座に更新するため）
  const [localIsMember, setLocalIsMember] = useState<boolean | null>(null);
  const [localMembershipRole, setLocalMembershipRole] = useState<string | null>(null);
  
  // canModerateプロップとpost.can_moderateの両方をチェック
  const hasModeratePermission = canModerate || !!post.can_moderate;
  // 自分の投稿かどうかを判定（author_username_idとcurrentUsernameを比較）
  const isOwnPost = !!(post.author_username_id && currentUsername && post.author_username_id === currentUsername);
  // コミュニティ情報の取得: postオブジェクトから直接取得するか、community propから取得
  // ローカル状態があればそれを優先（参加ボタンクリック後の即時更新のため）
  const membershipRole = localMembershipRole ?? community?.membership_role ?? post.community_membership_role ?? null;
  const isMemberFromPost = post.community_is_member !== undefined ? post.community_is_member : false;
  // メンバーシップの判定: community.is_member または post.community_is_member が true である必要がある
  // membershipRole のみでは不十分（メンバーでない場合も role が設定される可能性があるため）
  const computedIsMember = (() => {
    // ローカル状態が設定されている場合はそれを使用
    if (localIsMember !== null) {
      return localIsMember;
    }
    // communityプロップから判定（優先）
    if (community?.is_member !== undefined) {
      return community.is_member === true;
    }
    // postオブジェクトから判定（フォールバック）
    return isMemberFromPost === true;
  })();
  const isMember = computedIsMember;
  const isOwner = membershipRole === 'owner';
  const isAdminMod = membershipRole === 'admin_moderator';
  const isModerator = membershipRole === 'moderator';
  const canMuteCommunity = !isOwner && !isAdminMod && !isModerator; // 一般ユーザーのみコミュニティをミュート可能
  const isClipped = community?.clip_post_id === post.id; // このポストが固定されているか
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [cardWidth, setCardWidth] = useState<number>(0);
  // 常に投稿者名を表示（slugの代わりに投稿者名を使用）
  const primaryBadge = post.author_username || post.author_username_id || `user #${post.author}`;
  const primaryHref = undefined; // 投稿者名はリンクなしで表示
  const communityIconUrl = undefined; // コミュニティアイコンは使用しない
  // 投稿者アイコンを使用
  const authorIconUrl = post.author_icon_url ? post.author_icon_url : undefined;

  const reloadPost = useCallback(async () => {
    try {
      const resp = await fetch(`${API}/api/posts/${postId}/`, {
        credentials: 'include',
      });
      if (resp.ok) {
        const data: Post = await resp.json();
        setPost(data);
      } else if (resp.status === 404) {
        setPost(prev => ({ ...prev, is_deleted: true }));
      }
    } catch (error) {
      console.error('ポストの再読み込みに失敗しました:', error);
    }
  }, [postId]);

  const [score, setScore] = useState<number>(post.score ?? 0);
  const [userVote, setUserVote] = useState<number | null>(post.user_vote ?? null);
  const [isFollowing, setIsFollowing] = useState<boolean>(post.is_following ?? false);
  const commentsCount = post.comments_count ?? 0;
  const [bump, setBump] = useState<boolean>(false);
  const [countDir, setCountDir] = useState<"up"|"down"|null>(null);
  const [arrowBounce, setArrowBounce] = useState<"up"|"down"|null>(null);
  const prevScoreRef = useRef<number>(post.score ?? 0);
  // 投票の状態管理
  const [pollData, setPollData] = useState<Post['poll']>(post.poll ?? null);
  const [pollVoting, setPollVoting] = useState<boolean>(false);
  // メディアタイプの投稿の場合は、post.mediaから取得
  // テキストタイプの投稿の場合は、bodyからURLを抽出（後方互換性のため）
  const postMedia: PostMedia[] = post.media && Array.isArray(post.media) ? post.media : [];
  const imageMedia = postMedia.filter(m => m.media_type === 'image');
  const videoMedia = postMedia.filter(m => m.media_type === 'video');
  
  // 後方互換性: bodyからURLを抽出（post_typeがtextまたは未設定の場合のみ）
  const firstUrl = (() => {
    if (postMedia.length > 0) return ""; // メディアタイプの場合は無視
    if (!post.body) return "";
    const m = post.body.match(/https?:\/\/[^\s]+/i);
    return m ? m[0] : "";
  })();
  const imageUrls: string[] = (() => {
    if (imageMedia.length > 0) return []; // メディアタイプの場合は無視
    if (!post.body) return [];
    const urls = post.body.match(/https?:\/\/[^\s]+/gi) || [];
    return urls.filter(u => /\.(png|jpe?g|gif|webp)(\?.*)?$/i.test(u));
  })();
  const videoUrls: string[] = (() => {
    if (videoMedia.length > 0) return []; // メディアタイプの場合は無視
    if (!post.body) return [];
    const urls = post.body.match(/https?:\/\/[^\s]+/gi) || [];
    return urls.filter(u => /\.(mp4|webm|mov)(\?.*)?$/i.test(u));
  })();
  
  // メディアタイプの投稿の場合、画像/動画のURLリスト
  const mediaImageUrls = imageMedia.map(m => m.url);
  const mediaVideoUrls = videoMedia.map(m => m.url);
  
  // 表示用の画像/動画URL（メディアタイプ優先、フォールバックはbodyから抽出）
  const displayImageUrls = mediaImageUrls.length > 0 ? mediaImageUrls : imageUrls;
  const displayVideoUrls = mediaVideoUrls.length > 0 ? mediaVideoUrls : videoUrls;
  const [preview, setPreview] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [currentIdx, setCurrentIdx] = useState<number>(0);
  const [timeText, setTimeText] = useState<string>("");
  const [moreOpen, setMoreOpen] = useState<boolean>(false);
  const [menuMount, setMenuMount] = useState<boolean>(false);
  const [menuVisible, setMenuVisible] = useState<boolean>(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editTitle, setEditTitle] = useState<string>(post.title);
  const [editBody, setEditBody] = useState<string>(post.body || '');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [reportModal, setReportModal] = useState<{ isOpen: boolean; onConfirm: (reason: string) => void }>({ isOpen: false, onConfirm: () => {} });

  useEffect(() => {
    const el = cardRef.current;
    if (!el || typeof window === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry && entry.contentRect) setCardWidth(entry.contentRect.width);
    });
    ro.observe(el);
    // 初期幅
    try { setCardWidth(el.getBoundingClientRect().width); } catch {}
    return () => { try { ro.disconnect(); } catch {} };
  }, []);

  const computedImageHeight = (() => {
    // カード幅に応じて高さを算出（比率維持のための上限）
    // 目安: 幅の 0.45 倍、最小 160px、最大 360px
    const base = Math.round(cardWidth * 0.45);
    const clamped = Math.max(160, Math.min(360, base || 260));
    return clamped;
  })();

  function scrollToIndex(next: number) {
    if (!scrollerRef.current) return;
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
    const target = clamp(next, 0, Math.max(0, displayImageUrls.length - 1));
    const width = scrollerRef.current.clientWidth;
    scrollerRef.current.scrollTo({ left: target * width, behavior: 'smooth' });
    setCurrentIdx(target);
  }
  const bodyWithoutImages = (() => {
    // メディアタイプの投稿の場合は、bodyをそのまま返す（本文とメディアは分離されている）
    if (postMedia.length > 0 || post.post_type === 'image' || post.post_type === 'video') {
      return post.body || '';
    }
    // テキストタイプの投稿の場合は、bodyからURLを除去（後方互換性）
    let s = post.body || '';
    if (!s) return s;
    imageUrls.forEach((u) => { s = s.split(u).join(''); });
    videoUrls.forEach((u) => { s = s.split(u).join(''); });
    return s.trim();
  })();
  const [showFullBody, setShowFullBody] = useState<boolean>(false);
  const BODY_TRUNCATE = 255;
  const needsTruncate = (bodyWithoutImages || '').length > BODY_TRUNCATE;
  const displayBody = showFullBody || !needsTruncate
    ? bodyWithoutImages
    : (bodyWithoutImages || '').slice(0, BODY_TRUNCATE);

  useEffect(() => {
    setScore(post.score ?? 0);
    setUserVote(post.user_vote ?? null);
    setPollData(post.poll ?? null);
    setIsFollowing(post.is_following ?? false);
    if (typeof post.score === 'number') {
      const prev = prevScoreRef.current;
      const curr = post.score;
      if (curr > prev) setCountDir('up'); else if (curr < prev) setCountDir('down'); else setCountDir(null);
      prevScoreRef.current = curr;
      setBump(true);
      const t = setTimeout(() => { setBump(false); setCountDir(null); }, 240);
      return () => clearTimeout(t);
    }
  }, [post.score, post.user_vote, post.poll, post.is_following]);

  useEffect(() => {
    // Compute relative time on client to avoid SSR/CSR mismatch
    try { setTimeText(timeAgo(post.created_at)); } catch {}
  }, [post.created_at]);

  // ゲストユーザーが投票可能かどうかを判定
  const effectiveJoinPolicy = community?.join_policy ?? post.community_join_policy ?? null;
  const requiredKarma = community?.karma ?? post.community_karma ?? 0;
  const canGuestVote = (() => {
    if (isAuthenticated) return false; // ログイン済みユーザーはメンバーシップチェックで判定
    // コミュニティに属していない投稿の場合は投票不可
    if (!post.community_id && !post.community_slug) return false;
    // 参加ポリシーの情報が不足している場合は投票不可（判定できないため無効化）
    if (effectiveJoinPolicy === null || effectiveJoinPolicy === undefined) return false;
    // 参加ポリシーがopenでない場合は投票不可
    if (effectiveJoinPolicy !== 'open') return false;
    // ゲストユーザーの場合もメンバーシップチェックが必要
    // メンバーシップ情報が不足している場合は投票不可（判定できないため無効化）
    if (isMember === false) return false; // 明示的にfalseの場合は投票不可
    if (isMember !== true) return false; // trueでない場合（undefined/null）も投票不可
    // メンバーシップがある場合、スコアチェック
    const karma = requiredKarma ?? 0;
    if (karma === 0) return true; // karmaが0の場合は常に許可
    const userScore = guestScore ?? 0;
    return userScore >= karma; // スコアがkarma以上の場合に許可
  })();

  // ログインユーザーが投票可能かどうかを判定（コミュニティメンバーである必要がある）
  const canVote = (() => {
    // 投稿が削除されている場合は不可
    if (post.is_deleted) return false;
    // コミュニティに属していない投稿の場合は投票不可
    if (!post.community_id && !post.community_slug) return false;
    if (isAuthenticated) {
      // ログインユーザーの場合、メンバーシップ情報が不足している場合は投票不可（判定できないため無効化）
      // isMemberはcomputedIsMemberから取得されており、情報が不足している場合はfalseになる
      return isMember === true;
    } else {
      // ゲストユーザーの場合、canGuestVoteで判定
      return canGuestVote;
    }
  })();

  async function vote(value: 1 | -1) {
    // クリック時に即座にアニメーションを発動
    setArrowBounce(value === 1 ? 'up' : 'down');
    setTimeout(() => setArrowBounce(null), 200);
    // optimistic update（現在の値を保存してロールバックに備える）
    const prevVote = userVote;
    const prevScore = score;
    let delta: number = value;
    if (prevVote === value) {
      // toggle off
      delta = -value;
      setUserVote(null);
      setScore((s) => s + delta);
    } else if (prevVote && prevVote !== value) {
      // switch
      delta = value - prevVote;
      setUserVote(value);
      setScore((s) => s + delta);
    } else {
      // first vote
      setUserVote(value);
      setScore((s) => s + value);
    }
    setCountDir(delta > 0 ? 'up' : (delta < 0 ? 'down' : null));
    setBump(true);
    setTimeout(() => { setBump(false); setCountDir(null); }, 240);

    try {
      const resp = await fetch(`${API}/api/posts/${post.id}/vote/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ value: value === 1 ? 'good' : 'bad' }),
      });
      if (resp.ok) {
        const data = await resp.json().catch(() => null);
        if (data && typeof data.score === 'number') setScore(data.score);
        if (data && (data.user_vote === 1 || data.user_vote === -1 || data.user_vote === null)) setUserVote(data.user_vote);
        // いいね/バッドの投票はoptimistic updateで完結するため、onVotedは呼ばない
      } else {
        // エラーの場合、optimistic updateをロールバック
        const errorData = await resp.json().catch(() => null);
        setUserVote(prevVote);
        setScore(prevScore);
        console.error('投票エラー:', errorData?.detail || `投票に失敗しました (${resp.status})`);
      }
    } catch (e) {
      // ネットワークエラーの場合、optimistic updateをロールバック
      setUserVote(prevVote);
      setScore(prevScore);
      console.error('投票エラー:', e);
    }
  }

  const upActive = userVote === 1;
  const downActive = userVote === -1;

  // 投票機能（投票済みの場合は変更不可）
  async function handlePollVote(optionId: number) {
    if (!pollData || pollVoting) return;
    // 既に投票済みの場合は何もしない
    if (pollData.user_vote_id !== null && pollData.user_vote_id !== undefined) return;
    // 期限切れなら不可
    if (pollData.expires_at && new Date(pollData.expires_at).getTime() <= Date.now()) return;
    // メンバーでない場合は何もしない
    if (!isMember) return;
    
    // セキュリティ対策: JWTトークンはCookieから自動的に送信される

    setPollVoting(true);
    // optimistic update（新規投票のみ）
    const prevOptions = [...pollData.options];
    const optionIdx = prevOptions.findIndex(opt => opt.id === optionId);
    
    // 新規投票のみ許可
    setPollData({
      ...pollData,
      user_vote_id: optionId,
      options: prevOptions.map((opt, idx) => 
        idx === optionIdx ? { ...opt, vote_count: opt.vote_count + 1 } : opt
      )
    });

    try {
      let resp = await fetch(`${API}/api/polls/${pollData.id}/vote/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ option_id: optionId }),
      });
      if (resp.ok) {
        const data = await resp.json().catch(() => null);
        if (data && data.selected_option_id !== undefined) {
          // サーバーから最新のデータを取得するためにポストを再読み込み
          if (onVoted) onVoted();
        }
      } else {
        // 失敗時はロールバック
        setPollData({
          ...pollData,
          options: prevOptions,
          user_vote_id: null,
        });
      }
    } catch (e) {
      // 失敗時はロールバック
      setPollData({
        ...pollData,
        options: prevOptions,
        user_vote_id: null,
      });
    } finally {
      setPollVoting(false);
    }
  }

  // close on outside click
  useEffect(() => {
    if (!menuMount) return;
    function onDocClick() { setMenuVisible(false); setTimeout(() => setMenuMount(false), 150); }
    document.addEventListener('click', onDocClick);
    function onScrollOrResize() {
      if (!triggerRef.current) return;
      const r = triggerRef.current.getBoundingClientRect();
      setMenuPos({ top: Math.round(r.bottom + 6), left: Math.round(r.right - 224) }); // 224px ~= min-w-56
    }
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize, true);
    // 初期座標確定
    onScrollOrResize();
    return () => {
      document.removeEventListener('click', onDocClick);
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize, true);
    };
  }, [menuMount]);

  const handleCardClick = useCallback((event: MouseEvent<HTMLDivElement>) => {
    if (disableLink || event.defaultPrevented) return;
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (target.closest('a, button, input, textarea, select, label, video, audio, [role="menu"], [role="menuitem"], [data-ignore-card-click="true"]')) {
      return;
    }
    window.location.href = `/p/${post.id}`;
  }, [disableLink, post.id]);

  // メニューを閉じる共通関数
  const closeMenu = useCallback(() => {
    setMenuVisible(false);
    setTimeout(() => setMenuMount(false), 150);
    setMoreOpen(false);
  }, []);

  // セキュリティ対策: JWTトークンはCookieから自動的に送信されるため、トークン取得関数は不要
  // トークンリフレッシュ処理もバックエンドで自動的に処理される
  const callApiWithRefresh = useCallback(async (
    url: string,
    options: RequestInit = {}
  ): Promise<Response> => {
    // セキュリティ対策: JWTトークンはCookieから自動的に送信される
    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });
  }, []);

  // メニュー項目を動的に生成
  const menuItems = useMemo<MenuItem[]>(() => {
    const items: MenuItem[] = [];

    // 削除（自分の投稿、またはオーナー/管理モデレータ/モデレータ）
    if (isOwnPost || isOwner || isAdminMod || isModerator) {
      items.push({
        id: 'delete',
        label: '削除',
        icon: 'delete',
        show: true,
        onClick: async () => {
          // セキュリティ対策: JWTトークンはCookieから自動的に送信される
          if (!window.confirm('この投稿を削除しますか？')) return;
          try {
            const resp = await fetch(`${API}/api/posts/${post.id}/`, {
              method: 'DELETE',
              credentials: 'include',
            });
            if (resp.status === 204) {
              await reloadPost();
              if (onDeleted) onDeleted();
            } else {
              const t = await resp.text();
              alert(t || `削除に失敗しました (${resp.status})`);
            }
          } catch {
            alert('削除に失敗しました。');
          }
        },
        divider: false,
      });
    }

    // 編集（自分の投稿のみ）
    if (isOwnPost) {
      items.push({
        id: 'edit',
        label: '編集',
        icon: 'edit',
        show: true,
        onClick: () => {
          setIsEditing(true);
          setEditTitle(post.title);
          setEditBody(post.body || '');
        },
        divider: false,
      });
    }

    // 固定（オーナー/管理モデレータ）
    if ((isOwner || isAdminMod) && (post.community_id || post.community_slug)) {
      items.push({
        id: 'pin',
        label: () => isClipped ? '固定解除' : 'アノニウムに固定',
        icon: 'push_pin',
        show: true,
        onClick: async () => {
          // セキュリティ対策: JWTトークンはCookieから自動的に送信される
          try {
            const method = isClipped ? 'DELETE' : 'POST';
            const communityId = post.community_id || post.community_slug;
            const resp = await fetch(`${API}/api/communities/${communityId}/posts/${post.id}/clip/`, {
              method,
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
            });
            if (resp.ok) {
              const data = await resp.json().catch(() => null);
              alert(data?.detail || (isClipped ? '固定を解除しました。' : 'ポストを固定しました。'));
              if (onDeleted) onDeleted();
            } else {
              const t = await resp.text();
              alert(t || `操作に失敗しました (${resp.status})`);
            }
          } catch {
            alert('操作に失敗しました。');
          }
        },
        divider: false,
      });
    }

    // オーナー/管理モデレータ専用メニュー（他人の投稿の場合のみ）
    if (!isOwnPost && (isOwner || isAdminMod) && (post.community_id || post.community_slug)) {
      // ユーザーをブロック
      if (post.author_username) {
        items.push({
          id: 'block-user',
          label: 'ユーザーをブロック',
          icon: 'block',
          show: true,
          onClick: async () => {
            // セキュリティ対策: JWTトークンはCookieから自動的に送信される
            // 認証状態はAPIレスポンスで確認（401が返される場合）
            if (!window.confirm(`ユーザー「${post.author_username}」をこのアノニウムからブロックしますか？`)) return;
            const reason = prompt('ブロック理由を入力してください（任意）') || '';
            try {
              const communityId = post.community_id;
              if (!communityId) { alert('コミュニティIDを取得できませんでした。'); return; }
              const targetUserId = post.author;
              if (!targetUserId) { alert('ユーザーIDを取得できませんでした。'); return; }
              const resp = await fetch(`${API}/api/communities/${communityId}/members/${targetUserId}/block/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ reason }),
              });
              if (resp.ok) {
                const data = await resp.json().catch(() => null);
                alert(data?.detail || 'ブロックしました。');
                if (onDeleted) onDeleted();
              } else {
                const t = await resp.text();
                alert(t || `ブロックに失敗しました (${resp.status})`);
              }
            } catch {
              alert('ブロックに失敗しました。');
            }
          },
          divider: false,
        });
      }

      // 除名
      items.push({
        id: 'remove-member',
        label: '除名',
        icon: 'person_remove',
        show: true,
          onClick: async () => {
            // セキュリティ対策: JWTトークンはCookieから自動的に送信される
            // 認証状態はAPIレスポンスで確認（401が返される場合）
            if (!window.confirm(`ユーザー「${post.author_username}」をこのアノニウムから除名しますか？`)) return;
          try {
            const communityId = post.community_id;
            if (!communityId) { alert('コミュニティIDを取得できませんでした。'); return; }
            const targetUserId = post.author;
            if (!targetUserId) { alert('ユーザーIDを取得できませんでした。'); return; }
            const resp = await fetch(`${API}/api/communities/${communityId}/members/${targetUserId}/remove/`, {
              method: 'POST',
              credentials: 'include',
            });
            if (resp.ok) {
              alert('除名しました。');
              if (onDeleted) onDeleted();
            } else {
              const t = await resp.text();
              alert(t || `除名に失敗しました (${resp.status})`);
            }
          } catch {
            alert('除名に失敗しました。');
          }
        },
        divider: false,
      });

      // このユーザーをミュート（オーナー/管理モデレータ）
      items.push({
        id: 'mute-user-admin',
        label: 'このユーザーをミュート',
        icon: 'voice_over_off',
        show: true,
        onClick: async () => {
          // セキュリティ対策: JWTトークンはCookieから自動的に送信される
          try {
            const resp = await fetch(`${API}/api/accounts/mute/`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ target_username: post.author_username_id || post.author_username }),
            });
            if (resp.ok) {
              const j = await resp.json().catch(() => null);
              alert(j?.detail || 'ミュートしました。');
            } else {
              if (resp.status === 401) {
                alert('ログインが必要です。');
                return;
              }
              const t = await resp.text();
              alert(t || `ミュートに失敗しました (${resp.status})`);
            }
          } catch {
            alert('ミュートに失敗しました。');
          }
        },
        divider: false,
      });
    }

    // モデレータ専用メニュー（他人の投稿の場合のみ）
    if (!isOwnPost && isModerator && post.author_username) {
      // ユーザーを通報
      items.push({
        id: 'report-user-moderator',
        label: 'ユーザーを通報',
        icon: 'flag',
        show: true,
        onClick: async () => {
          // セキュリティ対策: JWTトークンはCookieから自動的に送信される
          const reason = prompt('ユーザーを通報する理由を入力してください（任意）') || '';
          try {
            const resp = await fetch(`${API}/api/accounts/report/`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ target_username: post.author_username_id || post.author_username, reason }),
            });
            if (resp.ok || resp.status === 202) {
              alert('通報を受け付けました。');
            } else {
              const t = await resp.text();
              alert(t || `通報に失敗しました (${resp.status})`);
            }
          } catch {
            alert('通報に失敗しました。');
          }
        },
        divider: false,
      });

      // このユーザーをミュート（モデレータ）
      items.push({
        id: 'mute-user-moderator',
        label: 'このユーザーをミュート',
        icon: 'voice_over_off',
        show: true,
        onClick: async () => {
          // セキュリティ対策: JWTトークンはCookieから自動的に送信される
          try {
            const resp = await fetch(`${API}/api/accounts/mute/`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ target_username: post.author_username_id || post.author_username }),
            });
            if (resp.ok) {
              const j = await resp.json().catch(() => null);
              alert(j?.detail || 'ミュートしました。');
            } else {
              if (resp.status === 401) {
                alert('ログインが必要です。');
                return;
              }
              const t = await resp.text();
              alert(t || `ミュートに失敗しました (${resp.status})`);
            }
          } catch {
            alert('ミュートに失敗しました。');
          }
        },
        divider: false,
      });
    }

    // 一般ユーザー向けメニュー（他人の投稿の場合のみ）
    if (!isOwnPost) {
      // 報告
      items.push({
        id: 'report-post',
        label: '報告',
        icon: 'flag',
        show: true,
        onClick: () => {
          // セキュリティ対策: JWTトークンはCookieから自動的に送信される
          const communityId = post.community_id || post.community_slug;
          if (!communityId) { alert('アノニウム情報がありません。'); return; }
          setReportModal({
            isOpen: true,
            onConfirm: async (reason: string) => {
              setReportModal({ isOpen: false, onConfirm: () => {} });
              try {
                const communityResp: Response = await fetch(`${API}/api/communities/${communityId}/`, {
                  credentials: 'include',
                });
                if (!communityResp.ok) {
                  throw new Error('アノニウム情報の取得に失敗しました。');
                }
                const communityData: { id: number } = await communityResp.json();
                const communityIdFromData: number = communityData.id;

                const resp = await fetch(`${API}/api/messages/reports/`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  credentials: 'include',
                  body: JSON.stringify({
                    community_id: communityIdFromData,
                    post_id: post.id,
                    body: reason,
                  }),
                });

                if (resp.ok || resp.status === 201) {
                  alert('報告を受け付けました。');
                } else {
                  const errorData = await resp.json().catch(() => null);
                  alert(errorData?.detail || errorData?.message || `報告に失敗しました (${resp.status})`);
                }
              } catch (error) {
                alert(error instanceof Error ? error.message : '報告に失敗しました。');
              }
            },
          });
        },
        divider: false,
      });

      // このユーザーをミュート（一般ユーザー）
      if (!isModerator && !isAdminMod && !isOwner && post.author_username) {
        items.push({
          id: 'mute-user-general',
          label: 'このユーザーをミュート',
          icon: 'voice_over_off',
          show: true,
          onClick: async () => {
            // セキュリティ対策: JWTトークンはCookieから自動的に送信される
            try {
              const resp = await fetch(`${API}/api/accounts/mute/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ target_username: post.author_username_id || post.author_username }),
              });
              if (resp.ok) {
                const j = await resp.json().catch(() => null);
                alert(j?.detail || 'ミュートしました。');
              } else {
                const t = await resp.text();
                alert(t || `ミュートに失敗しました (${resp.status})`);
              }
            } catch {
              alert('ミュートに失敗しました。');
            }
          },
          divider: false,
        });
      }

      // コミュニティをミュート（一般ユーザーのみ）
      if (canMuteCommunity && (post.community_id || post.community_slug)) {
        items.push({
          id: 'mute-community',
          label: 'このアノニウムをミュート',
          icon: 'block',
          show: true,
            onClick: async () => {
            // セキュリティ対策: JWTトークンはCookieから自動的に送信される
            try {
              const communityId = post.community_id || post.community_slug;
              const resp = await fetch(`${API}/api/communities/${communityId}/mute/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
              });
              if (resp.ok) {
                const j = await resp.json().catch(() => null);
                alert(j?.detail || 'アノニウムをミュートしました。');
              } else {
                const t = await resp.text();
                alert(t || `ミュートに失敗しました (${resp.status})`);
              }
            } catch {
              alert('ミュートに失敗しました。');
            }
          },
          divider: false,
        });
      }
    }

    // フォロー（全員）
    items.push({
      id: 'follow',
      label: () => isFollowing ? 'フォロー解除' : '投稿をフォロー',
      icon: isFollowing ? 'notifications_active' : 'notifications',
      show: true,
      onClick: async () => {
        // セキュリティ対策: JWTトークンはCookieから自動的に送信される
        try {
          const resp = await callApiWithRefresh(`${API}/api/posts/${post.id}/follow/`, {
            method: 'POST',
          });
          if (resp.ok) {
            const data = await resp.json().catch(() => null);
            if (data && typeof data.is_following === 'boolean') {
              setIsFollowing(data.is_following);
            }
          } else {
            const t = await resp.text();
            alert(t || `フォロー操作に失敗しました (${resp.status})`);
          }
        } catch {
          alert('フォロー操作に失敗しました。');
        }
      },
      divider: true,
    });

    return items;
  }, [
    isOwnPost,
    isOwner,
    isAdminMod,
    isModerator,
    isClipped,
    isFollowing,
    canMuteCommunity,
    post,
    isAuthenticated,
    callApiWithRefresh,
    reloadPost,
    onDeleted,
    setIsEditing,
    setEditTitle,
    setEditBody,
    setReportModal,
    setIsFollowing,
  ]);

  return (
    <div
      ref={cardRef}
      className={`relative rounded-lg border border-subtle p-3 surface-2 ${disableLink ? '' : 'cursor-pointer'} transition-colors ${disableLink ? '' : 'hover:!border-white/40 hover:!bg-white/10 hover:shadow-md hover:shadow-black/20'}`}
      onClick={handleCardClick}
    >
      {/* 固定されたスレッド表示 */}
      {isClipped && (
        <div className="mb-2 pb-2 border-b border-gray-600/50">
          <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-blue-500/20 border border-blue-500/30 text-blue-300 text-xs font-medium">
            <span className="material-symbols-rounded text-sm" aria-hidden>push_pin</span>
            <span>固定されたスレッド</span>
          </div>
        </div>
      )}
      {/* Top meta: community/user and time ago */}
      <div className="flex items-center gap-3 text-xs relative z-20">
        {/* ホームページまたはサーチページの場合はコミュニティ情報、それ以外は投稿者情報を表示 */}
        {isHomeOrSearchPage ? (
          /* コミュニティ情報を表示（ホーム・サーチページ） */
          (post.community_id || post.community_slug) && (
            <a
              href={`/v/${post.community_id || post.community_slug}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-2 text-subtle hover:underline whitespace-nowrap"
            >
              {post.community_icon_url ? (
                <img
                  src={post.community_icon_url}
                  alt={post.community_slug || `community-${post.community_id}`}
                  className="w-6 h-6 rounded-full border border-subtle object-cover"
                />
              ) : (
                <span className="w-6 h-6 rounded-full border border-subtle surface-1 flex items-center justify-center text-xs">#</span>
              )}
              <span>{post.community_slug || `community-${post.community_id}`}</span>
              {post.community_visibility === 'private' && (
                <span className="material-symbols-rounded text-xs" style={{ fontSize: 14 }} aria-label="非公開">lock</span>
              )}
            </a>
          )
        ) : (
          /* 投稿者情報を表示（その他のページ） */
          primaryBadge && (
            primaryHref ? (
              <a href={primaryHref} className="flex items-center gap-2 text-subtle hover:underline whitespace-nowrap">
                {communityIconUrl ? (
                  <img src={communityIconUrl} alt={primaryBadge} className="w-6 h-6 rounded-full border border-subtle" />
                ) : authorIconUrl ? (
                  <img src={authorIconUrl} alt={primaryBadge} className="w-6 h-6 rounded-full border border-subtle" />
                ) : (
                  <span className="w-6 h-6 rounded-full border border-subtle surface-1 flex items-center justify-center text-xs">#</span>
                )}
                <span>{primaryBadge}</span>
                {post.community_visibility === 'private' && (
                  <span className="material-symbols-rounded text-xs" style={{ fontSize: 14 }} aria-label="非公開">lock</span>
                )}
              </a>
            ) : (
              <span className="flex items-center gap-2 text-subtle whitespace-nowrap">
                {authorIconUrl ? (
                  <img src={authorIconUrl} alt={primaryBadge} className="w-6 h-6 rounded-full border border-subtle" />
                ) : communityIconUrl ? (
                  <img src={communityIconUrl} alt={primaryBadge} className="w-6 h-6 rounded-full border border-subtle" />
                ) : (
                  <span className="w-6 h-6 rounded-full border border-subtle surface-1 flex items-center justify-center text-xs">#</span>
                )}
                <span>{primaryBadge}</span>
                {(() => {
                  const isLoggedInUser = (post.author_username_id && !post.author_username_id.startsWith('Anonium-')) || 
                                        (post.author_username && !post.author_username.startsWith('Anonium-') && !post.author_username_id);
                  return isLoggedInUser ? (
                    <span className="relative inline-flex items-center justify-center flex-shrink-0" title="ログイン済" aria-label="ログイン済">
                      <svg className="w-3 h-3 text-green-500" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                        <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.1"/>
                        <path d="M7 10l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                      </svg>
                    </span>
                  ) : null;
                })()}
              </span>
            )
          )
        )}
        {post.tag && post.tag.name && (post.community_id || post.community_slug) && (
          <a
            href={`/v/${post.community_id || post.community_slug}`}
            onClick={(e) => {
              e.stopPropagation();
              try { localStorage.setItem('villageTagFilter', post.tag!.name); } catch {}
            }}
            className="inline-flex items-center text-[11px] px-1.5 py-0.5 rounded-full border border-subtle hover:bg-white/5 whitespace-nowrap relative z-20"
            style={{ 
              backgroundColor: post.tag.color || '#1e3a8a',
              color: (() => {
                try {
                  const bg = post.tag.color || '#1e3a8a';
                  const hex = (bg || '').replace('#','');
                  if (hex.length === 6) {
                    const r = parseInt(hex.substring(0,2), 16) / 255;
                    const g = parseInt(hex.substring(2,4), 16) / 255;
                    const b = parseInt(hex.substring(4,6), 16) / 255;
                    const srgb = [r,g,b].map(v => (v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4)));
                    const L = 0.2126*srgb[0] + 0.7152*srgb[1] + 0.0722*srgb[2];
                    return L > 0.5 ? '#000000' : '#ffffff';
                  }
                } catch {}
                return '#ffffff';
              })()
            }}
            title="このタグでフィルタ"
          >
            {post.tag.name}
          </a>
        )}
        <span className="text-subtle" suppressHydrationWarning>
          {timeText ? (
            disableLink ? <span>{`${timeText}の投稿`}</span> : <a href={`/p/${post.id}`} className="hover:underline">{`${timeText}の投稿`}</a>
          ) : ''}
          {post.is_edited && (
            <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-subtle" title="編集済み">編集済み</span>
          )}
        </span>
        {/* showAuthorは削除（primaryBadgeで既に表示しているため） */}
      </div>

      {/* Title + Body or deleted notice */}
      {post.is_deleted ? (
        <div className="relative mt-1.5">
          <div className="text-sm font-medium text-subtle">この投稿は削除されました。</div>
        </div>
      ) : isEditing ? (
        <div className="relative mt-1.5 space-y-2">
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="w-full rounded-md border border-subtle bg-transparent px-3 py-2 text-sm font-bold"
            placeholder="タイトル"
            disabled={isSubmitting}
          />
          <textarea
            value={editBody}
            onChange={(e) => setEditBody(e.target.value)}
            className="w-full rounded-md border border-subtle bg-transparent px-3 py-2 text-sm min-h-[120px]"
            placeholder="本文"
            disabled={isSubmitting}
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                if (isSubmitting) return;
                setIsSubmitting(true);
                try {
                  const resp = await fetch(`${API}/api/posts/${post.id}/`, {
                    method: 'PATCH',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    // セキュリティ対策: JWTトークンはCookieから自動的に送信される
                    credentials: 'include',
                    body: JSON.stringify({ title: editTitle, body: editBody }),
                  });
                  if (resp.ok) {
                    const data = await resp.json();
                    setIsEditing(false);
                    // 編集後のデータでpostを更新
                    if (onVoted) onVoted();
                  } else {
                    const t = await resp.text();
                    alert(t || `編集に失敗しました (${resp.status})`);
                  }
                } catch {
                  alert('編集に失敗しました。');
                } finally {
                  setIsSubmitting(false);
                }
              }}
              disabled={isSubmitting || !editTitle.trim()}
              className="px-3 py-1.5 rounded-md bg-accent text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              保存
            </button>
            <button
              type="button"
              onClick={() => {
                setIsEditing(false);
                setEditTitle(post.title);
                setEditBody(post.body || '');
              }}
              disabled={isSubmitting}
              className="px-3 py-1.5 rounded-md border border-subtle hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              キャンセル
            </button>
          </div>
        </div>
      ) : (
        <div className="relative mt-1.5">
          <div className="text-sm font-bold hover:underline">
            {disableLink ? <span>{post.title}</span> : <a href={`/p/${post.id}`}>{post.title}</a>}
          </div>
          {bodyWithoutImages && (
            <>
              <RichText text={displayBody + (needsTruncate && !showFullBody ? '…' : '')} className="text-xs text-subtle mt-1.5" />
              {needsTruncate && (
                <div className="mt-1">
                  <button
                    type="button"
                    className="text-xs text-subtle hover:underline relative z-20"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowFullBody(v => !v); }}
                  >
                    {showFullBody ? '閉じる' : '続きを読む'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
      {/* メディア表示（画像/動画タイプの投稿またはbodyから抽出した画像/動画） */}
      {!post.is_deleted && displayImageUrls.length === 1 && (
        <div className="relative z-20" data-ignore-card-click="true">
          {/* 単一画像は比率維持でカード幅に追従（高さは幅から算出） */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={displayImageUrls[0]}
            alt="image"
            className="mt-2 w-full rounded-md border border-subtle object-contain cursor-zoom-in"
            style={{ maxHeight: computedImageHeight }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setPreview(displayImageUrls[0]);
            }}
          />
        </div>
      )}
      {!post.is_deleted && displayVideoUrls.length === 1 && (
        <div className="relative z-20" data-ignore-card-click="true">
          <video
            src={displayVideoUrls[0]}
            className="mt-2 w-full rounded-md border border-subtle"
            style={{ maxHeight: computedImageHeight }}
            controls
            muted={false}
          />
        </div>
      )}
      {!post.is_deleted && displayImageUrls.length > 1 && (
        <div className="mt-2 relative z-20 rounded-md border border-subtle overflow-hidden" data-ignore-card-click="true">
          <div
            ref={scrollerRef}
            className="snap-x snap-mandatory overflow-x-auto no-scrollbar flex w-full"
            onScroll={(e) => {
              const el = e.currentTarget;
              const width = el.clientWidth || 1;
              const idx = Math.round(el.scrollLeft / width);
              if (idx !== currentIdx) setCurrentIdx(idx);
            }}
          >
            {displayImageUrls.map((src, idx) => (
              <div key={idx} className="flex-none w-full snap-center flex items-center justify-center bg-white/5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={`image-${idx}`}
                  className="w-full object-contain cursor-zoom-in"
                  style={{ height: computedImageHeight }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setPreview(src);
                  }}
                />
              </div>
            ))}
          </div>
          {/* arrows */}
          <button
            type="button"
            className="absolute left-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-9 h-9 rounded-full bg-black/60 hover:bg-black/70 border border-white/20 text-white disabled:opacity-40"
            onClick={() => scrollToIndex(currentIdx - 1)}
            disabled={currentIdx <= 0}
            aria-label="前へ"
          >
            <span className="material-symbols-rounded">chevron_left</span>
          </button>
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-9 h-9 rounded-full bg-black/60 hover:bg-black/70 border border-white/20 text-white disabled:opacity-40"
            onClick={() => scrollToIndex(currentIdx + 1)}
            disabled={currentIdx >= displayImageUrls.length - 1}
            aria-label="次へ"
          >
            <span className="material-symbols-rounded">chevron_right</span>
          </button>
          {/* indicator */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs px-2 py-0.5 rounded-full bg-black/50 text-white">
            {currentIdx + 1} / {displayImageUrls.length}
          </div>
        </div>
      )}
      {!post.is_deleted && displayVideoUrls.length > 1 && (
        <div className="mt-2 space-y-2 relative z-20" data-ignore-card-click="true">
          {displayVideoUrls.map((src, idx) => (
            <video key={idx} src={src} className="w-full rounded-md border border-subtle" style={{ maxHeight: computedImageHeight }} controls muted={false} />
          ))}
        </div>
      )}
      {/* Poll UI */}
      {!post.is_deleted && post.post_type === 'poll' && pollData && (() => {
        const hasVoted = pollData.user_vote_id !== null && pollData.user_vote_id !== undefined;
        const { text: remainLabel, expired } = remainingText(pollData.expires_at ?? null);
        const showResults = hasVoted || expired;
        // 投票可能かどうか: 認証済み && メンバー && 投票済みでない && 期限切れでない
        const canVote = isAuthenticated && isMember && !hasVoted && !expired;
        // 結果を表示するか: 投票済み || 期限切れ || メンバーでない（メンバーでない場合は結果のみ表示）
        const showResultsOnly = !isAuthenticated || !isMember || expired;
        
        return (
          <div className="mt-3 relative z-20" data-ignore-card-click="true">
            <div className="rounded-md border border-subtle p-3 surface-1">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="text-sm font-medium">{pollData.title}</div>
                <div className={`text-[11px] ${expired ? 'text-subtle' : 'text-subtle'}`}>{remainLabel}</div>
              </div>
              {!isAuthenticated && (
                <div className="mb-2 p-2 rounded border border-subtle surface-1">
                  <div className="text-xs text-subtle text-center">
                    この投票に参加するには、ログインしてアノニウムに参加する必要があります。
                  </div>
                </div>
              )}
              {isAuthenticated && !isMember && (
                <div className="flex items-center justify-between gap-2 mb-2 p-2 rounded border border-subtle surface-1">
                  <div className="text-xs text-subtle">
                    この投票に参加するには、アノニウムに参加する必要があります。
                  </div>
                  {(post.community_id || post.community_slug) && (
                    <button
                      type="button"
                      onClick={async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        // セキュリティ対策: JWTトークンはCookieから自動的に送信される
                        try {
                          const communityId = post.community_id || post.community_slug;
                          const res = await fetch(`${API}/api/communities/${communityId}/join/`, {
                            method: 'POST',
                            credentials: 'include',
                          });
                          if (res.ok || res.status === 202) {
                            // ローカル状態を更新して投票UIを即座に解放
                            setLocalIsMember(true);
                            setLocalMembershipRole('member'); // デフォルトで一般メンバーとして設定
                            // onVotedコールバックがあれば呼び出す（親コンポーネントで状態を更新）
                            if (onVoted) onVoted();
                          }
                        } catch {}
                      }}
                      className="px-3 py-1 text-xs rounded-md bg-accent text-white hover:opacity-90 whitespace-nowrap"
                    >
                      参加する
                    </button>
                  )}
                </div>
              )}
              <div className="space-y-2">
                {pollData.options.map((option) => {
                  const totalVotes = pollData.options.reduce((sum, opt) => sum + opt.vote_count, 0);
                  const percentage = totalVotes > 0 ? (option.vote_count / totalVotes) * 100 : 0;
                  const isSelected = pollData.user_vote_id === option.id;
                  return (
                    <div
                      key={option.id}
                      className={`w-full text-left p-2 rounded border transition-colors relative z-20 ${
                        showResultsOnly
                          ? 'opacity-100 border-subtle cursor-default'
                          : canVote
                            ? 'border-subtle hover:border-white/40 hover:bg-white/5 cursor-pointer'
                            : 'opacity-75 border-subtle cursor-not-allowed'
                      }`}
                      onClick={canVote ? (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handlePollVote(option.id);
                      } : undefined}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-xs flex-1">{option.text}</span>
                        {/* 結果を表示: メンバーでない場合、投票済みの場合、または期限切れの場合 */}
                        {(showResultsOnly || hasVoted) && (
                          <span className="text-xs text-subtle tabular-nums whitespace-nowrap">
                            {option.vote_count}票 ({percentage.toFixed(1)}%)
                          </span>
                        )}
                      </div>
                      {/* 結果を表示: メンバーでない場合、投票済みの場合、または期限切れの場合 */}
                      {(showResultsOnly || hasVoted) && (
                        <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className="h-full bg-accent transition-all duration-300"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {!isAuthenticated && (
                <div className="mt-2 text-xs text-subtle text-center">
                  投票するにはログインが必要です
                </div>
              )}
              {isAuthenticated && !isMember && (
                <div className="mt-2 text-xs text-subtle text-center">
                  投票するにはアノニウムへの参加が必要です
                </div>
              )}
              {isAuthenticated && isMember && hasVoted && (
                <div className="mt-2 text-xs text-subtle text-center">
                  投票済み（変更できません）
                </div>
              )}
              {isAuthenticated && isMember && expired && (
                <div className="mt-2 text-xs text-subtle text-center">
                  投票は締め切られました
                </div>
              )}
            </div>
          </div>
        );
      })()}
      {/* OGP preview for non-image first URL (メディアタイプの投稿では表示しない) */}
      {!post.is_deleted && firstUrl && postMedia.length === 0 && !/\.(png|jpe?g|gif|webp)(\?.*)?$/i.test(firstUrl) && (
        <div className="relative z-20">
          <LinkPreview url={firstUrl} />
        </div>
      )}

      {/* Actions (no badge/pill) */}
      <div className="mt-2.5 flex items-center gap-3 text-xs relative z-20">
        <button
          className={`p-0.5 ${upActive ? 'active-up' : 'text-subtle hover-up'} hover:opacity-80`}
          onClick={() => vote(1)}
          disabled={!canVote}
          title="good"
        >
          <span className={`material-symbols-rounded ${arrowBounce === 'up' ? 'animate-bounce-up' : (upActive ? 'animate-bounce-up' : '')}`} style={{ fontSize: 18, lineHeight: '18px', fontVariationSettings: '"FILL" 1, "wght" 700' }}>north</span>
        </button>
        <span className={`tabular-nums ${bump ? (countDir==='up' ? 'count-up' : (countDir==='down' ? 'count-down' : 'animate-bump')) : ''}`} style={{ minWidth: 20, textAlign: 'center', lineHeight: '16px', display: 'inline-block' }}>{score}</span>
        <button
          className={`p-0.5 ${downActive ? 'active-down' : 'text-subtle hover-down'} hover:opacity-80`}
          onClick={() => vote(-1)}
          disabled={!canVote}
          title="bad"
        >
          <span className={`material-symbols-rounded ${arrowBounce === 'down' ? 'animate-bounce-down' : (downActive ? 'animate-bounce-down' : '')}`} style={{ fontSize: 18, lineHeight: '18px', fontVariationSettings: '"FILL" 1, "wght" 700' }}>south</span>
        </button>
        <span className="opacity-30">|</span>
        {disableLink ? (
          <span className="p-0.5 text-subtle" title="comment" aria-label="コメントを開く">
            <span className="material-symbols-rounded" style={{ fontSize: 16 }}>chat_bubble</span>
          </span>
        ) : (
          <a href={`/p/${post.id}`} className="p-0.5 text-subtle hover:opacity-80" title="comment" aria-label="コメントを開く">
            <span className="material-symbols-rounded" style={{ fontSize: 16 }}>chat_bubble</span>
          </a>
        )}
        {disableLink ? (
          <span className="tabular-nums" aria-label="コメント数">
            {commentsCount}
          </span>
        ) : (
          <a href={`/p/${post.id}`} className="tabular-nums hover:underline" aria-label="コメント数と投稿ページへ">
            {commentsCount}
          </a>
        )}
        {/* More menu trigger + anchored dropdown at the icon */}
        <div className="relative inline-block">
            <button
            type="button"
            className="p-0.5 text-subtle hover:opacity-80"
            title="詳細"
            onClick={(e) => {
              e.stopPropagation(); e.preventDefault();
              if (!menuMount) {
                setMenuMount(true);
                requestAnimationFrame(() => {
                  setMenuVisible(true);
                  if (triggerRef.current) {
                    const r = triggerRef.current.getBoundingClientRect();
                    setMenuPos({ top: Math.round(r.bottom + 6), left: Math.round(r.right - 224) });
                  }
                });
              } else {
                setMenuVisible(false);
                setTimeout(() => setMenuMount(false), 150);
              }
              setMoreOpen(v => !v);
            }}
            ref={triggerRef}
          >
            <span className="material-symbols-rounded" style={{ fontSize: 16, lineHeight: '16px' }}>more_horiz</span>
          </button>
          {menuMount && menuPos && createPortal(
            <div
              className={`fixed min-w-56 rounded-md border border-subtle bg-background shadow-lg z-[100000] transition-all duration-150 ease-out origin-top-right ${menuVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-1 scale-95 pointer-events-none'}`}
              style={{ top: menuPos.top, left: menuPos.left }}
            >
              <PostMenu items={menuItems} onClose={closeMenu} />
            </div>,
            document.body
          )}
        </div>
      </div>
      {preview && (
        <ImageModal src={preview} onClose={() => setPreview(null)} />
      )}
      <ReportModal
        isOpen={reportModal.isOpen}
        title="投稿を報告"
        message="この投稿を報告する理由を入力してください（任意）"
        placeholder="報告理由を入力してください（任意）"
        onConfirm={reportModal.onConfirm}
        onCancel={() => setReportModal({ isOpen: false, onConfirm: () => {} })}
      />
    </div>
  );
}
