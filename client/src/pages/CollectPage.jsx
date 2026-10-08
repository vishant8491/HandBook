import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import {
  Search,
  Upload,
  AlertCircle,
  CheckCircle2,
  RotateCcw,
  Globe,
  ExternalLink,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { api } from '../lib/api.js';
import { sanitizeUrl, normalizeDomain } from '../utils/url.js';

export function CollectPage({ onNavigate, onSelectLead }) {
  const [urlInput, setUrlInput] = useState('');
  const [collectionMode, setCollectionMode] = useState('live');
  const [isParsingCsv, setIsParsingCsv] = useState(false);
  const [activeJob, setActiveJob] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Preview state
  const [preview, setPreview] = useState({
    valid: [],
    duplicates: [],
    invalid: [],
  });

  const SAMPLE_LIVE_URLS = [
    'https://stripe.com',
    'https://github.com',
    'https://vercel.com',
  ].join('\n');

  const SAMPLE_FIXTURE_URLS = [
    'https://acmecloud.example',
    'https://medipulse.example',
    'https://finscale.example',
    'https://novalogistics.example',
    'https://shoppulse.example',
  ].join('\n');

  useEffect(() => {
    const rawLines = urlInput
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    const valid = [];
    const duplicates = [];
    const invalid = [];
    const seenDomains = new Set();

    rawLines.forEach((line) => {
      const sanitized = sanitizeUrl(line);
      const domain = normalizeDomain(line);

      if (!sanitized || !domain) {
        invalid.push({ raw: line, reason: 'Invalid URL structure, non-http protocol, or restricted port' });
      } else if (seenDomains.has(domain)) {
        duplicates.push({ raw: line, domain, reason: 'Duplicate domain in input batch' });
      } else {
        seenDomains.add(domain);
        valid.push({ raw: line, sanitized, domain });
      }
    });

    setPreview({ valid, duplicates, invalid });
  }, [urlInput]);

  // Polling for active job execution with overlap protection & clean termination
  useEffect(() => {
    if (!activeJob || activeJob.status === 'completed' || activeJob.status === 'failed' || activeJob.status === 'interrupted') {
      return;
    }

    let isMounted = true;
    let isPolling = false;

    const interval = setInterval(async () => {
      if (isPolling) return;
      isPolling = true;
      try {
        const res = await api.getCollectionJobById(activeJob._id);
        if (isMounted) {
          setActiveJob(res.job);
        }
      } catch (err) {
        console.error('Failed to poll job status:', err);
      } finally {
        isPolling = false;
      }
    }, 1500);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [activeJob]);

  const handleStartCollection = async () => {
    if (preview.valid.length === 0) {
      setErrorMsg('Please supply at least 1 valid public company website URL.');
      return;
    }

    if (preview.valid.length > 20) {
      setErrorMsg('A maximum of 20 websites are permitted per collection batch.');
      return;
    }

    setErrorMsg('');
    setIsSubmitting(true);

    try {
      const targetUrls = preview.valid.map((v) => v.sanitized);
      const res = await api.createCollectionJob(targetUrls, collectionMode);
      setActiveJob(res.job);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to start collection job');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCsvUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsingCsv(true);
    setErrorMsg('');

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setIsParsingCsv(false);
        if (!results.data || results.data.length === 0) {
          setErrorMsg('Uploaded CSV file contains no data rows.');
          return;
        }

        const firstRow = results.data[0];
        const websiteKey = Object.keys(firstRow).find((k) =>
          /^(website|url|domain|company_url|web)$/i.test(k.trim())
        );

        if (!websiteKey) {
          setErrorMsg(
            `Missing "website" column in CSV header. Found: [${Object.keys(firstRow).join(', ')}]`
          );
          return;
        }

        const urls = results.data
          .map((row) => (row[websiteKey] || '').trim())
          .filter(Boolean);

        setUrlInput(urls.slice(0, 20).join('\n'));
      },
      error: (err) => {
        setIsParsingCsv(false);
        setErrorMsg(`CSV parsing error: ${err.message}`);
      },
    });
  };

  const handleRetryFailed = () => {
    if (!activeJob || !activeJob.results) return;
    const failedUrls = activeJob.results
      .filter((r) => r.status === 'failed')
      .map((r) => r.inputUrl);

    if (failedUrls.length === 0) return;

    setUrlInput(failedUrls.join('\n'));
    setActiveJob(null);
  };

  const progressPercent = activeJob && activeJob.totalCount > 0
    ? Math.round((activeJob.processedCount / activeJob.totalCount) * 100)
    : 0;

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      {/* Top Header & Mode Toggle */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h2 className="text-base font-bold text-ink tracking-tight">
            Collect &amp; Clean Business Leads
          </h2>
          <p className="text-xs text-ink-secondary">
            Supply up to 20 company URLs to extract contact details, metadata, and qualification signals.
          </p>
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-stone-200/60 rounded text-xs font-medium">
          <button
            type="button"
            onClick={() => {
              setCollectionMode('live');
              setUrlInput(SAMPLE_LIVE_URLS);
            }}
            className={`px-2.5 py-1 rounded transition-colors ${
              collectionMode === 'live'
                ? 'bg-surface text-ink font-semibold shadow-2xs'
                : 'text-ink-secondary hover:text-ink'
            }`}
          >
            Live Scraper
          </button>
          <button
            type="button"
            onClick={() => {
              setCollectionMode('fixture');
              setUrlInput(SAMPLE_FIXTURE_URLS);
            }}
            className={`px-2.5 py-1 rounded transition-colors ${
              collectionMode === 'fixture'
                ? 'bg-surface text-ink font-semibold shadow-2xs'
                : 'text-ink-secondary hover:text-ink'
            }`}
          >
            Fixture Mode (Offline Demo)
          </button>
        </div>
      </div>

      {/* Workflow Layout: Left Form vs Right Execution Status */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Step 1 & Step 2: Input & Review (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-surface rounded-lg border border-border p-4 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <label htmlFor="url-input" className="text-xs font-bold text-ink uppercase tracking-wider">
                Step 1: Add Company Website URLs
              </label>
              <button
                type="button"
                onClick={() =>
                  setUrlInput(collectionMode === 'fixture' ? SAMPLE_FIXTURE_URLS : SAMPLE_LIVE_URLS)
                }
                className="text-xs font-semibold text-forest hover:underline"
              >
                Load sample websites
              </button>
            </div>

            <textarea
              id="url-input"
              rows={5}
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://company1.com&#10;https://company2.org&#10;domain3.com"
              className="w-full text-xs font-mono p-3 bg-surface-subtle border border-border rounded focus:border-forest placeholder:text-ink-muted"
            />

            {/* CSV Alternative */}
            <div className="flex items-center justify-between p-3 bg-surface-subtle border border-dashed border-border rounded">
              <div className="flex items-center gap-2 text-xs">
                <Upload className="w-4 h-4 text-forest" />
                <div>
                  <span className="font-semibold text-ink">Or upload CSV list</span>
                  <span className="text-[11px] text-ink-muted block">Must have a "website" header column</span>
                </div>
              </div>

              <label className="px-2.5 py-1 bg-surface hover:bg-stone-100 text-ink text-xs font-medium rounded border border-border cursor-pointer shadow-2xs">
                {isParsingCsv ? 'Parsing...' : 'Select CSV'}
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleCsvUpload}
                  disabled={isParsingCsv}
                />
              </label>
            </div>

            {/* Step 2: Input Review */}
            <div className="space-y-2 pt-2 border-t border-border">
              <div className="text-xs font-bold text-ink uppercase tracking-wider">
                Step 2: Review Inputs
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2.5 rounded bg-forest-light border border-forest-border text-forest">
                  <div className="text-lg font-bold font-mono">{preview.valid.length}</div>
                  <div className="text-[11px] font-medium">Valid websites</div>
                </div>
                <div className="p-2.5 rounded bg-warning-light border border-warning-border text-warning">
                  <div className="text-lg font-bold font-mono">{preview.duplicates.length}</div>
                  <div className="text-[11px] font-medium">Duplicate inputs</div>
                </div>
                <div className="p-2.5 rounded bg-danger-light border border-danger-border text-danger">
                  <div className="text-lg font-bold font-mono">{preview.invalid.length}</div>
                  <div className="text-[11px] font-medium">Invalid rows</div>
                </div>
              </div>

              {preview.invalid.length > 0 && (
                <div className="p-2.5 rounded bg-danger-light border border-danger-border text-danger text-xs space-y-1">
                  <span className="font-semibold block">Invalid row reasons:</span>
                  {preview.invalid.map((item, idx) => (
                    <div key={idx} className="text-[11px] font-mono truncate">
                      • {item.raw}: {item.reason}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {errorMsg && (
              <div className="p-2.5 rounded bg-danger-light border border-danger-border text-danger text-xs flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Start CTA */}
            <button
              onClick={handleStartCollection}
              disabled={isSubmitting || preview.valid.length === 0 || (activeJob && activeJob.status === 'running')}
              className="w-full py-2 bg-forest hover:bg-forest-hover disabled:opacity-50 text-white font-semibold text-xs rounded shadow-2xs flex items-center justify-center gap-2 transition-colors"
            >
              {isSubmitting ? (
                <span>Starting collection...</span>
              ) : activeJob && activeJob.status === 'running' ? (
                <span>Collection currently running...</span>
              ) : (
                <>
                  <Search className="w-3.5 h-3.5" />
                  <span>Start Collection Job ({preview.valid.length} websites)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Step 3 & Step 4: Execution Stream & Results (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-surface rounded-lg border border-border p-4 shadow-2xs flex flex-col min-h-[420px]">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="text-xs font-bold text-ink uppercase tracking-wider">
                Step 3 &amp; 4: Collection Progress
              </h3>
              {activeJob && (
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                    activeJob.status === 'completed'
                      ? 'bg-forest-light text-forest border-forest-border'
                      : activeJob.status === 'running'
                      ? 'bg-sky-50 text-sky-800 border-sky-200 animate-pulse'
                      : 'bg-stone-100 text-ink-secondary border-border'
                  }`}
                >
                  {activeJob.status}
                </span>
              )}
            </div>

            {activeJob ? (
              <div className="flex-1 flex flex-col space-y-3 pt-3">
                {/* Progress bar */}
                <div>
                  <div className="flex justify-between text-xs font-mono text-ink-secondary mb-1">
                    <span>
                      {activeJob.processedCount} / {activeJob.totalCount} processed
                    </span>
                    <span>{progressPercent}%</span>
                  </div>
                  <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden border border-border">
                    <div
                      className={`h-full transition-all duration-300 ${
                        activeJob.status === 'completed' ? 'bg-forest' : 'bg-forest'
                      }`}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>

                {/* Per-URL Result Stream */}
                <div className="flex-1 overflow-y-auto max-h-[260px] divide-y divide-border/60 border border-border rounded bg-surface-subtle">
                  {activeJob.results && activeJob.results.length > 0 ? (
                    activeJob.results.map((res, idx) => (
                      <div key={idx} className="p-2.5 text-xs flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-semibold text-ink truncate font-mono text-[11px]">
                            {res.companyName || res.normalizedDomain || res.inputUrl}
                          </div>
                          {res.errorReason ? (
                            <div className="text-[10px] text-danger truncate">{res.errorReason}</div>
                          ) : (
                            <div className="text-[10px] text-ink-muted">
                              {res.fromCache ? 'Served from 24h cache' : res.durationMs ? `${res.durationMs}ms` : 'Queued'}
                            </div>
                          )}
                        </div>

                        <div>
                          {res.status === 'success' || res.status === 'cached' ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-forest-light text-forest border border-forest-border">
                              <CheckCircle2 className="w-3 h-3" /> {res.fromCache ? 'CACHED' : 'SAVED'}
                            </span>
                          ) : res.status === 'processing' ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-sky-50 text-sky-800 border border-sky-200 animate-pulse">
                              SCRAPING
                            </span>
                          ) : res.status === 'failed' ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-danger-light text-danger border border-danger-border">
                              FAILED
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] text-ink-muted bg-stone-100 border border-border">
                              QUEUED
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  ) : null}
                </div>

                {/* Step 4 Results Summary & Actions */}
                {activeJob.status === 'completed' && (
                  <div className="pt-2 border-t border-border space-y-2">
                    <div className="p-2.5 rounded bg-surface border border-border text-xs text-ink-secondary">
                      <strong className="text-ink">
                        {activeJob.successfulCount} company leads saved.
                      </strong>{' '}
                      {activeJob.failedCount > 0 && (
                        <span className="text-danger">
                          {activeJob.failedCount} website(s) failed collection.
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      {activeJob.failedCount > 0 && (
                        <button
                          onClick={handleRetryFailed}
                          className="px-2.5 py-1 text-xs font-medium text-danger bg-danger-light border border-danger-border rounded hover:bg-red-100 flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3" /> Retry failed ({activeJob.failedCount})
                        </button>
                      )}
                      <button
                        onClick={() => onNavigate('leads')}
                        className="ml-auto px-3 py-1 bg-forest hover:bg-forest-hover text-white text-xs font-semibold rounded flex items-center gap-1 shadow-2xs"
                      >
                        <span>Open Leads directory</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-ink-muted space-y-2">
                <Globe className="w-8 h-8 text-ink-subtle" />
                <div className="text-xs font-semibold text-ink-secondary">No Active Collection Job</div>
                <p className="text-[11px] text-ink-muted max-w-xs">
                  Enter websites above and click Start Collection to monitor extraction in real time.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
