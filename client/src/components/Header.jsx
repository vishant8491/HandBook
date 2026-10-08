import React from 'react';
import { Menu, Plus } from 'lucide-react';

export function Header({ title, description, primaryAction, onOpenMobile }) {
  return (
    <header className="sticky top-0 z-30 bg-surface/95 backdrop-blur-xs border-b border-border px-4 sm:px-6 py-3.5 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobile}
          className="p-1.5 rounded text-ink-secondary hover:bg-surface-subtle lg:hidden"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-base font-bold tracking-tight text-ink">{title}</h1>
          {description && (
            <p className="text-xs text-ink-secondary hidden sm:block mt-0.5">{description}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {primaryAction && (
          <button
            onClick={primaryAction.onClick}
            className="px-3 py-1.5 bg-forest hover:bg-forest-hover text-white text-xs font-semibold rounded shadow-2xs flex items-center gap-1.5 transition-colors"
          >
            {primaryAction.icon || <Plus className="w-3.5 h-3.5" />}
            <span>{primaryAction.label}</span>
          </button>
        )}
      </div>
    </header>
  );
}
