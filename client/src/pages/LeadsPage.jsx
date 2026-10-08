import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Download,
  Sliders,
  RotateCcw,
  Eye,
  Trash2,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  Square,
  Copy,
  Check,
} from 'lucide-react';
import { PriorityBadge } from '../components/PriorityBadge.jsx';
import { api } from '../lib/api.js';
import { formatDate } from '../lib/utils.js';

export function LeadsPage({ onSelectLead, onOpenSettings }) {
  const [leads, setLeads] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [facets, setFacets] = useState({ industries: [], locations: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copiedEmail, setCopiedEmail] = useState(null);

  // Search input with 300ms debounce
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Filters state
  const [quickFilter, setQuickFilter] = useState('all');
  const [industry, setIndustry] = useState('');
  const [location, setLocation] = useState('');
  const [minScore, setMinScore] = useState(0);
  const [outreachStatus, setOutreachStatus] = useState('all');
  const [isDemo, setIsDemo] = useState('all');
  const [sortBy, setSortBy] = useState('score');
  const [sortOrder, setSortOrder] = useState('desc');
  const [page, setPage] = useState(1);

  // Selection state
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isExporting, setIsExporting] = useState(false);

  // Debounce search input by 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Fetch leads with AbortController for cancelation of stale queries
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    api
      .getLeads(
        {
          search: debouncedSearch,
          quickFilter,
          industry,
          location,
          minScore: quickFilter === 'all' && minScore > 0 ? minScore : undefined,
          outreachStatus,
          isDemo,
          sortBy,
          sortOrder,
          page,
          limit: 10,
        },
        { signal: controller.signal }
      )
      .then((res) => {
        setLeads(res.leads || []);
        setPagination(res.pagination || { page: 1, limit: 10, total: 0, totalPages: 1 });
        if (res.facets) setFacets(res.facets);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name === 'AbortError') {
          // Ignore cancelled requests
          return;
        }
        setError(err.message || 'Failed to fetch leads');
        setLoading(false);
      });

    return () => controller.abort();
  }, [debouncedSearch, quickFilter, industry, location, minScore, outreachStatus, isDemo, sortBy, sortOrder, page]);

  const handleResetFilters = () => {
    setSearchInput('');
    setDebouncedSearch('');
    setQuickFilter('all');
    setIndustry('');
    setLocation('');
    setMinScore(0);
    setOutreachStatus('all');
    setIsDemo('all');
    setSortBy('score');
    setSortOrder('desc');
    setPage(1);
    setSelectedIds(new Set());
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.size === leads.length && leads.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(leads.map((l) => l._id)));
    }
  };

  const handleToggleRow = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleExportSelected = async () => {
    if (selectedIds.size === 0) return;
    setIsExporting(true);
    try {
      await api.exportLeads({ leadIds: Array.from(selectedIds) });
    } catch (err) {
      alert(`Export failed: ${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportFiltered = async () => {
    setIsExporting(true);
    try {
      await api.exportLeads({
        filters: {
          search: debouncedSearch,
          quickFilter,
          industry,
          location,
          minScore: minScore > 0 ? minScore : undefined,
          outreachStatus,
          isDemo,
        },
      });
    } catch (err) {
      alert(`Export failed: ${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleUpdateStatus = async (leadId, newStatus) => {
    try {
      await api.updateLead(leadId, { outreachStatus: newStatus });
      setLeads((prev) =>
        prev.map((l) => (l._id === leadId ? { ...l, outreachStatus: newStatus } : l))
      );
    } catch (err) {
      alert(`Failed to update status: ${err.message}`);
    }
  };

  const handleDeleteLead = async (leadId) => {
    if (!window.confirm('Delete this company lead from your database?')) return;
    try {
      await api.deleteLead(leadId);
      setLeads((prev) => prev.filter((l) => l._id !== leadId));
      setPagination((prev) => ({ ...prev, total: Math.max(0, prev.total - 1) }));
    } catch (err) {
      alert(`Failed to delete lead: ${err.message}`);
    }
  };

  const handleCopyEmail = (email, id) => {
    navigator.clipboard.writeText(email);
    setCopiedEmail(id);
    setTimeout(() => setCopiedEmail(null), 1500);
  };

  const isAllSelected = leads.length > 0 && selectedIds.size === leads.length;

  const hasActiveFilters =
    searchInput.trim().length > 0 ||
    quickFilter !== 'all' ||
    industry !== '' ||
    location !== '' ||
    minScore > 0 ||
    outreachStatus !== 'all' ||
    isDemo !== 'all';

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4">
      {/* Top Header & Export Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-border pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-ink tracking-tight">
              Lead Qualification Directory
            </h2>
            <span className="text-xs text-ink-muted font-mono">
              ({pagination.total} {pagination.total === 1 ? 'lead' : 'leads'})
            </span>
          </div>
          <p className="text-xs text-ink-secondary">
            Prioritized by target criteria fit, keyword alignment, and verified public contact presence.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={onOpenSettings}
            className="px-2.5 py-1.5 bg-surface hover:bg-stone-100 border border-border rounded text-xs font-semibold text-ink flex items-center gap-1.5 shadow-2xs transition-colors"
          >
            <Sliders className="w-3.5 h-3.5 text-forest" />
            <span>Target criteria</span>
          </button>

          <button
            onClick={handleExportSelected}
            disabled={selectedIds.size === 0 || isExporting}
            className="px-3 py-1.5 bg-surface hover:bg-stone-100 border border-border rounded text-xs font-semibold text-ink flex items-center gap-1.5 disabled:opacity-50 shadow-2xs transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-ink-secondary" />
            <span>Export selected ({selectedIds.size})</span>
          </button>

          <button
            onClick={handleExportFiltered}
            disabled={pagination.total === 0 || isExporting}
            className="px-3.5 py-1.5 bg-forest hover:bg-forest-hover text-white rounded text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50 shadow-2xs transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export filtered ({pagination.total})</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-surface rounded-lg border border-border p-3.5 shadow-2xs space-y-3">
        {/* Quick Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-border">
          <span className="text-xs font-semibold text-ink-muted uppercase mr-1">Filter:</span>
          {[
            { id: 'all', label: 'All leads' },
            { id: 'high-priority', label: 'High priority (75+ pts)' },
            { id: 'has-email', label: 'Has public email' },
            { id: 'missing-contact', label: 'Missing contact details' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setQuickFilter(tab.id);
                setPage(1);
              }}
              className={`px-2.5 py-1 rounded text-xs font-medium whitespace-nowrap transition-colors ${
                quickFilter === tab.id
                  ? 'bg-surface-selected text-forest font-semibold border border-forest-border'
                  : 'text-ink-secondary hover:text-ink hover:bg-surface-subtle'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Detailed Search & Facet Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 text-xs items-center">
          {/* Search Box (4 cols) with 300ms debounce */}
          <div className="lg:col-span-4 relative">
            <Search className="w-3.5 h-3.5 text-ink-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search companies, domains, emails..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full text-xs pl-8 pr-3 py-1.5 bg-surface-subtle border border-border rounded focus:border-forest"
            />
          </div>

          {/* Industry Facet (2 cols) */}
          <div className="lg:col-span-2">
            <select
              value={industry}
              onChange={(e) => {
                setIndustry(e.target.value);
                setPage(1);
              }}
              className="w-full text-xs py-1.5 px-2 bg-surface-subtle border border-border rounded focus:border-forest"
              aria-label="Filter by Industry"
            >
              <option value="">All industries</option>
              {facets.industries.map((ind, idx) => (
                <option key={idx} value={ind}>
                  {ind}
                </option>
              ))}
            </select>
          </div>

          {/* Location Facet (2 cols) */}
          <div className="lg:col-span-2">
            <select
              value={location}
              onChange={(e) => {
                setLocation(e.target.value);
                setPage(1);
              }}
              className="w-full text-xs py-1.5 px-2 bg-surface-subtle border border-border rounded focus:border-forest"
              aria-label="Filter by Location"
            >
              <option value="">All locations</option>
              {facets.locations.map((loc, idx) => (
                <option key={idx} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>

          {/* Outreach Status (2 cols) */}
          <div className="lg:col-span-2">
            <select
              value={outreachStatus}
              onChange={(e) => {
                setOutreachStatus(e.target.value);
                setPage(1);
              }}
              className="w-full text-xs py-1.5 px-2 bg-surface-subtle border border-border rounded focus:border-forest"
              aria-label="Filter by Outreach Status"
            >
              <option value="all">Status: All</option>
              <option value="new">New</option>
              <option value="shortlisted">Shortlisted</option>
              <option value="contacted">Contacted</option>
              <option value="not-relevant">Not relevant</option>
            </select>
          </div>

          {/* Sort & Reset (2 cols) */}
          <div className="lg:col-span-2 flex items-center gap-1.5">
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [sb, so] = e.target.value.split('-');
                setSortBy(sb);
                setSortOrder(so);
                setPage(1);
              }}
              className="w-full text-xs py-1.5 px-2 bg-surface-subtle border border-border rounded focus:border-forest"
              aria-label="Sort leads"
            >
              <option value="score-desc">Score: High &rarr; Low</option>
              <option value="score-asc">Score: Low &rarr; High</option>
              <option value="companyName-asc">Company: A &rarr; Z</option>
              <option value="lastScrapedAt-desc">Scraped: Newest</option>
            </select>

            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="p-1.5 text-xs text-ink-muted hover:text-ink hover:bg-stone-100 rounded border border-border shrink-0"
                title="Reset all filters"
                aria-label="Reset all filters"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Selected count banner */}
        {selectedIds.size > 0 && (
          <div className="pt-2 border-t border-border flex items-center justify-between text-xs text-ink-secondary">
            <span>
              <strong className="text-ink">{selectedIds.size}</strong> of {leads.length} leads selected on this page.
            </span>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-forest hover:underline font-semibold"
            >
              Clear selection
            </button>
          </div>
        )}
      </div>

      {/* Main Leads Table with Sticky Header */}
      <div className="bg-surface rounded-lg border border-border shadow-2xs overflow-hidden flex flex-col">
        <div className="overflow-x-auto custom-scrollbar max-h-[640px]">
          <table className="min-w-full divide-y divide-border text-left text-xs">
            <thead className="bg-surface-subtle font-semibold text-ink-secondary uppercase tracking-wider text-[11px] sticky top-0 z-10 shadow-xs border-b border-border">
              <tr>
                <th className="py-2.5 pl-3 pr-2 w-8 bg-surface-subtle">
                  <button
                    type="button"
                    onClick={handleToggleSelectAll}
                    className="text-ink-muted hover:text-ink"
                    aria-label="Select all rows"
                  >
                    {isAllSelected ? (
                      <CheckSquare className="w-4 h-4 text-forest" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="py-2.5 px-3 bg-surface-subtle">Company &amp; Website</th>
                <th className="py-2.5 px-3 bg-surface-subtle">Industry</th>
                <th className="py-2.5 px-3 bg-surface-subtle">Location</th>
                <th className="py-2.5 px-3 bg-surface-subtle">Public Contact</th>
                <th className="py-2.5 px-3 text-center bg-surface-subtle">Score</th>
                <th className="py-2.5 px-3 bg-surface-subtle">Outreach Status</th>
                <th className="py-2.5 px-3 bg-surface-subtle">Collected</th>
                <th className="py-2.5 pr-3 pl-2 text-right bg-surface-subtle">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 text-ink">
              {loading && leads.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-12 text-center text-ink-muted">
                    Loading qualified leads...
                  </td>
                </tr>
              ) : leads.length > 0 ? (
                leads.map((lead) => {
                  const isSelected = selectedIds.has(lead._id);
                  const hasEmail = lead.emails && lead.emails.length > 0;
                  const hasPhone = lead.phones && lead.phones.length > 0;

                  return (
                    <tr
                      key={lead._id}
                      className={`hover:bg-surface-subtle transition-colors ${
                        isSelected ? 'bg-surface-selected' : ''
                      }`}
                    >
                      <td className="py-2.5 pl-3 pr-2">
                        <button
                          type="button"
                          onClick={() => handleToggleRow(lead._id)}
                          className="text-ink-muted hover:text-ink"
                          aria-label={`Select ${lead.companyName}`}
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-forest" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>

                      {/* Company Name & Website */}
                      <td className="py-2.5 px-3 min-w-[170px]">
                        <div className="font-bold text-ink text-xs flex items-center gap-1.5">
                          <span>{lead.companyName}</span>
                          {lead.isDemo && (
                            <span className="text-[9px] bg-stone-100 text-ink-muted px-1 py-0.2 rounded border border-border">
                              Demo
                            </span>
                          )}
                        </div>
                        <a
                          href={lead.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-ink-muted hover:text-forest font-mono truncate block max-w-[160px]"
                        >
                          {lead.normalizedDomain}
                        </a>
                      </td>

                      {/* Industry */}
                      <td className="py-2.5 px-3 max-w-[140px] truncate">
                        <span className="text-xs text-ink font-medium">
                          {lead.industry || 'Unknown'}
                        </span>
                        <div className="text-[10px] text-ink-muted capitalize">
                          {lead.industrySource}
                        </div>
                      </td>

                      {/* Location */}
                      <td className="py-2.5 px-3 max-w-[130px] truncate">
                        <span className="text-xs text-ink">
                          {lead.location || 'Unknown'}
                        </span>
                      </td>

                      {/* Public Contact */}
                      <td className="py-2.5 px-3 min-w-[160px]">
                        {hasEmail ? (
                          <div className="flex items-center gap-1.5">
                            <a
                              href={`mailto:${lead.emails[0]}`}
                              className="font-mono text-[11px] text-forest hover:underline truncate max-w-[130px]"
                              title={lead.emails.join(', ')}
                            >
                              {lead.emails[0]}
                            </a>
                            <button
                              type="button"
                              onClick={() => handleCopyEmail(lead.emails[0], lead._id)}
                              className="text-ink-muted hover:text-ink p-0.5 rounded"
                              title="Copy email"
                            >
                              {copiedEmail === lead._id ? (
                                <Check className="w-3 h-3 text-forest" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        ) : hasPhone ? (
                          <span className="font-mono text-[11px] text-ink-secondary">
                            {lead.phones[0]}
                          </span>
                        ) : (
                          <span className="text-[11px] text-ink-muted italic">
                            No public email found
                          </span>
                        )}
                      </td>

                      {/* Score */}
                      <td className="py-2.5 px-3 text-center min-w-[100px]">
                        <PriorityBadge
                          score={lead.score}
                          priorityBand={lead.scoreBreakdown?.priorityBand}
                        />
                      </td>

                      {/* Outreach Status */}
                      <td className="py-2.5 px-3">
                        <select
                          value={lead.outreachStatus}
                          onChange={(e) => handleUpdateStatus(lead._id, e.target.value)}
                          className="text-[11px] font-medium bg-surface border border-border text-ink rounded px-2 py-0.5 cursor-pointer focus:border-forest"
                        >
                          <option value="new">New</option>
                          <option value="shortlisted">Shortlisted</option>
                          <option value="contacted">Contacted</option>
                          <option value="not-relevant">Not relevant</option>
                        </select>
                      </td>

                      {/* Collected Date */}
                      <td className="py-2.5 px-3 text-[11px] text-ink-muted font-mono whitespace-nowrap">
                        {formatDate(lead.lastScrapedAt || lead.createdAt)}
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 pr-3 pl-2 text-right space-x-1 whitespace-nowrap">
                        <button
                          onClick={() => onSelectLead(lead)}
                          className="p-1 rounded text-ink-secondary hover:text-forest hover:bg-surface-subtle"
                          title="Inspect Lead Details & Score Evidence"
                          aria-label={`Inspect ${lead.companyName}`}
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteLead(lead._id)}
                          className="p-1 rounded text-ink-muted hover:text-danger hover:bg-danger-light"
                          title="Delete Lead"
                          aria-label={`Delete ${lead.companyName}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                /* Distinct Contextual Empty States */
                <tr>
                  <td colSpan="9" className="py-12 text-center text-ink-muted">
                    <div className="max-w-xs mx-auto space-y-2">
                      <div className="font-semibold text-xs text-ink">
                        {quickFilter === 'high-priority'
                          ? 'No high-priority leads found'
                          : quickFilter === 'has-email'
                          ? 'No leads with public emails found'
                          : debouncedSearch.trim()
                          ? `No companies matching "${debouncedSearch}"`
                          : 'No saved leads in directory'}
                      </div>
                      <p className="text-[11px] text-ink-secondary">
                        {quickFilter === 'high-priority'
                          ? 'Try adjusting your target industry, location, or keyword rules.'
                          : quickFilter === 'has-email'
                          ? 'Collect additional website sources to discover public contact emails.'
                          : debouncedSearch.trim()
                          ? 'Try searching by a broader domain name or reset your filters.'
                          : 'Use the Collect workflow to scrape company websites or seed demo data.'}
                      </p>
                      {hasActiveFilters && (
                        <button
                          onClick={handleResetFilters}
                          className="mt-1 px-3 py-1 bg-surface-subtle hover:bg-stone-200 border border-border text-ink rounded text-xs font-semibold"
                        >
                          Reset filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-4 py-3 bg-surface-subtle border-t border-border flex items-center justify-between text-xs text-ink-secondary">
          <div>
            Showing{' '}
            <span className="font-mono font-bold text-ink">
              {leads.length > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0}
            </span>{' '}
            to{' '}
            <span className="font-mono font-bold text-ink">
              {Math.min(pagination.page * pagination.limit, pagination.total)}
            </span>{' '}
            of <span className="font-mono font-bold text-ink">{pagination.total}</span> leads
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={pagination.page <= 1}
              className="p-1 rounded border border-border bg-surface hover:bg-stone-100 disabled:opacity-40"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono px-2 text-[11px]">
              {pagination.page} / {pagination.totalPages || 1}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={pagination.page >= pagination.totalPages}
              className="p-1 rounded border border-border bg-surface hover:bg-stone-100 disabled:opacity-40"
              aria-label="Next page"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
