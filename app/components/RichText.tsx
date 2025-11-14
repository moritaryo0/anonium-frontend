"use client";

import React from "react";
import { linkify } from "./Linkify";

type Props = {
  text: string;
  className?: string;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

type Token = { type: 'text' | 'comment' | 'string' | 'keyword' | 'number'; text: string };

const JS_KEYWORDS = new Set([
  'async','await','break','case','catch','class','const','continue','debugger','default','delete','do','else','export','extends','finally','for','from','function','if','import','in','instanceof','let','new','null','return','super','switch','this','throw','try','typeof','var','void','while','with','yield','true','false','undefined'
]);

const PY_KEYWORDS = new Set([
  'and','as','assert','break','class','continue','def','del','elif','else','except','False','finally','for','from','global','if','import','in','is','lambda','None','nonlocal','not','or','pass','raise','return','True','try','while','with','yield'
]);

function tokenizeJS(code: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  const n = code.length;
  function push(type: Token['type'], text: string) { if (text) out.push({ type, text }); }
  while (i < n) {
    const ch = code[i];
    const next = code[i+1];
    // Line comment
    if (ch === '/' && next === '/') {
      let j = i + 2;
      while (j < n && code[j] !== '\n') j++;
      push('comment', code.slice(i, j));
      i = j;
      continue;
    }
    // Block comment
    if (ch === '/' && next === '*') {
      let j = i + 2;
      while (j < n && !(code[j] === '*' && code[j+1] === '/')) j++;
      j = Math.min(n, j + 2);
      push('comment', code.slice(i, j));
      i = j;
      continue;
    }
    // String / template
    if (ch === '"' || ch === '\'' || ch === '`') {
      const quote = ch;
      let j = i + 1;
      while (j < n) {
        const cj = code[j];
        if (cj === '\\') { j += 2; continue; }
        if (cj === quote) { j++; break; }
        j++;
      }
      push('string', code.slice(i, j));
      i = j;
      continue;
    }
    // Number
    {
      const m = /^(?:0x[0-9a-fA-F]+|\d+\.\d+|\d+)/.exec(code.slice(i));
      if (m) {
        push('number', m[0]);
        i += m[0].length;
        continue;
      }
    }
    // Identifier / keyword
    if (/[$A-Za-z_]/.test(ch)) {
      let j = i + 1;
      while (j < n && /[$0-9A-Za-z_]/.test(code[j])) j++;
      const word = code.slice(i, j);
      if (JS_KEYWORDS.has(word)) push('keyword', word); else push('text', word);
      i = j;
      continue;
    }
    // Other single char
    push('text', ch);
    i++;
  }
  return out;
}

function tokenizePy(code: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  const n = code.length;
  function push(type: Token['type'], text: string) { if (text) out.push({ type, text }); }
  while (i < n) {
    const ch = code[i];
    const next2 = code.slice(i, i+3);
    // Comment #...
    if (ch === '#') {
      let j = i + 1;
      while (j < n && code[j] !== '\n') j++;
      push('comment', code.slice(i, j));
      i = j;
      continue;
    }
    // Triple-quoted strings
    if (next2 === "'''" || next2 === '"""') {
      const q = next2;
      let j = i + 3;
      while (j < n && code.slice(j, j+3) !== q) {
        if (code[j] === '\\') { j += 2; continue; }
        j++;
      }
      j = Math.min(n, j + 3);
      push('string', code.slice(i, j));
      i = j;
      continue;
    }
    // Single/double strings
    if (ch === '\'' || ch === '"') {
      const quote = ch;
      let j = i + 1;
      while (j < n) {
        const cj = code[j];
        if (cj === '\\') { j += 2; continue; }
        if (cj === quote) { j++; break; }
        j++;
      }
      push('string', code.slice(i, j));
      i = j;
      continue;
    }
    // Number
    {
      const m = /^(?:0x[0-9a-fA-F]+|\d+\.\d+|\d+)/.exec(code.slice(i));
      if (m) {
        push('number', m[0]);
        i += m[0].length;
        continue;
      }
    }
    // Identifier / keyword
    if (/[A-Za-z_]/.test(ch)) {
      let j = i + 1;
      while (j < n && /[0-9A-Za-z_]/.test(code[j])) j++;
      const word = code.slice(i, j);
      if (PY_KEYWORDS.has(word)) push('keyword', word); else push('text', word);
      i = j;
      continue;
    }
    // Other single char
    push('text', ch);
    i++;
  }
  return out;
}

function highlightCode(code: string, lang?: string): string {
  const l = (lang || '').toLowerCase();
  const mode = /^(js|javascript|ts|typescript|tsx|jsx)$/.test(l) ? 'js' : (/^(py|python)$/.test(l) ? 'py' : 'none');
  if (mode === 'none') return escapeHtml(code);
  const tokens = mode === 'js' ? tokenizeJS(code) : tokenizePy(code);
  let html = '';
  for (const t of tokens) {
    const escaped = escapeHtml(t.text);
    switch (t.type) {
      case 'comment': html += `<span class="tk tk-comment">${escaped}</span>`; break;
      case 'string': html += `<span class="tk tk-string">${escaped}</span>`; break;
      case 'keyword': html += `<span class="tk tk-keyword">${escaped}</span>`; break;
      case 'number': html += `<span class="tk tk-number">${escaped}</span>`; break;
      default: html += escaped; break;
    }
  }
  return html;
}

function renderInline(s: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let last = 0;
  const inlineRegex = /`([^`]+)`/g;
  let mm: RegExpExecArray | null;
  while ((mm = inlineRegex.exec(s)) !== null) {
    const start = mm.index;
    const end = inlineRegex.lastIndex;
    if (start > last) {
      parts.push(
        <span key={`t-${last}`} className="whitespace-pre-wrap">
          {linkify(s.slice(last, start))}
        </span>
      );
    }
    const codeText = mm[1] || "";
    parts.push(
      <code
        key={`ic-${start}`}
        className="px-1 py-0.5 rounded-md border border-subtle surface-1 text-[0.85em] font-mono"
      >
        {codeText}
      </code>
    );
    last = end;
  }
  if (last < s.length) {
    parts.push(
      <span key={`t-${last}`} className="whitespace-pre-wrap">
        {linkify(s.slice(last))}
      </span>
    );
  }
  return <>{parts}</>;
}

function renderBlocks(plain: string): React.ReactNode {
  const nodes: React.ReactNode[] = [];
  const lines = plain.split('\n');
  let i = 0;
  while (i < lines.length) {
    const raw = lines[i];
    const line = raw || '';
    const trimmed = line.trim();

    // 空行は段落の区切りとして扱う
    if (trimmed === '') {
      i++;
      continue;
    }

    // 箇条書き: 連続する "- " または "・ " 始まりの行を <ul> にまとめる
    if (/^[-\・]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length) {
        const t = (lines[i] || '').trim();
        if (/^[-\・]\s+/.test(t)) {
          items.push(t.replace(/^[-\・]\s+/, ''));
          i++;
        } else if (t === '') {
          // 空行で終了
          i++;
          break;
        } else {
          break;
        }
      }
      nodes.push(
        <ul key={`ul-${i}-${items.length}`} className="list-disc pl-5 my-2">
          {items.map((it, idx) => (
            <li key={`li-${idx}`}>{renderInline(it)}</li>
          ))}
        </ul>
      );
      continue;
    }

    // 引用: 連続する "> " 始まりの行を <blockquote> にまとめる
    if (/^>\s?/.test(trimmed)) {
      const q: string[] = [];
      while (i < lines.length) {
        const t = (lines[i] || '').trim();
        if (/^>\s?/.test(t)) {
          q.push(t.replace(/^>\s?/, ''));
          i++;
        } else if (t === '') {
          // 空行で終了
          i++;
          break;
        } else {
          break;
        }
      }
      nodes.push(
        <blockquote key={`q-${i}-${q.length}`} className="border-l-2 border-subtle pl-3 py-2 pr-3 my-2 text-subtle surface-2 rounded-md max-w-fit">
          <div className="whitespace-pre-wrap">{renderInline(q.join('\n'))}</div>
        </blockquote>
      );
      continue;
    }

    // 通常行: 次の空行までを1段落として扱う
    const paras: string[] = [];
    while (i < lines.length) {
      const t = lines[i] || '';
      if ((t.trim() === '') || /^[-\・]\s+/.test(t.trim()) || /^>\s?/.test(t.trim())) break;
      paras.push(t);
      i++;
    }
    nodes.push(
      <p key={`p-${i}-${paras.length}`} className="my-1">
        <span className="whitespace-pre-wrap">{renderInline(paras.join('\n'))}</span>
      </p>
    );
  }
  return <>{nodes}</>;
}

export default function RichText({ text, className }: Props) {
  const nodes: React.ReactNode[] = [];
  if (!text) return <></>;

  let idx = 0;
  const fenceRegex = /```([a-zA-Z0-9_-]+)?[ \t]*\n([\s\S]*?)\n```/g;
  let m: RegExpExecArray | null;
  while ((m = fenceRegex.exec(text)) !== null) {
    const start = m.index;
    const end = fenceRegex.lastIndex;
    if (start > idx) {
      const plain = text.slice(idx, start);
      nodes.push(
        <React.Fragment key={`plain-${idx}-${start}`}>
          {renderBlocks(plain)}
        </React.Fragment>
      );
    }
    const lang = m[1] || "";
    const code = m[2] || "";
    nodes.push(
      <pre
        key={`code-${start}`}
        className="mt-2 mb-2 rounded-md border border-subtle surface-1 overflow-x-auto text-xs"
      >
        <code
          className={`block px-3 py-2 font-mono rt-code ${lang ? `language-${lang}` : ""}`}
          dangerouslySetInnerHTML={{ __html: highlightCode(code, lang) }}
        />
      </pre>
    );
    idx = end;
  }
  if (idx < text.length) {
    nodes.push(
      <React.Fragment key={`plain-tail-${idx}`}>
        {renderBlocks(text.slice(idx))}
      </React.Fragment>
    );
  }

  return <div className={className}>{nodes}</div>;
}


