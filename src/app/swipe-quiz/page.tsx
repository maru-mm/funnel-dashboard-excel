'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import Header from '@/components/Header';
import { useStore } from '@/store/useStore';
import { fetchAffiliateSavedFunnels } from '@/lib/supabase-operations';
import type { AffiliateSavedFunnel } from '@/types/database';
import {
  Play,
  Loader2,
  Code2,
  Eye,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  Download,
  Maximize2,
  Minimize2,
  Zap,
  HelpCircle,
  ShoppingCart,
  Heart,
  Utensils,
  Dumbbell,
  Palette,
  Globe,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Layers,
  RefreshCw,
  FileText,
} from 'lucide-react';

interface UsageInfo {
  input_tokens: number;
  output_tokens: number;
}

interface AffiliateFunnelStep {
  step_index: number;
  url: string;
  title: string;
  step_type?: string;
  input_type?: string;
  options?: string[];
  description?: string;
  cta_text?: string;
}

const PRESET_QUIZZES = [
  {
    icon: ShoppingCart,
    label: 'Product Finder',
    color: 'from-blue-500 to-cyan-500',
    prompt:
      'Quiz "Trova il prodotto perfetto per te" con 5 domande sulle preferenze dell\'utente (budget, stile, utilizzo) e 3 profili risultato con raccomandazione prodotto. Design elegante con gradiente blu/viola.',
  },
  {
    icon: Heart,
    label: 'Skincare Routine',
    color: 'from-pink-500 to-rose-500',
    prompt:
      'Quiz "Scopri la tua routine skincare ideale" con 6 domande sul tipo di pelle, età, problematiche. 4 risultati possibili con routine personalizzata. Design femminile con colori rosa/corallo e icone carine.',
  },
  {
    icon: Utensils,
    label: 'Dieta Ideale',
    color: 'from-green-500 to-emerald-500',
    prompt:
      'Quiz "Qual è la dieta giusta per te?" con 7 domande su obiettivi, allergie, stile di vita. 4 profili dieta risultato. Design fresco con colori verdi e illustrazioni di cibo. Includi progress bar animata.',
  },
  {
    icon: Dumbbell,
    label: 'Fitness Plan',
    color: 'from-orange-500 to-amber-500',
    prompt:
      'Quiz "Il tuo piano fitness personalizzato" con 6 domande su livello, obiettivi, tempo disponibile. 3 piani risultato (principiante, intermedio, avanzato). Design energetico con colori arancio/giallo.',
  },
  {
    icon: Palette,
    label: 'Brand Personality',
    color: 'from-purple-500 to-violet-500',
    prompt:
      'Quiz "Scopri la personalità del tuo brand" con 5 domande su valori, target, tono di voce. 4 archetipi di brand come risultato. Design creativo con gradiente viola e animazioni moderne.',
  },
  {
    icon: HelpCircle,
    label: 'Lead Magnet',
    color: 'from-indigo-500 to-blue-600',
    prompt:
      'Quiz lead magnet "Quanto ne sai di marketing digitale?" con 8 domande a risposta multipla, punteggio finale con livello (novice, intermedio, esperto) e call-to-action per scaricare una guida gratuita. Design professionale.',
  },
];

