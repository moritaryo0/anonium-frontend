"use client";

import { useState } from "react";

type RuleItem = {
  title: string;
  description: string;
};

type Props = {
  rules?: string | RuleItem[];
};

export default function RulesCard({ rules }: Props) {
  const [expandedRules, setExpandedRules] = useState<Set<number>>(new Set());

  // 空の場合は表示しない
  if (!rules) return null;

  // 文字列の場合（後方互換性のため）
  if (typeof rules === 'string') {
    const trimmed = rules.trim();
    if (!trimmed) return null;
    return (
      <div className="rounded-lg border border-subtle p-4 surface-1">
        <h2 className="font-medium mb-2">ルール</h2>
        <div className="text-sm text-subtle whitespace-pre-wrap max-h-[calc(100vh-400px)] overflow-auto">{trimmed}</div>
      </div>
    );
  }

  // 配列の場合
  if (Array.isArray(rules) && rules.length === 0) return null;

  if (!Array.isArray(rules)) return null;

  const toggleRule = (index: number) => {
    setExpandedRules(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  return (
    <div className="rounded-lg border border-subtle p-4 surface-1">
      <h2 className="font-medium mb-3">ルール</h2>
      <div className="space-y-2 max-h-[calc(100vh-400px)] overflow-auto">
        {rules.map((rule, index) => {
          const isExpanded = expandedRules.has(index);
          const hasDescription = rule.description && rule.description.trim().length > 0;
          
          return (
            <div key={index} className="text-sm">
              <button
                onClick={() => hasDescription && toggleRule(index)}
                className={`w-full text-left flex items-start gap-2 ${
                  hasDescription ? 'cursor-pointer hover:opacity-80' : 'cursor-default'
                }`}
                disabled={!hasDescription}
              >
                <span className="font-medium text-foreground flex-shrink-0">
                  {index + 1}.
                </span>
                <span className="font-medium text-foreground flex-1">
                  {rule.title || `ルール${index + 1}`}
                </span>
                {hasDescription && (
                  <span className="material-symbols-rounded text-base text-subtle flex-shrink-0 transition-transform">
                    {isExpanded ? 'expand_less' : 'expand_more'}
                  </span>
                )}
              </button>
              {hasDescription && isExpanded && (
                <div className="text-subtle ml-6 mt-1 whitespace-pre-wrap">
                  {rule.description}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}


