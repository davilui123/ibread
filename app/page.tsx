"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';
import {
  ensureUserStats,
  syncUnlockedBadges,
  type Badge,
  type UserStats,
} from '@/lib/gamification';
import type { Book } from '@/lib/types';
import AuthScreen from '@/components/AuthScreen';
import HomeView from '@/components/HomeView';
import LibraryView from '@/components/LibraryView';
import NotesView from '@/components/NotesView';
import ProgressView from '@/components/ProgressView';
import BookUpload from '@/components/BookUpload';
import { AnimatePresence, motion } from 'framer-motion';
import { Home as HomeIcon, Library, Highlighter, Target, Loader2 } from 'lucide-react';

type MainTab = 'home' | 'library' | 'notes' | 'progress';

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<MainTab>('home');

  const [books, setBooks] = useState<Book[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [unlockedBadgeIds, setUnlockedBadgeIds] = useState<string[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [statsLoaded, setStatsLoaded] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [newBadge, setNewBadge] = useState<Badge | null>(null);

  const checkingBadgesRef = useRef(false);

  // Monitora sessão Auth
  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setUser(session?.user ?? null);
      setAuthLoading(false);
      if (!session) {
        setBooks([]);
        setStats(null);
        setUnlockedBadgeIds([]);
        setStatsLoaded(false);
        setActiveTab('home');
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const loadUserData = useCallback(async (uid: string) => {
    setDataLoading(true);
    try {
      const [booksRes, loadedStats, badgeRes] = await Promise.all([
        supabase
          .from('books')
          .select('*')
          .eq('user_id', uid)
          .order('updated_at', { ascending: false }),
        ensureUserStats(supabase, uid),
        supabase.from('user_badges').select('badge_id').eq('user_id', uid),
      ]);

      if (!booksRes.error) setBooks((booksRes.data as Book[]) || []);
      setUnlockedBadgeIds(badgeRes.data?.map((b: { badge_id: string }) => b.badge_id) ?? []);
      if (loadedStats) setStats(loadedStats);
      setStatsLoaded(true);
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.id) {
      loadUserData(user.id);
    }
  }, [user?.id, loadUserData]);

  // Verifica conquistas após stats + badges iniciais carregarem
  useEffect(() => {
    if (!user?.id || !statsLoaded || !stats || checkingBadgesRef.current) return;

    let cancelled = false;
    const runBadgeSync = async () => {
      checkingBadgesRef.current = true;
      try {
        const result = await syncUnlockedBadges(
          supabase,
          user.id,
          stats,
          unlockedBadgeIds,
          books.length
        );
        if (cancelled) return;
        if (result.newlyUnlocked.length > 0) {
          setUnlockedBadgeIds(result.updatedBadgeIds);
          setStats(result.updatedStats);
          setNewBadge(result.newlyUnlocked[0]);
          setTimeout(() => setNewBadge(null), 3500);
        }
      } finally {
        checkingBadgesRef.current = false;
      }
    };

    runBadgeSync();
    return () => {
      cancelled = true;
    };
  }, [user?.id, statsLoaded, stats, unlockedBadgeIds, books.length]);

  const existingCollections = useMemo(() => {
    const set = new Set<string>();
    books.forEach((b) => {
      if (b.category?.trim()) set.add(b.category.trim());
    });
    return Array.from(set);
  }, [books]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F8F9F7] flex items-center justify-center">
        <Loader2 className="animate-spin text-stone-300" size={32} />
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <div className="min-h-screen bg-[#F8F9F7]">
      {dataLoading && books.length === 0 ? (
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="animate-spin text-stone-300" size={32} />
        </div>
      ) : (
        <>
          {activeTab === 'home' && (
            <HomeView
              user={user}
              books={books}
              stats={stats}
              onOpenProgress={() => setActiveTab('progress')}
              onOpenLibrary={() => setActiveTab('library')}
              onOpenUpload={() => setIsUploadOpen(true)}
            />
          )}

          {activeTab === 'library' && (
            <LibraryView
              books={books}
              onBooksChange={setBooks}
              onOpenUpload={() => setIsUploadOpen(true)}
            />
          )}

          {activeTab === 'notes' && (
            <NotesView userId={user.id} books={books} />
          )}

          {activeTab === 'progress' && (
            <ProgressView
              user={user}
              books={books}
              stats={stats}
              unlockedBadgeIds={unlockedBadgeIds}
              onStatsUpdated={setStats}
            />
          )}
        </>
      )}

      {/* ── MODAL UPLOAD ── */}
      <AnimatePresence>
        {isUploadOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsUploadOpen(false)}
            className="fixed inset-0 bg-black/30 backdrop-blur-xs z-[110] flex items-center justify-center p-4"
          >
            <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md flex justify-center">
              <BookUpload
                user={user}
                existingCollections={existingCollections}
                onClose={() => setIsUploadOpen(false)}
                onSuccess={() => {
                  setIsUploadOpen(false);
                  loadUserData(user.id);
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── TOAST DE CONQUISTA ── */}
      <AnimatePresence>
        {newBadge && (
          <motion.div
            initial={{ opacity: 0, y: 80, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="fixed bottom-28 left-1/2 -translate-x-1/2 z-[120] bg-[#1A1A1A] text-white rounded-2xl px-5 py-4 flex items-center gap-3 shadow-2xl shadow-black/25 min-w-[220px]"
          >
            <span className="text-2xl">{newBadge.icon}</span>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-stone-400 mb-0.5">
                Conquista desbloqueada
              </p>
              <p className="text-sm font-bold">{newBadge.label}</p>
              <p className="text-[10px] text-amber-400 font-black">+{newBadge.xpReward} XP</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── BARRA INFERIOR FLUTUANTE (4 ABAS ESTILO APPLE BOOKS) ── */}
      <nav
        aria-label="Navegação principal"
        className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[100] bg-white/90 backdrop-blur-xl border border-stone-200/70 shadow-[0_16px_40px_rgba(0,0,0,0.10)] rounded-full p-1.5 flex items-center gap-1 max-w-[calc(100%-2rem)]"
      >
        {([
          { id: 'home', label: 'Início', icon: HomeIcon },
          { id: 'library', label: 'Biblioteca', icon: Library },
          { id: 'notes', label: 'Notas', icon: Highlighter },
          { id: 'progress', label: 'Progresso', icon: Target },
        ] as const).map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative px-4 py-2 rounded-full flex flex-col items-center justify-center gap-0.5 transition-all min-w-[72px] ${
                active ? 'text-[#1A1A1A]' : 'text-stone-400 hover:text-stone-600'
              }`}
            >
              {active && (
                <motion.span
                  layoutId="bottom-nav-pill"
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                  className="absolute inset-0 bg-stone-100 rounded-full -z-10"
                />
              )}
              <Icon size={18} strokeWidth={active ? 2.2 : 1.75} />
              <span className={`text-[9px] tracking-tight ${active ? 'font-bold' : 'font-medium'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
