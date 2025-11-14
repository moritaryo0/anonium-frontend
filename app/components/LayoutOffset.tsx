"use client";

import { PropsWithChildren, useEffect, useState } from "react";

export default function LayoutOffset({ children }: PropsWithChildren) {
  const [vw, setVw] = useState<number>(0);

  useEffect(() => {
    function onResize() { setVw(window.innerWidth); }
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const leftRailWidth = vw >= 1200 ? 200 : 60;
  const paddingLeft = (vw >= 500 ? leftRailWidth : 0);

  return (
    <div style={{ paddingLeft }}>
      {children}
    </div>
  );
}


