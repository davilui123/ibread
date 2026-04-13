"use client";

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { ArrowLeft, Loader2, BookOpen, Sun, Moon, Sparkles, X, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type ThemeType = 'default' | 'sepia' | 'comfort';

export default function ReaderPage() {
  const { id } = useParams();
  const router = useRouter();
  const [book, setBook] = useState<any>(null);
  const [isEpub, setIsEpub] = useState(false);
  const [loadingReader, setLoadingReader] = useState(true);
  const [theme, setTheme] = useState<ThemeType>('default');
  
  // Estados de IA e Personagens
  const [selectedText, setSelectedText] = useState("");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [aiResponse, setAiResponse] = useState("");
  const [loadingAi, setLoadingAi] = useState(false);
  const [activeTab, setActiveTab] = useState<'insight' | 'persona'>('insight');
  
  // Estados de Paginação e Tempo
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [timeLeft, setTimeLeft] = useState<string>("Calculando...");

  const viewerRef = useRef<HTMLDivElement>(null);
  const renditionRef = useRef<any>(null);
  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    const fetchBook = async () => {
      const { data } = await supabase.from('books').select('*').eq('id', id).single();
      if (data) {
        setBook(data);
        setIsEpub(data.pdf_url.toLowerCase().endsWith('.epub'));
      }
    };
    fetchBook();
  }, [id]);

  // Estimativa de Tempo de Leitura (WPM Adaptativo)
  const calculateTimeRemaining = (currentLoc: number, totalLocs: number) => {
    const now = Date.now();
    const secondsSpent = (now - startTimeRef.current) / 1000;
    startTimeRef.current = now; // Reseta para a próxima página

    const pagesRemaining = totalLocs - currentLoc;
    if (pagesRemaining <= 0) return "Fim do livro";

    // Mínimo de 10s para evitar cálculos malucos em cliques rápidos
    const estimatedSecondsPerPage = secondsSpent > 10 ? secondsSpent : 35;
    const totalSecondsRemaining = pagesRemaining * estimatedSecondsPerPage;

    const minutes = Math.ceil(totalSecondsRemaining / 60);
    if (minutes < 1) return "Menos de 1 min para o fim";
    if (minutes > 60) return `${Math.floor(minutes / 60)}h ${minutes % 60}m para o fim`;
    return `${minutes} min para o fim do capítulo`;
  };

  const handleCharacters = async (bookData: any) => {
    try {
      let charList = bookData.characters;
      if (!charList) {
        const res = await fetch('/api/books/scan-characters', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bookTitle: bookData.title, author: bookData.author || "Desconhecido" })
        });
        charList = await res.json();
        await supabase.from('books').update({ characters: charList }).eq('id', id);
      }
    } catch (e) { console.error(e); }
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
        const response = await fetch(publicUrl);
        const buffer = await response.arrayBuffer();

        if (!isMounted) return;
        const bookInstance = ePub(buffer);
        await bookInstance.opened;

        const rendition = bookInstance.renderTo(viewerRef.current, {
          width: "100%", height: "100%", flow: "paginated", manager: "default"
        });
        renditionRef.current = rendition;

        rendition.hooks.content.register((contents: any) => {
          const style = contents.document.createElement("style");
          style.innerHTML = `
            ::selection { background: rgba(0, 0, 0, 0.1) !important; }
            .character-link { border-bottom: 1px dashed #A8A29E !important; cursor: pointer !important; }
          `;
          contents.document.head.appendChild(style);
        });

        rendition.on("selected", (cfiRange: string, contents: any) => {
          const text = contents.window.getSelection().toString().trim();
          if (text.length > 2) setSelectedText(text);
        });

        rendition.on("click", () => { if (!isDrawerOpen) setSelectedText(""); });

        // Temas
        rendition.themes.default({ body: { "font-family": "serif !important", "padding": "40px !important" } });
        rendition.themes.register("sepia", { body: { "background": "#F4ECD8 !important", "color": "#5B4636 !important" } });
        rendition.themes.register("comfort", { body: { "background": "#1A1A1A !important", "color": "#D1D1D1 !important" } });

        bookInstance.ready.then(async () => {
          // O PULO DO GATO: Gera localizações para o contador funcionar
          await bookInstance.locations.generate(1024); 
          if (isMounted) {
            const total = bookInstance.locations.length();
            setTotalPages(total);
            const savedPage = book.current_page || 0;
            const percentage = savedPage / (total || 1);
            await rendition.display(bookInstance.locations.cfiFromPercentage(percentage > 0 ? percentage : 0));
            setLoadingReader(false);
            handleCharacters(book);
          }
        });

        rendition.on("relocated", async (location: any) => {
          if (!isMounted) return;
          const percent = bookInstance.locations.percentageFromCfi(location.start.cfi);
          const currentLoc = Math.floor(percent * bookInstance.locations.length()) || 1;
          
          setCurrentPage(currentLoc);
          setTimeLeft(calculateTimeRemaining(currentLoc, bookInstance.locations.length()));

          await supabase.from('books').update({ 
            current_page: currentLoc,
            total_pages: bookInstance.locations.length() 
          }).eq('id', id);
        });
      } catch (err) { setLoadingReader(false); }
    }
    init();
    return () => { isMounted = false; renditionRef.current?.destroy(); };
  }, [isEpub, book, id]);

  const callAi = async (mode: 'insight' | 'persona') => {
    setActiveTab(mode);
    setIsDrawerOpen(true);
    setLoadingAi(true);
    setAiResponse("");
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: selectedText, bookTitle: book.title, action: mode === 'persona' ? 'persona' : 'analyze' })
      });
      const data = await res.json();
      setAiResponse(data.result || data.error);
    } catch (e) { setAiResponse("Erro na conexão."); }
    finally { setLoadingAi(false); }
  };

  return (
    <div className={`h-screen flex flex-col transition-colors duration-500 overflow-hidden 
      ${theme === 'comfort' ? 'bg-[#121212]' : theme === 'sepia' ? 'bg-[#F4ECD8]' : 'bg-[#F8F9F7]'}`}>
      
      <header className={`px-6 py-4 border-b flex justify-between items-center z-30 transition-colors duration-500
        ${theme === 'comfort' ? 'bg-[#1A1A1A] border-stone-800' : 
          theme === 'sepia' ? 'bg-[#E8DFCA] border-[#D6CBB3]' : 'bg-white/80 backdrop-blur-md border-stone-200'}`}>
        
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="text-stone-400 hover:text-black"><ArrowLeft size={20} /></button>
          <h2 className={`text-[10px] font-black uppercase tracking-[0.2em] truncate max-w-[120px] 
            ${theme === 'comfort' ? 'text-stone-500' : 'text-stone-400'}`}>{book?.title}</h2>
        </div>

        <div className="flex items-center gap-3">
          <AnimatePresence>
            {selectedText && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="flex gap-2">
                <button onClick={() => callAi('insight')} className="bg-black text-white px-3 py-1.5 rounded-full shadow-lg flex items-center gap-2">
                  <Sparkles size={12} className="animate-pulse" /><span className="text-[9px] font-black uppercase tracking-widest">Insight</span>
                </button>
                <button onClick={() => callAi('persona')} className="bg-white/50 text-stone-600 px-3 py-1.5 rounded-full border border-stone-200 text-[9px] font-black uppercase tracking-widest flex items-center gap-2">
                  <User size={12} />Persona
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex bg-stone-100/50 p-1 rounded-full gap-1 border border-stone-200/50">
            <button onClick={() => {setTheme('default'); renditionRef.current?.themes.select('default');}} className={`w-6 h-6 rounded-full border-2 ${theme === 'default' ? 'border-blue-400 bg-white' : 'border-transparent bg-white'}`} />
            <button onClick={() => {setTheme('sepia'); renditionRef.current?.themes.select('sepia');}} className={`w-6 h-6 rounded-full border-2 ${theme === 'sepia' ? 'border-orange-400 bg-[#F4ECD8]' : 'border-transparent bg-[#F4ECD8]'}`} />
            <button onClick={() => {setTheme('comfort'); renditionRef.current?.themes.select('comfort');}} className={`w-6 h-6 rounded-full border-2 ${theme === 'comfort' ? 'border-stone-400 bg-[#1A1A1A]' : 'border-transparent bg-[#1A1A1A]'}`} />
          </div>
        </div>
      </header>

      <main className="flex-1 relative flex items-center justify-center">
        {loadingReader && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-50 bg-[#F8F9F7]">
                <Loader2 className="animate-spin text-stone-200" size={40} />
            </div>
        )}

        <div ref={viewerRef} className={`h-full w-full max-w-3xl relative transition-all 
          ${theme === 'comfort' ? 'bg-[#1A1A1A]' : theme === 'sepia' ? 'bg-[#F4ECD8]' : 'bg-white shadow-sm'}`} />
        
        <button onClick={() => renditionRef.current?.prev()} className="absolute left-0 h-full w-[10%] z-10 cursor-w-resize" />
        <button onClick={() => renditionRef.current?.next()} className="absolute right-0 h-full w-[10%] z-10 cursor-e-resize" />

        <AnimatePresence>
          {isDrawerOpen && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsDrawerOpen(false)} className="absolute inset-0 bg-black/10 backdrop-blur-[1px] z-[50]" />
              <motion.div 
                initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
                className={`absolute right-0 top-0 h-full w-full max-w-sm z-[60] shadow-2xl p-8 flex flex-col transition-colors duration-500
                ${theme === 'comfort' ? 'bg-[#1A1A1A] text-stone-300' : theme === 'sepia' ? 'bg-[#E8DFCA] text-[#5B4636]' : 'bg-white text-stone-800'}`}
              >
                <div className="flex justify-between items-center mb-8">
                  <div className="flex items-center gap-2">
                    {activeTab === 'insight' ? <Sparkles size={16} className="text-stone-400" /> : <User size={16} className="text-stone-400" />}
                    <h3 className="text-[10px] font-black uppercase tracking-widest">{activeTab === 'insight' ? 'Mentor de Contexto' : 'Persona Visualizer'}</h3>
                  </div>
                  <button onClick={() => setIsDrawerOpen(false)}><X size={20} className="text-stone-300" /></button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-6">
                  <div className={`p-4 rounded-2xl border transition-colors ${theme === 'comfort' ? 'bg-stone-900 border-stone-800' : 'bg-stone-50/50 border-stone-100'}`}>
                    <p className="text-[9px] font-black uppercase text-stone-400 mb-2">Trecho Ativo</p>
                    <p className="text-sm italic font-serif opacity-70">"{selectedText}"</p>
                  </div>

                  {loadingAi ? (
                    <div className="flex flex-col items-center justify-center py-20"><Loader2 className="animate-spin text-stone-200" size={32} /></div>
                  ) : (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="prose prose-stone">
                      <p className="font-serif text-lg leading-relaxed whitespace-pre-line">{aiResponse}</p>
                    </motion.div>
                  )}
                </div>
                
                <button onClick={() => setIsDrawerOpen(false)} className={`mt-8 w-full py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${theme === 'comfort' ? 'bg-stone-800 text-white' : 'bg-black text-white'}`}>
                  Continuar Leitura
                </button>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </main>

      {/* FOOTER MULTIFUNCIONAL */}
      <footer className={`px-8 py-5 border-t flex items-center justify-between gap-6 transition-colors duration-500
        ${theme === 'comfort' ? 'bg-[#1A1A1A] border-stone-800' : 
          theme === 'sepia' ? 'bg-[#E8DFCA] border-[#D6CBB3]' : 'bg-white border-stone-100'}`}>
        
        <div className="flex flex-col min-w-[100px]">
            <span className={`text-[10px] font-black uppercase ${theme === 'comfort' ? 'text-stone-500' : 'text-stone-800'}`}>
                Pág. {currentPage} de {totalPages}
            </span>
            <span className="text-[8px] text-stone-400 font-bold uppercase tracking-tighter">
                {timeLeft}
            </span>
        </div>

        <div className="flex-1 max-w-xs h-1 bg-stone-200/30 rounded-full overflow-hidden relative">
          <div className={`h-full transition-all duration-700 ${theme === 'comfort' ? 'bg-stone-600' : theme === 'sepia' ? 'bg-[#5B4636]' : 'bg-black'}`} 
               style={{ width: `${(currentPage / (totalPages || 1)) * 100}%` }} />
        </div>

        <span className={`text-[10px] font-black ${theme === 'comfort' ? 'text-stone-500' : 'text-stone-800'}`}>
          {Math.round((currentPage / (totalPages || 1)) * 100)}%
        </span>
      </footer>
    </div>
  );
}
