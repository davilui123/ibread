"use client";

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { ArrowLeft, Loader2, Sparkles, X, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import TurboReader from '@/components/TurboReader';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type ThemeType = 'default' | 'sepia' | 'comfort' | 'kindle';

const THEME_STYLES: Record<ThemeType, { bg: string; header: string; footer: string; viewer: string; border: string; text: string }> = {
  default: {
    bg: 'bg-[#F8F9F7]',
    header: 'bg-white/80 border-stone-200 text-stone-800',
    footer: 'bg-white border-stone-100 text-stone-800',
    viewer: 'bg-white',
    border: 'border-blue-400',
    text: 'text-stone-800',
  },
  sepia: {
    bg: 'bg-[#F4ECD8]',
    header: 'bg-[#E8DFCA] border-[#D6CBB3] text-[#5B4636]',
    footer: 'bg-[#E8DFCA] border-[#D6CBB3] text-[#5B4636]',
    viewer: 'bg-[#F4ECD8]',
    border: 'border-orange-400',
    text: 'text-[#5B4636]',
  },
  comfort: {
    bg: 'bg-[#121212]',
    header: 'bg-[#1A1A1A] border-stone-800 text-stone-300',
    footer: 'bg-[#1A1A1A] border-stone-800 text-stone-400',
    viewer: 'bg-[#1A1A1A]',
    border: 'border-stone-500',
    text: 'text-stone-300',
  },
  kindle: {
    bg: 'bg-[#F3F3EF]',
    header: 'bg-[#EBEBЕ7] border-[#D8D8D4] text-[#3A3A3A]',
    footer: 'bg-[#EBEBЕ7] border-[#D8D8D4] text-[#3A3A3A]',
    viewer: 'bg-[#F3F3EF]',
    border: 'border-stone-400',
    text: 'text-[#3A3A3A]',
  },
};

// Swatch visual de cada tema no seletor
const THEME_SWATCHES: { key: ThemeType; bg: string; dot: string }[] = [
  { key: 'default', bg: 'bg-white',      dot: 'border-blue-400' },
  { key: 'sepia',   bg: 'bg-[#F4ECD8]', dot: 'border-orange-400' },
  { key: 'kindle',  bg: 'bg-[#F3F3EF]', dot: 'border-stone-400' },
  { key: 'comfort', bg: 'bg-[#1A1A1A]', dot: 'border-stone-500' },
];

// XP por página virada
const XP_PER_PAGE = 2;

// ─── Componente ───────────────────────────────────────────────────────────────

export default function ReaderPage() {
  const params = useParams();
  const id = params?.id;
  const router = useRouter();

  const [book, setBook] = useState<any>(null);
  const [isEpub, setIsEpub] = useState(false);
  const [loadingReader, setLoadingReader] = useState(true);
  const [theme, setTheme] = useState<ThemeType>('default');

  const [selectedText, setSelectedText] = useState("");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [aiResponse, setAiResponse] = useState("");
  const [loadingAi, setLoadingAi] = useState(false);

  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [timeLeft, setTimeLeft] = useState<string>("Calculando...");
  const [isTurboMode, setIsTurboMode] = useState(false);
  const [pageText, setPageText] = useState("");

  const viewerRef = useRef<HTMLDivElement>(null);
  const renditionRef = useRef<any>(null);
  const startTimeRef = useRef<number>(Date.now());
  const hasUpdatedStreak = useRef(false);
  const wakeLockRef = useRef<any>(null);

  // ─── Wake Lock ──────────────────────────────────────────────────────────────

  const requestWakeLock = async () => {
    if (!('wakeLock' in navigator)) return;
    try {
      wakeLockRef.current = await (navigator as any).wakeLock.request('screen');

      // Reaquire se o documento voltar ao foco (ex: troca de aba)
      document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState === 'visible' && wakeLockRef.current === null) {
          try {
            wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
          } catch { /* silencioso */ }
        }
      });
    } catch { /* silencioso — dispositivo pode negar */ }
  };

  const releaseWakeLock = () => {
    wakeLockRef.current?.release();
    wakeLockRef.current = null;
  };

  useEffect(() => {
    requestWakeLock();
    return () => releaseWakeLock();
  }, []);

  // ─── Swipe ──────────────────────────────────────────────────────────────────

  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const SWIPE_THRESHOLD = 50; // px mínimo para considerar swipe
  const SWIPE_MAX_VERTICAL = 80; // evita confundir scroll com swipe

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    if (isDrawerOpen || isTurboMode) return; // não interferir em overlays

    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = Math.abs(e.changedTouches[0].clientY - touchStartY.current);

    if (dy > SWIPE_MAX_VERTICAL) return; // scroll vertical — ignora
    if (Math.abs(dx) < SWIPE_THRESHOLD) return;

    if (dx < 0) {
      renditionRef.current?.next(); // swipe esquerda → próxima
    } else {
      renditionRef.current?.prev(); // swipe direita → anterior
    }

    touchStartX.current = null;
    touchStartY.current = null;
  };

  // ─── Busca do livro ─────────────────────────────────────────────────────────

  useEffect(() => {
    const fetchBook = async () => {
      if (!id) return;
      const { data, error } = await supabase.from('books').select('*').eq('id', id).single();
      if (!error && data) {
        setBook(data);
        setIsEpub(data.pdf_url?.toLowerCase().endsWith('.epub'));
      }
    };
    fetchBook();
  }, [id]);

  // ─── Streak (30s de leitura) ────────────────────────────────────────────────

  const updateReadingStreak = async () => {
    if (hasUpdatedStreak.current) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const today = new Date().toISOString().split('T')[0];
    const { data: stats } = await supabase
      .from('user_stats')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (stats) {
      if (stats.last_read_date === today) {
        hasUpdatedStreak.current = true;
        return;
      }
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      const newStreak = stats.last_read_date === yesterdayStr
        ? stats.streak_count + 1
        : 1;

      await supabase
        .from('user_stats')
        .update({ streak_count: newStreak, last_read_date: today })
        .eq('user_id', user.id);
    } else {
      await supabase
        .from('user_stats')
        .insert({ user_id: user.id, streak_count: 1, last_read_date: today });
    }

    hasUpdatedStreak.current = true;
  };

  // ─── XP + páginas (por relocated) ──────────────────────────────────────────

  const updateXpAndPages = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: stats } = await supabase
      .from('user_stats')
      .select('xp, level, total_pages, weekly_pages, week_start, weekly_goal')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!stats) return;

    const newXp = (stats.xp ?? 0) + XP_PER_PAGE;
    const newTotalPages = (stats.total_pages ?? 0) + 1;

    // Reseta weekly_pages se a semana mudou (segunda-feira)
    const today = new Date();
    const weekStart = new Date(stats.week_start ?? today);
    const diffDays = Math.floor((today.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24));
    const isNewWeek = diffDays >= 7;

    const newWeeklyPages = isNewWeek ? 1 : (stats.weekly_pages ?? 0) + 1;
    const newWeekStart = isNewWeek ? today.toISOString().split('T')[0] : stats.week_start;

    // Recalcula nível
    const xpForLevel = (lvl: number) => Math.floor(100 * Math.pow(lvl, 1.6));
    const totalXpForLevel = (lvl: number) => {
      let total = 0;
      for (let i = 1; i < lvl; i++) total += xpForLevel(i);
      return total;
    };
    let newLevel = 1;
    while (newXp >= totalXpForLevel(newLevel + 1)) newLevel++;

    await supabase
      .from('user_stats')
      .update({
        xp: newXp,
        level: newLevel,
        total_pages: newTotalPages,
        weekly_pages: newWeeklyPages,
        week_start: newWeekStart,
      })
      .eq('user_id', user.id);
  };

  // ─── Tempo restante ─────────────────────────────────────────────────────────

  const calculateTimeRemaining = (current: number, total: number) => {
    const now = Date.now();
    const secondsSpent = (now - startTimeRef.current) / 1000;
    startTimeRef.current = now;
    const pagesRemaining = total - current;
    if (pagesRemaining <= 0) return "Fim do livro";
    const minutes = Math.ceil(
      (pagesRemaining * (secondsSpent > 5 ? secondsSpent : 30)) / 60
    );
    if (minutes < 1) return "Menos de 1 min";
    if (minutes > 60) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
    return `${minutes} min para o fim`;
  };

  // ─── Inicialização do EPUB ──────────────────────────────────────────────────

  useEffect(() => {
    if (!isEpub || !book || !viewerRef.current) {
      if (book && !isEpub) setLoadingReader(false);
      return;
    }

    let isMounted = true;

    async function init() {
      try {
        const ePubModule = await import('epubjs');
        const ePub = (ePubModule as any).default || ePubModule;
        const { data: { publicUrl } } = supabase.storage.from('pdfs').getPublicUrl(book.pdf_url);
        const bookInstance = ePub(publicUrl);
        const rendition = bookInstance.renderTo(viewerRef.current, {
          width: "100%", height: "100%", flow: "paginated",
        });
        renditionRef.current = rendition;

        // Seleção de texto
        rendition.on("selected", (_cfiRange: string, contents: any) => {
          const text = contents.window.getSelection().toString().trim();
          if (text.length > 2) setSelectedText(text);
        });

        // Injeção de temas
        rendition.themes.default({
          body: { "font-family": "serif !important", "padding": "40px !important" },
        });
        rendition.themes.register("sepia", {
          body: { "background": "#F4ECD8 !important", "color": "#5B4636 !important" },
        });
        rendition.themes.register("comfort", {
          body: { "background": "#1A1A1A !important", "color": "#D1D1D1 !important" },
        });
        rendition.themes.register("kindle", {
          body: {
            "background": "#F3F3EF !important",
            "color": "#3A3A3A !important",
            "font-family": "'Georgia', serif !important",
          },
        });

        bookInstance.ready.then(async () => {
          await bookInstance.locations.generate(1024);
          if (isMounted) {
            setTotalPages(bookInstance.locations.length());
            const percentage = (book.current_page || 0) / (bookInstance.locations.length() || 1);
            await rendition.display(bookInstance.locations.cfiFromPercentage(percentage));
            setLoadingReader(false);

            // Streak após 30s de leitura real
            setTimeout(() => { if (isMounted) updateReadingStreak(); }, 30000);
          }
        });

        rendition.on("relocated", async (location: any) => {
          if (!isMounted) return;

          // Captura de texto para TurboReader
          try {
            const range = renditionRef.current.getRange(location.start.cfi);
            let captured = range.toString();
            if (!captured || captured.trim().length === 0) {
              const iframe = viewerRef.current?.querySelector('iframe');
              captured = iframe?.contentDocument?.body?.innerText || "";
            }
            setPageText(captured);
          } catch { /* silencioso */ }

          const percent = bookInstance.locations.percentageFromCfi(location.start.cfi);
          const currentLoc = Math.floor(percent * bookInstance.locations.length()) || 1;
          setCurrentPage(currentLoc);
          setTimeLeft(calculateTimeRemaining(currentLoc, bookInstance.locations.length()));

          // Persistência de progresso
          await supabase
            .from('books')
            .update({ current_page: currentLoc, total_pages: bookInstance.locations.length() })
            .eq('id', id);

          // XP e páginas (não conta na primeira exibição)
          if (currentLoc > 1) await updateXpAndPages();
        });

      } catch (err) {
        console.error(err);
        setLoadingReader(false);
      }
    }

    init();
    return () => {
      isMounted = false;
      renditionRef.current?.destroy();
    };
  }, [isEpub, book, id]);

  // ─── Mudança de tema ────────────────────────────────────────────────────────

  const changeTheme = (newTheme: ThemeType) => {
    setTheme(newTheme);
    renditionRef.current?.themes.select(newTheme === 'default' ? 'default' : newTheme);
  };

  // ─── IA Mentor ──────────────────────────────────────────────────────────────

  const callAi = async (mode: 'insight' | 'persona') => {
    setIsDrawerOpen(true);
    setLoadingAi(true);
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: selectedText, bookTitle: book.title, action: mode }),
      });
      const data = await res.json();
      setAiResponse(data.result);
    } catch {
      setAiResponse("Erro na IA.");
    } finally {
      setLoadingAi(false);
    }
  };

  // ─── Helpers de estilo ──────────────────────────────────────────────────────

  const t = THEME_STYLES[theme];

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className={`h-screen flex flex-col overflow-hidden ${t.bg}`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* HEADER */}
      <header className={`px-6 py-4 border-b flex justify-between items-center z-30 transition-colors duration-300 ${t.header}`}>
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="opacity-50 hover:opacity-100 transition-opacity">
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-[10px] font-black uppercase tracking-widest opacity-40 truncate max-w-[150px]">
            {book?.title || "Carregando..."}
          </h2>
        </div>

        <div className="flex items-center gap-3">
          {/* Botões IA — aparecem quando há texto selecionado */}
          <AnimatePresence>
            {selectedText && !isTurboMode && (
              <motion.div
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                className="flex gap-2"
              >
                <button
                  onClick={() => callAi('insight')}
                  className="bg-black text-white px-4 py-2 rounded-full flex items-center gap-2"
                >
                  <Sparkles size={12} className="text-orange-300" />
                  <span className="text-[10px] font-black">Insight</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Turbo Reader */}
          <button
            onClick={() => setIsTurboMode(true)}
            className="p-2.5 rounded-full bg-stone-100 text-stone-500 hover:bg-black hover:text-white transition-all"
          >
            <Zap size={16} />
          </button>

          {/* Seletor de tema — agora com 4 swatches */}
          <div className="flex bg-stone-100 p-1 rounded-full border border-stone-200 gap-0.5">
            {THEME_SWATCHES.map(({ key, bg, dot }) => (
              <button
                key={key}
                onClick={() => changeTheme(key)}
                className={`w-6 h-6 rounded-full border-2 transition-all ${bg} ${theme === key ? dot : 'border-transparent'}`}
              />
            ))}
          </div>
        </div>
      </header>

      {/* LEITOR */}
      <main className="flex-1 relative flex items-center justify-center">
        {loadingReader && (
          <div className={`absolute inset-0 flex items-center justify-center z-50 ${t.bg}`}>
            <Loader2 className="animate-spin text-stone-200" size={40} />
          </div>
        )}

        {/* Viewer EPUB */}
        <div
          ref={viewerRef}
          className={`h-full w-full max-w-4xl transition-colors duration-300 ${t.viewer}`}
        />

        {/* Zonas de clique lateral (desktop / fallback) */}
        <button onClick={() => renditionRef.current?.prev()} className="absolute left-0 h-full w-[15%] z-10" />
        <button onClick={() => renditionRef.current?.next()} className="absolute right-0 h-full w-[15%] z-10" />

        {/* Drawer IA */}
        <AnimatePresence>
          {isDrawerOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setIsDrawerOpen(false)}
                className="absolute inset-0 bg-black/20 backdrop-blur-sm z-[50]"
              />
              <motion.div
                initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 280 }}
                className="absolute right-0 top-0 h-full w-full max-w-md z-[60] shadow-2xl p-10 flex flex-col bg-white"
              >
                <div className="flex justify-between items-center mb-10">
                  <h3 className="text-xs font-black uppercase tracking-widest text-stone-800">IA Mentor</h3>
                  <button onClick={() => setIsDrawerOpen(false)}><X size={24} /></button>
                </div>
                <div className="flex-1 overflow-y-auto pr-4">
                  <div className="p-5 rounded-3xl mb-8 border bg-stone-50 border-stone-100 text-stone-600 italic">
                    "{selectedText}"
                  </div>
                  {loadingAi
                    ? <Loader2 className="animate-spin mx-auto text-stone-300" />
                    : <div className="text-xl font-serif leading-loose">{aiResponse}</div>
                  }
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Turbo Reader */}
        <AnimatePresence>
          {isTurboMode && <TurboReader text={pageText} onClose={() => setIsTurboMode(false)} />}
        </AnimatePresence>
      </main>

      {/* FOOTER */}
      <footer className={`px-10 py-6 border-t flex items-center justify-between transition-colors duration-300 ${t.footer}`}>
        <div className="flex flex-col">
          <span className="text-[11px] font-black uppercase">Pág. {currentPage} / {totalPages}</span>
          <span className="text-[9px] font-bold uppercase opacity-60">{timeLeft}</span>
        </div>
        <div className="flex-1 h-[2px] bg-stone-100 rounded-full mx-10 overflow-hidden">
          <motion.div
            className="h-full bg-black"
            initial={{ width: 0 }}
            animate={{ width: `${(currentPage / totalPages) * 100}%` }}
          />
        </div>
        <span className="text-[11px] font-black">
          {Math.round((currentPage / totalPages) * 100)}%
        </span>
      </footer>
    </div>
  );
}
