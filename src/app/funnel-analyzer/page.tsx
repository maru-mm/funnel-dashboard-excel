'use client';

import { useState } from 'react';
import Header from '@/components/Header';
import type {
  FunnelCrawlResult,
  FunnelCrawlStep,
  FunnelCrawlLink,
  FunnelPageVisionAnalysis,
} from '@/types';
import {
  Play,
  Loader2,
  CheckCircle,
  XCircle,
  Globe,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Copy,
  Image as ImageIcon,
  Link as LinkIcon,
  MousePointer,
  FileText,
  Network,
  Cookie,
  Clock,
  Layers,
  AlertCircle,
  Sparkles,
  Eye,
  Tag,
  DollarSign,
  MessageSquare,
  Cpu,
} from 'lucide-react';

export default function FunnelAnalyzerPage() {
  const [entryUrl, setEntryUrl] = useState('');
  const [headless, setHeadless] = useState(true);
  const [maxSteps, setMaxSteps] = useState(15);
  const [maxDepth, setMaxDepth] = useState(3);
  const [followSameOriginOnly, setFollowSameOriginOnly] = useState(true);
  const [captureScreenshots, setCaptureScreenshots] = useState(true);
  const [captureNetwork, setCaptureNetwork] = useState(true);
  const [captureCookies, setCaptureCookies] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FunnelCrawlResult | null>(null);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  // Vision layer
  const [visionProvider, setVisionProvider] = useState<'claude' | 'gemini'>('gemini');
  const [visionLoading, setVisionLoading] = useState(false);
  const [visionAnalyses, setVisionAnalyses] = useState<FunnelPageVisionAnalysis[] | null>(null);
  const [visionError, setVisionError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'crawl' | 'vision'>('crawl');
  // Salvataggio su Supabase: nome funnel, tag, step selezionati
  const [funnelName, setFunnelName] = useState('');
  const [funnelTag, setFunnelTag] = useState('');
  const [selectedSteps, setSelectedSteps] = useState<Set<number>>(new Set());
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const runCrawl = async () => {
    if (!entryUrl.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/funnel-analyzer/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entryUrl: entryUrl.trim(),
          headless,
          maxSteps,
          maxDepth,
          followSameOriginOnly,
          captureScreenshots,
          captureNetwork,
          captureCookies,
          viewportWidth: 1280,
          viewportHeight: 720,
        }),
      });
      const data: FunnelCrawlResult = await res.json();
      setResult(data);
      setSelectedSteps(new Set());
      setSaveSuccess(null);
      setSaveError(null);
      if (data.steps.length > 0) setExpandedStep(1);
    } catch (err) {
      setResult({
        success: false,
        entryUrl: entryUrl.trim(),
        steps: [],
        totalSteps: 0,
        durationMs: 0,
        visitedUrls: [],
        error: err instanceof Error ? err.message : 'Request failed',
      });
    } finally {
      setLoading(false);
    }
  };

  const copyJson = () => {
    if (!result) return;
    navigator.clipboard.writeText(JSON.stringify(result, null, 2));
  };

  const toggleStepSelection = (stepIndex: number) => {
    setSelectedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepIndex)) next.delete(stepIndex);
      else next.add(stepIndex);
      return next;
    });
    setSaveSuccess(null);
    setSaveError(null);
  };

  const selectAllSteps = () => {
    if (!result?.steps?.length) return;
    setSelectedSteps(new Set(result.steps.map((s) => s.stepIndex)));
    setSaveSuccess(null);
    setSaveError(null);
  };

  const deselectAllSteps = () => {
    setSelectedSteps(new Set());
    setSaveSuccess(null);
    setSaveError(null);
  };

  const saveSelectedToSupabase = async () => {
    if (!result || selectedSteps.size === 0) return;
    const toSave = result.steps.filter((s) => selectedSteps.has(s.stepIndex));
    setSaveLoading(true);
    setSaveSuccess(null);
    setSaveError(null);
    try {
      const res = await fetch('/api/funnel-analyzer/save-steps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entryUrl: result.entryUrl,
          funnelName: funnelName.trim() || undefined,
          funnelTag: funnelTag.trim() || undefined,
          steps: toSave,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Salvataggio fallito');
      setSaveSuccess(data.saved ?? toSave.length);
      setSelectedSteps(new Set());
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Errore di salvataggio');
    } finally {
      setSaveLoading(false);
    }
  };

  const runVisionAnalysis = async () => {
    if (!result?.steps?.length) return;
    const stepsToAnalyze = result.steps.filter((s) => selectedSteps.has(s.stepIndex));
    if (stepsToAnalyze.length === 0) {
      setVisionError('Seleziona almeno una pagina dalle checkbox per l\'analisi AI.');
      return;
    }
    const withScreenshot = stepsToAnalyze.filter((s) => s.screenshotBase64);
    if (withScreenshot.length === 0) {
      setVisionError('Nessuna delle pagine selezionate ha uno screenshot. Seleziona step con screenshot.');
      return;
    }
    setVisionLoading(true);
    setVisionError(null);
    setVisionAnalyses(null);
    try {
      const res = await fetch('/api/funnel-analyzer/vision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ steps: withScreenshot, provider: visionProvider }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Vision request failed');
      setVisionAnalyses(data.analyses || []);
      setActiveTab('vision');
    } catch (err) {
      setVisionError(err instanceof Error ? err.message : 'Vision analysis failed');
    } finally {
      setVisionLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        title="Funnel Analyzer"
        subtitle="Browser automation: crawl funnel, screenshot ogni step, link/CTA/form, network e cookie"
      />

      <div className="p-6">
        {/* URL & Options */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Globe className="w-5 h-5 text-emerald-500" />
            URL di ingresso
          </h3>
          <div className="flex gap-3 mb-6">
            <input
              type="url"
              value={entryUrl}
              onChange={(e) => setEntryUrl(e.target.value)}
              placeholder="https://esempio.com/landing oppure ad/opt-in"
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
            />
            {entryUrl && (
              <a
                href={entryUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-3 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 flex items-center gap-2"
              >
                <ExternalLink className="w-5 h-5" />
              </a>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Browser & Limiti</h4>
              <div className="space-y-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={headless}
                    onChange={(e) => setHeadless(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-700">Headless (nessuna finestra)</span>
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Max step:</span>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={maxSteps}
                    onChange={(e) => setMaxSteps(Number(e.target.value) || 10)}
                    className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Profondità link:</span>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={maxDepth}
                    onChange={(e) => setMaxDepth(Number(e.target.value) || 2)}
                    className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                </div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={followSameOriginOnly}
                    onChange={(e) => setFollowSameOriginOnly(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-700">Solo stesso dominio</span>
                </label>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Cattura</h4>
              <div className="space-y-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={captureScreenshots}
                    onChange={(e) => setCaptureScreenshots(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-700">Screenshot full-page</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={captureNetwork}
                    onChange={(e) => setCaptureNetwork(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-700">Network (pixel, script, checkout)</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={captureCookies}
                    onChange={(e) => setCaptureCookies(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-700">Cookie</span>
                </label>
              </div>
            </div>
          </div>

          <button
            onClick={runCrawl}
            disabled={!entryUrl.trim() || loading}
            className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Play className="w-5 h-5" />
            )}
            Avvia crawl funnel
          </button>
        </div>

        {/* Result */}
        {result && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                {result.success ? (
                  <span className="flex items-center gap-2 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                    <CheckCircle className="w-4 h-4" />
                    Completato
                  </span>
                ) : (
                  <span className="flex items-center gap-2 px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                    <XCircle className="w-4 h-4" />
                    Errore
                  </span>
                )}
                <span className="flex items-center gap-1 text-sm text-gray-500">
                  <Layers className="w-4 h-4" />
                  {result.totalSteps} step
                </span>
                <span className="flex items-center gap-1 text-sm text-gray-500">
                  <Clock className="w-4 h-4" />
                  {(result.durationMs / 1000).toFixed(1)}s
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={copyJson}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  <Copy className="w-4 h-4" />
                  Copia JSON
                </button>
                {result.success && result.steps.some((s) => s.screenshotBase64) && (
                  <div className="flex items-center gap-2 pl-2 border-l border-gray-200">
                    <span className="text-xs text-gray-500">Vision:</span>
                    <select
                      value={visionProvider}
                      onChange={(e) => setVisionProvider(e.target.value as 'claude' | 'gemini')}
                      className="text-sm border border-gray-300 rounded px-2 py-1"
                    >
                      <option value="gemini">Gemini</option>
                      <option value="claude">Claude</option>
                    </select>
                    <button
                      onClick={runVisionAnalysis}
                      disabled={visionLoading || selectedSteps.size === 0}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50"
                      title={selectedSteps.size === 0 ? 'Seleziona almeno una pagina dalle checkbox' : undefined}
                    >
                      {visionLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4" />
                      )}
                      {selectedSteps.size > 0
                        ? `Analizza con AI (${selectedSteps.size})`
                        : 'Analizza con AI'}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {result.error && (
              <div className="mx-6 mt-4 p-4 bg-red-50 rounded-lg border border-red-200 flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <p className="text-red-700">{result.error}</p>
              </div>
            )}

            {visionError && (
              <div className="mx-6 mt-4 p-4 bg-amber-50 rounded-lg border border-amber-200 flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-amber-800">{visionError}</p>
              </div>
            )}

            {/* Tabs: Crawl | Vision */}
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setActiveTab('crawl')}
                className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors ${
                  activeTab === 'crawl' ? 'border-b-2 border-emerald-500 text-emerald-700 bg-emerald-50/50' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Layers className="w-4 h-4" />
                Crawl
              </button>
              <button
                onClick={() => setActiveTab('vision')}
                className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors ${
                  activeTab === 'vision' ? 'border-b-2 border-violet-500 text-violet-700 bg-violet-50/50' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Eye className="w-4 h-4" />
                Vision AI
                {visionAnalyses && (
                  <span className="text-xs bg-violet-200 text-violet-800 px-1.5 rounded">
                    {visionAnalyses.length}
                  </span>
                )}
              </button>
            </div>

            {activeTab === 'crawl' && (
              <>
                <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 space-y-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-sm font-medium text-gray-700">Salva su Supabase</span>
                    <label className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">Nome funnel:</span>
                      <input
                        type="text"
                        value={funnelName}
                        onChange={(e) => setFunnelName(e.target.value)}
                        placeholder="es. Funnel Bioma Q1"
                        className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm w-48 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      />
                    </label>
                    <label className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">Tag:</span>
                      <input
                        type="text"
                        value={funnelTag}
                        onChange={(e) => setFunnelTag(e.target.value)}
                        placeholder="es. nutra, advertorial"
                        className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm w-40 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      />
                    </label>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      type="button"
                      onClick={selectAllSteps}
                      className="text-sm text-emerald-600 hover:underline"
                    >
                      Seleziona tutti
                    </button>
                    <button
                      type="button"
                      onClick={deselectAllSteps}
                      className="text-sm text-gray-500 hover:underline"
                    >
                      Deseleziona tutti
                    </button>
                    <button
                      type="button"
                      onClick={saveSelectedToSupabase}
                      disabled={selectedSteps.size === 0 || saveLoading}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {saveLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle className="w-4 h-4" />
                      )}
                      Salva selezionati ({selectedSteps.size})
                    </button>
                    {saveSuccess !== null && (
                      <span className="text-sm text-green-600 font-medium">
                        Salvati {saveSuccess} step su Supabase
                      </span>
                    )}
                    {saveError && (
                      <span className="text-sm text-red-600">{saveError}</span>
                    )}
                  </div>
                </div>
                <div className="divide-y divide-gray-200">
                  {result.steps.map((step) => (
                    <StepCard
                      key={step.stepIndex}
                      step={step}
                      expanded={expandedStep === step.stepIndex}
                      expandedSection={expandedSection}
                      selected={selectedSteps.has(step.stepIndex)}
                      onToggleSelect={() => toggleStepSelection(step.stepIndex)}
                      onToggleExpand={() =>
                        setExpandedStep((prev) => (prev === step.stepIndex ? null : step.stepIndex))
                      }
                      onToggleSection={(section) =>
                        setExpandedSection((prev) => (prev === section ? null : section))
                      }
                    />
                  ))}
                </div>
              </>
            )}

            {activeTab === 'vision' && (
              <div className="p-6">
                {visionLoading && (
                  <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                    <Loader2 className="w-10 h-10 animate-spin text-violet-500 mb-3" />
                    <p>Analisi vision in corso (Claude/Gemini)...</p>
                  </div>
                )}
                {!visionLoading && !visionAnalyses?.length && (
                  <p className="text-gray-500 text-center py-8">
                    Esegui prima &quot;Analizza con AI&quot; dopo il crawl per estrarre copy, tipo pagina e tech stack.
                  </p>
                )}
                {!visionLoading && visionAnalyses && visionAnalyses.length > 0 && (
                  <div className="space-y-6">
                    {visionAnalyses.map((a) => (
                      <VisionAnalysisCard key={a.stepIndex} analysis={a} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {(loading || visionLoading) && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-8 shadow-2xl flex flex-col items-center">
              <Loader2 className={`w-12 h-12 animate-spin mb-4 ${visionLoading ? 'text-violet-500' : 'text-emerald-500'}`} />
              <p className="text-gray-900 font-medium">
                {visionLoading ? 'Analisi Vision (Claude/Gemini)...' : 'Crawl in corso...'}
              </p>
              <p className="text-gray-500 text-sm mt-2">
                {visionLoading ? 'Estrazione copy, tipo pagina, offerta e tech stack' : 'Navigazione, screenshot e raccolta dati'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StepCard({
  step,
  expanded,
  expandedSection,
  selected,
  onToggleSelect,
  onToggleExpand,
  onToggleSection,
}: {
  step: FunnelCrawlStep;
  expanded: boolean;
  expandedSection: string | null;
  selected: boolean;
  onToggleSelect: () => void;
  onToggleExpand: () => void;
  onToggleSection: (s: string) => void;
}) {
  return (
    <div className="px-6 py-4">
      <div className="w-full flex items-center gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          onClick={(e) => e.stopPropagation()}
          className="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500 shrink-0"
          aria-label={`Salva step ${step.stepIndex}`}
        />
        <button
          onClick={onToggleExpand}
          className="flex-1 flex items-center gap-3 text-left min-w-0"
        >
          {expanded ? (
            <ChevronUp className="w-5 h-5 text-gray-500 shrink-0" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-500 shrink-0" />
          )}
          <span className="font-medium text-gray-900">Step {step.stepIndex}</span>
          <span className="text-gray-500 truncate flex-1">{step.title || step.url}</span>
          <a
            href={step.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-600 hover:underline shrink-0 flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </button>
      </div>

      {expanded && (
        <div className="mt-4 pl-8 space-y-4">
          {step.screenshotBase64 && (
            <div className="rounded-lg border border-gray-200 overflow-hidden bg-gray-100">
              <img
                src={`data:image/png;base64,${step.screenshotBase64}`}
                alt={`Step ${step.stepIndex}`}
                className="w-full max-h-[400px] object-contain object-top"
              />
            </div>
          )}

          <SectionToggle
            id="links"
            icon={<LinkIcon className="w-4 h-4" />}
            label="Link"
            count={step.links.length}
            expanded={expandedSection === 'links'}
            onToggle={() => onToggleSection('links')}
          >
            <ul className="text-sm space-y-1 max-h-48 overflow-y-auto">
              {step.links.slice(0, 100).map((l, i) => (
                <LinkRow key={i} link={l} />
              ))}
              {step.links.length > 100 && (
                <li className="text-gray-500">… e altri {step.links.length - 100}</li>
              )}
            </ul>
          </SectionToggle>

          <SectionToggle
            id="cta"
            icon={<MousePointer className="w-4 h-4" />}
            label="CTA / Bottoni"
            count={step.ctaButtons.length}
            expanded={expandedSection === 'cta'}
            onToggle={() => onToggleSection('cta')}
          >
            <ul className="text-sm space-y-1 max-h-48 overflow-y-auto">
              {step.ctaButtons.map((l, i) => (
                <LinkRow key={i} link={l} />
              ))}
            </ul>
          </SectionToggle>

          <SectionToggle
            id="forms"
            icon={<FileText className="w-4 h-4" />}
            label="Form"
            count={step.forms.length}
            expanded={expandedSection === 'forms'}
            onToggle={() => onToggleSection('forms')}
          >
            <ul className="text-sm space-y-3">
              {step.forms.map((f, i) => (
                <li key={i} className="p-3 bg-gray-50 rounded border border-gray-200">
                  <div className="font-medium text-gray-700">{f.method.toUpperCase()} {f.action}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {f.inputs.map((inp) => inp.name).join(', ')}
                    {f.submitButtonText && ` · Submit: ${f.submitButtonText}`}
                  </div>
                </li>
              ))}
            </ul>
          </SectionToggle>

          <SectionToggle
            id="network"
            icon={<Network className="w-4 h-4" />}
            label="Network"
            count={step.networkRequests.length}
            expanded={expandedSection === 'network'}
            onToggle={() => onToggleSection('network')}
          >
            <div className="text-xs max-h-64 overflow-y-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="py-1">Tipo</th>
                    <th className="py-1">Status</th>
                    <th className="py-1">Tracking/Checkout</th>
                    <th className="py-1">URL</th>
                  </tr>
                </thead>
                <tbody>
                  {step.networkRequests.slice(0, 80).map((r, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="py-1">{r.resourceType}</td>
                      <td className="py-1">{r.status ?? '-'}</td>
                      <td className="py-1">
                        {r.isTracking && <span className="text-amber-600">track</span>}
                        {r.isCheckout && <span className="text-green-600">checkout</span>}
                      </td>
                      <td className="py-1 truncate max-w-xs" title={r.url}>{r.url}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {step.networkRequests.length > 80 && (
                <p className="text-gray-500 py-1">… e altri {step.networkRequests.length - 80}</p>
              )}
            </div>
          </SectionToggle>

          <SectionToggle
            id="cookies"
            icon={<Cookie className="w-4 h-4" />}
            label="Cookie"
            count={step.cookies.length}
            expanded={expandedSection === 'cookies'}
            onToggle={() => onToggleSection('cookies')}
          >
            <ul className="text-xs space-y-1 max-h-48 overflow-y-auto">
              {step.cookies.map((c, i) => (
                <li key={i} className="flex gap-2">
                  <span className="font-medium">{c.name}</span>
                  <span className="text-gray-500">{c.domain}</span>
                  {c.httpOnly && <span className="text-amber-600">httpOnly</span>}
                </li>
              ))}
            </ul>
          </SectionToggle>

          {step.domLength > 0 && (
            <p className="text-xs text-gray-500">
              <ImageIcon className="w-3 h-3 inline mr-1" />
              DOM: {step.domLength.toLocaleString()} caratteri
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function SectionToggle({
  id,
  icon,
  label,
  count,
  expanded,
  onToggle,
  children,
}: {
  id: string;
  icon: React.ReactNode;
  label: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
      >
        {icon}
        {label} ({count})
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {expanded && <div className="mt-2">{children}</div>}
    </div>
  );
}

function LinkRow({ link }: { link: FunnelCrawlLink }) {
  return (
    <li className="flex items-center gap-2 truncate">
      <a
        href={link.href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-emerald-600 hover:underline truncate flex-1"
      >
        {link.text || link.href}
      </a>
      {link.isCta && (
        <span className="shrink-0 text-xs bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">CTA</span>
      )}
    </li>
  );
}

function VisionAnalysisCard({ analysis }: { analysis: FunnelPageVisionAnalysis }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 text-left"
      >
        {open ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        <span className="font-medium">Step {analysis.stepIndex}</span>
        <Tag className="w-4 h-4 text-violet-500" />
        <span className="text-sm text-violet-700 font-medium">{analysis.page_type.replace('_', ' ')}</span>
        {analysis.headline && (
          <span className="text-gray-600 truncate flex-1">{analysis.headline.slice(0, 60)}…</span>
        )}
        {analysis.error && (
          <span className="text-red-600 text-sm">Errore</span>
        )}
      </button>
      {open && (
        <div className="p-4 space-y-4 text-sm">
          {analysis.error && (
            <p className="text-red-600 bg-red-50 p-2 rounded">{analysis.error}</p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {analysis.headline && (
              <div>
                <h4 className="font-medium text-gray-700 mb-1 flex items-center gap-1"><MessageSquare className="w-4 h-4" /> Headline</h4>
                <p className="text-gray-600">{analysis.headline}</p>
              </div>
            )}
            {analysis.subheadline && (
              <div>
                <h4 className="font-medium text-gray-700 mb-1">Subheadline</h4>
                <p className="text-gray-600">{analysis.subheadline}</p>
              </div>
            )}
          </div>
          {analysis.body_copy && (
            <div>
              <h4 className="font-medium text-gray-700 mb-1">Body copy</h4>
              <p className="text-gray-600 whitespace-pre-wrap max-h-32 overflow-y-auto">{analysis.body_copy}</p>
            </div>
          )}
          {analysis.cta_text?.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-700 mb-1 flex items-center gap-1"><MousePointer className="w-4 h-4" /> CTA</h4>
              <ul className="flex flex-wrap gap-1">
                {analysis.cta_text.map((t, i) => (
                  <li key={i} className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-xs">{t}</li>
                ))}
              </ul>
            </div>
          )}
          {analysis.price_points?.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-700 mb-1 flex items-center gap-1"><DollarSign className="w-4 h-4" /> Prezzi</h4>
              <ul className="flex flex-wrap gap-1">
                {analysis.price_points.map((p, i) => (
                  <li key={i} className="bg-green-100 text-green-800 px-2 py-0.5 rounded text-xs">{p}</li>
                ))}
              </ul>
            </div>
          )}
          {analysis.offer_details && (
            <div>
              <h4 className="font-medium text-gray-700 mb-1">Offerta</h4>
              <p className="text-gray-600">{analysis.offer_details}</p>
            </div>
          )}
          {analysis.urgency_elements?.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-700 mb-1">Urgenza</h4>
              <ul className="flex flex-wrap gap-1">
                {analysis.urgency_elements.map((u, i) => (
                  <li key={i} className="bg-red-100 text-red-800 px-2 py-0.5 rounded text-xs">{u}</li>
                ))}
              </ul>
            </div>
          )}
          {analysis.social_proof?.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-700 mb-1">Social proof</h4>
              <ul className="list-disc list-inside text-gray-600 space-y-0.5">
                {analysis.social_proof.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
          {analysis.tech_stack_detected?.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-700 mb-1 flex items-center gap-1"><Cpu className="w-4 h-4" /> Tech stack</h4>
              <ul className="flex flex-wrap gap-1">
                {analysis.tech_stack_detected.map((t, i) => (
                  <li key={i} className="bg-gray-200 text-gray-700 px-2 py-0.5 rounded text-xs">{t}</li>
                ))}
              </ul>
            </div>
          )}
          {analysis.persuasion_techniques_used?.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-700 mb-1">Tecniche persuasione</h4>
              <ul className="flex flex-wrap gap-1">
                {analysis.persuasion_techniques_used.map((p, i) => (
                  <li key={i} className="bg-violet-100 text-violet-800 px-2 py-0.5 rounded text-xs">{p}</li>
                ))}
              </ul>
            </div>
          )}
          {analysis.outbound_links?.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-700 mb-1 flex items-center gap-1"><LinkIcon className="w-4 h-4" /> Link principali</h4>
              <ul className="text-xs text-gray-500 truncate space-y-0.5 max-h-20 overflow-y-auto">
                {analysis.outbound_links.map((l, i) => (
                  <li key={i} title={l}>{l}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="pt-2 border-t">
            <a href={analysis.url} target="_blank" rel="noopener noreferrer" className="text-violet-600 hover:underline text-xs flex items-center gap-1">
              <ExternalLink className="w-3 h-3" /> {analysis.url}
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
