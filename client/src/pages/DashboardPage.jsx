import React, { useEffect, useState } from 'react';
import {
  Users,
  Mail,
  Award,
  AlertCircle,
  Search,
  ArrowRight,
  RefreshCw,
  Globe,
  Sliders,
  CheckCircle2,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { MetricCard } from '../components/MetricCard.jsx';
import { PriorityBadge } from '../components/PriorityBadge.jsx';
import { OutreachBadge } from '../components/OutreachBadge.jsx';
import { api } from '../lib/api.js';
import { formatDate, formatDateTime } from '../lib/utils.js';

export function DashboardPage({ onNavigate, onSelectLead, onOpenSettings }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getDashboard();
      setData(res);
    } catch (err) {
      setError(err.message || 'Failed to load dashboard metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-ink-muted">
        <RefreshCw className="w-6 h-6 animate-spin text-forest mb-2" />
        <p className="text-xs">Loading database metrics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="p-4 rounded bg-danger-light border border-danger-border text-danger flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-xs font-bold">Failed to load overview</h3>
            <p className="text-xs mt-1">{error}</p>
            <button
              onClick={fetchDashboard}
              className="mt-2 px-2.5 py-1 bg-danger text-white rounded text-xs font-medium"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { metrics, hasConfiguredSettings, latestJob, recentJobs, topLeads } = data;

  // Determine dynamic recommended next step
  let recommendation = null;
  if (metrics.totalLeads === 0) {
    recommendation = {
      title: 'Collect your first company websites',
      description: 'Start by pasting up to 20 company URLs or uploading a CSV file to extract public contact details.',
      actionLabel: 'Collect leads',
      action: () => onNavigate('collect'),
      icon: Search,
    };
  } else if (!hasConfiguredSettings) {
    recommendation = {
      title: 'Define your target qualification criteria',
      description: 'Set your target industry, target location, and preferred keywords to automatically rank your leads.',
      actionLabel: 'Configure criteria',
      action: onOpenSettings,
      icon: Sliders,
    };
  } else if (latestJob && latestJob.failedCount > 0) {
    recommendation = {
      title: `Review ${latestJob.failedCount} failed website sources`,
      description: 'Your recent collection job had some inaccessible or blocked sites. Inspect the failure reasons or retry.',
      actionLabel: 'Review collection',
      action: () => onNavigate('collect'),
      icon: AlertCircle,
    };
  } else if (metrics.highPriorityLeads > 0) {
    recommendation = {
      title: `${metrics.highPriorityLeads} high-priority leads ready for outreach`,
      description: 'Review qualified companies matching your target criteria with public contact information available.',
      actionLabel: 'View top leads',
      action: () => onNavigate('leads'),
      icon: Award,
    };
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      {/* Dynamic Recommendation Banner */}
      {recommendation && (
        <div className="bg-surface rounded-lg border border-forest-border p-4 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-0.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-forest">
              Recommended Next Step
            </div>
            <h2 className="text-sm font-bold text-ink">{recommendation.title}</h2>
            <p className="text-xs text-ink-secondary">{recommendation.description}</p>
          </div>
          <button
            onClick={recommendation.action}
            className="px-3.5 py-1.5 bg-forest hover:bg-forest-hover text-white text-xs font-semibold rounded shadow-2xs flex items-center gap-1.5 shrink-0 transition-colors"
          >
            <span>{recommendation.actionLabel}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <MetricCard
          title="Total saved leads"
          value={metrics.totalLeads}
          subtitle="Unique domains in database"
        />
        <MetricCard
          title="High priority leads"
          value={metrics.highPriorityLeads}
          subtitle="Score &ge; 75/100"
          tag="Top fit"
        />
        <MetricCard
          title="Leads with public email"
          value={metrics.leadsWithEmail}
          subtitle={
            metrics.totalLeads > 0
              ? `${Math.round((metrics.leadsWithEmail / metrics.totalLeads) * 100)}% contact rate`
              : 'No leads collected'
          }
        />
        <MetricCard
          title="Missing contact details"
          value={metrics.leadsMissingContact}
          subtitle="No email or phone found"
        />
      </div>

      {/* Main Grid: Top Leads & Recent Jobs */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Top-Ranked Leads List (7 cols) */}
        <div className="lg:col-span-7 bg-surface rounded-lg border border-border shadow-2xs flex flex-col">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="font-bold text-xs text-ink uppercase tracking-wider">
                Top-Ranked Leads
              </h3>
              <p className="text-[11px] text-ink-muted">Prioritized by target fit and contact availability</p>
            </div>
            <button
              onClick={() => onNavigate('leads')}
              className="text-xs font-semibold text-forest hover:underline flex items-center gap-1"
            >
              View directory <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="divide-y divide-border/60 flex-1">
            {topLeads && topLeads.length > 0 ? (
              topLeads.map((lead) => (
                <div
                  key={lead._id}
                  onClick={() => onSelectLead(lead)}
                  className="p-3 hover:bg-surface-subtle transition-colors flex items-center justify-between gap-3 cursor-pointer"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-xs text-ink truncate">
                        {lead.companyName}
                      </span>
                      {lead.isDemo && (
                        <span className="text-[9px] bg-stone-100 text-ink-muted px-1 py-0.2 rounded border border-border">
                          Demo
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-ink-muted">
                      <span className="font-mono truncate">{lead.normalizedDomain}</span>
                      <span>•</span>
                      <span className="truncate">{lead.industry || 'Unknown'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <OutreachBadge status={lead.outreachStatus} />
                    <PriorityBadge
                      score={lead.score}
                      priorityBand={lead.scoreBreakdown?.priorityBand}
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-ink-muted text-xs">
                No saved leads. Use the Collect workflow to add company websites.
              </div>
            )}
          </div>
        </div>

        {/* Recent Scraping Jobs (5 cols) */}
        <div className="lg:col-span-5 bg-surface rounded-lg border border-border shadow-2xs flex flex-col">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="font-bold text-xs text-ink uppercase tracking-wider">
                Recent Collection Jobs
              </h3>
              <p className="text-[11px] text-ink-muted">Execution history and worker status</p>
            </div>
          </div>

          <div className="divide-y divide-border/60 flex-1">
            {recentJobs && recentJobs.length > 0 ? (
              recentJobs.map((job) => (
                <div key={job._id} className="p-3 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-ink text-[11px]">
                      {job.inputUrls?.length || 0} websites ({job.mode || 'live'})
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                        job.status === 'completed'
                          ? 'bg-forest-light text-forest border-forest-border'
                          : job.status === 'running'
                          ? 'bg-sky-50 text-sky-800 border-sky-200 animate-pulse'
                          : job.status === 'interrupted'
                          ? 'bg-warning-light text-warning border-warning-border'
                          : 'bg-danger-light text-danger border-danger-border'
                      }`}
                    >
                      {job.status}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-ink-secondary">
                    <span>
                      {job.successfulCount} collected, {job.failedCount} failed
                    </span>
                    <span className="text-ink-muted">
                      {formatDate(job.createdAt)}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-ink-muted text-xs">
                No collection runs recorded yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
