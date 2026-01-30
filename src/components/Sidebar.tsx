'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  ShoppingBag, 
  Layers, 
  CreditCard,
  ChevronRight,
  Sparkles,
  Copy
} from 'lucide-react';

const menuItems = [
  {
    name: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
  },
  {
    name: 'Clone & Swipe',
    href: '/clone-landing',
    icon: Copy,
  },
  {
    name: 'Copy Analyzer',
    href: '/copy-analyzer',
    icon: Sparkles,
  },
  {
    name: 'Front End Funnel',
    href: '/front-end-funnel',
    icon: Layers,
  },
  {
    name: 'Post Purchase Funnel',
    href: '/post-purchase',
    icon: CreditCard,
  },
  {
    name: 'My Products',
    href: '/products',
    icon: ShoppingBag,
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-gray-900 text-white min-h-screen flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-gray-800">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Layers className="w-6 h-6 text-blue-400" />
          Funnel Swiper
        </h1>
        <p className="text-gray-400 text-sm mt-1">Dashboard Operations</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="flex-1">{item.name}</span>
                  {isActive && <ChevronRight className="w-4 h-4" />}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-800">
        <div className="bg-gray-800 rounded-lg p-4">
          <p className="text-sm text-gray-400">Swipe Status</p>
          <div className="flex items-center gap-2 mt-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm">Sistema attivo</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
