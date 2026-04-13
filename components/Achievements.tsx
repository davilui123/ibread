"use client";

import { Award, Flame, BookCheck, Zap, Star } from 'lucide-react';
import { motion } from 'framer-motion';

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: any;
  requirement: number;
  current: number;
  color: string;
}

export default function Achievements({ streak, totalBooks }: { streak: number, totalBooks: number }) {
  const badges: Achievement[] = [
    {
      id: 'streak_3',
      title: 'Hábito Inicial',
      description: 'Mantenha uma chama de 3 dias.',
      icon: Flame,
      requirement: 3,
      current: streak,
      color: 'text-orange-500',
    },
    {
      id: 'first_book',
      title: 'Primeira Vitória',
      description: 'Termine seu primeiro livro.',
      icon: BookCheck,
      requirement: 1,
      current: totalBooks,
      color: 'text-blue-500',
    },
    {
      id: 'streak_7',
      title: 'Leitor Assíduo',
      description: 'Uma semana inteira de leitura.',
      icon: Zap,
      requirement: 7,
      current: streak,
      color: 'text-yellow-500',
    },
    {
      id: 'library_5',
      title: 'Colecionador',
      description: 'Tenha 5 livros na sua estante.',
      icon: Star,
      requirement: 5,
      current: totalBooks,
      color: 'text-purple-500',
    },
  ];

  return (
    <div className="space-y-4">
      <h3 className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-4">Conquistas</h3>
      <div className="grid grid-cols-1 gap-3">
        {badges.map((badge) => {
          const isUnlocked = badge.current >= badge.requirement;
          
          return (
            <motion.div
              key={badge.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-4 rounded-2xl border transition-all ${
                isUnlocked 
                ? 'bg-white border-stone-100 shadow-sm' 
                : 'bg-stone-50/50 border-stone-100 opacity-60'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`p-2 rounded-xl ${isUnlocked ? 'bg-stone-50' : 'bg-stone-100 grayscale'}`}>
                  <badge.icon size={20} className={isUnlocked ? badge.color : 'text-stone-300'} />
                </div>
                <div className="flex-1">
                  <h4 className={`text-xs font-black ${isUnlocked ? 'text-stone-900' : 'text-stone-400'}`}>
                    {badge.title}
                  </h4>
                  <p className="text-[10px] text-stone-400 font-medium">
                    {badge.description}
                  </p>
                </div>
                {isUnlocked && (
                  <div className="bg-green-50 text-green-600 p-1 rounded-full">
                    <Award size={12} />
                  </div>
                )}
              </div>
              
              {/* Barra de progresso da conquista */}
              {!isUnlocked && (
                <div className="mt-3 w-full h-1 bg-stone-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-stone-300 transition-all duration-1000"
                    style={{ width: `${Math.min((badge.current / badge.requirement) * 100, 100)}%` }}
                  />
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
