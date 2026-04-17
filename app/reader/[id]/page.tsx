"use client";

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { ArrowLeft, Loader2, Sparkles, User, X, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import TurboReader from '@/components/TurboReader';

type ThemeType = 'default' | 'sepia' | 'comfort';

export default function ReaderPage() {
  const { id } = useParams();
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

  // Estados para o Modo Turbo
  const [isTurboMode, setIsTurboMode] = useState(false);
  const [pageText, setPageText] = useState("");

  // Ref para controle de leitura e tempo
  const viewerRef = useRef<HTMLDivElement>(null);
  const renditionRef = useRef<any>(null);
  const startTimeRef = useRef<number>(Date.now());
  const hasUpdatedStreak = useRef(false);

  useEffect(() => {
    const fetchBook = async () => {
      const { data } = await supabase.from('books').select('*').eq(id).single();
      if (data) {
        setBook(data);
        setIsEpub(data.pdf_url.toLowerCase().endsWith('.epub'));
      }
    };
    fetchBook();
  }, [id]);

  // Lógica silenciosa do Streak (Chama)
  const updateReadingStreak = async () => {
    if (hasUpdatedStreak.current) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const { data: stats } = await supabase.from('user_stats').select('*').eq('user_id', user.id).maybeSingle();

    if (stats) {
      if (stats.last_read_date === today) return;

      let newStreak = 1;
      if (stats.last_read_date === yesterdayStr) {
        newStreak = stats.streak_count + 1;
      }
      await supabase.from('user_stats').update({ streak_count: newStreak, last_read_date: today }).eq('user_id', user.id);
    } else {
      await supabase.from('user_stats').insert({ user_id: user.id, streak_count: 1, last_read_date: today });
    }
    hasUpdatedStreak.current = true;
  };

  const calculateTimeRemaining = (currentLoc: number, totalLocs: number) => {
    const now = Date.now();
    const secondsSpent = (now - startTimeRef.current) / 1000;
    startTimeRef.current = now;

    const pagesRemaining = totalLocs - currentLoc;
    if (pagesRemaining <= 0) return "Fim do livro";

    const estSecondsPerPage = secondsSpent > 8 ? secondsSpent : 30;
    const totalSecondsRemaining = pagesRemaining * estSecondsPerPage;
    const minutes = Math.ceil(totalSecondsRemaining / 60);

    if (minutes < 1) return "Menos de 1 min";
    if (minutes > 60) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
    return `${minutes} min para o fim`;
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
        const rendition = bookInstance.renderTo(viewerRef.current, {
          width: "100%", height: "100%", flow: "paginated"
        });
        renditionRef.current = rendition;

        rendition.hooks.content.register((contents: any) => {
          const style = contents.document.createElement("style");
          style.innerHTML = `::selection { background: rgba(0,0,0,0.1); }`;
          contents.document.head.appendChild(style);
        });

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
            const savedPage = book.current_page || 0;
            const percentage = savedPage / (bookInstance.locations.length() || 1);
            await rendition.display(bookInstance.locations.cfiFromPercentage(percentage));
            setLoadingReader(false);
            
            setTimeout(() => { if(isMounted) updateReadingStreak(); }, 30000);
          }
        });

        rendition.on("relocated", async (location: any) => {
          if (!isMounted) return;

          // Extrai o texto da página atual para o TurboReader
          try {
            const range = renditionRef.current.getRange(location.start.cfi);
            setPageText(range.toString());
          } catch (e) { console.warn("Falha ao extrair texto da página"); }

          const percent = bookInstance.locations.percentageFromCfi(location.start.cfi);
          const currentLoc = Math.floor(percent * bookInstance.locations.length()) || 1;
          setCurrentPage(currentLoc);
          setTimeLeft(calculateTimeRemaining(currentLoc, bookInstance.locations.length()));

          await supabase.from('books').update({ 
            current_page: currentLoc, 
            total_pages: bookInstance.locations.length() 
          }).eq('id', id);
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
    } catch (e) { setAiResponse("Erro ao conectar ao Mentor."); }
    finally { setLoadingAi(false); }
  };

  return (
    <div className={`h-screen flex flex-col transition-colors duration-500 overflow-hidden 
      ${theme === 'comfort' ? 'bg-[#121212]' : theme === 'sepia' ? 'bg-[#F4ECD8]' : 'bg-[#F8F9F7]'}`}>
      
      <header className={`px-6 py-4 border-b flex justify-between items-center z-30 
        ${theme === 'comfort' ? 'bg-[#1A1A1A] border-stone-800' : 'bg-white/80 backdrop-blur-md border-stone-200'}`}>
        
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="text-stone-400 hover:text-black transition-colors">
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-[10px] font-black uppercase tracking-widest opacity-40 truncate max-w-[150px]">
            {book?.title}
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <AnimatePresence>
            {selectedText && !isTurboMode && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="flex gap-2">
                <button onClick={() => callAi('insight')} className="bg-black text-white px-4 py-2 rounded-full shadow-xl flex items-center gap-2">
                  <Sparkles size={12} className="text-orange-300" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Insight</span>
                </button>
                <button onClick={() => callAi('persona')} className="bg-white text-stone-600 px-4 py-2 rounded-full border border-stone-200 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                  <User size={12} />Persona
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center gap-2">
            {/* Botão Modo Turbo */}
            <button 
              onClick={() => setIsTurboMode(true)}
              className="p-2.5 rounded-full bg-stone-100 text-stone-500 hover:bg-black hover:text-white transition-all duration-300"
              title="Modo Turbo"
            >
              <Zap size={16} />
            </button>

            <div className="flex bg-stone-100 p-1 rounded-full border border-stone-200">
              <button onClick={() => {setTheme('default'); renditionRef.current?.themes.select('default');}} className={`w-6 h-6 rounded-full border-2 ${theme === 'default' ? 'border-blue-400' : 'border-transparent'} bg-white`} />
              <button onClick={() => {setTheme('sepia'); renditionRef.current?.themes.select('sepia');}} className={`w-6 h-6 rounded-full border-2 ${theme === 'sepia' ? 'border-orange-400' : 'border-transparent'} bg-[#F4ECD8]`} />
              <button onClick={() => {setTheme('comfort'); renditionRef.current?.themes.select('comfort');}} className={`w-6 h-6 rounded-full border-2 ${theme === 'comfort' ? 'border-stone-400' : 'border-transparent'} bg-[#1A1A1A]`} />
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 relative flex items-center justify-center">
        {loadingReader && <div className="absolute inset-0 flex items-center justify-center z-50 bg-[#F8F9F7]"><Loader2 className="animate-spin text-stone-200" size={40} /></div>}
        <div ref={viewerRef} className={`h-full w-full max-w-4xl transition-all ${theme === 'comfort' ? 'bg-[#1A1A1A]' : 'bg-white'}`} />
        
        <button onClick={() => renditionRef.current?.prev()} className="absolute left-0 h-full w-[15%] z-10" />
        <button onClick={() => renditionRef.current?.next()} className="absolute right-0 h-full w-[15%] z-10" />

        <AnimatePresence>
          {isDrawerOpen && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsDrawerOpen(false)} className="absolute inset-0 bg-black/20 backdrop-blur-sm z-[50]" />
              <motion.div 
                initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
                className={`absolute right-0 top-0 h-full w-full max-md z-[60] shadow-2xl p-10 flex flex-col ${theme === 'comfort' ? 'bg-[#1A1A1A] text-stone-300' : 'bg-white text-stone-800'}`}
              >
                <div className="flex justify-between items-center mb-10">
                  <div className="flex items-center gap-3">
                    {activeTab === 'insight' ? <Sparkles size={18} className="text-orange-400" /> : <User size={18} className="text-blue-400" />}
                    <h3 className="text-xs font-black uppercase tracking-widest">{activeTab === 'insight' ? 'Análise do Mentor' : 'Visualização Persona'}</h3>
                  </div>
                  <button onClick={() => setIsDrawerOpen(false)} className="p-2 hover:bg-stone-100 rounded-full transition-colors"><X size={24} /></button>
                </div>

                <div className="flex-1 overflow-y-auto pr-4 custom-scrollbar">
                  <div className={`p-5 rounded-3xl mb-8 border ${theme === 'comfort' ? 'bg-stone-900 border-stone-800' : 'bg-stone-50 border-stone-100'}`}>
                    <p className="text-[10px] font-black uppercase text-stone-400 mb-3 tracking-tighter">Trecho Selecionado</p>
                    <p className="text-lg font-serif italic leading-relaxed opacity-80">"{selectedText}"</p>
                  </div>

                  {loadingAi ? (
                    <div className="py-20 flex flex-col items-center gap-4">
                      <Loader2 className="animate-spin text-stone-300" size={40} />
                      <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Consultando Llama 3.1...</p>
                    </div>
                  ) : (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="font-serif text-xl leading-loose">
                      {aiResponse}
                    </motion.div>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Modal do Turbo Reader */}
        <AnimatePresence>
          {isTurboMode && (
            <TurboReader 
              text={pageText} 
              onClose={() => setIsTurboMode(false)} 
            />
          )}
        </AnimatePresence>
      </main>

      <footer className={`px-10 py-6 border-t flex items-center justify-between gap-10 
        ${theme === 'comfort' ? 'bg-[#1A1A1A] border-stone-800 text-stone-500' : 'bg-white border-stone-100 text-stone-400'}`}>
        
        <div className="flex flex-col">
          <span className="text-[11px] font-black uppercase tracking-tighter text-stone-800 dark:text-stone-200">
            Pág. {currentPage} de {totalPages}
          </span>
          <span className="text-[9px] font-bold uppercase opacity-60">
            {timeLeft}
          </span>
        </div>

        <div className="flex-1 h-[2px] bg-stone-100 rounded-full overflow-hidden relative">
          <motion.div 
            className={`h-full ${theme === 'comfort' ? 'bg-stone-600' : 'bg-black'}`}
            initial={{ width: 0 }}
            animate={{ width: `${(currentPage / (totalPages || 1)) * 100}%` }}
            transition={{ duration: 1 }}
          />
        </div>

        <span className="text-[11px] font-black">{Math.round((currentPage / (totalPages || 1)) * 100)}%</span>
      </footer>
    </div>
  );
}
