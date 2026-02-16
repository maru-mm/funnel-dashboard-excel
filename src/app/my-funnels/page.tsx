'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Header from '@/components/Header';
import { fetchAffiliateSavedFunnels, deleteAffiliateSavedFunnel } from '@/lib/supabase-operations';
import type { AffiliateSavedFunnel, Json } from '@/types/database';
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
  Zap,
  Target,
  Search,
  Globe,
  ShieldCheck,
  Lightbulb,
  LayoutList,
  Eye,
  CheckSquare,
  Square,
  CheckCircle2,
  Circle,
  MousePointerClick,
  ClipboardList,
  ListChecks,
} from 'lucide-react';

/* ───────── helpers ───────── */

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

const FUNNEL_TYPE_LABELS: Record<string, string> = {
  quiz_funnel: 'Quiz Funnel',
  sales_funnel: 'Sales Funnel',
  landing_page: 'Landing Page',
  webinar_funnel: 'Webinar Funnel',
  tripwire_funnel: 'Tripwire Funnel',
  lead_magnet: 'Lead Magnet',
  vsl_funnel: 'VSL Funnel',
  other: 'Altro',
};

const CATEGORY_LABELS: Record<string, string> = {
  weight_loss: 'Weight Loss',
  supplements: 'Supplements',
  skincare: 'Skincare',
  fitness: 'Fitness',
  finance: 'Finance',
  saas: 'SaaS',
  ecommerce: 'E-commerce',
  health: 'Health',
  education: 'Education',
  other: 'Altro',
};

const FUNNEL_TYPE_COLORS: Record<string, string> = {
  quiz_funnel: 'bg-violet-100 text-violet-800',
  sales_funnel: 'bg-emerald-100 text-emerald-800',
  landing_page: 'bg-sky-100 text-sky-800',
  webinar_funnel: 'bg-rose-100 text-rose-800',
  tripwire_funnel: 'bg-amber-100 text-amber-800',
  lead_magnet: 'bg-teal-100 text-teal-800',
  vsl_funnel: 'bg-orange-100 text-orange-800',
  other: 'bg-slate-100 text-slate-700',
};

const STEP_TYPE_COLORS: Record<string, string> = {
  quiz_question: 'bg-violet-100 text-violet-700',
  info_screen: 'bg-sky-100 text-sky-700',
  lead_capture: 'bg-teal-100 text-teal-700',
  checkout: 'bg-emerald-100 text-emerald-700',
  upsell: 'bg-amber-100 text-amber-700',
  thank_you: 'bg-green-100 text-green-700',
  landing: 'bg-blue-100 text-blue-700',
  other: 'bg-slate-100 text-slate-600',
};

type TabId = 'all' | 'quiz';

interface SavedFunnelStep {
  step_index: number;
  url?: string;
  title?: string;
  step_type?: string;
  input_type?: string;
  options?: string[];
  description?: string;
  cta_text?: string;
}

function parseSteps(raw: Json): SavedFunnelStep[] {
  if (!Array.isArray(raw)) return [];
  return raw as unknown as SavedFunnelStep[];
}

export interface SelectedItem {
  funnelId: string;
  funnelName: string;
  type: 'full_funnel' | 'single_page';
  stepIndex?: number;
  stepTitle?: string;
  stepUrl?: string;
}

/* ───────── component ───────── */

