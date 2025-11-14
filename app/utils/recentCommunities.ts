export type RecentCommunity = {
  id: number;
  name: string;
  icon_url?: string;
  visited_at: number; // epoch ms
  slug?: string; // 後方互換性のため保持
};

const KEY = 'recentCommunities';
const MAX_ITEMS = 30;

export function getRecentCommunities(): RecentCommunity[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((x) => x && (typeof x.id === 'number' || typeof x.slug === 'string') && typeof x.visited_at === 'number');
  } catch {
    return [];
  }
}

export function pushRecentCommunity(c: { id: number; name?: string; icon_url?: string; slug?: string }) {
  try {
    const now = Date.now();
    const list = getRecentCommunities();
    const without = list.filter((x) => x.id !== c.id);
    const item: RecentCommunity = { id: c.id, name: c.name || String(c.id), icon_url: c.icon_url, visited_at: now, slug: c.slug };
    const next = [item, ...without].slice(0, MAX_ITEMS);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
}

export function clearRecentCommunities() {
  try { localStorage.removeItem(KEY); } catch {}
}

export function removeRecentCommunity(idOrSlug: number | string) {
  try {
    const list = getRecentCommunities();
    const next = list.filter((x) => {
      if (typeof idOrSlug === 'number') {
        return x.id !== idOrSlug;
      } else {
        return x.slug !== idOrSlug && x.id !== Number(idOrSlug);
      }
    });
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
}


