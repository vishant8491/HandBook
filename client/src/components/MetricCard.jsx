import React from 'react';

export function MetricCard({ title, value, subtitle, tag }) {
  return (
    <div className="bg-surface rounded-lg border border-border p-4 shadow-2xs">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-ink-secondary">{title}</span>
        {tag && (
          <span className="text-[11px] font-medium text-forest bg-forest-light px-1.5 py-0.5 rounded border border-forest-border">
            {tag}
          </span>
        )}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-bold tracking-tight text-ink font-mono">{value}</span>
      </div>
      {subtitle && <p className="mt-1 text-xs text-ink-muted">{subtitle}</p>}
    </div>
  );
}
