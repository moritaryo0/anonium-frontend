"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Header from "@/app/components/Header";
import PostCard from "@/app/components/PostCard";
import CommentItem from "@/app/components/CommentItem";
import Composer from "@/app/components/Composer";
import SidebarTabs from "@/app/components/SidebarTabs";
import MobileNav from "@/app/components/MobileNav";
import RightSidebar from "@/app/components/RightSidebar";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

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
  score?: number;
  user_vote?: number | null;
  is_following?: boolean;
  community_is_member?: boolean;
  community_membership_role?: string | null;
  can_moderate?: boolean;
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

// Rename to avoid name collision and include fields RightSidebar expects
type SidebarCommunity = {
  id: number;
  name: string;
  slug: string;
  description?: string;
  members_count?: number;
  is_member?: boolean;
  membership_status?: string | null;
  membership_role?: string | null;
  is_admin?: boolean;
  is_blocked?: boolean;
  join_policy?: string;
  rules?: any;
  icon_url?: string;
};

export default function DeepThreadPage() {
  const params = useParams<{ id: string; cid: string }>();
  const router = useRouter();
  const postId = Number(params.id);
  const rootCommentId = Number(params.cid);
  const [signedIn, setSignedIn] = useState<boolean>(false);
  const [post, setPost] = useState<Post | null>(null);
  const [community, setCommunity] = useState<SidebarCommunity | null>(null);
  const [communityUserStatus, setCommunityUserStatus] = useState<{
    is_member?: boolean;
    membership_status?: string | null;
    membership_role?: string | null;
    is_admin?: boolean;
    is_blocked?: boolean;
    is_favorite?: boolean;
  } | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [vw, setVw] = useState<number>(0);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [tab, setTab] = useState<string>("home");
  const [postDetailTab, setPostDetailTab] = useState<'post' | 'detail'>('post');
  const [collapsedMap, setCollapsedMap] = useState<Map<number, boolean>>(new Map()); // 折りたたみ状態のマップ
  const collapsedMapRef = useRef<Map<number, boolean>>(new Map()); // 折りたたみ状態のマップのref（最新値を保持）
  const commentsRef = useRef<Comment[]>([]); // コメントのref（最新値を保持）
  
  // collapsedMapが更新されたときにrefも更新
  useEffect(() => {
    collapsedMapRef.current = collapsedMap;
  }, [collapsedMap]);

  // responsive helpers (mirror /p/[id])
  const isMobile = vw > 0 && vw < 1000;
  const asideWidth = vw >= 1200 ? 300 : (vw > 1000 ? Math.round(200 + (vw - 1000) * 0.5) : undefined);
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
    return w;
  }, [vw]);

  useEffect(() => {
    // セキュリティ対策: JWTトークンはCookieから自動的に送信される
    // 認証状態を確認
    async function checkAuth() {
      try {
        const res = await fetch(`${API}/api/accounts/me/`, {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          // ゲストユーザーかどうかを確認
          const isGuest = data.is_guest || (data.username && data.username.startsWith('Anonium-'));
          setSignedIn(!isGuest && data.username && !data.username.startsWith('Anonium-'));
        } else {
          setSignedIn(false);
        }
      } catch {
        setSignedIn(false);
      }
    }
    checkAuth();
    fetchPost();
    fetchComments();
    function compute() {
      const w = typeof window !== 'undefined' ? window.innerWidth : 0;
      setVw(w);
    }
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId, rootCommentId]);

  async function fetchPost() {
    // セキュリティ対策: JWTトークンはCookieから自動的に送信される
    const res = await fetch(`${API}/api/posts/${postId}/`, { credentials: 'include' });
    if (!res.ok) return;
    const data: Post = await res.json();
    setPost(data);
    // community_idを優先的に使用、なければcommunity_slugを使用（後方互換性のため）
    const communityId = data.community_id || data.community;
    if (communityId) {
      fetchCommunity(communityId);
    } else if (data.community_slug) {
      // フォールバック: スラッグが存在する場合はスラッグを使用（古いデータとの互換性）
      // ただし、スラッグベースのAPIは存在しないため、エラーを無視
      console.warn('community_slug is deprecated. Use community_id instead.');
    }

    // ユーザー固有情報を取得してマージ
    fetchPostUserData(postId, data);
  }

  async function fetchPostUserData(postId: number, postData: Post) {
    try {
      // セキュリティ対策: JWTトークンはCookieから自動的に送信される
      // 投票状態、フォロー状態、コミュニティメンバーシップを並列取得
      const [voteRes, followRes, communityStatusRes] = await Promise.allSettled([
        fetch(`${API}/api/posts/${postId}/vote/`, { credentials: 'include' }),
        fetch(`${API}/api/posts/${postId}/follow/`, { credentials: 'include' }),
        postData.community_id ? fetch(`${API}/api/communities/${postData.community_id}/status/`, { credentials: 'include' }) : Promise.resolve(null),
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

      // コミュニティメンバーシップをマージ
      if (communityStatusRes.status === 'fulfilled' && communityStatusRes.value && communityStatusRes.value.ok) {
        const statusData = await communityStatusRes.value.json();
        setPost(prev => prev ? {
          ...prev,
          community_is_member: statusData.is_member,
          community_membership_role: statusData.membership_role,
          can_moderate: statusData.is_admin || statusData.membership_role === 'moderator',
        } : null);
      }
    } catch (error) {
      // エラーは無視（ユーザーには表示しない）
    }
  }

  async function fetchCommunity(id: number) {
    // セキュリティ対策: JWTトークンはCookieから自動的に送信される
    const res = await fetch(`${API}/api/communities/${id}/`, { credentials: 'include' });
    if (!res.ok) return;
    const data = await res.json();
    setCommunity(data as SidebarCommunity);
    
    // ユーザー状態を別途取得
    fetchCommunityUserStatus(id);
  }

  async function fetchCommunityUserStatus(id: number) {
    try {
      // セキュリティ対策: JWTトークンはCookieから自動的に送信される
      const res = await fetch(`${API}/api/communities/${id}/status/`, { credentials: 'include' });
      if (res.ok) {
        const status = await res.json();
        setCommunityUserStatus(status);
      } else {
        // エラーの場合はデフォルト値を設定
        setCommunityUserStatus({
          is_member: false,
          membership_status: null,
          membership_role: null,
          is_admin: false,
          is_blocked: false,
          is_favorite: false,
        });
      }
    } catch (error) {
      // エラーの場合はデフォルト値を設定
      setCommunityUserStatus({
        is_member: false,
        membership_status: null,
        membership_role: null,
        is_admin: false,
        is_blocked: false,
        is_favorite: false,
      });
    }
  }

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

  // BFSで子孫コメントを取得する関数
  const fetchCommentDescendants = useCallback(async (commentId: number, limit: number = 5, cursor: string | null = null, excludeIds: Set<number> = new Set()): Promise<{ items: Comment[]; parents: Comment[]; next: string | null }> => {
    // セキュリティ対策: JWTトークンはCookieから自動的に送信される
    const urlParams = new URLSearchParams();
    urlParams.set('limit', String(limit));
    if (cursor) urlParams.set('cursor', cursor);
    if (excludeIds.size > 0) {
      urlParams.set('exclude_ids', Array.from(excludeIds).join(','));
    }
    const url = `${API}/api/comments/${commentId}/children/?${urlParams.toString()}`;
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) {
      return { items: [], parents: [], next: null };
    }
    const data = await res.json();
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
        score: item.score,
        user_vote: item.user_vote,
        can_moderate: item.can_moderate,
        community_slug: item.community_slug,
        is_edited: item.is_edited,
        has_more_children: item.has_more_children || false,
        children_count: item.children_count || 0,
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
        score: item.score,
        user_vote: item.user_vote,
        can_moderate: item.can_moderate,
        community_slug: item.community_slug,
        is_edited: item.is_edited,
        has_more_children: item.has_more_children || false,
        children_count: item.children_count || 0,
        children: item.children || [],
      })),
      next: data.next || null,
    };
  }, []);

  // ルートコメントとその子孫コメントを取得する関数
  // retryCount: リトライ回数（デフォルト: 0、最大2回までリトライ）
  const fetchRootCommentWithDescendants = useCallback(async (retryCount: number = 0): Promise<Comment | null> => {
    try {
      // セキュリティ対策: JWTトークンはCookieから自動的に送信される
      // ルートコメントを取得
      const rootRes = await fetch(`${API}/api/comments/${rootCommentId}/`, { credentials: 'include' });
      if (!rootRes.ok) {
        // 404エラーの場合、リトライ可能な場合は少し待ってからリトライ
        if (rootRes.status === 404 && retryCount < 2) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // 1秒、2秒と待機時間を増やす
          return fetchRootCommentWithDescendants(retryCount + 1);
        }
        return null;
      }
      const rootComment: Comment = await rootRes.json();
      
      // ルートコメントの子孫コメントをBFSで取得（子コメント・孫コメントまで取得）
      // まず子コメントを取得
      const { items: initialDescendants, next: initialNext } = await fetchCommentDescendants(rootCommentId, 20, null);
      
      // 子コメントの子コメント（孫コメント）も取得
      const allDescendants: Comment[] = [...initialDescendants];
      const processedIds = new Set<number>();
      initialDescendants.forEach(c => processedIds.add(c.id));
      
      // 各子コメントの子コメントを取得
      for (const child of initialDescendants) {
        if (child.children && child.children.length > 0) {
          // 既に子コメントが含まれている場合はスキップ
          continue;
        }
        try {
          const { items: grandchildren } = await fetchCommentDescendants(child.id, 3, null, processedIds);
          if (grandchildren && grandchildren.length > 0) {
            allDescendants.push(...grandchildren);
            grandchildren.forEach(c => processedIds.add(c.id));
          }
        } catch {
          // エラー時はスキップ
        }
      }
      
      // ツリー構造に変換
      const buildTreeFromFlat = (items: Comment[], parentId: number): Comment[] => {
        const nodeMap = new Map<number, Comment>();
        const roots: Comment[] = [];
        
        // まず全てのノードを作成（has_more_childrenフラグも保持）
        for (const item of items) {
          nodeMap.set(item.id, { 
            ...item, 
            children: [],
            has_more_children: item.has_more_children || false,
          });
        }
        
        // 親子関係を構築
        for (const item of items) {
          const node = nodeMap.get(item.id)!;
          if (item.parent === parentId) {
            // 直接の子
            roots.push(node);
          } else if (item.parent) {
            // 子孫
            const parentNode = nodeMap.get(item.parent);
            if (parentNode) {
              if (!parentNode.children) parentNode.children = [];
              parentNode.children.push(node);
            } else {
              // 親が見つからない場合はルートに追加（データ不整合の場合）
              roots.push(node);
            }
          }
        }
        
        return roots;
      };
      
      const childrenTree = buildTreeFromFlat(allDescendants, rootCommentId);
      
      // 子コメント（level=1）のhas_more_childrenをfalseに設定（初期表示で孫コメントも取得済みのため）
      // 孫コメント（level=2）以降は元のhas_more_childrenを保持
      const setChildrenHasMoreChildren = (comments: Comment[], currentLevel: number = 1) => {
        for (const comment of comments) {
          // 子コメント（level=1）のみhas_more_childrenをfalseに設定
          if (currentLevel === 1) {
            comment.has_more_children = false;
          }
          // 孫コメント以降は元の値を保持したまま再帰的に処理
          if (comment.children && comment.children.length > 0) {
            setChildrenHasMoreChildren(comment.children, currentLevel + 1);
          }
        }
      };
      setChildrenHasMoreChildren(childrenTree, 1);
      
      const treeNode: Comment = { 
        ...rootComment, 
        children: childrenTree,
        // ルートコメントには「もっと表示」ボタンを表示しないため、has_more_childrenをfalseに設定
        has_more_children: false,
      };
      
      return treeNode;
    } catch (error) {
      // エラーが発生した場合、リトライ可能な場合は少し待ってからリトライ
      if (retryCount < 2) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // 1秒、2秒と待機時間を増やす
        return fetchRootCommentWithDescendants(retryCount + 1);
      }
      return null;
    }
  }, [rootCommentId, fetchCommentDescendants]);

  const fetchComments = useCallback(async () => {
    try {
      const y = (typeof window !== 'undefined') ? window.scrollY : 0;
      const rootComment = await fetchRootCommentWithDescendants();
      if (rootComment) {
        // 折りたたみ状態を読み込む
        const collapsedIds = loadCollapsedState(postId);
        // 折りたたみ状態を適用（サーバーから取得した子コメントは常に表示）
        const { comments: processedComments, collapsedMap } = applyExpandedState([rootComment], collapsedIds);
        const processedComment = processedComments[0];
        
        // 折りたたみ状態のマップをstateに保存（refも更新）
        setCollapsedMap(collapsedMap);
        collapsedMapRef.current = collapsedMap;
        
        // commentsRefを更新
        commentsRef.current = [processedComment];
        
        setComments([processedComment]);
        
        // 展開されたコメントIDを読み込んで、該当するコメントの子孫を再取得
        const expandedIds = loadExpandedComments(postId);
        if (expandedIds.size > 0) {
          // 折りたたみ状態のマップを更新（展開されたコメントが折りたたまれていないようにする）
          const updatedCollapsedMap = new Map(collapsedMap);
          for (const commentId of expandedIds) {
            updatedCollapsedMap.set(commentId, false);
          }
          setCollapsedMap(updatedCollapsedMap);
          collapsedMapRef.current = updatedCollapsedMap;
          
          // 展開されたコメントの子孫を再取得（非同期で実行）
          const restoreExpandedComments = async () => {
            // 現在のコメントツリーを取得
            const currentComments = commentsRef.current;
            const currentRootComment = currentComments.length > 0 ? currentComments[0] : processedComment;
            
            // 全ての展開されたコメントを並列で処理
            const restorePromises = Array.from(expandedIds).map(async (commentId) => {
              try {
                // コメントツリー内に該当するコメントが存在するか確認
                const findComment = (comment: Comment): Comment | null => {
                  if (comment.id === commentId) {
                    return comment;
                  }
                  if (comment.children && comment.children.length > 0) {
                    for (const child of comment.children) {
                      const found = findComment(child);
                      if (found) return found;
                    }
                  }
                  return null;
                };
                
                const targetComment = findComment(currentRootComment);
                if (!targetComment) {
                  // コメントがツリー内に見つからない場合（削除された、またはツリー構造が変わった場合）はスキップ
                  return;
                }
                
                // 既に全ての子コメントが取得されている場合はスキップ
                const hasMore = targetComment.has_more_children || 
                  ((targetComment.children_count ?? 0) > (targetComment.children?.length ?? 0));
                if (!hasMore) {
                  return;
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
                      if (prev.length === 0 || prev[0].id !== rootCommentId) {
                        return prev;
                      }
                      
                      const rootComment = prev[0];
                      
                      // 既存の子コメントと新しいコメントを統合してマップを作成
                      const allCommentsMap = new Map<number, Comment>();
                      
                      // 既存の子コメントをマップに追加（全ての階層を含む）
                      const collectExisting = (comments: Comment[]) => {
                        for (const comment of comments) {
                          allCommentsMap.set(comment.id, { ...comment });
                          if (comment.children && comment.children.length > 0) {
                            collectExisting(comment.children);
                          }
                        }
                      };
                      collectExisting(rootComment.children || []);
                      
                      // 新しいコメントをマップに追加または更新（全ての階層を含む）
                      const collectNew = (comments: Comment[]) => {
                        for (const comment of comments) {
                          const existing = allCommentsMap.get(comment.id);
                          if (existing) {
                            allCommentsMap.set(comment.id, {
                              ...comment,
                              children: mergeCommentTrees(existing.children || [], comment.children || []),
                            });
                          } else {
                            allCommentsMap.set(comment.id, { ...comment });
                          }
                          if (comment.children && comment.children.length > 0) {
                            collectNew(comment.children);
                          }
                        }
                      };
                      collectNew(result.items);
                      
                      // 親子関係を正しく構築してツリーに変換（親IDがparentIdのコメントのみ）
                      const buildTreeForParent = (parentId: number, processed: Set<number> = new Set()): Comment[] => {
                        const result: Comment[] = [];
                        
                        // 全てのコメントを走査して、親IDが一致するコメントを探す
                        for (const [id, comment] of allCommentsMap) {
                          if (processed.has(id)) continue;
                          
                          // 親IDが一致するコメントを探す
                          if (comment.parent === parentId) {
                            processed.add(id);
                            // 子コメントを再帰的に構築
                            const children = buildTreeForParent(id, processed);
                            result.push({
                              ...comment,
                              children,
                            });
                          }
                        }
                        
                        return result;
                      };
                      
                      // ルートコメントの子コメントを構築
                      const mergedChildren = buildTreeForParent(rootCommentId);
                      
                      // ルートコメントを更新（子コメントをマージしたものに置き換え）
                      const updatedRootComment: Comment = {
                        ...rootComment,
                        children: mergedChildren,
                      };
                      
                      // 折りたたみ状態を読み込む
                      const currentCollapsed = loadCollapsedState(postId);
                      
                      // 既存の折りたたみ状態のマップを取得（refから最新値を取得）
                      const currentCollapsedMap = collapsedMapRef.current;
                      
                      // 折りたたみ状態を適用（既存のマップを保持しながら）
                      const { comments: finalComments, collapsedMap: updatedCollapsedMap } = applyExpandedState([updatedRootComment], currentCollapsed, currentCollapsedMap);
                      
                      // 折りたたみ状態のマップを更新（refも更新）
                      setCollapsedMap(updatedCollapsedMap);
                      collapsedMapRef.current = updatedCollapsedMap;
                      
                      commentsRef.current = finalComments;
                      
                      return finalComments;
                    });
                    
                    // 取得したコメントIDを追跡に追加
                    const newIds = collectAllCommentIds(result.items);
                  }
              } catch (error) {
                // エラーは無視（ユーザーには表示しない）
              }
            });
            
            await Promise.all(restorePromises);
          };
          
          // 少し待ってから実行（初期レンダリング後に実行）
          setTimeout(restoreExpandedComments, 200);
        }
      } else {
        // ルートコメントが見つからない場合、既存のコメントを保持（リロードエラー時も表示を維持）
        // ただし、初回読み込み時（commentsRef.currentが空）の場合は空にする
        if (commentsRef.current.length === 0) {
          commentsRef.current = [];
          setComments([]);
        } else {
          // 既存のコメントがある場合は、そのまま維持（リロードエラー時も表示を維持）
        }
      }
      // 元のスクロール位置を復元（ページ最上部に戻るのを防ぐ）
      try { requestAnimationFrame(() => window.scrollTo(0, y)); } catch {}
    } catch (error) {
      // エラー時も既存のコメントを保持（リロードエラー時も表示を維持）
      if (commentsRef.current.length === 0) {
        commentsRef.current = [];
        setComments([]);
      }
    }
  }, [postId, rootCommentId, fetchRootCommentWithDescendants, loadCollapsedState, applyExpandedState, loadExpandedComments, fetchCommentDescendants, mergeCommentTrees, collectAllCommentIds]);

  const subtree = useMemo(() => {
    if (!comments.length || !rootCommentId) return null;
    // commentsにはルートコメントが1つだけ含まれている
    const rootComment = comments[0];
    if (rootComment && rootComment.id === rootCommentId) {
      return rootComment;
    }
    return null;
  }, [comments, rootCommentId]);

  const canModerateFlags = useMemo(() => {
    const role = community?.membership_role;
    const isOwner = role === 'owner';
    const isAdminMod = role === 'admin_moderator';
    const isModerator = role === 'moderator';
    return { canDelete: !!(isOwner || isAdminMod || isModerator), canBlock: !!(isOwner || isAdminMod) };
  }, [community?.membership_role]);

  const currentUsername = useMemo(() => {
    try { return localStorage.getItem('accessUsername') || ''; } catch { return ''; }
  }, []);

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
          localStorage.removeItem("accessToken");
          localStorage.removeItem("refreshToken");
          localStorage.removeItem("accessUsername");
          setSignedIn(false);
          router.push("/");
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
              {/* スマホ表示時のタブUI（/p/[id] と同じ） */}
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

              {/* 投稿タブ（/p/[id] と同様。ここだけ深いスレッド表示に差し替え） */}
              {(postDetailTab === 'post' || !isMobile) && (
                <div className={`space-y-4 pr-1 ${vw < 500 ? 'pb-24' : ''}`}>
                  {post && (
                    <PostCard
                      post={post}
                      onVoted={fetchPost}
                      onDeleted={() => { if (community?.slug) window.location.href = `/v/${community.slug}`; else window.location.href = '/'; }}
                      disableLink={true}
                      community={community}
                      currentUsername={currentUsername}
                    />
                  )}

                  <div className="mt-4">
                    {!subtree ? (
                      <div className="rounded-md border border-subtle p-3 surface-1 text-sm text-subtle">スレッドが見つかりませんでした。</div>
                    ) : (
                      <div className="space-y-3">
                        {!community?.is_blocked ? (
                          <Composer
                            postId={postId}
                            parentId={subtree.id}
                            placeholder="返信を入力..."
                            onSubmitted={fetchComments}
                            community={community}
                          />
                        ) : (
                          <div className="rounded-md border border-subtle p-3 surface-1 text-sm text-subtle">ブロックされているため、このアノニウムではコメントできません。</div>
                        )}

                    <div className="flex items-center justify-between mb-2">
                      <a href={`/p/${postId}`} className="text-xs text-subtle hover:text-accent">スレッドに戻る</a>
                      <button
                        className="text-xs px-2 py-1 rounded-md border border-subtle surface-1 hover:bg-white/5"
                        onClick={fetchComments}
                      >
                        更新
                      </button>
                    </div>

                        <CommentItem
                          comment={subtree}
                          initialCollapsed={collapsedMap.get(subtree.id) ?? false}
                          collapsedMap={collapsedMap}
                          isAuthenticated={signedIn}
                          onPosted={async () => {
                            // コメントが更新されたら再取得（折りたたみ状態を保持）
                            // 現在の折りたたみ状態を保存
                            const currentCollapsed = loadCollapsedState(postId);
                            saveCollapsedState(postId, currentCollapsed);
                            
                            // サーバー側の処理が完了するまで少し待つ（新しいコメントが反映されるのを待つ）
                            await new Promise(resolve => setTimeout(resolve, 500));
                            
                            // コメントを再取得
                            fetchComments();
                          }}
                          level={0}
                          canDelete={canModerateFlags.canDelete}
                          canBlock={canModerateFlags.canBlock}
                          community={community}
                          currentUsername={currentUsername}
                          fetchCommentDescendants={fetchCommentDescendants}
                          onCommentsFetched={(newComments, parentId?: number) => {
                            // 新しく取得したコメントIDを追跡に追加
                            const newIds = collectAllCommentIds(newComments);
                            
                            // 親IDが指定されている場合、展開されたコメントIDとして保存
                            if (parentId !== undefined) {
                              const expandedIds = loadExpandedComments(postId);
                              expandedIds.add(parentId);
                              saveExpandedComments(postId, expandedIds);
                            }
                            
                            // コメントツリーを更新（既存のツリーに新しいコメントをマージ）
                            setComments(prev => {
                              // スレッドページの場合、prevにはルートコメントが1つだけ含まれている
                              if (prev.length === 0) {
                                // 既存のコメントがない場合は何もしない
                                return prev;
                              }
                              
                              const rootComment = prev[0];
                              if (!rootComment || rootComment.id !== rootCommentId) {
                                // ルートコメントが一致しない場合は既存のコメントを返す
                                return prev;
                              }
                              
                              // ルートコメントの子コメントのみをマージ
                              // 既存の子コメントと新しいコメントを統合してマップを作成
                              const allCommentsMap = new Map<number, Comment>();
                              
                              // 既存の子コメントをマップに追加（全ての階層を含む）
                              const collectExisting = (comments: Comment[]) => {
                                for (const comment of comments) {
                                  allCommentsMap.set(comment.id, { ...comment });
                                  if (comment.children && comment.children.length > 0) {
                                    collectExisting(comment.children);
                                  }
                                }
                              };
                              collectExisting(rootComment.children || []);
                              
                              // 新しいコメントをマップに追加または更新（全ての階層を含む）
                              const collectNew = (comments: Comment[]) => {
                                for (const comment of comments) {
                                  const existing = allCommentsMap.get(comment.id);
                                  if (existing) {
                                    // 既存のコメントを更新（新しいデータで上書き、ただしchildrenはマージ）
                                    allCommentsMap.set(comment.id, {
                                      ...comment,
                                      children: mergeCommentTrees(existing.children || [], comment.children || []),
                                    });
                                  } else {
                                    // 新しいコメントを追加
                                    allCommentsMap.set(comment.id, { ...comment });
                                  }
                                  if (comment.children && comment.children.length > 0) {
                                    collectNew(comment.children);
                                  }
                                }
                              };
                              collectNew(newComments);
                              
                              // 親子関係を正しく構築してツリーに変換（親IDがparentIdのコメントのみ）
                              const buildTreeForParent = (parentId: number, processed: Set<number> = new Set()): Comment[] => {
                                const result: Comment[] = [];
                                
                                // 全てのコメントを走査して、親IDが一致するコメントを探す
                                for (const [id, comment] of allCommentsMap) {
                                  // 既に処理済みの場合はスキップ
                                  if (processed.has(id)) continue;
                                  
                                  // 親IDが一致するコメントを探す
                                  if (comment.parent === parentId) {
                                    processed.add(id);
                                    // 子コメントを再帰的に構築
                                    const children = buildTreeForParent(id, processed);
                                    result.push({
                                      ...comment,
                                      children,
                                    });
                                  }
                                }
                                
                                return result;
                              };
                              
                              // ルートコメントの子コメントを構築
                              const mergedChildren = buildTreeForParent(rootCommentId);
                              
                              // ルートコメントを更新（子コメントをマージしたものに置き換え）
                              const updatedRootComment: Comment = {
                                ...rootComment,
                                children: mergedChildren,
                              };
                              
                              // 折りたたみ状態を読み込む
                              const currentCollapsed = loadCollapsedState(postId);
                              
                              // 既存の折りたたみ状態のマップを取得（refから最新値を取得）
                              // これにより、孫以降のコメントの展開状態も維持される
                              const currentCollapsedMap = collapsedMapRef.current;
                              
                              // 折りたたみ状態を適用（既存のマップを保持しながら）
                              const { comments: finalComments, collapsedMap: updatedCollapsedMap } = applyExpandedState([updatedRootComment], currentCollapsed, currentCollapsedMap);
                              
                              // 折りたたみ状態のマップを更新（refも更新）
                              setCollapsedMap(updatedCollapsedMap);
                              collapsedMapRef.current = updatedCollapsedMap;
                              
                              commentsRef.current = finalComments;
                              
                              return finalComments;
                            });
                          }}
                          onExpandedChange={(commentId, isExpanded) => {
                            // 折りたたみ状態が変更されたら保存
                            const currentCollapsed = loadCollapsedState(postId);
                            if (isExpanded) {
                              currentCollapsed.delete(commentId);
                            } else {
                              currentCollapsed.add(commentId);
                            }
                            saveCollapsedState(postId, currentCollapsed);
                            // 折りたたみ状態のマップも更新（refも更新）
                            setCollapsedMap(prev => {
                              const newMap = new Map(prev);
                              newMap.set(commentId, !isExpanded);
                              collapsedMapRef.current = newMap;
                              return newMap;
                            });
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 詳細タブ（モバイル） */}
              {isMobile && postDetailTab === 'detail' && (
                <div className={`space-y-4 pr-1 ${vw < 500 ? 'pb-24' : ''}`}>
                  <RightSidebar 
                    community={community && communityUserStatus ? {
                      ...community,
                      ...communityUserStatus,
                    } : community} 
                  />
                </div>
              )}
            </section>
            {/* 右サイドバー（デスクトップ） */}
            {(vw > 1000) && (
              <aside className="hidden md:block" style={{ width: asideWidth, maxWidth: 300 }}>
                <RightSidebar 
                  community={community && communityUserStatus ? {
                    ...community,
                    ...communityUserStatus,
                  } : community} 
                />
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
    </div>
  );
}
