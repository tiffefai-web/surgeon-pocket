import GlobalNavbar from '@/components/GlobalNavbar';
import { ReactNode } from 'react';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <GlobalNavbar 
        title="Surgeon's Pocket - Main Hospital" 
        role="Admin" 
        bgClass="bg-blue-900"
        secondaryLinks={
          <a href="/hospital" className="text-sm text-blue-100 hover:text-white transition font-medium">
            Global Hospital Board
          </a>
        }
      />
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {children}
      </main>
    </div>
  );
}
