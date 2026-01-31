import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Sidebar from '@/components/Sidebar';
import { SupabaseProvider } from '@/components/SupabaseProvider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Funnel Swiper Dashboard',
  description: 'Gestione attività di swipe funnel',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it">
      <body className={inter.className}>
        <SupabaseProvider>
          <div className="flex min-h-screen">
            <Sidebar />
            <main className="flex-1 bg-gray-50">
              {children}
            </main>
          </div>
        </SupabaseProvider>
      </body>
    </html>
  );
}
