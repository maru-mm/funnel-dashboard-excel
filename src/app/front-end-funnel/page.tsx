'use client';

import { useState } from 'react';
import Header from '@/components/Header';
import { useStore } from '@/store/useStore';
import {
  TEMPLATE_OPTIONS,
  PAGE_TYPE_OPTIONS,
  STATUS_OPTIONS,
  PageType,
  TemplateType,
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
} from 'lucide-react';

export default function FrontEndFunnel() {
  const {
    products,
    funnelPages,
    addFunnelPage,
    updateFunnelPage,
    deleteFunnelPage,
    launchSwipe,
  } = useStore();

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
    metadata: { method: string; length: number; duration: number } | null;
  }>({ isOpen: false, title: '', html: '', metadata: null });

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

  const handleLaunchSwipe = async (id: string) => {
    setLoadingIds((prev) => [...prev, id]);
    await launchSwipe(id);
    setLoadingIds((prev) => prev.filter((i) => i !== id));
  };

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
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={handleAddPage}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Aggiungi Pagina
            </button>
            <span className="text-gray-500">
              {funnelPages.length} pagine totali
            </span>
          </div>
          <div className="text-sm text-gray-500">
            Clicca sulle celle per modificare
          </div>
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
                  <th className="min-w-[150px]">Template</th>
                  <th className="min-w-[150px]">Prodotto</th>
                  <th className="min-w-[300px]">URL da Swipare</th>
                  <th className="min-w-[120px]">Stato</th>
                  <th className="min-w-[200px]">Risultato Swipe</th>
                  <th className="min-w-[120px]">Analisi</th>
                  <th className="min-w-[180px]">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {funnelPages.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-8 text-gray-500">
                      Nessuna pagina. Clicca "Aggiungi Pagina" per iniziare.
                    </td>
                  </tr>
                ) : (
                  funnelPages.map((page, index) => (
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
                          {PAGE_TYPE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Template */}
                      <td>
                        <select
                          value={page.template}
                          onChange={(e) =>
                            updateFunnelPage(page.id, {
                              template: e.target.value as TemplateType,
                            })
                          }
                        >
                          {TEMPLATE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
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
                          {products.map((prod) => (
                            <option key={prod.id} value={prod.id}>
                              {prod.name}
                            </option>
                          ))}
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
                          <span className="text-sm truncate">
                            {page.swipeResult || '-'}
                          </span>
                          {page.clonedData && (
                            <button
                              onClick={() => setHtmlPreviewModal({
                                isOpen: true,
                                title: page.clonedData!.title || page.name,
                                html: page.clonedData!.html,
                                metadata: {
                                  method: page.clonedData!.method_used,
                                  length: page.clonedData!.content_length,
                                  duration: page.clonedData!.duration_seconds,
                                },
                              })}
                              className="p-1 text-blue-500 hover:bg-blue-50 rounded"
                              title="Visualizza HTML clonato"
                            >
                              <Eye className="w-4 h-4" />
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
                          {/* Swipe Button */}
                          <button
                            onClick={() => handleLaunchSwipe(page.id)}
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
                            title="Lancia Swipe"
                          >
                            {loadingIds.includes(page.id) ||
                            page.swipeStatus === 'in_progress' ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Play className="w-3 h-3" />
                            )}
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
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {PAGE_TYPE_OPTIONS.map((opt) => (
              <div key={opt.value} className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span className="text-sm text-gray-600">{opt.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

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
                </div>
              </div>
              <button
                onClick={() => setHtmlPreviewModal({ isOpen: false, title: '', html: '', metadata: null })}
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
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(htmlPreviewModal.html);
                    alert('HTML copiato negli appunti!');
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700"
                >
                  Copia HTML
                </button>
              </div>
              
              {/* Preview iframe */}
              <div className="flex-1 overflow-hidden bg-gray-100 p-2">
                <iframe
                  srcDoc={htmlPreviewModal.html}
                  className="w-full h-full bg-white rounded border border-gray-300"
                  sandbox="allow-same-origin"
                  title="HTML Preview"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-2">
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
              <button
                onClick={() => setHtmlPreviewModal({ isOpen: false, title: '', html: '', metadata: null })}
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
    </div>
  );
}
