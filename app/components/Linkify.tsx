"use client";

import React from "react";

function normalizeHref(raw: string): string {
  if (raw.startsWith("https//")) return "https://" + raw.slice("https//".length);
  if (raw.startsWith("http//")) return "http://" + raw.slice("http//".length);
  return raw;
}

function formatDisplayText(rawUrl: string, maxLength = 48): string {
  try {
    const u = new URL(normalizeHref(rawUrl));
    // 表示はホスト + パス（クエリ/ハッシュは長ければ省略）
    let display = u.host + (u.pathname || "/");
    const extras = (u.search + u.hash) || "";
    if (display.length + extras.length <= maxLength) {
      return display + extras;
    }
    // 長い場合は末尾に…を付与して省略
    if (display.length > maxLength) {
      return display.slice(0, Math.max(0, maxLength - 1)) + "…";
    }
    // displayは収まるので、余裕がある分だけextrasを付ける
    const remain = maxLength - display.length - 1; // 末尾の…ぶん
    if (remain > 0 && extras) {
      return display + extras.slice(0, Math.max(0, remain)) + "…";
    }
    return display;
  } catch {
    // URLとして解釈できない場合は素の文字列を切り詰め
    if (rawUrl.length <= maxLength) return rawUrl;
    return rawUrl.slice(0, Math.max(0, maxLength - 1)) + "…";
  }
}

export function linkify(text: string): (string | React.ReactElement)[] {
  const nodes: (string | React.ReactElement)[] = [];
  if (!text) return nodes;
  // マッチ対象: 正常な http(s):// と、コロン抜けの http// / https//
  const regex = /(https?:\/\/[^\s]+)|((?:https|http)\/\/[^\s]+)/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const start = match.index;
    const end = regex.lastIndex;
    if (start > lastIndex) nodes.push(text.slice(lastIndex, start));
    let urlText = match[0];
    // 末尾の括弧や句読点が付いている場合は除去
    let trailing = "";
    while (/[),.!?\]\}]$/.test(urlText)) {
      trailing = urlText.slice(-1) + trailing;
      urlText = urlText.slice(0, -1);
    }
    const href = normalizeHref(urlText);
    const display = formatDisplayText(urlText);
    nodes.push(
      <a
        key={`${start}-${href}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="relative z-20 underline hover:opacity-80"
        onClick={(e) => e.stopPropagation()}
      >
        {display}
      </a>
    );
    if (trailing) nodes.push(trailing);
    lastIndex = end;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}


