"use client";

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { ArrowLeft, Sparkles, X, Zap, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import TurboReader from '@/components/TurboReader';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type ThemeType = 'default' | 'sepia' | 'kindle' | 'comfort';

interface ThemeConfig {
  // Shell (fundo externo ao viewer)
  shell: string;
  // Header / Footer
  chrome: string;
  chromeBorder: string;
  chromeText: string;
  // Viewer (iframe container)
  viewer: string;
  // Swatch no seletor
  swatchBg: string;
  swatchDot: string;
  // CSS injetado no EPUB
  epubBg: string;
  epubColor: string;
  epubFont: string;
}

const THEMES: Record<ThemeType, ThemeConfig> = {
  default: {
    shell:       '#FFFFFF',
    chrome:      'bg-white/90',
    chromeBorder:'border-stone-200',
    chromeText:  'text-[#0A0A0A]',
    viewer:      'bg-white',
    swatchBg:    'bg-white',
    swatchDot:   'border-blue-500',
    epubBg:      '#FFFFFF',
    epubColor:   '#0A0A0A',
    epubFont:    'Georgia, serif',
  },
  sepia: {
    shell:       '#F4ECD8',
    chrome:      'bg-[#EDE3CC]/90',
    chromeBorder:'border-[#D0C4A8]',
    chromeText:  'text-[#3D2B1F]',
    viewer:      'bg-[#F4ECD8]',
    swatchBg:    'bg-[#F4ECD8]',
    swatchDot:   'border-orange-500',
    epubBg:      '#F4ECD8',
    epubColor:   '#3D2B1F',
    epubFont:    'Georgia, serif',
  },
  kindle: {
    shell:       '#E4E4E0',
    chrome:      'bg-[#DCDCD8]/90',
    chromeBorder:'border-[#C4C4C0]',
    chromeText:  'text-[#0A0A0A]',
    viewer:      'bg-[#E4E4E0]',
    swatchBg:    'bg-[#E4E4E0]',
    swatchDot:   'border-stone-500',
    epubBg:      '#E4E4E0',
    epubColor:   '#0A0A0A',
    epubFont:    'Georgia, serif',
  },
  comfort: {
    shell:       '#141414',
    chrome:      'bg-[#1C1C1C]/90',
    chromeBorder:'border-stone-800',
    chromeText:  'text-[#CCCCCC]',
    viewer:      'bg-[#141414]',
    swatchBg:    'bg-[#141414]',
    swatchDot:   'border-stone-500',
    epubBg:      '#141414',
    epubColor:   '#CCCCCC',
    epubFont:    'Georgia, serif',
  },
};

const THEME_ORDER: ThemeType[] = ['default', 'sepia', 'kindle', 'comfort'];

// XP por página virada
const XP_PER_PAGE = 2;

// Debounce simples para o XP
let xpTimeout: ReturnType<typeof setTimeout> | null = null;

// ─── Componente ───────────────────────────────────────────────────────────────

export default function ReaderPage() {
  const params  = useParams();
  const id      = params?.id as string;
  const router  = useRouter();

  const [book, setBook]               = useState<any>(null);
  const [isEpub, setIsEpub]           = useState(false);
  const [loadingReader, setLoading]   = useState(true);
  const [theme, setTheme]             = useState<ThemeType>('default');
  const [uiVisible, setUiVisible]     = useState(true); // UI imersiva

  // IA
  const [selectedText, setSelectedText] = useState('');
  const [isDrawerOpen, setDrawerOpen]   = useState(false);
  const [aiResponse, setAiResponse]     = useState('');
  const [loadingAi, setLoadingAi]       = useState(false);

  // Leitor
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages]   = useState(0);
  const [timeLeft, setTimeLeft]       = useState('Calculando...');
  const [isTurboMode, setTurboMode]   = useState(false);
  const [pageText, setPageText]       = useState('');

  // Refs
  const viewerRef        = useRef<HTMLDivElement>(null);
  const renditionRef     = useRef<any>(null);
  const bookInstanceRef  = useRef<any>(null);
  const startTimeRef     = useRef<number>(Date.now());
  const hasStreakRef     = useRef(false);
  const streakTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wakeLockRef      = useRef<any>(null);
  const pendingXpRef     = useRef(0); // XP acumulado aguardando flush

  // ─── Wake Lock ────────────────────────────────────────────────────────────

  useEffect(() => {
    const acquire = async () => {
      if (!('wakeLock' in navigator)) return;
      try { wakeLockRef.current = await (navigator as any).wakeLock.request('screen'); }
      catch { /* dispositivo negou */ }
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

  // ─── Swipe ────────────────────────────────────────────────────────────────

  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || isDrawerOpen || isTurboMode) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = Math.abs(e.changedTouches[0].clientY - (touchStartY.current ?? 0));
    touchStartX.current = null;
    if (dy > 80 || Math.abs(dx) < 50) return;
    dx < 0 ? renditionRef.current?.next() : renditionRef.current?.prev();
  };

  // ─── Tap central para mostrar/ocultar UI ──────────────────────────────────

  const handleCenterTap = () => {
    if (isDrawerOpen || isTurboMode) return;
    setUiVisible(v => !v);
  };

  // ─── Busca do livro ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!id) return;
    supabase.from('books').select('*').eq('id', id).single().then(({ data, error }) => {
      if (!error && data) {
        setBook(data);
        setIsEpub(data.pdf_url?.toLowerCase().endsWith('.epub'));
      }
    });
  }, [id]);

  // ─── Streak — dispara IMEDIATAMENTE, conta 30s a partir daqui ─────────────

  const updateStreak = useCallback(async () => {
    if (hasStreakRef.current) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const today = new Date().toISOString().split('T')[0];

    // upsert garante que o registro existe mesmo sem SQL prévio
    const { data: stats } = await supabase
      .from('user_stats')
      .select('streak_count, last_read_date')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!stats) {
      // Primeira vez absoluta — cria o registro completo
      await supabase.from('user_stats').insert({
        user_id:        user.id,
        streak_count:   1,
        last_read_date: today,
        xp:             0,
        level:          1,
        total_pages:    0,
        weekly_pages:   0,
        turbo_uses:     0,
        weekly_goal:    50,
        week_start:     today,
      });
      hasStreakRef.current = true;
      return;
    }

    if (stats.last_read_date === today) {
      hasStreakRef.current = true;
      return; // já contou hoje
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = yesterday.toISOString().split('T')[0];
    const newStreak = stats.last_read_date === yStr ? stats.streak_count + 1 : 1;

    await supabase.from('user_stats')
      .update({ streak_count: newStreak, last_read_date: today })
      .eq('user_id', user.id);

    hasStreakRef.current = true;
  }, []);

  // ─── XP com debounce — flush a cada 3s de inatividade ────────────────────

  const flushXp = useCallback(async () => {
    const amount = pendingXpRef.current;
    if (amount === 0) return;
    pendingXpRef.current = 0;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: stats } = await supabase
      .from('user_stats')
      .select('xp, level, total_pages, weekly_pages, week_start')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!stats) return;

    const newXp          = (stats.xp ?? 0) + amount;
    const newTotalPages  = (stats.total_pages ?? 0) + amount / XP_PER_PAGE;

    // Reset semanal
    const today     = new Date();
    const weekStart = new Date(stats.week_start ?? today);
    const isNewWeek = (today.getTime() - weekStart.getTime()) / 86400000 >= 7;
    const newWeekly = isNewWeek ? amount / XP_PER_PAGE : (stats.weekly_pages ?? 0) + amount / XP_PER_PAGE;

    // Nível
    const xpForLevel    = (l: number) => Math.floor(100 * Math.pow(l, 1.6));
    const totalForLevel = (l: number) => { let t = 0; for (let i = 1; i < l; i++) t += xpForLevel(i); return t; };
    let newLevel = stats.level ?? 1;
    while (newXp >= totalForLevel(newLevel + 1)) newLevel++;

    await supabase.from('user_stats').update({
      xp:           newXp,
      level:        newLevel,
      total_pages:  Math.floor(newTotalPages),
      weekly_pages: Math.floor(newWeekly),
      ...(isNewWeek ? { week_start: today.toISOString().split('T')[0] } : {}),
    }).eq('user_id', user.id);
  }, []);

  const queueXp = useCallback(() => {
    pendingXpRef.current += XP_PER_PAGE;
    if (xpTimeout) clearTimeout(xpTimeout);
    xpTimeout = setTimeout(flushXp, 3000);
  }, [flushXp]);

  // ─── Tempo restante ───────────────────────────────────────────────────────

  const calcTime = (current: number, total: number) => {
    const now          = Date.now();
    const secs         = (now - startTimeRef.current) / 1000;
    startTimeRef.current = now;
    const remaining    = total - current;
    if (remaining <= 0) return 'Fim do livro';
    const mins = Math.ceil((remaining * (secs > 5 ? secs : 30)) / 60);
    if (mins < 1)  return 'Menos de 1 min';
    if (mins > 60) return `${Math.floor(mins / 60)}h ${mins % 60}m`;
    return `${mins} min`;
  };

  // ─── Inicialização do EPUB ────────────────────────────────────────────────

  useEffect(() => {
    if (!isEpub || !book || !viewerRef.current) {
      if (book && !isEpub) setLoading(false);
      return;
    }

    let mounted = true;

    async function init() {
      try {
        const ePubModule  = await import('epubjs');
        const ePub        = (ePubModule as any).default || ePubModule;
        const { data: { publicUrl } } = supabase.storage.from('pdfs').getPublicUrl(book.pdf_url);
        const bi          = ePub(publicUrl);
        bookInstanceRef.current = bi;

        const rendition = bi.renderTo(viewerRef.current, {
          width: '100%', height: '100%', flow: 'paginated',
        });
        renditionRef.current = rendition;

        // Seleção de texto → IA
        rendition.on('selected', (_: string, contents: any) => {
          const t = contents.window.getSelection().toString().trim();
          if (t.length > 2) setSelectedText(t);
        });

        // Aplica tema atual ao conteúdo
        const applyEpubTheme = (th: ThemeType) => {
          const cfg = THEMES[th];
          rendition.themes.override('body', {
            background:  `${cfg.epubBg} !important`,
            color:       `${cfg.epubColor} !important`,
            'font-family': `${cfg.epubFont} !important`,
            padding:     '40px !important',
            'line-height': '1.8 !important',
          });
        };

        // Registra temas e aplica o atual
        rendition.themes.default({ body: { padding: '40px !important', 'line-height': '1.8 !important' } });
        applyEpubTheme(theme);

        // Expõe applyEpubTheme para o changeTheme
        (renditionRef as any).applyEpubTheme = applyEpubTheme;

        bi.ready.then(async () => {
          await bi.locations.generate(1024);
          if (!mounted) return;

          const total = bi.locations.length();
          setTotalPages(total);
          const pct = (book.current_page || 0) / (total || 1);
          await rendition.display(bi.locations.cfiFromPercentage(pct > 0 ? pct : 0));
          setLoading(false);

          // ← Streak: timer começa AGORA, após o livro estar pronto
          if (streakTimerRef.current) clearTimeout(streakTimerRef.current);
          streakTimerRef.current = setTimeout(() => {
            if (mounted) updateStreak();
          }, 30000);
        });

        rendition.on('relocated', async (location: any) => {
          if (!mounted) return;

          // Captura texto para Turbo
          try {
            const range   = renditionRef.current.getRange(location.start.cfi);
            let captured  = range?.toString() || '';
            if (!captured.trim()) {
              const iframe = viewerRef.current?.querySelector('iframe');
              captured = iframe?.contentDocument?.body?.innerText || '';
            }
            setPageText(captured);
          } catch { /* silencioso */ }

          const pct     = bi.locations.percentageFromCfi(location.start.cfi);
          const current = Math.floor(pct * bi.locations.length()) || 1;
          setCurrentPage(current);
          setTimeLeft(calcTime(current, bi.locations.length()));

          // Salva progresso
          await supabase.from('books')
            .update({ current_page: current, total_pages: bi.locations.length() })
            .eq('id', id);

          // XP (não conta ao abrir)
          if (current > 1) queueXp();
        });

      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    }

    init();

    return () => {
      mounted = false;
      if (streakTimerRef.current) clearTimeout(streakTimerRef.current);
      if (xpTimeout) clearTimeout(xpTimeout);
      flushXp(); // garante flush ao sair
      renditionRef.current?.destroy();
    };
  }, [isEpub, book, id]);

  // ─── Mudança de tema ──────────────────────────────────────────────────────

  const changeTheme = (t: ThemeType) => {
    setTheme(t);
    const apply = (renditionRef as any).applyEpubTheme;
    if (apply) apply(t);
  };

  // ─── IA ───────────────────────────────────────────────────────────────────

  const callAi = async (mode: 'insight' | 'persona') => {
    setDrawerOpen(true);
    setLoadingAi(true);
    setUiVisible(false);
    try {
      const res  = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: selectedText, bookTitle: book.title, action: mode }),
      });
      const data = await res.json();
      setAiResponse(data.result);
    } catch { setAiResponse('Erro na IA.'); }
    finally   { setLoadingAi(false); }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  const th      = THEMES[theme];
  const pct     = totalPages > 0 ? (currentPage / totalPages) * 100 : 0;
  const pctText = Math.round(pct);

  return (
    <div
      className="h-screen flex flex-col overflow-hidden relative"
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
            className={`absolute top-0 left-0 right-0 z-30 px-5 py-4 border-b backdrop-blur-md flex justify-between items-center ${th.chrome} ${th.chromeBorder} ${th.chromeText}`}
          >
            <div className="flex items-center gap-3">
              <button onClick={() => router.back()} className="opacity-50 hover:opacity-100 transition-opacity">
                <ArrowLeft size={20} />
              </button>
              <span className="text-[10px] font-black uppercase tracking-widest opacity-40 truncate max-w-[140px]">
                {book?.title || ''}
              </span>
            </div>

            <div className="flex items-center gap-3">
              {/* Insight — aparece só com texto selecionado */}
              <AnimatePresence>
                {selectedText && !isTurboMode && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    onClick={() => callAi('insight')}
                    className="bg-black text-white px-3.5 py-2 rounded-full flex items-center gap-1.5"
                  >
                    <Sparkles size={11} className="text-orange-300" />
                    <span className="text-[10px] font-black">Insight</span>
                  </motion.button>
                )}
              </AnimatePresence>

              {/* Turbo */}
              <button
                onClick={() => setTurboMode(true)}
                className="p-2.5 rounded-full bg-black/5 hover:bg-black hover:text-white transition-all"
              >
                <Zap size={15} />
              </button>

              {/* Seletor de tema — 4 swatches */}
              <div className="flex bg-black/5 p-1 rounded-full gap-0.5">
                {THEME_ORDER.map(key => (
                  <button
                    key={key}
                    onClick={() => changeTheme(key)}
                    className={`w-6 h-6 rounded-full border-2 transition-all ${THEMES[key].swatchBg} ${theme === key ? THEMES[key].swatchDot : 'border-transparent'}`}
                  />
                ))}
              </div>
            </div>
          </motion.header>
        )}
      </AnimatePresence>

      {/* ── VIEWER ── */}
      <main className="flex-1 relative flex items-center justify-center">
        {loadingReader && (
          <div className="absolute inset-0 flex items-center justify-center z-50" style={{ background: th.shell }}>
            <Loader2 className="animate-spin text-stone-300" size={36} />
          </div>
        )}

        {/* Container do EPUB */}
        <div
          ref={viewerRef}
          className={`h-full w-full max-w-4xl transition-colors duration-300 ${th.viewer}`}
          style={{ paddingTop: uiVisible ? '64px' : 0, paddingBottom: uiVisible ? '72px' : 0, transition: 'padding 0.22s ease' }}
        />

        {/* Zona de tap central (toggle UI) — evita as bordas de swipe */}
        <div
          onClick={handleCenterTap}
          className="absolute inset-0 z-10"
          style={{ pointerEvents: isDrawerOpen || isTurboMode ? 'none' : 'auto' }}
        />

        {/* Zonas de clique lateral — sobre o tap central */}
        <button
          onClick={(e) => { e.stopPropagation(); renditionRef.current?.prev(); }}
          className="absolute left-0 top-0 h-full w-[15%] z-20"
        />
        <button
          onClick={(e) => { e.stopPropagation(); renditionRef.current?.next(); }}
          className="absolute right-0 top-0 h-full w-[15%] z-20"
        />

        {/* Drawer IA */}
        <AnimatePresence>
          {isDrawerOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setDrawerOpen(false)}
                className="absolute inset-0 bg-black/20 backdrop-blur-sm z-[50]"
              />
              <motion.div
                initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 280 }}
                className="absolute right-0 top-0 h-full w-full max-w-md z-[60] shadow-2xl p-10 flex flex-col bg-white"
              >
                <div className="flex justify-between items-center mb-8">
                  <div className="flex items-center gap-2">
                    <Sparkles size={14} className="text-stone-400" />
                    <h3 className="text-[10px] font-black uppercase tracking-widest">IA Mentor</h3>
                  </div>
                  <button onClick={() => setDrawerOpen(false)}><X size={20} className="text-stone-400" /></button>
                </div>
                <div className="flex-1 overflow-y-auto">
                  <div className="p-4 rounded-2xl mb-6 bg-stone-50 border border-stone-100 text-stone-500 text-sm italic font-serif">
                    "{selectedText}"
                  </div>
                  {loadingAi
                    ? <div className="flex justify-center py-16"><Loader2 className="animate-spin text-stone-200" size={28} /></div>
                    : <p className="text-lg font-serif leading-relaxed text-stone-800 whitespace-pre-line">{aiResponse}</p>
                  }
                </div>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="mt-6 w-full py-3.5 rounded-xl bg-black text-white text-[10px] font-black uppercase tracking-widest"
                >
                  Continuar Leitura
                </button>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Turbo Reader */}
        <AnimatePresence>
          {isTurboMode && <TurboReader text={pageText} onClose={() => setTurboMode(false)} />}
        </AnimatePresence>
      </main>

      {/* ── FOOTER ── */}
      <AnimatePresence>
        {uiVisible && (
          <motion.footer
            key="footer"
            initial={{ y: 72, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 72, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            className={`absolute bottom-0 left-0 right-0 z-30 px-8 py-5 border-t backdrop-blur-md flex items-center gap-6 ${th.chrome} ${th.chromeBorder} ${th.chromeText}`}
          >
            <div className="flex flex-col min-w-[60px]">
              <span className="text-[11px] font-black uppercase tabular-nums">
                {currentPage} / {totalPages}
              </span>
              <span className="text-[9px] font-bold uppercase opacity-50 mt-0.5">{timeLeft}</span>
            </div>

            <div className="flex-1 h-[2px] rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.08)' }}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: theme === 'comfort' ? '#888' : '#0A0A0A' }}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            </div>

            <span className="text-[11px] font-black tabular-nums min-w-[36px] text-right">
              {pctText}%
            </span>
          </motion.footer>
        )}
      </AnimatePresence>
    </div>
  );
}
