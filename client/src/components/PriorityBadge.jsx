import React from 'react';

export function PriorityBadge({ score, priorityBand }) {
  const band = priorityBand || (score >= 75 ? 'high' : score >= 40 ? 'medium' : 'low');

  const config = {
    high: {
      bg: 'bg-forest-light text-forest border-forest-border',
      dot: 'bg-forest',
      label: 'High fit',
    },
    medium: {
      bg: 'bg-warning-light text-warning border-warning-border',
      dot: 'bg-warning',
      label: 'Medium fit',
    },
    low: {
      bg: 'bg-stone-100 text-ink-secondary border-border',
      dot: 'bg-ink-muted',
      label: 'Low fit',
    },
  };

  const style = config[band] || config.low;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium border ${style.bg}`}
      title={`Score: ${score}/100 (${style.label})`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} aria-hidden="true" />
      <span className="font-mono font-semibold">{score}</span>
      <span className="text-[11px] opacity-70">/100</span>
    </span>
  );
}
