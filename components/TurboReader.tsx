"use client";

import { useState, useEffect, useRef } from 'react';
import { X, Play, Pause, ChevronLeft, ChevronRight, Gauge, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface TurboReaderProps {
  text: string;
  onClose: () => void;
}

export default function TurboReader({ text, onClose }: TurboReaderProps) {
  const [words, setWords] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [wpm, setWpm] = useState(300);
  
  // Estados para a Trava de Saúde
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [showHealthAlert, setShowHealthAlert] = useState(false);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const healthTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!text) {
      setWords(["Arraste", "a", "página", "para", "carregar", "o", "texto"]);
      return;
    }

    const cleanText = text
      .replace(/<[^>]*>?/gm, '')
      .replace(/\s+/g, ' ')
      .trim();

    const wordsArray = cleanText.split(' ').filter(w => w.length > 0);
    setWords(wordsArray);
    setCurrentIndex(0);
  }, [text]);

  // Timer de Leitura (RSVP)
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

  // Timer de Saúde (Trava de 5 minutos / 300 segundos)
  useEffect(() => {
    if (isPlaying) {
      healthTimerRef.current = setInterval(() => {
        setSessionSeconds(prev => {
          if (prev >= 300) { // 5 minutos
            setIsPlaying(false);
            setShowHealthAlert(true);
            return 0;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      if (healthTimerRef.current) clearInterval(healthTimerRef.current);
    }
    return () => { if (healthTimerRef.current) clearInterval(healthTimerRef.current); };
  }, [isPlaying]);

  const renderWord = (word: string) => {
    if (!word) return null;
    const index = Math.max(1, Math.floor(word.length * 0.35));
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
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }} 
      className="fixed inset-0 z-[200] bg-white flex flex-col items-center justify-center p-6 text-stone-900"
    >
      <button onClick={onClose} className="absolute top-8 right-8 text-stone-400 hover:text-black">
        <X size={32} />
      </button>

      {/* Alerta de Saúde */}
      <AnimatePresence>
        {showHealthAlert && (
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="absolute top-20 bg-orange-50 border border-orange-100 p-4 rounded-2xl flex items-center gap-3 max-w-sm shadow-xl z-[210]"
          >
            <AlertCircle className="text-orange-500" />
            <div>
              <p className="text-xs font-black uppercase text-orange-800">Pausa para os olhos!</p>
              <p className="text-[10px] text-orange-700 font-medium">Você leu por 5 min em foco total. Descanse 30 segundos antes de continuar.</p>
            </div>
            <button onClick={() => setShowHealthAlert(false)} className="ml-2 text-orange-400"><X size={16} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative w-full max-w-2xl h-40 flex items-center justify-center border-y-2 border-stone-100">
        <div className="absolute left-1/2 -translate-x-1/2 top-0 w-0.5 h-4 bg-stone-200" />
        <div className="absolute left-1/2 -translate-x-1/2 bottom-0 w-0.5 h-4 bg-stone-200" />
        <AnimatePresence mode="wait">
          <div key={currentIndex}>{renderWord(words[currentIndex])}</div>
        </AnimatePresence>
      </div>

      <div className="mt-12 flex flex-col items-center gap-8 w-full max-w-xs">
        <div className="flex items-center gap-4 w-full bg-stone-50 p-4 rounded-2xl border border-stone-100">
          <Gauge size={20} className="text-stone-400" />
          <input 
            type="range" min="100" max="800" step="50" 
            value={wpm} onChange={(e) => setWpm(parseInt(e.target.value))} 
            className="flex-1 accent-black cursor-pointer" 
          />
          <span className="text-xs font-black w-16 text-right">{wpm} WPM</span>
        </div>

        <div className="flex items-center gap-6">
          <button onClick={() => setCurrentIndex(Math.max(0, currentIndex - 10))} className="p-3 text-stone-400">
            <ChevronLeft size={24}/>
          </button>
          
          <button 
            onClick={() => {
              setIsPlaying(!isPlaying);
              setShowHealthAlert(false);
            }} 
            className="w-20 h-20 bg-black text-white rounded-full flex items-center justify-center shadow-2xl hover:scale-105 transition-transform"
          >
            {isPlaying ? <Pause size={32} fill="white" /> : <Play size={32} fill="white" className="ml-1" />}
          </button>

          <button onClick={() => setCurrentIndex(Math.min(words.length - 1, currentIndex + 10))} className="p-3 text-stone-400">
            <ChevronRight size={24}/>
          </button>
        </div>

        <div className="text-center">
          <p className="text-[10px] font-black uppercase text-stone-300 tracking-tighter">
            Palavra {currentIndex + 1} de {words.length}
          </p>
          {isPlaying && (
            <p className="text-[8px] font-bold text-stone-200 uppercase mt-1">
              Sessão: {Math.floor(sessionSeconds / 60)}m {sessionSeconds % 60}s
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
