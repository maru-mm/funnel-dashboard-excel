'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Header from '@/components/Header';
import { useStore } from '@/store/useStore';
import {
  BUILT_IN_PAGE_TYPE_OPTIONS,
  PAGE_TYPE_CATEGORIES,
  STATUS_OPTIONS,
  SECTION_TYPE_COLORS,
  PageType,
  PageTypeOption,
  VisionJobSummary,
  VisionJobDetail,
} from '@/types';
import {
  Plus,
  Trash2,
  Play,
  Loader2,
  ExternalLink,
  CheckCircle,
  XCircle,
  Search,
  FileText,
  Eye,
  Code,
  Settings,
  Wand2,
  X,
  Image as ImageIcon,
  Layers,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from 'lucide-react';

// API endpoints - can switch between local proxy, direct fly.dev, or local dev server
const API_ENDPOINTS = {
  local: {
    name: 'Local Proxy',
    icon: '🖥️',
    start: '/api/pipeline/start',
    status: (jobId: string) => `/api/pipeline/status/${jobId}`,
    result: (jobId: string) => `/api/pipeline/result/${jobId}`,
    resultJson: (jobId: string) => `/api/pipeline/result/${jobId}?format=json`,
    jobs: '/api/pipeline/jobs',
  },
  server: {
    name: 'Fly.dev',
    icon: '☁️',
    start: 'https://claude-code-agents.fly.dev/api/pipeline/jobs/start',
    status: (jobId: string) => `https://claude-code-agents.fly.dev/api/pipeline/jobs/${jobId}/status`,
    result: (jobId: string) => `https://claude-code-agents.fly.dev/api/pipeline/jobs/${jobId}/result`,
    resultJson: (jobId: string) => `https://claude-code-agents.fly.dev/api/pipeline/jobs/${jobId}/result/json`,
    jobs: 'https://claude-code-agents.fly.dev/api/pipeline/jobs',
  },
  localDev: {
    name: 'Dev Server',
    icon: '🔧',
    start: 'http://localhost:8081/api/pipeline/jobs/start',
    status: (jobId: string) => `http://localhost:8081/api/pipeline/jobs/${jobId}/status`,
    result: (jobId: string) => `http://localhost:8081/api/pipeline/jobs/${jobId}/result`,
    resultJson: (jobId: string) => `http://localhost:8081/api/pipeline/jobs/${jobId}/result/json`,
    jobs: 'http://localhost:8081/api/pipeline/jobs',
  },
};

type ApiMode = 'local' | 'server' | 'localDev';

interface SwipeJobConfig {
  url: string;
  product_name: string;
  product_description: string;
  cta_text: string;
  cta_url: string;
  language: string;
  benefits: string[];
  brand_name: string;
}

interface JobStatus {
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  current_layer?: string;
  error?: string;
  result_url?: string;
  started_at?: string;
  completed_at?: string;
  vision_job_id?: string; // Available after Layer 1 (screenshot + vision analysis)
}

interface ActiveJob {
  pageId: string;
  jobId: string;
  status: JobStatus['status'];
  progress: number;
  currentLayer?: string;
  startedAt?: Date;
  lastUpdate?: Date;
  visionJobId?: string; // Vision analysis job ID
}

export default function FrontEndFunnel() {
  const {
    products,
    templates,
    funnelPages,
    addFunnelPage,
    updateFunnelPage,
    deleteFunnelPage,
    customPageTypes,
  } = useStore();

  // Combine built-in and custom page types
  const allPageTypeOptions: PageTypeOption[] = [
    ...BUILT_IN_PAGE_TYPE_OPTIONS,
    ...(customPageTypes || []).map(ct => ({
      value: ct.value,
      label: ct.label,
      category: 'custom' as const,
    })),
  ];

  // Group page types by category for select dropdown
  const groupedPageTypes: Record<string, PageTypeOption[]> = {};
  PAGE_TYPE_CATEGORIES.forEach(cat => {
    groupedPageTypes[cat.value] = allPageTypeOptions.filter(opt => opt.category === cat.value);
  });

  // Get label for a page type value
  const getPageTypeLabel = (value: PageType): string => {
    const option = allPageTypeOptions.find(opt => opt.value === value);
    return option?.label || value;
  };

  const [loadingIds, setLoadingIds] = useState<string[]>([]);
  const [analyzingIds, setAnalyzingIds] = useState<string[]>([]);
  const [analysisModal, setAnalysisModal] = useState<{
    isOpen: boolean;
    pageId: string;
    result: string | null;
    extractedData: { headline: string; subheadline: string; cta: string[]; price: string | null; benefits: string[] } | null;
  }>({ isOpen: false, pageId: '', result: null, extractedData: null });

  const [htmlPreviewModal, setHtmlPreviewModal] = useState<{
    isOpen: boolean;
    title: string;
    html: string;
    iframeSrc: string;
    metadata: { method: string; length: number; duration: number } | null;
  }>({ isOpen: false, title: '', html: '', iframeSrc: '', metadata: null });

  // Swipe Configuration Modal
  const [swipeConfigModal, setSwipeConfigModal] = useState<{
    isOpen: boolean;
    pageId: string;
    pageName: string;
    url: string;
  }>({ isOpen: false, pageId: '', pageName: '', url: '' });

  const [swipeConfig, setSwipeConfig] = useState<SwipeJobConfig>({
    url: '',
    product_name: '',
    product_description: '',
    cta_text: 'COMPRA ORA',
    cta_url: '',
    language: 'it',
    benefits: [],
    brand_name: '',
  });
  const [benefitInput, setBenefitInput] = useState('');

  // Active Jobs tracking
  const [activeJobs, setActiveJobs] = useState<ActiveJob[]>([]);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // API Mode: 'local' uses Next.js proxy, 'server' calls fly.dev, 'localDev' calls localhost:8081
  const [apiMode, setApiMode] = useState<ApiMode>('localDev');
  const api = API_ENDPOINTS[apiMode];

  // Jobs Monitor Panel
  const [showJobsPanel, setShowJobsPanel] = useState(false);

  // Vision Analysis Modal
  const [visionModal, setVisionModal] = useState<{
    isOpen: boolean;
    pageId: string;
    pageName: string;
    sourceUrl: string;
  }>({ isOpen: false, pageId: '', pageName: '', sourceUrl: '' });
  const [visionJobs, setVisionJobs] = useState<VisionJobSummary[]>([]);
  const [selectedVisionJob, setSelectedVisionJob] = useState<VisionJobDetail | null>(null);
  const [visionLoading, setVisionLoading] = useState(false);
  const [visionError, setVisionError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<number[]>([]);

  // Poll job status - uses selected API mode
  const pollJobStatus = useCallback(async (jobId: string, pageId: string) => {
    try {
      const response = await fetch(api.status(jobId));
      const status: JobStatus = await response.json();

      // Update active job with detailed info (including vision_job_id when available)
      setActiveJobs(prev => prev.map(job => 
        job.jobId === jobId 
          ? { 
              ...job, 
              status: status.status, 
              progress: status.progress || 0,
              currentLayer: status.current_layer,
              lastUpdate: new Date(),
              // Save vision_job_id when it becomes available (after Layer 1)
              visionJobId: status.vision_job_id || job.visionJobId,
            }
          : job
      ));

      // Update page result with layer info
      const layerInfo = status.current_layer ? ` [${status.current_layer}]` : '';
      updateFunnelPage(pageId, {
        swipeResult: `${status.progress || 0}%${layerInfo}`,
      });

      if (status.status === 'completed') {
        // Job completed - update page and show result
        updateFunnelPage(pageId, {
          swipeStatus: 'completed',
          swipeResult: `✓ Completato!`,
        });
        
        setLoadingIds(prev => prev.filter(i => i !== pageId));
        
        // Keep job in list for 5 seconds to show completion
        setTimeout(() => {
          setActiveJobs(prev => prev.filter(job => job.jobId !== jobId));
        }, 5000);

        // Open preview modal with iframe to result
        const page = (funnelPages || []).find(p => p.id === pageId);
        setHtmlPreviewModal({
          isOpen: true,
          title: page?.name || 'Risultato Swipe',
          html: '',
          iframeSrc: api.result(jobId),
          metadata: null,
        });

        return true; // Stop polling
      } else if (status.status === 'failed') {
        updateFunnelPage(pageId, {
          swipeStatus: 'failed',
          swipeResult: status.error || 'Job fallito',
        });
        setLoadingIds(prev => prev.filter(i => i !== pageId));
        setActiveJobs(prev => prev.filter(job => job.jobId !== jobId));
        return true; // Stop polling
      }

      return false; // Continue polling
    } catch (error) {
      console.error('Error polling job status:', error);
      // Update with error but keep polling
      setActiveJobs(prev => prev.map(job => 
        job.jobId === jobId 
          ? { ...job, lastUpdate: new Date() }
          : job
      ));
      return false;
    }
  }, [api, funnelPages, updateFunnelPage]);

  // Polling effect
  useEffect(() => {
    if (activeJobs.length === 0) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    pollingRef.current = setInterval(async () => {
      for (const job of activeJobs) {
        if (job.status === 'pending' || job.status === 'running') {
          await pollJobStatus(job.jobId, job.pageId);
        }
      }
    }, 5000); // Poll every 5 seconds as recommended

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [activeJobs, pollJobStatus]);

  const handleAddPage = () => {
    addFunnelPage({
      name: 'Nuova Pagina',
      pageType: 'landing',
      template: 'advertorial',
      productId: products[0]?.id || '',
      urlToSwipe: '',
      swipeStatus: 'pending',
    });
  };

  // Open swipe config modal
  const openSwipeConfig = (page: typeof funnelPages[0]) => {
    const product = (products || []).find(p => p.id === page.productId);
    
    setSwipeConfig({
      url: page.urlToSwipe,
      product_name: product?.name || '',
      product_description: product?.description || '',
      cta_text: product?.ctaText || 'COMPRA ORA',
      cta_url: product?.ctaUrl || '',
      language: 'it',
      benefits: product?.benefits || [],
      brand_name: product?.brandName || '',
    });

    setSwipeConfigModal({
      isOpen: true,
      pageId: page.id,
      pageName: page.name,
      url: page.urlToSwipe,
    });
  };

  // =====================================================
  // VISION ANALYSIS FUNCTIONS
  // =====================================================

  // Fetch vision jobs for a source URL
  const fetchVisionJobs = async (sourceUrl: string) => {
    setVisionLoading(true);
    setVisionError(null);
    setVisionJobs([]);
    setSelectedVisionJob(null);

    try {
      // Encode the URL to use as project_id filter
      const projectId = encodeURIComponent(sourceUrl);
      const response = await fetch(`/api/vision/jobs?project_id=${projectId}&limit=20`);
      const data = await response.json();

      if (!data.success) {
        setVisionError(data.error || 'Errore nel recupero delle analisi');
        return;
      }

      setVisionJobs(data.jobs || []);
      
      // Auto-select the first completed job if available
      const completedJobs = (data.jobs || []).filter((j: VisionJobSummary) => j.status === 'completed');
      if (completedJobs.length > 0) {
        fetchVisionJobDetail(completedJobs[0].id);
      }
    } catch (error) {
      console.error('Error fetching vision jobs:', error);
      setVisionError(error instanceof Error ? error.message : 'Errore di rete');
    } finally {
      setVisionLoading(false);
    }
  };

  // Fetch detailed vision job data
  const fetchVisionJobDetail = async (jobId: string) => {
    setVisionLoading(true);
    setVisionError(null);

    try {
      const response = await fetch(`/api/vision/jobs/${jobId}`);
      const data = await response.json();

      if (!data.success) {
        setVisionError(data.error || 'Errore nel recupero dei dettagli');
        return;
      }

      setSelectedVisionJob(data.job);
      setExpandedSections([]);
    } catch (error) {
      console.error('Error fetching vision job detail:', error);
      setVisionError(error instanceof Error ? error.message : 'Errore di rete');
    } finally {
      setVisionLoading(false);
    }
  };

  // Open vision analysis modal for a page
  const openVisionModal = (page: typeof funnelPages[0]) => {
    setVisionModal({
      isOpen: true,
      pageId: page.id,
      pageName: page.name,
      sourceUrl: page.urlToSwipe,
    });
    
    // Fetch vision jobs for this URL
    if (page.urlToSwipe) {
      fetchVisionJobs(page.urlToSwipe);
    }
  };

  // Toggle section expansion
  const toggleSectionExpanded = (index: number) => {
    setExpandedSections(prev =>
      prev.includes(index)
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  };

  // Get color class for section type
  const getSectionTypeColor = (type: string): string => {
    const normalizedType = type.toLowerCase().replace(/[^a-z]/g, '_');
    return SECTION_TYPE_COLORS[normalizedType] || SECTION_TYPE_COLORS.unknown;
  };

  // Launch swipe with job API - uses selected API mode
  const handleLaunchSwipeJob = async () => {
    const pageId = swipeConfigModal.pageId;
    
    setSwipeConfigModal({ isOpen: false, pageId: '', pageName: '', url: '' });
    setLoadingIds(prev => [...prev, pageId]);
    setShowJobsPanel(true); // Auto-show jobs panel
    updateFunnelPage(pageId, { swipeStatus: 'in_progress', swipeResult: `Avvio...` });

    try {
      let response: Response;

      // Generate project_id from URL (use domain as identifier)
      const projectId = swipeConfig.url ? new URL(swipeConfig.url).hostname : 'default';
      const userId = 'funnel-swiper-user'; // Default user - can be dynamic later

      if (apiMode === 'local') {
        // Use local proxy API to avoid CORS
        response = await fetch(api.start, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: swipeConfig.url,
            product_name: swipeConfig.product_name,
            product_description: swipeConfig.product_description,
            cta_text: swipeConfig.cta_text,
            cta_url: swipeConfig.cta_url,
            language: swipeConfig.language,
            brand_name: swipeConfig.brand_name,
            benefits: swipeConfig.benefits.filter(b => b.trim()),
            project_id: projectId,
            user_id: userId,
          }),
        });
      } else {
        // Direct server call with query params (for server and localDev modes)
        const params = new URLSearchParams({
          url: swipeConfig.url,
          product_name: swipeConfig.product_name,
          product_description: swipeConfig.product_description,
          cta_text: swipeConfig.cta_text,
          cta_url: swipeConfig.cta_url,
          language: swipeConfig.language,
          project_id: projectId,
          user_id: userId,
        });
        
        swipeConfig.benefits.forEach(benefit => {
          if (benefit.trim()) params.append('benefits', benefit.trim());
        });
        if (swipeConfig.brand_name) params.append('brand_name', swipeConfig.brand_name);

        response = await fetch(`${api.start}?${params.toString()}`, {
          method: 'POST',
        });
      }

      const data = await response.json();

      if (!response.ok || !data.job_id) {
        throw new Error(data.error || data.detail || 'Errore avvio job');
      }

      // Add to active jobs for polling with start time
      setActiveJobs(prev => [...prev, {
        pageId,
        jobId: data.job_id,
        status: 'pending',
        progress: 0,
        startedAt: new Date(),
        lastUpdate: new Date(),
      }]);

      updateFunnelPage(pageId, { 
        swipeStatus: 'in_progress', 
        swipeResult: `0%` 
      });

    } catch (error) {
      updateFunnelPage(pageId, {
        swipeStatus: 'failed',
        swipeResult: error instanceof Error ? error.message : 'Errore di rete',
      });
      setLoadingIds(prev => prev.filter(i => i !== pageId));
    }
  };

  const addBenefit = () => {
    if (benefitInput.trim() && !swipeConfig.benefits.includes(benefitInput.trim())) {
      setSwipeConfig({
        ...swipeConfig,
        benefits: [...swipeConfig.benefits, benefitInput.trim()],
      });
      setBenefitInput('');
    }
  };

  const removeBenefit = (index: number) => {
    setSwipeConfig({
      ...swipeConfig,
      benefits: swipeConfig.benefits.filter((_, i) => i !== index),
    });
  };

  const getActiveJob = (pageId: string) => activeJobs.find(j => j.pageId === pageId);

  const handleAnalyze = async (page: typeof funnelPages[0]) => {
    if (!page.urlToSwipe) return;
    
    setAnalyzingIds((prev) => [...prev, page.id]);
    updateFunnelPage(page.id, { analysisStatus: 'in_progress' });

    try {
      const response = await fetch('/api/funnel/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: page.urlToSwipe,
          pageType: page.pageType,
          template: page.template,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        updateFunnelPage(page.id, { 
          analysisStatus: 'failed',
          analysisResult: data.error || 'Errore durante l\'analisi'
        });
      } else {
        const resultText = data.analysis?.result || 
                          data.analysis?.error || 
                          JSON.stringify(data.analysis, null, 2);
        
        updateFunnelPage(page.id, { 
          analysisStatus: 'completed',
          analysisResult: resultText,
          extractedData: data.extractedData
        });

        // Apri il modal con i risultati
        setAnalysisModal({
          isOpen: true,
          pageId: page.id,
          result: resultText,
          extractedData: data.extractedData
        });
      }
    } catch (error) {
      updateFunnelPage(page.id, { 
        analysisStatus: 'failed',
        analysisResult: 'Errore di rete'
      });
    } finally {
      setAnalyzingIds((prev) => prev.filter((i) => i !== page.id));
    }
  };

  const getStatusBadge = (status: string) => {
    const statusOption = STATUS_OPTIONS.find((s) => s.value === status);
    return (
      <span
        className={`px-2 py-1 rounded-full text-xs font-medium ${
          statusOption?.color || 'bg-gray-200'
        }`}
      >
        {statusOption?.label || status}
      </span>
    );
  };

  return (
    <div className="min-h-screen">
      <Header
        title="Front End Funnel"
        subtitle="Gestisci le pagine del funnel con vista Excel"
      />

      <div className="p-6">
        {/* Toolbar */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <button
                onClick={handleAddPage}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Aggiungi Pagina
              </button>
              <span className="text-gray-500">
                {(funnelPages || []).length} pagine
              </span>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Jobs Monitor Toggle */}
              <button
                onClick={() => setShowJobsPanel(!showJobsPanel)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  showJobsPanel 
                    ? 'bg-purple-100 text-purple-700' 
                    : activeJobs.length > 0 
                      ? 'bg-yellow-100 text-yellow-700 animate-pulse' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Loader2 className={`w-4 h-4 ${activeJobs.length > 0 ? 'animate-spin' : ''}`} />
                Jobs {activeJobs.length > 0 && `(${activeJobs.length})`}
              </button>

              {/* API Mode Toggle */}
              <div className="flex items-center bg-gray-100 rounded-lg p-1">
                {(['localDev', 'local', 'server'] as ApiMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setApiMode(mode)}
                    className={`px-3 py-1.5 rounded text-sm font-medium transition-colors whitespace-nowrap ${
                      apiMode === mode
                        ? mode === 'localDev' 
                          ? 'bg-white text-orange-600 shadow-sm'
                          : mode === 'local'
                            ? 'bg-white text-blue-600 shadow-sm'
                            : 'bg-white text-green-600 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                    title={mode === 'localDev' ? 'localhost:8081' : mode === 'local' ? 'Next.js Proxy' : 'fly.dev'}
                  >
                    {API_ENDPOINTS[mode].icon} {API_ENDPOINTS[mode].name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Active Jobs Panel */}
          {showJobsPanel && activeJobs.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                  Jobs Attivi
                </h3>
                <span className="text-xs text-gray-500">
                  Polling ogni 5s • API: {API_ENDPOINTS[apiMode].name}
                </span>
              </div>
              <div className="space-y-3">
                {activeJobs.map((job) => {
                  const page = (funnelPages || []).find(p => p.id === job.pageId);
                  const elapsed = job.startedAt 
                    ? Math.floor((Date.now() - job.startedAt.getTime()) / 1000)
                    : 0;
                  
                  return (
                    <div 
                      key={job.jobId} 
                      className={`rounded-lg p-3 ${
                        job.status === 'completed' 
                          ? 'bg-green-50 border border-green-200' 
                          : job.status === 'failed'
                            ? 'bg-red-50 border border-red-200'
                            : 'bg-purple-50 border border-purple-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {job.status === 'completed' ? (
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          ) : job.status === 'failed' ? (
                            <XCircle className="w-4 h-4 text-red-600" />
                          ) : (
                            <Loader2 className="w-4 h-4 text-purple-600 animate-spin" />
                          )}
                          <span className="font-medium text-gray-900">
                            {page?.name || 'Job'}
                          </span>
                          <code className="text-xs bg-gray-200 px-1.5 py-0.5 rounded text-gray-600">
                            {job.jobId.slice(0, 8)}...
                          </code>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                          <span className="text-gray-500">
                            {Math.floor(elapsed / 60)}:{(elapsed % 60).toString().padStart(2, '0')}
                          </span>
                          <span className={`font-bold ${
                            job.status === 'completed' ? 'text-green-600' : 'text-purple-600'
                          }`}>
                            {job.progress}%
                          </span>
                        </div>
                      </div>
                      
                      {/* Progress Bar */}
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-500 ${
                            job.status === 'completed' 
                              ? 'bg-green-500' 
                              : job.status === 'failed'
                                ? 'bg-red-500'
                                : 'bg-purple-500'
                          }`}
                          style={{ width: `${job.progress}%` }}
                        />
                      </div>
                      
                      {/* Current Layer Info */}
                      {job.currentLayer && job.status === 'running' && (
                        <div className="mt-2 text-xs text-purple-700 flex items-center gap-1">
                          <span className="animate-pulse">●</span>
                          Layer: <span className="font-medium">{job.currentLayer}</span>
                        </div>
                      )}
                      
                      {/* Vision Job ID - Available after Layer 1 */}
                      {job.visionJobId && (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-xs text-indigo-600 flex items-center gap-1">
                            <ImageIcon className="w-3 h-3" />
                            Vision: <code className="bg-indigo-100 px-1 rounded">{job.visionJobId.slice(0, 8)}...</code>
                          </span>
                          <button
                            onClick={() => {
                              if (page) {
                                setVisionModal({
                                  isOpen: true,
                                  pageId: page.id,
                                  pageName: page.name,
                                  sourceUrl: page.urlToSwipe,
                                });
                                fetchVisionJobDetail(job.visionJobId!);
                              }
                            }}
                            className="text-xs text-indigo-600 hover:text-indigo-800 underline"
                          >
                            Vedi analisi
                          </button>
                        </div>
                      )}

                      {/* Result button when completed */}
                      {job.status === 'completed' && (
                        <div className="mt-2 flex gap-2">
                          <button
                            onClick={() => {
                              setHtmlPreviewModal({
                                isOpen: true,
                                title: page?.name || 'Risultato',
                                html: '',
                                iframeSrc: api.result(job.jobId),
                                metadata: null,
                              });
                            }}
                            className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                          >
                            <Eye className="w-3 h-3 inline mr-1" />
                            Vedi Risultato
                          </button>
                          <a
                            href={api.result(job.jobId)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs px-2 py-1 bg-gray-600 text-white rounded hover:bg-gray-700"
                          >
                            <ExternalLink className="w-3 h-3 inline mr-1" />
                            Apri
                          </a>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty Jobs Panel */}
          {showJobsPanel && activeJobs.length === 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200 text-center py-6 text-gray-500">
              <Loader2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>Nessun job attivo</p>
              <p className="text-xs mt-1">I job appariranno qui quando lanci uno swipe</p>
            </div>
          )}
        </div>

        {/* Excel-style Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="excel-table">
              <thead>
                <tr>
                  <th className="w-12">#</th>
                  <th className="min-w-[200px]">Nome Pagina</th>
                  <th className="min-w-[180px]">Tipo Pagina</th>
                  <th className="min-w-[180px]">Template da Swipare</th>
                  <th className="min-w-[300px]">URL da Swipare</th>
                  <th className="min-w-[150px]">Prodotto</th>
                  <th className="min-w-[120px]">Stato</th>
                  <th className="min-w-[200px]">Risultato Swipe</th>
                  <th className="min-w-[120px]">Analisi</th>
                  <th className="min-w-[180px]">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {(funnelPages || []).length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-8 text-gray-500">
                      Nessuna pagina. Clicca "Aggiungi Pagina" per iniziare.
                    </td>
                  </tr>
                ) : (
                  (funnelPages || []).map((page, index) => (
                    <tr key={page.id}>
                      {/* Row Number */}
                      <td className="text-center text-gray-500 bg-gray-50">
                        {index + 1}
                      </td>

                      {/* Page Name */}
                      <td>
                        <input
                          type="text"
                          value={page.name}
                          onChange={(e) =>
                            updateFunnelPage(page.id, { name: e.target.value })
                          }
                          className="font-medium"
                        />
                      </td>

                      {/* Page Type */}
                      <td>
                        <select
                          value={page.pageType}
                          onChange={(e) =>
                            updateFunnelPage(page.id, {
                              pageType: e.target.value as PageType,
                            })
                          }
                        >
                          {PAGE_TYPE_CATEGORIES.map((category) => {
                            const categoryOptions = groupedPageTypes[category.value] || [];
                            if (categoryOptions.length === 0) return null;
                            return (
                              <optgroup key={category.value} label={category.label}>
                                {categoryOptions.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </optgroup>
                            );
                          })}
                        </select>
                      </td>

                      {/* Template da Swipare */}
                      <td>
                        <select
                          value={page.templateId || ''}
                          onChange={(e) => {
                            const templateId = e.target.value;
                            const selectedTemplate = (templates || []).find(t => t.id === templateId);
                            updateFunnelPage(page.id, {
                              templateId: templateId || undefined,
                              urlToSwipe: selectedTemplate?.sourceUrl || page.urlToSwipe,
                            });
                          }}
                          className="text-sm"
                        >
                          <option value="">-- Seleziona Template --</option>
                          {(templates || []).filter(t => (t.category || 'standard') === 'standard').length > 0 && (
                            <optgroup label="📄 Template Standard">
                              {(templates || [])
                                .filter(t => (t.category || 'standard') === 'standard')
                                .map((template) => (
                                  <option key={template.id} value={template.id}>
                                    {template.name}{template.tags?.length ? ` [${template.tags.join(', ')}]` : ''}
                                  </option>
                                ))}
                            </optgroup>
                          )}
                          {(templates || []).filter(t => t.category === 'quiz').length > 0 && (
                            <optgroup label="❓ Quiz Template">
                              {(templates || [])
                                .filter(t => t.category === 'quiz')
                                .map((template) => (
                                  <option key={template.id} value={template.id}>
                                    {template.name}{template.tags?.length ? ` [${template.tags.join(', ')}]` : ''}
                                  </option>
                                ))}
                            </optgroup>
                          )}
                        </select>
                      </td>

                      {/* URL to Swipe */}
                      <td>
                        <div className="flex items-center gap-1">
                          <input
                            type="url"
                            value={page.urlToSwipe}
                            onChange={(e) =>
                              updateFunnelPage(page.id, {
                                urlToSwipe: e.target.value,
                              })
                            }
                            placeholder="https://..."
                            className="flex-1"
                          />
                          {page.urlToSwipe && (
                            <a
                              href={page.urlToSwipe}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-500 hover:text-blue-700 p-1"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                      </td>

                      {/* Product */}
                      <td>
                        <select
                          value={page.productId}
                          onChange={(e) =>
                            updateFunnelPage(page.id, {
                              productId: e.target.value,
                            })
                          }
                        >
                          <option value="">Seleziona...</option>
                          {(products || []).map((prod) => (
                            <option key={prod.id} value={prod.id}>
                              {prod.name}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Status */}
                      <td className="text-center">
                        {getStatusBadge(page.swipeStatus)}
                      </td>

                      {/* Swipe Result */}
                      <td>
                        <div className="flex items-center gap-2">
                          {page.swipeStatus === 'completed' && (
                            <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                          )}
                          {page.swipeStatus === 'failed' && (
                            <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                          )}
                          <span className="text-sm truncate max-w-[150px]" title={page.swipeResult || ''}>
                            {page.swipeResult || '-'}
                          </span>
                          {(page.swipedData || page.clonedData) && (
                            <button
                              onClick={() => {
                                if (page.swipedData) {
                                  setHtmlPreviewModal({
                                    isOpen: true,
                                    title: page.swipedData.newTitle || page.name,
                                    html: page.swipedData.html,
                                    iframeSrc: '',
                                    metadata: {
                                      method: page.swipedData.methodUsed,
                                      length: page.swipedData.newLength,
                                      duration: page.swipedData.processingTime,
                                    },
                                  });
                                } else if (page.clonedData) {
                                  setHtmlPreviewModal({
                                    isOpen: true,
                                    title: page.clonedData!.title || page.name,
                                    html: page.clonedData!.html,
                                    iframeSrc: '',
                                    metadata: {
                                      method: page.clonedData!.method_used,
                                      length: page.clonedData!.content_length,
                                      duration: page.clonedData!.duration_seconds,
                                    },
                                  });
                                }
                              }}
                              className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded text-xs font-medium"
                              title="Visualizza HTML swipato"
                            >
                              <Eye className="w-3 h-3" />
                              Preview
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Analysis Status */}
                      <td className="text-center">
                        {page.analysisStatus ? (
                          <button
                            onClick={() => {
                              if (page.analysisResult) {
                                setAnalysisModal({
                                  isOpen: true,
                                  pageId: page.id,
                                  result: page.analysisResult,
                                  extractedData: page.extractedData || null
                                });
                              }
                            }}
                            className={`px-2 py-1 rounded-full text-xs font-medium cursor-pointer hover:opacity-80 ${
                              page.analysisStatus === 'completed'
                                ? 'bg-purple-100 text-purple-800'
                                : page.analysisStatus === 'failed'
                                ? 'bg-red-100 text-red-800'
                                : page.analysisStatus === 'in_progress'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {page.analysisStatus === 'completed' ? (
                              <span className="flex items-center gap-1">
                                <FileText className="w-3 h-3" />
                                Vedi
                              </span>
                            ) : page.analysisStatus === 'in_progress' ? (
                              <span className="flex items-center gap-1">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                ...
                              </span>
                            ) : page.analysisStatus === 'failed' ? (
                              'Errore'
                            ) : (
                              '-'
                            )}
                          </button>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td>
                        <div className="flex items-center gap-2">
                          {/* Analyze Button */}
                          <button
                            onClick={() => handleAnalyze(page)}
                            disabled={
                              analyzingIds.includes(page.id) ||
                              page.analysisStatus === 'in_progress' ||
                              !page.urlToSwipe
                            }
                            className={`flex items-center gap-1 px-2 py-1 rounded text-sm font-medium transition-colors ${
                              analyzingIds.includes(page.id) ||
                              page.analysisStatus === 'in_progress'
                                ? 'bg-purple-100 text-purple-700'
                                : !page.urlToSwipe
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                            }`}
                            title="Analizza Funnel Step"
                          >
                            {analyzingIds.includes(page.id) ||
                            page.analysisStatus === 'in_progress' ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Search className="w-3 h-3" />
                            )}
                          </button>
                          {/* Swipe Button - Opens Config Modal */}
                          <button
                            onClick={() => openSwipeConfig(page)}
                            disabled={
                              loadingIds.includes(page.id) ||
                              page.swipeStatus === 'in_progress' ||
                              !page.urlToSwipe
                            }
                            className={`flex items-center gap-1 px-2 py-1 rounded text-sm font-medium transition-colors ${
                              loadingIds.includes(page.id) ||
                              page.swipeStatus === 'in_progress'
                                ? 'bg-yellow-100 text-yellow-700'
                                : !page.urlToSwipe
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'bg-green-100 text-green-700 hover:bg-green-200'
                            }`}
                            title="Configura e Lancia Swipe"
                          >
                            {loadingIds.includes(page.id) ||
                            page.swipeStatus === 'in_progress' ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin" />
                                {getActiveJob(page.id) && (
                                  <span className="text-xs">{getActiveJob(page.id)?.progress}%</span>
                                )}
                              </>
                            ) : (
                              <>
                                <Wand2 className="w-3 h-3" />
                                <span className="hidden sm:inline">Swipe</span>
                              </>
                            )}
                          </button>
                          {/* Vision Analysis Button */}
                          <button
                            onClick={() => openVisionModal(page)}
                            disabled={!page.urlToSwipe}
                            className={`flex items-center gap-1 px-2 py-1 rounded text-sm font-medium transition-colors ${
                              !page.urlToSwipe
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                            }`}
                            title="Vedi Analisi Vision (Claude)"
                          >
                            <ImageIcon className="w-3 h-3" />
                            <span className="hidden sm:inline">Vision</span>
                          </button>
                          {/* Delete Button */}
                          <button
                            onClick={() => deleteFunnelPage(page.id)}
                            className="p-1 text-red-500 hover:bg-red-50 rounded"
                            title="Elimina"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-6 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-900 mb-3">Legenda Tipi Pagina</h3>
          <div className="space-y-3">
            {PAGE_TYPE_CATEGORIES.map((category) => {
              const categoryOptions = groupedPageTypes[category.value] || [];
              if (categoryOptions.length === 0) return null;
              return (
                <div key={category.value}>
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${category.color} mb-2`}>
                    {category.label}
                  </span>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 pl-2">
                    {categoryOptions.map((opt) => (
                      <div key={opt.value} className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                        <span className="text-xs text-gray-600">{opt.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Swipe Configuration Modal */}
      {swipeConfigModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-green-600 to-emerald-600">
              <div className="flex items-center gap-3">
                <Settings className="w-6 h-6 text-white" />
                <div>
                  <h2 className="text-xl font-bold text-white">
                    Configura Swipe
                  </h2>
                  <p className="text-white/80 text-sm">
                    {swipeConfigModal.pageName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSwipeConfigModal({ isOpen: false, pageId: '', pageName: '', url: '' })}
                className="text-white/80 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
                {/* URL */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    URL da Swipare
                  </label>
                  <input
                    type="url"
                    value={swipeConfig.url}
                    onChange={(e) => setSwipeConfig({ ...swipeConfig, url: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                    placeholder="https://landing-page.com"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Product Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nome Prodotto *
                    </label>
                    <input
                      type="text"
                      value={swipeConfig.product_name}
                      onChange={(e) => setSwipeConfig({ ...swipeConfig, product_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                      placeholder="Il Tuo Prodotto"
                    />
                  </div>

                  {/* Brand Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Brand Name
                    </label>
                    <input
                      type="text"
                      value={swipeConfig.brand_name}
                      onChange={(e) => setSwipeConfig({ ...swipeConfig, brand_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                      placeholder="TuoBrand"
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descrizione Prodotto
                  </label>
                  <textarea
                    value={swipeConfig.product_description}
                    onChange={(e) => setSwipeConfig({ ...swipeConfig, product_description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                    rows={2}
                    placeholder="Descrizione del tuo prodotto..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* CTA Text */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Testo CTA
                    </label>
                    <input
                      type="text"
                      value={swipeConfig.cta_text}
                      onChange={(e) => setSwipeConfig({ ...swipeConfig, cta_text: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                      placeholder="COMPRA ORA"
                    />
                  </div>

                  {/* Language */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Lingua
                    </label>
                    <select
                      value={swipeConfig.language}
                      onChange={(e) => setSwipeConfig({ ...swipeConfig, language: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                    >
                      <option value="it">Italiano</option>
                      <option value="en">English</option>
                      <option value="es">Español</option>
                      <option value="fr">Français</option>
                      <option value="de">Deutsch</option>
                    </select>
                  </div>
                </div>

                {/* CTA URL */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    URL CTA
                  </label>
                  <input
                    type="url"
                    value={swipeConfig.cta_url}
                    onChange={(e) => setSwipeConfig({ ...swipeConfig, cta_url: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                    placeholder="https://tuosito.com/checkout"
                  />
                </div>

                {/* Benefits */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Benefici
                  </label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={benefitInput}
                      onChange={(e) => setBenefitInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addBenefit())}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                      placeholder="Aggiungi un beneficio..."
                    />
                    <button
                      type="button"
                      onClick={addBenefit}
                      className="px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200"
                    >
                      +
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {swipeConfig.benefits.map((benefit, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm"
                      >
                        {benefit}
                        <button
                          onClick={() => removeBenefit(index)}
                          className="hover:text-green-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                    {swipeConfig.benefits.length === 0 && (
                      <span className="text-sm text-gray-400 italic">Nessun beneficio</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => setSwipeConfigModal({ isOpen: false, pageId: '', pageName: '', url: '' })}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={handleLaunchSwipeJob}
                disabled={!swipeConfig.url || !swipeConfig.product_name}
                className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                <Wand2 className="w-4 h-4" />
                Lancia Swipe Job
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HTML Preview Modal */}
      {htmlPreviewModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-blue-600 to-cyan-600">
              <div className="flex items-center gap-3">
                <Code className="w-6 h-6 text-white" />
                <div>
                  <h2 className="text-xl font-bold text-white">
                    {htmlPreviewModal.title}
                  </h2>
                  {htmlPreviewModal.metadata && (
                    <p className="text-white/80 text-sm">
                      Metodo: {htmlPreviewModal.metadata.method} | 
                      {htmlPreviewModal.metadata.length.toLocaleString()} chars | 
                      {htmlPreviewModal.metadata.duration.toFixed(2)}s
                    </p>
                  )}
                  {htmlPreviewModal.iframeSrc && (
                    <p className="text-white/80 text-sm">
                      Risultato dal job pipeline
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => setHtmlPreviewModal({ isOpen: false, title: '', html: '', iframeSrc: '', metadata: null })}
                className="text-white/80 hover:text-white text-2xl font-bold"
              >
                ×
              </button>
            </div>

            {/* Modal Body - Tabs */}
            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="flex border-b border-gray-200">
                <button
                  className="px-4 py-2 text-sm font-medium text-blue-600 border-b-2 border-blue-600"
                >
                  Preview
                </button>
                {htmlPreviewModal.html && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(htmlPreviewModal.html);
                      alert('HTML copiato negli appunti!');
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700"
                  >
                    Copia HTML
                  </button>
                )}
                {htmlPreviewModal.iframeSrc && (
                  <a
                    href={htmlPreviewModal.iframeSrc}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Apri in nuova tab
                  </a>
                )}
              </div>
              
              {/* Preview iframe */}
              <div className="flex-1 overflow-hidden bg-gray-100 p-2">
                <iframe
                  src={htmlPreviewModal.iframeSrc || undefined}
                  srcDoc={htmlPreviewModal.html || undefined}
                  className="w-full h-full bg-white rounded border border-gray-300"
                  sandbox="allow-same-origin allow-scripts"
                  title="HTML Preview"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-2">
              {htmlPreviewModal.html && (
                <button
                  onClick={() => {
                    const blob = new Blob([htmlPreviewModal.html], { type: 'text/html' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${htmlPreviewModal.title.replace(/[^a-z0-9]/gi, '_')}.html`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Scarica HTML
                </button>
              )}
              <button
                onClick={() => setHtmlPreviewModal({ isOpen: false, title: '', html: '', iframeSrc: '', metadata: null })}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Analysis Modal */}
      {analysisModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-purple-600 to-blue-600">
              <div className="flex items-center gap-3">
                <FileText className="w-6 h-6 text-white" />
                <h2 className="text-xl font-bold text-white">
                  Analisi Funnel Step
                </h2>
              </div>
              <button
                onClick={() => setAnalysisModal({ isOpen: false, pageId: '', result: null, extractedData: null })}
                className="text-white/80 hover:text-white text-2xl font-bold"
              >
                ×
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Extracted Data */}
              {analysisModal.extractedData && (
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs">ESTRATTO</span>
                    Dati dalla Pagina
                  </h3>
                  <div className="space-y-3 text-sm">
                    {analysisModal.extractedData.headline && (
                      <div>
                        <span className="font-medium text-gray-700">Headline:</span>
                        <p className="text-gray-900 mt-1">&quot;{analysisModal.extractedData.headline}&quot;</p>
                      </div>
                    )}
                    {analysisModal.extractedData.subheadline && (
                      <div>
                        <span className="font-medium text-gray-700">Subheadline:</span>
                        <p className="text-gray-600 mt-1">{analysisModal.extractedData.subheadline}</p>
                      </div>
                    )}
                    {analysisModal.extractedData.cta && analysisModal.extractedData.cta.length > 0 && (
                      <div>
                        <span className="font-medium text-gray-700">CTA:</span>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {analysisModal.extractedData.cta.slice(0, 5).map((cta, i) => (
                            <span key={i} className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                              {cta}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {analysisModal.extractedData.price && (
                      <div>
                        <span className="font-medium text-gray-700">Prezzo:</span>
                        <span className="ml-2 bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-sm font-bold">
                          {analysisModal.extractedData.price}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Analysis Result */}
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs">AI</span>
                  Risultato Analisi
                </h3>
                <div className="prose prose-sm max-w-none">
                  <pre className="whitespace-pre-wrap text-gray-700 text-sm leading-relaxed font-sans bg-gray-50 p-4 rounded-lg">
                    {analysisModal.result}
                  </pre>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end">
              <button
                onClick={() => setAnalysisModal({ isOpen: false, pageId: '', result: null, extractedData: null })}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== VISION ANALYSIS MODAL ==================== */}
      {visionModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-purple-600 to-indigo-600">
              <div className="flex items-center gap-3">
                <ImageIcon className="w-6 h-6 text-white" />
                <div>
                  <h2 className="text-xl font-bold text-white">
                    Analisi Vision AI
                  </h2>
                  <p className="text-white/80 text-sm truncate max-w-md">
                    {visionModal.pageName} - {visionModal.sourceUrl}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fetchVisionJobs(visionModal.sourceUrl)}
                  className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors"
                  title="Ricarica"
                >
                  <RefreshCw className={`w-5 h-5 ${visionLoading ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={() => {
                    setVisionModal({ isOpen: false, pageId: '', pageName: '', sourceUrl: '' });
                    setSelectedVisionJob(null);
                    setVisionJobs([]);
                    setVisionError(null);
                  }}
                  className="text-white/80 hover:text-white text-2xl font-bold px-2"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Loading State */}
              {visionLoading && !selectedVisionJob && (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="w-12 h-12 text-purple-500 animate-spin mb-4" />
                  <p className="text-gray-600">Caricamento analisi vision...</p>
                </div>
              )}

              {/* Error State */}
              {visionError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                  <div className="flex items-center gap-2 text-red-700">
                    <XCircle className="w-5 h-5" />
                    <span className="font-medium">Errore</span>
                  </div>
                  <p className="text-red-600 mt-1">{visionError}</p>
                </div>
              )}

              {/* No Jobs Found */}
              {!visionLoading && !visionError && visionJobs.length === 0 && (
                <div className="text-center py-12">
                  <ImageIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Nessuna analisi trovata</h3>
                  <p className="text-gray-500">
                    Non sono state trovate analisi vision per questa pagina.
                    <br />
                    Lancia prima un job di swipe per generare l&apos;analisi.
                  </p>
                </div>
              )}

              {/* Jobs List */}
              {visionJobs.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-700 mb-3">
                    Analisi disponibili ({visionJobs.length})
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {visionJobs.map((job) => (
                      <button
                        key={job.id}
                        onClick={() => fetchVisionJobDetail(job.id)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                          selectedVisionJob?.id === job.id
                            ? 'bg-purple-600 text-white'
                            : job.status === 'completed'
                            ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                            : job.status === 'failed'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {job.status === 'completed' ? (
                          <CheckCircle className="w-4 h-4" />
                        ) : job.status === 'failed' ? (
                          <XCircle className="w-4 h-4" />
                        ) : (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        )}
                        <span>{new Date(job.created_at).toLocaleString('it-IT', { 
                          day: '2-digit', 
                          month: '2-digit', 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}</span>
                        {job.total_sections_detected > 0 && (
                          <span className="bg-white/50 px-1.5 py-0.5 rounded text-xs">
                            {job.total_sections_detected} sezioni
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Selected Job Details */}
              {selectedVisionJob && (
                <div className="space-y-6">
                  {/* Screenshot Preview */}
                  {selectedVisionJob.screenshot_url && (
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                        <Eye className="w-4 h-4" />
                        Screenshot Pagina
                      </h4>
                      <div className="relative rounded-lg overflow-hidden border border-gray-300 bg-white">
                        <img
                          src={selectedVisionJob.screenshot_url}
                          alt="Screenshot pagina"
                          className="w-full h-auto max-h-[400px] object-contain"
                        />
                      </div>
                    </div>
                  )}

                  {/* Page Structure Overview */}
                  {selectedVisionJob.page_structure && (
                    <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-200">
                      <h4 className="font-medium text-indigo-900 mb-3 flex items-center gap-2">
                        <Layers className="w-4 h-4" />
                        Struttura Pagina
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                        {Object.entries(selectedVisionJob.page_structure).map(([key, value]) => (
                          <div key={key} className="bg-white rounded-lg p-3 text-center">
                            <div className={`text-lg font-bold ${
                              typeof value === 'boolean' 
                                ? value ? 'text-green-600' : 'text-gray-400'
                                : 'text-indigo-600'
                            }`}>
                              {typeof value === 'boolean' ? (value ? '✓' : '✗') : value}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {key.replace(/_/g, ' ').replace(/has /i, '')}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Sections Analysis */}
                  {selectedVisionJob.sections && selectedVisionJob.sections.length > 0 && (
                    <div className="bg-white rounded-lg border border-gray-200">
                      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                        <h4 className="font-medium text-gray-900 flex items-center gap-2">
                          <Layers className="w-4 h-4 text-purple-500" />
                          Sezioni Rilevate ({selectedVisionJob.sections.length})
                        </h4>
                        <button
                          onClick={() => setExpandedSections(
                            expandedSections.length === selectedVisionJob.sections.length
                              ? []
                              : selectedVisionJob.sections.map((_, i) => i)
                          )}
                          className="text-sm text-purple-600 hover:text-purple-800"
                        >
                          {expandedSections.length === selectedVisionJob.sections.length 
                            ? 'Chiudi tutto' 
                            : 'Espandi tutto'}
                        </button>
                      </div>
                      <div className="divide-y divide-gray-100">
                        {selectedVisionJob.sections.map((section, idx) => (
                          <div key={idx} className="p-4">
                            <button
                              onClick={() => toggleSectionExpanded(idx)}
                              className="w-full flex items-center justify-between text-left"
                            >
                              <div className="flex items-center gap-3">
                                <span className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-sm font-bold">
                                  {section.section_index + 1}
                                </span>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getSectionTypeColor(section.section_type_hint)}`}>
                                  {section.section_type_hint}
                                </span>
                                {section.has_cta && (
                                  <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                                    CTA
                                  </span>
                                )}
                                <span className="text-sm text-gray-500">
                                  Confidence: {Math.round(section.confidence * 100)}%
                                </span>
                              </div>
                              {expandedSections.includes(idx) ? (
                                <ChevronUp className="w-5 h-5 text-gray-400" />
                              ) : (
                                <ChevronDown className="w-5 h-5 text-gray-400" />
                              )}
                            </button>
                            
                            {expandedSections.includes(idx) && (
                              <div className="mt-3 ml-11 space-y-2">
                                {section.text_preview && (
                                  <div className="bg-gray-50 rounded-lg p-3">
                                    <p className="text-xs text-gray-500 mb-1">Anteprima Testo</p>
                                    <p className="text-sm text-gray-700">{section.text_preview}</p>
                                  </div>
                                )}
                                {section.bounding_box && (
                                  <div className="text-xs text-gray-500">
                                    Posizione: x={section.bounding_box.x}, y={section.bounding_box.y}, 
                                    {section.bounding_box.width}x{section.bounding_box.height}px
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Images Analysis */}
                  {selectedVisionJob.images && selectedVisionJob.images.length > 0 && (
                    <div className="bg-white rounded-lg border border-gray-200">
                      <div className="px-4 py-3 border-b border-gray-200">
                        <h4 className="font-medium text-gray-900 flex items-center gap-2">
                          <ImageIcon className="w-4 h-4 text-blue-500" />
                          Immagini Analizzate ({selectedVisionJob.images.length})
                        </h4>
                      </div>
                      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                        {selectedVisionJob.images.map((img, idx) => (
                          <div key={idx} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                            <div className="flex items-start gap-3">
                              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                                <ImageIcon className="w-5 h-5 text-blue-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <span className="inline-block px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium mb-2">
                                  {img.image_type}
                                </span>
                                <p className="text-sm text-gray-700 mb-2">{img.description}</p>
                                {img.suggestion && (
                                  <div className="flex items-start gap-2 bg-yellow-50 rounded-lg p-2 border border-yellow-200">
                                    <Lightbulb className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                                    <p className="text-xs text-yellow-800">{img.suggestion}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recommendations */}
                  {selectedVisionJob.recommendations && selectedVisionJob.recommendations.length > 0 && (
                    <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                      <h4 className="font-medium text-green-900 mb-3 flex items-center gap-2">
                        <Lightbulb className="w-4 h-4" />
                        Raccomandazioni AI
                      </h4>
                      <ul className="space-y-2">
                        {selectedVisionJob.recommendations.map((rec, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="w-5 h-5 rounded-full bg-green-200 text-green-800 flex items-center justify-center text-xs font-bold flex-shrink-0">
                              {idx + 1}
                            </span>
                            <p className="text-sm text-green-800">{rec}</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Raw Analysis */}
                  {selectedVisionJob.raw_analysis && (
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                        <Code className="w-4 h-4" />
                        Analisi Completa (Raw)
                      </h4>
                      <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono bg-white p-4 rounded-lg border border-gray-200 max-h-[300px] overflow-y-auto">
                        {selectedVisionJob.raw_analysis}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
              <div className="text-sm text-gray-500">
                {selectedVisionJob && (
                  <>
                    Job ID: <code className="bg-gray-200 px-1 rounded">{selectedVisionJob.id.slice(0, 8)}...</code>
                    {selectedVisionJob.completed_at && (
                      <span className="ml-3">
                        Completato: {new Date(selectedVisionJob.completed_at).toLocaleString('it-IT')}
                      </span>
                    )}
                  </>
                )}
              </div>
              <button
                onClick={() => {
                  setVisionModal({ isOpen: false, pageId: '', pageName: '', sourceUrl: '' });
                  setSelectedVisionJob(null);
                  setVisionJobs([]);
                  setVisionError(null);
                }}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
