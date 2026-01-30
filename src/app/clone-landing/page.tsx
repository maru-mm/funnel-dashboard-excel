'use client';

import { useState, useRef } from 'react';
import Header from '@/components/Header';
import {
  Copy,
  Loader2,
  ExternalLink,
  Download,
  Maximize2,
  Minimize2,
  Code,
  Eye,
  RefreshCw,
  Sparkles,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';

export default function CloneLandingPage() {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    html: string;
    url: string;
  } | null>(null);
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handleClone = async () => {
    if (!url.trim()) {
      setError('Inserisci un URL valido');
      return;
    }

    try {
      new URL(url);
    } catch {
      setError('URL non valido. Assicurati di includere http:// o https://');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/landing/clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Errore durante la clonazione');
      }

      if (data.html) {
        setResult({
          html: data.html,
          url: data.url,
        });
      } else if (data.data) {
        // Se riceve JSON invece di HTML
        setResult({
          html: `<pre style="padding: 20px; font-family: monospace;">${JSON.stringify(data.data, null, 2)}</pre>`,
          url: data.url,
        });
      } else {
        throw new Error('Nessun contenuto ricevuto');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    if (!result?.html) return;
    
    const blob = new Blob([result.html], { type: 'text/html' });
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `cloned-landing-${Date.now()}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(downloadUrl);
  };

  const handleCopyCode = () => {
    if (!result?.html) return;
    navigator.clipboard.writeText(result.html);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading) {
      handleClone();
    }
  };

  return (
    <div className={`min-h-screen ${isFullscreen ? 'fixed inset-0 z-50 bg-white' : ''}`}>
      {!isFullscreen && (
        <Header
          title="Clone Landing Page"
          subtitle="Clona e visualizza landing page da qualsiasi URL"
        />
      )}

      <div className={`${isFullscreen ? 'h-full flex flex-col' : 'p-6'}`}>
        {/* Input Section */}
        <div className={`bg-white rounded-xl shadow-sm border border-gray-200 p-4 ${isFullscreen ? 'mx-4 mt-4' : 'mb-6'}`}>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <input
                type="url"
                placeholder="https://esempio.com/landing-page"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={isLoading}
                className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-100"
              />
              <ExternalLink className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            </div>
            <button
              onClick={handleClone}
              disabled={isLoading || !url.trim()}
              className="px-6 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Clonando...
                </>
              ) : (
                <>
                  <Copy className="w-5 h-5" />
                  Clona Pagina
                </>
              )}
            </button>
          </div>

          {/* Quick Examples */}
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="text-sm text-gray-500">Esempi:</span>
            {['https://stripe.com', 'https://linear.app', 'https://vercel.com'].map((example) => (
              <button
                key={example}
                onClick={() => setUrl(example)}
                className="text-sm text-purple-600 hover:text-purple-800 hover:underline"
              >
                {example.replace('https://', '')}
              </button>
            ))}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className={`bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 ${isFullscreen ? 'mx-4' : 'mb-6'}`}>
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-medium text-red-800">Errore</h3>
              <p className="text-red-700 text-sm mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <Loader2 className="w-12 h-12 text-purple-600 animate-spin mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900">Clonazione in corso...</h3>
            <p className="text-gray-500 mt-2">Sto scaricando e processando la pagina</p>
          </div>
        )}

        {/* Result Viewer */}
        {result && !isLoading && (
          <div className={`bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden ${isFullscreen ? 'flex-1 mx-4 mb-4 flex flex-col' : ''}`}>
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <div>
                  <span className="font-medium text-gray-900">Pagina Clonata</span>
                  <a
                    href={result.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 text-sm text-purple-600 hover:underline inline-flex items-center gap-1"
                  >
                    {result.url}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* View Mode Toggle */}
                <div className="flex bg-gray-200 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('preview')}
                    className={`px-3 py-1 rounded text-sm font-medium transition-colors flex items-center gap-1 ${
                      viewMode === 'preview'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Eye className="w-4 h-4" />
                    Preview
                  </button>
                  <button
                    onClick={() => setViewMode('code')}
                    className={`px-3 py-1 rounded text-sm font-medium transition-colors flex items-center gap-1 ${
                      viewMode === 'code'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Code className="w-4 h-4" />
                    HTML
                  </button>
                </div>

                {/* Actions */}
                <button
                  onClick={handleCopyCode}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-lg transition-colors"
                  title="Copia HTML"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <button
                  onClick={handleDownload}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-lg transition-colors"
                  title="Scarica HTML"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-lg transition-colors"
                  title={isFullscreen ? 'Esci da fullscreen' : 'Fullscreen'}
                >
                  {isFullscreen ? (
                    <Minimize2 className="w-4 h-4" />
                  ) : (
                    <Maximize2 className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={handleClone}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-lg transition-colors"
                  title="Ricarica"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className={`${isFullscreen ? 'flex-1' : 'h-[600px]'}`}>
              {viewMode === 'preview' ? (
                <iframe
                  ref={iframeRef}
                  srcDoc={result.html}
                  className="w-full h-full border-0"
                  title="Cloned Landing Page Preview"
                  sandbox="allow-scripts allow-same-origin"
                />
              ) : (
                <div className="h-full overflow-auto bg-gray-900 p-4">
                  <pre className="text-sm text-gray-300 font-mono whitespace-pre-wrap">
                    {result.html}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Instructions */}
        {!result && !isLoading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-purple-100 p-2 rounded-lg">
                  <Copy className="w-5 h-5 text-purple-600" />
                </div>
                <h3 className="font-semibold text-purple-900">Come funziona</h3>
              </div>
              <ol className="space-y-2 text-purple-800 text-sm">
                <li className="flex items-start gap-2">
                  <span className="bg-purple-200 text-purple-900 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
                  <span>Inserisci l&apos;URL della landing page da clonare</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-purple-200 text-purple-900 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
                  <span>Clicca &quot;Clona Pagina&quot; per scaricare l&apos;HTML</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-purple-200 text-purple-900 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
                  <span>Visualizza il risultato in anteprima o codice</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-purple-200 text-purple-900 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">4</span>
                  <span>Scarica o copia il codice HTML</span>
                </li>
              </ol>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-blue-100 p-2 rounded-lg">
                  <Sparkles className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="font-semibold text-blue-900">Funzionalità</h3>
              </div>
              <ul className="space-y-2 text-blue-800 text-sm">
                <li className="flex items-center gap-2">
                  <Eye className="w-4 h-4" />
                  <span>Preview live della pagina clonata</span>
                </li>
                <li className="flex items-center gap-2">
                  <Code className="w-4 h-4" />
                  <span>Visualizzazione codice HTML completo</span>
                </li>
                <li className="flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  <span>Download file HTML</span>
                </li>
                <li className="flex items-center gap-2">
                  <Maximize2 className="w-4 h-4" />
                  <span>Modalità fullscreen per preview</span>
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
