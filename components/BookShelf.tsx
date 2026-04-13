"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Search, User, Loader2, BookMarked, LayoutGrid, Trash2, Flame, X, LogOut, Settings } from 'lucide-react';
import Link from 'next/link';

export default function BookShelf() {
  const [books, setBooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Estados para Chama e Perfil
  const [user, setUser] = useState<any>(null);
  const [streak, setStreak] = useState(0);
  const [hasReadToday, setHasReadToday] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  useEffect(() => {
    fetchBooks();
    loadUserStats();
  }, []);

  const loadUserStats = async () => {
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
  };

  const fetchBooks = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('books')
      .select('*')
      .order('updated_at', { ascending: false });

    if (!error) setBooks(data || []);
    setLoading(false);
  };

  const deleteBook = async (e: React.MouseEvent, book: any) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Excluir "${book.title}" permanentemente?`)) return;

    try {
      const { error: dbError } = await supabase.from('books').delete().eq('id', book.id);
      if (dbError) throw dbError;
      if (book.pdf_url) await supabase.storage.from('pdfs').remove([book.pdf_url]);
      setBooks(books.filter(b => b.id !== book.id));
    } catch (err) {
      alert("Erro ao excluir!");
      console.error(err);
    }
  };

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-[#F8F9F7]">
      <Loader2 className="animate-spin text-stone-300" size={32} />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8F9F7] text-[#1A1A1A] font-sans pb-40">
      
      {/* HEADER ORIGINAL COM LOGO PERSONALIZADA + CHAMA + USER */}
      <header className="sticky top-0 z-50 bg-[#F8F9F7]/80 backdrop-blur-xl border-b border-stone-200/50 px-6 py-5 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="bg-[#1A1A1A] p-2 rounded-lg shadow-xl shadow-black/10">
            <BookMarked size={18} className="text-white" />
          </div>
          <h1 className="text-2xl leading-none italic font-serif">
            IB<span className="not-italic font-sans font-light text-stone-400 tracking-tighter">Read</span>
          </h1>
        </div>

        <div className="flex items-center gap-5">
          <Search size={20} strokeWidth={1.5} className="text-stone-500" />
          
          {/* A CHAMA SUTIL (Baseada na Home Page) */}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all duration-500 ${hasReadToday ? 'bg-orange-50 border-orange-100 shadow-sm' : 'bg-stone-50 border-stone-100'}`}>
            <Flame size={14} className={hasReadToday ? "text-orange-500 fill-orange-500 animate-pulse" : "text-stone-300"} />
            <span className={`text-[10px] font-black leading-none ${hasReadToday ? "text-orange-600" : "text-stone-400"}`}>
              {streak}
            </span>
          </div>

          {/* O BONEQUINHO (Agora abre o Drawer) */}
          <button 
            onClick={() => setIsProfileOpen(true)}
            className="w-8 h-8 rounded-full bg-stone-200 flex items-center justify-center shadow-inner hover:bg-stone-300 transition-colors"
          >
            <User size={16} className="text-stone-400" />
          </button>
        </div>
      </header>

      <div className="max-w-md mx-auto px-6 py-8">
        
        {books.length > 0 && (
          <section className="mb-12">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400">Leitura Atual</h2>
            </div>
            
            <motion.div 
              whileTap={{ scale: 0.98 }}
              className="relative group bg-white p-4 rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.04)] border border-stone-100 flex gap-4 items-center cursor-pointer"
            >
              <Link href={`/reader/${books[0].id}`} className="flex flex-1 items-center gap-4">
                <div className="w-20 h-28 rounded-xl overflow-hidden shadow-md flex-shrink-0">
                  <img src={books[0].cover_url} className="w-full h-full object-cover" alt="capa" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-bold leading-tight mb-1">{books[0].title}</h3>
                  <p className="text-[10px] text-stone-400 font-medium mb-4">{books[0].author}</p>
                  
                  <div className="w-full h-1 bg-stone-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-[#1A1A1A] rounded-full transition-all duration-1000" 
                      style={{ width: `${(books[0].current_page / books[0].total_pages) * 100 || 2}%` }}
                    />
                  </div>
                </div>
                <div className="w-10 h-10 bg-stone-50 rounded-full flex items-center justify-center text-stone-800 border border-stone-100 shadow-sm">
                  <Play fill="currentColor" size={14} className="ml-0.5" />
                </div>
              </Link>

              <button 
                onClick={(e) => deleteBook(e, books[0])}
                className="absolute top-2 right-2 p-2 text-stone-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
              >
                <Trash2 size={14} />
              </button>
            </motion.div>
          </section>
        )}

        <section>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400">Toda a Biblioteca</h2>
            <LayoutGrid size={14} className="text-stone-300" />
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-8">
            {books.map((book) => (
              <div key={book.id} className="relative group">
                <Link href={`/reader/${book.id}`} className="flex flex-col">
                  <motion.div 
                    whileTap={{ scale: 0.96 }}
                    className="relative aspect-[3/4.2] rounded-xl overflow-hidden bg-stone-100 shadow-[0_10px_20px_rgba(0,0,0,0.06)] border border-white mb-3"
                  >
                    <img src={book.cover_url} className="w-full h-full object-cover" alt={book.title} />
                    
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/5">
                      <div 
                        className="h-full bg-white shadow-[0_0_10px_white] transition-all duration-1000" 
                        style={{ width: `${(book.current_page / book.total_pages) * 100 || 0}%` }}
                      />
                    </div>
                  </motion.div>
                  <h3 className="text-[11px] font-bold leading-tight truncate px-1">{book.title}</h3>
                  <p className="text-[9px] text-stone-400 truncate px-1 mt-0.5 uppercase tracking-tighter">{book.author}</p>
                </Link>

                <button 
                  onClick={(e) => deleteBook(e, book)}
                  className="absolute -top-2 -right-2 p-2 bg-white rounded-full shadow-lg text-stone-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all border border-stone-100 z-10"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>

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
                <h3 className="text-[10px] font-black uppercase tracking-widest text-stone-400">Meu Perfil</h3>
                <button onClick={() => setIsProfileOpen(false)} className="text-stone-300 hover:text-stone-950"><X size={20} /></button>
              </div>

              <div className="flex flex-col items-center py-8 mb-8 border-b border-stone-50">
                <div className="w-16 h-16 rounded-full bg-stone-50 border border-stone-100 flex items-center justify-center text-stone-300 text-xl font-black mb-4">
                  {user?.email?.[0].toUpperCase()}
                </div>
                <h4 className="font-black text-stone-900 leading-none mb-2">{user?.email?.split('@')[0]}</h4>
                <p className="text-[10px] text-stone-400 font-bold uppercase">{user?.email}</p>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center p-4 rounded-2xl bg-stone-50 border border-stone-100 text-xs font-bold text-stone-600">
                   Streak Atual <span className="text-orange-500 flex items-center gap-1"><Flame size={12} fill="currentColor"/> {streak} dias</span>
                </div>
                <button className="w-full flex items-center gap-3 p-4 text-xs font-bold text-stone-400 hover:text-stone-900 transition-colors">
                  <Settings size={14} /> Ajustes
                </button>
                <button 
                  onClick={() => supabase.auth.signOut()}
                  className="w-full flex items-center gap-3 p-4 text-xs font-bold text-red-400 hover:text-red-600 transition-colors mt-8"
                >
                  <LogOut size={14} /> Sair do App
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
