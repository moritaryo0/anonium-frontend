"use client";

import React, { useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

// 型定義は親コンポーネントから受け取るため、ここでは定義しない
type User = any;
type Community = any;
type GroupChatMessage = any;
type Report = any;

interface ChatSectionProps {
  messages: GroupChatMessage[];
  newMessage: string;
  setNewMessage: (message: string) => void;
  replyingTo: GroupChatMessage | null;
  setReplyingTo: React.Dispatch<React.SetStateAction<GroupChatMessage | null>>;
  reportingFrom: Report | null;
  setReportingFrom: React.Dispatch<React.SetStateAction<Report | null>>;
  currentUserId: number | null;
  handleSendMessage: () => Promise<void>;
  handleReplyToMessage: (message: GroupChatMessage) => void;
  handleCancelReply: () => void;
  handleDeleteMessage: (messageId: number) => Promise<void>;
  scrollToBottom?: () => void;
  showScrollToBottom: boolean;
  postDetails?: Record<number, {
    id: number;
    title: string;
    body?: string;
    author_username?: string;
    author_icon_url?: string;
    community_slug?: string;
    created_at: string;
  }>;
  commentDetails?: Record<number, {
    id: number;
    body: string;
    author_username?: string;
    author_icon_url?: string;
    post: number;
    created_at: string;
  }>;
  commentPostIds?: Record<number, number>;
}

export default function ChatSection({
  messages,
  newMessage,
  setNewMessage,
  replyingTo,
  setReplyingTo,
  reportingFrom,
  setReportingFrom,
  currentUserId,
  handleSendMessage,
  handleReplyToMessage,
  handleCancelReply,
  handleDeleteMessage,
  scrollToBottom,
  showScrollToBottom,
  postDetails = {},
  commentDetails = {},
  commentPostIds = {},
}: ChatSectionProps) {
  const router = useRouter();
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);
  const isInitialLoad = useRef(true);

  // スクロールを最下部に移動する関数
  const scrollToBottomFunc = useCallback(() => {
    if (messagesContainerRef.current) {
      // 即座に最下部に移動（スムーズスクロールなし）
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, []);

  // メッセージが更新されたらスクロール
  useEffect(() => {
    // 初期読み込み時またはメッセージが更新されたらスクロール
    if (messages.length > 0) {
      // DOMの更新を待つために複数の方法を組み合わせ
      // requestAnimationFrameを2回使用してレンダリング完了を待つ
      const timeoutId = setTimeout(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            scrollToBottomFunc();
            if (isInitialLoad.current) {
              isInitialLoad.current = false;
            }
          });
        });
      }, 150); // 初期読み込み時は少し長めの遅延
      
      return () => clearTimeout(timeoutId);
    }
  }, [messages, scrollToBottomFunc]);

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

  return (
    <div className="bg-[var(--surface-2)] rounded-lg flex flex-col relative" style={{ height: 'calc(100vh - 250px)' }}>
      {/* 報告カードの固定表示（チャットボックス上部、スクロールしても見える） */}
      {reportingFrom && (
        <div className="flex-shrink-0 border-b border-subtle bg-[var(--surface-2)] z-30">
          <div className="px-4 pt-3 pb-2">
            <div className="border-l-4 border-orange-500/60 pl-3 py-2 bg-orange-500/10 rounded-r flex items-start justify-between shadow-sm">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="material-symbols-rounded text-orange-400 text-xs" aria-hidden>flag</span>
                  <span className="text-xs font-medium text-orange-300">
                    報告 #{reportingFrom.id}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    reportingFrom.status === 'pending' ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' :
                    reportingFrom.status === 'in_progress' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' :
                    reportingFrom.status === 'resolved' ? 'bg-green-500/20 text-green-300 border border-green-500/30' :
                    'bg-gray-500/20 text-gray-300 border border-gray-500/30'
                  }`}>
                    {reportingFrom.status === 'pending' ? '未対応' :
                     reportingFrom.status === 'in_progress' ? '対応中' :
                     reportingFrom.status === 'resolved' ? '対応済み' : '却下'}
                  </span>
                </div>
                <div className="text-[11px] text-gray-400 line-clamp-1">
                  報告者: {reportingFrom.reporter.username} | {reportingFrom.body}
                </div>
              </div>
              <button
                onClick={() => setReportingFrom(null)}
                className="ml-2 text-gray-400 hover:text-gray-200 transition-colors flex-shrink-0"
                aria-label="報告の引用をキャンセル"
              >
                <span className="material-symbols-rounded text-base">close</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* メッセージ一覧 */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto chat-scrollbar"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(255, 255, 255, 0.1) transparent',
        }}
      >
        <div className="p-4">
          {messages.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              メッセージがありません。最初のメッセージを送信しましょう！
            </div>
          ) : (
            <div className="space-y-4">
              {[...messages].reverse().map((message) => {
              const isMyMessage = currentUserId !== null && message.sender.id === currentUserId;
              return (
                <div 
                  key={message.id}
                  data-message-id={message.id}
                  className="flex gap-3 rounded-lg p-2"
                >
                  <div className="flex-shrink-0">
                    {message.sender.icon_url ? (
                      <img
                        src={message.sender.icon_url}
                        alt={message.sender.username}
                        className="w-10 h-10 rounded-full"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-[var(--accent)] flex items-center justify-center">
                        <span className="text-sm">
                          {message.sender.username[0].toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="font-semibold">
                        {message.sender.username}
                      </span>
                      <span className="text-xs text-gray-400">
                        {formatTime(message.created_at)}
                      </span>
                    </div>
                    {/* 引用メッセージの表示 */}
                    {message.reply_to && (
                      <div 
                        className="mb-2 border-l-4 border-[var(--accent)] pl-3 py-1 bg-[var(--surface-1)]/50 rounded-r cursor-pointer hover:bg-[var(--surface-1)]/70 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          // 引用元メッセージの位置にスクロール
                          setTimeout(() => {
                            const element = document.querySelector(`[data-message-id="${message.reply_to?.id}"]`);
                            if (element) {
                              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                              // 一時的にハイライト表示
                              element.classList.add('ring-2', 'ring-[var(--accent)]');
                              setTimeout(() => {
                                element.classList.remove('ring-2', 'ring-[var(--accent)]');
                              }, 2000);
                            }
                          }, 100);
                        }}
                        title="引用元メッセージを表示"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          {message.reply_to.sender.icon_url ? (
                            <img
                              src={message.reply_to.sender.icon_url}
                              alt={message.reply_to.sender.username}
                              className="w-6 h-6 rounded-full"
                            />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-[var(--accent)]/50 flex items-center justify-center">
                              <span className="text-xs">
                                {message.reply_to.sender.username[0].toUpperCase()}
                              </span>
                            </div>
                          )}
                          <span className="text-xs font-medium text-gray-300">
                            {message.reply_to.sender.username}
                          </span>
                        </div>
                        <div className="text-sm text-gray-400 line-clamp-2">
                          {message.reply_to.body}
                        </div>
                      </div>
                    )}
                    {/* 引用報告の表示 */}
                    {message.report && (
                      <div className="mb-2 border-l-4 border-orange-500/60 pl-3 py-2 bg-orange-500/10 rounded-r">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="material-symbols-rounded text-orange-400 text-sm" aria-hidden>flag</span>
                          <span className="text-xs font-medium text-orange-300">
                            報告 #{message.report.id} を引用
                          </span>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                            message.report.status === 'pending' ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' :
                            message.report.status === 'in_progress' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' :
                            message.report.status === 'resolved' ? 'bg-green-500/20 text-green-300 border border-green-500/30' :
                            'bg-gray-500/20 text-gray-300 border border-gray-500/30'
                          }`}>
                            {message.report.status === 'pending' ? '未対応' :
                             message.report.status === 'in_progress' ? '対応中' :
                             message.report.status === 'resolved' ? '対応済み' : '却下'}
                          </span>
                        </div>
                        <div className="text-xs text-gray-400 mb-2">
                          報告者: {message.report.reporter.username} | 
                          対象: {message.report.content_type === 'post' ? '投稿' : 'コメント'} #{message.report.content_object_id}
                        </div>
                        <div className="text-sm text-gray-300 mb-3 whitespace-pre-wrap break-words bg-[var(--surface-2)] rounded p-2">
                          {message.report.body}
                        </div>
                        {/* 投稿/コメントの詳細カード */}
                        {(() => {
                          if (message.report.content_type === 'comment') {
                            // コメントの報告の場合
                            const commentId = message.report.comment_id || message.report.content_object_id;
                            const commentDetail = commentId ? commentDetails[commentId] : null;
                            const postId = commentDetail?.post || (commentId ? commentPostIds[commentId] : null);
                            const postDetail = postId ? postDetails[postId] : null;

                            if (postDetail) {
                              const cardHref = `/p/${postId}${commentId ? `#comment-${commentId}` : ''}`;
                              return (
                                <Link
                                  href={cardHref}
                                  className="mt-2 p-3 bg-[var(--surface-2)] rounded-lg border border-subtle hover:border-orange-500/50 transition-colors block"
                                  onClick={(e) => e.stopPropagation()}
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
                          } else if (message.report.content_type === 'post') {
                            // 投稿の報告の場合
                            const postId = message.report.post_id || message.report.content_object_id;
                            const postDetail = postId ? postDetails[postId] : null;

                            if (postDetail) {
                              const cardHref = `/p/${postId}`;
                              return (
                                <Link
                                  href={cardHref}
                                  className="mt-2 p-3 bg-[var(--surface-2)] rounded-lg border border-subtle hover:border-orange-500/50 transition-colors block"
                                  onClick={(e) => e.stopPropagation()}
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
                      </div>
                    )}
                    <div className="bg-[var(--surface-1)] rounded-lg p-3 whitespace-pre-wrap break-words">
                      {message.body}
                    </div>
                    {/* 返信ボタンと削除ボタン */}
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReplyToMessage(message);
                        }}
                        className="flex items-center gap-1 text-xs text-gray-400 hover:text-[var(--accent)] px-2 py-1 rounded hover:bg-[var(--surface-1)] transition-colors"
                        aria-label="返信"
                        title="このメッセージに返信"
                      >
                        <span className="material-symbols-rounded text-sm" aria-hidden>reply</span>
                        <span>返信</span>
                      </button>
                      {isMyMessage && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteMessage(message.id);
                          }}
                          className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-300 px-2 py-1 rounded hover:bg-[var(--surface-1)] transition-colors"
                          aria-label="削除"
                          title="このメッセージを削除"
                        >
                          <span className="material-symbols-rounded text-sm" aria-hidden>delete</span>
                          <span>削除</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* メッセージ入力 */}
      <div className="border-t border-subtle p-3">
        {/* 引用リプライ表示 */}
        {replyingTo && (
          <div className="mb-2 border-l-4 border-[var(--accent)] pl-3 py-2 bg-[var(--surface-1)] rounded-r flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {replyingTo.sender.icon_url ? (
                  <img
                    src={replyingTo.sender.icon_url}
                    alt={replyingTo.sender.username}
                    className="w-5 h-5 rounded-full"
                  />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-[var(--accent)]/50 flex items-center justify-center">
                    <span className="text-xs">
                      {replyingTo.sender.username[0].toUpperCase()}
                    </span>
                  </div>
                )}
                <span className="text-xs font-medium text-gray-300">
                  {replyingTo.sender.username}に返信
                </span>
              </div>
              <div className="text-xs text-gray-400 line-clamp-1">
                {replyingTo.body}
              </div>
            </div>
            <button
              onClick={handleCancelReply}
              className="ml-2 text-gray-400 hover:text-gray-200 transition-colors"
              aria-label="返信をキャンセル"
            >
              <span className="material-symbols-rounded text-lg">close</span>
            </button>
          </div>
        )}
        <div className="flex gap-2">
          <textarea
            ref={messageInputRef}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                if (replyingTo) {
                  handleCancelReply();
                } else if (reportingFrom) {
                  setReportingFrom(null);
                }
              }
            }}
            placeholder={replyingTo ? `${replyingTo.sender.username}に返信...` : reportingFrom ? `報告 #${reportingFrom.id} について議論...` : "メッセージを入力..."}
            className="flex-1 bg-[var(--surface-1)] text-[var(--foreground)] rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            rows={1}
          />
          <button
            onClick={handleSendMessage}
            disabled={!newMessage.trim()}
            className="bg-[var(--accent)] text-white px-4 py-2 rounded-lg hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            送信
          </button>
        </div>

        {/* 一番下にスクロールボタン */}
        {showScrollToBottom && (
          <button
            onClick={scrollToBottomFunc}
            className="absolute bottom-24 right-4 bg-[var(--surface-1)] border border-subtle rounded-full p-2.5 shadow-lg hover:bg-[var(--surface-2)] transition-all z-10 flex items-center justify-center"
            style={{ width: '40px', height: '40px' }}
            aria-label="一番下にスクロール"
            title="一番下にスクロール"
          >
            <span className="material-symbols-rounded text-[var(--foreground)] text-xl">keyboard_arrow_down</span>
          </button>
        )}
      </div>
    </div>
  );
}

