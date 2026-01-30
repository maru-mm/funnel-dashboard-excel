'use client';

import Header from '@/components/Header';
import { useStore } from '@/store/useStore';
import { 
  Layers, 
  ShoppingBag, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  TrendingUp 
} from 'lucide-react';
import Link from 'next/link';

export default function Dashboard() {
  const { products, funnelPages, postPurchasePages } = useStore();

  const stats = [
    {
      name: 'Prodotti Totali',
      value: products.length,
      icon: ShoppingBag,
      color: 'bg-blue-500',
      href: '/products',
    },
    {
      name: 'Pagine Front End',
      value: funnelPages.length,
      icon: Layers,
      color: 'bg-purple-500',
      href: '/front-end-funnel',
    },
    {
      name: 'Swipe Completati',
      value: [...funnelPages, ...postPurchasePages].filter(
        (p) => p.swipeStatus === 'completed'
      ).length,
      icon: CheckCircle,
      color: 'bg-green-500',
      href: '#',
    },
    {
      name: 'In Attesa',
      value: [...funnelPages, ...postPurchasePages].filter(
        (p) => p.swipeStatus === 'pending'
      ).length,
      icon: Clock,
      color: 'bg-yellow-500',
      href: '#',
    },
  ];

  const recentPages = [...funnelPages, ...postPurchasePages]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);

  return (
    <div className="min-h-screen">
      <Header title="Dashboard" subtitle="Panoramica delle attività di swipe" />

      <div className="p-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Link
                key={stat.name}
                href={stat.href}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-500 text-sm">{stat.name}</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">
                      {stat.value}
                    </p>
                  </div>
                  <div className={`${stat.color} p-3 rounded-lg`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Link
            href="/front-end-funnel"
            className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl p-6 hover:from-blue-700 hover:to-blue-800 transition-colors"
          >
            <div className="flex items-center gap-4">
              <Layers className="w-12 h-12" />
              <div>
                <h3 className="text-xl font-bold">Front End Funnel</h3>
                <p className="text-blue-100 mt-1">
                  Gestisci landing, quiz, checkout e altre pagine
                </p>
              </div>
            </div>
          </Link>

          <Link
            href="/post-purchase"
            className="bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-xl p-6 hover:from-purple-700 hover:to-purple-800 transition-colors"
          >
            <div className="flex items-center gap-4">
              <TrendingUp className="w-12 h-12" />
              <div>
                <h3 className="text-xl font-bold">Post Purchase Funnel</h3>
                <p className="text-purple-100 mt-1">
                  Gestisci upsell, downsell e thank you pages
                </p>
              </div>
            </div>
          </Link>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Attività Recenti
            </h2>
          </div>
          <div className="divide-y divide-gray-200">
            {recentPages.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                Nessuna attività recente
              </div>
            ) : (
              recentPages.map((page) => (
                <div
                  key={page.id}
                  className="px-6 py-4 flex items-center justify-between hover:bg-gray-50"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        page.swipeStatus === 'completed'
                          ? 'bg-green-100'
                          : page.swipeStatus === 'failed'
                          ? 'bg-red-100'
                          : page.swipeStatus === 'in_progress'
                          ? 'bg-yellow-100'
                          : 'bg-gray-100'
                      }`}
                    >
                      {page.swipeStatus === 'completed' ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : page.swipeStatus === 'failed' ? (
                        <AlertCircle className="w-5 h-5 text-red-600" />
                      ) : page.swipeStatus === 'in_progress' ? (
                        <Clock className="w-5 h-5 text-yellow-600" />
                      ) : (
                        <Clock className="w-5 h-5 text-gray-600" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{page.name}</p>
                      <p className="text-sm text-gray-500">{page.urlToSwipe}</p>
                    </div>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      page.swipeStatus === 'completed'
                        ? 'bg-green-100 text-green-800'
                        : page.swipeStatus === 'failed'
                        ? 'bg-red-100 text-red-800'
                        : page.swipeStatus === 'in_progress'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {page.swipeStatus === 'completed'
                      ? 'Completato'
                      : page.swipeStatus === 'failed'
                      ? 'Fallito'
                      : page.swipeStatus === 'in_progress'
                      ? 'In Corso'
                      : 'In Attesa'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
