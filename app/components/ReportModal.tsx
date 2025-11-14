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

export default function ReportModal({
  isOpen,
  title,
  message,
  placeholder = "報告理由を入力してください（任意）",
  defaultValue = "",
  confirmText = "報告する",
  cancelText = "キャンセル",
  onConfirm,
  onCancel,
}: Props) {
  const backdropRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    if (isOpen) {
      setValue(defaultValue);
      setTimeout(() => textareaRef.current?.focus(), 100);
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
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4 pointer-events-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-title"
    >
      <div 
        className="surface-2 border border-subtle rounded-lg p-6 max-w-md w-full shadow-lg pointer-events-auto"
        style={{ backgroundColor: 'var(--surface-2)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="report-title" className="text-lg font-semibold mb-3">{title}</h2>
        <p className="text-sm text-subtle mb-4">{message}</p>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          rows={5}
          className="w-full px-3 py-2 rounded-md border border-subtle surface-1 text-sm mb-6 focus:outline-none focus:border-white resize-y min-h-[100px]"
          style={{ backgroundColor: 'var(--surface-1)' }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
              e.preventDefault();
              onConfirm(value);
            }
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
            className="px-4 py-2 rounded-md bg-white text-black hover:bg-white/90 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
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

