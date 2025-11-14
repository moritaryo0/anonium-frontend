"use client";

export const runtime = 'edge';

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Header from "@/app/components/Header";
import PostCard from "@/app/components/PostCard";
import CommentItem from "@/app/components/CommentItem";
import Composer from "@/app/components/Composer";
import RightSidebar from "@/app/components/RightSidebar";
import SidebarTabs from "@/app/components/SidebarTabs";
import MobileNav from "@/app/components/MobileNav";
import CreateFab from "@/app/components/CreateFab";
import { addRecentPost } from "@/app/utils/recentPosts";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

type PaginatedResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

type Post = {
  id: number;
  title: string;
  body?: string;
  author: number;
  author_username?: string;
  created_at: string;
  community?: number;
  community_id?: number;
  community_slug?: string;
  community_name?: string;
  community_visibility?: string;
  community_join_policy?: string;
  community_karma?: number;
  score?: number;
  user_vote?: number | null;
  post_type?: string;
  is_following?: boolean;
  community_is_member?: boolean;
  community_membership_role?: string | null;
  can_moderate?: boolean;
  poll?: {
    id: number;
    title: string;
    options: Array<{ id: number; text: string; vote_count: number }>;
    user_vote_id?: number | null;
    expires_at?: string | null;
  } | null;
};

type Comment = {
  id: number;
  post: number;
  author: number;
  author_username?: string;
  author_icon_url?: string;
  parent?: number | null;
  body: string;
  created_at: string;
  is_deleted?: boolean;
  score?: number;
  user_vote?: number | null;
  can_moderate?: boolean;
  community_slug?: string;
  is_edited?: boolean;
  children?: Comment[];
  children_count?: number;
  has_more_children?: boolean;
  level_from_parent?: number;
};

type CommunityDetail = {
  id: number;
  name: string;
  slug: string;
  description?: string;
  members_count: number;
  is_member?: boolean;
  membership_status?: string | null;
  membership_role?: string | null;
  is_admin?: boolean;
  is_blocked?: boolean;
  is_favorite?: boolean;
  join_policy?: string;
  visibility?: string;
  karma?: number;
  rules?: string;
};

