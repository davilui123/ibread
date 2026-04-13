"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import BookShelf from '@/components/BookShelf';
import BookUpload from '@/components/BookUpload';
import { Library, Plus, Flame, User, Sparkles, X, Settings, LogOut, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Home() {
  const [view, setView] = useState<'shelf' | 'add'>('shelf');
  const [user, setUser] = useState<any>(null);
  const [streak, setStreak] = useState(0);
  const [hasReadToday, setHasReadToday] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // 1. Carregar dados do Usuário e da Chama (Streak)
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
      
      {/* HEADER SUPER CLEAN */}
      <header className="px-8 py-6 flex justify-between items-center bg-white/50 backdrop-blur-md sticky top-0 z-[90]">
        <div className="flex items-center gap-2">
          <Sparkles className="text-stone-300" size={16} />
          <h1 className="text-[10px] font-black uppercase tracking-[0.4em] text-stone-950">IBRead</h1>
        </div>

        <div className="flex items-center gap-4">
          {/* Chama Sutil */}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all duration-500 ${hasReadToday ? 'bg-orange-50 border-orange-100 shadow-sm' : 'bg-stone-50 border-stone-100'}`}>
            <Flame size={14} className={hasReadToday ? "text-orange-500 fill-orange-500 animate-pulse" : "text-stone-300"} />
            <span className={`text-[10px] font-black leading-none ${hasReadToday ? "text-orange-600" : "text-stone-400"}`}>
              {streak}
            </span>
          </div>

          {/* Bonequinho do Perfil */}
          <button 
            onClick={() => setIsProfileOpen(true)}
            className="w-8 h-8 rounded-full bg-stone-100 border border-stone-200 flex items-center justify-center text-stone-500 hover:text-stone-900 transition-colors"
          >
            <User size={16} />
          </button>
        </div>
      </header>

      {/* CONTEÚDO DINÂMICO */}
      <main className="max-w-7xl mx-auto px-8 pt-4">
        {view === 'shelf' ? <BookShelf /> : <BookUpload />}
      </main>

      {/* NAV BAR FLUTUANTE (ESTILO IPHONE) */}
      <nav className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-white/80 backdrop-blur-2xl border border-white/50 shadow-[0_20px_50px_rgba(0,0,0,0.1)] rounded-full px-10 py-4 flex gap-14 z-[100]">
        <button 
          onClick={() => setView('shelf')}
          className={`transition-all duration-300 flex flex-col items-center gap-1 ${view === 'shelf' ? 'text-black scale-110' : 'text-stone-300'}`}
        >
          <Library size={22} />
          <span className="text-[8px] font-black uppercase tracking-tighter">Biblioteca</span>
        </button>
        <button 
          onClick={() => setView('add')}
          className={`transition-all duration-300 flex flex-col items-center gap-1 ${view === 'add' ? 'text-black scale-110' : 'text-stone-300'}`}
        >
          <Plus size={22} />
          <span className="text-[8px] font-black uppercase tracking-tighter">Novo Livro</span>
        </button>
      </nav>

      {/* DRAWER DO PERFIL (Animação Lateral) */}
      <AnimatePresence>
        {isProfileOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsProfileOpen(false)} className="fixed inset-0 bg-black/5 backdrop-blur-sm z-[110]" />
            <motion.div 
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 h-screen w-full max-w-sm z-[120] shadow-2xl p-12 bg-white flex flex-col"
            >
              <div className="flex justify-between items-center mb-12">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-stone-400">Minha Conta</h3>
                <button onClick={() => setIsProfileOpen(false)} className="text-stone-300 hover:text-stone-900"><X size={20} /></button>
              </div>

              <div className="flex flex-col items-center text-center py-8 mb-8">
                <div className="w-16 h-16 rounded-full bg-stone-50 border border-stone-100 flex items-center justify-center text-stone-300 text-xl font-black mb-4">
                  {user?.email?.[0].toUpperCase()}
                </div>
                <h4 className="font-black text-stone-900 leading-none mb-2">{user?.email?.split('@')[0]}</h4>
                <p className="text-[10px] text-stone-400 font-bold uppercase">{user?.email}</p>
              </div>

              <div className="space-y-4">
                <button className="w-full flex justify-between items-center p-4 rounded-2xl bg-stone-50 border border-stone-100 text-xs font-bold text-stone-600">
                   Sua Chama <span className="text-orange-500">{streak} dias</span>
                </button>
                <button className="w-full flex items-center gap-3 p-4 text-xs font-bold text-stone-400 hover:text-stone-900 transition-colors">
                  <Settings size={14} /> Preferências
                </button>
                <button 
                  onClick={() => supabase.auth.signOut()}
                  className="w-full flex items-center gap-3 p-4 text-xs font-bold text-red-400 hover:text-red-600 transition-colors mt-8"
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
