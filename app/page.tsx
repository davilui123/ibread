"use client";
import { useState } from 'react';
import BookShelf from '@/components/BookShelf';
import BookUpload from '@/components/BookUpload';
import { Library, Plus } from 'lucide-react';

export default function Home() {
  const [view, setView] = useState<'shelf' | 'add'>('shelf');

  return (
    <div className="min-h-screen bg-[#F8F9F7]">
      {view === 'shelf' ? <BookShelf /> : <BookUpload />}
      
      {/* NAV BAR ESTILO APP IPHONE */}
      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-xl border border-white/50 shadow-2xl rounded-full px-8 py-3 flex gap-12 z-[100]">
        <button 
          onClick={() => setView('shelf')}
          className={`transition-all ${view === 'shelf' ? 'text-black scale-110' : 'text-stone-300'}`}
        >
          <Library size={22} />
        </button>
        <button 
          onClick={() => setView('add')}
          className={`transition-all ${view === 'add' ? 'text-black scale-110' : 'text-stone-300'}`}
        >
          <Plus size={22} />
        </button>
      </nav>
    </div>
  );
}