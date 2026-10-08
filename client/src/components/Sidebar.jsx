import React from 'react';
import {
  LayoutDashboard,
  Users,
  Search,
  Sliders,
  X,
  Compass,
} from 'lucide-react';

export function Sidebar({
  currentPage,
  onNavigate,
  isMobileOpen,
  onCloseMobile,
  onOpenSettings,
}) {
  const navItems = [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    { id: 'leads', label: 'Leads', icon: Users },
    { id: 'collect', label: 'Collect', icon: Search },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-xs lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-56 bg-surface text-ink flex flex-col border-r border-border transition-transform duration-200 lg:static lg:translate-x-0 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Primary Navigation"
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded bg-forest text-white flex items-center justify-center font-bold text-sm">
              L
            </div>
            <div>
              <div className="font-bold text-sm tracking-tight text-ink leading-none">
                LeadLens
              </div>
              <div className="text-[11px] text-ink-muted mt-0.5">
                Qualification Workbench
              </div>
            </div>
          </div>
          <button
            onClick={onCloseMobile}
            className="p-1 rounded text-ink-muted hover:text-ink lg:hidden"
            aria-label="Close navigation sidebar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <div className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
            Workflows
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onNavigate(item.id);
                  if (onCloseMobile) onCloseMobile();
                }}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-surface-selected text-forest font-semibold border border-forest-border'
                    : 'text-ink-secondary hover:bg-surface-subtle hover:text-ink'
                }`}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon className="w-4 h-4" aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Target Qualification Rules */}
        <div className="p-3 border-t border-border space-y-2">
          <button
            onClick={onOpenSettings}
            className="w-full flex items-center justify-between px-2.5 py-2 rounded text-xs font-medium text-ink-secondary bg-surface-subtle hover:bg-stone-100 hover:text-ink border border-border transition-colors"
          >
            <span className="flex items-center gap-2">
              <Sliders className="w-3.5 h-3.5 text-forest" aria-hidden="true" />
              Target Criteria
            </span>
            <span className="text-[10px] text-ink-muted font-mono">
              Edit
            </span>
          </button>

          <div className="p-2.5 rounded bg-surface-subtle border border-border text-[11px] text-ink-secondary leading-relaxed">
            <span className="font-semibold text-ink block mb-0.5">Sourcing Model</span>
            Deterministic 100-pt fit scoring with evidence provenance.
          </div>
        </div>
      </aside>
    </>
  );
}
