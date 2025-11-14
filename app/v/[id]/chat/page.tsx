"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Header from "@/app/components/Header";
import SidebarTabs from "@/app/components/SidebarTabs";
import MobileNav from "@/app/components/MobileNav";
import RulesCard from "@/app/components/RulesCard";
import ChatSection from "@/app/components/ChatSection";
import AtomSpinner from "@/app/components/AtomSpinner";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

type User = {
  id: number;
  username: string;
  icon_url?: string;
  score?: number;
};

type Community = {
  id: number;
  name: string;
  slug: string;
  icon_url?: string;
  description?: string;
  banner_url?: string;
  members_count: number;
  visibility: string;
  join_policy: string;
  is_nsfw: boolean;
  allow_repost?: boolean;
  rules?: string;
  membership_role?: string | null;
  created_at?: string;
};

type Member = {
  id: number;
  username: string;
  icon_url?: string;
  score?: number;
  role?: string | null;
};

type PendingRequest = {
  id: number;
  username: string;
  icon_url?: string;
  role?: string | null;
};

type Report = {
  id: number;
  reporter: {
    id: number;
    username: string;
    icon_url?: string;
  };
  community: Community;
  content_type: 'post' | 'comment';
  content_object_id: number;
  post_id: number | null;
  comment_id: number | null;
  body: string;
  status: 'pending' | 'in_progress' | 'resolved' | 'rejected';
  created_at: string;
  updated_at: string;
};

type GroupChatMessage = {
  id: number;
  sender: User;
  community: Community;
  body: string;
  reply_to?: {
    id: number;
    sender: {
      id: number;
      username: string;
      icon_url?: string;
      role?: string | null;
    };
    body: string;
    created_at: string;
  } | null;
  report?: {
    id: number;
    reporter: {
      id: number;
      username: string;
    };
    content_type: 'post' | 'comment';
    content_object_id: number;
    post_id: number | null;
    comment_id: number | null;
    body: string;
    status: 'pending' | 'in_progress' | 'resolved' | 'rejected';
    created_at: string;
  } | null;
  created_at: string;
  updated_at: string;
};

