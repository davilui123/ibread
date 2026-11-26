"use client";

import type { User as SupabaseUser } from '@supabase/supabase-js';
import { getBookProgressPercent, type Book } from '@/lib/types';
import { isStreakActiveForDate, type UserStats } from '@/lib/gamification';
import { motion } from 'framer-motion';
import {
  Play, BookMarked, Flame, User, ChevronRight, Plus, CheckCircle2, BookOpen
} from 'lucide-react';
import Link from 'next/link';

interface HomeViewProps {
  user: SupabaseUser;
  books: Book[];
  stats: UserStats | null;
  onOpenProgress: () => void;
  onOpenLibrary: () => void;
  onOpenUpload: () => void;
}

export default function HomeView({
  user,
  books,
  stats,
  onOpenProgress,
  onOpenLibrary,
  onOpenUpload,
}: HomeViewProps) {
  const weeklyGoal = stats?.weekly_goal || 50;
  const weeklyPages = stats?.weekly_pages ?? 0;
  const weeklyPercent = Math.min(100, Math.round((weeklyPages / weeklyGoal) * 100));
  const streakCount =
    stats && isStreakActiveForDate(stats.last_read_date) ? (stats.streak_count ?? 0) : 0;
  const goalAchieved = weeklyPages >= weeklyGoal;

  // Anel de progresso estilo Apple Books
  const ringRadius = 14;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringDashOffset = ringCircumference * (1 - weeklyPercent / 100);

  // Livro principal: o mais recente com status 'lendo' (ou o mais recente aberto)
  const readingBooks = books.filter((b) => !b.status || b.status === 'lendo');
  const currentBook = readingBooks[0] ?? books[0] ?? null;
  const recentlyOpened = books.filter((b) => b.id !== currentBook?.id).slice(0, 10);
  const wantToReadBooks = books.filter((b) => b.status === 'quero_ler');

  const displayName =
    (user.user_metadata?.full_name as string | undefined)?.trim() ||
    user.email?.split('@')[0] ||
    'Leitor';

  return (
    <div className="min-h-screen bg-[#F8F9F7] text-[#1A1A1A] font-sans pb-36">
      <div className="max-w-lg mx-auto px-6 pt-8">
        {/* ── HEADER ESTILO APPLE BOOKS ── */}
        <header className="flex items-start justify-between mb-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-stone-400 mb-1">
              IBRead · {displayName}
            </p>
            <h1
              className="text-4xl leading-none tracking-tight text-[#1A1A1A]"
              style={{ fontFamily: 'var(--font-serif)' }}
            >
              Lendo Agora
            </h1>
            <div className="flex items-center gap-1.5 mt-2">
              {goalAchieved ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                  <CheckCircle2 size={13} />
                  Meta semanal concluída
                </span>
              ) : (
                <span className="text-[11px] font-medium text-stone-400">
                  Meta semanal: {weeklyPages} de {weeklyGoal} págs
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2.5 pt-1">
            {streakCount > 0 && (
              <button
                onClick={onOpenProgress}
                className="flex items-center gap-1 bg-white border border-stone-100 rounded-full px-2.5 py-1.5 shadow-sm text-orange-500"
                title="Sequência de leitura"
              >
                <Flame size={13} fill="currentColor" />
                <span className="text-[11px] font-black">{streakCount}</span>
              </button>
            )}

            {/* Anel de Progresso */}
            <button
              onClick={onOpenProgress}
              className="relative w-9 h-9 rounded-full bg-white border border-stone-100 shadow-sm flex items-center justify-center"
              aria-label="Ver progresso semanal"
            >
              <svg className="w-9 h-9 -rotate-90" viewBox="0 0 36 36">
                <circle
                  cx="18"
                  cy="18"
                  r={ringRadius}
                  fill="none"
                  stroke="#E7E5E4"
                  strokeWidth="2.5"
                />
                <circle
                  cx="18"
                  cy="18"
                  r={ringRadius}
                  fill="none"
                  stroke="#1A1A1A"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeDasharray={ringCircumference}
                  strokeDashoffset={ringDashOffset}
                />
              </svg>
              <span className="absolute text-[9px] font-black text-[#1A1A1A]">
                {weeklyPercent}%
              </span>
            </button>

            <button
              onClick={onOpenProgress}
              className="w-9 h-9 rounded-full bg-[#1A1A1A] text-white flex items-center justify-center shadow-md shadow-black/10"
              aria-label="Abrir perfil"
            >
              <User size={15} />
            </button>
          </div>
        </header>

        {books.length === 0 ? (
          <div className="bg-white border border-stone-100 rounded-3xl p-10 text-center shadow-[0_20px_40px_rgba(0,0,0,0.04)] mt-6">
            <div className="w-14 h-14 rounded-2xl bg-stone-50 border border-stone-100 flex items-center justify-center mx-auto mb-4">
              <BookOpen size={24} className="text-stone-400" />
            </div>
            <h2
              className="text-2xl mb-2"
              style={{ fontFamily: 'var(--font-serif)' }}
            >
              Comece sua estante
            </h2>
            <p className="text-xs text-stone-400 leading-relaxed max-w-xs mx-auto mb-6">
              Envie seu primeiro arquivo ePUB ou PDF para retomar a leitura exatamente de onde parou.
            </p>
            <button
              onClick={onOpenUpload}
              className="inline-flex items-center gap-2 bg-[#1A1A1A] text-white px-5 py-3 rounded-full text-[11px] font-bold uppercase tracking-[0.18em] shadow-lg shadow-black/10 active:scale-95 transition-transform"
            >
              <Plus size={14} />
              Adicionar livro
            </button>
          </div>
        ) : (
          <div className="space-y-9">
            {/* ── CONTINUAR (DESTAQUE) ── */}
            {currentBook && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2
                    className="text-xl text-[#1A1A1A]"
                    style={{ fontFamily: 'var(--font-serif)' }}
                  >
                    Continuar
                  </h2>
                  <button
                    onClick={onOpenUpload}
                    className="text-[10px] font-bold uppercase tracking-widest text-stone-400 hover:text-[#1A1A1A] inline-flex items-center gap-1 transition-colors"
                  >
                    <Plus size={12} />
                    Adicionar
                  </button>
                </div>

                <Link href={`/reader/${currentBook.id}`}>
                  <motion.div
                    whileTap={{ scale: 0.985 }}
                    className="bg-white rounded-3xl p-4 border border-stone-100 shadow-[0_20px_45px_rgba(0,0,0,0.05)] flex items-center gap-4 group"
                  >
                    <div className="w-24 h-36 rounded-2xl overflow-hidden shadow-md bg-stone-100 flex-shrink-0 flex items-center justify-center">
                      {currentBook.cover_url ? (
                        <img
                          src={currentBook.cover_url}
                          alt={currentBook.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <BookMarked size={26} className="text-stone-300" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0 py-1">
                      <span className="inline-block text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-stone-100 text-stone-500 mb-2">
                        {currentBook.pdf_url?.toLowerCase().endsWith('.pdf') ? 'PDF' : 'ePUB'}
                      </span>
                      <h3 className="text-base font-bold leading-snug text-[#1A1A1A] line-clamp-2">
                        {currentBook.title}
                      </h3>
                      <p className="text-xs text-stone-400 font-medium truncate mt-0.5 mb-4">
                        {currentBook.author}
                      </p>

                      <div className="space-y-1.5">
                        <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#1A1A1A] rounded-full transition-all duration-700"
                            style={{ width: `${Math.max(getBookProgressPercent(currentBook), 2)}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[10px] font-bold text-stone-400">
                          <span>{getBookProgressPercent(currentBook)}% lido</span>
                          {currentBook.total_pages > 0 && (
                            <span>
                              pág. {currentBook.current_page || 1} / {currentBook.total_pages}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="w-11 h-11 rounded-full bg-[#1A1A1A] text-white flex items-center justify-center shadow-lg shadow-black/15 group-hover:scale-105 transition-transform flex-shrink-0">
                      <Play size={15} fill="currentColor" className="ml-0.5" />
                    </div>
                  </motion.div>
                </Link>
              </section>
            )}

            {/* ── ABERTOS RECENTEMENTE ── */}
            {recentlyOpened.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2
                    className="text-xl text-[#1A1A1A]"
                    style={{ fontFamily: 'var(--font-serif)' }}
                  >
                    Abertos Recentemente
                  </h2>
                  <button
                    onClick={onOpenLibrary}
                    className="text-[11px] font-semibold text-stone-400 hover:text-[#1A1A1A] inline-flex items-center gap-0.5 transition-colors"
                  >
                    Ver todos
                    <ChevronRight size={14} />
                  </button>
                </div>

                <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2 -mx-6 px-6">
                  {recentlyOpened.map((book) => {
                    const pct = getBookProgressPercent(book);
                    return (
                      <Link
                        key={book.id}
                        href={`/reader/${book.id}`}
                        className="w-28 flex-shrink-0 group"
                      >
                        <motion.div
                          whileTap={{ scale: 0.96 }}
                          className="relative aspect-[2/3] rounded-xl overflow-hidden bg-stone-100 shadow-[0_10px_24px_rgba(0,0,0,0.08)] border border-white mb-2 flex items-center justify-center"
                        >
                          {book.cover_url ? (
                            <img
                              src={book.cover_url}
                              alt={book.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <BookMarked size={22} className="text-stone-300" />
                          )}
                          <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/10">
                            <div
                              className="h-full bg-white"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </motion.div>
                        <p className="text-[11px] font-bold leading-tight truncate text-[#1A1A1A]">
                          {book.title}
                        </p>
                        <p className="text-[10px] font-semibold text-stone-400 mt-0.5">
                          {pct}%
                        </p>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ── QUERO LER (ESTILO APPLE BOOKS WANT TO READ) ── */}
            {wantToReadBooks.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-1">
                  <button
                    onClick={onOpenLibrary}
                    className="inline-flex items-center gap-1 group"
                  >
                    <h2
                      className="text-xl text-[#1A1A1A]"
                      style={{ fontFamily: 'var(--font-serif)' }}
                    >
                      Quero Ler
                    </h2>
                    <ChevronRight size={16} className="text-stone-400 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </div>
                <p className="text-xs text-stone-400 mb-4">
                  Livros reservados para suas próximas leituras.
                </p>

                <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2 -mx-6 px-6">
                  {wantToReadBooks.map((book) => (
                    <Link
                      key={book.id}
                      href={`/reader/${book.id}`}
                      className="w-32 flex-shrink-0"
                    >
                      <motion.div
                        whileTap={{ scale: 0.96 }}
                        className="aspect-[2/3] rounded-xl overflow-hidden bg-stone-100 shadow-[0_10px_24px_rgba(0,0,0,0.08)] border border-white mb-2 flex items-center justify-center"
                      >
                        {book.cover_url ? (
                          <img
                            src={book.cover_url}
                            alt={book.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <BookMarked size={24} className="text-stone-300" />
                        )}
                      </motion.div>
                      <p className="text-[11px] font-bold truncate text-[#1A1A1A]">
                        {book.title}
                      </p>
                      <p className="text-[10px] text-stone-400 truncate">
                        {book.author}
                      </p>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
