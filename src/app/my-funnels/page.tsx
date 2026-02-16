'use client';

import { useState, useEffect, useMemo } from 'react';
import Header from '@/components/Header';
import { fetchFunnelCrawlSteps, deleteFunnelCrawlStepsByFunnel } from '@/lib/supabase-operations';
import { groupStepsByFunnel, type FunnelGroup } from '@/lib/funnel-groups';
import type { FunnelPageVisionAnalysis } from '@/types';
import {
  Filter,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Trash2,
  Tag,
  Calendar,
  FileStack,
  Loader2,
  AlertCircle,
  Sparkles,
  X,
  Check,
  Zap,
  Target,
  DollarSign,
} from 'lucide-react';

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function getPageTypeLabel(pageType: string): string {
  const labels: Record<string, string> = {
    'opt-in': 'Opt-in',
    vsl: 'VSL',
    sales_page: 'Sales Page',
    order_form: 'Order Form',
    upsell: 'Upsell',
    downsell: 'Downsell',
    thank_you: 'Thank You',
    bridge_page: 'Bridge',
    landing: 'Landing',
    checkout: 'Checkout',
    other: 'Altro',
  };
  return labels[pageType] ?? pageType;
}

export default function MyFunnelsPage() {
  const [steps, setSteps] = useState<FunnelCrawlStepRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [visionLoading, setVisionLoading] = useState(false);
  const [visionResult, setVisionResult] = useState<{
    funnelName: string;
    analyses: FunnelPageVisionAnalysis[];
  } | null>(null);
  const [visionError, setVisionError] = useState<string | null>(null);

  const funnels = useMemo(() => groupStepsByFunnel(steps), [steps]);
  const selectedFunnel = useMemo(
    () => (selectedKey ? funnels.find((f) => f.key === selectedKey) : null),
    [selectedKey, funnels]
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchFunnelCrawlSteps()
      .then((data) => {
        if (!cancelled) setSteps(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message ?? 'Errore nel caricamento dei funnel');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleExpanded = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSelectFunnel = (key: string) => {
    setSelectedKey((prev) => (prev === key ? null : key));
    setVisionResult(null);
    setVisionError(null);
  };

  const handleAnalyzeWithAI = async () => {
    if (!selectedFunnel) return;
    setVisionLoading(true);
    setVisionError(null);
    setVisionResult(null);
    try {
      const res = await fetch('/api/funnel-analyzer/vision-from-saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entryUrl: selectedFunnel.entryUrl,
          funnelName: selectedFunnel.funnelNameDb,
          provider: 'gemini',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Analisi fallita');
      setVisionResult({
        funnelName: selectedFunnel.funnelName,
        analyses: data.analyses ?? [],
      });
    } catch (err) {
      setVisionError(err instanceof Error ? err.message : 'Errore analisi AI');
    } finally {
      setVisionLoading(false);
    }
  };

  const handleDeleteFunnel = async (group: FunnelGroup) => {
    if (!confirm(`Eliminare il funnel "${group.funnelName}" e tutte le ${group.steps.length} pagine?`)) return;
    setDeletingKey(group.key);
    try {
      await deleteFunnelCrawlStepsByFunnel(group.entryUrl, group.funnelNameDb);
      setSteps((prev) =>
        prev.filter((s) => s.entry_url !== group.entryUrl || s.funnel_name !== group.funnelNameDb)
      );
      if (selectedKey === group.key) setSelectedKey(null);
    } catch (err) {
      setError((err as Error)?.message ?? "Errore durante l'eliminazione");
    } finally {
      setDeletingKey(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50/80 via-orange-50/40 to-slate-50">
      <Header
        title="My Funnels"
        subtitle="I tuoi funnel salvati — seleziona e analizza con l'AI per estrarre copy, CTA e strategie"
      />

      <div className="p-6">
        {/* Hero strip */}
        {!loading && !error && funnels.length > 0 && (
          <div className="mb-8 rounded-2xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-600/5 border border-amber-200/60 p-6 shadow-sm">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-amber-500/20">
                <Target className="h-8 w-8 text-amber-700" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800">Swipe & analizza</h2>
                <p className="text-sm text-slate-600 mt-0.5">
                  Seleziona un funnel e lancia l&apos;analisi AI per ottenere headline, CTA, tecniche di persuasione e tipo di pagina.
                </p>
              </div>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-24">
            <Loader2 className="h-12 w-12 text-amber-500 animate-spin" />
            <p className="mt-4 text-slate-500">Caricamento funnel...</p>
          </div>
        )}

        {error && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!loading && !error && funnels.length === 0 && (
          <div className="rounded-2xl border border-amber-200/60 bg-white p-12 text-center shadow-sm">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-amber-100">
              <Filter className="h-10 w-10 text-amber-600" />
            </div>
            <h3 className="mt-4 text-xl font-semibold text-slate-800">Nessun funnel salvato</h3>
            <p className="mt-2 text-slate-600">
              Usa il <strong>Funnel Analyzer</strong> per crawllare un funnel e salvarlo qui. Poi potrai analizzarlo con l&apos;AI.
            </p>
            <a
              href="/funnel-analyzer"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 font-medium text-white shadow-md hover:bg-amber-600 transition-colors"
            >
              Vai al Funnel Analyzer
            </a>
          </div>
        )}

        {!loading && !error && funnels.length > 0 && (
          <>
            {/* Selection CTA bar */}
            {selectedFunnel && (
              <div className="mb-6 flex flex-wrap items-center gap-4 rounded-xl border border-amber-300/60 bg-amber-50/90 px-5 py-4 shadow-sm">
                <span className="text-sm font-medium text-slate-700">
                  Selezionato: <strong>{selectedFunnel.funnelName}</strong>
                </span>
                <button
                  onClick={handleAnalyzeWithAI}
                  disabled={visionLoading}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-2.5 font-semibold text-white shadow-md hover:from-amber-600 hover:to-orange-600 disabled:opacity-60 transition-all"
                >
                  {visionLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Sparkles className="h-5 w-5" />
                  )}
                  Analizza con AI
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedKey(null)}
                  className="text-slate-500 hover:text-slate-700 text-sm"
                >
                  Annulla selezione
                </button>
              </div>
            )}

            {visionError && (
              <div className="mb-6 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <span>{visionError}</span>
              </div>
            )}

            {/* Funnel cards grid */}
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {funnels.map((group) => {
                const isExpanded = expandedKeys.has(group.key);
                const isSelected = selectedKey === group.key;
                const isDeleting = deletingKey === group.key;
                return (
                  <div
                    key={group.key}
                    className={`overflow-hidden rounded-2xl border-2 bg-white shadow-md transition-all ${
                      isSelected
                        ? 'border-amber-500 ring-2 ring-amber-200'
                        : 'border-slate-200/80 hover:border-amber-200 hover:shadow-lg'
                    }`}
                  >
                    {/* Card header: icon + select + infos */}
                    <div
                      className="p-5 cursor-pointer"
                      onClick={() => handleSelectFunnel(group.key)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && handleSelectFunnel(group.key)}
                    >
                      <div className="flex items-start gap-4">
                        <div
                          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl ${
                            isSelected ? 'bg-amber-100' : 'bg-slate-100'
                          }`}
                        >
                          <Filter className={`h-7 w-7 ${isSelected ? 'text-amber-600' : 'text-slate-500'}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-slate-800 truncate">{group.funnelName}</h3>
                            {isSelected && (
                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-white">
                                <Check className="h-3 w-3" />
                              </span>
                            )}
                          </div>
                          {group.funnelTag && (
                            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                              <Tag className="h-3 w-3" />
                              {group.funnelTag}
                            </span>
                          )}
                          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                            <span className="inline-flex items-center gap-1">
                              <FileStack className="h-3.5 w-3.5" />
                              {group.steps.length} pagine
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" />
                              {formatDate(group.createdAt)}
                            </span>
                          </div>
                          <a
                            href={group.entryUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 block truncate text-xs text-amber-600 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {group.entryUrl}
                          </a>
                        </div>
                      </div>
                    </div>

                    {/* Actions row */}
                    <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpanded(group.key);
                        }}
                        className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-amber-600"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        {isExpanded ? 'Nascondi pagine' : 'Vedi pagine'}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteFunnel(group);
                        }}
                        disabled={isDeleting}
                        className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                        title="Elimina funnel"
                      >
                        {isDeleting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Trash2 className="h-5 w-5" />}
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-slate-100 bg-slate-50/50">
                        <ul className="divide-y divide-slate-100 p-3">
                          {group.steps.map((step) => (
                            <li key={step.id} className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-white/80">
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm font-semibold text-amber-700">
                                {step.step_index + 1}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-medium text-slate-800">{step.title || 'Senza titolo'}</p>
                                <a
                                  href={step.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="truncate text-xs text-amber-600 hover:underline flex items-center gap-1"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {step.url}
                                  <ExternalLink className="h-3 w-3 inline" />
                                </a>
                              </div>
                              <a
                                href={step.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-amber-100 hover:text-amber-600"
                                title="Apri pagina"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Modal: AI Analysis results */}
      {visionResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-amber-50 to-orange-50 px-6 py-4">
              <div className="flex items-center gap-3">
                <Zap className="h-6 w-6 text-amber-500" />
                <div>
                  <h3 className="font-bold text-slate-800">Analisi AI — {visionResult.funnelName}</h3>
                  <p className="text-sm text-slate-500">{visionResult.analyses.length} pagine analizzate</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setVisionResult(null)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {visionResult.analyses.map((a, i) => (
                <div
                  key={`${a.stepIndex}-${i}`}
                  className="rounded-xl border border-slate-200 bg-slate-50/50 p-4"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-800">
                      Step {a.stepIndex + 1}
                    </span>
                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-700">
                      {getPageTypeLabel(a.page_type)}
                    </span>
                  </div>
                  {a.error && (
                    <p className="text-sm text-red-600 mb-2">{a.error}</p>
                  )}
                  {a.headline && (
                    <p className="font-semibold text-slate-800 mb-1">{a.headline}</p>
                  )}
                  {a.subheadline && (
                    <p className="text-sm text-slate-600 mb-2">{a.subheadline}</p>
                  )}
                  {a.cta_text && a.cta_text.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {a.cta_text.map((cta, j) => (
                        <span key={j} className="inline-flex items-center gap-1 rounded-md bg-green-100 px-2 py-0.5 text-xs text-green-800">
                          <DollarSign className="h-3 w-3" />
                          {cta}
                        </span>
                      ))}
                    </div>
                  )}
                  {a.next_step_ctas && a.next_step_ctas.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      <span className="text-xs font-medium text-slate-600">CTA verso step successivo:</span>
                      {a.next_step_ctas.map((cta, j) => (
                        <span key={j} className="inline-flex items-center gap-1 rounded-md bg-emerald-200 px-2 py-0.5 text-xs font-medium text-emerald-900">
                          {cta}
                        </span>
                      ))}
                    </div>
                  )}
                  {a.price_points && a.price_points.length > 0 && (
                    <p className="text-xs text-slate-600">Prezzi: {a.price_points.join(', ')}</p>
                  )}
                  {a.persuasion_techniques_used && a.persuasion_techniques_used.length > 0 && (
                    <p className="text-xs text-slate-500 mt-1">
                      Tecniche: {a.persuasion_techniques_used.join(', ')}
                    </p>
                  )}
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-xs text-amber-600 hover:underline"
                  >
                    {a.url}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
