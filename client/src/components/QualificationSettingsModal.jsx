import React, { useState, useEffect } from 'react';
import { X, Sliders, Check, RefreshCw, Sparkles } from 'lucide-react';

export function QualificationSettingsModal({ isOpen, onClose, currentSettings, onSave }) {
  const [targetIndustry, setTargetIndustry] = useState('');
  const [targetLocation, setTargetLocation] = useState('');
  const [preferredKeywords, setPreferredKeywords] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (currentSettings) {
      setTargetIndustry(currentSettings.targetIndustry || '');
      setTargetLocation(currentSettings.targetLocation || '');
      setPreferredKeywords(
        Array.isArray(currentSettings.preferredKeywords)
          ? currentSettings.preferredKeywords.join(', ')
          : ''
      );
    }
  }, [currentSettings, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSuccessMsg('');
    try {
      const keywordsArray = preferredKeywords
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean);

      await onSave({
        targetIndustry,
        targetLocation,
        preferredKeywords: keywordsArray,
      });

      setSuccessMsg('Target criteria saved and stored lead scores recalculated.');
      setTimeout(() => {
        setSuccessMsg('');
        onClose();
      }, 1000);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
    >
      <div
        className="fixed inset-0 bg-ink/40 backdrop-blur-xs"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-lg rounded-lg bg-surface p-5 shadow-xl border border-border">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-forest" />
              <h3 id="settings-title" className="text-sm font-bold text-ink">
                Target Qualification Criteria
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded text-ink-muted hover:text-ink hover:bg-stone-100"
              aria-label="Close dialog"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-ink mb-1">
                Target industry (30 points)
              </label>
              <input
                type="text"
                placeholder="e.g. SaaS & Enterprise Software, Healthcare, Fintech"
                value={targetIndustry}
                onChange={(e) => setTargetIndustry(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-surface-subtle border border-border rounded focus:border-forest"
              />
              <span className="text-[11px] text-ink-muted mt-0.5 block">
                Leave blank to exclude industry weight from the score denominator.
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink mb-1">
                Target location (20 points)
              </label>
              <input
                type="text"
                placeholder="e.g. San Francisco, CA, New York, NY, Austin, TX"
                value={targetLocation}
                onChange={(e) => setTargetLocation(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-surface-subtle border border-border rounded focus:border-forest"
              />
              <span className="text-[11px] text-ink-muted mt-0.5 block">
                Leave blank to exclude location weight from the score denominator.
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink mb-1">
                Preferred keywords (20 points)
              </label>
              <input
                type="text"
                placeholder="b2b, cloud, automation, platform, ai (comma-separated)"
                value={preferredKeywords}
                onChange={(e) => setPreferredKeywords(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-surface-subtle border border-border rounded focus:border-forest"
              />
              <span className="text-[11px] text-ink-muted mt-0.5 block">
                Points are awarded proportionally based on keyword matches in company text.
              </span>
            </div>

            <div className="p-3 rounded bg-surface-subtle border border-border text-xs space-y-1">
              <span className="font-semibold text-ink block">Fixed contact baseline weights</span>
              <ul className="text-[11px] text-ink-secondary space-y-0.5 list-disc pl-4">
                <li>Valid-format public email: <strong>15 pts</strong></li>
                <li>Usable public phone: <strong>5 pts</strong></li>
                <li>Non-empty company description: <strong>10 pts</strong></li>
              </ul>
            </div>

            {successMsg && (
              <div className="p-2.5 rounded bg-forest-light border border-forest-border text-forest text-xs flex items-center gap-1.5">
                <Check className="w-4 h-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs text-ink-secondary hover:bg-stone-100 rounded"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-forest hover:bg-forest-hover rounded flex items-center gap-1.5 disabled:opacity-50"
              >
                {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Save &amp; Recalculate Scores
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