export default function SwipeQuizPage() {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCode, setGeneratedCode] = useState('');
  const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview');
  const [copied, setCopied] = useState(false);
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [streamProgress, setStreamProgress] = useState(0);

  // Existing funnels from store + Supabase
  const { funnelPages, isInitialized } = useStore();
  const [affiliateFunnels, setAffiliateFunnels] = useState<AffiliateSavedFunnel[]>([]);
  const [affiliateLoading, setAffiliateLoading] = useState(false);
  const [showMyFunnels, setShowMyFunnels] = useState(true);
  const [expandedFunnelId, setExpandedFunnelId] = useState<string | null>(null);

  // Filter quiz-type funnel pages from the store
  const quizFunnelPages = useMemo(
    () => funnelPages.filter((p) => p.pageType === 'quiz_funnel'),
    [funnelPages]
  );

  // Filter affiliate funnels that are quiz-type
  const quizAffiliateFunnels = useMemo(
    () => affiliateFunnels.filter((f) =>
      f.funnel_type?.toLowerCase().includes('quiz') ||
      f.category?.toLowerCase().includes('quiz') ||
      (Array.isArray(f.steps) && (f.steps as unknown as AffiliateFunnelStep[]).some(
        (s) => s.step_type === 'quiz_question' || s.step_type === 'info_screen'
      ))
    ),
    [affiliateFunnels]
  );

  // All affiliate funnels (non-quiz) as fallback
  const otherAffiliateFunnels = useMemo(
    () => affiliateFunnels.filter((f) =>
      !quizAffiliateFunnels.some((q) => q.id === f.id)
    ),
    [affiliateFunnels, quizAffiliateFunnels]
  );

  const loadAffiliateFunnels = useCallback(async () => {
    setAffiliateLoading(true);
    try {
      const data = await fetchAffiliateSavedFunnels();
      setAffiliateFunnels(data);
    } catch (err) {
      console.error('Errore caricamento affiliate funnels:', err);
    } finally {
      setAffiliateLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAffiliateFunnels();
  }, [loadAffiliateFunnels]);

  const buildPromptFromFunnel = (funnel: AffiliateSavedFunnel): string => {
    const steps = Array.isArray(funnel.steps)
      ? (funnel.steps as unknown as AffiliateFunnelStep[])
      : [];
    const quizSteps = steps.filter(
      (s) => s.step_type === 'quiz_question' || s.step_type === 'info_screen'
    );

    const stepsDescription = (quizSteps.length > 0 ? quizSteps : steps)
      .slice(0, 10)
      .map((s) => {
        let desc = `Step ${s.step_index}: "${s.title || 'Senza titolo'}"`;
        if (s.step_type) desc += ` (tipo: ${s.step_type})`;
        if (s.options && s.options.length > 0)
          desc += ` — Opzioni: ${s.options.join(', ')}`;
        if (s.description) desc += ` — ${s.description}`;
        return desc;
      })
      .join('\n');

    const techniques = funnel.persuasion_techniques?.length
      ? `\nTecniche di persuasione: ${funnel.persuasion_techniques.join(', ')}`
      : '';
    const elements = funnel.notable_elements?.length
      ? `\nElementi notevoli: ${funnel.notable_elements.join(', ')}`
      : '';
    const analysis = funnel.analysis_summary
      ? `\nAnalisi: ${funnel.analysis_summary}`
      : '';

    return `Crea un quiz interattivo ispirato al funnel "${funnel.funnel_name}" (${funnel.brand_name || 'brand generico'}).
Tipo funnel: ${funnel.funnel_type || 'quiz'}
Categoria: ${funnel.category || 'generale'}
URL originale: ${funnel.entry_url}
Numero step originali: ${funnel.total_steps}
${techniques}${elements}${analysis}

STRUTTURA DEGLI STEP DEL QUIZ ORIGINALE:
${stepsDescription || 'Nessuno step disponibile'}

Genera un quiz HTML/CSS/JS con lo stesso stile e struttura ma con design moderno, colori accattivanti, progress bar animata e pagina risultati finale.`;
  };

  const buildPromptFromFunnelPage = (page: {
    name: string;
    urlToSwipe: string;
    prompt?: string;
    extractedData?: {
      headline: string;
      subheadline: string;
      cta: string[];
      benefits: string[];
    };
  }): string => {
    const extracted = page.extractedData;
    const details = extracted
      ? `\nHeadline originale: "${extracted.headline}"
Subheadline: "${extracted.subheadline}"
CTA: ${extracted.cta?.join(', ') || 'N/A'}
Benefici: ${extracted.benefits?.join(', ') || 'N/A'}`
      : '';

    return `Crea un quiz interattivo ispirato alla pagina "${page.name}".
URL originale: ${page.urlToSwipe}
${page.prompt ? `Note: ${page.prompt}` : ''}${details}

Genera un quiz HTML/CSS/JS con 5-7 domande, design moderno, progress bar e pagina risultati. Il quiz deve catturare l'utente e portarlo a una raccomandazione prodotto.`;
  };

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const codeRef = useRef<HTMLPreElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const updateIframe = useCallback((html: string) => {
    if (iframeRef.current) {
      iframeRef.current.srcdoc = html;
    }
  }, []);

  useEffect(() => {
    if (codeRef.current) {
      codeRef.current.scrollTop = codeRef.current.scrollHeight;
    }
  }, [generatedCode]);

  const generateQuiz = async (customPrompt?: string) => {
    const finalPrompt = customPrompt || prompt;
    if (!finalPrompt.trim() || isGenerating) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsGenerating(true);
    setGeneratedCode('');
    setUsage(null);
    setError(null);
    setStreamProgress(0);
    setActiveTab('preview');

    let accumulated = '';

    try {
      const response = await fetch('/api/swipe-quiz/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: finalPrompt }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || `Errore HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('Impossibile leggere lo stream');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6);

          try {
            const data = JSON.parse(jsonStr);

            if (data.error) {
              setError(data.error);
              break;
            }

            if (data.done) {
              setUsage(data.usage || null);
              break;
            }

            if (data.text) {
              accumulated += data.text;
              setGeneratedCode(accumulated);
              setStreamProgress((prev) => Math.min(prev + 0.5, 95));

              if (
                accumulated.includes('</style>') ||
                accumulated.includes('</body>') ||
                accumulated.includes('</html>')
              ) {
                updateIframe(accumulated);
              }
            }
          } catch {
            // skip malformed JSON chunks
          }
        }
      }

      if (accumulated) {
        updateIframe(accumulated);
        setStreamProgress(100);
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      setError(
        err instanceof Error ? err.message : 'Errore durante la generazione'
      );
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  const stopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsGenerating(false);
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(generatedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadHtml = () => {
    const blob = new Blob([generatedCode], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'swipe-quiz.html';
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetAll = () => {
    stopGeneration();
    setPrompt('');
    setGeneratedCode('');
    setUsage(null);
    setError(null);
    setStreamProgress(0);
    if (iframeRef.current) {
      iframeRef.current.srcdoc = '';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        title="Swipe Quiz"
        subtitle="Genera quiz interattivi con AI — Preview live in tempo reale"
      />

      <div className="p-6">
        {/* Prompt + Presets Row */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-purple-500" />
            <h2 className="font-semibold text-gray-900">
              Descrivi il quiz che vuoi generare
            </h2>
          </div>

          {/* Prompt Input */}
          <div className="flex gap-3 mb-5">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  generateQuiz();
                }
              }}
              placeholder='Es: "Quiz per trovare il prodotto beauty perfetto, 5 domande, design rosa e oro, con progress bar e risultati personalizzati"'
              rows={3}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none resize-none text-sm"
              disabled={isGenerating}
            />
            <div className="flex flex-col gap-2">
              {isGenerating ? (
                <button
                  onClick={stopGeneration}
                  className="flex items-center gap-2 px-5 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                >
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Stop
                </button>
              ) : (
                <button
                  onClick={() => generateQuiz()}
                  disabled={!prompt.trim()}
                  className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed text-sm font-medium shadow-sm"
                >
                  <Play className="w-4 h-4" />
                  Genera
                </button>
              )}
              <button
                onClick={resetAll}
                className="flex items-center gap-2 px-5 py-3 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors text-sm"
              >
                <RotateCcw className="w-4 h-4" />
                Reset
              </button>
            </div>
          </div>

          {/* Preset Templates */}
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
              Template rapidi
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
              {PRESET_QUIZZES.map((preset) => {
                const Icon = preset.icon;
                return (
                  <button
                    key={preset.label}
                    onClick={() => {
                      setPrompt(preset.prompt);
                      generateQuiz(preset.prompt);
                    }}
                    disabled={isGenerating}
                    className="group flex flex-col items-center gap-2 p-3 rounded-lg border border-gray-200 hover:border-transparent hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div
                      className={`w-10 h-10 rounded-lg bg-gradient-to-br ${preset.color} flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform`}
                    >
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-xs font-medium text-gray-700 text-center leading-tight">
                      {preset.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* My Quiz Funnels Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6 overflow-hidden">
          <button
            onClick={() => setShowMyFunnels(!showMyFunnels)}
            className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-500" />
              <h2 className="font-semibold text-gray-900">I miei Quiz Funnel</h2>
              <span className="text-xs bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full font-medium">
                {quizFunnelPages.length + quizAffiliateFunnels.length + otherAffiliateFunnels.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {affiliateLoading && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  loadAffiliateFunnels();
                }}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors"
                title="Ricarica funnel"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              {showMyFunnels ? (
                <ChevronUp className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              )}
            </div>
          </button>

          {showMyFunnels && (
            <div className="px-6 pb-6 border-t border-gray-100 pt-4">
              {/* Quiz Funnel Pages from Store */}
              {quizFunnelPages.length > 0 && (
                <div className="mb-5">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    Front End Funnel Pages (quiz)
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {quizFunnelPages.map((page) => (
                      <button
                        key={page.id}
                        onClick={() => {
                          const p = buildPromptFromFunnelPage(page);
                          setPrompt(p);
                          generateQuiz(p);
                        }}
                        disabled={isGenerating}
                        className="group text-left p-4 rounded-lg border border-gray-200 hover:border-indigo-300 hover:shadow-md transition-all disabled:opacity-50"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <span className="text-sm font-medium text-gray-800 line-clamp-1 group-hover:text-indigo-700 transition-colors">
                            {page.name}
                          </span>
                          <Sparkles className="w-4 h-4 text-gray-300 group-hover:text-indigo-500 shrink-0 ml-2 transition-colors" />
                        </div>
                        <p className="text-xs text-gray-400 truncate mb-1.5">{page.urlToSwipe}</p>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                            page.swipeStatus === 'completed'
                              ? 'bg-green-100 text-green-700'
                              : page.swipeStatus === 'in_progress'
                                ? 'bg-yellow-100 text-yellow-700'
                                : page.swipeStatus === 'failed'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-gray-100 text-gray-500'
                          }`}>
                            {page.swipeStatus}
                          </span>
                          {page.extractedData && (
                            <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">
                              dati estratti
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Quiz-type Affiliate Funnels */}
              {quizAffiliateFunnels.length > 0 && (
                <div className="mb-5">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5" />
                    Quiz Funnel Salvati ({quizAffiliateFunnels.length})
                  </p>
                  <div className="space-y-2">
                    {quizAffiliateFunnels.map((funnel) => {
                      const steps = Array.isArray(funnel.steps)
                        ? (funnel.steps as unknown as AffiliateFunnelStep[])
                        : [];
                      const isExpanded = expandedFunnelId === funnel.id;

                      return (
                        <div
                          key={funnel.id}
                          className="border border-gray-200 rounded-lg overflow-hidden hover:border-indigo-200 transition-colors"
                        >
                          <div className="flex items-center gap-3 p-3">
                            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0">
                              <HelpCircle className="w-4 h-4 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-800 truncate">
                                  {funnel.funnel_name}
                                </span>
                                {funnel.brand_name && (
                                  <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded shrink-0">
                                    {funnel.brand_name}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs text-gray-400 truncate">{funnel.entry_url}</span>
                                <span className="text-[10px] bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded shrink-0">
                                  {funnel.total_steps} step
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                onClick={() =>
                                  setExpandedFunnelId(isExpanded ? null : funnel.id)
                                }
                                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors"
                                title="Mostra step"
                              >
                                {isExpanded ? (
                                  <ChevronUp className="w-4 h-4" />
                                ) : (
                                  <ChevronDown className="w-4 h-4" />
                                )}
                              </button>
                              <a
                                href={funnel.entry_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 text-gray-400 hover:text-blue-600 rounded-md hover:bg-blue-50 transition-colors"
                                onClick={(e) => e.stopPropagation()}
                                title="Apri URL originale"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                              <button
                                onClick={() => {
                                  const p = buildPromptFromFunnel(funnel);
                                  setPrompt(p);
                                  generateQuiz(p);
                                }}
                                disabled={isGenerating}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-xs font-medium rounded-md hover:from-indigo-600 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <Sparkles className="w-3.5 h-3.5" />
                                Genera Quiz
                              </button>
                            </div>
                          </div>

                          {/* Expanded step details */}
                          {isExpanded && steps.length > 0 && (
                            <div className="border-t border-gray-100 bg-gray-50 p-3">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {steps.slice(0, 12).map((step, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-start gap-2 p-2 bg-white rounded-md border border-gray-100 text-xs"
                                  >
                                    <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 text-[10px] font-bold">
                                      {step.step_index}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                      <p className="font-medium text-gray-700 truncate">
                                        {step.title || 'Senza titolo'}
                                      </p>
                                      {step.step_type && (
                                        <span
                                          className={`inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                            step.step_type === 'quiz_question'
                                              ? 'bg-indigo-50 text-indigo-600'
                                              : step.step_type === 'lead_capture'
                                                ? 'bg-amber-50 text-amber-600'
                                                : step.step_type === 'info_screen'
                                                  ? 'bg-cyan-50 text-cyan-600'
                                                  : 'bg-gray-100 text-gray-500'
                                          }`}
                                        >
                                          {step.step_type}
                                        </span>
                                      )}
                                      {step.options && step.options.length > 0 && (
                                        <p className="text-gray-400 mt-0.5 truncate">
                                          {step.options.join(' · ')}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                              {steps.length > 12 && (
                                <p className="text-xs text-gray-400 mt-2 text-center">
                                  +{steps.length - 12} altri step
                                </p>
                              )}
                              {funnel.persuasion_techniques && funnel.persuasion_techniques.length > 0 && (
                                <div className="mt-3 flex flex-wrap gap-1">
                                  {funnel.persuasion_techniques.map((t, i) => (
                                    <span
                                      key={i}
                                      className="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded"
                                    >
                                      {t}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Other (non-quiz) Affiliate Funnels */}
              {otherAffiliateFunnels.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5" />
                    Altri Funnel Salvati ({otherAffiliateFunnels.length})
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {otherAffiliateFunnels.slice(0, 9).map((funnel) => (
                      <button
                        key={funnel.id}
                        onClick={() => {
                          const p = buildPromptFromFunnel(funnel);
                          setPrompt(p);
                          generateQuiz(p);
                        }}
                        disabled={isGenerating}
                        className="group text-left p-3 rounded-lg border border-gray-200 hover:border-indigo-200 hover:shadow-sm transition-all disabled:opacity-50"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-gray-700 truncate group-hover:text-indigo-700 transition-colors">
                            {funnel.funnel_name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                            {funnel.funnel_type || funnel.category || 'funnel'}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {funnel.total_steps} step
                          </span>
                          {funnel.brand_name && (
                            <span className="text-[10px] text-gray-400 truncate">
                              {funnel.brand_name}
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                  {otherAffiliateFunnels.length > 9 && (
                    <p className="text-xs text-gray-400 mt-2 text-center">
                      +{otherAffiliateFunnels.length - 9} altri funnel disponibili
                    </p>
                  )}
                </div>
              )}

              {/* Empty state */}
              {!affiliateLoading &&
                !isInitialized &&
                quizFunnelPages.length === 0 &&
                affiliateFunnels.length === 0 && (
                  <div className="text-center py-8 text-gray-400">
                    <Layers className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm">Nessun quiz funnel trovato</p>
                    <p className="text-xs mt-1">
                      I tuoi funnel dalla sezione &quot;Front End Funnel&quot; e i funnel salvati appariranno qui
                    </p>
                  </div>
                )}

              {affiliateLoading && affiliateFunnels.length === 0 && (
                <div className="flex items-center justify-center py-6 gap-2 text-gray-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Caricamento funnel...</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Progress Bar */}
        {isGenerating && (
          <div className="mb-4">
            <div className="flex items-center gap-3 mb-1">
              <Zap className="w-4 h-4 text-purple-500 animate-pulse" />
              <span className="text-sm text-gray-600">
                Generazione in corso...
              </span>
              <span className="text-xs text-gray-400 ml-auto">
                {Math.round(streamProgress)}%
              </span>
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${streamProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            <strong>Errore:</strong> {error}
          </div>
        )}

        {/* Main Content: Preview + Code */}
        <div
          className={`bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden ${
            isFullscreen ? 'fixed inset-0 z-50 rounded-none' : ''
          }`}
        >
          {/* Tabs + Actions */}
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-0">
            <div className="flex">
              <button
                onClick={() => setActiveTab('preview')}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'preview'
                    ? 'border-purple-500 text-purple-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Eye className="w-4 h-4" />
                Preview Live
              </button>
              <button
                onClick={() => setActiveTab('code')}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'code'
                    ? 'border-purple-500 text-purple-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Code2 className="w-4 h-4" />
                Codice
                {generatedCode && (
                  <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                    {(generatedCode.length / 1024).toFixed(1)}KB
                  </span>
                )}
              </button>
            </div>

            <div className="flex items-center gap-2">
              {usage && (
                <span className="text-xs text-gray-400 mr-2">
                  Token: {usage.input_tokens} in / {usage.output_tokens} out
                </span>
              )}
              {generatedCode && (
                <>
                  <button
                    onClick={copyCode}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-200 rounded-md hover:bg-gray-50 transition-colors text-gray-600"
                  >
                    {copied ? (
                      <Check className="w-3.5 h-3.5 text-green-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    {copied ? 'Copiato!' : 'Copia'}
                  </button>
                  <button
                    onClick={downloadHtml}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-200 rounded-md hover:bg-gray-50 transition-colors text-gray-600"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Scarica
                  </button>
                </>
              )}
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {isFullscreen ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Content Area */}
          <div
            className={`${isFullscreen ? 'h-[calc(100vh-49px)]' : 'h-[700px]'}`}
          >
            {/* Preview Tab */}
            <div
              className={`w-full h-full ${activeTab === 'preview' ? 'block' : 'hidden'}`}
            >
              {generatedCode ? (
                <iframe
                  ref={iframeRef}
                  title="Quiz Preview"
                  sandbox="allow-scripts allow-forms"
                  className="w-full h-full border-0"
                  srcDoc={generatedCode}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center mb-4">
                    <Sparkles className="w-10 h-10 text-purple-400" />
                  </div>
                  <p className="text-lg font-medium text-gray-500 mb-1">
                    Nessun quiz generato
                  </p>
                  <p className="text-sm">
                    Scrivi un prompt o scegli un template per iniziare
                  </p>
                </div>
              )}
            </div>

            {/* Code Tab */}
            <div
              className={`w-full h-full ${activeTab === 'code' ? 'block' : 'hidden'}`}
            >
              {generatedCode ? (
                <pre
                  ref={codeRef}
                  className="w-full h-full overflow-auto p-4 bg-gray-950 text-gray-300 text-xs font-mono leading-relaxed"
                >
                  <code>{generatedCode}</code>
                </pre>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400">
                  <p className="text-sm">
                    Il codice apparirà qui durante la generazione
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Usage Footer */}
        {usage && (
          <div className="mt-4 flex items-center justify-between text-xs text-gray-400">
            <span>
              Generato con Claude Sonnet 4 &middot;{' '}
              {generatedCode.length.toLocaleString()} caratteri
            </span>
            <span>
              {usage.input_tokens.toLocaleString()} token input &middot;{' '}
              {usage.output_tokens.toLocaleString()} token output
            </span>
          </div>
        )}

        {/* Keyboard shortcut hint */}
        <p className="mt-3 text-xs text-gray-400 text-center">
          Premi <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-200 rounded text-gray-500 font-mono">Cmd+Enter</kbd> per generare rapidamente
        </p>
      </div>
    </div>
  );
}
