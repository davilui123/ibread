'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient'; // PADRONIZE ESTE CAMINHO
import { Flame, BookOpen, User, Loader2, Sparkles, X, Settings, LogOut, Search } from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

export default function HomePage() {
  const [user, setUser] = useState<any>(null);
  const [streak, setStreak] = useState(0);
  const [hasReadToday, setHasReadToday] = useState(false);
  const [books, setBooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados do Perfil Drawer
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  useEffect(() => {
    async function getDashboardData() {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        setUser(user);

        // Busca a chama (Streak)
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
            setHasReadToday(true); // Acende o fogo
          } else if (stats.last_read_date === yesterdayStr) {
            setStreak(stats.streak_count);
          } else {
            setStreak(0);
          }
        }

        // Busca os Livros para a Estante Normal
        const { data: userBooks } = await supabase
          .from('books')
          .select('*')
          .order('updated_at', { ascending: false });
        
        if (userBooks) setBooks(userBooks);
      }
      setLoading(false);
    }

    getDashboardData();
  }, []);

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-[#F8F9F7]">
      <Loader2 className="animate-spin text-stone-200" size={32} />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8F9F7] text-stone-900">
      
      {/* HEADER MINIMALISTA (Estética Antiga) */}
      <header className="px-8 py-5 border-b border-stone-100 bg-white/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Sparkles className="text-stone-300" size={18} />
            <h1 className="text-xs font-black uppercase tracking-[0.3em] text-stone-950">IBRead</h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-300" size={14} />
              <input type="search" placeholder="Buscar na estante..." className="bg-stone-50 border border-stone-100 text-xs rounded-full pl-9 pr-4 py-2 w-60 outline-none focus:border-stone-200 transition" />
            </div>

            {/* A Chama Sutil */}
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${hasReadToday ? 'bg-orange-50 border-orange-100' : 'bg-stone-50 border-stone-100'}`}>
              <Flame size={14} className={hasReadToday ? "text-orange-500 fill-orange-500 animate-pulse" : "text-stone-300"} />
              <span className={`text-[11px] font-black leading-none ${hasReadToday ? "text-orange-600" : "text-stone-400"}`}>
                {streak}
              </span>
            </div>

            {/* Botão do Perfil (Bonequinho) */}
            <button 
              onClick={() => setIsProfileOpen(true)}
              className="w-9 h-9 rounded-full bg-stone-100 border border-stone-200 flex items-center justify-center text-stone-500 hover:border-stone-300 hover:text-stone-700 transition"
            >
              <User size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* ESTANTE NORMAL (Estética Antiga) */}
      <main className="max-w-7xl mx-auto p-12">
        <div className="mb-12 flex justify-between items-center">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-stone-400">Minha Estante ({books.length})</h2>
            <button className="text-[10px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-700">+ Adicionar Livro</button>
        </div>

        {/* Lista Clean de Livros */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {books.map((b) => (
            <Link href={`/reader/${b.id}`} key={b.id}>
              <div className="bg-white border border-stone-100 p-7 rounded-3xl hover:shadow-xl hover:scale-[1.01] transition-all group cursor-pointer relative overflow-hidden">
                
                {/* Capa Minimalista */}
                <div className="aspect-[3/4.2] bg-stone-50 rounded-2xl mb-5 flex items-center justify-center border border-stone-100 overflow-hidden">
                    <BookOpen className="text-stone-200 group-hover:text-blue-300 transition-colors" size={48} />
                </div>

                <h3 className="font-bold text-stone-900 truncate leading-snug">{b.title}</h3>
                <p className="text-[11px] text-stone-400 font-bold uppercase tracking-tight">{b.author || 'Autor Desconhecido'}</p>
                
                <div className="flex items-center gap-3 mt-4 pt-4 border-t border-stone-50">
                    <span className="text-[10px] font-black uppercase text-stone-400">Progresso</span>
                    <span className="text-[10px] font-black text-stone-900">{Math.round((b.current_page / (b.total_pages || 1)) * 100)}%</span>
                </div>

                {/* Barra de progresso visível no hover */}
                <div className="absolute bottom-0 left-0 h-1 w-full bg-stone-100/30 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div 
                    className="h-full bg-stone-800" 
                    style={{ width: `${(b.current_page / (b.total_pages || 1)) * 100}%` }}
                  />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </main>

      {/* DRAWER DO PERFIL (O Bonequinho) */}
      <AnimatePresence>
        {isProfileOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsProfileOpen(false)} className="absolute inset-0 bg-black/10 backdrop-blur-sm z-[50]" />
            <motion.div 
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              className="absolute right-0 top-0 h-screen w-full max-w-sm z-[60] shadow-2xl p-12 bg-white flex flex-col"
            >
              <div className="flex justify-between items-center mb-12">
                <div className="flex items-center gap-2">
                  <User size={16} className="text-stone-400" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-stone-950">Meu Perfil</h3>
                </div>
                <button onClick={() => setIsProfileOpen(false)}><X size={20} className="text-stone-300" /></button>
              </div>

              {/* Informações do Usuário */}
              <div className="flex flex-col items-center text-center mb-12 py-8 bg-stone-50 rounded-3xl border border-stone-100">
                <div className="w-20 h-20 rounded-full bg-stone-100 border-2 border-stone-200 flex items-center justify-center mb-4 text-stone-400 text-3xl font-black">
                    {user?.user_metadata?.full_name?.[0] || 'L'}
                </div>
                <h4 className="font-black text-lg text-stone-950">{user?.user_metadata?.full_name || 'Leitor'}</h4>
                <p className="text-sm text-stone-400">{user?.email}</p>
              </div>

              {/* Estatísticas Rápidas */}
              <div className="grid grid-cols-2 gap-4 mb-10">
                <div className="p-5 bg-stone-50 rounded-2xl border border-stone-100 text-center">
                    <Flame className="mx-auto mb-2 text-orange-400" size={20} />
                    <p className="text-[10px] font-bold uppercase text-stone-400">Streak Atual</p>
                    <p className="text-2xl font-black text-orange-600">{streak} dias</p>
                </div>
                <div className="p-5 bg-stone-50 rounded-2xl border border-stone-100 text-center">
                    <BookOpen className="mx-auto mb-2 text-blue-400" size={20} />
                    <p className="text-[10px] font-bold uppercase text-stone-400">Livros</p>
                    <p className="text-2xl font-black text-stone-900">{books.length}</p>
                </div>
              </div>

              {/* Menu de Ações */}
              <div className="space-y-3 mt-auto">
                <button className="w-full flex items-center gap-3 p-4 rounded-xl hover:bg-stone-50 transition text-sm font-bold text-stone-700">
                    <Settings size={16} /> Configurações da Conta
                </button>
                <button onClick={() => supabase.auth.signOut()} className="w-full flex items-center gap-3 p-4 rounded-xl hover:bg-red-50 transition text-sm font-bold text-red-600">
                    <LogOut size={16} /> Sair do IBRead
                </button>
              </div>

            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
}
