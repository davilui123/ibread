import type { SupabaseClient } from '@supabase/supabase-js';

export interface UserStats {
  user_id: string;
  streak_count: number;
  last_read_date: string | null;
  xp: number;
  level: number;
  total_pages: number;
  total_minutes?: number;
  weekly_goal: number;
  weekly_pages: number;
  week_start: string | null;
}

export interface BadgeContext {
  totalBooks: number;
}

export interface Badge {
  id: string;
  label: string;
  description: string;
  icon: string;
  xpReward: number;
  check: (stats: UserStats, ctx: BadgeContext) => boolean;
}

export const XP_PER_PAGE = 2;

export const BADGE_CATALOG: Badge[] = [
  {
    id: 'first_book',
    label: 'Primeira Página',
    description: 'Adicionou o primeiro livro à estante',
    icon: '📖',
    xpReward: 50,
    check: (_s, ctx) => ctx.totalBooks > 0,
  },
  {
    id: 'collector_5',
    label: 'Colecionador',
    description: 'Tem 5 livros na estante',
    icon: '🗂️',
    xpReward: 120,
    check: (_s, ctx) => ctx.totalBooks >= 5,
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
    id: 'goal_week',
    label: 'Meta Cumprida',
    description: 'Atingiu a meta semanal de páginas',
    icon: '🎯',
    xpReward: 100,
    check: (s) => s.weekly_goal > 0 && s.weekly_pages >= s.weekly_goal,
  },
];

// ─── Datas Locais ─────────────────────────────────────────────────────────────

export const getLocalDateString = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getYesterdayDateString = (now: Date = new Date()): string => {
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  return getLocalDateString(yesterday);
};

