"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import BookShelf from '@/components/BookShelf';
import BookUpload from '@/components/BookUpload';
import { Library, Plus, Flame, User, Sparkles, X, Settings, LogOut, Loader2, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Home() {
  const [view, setView] = useState<'shelf' | 'add'>('shelf');
  const [user, setUser] = useState<any>(null);
  const [streak, setStreak] = useState(0);
  const [hasReadToday, setHasReadToday] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUser(user);
        const { data: stats } = await supabase
          .from('user_stats')
          .select('streak_count, last_read_date')
          .eq('user_id', user.id)
          .maybeSingle();

        if (stats) {
          const today = new Date().toISOString().split('T')[0];
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = yesterday.toISOString().split('T')[0];

          if (stats.last_read_date === today) {
            setStreak(stats.streak_count);
            setHasReadToday(true);
          } else if (stats.last_read_date === yesterdayStr) {
            setStreak(stats.streak_count);
          } else {
            setStreak(0);
          }
        }
      }
      setLoading(false);
    }
    loadDashboard();
  }, []);

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-[#F8F9F7]">
      <Loader2 className="animate-spin text-stone-200" size={32} />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8F9F7] text-stone-900 pb-24">
      
      {/* HEADER ÚNICO E DEFINITIVO */}
      <header className="px-8 py-6 border-b border-stone-100 bg-white/80 backdrop-blur-md sticky top-0 z-[90]">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          
          {/* Lado Esquerdo: Logo */}
          <div className="flex items-center gap-2">
            <Sparkles className="text-stone-300" size={18} />
            <h1 className="text-xs font-black uppercase tracking-[0.3em] text-stone-950">IBRead</h1>
          </div>

          {/* Lado Direito: Busca + Chama + User */}
          <div className="flex items-center gap-4">
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-300" size={14} />
              <input 
                type="search" 
                placeholder="Buscar..." 
                className="bg-stone-50 border border-stone-100 text-xs rounded-full pl-9 pr-4 py-2 w-48 outline-none focus:border-stone-200 transition" 
              />
            </div>

            {/* Chama Sutil */}
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all duration-500 ${hasReadToday ? 'bg-orange-50 border-orange-100 shadow-sm' : 'bg-stone-50 border-stone-100'}`}>
              <Flame size={14} className={hasReadToday ? "text-orange-500 fill-orange-500 animate-pulse" : "text-stone-300"} />
              <span className={`text-[10px] font-black leading-none ${hasReadToday ? "text-orange-600" : "text-stone-400"}`}>
                {streak}
              </span>
            </div>

            {/* Perfil */}
            <button 
              onClick={() => setIsProfileOpen(true)}
              className="w-9 h-9 rounded-full bg-stone-100 border border-stone-200 flex items-center justify-center text-stone-500 hover:text-stone-900 transition-colors"
            >
              <User size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* CONTEÚDO */}
      <main className="max-w-7xl mx-auto px-8 pt-8">
        {view === 'shelf' ? (
          <div className="animate-in fade-in duration-700">
            <BookShelf />
          </div>
        ) : (
          <div className="animate-in slide-in-from-bottom-4 duration-500">
            <BookUpload />
          </div>
        )}
      </main>

      {/* NAV BAR FLUTUANTE (IPHONE STYLE) */}
      <nav className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-white/80 backdrop-blur-2xl border border-white/50 shadow-2xl rounded-full px-10 py-4 flex gap-14 z-[100]">
        <button 
          onClick={() => setView('shelf')}
          className={`transition-all duration-300 flex flex-col items-center gap-1 ${view === 'shelf' ? 'text-black scale-110' : 'text-stone-300'}`}
        >
          <Library size={22} />
          <span className="text-[8px] font-black uppercase tracking-tighter">Estante</span>
        </button>
        <button 
          onClick={() => setView('add')}
          className={`transition-all duration-300 flex flex-col items-center gap-1 ${view === 'add' ? 'text-black scale-110' : 'text-stone-300'}`}
        >
          <Plus size={22} />
          <span className="text-[8px] font-black uppercase tracking-tighter">Adicionar</span>
        </button>
      </nav>

      {/* DRAWER PERFIL */}
      <AnimatePresence>
        {isProfileOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsProfileOpen(false)} className="fixed inset-0 bg-black/5 backdrop-blur-sm z-[110]" />
            <motion.div 
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              className="fixed right-0 top-0 h-screen w-full max-w-sm z-[120] shadow-2xl p-12 bg-white flex flex-col"
            >
              <div className="flex justify-between items-center mb-12">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-stone-400">Perfil do Leitor</h3>
                <button onClick={() => setIsProfileOpen(false)}><X size={20} className="text-stone-300" /></button>
              </div>

              <div className="flex flex-col items-center py-8 bg-stone-50 rounded-3xl border border-stone-100 mb-8">
                <div className="w-16 h-16 rounded-full bg-white border border-stone-100 flex items-center justify-center text-stone-300 text-xl font-black mb-4">
                  {user?.email?.[0].toUpperCase()}
                </div>
                <p className="text-[10px] text-stone-400 font-bold uppercase">{user?.email}</p>
              </div>

              <div className="space-y-4 mt-auto">
                <button 
                  onClick={() => supabase.auth.signOut()}
                  className="w-full flex items-center gap-3 p-4 text-xs font-bold text-red-400 hover:text-red-600 transition-colors"
                >
                  <LogOut size={14} /> Encerrar Sessão
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