export default function CommunityChatPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = (Array.isArray(params.id) ? params.id[0] : params.id) || '';
  
  const [messages, setMessages] = useState<GroupChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [replyingTo, setReplyingTo] = useState<GroupChatMessage | null>(null);
  const [reportingFrom, setReportingFrom] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [community, setCommunity] = useState<Community | null>(null);
  const [isModerator, setIsModerator] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [tab, setTab] = useState<string>("trending");
  const [overlayMode, setOverlayMode] = useState<boolean>(false);
  const [vw, setVw] = useState<number>(0);
  const asideWidth = vw >= 1200 ? 300 : (vw > 1000 ? Math.round(200 + (vw - 1000) * 0.5) : undefined);
  const [currentUsername, setCurrentUsername] = useState<string>("");
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [signedIn, setSignedIn] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'reports'>('chat');
  const [reports, setReports] = useState<Report[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportStatusFilter, setReportStatusFilter] = useState<'pending' | 'resolved'>('pending');
  const [reportUserFilter, setReportUserFilter] = useState<boolean>(false);
  const [commentPostIds, setCommentPostIds] = useState<Record<number, number>>({});
  const [postDetails, setPostDetails] = useState<Record<number, {
    id: number;
    title: string;
    body?: string;
    author_username?: string;
    author_icon_url?: string;
    community_slug?: string;
    created_at: string;
  }>>({});
  const [commentDetails, setCommentDetails] = useState<Record<number, {
    id: number;
    body: string;
    author_username?: string;
    author_icon_url?: string;
    post: number;
    created_at: string;
  }>>({});
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [memberMenuMount, setMemberMenuMount] = useState<boolean>(false);
  const [memberMenuVisible, setMemberMenuVisible] = useState<boolean>(false);
  const [memberMenuUp, setMemberMenuUp] = useState<boolean>(false);
  const [mobileTab, setMobileTab] = useState<'chat' | 'reports' | 'details'>('chat');
  
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // オーナーとモデレーターのみをフィルタリング
  const moderators = useMemo(() => {
    return members.filter(m => m.role === 'owner' || m.role === 'admin_moderator' || m.role === 'moderator').sort((a, b) => {
      if (a.role === 'owner' && b.role !== 'owner') return -1;
      if (a.role !== 'owner' && b.role === 'owner') return 1;
      if (a.role === 'admin_moderator' && b.role !== 'admin_moderator') return -1;
      if (a.role !== 'admin_moderator' && b.role === 'admin_moderator') return 1;
      if (a.role === 'moderator' && b.role !== 'moderator') return -1;
      if (a.role !== 'moderator' && b.role === 'moderator') return 1;
      const scoreA = a.score ?? 0;
      const scoreB = b.score ?? 0;
      return scoreB - scoreA;
    });
  }, [members]);

  useEffect(() => {
    // セキュリティ対策: JWTトークンはCookieから自動的に認証されるため、localStorageのチェックは不要
    // setAccessは使用しない（Cookieから自動的に認証される）
    try {
      const savedUsername = localStorage.getItem("accessUsername");
      if (savedUsername) setCurrentUsername(savedUsername);
      const savedUserId = localStorage.getItem("accessUserId");
      if (savedUserId) setCurrentUserId(parseInt(savedUserId));
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

  // スクロールを最下部に
  const scrollToBottom = useCallback(() => {
    // ChatSection内で処理されるため、ここでは何もしない
  }, []);

  async function fetchMembers(communityData?: Community) {
    if (!id) return;
    // セキュリティ対策: JWTトークンはCookieから自動的に送信される
    const res = await fetch(`${API}/api/communities/${id}/members/?limit=12`, { credentials: 'include' });
    if (!res.ok) { setMembers([]); return; }
    const data = await res.json();
    const members = Array.isArray(data) ? data : (data.results || []);
    setMembers(members);
  }

  async function fetchPendingRequests(communityData?: Community) {
    if (!communityData || communityData.membership_role !== 'owner' || communityData.join_policy !== 'approval') return;
    // セキュリティ対策: JWTトークンはCookieから自動的に送信される
    const res = await fetch(`${API}/api/communities/${id}/requests/`, { credentials: 'include' });
    if (!res.ok) { setPendingRequests([]); return; }
    const data = await res.json();
    const requests = Array.isArray(data) ? data : (data.results || []);
    setPendingRequests(requests);
  }

  // コメント詳細を取得（投稿IDも含む）
  const fetchCommentDetail = async (commentId: number, currentCommentDetails: Record<number, any> = {}) => {
    // セキュリティ対策: JWTトークンはCookieから自動的に送信される
    // 既に取得済みの場合はスキップ
    if (currentCommentDetails[commentId]) {
      return currentCommentDetails[commentId];
    }

    try {
      const response = await fetch(`${API}/api/comments/${commentId}/`, {
        credentials: 'include',
      });

      if (!response.ok) {
        return null;
      }

      const commentData = await response.json();
      // postフィールドは数値（投稿ID）として返される可能性がある
      const postId = typeof commentData.post === 'number' 
        ? commentData.post 
        : (commentData.post?.id || commentData.post_id || null);
      
      const commentInfo = {
        id: commentData.id,
        body: commentData.body || '',
        author_username: commentData.author_username || '',
        author_icon_url: commentData.author_icon_url || '',
        post: postId,
        created_at: commentData.created_at || '',
      };

      if (commentInfo.post) {
        setCommentDetails((prev) => ({ ...prev, [commentId]: commentInfo }));
      }
      
      return commentInfo;
    } catch (err) {
      console.error("Error fetching comment:", err);
      return null;
    }
  };

  // 投稿詳細を取得
  const fetchPostDetail = async (postId: number, currentPostDetails: Record<number, any> = {}) => {
    // セキュリティ対策: JWTトークンはCookieから自動的に送信される
    // 既に取得済みの場合はスキップ
    if (currentPostDetails[postId]) {
      return currentPostDetails[postId];
    }

    try {
      const response = await fetch(`${API}/api/posts/${postId}/`, {
        credentials: 'include',
      });

      if (!response.ok) {
        return null;
      }

      const postData = await response.json();
      const postInfo = {
        id: postData.id,
        title: postData.title || '',
        body: postData.body || '',
        author_username: postData.author_username || '',
        author_icon_url: postData.author_icon_url || '',
        community_slug: postData.community_slug || '',
        created_at: postData.created_at || '',
      };
      
      setPostDetails((prev) => ({ ...prev, [postId]: postInfo }));
      return postInfo;
    } catch (err) {
      console.error("Error fetching post:", err);
      return null;
    }
  };

  async function fetchReports(communityId: number, status?: string) {
    // セキュリティ対策: JWTトークンはCookieから自動的に送信される
    setReportsLoading(true);
    try {
      const url = status 
        ? `${API}/api/messages/reports/community/${communityId}/?status=${status}`
        : `${API}/api/messages/reports/community/${communityId}/?status=pending`;
      const response = await fetch(
        url,
        {
          credentials: 'include',
        }
      );

      if (!response.ok) {
        console.error("報告の取得に失敗しました");
        setReports([]);
        return;
      }

      const data = await response.json();
      const reportsList = Array.isArray(data) ? data : (data.results || []);
      setReports(reportsList);

      // 報告のタイプに応じて投稿IDまたはコメントIDを取得
      const commentPromises: Promise<void>[] = [];
      const newCommentPostIds: Record<number, number> = {};
      const postIdsToFetch = new Set<number>();
      const currentCommentDetails = commentDetails;

      reportsList.forEach((report: Report) => {
        if (report.content_type === 'comment') {
          // コメントの報告の場合
          const commentId = report.comment_id || report.content_object_id;
          if (commentId) {
            // コメント詳細を取得（投稿IDも含む）
            if (!currentCommentDetails[commentId]) {
              commentPromises.push(
                fetchCommentDetail(commentId, currentCommentDetails).then((commentInfo) => {
                  if (commentInfo && commentInfo.post) {
                    newCommentPostIds[commentId] = commentInfo.post;
                    postIdsToFetch.add(commentInfo.post);
                  }
                })
              );
            } else {
              // 既に取得済みのコメント情報から投稿IDを取得
              const existingComment = currentCommentDetails[commentId];
              if (existingComment && existingComment.post) {
                newCommentPostIds[commentId] = existingComment.post;
                postIdsToFetch.add(existingComment.post);
              }
            }
          }
        } else if (report.content_type === 'post') {
          // 投稿の報告の場合
          const postId = report.post_id || report.content_object_id;
          if (postId) {
            postIdsToFetch.add(postId);
          }
        }
      });

      // コメント詳細を取得
      if (commentPromises.length > 0) {
        await Promise.all(commentPromises);
        if (Object.keys(newCommentPostIds).length > 0) {
          setCommentPostIds((prev) => ({ ...prev, ...newCommentPostIds }));
        }
      }

      // 投稿詳細を取得（現在の状態を参照）
      const currentPostDetails = postDetails;
      const postDetailPromises = Array.from(postIdsToFetch)
        .filter((postId) => !currentPostDetails[postId])
        .map((postId) => fetchPostDetail(postId, currentPostDetails));
      
      if (postDetailPromises.length > 0) {
        await Promise.all(postDetailPromises);
      }
    } catch (err) {
      console.error("Error fetching reports:", err);
      setReports([]);
    } finally {
      setReportsLoading(false);
    }
  }

  // コミュニティ情報とメッセージを取得
  useEffect(() => {
    const fetchData = async () => {
      try {
        // セキュリティ対策: JWTトークンはCookieから自動的に送信される
        // コミュニティ情報を取得
        const communityRes = await fetch(`${API}/api/communities/${id}/`, {
          credentials: 'include',
        });

        if (!communityRes.ok) {
          if (communityRes.status === 404) {
            setError("アノニウムが見つかりません");
          } else {
            setError("アノニウム情報の取得に失敗しました");
          }
          setLoading(false);
          return;
        }

        const communityData = await communityRes.json();
        setCommunity(communityData);

        // モデレーター権限チェック
        const isMod = communityData.is_admin || 
          (communityData.membership_role && 
           ['owner', 'admin_moderator', 'moderator'].includes(communityData.membership_role));
        setIsModerator(isMod);

        if (!isMod) {
          setError("このアノニウムのモデレーター以上の権限が必要です");
          setLoading(false);
          return;
        }

        // メンバー情報を取得
        fetchMembers(communityData);
        
        // 参加申請を取得（オーナーのみ）
        if (communityData.membership_role === 'owner' && communityData.join_policy === 'approval') {
          fetchPendingRequests(communityData);
        }

        // 報告一覧を取得（デフォルトで未対応のみ）
        fetchReports(communityData.id, 'pending');

        // グループチャットメッセージを取得
        const messagesRes = await fetch(
          `${API}/api/messages/group-chat/community/${communityData.id}/`,
          {
            credentials: 'include',
          }
        );

        if (!messagesRes.ok) {
          if (messagesRes.status === 403) {
            setError("このアノニウムのモデレーター以上の権限が必要です");
          } else {
            setError("メッセージの取得に失敗しました");
          }
          setLoading(false);
          return;
        }

        const messagesData = await messagesRes.json();
        const messagesList = messagesData.results || messagesData;
        setMessages(messagesList);
        
        // メッセージに含まれる報告に関連する投稿/コメントの詳細を取得
        const reportPromises: Promise<void>[] = [];
        const newCommentPostIds: Record<number, number> = {};
        const postIdsToFetch = new Set<number>();
        const currentCommentDetails = commentDetails;

        messagesList.forEach((message: GroupChatMessage) => {
          if (message.report) {
            if (message.report.content_type === 'comment') {
              // コメントの報告の場合
              const commentId = message.report.comment_id || message.report.content_object_id;
              if (commentId) {
                // コメント詳細を取得（投稿IDも含む）
                if (!currentCommentDetails[commentId]) {
                  reportPromises.push(
                    fetchCommentDetail(commentId, currentCommentDetails).then((commentInfo) => {
                      if (commentInfo && commentInfo.post) {
                        newCommentPostIds[commentId] = commentInfo.post;
                        postIdsToFetch.add(commentInfo.post);
                      }
                    })
                  );
                } else {
                  // 既に取得済みのコメント情報から投稿IDを取得
                  const existingComment = currentCommentDetails[commentId];
                  if (existingComment && existingComment.post) {
                    newCommentPostIds[commentId] = existingComment.post;
                    postIdsToFetch.add(existingComment.post);
                  }
                }
              }
            } else if (message.report.content_type === 'post') {
              // 投稿の報告の場合
              const postId = message.report.post_id || message.report.content_object_id;
              if (postId) {
                postIdsToFetch.add(postId);
              }
            }
          }
        });

        // コメント詳細を取得
        if (reportPromises.length > 0) {
          await Promise.all(reportPromises);
          if (Object.keys(newCommentPostIds).length > 0) {
            setCommentPostIds((prev) => ({ ...prev, ...newCommentPostIds }));
          }
        }

        // 投稿詳細を取得（現在の状態を参照）
        const currentPostDetails = postDetails;
        const postDetailPromises = Array.from(postIdsToFetch)
          .filter((postId) => !currentPostDetails[postId])
          .map((postId) => fetchPostDetail(postId, currentPostDetails));
        
        if (postDetailPromises.length > 0) {
          await Promise.all(postDetailPromises);
        }
        
        // 現在のユーザーIDを取得
        if (!currentUserId) {
          // ユーザー情報を取得
          const userRes = await fetch(`${API}/api/accounts/me/`, {
            credentials: 'include',
          });
          if (userRes.ok) {
            const userData = await userRes.json();
            setCurrentUserId(userData.id);
            setSignedIn(true);
            if (userData.username) {
              setCurrentUsername(userData.username);
              try { localStorage.setItem("accessUsername", userData.username); } catch {}
            }
            try { localStorage.setItem("accessUserId", userData.id.toString()); } catch {}
          } else {
            setSignedIn(false);
            setCurrentUserId(null);
          }
        } else {
          setSignedIn(true);
        }
        
        setLoading(false);
        
        // 読み込み完了後、少し遅延してからスクロール（DOMの更新を待つ）
        // ChatSection内で自動的にスクロールされるので、ここでは何もしない
      } catch (err) {
        console.error("Error fetching data:", err);
        setError("データの取得に失敗しました");
        setLoading(false);
      }
    };

    fetchData();
  }, [id, router]);

  // メッセージのポーリング（WebSocketの代わり）
  useEffect(() => {
    if (!community || !isModerator) return;

    const fetchMessages = async () => {
      // セキュリティ対策: JWTトークンはCookieから自動的に送信される
      try {
        const messagesRes = await fetch(
          `${API}/api/messages/group-chat/community/${community.id}/`,
          {
            credentials: 'include',
          }
        );

        if (messagesRes.ok) {
          const messagesData = await messagesRes.json();
          const messagesList = messagesData.results || messagesData;
          setMessages(messagesList);
          
          // メッセージに含まれる報告に関連する投稿/コメントの詳細を取得
          const reportPromises: Promise<void>[] = [];
          const newCommentPostIds: Record<number, number> = {};
          const postIdsToFetch = new Set<number>();
          const currentCommentDetails = commentDetails;

          messagesList.forEach((message: GroupChatMessage) => {
            if (message.report) {
              if (message.report.content_type === 'comment') {
                // コメントの報告の場合
                const commentId = message.report.comment_id || message.report.content_object_id;
                if (commentId) {
                  // コメント詳細を取得（投稿IDも含む）
                  if (!currentCommentDetails[commentId]) {
                    reportPromises.push(
                      fetchCommentDetail(commentId, currentCommentDetails).then((commentInfo) => {
                        if (commentInfo && commentInfo.post) {
                          newCommentPostIds[commentId] = commentInfo.post;
                          postIdsToFetch.add(commentInfo.post);
                        }
                      })
                    );
                  } else {
                    // 既に取得済みのコメント情報から投稿IDを取得
                    const existingComment = currentCommentDetails[commentId];
                    if (existingComment && existingComment.post) {
                      newCommentPostIds[commentId] = existingComment.post;
                      postIdsToFetch.add(existingComment.post);
                    }
                  }
                }
              } else if (message.report.content_type === 'post') {
                // 投稿の報告の場合
                const postId = message.report.post_id || message.report.content_object_id;
                if (postId) {
                  postIdsToFetch.add(postId);
                }
              }
            }
          });

          // コメント詳細を取得
          if (reportPromises.length > 0) {
            await Promise.all(reportPromises);
            if (Object.keys(newCommentPostIds).length > 0) {
              setCommentPostIds((prev) => ({ ...prev, ...newCommentPostIds }));
            }
          }

          // 投稿詳細を取得（現在の状態を参照）
          const currentPostDetails = postDetails;
          const postDetailPromises = Array.from(postIdsToFetch)
            .filter((postId) => !currentPostDetails[postId])
            .map((postId) => fetchPostDetail(postId, currentPostDetails));
          
          if (postDetailPromises.length > 0) {
            await Promise.all(postDetailPromises);
          }
        }
      } catch (err) {
        console.error("Error fetching messages:", err);
      }
    };

    // 初回取得
    fetchMessages();

    // 5秒ごとにポーリング
    pollingIntervalRef.current = setInterval(fetchMessages, 5000);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [community, isModerator]);

  // メニューの外側をクリックしたときに閉じる
  useEffect(() => {
    if (!memberMenuMount) return;
    function onDocClick() {
      setMemberMenuVisible(false);
      setTimeout(() => { setMemberMenuMount(false); setOpenMenuId(null); }, 150);
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [memberMenuMount]);

  // メッセージ送信
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !community) {
      return;
    }

    // セキュリティ対策: JWTトークンはCookieから自動的に送信される
    try {
      const response = await fetch(
        `${API}/api/messages/group-chat/community/${community.id}/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: 'include',
          body: JSON.stringify({
            community_id: community.id,
            body: newMessage.trim(),
            reply_to_id: replyingTo?.id || null,
            report_id: reportingFrom?.id || null,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "メッセージの送信に失敗しました");
      }

      // 送信成功後、メッセージを再取得
      const messagesRes = await fetch(
        `${API}/api/messages/group-chat/community/${community.id}/`,
        {
          credentials: 'include',
        }
      );

      if (messagesRes.ok) {
        const messagesData = await messagesRes.json();
        setMessages(messagesData.results || messagesData);
        setTimeout(scrollToBottom, 100);
      }

      setNewMessage("");
      setReplyingTo(null);
      setReportingFrom(null);
    } catch (err: any) {
      console.error("Error sending message:", err);
      alert(err.message || "メッセージの送信に失敗しました");
    }
  };

  // 引用リプライを開始
  const handleReplyToMessage = (message: GroupChatMessage) => {
    setReplyingTo(message);
  };

  // 引用リプライをキャンセル
  const handleCancelReply = () => {
    setReplyingTo(null);
  };

  // 報告を引用してチャットに追加
  const handleQuoteReport = (report: Report) => {
    setReportingFrom(report);
    setReplyingTo(null); // メッセージへの返信をキャンセル
    setActiveTab('chat'); // チャットタブに切り替え（デスクトップ）
    setMobileTab('chat'); // チャットタブに切り替え（スマホ）
  };

  // 報告のステータスを更新
  const handleUpdateReportStatus = async (reportId: number, newStatus: string) => {
    if (!community) return;

    // セキュリティ対策: JWTトークンはCookieから自動的に送信される
    try {
      const response = await fetch(
        `${API}/api/messages/reports/community/${community.id}/${reportId}/`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: 'include',
          body: JSON.stringify({ status: newStatus }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "報告の更新に失敗しました");
      }

      // 報告一覧を再取得（現在のフィルタを維持）
      await fetchReports(community.id, reportStatusFilter);
    } catch (err: any) {
      console.error("Error updating report:", err);
      alert(err.message || "報告の更新に失敗しました");
    }
  };

  // メッセージ削除
  const handleDeleteMessage = async (messageId: number) => {
    if (!community || !window.confirm("このメッセージを削除しますか？")) {
      return;
    }

    // セキュリティ対策: JWTトークンはCookieから自動的に送信される
    try {
      const response = await fetch(
        `${API}/api/messages/group-chat/community/${community.id}/${messageId}/`,
        {
          method: "DELETE",
          credentials: 'include',
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "メッセージの削除に失敗しました");
      }

      // 削除成功後、メッセージを再取得
      const messagesRes = await fetch(
        `${API}/api/messages/group-chat/community/${community.id}/`,
        {
          credentials: 'include',
        }
      );

      if (messagesRes.ok) {
        const messagesData = await messagesRes.json();
        setMessages(messagesData.results || messagesData);
      }
    } catch (err: any) {
      console.error("Error deleting message:", err);
      alert(err.message || "メッセージの削除に失敗しました");
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "たった今";
    if (minutes < 60) return `${minutes}分前`;
    if (hours < 24) return `${hours}時間前`;
    if (days < 7) return `${days}日前`;
    
    return date.toLocaleDateString("ja-JP", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
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
            localStorage.removeItem("accessUserId");
            setSignedIn(false);
            setCurrentUserId(null);
            setCurrentUsername("");
            router.push("/");
          }}
        />
        <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
          <div className="text-center">
            <AtomSpinner size={48} className="mx-auto mb-4" />
            <p>読み込み中...</p>
          </div>
        </div>
        <MobileNav current={tab} onChange={(v) => { setTab(v); localStorage.setItem('homeTab', v); }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
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
            localStorage.removeItem("accessUserId");
            setSignedIn(false);
            setCurrentUserId(null);
            setCurrentUsername("");
            router.push("/");
          }}
        />
        <div className="container mx-auto px-4 py-8">
          <div className="bg-[var(--surface-2)] rounded-lg p-6 text-center">
            <p className="text-red-400 mb-4">{error}</p>
            <Link
              href={`/v/${id}`}
              className="text-[var(--accent)] hover:underline"
            >
              アノニウムページに戻る
            </Link>
          </div>
        </div>
        <MobileNav current={tab} onChange={(v) => { setTab(v); localStorage.setItem('homeTab', v); }} />
      </div>
    );
  }

  // メンバー管理関数
  async function adminAction(endpoint: string, onOk: () => void) {
    // セキュリティ対策: JWTトークンはCookieから自動的に送信される
    // 認証状態はAPIレスポンスで確認（401または403が返される場合）
    if (!(community?.membership_role === 'owner' || community?.membership_role === 'admin_moderator')) {
      alert('権限がありません。');
      return;
    }
    try {
      const res = await fetch(endpoint, { method: 'POST', credentials: 'include' });
      const txt = await res.text();
      if (!res.ok) {
        if (res.status === 401) {
          alert('ログインが必要です。');
        } else if (res.status === 403) {
          alert('権限がありません。');
        } else {
          alert(txt || `エラー ${res.status}`);
        }
        return;
      }
      onOk();
    } catch {
      alert('操作に失敗しました。');
    }
  }

  function removeMember(userId: number, displayName: string) {
    if (!window.confirm(`${displayName} を除名しますか？`)) return;
    adminAction(`${API}/api/communities/${id}/members/${userId}/remove/`, () => {
      setMembers(ms => ms.filter(m => m.id !== userId));
      setCommunity(v => v && v.members_count > 0 ? { ...v, members_count: v.members_count - 1 } : v);
      alert('除名しました。');
    });
  }

  function blockMember(userId: number, displayName: string) {
    if (!window.confirm(`${displayName} をブロックし、参加からも外しますか？`)) return;
    adminAction(`${API}/api/communities/${id}/members/${userId}/block/`, () => {
      setMembers(ms => ms.filter(m => m.id !== userId));
      setCommunity(v => v && v.members_count > 0 ? { ...v, members_count: v.members_count - 1 } : v);
      alert('ブロックしました。');
    });
  }

  function promoteModerator(userId: number) {
    adminAction(`${API}/api/communities/${id}/members/${userId}/promote/`, () => {
      setMembers(ms => ms.map(m => m.id === userId ? { ...m, role: 'moderator' } : m));
      alert('モデレーターに任命しました。');
    });
  }

  function promoteAdminModerator(userId: number) {
    if (community?.membership_role !== 'owner') { alert('オーナー権限が必要です。'); return; }
    adminAction(`${API}/api/communities/${id}/members/${userId}/promote_admin/`, () => {
      setMembers(ms => ms.map(m => m.id === userId ? { ...m, role: 'admin_moderator' } : m));
      alert('管理モデレーターに任命しました。');
    });
  }

  // 右サイドバーのコンポーネント
  function ModeratorListCard() {
    if (moderators.length === 0) return null;
    return (
      <div className="rounded-lg border border-subtle p-4 surface-1">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-medium">モデレーター</h2>
          <Link 
            href={`/v/${id}/moderators`}
            className="text-xs text-subtle hover:text-foreground flex items-center gap-1"
          >
            <span>すべて表示</span>
            <span className="material-symbols-rounded text-xs" aria-hidden>chevron_right</span>
          </Link>
        </div>
        <ul className="space-y-3">
          {moderators.map(m => (
            <li key={m.id} className="flex items-center gap-2 min-w-0 relative">
              {m.icon_url ? (
                <img src={m.icon_url} alt={m.username} className="w-8 h-8 rounded-full border border-subtle object-cover flex-shrink-0" />
              ) : (
                <div className="w-8 h-8 rounded-full border border-subtle surface-1 flex-shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm truncate" title={m.username}>{m.username}</span>
                  {m.role === 'owner' && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-rose-500/30 bg-rose-500/20 text-rose-300">オーナー</span>
                  )}
                  {m.role === 'admin_moderator' && (
                    <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/20 text-amber-300" title="管理モデレーター">
                      <span className="material-symbols-rounded" style={{ fontSize: 12 }} aria-hidden>build</span>
                      <span className="ml-0.5">管理モデ</span>
                    </span>
                  )}
                  {m.role === 'moderator' && (
                    <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full border border-sky-500/30 bg-sky-500/20 text-sky-300" title="モデレーター">
                      <span className="material-symbols-rounded" style={{ fontSize: 12 }} aria-hidden>shield_person</span>
                      <span className="ml-0.5">モデ</span>
                    </span>
                  )}
                </div>
              </div>
              {(community?.membership_role === 'owner' || community?.membership_role === 'admin_moderator') && (m.role === 'moderator' || (m.role === 'admin_moderator' && community?.membership_role === 'owner')) && m.id !== currentUserId && (
                <div className="ml-auto relative inline-block">
                  <button
                    type="button"
                    className="w-8 h-8 inline-flex items-center justify-center rounded-md border border-subtle surface-1 hover:bg-white/5"
                    title="詳細"
                    onClick={(e) => { e.stopPropagation(); e.preventDefault();
                      if (openMenuId === m.id && memberMenuMount) {
                        setMemberMenuVisible(false);
                        setTimeout(() => { setMemberMenuMount(false); setOpenMenuId(null); }, 150);
                      } else {
                        try {
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                          const spaceBelow = (typeof window !== 'undefined' ? window.innerHeight : 0) - rect.bottom;
                          setMemberMenuUp(spaceBelow < 220);
                        } catch {}
                        setOpenMenuId(m.id);
                        setMemberMenuMount(true);
                        requestAnimationFrame(() => setMemberMenuVisible(true));
                      }
                    }}
                  >
                    <span className="material-symbols-rounded text-base" aria-hidden>more_horiz</span>
                  </button>
                  {memberMenuMount && openMenuId === m.id && (
                    <div className={`absolute right-0 ${memberMenuUp ? 'bottom-full mb-1 origin-bottom-right' : 'top-full mt-1 origin-top-right'} min-w-40 rounded-md border border-subtle surface-1 shadow-lg z-30 transition-all duration-150 ease-out ${memberMenuVisible ? 'opacity-100 -translate-y-0 scale-100' : 'opacity-0 -translate-y-1 scale-95 pointer-events-none'}`}>
                      {m.role === 'admin_moderator' ? (
                        community?.membership_role === 'owner' ? (
                          <button className="w-full text-left px-3 py-2 text-sm hover:bg-white/10 flex items-center gap-2" onClick={(e) => { e.stopPropagation(); e.preventDefault(); setMemberMenuVisible(false); setTimeout(() => { setMemberMenuMount(false); setOpenMenuId(null); }, 150);
                            // セキュリティ対策: JWTトークンはCookieから自動的に送信される
                            fetch(`${API}/api/communities/${id}/members/${m.id}/demote_admin/`, { method: 'POST', credentials: 'include' }).then(() => fetchMembers(community || undefined));
                          }}>
                            <span className="material-symbols-rounded" aria-hidden>shield_lock</span>
                            <span>管理モデ解除</span>
                          </button>
                        ) : null
                      ) : (
                        <button className="w-full text-left px-3 py-2 text-sm hover:bg-white/10 flex items-center gap-2" onClick={(e) => { e.stopPropagation(); e.preventDefault(); setMemberMenuVisible(false); setTimeout(() => { setMemberMenuMount(false); setOpenMenuId(null); }, 150);
                          // セキュリティ対策: JWTトークンはCookieから自動的に送信される
                          fetch(`${API}/api/communities/${id}/members/${m.id}/demote/`, { method: 'POST', credentials: 'include' }).then(() => fetchMembers(community || undefined));
                        }}>
                          <span className="material-symbols-rounded" aria-hidden>shield</span>
                          <span>モデレーター解除</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  function MembersListCard() {
    return (
      <div className="rounded-lg border border-subtle p-4 surface-1">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-medium">メンバー</h2>
          <button className="text-xs px-2 py-1 rounded-md border border-subtle surface-1 hover:bg-white/5" onClick={() => fetchMembers(community || undefined)}>更新</button>
        </div>
        {members.length === 0 ? (
          <div className="text-sm text-subtle">まだメンバーがいません。</div>
        ) : (
          <ul className="space-y-3">
            {members.slice(0, 5).map(m => (
              <li key={m.id} className="flex items-center gap-2 min-w-0 relative">
                {m.icon_url ? (
                  <img src={m.icon_url} alt={m.username} className="w-8 h-8 rounded-full border border-subtle object-cover flex-shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded-full border border-subtle surface-1 flex-shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm truncate" title={m.username}>{m.username}</span>
                    {m.role === 'owner' && (
                      <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full border border-rose-500/30 bg-rose-500/20 text-rose-300">オーナー</span>
                    )}
                    {m.role === 'admin_moderator' && (
                      <span className="ml-2 inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/20 text-amber-300" title="管理モデレーター">
                        <span className="material-symbols-rounded" style={{ fontSize: 12 }} aria-hidden>build</span>
                        <span className="ml-0.5">管理モデ</span>
                      </span>
                    )}
                    {m.role === 'moderator' && (
                      <span className="ml-2 inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full border border-sky-500/30 bg-sky-500/20 text-sky-300" title="モデレーター">
                        <span className="material-symbols-rounded" style={{ fontSize: 12 }} aria-hidden>shield_person</span>
                        <span className="ml-0.5">モデ</span>
                      </span>
                    )}
                  </div>
                </div>
                {(community?.membership_role === 'owner' || community?.membership_role === 'admin_moderator') && m.role !== 'owner' && m.id !== currentUserId && (
                <div className="ml-auto relative inline-block">
                  <button
                    type="button"
                    className="w-8 h-8 inline-flex items-center justify-center rounded-md border border-subtle surface-1 hover:bg-white/5"
                    title="詳細"
                    onClick={(e) => { e.stopPropagation(); e.preventDefault();
                      if (openMenuId === m.id && memberMenuMount) {
                        setMemberMenuVisible(false);
                        setTimeout(() => { setMemberMenuMount(false); setOpenMenuId(null); }, 150);
                      } else {
                        try {
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                          const spaceBelow = (typeof window !== 'undefined' ? window.innerHeight : 0) - rect.bottom;
                          setMemberMenuUp(spaceBelow < 220);
                        } catch {}
                        setOpenMenuId(m.id);
                        setMemberMenuMount(true);
                        requestAnimationFrame(() => setMemberMenuVisible(true));
                      }
                    }}
                  >
                    <span className="material-symbols-rounded text-base" aria-hidden>more_horiz</span>
                  </button>
                  {memberMenuMount && openMenuId === m.id && (
                    <div className={`absolute right-0 ${memberMenuUp ? 'bottom-full mb-1 origin-bottom-right' : 'top-full mt-1 origin-top-right'} min-w-44 rounded-md border border-subtle surface-1 shadow-lg z-30 transition-all duration-150 ease-out ${memberMenuVisible ? 'opacity-100 -translate-y-0 scale-100' : 'opacity-0 -translate-y-1 scale-95 pointer-events-none'}`}>
                      <button className="w-full text-left px-3 py-2 text-sm hover:bg-white/10 flex items-center gap-2" onClick={(e) => { e.stopPropagation(); e.preventDefault(); setMemberMenuVisible(false); setTimeout(() => { setMemberMenuMount(false); setOpenMenuId(null); }, 150);
                        promoteModerator(m.id);
                      }}>
                        <span className="material-symbols-rounded" aria-hidden>shield_person</span>
                        <span>モデレーター任命</span>
                      </button>
                      {(community?.membership_role === 'owner') && (
                        <button className="w-full text-left px-3 py-2 text-sm hover:bg-white/10 flex items-center gap-2" onClick={(e) => { e.stopPropagation(); e.preventDefault(); setMemberMenuVisible(false); setTimeout(() => { setMemberMenuMount(false); setOpenMenuId(null); }, 150);
                          promoteAdminModerator(m.id);
                        }}>
                          <span className="material-symbols-rounded" aria-hidden>build</span>
                          <span>管理モデ任命</span>
                        </button>
                      )}
                      <button className="w-full text-left px-3 py-2 text-sm hover:bg-white/10 flex items-center gap-2" onClick={(e) => { e.stopPropagation(); e.preventDefault(); setMemberMenuVisible(false); setTimeout(() => { setMemberMenuMount(false); setOpenMenuId(null); }, 150);
                        removeMember(m.id, m.username);
                      }}>
                        <span className="material-symbols-rounded" aria-hidden>person_remove</span>
                        <span>除名</span>
                      </button>
                      <button className="w-full text-left px-3 py-2 text-sm hover:bg-white/10 flex items-center gap-2" onClick={(e) => { e.stopPropagation(); e.preventDefault(); setMemberMenuVisible(false); setTimeout(() => { setMemberMenuMount(false); setOpenMenuId(null); }, 150);
                        blockMember(m.id, m.username);
                      }}>
                        <span className="material-symbols-rounded" aria-hidden>block</span>
                        <span>ブロック</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

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
          localStorage.removeItem("accessUserId");
          setSignedIn(false);
          setCurrentUserId(null);
          setCurrentUsername("");
          router.push("/");
        }}
      />

      <main className="max-w-none mx-auto px-2 sm:px-2 md:px-3 py-6">
        <div className="mx-auto" style={{ maxWidth: vw >= 1200 ? 1200 : '100%' }}>
          <div className="flex items-start gap-4 md:gap-6 min-w-0">
            <SidebarTabs
              open={sidebarOpen}
              current={tab}
              onChange={(v) => { setTab(v); localStorage.setItem('homeTab', v); }}
              setOpen={setSidebarOpen}
            />

            <section className="flex-1 min-w-0" style={{ maxWidth: vw >= 1200 ? 800 : 700 }}>
              <div className={`pr-1 ${vw < 500 ? 'pb-16' : ''}`}>
                {/* ヘッダー */}
                <div className="mb-3 flex items-center gap-2">
                  <Link
                    href="/messages"
                    className="text-white/70 hover:text-white text-sm flex items-center gap-1"
                  >
                    <span className="material-symbols-rounded text-base" aria-hidden>arrow_back</span>
                    <span>戻る</span>
                  </Link>
                  <div className="flex items-center gap-2">
                    {community?.icon_url ? (
                      <img
                        src={community.icon_url}
                        alt={community.name}
                        className="w-6 h-6 rounded-full border border-subtle object-cover"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full border border-subtle surface-1 flex items-center justify-center">
                        <span className="text-xs">
                          {id[0]?.toUpperCase() || 'C'}
                        </span>
                      </div>
                    )}
                    <Link href={`/v/${id}`} className="hover:underline">
                      <h1 className="text-lg font-semibold">
                        {community?.name || id}
                      </h1>
                    </Link>
                  </div>
                </div>

                {/* タブ */}
                {vw > 1000 ? (
                  <div className="mb-3 flex gap-2 border-b border-subtle">
                    <button
                      onClick={() => setActiveTab('chat')}
                      className={`px-4 py-2 text-sm font-medium transition-colors ${
                        activeTab === 'chat'
                          ? 'text-white border-b-2 border-white'
                          : 'text-subtle hover:text-foreground'
                      }`}
                    >
                      チャット
                    </button>
                    <button
                      onClick={() => setActiveTab('reports')}
                      className={`px-4 py-2 text-sm font-medium transition-colors ${
                        activeTab === 'reports'
                          ? 'text-white border-b-2 border-white'
                          : 'text-subtle hover:text-foreground'
                      }`}
                    >
                      報告
                    </button>
                  </div>
                ) : (
                  <div className="mb-3 rounded-lg border border-subtle p-1 surface-1 flex items-center gap-1">
                    <button
                      onClick={() => setMobileTab('chat')}
                      className={`flex-1 px-3 py-1.5 rounded-md text-sm ${
                        mobileTab === 'chat' ? 'bg-white text-black' : 'hover:bg-white/10 text-gray-300'
                      }`}
                    >
                      チャット
                    </button>
                    <button
                      onClick={() => setMobileTab('reports')}
                      className={`flex-1 px-3 py-1.5 rounded-md text-sm ${
                        mobileTab === 'reports' ? 'bg-white text-black' : 'hover:bg-white/10 text-gray-300'
                      }`}
                    >
                      報告
                    </button>
                    <button
                      onClick={() => setMobileTab('details')}
                      className={`flex-1 px-3 py-1.5 rounded-md text-sm ${
                        mobileTab === 'details' ? 'bg-white text-black' : 'hover:bg-white/10 text-gray-300'
                      }`}
                    >
                      詳細
                    </button>
                  </div>
                )}

                {/* チャットタブの内容 */}
                {(vw > 1000 ? activeTab === 'chat' : mobileTab === 'chat') && (
                  <ChatSection
                    messages={messages}
                    newMessage={newMessage}
                    setNewMessage={setNewMessage}
                    replyingTo={replyingTo}
                    setReplyingTo={setReplyingTo}
                    reportingFrom={reportingFrom}
                    setReportingFrom={setReportingFrom}
                    currentUserId={currentUserId}
                    handleSendMessage={handleSendMessage}
                    handleReplyToMessage={handleReplyToMessage}
                    handleCancelReply={handleCancelReply}
                    handleDeleteMessage={handleDeleteMessage}
                    scrollToBottom={scrollToBottom}
                    showScrollToBottom={showScrollToBottom}
                    postDetails={postDetails}
                    commentDetails={commentDetails}
                    commentPostIds={commentPostIds}
                  />
                )}

                {/* 報告タブの内容 */}
                {(vw > 1000 ? activeTab === 'reports' : mobileTab === 'reports') && (
                  <div className="bg-[var(--surface-2)] rounded-lg flex flex-col relative" style={{ height: 'calc(100vh - 250px)' }}>
                    {/* フィルタタブ */}
                    <div className="border-b border-subtle p-3">
                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={() => {
                            setReportStatusFilter('pending');
                            if (community) {
                              fetchReports(community.id, 'pending');
                            }
                          }}
                          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                            reportStatusFilter === 'pending'
                              ? 'bg-[var(--accent)] text-white'
                              : 'bg-[var(--surface-1)] text-gray-300 hover:bg-[var(--surface-1)]/80'
                          }`}
                        >
                          未対応
                        </button>
                        <button
                          onClick={() => {
                            setReportStatusFilter('resolved');
                            if (community) {
                              fetchReports(community.id, 'resolved');
                            }
                          }}
                          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                            reportStatusFilter === 'resolved'
                              ? 'bg-[var(--accent)] text-white'
                              : 'bg-[var(--surface-1)] text-gray-300 hover:bg-[var(--surface-1)]/80'
                          }`}
                        >
                          対応済み
                        </button>
                        {(() => {
                          // セキュリティ対策: JWTトークンはCookieから自動的に認証されるため、localStorageのチェックは不要
                          // ログイン状態は/api/accounts/me/を呼び出して確認
                          const isLoggedIn = true; // バックエンドで認証状態を確認
                          
                          if (!isLoggedIn) return null;
                          
                          return (
                            <button
                              onClick={() => {
                                setReportUserFilter(!reportUserFilter);
                              }}
                              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                                reportUserFilter
                                  ? 'bg-white text-black'
                                  : 'bg-[var(--surface-1)] text-gray-300 hover:bg-[var(--surface-1)]/80 border border-white/20'
                              }`}
                            >
                              ログインの報告のみ
                            </button>
                          );
                        })()}
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 chat-scrollbar" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255, 255, 255, 0.1) transparent' }}>
                      {reportsLoading ? (
                        <div className="text-center text-gray-400 py-8">
                          <AtomSpinner size={32} className="mx-auto mb-4" />
                          <p>読み込み中...</p>
                        </div>
                      ) : (() => {
                        // セキュリティ対策: JWTトークンはCookieから自動的に認証されるため、localStorageのチェックは不要
                        // ログイン状態はcurrentUserIdで判断
                        const isLoggedIn = !!currentUserId;
                        const filteredReports = reportUserFilter && isLoggedIn && currentUserId
                          ? reports.filter((report) => report.reporter.id === currentUserId)
                          : reports;

                        if (filteredReports.length === 0) {
                          return (
                            <div className="text-center text-gray-400 py-8">
                              {reportUserFilter && isLoggedIn && currentUserId
                                ? 'ログインの報告はありません'
                                : reportStatusFilter === 'pending'
                                ? '未対応の報告はありません'
                                : '対応済みの報告はありません'}
                            </div>
                          );
                        }

                        return (
                          <div className="space-y-3">
                            {filteredReports.map((report) => (
                            <div
                              key={report.id}
                              className="bg-[var(--surface-1)] rounded-lg p-4 border border-subtle hover:border-[var(--accent)]/30 transition-colors"
                            >
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  {report.reporter.icon_url ? (
                                    <img
                                      src={report.reporter.icon_url}
                                      alt={report.reporter.username}
                                      className="w-8 h-8 rounded-full border border-subtle object-cover"
                                    />
                                  ) : (
                                    <div className="w-8 h-8 rounded-full border border-subtle bg-[var(--surface-2)] flex items-center justify-center">
                                      <span className="text-xs">
                                        {report.reporter.username[0].toUpperCase()}
                                      </span>
                                    </div>
                                  )}
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-sm">{report.reporter.username}</span>
                                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                                        report.status === 'pending' ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' :
                                        report.status === 'in_progress' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' :
                                        report.status === 'resolved' ? 'bg-green-500/20 text-green-300 border border-green-500/30' :
                                        'bg-gray-500/20 text-gray-300 border border-gray-500/30'
                                      }`}>
                                        {report.status === 'pending' ? '未対応' :
                                         report.status === 'in_progress' ? '対応中' :
                                         report.status === 'resolved' ? '対応済み' : '却下'}
                                      </span>
                                    </div>
                                    <span className="text-xs text-gray-400">{formatTime(report.created_at)}</span>
                                  </div>
                                </div>
                              </div>

                              <div className="text-sm text-gray-300 whitespace-pre-wrap break-words bg-[var(--surface-2)] rounded p-3 mt-2">
                                {report.body}
                              </div>

                              {/* 投稿の簡易表示カード */}
                              {(() => {
                                if (report.content_type === 'comment') {
                                  // コメントの報告の場合
                                  const commentId = report.comment_id || report.content_object_id;
                                  const commentDetail = commentId ? commentDetails[commentId] : null;
                                  const postId = commentDetail?.post || (commentId ? commentPostIds[commentId] : null);
                                  const postDetail = postId ? postDetails[postId] : null;

                                  if (postDetail) {
                                    const cardHref = `/p/${postId}${commentId ? `#comment-${commentId}` : ''}`;
                                    return (
                                      <Link
                                        href={cardHref}
                                        className="mt-3 p-3 bg-[var(--surface-2)] rounded-lg border border-subtle hover:border-[var(--accent)]/50 transition-colors block"
                                      >
                                        <div className="flex items-start gap-2 mb-2">
                                          {postDetail.author_icon_url ? (
                                            <img
                                              src={postDetail.author_icon_url}
                                              alt={postDetail.author_username}
                                              className="w-6 h-6 rounded-full border border-subtle object-cover flex-shrink-0"
                                            />
                                          ) : (
                                            <div className="w-6 h-6 rounded-full border border-subtle bg-[var(--surface-1)] flex items-center justify-center flex-shrink-0">
                                              <span className="text-xs">
                                                {postDetail.author_username?.[0]?.toUpperCase() || 'U'}
                                              </span>
                                            </div>
                                          )}
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                              <span className="text-xs font-medium text-gray-300">
                                                {postDetail.author_username || '不明なユーザー'}
                                              </span>
                                              {postDetail.community_slug && (
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    e.preventDefault();
                                                    router.push(`/v/${postDetail.community_slug}`);
                                                  }}
                                                  className="text-xs text-[var(--accent)] hover:underline"
                                                >
                                                  {postDetail.community_slug}
                                                </button>
                                              )}
                                              <span className="text-xs text-gray-500">
                                                {formatTime(postDetail.created_at)}
                                              </span>
                                            </div>
                                            <div>
                                              <h3 className="text-sm font-semibold text-gray-200 mb-1 hover:text-[var(--accent)] transition-colors line-clamp-2">
                                                {postDetail.title}
                                              </h3>
                                              {postDetail.body && (
                                                <p className="text-xs text-gray-400 line-clamp-2">
                                                  {postDetail.body.replace(/\n/g, ' ')}
                                                </p>
                                              )}
                                            </div>
                                            {/* コメントの内容を表示 */}
                                            {commentDetail && (
                                              <div className="mt-2 pt-2 border-t border-subtle">
                                                <div className="flex items-center gap-2 mb-1">
                                                  {commentDetail.author_icon_url ? (
                                                    <img
                                                      src={commentDetail.author_icon_url}
                                                      alt={commentDetail.author_username}
                                                      className="w-5 h-5 rounded-full border border-subtle object-cover flex-shrink-0"
                                                    />
                                                  ) : (
                                                    <div className="w-5 h-5 rounded-full border border-subtle bg-[var(--surface-1)] flex items-center justify-center flex-shrink-0">
                                                      <span className="text-[10px]">
                                                        {commentDetail.author_username?.[0]?.toUpperCase() || 'U'}
                                                      </span>
                                                    </div>
                                                  )}
                                                  <span className="text-xs text-gray-400">
                                                    {commentDetail.author_username || '不明なユーザー'}のコメント
                                                  </span>
                                                </div>
                                                <p className="text-xs text-gray-400 line-clamp-2 ml-7">
                                                  {commentDetail.body.replace(/\n/g, ' ')}
                                                </p>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </Link>
                                    );
                                  }
                                } else if (report.content_type === 'post') {
                                  // 投稿の報告の場合
                                  const postId = report.post_id || report.content_object_id;
                                  const postDetail = postId ? postDetails[postId] : null;

                                  if (postDetail) {
                                    const cardHref = `/p/${postId}`;
                                    return (
                                      <Link
                                        href={cardHref}
                                        className="mt-3 p-3 bg-[var(--surface-2)] rounded-lg border border-subtle hover:border-[var(--accent)]/50 transition-colors block"
                                      >
                                        <div className="flex items-start gap-2 mb-2">
                                          {postDetail.author_icon_url ? (
                                            <img
                                              src={postDetail.author_icon_url}
                                              alt={postDetail.author_username}
                                              className="w-6 h-6 rounded-full border border-subtle object-cover flex-shrink-0"
                                            />
                                          ) : (
                                            <div className="w-6 h-6 rounded-full border border-subtle bg-[var(--surface-1)] flex items-center justify-center flex-shrink-0">
                                              <span className="text-xs">
                                                {postDetail.author_username?.[0]?.toUpperCase() || 'U'}
                                              </span>
                                            </div>
                                          )}
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                              <span className="text-xs font-medium text-gray-300">
                                                {postDetail.author_username || '不明なユーザー'}
                                              </span>
                                              {postDetail.community_slug && (
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    e.preventDefault();
                                                    router.push(`/v/${postDetail.community_slug}`);
                                                  }}
                                                  className="text-xs text-[var(--accent)] hover:underline"
                                                >
                                                  {postDetail.community_slug}
                                                </button>
                                              )}
                                              <span className="text-xs text-gray-500">
                                                {formatTime(postDetail.created_at)}
                                              </span>
                                            </div>
                                            <div>
                                              <h3 className="text-sm font-semibold text-gray-200 mb-1 hover:text-[var(--accent)] transition-colors line-clamp-2">
                                                {postDetail.title}
                                              </h3>
                                              {postDetail.body && (
                                                <p className="text-xs text-gray-400 line-clamp-2">
                                                  {postDetail.body.replace(/\n/g, ' ')}
                                                </p>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      </Link>
                                    );
                                  }
                                }
                                return null;
                              })()}
                              
                              {/* チャットに引用ボタン */}
                              <div className="mt-3 flex items-center gap-2 flex-wrap">
                                <button
                                  onClick={() => handleQuoteReport(report)}
                                  className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-md bg-orange-500/20 border border-orange-500/30 text-orange-300 hover:bg-orange-500/30 transition-colors"
                                  title="この報告をチャットで議論"
                                >
                                  <span className="material-symbols-rounded text-sm" aria-hidden>chat_bubble</span>
                                  <span>引用</span>
                                </button>
                                {reportStatusFilter === 'pending' && report.status !== 'resolved' && (
                                  <button
                                    onClick={() => {
                                      if (window.confirm("この報告を対応済みにしますか？")) {
                                        handleUpdateReportStatus(report.id, 'resolved');
                                      }
                                    }}
                                    className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-md bg-green-500/20 border border-green-500/30 text-green-300 hover:bg-green-500/30 transition-colors"
                                    title="対応済み"
                                  >
                                    <span className="material-symbols-rounded text-sm" aria-hidden>check_circle</span>
                                    <span>対応済み</span>
                                  </button>
                                )}
                              </div>
                            </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {/* 詳細タブの内容（スマホのみ） */}
                {vw <= 1000 && mobileTab === 'details' && (
                  <div className="space-y-4">
                    <div className="rounded-lg border border-subtle p-4 surface-1">
                      <h2 className="font-medium mb-3">ステータス</h2>
                      <ul className="text-sm space-y-2">
                        <li className="flex items-center gap-2">
                          <span className="material-symbols-rounded icon-faint" aria-hidden>public</span>
                          <span>
                            <span className="text-subtle">表示ポリシー: </span>
                            {community?.visibility === 'public' ? '公開' : '非公開'}
                          </span>
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="material-symbols-rounded icon-faint" aria-hidden>{community?.join_policy === 'open' ? 'group_add' : (community?.join_policy === 'approval' ? 'approval' : 'login')}</span>
                          <span>
                            <span className="text-subtle">参加ポリシー: </span>
                            {community?.join_policy === 'open' ? '誰でも参加可' : community?.join_policy === 'approval' ? '承認制' : 'ログイン必須'}
                          </span>
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="material-symbols-rounded icon-faint" aria-hidden>warning</span>
                          <span>
                            <span className="text-subtle">年齢制限: </span>
                            {community?.is_nsfw ? 'あり' : 'なし'}
                          </span>
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="material-symbols-rounded icon-faint" aria-hidden>share</span>
                          <span>
                            <span className="text-subtle">転載: </span>
                            {community?.allow_repost ? '許可' : '不可'}
                          </span>
                        </li>
                        {community?.created_at && (
                          <li className="flex items-center gap-2">
                            <span className="material-symbols-rounded icon-faint" aria-hidden>calendar_today</span>
                            <span>
                              <span className="text-subtle">作成日: </span>
                              {new Date(community.created_at).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
                            </span>
                          </li>
                        )}
                      </ul>
                      {community?.description && (
                        <div className="mt-3">
                          <div className="text-sm font-medium mb-1">説明</div>
                          <div className="text-sm text-subtle whitespace-pre-wrap">{community.description}</div>
                        </div>
                      )}
                    </div>
                    <RulesCard rules={community?.rules} />
                    <ModeratorListCard />
                    {community?.membership_role === 'owner' && community?.join_policy === 'approval' && (
                      <div className="rounded-lg border border-subtle p-4 surface-1">
                        <div className="flex items-center justify-between mb-3">
                          <h2 className="font-medium">参加申請</h2>
                          <button className="text-xs px-2 py-1 rounded-md border border-subtle surface-1 hover:bg-white/5" onClick={() => fetchPendingRequests(community || undefined)}>更新</button>
                        </div>
                        {pendingRequests.length === 0 ? (
                          <div className="text-sm text-subtle">参加申請はありません。</div>
                        ) : (
                          <ul className="space-y-3">
                            {pendingRequests.map(pr => (
                              <li key={pr.id} className="flex items-center gap-2 min-w-0">
                                {pr.icon_url ? (
                                  <img src={pr.icon_url} alt={pr.username} className="w-8 h-8 rounded-full border border-subtle object-cover flex-shrink-0" />
                                ) : (
                                  <div className="w-8 h-8 rounded-full border border-subtle surface-1 flex-shrink-0" />
                                )}
                                <span className="text-sm truncate flex-1" title={pr.username}>{pr.username}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                    <MembersListCard />
                  </div>
                )}
              </div>
            </section>

            {(vw > 1000) && (
              <aside className="hidden md:block space-y-4" style={{ width: asideWidth, maxWidth: 300 }}>
                <div className="rounded-lg border border-subtle p-4 surface-1">
                  <h2 className="font-medium mb-3">ステータス</h2>
                  <ul className="text-sm space-y-2">
                    <li className="flex items-center gap-2">
                      <span className="material-symbols-rounded icon-faint" aria-hidden>public</span>
                      <span>
                        <span className="text-subtle">表示ポリシー: </span>
                        {community?.visibility === 'public' ? '公開' : '非公開'}
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="material-symbols-rounded icon-faint" aria-hidden>{community?.join_policy === 'open' ? 'group_add' : (community?.join_policy === 'approval' ? 'approval' : 'login')}</span>
                      <span>
                        <span className="text-subtle">参加ポリシー: </span>
                        {community?.join_policy === 'open' ? '誰でも参加可' : community?.join_policy === 'approval' ? '承認制' : 'ログイン必須'}
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="material-symbols-rounded icon-faint" aria-hidden>warning</span>
                      <span>
                        <span className="text-subtle">年齢制限: </span>
                        {community?.is_nsfw ? 'あり' : 'なし'}
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="material-symbols-rounded icon-faint" aria-hidden>share</span>
                      <span>
                        <span className="text-subtle">転載: </span>
                        {community?.allow_repost ? '許可' : '不可'}
                      </span>
                    </li>
                    {community?.created_at && (
                      <li className="flex items-center gap-2">
                        <span className="material-symbols-rounded icon-faint" aria-hidden>calendar_today</span>
                        <span>
                          <span className="text-subtle">作成日: </span>
                          {new Date(community.created_at).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
                        </span>
                      </li>
                    )}
                  </ul>
                  {community?.description && (
                    <div className="mt-3">
                      <div className="text-sm font-medium mb-1">説明</div>
                      <div className="text-sm text-subtle whitespace-pre-wrap">{community.description}</div>
                    </div>
                  )}
                </div>
                <RulesCard rules={community?.rules} />
                <ModeratorListCard />
                {community?.membership_role === 'owner' && community?.join_policy === 'approval' && (
                  <div className="rounded-lg border border-subtle p-4 surface-1">
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="font-medium">参加申請</h2>
                      <button className="text-xs px-2 py-1 rounded-md border border-subtle surface-1 hover:bg-white/5" onClick={() => fetchPendingRequests(community || undefined)}>更新</button>
                    </div>
                    {pendingRequests.length === 0 ? (
                      <div className="text-sm text-subtle">参加申請はありません。</div>
                    ) : (
                      <ul className="space-y-3">
                        {pendingRequests.map(pr => (
                          <li key={pr.id} className="flex items-center gap-2 min-w-0">
                            {pr.icon_url ? (
                              <img src={pr.icon_url} alt={pr.username} className="w-8 h-8 rounded-full border border-subtle object-cover flex-shrink-0" />
                            ) : (
                              <div className="w-8 h-8 rounded-full border border-subtle surface-1 flex-shrink-0" />
                            )}
                            <span className="text-sm truncate flex-1" title={pr.username}>{pr.username}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
                <MembersListCard />
              </aside>
            )}
          </div>
        </div>
      </main>
      {vw > 0 && vw < 500 && (
        <MobileNav current={tab} onChange={(v) => { setTab(v); localStorage.setItem('homeTab', v); }} />
      )}
    </div>
  );
}

