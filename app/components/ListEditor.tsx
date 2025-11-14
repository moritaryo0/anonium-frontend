"use client";

import { useState } from "react";

type Props = {
  onInsert: (items: string[]) => void;
  className?: string;
};

export default function ListEditor({ onInsert, className }: Props) {
  const [items, setItems] = useState<string[]>([""]);

  function addItem() {
    setItems([...items, ""]);
  }

  function removeItem(index: number) {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  }

  function updateItem(index: number, value: string) {
    const newItems = [...items];
    newItems[index] = value;
    setItems(newItems);
  }

  function handleInsert() {
    const nonEmptyItems = items.filter(item => item.trim() !== "");
    if (nonEmptyItems.length > 0) {
      onInsert(nonEmptyItems);
      setItems([""]);
    }
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs text-subtle">箇条書き項目</label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md border border-subtle surface-2 px-2 py-1 text-sm hover:bg-white/5"
            onClick={() => setItems([""])}
          >
            クリア
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md bg-accent text-white px-3 py-1.5 text-sm hover:opacity-90 disabled:opacity-50"
            disabled={items.filter(item => item.trim() !== "").length === 0}
            onClick={handleInsert}
          >
            本文へ挿入
          </button>
        </div>
      </div>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            <span className="text-sm text-subtle w-4 flex-shrink-0">・</span>
            <input
              type="text"
              value={item}
              onChange={(e) => updateItem(index, e.target.value)}
              placeholder={`項目 ${index + 1}`}
              className="flex-1 rounded-md border border-subtle bg-transparent px-2 py-1 text-sm focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (index === items.length - 1) {
                    addItem();
                    // 次のフレームで新しい入力フィールドにフォーカス
                    setTimeout(() => {
                      const inputs = e.currentTarget.parentElement?.parentElement?.querySelectorAll('input[type="text"]');
                      if (inputs && inputs.length > index + 1) {
                        (inputs[index + 1] as HTMLInputElement)?.focus();
                      }
                    }, 0);
                  } else {
                    const inputs = e.currentTarget.parentElement?.parentElement?.querySelectorAll('input[type="text"]');
                    if (inputs && inputs.length > index + 1) {
                      (inputs[index + 1] as HTMLInputElement)?.focus();
                    }
                  }
                }
              }}
            />
            {items.length > 1 && (
              <button
                type="button"
                className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-subtle surface-2 text-subtle hover:bg-white/5"
                onClick={() => removeItem(index)}
                title="削除"
              >
                <span className="material-symbols-rounded text-sm" aria-hidden>close</span>
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          className="w-full text-left text-xs text-subtle hover:text-white px-2 py-1 rounded-md border border-subtle surface-2 hover:bg-white/5"
          onClick={addItem}
        >
          + 項目を追加
        </button>
      </div>
    </div>
  );
}

