'use client';

import { useState } from 'react';
import Header from '@/components/Header';
import {
  Play,
  Loader2,
  CheckCircle,
  XCircle,
  Globe,
  Eye,
  Code,
  Layers,
  Zap,
  RefreshCw,
  Copy,
  ExternalLink,
  AlertCircle,
  Clock,
  Server,
} from 'lucide-react';

type PromptType = 'visual_analysis' | 'conversion_optimization' | 'ux_audit' | 'brand_analysis' | 'custom';

interface HealthStatus {
  success: boolean;
  server: string;
  status?: string;
  version?: string;
  error?: string;
}

interface ApiResult {
  success: boolean;
  duration_ms?: number;
  error?: string;
  details?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any;
}

const PROMPT_TYPES: { value: PromptType; label: string; description: string }[] = [
  { value: 'visual_analysis', label: 'Visual Analysis', description: 'Complete visual analysis of the page' },
  { value: 'conversion_optimization', label: 'Conversion Optimization', description: 'Tips to optimize conversions' },
  { value: 'ux_audit', label: 'UX Audit', description: 'User experience audit' },
  { value: 'brand_analysis', label: 'Brand Analysis', description: 'Brand and visual identity analysis' },
  { value: 'custom', label: 'Custom Prompt', description: 'Custom prompt' },
];

