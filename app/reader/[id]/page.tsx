"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import {
  XP_PER_PAGE,
  awardReadingXp,
  ensureUserStats,
  recordDailyStreak,
  syncUnlockedBadges,
} from '@/lib/gamification';
import {
  HIGHLIGHT_STYLES,
  type Book,
  type BookBookmark,
  type BookHighlight,
  type HighlightColor,
} from '@/lib/types';
import ReaderDrawers, { type TocItem } from '@/components/reader/ReaderDrawers';
import PdfViewer, { type ReaderTheme } from '@/components/reader/PdfViewer';
import {
  ArrowLeft, Bookmark, List, Loader2, StickyNote, X, Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ThemeConfig {
  shell: string;
  chrome: string;
  chromeBorder: string;
  chromeText: string;
  viewer: string;
  swatchBg: string;
  swatchDot: string;
  epubBg: string;
  epubColor: string;
  epubFont: string;
}

const THEMES: Record<ReaderTheme, ThemeConfig> = {
  default: {
    shell:        '#FFFFFF',
    chrome:       'bg-white/92',
    chromeBorder: 'border-stone-200',
    chromeText:   'text-[#0A0A0A]',
    viewer:       'bg-white',
    swatchBg:     'bg-white',
    swatchDot:    'border-blue-500',
    epubBg:       '#FFFFFF',
    epubColor:    '#0A0A0A',
    epubFont:     'Georgia, serif',
  },
  sepia: {
    shell:        '#F4ECD8',
    chrome:       'bg-[#EDE3CC]/92',
    chromeBorder: 'border-[#D0C4A8]',
    chromeText:   'text-[#3D2B1F]',
    viewer:       'bg-[#F4ECD8]',
    swatchBg:     'bg-[#F4ECD8]',
    swatchDot:    'border-orange-500',
    epubBg:       '#F4ECD8',
    epubColor:    '#3D2B1F',
    epubFont:     'Georgia, serif',
  },
  kindle: {
    shell:        '#E4E4E0',
    chrome:       'bg-[#DCDCD8]/92',
    chromeBorder: 'border-[#C4C4C0]',
    chromeText:   'text-[#0A0A0A]',
    viewer:       'bg-[#E4E4E0]',
    swatchBg:     'bg-[#E4E4E0]',
    swatchDot:    'border-stone-500',
    epubBg:       '#E4E4E0',
    epubColor:    '#0A0A0A',
    epubFont:     'Georgia, serif',
  },
  comfort: {
    shell:        '#141414',
    chrome:       'bg-[#1C1C1C]/92',
    chromeBorder: 'border-stone-800',
    chromeText:   'text-[#CCCCCC]',
    viewer:       'bg-[#141414]',
    swatchBg:     'bg-[#141414]',
    swatchDot:    'border-stone-400',
    epubBg:       '#141414',
    epubColor:    '#CCCCCC',
    epubFont:     'Georgia, serif',
  },
};

const THEME_ORDER: ReaderTheme[] = ['default', 'sepia', 'kindle', 'comfort'];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapEpubToc(items: any[], prefix = 'epub'): TocItem[] {
  if (!Array.isArray(items)) return [];
  return items.map((item, idx) => ({
    id: item.id || `${prefix}-${idx}`,
    label: (item.label || `Capítulo ${idx + 1}`).trim(),
    href: item.href,
    subitems: item.subitems ? mapEpubToc(item.subitems, `${prefix}-${idx}`) : [],
  }));
}

function flattenToc(items: TocItem[]): TocItem[] {
  const flat: TocItem[] = [];
  for (const item of items) {
    flat.push(item);
    if (item.subitems?.length) flat.push(...flattenToc(item.subitems));
  }
  return flat;
}

function ReaderContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params?.id as string;
  const queryCfi = searchParams.get('cfi');
  const queryPage = searchParams.get('page');
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [book, setBook] = useState<Book | null>(null);
  const [isEpub, setIsEpub] = useState(false);
  const [pdfPublicUrl, setPdfPublicUrl] = useState<string | null>(null);
  const [loadingReader, setLoading] = useState(true);
  const [readerError, setReaderError] = useState<string | null>(null);
  const [theme, setTheme] = useState<ReaderTheme>('default');
  const [uiVisible, setUiVisible] = useState(true);

  // Leitor
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [currentChapter, setCurrentChapter] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState('Calculando...');
  const [scrubPage, setScrubPage] = useState<number | null>(null);

  // TOC, Marcadores & Destaques
  const [toc, setToc] = useState<TocItem[]>([]);
  const [isNavDrawerOpen, setNavDrawerOpen] = useState(false);
  const [bookmarks, setBookmarks] = useState<BookBookmark[]>([]);
  const [highlights, setHighlights] = useState<BookHighlight[]>([]);

  // Seleção de texto para Highlight / Nota
  const [pendingSelection, setPendingSelection] = useState<{
    text: string;
    cfi: string | null;
  } | null>(null);
  const [noteMode, setNoteMode] = useState(false);
  const [noteInput, setNoteInput] = useState('');
  const [selectedColor, setSelectedColor] = useState<HighlightColor>('amber');

  // Toast
  const [toast, setToast] = useState<{ icon: string; title: string; sub: string } | null>(null);

  // Refs
  const viewerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renditionRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bookInstanceRef = useRef<any>(null);
  const applyThemeRef = useRef<((th: ReaderTheme) => void) | null>(null);
  const themeRef = useRef<ReaderTheme>(theme);
  const currentCfiRef = useRef<string | null>(null);
  const currentPageRef = useRef<number>(1);
  const totalPagesRef = useRef<number>(0);
  const flatTocRef = useRef<TocItem[]>([]);
  const startTimeRef = useRef<number>(Date.now());
  const hasStreakRef = useRef(false);
  const streakTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wakeLockRef = useRef<any>(null);
  const pendingXpRef = useRef(0);
  const xpFlushRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    themeRef.current = theme;
  }, [theme]);

  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  useEffect(() => {
    totalPagesRef.current = totalPages;
  }, [totalPages]);

  const showToast = useCallback((icon: string, title: string, sub: string) => {
    setToast({ icon, title, sub });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 3500);
  }, []);

  // ─── Auth + Dados do livro, marcadores e destaques ────────────────────────

  useEffect(() => {
    let active = true;

    async function loadData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace('/');
        return;
      }
      if (!active || !id) return;
      const uid = session.user.id;
      setUserId(uid);

      const [bookRes, bmRes, hlRes] = await Promise.all([
        supabase.from('books').select('*').eq('id', id).single(),
        supabase
          .from('book_bookmarks')
          .select('*')
          .eq('book_id', id)
          .eq('user_id', uid)
          .order('created_at', { ascending: false }),
        supabase
          .from('book_highlights')
          .select('*')
          .eq('book_id', id)
          .eq('user_id', uid)
          .order('created_at', { ascending: false }),
      ]);

      if (!active) return;
      if (bookRes.error || !bookRes.data) {
        router.replace('/');
        return;
      }

      const loadedBook = bookRes.data as Book;
      setBook(loadedBook);
      const epubFlag = Boolean(loadedBook.pdf_url?.toLowerCase().endsWith('.epub'));
      setIsEpub(epubFlag);

      if (!epubFlag && loadedBook.pdf_url) {
        const { data: { publicUrl } } = supabase.storage
          .from('pdfs')
          .getPublicUrl(loadedBook.pdf_url);
        setPdfPublicUrl(publicUrl);
        const startPage = queryPage ? Number(queryPage) : loadedBook.current_page || 1;
        setCurrentPage(Math.max(1, startPage));
        if (loadedBook.total_pages) setTotalPages(loadedBook.total_pages);
      }

      if (!bmRes.error) setBookmarks((bmRes.data as BookBookmark[]) || []);
      if (!hlRes.error) setHighlights((hlRes.data as BookHighlight[]) || []);
    }

    loadData();
    return () => {
      active = false;
    };
  }, [id, router, queryPage]);

  // ─── Wake Lock ────────────────────────────────────────────────────────────

  useEffect(() => {
    const acquire = async () => {
      if (!('wakeLock' in navigator)) return;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
      } catch {
        // dispositivo negou
      }
    };
    const onVisibility = async () => {
      if (document.visibilityState === 'visible') await acquire();
    };
    acquire();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      wakeLockRef.current?.release();
    };
  }, []);

  // ─── Gamificação: Badges, Streak, XP ──────────────────────────────────────

  const checkBadgesInReader = useCallback(
    async (uid: string) => {
      const [stats, badgeRes, booksCountRes] = await Promise.all([
        ensureUserStats(supabase, uid),
        supabase.from('user_badges').select('badge_id').eq('user_id', uid),
        supabase.from('books').select('id', { count: 'exact', head: true }).eq('user_id', uid),
      ]);

      if (!stats) return;
      const unlockedIds = badgeRes.data?.map((b: { badge_id: string }) => b.badge_id) ?? [];
      const totalBooks = booksCountRes.count ?? 1;

      const { newlyUnlocked } = await syncUnlockedBadges(
        supabase,
        uid,
        stats,
        unlockedIds,
        totalBooks
      );

      if (newlyUnlocked.length > 0) {
        const b = newlyUnlocked[0];
        showToast(b.icon, `Conquista: ${b.label}`, `+${b.xpReward} XP`);
      }
    },
    [showToast]
  );

  const updateStreak = useCallback(async () => {
    if (hasStreakRef.current || !userId) return;
    hasStreakRef.current = true;

    const res = await recordDailyStreak(supabase, userId);
    if (!res.updated) return;

    if (res.newStreak === 1) {
      showToast('🔥', 'Streak iniciado!', '1 dia consecutivo');
    } else {
      showToast('🔥', `Streak: ${res.newStreak} dias!`, 'Incrível consistência');
    }
    await checkBadgesInReader(userId);
  }, [userId, showToast, checkBadgesInReader]);

  const flushXp = useCallback(async () => {
    const amount = pendingXpRef.current;
    if (amount === 0 || !userId) return;
    pendingXpRef.current = 0;

    const result = await awardReadingXp(supabase, userId, amount);
    if (!result) return;

    if (result.leveledUp) {
      showToast('⭐', `Nível ${result.newLevel}!`, 'Você subiu de nível');
    }
    await checkBadgesInReader(userId);
  }, [userId, showToast, checkBadgesInReader]);

  const queueXp = useCallback(() => {
    pendingXpRef.current += XP_PER_PAGE;
    if (xpFlushRef.current) clearTimeout(xpFlushRef.current);
    xpFlushRef.current = setTimeout(flushXp, 3000);
  }, [flushXp]);

  const calcTime = useCallback((current: number, total: number) => {
    const now = Date.now();
    const secs = (now - startTimeRef.current) / 1000;
    startTimeRef.current = now;
    const remaining = total - current;
    if (remaining <= 0) return 'Fim do livro';
    const clampedSecs = secs > 5 && secs < 300 ? secs : 30;
    const mins = Math.ceil((remaining * clampedSecs) / 60);
    if (mins < 1) return 'Menos de 1 min';
    if (mins > 60) return `${Math.floor(mins / 60)}h ${mins % 60}m`;
    return `${mins} min`;
  }, []);

  // ─── Navegação PDF / EPUB ─────────────────────────────────────────────────

  const goToPdfPage = useCallback(
    async (nextPage: number, countXp = true) => {
      const total = totalPagesRef.current;
      if (!total || !book?.id) return;
      const clamped = Math.max(1, Math.min(nextPage, total));
      setCurrentPage(clamped);
      setTimeLeft(calcTime(clamped, total));

      // Atualiza capítulo atual pelo outline
      const matchingToc = [...flatTocRef.current]
        .reverse()
        .find((item) => item.pageNumber && item.pageNumber <= clamped);
      if (matchingToc) setCurrentChapter(matchingToc.label);

      await supabase
        .from('books')
        .update({
          current_page: clamped,
          total_pages: total,
          updated_at: new Date().toISOString(),
        })
        .eq('id', book.id);

      if (countXp) queueXp();
    },
    [book?.id, calcTime, queueXp]
  );

  const goPrev = useCallback(() => {
    if (isEpub) {
      renditionRef.current?.prev();
    } else {
      goToPdfPage(currentPageRef.current - 1);
    }
  }, [isEpub, goToPdfPage]);

  const goNext = useCallback(() => {
    if (isEpub) {
      renditionRef.current?.next();
    } else {
      goToPdfPage(currentPageRef.current + 1);
    }
  }, [isEpub, goToPdfPage]);

  // Atalhos de teclado
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (noteMode || isNavDrawerOpen) return;
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [goNext, goPrev, noteMode, isNavDrawerOpen]);

  // Swipe touch
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || isNavDrawerOpen || noteMode) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = Math.abs(e.changedTouches[0].clientY - (touchStartY.current ?? 0));
    touchStartX.current = null;
    if (dy > 80 || Math.abs(dx) < 50) return;
    if (dx < 0) goNext();
    else goPrev();
  };

  // ─── Inicialização do EPUB ────────────────────────────────────────────────

  const bookId = book?.id;
  const bookPdfUrl = book?.pdf_url;
  const initialPage = book?.current_page ?? 0;
  const initialCfi = book?.last_cfi ?? null;

  useEffect(() => {
    if (!bookId || !bookPdfUrl || !userId || !isEpub) return;
    if (!viewerRef.current) return;

    let mounted = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let localBook: any = null;

    async function initEpub() {
      try {
        const ePubModule = await import('epubjs');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ePub = (ePubModule as any).default || ePubModule;
        const { data: { publicUrl } } = supabase.storage.from('pdfs').getPublicUrl(bookPdfUrl!);
        const bi = ePub(publicUrl);
        localBook = bi;
        bookInstanceRef.current = bi;

        const rendition = bi.renderTo(viewerRef.current, {
          width: '100%',
          height: '100%',
          flow: 'paginated',
        });
        renditionRef.current = rendition;

        // Timer de streak começa ao abrir o livro
        if (streakTimerRef.current) clearTimeout(streakTimerRef.current);
        streakTimerRef.current = setTimeout(() => {
          if (mounted) updateStreak();
        }, 30000);

        rendition.on('click', () => {
          setUiVisible((v) => !v);
        });

        // Seleção de texto -> Destaques & Notas
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rendition.on('selected', (cfiRange: string, contents: any) => {
          const text = contents?.window?.getSelection?.()?.toString?.()?.trim() || '';
          if (text.length > 2) {
            setPendingSelection({ text, cfi: cfiRange });
            setNoteMode(false);
            setNoteInput('');
          }
        });

        const applyEpubTheme = (th: ReaderTheme) => {
          const cfg = THEMES[th];
          rendition.themes.override('body', {
            background: `${cfg.epubBg} !important`,
            color: `${cfg.epubColor} !important`,
            'font-family': `${cfg.epubFont} !important`,
            padding: '40px !important',
            'line-height': '1.8 !important',
          });
        };

        rendition.themes.default({
          body: { padding: '40px !important', 'line-height': '1.8 !important' },
        });
        applyEpubTheme(themeRef.current);
        applyThemeRef.current = applyEpubTheme;

        await bi.ready;

        // Carrega sumário (TOC)
        try {
          const nav = await bi.loaded.navigation;
          if (mounted && nav?.toc) {
            const mappedToc = mapEpubToc(nav.toc);
            setToc(mappedToc);
            flatTocRef.current = flattenToc(mappedToc);
          }
        } catch {
          // sem TOC embutido
        }

        await bi.locations.generate(1024);
        if (!mounted) return;

        const total = bi.locations.length();
        setTotalPages(total);

        // Posição exata por CFI (?cfi= -> book.last_cfi -> fallback por página)
        const targetDisplay =
          queryCfi ||
          initialCfi ||
          (initialPage > 0 && total > 0
            ? bi.locations.cfiFromPercentage(Math.min(0.999, initialPage / total))
            : undefined);

        await rendition.display(targetDisplay);

        // Restaura destaques visuais salvos
        highlights.forEach((hl) => {
          if (!hl.cfi) return;
          try {
            const fill = HIGHLIGHT_STYLES[hl.color]?.epubFill || '#FCD34D';
            rendition.annotations.add('highlight', hl.cfi, {}, undefined, `hl-${hl.id}`, {
              fill,
              'fill-opacity': '0.35',
              'mix-blend-mode': 'multiply',
            });
          } catch {
            // CFI inválido para este arquivo
          }
        });

        if (mounted) setLoading(false);

        let isFirstRelocated = true;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rendition.on('relocated', async (location: any) => {
          if (!mounted) return;

          const cfi = location?.start?.cfi || null;
          currentCfiRef.current = cfi;

          // Identifica capítulo atual
          const startHref = location?.start?.href?.split('#')[0];
          if (startHref && flatTocRef.current.length > 0) {
            const match = flatTocRef.current.find(
              (item) => item.href && item.href.split('#')[0].endsWith(startHref)
            );
            if (match) setCurrentChapter(match.label);
          }

          const totalLocs = bi.locations.length();
          const pctLoc = cfi ? bi.locations.percentageFromCfi(cfi) : 0;
          const current = Math.max(1, Math.round(pctLoc * totalLocs) || 1);
          setCurrentPage(current);
          setTotalPages(totalLocs);
          setTimeLeft(calcTime(current, totalLocs));

          await supabase
            .from('books')
            .update({
              current_page: current,
              total_pages: totalLocs,
              last_cfi: cfi,
              updated_at: new Date().toISOString(),
            })
            .eq('id', bookId);

          if (isFirstRelocated) {
            isFirstRelocated = false;
            return;
          }
          queueXp();
        });
      } catch (err) {
        console.error('Erro ao carregar EPUB:', err);
        if (mounted) {
          setReaderError('Não foi possível abrir este arquivo ePUB.');
          setLoading(false);
        }
      }
    }

    initEpub();

    return () => {
      mounted = false;
      if (streakTimerRef.current) clearTimeout(streakTimerRef.current);
      if (xpFlushRef.current) clearTimeout(xpFlushRef.current);
      if (pendingXpRef.current > 0) flushXp();
      renditionRef.current?.destroy();
      localBook?.destroy?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEpub, bookId, bookPdfUrl, userId]);

  // ─── Timer de Streak para PDF ─────────────────────────────────────────────

  useEffect(() => {
    if (!bookId || !userId || isEpub) return;
    if (streakTimerRef.current) clearTimeout(streakTimerRef.current);
    streakTimerRef.current = setTimeout(() => {
      updateStreak();
    }, 30000);

    return () => {
      if (streakTimerRef.current) clearTimeout(streakTimerRef.current);
      if (xpFlushRef.current) clearTimeout(xpFlushRef.current);
      if (pendingXpRef.current > 0) flushXp();
    };
  }, [bookId, userId, isEpub, updateStreak, flushXp]);

  // ─── Callbacks do PDF ─────────────────────────────────────────────────────

  const handlePdfReady = useCallback(
    (numPages: number, outline: TocItem[]) => {
      setTotalPages(numPages);
      setToc(outline);
      flatTocRef.current = flattenToc(outline);
      setLoading(false);
      const startPage = queryPage ? Number(queryPage) : initialPage || 1;
      const clamped = Math.max(1, Math.min(startPage, numPages));
      setCurrentPage(clamped);
      setTimeLeft(calcTime(clamped, numPages));

      if (bookId && numPages > 0) {
        supabase
          .from('books')
          .update({
            total_pages: numPages,
            updated_at: new Date().toISOString(),
          })
          .eq('id', bookId);
      }
    },
    [bookId, initialPage, queryPage, calcTime]
  );

  const handlePdfError = useCallback((msg: string) => {
    setReaderError(msg);
    setLoading(false);
  }, []);

  // ─── Mudança de tema ──────────────────────────────────────────────────────

  const changeTheme = (t: ReaderTheme) => {
    setTheme(t);
    applyThemeRef.current?.(t);
  };

  // ─── Marcador (Bookmark) ──────────────────────────────────────────────────

  const currentBookmark = useMemo(() => {
    if (isEpub && currentCfiRef.current) {
      const byCfi = bookmarks.find((bm) => bm.cfi === currentCfiRef.current);
      if (byCfi) return byCfi;
    }
    return bookmarks.find((bm) => bm.page_number === currentPage) || null;
  }, [bookmarks, currentPage, isEpub]);

  const toggleBookmark = async () => {
    if (!userId || !book?.id) return;

    if (currentBookmark) {
      const { error } = await supabase
        .from('book_bookmarks')
        .delete()
        .eq('id', currentBookmark.id);
      if (!error) {
        setBookmarks((prev) => prev.filter((b) => b.id !== currentBookmark.id));
        showToast('🔖', 'Marcador removido', `Página ${currentBookmark.page_number}`);
      }
      return;
    }

    const { data, error } = await supabase
      .from('book_bookmarks')
      .insert({
        user_id: userId,
        book_id: book.id,
        cfi: isEpub ? currentCfiRef.current : null,
        page_number: currentPage,
        chapter_title: currentChapter,
      })
      .select()
      .single();

    if (!error && data) {
      setBookmarks((prev) => [data as BookBookmark, ...prev]);
      showToast('🔖', 'Página marcada!', `Página ${currentPage}`);
    }
  };

  const deleteBookmarkById = async (bmId: string) => {
    const { error } = await supabase.from('book_bookmarks').delete().eq('id', bmId);
    if (!error) setBookmarks((prev) => prev.filter((b) => b.id !== bmId));
  };

  // ─── Destaques (Highlights) & Notas ───────────────────────────────────────

  const saveHighlight = async (color: HighlightColor, noteText?: string) => {
    if (!pendingSelection || !userId || !book?.id) return;

    const { data, error } = await supabase
      .from('book_highlights')
      .insert({
        user_id: userId,
        book_id: book.id,
        cfi: pendingSelection.cfi,
        page_number: currentPage,
        selected_text: pendingSelection.text,
        note: noteText?.trim() || null,
        color,
        chapter_title: currentChapter,
      })
      .select()
      .single();

    if (!error && data) {
      const saved = data as BookHighlight;
      setHighlights((prev) => [saved, ...prev]);

      if (isEpub && saved.cfi && renditionRef.current?.annotations) {
        try {
          renditionRef.current.annotations.add(
            'highlight',
            saved.cfi,
            {},
            undefined,
            `hl-${saved.id}`,
            {
              fill: HIGHLIGHT_STYLES[color].epubFill,
              'fill-opacity': '0.35',
              'mix-blend-mode': 'multiply',
            }
          );
        } catch {
          // ignora erro de anotação
        }
      }

      setPendingSelection(null);
      setNoteMode(false);
      setNoteInput('');
      showToast('✨', noteText ? 'Nota salva!' : 'Trecho destacado!', `Página ${currentPage}`);
    }
  };

  const deleteHighlightById = async (hlId: string) => {
    const target = highlights.find((h) => h.id === hlId);
    const { error } = await supabase.from('book_highlights').delete().eq('id', hlId);
    if (!error) {
      setHighlights((prev) => prev.filter((h) => h.id !== hlId));
      if (isEpub && target?.cfi && renditionRef.current?.annotations) {
        try {
          renditionRef.current.annotations.remove(target.cfi, 'highlight');
        } catch {
          // ignora
        }
      }
    }
  };

  // ─── Salto via TOC, Bookmark, Highlight ou Scrubber ───────────────────────

  const handleSelectToc = (item: TocItem) => {
    if (isEpub && item.href) {
      renditionRef.current?.display(item.href);
    } else if (!isEpub && item.pageNumber) {
      goToPdfPage(item.pageNumber, false);
    }
  };

  const handleSelectBookmark = (bm: BookBookmark) => {
    if (isEpub) {
      if (bm.cfi) renditionRef.current?.display(bm.cfi);
      else if (totalPages > 0 && bookInstanceRef.current) {
        const cfi = bookInstanceRef.current.locations.cfiFromPercentage(bm.page_number / totalPages);
        renditionRef.current?.display(cfi);
      }
    } else {
      goToPdfPage(bm.page_number, false);
    }
  };

  const handleSelectHighlight = (hl: BookHighlight) => {
    if (isEpub && hl.cfi) {
      renditionRef.current?.display(hl.cfi);
    } else if (!isEpub) {
      goToPdfPage(hl.page_number, false);
    }
  };

  const commitScrub = (targetPage: number) => {
    setScrubPage(null);
    if (totalPages <= 0) return;

    if (isEpub && bookInstanceRef.current) {
      const pct = Math.min(0.999, Math.max(0, (targetPage - 1) / totalPages));
      const cfi = bookInstanceRef.current.locations.cfiFromPercentage(pct);
      renditionRef.current?.display(cfi);
    } else if (!isEpub) {
      goToPdfPage(targetPage, false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  const th = THEMES[theme];
  const displayPage = scrubPage ?? currentPage;
  const pct = totalPages > 0 ? Math.min(100, (displayPage / totalPages) * 100) : 0;
  const pctText = Math.round(pct);

  return (
    <div
      className="h-screen flex flex-col overflow-hidden relative select-none"
      style={{ background: th.shell }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* ── HEADER ── */}
      <AnimatePresence>
        {uiVisible && (
          <motion.header
            key="header"
            initial={{ y: -64, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -64, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            className={`absolute top-0 left-0 right-0 z-30 px-4 py-3.5 border-b backdrop-blur-md flex justify-between items-center gap-3 ${th.chrome} ${th.chromeBorder} ${th.chromeText}`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                onClick={() => router.back()}
                className="p-1.5 rounded-full opacity-60 hover:opacity-100 transition-opacity"
                aria-label="Voltar para a estante"
              >
                <ArrowLeft size={20} />
              </button>
              <button
                onClick={() => setNavDrawerOpen(true)}
                className="p-1.5 rounded-full opacity-70 hover:opacity-100 transition-opacity"
                aria-label="Abrir sumário, marcadores e destaques"
              >
                <List size={19} />
              </button>
              <div className="min-w-0">
                <p className="text-[11px] font-bold truncate max-w-[140px]">
                  {book?.title || ''}
                </p>
                {currentChapter && (
                  <p className="text-[9px] opacity-50 truncate max-w-[140px]">
                    {currentChapter}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={toggleBookmark}
                className="p-2 rounded-full bg-black/5 hover:bg-black/10 transition-colors"
                aria-label={currentBookmark ? 'Remover marcador' : 'Marcar página'}
              >
                <Bookmark
                  size={16}
                  fill={currentBookmark ? 'currentColor' : 'none'}
                  className={currentBookmark ? 'text-amber-500' : ''}
                />
              </button>

              {/* Seletor de tema — 4 swatches */}
              <div className="flex bg-black/5 p-1 rounded-full gap-0.5">
                {THEME_ORDER.map((key) => (
                  <button
                    key={key}
                    onClick={() => changeTheme(key)}
                    aria-label={`Tema ${key}`}
                    className={`w-5 h-5 rounded-full border-2 transition-all ${THEMES[key].swatchBg} ${
                      theme === key ? THEMES[key].swatchDot : 'border-transparent'
                    }`}
                  />
                ))}
              </div>
            </div>
          </motion.header>
        )}
      </AnimatePresence>

      {/* ── VIEWER ── */}
      <main
        className="flex-1 relative flex items-center justify-center overflow-hidden"
        onClick={(e) => {
          if (e.target === e.currentTarget) setUiVisible((v) => !v);
        }}
      >
        {loadingReader && (
          <div className="absolute inset-0 flex items-center justify-center z-50" style={{ background: th.shell }}>
            <Loader2 className="animate-spin text-stone-300" size={36} />
          </div>
        )}

        {readerError ? (
          <div className="text-center px-6">
            <p className="text-sm font-bold text-red-500 mb-3">{readerError}</p>
            <button
              onClick={() => router.back()}
              className="px-4 py-2 rounded-full bg-[#1A1A1A] text-white text-xs font-bold"
            >
              Voltar
            </button>
          </div>
        ) : isEpub ? (
          <div
            ref={viewerRef}
            className={`h-full w-full max-w-4xl transition-colors duration-300 ${th.viewer}`}
            style={{
              paddingTop: uiVisible ? '60px' : 0,
              paddingBottom: uiVisible ? '86px' : 0,
              transition: 'padding 0.22s ease',
            }}
          />
        ) : pdfPublicUrl ? (
          <div
            className="h-full w-full"
            style={{
              paddingTop: uiVisible ? '60px' : 0,
              paddingBottom: uiVisible ? '86px' : 0,
              transition: 'padding 0.22s ease',
            }}
          >
            <PdfViewer
              url={pdfPublicUrl}
              pageNumber={currentPage}
              theme={theme}
              onDocumentReady={handlePdfReady}
              onError={handlePdfError}
              onSelectText={(text) => {
                setPendingSelection({ text, cfi: null });
                setNoteMode(false);
                setNoteInput('');
              }}
              onCenterTap={() => setUiVisible((v) => !v)}
            />
          </div>
        ) : null}

        {/* Zonas de clique lateral */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            goPrev();
          }}
          aria-label="Página anterior"
          className="absolute left-0 top-16 bottom-24 w-[10%] z-20"
        />
        <button
          onClick={(e) => {
            e.stopPropagation();
            goNext();
          }}
          aria-label="Próxima página"
          className="absolute right-0 top-16 bottom-24 w-[10%] z-20"
        />
      </main>

      {/* ── DRAWER SUMÁRIO / MARCADORES / DESTAQUES ── */}
      <ReaderDrawers
        isOpen={isNavDrawerOpen}
        onClose={() => setNavDrawerOpen(false)}
        toc={toc}
        bookmarks={bookmarks}
        highlights={highlights}
        onSelectToc={handleSelectToc}
        onSelectBookmark={handleSelectBookmark}
        onDeleteBookmark={deleteBookmarkById}
        onSelectHighlight={handleSelectHighlight}
        onDeleteHighlight={deleteHighlightById}
      />

      {/* ── BARRA FLUTUANTE DE HIGHLIGHT / NOTA ── */}
      <AnimatePresence>
        {pendingSelection && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[90] bg-white text-[#1A1A1A] border border-stone-200 rounded-2xl shadow-2xl p-3.5 w-[calc(100%-2rem)] max-w-sm"
          >
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">
                Destacar ou Anotar
              </p>
              <button
                onClick={() => {
                  setPendingSelection(null);
                  setNoteMode(false);
                }}
                className="text-stone-300 hover:text-[#1A1A1A]"
                aria-label="Fechar seleção"
              >
                <X size={15} />
              </button>
            </div>

            <p className="text-xs italic text-stone-500 line-clamp-2 mb-3 font-serif">
              “{pendingSelection.text}”
            </p>

            {noteMode ? (
              <div className="space-y-2.5">
                <textarea
                  rows={2}
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  placeholder="Escreva sua nota sobre este trecho..."
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl p-2.5 text-xs font-medium outline-none focus:border-[#1A1A1A] resize-none"
                />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    {(['amber', 'blue', 'green', 'rose'] as HighlightColor[]).map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setSelectedColor(c)}
                        className={`w-6 h-6 rounded-full ${HIGHLIGHT_STYLES[c].dot} border-2 ${
                          selectedColor === c ? 'border-[#1A1A1A] scale-110' : 'border-transparent'
                        } transition-transform`}
                        aria-label={`Cor ${HIGHLIGHT_STYLES[c].label}`}
                      />
                    ))}
                  </div>
                  <button
                    onClick={() => saveHighlight(selectedColor, noteInput)}
                    className="px-3.5 py-1.5 rounded-xl bg-[#1A1A1A] text-white text-xs font-bold inline-flex items-center gap-1"
                  >
                    <Check size={13} />
                    Salvar Nota
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {(['amber', 'blue', 'green', 'rose'] as HighlightColor[]).map((c) => (
                    <button
                      key={c}
                      onClick={() => saveHighlight(c)}
                      className={`w-7 h-7 rounded-full ${HIGHLIGHT_STYLES[c].dot} hover:scale-110 transition-transform border border-black/10`}
                      aria-label={`Destacar em ${HIGHLIGHT_STYLES[c].label}`}
                    />
                  ))}
                </div>
                <button
                  onClick={() => setNoteMode(true)}
                  className="px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
                >
                  <StickyNote size={13} />
                  Adicionar Nota
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── TOAST ── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 60, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="fixed bottom-28 left-1/2 -translate-x-1/2 z-[100] bg-[#0A0A0A] text-white rounded-2xl px-5 py-4 flex items-center gap-3 shadow-2xl shadow-black/30 min-w-[200px]"
          >
            <span className="text-2xl">{toast.icon}</span>
            <div>
              <p className="text-sm font-bold leading-tight">{toast.title}</p>
              <p className="text-[10px] text-stone-400 mt-0.5">{toast.sub}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── FOOTER COM BARRA DESLIZANTE DE PÁGINAS ── */}
      <AnimatePresence>
        {uiVisible && (
          <motion.footer
            key="footer"
            initial={{ y: 86, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 86, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            className={`absolute bottom-0 left-0 right-0 z-30 px-6 py-3.5 border-t backdrop-blur-md ${th.chrome} ${th.chromeBorder} ${th.chromeText}`}
          >
            {scrubPage !== null && (
              <div className="absolute -top-9 left-1/2 -translate-x-1/2 bg-[#1A1A1A] text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-lg">
                Ir para pág. {scrubPage} ({pctText}%)
              </div>
            )}

            <div className="max-w-3xl mx-auto space-y-2">
              <input
                type="range"
                min={1}
                max={Math.max(1, totalPages)}
                value={Math.min(Math.max(1, displayPage), Math.max(1, totalPages))}
                disabled={totalPages <= 1}
                onChange={(e) => setScrubPage(Number(e.target.value))}
                onMouseUp={(e) => commitScrub(Number((e.target as HTMLInputElement).value))}
                onTouchEnd={(e) => commitScrub(Number((e.target as HTMLInputElement).value))}
                onKeyUp={(e) => commitScrub(Number((e.target as HTMLInputElement).value))}
                aria-label="Barra deslizante de páginas"
                className="w-full h-1.5 accent-[#1A1A1A] cursor-pointer"
              />

              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider opacity-70 tabular-nums">
                <span>
                  {displayPage} / {totalPages || '...'}
                </span>
                <span>{timeLeft}</span>
                <span>{pctText}%</span>
              </div>
            </div>
          </motion.footer>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function ReaderPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen flex items-center justify-center bg-[#F8F9F7]">
          <Loader2 className="animate-spin text-stone-300" size={32} />
        </div>
      }
    >
      <ReaderContent />
    </Suspense>
  );
}
