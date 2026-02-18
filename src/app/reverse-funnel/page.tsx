'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import { createClient } from '@supabase/supabase-js';
import type { AffiliateSavedFunnel, Json } from '@/types/database';
import {
  Search,
  FlipVertical,
  Loader2,
  ChevronDown,
  ChevronRight,
  Target,
  Brain,
  Zap,
  MessageSquare,
  ArrowRight,
  Shield,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  Eye,
  Heart,
  Users,
  Award,
  BarChart3,
  Globe,
  CheckCircle2,
  XCircle,
  ChevronUp,
} from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface FunnelStep {
  step_index: number;
  url?: string;
  title?: string;
  step_type?: string;
  input_type?: string;
  options?: string[];
  description?: string;
  cta_text?: string;
}

interface StepAnalysis {
  step_index: number;
  step_name: string;
  step_type: string;
  unique_mechanism: string;
  objective: string;
  psychological_triggers: string[];
  copywriting_framework: string;
  hook: string;
  angle: string;
  bridge_to_next: string;
  conversion_elements: {
    primary_cta: string;
    cta_style: string;
    secondary_ctas: string[];
    form_elements: string[];
    trust_signals: string[];
  };
  objections_handled: string[];
  micro_commitments: string[];
  emotional_state: {
    entry_emotion: string;
    exit_emotion: string;
  };
  effectiveness_notes: string;
}

interface FunnelOverview {
  funnel_architecture: string;
  global_unique_mechanism: string;
  big_promise: string;
  target_avatar: string;
  awareness_level: string;
  sophistication_level: string;
  customer_journey_emotions: string[];
  overall_effectiveness_score: number;
  copy_score: number;
  design_score: number;
  persuasion_score: number;
  flow_score: number;
  cta_score: number;
  strengths: string[];
  weaknesses: string[];
  optimization_suggestions: string[];
}

interface ReverseAnalysis {
  funnel_overview: FunnelOverview;
  steps_analysis: StepAnalysis[];
}

function parseSteps(raw: Json): FunnelStep[] {
  if (!Array.isArray(raw)) return [];
  return raw as unknown as FunnelStep[];
}

