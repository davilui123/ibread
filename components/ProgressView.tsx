"use client";

import { useState } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';
import type { Book } from '@/lib/types';
import {
  BADGE_CATALOG,
  getLevelTitle,
  isStreakActiveForDate,
  updateWeeklyGoal,
  xpProgressInLevel,
  type UserStats,
} from '@/lib/gamification';
import { motion } from 'framer-motion';
import {
  Flame, Target, BookMarked, BookOpen, CheckCircle2, Lock, LogOut, User, Check
} from 'lucide-react';

interface ProgressViewProps {
  user: SupabaseUser;
  books: Book[];
  stats: UserStats | null;
  unlockedBadgeIds: string[];
  onStatsUpdated: (stats: UserStats) => void;
}

const GOAL_PRESETS = [25, 50, 100, 200];

export default function ProgressView({
  user,
  books,
  stats,
  unlockedBadgeIds,
  onStatsUpdated,
}: ProgressViewProps) {
  const [goalInput, setGoalInput] = useState<string>(String(stats?.weekly_goal ?? 50));
  const [savingGoal, setSavingGoal] = useState(false);
  const [goalSaved, setGoalSaved] = useState(false);

  const level = stats?.level ?? 1;
  const xp = stats?.xp ?? 0;
  const { current: xpInLevel, needed: xpNeeded } = xpProgressInLevel(xp, level);
  const xpPercent = Math.min(Math.round((xpInLevel / xpNeeded) * 100), 100);

  const streakCount =
    stats && isStreakActiveForDate(stats.last_read_date) ? (stats.streak_count ?? 0) : 0;
  const streakActive = streakCount > 0;

  const weeklyGoal = stats?.weekly_goal || 50;
  const weeklyPages = stats?.weekly_pages ?? 0;
  const weeklyPercent = Math.min(100, Math.round((weeklyPages / weeklyGoal) * 100));

  const finishedCount = books.filter((b) => b.status === 'finalizado').length;

  const ringRadius = 38;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringDashOffset = ringCircumference * (1 - weeklyPercent / 100);

  const displayName =
    (user.user_metadata?.full_name as string | undefined)?.trim() ||
    user.email?.split('@')[0] ||
    'Leitor';

  const handleSaveGoal = async (nextGoal: number) => {
    setSavingGoal(true);
    setGoalSaved(false);
    const updated = await updateWeeklyGoal(supabase, user.id, nextGoal);
    setSavingGoal(false);
    if (updated) {
      setGoalInput(String(updated.weekly_goal));
      onStatsUpdated(updated);
      setGoalSaved(true);
      setTimeout(() => setGoalSaved(false), 2000);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="min-h-screen bg-[#F8F9F7] text-[#1A1A1A] font-sans pb-36">
      <div className="max-w-lg mx-auto px-6 pt-8 space-y-7">
        {/* ── HEADER ── */}
        <header className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-stone-400 mb-1">
              Gamificação & Perfil
            </p>
            <h1
              className="text-4xl leading-none tracking-tight"
              style={{ fontFamily: 'var(--font-serif)' }}
            >
              Progresso
            </h1>
          </div>

          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white border border-stone-200/70 text-[11px] font-bold text-red-500 hover:bg-red-50 transition-colors shadow-sm"
          >
            <LogOut size={13} />
            Sair
          </button>
        </header>

        {/* ── CARD PERFIL + NÍVEL + XP ── */}
        <section className="bg-white rounded-3xl p-6 border border-stone-100 shadow-[0_20px_40px_rgba(0,0,0,0.04)]">
          <div className="flex items-center gap-4 mb-5">
            <div className="relative">
              <div className="w-14 h-14 rounded-full bg-stone-100 flex items-center justify-center">
                <User size={22} className="text-stone-500" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-[#1A1A1A] rounded-full flex items-center justify-center border-2 border-white">
                <span className="text-white text-[9px] font-black">{level}</span>
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-bold truncate">{displayName}</h2>
              <p className="text-xs text-stone-400 truncate">{user.email}</p>
              <p className="text-[11px] font-bold text-[#1A1A1A] mt-0.5">
                {getLevelTitle(level)} · {xp} XP acumulados
              </p>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1.5">
              <span>Nível {level} → {level + 1}</span>
              <span>{xpInLevel} / {xpNeeded} XP</span>
            </div>
            <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${xpPercent}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="h-full bg-[#1A1A1A] rounded-full"
              />
            </div>
          </div>
        </section>

        {/* ── META SEMANAL (ANEL + CONFIGURAÇÃO) ── */}
        <section className="bg-white rounded-3xl p-6 border border-stone-100 shadow-[0_16px_36px_rgba(0,0,0,0.04)]">
          <div className="flex items-center gap-5 mb-5">
            <div className="relative w-24 h-24 flex-shrink-0 flex items-center justify-center">
              <svg className="w-24 h-24 -rotate-90" viewBox="0 0 96 96">
                <circle
                  cx="48"
                  cy="48"
                  r={ringRadius}
                  fill="none"
                  stroke="#F5F5F4"
                  strokeWidth="8"
                />
                <circle
                  cx="48"
                  cy="48"
                  r={ringRadius}
                  fill="none"
                  stroke={weeklyPercent >= 100 ? '#10B981' : '#1A1A1A'}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={ringCircumference}
                  strokeDashoffset={ringDashOffset}
                />
              </svg>
              <div className="absolute text-center">
                <p className="text-lg font-black leading-none">{weeklyPercent}%</p>
                <p className="text-[9px] font-bold text-stone-400 uppercase mt-0.5">Meta</p>
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">
                <Target size={12} />
                Meta Semanal
              </div>
              <p className="text-xl font-black text-[#1A1A1A]">
                {weeklyPages} <span className="text-xs font-semibold text-stone-400">/ {weeklyGoal} págs</span>
              </p>
              <p className="text-xs text-stone-400 mt-1">
                {weeklyPercent >= 100
                  ? 'Meta semanal batida! Continue mantendo o ritmo.'
                  : `Faltam ${Math.max(0, weeklyGoal - weeklyPages)} páginas esta semana.`}
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-stone-100">
            <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-2.5">
              Ajustar Meta (páginas/semana)
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {GOAL_PRESETS.map((preset) => (
                <button
                  key={preset}
                  disabled={savingGoal}
                  onClick={() => handleSaveGoal(preset)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                    weeklyGoal === preset
                      ? 'bg-[#1A1A1A] text-white'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  {preset}
                </button>
              ))}

              <div className="flex items-center gap-1.5 ml-auto">
                <input
                  type="number"
                  min={5}
                  max={2000}
                  value={goalInput}
                  onChange={(e) => setGoalInput(e.target.value)}
                  className="w-16 bg-stone-50 border border-stone-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-center outline-none focus:border-[#1A1A1A]"
                />
                <button
                  disabled={savingGoal}
                  onClick={() => {
                    const parsed = Number(goalInput);
                    if (Number.isFinite(parsed) && parsed > 0) handleSaveGoal(parsed);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-[#1A1A1A] text-white text-xs font-bold flex items-center gap-1 disabled:opacity-40"
                >
                  {goalSaved ? <Check size={13} /> : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ── ESTATÍSTICAS RÁPIDAS ── */}
        <section className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl p-4 border border-stone-100 shadow-sm">
            <div className="flex items-center gap-2 text-stone-400 mb-2">
              <Flame
                size={16}
                className={streakActive ? 'text-orange-500' : 'text-stone-300'}
                fill={streakActive ? 'currentColor' : 'none'}
              />
              <span className="text-[10px] font-bold uppercase tracking-wider">Streak</span>
            </div>
            <p className={`text-2xl font-black ${streakActive ? 'text-orange-500' : 'text-stone-300'}`}>
              {streakCount} <span className="text-xs font-semibold text-stone-400">dias</span>
            </p>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-stone-100 shadow-sm">
            <div className="flex items-center gap-2 text-stone-400 mb-2">
              <BookMarked size={16} />
              <span className="text-[10px] font-bold uppercase tracking-wider">Páginas</span>
            </div>
            <p className="text-2xl font-black text-[#1A1A1A]">
              {stats?.total_pages ?? 0} <span className="text-xs font-semibold text-stone-400">lidas</span>
            </p>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-stone-100 shadow-sm">
            <div className="flex items-center gap-2 text-stone-400 mb-2">
              <BookOpen size={16} />
              <span className="text-[10px] font-bold uppercase tracking-wider">Acervo</span>
            </div>
            <p className="text-2xl font-black text-[#1A1A1A]">
              {books.length} <span className="text-xs font-semibold text-stone-400">obras</span>
            </p>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-stone-100 shadow-sm">
            <div className="flex items-center gap-2 text-stone-400 mb-2">
              <CheckCircle2 size={16} className="text-emerald-500" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Finalizados</span>
            </div>
            <p className="text-2xl font-black text-[#1A1A1A]">
              {finishedCount} <span className="text-xs font-semibold text-stone-400">livros</span>
            </p>
          </div>
        </section>

        {/* ── CONQUISTAS ── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2
              className="text-xl text-[#1A1A1A]"
              style={{ fontFamily: 'var(--font-serif)' }}
            >
              Conquistas
            </h2>
            <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">
              {unlockedBadgeIds.length} / {BADGE_CATALOG.length}
            </span>
          </div>

          <div className="space-y-2.5">
            {BADGE_CATALOG.map((badge) => {
              const unlocked = unlockedBadgeIds.includes(badge.id);
              return (
                <div
                  key={badge.id}
                  className={`flex items-center gap-3.5 p-3.5 rounded-2xl border transition-all ${
                    unlocked
                      ? 'bg-white border-stone-100 shadow-sm'
                      : 'bg-stone-100/50 border-stone-200/40'
                  }`}
                >
                  <span className={`text-2xl ${unlocked ? '' : 'grayscale opacity-30'}`}>
                    {badge.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-bold ${unlocked ? 'text-[#1A1A1A]' : 'text-stone-400'}`}>
                      {badge.label}
                    </p>
                    <p className="text-[11px] text-stone-400 truncate">{badge.description}</p>
                  </div>
                  <div className="flex-shrink-0">
                    {unlocked ? (
                      <span className="text-[10px] font-black text-amber-500">+{badge.xpReward} XP</span>
                    ) : (
                      <Lock size={13} className="text-stone-300" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
