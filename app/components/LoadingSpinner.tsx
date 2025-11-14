"use client";

import AtomSpinner from "./AtomSpinner";

type LoadingSpinnerProps = {
  size?: number; // px
  className?: string;
};

export default function LoadingSpinner({ size = 24, className = "" }: LoadingSpinnerProps) {
  return <AtomSpinner size={size} className={className} speed={800} electronCount={4} />;
}

