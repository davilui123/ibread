"use client";

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { ArrowLeft, Settings, Loader2, BookOpen, Sun, Moon, Sparkles, X } from 'lucide-react';
import { motion } from 'framer-motion';

export default function ReaderPage() {
  const { id } = useParams();
  const router = useRouter();
  const [book, setBook] = useState<any>(null);
  const [isEpub, setIsEpub] = useState(false);
  const [loadingReader, setLoadingReader] = useState(true);
  const [isComfortMode, setIsComfortMode] = useState(false);
  
  // Estados da IA
  const [selectedText, setSelectedText] = useState("");
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [showAiMenu, setShowAiMenu] = useState(false);
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
    let bookInstance: any = null;

    async function init() {
      try {
        const ePubModule = await import('epubjs');
        const ePub = (ePubModule as any).default || ePubModule;
        const { data: { publicUrl } } = supabase.storage.from('pdfs').getPublicUrl(book.pdf_url);
        const response = await fetch(publicUrl);
        const buffer = await response.arrayBuffer();

        if (!isMounted) return;
        bookInstance = ePub(buffer);
        await bookInstance.opened;

        const rendition = bookInstance.renderTo(viewerRef.current, {
          width: "100%", height: "100%", flow: "paginated", manager: "default"
        });
        renditionRef.current = rendition;

        // INJEÇÃO DE CSS PARA PERMITIR SELEÇÃO
        rendition.hooks.content.register((contents: any) => {
          const style = contents.document.createElement("style");
          style.innerHTML = `
            ::selection { background: rgba(0, 0, 0, 0.1) !important; }
            * { -webkit-user-select: text !important; user-select: text !important; cursor: text !important; }
          `;
          contents.document.head.appendChild(style);
        });

        // LÓGICA DE SELEÇÃO PARA IA
        rendition.on("selected", (cfiRange: string, contents: any) => {
          const selection = contents.window.getSelection();
          const text = selection.toString().trim();
          
          if (text && text.length > 2) {
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            const iframeRect = viewerRef.current?.getBoundingClientRect();

            if (iframeRect) {
              setSelectedText(text);
              setMenuPosition({
                top: rect.top + iframeRect.top - 60,
                left: rect.left + iframeRect.left + (rect.width / 2)
              });
              setShowAiMenu(true);
            }
          }
        });

        rendition.on("click", () => setShowAiMenu(false));

        bookInstance.ready.then(async () => {
          await bookInstance.locations.generate(1000);
          if (isMounted) {
            const totalLocs = bookInstance.locations.length();
            const savedPage = book.current_page || 0;
            const percentage = savedPage / (book.total_pages || totalLocs || 1);
            if (percentage > 0 && percentage < 1) {
              await rendition.display(bookInstance.locations.cfiFromPercentage(percentage));
            } else {
              await rendition.display();
            }
            setLoadingReader(false);
          }
        });

        rendition.themes.default({
          body: { "font-family": "serif !important", "color": "#1A1A1A !important", "padding": "40px !important" }
        });
        rendition.themes.register("comfort", {
          body: { "background": "#1A1A1A !important", "color": "#D1D1D1 !important" }
        });

        rendition.on("relocated", async (location: any) => {
          if (!isMounted) return;
          const percent = bookInstance.locations.percentageFromCfi(location.start.cfi);
          const totalLocs = bookInstance.locations.length();
          const calculatedPage = Math.floor(percent * totalLocs) || 1;
          await supabase.from('books').update({ current_page: calculatedPage }).eq('id', id);
        });
      } catch (err) { setLoadingReader(false); }
    }
    init();
    return () => { isMounted = false; renditionRef.current?.destroy(); };
  }, [isEpub, book, id]);

  const handleAiAction = async (action: 'explain' | 'summarize') => {
    setShowAiMenu(false);
    setLoadingAi(true);
    setAiResponse("");

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: selectedText, action })
      });
      const data = await res.json();
      setAiResponse(data.result);
    } catch (error) {
      setAiResponse("Erro ao consultar a IA.");
    } finally {
      setLoadingAi(false);
    }
  };

  if (!book) return <div className="h-screen flex items-center justify-center bg-[#F8F9F7]"><Loader2 className="animate-spin text-stone-300" /></div>;

  return (
    <div className={`h-screen flex flex-col transition-colors duration-500 ${isComfortMode ? 'bg-[#121212]' : 'bg-[#F8F9F7]'}`}>
      
      {/* MENU FLUTUANTE IA (Z-INDEX ALTO) */}
      {showAiMenu && (
        <div 
          className="fixed z-[100] bg-black text-white rounded-xl shadow-2xl flex items-center px-3 py-2 gap-3 border border-white/10"
          style={{ top: `${menuPosition.top}px`, left: `${menuPosition.left}px`, transform: 'translateX(-50%)' }}
        >
          <button onClick={() => handleAiAction('explain')} className="text-[9px] font-black uppercase tracking-widest flex items-center gap-2 hover:text-blue-400 transition-colors">
              <Sparkles size={12} /> Explicar
          </button>
          <div className="w-[1px] h-3 bg-white/20" />
          <button onClick={() => handleAiAction('summarize')} className="text-[9px] font-black uppercase tracking-widest hover:text-green-400 transition-colors">Resumir</button>
        </div>
      )}

      {/* HEADER */}
      <header className={`px-6 py-4 border-b flex justify-between items-center z-30 ${isComfortMode ? 'bg-[#1A1A1A] border-stone-800' : 'bg-white/80 backdrop-blur-md border-stone-200'}`}>
        <button onClick={() => router.back()} className="p-2 text-stone-400 hover:text-black"><ArrowLeft size={20} /></button>
        <h2 className={`text-[10px] font-black uppercase tracking-[0.2em] truncate max-w-[40%] ${isComfortMode ? 'text-stone-500' : 'text-stone-400'}`}>{book?.title}</h2>
        <button onClick={() => {
          setIsComfortMode(!isComfortMode);
          renditionRef.current?.themes.select(!isComfortMode ? "comfort" : "default");
        }} className={`p-2 rounded-full ${isComfortMode ? 'text-yellow-500' : 'text-stone-400'}`}>
           {isComfortMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </header>

      <main className="flex-1 relative flex items-center justify-center overflow-hidden">
        {loadingReader && <div className="absolute inset-0 flex items-center justify-center z-50 bg-[#F8F9F7]"><BookOpen className="text-stone-200 animate-pulse" size={40} /></div>}
        
        <div ref={viewerRef} className={`h-full w-full max-w-3xl relative ${isComfortMode ? 'bg-[#1A1A1A]' : 'bg-white shadow-2xl'}`} />
        
        {/* ZONAS DE NAVEGAÇÃO LATERAIS REDUZIDAS */}
        <div onClick={() => renditionRef.current?.prev()} className="absolute left-0 top-0 h-full w-[8%] z-40 cursor-w-resize" />
        <div onClick={() => renditionRef.current?.next()} className="absolute right-0 top-0 h-full w-[8%] z-40 cursor-e-resize" />
      </main>

      {/* MODAL DE RESPOSTA DA IA */}
      {(loadingAi || aiResponse) && (
        <div className="fixed inset-0 z-[110] bg-black/40 backdrop-blur-sm flex items-center justify-center p-6">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl relative">
            <button onClick={() => {setAiResponse(""); setLoadingAi(false)}} className="absolute top-4 right-4 text-stone-300 hover:text-black"><X size={20} /></button>
            <div className="flex items-center gap-2 mb-4">
                <div className="bg-black p-1.5 rounded-lg"><Sparkles size={12} className="text-white" /></div>
                <h3 className="text-[10px] font-black uppercase tracking-widest">Insight IA</h3>
            </div>
            {loadingAi ? (
              <div className="flex flex-col items-center py-8"><Loader2 className="animate-spin text-stone-200" size={32} /></div>
            ) : (
              <div className="max-h-[50vh] overflow-y-auto text-stone-600 font-serif text-lg leading-relaxed italic">{aiResponse}</div>
            )}
          </motion.div>
        </div>
      )}

      {/* FOOTER */}
      <footer className={`px-8 py-5 border-t flex items-center justify-between gap-6 ${isComfortMode ? 'bg-[#1A1A1A] border-stone-800' : 'bg-white border-stone-100'}`}>
        <span className={`text-[10px] font-black ${isComfortMode ? 'text-stone-400' : 'text-stone-800'}`}>Pág. {book?.current_page || 0}</span>
        <div className="flex-1 max-w-xs h-1.5 bg-stone-200/20 rounded-full overflow-hidden">
          <div className={`h-full bg-black transition-all duration-700 ${isComfortMode ? 'bg-stone-400' : 'bg-black'}`} style={{ width: `${((book?.current_page || 1) / (book?.total_pages || 100)) * 100}%` }} />
        </div>
        <span className={`text-[10px] font-black ${isComfortMode ? 'text-stone-400' : 'text-stone-800'}`}>{Math.round(((book?.current_page || 0) / (book?.total_pages || 1)) * 100)}%</span>
      </footer>
    </div>
  );
}