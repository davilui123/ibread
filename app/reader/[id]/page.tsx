"use client";

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { ArrowLeft, Settings, Loader2, BookOpen, Sun, Moon } from 'lucide-react';

export default function ReaderPage() {
  const { id } = useParams();
  const router = useRouter();
  const [book, setBook] = useState<any>(null);
  const [isEpub, setIsEpub] = useState(false);
  const [loadingReader, setLoadingReader] = useState(true);
  const [isComfortMode, setIsComfortMode] = useState(false); // Novo: Modo conforto opcional
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

        bookInstance.ready.then(async () => {
          await bookInstance.locations.generate(1000);
          
          if (isMounted) {
            const totalLocs = bookInstance.locations.length();
            const savedPage = book.current_page || 0;
            const percentage = savedPage / (book.total_pages || totalLocs || 1);
            
            if (percentage > 0 && percentage < 1) {
              const cfi = bookInstance.locations.cfiFromPercentage(percentage);
              await rendition.display(cfi);
            } else {
              await rendition.display();
            }
            
            if (totalLocs > 0 && (!book.total_pages || book.total_pages <= 1)) {
              await supabase.from('books').update({ total_pages: totalLocs }).eq('id', id);
            }
            setLoadingReader(false);
          }
        });

        // Temas para conforto visual
        rendition.themes.default({
          body: { "font-family": "serif !important", "color": "#1A1A1A !important", "padding": "40px !important", "line-height": "1.7 !important" }
        });
        rendition.themes.register("comfort", {
          body: { "background": "#1A1A1A !important", "color": "#D1D1D1 !important" }
        });

        rendition.on("relocated", async (location: any) => {
          if (!isMounted) return;
          const percent = bookInstance.locations.percentageFromCfi(location.start.cfi);
          const calculatedPage = Math.floor(percent * bookInstance.locations.length()) || 1;
          
          await supabase.from('books').update({ 
            current_page: calculatedPage,
            updated_at: new Date().toISOString() 
          }).eq('id', id);
        });

      } catch (err) {
        setLoadingReader(false);
      }
    }

    init();

    return () => {
      isMounted = false;
      if (renditionRef.current) {
        try { renditionRef.current.destroy(); } catch (e) {}
      }
    };
  }, [isEpub, book, id]);

  // Função para alternar modo conforto
  const toggleComfort = () => {
    const newMode = !isComfortMode;
    setIsComfortMode(newMode);
    if (renditionRef.current) {
      renditionRef.current.themes.select(newMode ? "comfort" : "default");
    }
  };

  if (!book) return <div className="h-screen flex items-center justify-center bg-[#F8F9F7]"><Loader2 className="animate-spin text-stone-300" /></div>;

  return (
    <div className={`h-screen flex flex-col transition-colors duration-500 ${isComfortMode ? 'bg-[#121212]' : 'bg-[#F8F9F7]'}`}>
      <header className={`px-6 py-4 border-b flex justify-between items-center z-30 transition-colors ${isComfortMode ? 'bg-[#1A1A1A] border-stone-800' : 'bg-white/80 backdrop-blur-md border-stone-200'}`}>
        <button onClick={() => router.back()} className={`p-2 transition-colors ${isComfortMode ? 'text-stone-400' : 'text-stone-400 hover:text-black'}`}>
          <ArrowLeft size={20} />
        </button>
        <h2 className={`text-[10px] font-black uppercase tracking-[0.2em] truncate max-w-[50%] ${isComfortMode ? 'text-stone-500' : 'text-stone-400'}`}>
          {book.title}
        </h2>
        <div className="flex gap-2">
          <button onClick={toggleComfort} className={`p-2 rounded-full transition-colors ${isComfortMode ? 'text-yellow-500 bg-stone-800' : 'text-stone-400 hover:bg-stone-100'}`}>
             {isComfortMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button className="p-2 text-stone-300"><Settings size={20} /></button>
        </div>
      </header>

      <main className="flex-1 relative flex items-center justify-center overflow-hidden">
        {loadingReader && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#F8F9F7] z-50">
            <BookOpen className="text-stone-200 animate-pulse mb-4" size={40} />
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Sincronizando...</p>
          </div>
        )}

        {isEpub ? (
          <div className={`h-full w-full max-w-3xl shadow-2xl relative transition-colors ${isComfortMode ? 'bg-[#1A1A1A]' : 'bg-white'}`}>
            <div ref={viewerRef} className="h-full w-full" />
            <div onClick={() => renditionRef.current?.prev()} className="absolute left-0 top-0 h-full w-[20%] z-40 cursor-w-resize" />
            <div onClick={() => renditionRef.current?.next()} className="absolute right-0 top-0 h-full w-[20%] z-40 cursor-e-resize" />
          </div>
        ) : (
          <iframe src={supabase.storage.from('pdfs').getPublicUrl(book.pdf_url).data.publicUrl} className="w-full h-full border-none" />
        )}
      </main>

      <footer className={`px-8 py-5 border-t flex items-center justify-between gap-6 transition-colors ${isComfortMode ? 'bg-[#1A1A1A] border-stone-800' : 'bg-white border-stone-100'}`}>
        <div className="flex flex-col">
            <span className={`text-[10px] font-black uppercase tracking-widest ${isComfortMode ? 'text-stone-400' : 'text-stone-800'}`}>Pág. {book.current_page || 1}</span>
            <span className="text-[8px] font-bold text-stone-300 uppercase text-left">de {book.total_pages || '--'}</span>
        </div>
        <div className={`flex-1 max-w-xs h-1.5 rounded-full overflow-hidden border ${isComfortMode ? 'bg-stone-800 border-stone-700' : 'bg-stone-50 border-stone-100'}`}>
          <div 
            className={`h-full transition-all duration-700 ${isComfortMode ? 'bg-stone-400' : 'bg-black'}`} 
            style={{ width: `${((book.current_page || 1) / (book.total_pages || 100)) * 100}%` }} 
          />
        </div>
        <div className="text-right">
            <span className={`text-[10px] font-black ${isComfortMode ? 'text-stone-400' : 'text-stone-800'}`}>
              {Math.round(((book.current_page || 1) / (book.total_pages || 1)) * 100) || 0}%
            </span>
        </div>
      </footer>
    </div>
  );
}