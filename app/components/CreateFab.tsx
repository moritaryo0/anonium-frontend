"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

type CreateFabProps = {
  hideCreatePost?: boolean;
};

export default function CreateFab({ hideCreatePost = false }: CreateFabProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [vw, setVw] = useState<number>(0);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [authChecked, setAuthChecked] = useState<boolean>(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  
  // 投稿作成ページではスレッド作成ボタンを非表示 
  const isPostDetailPage = pathname?.startsWith("//");
  const showCreatePost = !hideCreatePost && !isPostDetailPage;
  
  // 認証状態を確認
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch(`${API}/api/accounts/me/`, {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          // ゲストユーザーかどうかを確認
          const isGuest = data.is_guest || (data.username && data.username.startsWith('Anonium-'));
          setIsAuthenticated(!isGuest && data.username && !data.username.startsWith('Anonium-'));
        } else {
          setIsAuthenticated(false);
        }
      } catch {
        setIsAuthenticated(false);
      } finally {
        setAuthChecked(true);
      }
    }
    checkAuth();
  }, []);

  // クライアントサイドでマウント後にウィンドウ幅を監視（1000px以下で表示）
  useEffect(() => {
    setMounted(true);
    function onResize() {
      setVw(window.innerWidth);
    }
    // 初回の幅を設定
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  
  // マウント前または1000px超の時は非表示（ハイドレーションエラーを防ぐ）
  const shouldShow = mounted && vw > 0 && vw <= 1000;

  // メニュー外をクリックしたら閉じる
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [isOpen]);

  // モーダルが開いている時はスクロールを無効化
  useEffect(() => {
    if (isModalOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isModalOpen]);

  if (!shouldShow) {
    return null;
  }

  return (
    <div className="fixed bottom-20 right-4 z-[60]" ref={menuRef}>
      {/* 展開メニュー */}
      <div 
        className={`absolute bottom-16 right-0 mb-2 flex flex-col gap-2 transition-all duration-200 ease-out z-[61] ${
          isOpen 
            ? 'opacity-100 translate-y-0 pointer-events-auto' 
            : 'opacity-0 translate-y-2 pointer-events-none'
        }`}
      >
        {showCreatePost && (
          <Link
            href="/post"
            className="flex items-center gap-3 px-4 py-3 bg-black/95 backdrop-blur-sm border border-subtle rounded-lg shadow-lg hover:bg-white/10 transition-colors min-w-[160px]"
            onClick={() => setIsOpen(false)}
          >
            <span className="material-symbols-rounded text-lg">edit</span>
            <span className="text-sm font-medium">スレッドを作成</span>
          </Link>
        )}
        {isAuthenticated && (
          <Link
            href="/community/new"
            className="flex items-center gap-3 px-4 py-3 bg-black/95 backdrop-blur-sm border border-subtle rounded-lg shadow-lg hover:bg-white/10 transition-colors min-w-[160px]"
            onClick={() => setIsOpen(false)}
          >
            <span className="material-symbols-rounded text-lg">add_circle</span>
            <span className="text-sm font-medium">アノニウムを作成</span>
          </Link>
        )}
        <button
          onClick={() => {
            setIsOpen(false);
            setIsModalOpen(true);
          }}
          className="flex items-center justify-center gap-2 px-3 py-2 text-xs text-subtle hover:text-white border border-subtle rounded-lg hover:bg-white/5 transition-colors min-w-[160px] bg-black/95 backdrop-blur-sm"
        >
          <span className="material-symbols-rounded text-sm">info</span>
          <span>アノニウムとは</span>
        </button>
      </div>

      {/* メインボタン */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-full bg-accent text-white shadow-lg hover:bg-accent/90 transition-all duration-200 flex items-center justify-center ${
          isOpen ? "rotate-45" : "rotate-0"
        }`}
        aria-label="作成メニュー"
        aria-expanded={isOpen}
      >
        <span className="material-symbols-rounded text-2xl">
          {isOpen ? "close" : "add"}
        </span>
      </button>

      {/* モーダル */}
      {isModalOpen && (
        <>
          {/* オーバーレイ */}
          <div
            className="fixed inset-0 bg-black/60 z-[70]"
            onClick={() => setIsModalOpen(false)}
          />
          {/* モーダルコンテンツ */}
          <div className="fixed inset-0 z-[71] flex items-center justify-center p-4">
            <div
              className="bg-black border border-subtle rounded-lg shadow-lg max-w-md w-full p-6 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">アノニウムとは</h2>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-subtle hover:text-white transition-colors"
                  aria-label="閉じる"
                >
                  <span className="material-symbols-rounded">close</span>
                </button>
              </div>
              <div className="space-y-3 text-sm">
                <p className="text-white">
                  このサービスではユーザはアノニウムというコミュニティを作成できます。
                </p>
                <p className="text-subtle">
                  Anonium(アノニウム)はインターネットの匿名性を構成する元素という意味で、アノニマス(anonymous : 匿名)と元素(~ium)から取った言葉です。
                </p>
                <p className="text-subtle">
                  このサービスは基本的に原則匿名であり、実名の使用は禁止です。我々はインターネットを構成する匿名性の元素の集合体なのです。
                </p>
                <div className="pt-2 border-t border-subtle">
                  <Link
                    href="/about/qa"
                    onClick={() => setIsModalOpen(false)}
                    className="inline-flex items-center gap-2 text-white hover:text-white/80 transition-colors"
                  >
                    <span className="material-symbols-rounded text-base" style={{ fontSize: 16 }}>help_outline</span>
                    <span>よくある質問（Q&A）を見る</span>
                  </Link>
                </div>
              </div>
              <div className="flex justify-end pt-4">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors"
                >
                  閉じる
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

