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
  const [characters, setCharacters] = useState<any[]>([]);

  const viewerRef = useRef<HTMLDivElement>(null);
  const renditionRef = useRef<any>(null);

  // 1. Busca dados do livro
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

  // 2. Lógica de Scan de Personagens
  const handleCharacters = async (bookData: any) => {
    try {
      let charList = [];
      
      if (bookData.characters) {
        charList = typeof bookData.characters === 'string' 
          ? JSON.parse(bookData.characters) 
          : bookData.characters;
      } else {
        // Se não existe no banco, busca na API
        const res = await fetch('/api/books/scan-characters', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bookTitle: bookData.title, author: bookData.author || "Desconhecido" })
        });
        charList = await res.json();
        
        // Salva no Supabase para persistência
        await supabase.from('books').update({ characters: charList }).eq('id', id);
      }
      
      setCharacters(charList);
    } catch (error) {
      console.error("Erro ao processar personagens:", error);
    }
  };

  // 3. Inicialização do EPUB
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

        // Injeção de CSS para marcação de seleção e links de personagens
        rendition.hooks.content.register((contents: any) => {
          const style = contents.document.createElement("style");
          style.innerHTML = `
            ::selection { background: rgba(0, 0, 0, 0.1) !important; color: inherit; }
            .character-link { 
              border-bottom: 1px dashed #A8A29E !important; 
              cursor: pointer !important;
              color: inherit !important;
              text-decoration: none !important;
            }
          `;
          contents.document.head.appendChild(style);
        });

        rendition.on("selected", (cfiRange: string, contents: any) => {
          const text = contents.window.getSelection().toString().trim();
          if (text.length > 2) setSelectedText(text);
        });

        rendition.on("click", () => {
          if (!isDrawerOpen) setSelectedText("");
        });

        // Configuração de Temas
        rendition.themes.default({ body: { "font-family": "serif !important", "padding": "40px !important" } });
        rendition.themes.register("sepia", { body: { "background": "#F4ECD8 !important", "color": "#5B4636 !important" } });
        rendition.themes.register("comfort", { body: { "background": "#1A1A1A !important", "color": "#D1D1D1 !important" } });

        bookInstance.ready.then(async () => {
          await bookInstance.locations.generate(1000);
          if (isMounted) {
            const savedPage = book.current_page || 0;
            const percentage = savedPage / (bookInstance.locations.length() || 1);
            await rendition.display(bookInstance.locations.cfiFromPercentage(percentage > 0 ? percentage : 0));
            setLoadingReader(false);
            
            // Inicia o scan de personagens após o livro estar pronto
            handleCharacters(book);
          }
        });

        rendition.on("relocated", async (location: any) => {
          if (!isMounted) return;
          const percent = bookInstance.locations.percentageFromCfi(location.start.cfi);
          const calculatedPage = Math.floor(percent * bookInstance.locations.length()) || 1;
          await supabase.from('books').update({ current_page: calculatedPage }).eq('id', id);
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
        body: JSON.stringify({ 
          text: selectedText, 
          bookTitle: book.title, 
          action: mode === 'persona' ? 'persona' : 'analyze' 
        })
      });
      const data = await res.json();
      setAiResponse(data.result || data.error);
    } catch (error) {
      setAiResponse("Erro ao conectar com o Mentor.");
    } finally {
      setLoadingAi(false);
    }
  };

  const changeTheme = (newTheme: ThemeType) => {
    setTheme(newTheme);
    renditionRef.current?.themes.select(newTheme);
  };

  return (
    <div className={`h-screen flex flex-col transition-colors duration-500 overflow-hidden 
      ${theme === 'comfort' ? 'bg-[#121212]' : theme === 'sepia' ? 'bg-[#F4ECD8]' : 'bg-[#F8F9F7]'}`}>
      
      {/* HEADER */}
      <header className={`px-6 py-4 border-b flex justify-between items-center z-30 transition-colors duration-500
        ${theme === 'comfort' ? 'bg-[#1A1A1A] border-stone-800' : 
          theme === 'sepia' ? 'bg-[#E8DFCA] border-[#D6CBB3]' : 'bg-white/80 backdrop-blur-md border-stone-200'}`}>
        
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="text-stone-400 hover:text-black transition-colors"><ArrowLeft size={20} /></button>
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
            <button onClick={() => changeTheme('default')} className={`w-6 h-6 rounded-full border-2 ${theme === 'default' ? 'border-blue-400 bg-white' : 'border-transparent bg-white'}`} />
            <button onClick={() => changeTheme('sepia')} className={`w-6 h-6 rounded-full border-2 ${theme === 'sepia' ? 'border-orange-400 bg-[#F4ECD8]' : 'border-transparent bg-[#F4ECD8]'}`} />
            <button onClick={() => changeTheme('comfort')} className={`w-6 h-6 rounded-full border-2 ${theme === 'comfort' ? 'border-stone-400 bg-[#1A1A1A]' : 'border-transparent bg-[#1A1A1A]'}`} />
          </div>
        </div>
      </header>

      <main className="flex-1 relative flex items-center justify-center">
        {loadingReader && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-50 bg-[#F8F9F7]">
                <Loader2 className="animate-spin text-stone-200" size={40} />
            </div>
        )}

        <div ref={viewerRef} className={`h-full w-full max-w-3xl relative transition-all shadow-sm
          ${theme === 'comfort' ? 'bg-[#1A1A1A]' : theme === 'sepia' ? 'bg-[#F4ECD8]' : 'bg-white'}`} />
        
        <button onClick={() => renditionRef.current?.prev()} className="absolute left-0 h-full w-[10%] z-10 cursor-w-resize" />
        <button onClick={() => renditionRef.current?.next()} className="absolute right-0 h-full w-[10%] z-10 cursor-e-resize" />

        {/* DRAWER */}
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

      {/* FOOTER */}
      <footer className={`px-8 py-5 border-t flex items-center justify-between gap-6 transition-colors duration-500
        ${theme === 'comfort' ? 'bg-[#1A1A1A] border-stone-800' : 
          theme === 'sepia' ? 'bg-[#E8DFCA] border-[#D6CBB3]' : 'bg-white border-stone-100'}`}>
        <span className={`text-[10px] font-black uppercase ${theme === 'comfort' ? 'text-stone-500' : 'text-stone-800'}`}>Pág. {book?.current_page || 0}</span>
        <div className="flex-1 max-w-xs h-1 bg-stone-200/30 rounded-full overflow-hidden">
          <div className={`h-full transition-all duration-700 ${theme === 'comfort' ? 'bg-stone-600' : theme === 'sepia' ? 'bg-[#5B4636]' : 'bg-black'}`} style={{ width: `${((book?.current_page || 1) / (book?.total_pages || 100)) * 100}%` }} />
        </div>
        <span className={`text-[10px] font-black ${theme === 'comfort' ? 'text-stone-500' : 'text-stone-800'}`}>{Math.round(((book?.current_page || 0) / (book?.total_pages || 1)) * 100)}%</span>
      </footer>
    </div>
  );
}