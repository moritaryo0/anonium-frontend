"use client";

import { useEffect, useState } from "react";
import AtomSpinner from "./AtomSpinner";

type PageLoaderProps = {
  animationDuration?: number; // ms (スピナーの速度として使用)
  size?: number; // px
};

export default function PageLoader({ animationDuration = 800, size = 60 }: PageLoaderProps) {
  const [visible, setVisible] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    function finish() {
      // Trigger fade-out animation first, then remove from DOM
      setFadeOut(true);
      const timeout = window.setTimeout(() => setVisible(false), 260);
      return () => window.clearTimeout(timeout);
    }

    if (typeof window !== "undefined") {
      if (document.readyState === "complete") {
        return finish();
      }
      const onLoad = () => finish();
      window.addEventListener("load", onLoad);
      return () => window.removeEventListener("load", onLoad);
    }
  }, []);

  if (!visible) return null;

  return (
    <div className={`page-loader-overlay${fadeOut ? " page-loader-overlay--fadeout" : ""}`}>
      <AtomSpinner size={size} speed={animationDuration} electronCount={4} />
    </div>
  );
}