const parseYmd = (ymd: string): Date => {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

export const isNewWeekStarted = (weekStart: string | null | undefined, now: Date = new Date()): boolean => {
  if (!weekStart) return true;
  const start = parseYmd(weekStart);
  const today = parseYmd(getLocalDateString(now));
  const diffDays = (today.getTime() - start.getTime()) / 86400000;
  return diffDays >= 7;
};

export const isStreakActiveForDate = (lastReadDate: string | null | undefined, now: Date = new Date()): boolean => {
  if (!lastReadDate) return false;
  const today = getLocalDateString(now);
  const yesterday = getYesterdayDateString(now);
  return lastReadDate === today || lastReadDate === yesterday;
};

// ─── XP / Níveis ──────────────────────────────────────────────────────────────

export const xpForLevel = (level: number): number => Math.floor(100 * Math.pow(level, 1.6));

export const totalXpForLevel = (level: number): number => {
  let total = 0;
  for (let i = 1; i < level; i++) total += xpForLevel(i);
  return total;
};

export const getLevelFromXp = (xp: number): number => {
  let level = 1;
  while (xp >= totalXpForLevel(level + 1)) level++;
  return level;
};

export const xpProgressInLevel = (xp: number, level: number) => {
  const start = totalXpForLevel(level);
  const end = totalXpForLevel(level + 1);
  return { current: Math.max(0, xp - start), needed: Math.max(1, end - start) };
};

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

export const getLevelTitle = (level: number): string =>
  LEVEL_TITLES[Math.min(level, 10)] ?? 'Lendário';

// ─── Operações no Supabase ────────────────────────────────────────────────────

export async function ensureUserStats(
  supabase: SupabaseClient,
  userId: string
): Promise<UserStats | null> {
  const today = getLocalDateString();

  const { data: existing, error: fetchError } = await supabase
    .from('user_stats')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (fetchError) {
    console.error('Erro ao buscar user_stats:', fetchError);
    return null;
  }

  if (!existing) {
    const initialRow: UserStats = {
      user_id: userId,
      streak_count: 0,
      last_read_date: null,
      xp: 0,
      level: 1,
      total_pages: 0,
      weekly_goal: 50,
      weekly_pages: 0,
      week_start: today,
    };

    const { data: inserted, error: insertError } = await supabase
      .from('user_stats')
      .insert(initialRow)
      .select()
      .single();

    if (insertError) {
      console.error('Erro ao criar user_stats:', insertError);
      return null;
    }
    return inserted as UserStats;
  }

  const stats = existing as UserStats;
  const updates: Partial<UserStats> = {};

  const computedLevel = getLevelFromXp(stats.xp ?? 0);
  if (computedLevel !== stats.level) {
    updates.level = computedLevel;
  }

  if (isNewWeekStarted(stats.week_start)) {
    updates.weekly_pages = 0;
    updates.week_start = today;
  }

  if (stats.streak_count > 0 && !isStreakActiveForDate(stats.last_read_date)) {
    updates.streak_count = 0;
  }

  if (Object.keys(updates).length > 0) {
    const { data: updated } = await supabase
      .from('user_stats')
      .update(updates)
      .eq('user_id', userId)
      .select()
      .single();

    if (updated) return updated as UserStats;
    return { ...stats, ...updates };
  }

  return stats;
}

export async function recordDailyStreak(
  supabase: SupabaseClient,
  userId: string
): Promise<{ updated: boolean; newStreak: number }> {
  const stats = await ensureUserStats(supabase, userId);
  if (!stats) return { updated: false, newStreak: 0 };

  const today = getLocalDateString();
  if (stats.last_read_date === today) {
    return { updated: false, newStreak: stats.streak_count };
  }

  const yesterday = getYesterdayDateString();
  const newStreak = stats.last_read_date === yesterday ? (stats.streak_count ?? 0) + 1 : 1;

  const { error } = await supabase
    .from('user_stats')
    .update({ streak_count: newStreak, last_read_date: today })
    .eq('user_id', userId);

  if (error) {
    console.error('Erro ao atualizar streak:', error);
    return { updated: false, newStreak: stats.streak_count };
  }

  return { updated: true, newStreak };
}

export async function awardReadingXp(
  supabase: SupabaseClient,
  userId: string,
  xpAmount: number
): Promise<{ newLevel: number; leveledUp: boolean } | null> {
  if (xpAmount <= 0) return null;

  const stats = await ensureUserStats(supabase, userId);
  if (!stats) return null;

  const pagesRead = Math.floor(xpAmount / XP_PER_PAGE);
  const newXp = (stats.xp ?? 0) + xpAmount;
  const prevLevel = stats.level ?? 1;
  const newLevel = getLevelFromXp(newXp);
  const newTotalPages = (stats.total_pages ?? 0) + pagesRead;

  const newWeek = isNewWeekStarted(stats.week_start);
  const newWeeklyPages = newWeek ? pagesRead : (stats.weekly_pages ?? 0) + pagesRead;

  const { error } = await supabase
    .from('user_stats')
    .update({
      xp: newXp,
      level: newLevel,
      total_pages: newTotalPages,
      weekly_pages: newWeeklyPages,
      ...(newWeek ? { week_start: getLocalDateString() } : {}),
    })
    .eq('user_id', userId);

  if (error) {
    console.error('Erro ao salvar XP:', error);
    return null;
  }

  return { newLevel, leveledUp: newLevel > prevLevel };
}

export async function syncUnlockedBadges(
  supabase: SupabaseClient,
  userId: string,
  stats: UserStats,
  unlockedBadgeIds: string[],
  totalBooks: number
): Promise<{
  newlyUnlocked: Badge[];
  updatedStats: UserStats;
  updatedBadgeIds: string[];
}> {
  const eligible = BADGE_CATALOG.filter(
    (badge) => !unlockedBadgeIds.includes(badge.id) && badge.check(stats, { totalBooks })
  );

  if (eligible.length === 0) {
    return { newlyUnlocked: [], updatedStats: stats, updatedBadgeIds: unlockedBadgeIds };
  }

  const newlyUnlocked: Badge[] = [];
  let bonusXp = 0;

  for (const badge of eligible) {
    const { error } = await supabase.from('user_badges').insert({
      user_id: userId,
      badge_id: badge.id,
    });

    if (error) {
      // 23505 = unique_violation (badge já existe no banco)
      if (error.code === '23505') {
        if (!unlockedBadgeIds.includes(badge.id)) {
          unlockedBadgeIds = [...unlockedBadgeIds, badge.id];
        }
        continue;
      }
      console.error(`Erro ao salvar badge ${badge.id}:`, error);
      continue;
    }

    newlyUnlocked.push(badge);
    bonusXp += badge.xpReward;
  }

  const updatedBadgeIds = Array.from(
    new Set([...unlockedBadgeIds, ...newlyUnlocked.map((b) => b.id)])
  );

  if (bonusXp === 0) {
    return { newlyUnlocked: [], updatedStats: stats, updatedBadgeIds };
  }

  const newXp = (stats.xp ?? 0) + bonusXp;
  const newLevel = getLevelFromXp(newXp);

  const { error: statsError } = await supabase
    .from('user_stats')
    .update({ xp: newXp, level: newLevel })
    .eq('user_id', userId);

  if (statsError) {
    console.error('Erro ao creditar XP de badges:', statsError);
  }

  return {
    newlyUnlocked,
    updatedStats: { ...stats, xp: newXp, level: newLevel },
    updatedBadgeIds,
  };
}

export async function updateWeeklyGoal(
  supabase: SupabaseClient,
  userId: string,
  weeklyGoal: number
): Promise<UserStats | null> {
  const clamped = Math.max(5, Math.min(2000, Math.round(weeklyGoal)));
  const { data, error } = await supabase
    .from('user_stats')
    .update({ weekly_goal: clamped })
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    console.error('Erro ao atualizar meta semanal:', error);
    return null;
  }

  return data as UserStats;
}

