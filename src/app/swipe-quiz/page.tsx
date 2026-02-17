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
  Camera,
  Package,
  ArrowRight,
  X,
  Image as ImageIcon,
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

interface SwapPayload {
  prompt: string;
  screenshot?: string;
  product?: {
    name: string;
    description: string;
    price: number;
    benefits: string[];
    ctaText: string;
    ctaUrl: string;
    brandName: string;
  };
  funnelSteps?: AffiliateFunnelStep[];
  funnelMeta?: {
    funnel_name?: string;
    brand_name?: string;
    entry_url?: string;
    funnel_type?: string;
    category?: string;
    total_steps?: number;
    analysis_summary?: string;
    persuasion_techniques?: string[];
    notable_elements?: string[];
    lead_capture_method?: string;
  };
  // Chunked mode fields
  mode?: 'simple' | 'swap' | 'chunked';
  designSpec?: unknown;
  cssTokens?: unknown;
  branding?: unknown;
}

type PipelinePhase =
  | 'idle'
  | 'fetching_screenshots'
  | 'analyzing_steps'
  | 'analyzing_design'
  | 'generating_branding'
  | 'generating_css'
  | 'generating_js'
  | 'generating_html'
  | 'assembling'
  | 'done'
  | 'error';

const PHASE_LABELS: Record<PipelinePhase, string> = {
  idle: '',
  fetching_screenshots: 'Recupero screenshot dal database...',
  analyzing_steps: 'Analisi per-step con Gemini Vision...',
  analyzing_design: 'Analisi design con Gemini Vision...',
  generating_branding: 'Generazione branding con AI...',
  generating_css: 'Generazione CSS Design System...',
  generating_js: 'Generazione Quiz Engine JS...',
  generating_html: 'Generazione markup HTML...',
  assembling: 'Assemblaggio finale lato server...',
  done: 'Completato!',
  error: 'Errore',
};

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
  const [generationPhase, setGenerationPhase] = useState('');

  // Existing funnels from store + Supabase
  const { funnelPages, products, isInitialized } = useStore();
  const [affiliateFunnels, setAffiliateFunnels] = useState<AffiliateSavedFunnel[]>([]);
  const [affiliateLoading, setAffiliateLoading] = useState(false);
  const [showMyFunnels, setShowMyFunnels] = useState(true);
  const [expandedFunnelId, setExpandedFunnelId] = useState<string | null>(null);

  // Swap mode state
  const [selectedFunnel, setSelectedFunnel] = useState<AffiliateSavedFunnel | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [screenshotBase64, setScreenshotBase64] = useState<string | null>(null);
  const [screenshotLoading, setScreenshotLoading] = useState(false);
  const [captureScreenshot, setCaptureScreenshot] = useState(true);

  // Pipeline phase tracking for chunked mode
  const [pipelinePhase, setPipelinePhase] = useState<PipelinePhase>('idle');
  const [useChunkedMode, setUseChunkedMode] = useState(true);

  // Multi-Agent mode (new: clone + 4 Gemini agents + Claude transform)
  const [useMultiAgentMode, setUseMultiAgentMode] = useState(true);
  const [multiAgentPhase, setMultiAgentPhase] = useState('');
  const [multiAgentConfidence, setMultiAgentConfidence] = useState<number | null>(null);

  // Filter quiz-type funnel pages from the store
  const quizFunnelPages = useMemo(
    () => funnelPages.filter((p) => p.pageType === 'quiz_funnel'),
    [funnelPages]
  );

  // Filter affiliate funnels that are quiz-type
  const quizAffiliateFunnels = useMemo(
    () =>
      affiliateFunnels.filter(
        (f) =>
          f.funnel_type?.toLowerCase().includes('quiz') ||
          f.category?.toLowerCase().includes('quiz') ||
          (Array.isArray(f.steps) &&
            (f.steps as unknown as AffiliateFunnelStep[]).some(
              (s) => s.step_type === 'quiz_question' || s.step_type === 'info_screen'
            ))
      ),
    [affiliateFunnels]
  );

  // All affiliate funnels (non-quiz) as fallback
  const otherAffiliateFunnels = useMemo(
    () => affiliateFunnels.filter((f) => !quizAffiliateFunnels.some((q) => q.id === f.id)),
    [affiliateFunnels, quizAffiliateFunnels]
  );

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId) || null,
    [products, selectedProductId]
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

  // Auto-select first product
  useEffect(() => {
    if (products.length > 0 && !selectedProductId) {
      setSelectedProductId(products[0].id);
    }
  }, [products, selectedProductId]);

  const captureQuizScreenshot = async (url: string) => {
    setScreenshotLoading(true);
    setScreenshotBase64(null);
    try {
      const response = await fetch('/api/swipe-quiz/screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await response.json();
      if (data.success && data.screenshot) {
        setScreenshotBase64(data.screenshot);
        return data.screenshot as string;
      } else {
        console.error('Screenshot failed:', data.error);
        return null;
      }
    } catch (err) {
      console.error('Screenshot error:', err);
      return null;
    } finally {
      setScreenshotLoading(false);
    }
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

  const generateQuiz = async (payload: SwapPayload) => {
    if (!payload.prompt.trim() || isGenerating) return;

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
    setGenerationPhase('Invio a Claude...');

    let accumulated = '';
    // For chunked mode: track CSS and JS chunks separately for progress
    let currentChunk: 'css' | 'js' | 'html' | null = null;

    try {
      const response = await fetch('/api/swipe-quiz/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || `Errore HTTP ${response.status}`);
      }

      setGenerationPhase('Generazione codice quiz...');

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
              setPipelinePhase('error');
              break;
            }

            if (data.done) {
              setUsage(data.usage || null);
              setGenerationPhase('');
              setPipelinePhase('done');
              break;
            }

            // Chunked mode: phase events
            if (data.phase) {
              if (data.phase === 'css') {
                currentChunk = 'css';
                setPipelinePhase('generating_css');
                setGenerationPhase(data.phaseLabel || PHASE_LABELS.generating_css);
                setStreamProgress(30);
              } else if (data.phase === 'css_done') {
                setStreamProgress(45);
              } else if (data.phase === 'js') {
                currentChunk = 'js';
                setPipelinePhase('generating_js');
                setGenerationPhase(data.phaseLabel || PHASE_LABELS.generating_js);
                setStreamProgress(45);
              } else if (data.phase === 'js_done') {
                setStreamProgress(65);
              } else if (data.phase === 'html') {
                currentChunk = 'html';
                setPipelinePhase('generating_html');
                setGenerationPhase(data.phaseLabel || PHASE_LABELS.generating_html);
                setStreamProgress(65);
              } else if (data.phase === 'assembling') {
                setPipelinePhase('assembling');
                setGenerationPhase(data.phaseLabel || PHASE_LABELS.assembling);
                setStreamProgress(90);
              }
              continue;
            }

            // Server-side assembled HTML (new chunked mode: CSS+JS+HTML assembled on server)
            if (data.assembled && data.html) {
              accumulated = data.html;
              setGeneratedCode(accumulated);
              updateIframe(accumulated);
              setStreamProgress(95);
              continue;
            }

            // Chunked mode: chunk text (CSS/JS/HTML markup — intermediate, don't show in preview)
            if (data.chunk && data.text) {
              if (data.chunk === 'css' || data.chunk === 'js') {
                setStreamProgress((prev) => Math.min(prev + 0.3, currentChunk === 'css' ? 44 : 64));
              } else if (data.chunk === 'html_markup') {
                setStreamProgress((prev) => Math.min(prev + 0.3, 89));
              }
              continue;
            }

            // Main text output (legacy mode only — non-chunked)
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
      setError(err instanceof Error ? err.message : 'Errore durante la generazione');
      setPipelinePhase('error');
    } finally {
      setIsGenerating(false);
      setGenerationPhase('');
      abortControllerRef.current = null;
    }
  };

  // Simple generation (no swap)
  const generateSimple = (customPrompt?: string) => {
    const finalPrompt = customPrompt || prompt;
    if (!finalPrompt.trim()) return;
    generateQuiz({ prompt: finalPrompt });
  };

  // Full swap generation from a funnel
  const generateSwap = async (funnel: AffiliateSavedFunnel) => {
    const steps = Array.isArray(funnel.steps)
      ? (funnel.steps as unknown as AffiliateFunnelStep[])
      : [];

    const product = selectedProduct
      ? {
          name: selectedProduct.name,
          description: selectedProduct.description,
          price: selectedProduct.price,
          benefits: selectedProduct.benefits,
          ctaText: selectedProduct.ctaText,
          ctaUrl: selectedProduct.ctaUrl,
          brandName: selectedProduct.brandName,
        }
      : undefined;

    const funnelMeta = {
      funnel_name: funnel.funnel_name,
      brand_name: funnel.brand_name || undefined,
      entry_url: funnel.entry_url,
      funnel_type: funnel.funnel_type,
      category: funnel.category,
      total_steps: funnel.total_steps,
      analysis_summary: funnel.analysis_summary || undefined,
      persuasion_techniques: funnel.persuasion_techniques || [],
      notable_elements: funnel.notable_elements || [],
      lead_capture_method: funnel.lead_capture_method || undefined,
    };

    const swapPrompt = product
      ? `Replica esattamente il quiz "${funnel.funnel_name}" ma swappa tutto il contenuto per il mio prodotto "${product.name}" di "${product.brandName}". Mantieni la stessa identica struttura, numero di step, tipologie di domande e logica risultati. Genera il branding (colori, tono, copy) adeguato al mio prodotto.`
      : `Replica esattamente il quiz "${funnel.funnel_name}" con la stessa struttura, domande, opzioni e logica risultati. Crea un design moderno e professionale.`;

    setPrompt(swapPrompt);

    // ── CHUNKED PIPELINE: Per-Step Analysis + Branding + Chunked Generation ──
    if (useChunkedMode && product) {
      setIsGenerating(true);
      setGeneratedCode('');
      setUsage(null);
      setError(null);
      setStreamProgress(0);
      setActiveTab('preview');

      try {
        // Phase 1: Per-step analysis (screenshots + Gemini Vision per ogni step URL)
        setPipelinePhase('analyzing_steps');
        setGenerationPhase('Avvio analisi per-step con Gemini Vision...');
        setStreamProgress(2);

        let designSpec = null;
        let singleScreenshot: string | undefined;
        let cssTokens = null;

        try {
          const analysisRes = await fetch('/api/swipe-quiz/per-step-analysis', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ funnelId: funnel.id }),
          });

          if (analysisRes.ok && analysisRes.body) {
            const reader = analysisRes.body.getReader();
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
                try {
                  const data = JSON.parse(line.slice(6));

                  if (data.phase === 'analyzing_step') {
                    setGenerationPhase(
                      `Analisi step ${data.current}/${data.total}: ${data.stepTitle}...`,
                    );
                    setStreamProgress(2 + Math.round((data.current / data.total) * 15));
                  } else if (data.phase === 'step_done') {
                    setStreamProgress(2 + Math.round((data.current / data.total) * 15));
                  } else if (data.phase === 'complete') {
                    designSpec = data.designSpec || null;
                    if (data.screenshots?.length > 0) {
                      singleScreenshot = data.screenshots[0];
                      setScreenshotBase64(data.screenshots[0]);
                    }
                  }
                } catch {
                  // skip malformed SSE
                }
              }
            }
          }
        } catch (err) {
          console.warn('Per-step analysis failed, continuing with fallback:', err);
        }

        // Fallback: single screenshot if per-step analysis failed
        if (!designSpec && captureScreenshot && funnel.entry_url) {
          setPipelinePhase('analyzing_design');
          setGenerationPhase('Cattura screenshot del quiz originale (fallback)...');
          const result = await captureQuizScreenshot(funnel.entry_url);
          if (result) {
            singleScreenshot = result;
            try {
              const designRes = await fetch('/api/swipe-quiz/design-analysis', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ screenshots: [result] }),
              });
              const designData = await designRes.json();
              if (designData.success && designData.designSpec) {
                designSpec = designData.designSpec;
              }
            } catch {
              // Design analysis is best-effort
            }
          }
        }

        // CSS tokens from live page
        if (captureScreenshot && funnel.entry_url && !singleScreenshot) {
          try {
            const cssRes = await fetch('/api/swipe-quiz/screenshot', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url: funnel.entry_url, extractCss: true }),
            });
            const cssData = await cssRes.json();
            if (cssData.success) {
              cssTokens = cssData.cssTokens || null;
              if (!singleScreenshot && cssData.screenshot) {
                singleScreenshot = cssData.screenshot;
                setScreenshotBase64(cssData.screenshot);
              }
            }
          } catch {
            // CSS extraction is best-effort
          }
        }

        setStreamProgress(20);

        // Phase 2: Generate Branding (using funnelId for direct affiliate_saved_funnels support)
        setPipelinePhase('generating_branding');
        setGenerationPhase(PHASE_LABELS.generating_branding);

        let brandingResult = null;
        try {
          const brandingRes = await fetch('/api/swipe-quiz/generate-branding', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              funnelId: funnel.id,
              product,
              options: { provider: 'gemini', language: 'it' },
            }),
          });
          const brandingData = await brandingRes.json();
          if (brandingData.success && brandingData.branding) {
            brandingResult = brandingData.branding;
          }
        } catch (err) {
          console.warn('Branding generation (funnelId mode) failed:', err);
        }

        // Fallback: try legacy branding if funnelId mode failed
        if (!brandingResult) {
          try {
            const brandingRes = await fetch('/api/swipe-quiz/generate-branding', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                entryUrl: funnel.entry_url,
                funnelName: funnel.funnel_name,
                product,
                funnelMeta: {
                  funnel_type: funnel.funnel_type,
                  category: funnel.category,
                  analysis_summary: funnel.analysis_summary,
                  persuasion_techniques: funnel.persuasion_techniques,
                  lead_capture_method: funnel.lead_capture_method,
                  notable_elements: funnel.notable_elements,
                },
                options: { provider: 'gemini', language: 'it' },
              }),
            });
            const brandingData = await brandingRes.json();
            if (brandingData.success && brandingData.branding) {
              brandingResult = brandingData.branding;
            }
          } catch (err) {
            console.warn('Legacy branding also failed:', err);
          }
        }

        setStreamProgress(30);

        // Phase 3: Chunked generation (CSS → JS → HTML markup → server assembly)
        if (brandingResult) {
          setPipelinePhase('generating_css');
          setGenerationPhase(PHASE_LABELS.generating_css);

          await generateQuiz({
            prompt: swapPrompt,
            screenshot: singleScreenshot,
            product,
            funnelSteps: steps,
            funnelMeta,
            mode: 'chunked',
            designSpec,
            cssTokens,
            branding: brandingResult,
          });
        } else {
          // Fallback to legacy swap mode if branding failed
          console.warn('Branding generation failed — falling back to legacy swap mode');
          setPipelinePhase('idle');
          await generateQuiz({
            prompt: swapPrompt,
            screenshot: singleScreenshot,
            product,
            funnelSteps: steps,
            funnelMeta,
            designSpec,
            cssTokens,
          });
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Errore durante il pipeline');
        setPipelinePhase('error');
        setIsGenerating(false);
        setGenerationPhase('');
      }
      return;
    }

    // ── LEGACY SWAP MODE (no chunked) ──
    let screenshot: string | undefined;
    if (captureScreenshot && funnel.entry_url) {
      setGenerationPhase('Cattura screenshot del quiz originale...');
      const result = await captureQuizScreenshot(funnel.entry_url);
      screenshot = result || undefined;
    }

    await generateQuiz({
      prompt: swapPrompt,
      screenshot,
      product,
      funnelSteps: steps,
      funnelMeta,
    });
  };

  // ── MULTI-AGENT MODE: Clone + 4 Gemini Agents + Claude Transform ──
  const generateMultiAgent = async (funnel: AffiliateSavedFunnel) => {
    if (!selectedProduct || isGenerating) return;

    if (abortControllerRef.current) abortControllerRef.current.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsGenerating(true);
    setGeneratedCode('');
    setUsage(null);
    setError(null);
    setStreamProgress(0);
    setActiveTab('preview');
    setMultiAgentPhase('cloning_html');
    setMultiAgentConfidence(null);
    setGenerationPhase('Clonazione HTML originale...');
    setPipelinePhase('idle');

    const steps = Array.isArray(funnel.steps)
      ? (funnel.steps as unknown as AffiliateFunnelStep[])
      : [];

    let accumulated = '';

    try {
      const response = await fetch('/api/swipe-quiz/multiagent-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entryUrl: funnel.entry_url,
          funnelName: funnel.funnel_name,
          product: {
            name: selectedProduct.name,
            description: selectedProduct.description,
            price: selectedProduct.price,
            benefits: selectedProduct.benefits,
            ctaText: selectedProduct.ctaText,
            ctaUrl: selectedProduct.ctaUrl,
            brandName: selectedProduct.brandName,
          },
          funnelSteps: steps,
          funnelMeta: {
            funnel_type: funnel.funnel_type,
            category: funnel.category,
            analysis_summary: funnel.analysis_summary,
            persuasion_techniques: funnel.persuasion_techniques,
            lead_capture_method: funnel.lead_capture_method,
            notable_elements: funnel.notable_elements,
          },
          extraInstructions: prompt || undefined,
        }),
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
              setMultiAgentConfidence(data.masterSpecSummary?.confidence ?? null);
              setGenerationPhase('');
              setMultiAgentPhase('done');
              break;
            }

            // Phase updates
            if (data.phase) {
              setMultiAgentPhase(data.phase);
              if (data.message) setGenerationPhase(data.message);

              // Update progress based on phase
              const phaseProgressMap: Record<string, number> = {
                cloning_html: 5,
                cloning_done: 10,
                fetching_screenshots: 12,
                screenshots_ready: 15,
                agents_start: 18,
                parallel_agents: 20,
                agent_visual: 25,
                agent_ux_flow: 30,
                agent_cro: 35,
                agent_quiz_logic: 40,
                agents_done: 55,
                synthesizing: 58,
                generating_branding: 62,
                branding_done: 68,
                transforming_html: 70,
              };
              const progress = phaseProgressMap[data.phase];
              if (progress) setStreamProgress(progress);
            }

            // HTML text streaming from Claude transform
            if (data.text) {
              accumulated += data.text;
              setGeneratedCode(accumulated);
              setStreamProgress(prev => Math.min(prev + 0.3, 95));

              if (
                accumulated.includes('</style>') ||
                accumulated.includes('</body>') ||
                accumulated.includes('</html>')
              ) {
                updateIframe(accumulated);
              }
            }
          } catch {
            // skip malformed JSON
          }
        }
      }

      if (accumulated) {
        updateIframe(accumulated);
        setStreamProgress(100);
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Errore durante il pipeline multi-agente');
    } finally {
      setIsGenerating(false);
      setGenerationPhase('');
      abortControllerRef.current = null;
    }
  };

  const stopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsGenerating(false);
      setGenerationPhase('');
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
    setSelectedFunnel(null);
    setScreenshotBase64(null);
    setGenerationPhase('');
    setPipelinePhase('idle');
    setMultiAgentPhase('');
    setMultiAgentConfidence(null);
    if (iframeRef.current) {
      iframeRef.current.srcdoc = '';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        title="Swipe Quiz"
        subtitle="Genera quiz interattivi con AI — Swappa quiz esistenti sul tuo prodotto"
      />

      <div className="p-6">
        {/* Product Selector Bar */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-4 mb-6 shadow-md">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2 text-white">
              <Package className="w-5 h-5" />
              <span className="font-semibold text-sm">Il mio prodotto:</span>
            </div>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="flex-1 min-w-[250px] px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm outline-none focus:bg-white/20 transition-colors [&>option]:text-gray-900"
            >
              <option value="">-- Seleziona prodotto --</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.brandName} (€{p.price})
                </option>
              ))}
            </select>
            {selectedProduct && (
              <div className="flex items-center gap-3 text-white/80 text-xs">
                <span className="bg-white/15 px-2 py-1 rounded">{selectedProduct.brandName}</span>
                <span className="bg-white/15 px-2 py-1 rounded">€{selectedProduct.price}</span>
                <span className="bg-white/15 px-2 py-1 rounded">
                  {selectedProduct.benefits.length} benefici
                </span>
              </div>
            )}
            <div className="flex items-center gap-3 ml-auto">
              <label className="flex items-center gap-2 text-white/80 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={useChunkedMode}
                  onChange={(e) => setUseChunkedMode(e.target.checked)}
                  className="w-3.5 h-3.5 rounded"
                />
                <Zap className="w-3.5 h-3.5" />
                Pipeline HQ
              </label>
              <label className="flex items-center gap-2 text-white/80 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={captureScreenshot}
                  onChange={(e) => setCaptureScreenshot(e.target.checked)}
                  className="w-3.5 h-3.5 rounded"
                />
                <Camera className="w-3.5 h-3.5" />
                Screenshot
              </label>
            </div>
          </div>
          {selectedProduct && (
            <div className="mt-3 text-white/60 text-xs line-clamp-2">
              {selectedProduct.description}
            </div>
          )}
        </div>

        {/* Swap Panel - shown when a funnel is selected */}
        {selectedFunnel && (
          <div className="bg-white rounded-xl shadow-sm border-2 border-indigo-200 p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm">Quiz Swap</h3>
                  <p className="text-xs text-gray-500">
                    Replica struttura + branding dal tuo prodotto
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedFunnel(null);
                  setScreenshotBase64(null);
                }}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-center">
              {/* Source funnel */}
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <p className="text-[10px] uppercase font-medium text-gray-400 tracking-wider mb-2">
                  Quiz originale
                </p>
                <p className="font-medium text-gray-800 text-sm mb-1">
                  {selectedFunnel.funnel_name}
                </p>
                {selectedFunnel.brand_name && (
                  <p className="text-xs text-gray-500 mb-1">{selectedFunnel.brand_name}</p>
                )}
                <p className="text-xs text-gray-400 truncate mb-2">{selectedFunnel.entry_url}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded">
                    {selectedFunnel.total_steps} step
                  </span>
                  <span className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded">
                    {selectedFunnel.funnel_type || 'quiz'}
                  </span>
                  {(() => {
                    const steps = Array.isArray(selectedFunnel.steps)
                      ? (selectedFunnel.steps as unknown as AffiliateFunnelStep[])
                      : [];
                    const questions = steps.filter(
                      (s) => s.step_type === 'quiz_question'
                    ).length;
                    return questions > 0 ? (
                      <span className="text-[10px] bg-cyan-50 text-cyan-600 px-1.5 py-0.5 rounded">
                        {questions} domande
                      </span>
                    ) : null;
                  })()}
                </div>

                {/* Screenshot preview */}
                {screenshotBase64 && (
                  <div className="mt-3 relative">
                    <img
                      src={`data:image/png;base64,${screenshotBase64}`}
                      alt="Screenshot quiz"
                      className="w-full max-h-40 object-cover object-top rounded border border-gray-200"
                    />
                    <span className="absolute top-1 right-1 bg-green-500 text-white text-[9px] px-1.5 py-0.5 rounded font-medium">
                      Screenshot OK
                    </span>
                  </div>
                )}
                {screenshotLoading && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Cattura screenshot...
                  </div>
                )}
              </div>

              {/* Arrow */}
              <div className="hidden md:flex flex-col items-center gap-1">
                <ArrowRight className="w-6 h-6 text-indigo-400" />
                <span className="text-[10px] text-indigo-400 font-medium">SWAP</span>
              </div>

              {/* Target product */}
              <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-200">
                <p className="text-[10px] uppercase font-medium text-indigo-400 tracking-wider mb-2">
                  Il tuo prodotto
                </p>
                {selectedProduct ? (
                  <>
                    <p className="font-medium text-gray-800 text-sm mb-1">
                      {selectedProduct.name}
                    </p>
                    <p className="text-xs text-gray-500 mb-1">{selectedProduct.brandName}</p>
                    <p className="text-xs text-gray-400 line-clamp-2 mb-2">
                      {selectedProduct.description}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-medium">
                        €{selectedProduct.price}
                      </span>
                      <span className="text-[10px] bg-green-50 text-green-600 px-1.5 py-0.5 rounded">
                        {selectedProduct.benefits.length} benefici
                      </span>
                      <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">
                        CTA: {selectedProduct.ctaText}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-4">
                    <Package className="w-6 h-6 mx-auto text-indigo-300 mb-1" />
                    <p className="text-xs text-indigo-400">
                      Seleziona un prodotto dalla barra sopra
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Prompt customization */}
            <div className="mt-4">
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Istruzioni aggiuntive (opzionale)
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Es: Usa toni più caldi, aggiungi una sezione testimonianze prima del risultato, colori verde scuro..."
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none text-sm"
                disabled={isGenerating}
              />
            </div>

            {/* Mode toggle */}
            <div className="mt-3 flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="swapMode"
                  checked={useMultiAgentMode}
                  onChange={() => setUseMultiAgentMode(true)}
                  className="w-3.5 h-3.5 text-indigo-600"
                />
                <span className="text-xs font-medium text-gray-700 flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-indigo-500" />
                  Multi-Agent (Clone + Trasforma)
                </span>
                <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">Fedele</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="swapMode"
                  checked={!useMultiAgentMode}
                  onChange={() => setUseMultiAgentMode(false)}
                  className="w-3.5 h-3.5 text-gray-400"
                />
                <span className="text-xs text-gray-500">
                  Pipeline Legacy (genera da zero)
                </span>
              </label>
            </div>

            <button
              onClick={() => useMultiAgentMode ? generateMultiAgent(selectedFunnel) : generateSwap(selectedFunnel)}
              disabled={isGenerating}
              className={`mt-4 w-full flex items-center justify-center gap-2 px-5 py-3 text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold shadow-md ${
                useMultiAgentMode
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700'
                  : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700'
              }`}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {generationPhase || 'Generazione...'}
                </>
              ) : useMultiAgentMode ? (
                <>
                  <Layers className="w-4 h-4" />
                  Clone &amp; Trasforma Quiz (Multi-Agent)
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Genera Quiz Swappato
                  {captureScreenshot && <Camera className="w-4 h-4 ml-1 opacity-60" />}
                  {selectedProduct && <ImageIcon className="w-4 h-4 ml-1 opacity-60" />}
                </>
              )}
            </button>
          </div>
        )}

        {/* Prompt + Presets Row (simple mode) */}
        {!selectedFunnel && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-purple-500" />
              <h2 className="font-semibold text-gray-900">
                Genera un quiz da zero
              </h2>
            </div>

            {/* Prompt Input */}
            <div className="flex gap-3 mb-5">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    generateSimple();
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
                    onClick={() => generateSimple()}
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
                        generateSimple(preset.prompt);
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
        )}

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
              {selectedFunnel && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                  Selezionato: {selectedFunnel.funnel_name}
                </span>
              )}
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
                          generateSimple(
                            `Crea un quiz interattivo ispirato alla pagina "${page.name}". URL: ${page.urlToSwipe}. ${page.prompt || ''} ${
                              page.extractedData
                                ? `Headline: "${page.extractedData.headline}". CTA: ${page.extractedData.cta?.join(', ')}. Benefici: ${page.extractedData.benefits?.join(', ')}`
                                : ''
                            }`
                          );
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
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                              page.swipeStatus === 'completed'
                                ? 'bg-green-100 text-green-700'
                                : page.swipeStatus === 'in_progress'
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : page.swipeStatus === 'failed'
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-gray-100 text-gray-500'
                            }`}
                          >
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
                      const isSelected = selectedFunnel?.id === funnel.id;

                      return (
                        <div
                          key={funnel.id}
                          className={`border rounded-lg overflow-hidden transition-colors ${
                            isSelected
                              ? 'border-indigo-400 bg-indigo-50/30 shadow-md'
                              : 'border-gray-200 hover:border-indigo-200'
                          }`}
                        >
                          <div className="flex items-center gap-3 p-3">
                            <div
                              className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                                isSelected
                                  ? 'bg-gradient-to-br from-green-500 to-emerald-600'
                                  : 'bg-gradient-to-br from-indigo-500 to-purple-600'
                              }`}
                            >
                              {isSelected ? (
                                <Check className="w-4 h-4 text-white" />
                              ) : (
                                <HelpCircle className="w-4 h-4 text-white" />
                              )}
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
                                <span className="text-xs text-gray-400 truncate">
                                  {funnel.entry_url}
                                </span>
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
                                  setSelectedFunnel(isSelected ? null : funnel);
                                  setScreenshotBase64(null);
                                }}
                                disabled={isGenerating}
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                                  isSelected
                                    ? 'bg-green-600 text-white hover:bg-green-700'
                                    : 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:from-indigo-600 hover:to-purple-700'
                                }`}
                              >
                                {isSelected ? (
                                  <>
                                    <Check className="w-3.5 h-3.5" />
                                    Selezionato
                                  </>
                                ) : (
                                  <>
                                    <Sparkles className="w-3.5 h-3.5" />
                                    Swappa Quiz
                                  </>
                                )}
                              </button>
                            </div>
                          </div>

                          {/* Expanded step details */}
                          {isExpanded && steps.length > 0 && (
                            <div className="border-t border-gray-100 bg-gray-50 p-3">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {steps.map((step, idx) => (
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
                                                  : step.step_type === 'result'
                                                    ? 'bg-green-50 text-green-600'
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
                                      {step.description && (
                                        <p className="text-gray-400 mt-0.5 line-clamp-1 italic">
                                          {step.description}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                              {funnel.persuasion_techniques &&
                                funnel.persuasion_techniques.length > 0 && (
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
                              {funnel.analysis_summary && (
                                <p className="mt-2 text-xs text-gray-500 bg-white p-2 rounded border border-gray-100">
                                  {funnel.analysis_summary}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Other Affiliate Funnels */}
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
                          setSelectedFunnel(funnel);
                          setScreenshotBase64(null);
                        }}
                        disabled={isGenerating}
                        className={`group text-left p-3 rounded-lg border transition-all disabled:opacity-50 ${
                          selectedFunnel?.id === funnel.id
                            ? 'border-indigo-400 bg-indigo-50'
                            : 'border-gray-200 hover:border-indigo-200 hover:shadow-sm'
                        }`}
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
                      I tuoi funnel dalla sezione &quot;Front End Funnel&quot; e i funnel salvati
                      appariranno qui
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

        {/* Pipeline Progress */}
        {isGenerating && (
          <div className="mb-4">
            {/* Multi-Agent phase indicator */}
            {multiAgentPhase && multiAgentPhase !== 'idle' && multiAgentPhase !== 'done' && (
              <div className="flex items-center gap-1.5 mb-2 overflow-x-auto pb-1">
                {([
                  { key: 'cloning_html', label: 'Clone HTML' },
                  { key: 'agent_visual', label: 'Visual AI' },
                  { key: 'agent_ux_flow', label: 'UX Flow AI' },
                  { key: 'agent_cro', label: 'CRO AI' },
                  { key: 'agent_quiz_logic', label: 'Logic AI' },
                  { key: 'synthesizing', label: 'Sintesi' },
                  { key: 'generating_branding', label: 'Branding' },
                  { key: 'transforming_html', label: 'Trasforma' },
                ] as const).map((item, idx, arr) => {
                  const allPhases = arr.map(a => a.key);
                  const currentIdx = allPhases.indexOf(multiAgentPhase as typeof allPhases[number]);
                  const thisIdx = idx;
                  const isCurrent = multiAgentPhase === item.key ||
                    (multiAgentPhase === 'parallel_agents' && thisIdx >= 1 && thisIdx <= 4) ||
                    (multiAgentPhase.startsWith('agent_') && item.key.startsWith('agent_') && multiAgentPhase === item.key);
                  const isPast = currentIdx > thisIdx ||
                    (multiAgentPhase === 'agents_done' && thisIdx <= 4) ||
                    (multiAgentPhase === 'synthesizing' && thisIdx <= 4) ||
                    (multiAgentPhase === 'generating_branding' && thisIdx <= 5) ||
                    (multiAgentPhase === 'branding_done' && thisIdx <= 6) ||
                    (multiAgentPhase === 'transforming_html' && thisIdx <= 6);
                  const isParallel = thisIdx >= 1 && thisIdx <= 4 &&
                    (multiAgentPhase === 'parallel_agents' || multiAgentPhase === 'agents_start' || multiAgentPhase.startsWith('agent_'));

                  return (
                    <div key={item.key} className="flex items-center gap-1.5">
                      <div className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all whitespace-nowrap ${
                        isCurrent
                          ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300'
                          : isPast
                            ? 'bg-green-50 text-green-600'
                            : isParallel
                              ? 'bg-amber-50 text-amber-600 ring-1 ring-amber-200'
                              : 'bg-gray-100 text-gray-400'
                      }`}>
                        {isPast && <Check className="w-3 h-3" />}
                        {(isCurrent || isParallel) && !isPast && <Loader2 className="w-3 h-3 animate-spin" />}
                        {item.label}
                      </div>
                      {idx < arr.length - 1 && <span className="text-gray-300 text-[10px]">&rarr;</span>}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Legacy chunked mode phase indicator */}
            {!multiAgentPhase && pipelinePhase !== 'idle' && (
              <div className="flex items-center gap-1.5 mb-2 overflow-x-auto pb-1">
                {(['fetching_screenshots', 'analyzing_design', 'generating_branding', 'generating_css', 'generating_js', 'generating_html'] as PipelinePhase[]).map((phase, idx) => {
                  const isCurrent = pipelinePhase === phase;
                  const isPast = (['fetching_screenshots', 'analyzing_design', 'generating_branding', 'generating_css', 'generating_js', 'generating_html'] as PipelinePhase[]).indexOf(pipelinePhase) > idx;
                  const labels: Record<string, string> = {
                    fetching_screenshots: 'Screenshots',
                    analyzing_design: 'Design AI',
                    generating_branding: 'Branding',
                    generating_css: 'CSS',
                    generating_js: 'JS Engine',
                    generating_html: 'HTML',
                  };
                  return (
                    <div key={phase} className="flex items-center gap-1.5">
                      <div className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all whitespace-nowrap ${
                        isCurrent
                          ? 'bg-purple-100 text-purple-700 ring-1 ring-purple-300'
                          : isPast
                            ? 'bg-green-50 text-green-600'
                            : 'bg-gray-100 text-gray-400'
                      }`}>
                        {isPast && <Check className="w-3 h-3" />}
                        {isCurrent && <Loader2 className="w-3 h-3 animate-spin" />}
                        {labels[phase]}
                      </div>
                      {idx < 5 && <span className="text-gray-300 text-[10px]">&rarr;</span>}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex items-center gap-3 mb-1">
              <Zap className={`w-4 h-4 animate-pulse ${multiAgentPhase ? 'text-emerald-500' : 'text-purple-500'}`} />
              <span className="text-sm text-gray-600">
                {generationPhase || 'Generazione in corso...'}
              </span>
              {multiAgentConfidence !== null && (
                <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-medium">
                  Confidenza: {Math.round(multiAgentConfidence * 100)}%
                </span>
              )}
              <span className="text-xs text-gray-400 ml-auto">
                {Math.round(streamProgress)}%
              </span>
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ease-out ${
                  multiAgentPhase
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                    : 'bg-gradient-to-r from-purple-500 to-blue-500'
                }`}
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
          <div className={`${isFullscreen ? 'h-[calc(100vh-49px)]' : 'h-[700px]'}`}>
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
                  <p className="text-lg font-medium text-gray-500 mb-1">Nessun quiz generato</p>
                  <p className="text-sm">
                    Scrivi un prompt, scegli un template, o seleziona un funnel da swappare
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
                  <p className="text-sm">Il codice apparirà qui durante la generazione</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Usage Footer */}
        {usage && (
          <div className="mt-4 flex items-center justify-between text-xs text-gray-400">
            <span>
              Generato con Claude Sonnet 4{multiAgentPhase === 'done' ? ' (Multi-Agent Clone+Transform)' : pipelinePhase === 'done' ? ' (Pipeline HQ)' : ''} &middot; {generatedCode.length.toLocaleString()}{' '}
              caratteri
            </span>
            <span>
              {usage.input_tokens.toLocaleString()} token input &middot;{' '}
              {usage.output_tokens.toLocaleString()} token output
            </span>
          </div>
        )}

        {/* Keyboard shortcut hint */}
        <p className="mt-3 text-xs text-gray-400 text-center">
          Premi{' '}
          <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-200 rounded text-gray-500 font-mono">
            Cmd+Enter
          </kbd>{' '}
          per generare rapidamente
        </p>
      </div>
    </div>
  );
}
