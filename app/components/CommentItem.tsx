"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import LinkPreview from "./LinkPreview";
import RichText from "./RichText";
import Composer from "./Composer";
import ImageModal from "./ImageModal";
import ConfirmModal from "./ConfirmModal";
import PromptModal from "./PromptModal";
import ReportModal from "./ReportModal";
import AlertModal from "./AlertModal";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

type CommentMedia = {
  id: number;
  media_type: 'image' | 'video';
  url: string;
  thumbnail_url?: string;
  width?: number;
  height?: number;
  duration?: number;
  file_size?: number;
  order: number;
};

type Comment = {
  id: number;
  post: number;
  author: number;
  author_username?: string;
  author_username_id?: string;
  author_icon_url?: string;
  parent?: number | null;
  body: string;
  created_at: string;
  children?: Comment[];
  score?: number;
  user_vote?: number | null;
  can_moderate?: boolean;
  is_deleted?: boolean;
  is_edited?: boolean;
  deleted_by_username?: string | null;
  deleted_at?: string | null;
  community_id?: number;
  community_slug?: string;
  has_more_children?: boolean;
  children_count?: number;
  media?: CommentMedia[];
};

type Props = {
  comment: Comment;
  accessToken?: string; // 後方互換性のためオプショナル、クッキーベースの認証を使用
  onPosted: () => void;
  level?: number;
  canModerate?: boolean;
  canDelete?: boolean;
  canBlock?: boolean;
  community?: { join_policy?: string; is_member?: boolean; membership_role?: string | null; slug?: string; karma?: number } | null;
  currentUsername?: string;
  isAuthenticated?: boolean; // 親コンポーネントから認証状態を受け取る（各コメントアイテムで/api/accounts/me/を呼び出さないようにするため）
  fetchCommentDescendants?: (commentId: number, limit?: number, cursor?: string | null, excludeIds?: Set<number>) => Promise<{ items: Comment[]; parents: Comment[]; next: string | null }>;
  onCommentsFetched?: (newComments: Comment[], parentId?: number) => void;
  onExpandedChange?: (commentId: number, isExpanded: boolean) => void;
  initialCollapsed?: boolean; // 親から初期の折りたたみ状態を受け取る
  collapsedMap?: Map<number, boolean>; // 全てのコメントの折りたたみ状態のマップ（子コメントの初期状態を決定するために使用）
  guestScore?: number | null;
  showDeletedComments?: boolean; // 削除されたコメントを表示するかどうか
};

