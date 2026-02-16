'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Header from '@/components/Header';
import { useStore } from '@/store/useStore';
import { fetchAffiliateSavedFunnels } from '@/lib/supabase-operations';
import type { AffiliateSavedFunnel } from '@/types/database';
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
  MessageSquare,
  FileStack,
  Target,
  Copy,
  Globe,
} from 'lucide-react';

// Helper: inject <base href> into cloned HTML so relative URLs resolve correctly in iframe preview
function injectBaseHref(html: string, originalUrl: string): string {
  try {
    const base = new URL(originalUrl);
    const baseHref = `${base.origin}/`;
    const baseTag = `<base href="${baseHref}" target="_blank">`;
    if (html.includes('<head>')) {
      return html.replace('<head>', `<head>${baseTag}`);
    } else if (/<head\s/.test(html)) {
      return html.replace(/<head([^>]*)>/, `<head$1>${baseTag}`);
    } else if (html.includes('<html')) {
      return html.replace(/<html([^>]*)>/, `<html$1><head>${baseTag}</head>`);
    }
    return baseTag + html;
  } catch {
    return html;
  }
}

// Type for steps inside affiliate_saved_funnels.steps (JSONB)
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
  prompt?: string;
}

interface JobStatus {
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  current_layer?: string;
  error?: string;
  result_url?: string;
  started_at?: string;
  completed_at?: string;
  vision_job_id?: string;
}

interface ActiveJob {
  pageId: string;
  jobId: string;
  status: JobStatus['status'];
  progress: number;
  currentLayer?: string;
  startedAt?: Date;
  lastUpdate?: Date;
  visionJobId?: string;
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

