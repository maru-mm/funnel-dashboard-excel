'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Product, FunnelPage, PostPurchasePage, SwipeApiResponse } from '@/types';

const SWIPE_API_URL = 'https://claude-code-agents.fly.dev/api/landing/swipe';

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
          description: 'Integratore naturale per il benessere quotidiano',
          price: 47.00,
          benefits: ['Aumenta l\'energia', 'Migliora il sonno', 'Supporta il sistema immunitario'],
          ctaText: 'Acquista Ora',
          ctaUrl: 'https://example.com/buy',
          brandName: 'NaturalWell',
          createdAt: new Date(),
        },
        {
          id: '2',
          name: 'Prodotto Demo 2',
          description: 'Corso online per il successo personale',
          price: 97.00,
          benefits: ['Strategie comprovate', 'Accesso lifetime', 'Community esclusiva'],
          ctaText: 'Iscriviti Subito',
          ctaUrl: 'https://example.com/enroll',
          brandName: 'SuccessAcademy',
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

        const product = get().products.find((p) => p.id === page.productId);
        if (!product) {
          set((state) => ({
            funnelPages: state.funnelPages.map((p) =>
              p.id === id
                ? {
                    ...p,
                    swipeStatus: 'failed' as const,
                    swipeResult: 'Seleziona un prodotto prima di lanciare lo swipe',
                    updatedAt: new Date(),
                  }
                : p
            ),
          }));
          return;
        }

        set((state) => ({
          funnelPages: state.funnelPages.map((p) =>
            p.id === id
              ? { ...p, swipeStatus: 'in_progress' as const, updatedAt: new Date() }
              : p
          ),
        }));

        try {
          const response = await fetch(SWIPE_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              source_url: page.urlToSwipe,
              product: {
                name: product.name,
                description: product.description,
                benefits: product.benefits,
                cta_text: product.ctaText,
                cta_url: product.ctaUrl,
                brand_name: product.brandName,
              },
              language: 'it',
            }),
          });

          const data: SwipeApiResponse = await response.json();

          if (!response.ok || !data.success) {
            set((state) => ({
              funnelPages: state.funnelPages.map((p) =>
                p.id === id
                  ? {
                      ...p,
                      swipeStatus: 'failed' as const,
                      swipeResult: data.error || 'Errore durante lo swipe',
                      updatedAt: new Date(),
                    }
                  : p
              ),
            }));
            return;
          }

          // Successo - salva i dati swipati
          set((state) => ({
            funnelPages: state.funnelPages.map((p) =>
              p.id === id
                ? {
                    ...p,
                    swipeStatus: 'completed' as const,
                    swipeResult: `✓ Swipe completato: "${data.new_title}" (${data.new_length} chars, ${data.processing_time_seconds.toFixed(2)}s)`,
                    swipedData: {
                      html: data.html,
                      originalTitle: data.original_title,
                      newTitle: data.new_title,
                      originalLength: data.original_length,
                      newLength: data.new_length,
                      processingTime: data.processing_time_seconds,
                      methodUsed: data.method_used,
                      changesMade: data.changes_made,
                      swipedAt: new Date(),
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

        const product = get().products.find((p) => p.id === page.productId);
        if (!product) {
          set((state) => ({
            postPurchasePages: state.postPurchasePages.map((p) =>
              p.id === id
                ? {
                    ...p,
                    swipeStatus: 'failed' as const,
                    swipeResult: 'Seleziona un prodotto prima di lanciare lo swipe',
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
              ? { ...p, swipeStatus: 'in_progress' as const, updatedAt: new Date() }
              : p
          ),
        }));

        try {
          const response = await fetch(SWIPE_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              source_url: page.urlToSwipe,
              product: {
                name: product.name,
                description: product.description,
                benefits: product.benefits,
                cta_text: product.ctaText,
                cta_url: product.ctaUrl,
                brand_name: product.brandName,
              },
              language: 'it',
            }),
          });

          const data: SwipeApiResponse = await response.json();

          if (!response.ok || !data.success) {
            set((state) => ({
              postPurchasePages: state.postPurchasePages.map((p) =>
                p.id === id
                  ? {
                      ...p,
                      swipeStatus: 'failed' as const,
                      swipeResult: data.error || 'Errore durante lo swipe',
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
                    swipeResult: `✓ Swipe completato: "${data.new_title}" (${data.new_length} chars)`,
                    swipedData: {
                      html: data.html,
                      originalTitle: data.original_title,
                      newTitle: data.new_title,
                      originalLength: data.original_length,
                      newLength: data.new_length,
                      processingTime: data.processing_time_seconds,
                      methodUsed: data.method_used,
                      changesMade: data.changes_made,
                      swipedAt: new Date(),
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
