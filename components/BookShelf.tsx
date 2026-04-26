"use client";

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, Search, User, Loader2, BookMarked, LayoutGrid, Trash2,
  Flame, X, Star, Zap, Target, Settings, LogOut, ChevronRight,
  Trophy, Lock
} from 'lucide-react';
import Link from 'next/link';

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface Book {
  id: string;
  title: string;
  author: string;
  cover_url: string;
  pdf_url: string;
  current_page: number;
  total_pages: number;
  updated_at: string;
}

interface UserStats {
  user_id: string;
  streak_count: number;
  last_read_date: string;
  xp: number;
  level: number;
  total_pages: number;
  total_minutes: number;
  turbo_uses: number;
  weekly_goal: number;
  weekly_pages: number;
  week_start: string;
}

interface Badge {
  id: string;
  label: string;
  description: string;
  icon: string;
  xpReward: number;
  check: (stats: UserStats, badges: string[]) => boolean;
}

// ─── Catálogo de Badges ───────────────────────────────────────────────────────

const BADGE_CATALOG: Badge[] = [
  {
    id: 'first_book',
    label: 'Primeira Página',
    description: 'Adicionou o primeiro livro à estante',
    icon: '📖',
    xpReward: 50,
    check: (_s, _b) => true, // desbloqueado se tem livro
  },
  {
    id: 'pages_100',
    label: 'Centenário',
    description: '100 páginas lidas no total',
    icon: '💯',
    xpReward: 100,
    check: (s) => s.total_pages >= 100,
  },
  {
    id: 'pages_500',
    label: 'Meio Milhar',
    description: '500 páginas lidas',
    icon: '📚',
    xpReward: 250,
    check: (s) => s.total_pages >= 500,
  },
  {
    id: 'pages_1000',
    label: 'Milhar',
    description: '1000 páginas lidas',
    icon: '🏛️',
    xpReward: 500,
    check: (s) => s.total_pages >= 1000,
  },
  {
    id: 'streak_3',
    label: 'Trilogia',
    description: '3 dias consecutivos de leitura',
    icon: '🔥',
    xpReward: 75,
    check: (s) => s.streak_count >= 3,
  },
  {
    id: 'streak_7',
    label: 'Uma Semana',
    description: '7 dias consecutivos',
    icon: '⚡',
    xpReward: 200,
    check: (s) => s.streak_count >= 7,
  },
  {
    id: 'streak_30',
    label: 'Mês de Leitor',
    description: '30 dias consecutivos',
    icon: '🌕',
    xpReward: 1000,
    check: (s) => s.streak_count >= 30,
  },
  {
    id: 'turbo_10',
    label: 'Velocista',
    description: 'Usou o Turbo Reader 10 vezes',
    icon: '🚀',
    xpReward: 150,
    check: (s) => s.turbo_uses >= 10,
  },
  {
    id: 'goal_week',
    label: 'Meta Cumprida',
    description: 'Atingiu a meta semanal de páginas',
    icon: '🎯',
    xpReward: 100,
    check: (s) => s.weekly_pages >= s.weekly_goal,
  },
];

// ─── Lógica de XP / Nível ────────────────────────────────────────────────────

// XP necessário para cada nível (crescimento quadrático suave)
const xpForLevel = (level: number) => Math.floor(100 * Math.pow(level, 1.6));

// XP acumulado até chegar ao nível N
const totalXpForLevel = (level: number) => {
  let total = 0;
  for (let i = 1; i < level; i++) total += xpForLevel(i);
  return total;
};

const getLevelFromXp = (xp: number): number => {
  let level = 1;
  while (xp >= totalXpForLevel(level + 1)) level++;
  return level;
};

const xpProgressInLevel = (xp: number, level: number) => {
  const start = totalXpForLevel(level);
  const end = totalXpForLevel(level + 1);
  return { current: xp - start, needed: end - start };
};

// ─── Títulos por nível ───────────────────────────────────────────────────────

const LEVEL_TITLES: Record<number, string> = {
  1: 'Iniciante',
  2: 'Aprendiz',
  3: 'Leitor',
  4: 'Curioso',
  5: 'Estudioso',
  6: 'Voraz',
  7: 'Erudito',
  8: 'Sábio',
  9: 'Mestre',
  10: 'Lendário',
};

const getLevelTitle = (level: number) =>
  LEVEL_TITLES[Math.min(level, 10)] ?? 'Lendário';

// ─── Componente Principal ────────────────────────────────────────────────────