export default function CommentItem({ 
  comment, 
  accessToken = "", 
  onPosted, 
  level = 0, 
  canModerate = false, 
  canDelete = false, 
  canBlock = false, 
  community = null, 
  currentUsername,
  isAuthenticated: propIsAuthenticated,
  fetchCommentDescendants,
  onCommentsFetched,
  onExpandedChange,
  initialCollapsed,
  collapsedMap,
  guestScore,
  showDeletedComments = false
}: Props) {
  // 認証状態は親コンポーネントから受け取る（各コメントアイテムで/api/accounts/me/を呼び出さないようにするため）
  // 後方互換性のため、propIsAuthenticatedが未指定の場合はaccessTokenから判断
  const isAuthenticated = propIsAuthenticated !== undefined ? propIsAuthenticated : !!accessToken;
  
  // 画面幅を取得してスマホ表示かどうかを判断
  const [badgeTooltipOpen, setBadgeTooltipOpen] = useState<boolean>(false);
  const badgeTooltipRef = useRef<HTMLSpanElement | null>(null);
  
  // バッジツールチップの外側クリックで閉じる
  useEffect(() => {
    if (!badgeTooltipOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (badgeTooltipRef.current && !badgeTooltipRef.current.contains(event.target as Node)) {
        setBadgeTooltipOpen(false);
      }
    }
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [badgeTooltipOpen]);

  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 1000;
  });
  
  useEffect(() => {
    const checkMobile = () => {
      const newIsMobile = typeof window !== 'undefined' && window.innerWidth < 1000;
      setIsMobile(newIsMobile);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  const hasModeratePermission = canModerate || !!comment.can_moderate;
  const hasDeletePermission = canDelete || hasModeratePermission;
  const hasBlockPermission = canBlock;
  // 自分のコメントかどうかを判定（author_username_idとcurrentUsernameを比較）
  const isOwnComment = !!(comment.author_username_id && currentUsername && comment.author_username_id === currentUsername);
  const membershipRole = community?.membership_role;
  const isOwner = membershipRole === 'owner';
  const isAdminMod = membershipRole === 'admin_moderator';
  const isModerator = membershipRole === 'moderator';
  
  const [open, setOpen] = useState(false);
  const [score, setScore] = useState<number>(comment.score ?? 0);
  const [userVote, setUserVote] = useState<number | null>(comment.user_vote ?? null);
  const [isFollowing, setIsFollowing] = useState<boolean | null>(null); // nullは未取得状態
  // 初期状態: 親から明示的に指定された場合、削除されている場合、子コメントがなくhas_more_childrenもfalseの場合は折りたたみ
  // それ以外は展開（initialCollapsedが指定されていない場合は、子コメントがあれば展開）
  const getInitialCollapsed = () => {
    if (typeof initialCollapsed === 'boolean') {
      return initialCollapsed;
    }
    return !!comment.is_deleted || 
           ((comment.children?.length ?? 0) === 0 && !(comment.has_more_children ?? false));
  };
  
  const [collapsed, setCollapsed] = useState(getInitialCollapsed);
  
  // initialCollapsedが変更されたときに、collapsed状態を更新
  useEffect(() => {
    if (typeof initialCollapsed === 'boolean') {
      setCollapsed(initialCollapsed);
    }
  }, [initialCollapsed]);
  const [bump, setBump] = useState<boolean>(false);
  const [countDir, setCountDir] = useState<"up" | "down" | null>(null);
  const [arrowBounce, setArrowBounce] = useState<"up"|"down"|null>(null);
  const prevScoreRef = useRef<number>(comment.score ?? 0);
  const [timeText, setTimeText] = useState<string>("");
  const [deletedTimeText, setDeletedTimeText] = useState<string>("");
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editBody, setEditBody] = useState<string>(comment.body);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  
  // 子コメントの状態管理
  const [children, setChildren] = useState<Comment[]>(comment.children || []);
  const [loadingChildren, setLoadingChildren] = useState<boolean>(false);
  const [childrenCount, setChildrenCount] = useState<number>(comment.children_count ?? 0);
  // 表示する子コメントの数（一度に5件ずつ表示、スマホは3件ずつ）
  const [displayedChildrenCount, setDisplayedChildrenCount] = useState<number>(() => {
    const initialLimit = (typeof window !== 'undefined' && window.innerWidth < 1000) ? 3 : 5;
    return Math.min(comment.children?.length || 0, initialLimit);
  });
  
  // isMobileが変更されたときにdisplayedChildrenCountを更新
  useEffect(() => {
    const limit = isMobile ? 3 : 5;
    setDisplayedChildrenCount(prev => {
      const newCount = Math.min(prev, Math.min(children.length, limit));
      prevDisplayedCountRef.current = newCount;
      return newCount;
    });
  }, [isMobile, children.length]);
  
  // 前回の値を保存するためのref
  const prevCommentRef = useRef<{ id: number; childrenIds: string; hasMore: boolean; count: number } | null>(null);
  
  // アニメーション用のref
  const childrenContainerRef = useRef<HTMLDivElement | null>(null);
  
  // 前回の表示数を記録（アニメーション用）
  const prevDisplayedCountRef = useRef<number>(displayedChildrenCount);
  
  // コメントが開かれたときに前回の表示数をリセット
  useEffect(() => {
    if (!collapsed) {
      prevDisplayedCountRef.current = displayedChildrenCount;
    }
  }, [collapsed, displayedChildrenCount]);

  // 全ての子孫コメントの総数を再帰的に数える関数
  const countAllDescendants = useCallback((comments: Comment[]): number => {
    let count = comments.length;
    for (const c of comments) {
      if (c.children && c.children.length > 0) {
        count += countAllDescendants(c.children);
      }
    }
    return count;
  }, []);

  // hasMoreChildrenを計算する関数
  const calculateHasMoreChildren = useCallback((childrenList: Comment[], count: number, serverHasMore: boolean): boolean => {
    const totalFetched = countAllDescendants(childrenList);
    
    if (count > 0) {
      // childrenCountが設定されている場合は、取得済み数と比較のみ
      // サーバーのhasMoreフラグは無視（孫コメントが既に取得済みの場合があるため）
      return count > totalFetched;
    } else {
      // childrenCountが0の場合でも、実際に取得されているコメントがある場合は確認
      // 孫コメントが既に取得済みの場合、totalFetched > 0でもserverHasMoreがtrueの可能性がある
      // その場合は、実際に取得されているコメントがあるかどうかを確認
      return serverHasMore;
    }
  }, [countAllDescendants]);
  
  const [hasMoreChildren, setHasMoreChildren] = useState<boolean>(() => 
    calculateHasMoreChildren(comment.children || [], comment.children_count ?? 0, comment.has_more_children ?? false)
  );

  // コメントが変更されたら子コメントを更新
  // comment.childrenの長さを依存配列に含めることで、子コメントの変更を検出
  const childrenLength = comment.children?.length ?? 0;
  
  useEffect(() => {
    const newChildren = comment.children || [];
    const newChildrenIds = newChildren.map(c => c.id).sort((a, b) => a - b).join(',');
    const hasMore = comment.has_more_children ?? false;
    const newCount = comment.children_count ?? 0;
    
    // 前回の値と比較して、変更がある場合のみ更新
    const prev = prevCommentRef.current;
    if (!prev || prev.id !== comment.id || prev.childrenIds !== newChildrenIds || prev.hasMore !== hasMore || prev.count !== newCount) {
      const prevChildrenLength = children.length;
      setChildren(newChildren);
      setChildrenCount(newCount);
      
      // 新しい子コメントが追加された場合は、表示数を増やす（ただし上限は維持）
      if (newChildren.length > prevChildrenLength) {
        const limit = isMobile ? 3 : 5;
        setDisplayedChildrenCount(prev => Math.min(prev + (newChildren.length - prevChildrenLength), Math.min(newChildren.length, limit)));
      } else if (newChildren.length < prevChildrenLength) {
        // 子コメントが減った場合は、表示数を調整
        const limit = isMobile ? 3 : 5;
        setDisplayedChildrenCount(prev => Math.min(prev, Math.max(newChildren.length, limit)));
      }
      
      // hasMoreChildrenを再評価
      setHasMoreChildren(calculateHasMoreChildren(newChildren, newCount, hasMore));
      
      // 前回の値を更新
      prevCommentRef.current = {
        id: comment.id,
        childrenIds: newChildrenIds,
        hasMore,
        count: newCount,
      };
    }
  }, [comment.id, childrenLength, comment.has_more_children, comment.children_count, countAllDescendants, calculateHasMoreChildren, children.length, isMobile]);

  // コメントツリーをマージする関数（シンプルな実装）
  const mergeCommentTree = (existing: Comment[], newComments: Comment[]): Comment[] => {
    // 既存のコメントをIDでマップ
    const existingMap = new Map<number, Comment>();
    const collectComments = (comments: Comment[]) => {
      for (const c of comments) {
        existingMap.set(c.id, { ...c, children: c.children || [] });
        if (c.children && c.children.length > 0) {
          collectComments(c.children);
        }
      }
    };
    collectComments(existing);
    
    // 新しいコメントを追加または更新
    for (const newComment of newComments) {
      const existingComment = existingMap.get(newComment.id);
      if (existingComment) {
        // 既存のコメントを更新（子コメントは再帰的にマージ）
        const mergedChildren = mergeCommentTree(existingComment.children || [], newComment.children || []);
        existingMap.set(newComment.id, {
          ...newComment,
          children: mergedChildren,
        });
      } else {
        // 新しいコメントを追加
        const newChildren = newComment.children || [];
        existingMap.set(newComment.id, {
          ...newComment,
          children: newChildren,
        });
        // 子コメントもマップに追加
        if (newChildren.length > 0) {
          collectComments(newChildren);
        }
      }
    }
    
    // 既存の順序を保ちながら、新しいコメントを追加
    const result: Comment[] = [];
    const added = new Set<number>();
    
    // 既存のコメントを順序を保って追加
    const addRecursive = (comments: Comment[]) => {
      for (const c of comments) {
        if (added.has(c.id)) continue;
        added.add(c.id);
        
        const comment = existingMap.get(c.id);
        if (!comment) continue;
        
        // 子コメントを再帰的に追加
        const childrenList: Comment[] = [];
        if (comment.children && comment.children.length > 0) {
          addRecursive(comment.children);
          // 子コメントを順序通りに追加
          for (const child of comment.children) {
            const childComment = existingMap.get(child.id);
            if (childComment && added.has(child.id)) {
              childrenList.push(childComment);
            }
          }
        }
        
        result.push({
          ...comment,
          children: childrenList,
        });
      }
    };
    
    addRecursive(existing);
    
    // 新しいコメントを追加（既存にないもののみ）
    for (const newComment of newComments) {
      if (!added.has(newComment.id)) {
        added.add(newComment.id);
        const comment = existingMap.get(newComment.id);
        if (comment) {
          // 子コメントも追加
          const childrenList: Comment[] = [];
          if (comment.children && comment.children.length > 0) {
            for (const child of comment.children) {
              if (!added.has(child.id)) {
                added.add(child.id);
                const childComment = existingMap.get(child.id);
                if (childComment) {
                  childrenList.push(childComment);
                }
              } else {
                const childComment = existingMap.get(child.id);
                if (childComment) {
                  childrenList.push(childComment);
                }
              }
            }
          }
          result.push({
            ...comment,
            children: childrenList,
          });
        }
      }
    }
    
    return result;
  };

  // 子コメントを取得する関数
  async function loadChildren() {
    if (loadingChildren || !fetchCommentDescendants) return;
    setLoadingChildren(true);
    try {
      // 既存の子コメントIDを取得
      const existingIds = new Set<number>();
      const collectIds = (comments: Comment[]) => {
        for (const c of comments) {
          existingIds.add(c.id);
          if (c.children && c.children.length > 0) {
            collectIds(c.children);
          }
        }
      };
      collectIds(children);
      
      const result = await fetchCommentDescendants(comment.id, 20, null, existingIds);
      
      if (result.items && result.items.length > 0) {
        // 新しいコメントを既存のツリーにマージ
        const merged = mergeCommentTree(children, result.items);
        const prevChildrenLength = children.length;
        setChildren(merged);
        
        // 新しい子コメントが追加された場合は、表示数を増やす（ただし上限は維持）
        if (merged.length > prevChildrenLength) {
          const limit = isMobile ? 3 : 5;
          setDisplayedChildrenCount(prev => Math.min(prev + (merged.length - prevChildrenLength), Math.min(merged.length, prev + limit)));
        }
        
        // has_more_childrenを更新（マージ後の状態で再計算）
        // result.nextがある場合は確実にまだある、ない場合はchildrenCountと比較
        if (result.next) {
          setHasMoreChildren(true);
        } else {
          // result.nextがnullの場合、childrenCountと取得済み数を比較
          setHasMoreChildren(calculateHasMoreChildren(merged, childrenCount, false));
        }
        
        // 親コンポーネントに通知（親IDを渡す）
        if (onCommentsFetched) {
          onCommentsFetched(result.items, comment.id);
        }
      } else {
        // 取得できなかった場合は、既に取得済みのコメント数とchildrenCountを比較
        setHasMoreChildren(calculateHasMoreChildren(children, childrenCount, false));
      }
    } catch (error) {
      // エラーは無視（ユーザーには表示しない）
    } finally {
      setLoadingChildren(false);
    }
  }

  useEffect(() => {
    if (typeof comment.score === 'number') {
      const prev = prevScoreRef.current;
      const curr = comment.score;
      setScore(curr);
      setUserVote(comment.user_vote ?? null);
      if (curr > prev) setCountDir('up');
      else if (curr < prev) setCountDir('down');
      else setCountDir(null);
      prevScoreRef.current = curr;
      setBump(true);
      const t = setTimeout(() => { setBump(false); setCountDir(null); }, 240);
      return () => clearTimeout(t);
    }
  }, [comment.score, comment.user_vote]);

  useEffect(() => {
    try {
      const now = Date.now();
      const past = new Date(comment.created_at).getTime();
      const diff = Math.max(0, now - past);
      const m = 60 * 1000; const h = 60 * m; const d = 24 * h;
      let t = '';
      if (diff < m) t = `${Math.floor(diff / 1000)}秒前`;
      else if (diff < h) t = `${Math.floor(diff / m)}分前`;
      else if (diff < d) t = `${Math.floor(diff / h)}時間前`;
      else t = `${Math.floor(diff / d)}日前`;
      setTimeText(t);
    } catch {}
  }, [comment.created_at]);

  useEffect(() => {
    if (comment.is_deleted && comment.deleted_at) {
      try {
        const now = Date.now();
        const past = new Date(comment.deleted_at).getTime();
        const diff = Math.max(0, now - past);
        const m = 60 * 1000; const h = 60 * m; const d = 24 * h;
        let t = '';
        if (diff < m) t = `${Math.floor(diff / 1000)}秒前`;
        else if (diff < h) t = `${Math.floor(diff / m)}分前`;
        else if (diff < d) t = `${Math.floor(diff / h)}時間前`;
        else t = `${Math.floor(diff / d)}日前`;
        setDeletedTimeText(t);
      } catch {}
    } else {
      setDeletedTimeText("");
    }
  }, [comment.is_deleted, comment.deleted_at]);

  useEffect(() => {
    if (comment.is_deleted) setCollapsed(true);
  }, [comment.is_deleted]);

  // ゲストユーザーが投票可能かどうかを判定
  const canGuestVote = (() => {
    if (isAuthenticated) return false; // ログイン済みユーザーはメンバーシップチェックで判定
    // コミュニティに属していないコメントの場合は投票不可
    if (!comment.community_id) return false;
    if (!community || community.join_policy !== 'open') return false; // 参加ポリシーがopenでない場合は不可
    const karma = community.karma || 0;
    if (karma === 0) return true; // karmaが0の場合は常に許可
    const userScore = guestScore ?? 0;
    return userScore >= karma; // スコアがkarma以上の場合に許可
  })();

  // ログインユーザーが投票可能かどうかを判定（コミュニティメンバーである必要がある）
  const canVote = (() => {
    // コメントが削除されている場合は不可
    if (comment.is_deleted) return false;
    // コミュニティに属していないコメントの場合は投票不可
    if (!comment.community_id) return false;
    if (isAuthenticated) {
      // ログインユーザーの場合、メンバーでなければ投票不可
      return community?.is_member === true;
    } else {
      // ゲストユーザーの場合、canGuestVoteで判定
      return canGuestVote;
    }
  })();

  async function vote(value: 1 | -1) {
    // 投票できない場合は何もしない（ボタンがdisabledになっているはずだが、念のため）
    if (!canVote) {
      return;
    }
    // クリック時に即座にアニメーションを発動
    setArrowBounce(value === 1 ? 'up' : 'down');
    setTimeout(() => setArrowBounce(null), 200);
    const prev = userVote;
    let delta: number = value;
    if (prev === value) { delta = -value; setUserVote(null); setScore(s => s + delta); }
    else if (prev && prev !== value) { delta = value - prev; setUserVote(value); setScore(s => s + delta); }
    else { setUserVote(value); setScore(s => s + value); }

    setCountDir(delta > 0 ? 'up' : (delta < 0 ? 'down' : null));
    setBump(true);
    setTimeout(() => { setBump(false); setCountDir(null); }, 240);

    try {
      // セキュリティ対策: JWTトークンとゲストトークンはCookieから自動的に送信される
      const resp = await fetch(`${API}/api/comments/${comment.id}/vote/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Cookieを送信するため
        body: JSON.stringify({ value: value === 1 ? 'good' : 'bad' }),
      });
      if (resp.ok) {
        const data = await resp.json().catch(() => null);
        if (data && typeof data.score === 'number') setScore(data.score);
        if (data && (data.user_vote === 1 || data.user_vote === -1 || data.user_vote === null)) setUserVote(data.user_vote);
      }
    } catch {}
  }

  const upActive = userVote === 1;
  const downActive = userVote === -1;
  
  const depth = Math.max(0, level || 0);
  const maxRefDepth = 6;
  const innerRailAlpha = 0.10;
  const innerDotAlpha = 0.18;
  const railAlpha = Math.min(0.24, innerRailAlpha + Math.max(0, maxRefDepth - depth) * 0.02);
  const dotAlpha = Math.min(0.50, innerDotAlpha + Math.max(0, maxRefDepth - depth) * 0.04);
  
  const firstUrl = (() => {
    if (!comment.body) return "";
    const m = comment.body.match(/https?:\/\/[^\s]+/i);
    return m ? m[0] : "";
  })();
  // mediaフィールドから画像と動画を取得（優先）
  const commentMedia = comment.media || [];
  const imageMedia = commentMedia.filter(m => m.media_type === 'image');
  const videoMedia = commentMedia.filter(m => m.media_type === 'video');
  const imageUrls = imageMedia.map(m => m.url);
  const videoUrls = videoMedia.map(m => m.url);
  
  // 後方互換性: bodyからも画像/動画URLを抽出（mediaフィールドがない場合のフォールバック）
  const bodyImageUrls: string[] = (() => {
    if (imageUrls.length > 0) return []; // mediaフィールドがある場合は無視
    if (!comment.body) return [];
    const urls = comment.body.match(/https?:\/\/[^\s]+/gi) || [];
    return urls.filter(u => /\.(png|jpe?g|gif|webp)(\?.*)?$/i.test(u));
  })();
  const bodyVideoUrls: string[] = (() => {
    if (videoUrls.length > 0) return []; // mediaフィールドがある場合は無視
    if (!comment.body) return [];
    const urls = comment.body.match(/https?:\/\/[^\s]+/gi) || [];
    return urls.filter(u => /\.(mp4|webm|mov)(\?.*)?$/i.test(u));
  })();
  
  // 表示用の画像/動画URL（mediaフィールド優先、フォールバックはbodyから抽出）
  const displayImageUrls = imageUrls.length > 0 ? imageUrls : bodyImageUrls;
  const displayVideoUrls = videoUrls.length > 0 ? videoUrls : bodyVideoUrls;
  
  const bodyWithoutImages = (() => {
    let s = comment.body || '';
    if (!s) return s;
    // mediaフィールドがある場合はbodyからURLを削除しない（既に分離されているため）
    if (imageUrls.length === 0 && videoUrls.length === 0) {
      bodyImageUrls.forEach((u) => { s = s.split(u).join(''); });
      bodyVideoUrls.forEach((u) => { s = s.split(u).join(''); });
    }
    return s.trim();
  })();
  const [showFullBody, setShowFullBody] = useState<boolean>(false);
  const BODY_TRUNCATE = 255;
  const needsTruncate = (bodyWithoutImages || '').length > BODY_TRUNCATE;
  const displayBody = showFullBody || !needsTruncate
    ? bodyWithoutImages
    : (bodyWithoutImages || '').slice(0, BODY_TRUNCATE);
  const [preview, setPreview] = useState<string | null>(null);
  const [menuMount, setMenuMount] = useState<boolean>(false);
  const [menuVisible, setMenuVisible] = useState<boolean>(false);
  const menuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const menuContainerRef = useRef<HTMLDivElement | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const closeMenu = useCallback(() => {
    setMenuVisible(false);
    setMenuPos(null);
    setMenuMount(false);
  }, []);
  const updateMenuPosition = useCallback(() => {
    if (typeof window === 'undefined' || !menuTriggerRef.current) return;
    const rect = menuTriggerRef.current.getBoundingClientRect();
    const menuEl = menuContainerRef.current;
    const spacing = 6;
    const margin = 12;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const width = menuEl?.offsetWidth ?? 200;
    const height = menuEl?.offsetHeight ?? 240;
    let left = rect.right - width;
    left = Math.min(Math.max(left, margin), viewportWidth - width - margin);
    let top = rect.bottom + spacing;
    if (top + height > viewportHeight - margin) {
      top = Math.max(rect.top - spacing - height, margin);
    }
    if (top < margin) {
      top = Math.min(rect.bottom + spacing, viewportHeight - height - margin);
    }
    setMenuPos({ top, left });
  }, []);
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void }>({ isOpen: false, title: "", message: "", onConfirm: () => {} });
  const [promptModal, setPromptModal] = useState<{ isOpen: boolean; title: string; message: string; placeholder: string; onConfirm: (value: string) => void }>({ isOpen: false, title: "", message: "", placeholder: "", onConfirm: () => {} });
  const [reportModal, setReportModal] = useState<{ isOpen: boolean; title: string; message: string; placeholder: string; onConfirm: (value: string) => void }>({ isOpen: false, title: "", message: "", placeholder: "", onConfirm: () => {} });
  const [alertModal, setAlertModal] = useState<{ isOpen: boolean; title: string; message: string }>({ isOpen: false, title: "", message: "" });
  const loginRequiredLocked = !!(community && community.join_policy === 'login' && !isAuthenticated);
  useEffect(() => {
    if (!menuMount) return;
    if (typeof window === 'undefined') return;
    const handleDocClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuTriggerRef.current?.contains(target)) return;
      if (menuContainerRef.current?.contains(target)) return;
      closeMenu();
    };
    const handleUpdate = () => updateMenuPosition();
    document.addEventListener('click', handleDocClick);
    window.addEventListener('scroll', handleUpdate, true);
    window.addEventListener('resize', handleUpdate);
    requestAnimationFrame(() => updateMenuPosition());
    return () => {
      document.removeEventListener('click', handleDocClick);
      window.removeEventListener('scroll', handleUpdate, true);
      window.removeEventListener('resize', handleUpdate);
    };
  }, [menuMount, closeMenu, updateMenuPosition]);

  useEffect(() => {
    if (menuMount && menuVisible) {
      requestAnimationFrame(() => updateMenuPosition());
    }
  }, [menuMount, menuVisible, updateMenuPosition]);

  // 削除されたコメントが非表示の場合、メインコンテンツを非表示にする
  const shouldHideDeletedComment = comment.is_deleted && !showDeletedComments;

  return (
    <div className="relative pl-3" style={{ marginLeft: level * 12 }}>
      {/* connector dot */}
      <span
        className="absolute"
        style={{ left: 0, top: 12, width: 6, height: 6, borderRadius: '9999px', background: `rgba(255,255,255,${dotAlpha})`, transform: 'translateX(-50%)' }}
        aria-hidden
      />
      {/* vertical guide for children */}
      {(children.length > 0 || hasMoreChildren) && !collapsed && (
        <span
          className="absolute"
          style={{ 
            left: 0, 
            top: 18, 
            bottom: 0, 
            width: 1, 
            background: `rgba(255,255,255,${railAlpha})`, 
            transform: 'translateX(-0.5px)' 
          }}
          aria-hidden
        />
      )}
      <div className="border-l border-subtle">
      {!shouldHideDeletedComment && (
        <>
      <div className="text-xs text-subtle flex items-center gap-1.5">
        {comment.author_username ? (
          <span className="flex items-center gap-1.5 min-w-0">
            {comment.author_icon_url ? (
              <img src={comment.author_icon_url} alt={comment.author_username} className="w-4 h-4 rounded-full border border-subtle flex-shrink-0" />
            ) : (
              <span className="w-4 h-4 rounded-full border border-subtle surface-1 flex-shrink-0" />
            )}
            <span className="truncate">{comment.author_username}</span>
            {(() => {
              const isLoggedInUser = (comment.author_username_id && !comment.author_username_id.startsWith('Anonium-')) || 
                                    (comment.author_username && !comment.author_username.startsWith('Anonium-') && !comment.author_username_id);
              return isLoggedInUser ? (
                <span 
                  ref={badgeTooltipRef}
                  className="relative inline-flex items-center justify-center flex-shrink-0 cursor-pointer" 
                  aria-label="ログイン済"
                  onClick={(e) => {
                    e.stopPropagation();
                    setBadgeTooltipOpen(!badgeTooltipOpen);
                  }}
                >
                  <svg className="w-3 h-3 text-green-500" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.1"/>
                    <path d="M7 10l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                  </svg>
                  {badgeTooltipOpen && createPortal(
                    <div 
                      className="fixed z-50 px-2 py-1 text-xs text-white bg-black/90 border border-subtle rounded shadow-lg pointer-events-none"
                      style={{
                        top: badgeTooltipRef.current ? badgeTooltipRef.current.getBoundingClientRect().bottom + 4 : 0,
                        left: badgeTooltipRef.current ? badgeTooltipRef.current.getBoundingClientRect().left + (badgeTooltipRef.current.getBoundingClientRect().width / 2) - 30 : 0,
                      }}
                    >
                      ログイン済
                    </div>,
                    document.body
                  )}
                </span>
              ) : null;
            })()}
          </span>
        ) : (
          <span>{`user #${comment.author}`}</span>
        )}
        <span suppressHydrationWarning>・ {timeText}</span>
        {comment.is_edited && (
          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-subtle" title="編集済み">編集済み</span>
        )}
      </div>
        {comment.is_deleted ? (
          <div className="text-base whitespace-pre-wrap mt-1 text-subtle">
            <div>このコメントは削除されました。</div>
            {(comment.deleted_by_username || deletedTimeText) && (
              <div className="text-xs text-subtle mt-1">
                {comment.deleted_by_username && (
                  <span>削除者: {comment.deleted_by_username}</span>
                )}
                {comment.deleted_by_username && deletedTimeText && <span> ・ </span>}
                {deletedTimeText && <span>削除時間: {deletedTimeText}</span>}
              </div>
            )}
          </div>
        ) : isEditing ? (
          <div className="mt-1 space-y-2">
            <textarea
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              className="w-full rounded-md border border-subtle bg-transparent px-3 py-2 text-sm min-h-[100px]"
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
                    const resp = await fetch(`${API}/api/comments/${comment.id}/`, {
                      method: 'PATCH',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      credentials: 'include',
                      body: JSON.stringify({ body: editBody }),
                    });
                    if (resp.ok) {
                      setIsEditing(false);
                      // コメント投稿時と同じように、展開されている場合は子コメントを再取得
                      if (!collapsed && fetchCommentDescendants) {
                        try {
                          // サーバー側の処理が完了するまで少し待つ（編集が反映されるのを待つ）
                          await new Promise(resolve => setTimeout(resolve, 300));
                          
                          // 既存の子コメントIDを取得（重複取得を防ぐため）
                          const existingIds = new Set<number>();
                          const collectIds = (comments: Comment[]) => {
                            for (const c of comments) {
                              existingIds.add(c.id);
                              if (c.children && c.children.length > 0) {
                                collectIds(c.children);
                              }
                            }
                          };
                          collectIds(children);
                          
                          // 親コメントの子コメントを再取得（編集が反映されたコメントを取得するため）
                          const result = await fetchCommentDescendants(comment.id, 20, null, existingIds);
                          
                          if (result.items && result.items.length > 0) {
                            // 新しいコメントを既存のツリーにマージ
                            const merged = mergeCommentTree(children, result.items);
                            const prevChildrenLength = children.length;
                            setChildren(merged);
                            
                            // 新しい子コメントが追加された場合は、表示数を増やす（ただし上限は維持）
                            if (merged.length > prevChildrenLength) {
                              const limit = isMobile ? 3 : 5;
                              setDisplayedChildrenCount(prev => Math.min(prev + (merged.length - prevChildrenLength), Math.min(merged.length, prev + limit)));
                            }
                            
                            // has_more_childrenとchildren_countを更新
                            if (result.next) {
                              setHasMoreChildren(true);
                            } else {
                              // 全て取得したか、children_countを確認
                              const totalFetched = merged.length;
                              setHasMoreChildren(childrenCount > totalFetched);
                            }
                            
                            // 親コンポーネントに通知（コメントツリーを更新、親IDを渡す）
                            if (onCommentsFetched) {
                              onCommentsFetched(result.items, comment.id);
                            }
                          } else {
                            // 新しいコメントが取得できなかった場合、ページ全体のリロードにフォールバック
                            onPosted();
                          }
                        } catch (error) {
                          // エラーが発生した場合は、ページ全体のリロードにフォールバック
                          onPosted();
                        }
                      } else {
                        // 折りたたまれている場合は、ページ全体のコメントを更新
                        onPosted();
                      }
                    } else {
                      const t = await resp.text();
                      setAlertModal({ isOpen: true, title: "エラー", message: t || `編集に失敗しました (${resp.status})` });
                    }
                  } catch {
                    setAlertModal({ isOpen: true, title: "エラー", message: "編集に失敗しました。" });
                  } finally {
                    setIsSubmitting(false);
                  }
                }}
                disabled={isSubmitting || !editBody.trim()}
                className="px-3 py-1.5 rounded-md bg-accent text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                保存
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setEditBody(comment.body);
                }}
                disabled={isSubmitting}
                className="px-3 py-1.5 rounded-md border border-subtle hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                キャンセル
              </button>
            </div>
          </div>
        ) : bodyWithoutImages ? (
          <>
            <RichText text={displayBody + (needsTruncate && !showFullBody ? '…' : '')} className="text-base mt-1" />
            {needsTruncate && (
              <div className="mt-1">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-xs text-subtle hover:underline"
                  onClick={() => setShowFullBody(v => !v)}
                >
                  {showFullBody ? (
                    <>
                      <span className="material-symbols-rounded" style={{ fontSize: 14, lineHeight: '14px' }} aria-hidden>close</span>
                      <span className="sr-only">閉じる</span>
                    </>
                  ) : '続きを読む'}
                </button>
              </div>
            )}
          </>
        ) : null}
        {/* Inline images if body contains direct image URLs or media field */}
        {!comment.is_deleted && displayImageUrls.length > 0 && (
          <div className="mt-2 space-y-2">
            {displayImageUrls.map((src, idx) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={idx} src={src} alt="image" className="max-w-full rounded-md border border-subtle object-contain cursor-zoom-in" style={{ height: 150, width: 'auto' }} onClick={() => setPreview(src)} />
            ))}
          </div>
        )}
        {!comment.is_deleted && displayVideoUrls.length > 0 && (
          <div className="mt-2 space-y-2">
            {displayVideoUrls.map((src, idx) => (
              <video key={idx} src={src} className="max-w-full rounded-md border border-subtle" style={{ height: 180, width: 'auto' }} controls muted={false} />
            ))}
          </div>
        )}
        {/* Fallback OGP preview for the first URL (non-image) */}
        {!comment.is_deleted && firstUrl && !/\.(png|jpe?g|gif|webp)(\?.*)?$/i.test(firstUrl) && (
          <LinkPreview url={firstUrl} />
        )}
        <div className="flex items-center gap-3 mt-1 text-xs">
        <button className={`p-0.5 ${upActive ? 'active-up' : 'text-subtle hover-up'} hover:opacity-80`} onClick={() => vote(1)} title="good" disabled={!canVote}>
          <span className={`material-symbols-rounded ${arrowBounce === 'up' ? 'animate-bounce-up' : (upActive ? 'animate-bounce-up' : '')}`} style={{ fontSize: 18, lineHeight: '18px', fontVariationSettings: '"FILL" 1, "wght" 700' }}>north</span>
        </button>
        <span className={`tabular-nums ${bump ? (countDir==='up' ? 'count-up' : (countDir==='down' ? 'count-down' : 'animate-bump')) : ''}`} style={{ minWidth: 20, textAlign: 'center', lineHeight: '16px', display: 'inline-block' }}>{score}</span>
        <button className={`p-0.5 ${downActive ? 'active-down' : 'text-subtle hover-down'} hover:opacity-80`} onClick={() => vote(-1)} title="bad" disabled={!canVote}>
          <span className={`material-symbols-rounded ${arrowBounce === 'down' ? 'animate-bounce-down' : (downActive ? 'animate-bounce-down' : '')}`} style={{ fontSize: 18, lineHeight: '18px', fontVariationSettings: '"FILL" 1, "wght" 700' }}>south</span>
        </button>
        <span className="opacity-30">|</span>
        <button className="p-0.5 text-subtle hover:opacity-80" onClick={() => setOpen(v => !v)} title="reply" disabled={!!comment.is_deleted || loginRequiredLocked}>
          <span className="material-symbols-rounded" style={{ fontSize: 16, lineHeight: '16px' }}>reply</span>
        </button>
        {/* more menu (replyの隣に配置) */}
        <div className="relative inline-block">
          <button
            type="button"
            className="p-0.5 text-subtle hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
            title="詳細"
            onClick={(e) => {
              e.stopPropagation(); e.preventDefault();
              if (!menuMount) { setMenuMount(true); requestAnimationFrame(() => setMenuVisible(true)); }
              else { closeMenu(); }
            }}
            disabled={!!comment.is_deleted}
            ref={menuTriggerRef}
          >
            <span className="material-symbols-rounded" style={{ fontSize: 16, lineHeight: '16px' }}>more_horiz</span>
          </button>
        </div>
        {menuMount && typeof document !== 'undefined' && createPortal(
            <div
              ref={menuContainerRef}
              onClick={(event) => event.stopPropagation()}
              className="fixed min-w-44 rounded-md border border-subtle surface-1 shadow-lg z-[9999]"
              style={{
                top: menuPos?.top ?? 0,
                left: menuPos?.left ?? 0,
                visibility: menuPos ? 'visible' : 'hidden'
              }}
            >
              {isOwnComment ? (
                <>
                  <button
                    className="w-full text-left px-3 py-2 text-sm hover:bg-white/10 flex items-center gap-2 border-b border-subtle"
                    onClick={(e) => {
                      e.stopPropagation(); e.preventDefault();
                      closeMenu();
                      // セキュリティ対策: JWTトークンはCookieから自動的に送信される
                      // 認証状態はAPIレスポンスで確認（401が返される場合）
                      if (!isAuthenticated) {
                        setAlertModal({ isOpen: true, title: "エラー", message: "ログインが必要です。" });
                        return;
                      }
                      setConfirmModal({
                        isOpen: true,
                        title: "コメントを削除",
                        message: "このコメントを削除しますか？",
                        onConfirm: async () => {
                          setConfirmModal({ ...confirmModal, isOpen: false });
                          try {
                            const resp = await fetch(`${API}/api/comments/${comment.id}/`, { method: 'DELETE', credentials: 'include' });
                            if (resp.status === 204) {
                              setAlertModal({ isOpen: true, title: "削除完了", message: "コメントを削除しました。" });
                              onPosted();
                            } else {
                              const t = await resp.text();
                              setAlertModal({ isOpen: true, title: "エラー", message: t || `削除に失敗しました (${resp.status})` });
                            }
                          } catch {
                            setAlertModal({ isOpen: true, title: "エラー", message: "削除に失敗しました。" });
                          }
                        },
                      });
                    }}
                  >
                    <span className="material-symbols-rounded" aria-hidden>delete</span>
                    <span>削除</span>
                  </button>
                  <button
                    className="w-full text-left px-3 py-2 text-sm hover:bg-white/10 flex items-center gap-2 border-b border-subtle"
                    onClick={(e) => {
                      e.stopPropagation(); e.preventDefault();
                      closeMenu();
                      setIsEditing(true);
                      setEditBody(comment.body);
                    }}
                  >
                    <span className="material-symbols-rounded" aria-hidden>edit</span>
                    <span>編集</span>
                  </button>
                  <button
                    className="w-full text-left px-3 py-2 text-sm hover:bg-white/10 flex items-center gap-2"
                    onClick={async (e) => {
                      e.stopPropagation(); e.preventDefault();
                      closeMenu();
                      // セキュリティ対策: JWTトークンはCookieから自動的に送信される
                      // 認証状態はAPIレスポンスで確認（401が返される場合）
                      if (!isAuthenticated) {
                        setAlertModal({ isOpen: true, title: "エラー", message: "ログインが必要です。" });
                        return;
                      }
                      // セキュリティ対策: JWTトークンはCookieから自動的に送信される
                      try {
                        const resp = await fetch(`${API}/api/posts/${comment.post}/follow/`, {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                          },
                          credentials: 'include',
                        });
                        if (resp.ok) {
                          const data = await resp.json().catch(() => null);
                          if (data && typeof data.is_following === 'boolean') {
                            setIsFollowing(data.is_following);
                            setAlertModal({ 
                              isOpen: true, 
                              title: data.is_following ? "フォローしました" : "フォロー解除しました", 
                              message: data.is_following ? "この投稿をフォローしました。" : "この投稿のフォローを解除しました。" 
                            });
                          }
                        } else {
                          const t = await resp.text();
                          setAlertModal({ isOpen: true, title: "エラー", message: t || `フォロー操作に失敗しました (${resp.status})` });
                        }
                      } catch {
                        setAlertModal({ isOpen: true, title: "エラー", message: "フォロー操作に失敗しました。" });
                      }
                    }}
                  >
                    <span className="material-symbols-rounded" aria-hidden>{isFollowing === true ? 'notifications_active' : 'notifications'}</span>
                    <span>{isFollowing === true ? 'フォロー解除' : '投稿をフォロー'}</span>
                  </button>
                </>
              ) : (
                <>
                  {(isOwner || isAdminMod || isModerator) && (
                    <button
                      className="w-full text-left px-3 py-2 text-sm hover:bg-white/10 flex items-center gap-2 border-b border-subtle"
                      onClick={(e) => {
                        e.stopPropagation(); e.preventDefault();
                        closeMenu();
                        // セキュリティ対策: JWTトークンはCookieから自動的に送信される
                      // 認証状態はAPIレスポンスで確認（401が返される場合）
                      if (!isAuthenticated) {
                          setAlertModal({ isOpen: true, title: "エラー", message: "ログインが必要です。" });
                          return;
                        }
                        setConfirmModal({
                          isOpen: true,
                          title: "コメントを削除",
                          message: "このコメントを削除しますか？",
                          onConfirm: async () => {
                            setConfirmModal({ ...confirmModal, isOpen: false });
                            try {
                              const resp = await fetch(`${API}/api/comments/${comment.id}/`, { method: 'DELETE', credentials: 'include' });
                              if (resp.status === 204) {
                                setAlertModal({ isOpen: true, title: "削除完了", message: "コメントを削除しました。" });
                                onPosted();
                              } else {
                                const t = await resp.text();
                                setAlertModal({ isOpen: true, title: "エラー", message: t || `削除に失敗しました (${resp.status})` });
                              }
                            } catch {
                              setAlertModal({ isOpen: true, title: "エラー", message: "削除に失敗しました。" });
                            }
                          },
                        });
                      }}
                    >
                      <span className="material-symbols-rounded" aria-hidden>delete</span>
                      <span>削除</span>
                    </button>
                  )}
                  {(isOwner || isAdminMod) && comment.author_username && (comment.community_id || comment.community_slug) && (
                    <>
                      <button
                        className="w-full text-left px-3 py-2 text-sm hover:bg-white/10 flex items-center gap-2"
                        onClick={(e) => {
                          e.stopPropagation(); e.preventDefault();
                          closeMenu();
                          // セキュリティ対策: JWTトークンはCookieから自動的に送信される
                      // 認証状態はAPIレスポンスで確認（401が返される場合）
                      if (!isAuthenticated) {
                            setAlertModal({ isOpen: true, title: "エラー", message: "ログインが必要です。" });
                            return;
                          }
                          setConfirmModal({
                            isOpen: true,
                            title: "ユーザーをブロック",
                            message: `ユーザー「${comment.author_username}」をこのアノニウムからブロックしますか？`,
                            onConfirm: () => {
                              setConfirmModal({ ...confirmModal, isOpen: false });
                              setPromptModal({
                                isOpen: true,
                                title: "ブロック理由",
                                message: "ブロック理由を入力してください（任意）",
                                placeholder: "理由を入力...",
                                onConfirm: async (reason) => {
                                  setPromptModal({ ...promptModal, isOpen: false });
                                  try {
                                    const targetUserId = comment.author;
                                    if (!targetUserId) {
                                      setAlertModal({ isOpen: true, title: "エラー", message: "ユーザーIDを取得できませんでした。" });
                                      return;
                                    }
                                    const communityId = comment.community_id;
                                    if (!communityId) {
                                      setAlertModal({ isOpen: true, title: "エラー", message: "コミュニティIDを取得できませんでした。" });
                                      return;
                                    }
                                    const resp = await fetch(`${API}/api/communities/${communityId}/members/${targetUserId}/block/`, {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      credentials: 'include',
                                      body: JSON.stringify({ reason }),
                                    });
                                    if (resp.ok) {
                                      const data = await resp.json().catch(() => null);
                                      setAlertModal({ isOpen: true, title: "ブロック完了", message: data?.detail || 'ブロックしました。' });
                                      onPosted();
                                    } else {
                                      const t = await resp.text();
                                      setAlertModal({ isOpen: true, title: "エラー", message: t || `ブロックに失敗しました (${resp.status})` });
                                    }
                                  } catch {
                                    setAlertModal({ isOpen: true, title: "エラー", message: "ブロックに失敗しました。" });
                                  }
                                },
                              });
                            },
                          });
                        }}
                      >
                        <span className="material-symbols-rounded" aria-hidden>block</span>
                        <span>ユーザーをブロック</span>
                      </button>
                      <button
                        className="w-full text-left px-3 py-2 text-sm hover:bg-white/10 flex items-center gap-2"
                        onClick={(e) => {
                          e.stopPropagation(); e.preventDefault();
                          closeMenu();
                          // セキュリティ対策: JWTトークンはCookieから自動的に送信される
                      // 認証状態はAPIレスポンスで確認（401が返される場合）
                      if (!isAuthenticated) {
                            setAlertModal({ isOpen: true, title: "エラー", message: "ログインが必要です。" });
                            return;
                          }
                          setConfirmModal({
                            isOpen: true,
                            title: "ユーザーを除名",
                            message: `ユーザー「${comment.author_username}」をこのアノニウムから除名しますか？`,
                            onConfirm: async () => {
                              setConfirmModal({ ...confirmModal, isOpen: false });
                              try {
                                const targetUserId = comment.author;
                                if (!targetUserId) {
                                  setAlertModal({ isOpen: true, title: "エラー", message: "ユーザーIDを取得できませんでした。" });
                                  return;
                                }
                                const communityId = comment.community_id;
                                if (!communityId) {
                                  setAlertModal({ isOpen: true, title: "エラー", message: "コミュニティIDを取得できませんでした。" });
                                  return;
                                }
                                const resp = await fetch(`${API}/api/communities/${communityId}/members/${targetUserId}/remove/`, {
                                  method: 'POST',
                                  credentials: 'include',
                                });
                                if (resp.ok) {
                                  setAlertModal({ isOpen: true, title: "除名完了", message: "ユーザーを除名しました。" });
                                  onPosted();
                                } else {
                                  const t = await resp.text();
                                  setAlertModal({ isOpen: true, title: "エラー", message: t || `除名に失敗しました (${resp.status})` });
                                }
                              } catch {
                                setAlertModal({ isOpen: true, title: "エラー", message: "除名に失敗しました。" });
                              }
                            },
                          });
                        }}
                      >
                        <span className="material-symbols-rounded" aria-hidden>person_remove</span>
                        <span>除名</span>
                      </button>
                      <button
                        className="w-full text-left px-3 py-2 text-sm hover:bg-white/10 flex items-center gap-2"
                        onClick={(e) => {
                          e.stopPropagation(); e.preventDefault();
                          closeMenu();
                          // セキュリティ対策: JWTトークンはCookieから自動的に送信される
                          setConfirmModal({
                            isOpen: true,
                            title: "ユーザーをミュート",
                            message: `ユーザー「${comment.author_username}」をミュートしますか？`,
                            onConfirm: async () => {
                              setConfirmModal({ ...confirmModal, isOpen: false });
                              try {
                                const resp = await fetch(`${API}/api/accounts/mute/`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  credentials: 'include',
                                  body: JSON.stringify({ target_username: comment.author_username_id || comment.author_username }),
                                });
                                if (resp.ok) {
                                  const j = await resp.json().catch(() => null);
                                  setAlertModal({ isOpen: true, title: "ミュート完了", message: j?.detail || 'ミュートしました。' });
                                  onPosted();
                                } else {
                                  const t = await resp.text();
                                  setAlertModal({ isOpen: true, title: "エラー", message: t || `ミュートに失敗しました (${resp.status})` });
                                }
                              } catch {
                                setAlertModal({ isOpen: true, title: "エラー", message: "ミュートに失敗しました。" });
                              }
                            },
                          });
                        }}
                      >
                        <span className="material-symbols-rounded" aria-hidden>voice_over_off</span>
                        <span>このユーザーをミュート</span>
                      </button>
                    </>
                  )}
                  {isModerator && comment.author_username && (
                    <button
                      className="w-full text-left px-3 py-2 text-sm hover:bg-white/10 flex items-center gap-2"
                    onClick={(e) => {
                      e.stopPropagation(); e.preventDefault();
                      closeMenu();
                      // セキュリティ対策: JWTトークンはCookieから自動的に送信される
                        setPromptModal({
                          isOpen: true,
                          title: "ユーザーを通報",
                          message: "ユーザーを通報する理由を入力してください（任意）",
                          placeholder: "理由を入力...",
                          onConfirm: async (reason) => {
                            setPromptModal({ ...promptModal, isOpen: false });
                            try {
                              const resp = await fetch(`${API}/api/accounts/report/`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                credentials: 'include',
                                body: JSON.stringify({ target_username: comment.author_username, reason }),
                              });
                              if (resp.ok || resp.status === 202) {
                                setAlertModal({ isOpen: true, title: "通報完了", message: "通報を受け付けました。" });
                              } else {
                                const t = await resp.text();
                                setAlertModal({ isOpen: true, title: "エラー", message: t || `通報に失敗しました (${resp.status})` });
                              }
                            } catch {
                              setAlertModal({ isOpen: true, title: "エラー", message: "通報に失敗しました。" });
                            }
                          },
                        });
                      }}
                    >
                      <span className="material-symbols-rounded" aria-hidden>flag</span>
                      <span>ユーザーを通報</span>
                    </button>
                  )}
                  {isModerator && comment.author_username && (
                    <button
                      className="w-full text-left px-3 py-2 text-sm hover:bg-white/10 flex items-center gap-2"
                    onClick={(e) => {
                      e.stopPropagation(); e.preventDefault();
                      closeMenu();
                      // セキュリティ対策: JWTトークンはCookieから自動的に送信される
                        setConfirmModal({
                          isOpen: true,
                          title: "ユーザーをミュート",
                          message: `ユーザー「${comment.author_username}」をミュートしますか？`,
                          onConfirm: async () => {
                            setConfirmModal({ ...confirmModal, isOpen: false });
                            try {
                              const resp = await fetch(`${API}/api/accounts/mute/`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                credentials: 'include',
                                body: JSON.stringify({ target_username: comment.author_username }),
                              });
                              if (resp.ok) {
                                const j = await resp.json().catch(() => null);
                                setAlertModal({ isOpen: true, title: "ミュート完了", message: j?.detail || 'ミュートしました。' });
                                onPosted();
                              } else {
                                const t = await resp.text();
                                setAlertModal({ isOpen: true, title: "エラー", message: t || `ミュートに失敗しました (${resp.status})` });
                              }
                            } catch {
                              setAlertModal({ isOpen: true, title: "エラー", message: "ミュートに失敗しました。" });
                            }
                          },
                        });
                      }}
                    >
                      <span className="material-symbols-rounded" aria-hidden>voice_over_off</span>
                      <span>このユーザーをミュート</span>
                    </button>
                  )}
                    <button
                      className="w-full text-left px-3 py-2 text-sm hover:bg-white/10 flex items-center gap-2"
                    onClick={(e) => {
                      e.stopPropagation(); e.preventDefault();
                      closeMenu();
                      // セキュリティ対策: JWTトークンはCookieから自動的に送信される
                      if (!comment.community_slug) {
                        setAlertModal({ isOpen: true, title: "エラー", message: "アノニウム情報がありません。" });
                        return;
                      }
                        setReportModal({
                          isOpen: true,
                          title: "コメントを報告",
                          message: "このコメントを報告する理由を入力してください（任意）",
                          placeholder: "報告理由を入力してください（任意）",
                          onConfirm: async (reason) => {
                            setReportModal({ isOpen: false, title: "", message: "", placeholder: "", onConfirm: () => {} });
                            try {
                              // コミュニティ情報を取得してコミュニティIDを取得
                              const communityResp = await fetch(`${API}/api/communities/${comment.community_slug}/`, {
                                credentials: 'include'
                              });
                              if (!communityResp.ok) {
                                throw new Error('アノニウム情報の取得に失敗しました。');
                              }
                              const communityData = await communityResp.json();
                              const communityId = communityData.id;
                              
                              // 報告を作成
                              const resp = await fetch(`${API}/api/messages/reports/`, {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                },
                                credentials: 'include',
                                body: JSON.stringify({
                                  community_id: communityId,
                                  comment_id: comment.id,
                                  body: reason
                                })
                              });
                              
                              if (resp.ok || resp.status === 201) {
                                setAlertModal({ isOpen: true, title: "報告完了", message: "報告を受け付けました。" });
                              } else {
                                const errorData = await resp.json().catch(() => null);
                                setAlertModal({ 
                                  isOpen: true, 
                                  title: "エラー", 
                                  message: errorData?.detail || errorData?.message || `報告に失敗しました (${resp.status})` 
                                });
                              }
                            } catch (error) {
                              setAlertModal({ 
                                isOpen: true, 
                                title: "エラー", 
                                message: error instanceof Error ? error.message : "報告に失敗しました。" 
                              });
                            }
                          },
                        });
                      }}
                    >
                      <span className="material-symbols-rounded" aria-hidden>flag</span>
                      <span>報告</span>
                    </button>
                  {!isModerator && !isAdminMod && !isOwner && comment.author_username && (
                    <button
                      className="w-full text-left px-3 py-2 text-sm hover:bg-white/10 flex items-center gap-2"
                      onClick={(e) => {
                        e.stopPropagation(); e.preventDefault();
                        closeMenu();
                        // セキュリティ対策: JWTトークンはCookieから自動的に送信される
                        setConfirmModal({
                          isOpen: true,
                          title: "ユーザーをミュート",
                          message: `ユーザー「${comment.author_username}」をミュートしますか？`,
                          onConfirm: async () => {
                            setConfirmModal({ ...confirmModal, isOpen: false });
                            try {
                              const resp = await fetch(`${API}/api/accounts/mute/`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                credentials: 'include',
                                body: JSON.stringify({ target_username: comment.author_username }),
                              });
                              if (resp.ok) {
                                const j = await resp.json().catch(() => null);
                                setAlertModal({ isOpen: true, title: "ミュート完了", message: j?.detail || 'ミュートしました。' });
                                onPosted();
                              } else {
                                const t = await resp.text();
                                setAlertModal({ isOpen: true, title: "エラー", message: t || `ミュートに失敗しました (${resp.status})` });
                              }
                            } catch {
                              setAlertModal({ isOpen: true, title: "エラー", message: "ミュートに失敗しました。" });
                            }
                          },
                        });
                      }}
                    >
                      <span className="material-symbols-rounded" aria-hidden>voice_over_off</span>
                      <span>このユーザーをミュート</span>
                    </button>
                  )}
                  <button
                    className="w-full text-left px-3 py-2 text-sm hover:bg-white/10 flex items-center gap-2 border-t border-subtle"
                    onClick={async (e) => {
                      e.stopPropagation(); e.preventDefault();
                      closeMenu();
                      // セキュリティ対策: JWTトークンはCookieから自動的に送信される
                      // 認証状態はAPIレスポンスで確認（401が返される場合）
                      if (!isAuthenticated) {
                        setAlertModal({ isOpen: true, title: "エラー", message: "ログインが必要です。" });
                        return;
                      }
                      // セキュリティ対策: JWTトークンはCookieから自動的に送信される
                      try {
                        const resp = await fetch(`${API}/api/posts/${comment.post}/follow/`, {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                          },
                          credentials: 'include',
                        });
                        if (resp.ok) {
                          const data = await resp.json().catch(() => null);
                          if (data && typeof data.is_following === 'boolean') {
                            setIsFollowing(data.is_following);
                            setAlertModal({ 
                              isOpen: true, 
                              title: data.is_following ? "フォローしました" : "フォロー解除しました", 
                              message: data.is_following ? "この投稿をフォローしました。" : "この投稿のフォローを解除しました。" 
                            });
                          }
                        } else {
                          const t = await resp.text();
                          setAlertModal({ isOpen: true, title: "エラー", message: t || `フォロー操作に失敗しました (${resp.status})` });
                        }
                      } catch {
                        setAlertModal({ isOpen: true, title: "エラー", message: "フォロー操作に失敗しました。" });
                      }
                    }}
                  >
                    <span className="material-symbols-rounded" aria-hidden>{isFollowing === true ? 'notifications_active' : 'notifications'}</span>
                    <span>{isFollowing === true ? 'フォロー解除' : '投稿をフォロー'}</span>
                  </button>
                </>
              )}
            </div>,
            document.body
          )}
        </div>
        </>
      )}
      {open && (
        <div className="mt-2">
          <Composer
            postId={comment.post}
            parentId={comment.id}
            placeholder="返信を入力..."
            onSubmitted={async () => { 
              setOpen(false); 
              // 親コメントの子コメントを再取得して展開状態を維持
              // コメントが展開されている場合のみ再取得（折りたたまれている場合はページ全体のリロードで対応）
              if (!collapsed && fetchCommentDescendants) {
                try {
                  // サーバー側の処理が完了するまで少し待つ（新しいコメントが反映されるのを待つ）
                  await new Promise(resolve => setTimeout(resolve, 300));
                  
                  // 既存の子コメントIDを取得（重複取得を防ぐため）
                  const existingIds = new Set<number>();
                  const collectIds = (comments: Comment[]) => {
                    for (const c of comments) {
                      existingIds.add(c.id);
                      if (c.children && c.children.length > 0) {
                        collectIds(c.children);
                      }
                    }
                  };
                  collectIds(children);
                  
                  // 親コメントの子コメントを再取得（最新のコメントを取得するため、excludeIdsは空にする）
                  // ただし、既に表示されているコメントの重複を避けるため、既存IDを除外
                  const result = await fetchCommentDescendants(comment.id, 20, null, existingIds);
                  
                  if (result.items && result.items.length > 0) {
                    // 新しいコメントを既存のツリーにマージ
                    const merged = mergeCommentTree(children, result.items);
                    const prevChildrenLength = children.length;
                    setChildren(merged);
                    
                    // 新しい子コメントが追加された場合は、表示数を増やす（ただし上限は維持）
                    if (merged.length > prevChildrenLength) {
                      const limit = isMobile ? 3 : 5;
                      setDisplayedChildrenCount(prev => Math.min(prev + (merged.length - prevChildrenLength), Math.min(merged.length, prev + limit)));
                    }
                    
                    // has_more_childrenとchildren_countを更新
                    if (result.next) {
                      setHasMoreChildren(true);
                    } else {
                      // 全て取得したか、children_countを確認
                      const totalFetched = merged.length;
                      setHasMoreChildren(childrenCount > totalFetched);
                    }
                    
                    // 親コンポーネントに通知（コメントツリーを更新、親IDを渡す）
                    if (onCommentsFetched) {
                      onCommentsFetched(result.items, comment.id);
                    }
                  } else {
                    // 新しいコメントが取得できなかった場合（サーバー側の遅延など）、
                    // ページ全体のリロードにフォールバック
                    onPosted();
                  }
                } catch (error) {
                  // エラーが発生した場合は、ページ全体のリロードにフォールバック
                  onPosted();
                }
              } else {
                // 折りたたまれている場合は、ページ全体のコメントを更新
                onPosted();
              }
            }}
          />
        </div>
      )}
        {(!collapsed || shouldHideDeletedComment) && (
        <div 
          ref={childrenContainerRef}
          className="mt-2 overflow-hidden animate-slide-down"
        >
          <div className="space-y-2">
            {children.length > 0 && (
              <>
                {children.slice(0, displayedChildrenCount).map((c, index) => {
                  // 新しく追加されたコメントのみにアニメーションを適用
                  const isNew = index >= prevDisplayedCountRef.current;
                  return (
                    <div
                      key={c.id}
                      className={isNew ? "animate-slide-down" : ""}
                    >
                      <CommentItem
                        comment={c}
                        onPosted={onPosted}
                        level={level + 1}
                        canModerate={canModerate}
                        canDelete={canDelete}
                        canBlock={canBlock}
                        community={community}
                        currentUsername={currentUsername}
                        isAuthenticated={isAuthenticated}
                        fetchCommentDescendants={fetchCommentDescendants}
                        onCommentsFetched={onCommentsFetched}
                        onExpandedChange={onExpandedChange}
                        initialCollapsed={collapsedMap?.get(c.id)}
                        collapsedMap={collapsedMap}
                        showDeletedComments={showDeletedComments}
                      />
                    </div>
                  );
                })}
                {/* 既に取得済みの子コメントが5件（スマホは3件）を超える場合の「もっと表示」ボタン */}
                {!comment.is_deleted && displayedChildrenCount < children.length && (
                  <div className="pt-1">
                    <div className="relative">
                      <div className="absolute -top-px left-0 right-0 h-px bg-subtle/30"></div>
                      <button
                        type="button"
                        className="relative inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-subtle surface-1 hover:bg-white/5 text-subtle hover:text-foreground transition-colors"
                        onClick={() => {
                          const increment = isMobile ? 3 : 5;
                          // アニメーション用に前回の表示数を記録
                          const prevCount = displayedChildrenCount;
                          setDisplayedChildrenCount(prev => {
                            const newCount = Math.min(prev + increment, children.length);
                            // アニメーション完了後に前回の表示数を更新
                            setTimeout(() => {
                              prevDisplayedCountRef.current = newCount;
                            }, 300);
                            return newCount;
                          });
                        }}
                        title="もっと表示"
                      >
                        <span className="material-symbols-rounded" style={{ fontSize: 14 }} aria-hidden>unfold_more</span>
                        もっと表示（残り{children.length - displayedChildrenCount}件）
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
            {/* 「コメントを閉じる」ボタンと「もっと表示」「スレッドで読む」ボタン */}
            {/* スレッドページのルートコメント（level=0）には「もっと表示」ボタンを表示しない */}
            {level > 0 && (
              <>
                {/* 「スレッドで読む」ボタン（入れ子5件/スマホ3件で表示） */}
                {((!isMobile && level >= 5) || (isMobile && level >= 3)) ? (
                  !comment.is_deleted && hasMoreChildren && (
                    <div className="pt-1">
                    <a
                      href={`/p/${comment.post}/s/${comment.id}`}
                      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-subtle surface-1 hover:bg-white/5 text-subtle hover:text-foreground transition-colors"
                    >
                      <span className="material-symbols-rounded" style={{ fontSize: 14 }} aria-hidden>forum</span>
                      スレッドで読む
                    </a>
                  </div>
                  )
                ) : (
                  /* 「もっと表示」ボタン（入れ子が浅い場合） */
                  !comment.is_deleted && hasMoreChildren && (
                    <div className="pt-1">
                    <div className="relative">
                      <div className="absolute -top-px left-0 right-0 h-px bg-subtle/30"></div>
                      <button
                        type="button"
                          className="relative inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-subtle surface-1 hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        onClick={loadChildren}
                        disabled={loadingChildren}
                          title="もっと表示"
                      >
                        <span className="material-symbols-rounded" style={{ fontSize: 14 }} aria-hidden>unfold_more</span>
                        {loadingChildren ? '読み込み中…' : 'もっと表示'}
                      </button>
                    </div>
                  </div>
                  )
                )}
              </>
            )}
            {/* 「もっと表示」「スレッドで読む」ボタンがない場合の「コメントを閉じる」ボタン（展開後に表示） */}
            {!comment.is_deleted && (!hasMoreChildren || level === 0) && (children.length > 0 || hasMoreChildren) && (
                <div className="pt-1">
                  <div className="relative">
                    <div className="absolute -top-px left-0 right-0 h-px bg-subtle/30"></div>
                    <button
                      type="button"
                      className="relative inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-subtle surface-1 hover:bg-white/5 text-subtle hover:text-foreground transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCollapsed(true);
                        onExpandedChange?.(comment.id, false);
                      }}
                      title="コメントを閉じる"
                    >
                      <span className="material-symbols-rounded" style={{ fontSize: 14 }} aria-hidden>expand_more</span>
                      コメントを閉じる
                    </button>
                  </div>
                </div>
            )}
        </div>
          </div>
        )}
        {/* 折りたたみ時の「コメントを開く」ボタン */}
        {collapsed && !comment.is_deleted && (children.length > 0 || hasMoreChildren) && (
          <div className="mt-2 pt-1">
            <div className="relative">
              <div className="absolute -top-px left-0 right-0 h-px bg-subtle/30"></div>
              <button
                type="button"
                className="relative inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-subtle surface-1 hover:bg-white/5 text-subtle hover:text-foreground transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setCollapsed(false);
                  onExpandedChange?.(comment.id, true);
                }}
                title="コメントを開く"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    setCollapsed(false);
                    onExpandedChange?.(comment.id, true);
                  }
                }}
              >
                <span className="material-symbols-rounded" style={{ fontSize: 14 }} aria-hidden>expand_less</span>
                <span>{childrenCount || children.length}件の返信を表示</span>
              </button>
            </div>
          </div>
        )}
      </div>
      {preview && (
        <ImageModal src={preview} onClose={() => setPreview(null)} />
      )}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal({ ...confirmModal, isOpen: false })}
      />
      <PromptModal
        isOpen={promptModal.isOpen}
        title={promptModal.title}
        message={promptModal.message}
        placeholder={promptModal.placeholder}
        defaultValue=""
        onConfirm={promptModal.onConfirm}
        onCancel={() => setPromptModal({ ...promptModal, isOpen: false })}
      />
      <ReportModal
        isOpen={reportModal.isOpen}
        title={reportModal.title}
        message={reportModal.message}
        placeholder={reportModal.placeholder}
        onConfirm={reportModal.onConfirm}
        onCancel={() => setReportModal({ isOpen: false, title: "", message: "", placeholder: "", onConfirm: () => {} })}
      />
      <AlertModal
        isOpen={alertModal.isOpen}
        title={alertModal.title}
        message={alertModal.message}
        onClose={() => setAlertModal({ ...alertModal, isOpen: false })}
      />
    </div>
  );
}
