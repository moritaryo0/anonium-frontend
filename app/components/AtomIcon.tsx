import React from 'react';

type AtomIconProps = {
  className?: string;
  size?: number;
};

export default function AtomIcon({ className = '', size = 24 }: AtomIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 50 50"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* 軌道1 - 水平方向の楕円 */}
      <ellipse 
        cx="25" 
        cy="25" 
        rx="18" 
        ry="7" 
        stroke="currentColor" 
        strokeWidth="2"
        fill="none"
      />
      {/* 電子1 - 水平軌道の右側 */}
      <circle cx="42.5" cy="25" r="3" fill="currentColor" />
      
      {/* 軌道2 - 垂直方向の楕円 */}
      <ellipse 
        cx="25" 
        cy="25" 
        rx="7" 
        ry="18" 
        stroke="currentColor" 
        strokeWidth="2"
        fill="none"
      />
      {/* 電子2 - 垂直軌道の下側 */}
      <circle cx="25" cy="42.5" r="3" fill="currentColor" />
      
      {/* 軌道3 - 斜め45度の楕円 */}
      <g transform="rotate(45 25 25)">
        <ellipse 
          cx="25" 
          cy="25" 
          rx="18" 
          ry="7" 
          stroke="currentColor" 
          strokeWidth="2"
          fill="none"
        />
        {/* 電子3 - 斜め軌道の右上 */}
        <circle cx="42.5" cy="25" r="3" fill="currentColor" />
      </g>
      
      {/* 中心の原子核 */}
      <circle cx="25" cy="25" r="4" fill="currentColor" />
    </svg>
  );
}

