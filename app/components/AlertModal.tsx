"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

type Props = {
  isOpen: boolean;
  title: string;
  message: string;
  buttonText?: string;
  onClose: () => void;
};

export default function AlertModal({
  isOpen,
  title,
  message,
  buttonText = "OK",
  onClose,
}: Props) {
  const backdropRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' || e.key === 'Enter') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      buttonRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div
      ref={backdropRef}
      className="fixed inset-0 z-[1000] bg-black/80 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="alert-title"
    >
      <div className="bg-surface-2 border border-subtle rounded-lg p-6 max-w-md w-full shadow-lg">
        <h2 id="alert-title" className="text-lg font-semibold mb-3">{title}</h2>
        <p className="text-sm text-subtle mb-6">{message}</p>
        <div className="flex items-center justify-end">
          <button
            ref={buttonRef}
            className="px-4 py-2 rounded-md bg-accent text-white hover:opacity-90 text-sm"
            onClick={onClose}
          >
            {buttonText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

