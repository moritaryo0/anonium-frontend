import { MouseEvent } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export type MenuItem = {
  id: string;
  label: string | (() => string);
  icon: string;
  show: boolean;
  onClick: (e: MouseEvent<HTMLButtonElement>) => void | Promise<void>;
  className?: string;
  divider?: boolean; // この項目の前に区切り線を表示
};

type PostMenuProps = {
  items: MenuItem[];
  onClose: () => void;
};

export default function PostMenu({ items, onClose }: PostMenuProps) {
  const visibleItems = items.filter(item => item.show);

  if (visibleItems.length === 0) return null;

  return (
    <>
      {visibleItems.map((item, index) => {
        const label = typeof item.label === 'function' ? item.label() : item.label;
        const className = item.className || "w-full text-left px-3 py-2 text-sm hover:bg-white/10 flex items-center gap-2";
        const borderClass = item.divider ? "border-t border-subtle" : index > 0 && !visibleItems[index - 1]?.divider ? "border-b border-subtle" : "";

        return (
          <button
            key={item.id}
            className={`${className} ${borderClass}`}
            onClick={async (e) => {
              e.stopPropagation();
              e.preventDefault();
              await item.onClick(e);
              onClose();
            }}
          >
            <span className="material-symbols-rounded" aria-hidden>{item.icon}</span>
            <span>{label}</span>
          </button>
        );
      })}
    </>
  );
}

