'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Product, FunnelPage, PostPurchasePage } from '@/types';

interface Store {
  // Products
  products: Product[];
  addProduct: (product: Omit<Product, 'id' | 'createdAt'>) => void;
  updateProduct: (id: string, product: Partial<Product>) => void;
  deleteProduct: (id: string) => void;

  // Front End Funnel Pages
  funnelPages: FunnelPage[];
  addFunnelPage: (page: Omit<FunnelPage, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateFunnelPage: (id: string, page: Partial<FunnelPage>) => void;
  deleteFunnelPage: (id: string) => void;
  launchSwipe: (id: string) => Promise<void>;

  // Post Purchase Pages
  postPurchasePages: PostPurchasePage[];
  addPostPurchasePage: (page: Omit<PostPurchasePage, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updatePostPurchasePage: (id: string, page: Partial<PostPurchasePage>) => void;
  deletePostPurchasePage: (id: string) => void;
  launchPostPurchaseSwipe: (id: string) => Promise<void>;
}

const generateId = () => Math.random().toString(36).substring(2, 15);

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      // Products
      products: [
        {
          id: '1',
          name: 'Prodotto Demo 1',
          description: 'Descrizione prodotto demo',
          price: 47.00,
          createdAt: new Date(),
        },
        {
          id: '2',
          name: 'Prodotto Demo 2',
          description: 'Altro prodotto demo',
          price: 97.00,
          createdAt: new Date(),
        },
      ],

      addProduct: (product) =>
        set((state) => ({
          products: [
            ...state.products,
            {
              ...product,
              id: generateId(),
              createdAt: new Date(),
            },
          ],
        })),

      updateProduct: (id, product) =>
        set((state) => ({
          products: state.products.map((p) =>
            p.id === id ? { ...p, ...product } : p
          ),
        })),

      deleteProduct: (id) =>
        set((state) => ({
          products: state.products.filter((p) => p.id !== id),
        })),

      // Front End Funnel Pages
      funnelPages: [
        {
          id: '1',
          name: 'Landing Page Principale',
          pageType: 'landing',
          template: 'advertorial',
          productId: '1',
          urlToSwipe: 'https://example.com/landing',
          swipeStatus: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '2',
          name: 'Quiz Funnel Entry',
          pageType: 'quiz_funnel',
          template: 'advertorial',
          productId: '1',
          urlToSwipe: 'https://example.com/quiz',
          swipeStatus: 'completed',
          swipeResult: 'Swipe completato con successo',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],

      addFunnelPage: (page) =>
        set((state) => ({
          funnelPages: [
            ...state.funnelPages,
            {
              ...page,
              id: generateId(),
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        })),

      updateFunnelPage: (id, page) =>
        set((state) => ({
          funnelPages: state.funnelPages.map((p) =>
            p.id === id ? { ...p, ...page, updatedAt: new Date() } : p
          ),
        })),

      deleteFunnelPage: (id) =>
        set((state) => ({
          funnelPages: state.funnelPages.filter((p) => p.id !== id),
        })),

      launchSwipe: async (id) => {
        const page = get().funnelPages.find((p) => p.id === id);
        if (!page || !page.urlToSwipe) return;

        set((state) => ({
          funnelPages: state.funnelPages.map((p) =>
            p.id === id
              ? { ...p, swipeStatus: 'in_progress' as const, updatedAt: new Date() }
              : p
          ),
        }));

        try {
          const response = await fetch('/api/landing/clone', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              url: page.urlToSwipe,
              wait_for_js: false,
              remove_scripts: true,
            }),
          });

          const data = await response.json();

          if (!response.ok || !data.success) {
            set((state) => ({
              funnelPages: state.funnelPages.map((p) =>
                p.id === id
                  ? {
                      ...p,
                      swipeStatus: 'failed' as const,
                      swipeResult: data.error || 'Errore durante la clonazione',
                      updatedAt: new Date(),
                    }
                  : p
              ),
            }));
            return;
          }

          // Successo - salva i dati clonati
          set((state) => ({
            funnelPages: state.funnelPages.map((p) =>
              p.id === id
                ? {
                    ...p,
                    swipeStatus: 'completed' as const,
                    swipeResult: `✓ Clonato: ${data.title || 'Pagina'} (${data.content_length} chars, ${data.duration_seconds?.toFixed(2)}s)`,
                    clonedData: {
                      html: data.html,
                      title: data.title,
                      method_used: data.method_used,
                      content_length: data.content_length,
                      duration_seconds: data.duration_seconds,
                      cloned_at: new Date(),
                    },
                    updatedAt: new Date(),
                  }
                : p
            ),
          }));
        } catch (error) {
          set((state) => ({
            funnelPages: state.funnelPages.map((p) =>
              p.id === id
                ? {
                    ...p,
                    swipeStatus: 'failed' as const,
                    swipeResult: error instanceof Error ? error.message : 'Errore di rete',
                    updatedAt: new Date(),
                  }
                : p
            ),
          }));
        }
      },

      // Post Purchase Pages
      postPurchasePages: [
        {
          id: '1',
          name: 'Thank You Page',
          type: 'thank_you',
          productId: '1',
          urlToSwipe: 'https://example.com/thank-you',
          swipeStatus: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '2',
          name: 'Upsell Principale',
          type: 'upsell_1',
          productId: '1',
          urlToSwipe: 'https://example.com/upsell-1',
          swipeStatus: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],

      addPostPurchasePage: (page) =>
        set((state) => ({
          postPurchasePages: [
            ...state.postPurchasePages,
            {
              ...page,
              id: generateId(),
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        })),

      updatePostPurchasePage: (id, page) =>
        set((state) => ({
          postPurchasePages: state.postPurchasePages.map((p) =>
            p.id === id ? { ...p, ...page, updatedAt: new Date() } : p
          ),
        })),

      deletePostPurchasePage: (id) =>
        set((state) => ({
          postPurchasePages: state.postPurchasePages.filter((p) => p.id !== id),
        })),

      launchPostPurchaseSwipe: async (id) => {
        const page = get().postPurchasePages.find((p) => p.id === id);
        if (!page || !page.urlToSwipe) return;

        set((state) => ({
          postPurchasePages: state.postPurchasePages.map((p) =>
            p.id === id
              ? { ...p, swipeStatus: 'in_progress' as const, updatedAt: new Date() }
              : p
          ),
        }));

        try {
          const response = await fetch('/api/landing/clone', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              url: page.urlToSwipe,
              wait_for_js: false,
              remove_scripts: true,
            }),
          });

          const data = await response.json();

          if (!response.ok || !data.success) {
            set((state) => ({
              postPurchasePages: state.postPurchasePages.map((p) =>
                p.id === id
                  ? {
                      ...p,
                      swipeStatus: 'failed' as const,
                      swipeResult: data.error || 'Errore durante la clonazione',
                      updatedAt: new Date(),
                    }
                  : p
              ),
            }));
            return;
          }

          set((state) => ({
            postPurchasePages: state.postPurchasePages.map((p) =>
              p.id === id
                ? {
                    ...p,
                    swipeStatus: 'completed' as const,
                    swipeResult: `✓ Clonato: ${data.title || 'Pagina'} (${data.content_length} chars)`,
                    clonedData: {
                      html: data.html,
                      title: data.title,
                      method_used: data.method_used,
                      content_length: data.content_length,
                      duration_seconds: data.duration_seconds,
                      cloned_at: new Date(),
                    },
                    updatedAt: new Date(),
                  }
                : p
            ),
          }));
        } catch (error) {
          set((state) => ({
            postPurchasePages: state.postPurchasePages.map((p) =>
              p.id === id
                ? {
                    ...p,
                    swipeStatus: 'failed' as const,
                    swipeResult: error instanceof Error ? error.message : 'Errore di rete',
                    updatedAt: new Date(),
                  }
                : p
            ),
          }));
        }
      },
    }),
    {
      name: 'funnel-swiper-storage',
    }
  )
);
