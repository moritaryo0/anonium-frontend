"use client";

import { useState, useEffect } from "react";

type Props = {
  pollTitle: string;
  pollOptions: string[];
  onTitleChange: (title: string) => void;
  onOptionsChange: (options: string[]) => void;
  onExpiresChange?: (isoOrNull: string | null) => void;
  className?: string;
};

export default function PollEditor({ pollTitle, pollOptions, onTitleChange, onOptionsChange, onExpiresChange, className }: Props) {
  const [days, setDays] = useState<number>(0);
  const [hours, setHours] = useState<number>(0);
  const [minutes, setMinutes] = useState<number>(0);
  const [seconds, setSeconds] = useState<number>(0);
  const [unlimited, setUnlimited] = useState<boolean>(true);

  useEffect(() => {
    if (!onExpiresChange) return;
    if (unlimited) { onExpiresChange(null); return; }
    const total = (Math.max(0, days) * 86400) + (Math.max(0, hours) * 3600) + (Math.max(0, minutes) * 60) + Math.max(0, seconds);
    if (total <= 0) { onExpiresChange(null); return; }
    const d = new Date(Date.now() + total * 1000);
    onExpiresChange(d.toISOString());
  }, [days, hours, minutes, seconds, unlimited, onExpiresChange]);

  function addOption() {
    if (pollOptions.length < 20) {
      onOptionsChange([...pollOptions, ""]); 
    }
  }

  function removeOption(index: number) {
    if (pollOptions.length > 1) {
      onOptionsChange(pollOptions.filter((_, i) => i !== index));
    }
  }

  function updateOption(index: number, value: string) {
    const newOptions = [...pollOptions];
    newOptions[index] = value;
    onOptionsChange(newOptions);
  }

  return (
    <div className={className}>
      <div className="mb-4">
        <label className="block text-xs text-subtle mb-1">投票のタイトル</label>
        <input
          type="text"
          value={pollTitle}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="投票のタイトルを入力..."
          maxLength={200}
          className="w-full rounded-md border border-subtle bg-transparent px-3 py-2 text-sm focus:outline-none"
        />
      </div>

      <div className="mb-3">
        <label className="block text-xs text-subtle mb-1">投票期限</label>
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-1 text-xs">
            <input type="checkbox" className="rounded border-subtle" checked={unlimited} onChange={(e) => setUnlimited(e.target.checked)} />
            <span>無制限</span>
          </label>
          {!unlimited && (
            <div className="flex items-center gap-2 text-xs">
              <div className="inline-flex items-center gap-1">
                <input type="number" min={0} max={365} value={days} onChange={(e) => setDays(Number(e.target.value||0))} className="w-14 rounded-md border border-subtle bg-transparent px-2 py-1 text-xs" />
                <span>日</span>
              </div>
              <div className="inline-flex items-center gap-1">
                <input type="number" min={0} max={23} value={hours} onChange={(e) => setHours(Number(e.target.value||0))} className="w-14 rounded-md border border-subtle bg-transparent px-2 py-1 text-xs" />
                <span>時間</span>
              </div>
              <div className="inline-flex items-center gap-1">
                <input type="number" min={0} max={59} value={minutes} onChange={(e) => setMinutes(Number(e.target.value||0))} className="w-14 rounded-md border border-subtle bg-transparent px-2 py-1 text-xs" />
                <span>分</span>
              </div>
              <div className="inline-flex items-center gap-1">
                <input type="number" min={0} max={59} value={seconds} onChange={(e) => setSeconds(Number(e.target.value||0))} className="w-14 rounded-md border border-subtle bg-transparent px-2 py-1 text-xs" />
                <span>秒</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div>
        <label className="block text-xs text-subtle mb-2">投票項目（2-20個）</label>
        <div className="space-y-2">
          {pollOptions.map((option, index) => (
            <div key={index} className="flex items-center gap-2">
              <span className="text-sm text-subtle w-6 flex-shrink-0">{index + 1}.</span>
              <input
                type="text"
                value={option}
                onChange={(e) => updateOption(index, e.target.value)}
                placeholder={`選択肢 ${index + 1}`}
                maxLength={500}
                className="flex-1 rounded-md border border-subtle bg-transparent px-2 py-1 text-sm focus:outline-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (index === pollOptions.length - 1 && pollOptions.length < 20) {
                      addOption();
                      setTimeout(() => {
                        const inputs = e.currentTarget.parentElement?.parentElement?.querySelectorAll('input[type="text"]');
                        if (inputs && inputs.length > index + 2) {
                          (inputs[index + 2] as HTMLInputElement)?.focus();
                        }
                      }, 0);
                    } else if (index < pollOptions.length - 1) {
                      const inputs = e.currentTarget.parentElement?.parentElement?.querySelectorAll('input[type="text"]');
                      if (inputs && inputs.length > index + 2) {
                        (inputs[index + 2] as HTMLInputElement)?.focus();
                      }
                    }
                  }
                }}
              />
              {pollOptions.length > 1 && (
                <button
                  type="button"
                  className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-subtle surface-2 text-subtle hover:bg-white/5"
                  onClick={() => removeOption(index)}
                  title="削除"
                >
                  <span className="material-symbols-rounded text-sm" aria-hidden>close</span>
                </button>
              )}
            </div>
          ))}
          {pollOptions.length < 20 && (
            <button
              type="button"
              className="w-full text-left text-xs text-subtle hover:text-white px-2 py-1 rounded-md border border-subtle surface-2 hover:bg-white/5"
              onClick={addOption}
            >
              + 選択肢を追加
            </button>
          )}
          {pollOptions.length >= 20 && (
            <div className="text-xs text-subtle px-2 py-1">
              最大20個まで選択肢を追加できます
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

