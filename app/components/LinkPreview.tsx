"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

type OGP = {
  url: string;
  canonical_url?: string;
  title?: string;
  description?: string;
  image?: string;
  site_name?: string;
};

export default function LinkPreview({ url }: { url: string }) {
  const [data, setData] = useState<OGP | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [imgW, setImgW] = useState<number | null>(null);
  const [imgH, setImgH] = useState<number | null>(null);
  const [isNarrow, setIsNarrow] = useState<boolean>(false);
  const anchorRef = useRef<HTMLAnchorElement | null>(null);
  const [cardWidth, setCardWidth] = useState<number>(0);

  const domain = useMemo(() => {
    try {
      const u = new URL(url);
      return u.host;
    } catch {
      return "";
    }
  }, [url]);

  useEffect(() => {
    let cancelled = false;
    async function fetchOGP() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`${API}/api/ogp/preview/?url=${encodeURIComponent(url)}`);
        if (!res.ok) throw new Error(`status ${res.status}`);
        const j: OGP = await res.json();
        if (!cancelled) setData(j);
      } catch (e) {
        if (!cancelled) setError("failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchOGP();
    return () => { cancelled = true; };
  }, [url]);

  // 画面幅500px以下かどうかを監視
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(max-width: 500px)');
    const onChange = () => setIsNarrow(mq.matches);
    onChange();
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else mq.addListener(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', onChange);
      else mq.removeListener(onChange);
    };
  }, []);

  // 画像の縦横比を計算
  const ratio = useMemo(() => (imgW && imgH ? imgW / imgH : null), [imgW, imgH]);
  
  // コンテナ幅に応じてベース高さを調整（比率維持）
  useEffect(() => {
    const el = anchorRef.current;
    if (!el || typeof window === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry && entry.contentRect) setCardWidth(entry.contentRect.width);
    });
    ro.observe(el);
    try { setCardWidth(el.getBoundingClientRect().width); } catch {}
    return () => { try { ro.disconnect(); } catch {} };
  }, []);

  const compact = cardWidth > 0 && cardWidth < 520;
  const stacked = cardWidth > 0 && cardWidth < 360;
  const thumbnailBaseHeight = useMemo(() => {
    if (!cardWidth) return isNarrow ? 120 : 150;
    const base = Math.round(cardWidth * 0.22); // 横幅の約22%
    return Math.max(100, Math.min(180, base));
  }, [cardWidth, isNarrow]);
  const thumbnailSize = useMemo(() => {
    if (stacked) {
      // 縦積み時は横幅100%、高さは比率から算出（比率未取得時は200px）
      const width = cardWidth || 0;
      const height = ratio ? Math.round(width / ratio) : 200;
      return { width, height };
    }
    const height = thumbnailBaseHeight;
    const rawWidth = ratio ? Math.round(height * ratio) : height; // 比率が未取得の間は正方形
    // 親幅に対して最大45%に制限してはみ出しを防止
    const maxWidth = Math.max(80, Math.floor((cardWidth || 0) * 0.45));
    const width = Math.min(rawWidth, maxWidth);
    return { width, height };
  }, [ratio, thumbnailBaseHeight, cardWidth, stacked]);

  if (loading) {
    return (
      <div className="mt-2 rounded-lg border border-subtle surface-1 p-3 animate-pulse">
        <div className="h-4 bg-white/10 rounded w-1/2" />
        <div className="h-3 bg-white/10 rounded w-2/3 mt-2" />
      </div>
    );
  }
  if (error || !data) return null;

  const title = data.title || domain || data.url;
  const desc = data.description || "";
  const img = data.image || "";
  const site = data.site_name || domain;
  const href = data.canonical_url || data.url;

  return (
    <a
      ref={anchorRef}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative z-20 mt-2 block w-full rounded-lg border border-subtle surface-1 overflow-hidden hover:bg-white/5 transition-colors"
    >
      {/* 横並び（通常） or 縦積み（超狭幅） */}
      <div className={stacked ? "flex flex-col" : "flex"}>
        {img && (
          <div 
            className={stacked ? "w-full bg-white/10 overflow-hidden" : "flex-shrink-0 bg-white/10 overflow-hidden"}
            style={{ 
              width: stacked ? "100%" : `${thumbnailSize.width}px`, 
              height: `${thumbnailSize.height}px` 
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img}
              alt={title}
              className={stacked ? "w-full h-full object-cover" : "w-full h-full object-cover"}
              onLoad={(e) => { 
                try { 
                  setImgW(e.currentTarget.naturalWidth); 
                  setImgH(e.currentTarget.naturalHeight); 
                } catch {} 
              }}
            />
          </div>
        )}
        {/* テキストコンテナ */}
        <div className={`${stacked ? "p-3" : (compact ? 'p-2' : 'p-3')} min-w-0 flex-1 flex flex-col justify-center`}>
          {site && <div className="text-xs text-subtle mb-1 truncate">{site}</div>}
          <div className="text-sm font-semibold group-hover:underline line-clamp-2 mb-1">{title}</div>
          {desc && (
            <div className="text-xs text-subtle line-clamp-2 mb-1">{desc}</div>
          )}
          <div className="text-xs text-subtle underline group-hover:opacity-80 truncate">{href}</div>
        </div>
      </div>
    </a>
  );
}