export default function MyFunnelsPage() {
  const [funnels, setFunnels] = useState<AffiliateSavedFunnel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [detailFunnel, setDetailFunnel] = useState<AffiliateSavedFunnel | null>(null);

  /* ── Tabs ── */
  const [activeTab, setActiveTab] = useState<TabId>('all');

  /* ── Filters ── */
  const [searchText, setSearchText] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  /* ── Selection state ── */
  const [selectedFunnelIds, setSelectedFunnelIds] = useState<Set<string>>(new Set());
  const [selectedPages, setSelectedPages] = useState<Map<string, Set<number>>>(new Map());

  /* ── Tab counts ── */
  const allCount = funnels.length;
  const quizCount = useMemo(() => funnels.filter((f) => f.funnel_type === 'quiz_funnel').length, [funnels]);

  /* ── Tab-level filtering ── */
  const tabFiltered = useMemo(() => {
    if (activeTab === 'quiz') return funnels.filter((f) => f.funnel_type === 'quiz_funnel');
    return funnels;
  }, [funnels, activeTab]);

  const uniqueTypes = useMemo(() => {
    const set = new Set(tabFiltered.map((f) => f.funnel_type));
    return Array.from(set).sort();
  }, [tabFiltered]);

  const uniqueCategories = useMemo(() => {
    const set = new Set(tabFiltered.map((f) => f.category));
    return Array.from(set).sort();
  }, [tabFiltered]);

  /* ── Full filtering (tab + text + dropdown) ── */
  const filtered = useMemo(() => {
    return tabFiltered.filter((f) => {
      if (filterType !== 'all' && f.funnel_type !== filterType) return false;
      if (filterCategory !== 'all' && f.category !== filterCategory) return false;
      if (searchText.trim()) {
        const q = searchText.toLowerCase();
        const matchName = f.funnel_name.toLowerCase().includes(q);
        const matchBrand = f.brand_name?.toLowerCase().includes(q);
        const matchUrl = f.entry_url.toLowerCase().includes(q);
        const matchTags = f.tags.some((t) => t.toLowerCase().includes(q));
        if (!matchName && !matchBrand && !matchUrl && !matchTags) return false;
      }
      return true;
    });
  }, [tabFiltered, filterType, filterCategory, searchText]);

  /* ═══════════ Selection helpers ═══════════ */

  const isFunnelFullySelected = useCallback(
    (id: string) => selectedFunnelIds.has(id),
    [selectedFunnelIds],
  );

  const isStepSelected = useCallback(
    (funnelId: string, stepIndex: number) => {
      if (selectedFunnelIds.has(funnelId)) return true;
      return selectedPages.get(funnelId)?.has(stepIndex) ?? false;
    },
    [selectedFunnelIds, selectedPages],
  );

  const toggleSelectFunnel = useCallback(
    (funnel: AffiliateSavedFunnel) => {
      setSelectedFunnelIds((prev) => {
        const next = new Set(prev);
        if (next.has(funnel.id)) {
          next.delete(funnel.id);
        } else {
          next.add(funnel.id);
          setSelectedPages((sp) => {
            const nextSp = new Map(sp);
            nextSp.delete(funnel.id);
            return nextSp;
          });
        }
        return next;
      });
    },
    [],
  );

  const toggleSelectStep = useCallback(
    (funnelId: string, stepIndex: number) => {
      if (selectedFunnelIds.has(funnelId)) {
        const funnel = funnels.find((f) => f.id === funnelId);
        if (!funnel) return;
        const steps = parseSteps(funnel.steps);
        const allIndices = new Set(steps.map((s) => s.step_index));
        allIndices.delete(stepIndex);
        setSelectedFunnelIds((prev) => {
          const next = new Set(prev);
          next.delete(funnelId);
          return next;
        });
        setSelectedPages((prev) => {
          const next = new Map(prev);
          if (allIndices.size > 0) {
            next.set(funnelId, allIndices);
          } else {
            next.delete(funnelId);
          }
          return next;
        });
        return;
      }

      setSelectedPages((prev) => {
        const next = new Map(prev);
        const current = new Set(next.get(funnelId) ?? []);
        if (current.has(stepIndex)) {
          current.delete(stepIndex);
        } else {
          current.add(stepIndex);
        }
        if (current.size === 0) {
          next.delete(funnelId);
        } else {
          next.set(funnelId, current);
        }
        return next;
      });
    },
    [selectedFunnelIds, funnels],
  );

  const clearSelection = useCallback(() => {
    setSelectedFunnelIds(new Set());
    setSelectedPages(new Map());
  }, []);

  /* ── Derived selection info ── */
  const selectedItems = useMemo<SelectedItem[]>(() => {
    const items: SelectedItem[] = [];
    for (const fid of selectedFunnelIds) {
      const funnel = funnels.find((f) => f.id === fid);
      if (funnel) {
        items.push({ funnelId: funnel.id, funnelName: funnel.funnel_name, type: 'full_funnel' });
      }
    }
    for (const [fid, indices] of selectedPages) {
      const funnel = funnels.find((f) => f.id === fid);
      if (!funnel) continue;
      const steps = parseSteps(funnel.steps);
      for (const idx of indices) {
        const step = steps.find((s) => s.step_index === idx);
        items.push({
          funnelId: funnel.id,
          funnelName: funnel.funnel_name,
          type: 'single_page',
          stepIndex: idx,
          stepTitle: step?.title || `Step ${idx}`,
          stepUrl: step?.url,
        });
      }
    }
    return items;
  }, [selectedFunnelIds, selectedPages, funnels]);

  const totalSelectedFunnels = selectedFunnelIds.size;
  const totalSelectedPages = useMemo(() => {
    let count = 0;
    for (const s of selectedPages.values()) count += s.size;
    return count;
  }, [selectedPages]);
  const hasSelection = totalSelectedFunnels > 0 || totalSelectedPages > 0;

  /* ═══════════ Data loading ═══════════ */

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchAffiliateSavedFunnels()
      .then((data) => {
        if (!cancelled) setFunnels(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message ?? 'Errore nel caricamento');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setFilterType('all');
  }, [activeTab]);

  /* ═══════════ Handlers ═══════════ */

  const toggleExpanded = (id: string) =>
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleDelete = async (funnel: AffiliateSavedFunnel) => {
    if (!confirm(`Eliminare "${funnel.funnel_name}"?`)) return;
    setDeletingId(funnel.id);
    try {
      await deleteAffiliateSavedFunnel(funnel.id);
      setFunnels((prev) => prev.filter((f) => f.id !== funnel.id));
      if (detailFunnel?.id === funnel.id) setDetailFunnel(null);
      setSelectedFunnelIds((prev) => {
        const next = new Set(prev);
        next.delete(funnel.id);
        return next;
      });
      setSelectedPages((prev) => {
        const next = new Map(prev);
        next.delete(funnel.id);
        return next;
      });
    } catch (err) {
      setError((err as Error)?.message ?? "Errore durante l'eliminazione");
    } finally {
      setDeletingId(null);
    }
  };

  const TABS: { id: TabId; label: string; count: number; icon: typeof Target }[] = [
    { id: 'all', label: 'Tutti i Funnel', count: allCount, icon: Target },
    { id: 'quiz', label: 'Quiz Funnel', count: quizCount, icon: ListChecks },
  ];

  /* ═══════════ Render ═══════════ */

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50/80 via-orange-50/40 to-slate-50">
      <Header
        title="My Funnels"
        subtitle="Funnel salvati e analizzati — seleziona pagine singole o interi funnel"
      />

      <div className={`p-6 ${hasSelection ? 'pb-32' : ''}`}>
        {/* ══ Tabs ══ */}
        {!loading && !error && funnels.length > 0 && (
          <div className="mb-6 flex items-center gap-1 rounded-xl bg-white border border-slate-200 p-1 shadow-sm w-fit">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-amber-500 text-white shadow-md'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                  <span
                    className={`ml-1 rounded-full px-2 py-0.5 text-xs font-bold ${
                      isActive ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* ══ Hero strip ══ */}
        {!loading && !error && funnels.length > 0 && (
          <div className="mb-6 rounded-2xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-600/5 border border-amber-200/60 p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/20">
                  {activeTab === 'quiz' ? (
                    <ListChecks className="h-7 w-7 text-amber-700" />
                  ) : (
                    <Target className="h-7 w-7 text-amber-700" />
                  )}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800">
                    {filtered.length} funnel {activeTab === 'quiz' ? 'quiz ' : ''}
                    trovat{filtered.length === 1 ? 'o' : 'i'}
                  </h2>
                  <p className="text-sm text-slate-600 mt-0.5">
                    {activeTab === 'quiz'
                      ? 'Quiz funnel con step, domande e opzioni analizzate — clicca per selezionare'
                      : 'Seleziona un intero funnel o singole pagine per usarli'}
                  </p>
                </div>
              </div>
              {hasSelection && (
                <div className="flex items-center gap-2 rounded-xl bg-amber-100 px-4 py-2 border border-amber-300/60">
                  <MousePointerClick className="h-4 w-4 text-amber-700" />
                  <span className="text-sm font-medium text-amber-800">
                    {totalSelectedFunnels > 0 && `${totalSelectedFunnels} funnel`}
                    {totalSelectedFunnels > 0 && totalSelectedPages > 0 && ' + '}
                    {totalSelectedPages > 0 &&
                      `${totalSelectedPages} pagin${totalSelectedPages === 1 ? 'a' : 'e'}`}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══ Filters bar ══ */}
        {!loading && !error && funnels.length > 0 && (
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Cerca per nome, brand, URL o tag..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-amber-400 focus:ring-2 focus:ring-amber-200 outline-none"
              />
            </div>

            {activeTab === 'all' && (
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-amber-400 focus:ring-2 focus:ring-amber-200 outline-none"
              >
                <option value="all">Tutti i tipi</option>
                {uniqueTypes.map((t) => (
                  <option key={t} value={t}>
                    {FUNNEL_TYPE_LABELS[t] ?? t}
                  </option>
                ))}
              </select>
            )}

            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-amber-400 focus:ring-2 focus:ring-amber-200 outline-none"
            >
              <option value="all">Tutte le categorie</option>
              {uniqueCategories.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c] ?? c}
                </option>
              ))}
            </select>

            {(filterType !== 'all' || filterCategory !== 'all' || searchText) && (
              <button
                onClick={() => {
                  setFilterType('all');
                  setFilterCategory('all');
                  setSearchText('');
                }}
                className="text-xs text-slate-500 hover:text-amber-600 underline"
              >
                Reset filtri
              </button>
            )}
          </div>
        )}

        {/* ══ Loading ══ */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-24">
            <Loader2 className="h-12 w-12 text-amber-500 animate-spin" />
            <p className="mt-4 text-slate-500">Caricamento funnel...</p>
          </div>
        )}

        {/* ══ Error ══ */}
        {error && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ══ Empty state ══ */}
        {!loading && !error && funnels.length === 0 && (
          <div className="rounded-2xl border border-amber-200/60 bg-white p-12 text-center shadow-sm">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-amber-100">
              <Filter className="h-10 w-10 text-amber-600" />
            </div>
            <h3 className="mt-4 text-xl font-semibold text-slate-800">Nessun funnel salvato</h3>
            <p className="mt-2 text-slate-600">
              Usa l&apos;<strong>Affiliate Browser Chat</strong> per analizzare funnel con
              l&apos;agente AI e salvarli qui.
            </p>
            <a
              href="/affiliate-browser-chat"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 font-medium text-white shadow-md hover:bg-amber-600 transition-colors"
            >
              Vai all&apos;Affiliate Browser Chat
            </a>
          </div>
        )}

        {/* ══ No results for filters ══ */}
        {!loading && !error && funnels.length > 0 && filtered.length === 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <Search className="mx-auto h-10 w-10 text-slate-300" />
            <h3 className="mt-3 text-lg font-semibold text-slate-700">Nessun risultato</h3>
            <p className="mt-1 text-sm text-slate-500">
              {activeTab === 'quiz'
                ? 'Nessun quiz funnel trovato. Prova a modificare i filtri.'
                : 'Prova a modificare i filtri di ricerca.'}
            </p>
          </div>
        )}

        {/* ══ Funnel cards grid ══ */}
        {!loading && !error && filtered.length > 0 && (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((funnel) => {
              const isExpanded = expandedIds.has(funnel.id);
              const isDeleting = deletingId === funnel.id;
              const steps = parseSteps(funnel.steps);
              const typeColor = FUNNEL_TYPE_COLORS[funnel.funnel_type] ?? FUNNEL_TYPE_COLORS.other;
              const isFunnelSel = isFunnelFullySelected(funnel.id);
              const hasPageSel = selectedPages.has(funnel.id);
              const pageSelCount = selectedPages.get(funnel.id)?.size ?? 0;

              return (
                <div
                  key={funnel.id}
                  className={`overflow-hidden rounded-2xl border-2 bg-white shadow-md transition-all ${
                    isFunnelSel
                      ? 'border-amber-400 ring-2 ring-amber-200 shadow-amber-100'
                      : hasPageSel
                        ? 'border-amber-300/60 shadow-amber-50'
                        : 'border-slate-200/80 hover:border-amber-200 hover:shadow-lg'
                  }`}
                >
                  {/* Card header */}
                  <div className="p-5">
                    <div className="flex items-start gap-3">
                      {/* Selection checkbox — full funnel */}
                      <button
                        type="button"
                        onClick={() => toggleSelectFunnel(funnel)}
                        className={`mt-1 shrink-0 rounded-lg p-1 transition-colors ${
                          isFunnelSel
                            ? 'text-amber-600 hover:text-amber-700'
                            : 'text-slate-300 hover:text-amber-500'
                        }`}
                        title={isFunnelSel ? 'Deseleziona intero funnel' : 'Seleziona intero funnel'}
                      >
                        {isFunnelSel ? (
                          <CheckSquare className="h-5 w-5" />
                        ) : (
                          <Square className="h-5 w-5" />
                        )}
                      </button>

                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100">
                        <Globe className="h-6 w-6 text-slate-500" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-slate-800 truncate">{funnel.funnel_name}</h3>
                        {funnel.brand_name && (
                          <p className="text-xs text-slate-500 mt-0.5 truncate">{funnel.brand_name}</p>
                        )}

                        {/* Badges: type + category + selection */}
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${typeColor}`}
                          >
                            {FUNNEL_TYPE_LABELS[funnel.funnel_type] ?? funnel.funnel_type}
                          </span>
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                            {CATEGORY_LABELS[funnel.category] ?? funnel.category}
                          </span>
                          {(isFunnelSel || hasPageSel) && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                              <CheckCircle2 className="h-3 w-3" />
                              {isFunnelSel ? 'Intero funnel' : `${pageSelCount} pagin${pageSelCount === 1 ? 'a' : 'e'}`}
                            </span>
                          )}
                        </div>

                        {/* Tags */}
                        {funnel.tags.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {funnel.tags.slice(0, 4).map((tag, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center gap-0.5 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700 border border-amber-200/60"
                              >
                                <Tag className="h-2.5 w-2.5" />
                                {tag}
                              </span>
                            ))}
                            {funnel.tags.length > 4 && (
                              <span className="text-[10px] text-slate-400">+{funnel.tags.length - 4}</span>
                            )}
                          </div>
                        )}

                        {/* Meta row */}
                        <div className="mt-2.5 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                          <span className="inline-flex items-center gap-1">
                            <FileStack className="h-3.5 w-3.5" />
                            {funnel.total_steps} step
                          </span>
                          {funnel.lead_capture_method && funnel.lead_capture_method !== 'none' && (
                            <span className="inline-flex items-center gap-1">
                              <ShieldCheck className="h-3.5 w-3.5" />
                              {funnel.lead_capture_method}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {formatDate(funnel.created_at)}
                          </span>
                        </div>

                        {/* Entry URL */}
                        <a
                          href={funnel.entry_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1.5 block truncate text-xs text-amber-600 hover:underline"
                        >
                          {funnel.entry_url}
                        </a>
                      </div>
                    </div>

                    {/* Analysis summary */}
                    {funnel.analysis_summary && (
                      <p className="mt-3 text-xs text-slate-600 leading-relaxed line-clamp-3 bg-slate-50 rounded-lg p-2.5 border border-slate-100">
                        <Sparkles className="h-3 w-3 inline mr-1 text-amber-500" />
                        {funnel.analysis_summary}
                      </p>
                    )}

                    {/* Persuasion techniques */}
                    {funnel.persuasion_techniques.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1">
                        {funnel.persuasion_techniques.slice(0, 3).map((tech, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-0.5 rounded-md bg-violet-50 px-1.5 py-0.5 text-[10px] text-violet-700 border border-violet-200/60"
                          >
                            <Lightbulb className="h-2.5 w-2.5" />
                            {tech}
                          </span>
                        ))}
                        {funnel.persuasion_techniques.length > 3 && (
                          <span className="text-[10px] text-slate-400">
                            +{funnel.persuasion_techniques.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions row */}
                  <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleExpanded(funnel.id)}
                        className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-amber-600"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        {isExpanded ? 'Nascondi step' : `Vedi ${steps.length} step`}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDetailFunnel(funnel)}
                        className="flex items-center gap-1 text-sm font-medium text-amber-600 hover:text-amber-700"
                      >
                        <Eye className="h-4 w-4" />
                        Dettagli
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDelete(funnel)}
                      disabled={isDeleting}
                      className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                      title="Elimina funnel"
                    >
                      {isDeleting ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Trash2 className="h-5 w-5" />
                      )}
                    </button>
                  </div>

                  {/* ── Expanded steps — with per-step selection ── */}
                  {isExpanded && steps.length > 0 && (
                    <div className="border-t border-slate-100 bg-slate-50/50">
                      <div className="px-4 pt-3 pb-1 flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          Seleziona singole pagine
                        </span>
                        {!isFunnelSel && pageSelCount > 0 && pageSelCount < steps.length && (
                          <span className="text-[10px] text-amber-600 font-medium">
                            {pageSelCount}/{steps.length} selezionate
                          </span>
                        )}
                      </div>

                      <ul className="divide-y divide-slate-100 p-3 pt-1">
                        {steps.map((step, idx) => {
                          const stepTypeColor =
                            STEP_TYPE_COLORS[step.step_type ?? 'other'] ?? STEP_TYPE_COLORS.other;
                          const stepIdx = step.step_index ?? idx + 1;
                          const stepSel = isStepSelected(funnel.id, stepIdx);

                          return (
                            <li
                              key={idx}
                              className={`flex items-start gap-3 rounded-lg px-3 py-2.5 cursor-pointer transition-colors ${
                                stepSel
                                  ? 'bg-amber-50/80 ring-1 ring-amber-200'
                                  : 'hover:bg-white/80'
                              }`}
                              onClick={() => toggleSelectStep(funnel.id, stepIdx)}
                            >
                              {/* Step checkbox */}
                              <div
                                className={`mt-0.5 shrink-0 ${
                                  stepSel ? 'text-amber-600' : 'text-slate-300'
                                }`}
                              >
                                {stepSel ? (
                                  <CheckCircle2 className="h-5 w-5" />
                                ) : (
                                  <Circle className="h-5 w-5" />
                                )}
                              </div>

                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-semibold text-amber-700 mt-0.5">
                                {stepIdx}
                              </span>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-medium text-slate-800 text-sm truncate">
                                    {step.title || 'Senza titolo'}
                                  </p>
                                  {step.step_type && (
                                    <span
                                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${stepTypeColor}`}
                                    >
                                      {step.step_type.replace(/_/g, ' ')}
                                    </span>
                                  )}
                                </div>
                                {step.description && (
                                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                                    {step.description}
                                  </p>
                                )}
                                {step.cta_text && (
                                  <span className="mt-1 inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] text-emerald-700 border border-emerald-200/60">
                                    <Zap className="h-2.5 w-2.5" />
                                    CTA: {step.cta_text}
                                  </span>
                                )}
                                {step.options && step.options.length > 0 && (
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {step.options.map((opt, oi) => (
                                      <span
                                        key={oi}
                                        className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600"
                                      >
                                        {opt}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                {step.url && (
                                  <a
                                    href={step.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-1 block truncate text-[11px] text-amber-600 hover:underline"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {step.url}
                                  </a>
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ══════ Floating Selection Bar ══════ */}
      {hasSelection && (
        <div className="fixed bottom-0 inset-x-0 z-40">
          <div className="mx-auto max-w-5xl px-6 pb-6">
            <div className="rounded-2xl bg-slate-900 shadow-2xl border border-slate-700 px-6 py-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/20">
                    <ClipboardList className="h-5 w-5 text-amber-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">
                      {totalSelectedFunnels > 0 && (
                        <span>
                          {totalSelectedFunnels} funnel complet{totalSelectedFunnels === 1 ? 'o' : 'i'}
                        </span>
                      )}
                      {totalSelectedFunnels > 0 && totalSelectedPages > 0 && (
                        <span className="text-slate-400"> + </span>
                      )}
                      {totalSelectedPages > 0 && (
                        <span>
                          {totalSelectedPages} pagin{totalSelectedPages === 1 ? 'a' : 'e'} singol
                          {totalSelectedPages === 1 ? 'a' : 'e'}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5 truncate">
                      {selectedItems.length <= 4
                        ? selectedItems
                            .map((item) =>
                              item.type === 'full_funnel'
                                ? item.funnelName
                                : `${item.stepTitle} (${item.funnelName})`,
                            )
                            .join(', ')
                        : `${selectedItems
                            .slice(0, 3)
                            .map((item) =>
                              item.type === 'full_funnel' ? item.funnelName : item.stepTitle,
                            )
                            .join(', ')} e altri ${selectedItems.length - 3}...`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="rounded-xl px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                  >
                    Deseleziona tutto
                  </button>
                  <button
                    type="button"
                    className="rounded-xl bg-amber-500 px-5 py-2 text-sm font-bold text-white shadow-md hover:bg-amber-400 transition-colors flex items-center gap-2"
                    onClick={() => {
                      console.log('Selected items:', selectedItems);
                    }}
                  >
                    <Zap className="h-4 w-4" />
                    Usa selezione
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════ Detail Modal ══════ */}
      {detailFunnel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col">
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-amber-50 to-orange-50 px-6 py-4">
              <div className="flex items-center gap-3 min-w-0">
                <LayoutList className="h-6 w-6 text-amber-500 shrink-0" />
                <div className="min-w-0">
                  <h3 className="font-bold text-slate-800 truncate">{detailFunnel.funnel_name}</h3>
                  <p className="text-xs text-slate-500">
                    {FUNNEL_TYPE_LABELS[detailFunnel.funnel_type] ?? detailFunnel.funnel_type}{' '}
                    &middot; {CATEGORY_LABELS[detailFunnel.category] ?? detailFunnel.category}{' '}
                    &middot; {detailFunnel.total_steps} step
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailFunnel(null)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Summary */}
              {detailFunnel.analysis_summary && (
                <div className="rounded-xl border border-amber-200/60 bg-amber-50/50 p-4">
                  <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 mb-2">
                    <Sparkles className="h-4 w-4 text-amber-500" />
                    Analisi AI
                  </h4>
                  <p className="text-sm text-slate-700 leading-relaxed">
                    {detailFunnel.analysis_summary}
                  </p>
                </div>
              )}

              {/* Info grid */}
              <div className="grid grid-cols-2 gap-3">
                {detailFunnel.brand_name && (
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-0.5">
                      Brand
                    </p>
                    <p className="text-sm font-medium text-slate-800">{detailFunnel.brand_name}</p>
                  </div>
                )}
                {detailFunnel.lead_capture_method &&
                  detailFunnel.lead_capture_method !== 'none' && (
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-0.5">
                        Lead Capture
                      </p>
                      <p className="text-sm font-medium text-slate-800">
                        {detailFunnel.lead_capture_method}
                      </p>
                    </div>
                  )}
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-0.5">
                    Entry URL
                  </p>
                  <a
                    href={detailFunnel.entry_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-amber-600 hover:underline truncate block"
                  >
                    {detailFunnel.entry_url}
                  </a>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-0.5">
                    Salvato il
                  </p>
                  <p className="text-sm font-medium text-slate-800">
                    {formatDate(detailFunnel.created_at)}
                  </p>
                </div>
              </div>

              {/* Tags */}
              {detailFunnel.tags.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1">
                    <Tag className="h-3.5 w-3.5" />
                    Tags
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {detailFunnel.tags.map((tag, i) => (
                      <span
                        key={i}
                        className="rounded-md bg-amber-50 px-2 py-0.5 text-xs text-amber-700 border border-amber-200/60"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Persuasion techniques */}
              {detailFunnel.persuasion_techniques.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1">
                    <Lightbulb className="h-3.5 w-3.5" />
                    Tecniche di persuasione
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {detailFunnel.persuasion_techniques.map((tech, i) => (
                      <span
                        key={i}
                        className="rounded-md bg-violet-50 px-2 py-0.5 text-xs text-violet-700 border border-violet-200/60"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Notable elements */}
              {detailFunnel.notable_elements.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1">
                    <Eye className="h-3.5 w-3.5" />
                    Elementi notevoli
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {detailFunnel.notable_elements.map((el, i) => (
                      <span
                        key={i}
                        className="rounded-md bg-teal-50 px-2 py-0.5 text-xs text-teal-700 border border-teal-200/60"
                      >
                        {el}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Steps */}
              {(() => {
                const steps = parseSteps(detailFunnel.steps);
                if (steps.length === 0) return null;
                return (
                  <div>
                    <h4 className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1">
                      <FileStack className="h-3.5 w-3.5" />
                      Step del funnel ({steps.length})
                    </h4>
                    <div className="space-y-2">
                      {steps.map((step, idx) => {
                        const stepTypeColor =
                          STEP_TYPE_COLORS[step.step_type ?? 'other'] ?? STEP_TYPE_COLORS.other;
                        const stepIdx = step.step_index ?? idx + 1;
                        const stepSel = isStepSelected(detailFunnel.id, stepIdx);

                        return (
                          <div
                            key={idx}
                            className={`rounded-xl border p-3 cursor-pointer transition-colors ${
                              stepSel
                                ? 'border-amber-300 bg-amber-50/50 ring-1 ring-amber-200'
                                : 'border-slate-200 bg-white hover:border-amber-200'
                            }`}
                            onClick={() => toggleSelectStep(detailFunnel.id, stepIdx)}
                          >
                            <div className="flex items-center gap-2 flex-wrap">
                              <div
                                className={`shrink-0 ${
                                  stepSel ? 'text-amber-600' : 'text-slate-300'
                                }`}
                              >
                                {stepSel ? (
                                  <CheckCircle2 className="h-4 w-4" />
                                ) : (
                                  <Circle className="h-4 w-4" />
                                )}
                              </div>
                              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-700">
                                {stepIdx}
                              </span>
                              <span className="font-medium text-sm text-slate-800">
                                {step.title || 'Senza titolo'}
                              </span>
                              {step.step_type && (
                                <span
                                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${stepTypeColor}`}
                                >
                                  {step.step_type.replace(/_/g, ' ')}
                                </span>
                              )}
                              {step.input_type && step.input_type !== 'none' && (
                                <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                                  {step.input_type.replace(/_/g, ' ')}
                                </span>
                              )}
                            </div>
                            {step.description && (
                              <p className="mt-1 text-xs text-slate-600 ml-6">{step.description}</p>
                            )}
                            {step.cta_text && (
                              <span className="mt-1.5 ml-6 inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700 border border-emerald-200/60">
                                <Zap className="h-3 w-3" />
                                {step.cta_text}
                              </span>
                            )}
                            {step.options && step.options.length > 0 && (
                              <div className="mt-1.5 ml-6 flex flex-wrap gap-1">
                                {step.options.map((opt, oi) => (
                                  <span
                                    key={oi}
                                    className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600"
                                  >
                                    {opt}
                                  </span>
                                ))}
                              </div>
                            )}
                            {step.url && (
                              <a
                                href={step.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-1 ml-6 inline-flex items-center gap-1 text-[11px] text-amber-600 hover:underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <ExternalLink className="h-3 w-3" />
                                {step.url}
                              </a>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
