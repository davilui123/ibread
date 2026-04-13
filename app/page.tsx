'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase'; // Ajuste o caminho conforme seu projeto
import { Flame, BookOpen, User } from 'lucide-react'; // Ícones legais

export default function HomePage() {
  const [user, setUser] = useState<any>(null);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function getDashboardData() {
      // 1. Pega o usuário logado
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        setUser(user);

        // 2. Busca a chama do usuário na tabela que criamos
        const { data: stats } = await supabase
          .from('user_stats')
          .select('streak_count, last_read_date')
          .eq('user_id', user.id)
          .maybeSingle();

        if (stats) {
          // Lógica para verificar se a chama "esfriou" (mais de 24h sem ler)
          const today = new Date().toISOString().split('T')[0];
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = yesterday.toISOString().split('T')[0];

          if (stats.last_read_date !== today && stats.last_read_date !== yesterdayStr) {
            setStreak(0); // Esfriou
          } else {
            setStreak(stats.streak_count);
          }
        }
      }
      setLoading(false);
    }

    getDashboardData();
  }, []);

  if (loading) return <div className="p-8 text-center">Carregando IBRead...</div>;

  return (
    <main className="max-w-4xl mx-auto p-6">
      {/* Header do Dashboard */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Olá, {user?.user_metadata?.full_name || 'Leitor'}!</h1>
          <p className="text-gray-500">Pronto para a leitura de hoje?</p>
        </div>
        
        {/* O Widget da Chama na Home */}
        <div className="bg-orange-100 border-2 border-orange-500 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
          <Flame className={`w-8 h-8 ${streak > 0 ? 'text-orange-600 fill-orange-500' : 'text-gray-400'}`} />
          <div>
            <p className="text-xs text-orange-800 font-bold uppercase tracking-wider">Sua Chama</p>
            <p className="text-2xl font-black text-orange-600">{streak} dias</p>
          </div>
        </div>
      </div>

      {/* Grid de Conteúdo */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border p-6 rounded-xl hover:shadow-md transition cursor-pointer">
          <BookOpen className="mb-4 text-blue-500" />
          <h2 className="text-xl font-bold mb-2">Continuar Lendo</h2>
          <p className="text-gray-600 text-sm">Volte para o livro que você parou.</p>
        </div>

        <div className="bg-white border p-6 rounded-xl hover:shadow-md transition cursor-pointer">
          <User className="mb-4 text-purple-500" />
          <h2 className="text-xl font-bold mb-2">Meu Perfil</h2>
          <p className="text-gray-600 text-sm">Veja suas estatísticas e coleções.</p>
        </div>
      </div>
    </main>
  );
}