export default function LandingAnalyzerPage() {
  const [url, setUrl] = useState('');
  const [promptType, setPromptType] = useState<PromptType>('visual_analysis');
  const [customPrompt, setCustomPrompt] = useState('');
  
  // Analysis options
  const [includeScrape, setIncludeScrape] = useState(true);
  const [includeVision, setIncludeVision] = useState(true);
  const [includeExtract, setIncludeExtract] = useState(true);
  
  // Loading states
  const [healthLoading, setHealthLoading] = useState(false);
  const [scrapeLoading, setScrapeLoading] = useState(false);
  const [visionLoading, setVisionLoading] = useState(false);
  const [extractLoading, setExtractLoading] = useState(false);
  const [analyzeLoading, setAnalyzeLoading] = useState(false);
  
  // Results
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
  const [scrapeResult, setScrapeResult] = useState<ApiResult | null>(null);
  const [visionResult, setVisionResult] = useState<ApiResult | null>(null);
  const [extractResult, setExtractResult] = useState<ApiResult | null>(null);
  const [analyzeResult, setAnalyzeResult] = useState<ApiResult | null>(null);
  
  // Active tab
  const [activeResultTab, setActiveResultTab] = useState<'scrape' | 'vision' | 'extract' | 'analyze'>('analyze');

  // Health check
  const checkHealth = async () => {
    setHealthLoading(true);
    try {
      const response = await fetch('/api/agentic/health');
      const data = await response.json();
      setHealthStatus(data);
    } catch (error) {
      setHealthStatus({
        success: false,
        server: 'http://localhost:8000',
        error: error instanceof Error ? error.message : 'Connection failed',
      });
    } finally {
      setHealthLoading(false);
    }
  };

  // Scrape
  const runScrape = async () => {
    if (!url.trim()) return;
    setScrapeLoading(true);
    setScrapeResult(null);
    try {
      const response = await fetch('/api/agentic/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await response.json();
      setScrapeResult({ ...data, data: data });
      setActiveResultTab('scrape');
    } catch (error) {
      setScrapeResult({
        success: false,
        error: error instanceof Error ? error.message : 'Request failed',
      });
    } finally {
      setScrapeLoading(false);
    }
  };

  // Vision
  const runVision = async () => {
    if (!url.trim()) return;
    setVisionLoading(true);
    setVisionResult(null);
    try {
      const response = await fetch('/api/agentic/vision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          url: url.trim(),
          prompt_type: promptType,
          custom_prompt: promptType === 'custom' ? customPrompt : undefined,
        }),
      });
      const data = await response.json();
      setVisionResult({ ...data, data: data });
      setActiveResultTab('vision');
    } catch (error) {
      setVisionResult({
        success: false,
        error: error instanceof Error ? error.message : 'Request failed',
      });
    } finally {
      setVisionLoading(false);
    }
  };

  // Extract
  const runExtract = async () => {
    if (!url.trim()) return;
    setExtractLoading(true);
    setExtractResult(null);
    try {
      const response = await fetch('/api/agentic/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await response.json();
      setExtractResult({ ...data, data: data });
      setActiveResultTab('extract');
    } catch (error) {
      setExtractResult({
        success: false,
        error: error instanceof Error ? error.message : 'Request failed',
      });
    } finally {
      setExtractLoading(false);
    }
  };

  // Full Analyze
  const runFullAnalysis = async () => {
    if (!url.trim()) return;
    setAnalyzeLoading(true);
    setAnalyzeResult(null);
    try {
      const response = await fetch('/api/agentic/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          url: url.trim(),
          include_scrape: includeScrape,
          include_vision: includeVision,
          include_extract: includeExtract,
          prompt_type: promptType,
          custom_prompt: promptType === 'custom' ? customPrompt : undefined,
        }),
      });
      const data = await response.json();
      setAnalyzeResult({ ...data, data: data });
      setActiveResultTab('analyze');
    } catch (error) {
      setAnalyzeResult({
        success: false,
        error: error instanceof Error ? error.message : 'Request failed',
      });
    } finally {
      setAnalyzeLoading(false);
    }
  };

  // Copy JSON to clipboard
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const copyToClipboard = (data: any) => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
  };

  const isAnyLoading = scrapeLoading || visionLoading || extractLoading || analyzeLoading;

  // Get current result based on active tab
  const getCurrentResult = (): ApiResult | null => {
    switch (activeResultTab) {
      case 'scrape': return scrapeResult;
      case 'vision': return visionResult;
      case 'extract': return extractResult;
      case 'analyze': return analyzeResult;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        title="Landing Analyzer"
        subtitle="Agentic APIs for landing page analysis"
      />

      <div className="p-6">
        {/* Server Status */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Server className="w-5 h-5 text-gray-500" />
              <div>
                <h3 className="font-medium text-gray-900">Agentic API Server</h3>
                <p className="text-sm text-gray-500">localhost:8000</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {healthStatus && (
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
                  healthStatus.success 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-red-100 text-red-700'
                }`}>
                  {healthStatus.success ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    <XCircle className="w-4 h-4" />
                  )}
                  {healthStatus.success ? 'Online' : 'Offline'}
                </div>
              )}
              <button
                onClick={checkHealth}
                disabled={healthLoading}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                {healthLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Check Health
              </button>
            </div>
          </div>
          
          {healthStatus && !healthStatus.success && (
            <div className="mt-3 p-3 bg-red-50 rounded-lg border border-red-200">
              <p className="text-sm text-red-700">
                <AlertCircle className="w-4 h-4 inline mr-1" />
                {healthStatus.error}
              </p>
              <p className="text-xs text-red-600 mt-1">
                Make sure the server is running on {healthStatus.server}
              </p>
            </div>
          )}
        </div>

        {/* URL Input */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Globe className="w-5 h-5 text-blue-500" />
            URL to Analyze
          </h3>
          
          <div className="flex gap-3 mb-4">
            <div className="flex-1">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/landing-page"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-lg"
              />
            </div>
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-3 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
              >
                <ExternalLink className="w-5 h-5" />
              </a>
            )}
          </div>

          {/* Prompt Type Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Vision Analysis Type
            </label>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {PROMPT_TYPES.map((type) => (
                <button
                  key={type.value}
                  onClick={() => setPromptType(type.value)}
                  className={`p-3 rounded-lg border text-left transition-colors ${
                    promptType === type.value
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-medium text-sm">{type.label}</div>
                  <div className="text-xs text-gray-500 mt-1">{type.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Prompt */}
          {promptType === 'custom' && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Custom Prompt
              </label>
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Describe what you want to analyze..."
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>
          )}

          {/* Analysis Options for Full Analysis */}
          <div className="mb-4 p-4 bg-gray-50 rounded-lg">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Full Analysis Options
            </label>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeScrape}
                  onChange={(e) => setIncludeScrape(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Include Scrape</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeVision}
                  onChange={(e) => setIncludeVision(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Include Vision</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeExtract}
                  onChange={(e) => setIncludeExtract(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Include Extract</span>
              </label>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <button
              onClick={runScrape}
              disabled={!url.trim() || isAnyLoading}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {scrapeLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Code className="w-5 h-5" />
              )}
              <span>Scrape</span>
            </button>
            
            <button
              onClick={runVision}
              disabled={!url.trim() || isAnyLoading}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {visionLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Eye className="w-5 h-5" />
              )}
              <span>Vision</span>
            </button>
            
            <button
              onClick={runExtract}
              disabled={!url.trim() || isAnyLoading}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {extractLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Layers className="w-5 h-5" />
              )}
              <span>Extract</span>
            </button>
            
            <button
              onClick={runFullAnalysis}
              disabled={!url.trim() || isAnyLoading}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg hover:from-orange-600 hover:to-red-600 transition-colors disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed"
            >
              {analyzeLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Zap className="w-5 h-5" />
              )}
              <span>Full Analysis</span>
            </button>
          </div>
        </div>

        {/* Results Section */}
        {(scrapeResult || visionResult || extractResult || analyzeResult) && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            {/* Result Tabs */}
            <div className="flex border-b border-gray-200">
              {scrapeResult && (
                <button
                  onClick={() => setActiveResultTab('scrape')}
                  className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors ${
                    activeResultTab === 'scrape'
                      ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-500'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Code className="w-4 h-4" />
                  Scrape
                  {scrapeResult.success ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500" />
                  )}
                </button>
              )}
              {visionResult && (
                <button
                  onClick={() => setActiveResultTab('vision')}
                  className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors ${
                    activeResultTab === 'vision'
                      ? 'bg-purple-50 text-purple-700 border-b-2 border-purple-500'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Eye className="w-4 h-4" />
                  Vision
                  {visionResult.success ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500" />
                  )}
                </button>
              )}
              {extractResult && (
                <button
                  onClick={() => setActiveResultTab('extract')}
                  className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors ${
                    activeResultTab === 'extract'
                      ? 'bg-green-50 text-green-700 border-b-2 border-green-500'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Layers className="w-4 h-4" />
                  Extract
                  {extractResult.success ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500" />
                  )}
                </button>
              )}
              {analyzeResult && (
                <button
                  onClick={() => setActiveResultTab('analyze')}
                  className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors ${
                    activeResultTab === 'analyze'
                      ? 'bg-orange-50 text-orange-700 border-b-2 border-orange-500'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Zap className="w-4 h-4" />
                  Full Analysis
                  {analyzeResult.success ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500" />
                  )}
                </button>
              )}
            </div>

            {/* Result Content */}
            <div className="p-6">
              {getCurrentResult() && (
                <>
                  {/* Result Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                      {getCurrentResult()?.success ? (
                        <span className="flex items-center gap-2 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                          <CheckCircle className="w-4 h-4" />
                          Success
                        </span>
                      ) : (
                        <span className="flex items-center gap-2 px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                          <XCircle className="w-4 h-4" />
                          Error
                        </span>
                      )}
                      {getCurrentResult()?.duration_ms && (
                        <span className="flex items-center gap-1 text-sm text-gray-500">
                          <Clock className="w-4 h-4" />
                          {((getCurrentResult()?.duration_ms ?? 0) / 1000).toFixed(2)}s
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => copyToClipboard(getCurrentResult()?.data)}
                      className="flex items-center gap-2 px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <Copy className="w-4 h-4" />
                      Copy JSON
                    </button>
                  </div>

                  {/* Error Display */}
                  {getCurrentResult()?.error && (
                    <div className="mb-4 p-4 bg-red-50 rounded-lg border border-red-200">
                      <p className="text-red-700 font-medium">{getCurrentResult()?.error}</p>
                      {getCurrentResult()?.details && (
                        <pre className="mt-2 text-xs text-red-600 whitespace-pre-wrap">
                          {getCurrentResult()?.details}
                        </pre>
                      )}
                    </div>
                  )}

                  {/* JSON Result */}
                  {getCurrentResult()?.success && getCurrentResult()?.data && (
                    <div className="bg-gray-900 rounded-lg overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-2 bg-gray-800">
                        <span className="text-gray-400 text-sm">Response JSON</span>
                      </div>
                      <pre className="p-4 text-sm text-green-400 overflow-x-auto max-h-[600px] overflow-y-auto">
                        {JSON.stringify(getCurrentResult()?.data, null, 2)}
                      </pre>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Loading Overlay */}
        {isAnyLoading && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-8 shadow-2xl flex flex-col items-center">
              <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
              <p className="text-gray-900 font-medium">
                {scrapeLoading && 'Scraping page...'}
                {visionLoading && 'Vision analysis in progress...'}
                {extractLoading && 'Extracting structure...'}
                {analyzeLoading && 'Full analysis in progress...'}
              </p>
              <p className="text-gray-500 text-sm mt-2">This may take a few seconds</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
