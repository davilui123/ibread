"use client";

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { ArrowLeft, Loader2, BookOpen, Sun, Moon, Sparkles, X, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ReaderPage() {
  const { id } = useParams();
  const router = useRouter();
  const [book, setBook] = useState<any>(null);
  const [isEpub, setIsEpub] = useState(false);
  const [loadingReader, setLoadingReader] = useState(true);
  const [isComfortMode, setIsComfortMode] = useState(false);
  
  // Estados da IA Integrada
  const [selectedText, setSelectedText] = useState("");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [aiResponse, setAiResponse] = useState("");
  const [loadingAi, setLoadingAi] = useState(false);

  const viewerRef = useRef<HTMLDivElement>(null);
  const renditionRef = useRef<any>(null);

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

        // Injeção de CSS para marcação de seleção visível
        rendition.hooks.content.register((contents: any) => {
          const style = contents.document.createElement("style");
          style.innerHTML = `
            ::selection { background: rgba(0, 0, 0, 0.08) !important; color: inherit; }
            * { -webkit-user-select: text !important; user-select: text !important; }
          `;
          contents.document.head.appendChild(style);
        });

        // Captura de seleção para a barra superior
        rendition.on("selected", (cfiRange: string, contents: any) => {
          const text = contents.window.getSelection().toString().trim();
          if (text.length > 2) {
            setSelectedText(text);
          }
        });

        rendition.on("click", () => {
          if (!isDrawerOpen) setSelectedText("");
        });

        bookInstance.ready.then(async () => {
          await bookInstance.locations.generate(1000);
          const savedPage = book.current_page || 0;
          const percentage = savedPage / (book.total_pages || bookInstance.locations.length() || 1);
          await rendition.display(bookInstance.locations.cfiFromPercentage(percentage > 0 ? percentage : 0));
          setLoadingReader(false);
        });

        rendition.themes.default({
          body: { "font-family": "serif !important", "color": "#1A1A1A !important", "padding": "40px !important" }
        });
        rendition.themes.register("comfort", {
          body: { "background": "#1A1A1A !important", "color": "#D1D1D1 !important" }
        });

        rendition.on("relocated", async (location: any) => {
          const percent = bookInstance.locations.percentageFromCfi(location.start.cfi);
          const calculatedPage = Math.floor(percent * bookInstance.locations.length()) || 1;
          await supabase.from('books').update({ current_page: calculatedPage }).eq('id', id);
        });
      } catch (err) { setLoadingReader(false); }
    }
    init();
    return () => { isMounted = false; renditionRef.current?.destroy(); };
  }, [isEpub, book, id]);

  const askAi = async () => {
    setIsDrawerOpen(true);
    setLoadingAi(true);
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: selectedText, bookTitle: book.title, action: 'analyze' })
      });
      const data = await res.json();
      setAiResponse(data.result);
    } catch (error) {
      setAiResponse("O Mentor de Contexto está indisponível no momento.");
    } finally {
      setLoadingAi(false);
    }
  };

  return (
    <div className={`h-screen flex flex-col transition-colors duration-500 ${isComfortMode ? 'bg-[#121212]' : 'bg-[#F8F9F7]'} overflow-hidden`}>
      
      {/* HEADER INTEGRADO */}
      <header className={`px-6 py-4 border-b flex justify-between items-center z-30 ${isComfortMode ? 'bg-[#1A1A1A] border-stone-800' : 'bg-white/80 backdrop-blur-md border-stone-200'}`}>
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="text-stone-400 hover:text-black transition-colors"><ArrowLeft size={20} /></button>
          <h2 className={`text-[10px] font-black uppercase tracking-[0.2em] truncate max-w-[150px] ${isComfortMode ? 'text-stone-500' : 'text-stone-400'}`}>{book?.title}</h2>
        </div>

        <div className="flex items-center gap-3">
          <AnimatePresence>
            {selectedText && (
              <motion.button
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                onClick={askAi}
                className="flex items-center gap-2 bg-black text-white px-3 py-1.5 rounded-full shadow-lg"
              >
                <Sparkles size={14} className="animate-pulse" />
                <span className="text-[9px] font-black uppercase tracking-widest">Insight</span>
              </motion.button>
            )}
          </AnimatePresence>
          <button onClick={() => {
            setIsComfortMode(!isComfortMode);
            renditionRef.current?.themes.select(!isComfortMode ? "comfort" : "default");
          }} className={`p-2 rounded-full ${isComfortMode ? 'text-yellow-500 bg-stone-800' : 'text-stone-400'}`}>
             {isComfortMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </header>

      <main className="flex-1 relative flex items-center justify-center">
        <div ref={viewerRef} className={`h-full w-full max-w-3xl relative transition-all ${isComfortMode ? 'bg-[#1A1A1A]' : 'bg-white shadow-sm'}`} />
        
        {/* NAVEGAÇÃO LATERAL DISCRETA */}
        <button onClick={() => renditionRef.current?.prev()} className="absolute left-0 h-full w-[10%] z-10 cursor-w-resize" />
        <button onClick={() => renditionRef.current?.next()} className="absolute right-0 h-full w-[10%] z-10 cursor-e-resize" />

        {/* DRAWER LATERAL DE INSIGHTS */}
        <AnimatePresence>
          {isDrawerOpen && (
            <>
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setIsDrawerOpen(false)}
                className="absolute inset-0 bg-black/20 backdrop-blur-[2px] z-[50]"
              />
              <motion.div 
                initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className={`absolute right-0 top-0 h-full w-full max-w-sm z-[60] shadow-2xl p-8 flex flex-col ${isComfortMode ? 'bg-[#1A1A1A] text-stone-300' : 'bg-white text-stone-800'}`}
              >
                <div className="flex justify-between items-center mb-8">
                  <div className="flex items-center gap-2">
                    <Sparkles size={16} className="text-stone-400" />
                    <h3 className="text-[10px] font-black uppercase tracking-widest">Mentor de Contexto</h3>
                  </div>
                  <button onClick={() => setIsDrawerOpen(false)} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
                    <X size={20} className="text-stone-300" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-6 pr-2 custom-scrollbar">
                  <div className="p-4 bg-stone-50 rounded-2xl border border-stone-100">
                    <p className="text-[10px] font-bold text-stone-400 uppercase mb-2">Trecho Selecionado</p>
                    <p className="text-sm italic font-serif leading-relaxed opacity-70">"{selectedText}"</p>
                  </div>

                  {loadingAi ? (
                    <div className="flex flex-col items-center justify-center py-20 space-y-4">
                      <Loader2 className="animate-spin text-stone-200" size={32} />
                      <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Sincronizando Insights...</p>
                    </div>
                  ) : (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="prose prose-stone">
                      <p className="font-serif text-lg leading-relaxed first-letter:text-3xl first-letter:font-bold">
                        {aiResponse}
                      </p>
                    </motion.div>
                  )}
                </div>
                
                <button 
                   onClick={() => setIsDrawerOpen(false)}
                   className="mt-8 w-full py-4 bg-black text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-stone-800 transition-all"
                >
                  Continuar Leitura
                </button>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </main>

      {/* FOOTER MINIMALISTA */}
      <footer className={`px-8 py-5 border-t flex items-center justify-between gap-6 transition-colors ${isComfortMode ? 'bg-[#1A1A1A] border-stone-800' : 'bg-white border-stone-100'}`}>
        <span className={`text-[10px] font-black uppercase ${isComfortMode ? 'text-stone-500' : 'text-stone-800'}`}>Pág. {book?.current_page || 0}</span>
        <div className="flex-1 max-w-xs h-1 bg-stone-100 rounded-full overflow-hidden">
          <div className={`h-full transition-all duration-700 ${isComfortMode ? 'bg-stone-600' : 'bg-black'}`} style={{ width: `${((book?.current_page || 1) / (book?.total_pages || 100)) * 100}%` }} />
        </div>
        <span className={`text-[10px] font-black ${isComfortMode ? 'text-stone-500' : 'text-stone-800'}`}>{Math.round(((book?.current_page || 0) / (book?.total_pages || 1)) * 100)}%</span>
      </footer>
    </div>
  );
}