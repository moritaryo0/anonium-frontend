"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  isOpen: boolean;
  title: string;
  message: string;
  placeholder?: string;
  defaultValue?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
};

export default function PromptModal({
  isOpen,
  title,
  message,
  placeholder = "",
  defaultValue = "",
  confirmText = "OK",
  cancelText = "キャンセル",
  onConfirm,
  onCancel,
}: Props) {
  const backdropRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    if (isOpen) {
      setValue(defaultValue);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, defaultValue]);

  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter' && e.ctrlKey) onConfirm(value);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, value, onConfirm, onCancel]);

  if (!isOpen) return null;

  return createPortal(
    <div
      ref={backdropRef}
      className="fixed inset-0 z-[1000] bg-black/80 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === backdropRef.current) onCancel(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="prompt-title"
    >
      <div className="bg-surface-2 border border-subtle rounded-lg p-6 max-w-md w-full shadow-lg">
        <h2 id="prompt-title" className="text-lg font-semibold mb-3">{title}</h2>
        <p className="text-sm text-subtle mb-4">{message}</p>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="w-full px-3 py-2 rounded-md border border-subtle bg-transparent text-sm mb-6 focus:outline-none focus:border-accent"
          onKeyDown={(e) => {
            if (e.key === 'Enter') onConfirm(value);
          }}
        />
        <div className="flex items-center justify-end gap-3">
          <button
            className="px-4 py-2 rounded-md border border-subtle surface-1 hover:bg-white/5 text-sm"
            onClick={onCancel}
          >
            {cancelText}
          </button>
          <button
            className="px-4 py-2 rounded-md bg-accent text-white hover:opacity-90 text-sm"
            onClick={() => onConfirm(value)}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