export default function BookShelf() {
  const [books, setBooks] = useState<Book[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [unlockedBadgeIds, setUnlockedBadgeIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [profileTab, setProfileTab] = useState<'stats' | 'badges'>('stats');
  const [newBadge, setNewBadge] = useState<Badge | null>(null);

  useEffect(() => {
    const init = async () => {
      await Promise.all([fetchBooks(), fetchStats()]);
      setLoading(false);
    };
    init();
  }, []);

  // Verifica badges toda vez que stats mudar
  useEffect(() => {
    if (stats && books.length > 0) checkAndUnlockBadges(stats, books);
  }, [stats, books]);

  const fetchBooks = async () => {
    const { data, error } = await supabase
      .from('books')
      .select('*')
      .order('updated_at', { ascending: false });
    if (!error) setBooks(data || []);
  };

  const fetchStats = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let { data } = await supabase
      .from('user_stats')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!data) {
      // Cria registro inicial se não existir
      const { data: newData } = await supabase
        .from('user_stats')
        .insert({ user_id: user.id, streak_count: 0, xp: 0, level: 1, total_pages: 0, weekly_goal: 50 })
        .select()
        .single();
      data = newData;
    }

    if (data) {
      const computedLevel = getLevelFromXp(data.xp ?? 0);
      // Garante que o nível no banco está sincronizado
      if (computedLevel !== data.level) {
        await supabase.from('user_stats').update({ level: computedLevel }).eq('user_id', user.id);
        data.level = computedLevel;
      }
      setStats(data);
    }

    // Busca badges já desbloqueados
    const { data: badgeData } = await supabase
      .from('user_badges')
      .select('badge_id')
      .eq('user_id', user.id);
    setUnlockedBadgeIds(badgeData?.map((b: any) => b.badge_id) ?? []);
  };

  const checkAndUnlockBadges = async (currentStats: UserStats, currentBooks: Book[]) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    for (const badge of BADGE_CATALOG) {
      if (unlockedBadgeIds.includes(badge.id)) continue;

      const shouldUnlock =
        badge.id === 'first_book'
          ? currentBooks.length > 0
          : badge.check(currentStats, unlockedBadgeIds);

      if (shouldUnlock) {
        await supabase.from('user_badges').insert({
          user_id: user.id,
          badge_id: badge.id,
        });

        // Adiciona XP do badge
        const newXp = (currentStats.xp ?? 0) + badge.xpReward;
        const newLevel = getLevelFromXp(newXp);
        await supabase.from('user_stats').update({ xp: newXp, level: newLevel }).eq('user_id', currentStats.user_id);

        setStats(prev => prev ? { ...prev, xp: newXp, level: newLevel } : prev);
        setUnlockedBadgeIds(prev => [...prev, badge.id]);
        setNewBadge(badge);
        setTimeout(() => setNewBadge(null), 3500);
        break; // Um badge por vez para não sobrecarregar
      }
    }
  };

  const deleteBook = async (e: React.MouseEvent, book: Book) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Excluir "${book.title}" permanentemente?`)) return;
    try {
      await supabase.from('books').delete().eq('id', book.id);
      if (book.pdf_url) await supabase.storage.from('pdfs').remove([book.pdf_url]);
      setBooks(books.filter(b => b.id !== book.id));
    } catch {
      alert("Erro ao excluir!");
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-[#F8F9F7]">
      <Loader2 className="animate-spin text-stone-300" size={32} />
    </div>
  );

  const level = stats?.level ?? 1;
  const xp = stats?.xp ?? 0;
  const { current: xpInLevel, needed: xpNeeded } = xpProgressInLevel(xp, level);
  const xpPercent = Math.min(Math.round((xpInLevel / xpNeeded) * 100), 100);
  const streakActive = stats?.streak_count != null && stats.streak_count > 0;
  const weeklyPercent = Math.min(
    Math.round(((stats?.weekly_pages ?? 0) / (stats?.weekly_goal ?? 50)) * 100),
    100
  );

  return (
    <div className="min-h-screen bg-[#F8F9F7] text-[#1A1A1A] font-sans pb-40">

      {/* ── HEADER ── */}
      <header className="sticky top-0 z-50 bg-[#F8F9F7]/80 backdrop-blur-xl border-b border-stone-200/50 px-6 py-5 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="bg-[#1A1A1A] p-2 rounded-lg shadow-xl shadow-black/10">
            <BookMarked size={18} className="text-white" />
          </div>
          <h1 className="text-2xl leading-none italic font-serif" style={{ fontFamily: 'var(--font-serif)' }}>
            IB<span className="not-italic font-sans font-light text-stone-400 tracking-tighter">Read</span>
          </h1>
        </div>
        <div className="flex items-center gap-4 text-stone-500">
          <Search size={20} strokeWidth={1.5} />

          {/* Streak + Avatar */}
          <button
            onClick={() => setIsProfileOpen(true)}
            className="flex items-center gap-2 bg-white border border-stone-100 rounded-full pl-2.5 pr-1 py-1 shadow-sm"
          >
            {streakActive && (
              <span className="flex items-center gap-1 text-orange-500">
                <Flame size={13} fill="currentColor" />
                <span className="text-[11px] font-black">{stats?.streak_count}</span>
              </span>
            )}
            <div className="w-7 h-7 rounded-full bg-stone-100 flex items-center justify-center">
              <User size={14} className="text-stone-400" />
            </div>
          </button>
        </div>
      </header>

      {/* ── XP BANNER (compacto, abaixo do header) ── */}
      {stats && (
        <div className="max-w-md mx-auto px-6 pt-5">
          <div className="bg-white border border-stone-100 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-[0_4px_16px_rgba(0,0,0,0.03)]">
            {/* Nível */}
            <div className="w-9 h-9 rounded-xl bg-[#1A1A1A] flex items-center justify-center flex-shrink-0">
              <span className="text-white text-[11px] font-black">{level}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-baseline mb-1.5">
                <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">
                  {getLevelTitle(level)}
                </span>
                <span className="text-[10px] font-bold text-stone-300">
                  {xpInLevel}/{xpNeeded} xp
                </span>
              </div>
              <div className="h-1 bg-stone-100 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${xpPercent}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                  className="h-full bg-[#1A1A1A] rounded-full"
                />
              </div>
            </div>
            {/* Meta semanal */}
            <div className="flex-shrink-0 flex flex-col items-center gap-0.5 pl-2 border-l border-stone-100">
              <Target size={12} className="text-stone-300" />
              <span className="text-[10px] font-black text-stone-400">{weeklyPercent}%</span>
            </div>
          </div>
        </div>
      )}

      {/* ── CONTEÚDO ── */}
      <div className="max-w-md mx-auto px-6 py-6">

        {books.length > 0 && (
          <section className="mb-10">
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

      {/* ── DRAWER DE PERFIL ── */}
      <AnimatePresence>
        {isProfileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsProfileOpen(false)}
              className="fixed inset-0 bg-black/10 backdrop-blur-[2px] z-[60]"
            />
            <motion.div
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              className="fixed right-0 top-0 h-full w-full max-w-xs bg-white z-[70] shadow-2xl flex flex-col"
            >
              {/* Header do drawer */}
              <div className="px-6 pt-8 pb-6 border-b border-stone-100">
                <div className="flex justify-between items-start mb-6">
                  <p className="text-[9px] font-black uppercase tracking-[0.25em] text-stone-400">Meu Perfil</p>
                  <button onClick={() => setIsProfileOpen(false)}>
                    <X size={18} className="text-stone-300" />
                  </button>
                </div>

                {/* Avatar + Nome do Nível */}
                <div className="flex items-center gap-4 mb-6">
                  <div className="relative">
                    <div className="w-14 h-14 rounded-full bg-stone-100 flex items-center justify-center shadow-inner">
                      <User size={22} className="text-stone-300" />
                    </div>
                    {/* Badge de nível flutuante */}
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-[#1A1A1A] rounded-full flex items-center justify-center border-2 border-white">
                      <span className="text-white text-[9px] font-black">{level}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-base font-bold">{getLevelTitle(level)}</p>
                    <p className="text-[10px] text-stone-400 mt-0.5">{xp} XP acumulados</p>
                  </div>
                </div>

                {/* Barra de XP do drawer */}
                <div>
                  <div className="flex justify-between mb-1.5">
                    <span className="text-[9px] font-black text-stone-400 uppercase tracking-wider">Nível {level} → {level + 1}</span>
                    <span className="text-[9px] font-bold text-stone-300">{xpInLevel}/{xpNeeded}</span>
                  </div>
                  <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }} animate={{ width: `${xpPercent}%` }}
                      transition={{ duration: 1.2, ease: 'easeOut', delay: 0.2 }}
                      className="h-full bg-[#1A1A1A] rounded-full"
                    />
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-stone-100 px-6">
                {(['stats', 'badges'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setProfileTab(tab)}
                    className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-colors ${
                      profileTab === tab ? 'text-[#1A1A1A] border-b-2 border-[#1A1A1A]' : 'text-stone-300'
                    }`}
                  >
                    {tab === 'stats' ? 'Estatísticas' : 'Conquistas'}
                  </button>
                ))}
              </div>

              {/* Conteúdo das tabs */}
              <div className="flex-1 overflow-y-auto px-6 py-5">
                <AnimatePresence mode="wait">
                  {profileTab === 'stats' ? (
                    <motion.div key="stats" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">

                      {/* Streak */}
                      <div className="bg-stone-50 rounded-2xl p-4 flex items-center justify-between border border-stone-100">
                        <div className="flex items-center gap-3">
                          <Flame size={18} className={streakActive ? 'text-orange-500' : 'text-stone-300'} fill={streakActive ? 'currentColor' : 'none'} />
                          <div>
                            <p className="text-xs font-bold">Streak Atual</p>
                            <p className="text-[9px] text-stone-400">dias consecutivos</p>
                          </div>
                        </div>
                        <span className={`text-xl font-black ${streakActive ? 'text-orange-500' : 'text-stone-300'}`}>
                          {stats?.streak_count ?? 0}
                        </span>
                      </div>

                      {/* Stat cards */}
                      {[
                        { icon: <BookMarked size={16} className="text-stone-400" />, label: 'Páginas lidas', value: stats?.total_pages ?? 0, unit: 'págs' },
                        { icon: <Zap size={16} className="text-stone-400" />, label: 'Turbo Reader', value: stats?.turbo_uses ?? 0, unit: 'sessões' },
                      ].map(({ icon, label, value, unit }) => (
                        <div key={label} className="bg-stone-50 rounded-2xl p-4 flex items-center justify-between border border-stone-100">
                          <div className="flex items-center gap-3">
                            {icon}
                            <p className="text-xs font-bold">{label}</p>
                          </div>
                          <div className="text-right">
                            <span className="text-base font-black">{value}</span>
                            <span className="text-[9px] text-stone-400 ml-1">{unit}</span>
                          </div>
                        </div>
                      ))}

                      {/* Meta semanal */}
                      <div className="bg-stone-50 rounded-2xl p-4 border border-stone-100">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <Target size={16} className="text-stone-400" />
                            <div>
                              <p className="text-xs font-bold">Meta Semanal</p>
                              <p className="text-[9px] text-stone-400">{stats?.weekly_pages ?? 0} / {stats?.weekly_goal ?? 50} páginas</p>
                            </div>
                          </div>
                          <span className="text-base font-black text-stone-800">{weeklyPercent}%</span>
                        </div>
                        <div className="h-1.5 bg-stone-200 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${weeklyPercent}%` }}
                            transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
                            className={`h-full rounded-full ${weeklyPercent >= 100 ? 'bg-green-500' : 'bg-[#1A1A1A]'}`}
                          />
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div key="badges" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-2">
                      <p className="text-[9px] font-black uppercase text-stone-300 tracking-widest mb-4">
                        {unlockedBadgeIds.length} / {BADGE_CATALOG.length} desbloqueados
                      </p>
                      {BADGE_CATALOG.map((badge) => {
                        const unlocked = unlockedBadgeIds.includes(badge.id);
                        return (
                          <motion.div
                            key={badge.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                              unlocked
                                ? 'bg-white border-stone-100 shadow-sm'
                                : 'bg-stone-50/50 border-stone-100/50'
                            }`}
                          >
                            <span className={`text-xl ${unlocked ? '' : 'grayscale opacity-30'}`}>{badge.icon}</span>
                            <div className="flex-1 min-w-0">
                              <p className={`text-[11px] font-bold ${unlocked ? 'text-[#1A1A1A]' : 'text-stone-400'}`}>{badge.label}</p>
                              <p className="text-[9px] text-stone-400 truncate">{badge.description}</p>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {unlocked ? (
                                <span className="text-[9px] font-black text-amber-500">+{badge.xpReward} xp</span>
                              ) : (
                                <Lock size={11} className="text-stone-300" />
                              )}
                            </div>
                          </motion.div>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Footer do drawer */}
              <div className="px-6 py-5 border-t border-stone-100 space-y-2">
                <button className="w-full flex items-center justify-between py-3 text-stone-500 text-xs font-bold">
                  <div className="flex items-center gap-2"><Settings size={15} />Ajustes</div>
                  <ChevronRight size={14} className="text-stone-300" />
                </button>
                <button onClick={handleLogout} className="w-full flex items-center gap-2 py-3 text-red-400 text-xs font-bold">
                  <LogOut size={15} />Sair do App
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── TOAST DE NOVO BADGE ── */}
      <AnimatePresence>
        {newBadge && (
          <motion.div
            initial={{ opacity: 0, y: 80, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="fixed bottom-28 left-1/2 -translate-x-1/2 z-[100] bg-[#1A1A1A] text-white rounded-2xl px-5 py-4 flex items-center gap-3 shadow-2xl shadow-black/20 min-w-[220px]"
          >
            <span className="text-2xl">{newBadge.icon}</span>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-stone-400 mb-0.5">Conquista desbloqueada</p>
              <p className="text-sm font-bold">{newBadge.label}</p>
              <p className="text-[10px] text-amber-400 font-black">+{newBadge.xpReward} XP</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