function ScoreBar({ score, label, color }: { score: number; label: string; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-slate-500 w-24 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{ width: `${score * 10}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs font-bold text-slate-700 w-8 text-right">{score}/10</span>
    </div>
  );
}

function EmotionJourney({ emotions }: { emotions: string[] }) {
  if (!emotions || emotions.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {emotions.map((emotion, i) => (
        <span key={i} className="flex items-center gap-1">
          <span className="text-xs px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200 font-medium">
            {emotion}
          </span>
          {i < emotions.length - 1 && (
            <ArrowRight className="h-3 w-3 text-violet-300 shrink-0" />
          )}
        </span>
      ))}
    </div>
  );
}

const STEP_TYPE_ICONS: Record<string, { icon: typeof Target; color: string; bg: string }> = {
  landing: { icon: Globe, color: '#3b82f6', bg: '#eff6ff' },
  quiz_question: { icon: Brain, color: '#8b5cf6', bg: '#f5f3ff' },
  lead_capture: { icon: Users, color: '#14b8a6', bg: '#f0fdfa' },
  checkout: { icon: Award, color: '#10b981', bg: '#ecfdf5' },
  upsell: { icon: TrendingUp, color: '#f59e0b', bg: '#fffbeb' },
  info_screen: { icon: Eye, color: '#3b82f6', bg: '#f0f9ff' },
  thank_you: { icon: Heart, color: '#22c55e', bg: '#f0fdf4' },
  other: { icon: Zap, color: '#94a3b8', bg: '#f8fafc' },
};

export default function ReverseFunnelPage() {
  const [funnels, setFunnels] = useState<AffiliateSavedFunnel[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFunnel, setSelectedFunnel] = useState<AffiliateSavedFunnel | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<ReverseAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());
  const [activeTab, setActiveTab] = useState<'overview' | 'steps' | 'json'>('overview');

  useEffect(() => {
    loadFunnels();
  }, []);

  async function loadFunnels() {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('affiliate_saved_funnels')
      .select('*')
      .order('created_at', { ascending: false });
    if (err) {
      console.error('Error loading funnels:', err);
    } else {
      setFunnels(data ?? []);
    }
    setLoading(false);
  }

  async function analyzeReverseFunnel(funnel: AffiliateSavedFunnel) {
    setAnalyzing(true);
    setError(null);
    setAnalysis(null);
    setExpandedSteps(new Set());
    setActiveTab('overview');

    try {
      const res = await fetch('/api/reverse-funnel/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          funnel: {
            funnel_name: funnel.funnel_name,
            brand_name: funnel.brand_name,
            entry_url: funnel.entry_url,
            funnel_type: funnel.funnel_type,
            category: funnel.category,
            tags: funnel.tags,
            total_steps: funnel.total_steps,
            steps: funnel.steps,
            analysis_summary: funnel.analysis_summary,
            persuasion_techniques: funnel.persuasion_techniques,
            lead_capture_method: funnel.lead_capture_method,
            notable_elements: funnel.notable_elements,
          },
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || 'Errore durante l\'analisi');
        return;
      }

      setAnalysis(data.analysis as ReverseAnalysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore di rete');
    } finally {
      setAnalyzing(false);
    }
  }

  function toggleStep(idx: number) {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  function expandAllSteps() {
    if (!analysis) return;
    setExpandedSteps(new Set(analysis.steps_analysis.map((_, i) => i)));
  }

  function collapseAllSteps() {
    setExpandedSteps(new Set());
  }

  const filteredFunnels = funnels.filter((f) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      f.funnel_name.toLowerCase().includes(q) ||
      (f.brand_name?.toLowerCase().includes(q) ?? false) ||
      f.entry_url.toLowerCase().includes(q) ||
      f.funnel_type.toLowerCase().includes(q) ||
      f.tags.some((t) => t.toLowerCase().includes(q))
    );
  });

  return (
    <div className="flex flex-col h-full">
      <Header title="Reverse Funnel" subtitle="Analisi AI con reverse engineering di ogni step del funnel" />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto flex gap-6">
          {/* Left Panel - Funnel Selector */}
          <div className="w-96 shrink-0">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden sticky top-0">
              <div className="px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-violet-50">
                <div className="flex items-center gap-2 mb-3">
                  <FlipVertical className="h-5 w-5 text-indigo-600" />
                  <h2 className="text-sm font-bold text-slate-800">Seleziona Funnel</h2>
                </div>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Cerca funnel..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>

              <div className="max-h-[calc(100vh-280px)] overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-5 w-5 text-slate-400 animate-spin" />
                  </div>
                ) : filteredFunnels.length === 0 ? (
                  <div className="text-center py-12 px-4">
                    <FlipVertical className="h-8 w-8 text-slate-200 mx-auto" />
                    <p className="mt-2 text-xs text-slate-400">Nessun funnel trovato</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {filteredFunnels.map((funnel) => {
                      const isSelected = selectedFunnel?.id === funnel.id;
                      const steps = parseSteps(funnel.steps);
                      return (
                        <button
                          key={funnel.id}
                          onClick={() => setSelectedFunnel(funnel)}
                          className={`w-full text-left px-4 py-3 transition-colors ${
                            isSelected
                              ? 'bg-indigo-50 border-l-2 border-indigo-500'
                              : 'hover:bg-slate-50 border-l-2 border-transparent'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className={`text-xs font-semibold truncate ${isSelected ? 'text-indigo-700' : 'text-slate-700'}`}>
                                {funnel.funnel_name}
                              </p>
                              {funnel.brand_name && (
                                <p className="text-[10px] text-slate-400 mt-0.5">{funnel.brand_name}</p>
                              )}
                              <div className="flex items-center gap-2 mt-1.5">
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                                  {funnel.funnel_type.replace(/_/g, ' ')}
                                </span>
                                <span className="text-[10px] text-slate-400">{steps.length} step</span>
                              </div>
                            </div>
                            {isSelected && <ChevronRight className="h-4 w-4 text-indigo-500 shrink-0 mt-0.5" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Panel - Analysis */}
          <div className="flex-1 min-w-0">
            {!selectedFunnel ? (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex items-center justify-center min-h-[500px]">
                <div className="text-center px-8">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center mx-auto">
                    <FlipVertical className="h-8 w-8 text-indigo-500" />
                  </div>
                  <h3 className="mt-4 text-lg font-bold text-slate-700">Reverse Funnel Engineering</h3>
                  <p className="mt-2 text-sm text-slate-400 max-w-md">
                    Seleziona un funnel dalla lista per analizzarlo con AI.
                    OpenAI analizzerà ogni step identificando il meccanismo unico,
                    i trigger psicologici, il framework di copywriting e molto altro.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Funnel Header Card */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 px-5 py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-white font-bold text-lg">{selectedFunnel.funnel_name}</h3>
                        <div className="flex items-center gap-3 mt-1">
                          {selectedFunnel.brand_name && (
                            <span className="text-indigo-200 text-xs">{selectedFunnel.brand_name}</span>
                          )}
                          <span className="text-indigo-200 text-xs">{selectedFunnel.funnel_type.replace(/_/g, ' ')}</span>
                          <span className="text-indigo-200 text-xs">{selectedFunnel.total_steps} step</span>
                        </div>
                      </div>
                      <button
                        onClick={() => analyzeReverseFunnel(selectedFunnel)}
                        disabled={analyzing}
                        className="flex items-center gap-2 px-4 py-2.5 bg-white text-indigo-700 rounded-lg font-semibold text-sm hover:bg-indigo-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                      >
                        {analyzing ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Analizzando...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4" />
                            Analizza con AI
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Steps Preview */}
                  <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50">
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                      {parseSteps(selectedFunnel.steps).map((step, i) => {
                        const typeInfo = STEP_TYPE_ICONS[step.step_type ?? 'other'] ?? STEP_TYPE_ICONS.other;
                        const Icon = typeInfo.icon;
                        return (
                          <span key={i} className="flex items-center gap-1">
                            <span
                              className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium whitespace-nowrap border"
                              style={{ backgroundColor: typeInfo.bg, color: typeInfo.color, borderColor: typeInfo.color + '30' }}
                            >
                              <Icon className="h-2.5 w-2.5" />
                              {step.title || `Step ${step.step_index}`}
                            </span>
                            {i < parseSteps(selectedFunnel.steps).length - 1 && (
                              <ArrowRight className="h-3 w-3 text-slate-300 shrink-0" />
                            )}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-red-700">Errore nell&apos;analisi</p>
                      <p className="text-xs text-red-600 mt-0.5">{error}</p>
                    </div>
                  </div>
                )}

                {/* Loading state */}
                {analyzing && (
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex items-center justify-center py-20">
                    <div className="text-center">
                      <div className="relative">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center mx-auto animate-pulse">
                          <Brain className="h-8 w-8 text-indigo-500" />
                        </div>
                        <div className="absolute -top-1 -right-1 w-6 h-6 bg-amber-400 rounded-full flex items-center justify-center animate-bounce">
                          <Sparkles className="h-3 w-3 text-white" />
                        </div>
                      </div>
                      <p className="mt-4 text-sm font-semibold text-slate-700">Reverse Engineering in corso...</p>
                      <p className="mt-1 text-xs text-slate-400">OpenAI sta analizzando ogni step del funnel</p>
                      <div className="mt-4 flex items-center justify-center gap-1">
                        {[0, 1, 2, 3, 4].map((i) => (
                          <div
                            key={i}
                            className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"
                            style={{ animationDelay: `${i * 200}ms` }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Analysis Results */}
                {analysis && !analyzing && (
                  <div className="space-y-4">
                    {/* Tabs */}
                    <div className="flex items-center gap-1 bg-white rounded-xl border border-slate-200 p-1 shadow-sm">
                      {(['overview', 'steps', 'json'] as const).map((tab) => (
                        <button
                          key={tab}
                          onClick={() => setActiveTab(tab)}
                          className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            activeTab === tab
                              ? 'bg-indigo-600 text-white shadow-sm'
                              : 'text-slate-500 hover:bg-slate-50'
                          }`}
                        >
                          {tab === 'overview' ? 'Overview Globale' : tab === 'steps' ? 'Analisi Step' : 'JSON Raw'}
                        </button>
                      ))}
                    </div>

                    {/* OVERVIEW TAB */}
                    {activeTab === 'overview' && analysis.funnel_overview && (
                      <div className="space-y-4">
                        {/* Big Mechanism & Promise */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                          <div className="px-5 py-3 border-b border-slate-100 bg-gradient-to-r from-amber-50 to-orange-50">
                            <div className="flex items-center gap-2">
                              <Target className="h-4 w-4 text-amber-600" />
                              <h4 className="text-sm font-bold text-slate-800">Meccanismo Unico Globale</h4>
                            </div>
                          </div>
                          <div className="p-5 space-y-4">
                            <div>
                              <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Unique Mechanism</p>
                              <p className="text-sm text-slate-700 leading-relaxed">{analysis.funnel_overview.global_unique_mechanism}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Big Promise</p>
                              <p className="text-sm text-slate-700 leading-relaxed">{analysis.funnel_overview.big_promise}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Target Avatar</p>
                                <p className="text-sm text-slate-700">{analysis.funnel_overview.target_avatar}</p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Architettura</p>
                                <p className="text-sm text-slate-700">{analysis.funnel_overview.funnel_architecture}</p>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Awareness Level</p>
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                                  {analysis.funnel_overview.awareness_level}
                                </span>
                              </div>
                              <div>
                                <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Market Sophistication</p>
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
                                  Level {analysis.funnel_overview.sophistication_level}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Customer Journey Emotions */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                          <div className="px-5 py-3 border-b border-slate-100 bg-gradient-to-r from-violet-50 to-purple-50">
                            <div className="flex items-center gap-2">
                              <Heart className="h-4 w-4 text-violet-600" />
                              <h4 className="text-sm font-bold text-slate-800">Customer Journey Emotivo</h4>
                            </div>
                          </div>
                          <div className="p-5">
                            <EmotionJourney emotions={analysis.funnel_overview.customer_journey_emotions} />
                          </div>
                        </div>

                        {/* Scores */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                          <div className="px-5 py-3 border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-teal-50">
                            <div className="flex items-center gap-2">
                              <BarChart3 className="h-4 w-4 text-emerald-600" />
                              <h4 className="text-sm font-bold text-slate-800">Scoring di Efficacia</h4>
                            </div>
                          </div>
                          <div className="p-5">
                            <div className="flex items-center gap-4 mb-5">
                              <div className="flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg">
                                <span className="text-2xl font-black text-white">{analysis.funnel_overview.overall_effectiveness_score}</span>
                              </div>
                              <div>
                                <p className="text-lg font-bold text-slate-800">Punteggio Globale</p>
                                <p className="text-xs text-slate-400">Efficacia complessiva del funnel</p>
                              </div>
                            </div>
                            <div className="space-y-3">
                              <ScoreBar score={analysis.funnel_overview.copy_score} label="Copywriting" color="#8b5cf6" />
                              <ScoreBar score={analysis.funnel_overview.design_score} label="Design" color="#3b82f6" />
                              <ScoreBar score={analysis.funnel_overview.persuasion_score} label="Persuasione" color="#f59e0b" />
                              <ScoreBar score={analysis.funnel_overview.flow_score} label="Flow/UX" color="#10b981" />
                              <ScoreBar score={analysis.funnel_overview.cta_score} label="CTA" color="#ef4444" />
                            </div>
                          </div>
                        </div>

                        {/* Strengths & Weaknesses */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="px-5 py-3 border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-green-50">
                              <div className="flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                <h4 className="text-sm font-bold text-slate-800">Punti di Forza</h4>
                              </div>
                            </div>
                            <div className="p-4 space-y-2">
                              {analysis.funnel_overview.strengths?.map((s, i) => (
                                <div key={i} className="flex items-start gap-2">
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                                  <p className="text-xs text-slate-600 leading-relaxed">{s}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="px-5 py-3 border-b border-slate-100 bg-gradient-to-r from-red-50 to-orange-50">
                              <div className="flex items-center gap-2">
                                <XCircle className="h-4 w-4 text-red-500" />
                                <h4 className="text-sm font-bold text-slate-800">Punti Deboli</h4>
                              </div>
                            </div>
                            <div className="p-4 space-y-2">
                              {analysis.funnel_overview.weaknesses?.map((w, i) => (
                                <div key={i} className="flex items-start gap-2">
                                  <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
                                  <p className="text-xs text-slate-600 leading-relaxed">{w}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Optimization Suggestions */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                          <div className="px-5 py-3 border-b border-slate-100 bg-gradient-to-r from-sky-50 to-blue-50">
                            <div className="flex items-center gap-2">
                              <Lightbulb className="h-4 w-4 text-sky-600" />
                              <h4 className="text-sm font-bold text-slate-800">Suggerimenti di Ottimizzazione</h4>
                            </div>
                          </div>
                          <div className="p-4 space-y-2">
                            {analysis.funnel_overview.optimization_suggestions?.map((s, i) => (
                              <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-sky-50/50">
                                <Lightbulb className="h-3.5 w-3.5 text-sky-500 shrink-0 mt-0.5" />
                                <p className="text-xs text-slate-600 leading-relaxed">{s}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* STEPS TAB */}
                    {activeTab === 'steps' && analysis.steps_analysis && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-slate-400">{analysis.steps_analysis.length} step analizzati</p>
                          <div className="flex items-center gap-2">
                            <button onClick={expandAllSteps} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1">
                              <ChevronDown className="h-3 w-3" /> Espandi tutti
                            </button>
                            <button onClick={collapseAllSteps} className="text-xs text-slate-400 hover:text-slate-600 font-medium flex items-center gap-1">
                              <ChevronUp className="h-3 w-3" /> Comprimi tutti
                            </button>
                          </div>
                        </div>

                        {analysis.steps_analysis.map((step, idx) => {
                          const isExpanded = expandedSteps.has(idx);
                          const typeInfo = STEP_TYPE_ICONS[step.step_type ?? 'other'] ?? STEP_TYPE_ICONS.other;
                          const Icon = typeInfo.icon;

                          return (
                            <div key={idx} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                              <button
                                onClick={() => toggleStep(idx)}
                                className="w-full flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors"
                              >
                                <div
                                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                                  style={{ backgroundColor: typeInfo.bg }}
                                >
                                  <Icon className="h-4 w-4" style={{ color: typeInfo.color }} />
                                </div>
                                <div className="flex-1 text-left min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-white px-1.5 py-0.5 rounded" style={{ backgroundColor: typeInfo.color }}>
                                      STEP {step.step_index}
                                    </span>
                                    <span className="text-sm font-semibold text-slate-700 truncate">{step.step_name}</span>
                                  </div>
                                  <p className="text-[11px] text-slate-400 mt-0.5 truncate">{step.unique_mechanism}</p>
                                </div>
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
                                )}
                              </button>

                              {isExpanded && (
                                <div className="px-5 pb-5 border-t border-slate-100 space-y-4 pt-4">
                                  {/* Unique Mechanism */}
                                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                                    <div className="flex items-center gap-2 mb-1.5">
                                      <Target className="h-3.5 w-3.5 text-amber-600" />
                                      <p className="text-xs font-bold text-amber-800">Meccanismo Unico</p>
                                    </div>
                                    <p className="text-xs text-amber-700 leading-relaxed">{step.unique_mechanism}</p>
                                  </div>

                                  {/* Objective */}
                                  <div>
                                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Obiettivo</p>
                                    <p className="text-xs text-slate-700 leading-relaxed">{step.objective}</p>
                                  </div>

                                  {/* Hook & Angle */}
                                  <div className="grid grid-cols-2 gap-3">
                                    <div className="p-3 rounded-lg bg-indigo-50 border border-indigo-200">
                                      <p className="text-[10px] text-indigo-500 uppercase tracking-wider mb-1">Hook</p>
                                      <p className="text-xs text-indigo-800 font-medium">{step.hook}</p>
                                    </div>
                                    <div className="p-3 rounded-lg bg-violet-50 border border-violet-200">
                                      <p className="text-[10px] text-violet-500 uppercase tracking-wider mb-1">Angolo</p>
                                      <p className="text-xs text-violet-800 font-medium">{step.angle}</p>
                                    </div>
                                  </div>

                                  {/* Copywriting Framework */}
                                  <div>
                                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Framework di Copywriting</p>
                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
                                      <MessageSquare className="h-3 w-3" />
                                      {step.copywriting_framework}
                                    </span>
                                  </div>

                                  {/* Psychological Triggers */}
                                  <div>
                                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-1.5">Trigger Psicologici</p>
                                    <div className="flex flex-wrap gap-1.5">
                                      {step.psychological_triggers?.map((t, i) => (
                                        <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-rose-50 text-rose-700 border border-rose-200">
                                          <Brain className="h-2.5 w-2.5" />
                                          {t}
                                        </span>
                                      ))}
                                    </div>
                                  </div>

                                  {/* Emotional State */}
                                  {step.emotional_state && (
                                    <div className="flex items-center gap-3 p-3 rounded-lg bg-violet-50 border border-violet-200">
                                      <div className="text-center">
                                        <p className="text-[9px] text-violet-500 uppercase tracking-wider">Entrata</p>
                                        <p className="text-xs font-semibold text-violet-700 mt-0.5">{step.emotional_state.entry_emotion}</p>
                                      </div>
                                      <ArrowRight className="h-4 w-4 text-violet-400 shrink-0" />
                                      <div className="text-center">
                                        <p className="text-[9px] text-violet-500 uppercase tracking-wider">Uscita</p>
                                        <p className="text-xs font-semibold text-violet-700 mt-0.5">{step.emotional_state.exit_emotion}</p>
                                      </div>
                                    </div>
                                  )}

                                  {/* Conversion Elements */}
                                  {step.conversion_elements && (
                                    <div>
                                      <p className="text-xs text-slate-400 uppercase tracking-wider mb-1.5">Elementi di Conversione</p>
                                      <div className="space-y-2">
                                        {step.conversion_elements.primary_cta && (
                                          <div className="flex items-center gap-2">
                                            <Zap className="h-3 w-3 text-emerald-500" />
                                            <span className="text-xs text-slate-600">
                                              CTA: <span className="font-semibold text-emerald-700">{step.conversion_elements.primary_cta}</span>
                                            </span>
                                          </div>
                                        )}
                                        {step.conversion_elements.trust_signals && step.conversion_elements.trust_signals.length > 0 && (
                                          <div className="flex flex-wrap gap-1">
                                            {step.conversion_elements.trust_signals.map((ts, i) => (
                                              <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                <Shield className="h-2.5 w-2.5" />
                                                {ts}
                                              </span>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  {/* Objections Handled */}
                                  {step.objections_handled && step.objections_handled.length > 0 && (
                                    <div>
                                      <p className="text-xs text-slate-400 uppercase tracking-wider mb-1.5">Obiezioni Gestite</p>
                                      <div className="space-y-1">
                                        {step.objections_handled.map((obj, i) => (
                                          <div key={i} className="flex items-start gap-2">
                                            <Shield className="h-3 w-3 text-blue-500 shrink-0 mt-0.5" />
                                            <p className="text-xs text-slate-600">{obj}</p>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Micro Commitments */}
                                  {step.micro_commitments && step.micro_commitments.length > 0 && (
                                    <div>
                                      <p className="text-xs text-slate-400 uppercase tracking-wider mb-1.5">Micro-Commitments</p>
                                      <div className="flex flex-wrap gap-1.5">
                                        {step.micro_commitments.map((mc, i) => (
                                          <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-sky-50 text-sky-700 border border-sky-200">
                                            <CheckCircle2 className="h-2.5 w-2.5" />
                                            {mc}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Bridge to Next */}
                                  {step.bridge_to_next && (
                                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                                      <div className="flex items-center gap-2 mb-1">
                                        <ArrowRight className="h-3.5 w-3.5 text-slate-500" />
                                        <p className="text-xs font-bold text-slate-600">Transizione al Prossimo Step</p>
                                      </div>
                                      <p className="text-xs text-slate-500 leading-relaxed">{step.bridge_to_next}</p>
                                    </div>
                                  )}

                                  {/* Effectiveness Notes */}
                                  {step.effectiveness_notes && (
                                    <div className="p-3 rounded-lg bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200">
                                      <div className="flex items-center gap-2 mb-1">
                                        <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                                        <p className="text-xs font-bold text-emerald-700">Note sull&apos;Efficacia</p>
                                      </div>
                                      <p className="text-xs text-emerald-600 leading-relaxed">{step.effectiveness_notes}</p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* JSON TAB */}
                    {activeTab === 'json' && (
                      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                          <h4 className="text-sm font-bold text-slate-800">JSON Response</h4>
                          <button
                            onClick={() => navigator.clipboard.writeText(JSON.stringify(analysis, null, 2))}
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                          >
                            Copia JSON
                          </button>
                        </div>
                        <pre className="p-5 text-xs text-slate-600 overflow-auto max-h-[600px] bg-slate-50 font-mono leading-relaxed">
                          {JSON.stringify(analysis, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