export default function PostCommentsPage() {
  const params = useParams<{ id: string }>();
  const postId = Number(params.id);
  const [signedIn, setSignedIn] = useState<boolean>(false);
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState("");
  const [community, setCommunity] = useState<CommunityDetail | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [tab, setTab] = useState<string>("home");
  const [postDetailTab, setPostDetailTab] = useState<'post' | 'detail'>('post'); // スマホ表示時の投稿/詳細タブ
  const [overlayMode, setOverlayMode] = useState<boolean>(false);
  const [vw, setVw] = useState<number>(0);
  const asideWidth = vw >= 1200 ? 300 : (vw > 1000 ? Math.round(200 + (vw - 1000) * 0.5) : undefined);
  const [commentSort, setCommentSort] = useState<'popular' | 'new' | 'old'>('popular');
  const [isReloading, setIsReloading] = useState<boolean>(false);
  const isMobile = vw > 0 && vw < 1000; // スマホ表示判定
  const [loadingComments, setLoadingComments] = useState<boolean>(false);
  const [collapsedMap, setCollapsedMap] = useState<Map<number, boolean>>(new Map()); // 折りたたみ状態のマップ
  const collapsedMapRef = useRef<Map<number, boolean>>(new Map()); // 折りたたみ状態のマップのref（最新値を保持）
  const [showDeletedComments, setShowDeletedComments] = useState<boolean>(false); // 削除されたコメントを表示するかどうか
  const [hasDeletedComments, setHasDeletedComments] = useState<boolean>(false); // 削除されたコメントが存在するかどうか
  
  // collapsedMapが更新されたときにrefも更新
  useEffect(() => {
    collapsedMapRef.current = collapsedMap;
  }, [collapsedMap]);
  function cycleCommentSort() {
    setCommentSort((prev) => (prev === 'popular' ? 'new' : (prev === 'new' ? 'old' : 'popular')));
  }
  const sortIcon = commentSort === 'popular' ? 'whatshot' : (commentSort === 'new' ? 'new_releases' : 'history');
  const sortTitle = commentSort === 'popular' ? '人気（評価）' : (commentSort === 'new' ? '最新' : '過去（古い順）');

  // メインカラムの段階的な最大幅（ホーム相当 + さらに細かい段階）
  const mainMaxWidth = useMemo(() => {
    const w = vw || 0;
    if (w >= 1200) return 800;
    if (w >= 1100) return 660;
    if (w >= 1024) return 620;
    if (w >= 900)  return 600;
    if (w >= 820)  return 580;
    if (w >= 768)  return 560;
    if (w >= 700)  return 540;
    if (w >= 640)  return 520;
    if (w >= 560)  return 500;
    if (w >= 500)  return 480;
    if (w >= 440)  return 440;
    if (w >= 400)  return 400;
    // これ以下はビュー幅いっぱい（パディング分はmainのpxクラスで調整）
    return w; 
  }, [vw]);

  const [currentUsername, setCurrentUsername] = useState<string>("");
  const [guestScore, setGuestScore] = useState<number | null>(null);
  const [mutedUserIds, setMutedUserIds] = useState<Set<number>>(new Set());

  // ページ全体で取得済みのコメントIDを追跡（重複取得を防ぐ）
  const [fetchedCommentIds, setFetchedCommentIds] = useState<Set<number>>(new Set());
  
  // 現在のcommentsの値を保存するためのref（無限ループを防ぐため）
  const commentsRef = useRef<Comment[]>([]);
  
  // コメントツリーから全てのIDを再帰的に収集する関数
  const collectAllCommentIds = useCallback((comments: Comment[]): Set<number> => {
    const ids = new Set<number>();
    const collect = (list: Comment[]) => {
      for (const comment of list) {
        ids.add(comment.id);
        if (comment.children && comment.children.length > 0) {
          collect(comment.children);
        }
      }
    };
    collect(comments);
    return ids;
  }, []);

  // ミュートユーザーのコメントとその子孫をフィルタリングする関数
  const filterMutedComments = useCallback((comments: Comment[], mutedIds: Set<number>): Comment[] => {
    if (mutedIds.size === 0) {
      return comments;
    }

    // すべてのコメントをフラットなリストに展開して、ミュートユーザーのコメントとその子孫を特定
    const allComments: Comment[] = [];
    const parentChildMap = new Map<number, number[]>(); // parentId -> [childId, ...]
    
    const collectComments = (list: Comment[], parentId: number | null = null) => {
      for (const comment of list) {
        allComments.push(comment);
        
        if (parentId !== null) {
          if (!parentChildMap.has(parentId)) {
            parentChildMap.set(parentId, []);
          }
          parentChildMap.get(parentId)!.push(comment.id);
        }
        
        if (comment.children && comment.children.length > 0) {
          collectComments(comment.children, comment.id);
        }
      }
    };
    collectComments(comments);

    // ミュートユーザーのコメントとその子孫を除外
    const toExclude = new Set<number>();
    
    // ミュートユーザーのコメントを起点として、その子孫を再帰的に除外リストに追加
    const markDescendantsForExclusion = (commentId: number) => {
      if (toExclude.has(commentId)) return; // 既に処理済み
      toExclude.add(commentId);
      
      // 子コメントも除外
      const childIds = parentChildMap.get(commentId);
      if (childIds) {
        for (const childId of childIds) {
          markDescendantsForExclusion(childId);
        }
      }
    };

    // ミュートユーザーのコメントを特定して除外
    for (const comment of allComments) {
      if (mutedIds.has(comment.author)) {
        markDescendantsForExclusion(comment.id);
      }
    }

    // 除外リストにないコメントのみを返す（階層構造を維持）
    const filterRecursive = (list: Comment[]): Comment[] => {
      return list
        .filter(comment => !toExclude.has(comment.id))
        .map(comment => {
          const filtered: Comment = { ...comment };
          if (comment.children && comment.children.length > 0) {
            filtered.children = filterRecursive(comment.children);
          }
          return filtered;
        });
    };

    return filterRecursive(comments);
  }, []);

  // 削除されたコメントを再帰的に収集し、カウントする関数
  const countDeletedComments = useCallback((comments: Comment[]): number => {
    let count = 0;
    const collect = (list: Comment[]) => {
      for (const comment of list) {
        if (comment.is_deleted) {
          count++;
        }
        if (comment.children && comment.children.length > 0) {
          collect(comment.children);
        }
      }
    };
    collect(comments);
    return count;
  }, []);

  // 削除されたコメントの数を計算
  const deletedCommentsCount = useMemo(() => {
    // showDeletedCommentsがtrueの時は、現在表示されているコメントから削除されたコメントをカウント
    if (showDeletedComments) {
      return countDeletedComments(comments);
    }
    // showDeletedCommentsがfalseの時は、削除されたコメントが表示されていないため、
    // 削除されたコメントが存在するかどうかはhasDeletedCommentsで判断する
    // 削除されたコメントの数は取得していないため、正確な数は表示しない
    return 0;
  }, [comments, countDeletedComments, showDeletedComments]);

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

  // 折りたたみ状態を保存する関数（展開状態の逆）
  const saveCollapsedState = useCallback((postId: number, collapsedIds: Set<number>) => {
    try {
      const key = `comment_collapsed_${postId}`;
      localStorage.setItem(key, JSON.stringify(Array.from(collapsedIds)));
    } catch (error) {
      // エラーは無視（ユーザーには表示しない）
    }
  }, []);

  // 折りたたみ状態を読み込む関数
  const loadCollapsedState = useCallback((postId: number): Set<number> => {
    try {
      const key = `comment_collapsed_${postId}`;
      const saved = localStorage.getItem(key);
      if (!saved) return new Set();
      const ids = JSON.parse(saved) as number[];
      return new Set(ids);
    } catch (error) {
      // エラーは無視（ユーザーには表示しない）
      return new Set();
    }
  }, []);

  // 展開されたコメントIDを保存する関数（「もっと表示」で取得したコメントの親IDを保存）
  const saveExpandedComments = useCallback((postId: number, expandedIds: Set<number>) => {
    try {
      const key = `comment_expanded_${postId}`;
      localStorage.setItem(key, JSON.stringify(Array.from(expandedIds)));
    } catch (error) {
      // エラーは無視（ユーザーには表示しない）
    }
  }, []);

  // 展開されたコメントIDを読み込む関数
  const loadExpandedComments = useCallback((postId: number): Set<number> => {
    try {
      const key = `comment_expanded_${postId}`;
      const saved = localStorage.getItem(key);
      if (!saved) return new Set();
      const ids = JSON.parse(saved) as number[];
      return new Set(ids);
    } catch (error) {
      // エラーは無視（ユーザーには表示しない）
      return new Set();
    }
  }, []);

  // コメントツリーから折りたたまれているコメントIDを収集
  // 子コメントが存在するが表示されていないコメントを折りたたまれていると判断
  const collectCollapsedIds = useCallback((comments: Comment[], allComments: Comment[]): Set<number> => {
    const collapsedIds = new Set<number>();
    const allCommentsMap = new Map<number, Comment>();
    
    // 全てのコメントをIDでマップ（再帰的に収集）
    const collectAll = (comments: Comment[]) => {
      for (const comment of comments) {
        allCommentsMap.set(comment.id, comment);
        if (comment.children && comment.children.length > 0) {
          collectAll(comment.children);
        }
      }
    };
    collectAll(allComments);
    
    // 現在表示されているコメントツリーを走査
    const checkCollapsed = (comments: Comment[]) => {
      for (const comment of comments) {
        const allComment = allCommentsMap.get(comment.id);
        if (allComment) {
          // 全てのコメントに子コメントがあるが、表示されているコメントに子コメントがない場合は折りたたまれている
          if (allComment.children && allComment.children.length > 0 && (!comment.children || comment.children.length === 0)) {
            collapsedIds.add(comment.id);
          }
          // 子コメントを再帰的にチェック
          if (comment.children && comment.children.length > 0) {
            checkCollapsed(comment.children);
          }
        }
      }
    };
    checkCollapsed(comments);
    
    return collapsedIds;
  }, []);

  // 全てのコメントの折りたたみ状態をマップに収集する関数（再帰的に）
  // 既存のマップがあれば、それを拡張する（既存の状態を保持）
  const collectCollapsedMap = useCallback((comments: Comment[], collapsedIds: Set<number>, map: Map<number, boolean>): void => {
    for (const comment of comments) {
      // 既にマップに存在する場合は既存の状態を保持、そうでない場合はcollapsedIdsから判定
      if (!map.has(comment.id)) {
        const isCollapsed = collapsedIds.has(comment.id);
        map.set(comment.id, isCollapsed);
      }
      if (comment.children && comment.children.length > 0) {
        collectCollapsedMap(comment.children, collapsedIds, map);
      }
    }
  }, []);

  // 展開状態を適用してコメントツリーを構築する関数
  // サーバーから取得した子コメントは常に表示する
  // ユーザーが手動で折りたたんだコメントのみ子コメントを非表示にする
  // collapsedIds: ユーザーが手動で折りたたんだコメントIDのセット
  // existingCollapsedMap: 既存の折りたたみ状態のマップ（オプション、新しいコメントを追加する際に既存の状態を保持するために使用）
  // 戻り値: { comments: Comment[], collapsedMap: Map<number, boolean> } - コメントツリーと折りたたみ状態のマップ
  const applyExpandedState = useCallback((comments: Comment[], collapsedIds: Set<number>, existingCollapsedMap?: Map<number, boolean>): { comments: Comment[]; collapsedMap: Map<number, boolean> } => {
    // 既存のマップがある場合はコピー、ない場合は新規作成
    const collapsedMap = existingCollapsedMap ? new Map(existingCollapsedMap) : new Map<number, boolean>();
    
    // 全てのコメント（折りたたまれているコメントの子コメントも含む）の折りたたみ状態を収集
    // 既存のマップがある場合は、既存の状態を保持しながら新しいコメントの状態を追加
    collectCollapsedMap(comments, collapsedIds, collapsedMap);
    
    // 折りたたみ状態を適用してコメントツリーを構築
    const processComments = (comments: Comment[]): Comment[] => {
      return comments.map(comment => {
        const children = comment.children || [];
        // マップから折りたたみ状態を取得（既存のマップがある場合はそれを使用、ない場合はcollapsedIdsから判定）
        const isCollapsed = collapsedMap.get(comment.id) ?? collapsedIds.has(comment.id);
        
        // 折りたたまれている場合は子コメントを非表示
        const processedChildren = isCollapsed || children.length === 0
          ? []
          : processComments(children);
        
        return {
          ...comment,
          children: processedChildren,
        };
      });
    };
    
    return {
      comments: processComments(comments),
      collapsedMap,
    };
  }, [collectCollapsedMap]);

  // コメントツリーをマージする関数（子孫コメントを追加する際に使用）
  const mergeCommentTrees = useCallback((existing: Comment[], newComments: Comment[]): Comment[] => {
    // 既存のコメントをIDでマップ（全ての階層を含む）
    const existingMap = new Map<number, Comment>();
    const collectAll = (comments: Comment[]) => {
      for (const comment of comments) {
        existingMap.set(comment.id, { ...comment });
        if (comment.children && comment.children.length > 0) {
          collectAll(comment.children);
        }
      }
    };
    collectAll(existing);
    
    // 新しいコメントをIDでマップ（全ての階層を含む）
    const newMap = new Map<number, Comment>();
    const collectNew = (comments: Comment[]) => {
      for (const comment of comments) {
        newMap.set(comment.id, { ...comment });
        if (comment.children && comment.children.length > 0) {
          collectNew(comment.children);
        }
      }
    };
    collectNew(newComments);
    
    // 新しいコメントで既存のコメントを更新または追加
    for (const [id, newComment] of newMap) {
      const existingComment = existingMap.get(id);
      if (existingComment) {
        // 既存のコメントを更新（新しいデータで上書き、ただしchildrenはマージ）
        existingMap.set(id, {
          ...newComment,
          children: mergeCommentTrees(existingComment.children || [], newComment.children || []),
        });
      } else {
        // 新しいコメントを追加
        existingMap.set(id, { ...newComment });
      }
    }
    
    // 全てのコメント（既存と新しい両方）を含むリストを作成
    const allComments: Comment[] = [];
    const allCommentIds = new Set<number>();
    
    // 既存のコメントを追加
    const addExisting = (comments: Comment[]) => {
      for (const comment of comments) {
        if (!allCommentIds.has(comment.id)) {
          allCommentIds.add(comment.id);
          allComments.push(existingMap.get(comment.id) || comment);
          if (comment.children && comment.children.length > 0) {
            addExisting(comment.children);
          }
        }
      }
    };
    addExisting(existing);
    
    // 新しいコメントを追加（既存にないもののみ）
    const addNew = (comments: Comment[]) => {
      for (const comment of comments) {
        if (!allCommentIds.has(comment.id)) {
          allCommentIds.add(comment.id);
          allComments.push(existingMap.get(comment.id) || comment);
          if (comment.children && comment.children.length > 0) {
            addNew(comment.children);
          }
        }
      }
    };
    addNew(newComments);
    
    // 親子関係を正しく構築してツリーに変換
    const buildTree = (parentId: number | null = null): Comment[] => {
      const result: Comment[] = [];
      const processed = new Set<number>();
      
      for (const comment of allComments) {
        if (processed.has(comment.id)) continue;
        
        const merged = existingMap.get(comment.id);
        if (!merged) continue;
        
        // 親IDが一致するコメントを探す
        if ((merged.parent === null && parentId === null) || (merged.parent === parentId)) {
          processed.add(comment.id);
          // 子コメントを再帰的に構築
          const children = buildTree(comment.id);
          result.push({
            ...merged,
            children,
          });
        }
      }
      
      return result;
    };
    
    return buildTree(null);
  }, []);

  // BFSで子孫コメントを取得する関数（CommentItemで使用）
  const fetchCommentDescendants = useCallback(async (commentId: number, limit: number = 5, cursor: string | null = null, excludeIds: Set<number> = new Set()): Promise<{ items: Comment[]; parents: Comment[]; next: string | null }> => {
    // セキュリティ対策: JWTトークンとゲストトークンはCookieから自動的に送信される
    const urlParams = new URLSearchParams();
    urlParams.set('limit', String(limit));
    // ソート順を追加（初期ロードと同じソート順を使用）
    urlParams.set('sort', commentSort);
    if (cursor) urlParams.set('cursor', cursor);
    // 削除されたコメントを含めるかどうか
    if (showDeletedComments) {
      urlParams.set('include_deleted', 'true');
    }
    // skip_mute_filter=trueでキャッシュ可能なデータを取得
    urlParams.set('skip_mute_filter', 'true');
    // excludeIdsは、このコメントの既存の子孫のみを含むべき
    // fetchedCommentIdsにはページ全体のIDが含まれているため、特定のコメントの子孫を取得する際には
    // そのコメントの既存の子孫のみを除外する必要がある（fetchedCommentIdsは使用しない）
    if (excludeIds.size > 0) {
      urlParams.set('exclude_ids', Array.from(excludeIds).join(','));
    }
    const url = `${API}/api/comments/${commentId}/children/?${urlParams.toString()}`;
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) {
      return { items: [], parents: [], next: null };
    }
    let data = await res.json();
    
    // フロントエンドでミュートユーザーのコメントをフィルタリング
    if (mutedUserIds.size > 0) {
      // itemsとparentsの両方をフィルタリング
      const filteredItems = filterMutedComments(data.items || [], mutedUserIds);
      const filteredParents = filterMutedComments(data.parents || [], mutedUserIds);
      data = {
        ...data,
        items: filteredItems,
        parents: filteredParents,
      };
    }
    
    return {
      items: (data.items || []).map((item: any) => ({
        id: item.id,
        post: item.post,
        author: item.author,
        author_username: item.author_username,
        author_icon_url: item.author_icon_url,
        parent: item.parent,
        body: item.body,
        created_at: item.created_at,
        is_deleted: item.is_deleted,
        deleted_by_username: item.deleted_by_username,
        deleted_at: item.deleted_at,
        score: item.score,
        user_vote: item.user_vote,
        can_moderate: item.can_moderate,
        community_slug: item.community_slug,
        is_edited: item.is_edited,
        has_more_children: item.has_more_children !== undefined ? item.has_more_children : false,
        children_count: item.children_count !== undefined ? item.children_count : 0,
        level_from_parent: item.level_from_parent || 0,
        children: item.children || [],
      })),
      parents: (data.parents || []).map((item: any) => ({
        id: item.id,
        post: item.post,
        author: item.author,
        author_username: item.author_username,
        author_icon_url: item.author_icon_url,
        parent: item.parent,
        body: item.body,
        created_at: item.created_at,
        is_deleted: item.is_deleted,
        deleted_by_username: item.deleted_by_username,
        deleted_at: item.deleted_at,
        score: item.score,
        user_vote: item.user_vote,
        can_moderate: item.can_moderate,
        community_slug: item.community_slug,
        is_edited: item.is_edited,
        has_more_children: item.has_more_children !== undefined ? item.has_more_children : false,
        children_count: item.children_count !== undefined ? item.children_count : 0,
        children: item.children || [],
      })),
      next: data.next || null,
    };
  }, [commentSort, showDeletedComments, mutedUserIds, filterMutedComments, API]);

  const fetchComments = useCallback(async (reset: boolean = false) => {
    const y = (typeof window !== 'undefined') ? window.scrollY : 0;
    
    // 折りたたみ状態を読み込む（リセット時は空のセットを使用）
    const collapsedIds = reset ? new Set<number>() : loadCollapsedState(postId);
    
    setLoadingComments(true);
    try {
      // セキュリティ対策: JWTトークンとゲストトークンはCookieから自動的に送信される
      const headers: Record<string, string> = {};
      
      // 新しいAPIを使用: ソート順と子コメント取得件数を指定
      // skip_mute_filter=trueでキャッシュ可能なデータを取得
      const urlParams = new URLSearchParams();
      urlParams.set('sort', commentSort);
      urlParams.set('children_limit', '3'); // デフォルト3件
      urlParams.set('skip_mute_filter', 'true'); // ミュートフィルタをスキップ（キャッシュ可能）
      // 削除されたコメントを含めるかどうか
      // showDeletedCommentsがtrueの時は削除されたコメントも取得
      // falseの時は削除されたコメントを除外して取得
      if (showDeletedComments) {
        urlParams.set('include_deleted', 'true');
      }
      const url = `${API}/api/posts/${postId}/comments/?${urlParams.toString()}`;
      
      const res = await fetch(url, { headers, credentials: 'include' });
      if (!res.ok) {
        commentsRef.current = [];
        setComments([]);
        setFetchedCommentIds(new Set());
        return;
      }
      
      // 新しいAPIは配列を直接返す（ページネーションなし）
      let data: Comment[] = await res.json();
      
      // フロントエンドでミュートユーザーのコメントをフィルタリング
      if (mutedUserIds.size > 0) {
        data = filterMutedComments(data, mutedUserIds);
      }
      
      // コメントを正規化（再帰的にchildrenを処理）
      const normalizeComments = (comments: Comment[]): Comment[] => {
        return comments.map(comment => {
          const children = comment.children ? normalizeComments(comment.children) : [];
          const childrenCount = comment.children_count !== undefined ? comment.children_count : 0;
          
          // has_more_childrenを再評価（孫コメントを含めた総数と比較）
          // 孫コメントも含めた総数を計算
          const totalFetched = countAllDescendants(children);
          let hasMoreChildren = comment.has_more_children;
          
          if (hasMoreChildren === undefined) {
            // サーバからhas_more_childrenが来ていない場合、children_countと取得済み総数を比較
            if (childrenCount > 0) {
              // childrenCountが設定されている場合は、取得済み総数と比較
              hasMoreChildren = childrenCount > totalFetched;
            } else {
              // childrenCountが0の場合は、直接の子コメントの数と比較（フォールバック）
              hasMoreChildren = false;
            }
          } else if (childrenCount > 0) {
            // サーバからhas_more_childrenが来ている場合でも、childrenCountが設定されている場合は再評価
            // 孫コメントが既に取得済みの場合、サーバーのフラグが正しくない可能性があるため
            hasMoreChildren = childrenCount > totalFetched;
          }
          
          return {
            ...comment,
            children,
            children_count: childrenCount,
            has_more_children: hasMoreChildren,
          };
        });
      };
      
      const normalizedComments = normalizeComments(data);
      
      // 折りたたみ状態を適用（サーバーから取得した子コメントは常に表示）
      const { comments: finalComments, collapsedMap } = applyExpandedState(normalizedComments, collapsedIds);
      
      // 折りたたみ状態のマップをstateに保存（refも更新される）
      setCollapsedMap(collapsedMap);
      collapsedMapRef.current = collapsedMap;
      
      // commentsRefを更新
      commentsRef.current = finalComments;
      
      // 取得したコメントIDを全て収集して追跡
      const newIds = collectAllCommentIds(finalComments);
      setFetchedCommentIds(prevIds => {
        const mergedIds = new Set(prevIds);
        newIds.forEach(id => mergedIds.add(id));
        return mergedIds;
      });
      
      setComments(finalComments);
      
      // 削除されたコメントが存在するかどうかを確認
      if (showDeletedComments) {
        // showDeletedCommentsがtrueの時は、削除されたコメントが表示されているため、
        // 削除されたコメントをカウントしてhasDeletedCommentsを更新
        const hasDeleted = countDeletedComments(finalComments) > 0;
        if (hasDeleted) {
          setHasDeletedComments(true);
        }
      } else if (!hasDeletedComments) {
        // showDeletedCommentsがfalseで、まだ削除されたコメントの存在を確認していない場合、
        // 削除されたコメントが存在するかどうかを確認する
        // パフォーマンスの観点から、軽量なチェック（limit=20で取得）を実行
        const checkDeletedUrl = `${API}/api/posts/${postId}/comments/?sort=${commentSort}&include_deleted=true&limit=20&skip_mute_filter=true`;
        fetch(checkDeletedUrl, { headers, credentials: 'include' })
          .then(res => res.json())
          .then((data: Comment[]) => {
            // ミュートフィルタを適用（キャッシュデータには含まれている可能性があるため）
            const filteredData = mutedUserIds.size > 0 ? filterMutedComments(data, mutedUserIds) : data;
            // 削除されたコメントが存在するかどうかを確認
            const checkDeleted = (comments: Comment[]): boolean => {
              for (const comment of comments) {
                if (comment.is_deleted) return true;
                if (comment.children && comment.children.length > 0) {
                  if (checkDeleted(comment.children)) return true;
                }
              }
              return false;
            };
            const hasDeleted = checkDeleted(filteredData);
            setHasDeletedComments(hasDeleted);
          })
          .catch(() => {
            // エラーは無視
          });
      }
      
      // 展開されたコメントIDを読み込んで、該当するコメントの子孫を再取得
      // useEffectで実行するため、ここでは展開状態のマップのみ更新
      if (!reset) {
        const expandedIds = loadExpandedComments(postId);
        if (expandedIds.size > 0) {
          // 折りたたみ状態のマップを更新（展開されたコメントが折りたたまれていないようにする）
          const updatedCollapsedMap = new Map(collapsedMap);
          for (const commentId of expandedIds) {
            updatedCollapsedMap.set(commentId, false);
          }
          setCollapsedMap(updatedCollapsedMap);
          collapsedMapRef.current = updatedCollapsedMap;
        }
      }
      
      try { requestAnimationFrame(() => window.scrollTo(0, y)); } catch {}
    } catch (error) {
      // エラーは無視（ユーザーには表示しない）
      commentsRef.current = [];
      setComments([]);
      setFetchedCommentIds(new Set());
    } finally {
      setLoadingComments(false);
    }
  }, [postId, commentSort, showDeletedComments, mutedUserIds, filterMutedComments, collectAllCommentIds, countAllDescendants, loadCollapsedState, applyExpandedState, loadExpandedComments, fetchCommentDescendants, mergeCommentTrees]);

  // ミュートユーザーリストを取得
  useEffect(() => {
    async function fetchMutedUsers() {
      // セキュリティ対策: JWTトークンはCookieから自動的に送信される
      try {
        const res = await fetch(`${API}/api/accounts/mutes/`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          const results = Array.isArray(data) ? data : (Array.isArray(data?.results) ? data.results : []);
          const mutedIds = new Set<number>(results.map((m: { id: number }) => m.id));
          setMutedUserIds(mutedIds);
        } else {
          setMutedUserIds(new Set());
        }
      } catch {
        setMutedUserIds(new Set());
      }
    }
    fetchMutedUsers();
  }, [API]);

  useEffect(() => {
    // セキュリティ対策: JWTトークンはCookieから自動的に認証される
    // 認証状態を確認（ゲストスコアも同時に取得）
    async function checkAuth() {
      try {
        const res = await fetch(`${API}/api/accounts/me/`, {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          // ゲストユーザーかどうかを確認
          const isGuest = data.is_guest || (data.username && data.username.startsWith('Anonium-'));
          const authenticated = !isGuest && data.username && !data.username.startsWith('Anonium-');
          setSignedIn(authenticated);
          if (data && data.username) {
            try { localStorage.setItem('accessUsername', data.username); } catch {}
            setCurrentUsername(data.username);
          }
          // ゲストユーザーのスコアも同時に設定（fetchGuestScoreの重複呼び出しを回避）
          if (!authenticated) {
            setGuestScore(data.score ?? 0);
          } else {
            setGuestScore(null);
          }
        } else {
          setSignedIn(false);
          setGuestScore(null);
        }
      } catch {
        setSignedIn(false);
        setGuestScore(null);
      }
    }
    
    // パフォーマンス改善: 認証チェックと投稿取得を並列実行
    Promise.all([
      checkAuth(),
      fetchPost(),
    ]).catch(() => {
      // エラーは各関数内で処理されているため、ここでは無視
    });
    
    try {
      const savedUsername = localStorage.getItem("accessUsername");
      if (savedUsername) setCurrentUsername(savedUsername);
    } catch {}
    const savedSort = localStorage.getItem('commentSort');
    if (savedSort === 'popular' || savedSort === 'new' || savedSort === 'old') setCommentSort(savedSort);
    
    function compute() {
      const w = typeof window !== 'undefined' ? window.innerWidth : 0;
      setOverlayMode(w <= 1200);
      setVw(w);
    }
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  // commentSort、postId、またはshowDeletedCommentsが変更されたらコメントを再取得
  useEffect(() => {
    if (postId) {
      fetchComments(false);
    }
  }, [postId, commentSort, showDeletedComments, fetchComments]);

  // 展開されたコメントを復元するuseEffect
  useEffect(() => {
    if (!postId || loadingComments || comments.length === 0) return;
    
    const expandedIds = loadExpandedComments(postId);
    if (expandedIds.size === 0) return;
    
    // 展開されたコメントの子孫を再取得（非同期で実行）
    const restoreExpandedComments = async () => {
      // 現在のコメントツリーを取得
      const currentComments = commentsRef.current;
      
      // 全ての展開されたコメントを順次処理（並列だと状態更新が競合する可能性があるため）
      for (const commentId of expandedIds) {
        try {
          // コメントツリー内に該当するコメントが存在するか確認する関数
          const findComment = (comments: Comment[]): Comment | null => {
            for (const comment of comments) {
              if (comment.id === commentId) {
                return comment;
              }
              if (comment.children && comment.children.length > 0) {
                const found = findComment(comment.children);
                if (found) return found;
              }
            }
            return null;
          };
          
          const targetComment = findComment(currentComments);
          if (!targetComment) {
            continue;
          }
          
          // 既に全ての子コメントが取得されている場合はスキップ
          const hasMore = targetComment.has_more_children || 
            ((targetComment.children_count ?? 0) > (targetComment.children?.length ?? 0));
          if (!hasMore) {
            continue;
          }
          
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
          if (targetComment.children) {
            collectIds(targetComment.children);
          }
          
          // 子孫コメントを取得
          const result = await fetchCommentDescendants(commentId, 20, null, existingIds);
          if (result.items && result.items.length > 0) {
            // コメントツリーを更新
            setComments(prev => {
              // 既存のコメントツリーから、対象のコメントを探して全ての子コメントを取得（再帰的に）
              const findAllDescendants = (comments: Comment[], targetId: number): Comment[] => {
                for (const comment of comments) {
                  if (comment.id === targetId) {
                    // 対象のコメントが見つかった場合、全ての子孫コメントを再帰的に収集
                    const allDescendants: Comment[] = [];
                    const collectAll = (cs: Comment[]) => {
                      for (const c of cs) {
                        allDescendants.push(c);
                        if (c.children && c.children.length > 0) {
                          collectAll(c.children);
                        }
                      }
                    };
                    if (comment.children) {
                      collectAll(comment.children);
                    }
                    return allDescendants;
                  }
                  if (comment.children && comment.children.length > 0) {
                    const found = findAllDescendants(comment.children, targetId);
                    if (found.length > 0) return found;
                  }
                }
                return [];
              };
              
              // 既存のコメントツリーから、対象のコメントの全ての子孫コメントを取得
              const existingAllDescendants = findAllDescendants(prev, commentId);
              
              // 既存の子孫コメントと新しいコメントを統合（重複を除去）
              const allDescendantsMap = new Map<number, Comment>();
              for (const descendant of existingAllDescendants) {
                allDescendantsMap.set(descendant.id, descendant);
              }
              for (const newDescendant of result.items) {
                const existing = allDescendantsMap.get(newDescendant.id);
                if (existing) {
                  // 既存のコメントを更新（新しいデータで上書き、ただしchildrenはマージ）
                  allDescendantsMap.set(newDescendant.id, {
                    ...newDescendant,
                    children: mergeCommentTrees(existing.children || [], newDescendant.children || []),
                  });
                } else {
                  // 新しいコメントを追加
                  allDescendantsMap.set(newDescendant.id, newDescendant);
                }
              }
              
              // 全ての子孫コメントを配列に変換
              const allDescendants = Array.from(allDescendantsMap.values());
              
              // 親子関係を正しく構築してツリーに変換
              const buildTreeFromFlat = (items: Comment[], parentId: number): Comment[] => {
                const result: Comment[] = [];
                for (const item of items) {
                  if (item.parent === parentId) {
                    const children = buildTreeFromFlat(items, item.id);
                    result.push({
                      ...item,
                      children,
                    });
                  }
                }
                return result;
              };
              
              // 対象のコメントの子コメントを構築（親IDがcommentIdのコメントのみ）
              const newChildren = buildTreeFromFlat(allDescendants, commentId);
              
              // 既存のコメントツリーを更新（対象のコメントの子コメントを全ての子コメントに置き換え）
              const updateComment = (comments: Comment[]): Comment[] => {
                return comments.map(comment => {
                  if (comment.id === commentId) {
                    // 対象のコメントの場合、全ての子コメントを設定
                    return {
                      ...comment,
                      children: newChildren,
                      has_more_children: false, // 全て取得したのでfalseに設定
                    };
                  }
                  // 子コメントを再帰的に更新
                  return {
                    ...comment,
                    children: comment.children ? updateComment(comment.children) : [],
                  };
                });
              };
              
              const updatedTree = updateComment(prev);
              
              // mergeCommentTreesを呼び出さずに、直接更新したコメントツリーを使用
              // （既に全ての子コメントが設定されているため）
              const currentCollapsed = loadCollapsedState(postId);
              const currentCollapsedMap = collapsedMapRef.current;
              const { comments: updatedComments, collapsedMap: updatedCollapsedMap } = applyExpandedState(updatedTree, currentCollapsed, currentCollapsedMap);
              setCollapsedMap(updatedCollapsedMap);
              collapsedMapRef.current = updatedCollapsedMap;
              commentsRef.current = updatedComments;
              return updatedComments;
            });
            
            // 取得したコメントIDを追跡に追加
            const newIds = collectAllCommentIds(result.items);
            setFetchedCommentIds(prev => {
              const merged = new Set(prev);
              newIds.forEach(id => merged.add(id));
              return merged;
            });
          } else {
            // 子孫コメントが取得できなかった場合はスキップ
          }
        } catch (error) {
          // エラーは無視（ユーザーには表示しない）
        }
      }
    };
    
    // 少し待ってから実行（初期レンダリング後に実行）
    const timeoutId = setTimeout(restoreExpandedComments, 300);
    return () => clearTimeout(timeoutId);
  }, [postId, comments.length, loadingComments, loadExpandedComments, fetchCommentDescendants, mergeCommentTrees, collectAllCommentIds, countAllDescendants, loadCollapsedState, applyExpandedState]);


  useEffect(() => {
    // community_idを優先的に使用、なければcommunity_slugを使用（後方互換性のため）
    const communityId = post?.community_id || post?.community;
    if (communityId) {
      fetchCommunity(communityId);
    } else if (post?.community_slug) {
      // フォールバック: スラッグが存在する場合はスラッグを使用（古いデータとの互換性）
      fetchCommunityBySlug(post.community_slug);
    }
    // ゲストスコアはcheckAuth()で既に取得済みのため、ここでは取得しない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post?.community_id, post?.community, post?.community_slug]);

  async function fetchGuestScore() {
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
  }

  async function fetchPost() {
    try {
      // セキュリティ対策: JWTトークンとゲストトークンはCookieから自動的に送信される
      const url = `${API}/api/posts/${postId}/`;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) {
        return;
      }
      const data: Post = await res.json();
      setPost(data);
      
      // 最近見た投稿に追加
      addRecentPost({
        id: data.id,
        title: data.title,
        created_at: data.created_at,
        community_slug: data.community_slug,
        community_name: data.community_name,
        author_username: data.author_username,
      });

      // ユーザー固有情報を取得してマージ
      // セキュリティ対策: JWTトークンはCookieから自動的に送信される
      // 認証されていない場合はサーバー側で401が返されるが、エラーは無視される
      fetchPostUserData(postId, data);
      
      // postオブジェクトから取得したメンバーシップ情報をcommunityステートにも反映
      // communityステートが存在しない場合は、基本情報で初期化（fetchCommunityで後から詳細を取得）
      if (data.community_id && (data.community_is_member !== undefined || data.community_membership_role !== undefined)) {
        setCommunity(prev => {
          if (prev && prev.id === data.community_id) {
            // 既存のcommunityステートを更新
            return {
              ...prev,
              is_member: data.community_is_member ?? prev.is_member,
              membership_role: data.community_membership_role ?? prev.membership_role,
            };
          } else if (!prev && data.community_id) {
            // communityステートが存在しない場合、基本情報で初期化
            return {
              id: data.community_id,
              name: data.community_name || '',
              slug: data.community_slug || '',
              description: '',
              members_count: 0,
              is_member: data.community_is_member ?? false,
              membership_role: data.community_membership_role ?? null,
              membership_status: null,
              is_admin: false,
              is_blocked: false,
              join_policy: data.community_join_policy,
              visibility: data.community_visibility,
              karma: data.community_karma ?? 0,
              rules: '',
            };
          }
          return prev;
        });
      }
    } catch (error) {
      // エラーは無視（ユーザーには表示しない）
    }
  }

  async function fetchPostUserData(postId: number, postData: Post) {
    try {
      // セキュリティ対策: JWTトークンはCookieから自動的に送信される
      const headers: Record<string, string> = {};

      // 投票状態、フォロー状態、コミュニティメンバーシップを並列取得
      const [voteRes, followRes, communityStatusRes] = await Promise.allSettled([
        fetch(`${API}/api/posts/${postId}/vote/`, { headers, credentials: 'include' }),
        fetch(`${API}/api/posts/${postId}/follow/`, { headers, credentials: 'include' }),
        postData.community_id ? fetch(`${API}/api/communities/${postData.community_id}/status/`, { headers, credentials: 'include' }) : Promise.resolve(null),
      ]);

      // 投票状態をマージ
      if (voteRes.status === 'fulfilled' && voteRes.value.ok) {
        const voteData = await voteRes.value.json();
        setPost(prev => prev ? { ...prev, user_vote: voteData.user_vote } : null);
      }

      // フォロー状態をマージ
      if (followRes.status === 'fulfilled' && followRes.value.ok) {
        const followData = await followRes.value.json();
        setPost(prev => prev ? { ...prev, is_following: followData.is_following } : null);
      }

      // コミュニティメンバーシップをマージ（postとcommunityの両方に反映）
      if (communityStatusRes.status === 'fulfilled' && communityStatusRes.value && communityStatusRes.value.ok) {
        const statusData = await communityStatusRes.value.json();
        setPost(prev => prev ? {
          ...prev,
          community_is_member: statusData.is_member,
          community_membership_role: statusData.membership_role,
          can_moderate: statusData.is_admin || statusData.membership_role === 'moderator',
        } : null);
        // communityステートにも反映（PostCardコンポーネントで使用される）
        // communityステートが存在しない場合は、基本情報を設定してから更新
        setCommunity(prev => {
          if (prev) {
            // 既存のcommunityステートを更新
            return {
              ...prev,
              is_member: statusData.is_member,
              membership_role: statusData.membership_role,
              membership_status: statusData.membership_status,
              is_admin: statusData.is_admin,
              is_blocked: statusData.is_blocked,
              is_favorite: statusData.is_favorite,
            };
          } else if (postData.community_id) {
            // communityステートが存在しない場合、基本情報のみで初期化
            // 詳細情報はfetchCommunityで後から取得される
            return {
              id: postData.community_id,
              name: postData.community_name || '',
              slug: postData.community_slug || '',
              description: '',
              members_count: 0,
              is_member: statusData.is_member,
              membership_role: statusData.membership_role,
              membership_status: statusData.membership_status,
              is_admin: statusData.is_admin,
              is_blocked: statusData.is_blocked,
              join_policy: postData.community_join_policy,
              visibility: postData.community_visibility,
              karma: postData.community_karma,
              rules: '',
            };
          }
          return null;
        });
      }
    } catch (error) {
      // エラーは無視（ユーザーには表示しない）
    }
  }

  async function fetchCommunity(id: number) {
    try {
      // セキュリティ対策: JWTトークンとゲストトークンはCookieから自動的に送信される
      const url = `${API}/api/communities/${id}/`;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) {
        return;
      }
      const data: CommunityDetail = await res.json();
      // 既存のメンバーシップ情報を保持（fetchPostUserDataで取得した情報が優先）
      setCommunity(prev => {
        if (prev && prev.id === id) {
          // 既存のcommunityステートがある場合、メンバーシップ情報を保持
          return {
            ...data,
            is_member: prev.is_member !== undefined ? prev.is_member : data.is_member,
            membership_role: prev.membership_role !== undefined ? prev.membership_role : data.membership_role,
            membership_status: prev.membership_status !== undefined ? prev.membership_status : data.membership_status,
            is_admin: prev.is_admin !== undefined ? prev.is_admin : data.is_admin,
            is_blocked: prev.is_blocked !== undefined ? prev.is_blocked : data.is_blocked,
            is_favorite: prev.is_favorite !== undefined ? prev.is_favorite : data.is_favorite,
          };
        }
        // 既存のcommunityステートがない場合は、新しく取得したデータを使用
        return data;
      });
    } catch (error) {
      // エラーは無視（ユーザーには表示しない）
    }
  }

  // 後方互換性のため、スラッグベースの取得も残す（使用されないことを推奨）
  async function fetchCommunityBySlug(slug: string) {
    try {
      // セキュリティ対策: JWTトークンとゲストトークンはCookieから自動的に送信される
      // スラッグからコミュニティを検索するAPIは存在しないため、エラーを無視
      // 実際にはIDベースのAPIを使用する必要がある
      console.warn('fetchCommunityBySlug is deprecated. Use community_id instead.');
    } catch (error) {
      // エラーは無視（ユーザーには表示しない）
    }
  }

  // 新しいAPIはページネーションなしなので、loadNextCommentsは不要
  // ただし、後方互換性のため残しておく（何もしない）
  const loadNextComments = useCallback(async () => {
    // 新しいAPIはページネーションをサポートしていないため、何もしない
  }, []);

  // 新しいAPIはページネーションなしなので、Intersection Observerは不要
  // ただし、後方互換性のため残しておく（何もしない）
  useEffect(() => {
    // 新しいAPIはページネーションをサポートしていないため、何もしない
  }, []);

  async function handleReload() {
    setIsReloading(true);
    try {
      const communityId = post?.community_id || post?.community;
      await Promise.all([
        fetchPost(),
        fetchComments(true),
        communityId ? fetchCommunity(communityId) : Promise.resolve()
      ]);
    } finally {
      setIsReloading(false);
    }
  }

  // ソート順変更時にコメントを再取得
  const handleSortChange = useCallback((newSort: 'popular' | 'new' | 'old') => {
    setCommentSort(newSort);
    localStorage.setItem('commentSort', newSort);
    // commentSortが変更されるとfetchCommentsが自動的に再実行される
  }, []);

  // 新しいAPIは既にソート済みなので、treeはそのまま使用
  // ただし、削除されたコメントを最後に移動する処理は残す
  const tree = useMemo(() => {
    const roots: any[] = comments.map((c) => ({ ...c }));
    // 削除されたコメントを最後に移動
    roots.sort((a, b) => {
      const d = (a.is_deleted ? 1 : 0) - (b.is_deleted ? 1 : 0);
      if (d !== 0) return d;
      // 新しいAPIは既にソート済みなので、元の順序を保持
      return 0;
    });
    return roots;
  }, [comments]);

  async function submitTopLevel() {}

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
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('accessUsername');
          setSignedIn(false);
          setCurrentUsername("");
        }}
      />

      <main className="max-w-none mx-auto px-2 sm:px-2 md:px-3 py-6">
        <div className="mx-auto" style={{ maxWidth: vw >= 1200 ? 1200 : '100%' }}>
          <div className="flex items-start gap-4 md:gap-6 min-w-0">
            <SidebarTabs
              open={sidebarOpen}
              current={tab}
              onChange={(v) => { setTab(v); }}
              setOpen={setSidebarOpen}
            />
            <section className="flex-1 min-w-0" style={{ maxWidth: mainMaxWidth }}>
              {/* スマホ表示時のタブUI */}
              {isMobile && (
                <div className="mb-4 border-b border-subtle">
                  <div className="flex rounded-t-md overflow-hidden">
                    <button
                      className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
                        postDetailTab === 'post'
                          ? 'bg-white/10 text-white border-b-2 border-accent'
                          : 'text-subtle hover:bg-white/5'
                      }`}
                      onClick={() => setPostDetailTab('post')}
                    >
                      <span className="material-symbols-rounded align-middle mr-1.5" style={{ fontSize: 18, verticalAlign: 'middle' }}>chat_bubble</span>
                      投稿
                    </button>
                    <button
                      className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
                        postDetailTab === 'detail'
                          ? 'bg-white/10 text-white border-b-2 border-accent'
                          : 'text-subtle hover:bg-white/5'
                      }`}
                      onClick={() => setPostDetailTab('detail')}
                    >
                      <span className="material-symbols-rounded align-middle mr-1.5" style={{ fontSize: 18, verticalAlign: 'middle' }}>info</span>
                      詳細
                    </button>
                  </div>
                </div>
              )}

              {/* 投稿タブの内容 */}
              {(postDetailTab === 'post' || !isMobile) && (
                <div className={`space-y-4 pr-1 ${vw < 500 ? 'pb-24' : ''}`}>
                  {/* 非公開コミュニティかつメンバーでない場合 */}
                  {community?.visibility === 'private' && !community?.is_member ? (
                    <div className="rounded-lg border border-subtle p-8 surface-1 text-center">
                      <p className="text-subtle">このアノニウムは非公開です。</p>
                    </div>
                  ) : (
                    <>
                      {/* Parent post */}
                      {post && (
                        <PostCard
                          post={post}
                          onVoted={fetchPost}
                          canModerate={!!community?.is_admin}
                          onDeleted={() => { if (community?.id) window.location.href = `/v/${community.id}`; else window.location.href = '/'; }}
                          disableLink={true}
                          community={community ? {
                            id: community.id,
                            slug: community.slug,
                            is_member: community.is_member,
                            membership_role: community.membership_role,
                            clip_post_id: null,
                            join_policy: community.join_policy,
                            karma: community.karma,
                          } : null}
                          currentUsername={currentUsername}
                          guestScore={guestScore}
                          isAuthenticated={signedIn}
                        />
                      )}

                      {/* Add comment or blocked notice */}
                      <div className="mt-3 md:mt-4">
                        {community?.is_blocked ? (
                          <div className="rounded-lg border border-subtle p-4 surface-1 text-sm text-subtle">
                            ブロックされているため、このアノニウムではコメントできません。
                          </div>
                        ) : (
                          <Composer 
                            postId={postId} 
                            placeholder="コメントを入力..." 
                            onSubmitted={fetchComments}
                            community={community ? {
                              slug: community.slug,
                              name: community.name,
                              is_member: community.is_member,
                              join_policy: community.join_policy,
                            } : null}
                            onJoinCommunity={async () => {
                              if (!community?.id) return;
                              // セキュリティ対策: JWTトークンとゲストトークンはCookieから自動的に送信される
                              // join_policyが'open'でない場合は、認証が必要（バックエンドで検証）
                              try {
                                const res = await fetch(`${API}/api/communities/${community.id}/join/`, {
                                  method: 'POST',
                                  credentials: 'include'
                                });
                                if (res.ok || res.status === 201 || res.status === 202) {
                                  // 参加成功後、投稿とコミュニティ情報を再取得してコンポーザーを解放
                                  await Promise.all([
                                    fetchPost(),
                                    fetchCommunity(community.id)
                                  ]);
                                }
                              } catch (e) {
                                // エラーは無視（ユーザーには表示しない）
                              }
                            }}
                          />
                        )}
                      </div>

                      {/* フィルタ（使いやすいセグメント + 低幅ではセレクトにフォールバック） + リロードボタン */}
                      <div className="flex items-center gap-2 mt-2">
                        {vw >= 420 ? (
                          <div className="inline-flex rounded-md border border-subtle overflow-hidden">
                            {([
                              { key: 'popular', label: '人気', icon: 'whatshot' },
                              { key: 'new', label: '新着', icon: 'new_releases' },
                              { key: 'old', label: '古い', icon: 'history' },
                            ] as const).map((item, idx) => (
                        <button
                                key={item.key}
                                className={`px-2.5 py-1.5 text-sm flex items-center gap-1 ${commentSort===item.key ? 'bg-white/10' : 'hover:bg-white/5'} ${idx>0 ? 'border-l border-subtle' : ''}`}
                                onClick={() => handleSortChange(item.key)}
                                title={item.label}
                                aria-pressed={commentSort===item.key}
                        >
                                <span className="material-symbols-rounded" style={{ fontSize: 16, lineHeight: '16px' }}>{item.icon}</span>
                                <span className="hidden sm:inline">{item.label}</span>
                        </button>
                            ))}
                          </div>
                        ) : (
                          <label className="text-xs text-subtle inline-flex items-center gap-2">
                            並び替え
                            <select
                              className="rounded-md border border-subtle bg-transparent px-2 py-1 text-sm"
                              value={commentSort}
                              onChange={(e) => { const v = e.target.value as 'popular'|'new'|'old'; handleSortChange(v); }}
                            >
                              <option value="popular">人気</option>
                              <option value="new">新着</option>
                              <option value="old">古い</option>
                            </select>
                          </label>
                        )}
                        <button
                          onClick={handleReload}
                          disabled={isReloading}
                          className="inline-flex items-center justify-center px-2.5 py-1.5 text-sm rounded-md border border-subtle surface-1 hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="最新データを取得"
                          aria-label="リロード"
                        >
                          <span className={`material-symbols-rounded ${isReloading ? 'animate-spin' : ''}`} style={{ fontSize: 16, lineHeight: '16px' }}>
                            {isReloading ? 'sync' : 'refresh'}
                          </span>
                        </button>
                      </div>

                      {/* Comments tree */}
                      <div className="space-y-3 mt-3 md:mt-4">
                        {loadingComments && comments.length === 0 ? (
                          <div className="py-8 text-center text-subtle text-sm">
                            読み込み中...
                          </div>
                        ) : (
                          <>
                            {tree.map((c: any) => {
                              const isOwner = community?.membership_role === 'owner';
                              const isAdminMod = community?.membership_role === 'admin_moderator';
                              const isModerator = community?.membership_role === 'moderator';
                              const canDelete = isOwner || isAdminMod || isModerator;
                              const canBlock = isOwner || isAdminMod;
                              
                              const isCollapsed = collapsedMap.get(c.id) ?? false;
                              return (
                                <CommentItem
                                  key={c.id}
                                  comment={c}
                                  initialCollapsed={isCollapsed}
                                  collapsedMap={collapsedMap}
                                  showDeletedComments={showDeletedComments}
                                  isAuthenticated={signedIn}
                                  onPosted={() => {
                                    // コメントが更新されたら再取得（折りたたみ状態を保持）
                                    // 現在の折りたたみ状態を保存
                                    const currentCollapsed = loadCollapsedState(postId);
                                    saveCollapsedState(postId, currentCollapsed);
                                    fetchComments(false);
                                  }}
                                  community={community ? {
                                    join_policy: community.join_policy,
                                    is_member: community.is_member,
                                    membership_role: community.membership_role,
                                    slug: community.slug,
                                    karma: community.karma,
                                  } : null}
                                  guestScore={guestScore}
                                  onExpandedChange={(commentId, isExpanded) => {
                                    // 折りたたみ状態が変更されたら保存
                                    const currentCollapsed = loadCollapsedState(postId);
                                    const expandedComments = loadExpandedComments(postId);
                                    
                                    if (isExpanded) {
                                      currentCollapsed.delete(commentId);
                                      // 展開されたコメントIDとして保存
                                      expandedComments.add(commentId);
                                      saveExpandedComments(postId, expandedComments);
                                      
                                      // 折りたたみ状態のマップも更新（refも更新）
                                      setCollapsedMap(prev => {
                                        const newMap = new Map(prev);
                                        newMap.set(commentId, false);
                                        
                                        // コメントツリーから対象のコメントを探す関数
                                        const findComment = (comments: Comment[]): Comment | null => {
                                          for (const comment of comments) {
                                            if (comment.id === commentId) {
                                              return comment;
                                            }
                                            if (comment.children && comment.children.length > 0) {
                                              const found = findComment(comment.children);
                                              if (found) return found;
                                            }
                                          }
                                          return null;
                                        };
                                        
                                        // 対象のコメントを探す
                                        const targetComment = findComment(commentsRef.current);
                                        if (targetComment) {
                                          // 以前展開していた子孫コメントも展開する
                                          // 全ての子孫コメントを再帰的に収集し、展開状態にする
                                          const expandDescendants = (comment: Comment): void => {
                                            if (comment.children && comment.children.length > 0) {
                                              for (const child of comment.children) {
                                                // 以前展開していたコメントは展開状態にする
                                                if (expandedComments.has(child.id)) {
                                                  newMap.set(child.id, false);
                                                  currentCollapsed.delete(child.id);
                                                  // 再帰的に子孫も展開
                                                  expandDescendants(child);
                                                }
                                              }
                                            }
                                          };
                                          
                                          // 子孫コメントを展開
                                          expandDescendants(targetComment);
                                        }
                                        
                                        collapsedMapRef.current = newMap;
                                        saveCollapsedState(postId, currentCollapsed);
                                        return newMap;
                                      });
                                    } else {
                                      currentCollapsed.add(commentId);
                                      // 展開されたコメントIDから削除
                                      expandedComments.delete(commentId);
                                      saveExpandedComments(postId, expandedComments);
                                      
                                      // 折りたたみ状態のマップも更新（refも更新）
                                      setCollapsedMap(prev => {
                                        const newMap = new Map(prev);
                                        newMap.set(commentId, true);
                                        collapsedMapRef.current = newMap;
                                        return newMap;
                                      });
                                      saveCollapsedState(postId, currentCollapsed);
                                    }
                                  }}
                                  canDelete={canDelete}
                                  canBlock={canBlock}
                                  currentUsername={currentUsername}
                                  fetchCommentDescendants={fetchCommentDescendants}
                                  onCommentsFetched={(newComments, parentId?: number) => {
                                    // 新しく取得したコメントIDを追跡に追加
                                    const newIds = collectAllCommentIds(newComments);
                                    setFetchedCommentIds(prev => {
                                      const merged = new Set(prev);
                                      newIds.forEach(id => merged.add(id));
                                      return merged;
                                    });
                                    
                                    // 親IDが指定されている場合、展開されたコメントIDとして保存
                                    // 子孫コメントのIDも保存（再帰的に収集）
                                    if (parentId !== undefined) {
                                      const expandedIds = loadExpandedComments(postId);
                                      expandedIds.add(parentId);
                                      
                                      // 新しく取得したコメントのIDも展開状態として保存
                                      const collectExpandedIds = (comments: Comment[]): void => {
                                        for (const comment of comments) {
                                          expandedIds.add(comment.id);
                                          if (comment.children && comment.children.length > 0) {
                                            collectExpandedIds(comment.children);
                                          }
                                        }
                                      };
                                      collectExpandedIds(newComments);
                                      
                                      saveExpandedComments(postId, expandedIds);
                                    }
                                    
                                    // コメントツリーを更新（既存のツリーに新しいコメントをマージ）
                                    // 既存の折りたたみ状態のマップを保持しながら、新しいコメントの状態を追加
                                    setComments(prev => {
                                      const merged = mergeCommentTrees(prev, newComments);
                                      
                                      // has_more_childrenを再評価（孫コメントを含めた総数と比較）
                                      const normalizeComments = (comments: Comment[]): Comment[] => {
                                        return comments.map(comment => {
                                          const children = comment.children ? normalizeComments(comment.children) : [];
                                          const childrenCount = comment.children_count ?? 0;
                                          
                                          // 孫コメントも含めた総数を計算
                                          const totalFetched = countAllDescendants(children);
                                          
                                          // has_more_childrenを再評価
                                          let hasMoreChildren = comment.has_more_children ?? false;
                                          if (childrenCount > 0) {
                                            // childrenCountが設定されている場合は、取得済み総数と比較
                                            hasMoreChildren = childrenCount > totalFetched;
                                          }
                                          
                                          return {
                                            ...comment,
                                            children,
                                            children_count: childrenCount,
                                            has_more_children: hasMoreChildren,
                                          };
                                        });
                                      };
                                      
                                      const normalized = normalizeComments(merged);
                                      
                                      // 折りたたみ状態を読み込む
                                      const currentCollapsed = loadCollapsedState(postId);
                                      
                                      // 既存の折りたたみ状態のマップを取得（refから最新値を取得）
                                      // これにより、孫以降のコメントの展開状態も維持される
                                      const currentCollapsedMap = collapsedMapRef.current;
                                      
                                      // 折りたたみ状態を適用（既存のマップを保持しながら）
                                      const { comments: finalComments, collapsedMap: updatedCollapsedMap } = applyExpandedState(normalized, currentCollapsed, currentCollapsedMap);
                                      
                                      // 折りたたみ状態のマップを更新（refも更新）
                                      setCollapsedMap(updatedCollapsedMap);
                                      collapsedMapRef.current = updatedCollapsedMap;
                                      
                                      commentsRef.current = finalComments;
                                      
                                      return finalComments;
                                    });
                                  }}
                                />
                              );
                            })}
                            {comments.length === 0 && !loadingComments && (
                              <div className="py-8 text-center text-subtle text-sm">
                                コメントはまだありません
                              </div>
                            )}
                            {/* 削除履歴ボタン */}
                            {(hasDeletedComments || deletedCommentsCount > 0) && (
                              <div className="pt-2 mt-4 border-t border-subtle">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setShowDeletedComments(prev => !prev);
                                  }}
                                  className="inline-flex items-center gap-2 text-sm text-subtle hover:text-foreground transition-colors"
                                >
                                  <span className="material-symbols-rounded" style={{ fontSize: 18, lineHeight: '18px' }}>
                                    {showDeletedComments ? 'visibility_off' : 'history'}
                                  </span>
                                  <span>
                                    {showDeletedComments 
                                      ? '削除履歴を非表示' 
                                      : deletedCommentsCount > 0 
                                        ? `削除履歴を表示（${deletedCommentsCount}件）`
                                        : '削除履歴を表示'}
                                  </span>
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* 詳細タブの内容（スマホ表示時のみ） */}
              {isMobile && postDetailTab === 'detail' && (
                <div className={`space-y-4 pr-1 ${vw < 500 ? 'pb-24' : ''}`}>
                  <RightSidebar community={community || null} />
                </div>
              )}
            </section>
            {(vw > 1000) && (
              <aside className="hidden md:block" style={{ width: asideWidth, maxWidth: 300 }}>
                <RightSidebar community={community || null} />
              </aside>
            )}
          </div>
        </div>
      </main>
      {vw > 0 && vw < 500 && (
        <div style={{ height: 72 }} />
      )}
      {vw > 0 && vw < 500 && (
        <MobileNav current={tab} onChange={(v) => { setTab(v); }} />
      )}
      <CreateFab />
    </div>
  );
}


