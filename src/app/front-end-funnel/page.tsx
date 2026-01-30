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
                  <th className="min-w-[150px]">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {funnelPages.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-8 text-gray-500">
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
                        </div>
                      </td>

                      {/* Actions */}
                      <td>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleLaunchSwipe(page.id)}
                            disabled={
                              loadingIds.includes(page.id) ||
                              page.swipeStatus === 'in_progress' ||
                              !page.urlToSwipe
                            }
                            className={`flex items-center gap-1 px-3 py-1 rounded text-sm font-medium transition-colors ${
                              loadingIds.includes(page.id) ||
                              page.swipeStatus === 'in_progress'
                                ? 'bg-yellow-100 text-yellow-700'
                                : !page.urlToSwipe
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'bg-green-100 text-green-700 hover:bg-green-200'
                            }`}
                          >
                            {loadingIds.includes(page.id) ||
                            page.swipeStatus === 'in_progress' ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Swipe...
                              </>
                            ) : (
                              <>
                                <Play className="w-3 h-3" />
                                Swipe
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => deleteFunnelPage(page.id)}
                            className="p-1 text-red-500 hover:bg-red-50 rounded"
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
    </div>
  );
}
