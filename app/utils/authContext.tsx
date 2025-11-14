"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

type AuthContextType = {
  signedIn: boolean;
  isLoading: boolean;
  checkAuth: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  signedIn: false,
  isLoading: true,
  checkAuth: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [signedIn, setSignedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const checkAuth = async () => {
    try {
      // まず、/api/accounts/me/を呼び出して、JWTトークンがあるか確認
      const meRes = await fetch(`${API}/api/accounts/me/`, {
        credentials: 'include',
      });
      
      if (meRes.ok) {
        const data = await meRes.json();
        // ゲストユーザーでない場合のみログイン済みと判定
        const isAuthenticated = data && !data.is_guest && data.username && !data.username.startsWith('Anonium-');
        setSignedIn(isAuthenticated);
        if (data?.username) {
          try {
            localStorage.setItem('accessUsername', data.username);
          } catch {}
        }
        setIsLoading(false);
        return;
      }
      
      // JWTトークンがない場合、ゲストトークンを発行
      // ゲストユーザーの場合でも認証状態は false（ログインしていない）
      try {
        const guestRes = await fetch(`${API}/api/accounts/guest/issue/`, {
          method: 'POST',
          credentials: 'include',
        });
        if (guestRes.ok) {
          // ゲストトークンが発行された後、再度me情報を取得
          const guestData = await guestRes.json().catch(() => null);
          const gid = guestData && typeof guestData.gid === 'string' ? guestData.gid : '';
          if (gid) {
            const uname = `Anonium-${gid}`;
            try {
              localStorage.setItem('guestUsername', uname);
            } catch {}
          }
          // 少し遅延してからme情報を取得（Cookieが確実に設定されるまで待つ）
          setTimeout(async () => {
            try {
              const finalMeRes = await fetch(`${API}/api/accounts/me/`, {
                credentials: 'include',
              });
              if (finalMeRes.ok) {
                const finalData = await finalMeRes.json();
                if (finalData?.username) {
                  try {
                    localStorage.setItem('accessUsername', finalData.username);
                  } catch {}
                }
              }
            } catch {
              // エラーは無視
            }
          }, 100);
        }
      } catch {
        // ゲストトークン発行エラーは無視
      }
      
      setSignedIn(false);
    } catch {
      setSignedIn(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  return (
    <AuthContext.Provider value={{ signedIn, isLoading, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

