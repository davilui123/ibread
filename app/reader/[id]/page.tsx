"use client";

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { ArrowLeft, Loader2, Sparkles, User, X, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import TurboReader from '@/components/TurboReader';

type ThemeType = 'default' | 'sepia' | 'comfort';

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
  const [activeTab, setActiveTab] = useState<'insight' | 'persona'>('insight');
  
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [timeLeft, setTimeLeft] = useState<string>("Calculando...");
  const [isTurboMode, setIsTurboMode] = useState(false);
  const [pageText, setPageText] = useState("");

  const viewerRef = useRef<HTMLDivElement>(null);
  const renditionRef = useRef<any>(null);
  const startTimeRef = useRef<number>(Date.now());
  const hasUpdatedStreak = useRef(false);

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

  const updateReadingStreak = async () => {
    if (hasUpdatedStreak.current) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const today = new Date().toISOString().split('T')[0];
    const { data: stats } = await supabase.from('user_stats').select('*').eq('user_id', user.id).maybeSingle();
    if (stats) {
      if (stats.last_read_date === today) return;
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      let newStreak = (stats.last_read_date === yesterdayStr) ? stats.streak_count + 1 : 1;
      await supabase.from('user_stats').update({ streak_count: newStreak, last_read_date: today }).eq('user_id', user.id);
    } else {
      await supabase.from('user_stats').insert({ user_id: user.id, streak_count: 1, last_read_date: today });
    }
    hasUpdatedStreak.current = true;
  };

  const calculateTimeRemaining = (current: number, total: number) => {
    const now = Date.now();
    const secondsSpent = (now - startTimeRef.current) / 1000;
    startTimeRef.current = now;
    const pagesRemaining = total - current;
    if (pagesRemaining <= 0) return "Fim do livro";
    const minutes = Math.ceil((pagesRemaining * (secondsSpent > 5 ? secondsSpent : 30)) / 60);
    return minutes < 1 ? "Menos de 1 min" : minutes > 60 ? `${Math.floor(minutes/60)}h ${minutes%60}m` : `${minutes} min para o fim`;
  };

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
        const rendition = bookInstance.renderTo(viewerRef.current, { width: "100%", height: "100%", flow: "paginated" });
        renditionRef.current = rendition;

        rendition.on("selected", (cfiRange: string, contents: any) => {
          const text = contents.window.getSelection().toString().trim();
          if (text.length > 2) setSelectedText(text);
        });

        rendition.themes.default({ body: { "font-family": "serif !important", "padding": "40px !important" } });
        rendition.themes.register("sepia", { body: { "background": "#F4ECD8 !important", "color": "#5B4636 !important" } });
        rendition.themes.register("comfort", { body: { "background": "#1A1A1A !important", "color": "#D1D1D1 !important" } });

        bookInstance.ready.then(async () => {
          await bookInstance.locations.generate(1024); 
          if (isMounted) {
            setTotalPages(bookInstance.locations.length());
            const percentage = (book.current_page || 0) / (bookInstance.locations.length() || 1);
            await rendition.display(bookInstance.locations.cfiFromPercentage(percentage));
            setLoadingReader(false);
            setTimeout(() => { if(isMounted) updateReadingStreak(); }, 30000);
          }
        });

        rendition.on("relocated", async (location: any) => {
          if (!isMounted) return;
          
          // CAPTURA BRUTA DE TEXTO (FIX PARA O TURBO)
          try {
            const range = renditionRef.current.getRange(location.start.cfi);
            let captured = range.toString();
            if (!captured || captured.trim().length === 0) {
              const iframe = viewerRef.current?.querySelector('iframe');
              captured = iframe?.contentDocument?.body?.innerText || "";
            }
            setPageText(captured);
          } catch (e) { console.warn("Erro ao ler página"); }

          const percent = bookInstance.locations.percentageFromCfi(location.start.cfi);
          const currentLoc = Math.floor(percent * bookInstance.locations.length()) || 1;
          setCurrentPage(currentLoc);
          setTimeLeft(calculateTimeRemaining(currentLoc, bookInstance.locations.length()));

          await supabase.from('books').update({ current_page: currentLoc, total_pages: bookInstance.locations.length() }).eq('id', id);
        });
      } catch (err) { console.error(err); }
    }
    init();
    return () => { isMounted = false; renditionRef.current?.destroy(); };
  }, [isEpub, book, id]);

  const callAi = async (mode: 'insight' | 'persona') => {
    setActiveTab(mode);
    setIsDrawerOpen(true);
    setLoadingAi(true);
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: selectedText, bookTitle: book.title, action: mode })
      });
      const data = await res.json();
      setAiResponse(data.result);
    } catch (e) { setAiResponse("Erro na IA."); }
    finally { setLoadingAi(false); }
  };

  return (
    <div className={`h-screen flex flex-col overflow-hidden ${theme === 'comfort' ? 'bg-[#121212]' : theme === 'sepia' ? 'bg-[#F4ECD8]' : 'bg-[#F8F9F7]'}`}>
      <header className={`px-6 py-4 border-b flex justify-between items-center z-30 ${theme === 'comfort' ? 'bg-[#1A1A1A] border-stone-800 text-white' : 'bg-white/80 border-stone-200'}`}>
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="text-stone-400 hover:text-black"><ArrowLeft size={20} /></button>
          <h2 className="text-[10px] font-black uppercase tracking-widest opacity-40 truncate max-w-[150px]">{book?.title || "Carregando..."}</h2>
        </div>
        <div className="flex items-center gap-3">
          <AnimatePresence>
            {selectedText && !isTurboMode && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="flex gap-2">
                <button onClick={() => callAi('insight')} className="bg-black text-white px-4 py-2 rounded-full flex items-center gap-2">
                  <Sparkles size={12} className="text-orange-300" /><span className="text-[10px] font-black">Insight</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
          <button onClick={() => setIsTurboMode(true)} className="p-2.5 rounded-full bg-stone-100 text-stone-500 hover:bg-black hover:text-white transition-all"><Zap size={16} /></button>
          <div className="flex bg-stone-100 p-1 rounded-full border border-stone-200">
            <button onClick={() => {setTheme('default'); renditionRef.current?.themes.select('default');}} className={`w-6 h-6 rounded-full border-2 ${theme === 'default' ? 'border-blue-400' : 'border-transparent'} bg-white`} />
            <button onClick={() => {setTheme('sepia'); renditionRef.current?.themes.select('sepia');}} className={`w-6 h-6 rounded-full border-2 ${theme === 'sepia' ? 'border-orange-400' : 'border-transparent'} bg-[#F4ECD8]`} />
            <button onClick={() => {setTheme('comfort'); renditionRef.current?.themes.select('comfort');}} className={`w-6 h-6 rounded-full border-2 ${theme === 'comfort' ? 'border-stone-400' : 'border-transparent'} bg-[#1A1A1A]`} />
          </div>
        </div>
      </header>
      <main className="flex-1 relative flex items-center justify-center">
        {loadingReader && <div className="absolute inset-0 flex items-center justify-center z-50 bg-[#F8F9F7]"><Loader2 className="animate-spin text-stone-200" size={40} /></div>}
        <div ref={viewerRef} className={`h-full w-full max-w-4xl ${theme === 'comfort' ? 'bg-[#1A1A1A]' : 'bg-white'}`} />
        <button onClick={() => renditionRef.current?.prev()} className="absolute left-0 h-full w-[15%] z-10" />
        <button onClick={() => renditionRef.current?.next()} className="absolute right-0 h-full w-[15%] z-10" />
        <AnimatePresence>
          {isDrawerOpen && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsDrawerOpen(false)} className="absolute inset-0 bg-black/20 backdrop-blur-sm z-[50]" />
              <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} className="absolute right-0 top-0 h-full w-full max-w-md z-[60] shadow-2xl p-10 flex flex-col bg-white">
                <div className="flex justify-between items-center mb-10">
                  <h3 className="text-xs font-black uppercase tracking-widest text-stone-800">IA Mentor</h3>
                  <button onClick={() => setIsDrawerOpen(false)}><X size={24} /></button>
                </div>
                <div className="flex-1 overflow-y-auto pr-4">
                  <div className="p-5 rounded-3xl mb-8 border bg-stone-50 border-stone-100 text-stone-600 italic">"{selectedText}"</div>
                  {loadingAi ? <Loader2 className="animate-spin mx-auto text-stone-300" /> : <div className="text-xl font-serif leading-loose">{aiResponse}</div>}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
        <AnimatePresence>{isTurboMode && <TurboReader text={pageText} onClose={() => setIsTurboMode(false)} />}</AnimatePresence>
      </main>
      <footer className={`px-10 py-6 border-t flex items-center justify-between ${theme === 'comfort' ? 'bg-[#1A1A1A] border-stone-800 text-stone-400' : 'bg-white border-stone-100'}`}>
        <div className="flex flex-col"><span className="text-[11px] font-black uppercase">Pág. {currentPage} / {totalPages}</span><span className="text-[9px] font-bold uppercase opacity-60">{timeLeft}</span></div>
        <div className="flex-1 h-[2px] bg-stone-100 rounded-full mx-10 overflow-hidden"><motion.div className="h-full bg-black" initial={{ width: 0 }} animate={{ width: `${(currentPage/totalPages)*100}%` }} /></div>
        <span className="text-[11px] font-black">{Math.round((currentPage/totalPages)*100)}%</span>
      </footer>
    </div>
  );
}
