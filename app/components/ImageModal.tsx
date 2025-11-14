"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  src: string;
  alt?: string;
  onClose: () => void;
};

export default function ImageModal({ src, alt = "image", onClose }: Props) {
  const [mounted, setMounted] = useState(false);
  const backdropRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => { setMounted(true); return () => setMounted(false); }, []);

  if (!mounted) return null;

  return createPortal(
    <div
      ref={backdropRef}
      className="fixed inset-0 z-[1000] bg-black/80 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
      role="dialog"
      aria-modal="true"
    >
      <div className="relative max-w-full max-h-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="max-w-full max-h-[100vh] rounded-md border border-white/20 object-contain" />
        <button
          className="absolute top-2 right-2 inline-flex items-center justify-center w-9 h-9 rounded-full bg-black/70 hover:bg-black/80 border border-white/20 text-white"
          onClick={onClose}
          aria-label="閉じる"
        >
          <span className="material-symbols-rounded" aria-hidden>close</span>
        </button>
      </div>
    </div>,
    document.body
  );
}


