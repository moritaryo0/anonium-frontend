"use client";

import { useState } from "react";
import RichText from "./RichText";

type Props = {
  onInsert: (text: string) => void;
  className?: string;
};

export default function QuoteEditor({ onInsert, className }: Props) {
  const [text, setText] = useState<string>("");

  function handleInsert() {
    if (text.trim()) {
      onInsert(text);
      setText("");
    }
  }

  // 引用形式に変換（各行に `> ` を追加）
  const quoteText = text ? text.split('\n').map(line => `> ${line}`).join('\n') : '';

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs text-subtle">引用テキスト</label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md border border-subtle surface-2 px-2 py-1 text-sm hover:bg-white/5"
            onClick={() => setText("")}
          >
            クリア
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md bg-accent text-white px-3 py-1.5 text-sm hover:opacity-90 disabled:opacity-50"
            disabled={!text.trim()}
            onClick={handleInsert}
          >
            本文へ挿入
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-subtle mb-1 block">入力</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="引用するテキストを入力..."
            className="w-full rounded-md border border-subtle surface-1 px-3 py-2 text-sm"
            rows={8}
          />
        </div>
        <div>
          <label className="text-xs text-subtle mb-1 block">プレビュー</label>
          <div className="w-full rounded-md border border-subtle surface-1 px-3 py-2 text-sm min-h-[8rem] max-h-[8rem] overflow-y-auto">
            {quoteText ? (
              <RichText text={quoteText} className="text-sm" />
            ) : (
              <div className="text-xs text-subtle">プレビューがここに表示されます</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

