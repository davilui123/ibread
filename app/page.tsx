'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient'; // PADRONIZE ESTE CAMINHO
import { Flame, BookOpen, User, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function HomePage() {
  const [user, setUser] = useState<any>(null);
  const [streak, setStreak] = useState(0);
  const [books, setBooks] = useState<any[]>([]); // Estado para os livros
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function getDashboardData() {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        setUser(user);

        // Busca a chama
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

          if (stats.last_read_date !== today && stats.last_read_date !== yesterdayStr) {
            setStreak(0);
          } else {
            setStreak(stats.streak_count);
          }
        }

        // BUSCA OS LIVROS (Para a Home não ficar vazia)
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
      <Loader2 className="animate-spin text-stone-300" size={32} />
    </div>
  );

  return (
    <main className="max-w-5xl mx-auto p-8">
      <div className="flex justify-between items-center mb-12">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-stone-900">
            Olá, {user?.user_metadata?.full_name?.split(' ')[0] || 'Leitor'}!
          </h1>
          <p className="text-stone-500 font-medium">Sua biblioteca inteligente está pronta.</p>
        </div>
        
        <div className="bg-orange-50 border border-orange-100 rounded-3xl px-6 py-4 flex items-center gap-4 shadow-sm">
          <Flame className={`w-8 h-8 ${streak > 0 ? 'text-orange-500 fill-orange-500 animate-bounce' : 'text-stone-300'}`} />
          <div>
            <p className="text-[10px] text-orange-800 font-black uppercase tracking-widest">Streak</p>
            <p className="text-2xl font-black text-orange-600 leading-none">{streak} dias</p>
          </div>
        </div>
      </div>

      <h2 className="text-xs font-black uppercase tracking-[0.2em] text-stone-400 mb-6">Minha Estante</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {books.map((b) => (
          <Link href={`/reader/${b.id}`} key={b.id}>
            <div className="bg-white border border-stone-100 p-6 rounded-3xl hover:shadow-xl hover:scale-[1.02] transition-all group cursor-pointer">
              <div className="aspect-[3/4] bg-stone-100 rounded-2xl mb-4 overflow-hidden flex items-center justify-center">
                <BookOpen className="text-stone-300 group-hover:text-blue-400 transition-colors" size={48} />
              </div>
              <h3 className="font-black text-stone-800 truncate">{b.title}</h3>
              <p className="text-xs text-stone-400 font-bold uppercase">{b.author || 'Autor Desconhecido'}</p>
              
              {/* Barra de progresso visual */}
              <div className="mt-4 h-1 w-full bg-stone-50 rounded-full overflow-hidden">
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
  );
}