  const allPageTypeOptions: PageTypeOption[] = [
    ...BUILT_IN_PAGE_TYPE_OPTIONS,
    ...(customPageTypes || []).map((ct) => ({
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
    cta_text: 'BUY NOW',
    cta_url: '',
    language: 'en',
    benefits: [],
    brand_name: '',
    prompt: '',
  });
  const [benefitInput, setBenefitInput] = useState('');

  // Active Jobs tracking
  const [activeJobs, setActiveJobs] = useState<ActiveJob[]>([]);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // API Mode
  const [apiMode, setApiMode] = useState<ApiMode>('localDev');
  const api = API_ENDPOINTS[apiMode];

  // Jobs Monitor Panel
  const [showJobsPanel, setShowJobsPanel] = useState(false);

  // Saved Funnels (da affiliate_saved_funnels)
  const [affiliateFunnels, setAffiliateFunnels] = useState<AffiliateSavedFunnel[]>([]);
  const [affiliateFunnelsLoading, setAffiliateFunnelsLoading] = useState(false);
  const [affiliateFunnelsError, setAffiliateFunnelsError] = useState<string | null>(null);
  const [selectedAffiliateFunnelId, setSelectedAffiliateFunnelId] = useState<string | null>(null);

  // Clone Modal (smooth-responder Edge Function)
  const [cloneModal, setCloneModal] = useState<{
    isOpen: boolean;
    pageId: string;
    pageName: string;
    url: string;
  }>({ isOpen: false, pageId: '', pageName: '', url: '' });
  const [cloneMode, setCloneMode] = useState<'identical' | 'rewrite' | 'translate'>('identical');
  const [cloneConfig, setCloneConfig] = useState({
    productName: '',
    productDescription: '',
    framework: '',
    target: '',
    customPrompt: '',
    language: 'it',
    targetLanguage: 'Italiano',
  });
  const [cloningIds, setCloningIds] = useState<string[]>([]);
  const [cloneProgress, setCloneProgress] = useState<{
    phase: string;
    totalTexts: number;
    processedTexts: number;
    message: string;
  } | null>(null);

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

  const selectedAffiliateFunnel = useMemo(
    () => (selectedAffiliateFunnelId ? affiliateFunnels.find((f) => f.id === selectedAffiliateFunnelId) : null),
    [selectedAffiliateFunnelId, affiliateFunnels]
  );

  const affiliateFunnelSteps = useMemo<AffiliateFunnelStep[]>(() => {
    if (!selectedAffiliateFunnel) return [];
    const raw = selectedAffiliateFunnel.steps;
    if (Array.isArray(raw)) return raw as AffiliateFunnelStep[];
    return [];
  }, [selectedAffiliateFunnel]);

  const fetchAffiliateData = useCallback(async () => {
    setAffiliateFunnelsLoading(true);
    setAffiliateFunnelsError(null);
    try {
      const data = await fetchAffiliateSavedFunnels();
      setAffiliateFunnels(data);
    } catch (err) {
      setAffiliateFunnelsError(err instanceof Error ? err.message : 'Errore caricamento quiz funnel');
    } finally {
      setAffiliateFunnelsLoading(false);
    }
  }, []);

  // Load saved funnels on page load
  useEffect(() => {
    fetchAffiliateData();
  }, [fetchAffiliateData]);

  const handleUseAffiliateStepForSwipe = (step: AffiliateFunnelStep, funnelName: string) => {
    const stepType = step.step_type || 'landing';
    const pageType: PageType = stepType === 'quiz_question' || stepType === 'info_screen'
      ? 'quiz_funnel'
      : stepType === 'checkout'
        ? 'checkout'
        : stepType === 'landing'
          ? 'landing'
          : 'landing';

    addFunnelPage({
      name: step.title
        ? `${funnelName} - Step ${step.step_index}: ${step.title}`.slice(0, 80)
        : `${funnelName} - Step ${step.step_index}`,
      pageType,
      productId: products[0]?.id || '',
      urlToSwipe: step.url || '',
      prompt: step.description || '',
      swipeStatus: 'pending',
      feedback: '',
    });
  };

  const handleImportAllAffiliateSteps = () => {
    if (!selectedAffiliateFunnel || affiliateFunnelSteps.length === 0) return;
    const funnelName = selectedAffiliateFunnel.funnel_name;
    for (const step of affiliateFunnelSteps) {
      handleUseAffiliateStepForSwipe(step, funnelName);
    }
  };

  // Poll job status
  const pollJobStatus = useCallback(async (jobId: string, pageId: string) => {
    try {
      const response = await fetch(api.status(jobId));
      const status: JobStatus = await response.json();

      setActiveJobs(prev => prev.map(job => 
        job.jobId === jobId 
          ? { 
              ...job, 
              status: status.status, 
              progress: status.progress || 0,
              currentLayer: status.current_layer,
              lastUpdate: new Date(),
              visionJobId: status.vision_job_id || job.visionJobId,
            }
          : job
      ));

      const layerInfo = status.current_layer ? ` [${status.current_layer}]` : '';
      updateFunnelPage(pageId, {
        swipeResult: `${status.progress || 0}%${layerInfo}`,
      });

      if (status.status === 'completed') {
        updateFunnelPage(pageId, {
          swipeStatus: 'completed',
          swipeResult: `✓ Completed!`,
        });
        
        setLoadingIds(prev => prev.filter(i => i !== pageId));
        
        setTimeout(() => {
          setActiveJobs(prev => prev.filter(job => job.jobId !== jobId));
        }, 5000);

        const page = (funnelPages || []).find(p => p.id === pageId);
        setHtmlPreviewModal({
          isOpen: true,
          title: page?.name || 'Swipe Result',
          html: '',
          iframeSrc: api.result(jobId),
          metadata: null,
        });

        return true;
      } else if (status.status === 'failed') {
        updateFunnelPage(pageId, {
          swipeStatus: 'failed',
          swipeResult: status.error || 'Job failed',
        });
        setLoadingIds(prev => prev.filter(i => i !== pageId));
        setActiveJobs(prev => prev.filter(job => job.jobId !== jobId));
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error polling job status:', error);
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
    }, 5000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [activeJobs, pollJobStatus]);

  const handleAddPage = () => {
    const stepNum = (funnelPages || []).length + 1;
    addFunnelPage({
      name: `Step ${stepNum}`,
      pageType: 'landing',
      productId: products[0]?.id || '',
      urlToSwipe: '',
      prompt: '',
      swipeStatus: 'pending',
      feedback: '',
    });
  };

  // Open swipe config modal
  const openSwipeConfig = (page: typeof funnelPages[0]) => {
    const product = (products || []).find(p => p.id === page.productId);
    
    setSwipeConfig({
      url: page.urlToSwipe,
      product_name: product?.name || '',
      product_description: product?.description || '',
      cta_text: product?.ctaText || 'BUY NOW',
      cta_url: product?.ctaUrl || '',
      language: 'en',
      benefits: product?.benefits || [],
      brand_name: product?.brandName || '',
      prompt: page.prompt || '',
    });

    setSwipeConfigModal({
      isOpen: true,
      pageId: page.id,
      pageName: page.name,
      url: page.urlToSwipe,
    });
  };

  // Vision Analysis Functions
  const fetchVisionJobs = async (sourceUrl: string) => {
    setVisionLoading(true);
    setVisionError(null);
    setVisionJobs([]);
    setSelectedVisionJob(null);

    try {
      const projectId = encodeURIComponent(sourceUrl);
      const response = await fetch(`/api/vision/jobs?project_id=${projectId}&limit=20`);
      const data = await response.json();

      if (!data.success) {
        setVisionError(data.error || 'Error fetching analyses');
        return;
      }

      setVisionJobs(data.jobs || []);
      
      const completedJobs = (data.jobs || []).filter((j: VisionJobSummary) => j.status === 'completed');
      if (completedJobs.length > 0) {
        fetchVisionJobDetail(completedJobs[0].id);
      }
    } catch (error) {
      console.error('Error fetching vision jobs:', error);
      setVisionError(error instanceof Error ? error.message : 'Network error');
    } finally {
      setVisionLoading(false);
    }
  };

  const fetchVisionJobDetail = async (jobId: string) => {
    setVisionLoading(true);
    setVisionError(null);

    try {
      const response = await fetch(`/api/vision/jobs/${jobId}`);
      const data = await response.json();

      if (!data.success) {
        setVisionError(data.error || 'Error fetching details');
        return;
      }

      setSelectedVisionJob(data.job);
      setExpandedSections([]);
    } catch (error) {
      console.error('Error fetching vision job detail:', error);
      setVisionError(error instanceof Error ? error.message : 'Network error');
    } finally {
      setVisionLoading(false);
    }
  };

  const openVisionModal = (page: typeof funnelPages[0]) => {
    setVisionModal({
      isOpen: true,
      pageId: page.id,
      pageName: page.name,
      sourceUrl: page.urlToSwipe,
    });
    
    if (page.urlToSwipe) {
      fetchVisionJobs(page.urlToSwipe);
    }
  };

  // Clone via smooth-responder Edge Function
  const openCloneModal = (page: typeof funnelPages[0]) => {
    const product = (products || []).find(p => p.id === page.productId);
    setCloneConfig({
      productName: product?.name || '',
      productDescription: product?.description || '',
      framework: '',
      target: '',
      customPrompt: page.prompt || '',
      language: 'it',
      targetLanguage: 'Italiano',
    });
    setCloneMode('identical');
    setCloneProgress(null);
    setCloneModal({
      isOpen: true,
      pageId: page.id,
      pageName: page.name,
      url: page.urlToSwipe,
    });
  };

  const handleClone = async () => {
    const pageId = cloneModal.pageId;
    const url = cloneModal.url;
    const pageName = cloneModal.pageName;
    const mode = cloneMode;

    setCloneModal({ isOpen: false, pageId: '', pageName: '', url: '' });
    setCloningIds(prev => [...prev, pageId]);
    updateFunnelPage(pageId, {
      swipeStatus: 'in_progress',
      swipeResult: mode === 'identical' ? 'Cloning...' : mode === 'translate' ? 'Translating...' : 'Rewriting...',
    });

    try {
      if (mode === 'identical') {
        // Identical clone - single call, no API key needed
        const response = await fetch('/api/clone-funnel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, cloneMode: 'identical', userId: '00000000-0000-0000-0000-000000000001' }),
        });
        const data = await response.json();
        if (!response.ok || data.error) throw new Error(data.error || 'Clone failed');

        const clonedHtml = injectBaseHref(data.content, url);
        updateFunnelPage(pageId, {
          swipeStatus: 'completed',
          swipeResult: `Clone OK (${(data.content?.length || 0).toLocaleString()} chars)`,
          clonedData: {
            html: clonedHtml,
            title: pageName,
            method_used: 'identical',
            content_length: data.content?.length || 0,
            duration_seconds: 0,
            cloned_at: new Date(),
          },
        });

        setHtmlPreviewModal({
          isOpen: true,
          title: `Clone: ${pageName}`,
          html: clonedHtml,
          iframeSrc: '',
          metadata: { method: 'identical', length: data.content?.length || 0, duration: 0 },
        });

      } else if (mode === 'rewrite') {
        // Async rewrite: extract → process loop → completed
        const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001';

        // Phase 1: Extract
        setCloneProgress({ phase: 'extract', totalTexts: 0, processedTexts: 0, message: 'Extracting texts...' });
        const extractRes = await fetch('/api/clone-funnel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url,
            cloneMode: 'rewrite',
            phase: 'extract',
            productName: cloneConfig.productName,
            productDescription: cloneConfig.productDescription,
            framework: cloneConfig.framework || undefined,
            target: cloneConfig.target || undefined,
            customPrompt: cloneConfig.customPrompt || undefined,
            userId: DEFAULT_USER_ID,
          }),
        });
        const extractData = await extractRes.json();
        if (!extractRes.ok || extractData.error) throw new Error(extractData.error || 'Extract failed');

        const jobId = extractData.jobId;
        const totalTexts = extractData.totalTexts || 0;
        setCloneProgress({ phase: 'processing', totalTexts, processedTexts: 0, message: `0/${totalTexts} texts processed...` });
        updateFunnelPage(pageId, { swipeResult: `Rewriting 0/${totalTexts}...` });

        // Phase 2: Process loop
        let completed = false;
        let batchNum = 0;
        while (!completed) {
          await new Promise(r => setTimeout(r, 3000));

          const processRes = await fetch('/api/clone-funnel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              cloneMode: 'rewrite',
              phase: 'process',
              jobId,
              batchNumber: batchNum,
              userId: DEFAULT_USER_ID,
            }),
          });
          const processData = await processRes.json();
          if (!processRes.ok || processData.error) throw new Error(processData.error || 'Process failed');

          if (processData.phase === 'completed') {
            completed = true;

            const replacements = processData.replacements || 0;
            const textsProcessed = processData.textsProcessed || totalTexts;
            setCloneProgress(null);

            const rewrittenHtml = injectBaseHref(processData.content, url);
            updateFunnelPage(pageId, {
              swipeStatus: 'completed',
              swipeResult: `Rewrite OK (${replacements}/${textsProcessed} texts)`,
              swipedData: {
                html: rewrittenHtml,
                originalTitle: pageName,
                newTitle: `Rewrite: ${pageName}`,
                originalLength: 0,
                newLength: processData.content?.length || 0,
                processingTime: 0,
                methodUsed: 'smooth-responder-rewrite',
                changesMade: [`${replacements} texts rewritten out of ${textsProcessed}`],
                swipedAt: new Date(),
              },
            });

            setHtmlPreviewModal({
              isOpen: true,
              title: `Rewrite: ${pageName}`,
              html: rewrittenHtml,
              iframeSrc: '',
              metadata: { method: 'rewrite', length: processData.content?.length || 0, duration: 0 },
            });
          } else if (processData.continue) {
            batchNum++;
            const processed = processData.batchProcessed || 0;
            const remaining = processData.remainingTexts || 0;
            const done = totalTexts - remaining;
            setCloneProgress({
              phase: 'processing',
              totalTexts,
              processedTexts: done,
              message: `${done}/${totalTexts} texts processed...`,
            });
            updateFunnelPage(pageId, { swipeResult: `Rewriting ${done}/${totalTexts}...` });
          } else {
            throw new Error('Unexpected response from process phase');
          }
        }

      } else if (mode === 'translate') {
        // Translate mode: need clonedData HTML first
        const page = (funnelPages || []).find(p => p.id === pageId);
        const htmlToTranslate = page?.clonedData?.html || page?.swipedData?.html;

        if (!htmlToTranslate) {
          throw new Error('Clona la pagina prima di tradurla (serve HTML clonato o riscritto)');
        }

        setCloneProgress({ phase: 'translating', totalTexts: 0, processedTexts: 0, message: `Translating to ${cloneConfig.targetLanguage}...` });
        const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001';

        const response = await fetch('/api/clone-funnel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cloneMode: 'translate',
            htmlContent: htmlToTranslate,
            targetLanguage: cloneConfig.targetLanguage,
            userId: DEFAULT_USER_ID,
          }),
        });
        const data = await response.json();
        if (!response.ok || data.error) throw new Error(data.error || 'Translate failed');

        setCloneProgress(null);
        const translatedHtml = injectBaseHref(data.content, url);
        updateFunnelPage(pageId, {
          swipeStatus: 'completed',
          swipeResult: `Translated (${data.textsTranslated || 0} texts → ${data.targetLanguage})`,
          swipedData: {
            html: translatedHtml,
            originalTitle: pageName,
            newTitle: `${data.targetLanguage}: ${pageName}`,
            originalLength: data.originalHtmlSize || 0,
            newLength: data.finalHtmlSize || 0,
            processingTime: 0,
            methodUsed: 'smooth-responder-translate',
            changesMade: [`${data.textsTranslated} texts translated to ${data.targetLanguage}`],
            swipedAt: new Date(),
          },
        });

        setHtmlPreviewModal({
          isOpen: true,
          title: `${data.targetLanguage}: ${pageName}`,
          html: translatedHtml,
          iframeSrc: '',
          metadata: { method: 'translate', length: data.finalHtmlSize || 0, duration: 0 },
        });
      }
    } catch (error) {
      setCloneProgress(null);
      updateFunnelPage(pageId, {
        swipeStatus: 'failed',
        swipeResult: error instanceof Error ? error.message : 'Clone error',
      });
    } finally {
      setCloningIds(prev => prev.filter(i => i !== pageId));
    }
  };

  const toggleSectionExpanded = (index: number) => {
    setExpandedSections(prev =>
      prev.includes(index)
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  };

  const getSectionTypeColor = (type: string): string => {
    const normalizedType = type.toLowerCase().replace(/[^a-z]/g, '_');
    return SECTION_TYPE_COLORS[normalizedType] || SECTION_TYPE_COLORS.unknown;
  };

  // Launch swipe with job API
  const handleLaunchSwipeJob = async () => {
    const pageId = swipeConfigModal.pageId;
    
    // Save prompt to the page
    updateFunnelPage(pageId, { prompt: swipeConfig.prompt });
    
    setSwipeConfigModal({ isOpen: false, pageId: '', pageName: '', url: '' });
    setLoadingIds(prev => [...prev, pageId]);
    setShowJobsPanel(true);
    updateFunnelPage(pageId, { swipeStatus: 'in_progress', swipeResult: `Starting...` });

    try {
      let response: Response;

      const projectId = swipeConfig.url ? new URL(swipeConfig.url).hostname : 'default';
      const userId = 'funnel-swiper-user';

      if (apiMode === 'local') {
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
            prompt: swipeConfig.prompt,
          }),
        });
      } else {
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
        
        if (swipeConfig.prompt) params.append('prompt', swipeConfig.prompt);
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
        throw new Error(data.error || data.detail || 'Error starting job');
      }

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
        swipeResult: error instanceof Error ? error.message : 'Network error',
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
          template: page.templateId || page.pageType || 'standard',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        updateFunnelPage(page.id, { 
          analysisStatus: 'failed',
          analysisResult: data.error || 'Error during analysis'
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

        setAnalysisModal({
          isOpen: true,
          pageId: page.id,
          result: resultText,
          extractedData: data.extractedData
        });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Network error';
      updateFunnelPage(page.id, { 
        analysisStatus: 'failed',
        analysisResult: msg === 'Failed to fetch' ? 'Errore di rete. Verifica /api/health e che claude-code-agents.fly.dev sia raggiungibile.' : msg
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
        subtitle="Manage funnel pages with Excel-style view"
      />

      <div className="p-6">
        {/* Toolbar */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4 flex-wrap">
              <button
                onClick={handleAddPage}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Step
              </button>
              <span className="text-gray-500">
                {(funnelPages || []).length} pages
              </span>
              {/* Saved Funnels Dropdown (da affiliate_saved_funnels) */}
              <div className="flex items-center gap-2">
                <label htmlFor="saved-funnel-select" className="text-sm font-medium text-gray-700 flex items-center gap-1">
                  <FileStack className="w-4 h-4 text-amber-500" />
                  Funnel salvato
                </label>
                <select
                  id="saved-funnel-select"
                  value={selectedAffiliateFunnelId ?? ''}
                  onChange={(e) => setSelectedAffiliateFunnelId(e.target.value || null)}
                  className="min-w-[260px] px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm bg-white"
                >
                  <option value="">— Seleziona un funnel —</option>
                  {affiliateFunnelsLoading ? (
                    <option disabled>Caricamento...</option>
                  ) : (
                    affiliateFunnels.map((af) => (
                      <option key={af.id} value={af.id}>
                        {af.funnel_name}{af.brand_name ? ` (${af.brand_name})` : ''} — {af.funnel_type.replace(/_/g, ' ')} — {af.total_steps} step
                      </option>
                    ))
                  )}
                </select>
                {affiliateFunnels.length > 0 && (
                  <button
                    onClick={() => fetchAffiliateData()}
                    disabled={affiliateFunnelsLoading}
                    className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                    title="Aggiorna funnel"
                  >
                    <RefreshCw className={`w-4 h-4 ${affiliateFunnelsLoading ? 'animate-spin' : ''}`} />
                  </button>
                )}
              </div>
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
                  Active Jobs
                </h3>
                <span className="text-xs text-gray-500">
                  Polling every 5s • API: {API_ENDPOINTS[apiMode].name}
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
                      
                      {job.currentLayer && job.status === 'running' && (
                        <div className="mt-2 text-xs text-purple-700 flex items-center gap-1">
                          <span className="animate-pulse">●</span>
                          Layer: <span className="font-medium">{job.currentLayer}</span>
                        </div>
                      )}
                      
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
                            View Analysis
                          </button>
                        </div>
                      )}

                      {job.status === 'completed' && (
                        <div className="mt-2 flex gap-2">
                          <button
                            onClick={() => {
                              setHtmlPreviewModal({
                                isOpen: true,
                                title: page?.name || 'Result',
                                html: '',
                                iframeSrc: api.result(job.jobId),
                                metadata: null,
                              });
                            }}
                            className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                          >
                            <Eye className="w-3 h-3 inline mr-1" />
                            View Result
                          </button>
                          <a
                            href={api.result(job.jobId)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs px-2 py-1 bg-gray-600 text-white rounded hover:bg-gray-700"
                          >
                            <ExternalLink className="w-3 h-3 inline mr-1" />
                            Open
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
              <p>No active jobs</p>
              <p className="text-xs mt-1">Jobs will appear here when you launch a swipe</p>
            </div>
          )}

          {/* Pagine del funnel selezionato */}
          {selectedAffiliateFunnelId && selectedAffiliateFunnel && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <Target className="w-4 h-4 text-amber-600" />
                  Step di &quot;{selectedAffiliateFunnel.funnel_name}&quot;
                  {selectedAffiliateFunnel.brand_name && (
                    <span className="text-xs font-normal text-gray-500">({selectedAffiliateFunnel.brand_name})</span>
                  )}
                </h3>
                <div className="flex items-center gap-2">
                  {selectedAffiliateFunnel.funnel_type && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                      {selectedAffiliateFunnel.funnel_type.replace(/_/g, ' ')}
                    </span>
                  )}
                  {selectedAffiliateFunnel.category && selectedAffiliateFunnel.category !== 'other' && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                      {selectedAffiliateFunnel.category.replace(/_/g, ' ')}
                    </span>
                  )}
                  <button
                    onClick={handleImportAllAffiliateSteps}
                    disabled={affiliateFunnelSteps.length === 0}
                    className="px-3 py-1.5 text-xs font-medium bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors flex items-center gap-1 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-3 h-3" />
                    Importa tutti ({affiliateFunnelSteps.length})
                  </button>
                </div>
              </div>

              {/* Analysis summary */}
              {selectedAffiliateFunnel.analysis_summary && (
                <p className="text-xs text-gray-600 mb-3 bg-amber-50 rounded-lg p-2 border border-amber-100">
                  {selectedAffiliateFunnel.analysis_summary}
                </p>
              )}

              {/* Tags & Techniques */}
              {(selectedAffiliateFunnel.tags.length > 0 || selectedAffiliateFunnel.persuasion_techniques.length > 0) && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {selectedAffiliateFunnel.tags.map((tag, i) => (
                    <span key={`tag-${i}`} className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">
                      {tag}
                    </span>
                  ))}
                  {selectedAffiliateFunnel.persuasion_techniques.map((tech, i) => (
                    <span key={`tech-${i}`} className="px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-700">
                      {tech}
                    </span>
                  ))}
                </div>
              )}

              <div className="rounded-lg border border-amber-200 bg-amber-50/30 overflow-hidden">
                <div className="p-3 space-y-2 max-h-80 overflow-y-auto">
                  {affiliateFunnelSteps.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">
                      Nessuno step strutturato disponibile per questo funnel.
                    </p>
                  ) : (
                    affiliateFunnelSteps.map((step, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-3 p-2.5 rounded-lg bg-white border border-gray-100 hover:border-amber-200 transition-colors"
                      >
                        <span className="w-7 h-7 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold shrink-0">
                          {step.step_index}
                        </span>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {step.title || `Step ${step.step_index}`}
                            </p>
                            {step.step_type && (
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${
                                step.step_type === 'quiz_question'
                                  ? 'bg-indigo-100 text-indigo-700'
                                  : step.step_type === 'lead_capture'
                                    ? 'bg-green-100 text-green-700'
                                    : step.step_type === 'checkout'
                                      ? 'bg-orange-100 text-orange-700'
                                      : step.step_type === 'upsell'
                                        ? 'bg-red-100 text-red-700'
                                        : 'bg-gray-100 text-gray-600'
                              }`}>
                                {step.step_type.replace(/_/g, ' ')}
                              </span>
                            )}
                            {step.input_type && step.input_type !== 'none' && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-cyan-100 text-cyan-700 shrink-0">
                                {step.input_type.replace(/_/g, ' ')}
                              </span>
                            )}
                          </div>
                          {step.description && (
                            <p className="text-xs text-gray-500 truncate">{step.description}</p>
                          )}
                          {step.url && (
                            <a
                              href={step.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-amber-600 hover:underline truncate block"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {step.url}
                            </a>
                          )}
                          {step.cta_text && (
                            <span className="inline-block mt-1 px-2 py-0.5 text-[10px] bg-green-50 text-green-700 rounded border border-green-200">
                              CTA: {step.cta_text}
                            </span>
                          )}
                        </div>

                        <button
                          onClick={() => handleUseAffiliateStepForSwipe(step, selectedAffiliateFunnel.funnel_name)}
                          disabled={!step.url}
                          className="shrink-0 px-3 py-1.5 text-xs font-medium bg-amber-500 text-white rounded hover:bg-amber-600 transition-colors flex items-center gap-1 disabled:bg-gray-300 disabled:cursor-not-allowed"
                        >
                          <Wand2 className="w-3 h-3" />
                          Usa per swipe
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {affiliateFunnelsError && (
            <div className="mt-4 pt-4 border-t border-gray-200 flex items-center gap-2 text-red-600 text-sm">
              {affiliateFunnelsError}
              <button onClick={fetchAffiliateData} className="text-amber-600 hover:underline">
                Riprova
              </button>
            </div>
          )}
          {!affiliateFunnelsLoading && !affiliateFunnelsError && affiliateFunnels.length === 0 && (
            <p className="mt-4 pt-4 border-t border-gray-200 text-gray-500 text-sm">
              Nessun funnel salvato. Usa l&apos;<a href="/affiliate-browser-chat" className="text-amber-600 hover:underline">Affiliate Browser Chat</a> per analizzare e salvare funnel.
            </p>
          )}
        </div>

        {/* Excel-style Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="excel-table text-sm">
              <thead>
                <tr>
                  <th className="w-10 px-2" title="Step order (1 = first page of funnel)">Step</th>
                  <th className="min-w-[120px]">Page</th>
                  <th className="min-w-[100px]">Type</th>
                  <th className="min-w-[120px]">Template</th>
                  <th className="min-w-[180px]">URL</th>
                  <th className="min-w-[140px]">Prompt</th>
                  <th className="min-w-[100px]">Product</th>
                  <th className="w-20">Status</th>
                  <th className="min-w-[120px]">Result</th>
                  <th className="min-w-[100px]">Feedback</th>
                  <th className="w-16">AI</th>
                  <th className="w-32">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(funnelPages || []).length === 0 ? (
                  <tr>
                    <td colSpan={12} className="text-center py-8 text-gray-500">
                      Nessuno step. Clicca &quot;Add Step&quot; per iniziare dal Step 1.
                    </td>
                  </tr>
                ) : (
                  (funnelPages || []).map((page, index) => (
                    <tr key={page.id}>
                      {/* Step number (sequential: 1 = first, 2 = second, etc.) */}
                      <td className="text-center text-gray-500 bg-gray-50 font-medium">
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
                          className="font-medium truncate"
                        />
                      </td>

                      {/* Page Type */}
                      <td>
                        <select
                          value={page.pageType}
                          onChange={(e) => {
                            const v = e.target.value;
                            updateFunnelPage(page.id, {
                              // value from select is always a valid PageType (built-in or custom)
                              pageType: v as PageType,
                            });
                          }}
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

                      {/* Template to Swipe */}
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
                          className="truncate"
                        >
                          <option value="">Template...</option>
                          {(templates || []).filter(t => (t.category || 'standard') === 'standard').length > 0 && (
                            <optgroup label="📄 Standard Templates">
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
                            <optgroup label="❓ Quiz Templates">
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
                        <div className="flex items-center gap-0.5">
                          <input
                            type="url"
                            value={page.urlToSwipe}
                            onChange={(e) =>
                              updateFunnelPage(page.id, {
                                urlToSwipe: e.target.value,
                              })
                            }
                            placeholder="https://..."
                            className="flex-1 truncate"
                          />
                          {page.urlToSwipe && (
                            <a
                              href={page.urlToSwipe}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-500 hover:text-blue-700 p-0.5 flex-shrink-0"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </td>

                      {/* Prompt */}
                      <td>
                        <input
                          type="text"
                          value={page.prompt || ''}
                          onChange={(e) =>
                            updateFunnelPage(page.id, { prompt: e.target.value })
                          }
                          placeholder="Instructions..."
                          className="truncate"
                        />
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
                          className="truncate"
                        >
                          <option value="">Product...</option>
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
                        <div className="flex items-center gap-1">
                          {page.swipeStatus === 'completed' && (
                            <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0" />
                          )}
                          {page.swipeStatus === 'failed' && (
                            <XCircle className="w-3 h-3 text-red-500 flex-shrink-0" />
                          )}
                          <span className="truncate max-w-[80px]" title={page.swipeResult || ''}>
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
                              className="p-1 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded"
                              title="Preview"
                            >
                              <Eye className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Feedback */}
                      <td>
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={page.feedback || ''}
                            onChange={(e) =>
                              updateFunnelPage(page.id, { feedback: e.target.value })
                            }
                            placeholder="Feedback..."
                            className="flex-1"
                          />
                          {page.feedback && (
                            <MessageSquare className="w-3 h-3 text-green-500 flex-shrink-0" />
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
                                View
                              </span>
                            ) : page.analysisStatus === 'in_progress' ? (
                              <span className="flex items-center gap-1">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                ...
                              </span>
                            ) : page.analysisStatus === 'failed' ? (
                              'Error'
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
                        <div className="flex items-center gap-1">
                          {/* Clone Button (smooth-responder) */}
                          <button
                            onClick={() => openCloneModal(page)}
                            disabled={
                              cloningIds.includes(page.id) ||
                              !page.urlToSwipe
                            }
                            className={`p-1 rounded transition-colors ${
                              cloningIds.includes(page.id)
                                ? 'bg-amber-100 text-amber-700'
                                : !page.urlToSwipe
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                            }`}
                            title="Clone & Rewrite"
                          >
                            {cloningIds.includes(page.id) ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                          {/* Delete Button */}
                          <button
                            onClick={() => deleteFunnelPage(page.id)}
                            className="p-1 text-red-500 hover:bg-red-50 rounded"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
                    Configure Swipe
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
                    URL to Swipe
                  </label>
                  <input
                    type="url"
                    value={swipeConfig.url}
                    onChange={(e) => setSwipeConfig({ ...swipeConfig, url: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                    placeholder="https://landing-page.com"
                  />
                </div>

                {/* Prompt */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Custom Prompt (Optional)
                  </label>
                  <textarea
                    value={swipeConfig.prompt || ''}
                    onChange={(e) => setSwipeConfig({ ...swipeConfig, prompt: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                    rows={2}
                    placeholder="Add custom instructions for the AI..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Product Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Product Name *
                    </label>
                    <input
                      type="text"
                      value={swipeConfig.product_name}
                      onChange={(e) => setSwipeConfig({ ...swipeConfig, product_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                      placeholder="Your Product"
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
                      placeholder="YourBrand"
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Product Description
                  </label>
                  <textarea
                    value={swipeConfig.product_description}
                    onChange={(e) => setSwipeConfig({ ...swipeConfig, product_description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                    rows={2}
                    placeholder="Description of your product..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* CTA Text */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      CTA Text
                    </label>
                    <input
                      type="text"
                      value={swipeConfig.cta_text}
                      onChange={(e) => setSwipeConfig({ ...swipeConfig, cta_text: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                      placeholder="BUY NOW"
                    />
                  </div>

                  {/* Language */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Language
                    </label>
                    <select
                      value={swipeConfig.language}
                      onChange={(e) => setSwipeConfig({ ...swipeConfig, language: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                    >
                      <option value="en">English</option>
                      <option value="it">Italiano</option>
                      <option value="es">Español</option>
                      <option value="fr">Français</option>
                      <option value="de">Deutsch</option>
                    </select>
                  </div>
                </div>

                {/* CTA URL */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    CTA URL
                  </label>
                  <input
                    type="url"
                    value={swipeConfig.cta_url}
                    onChange={(e) => setSwipeConfig({ ...swipeConfig, cta_url: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                    placeholder="https://yoursite.com/checkout"
                  />
                </div>

                {/* Benefits */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Benefits
                  </label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={benefitInput}
                      onChange={(e) => setBenefitInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addBenefit())}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                      placeholder="Add a benefit..."
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
                      <span className="text-sm text-gray-400 italic">No benefits added</span>
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
                Cancel
              </button>
              <button
                onClick={handleLaunchSwipeJob}
                disabled={!swipeConfig.url || !swipeConfig.product_name}
                className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                <Wand2 className="w-4 h-4" />
                Launch Swipe Job
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HTML Preview Modal */}
      {htmlPreviewModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-1">
          <div className="bg-white rounded-xl shadow-2xl w-[98vw] h-[98vh] overflow-hidden flex flex-col">
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
                      Method: {htmlPreviewModal.metadata.method} | 
                      {htmlPreviewModal.metadata.length.toLocaleString()} chars | 
                      {htmlPreviewModal.metadata.duration.toFixed(2)}s
                    </p>
                  )}
                  {htmlPreviewModal.iframeSrc && (
                    <p className="text-white/80 text-sm">
                      Result from pipeline job
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
                      alert('HTML copied to clipboard!');
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700"
                  >
                    Copy HTML
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
                    Open in new tab
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
                    const blobUrl = URL.createObjectURL(blob);
                    window.open(blobUrl, '_blank');
                  }}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  Apri in Nuova Finestra
                </button>
              )}
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
                  Download HTML
                </button>
              )}
              <button
                onClick={() => setHtmlPreviewModal({ isOpen: false, title: '', html: '', iframeSrc: '', metadata: null })}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Close
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
                  Funnel Step Analysis
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
                    <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs">EXTRACTED</span>
                    Page Data
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
                        <span className="font-medium text-gray-700">Price:</span>
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
                  Analysis Result
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
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Vision Analysis Modal */}
      {visionModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-purple-600 to-indigo-600">
              <div className="flex items-center gap-3">
                <ImageIcon className="w-6 h-6 text-white" />
                <div>
                  <h2 className="text-xl font-bold text-white">
                    AI Vision Analysis
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
                  title="Refresh"
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
                  <p className="text-gray-600">Loading vision analysis...</p>
                </div>
              )}

              {/* Error State */}
              {visionError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                  <div className="flex items-center gap-2 text-red-700">
                    <XCircle className="w-5 h-5" />
                    <span className="font-medium">Error</span>
                  </div>
                  <p className="text-red-600 mt-1">{visionError}</p>
                </div>
              )}

              {/* No Jobs Found */}
              {!visionLoading && !visionError && visionJobs.length === 0 && (
                <div className="text-center py-12">
                  <ImageIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No analysis found</h3>
                  <p className="text-gray-500">
                    No vision analysis found for this page.
                    <br />
                    Launch a swipe job first to generate the analysis.
                  </p>
                </div>
              )}

              {/* Jobs List */}
              {visionJobs.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-700 mb-3">
                    Available analyses ({visionJobs.length})
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
                        <span>{new Date(job.created_at).toLocaleString('en-US', { 
                          day: '2-digit', 
                          month: '2-digit', 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}</span>
                        {job.total_sections_detected > 0 && (
                          <span className="bg-white/50 px-1.5 py-0.5 rounded text-xs">
                            {job.total_sections_detected} sections
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
                        Page Screenshot
                      </h4>
                      <div className="relative rounded-lg overflow-hidden border border-gray-300 bg-white">
                        <img
                          src={selectedVisionJob.screenshot_url}
                          alt="Page screenshot"
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
                        Page Structure
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
                          Detected Sections ({selectedVisionJob.sections.length})
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
                            ? 'Collapse all' 
                            : 'Expand all'}
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
                                    <p className="text-xs text-gray-500 mb-1">Text Preview</p>
                                    <p className="text-sm text-gray-700">{section.text_preview}</p>
                                  </div>
                                )}
                                {section.bounding_box && (
                                  <div className="text-xs text-gray-500">
                                    Position: x={section.bounding_box.x}, y={section.bounding_box.y}, 
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
                          Analyzed Images ({selectedVisionJob.images.length})
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
                        AI Recommendations
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
                        Complete Analysis (Raw)
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
                        Completed: {new Date(selectedVisionJob.completed_at).toLocaleString('en-US')}
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
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clone Progress Floating Indicator */}
      {cloneProgress && (
        <div className="fixed bottom-6 right-6 z-40 bg-white rounded-xl shadow-2xl border border-amber-200 p-4 w-80">
          <div className="flex items-center gap-3 mb-3">
            <Loader2 className="w-5 h-5 text-amber-600 animate-spin" />
            <span className="font-medium text-gray-900">
              {cloneProgress.phase === 'extract' ? 'Extracting texts...' :
               cloneProgress.phase === 'translating' ? 'Translating...' :
               'Rewriting texts...'}
            </span>
          </div>
          <div className="text-sm text-gray-600 mb-2">{cloneProgress.message}</div>
          {cloneProgress.totalTexts > 0 && (
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 transition-all duration-500"
                style={{ width: `${Math.round((cloneProgress.processedTexts / cloneProgress.totalTexts) * 100)}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* Clone Configuration Modal */}
      {cloneModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-amber-500 to-orange-500">
              <div className="flex items-center gap-3">
                <Copy className="w-6 h-6 text-white" />
                <div>
                  <h2 className="text-xl font-bold text-white">Clone & Rewrite</h2>
                  <p className="text-white/80 text-sm truncate max-w-sm">{cloneModal.url}</p>
                </div>
              </div>
              <button
                onClick={() => setCloneModal({ isOpen: false, pageId: '', pageName: '', url: '' })}
                className="text-white/80 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Mode Tabs */}
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setCloneMode('identical')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                  cloneMode === 'identical'
                    ? 'text-amber-700 border-b-2 border-amber-500 bg-amber-50'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Copy className="w-4 h-4" />
                Clone Identico
              </button>
              <button
                onClick={() => setCloneMode('rewrite')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                  cloneMode === 'rewrite'
                    ? 'text-amber-700 border-b-2 border-amber-500 bg-amber-50'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Wand2 className="w-4 h-4" />
                Riscrivi per Prodotto
              </button>
              <button
                onClick={() => setCloneMode('translate')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                  cloneMode === 'translate'
                    ? 'text-amber-700 border-b-2 border-amber-500 bg-amber-50'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Globe className="w-4 h-4" />
                Traduci
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Identical Mode */}
              {cloneMode === 'identical' && (
                <div className="text-center py-8">
                  <Copy className="w-16 h-16 text-amber-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Clone Identico</h3>
                  <p className="text-gray-500 mb-4">
                    Scarica l&apos;HTML esatto della pagina senza modifiche.
                    <br />
                    Utile per analizzare la struttura e come base per riscritture successive.
                  </p>
                  <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 break-all">
                    {cloneModal.url}
                  </div>
                </div>
              )}

              {/* Rewrite Mode */}
              {cloneMode === 'rewrite' && (
                <div className="space-y-4">
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                    La struttura HTML della pagina viene mantenuta identica. Solo i testi vengono riscritti da Claude AI per il tuo prodotto.
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nome Prodotto *</label>
                      <input
                        type="text"
                        value={cloneConfig.productName}
                        onChange={(e) => setCloneConfig({ ...cloneConfig, productName: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
                        placeholder="Es: SuperGlow Serum"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Framework</label>
                      <select
                        value={cloneConfig.framework}
                        onChange={(e) => setCloneConfig({ ...cloneConfig, framework: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
                      >
                        <option value="">Nessuno</option>
                        <option value="AIDA">AIDA (Attention-Interest-Desire-Action)</option>
                        <option value="PAS">PAS (Problem-Agitate-Solve)</option>
                        <option value="BAB">BAB (Before-After-Bridge)</option>
                        <option value="4Ps">4Ps (Promise-Picture-Proof-Push)</option>
                        <option value="QUEST">QUEST (Qualify-Understand-Educate-Stimulate-Transition)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Descrizione Prodotto *</label>
                    <textarea
                      value={cloneConfig.productDescription}
                      onChange={(e) => setCloneConfig({ ...cloneConfig, productDescription: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
                      rows={3}
                      placeholder="Descrivi il tuo prodotto, i suoi benefici e caratteristiche..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Target Audience</label>
                    <input
                      type="text"
                      value={cloneConfig.target}
                      onChange={(e) => setCloneConfig({ ...cloneConfig, target: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
                      placeholder="Es: Donne 30-50 anni attente alla skincare"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Istruzioni Custom (opzionale)</label>
                    <textarea
                      value={cloneConfig.customPrompt}
                      onChange={(e) => setCloneConfig({ ...cloneConfig, customPrompt: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
                      rows={2}
                      placeholder="Es: Tono lussuoso ma accessibile, in italiano..."
                    />
                  </div>
                </div>
              )}

              {/* Translate Mode */}
              {cloneMode === 'translate' && (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                    Traduce tutti i testi dell&apos;HTML clonato o riscritto in un&apos;altra lingua.
                    Serve prima aver clonato la pagina (Clone Identico o Riscrivi).
                  </div>

                  {(() => {
                    const page = (funnelPages || []).find(p => p.id === cloneModal.pageId);
                    const hasHtml = page?.clonedData?.html || page?.swipedData?.html;
                    return hasHtml ? (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" />
                        HTML disponibile ({((page?.swipedData?.html || page?.clonedData?.html)?.length || 0).toLocaleString()} chars)
                      </div>
                    ) : (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800 flex items-center gap-2">
                        <XCircle className="w-4 h-4" />
                        Nessun HTML disponibile. Clona la pagina prima.
                      </div>
                    );
                  })()}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Lingua Target</label>
                    <select
                      value={cloneConfig.targetLanguage}
                      onChange={(e) => setCloneConfig({ ...cloneConfig, targetLanguage: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
                    >
                      <option value="Italiano">Italiano</option>
                      <option value="Inglese">Inglese (English)</option>
                      <option value="Spagnolo">Spagnolo (Español)</option>
                      <option value="Francese">Francese (Français)</option>
                      <option value="Tedesco">Tedesco (Deutsch)</option>
                      <option value="Portoghese">Portoghese (Português)</option>
                      <option value="Olandese">Olandese (Nederlands)</option>
                      <option value="Polacco">Polacco (Polski)</option>
                      <option value="Rumeno">Rumeno (Română)</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => setCloneModal({ isOpen: false, pageId: '', pageName: '', url: '' })}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={handleClone}
                disabled={
                  (cloneMode === 'rewrite' && (!cloneConfig.productName || !cloneConfig.productDescription)) ||
                  (cloneMode === 'translate' && !(() => {
                    const page = (funnelPages || []).find(p => p.id === cloneModal.pageId);
                    return page?.clonedData?.html || page?.swipedData?.html;
                  })())
                }
                className="flex items-center gap-2 px-6 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {cloneMode === 'identical' && <><Copy className="w-4 h-4" /> Clona</>}
                {cloneMode === 'rewrite' && <><Wand2 className="w-4 h-4" /> Clona &amp; Riscrivi</>}
                {cloneMode === 'translate' && <><Globe className="w-4 h-4" /> Traduci</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
