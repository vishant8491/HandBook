import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  Globe,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  ExternalLink,
  Clock,
  Info,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Edit3,
  Sparkles,
  RefreshCw,
  Send,
  FileText,
  HelpCircle,
  ShieldAlert,
} from 'lucide-react';
import { PriorityBadge } from './PriorityBadge.jsx';
import { formatDateTime } from '../lib/utils.js';
import { api } from '../lib/api.js';

export function LeadDetailsDrawer({ lead, isOpen, onClose, onUpdateStatus, onSaveLeadEdit }) {
  const drawerRef = useRef(null);
  const [copiedItem, setCopiedItem] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    companyName: '',
    industry: '',
    location: '',
    description: '',
  });

  // AI Assistant State
  const [aiStatus, setAiStatus] = useState({ enabled: true, isConfigured: false, provider: 'gemini', model: 'gemini-3.8-flash' });
  const [activeAiTab, setActiveAiTab] = useState('summary'); // 'summary' | 'outreach'
  
  // Summary state
  const [summaryData, setSummaryData] = useState(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryError, setSummaryError] = useState(null);

  // Outreach draft state
  const [offeringDescription, setOfferingDescription] = useState('');
  const [senderName, setSenderName] = useState('');
  const [outreachData, setOutreachData] = useState(null);
  const [editableSubject, setEditableSubject] = useState('');
  const [editableBody, setEditableBody] = useState('');
  const [isDrafting, setIsDrafting] = useState(false);
  const [outreachError, setOutreachError] = useState(null);

  // Load AI status on mount
  useEffect(() => {
    let isMounted = true;
    api.getAiStatus()
      .then((status) => {
        if (isMounted) setAiStatus(status);
      })
      .catch(() => {
        if (isMounted) setAiStatus({ enabled: false, isConfigured: false });
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Sync lead state when opened
  useEffect(() => {
    if (lead) {
      setEditForm({
        companyName: lead.companyName || '',
        industry: lead.industry || '',
        location: lead.location || '',
        description: lead.description || '',
      });
      setIsEditing(false);
      setCopiedItem(null);
      setSummaryError(null);
      setOutreachError(null);

      // Hydrate existing AI research cache from lead document
      if (lead.aiResearch?.summary) {
        setSummaryData(lead.aiResearch.summary);
      } else {
        setSummaryData(null);
      }

      if (lead.aiResearch?.outreachDraft) {
        setOutreachData(lead.aiResearch.outreachDraft);
        setEditableSubject(lead.aiResearch.outreachDraft.subject || '');
        setEditableBody(lead.aiResearch.outreachDraft.bodyText || '');
        if (lead.aiResearch.outreachDraft.offeringUsed) {
          setOfferingDescription(lead.aiResearch.outreachDraft.offeringUsed);
        }
        if (lead.aiResearch.outreachDraft.senderNameUsed) {
          setSenderName(lead.aiResearch.outreachDraft.senderNameUsed);
        }
      } else {
        setOutreachData(null);
        setEditableSubject('');
        setEditableBody('');
      }
    }
  }, [lead]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Trap focus or focus container when opened
  useEffect(() => {
    if (isOpen && drawerRef.current) {
      drawerRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen || !lead) return null;

  const handleCopy = (text, label) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedItem(label);
    setTimeout(() => setCopiedItem(null), 1800);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (onSaveLeadEdit) {
      await onSaveLeadEdit(lead._id, editForm);
      setIsEditing(false);
    }
  };

  // AI Summary Handler
  const handleGenerateSummary = async (forceRegenerate = false) => {
    if (isSummarizing) return;
    setIsSummarizing(true);
    setSummaryError(null);
    try {
      const mock = !aiStatus.isConfigured;
      const res = await api.generateAiSummary(lead._id, forceRegenerate, mock);
      if (res.data) {
        setSummaryData(res.data);
      } else if (res.message) {
        setSummaryError(res.message);
      }
    } catch (err) {
      setSummaryError(err.message || 'Failed to generate AI company summary.');
    } finally {
      setIsSummarizing(false);
    }
  };

  // AI Outreach Draft Handler
  const handleGenerateOutreach = async (forceRegenerate = false) => {
    if (isDrafting) return;
    if (!offeringDescription.trim()) {
      setOutreachError('Please enter what you are offering before generating a cold outreach draft.');
      return;
    }
    setIsDrafting(true);
    setOutreachError(null);
    try {
      const mock = !aiStatus.isConfigured;
      const res = await api.generateAiOutreach(lead._id, {
        offeringDescription: offeringDescription.trim(),
        senderName: senderName.trim(),
        forceRegenerate,
        mock,
      });
      if (res.data) {
        setOutreachData(res.data);
        setEditableSubject(res.data.subject || '');
        setEditableBody(res.data.bodyText || '');
      } else if (res.message) {
        setOutreachError(res.message);
      }
    } catch (err) {
      setOutreachError(err.message || 'Failed to generate outreach email draft.');
    } finally {
      setIsDrafting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-ink/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-8 sm:pl-16">
        <div
          ref={drawerRef}
          tabIndex={-1}
          className="w-screen max-w-xl bg-surface shadow-2xl flex flex-col focus:outline-none border-l border-border"
        >
          {/* Header */}
          <div className="px-5 py-3.5 bg-surface-subtle border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <PriorityBadge
                score={lead.score}
                priorityBand={lead.scoreBreakdown?.priorityBand}
              />
              {lead.isDemo && (
                <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-amber-50 text-warning border border-warning-border rounded">
                  Demo fixture
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsEditing(!isEditing)}
                className="px-2 py-1 rounded text-xs font-medium text-ink-secondary hover:text-ink hover:bg-stone-200 transition-colors flex items-center gap-1"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>{isEditing ? 'Cancel edit' : 'Edit profile'}</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded text-ink-muted hover:text-ink hover:bg-stone-200 transition-colors"
                aria-label="Close details panel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            
            {/* SECTION 1: Company Overview */}
            {isEditing ? (
              <form onSubmit={handleSaveEdit} className="space-y-3 bg-surface-subtle p-3.5 rounded border border-border">
                <div className="flex items-center justify-between pb-1 border-b border-border">
                  <span className="text-xs font-semibold text-ink">Edit Company Details</span>
                  <span className="text-[11px] text-ink-muted">Manual overrides are audited in field evidence</span>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Company name</label>
                  <input
                    type="text"
                    value={editForm.companyName}
                    onChange={(e) => setEditForm({ ...editForm, companyName: e.target.value })}
                    className="w-full text-xs px-3 py-1.5 bg-surface border border-border rounded focus:border-forest"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-ink mb-1">Industry</label>
                    <input
                      type="text"
                      value={editForm.industry}
                      onChange={(e) => setEditForm({ ...editForm, industry: e.target.value })}
                      className="w-full text-xs px-3 py-1.5 bg-surface border border-border rounded focus:border-forest"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-ink mb-1">Location</label>
                    <input
                      type="text"
                      value={editForm.location}
                      onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                      className="w-full text-xs px-3 py-1.5 bg-surface border border-border rounded focus:border-forest"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Company Description</label>
                  <textarea
                    rows={3}
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    className="w-full text-xs px-3 py-1.5 bg-surface border border-border rounded focus:border-forest"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-2.5 py-1 text-xs text-ink-secondary hover:bg-stone-200 rounded"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1 text-xs font-semibold text-white bg-forest hover:bg-forest-hover rounded"
                  >
                    Save &amp; Recalculate
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 id="drawer-title" className="text-xl font-bold text-ink tracking-tight">
                      {lead.companyName}
                    </h2>
                    <div className="mt-1 flex items-center gap-2 text-xs text-forest font-medium">
                      <Globe className="w-3.5 h-3.5" />
                      <a
                        href={lead.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline inline-flex items-center gap-1 font-mono"
                      >
                        {lead.website}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                  <div className="text-right text-[11px] text-ink-muted">
                    <span className="font-mono">{lead.normalizedDomain}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded bg-surface border border-border flex items-center justify-between">
                    <span className="text-ink-secondary flex items-center gap-1.5">
                      <Briefcase className="w-3.5 h-3.5 text-ink-muted" /> Industry:
                    </span>
                    <span className="font-medium text-ink">{lead.industry || 'Unknown'}</span>
                  </div>
                  <div className="p-2.5 rounded bg-surface border border-border flex items-center justify-between">
                    <span className="text-ink-secondary flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-ink-muted" /> Location:
                    </span>
                    <span className="font-medium text-ink">{lead.location || 'Unknown'}</span>
                  </div>
                </div>

                {lead.description ? (
                  <div className="p-3 rounded border border-border bg-surface text-xs leading-relaxed text-ink-secondary">
                    <span className="font-semibold text-ink block mb-1">Company overview:</span>
                    {lead.description}
                  </div>
                ) : (
                  <div className="p-2.5 rounded bg-surface-subtle border border-dashed border-border text-xs text-ink-muted italic">
                    No public description found in meta tags or page body.
                  </div>
                )}
              </div>
            )}

            {/* SECTION 2: Public Contact Information */}
            <div className="space-y-2.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-muted flex items-center justify-between">
                <span>Public Contact Information</span>
                <span className="text-[10px] text-ink-muted normal-case font-normal">Directly extracted from public pages</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Emails */}
                <div className="p-3 rounded border border-border bg-surface space-y-1">
                  <div className="flex items-center justify-between text-xs font-semibold text-ink">
                    <span className="flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-forest" /> Public email(s)
                    </span>
                  </div>
                  {lead.emails && lead.emails.length > 0 ? (
                    <div className="space-y-1.5 pt-1">
                      {lead.emails.map((email, idx) => (
                        <div key={idx} className="flex items-center justify-between gap-2 text-xs">
                          <a
                            href={`mailto:${email}`}
                            className="font-mono text-forest hover:underline truncate"
                          >
                            {email}
                          </a>
                          <button
                            type="button"
                            onClick={() => handleCopy(email, `email-${idx}`)}
                            className="p-1 text-ink-muted hover:text-ink rounded transition-colors"
                            title="Copy email"
                          >
                            {copiedItem === `email-${idx}` ? (
                              <Check className="w-3.5 h-3.5 text-forest" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-ink-muted italic pt-1">No public email found</div>
                  )}
                </div>

                {/* Phones */}
                <div className="p-3 rounded border border-border bg-surface space-y-1">
                  <div className="flex items-center justify-between text-xs font-semibold text-ink">
                    <span className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-forest" /> Public phone(s)
                    </span>
                  </div>
                  {lead.phones && lead.phones.length > 0 ? (
                    <div className="space-y-1.5 pt-1">
                      {lead.phones.map((phone, idx) => (
                        <div key={idx} className="flex items-center justify-between gap-2 text-xs">
                          <a
                            href={`tel:${phone}`}
                            className="font-mono text-ink hover:underline truncate"
                          >
                            {phone}
                          </a>
                          <button
                            type="button"
                            onClick={() => handleCopy(phone, `phone-${idx}`)}
                            className="p-1 text-ink-muted hover:text-ink rounded transition-colors"
                            title="Copy phone"
                          >
                            {copiedItem === `phone-${idx}` ? (
                              <Check className="w-3.5 h-3.5 text-forest" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-ink-muted italic pt-1">No public phone found</div>
                  )}
                </div>
              </div>

              <div className="p-2.5 rounded bg-surface-subtle border border-border text-ink-secondary text-[11px] leading-relaxed flex items-start gap-2">
                <Info className="w-3.5 h-3.5 text-forest shrink-0 mt-0.5" />
                <span>
                  <strong>Verification notice:</strong> Emails are validated for syntax only. Mailbox inbox deliverability and bounce status are not tested.
                </span>
              </div>
            </div>

            {/* SECTION 3: Score Explanation */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  Score explanation (Why this lead ranks here)
                </h3>
                <span className="text-xs font-mono font-bold text-ink">
                  {lead.score} / 100 points
                </span>
              </div>

              <div className="space-y-2">
                {lead.scoreBreakdown?.criteria?.map((crit, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded border border-border bg-surface text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-medium text-ink">
                        {crit.matched ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-forest" />
                        ) : crit.applicable === 0 ? (
                          <Info className="w-3.5 h-3.5 text-ink-muted" />
                        ) : (
                          <AlertCircle className="w-3.5 h-3.5 text-ink-subtle" />
                        )}
                        <span>{crit.criterion}</span>
                      </div>
                      <span className="font-mono text-ink-secondary">
                        {crit.applicable > 0 ? `${crit.earned}/${crit.applicable}` : 'Excluded'}
                      </span>
                    </div>
                    <p className="text-[11px] text-ink-muted pl-5">
                      {crit.reason}
                    </p>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-ink-muted italic">
                Deterministic formula: score = round(earned / applicable &times; 100). AI assistant never alters lead rank.
              </p>
            </div>

            {/* SECTION 4: Source Evidence */}
            {lead.fieldEvidence && lead.fieldEvidence.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-muted flex items-center justify-between">
                  <span>Source evidence &amp; provenance</span>
                  <span className="text-[10px] text-ink-muted font-normal">Indexed for AI Grounding</span>
                </h3>
                <div className="bg-surface-subtle rounded border border-border p-2.5 text-xs space-y-2">
                  {lead.fieldEvidence.map((ev, idx) => (
                    <div
                      key={idx}
                      className="flex items-start justify-between gap-2 border-b border-border/50 pb-1.5 last:border-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono px-1 bg-surface rounded border border-border text-ink-muted">
                            source-{idx + 1}
                          </span>
                          <span className="font-semibold text-[10px] uppercase text-ink-secondary">
                            {ev.field}
                          </span>
                        </div>
                        <span className="text-[11px] text-ink truncate block mt-0.5">
                          {ev.rawValue}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono bg-surface px-1.5 py-0.5 rounded border border-border text-ink-muted shrink-0">
                        {ev.method}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SECTION 5: Research Assistant (AI) */}
            <div className="space-y-3 pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-forest" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-ink">
                    Research Assistant
                  </h3>
                </div>
                <span className="text-[10px] font-mono text-ink-muted bg-stone-100 px-1.5 py-0.5 rounded border border-border">
                  {aiStatus.model || 'gemini-3.8-flash'}
                </span>
              </div>

              {/* Unconfigured Alert */}
              {!aiStatus.isConfigured && (
                <div className="p-2.5 rounded bg-amber-50 border border-amber-200 text-[11px] text-amber-900 leading-relaxed flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Live AI is currently in demonstration mode:</span> Set <code className="font-mono bg-amber-100 px-1 rounded">GEMINI_API_KEY</code> in <code className="font-mono bg-amber-100 px-1 rounded">server/.env</code> to enable live provider generation. Test fixtures are available below.
                  </div>
                </div>
              )}

              {/* Subtabs for Summary vs Outreach */}
              <div className="flex items-center gap-2 border-b border-border pb-1">
                <button
                  type="button"
                  onClick={() => setActiveAiTab('summary')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-t flex items-center gap-1.5 transition-colors ${
                    activeAiTab === 'summary'
                      ? 'bg-forest text-white'
                      : 'text-ink-secondary hover:text-ink hover:bg-stone-200'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Company Summary</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveAiTab('outreach')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-t flex items-center gap-1.5 transition-colors ${
                    activeAiTab === 'outreach'
                      ? 'bg-forest text-white'
                      : 'text-ink-secondary hover:text-ink hover:bg-stone-200'
                  }`}
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Draft Outreach</span>
                </button>
              </div>

              {/* Tab 1: Company Summary */}
              {activeAiTab === 'summary' && (
                <div className="space-y-3 bg-surface p-3.5 rounded border border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-ink-secondary">
                      Strictly grounded summary (&le; 80 words) and factual observations.
                    </span>
                    <button
                      type="button"
                      disabled={isSummarizing}
                      onClick={() => handleGenerateSummary(Boolean(summaryData))}
                      className="px-3 py-1.5 text-xs font-semibold rounded bg-forest text-white hover:bg-forest-hover disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
                    >
                      {isSummarizing ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5" />
                      )}
                      <span>{summaryData ? 'Regenerate summary' : 'Summarize company'}</span>
                    </button>
                  </div>

                  {summaryError && (
                    <div className="p-2.5 rounded bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <span>{summaryError}</span>
                    </div>
                  )}

                  {summaryData ? (
                    <div className="space-y-3 pt-2">
                      {/* Summary Text */}
                      <div className="p-3 bg-surface-subtle rounded border border-border text-xs leading-relaxed text-ink relative">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-semibold text-ink-secondary text-[11px] uppercase tracking-wider">
                            Executive Summary
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopy(summaryData.summaryText, 'ai-summary')}
                            className="text-ink-muted hover:text-ink p-1 rounded transition-colors flex items-center gap-1 text-[11px]"
                            title="Copy summary"
                          >
                            {copiedItem === 'ai-summary' ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-forest" />
                                <span className="text-forest font-medium">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                        <p>{summaryData.summaryText}</p>
                      </div>

                      {/* Observations */}
                      {summaryData.keyObservations?.length > 0 && (
                        <div className="space-y-1.5">
                          <span className="text-[11px] font-semibold text-ink uppercase tracking-wider block">
                            Key Observations
                          </span>
                          <ul className="space-y-1 text-xs text-ink-secondary list-disc pl-4">
                            {summaryData.keyObservations.map((obs, idx) => (
                              <li key={idx} className="leading-normal">{obs}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Missing Information */}
                      {summaryData.missingInformation?.length > 0 && (
                        <div className="p-2.5 rounded bg-amber-50/60 border border-amber-200 text-xs text-amber-900 space-y-1">
                          <span className="font-semibold flex items-center gap-1 text-[11px]">
                            <HelpCircle className="w-3.5 h-3.5 text-amber-700" /> Missing Information for Complete Assessment
                          </span>
                          <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                            {summaryData.missingInformation.map((item, idx) => (
                              <li key={idx}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Source references */}
                      {summaryData.referencedSourceIds?.length > 0 && (
                        <div className="flex items-center gap-1.5 text-[11px] text-ink-muted">
                          <span>Grounding sources:</span>
                          {summaryData.referencedSourceIds.map((id) => (
                            <span key={id} className="font-mono bg-stone-100 px-1 py-0.5 rounded border border-border">
                              {id}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="text-[10px] text-ink-muted italic border-t border-border pt-2 flex items-center justify-between">
                        <span>AI-generated summary strictly derived from stored company data. Review before use.</span>
                        {summaryData.generatedAt && (
                          <span className="font-mono">{formatDateTime(summaryData.generatedAt)}</span>
                        )}
                      </div>
                    </div>
                  ) : (
                    !isSummarizing && (
                      <div className="p-4 rounded border border-dashed border-border text-center text-xs text-ink-muted">
                        Click <strong>"Summarize company"</strong> to produce an evidence-grounded summary without hallucinating unverified figures.
                      </div>
                    )
                  )}
                </div>
              )}

              {/* Tab 2: Draft Outreach */}
              {activeAiTab === 'outreach' && (
                <div className="space-y-3 bg-surface p-3.5 rounded border border-border">
                  <div className="space-y-2">
                    <div>
                      <label className="block text-xs font-semibold text-ink mb-1">
                        What product / service are you offering? <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. B2B sales automation platform for mid-market teams"
                        value={offeringDescription}
                        onChange={(e) => setOfferingDescription(e.target.value)}
                        className="w-full text-xs px-3 py-1.5 bg-surface-subtle border border-border rounded focus:border-forest"
                      />
                      <span className="text-[10px] text-ink-muted block mt-0.5">
                        Required. Prevents the AI from inventing what you sell.
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-semibold text-ink mb-1">Sender name (optional)</label>
                        <input
                          type="text"
                          placeholder="e.g. Jane Doe"
                          value={senderName}
                          onChange={(e) => setSenderName(e.target.value)}
                          className="w-full text-xs px-3 py-1.5 bg-surface-subtle border border-border rounded focus:border-forest"
                        />
                      </div>
                      <div className="flex items-end">
                        <button
                          type="button"
                          disabled={isDrafting || !offeringDescription.trim()}
                          onClick={() => handleGenerateOutreach(Boolean(outreachData))}
                          className="w-full py-1.5 text-xs font-semibold rounded bg-forest text-white hover:bg-forest-hover disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-xs"
                        >
                          {isDrafting ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Send className="w-3.5 h-3.5" />
                          )}
                          <span>{outreachData ? 'Regenerate draft' : 'Draft outreach'}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {outreachError && (
                    <div className="p-2.5 rounded bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <span>{outreachError}</span>
                    </div>
                  )}

                  {outreachData ? (
                    <div className="space-y-3 pt-2 border-t border-border">
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 text-[10px] font-semibold bg-amber-50 text-warning border border-warning-border rounded">
                          AI-generated draft — review before use
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(`Subject: ${editableSubject}\n\n${editableBody}`, 'outreach-copy')}
                          className="text-xs font-medium text-forest hover:underline flex items-center gap-1"
                        >
                          {copiedItem === 'outreach-copy' ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-forest" />
                              <span>Copied draft</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy draft</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Editable Subject */}
                      <div>
                        <label className="block text-[11px] font-semibold text-ink-secondary mb-1">Subject line (editable)</label>
                        <input
                          type="text"
                          value={editableSubject}
                          onChange={(e) => setEditableSubject(e.target.value)}
                          className="w-full text-xs font-semibold px-3 py-1.5 bg-surface-subtle border border-border rounded focus:border-forest"
                        />
                      </div>

                      {/* Editable Body */}
                      <div>
                        <label className="block text-[11px] font-semibold text-ink-secondary mb-1">Email body (&le; 120 words, editable)</label>
                        <textarea
                          rows={6}
                          value={editableBody}
                          onChange={(e) => setEditableBody(e.target.value)}
                          className="w-full text-xs px-3 py-2 bg-surface-subtle border border-border rounded font-mono leading-relaxed focus:border-forest"
                        />
                      </div>

                      {/* Source facts used */}
                      {outreachData.sourceFactsUsed?.length > 0 && (
                        <div className="p-2.5 rounded bg-surface-subtle border border-border text-[11px] space-y-1">
                          <span className="font-semibold text-ink block">Source facts used:</span>
                          <ul className="list-disc pl-4 space-y-0.5 text-ink-muted">
                            {outreachData.sourceFactsUsed.map((fact, idx) => (
                              <li key={idx}>{fact}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="p-2 rounded bg-stone-100 text-[10px] text-ink-muted leading-relaxed flex items-center justify-between">
                        <span><strong>Safety guarantee:</strong> LeadLens never connects to mailboxes or sends emails automatically.</span>
                        {outreachData.generatedAt && (
                          <span className="font-mono">{formatDateTime(outreachData.generatedAt)}</span>
                        )}
                      </div>
                    </div>
                  ) : (
                    !isDrafting && (
                      <div className="p-4 rounded border border-dashed border-border text-center text-xs text-ink-muted">
                        Enter your product offering description above and click <strong>"Draft outreach"</strong> to generate a customized, strictly grounded cold email.
                      </div>
                    )
                  )}
                </div>
              )}
            </div>

            {/* SECTION 6: Outreach Status Tracking */}
            <div className="bg-surface-subtle rounded border border-border p-3.5 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-ink">Outreach stage</div>
                <div className="text-[11px] text-ink-muted">Manual pipeline tracking (LeadLens does not send emails)</div>
              </div>
              <select
                value={lead.outreachStatus}
                onChange={(e) => onUpdateStatus(lead._id, e.target.value)}
                className="text-xs font-semibold bg-surface border border-border text-ink rounded px-3 py-1.5 cursor-pointer focus:border-forest"
                aria-label="Outreach status"
              >
                <option value="new">New</option>
                <option value="shortlisted">Shortlisted</option>
                <option value="contacted">Contacted</option>
                <option value="not-relevant">Not relevant</option>
              </select>
            </div>

            {/* Metadata Footer */}
            <div className="pt-2 border-t border-border flex items-center justify-between text-[11px] text-ink-muted font-mono">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" /> Scraped: {formatDateTime(lead.lastScrapedAt)}
              </span>
              <span>Domain: {lead.normalizedDomain}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
