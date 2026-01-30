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
        set((state) => ({
          funnelPages: state.funnelPages.map((p) =>
            p.id === id
              ? { ...p, swipeStatus: 'in_progress' as const, updatedAt: new Date() }
              : p
          ),
        }));

        // Simulate swipe process
        await new Promise((resolve) => setTimeout(resolve, 2000));

        const success = Math.random() > 0.2;
        set((state) => ({
          funnelPages: state.funnelPages.map((p) =>
            p.id === id
              ? {
                  ...p,
                  swipeStatus: success ? 'completed' : 'failed',
                  swipeResult: success
                    ? 'Swipe completato con successo! Contenuto estratto e salvato.'
                    : 'Errore durante lo swipe. Riprova.',
                  updatedAt: new Date(),
                }
              : p
          ),
        }));
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
        set((state) => ({
          postPurchasePages: state.postPurchasePages.map((p) =>
            p.id === id
              ? { ...p, swipeStatus: 'in_progress' as const, updatedAt: new Date() }
              : p
          ),
        }));

        await new Promise((resolve) => setTimeout(resolve, 2000));

        const success = Math.random() > 0.2;
        set((state) => ({
          postPurchasePages: state.postPurchasePages.map((p) =>
            p.id === id
              ? {
                  ...p,
                  swipeStatus: success ? 'completed' : 'failed',
                  swipeResult: success
                    ? 'Swipe completato con successo!'
                    : 'Errore durante lo swipe.',
                  updatedAt: new Date(),
                }
              : p
          ),
        }));
      },
    }),
    {
      name: 'funnel-swiper-storage',
    }
  )
);
