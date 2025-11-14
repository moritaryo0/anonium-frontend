"use client";

import { useState } from "react";

type Props = {
  onInsert: (code: string, language?: string) => void;
  className?: string;
};

export default function CodeBlockEditor({ onInsert, className }: Props) {
  const [language, setLanguage] = useState<string>("");
  const [code, setCode] = useState<string>("");

  return (
    <div className={className}>
      <div className="flex items-center gap-2 mb-2">
        <label className="text-xs text-subtle">言語</label>
        <input
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          placeholder="例: js, ts, py, go"
          className="rounded-md border border-subtle bg-transparent px-2 py-1 text-sm"
          style={{ width: 160 }}
        />
        <div className="flex-1" />
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-md border border-subtle surface-2 px-2 py-1 text-sm hover:bg-white/5"
          onClick={() => { setCode(""); setLanguage(""); }}
        >
          クリア
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-md bg-accent text-white px-3 py-1.5 text-sm hover:opacity-90 disabled:opacity-50"
          disabled={!code.trim()}
          onClick={() => onInsert(code, language.trim() || undefined)}
        >
          挿入
        </button>
      </div>
      <textarea
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder={`ここにコードを貼り付け/入力\nTabでインデントできます`}
        className="w-full rounded-md border border-subtle surface-1 px-3 py-2 font-mono text-sm"
        rows={10}
        onKeyDown={(e) => {
          if (e.key === 'Tab') {
            e.preventDefault();
            const target = e.currentTarget;
            const start = target.selectionStart || 0;
            const end = target.selectionEnd || 0;
            const before = code.slice(0, start);
            const after = code.slice(end);
            const insert = "\t"; // タブ文字（必要ならスペース2に変更）
            const next = before + insert + after;
            setCode(next);
            requestAnimationFrame(() => {
              try { target.setSelectionRange(start + insert.length, start + insert.length); } catch {}
            });
          }
        }}
      />
    </div>
  );
}


