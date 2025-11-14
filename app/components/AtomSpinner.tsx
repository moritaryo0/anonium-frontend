"use client";

type AtomSpinnerProps = {
  size?: number; // px
  className?: string;
  electronCount?: number; // 電子の数（デフォルト4、Si原子の価電子）
  speed?: number; // アニメーション速度（ms、デフォルト800）
};

export default function AtomSpinner({ 
  size = 24, 
  className = "",
  electronCount = 4, // Si原子の価電子数
  speed = 800 // より速い回転
}: AtomSpinnerProps) {
  // 電子数は4に制限（CSSのnth-child対応のため）
  const actualElectronCount = Math.min(electronCount, 4);
  const electrons = Array.from({ length: actualElectronCount }, (_, i) => i);
  const radius = size * 0.35; // 軌道の半径

  return (
    <div
      className={`atom-spinner ${className}`}
      style={{
        "--atom-size": `${size}px`,
        "--atom-radius": `${radius}px`,
        "--atom-speed": `${speed}ms`,
      } as React.CSSProperties}
      aria-label="読み込み中"
      role="status"
    >
      <span className="sr-only">読み込み中</span>
      {/* 原子核 */}
      <div className="atom-spinner__nucleus" />
      {/* 電子軌道（Si原子の四面体構造を模倣） */}
      {electrons.map((index) => (
        <div
          key={index}
          className="atom-spinner__orbit"
        >
          <div 
            className="atom-spinner__electron"
            style={{
              animationDelay: `${(index * speed) / (actualElectronCount * 2)}ms`,
            } as React.CSSProperties}
          />
        </div>
      ))}
    </div>
  );
}

