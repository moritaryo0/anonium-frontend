// 最近見た投稿を管理するユーティリティ

export type RecentPost = {
  id: number;
  title: string;
  created_at: string;
  community_slug?: string;
  community_name?: string;
  author_username?: string;
  viewed_at: number; // 閲覧時刻（ミリ秒）
};

const STORAGE_KEY = 'recentPosts';
const MAX_RECENT_POSTS = 50; // 最大保存数

// localStorageから最近見た投稿を取得
export function getRecentPosts(): RecentPost[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    
    const posts: RecentPost[] = JSON.parse(stored);
    return posts.sort((a, b) => b.viewed_at - a.viewed_at); // 新しい順にソート
  } catch {
    return [];
  }
}

// 最近見た投稿を追加
export function addRecentPost(post: Omit<RecentPost, 'viewed_at'>): void {
  if (typeof window === 'undefined') return;
  
  try {
    const recent = getRecentPosts();
    
    // 既に存在する場合は削除（重複防止）
    const filtered = recent.filter(p => p.id !== post.id);
    
    // 新しい投稿を先頭に追加
    const updated = [{ ...post, viewed_at: Date.now() }, ...filtered];
    
    // 最大数まで制限
    const limited = updated.slice(0, MAX_RECENT_POSTS);
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(limited));
  } catch {
    // エラー時は無視
  }
}

// 最近見た投稿をクリア
export function clearRecentPosts(): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // エラー時は無視
  }
}

// 特定の投稿を削除
export function removeRecentPost(postId: number): void {
  if (typeof window === 'undefined') return;
  
  try {
    const recent = getRecentPosts();
    const filtered = recent.filter(p => p.id !== postId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch {
    // エラー時は無視
  }
}

