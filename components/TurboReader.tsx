"use client";

import { useState, useEffect, useRef } from 'react';
import { X, Play, Pause, ChevronLeft, ChevronRight, Gauge } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface TurboReaderProps {
  text: string;
  onClose: () => void;
}

export default function TurboReader({ text, onClose }: TurboReaderProps) {
  const [words, setWords] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [wpm, setWpm] = useState(300); // Palavras por minuto inicial
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Limpa o texto de tags HTML e quebras de linha antes de dar o split
  useEffect(() => {
    const cleanText = text.replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim();
    setWords(cleanText.split(' '));
  }, [text]);

  // Lógica do Timer
  useEffect(() => {
    if (isPlaying && currentIndex < words.length) {
      const interval = 60000 / wpm;
      timerRef.current = setInterval(() => {
        setCurrentIndex((prev) => prev + 1);
      }, interval);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      if (currentIndex >= words.length) setIsPlaying(false);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isPlaying, wpm, currentIndex, words.length]);

  // Função para destacar a letra central (O segredo do Spritz/RSVP)
  const renderWord = (word: string) => {
    const index = Math.floor(word.length * 0.35); // Ponto ideal de foco
    return (
      <div className="text-5xl md:text-7xl font-mono font-bold tracking-tight flex">
        <span className="text-stone-300">{word.substring(0, index)}</span>
        <span className="text-red-500">{word[index]}</span>
        <span className="text-stone-800">{word.substring(index + 1)}</span>
      </div>
    );
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-white flex flex-col items-center justify-center p-6"
    >
      <button onClick={onClose} className="absolute top-8 right-8 text-stone-400 hover:text-black transition-colors">
        <X size={32} />
      </button>

      {/* Visor das Palavras */}
      <div className="relative w-full max-w-2xl h-40 flex items-center justify-center border-y-2 border-stone-100">
        {/* Guias visuais (ajudam o olho a não se mexer) */}
        <div className="absolute left-1/2 -translate-x-1/2 top-0 w-0.5 h-4 bg-stone-200" />
        <div className="absolute left-1/2 -translate-x-1/2 bottom-0 w-0.5 h-4 bg-stone-200" />
        
        <AnimatePresence mode="wait">
          <div key={currentIndex}>
            {words[currentIndex] ? renderWord(words[currentIndex]) : <span className="text-stone-300 uppercase text-xs font-black tracking-widest">Fim da Leitura</span>}
          </div>
        </AnimatePresence>
      </div>

      {/* Controles */}
      <div className="mt-12 flex flex-col items-center gap-8 w-full max-w-xs">
        
        {/* Velocidade (WPM) */}
        <div className="flex items-center gap-4 w-full bg-stone-50 p-4 rounded-2xl border border-stone-100">
          <Gauge size={20} className="text-stone-400" />
          <input 
            type="range" min="100" max="800" step="50" 
            value={wpm} onChange={(e) => setWpm(parseInt(e.target.value))}
            className="flex-1 accent-black cursor-pointer"
          />
          <span className="text-xs font-black w-16 text-right">{wpm} WPM</span>
        </div>

        {/* Play/Pause e Navegação */}
        <div className="flex items-center gap-6">
          <button onClick={() => setCurrentIndex(Math.max(0, currentIndex - 10))} className="p-3 text-stone-400 hover:text-black"><ChevronLeft size={24}/></button>
          
          <button 
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-20 h-20 bg-black text-white rounded-full flex items-center justify-center shadow-2xl hover:scale-105 transition-transform"
          >
            {isPlaying ? <Pause size={32} fill="white" /> : <Play size={32} fill="white" className="ml-1" />}
          </button>

          <button onClick={() => setCurrentIndex(Math.min(words.length - 1, currentIndex + 10))} className="p-3 text-stone-400 hover:text-black"><ChevronRight size={24}/></button>
        </div>

        <p className="text-[10px] font-black uppercase text-stone-300 tracking-tighter">
          Palavra {currentIndex + 1} de {words.length}
        </p>
      </div>
    </main>
  );
}
