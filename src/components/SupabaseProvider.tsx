'use client';

import { useEffect, ReactNode } from 'react';
import { useStore } from '@/store/useStore';

interface SupabaseProviderProps {
  children: ReactNode;
}

export function SupabaseProvider({ children }: SupabaseProviderProps) {
  const { initializeData, isLoading, error, isInitialized } = useStore();

  useEffect(() => {
    initializeData();
  }, [initializeData]);

  if (!isInitialized && isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Caricamento dati da Supabase...</p>
        </div>
      </div>
    );
  }

  if (error && !isInitialized) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-white mb-2">Errore di Connessione</h2>
          <p className="text-gray-400 mb-4">{error}</p>
          <p className="text-gray-500 text-sm mb-4">
            Assicurati che le tabelle siano state create in Supabase.
            <br />
            Controlla il file <code className="bg-gray-800 px-1 rounded">supabase-schema.sql</code>
          </p>
          <button
            onClick={() => initializeData()}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Riprova
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
