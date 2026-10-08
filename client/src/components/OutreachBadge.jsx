import React from 'react';

export function OutreachBadge({ status }) {
  const config = {
    new: {
      bg: 'bg-stone-100 text-ink-secondary border-border',
      label: 'New',
    },
    shortlisted: {
      bg: 'bg-forest-light text-forest border-forest-border',
      label: 'Shortlisted',
    },
    contacted: {
      bg: 'bg-sky-50 text-sky-800 border-sky-200',
      label: 'Contacted',
    },
    'not-relevant': {
      bg: 'bg-stone-100 text-ink-muted border-border line-through opacity-70',
      label: 'Not relevant',
    },
  };

  const style = config[status] || config.new;

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${style.bg}`}
    >
      {style.label}
    </span>
  );
}
