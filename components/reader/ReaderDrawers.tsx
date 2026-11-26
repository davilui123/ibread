"use client";

import { useState } from 'react';
import {
  HIGHLIGHT_STYLES,
  type BookBookmark,
  type BookHighlight,
} from '@/lib/types';
import { motion, AnimatePresence } from 'framer-motion';
import { X, List, Bookmark, Highlighter, Trash2, ChevronRight } from 'lucide-react';

export interface TocItem {
  id: string;
  label: string;
  href?: string;
  pageNumber?: number;
  subitems?: TocItem[];
}

interface ReaderDrawersProps {
  isOpen: boolean;
  onClose: () => void;
  toc: TocItem[];
  bookmarks: BookBookmark[];
  highlights: BookHighlight[];
  onSelectToc: (item: TocItem) => void;
  onSelectBookmark: (bm: BookBookmark) => void;
  onDeleteBookmark: (id: string) => void;
  onSelectHighlight: (hl: BookHighlight) => void;
  onDeleteHighlight: (id: string) => void;
}

type DrawerTab = 'toc' | 'bookmarks' | 'highlights';

function TocTree({
  items,
  depth = 0,
  onSelect,
}: {
  items: TocItem[];
  depth?: number;
  onSelect: (item: TocItem) => void;
}) {
  return (
    <div className="space-y-1">
      {items.map((item, idx) => (
        <div key={`${item.id}-${idx}`}>
          <button
            onClick={() => onSelect(item)}
            style={{ paddingLeft: `${12 + depth * 14}px` }}
            className="w-full text-left py-2.5 pr-3 rounded-xl hover:bg-stone-50 flex items-center justify-between gap-2 transition-colors group"
          >
            <span className="text-xs font-semibold text-[#1A1A1A] leading-snug line-clamp-2">
              {item.label}
            </span>
            <span className="flex items-center gap-1 text-[10px] font-bold text-stone-300 group-hover:text-stone-500 flex-shrink-0">
              {item.pageNumber ? `p.${item.pageNumber}` : null}
              <ChevronRight size={13} />
            </span>
          </button>
          {item.subitems && item.subitems.length > 0 && (
            <TocTree items={item.subitems} depth={depth + 1} onSelect={onSelect} />
          )}
        </div>
      ))}
    </div>
  );
}

export default function ReaderDrawers({
  isOpen,
  onClose,
  toc,
  bookmarks,
  highlights,
  onSelectToc,
  onSelectBookmark,
  onDeleteBookmark,
  onSelectHighlight,
  onDeleteHighlight,
}: ReaderDrawersProps) {
  const [tab, setTab] = useState<DrawerTab>('toc');

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/25 backdrop-blur-xs z-[70]"
          />
          <motion.aside
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className="fixed left-0 top-0 h-full w-full max-w-xs bg-white z-[80] shadow-2xl flex flex-col text-[#1A1A1A]"
          >
            {/* Header */}
            <div className="px-5 pt-6 pb-4 border-b border-stone-100 flex items-center justify-between">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-stone-400">
                Navegação do Livro
              </p>
              <button
                onClick={onClose}
                className="p-1.5 rounded-full bg-stone-50 text-stone-400 hover:text-[#1A1A1A]"
                aria-label="Fechar sumário"
              >
                <X size={16} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-stone-100 px-3">
              {([
                { id: 'toc', label: 'Sumário', icon: List },
                { id: 'bookmarks', label: `Marcadores (${bookmarks.length})`, icon: Bookmark },
                { id: 'highlights', label: `Notas (${highlights.length})`, icon: Highlighter },
              ] as const).map((t) => {
                const Icon = t.icon;
                const active = tab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`flex-1 py-3 text-[10px] font-bold flex items-center justify-center gap-1 border-b-2 transition-colors ${
                      active
                        ? 'border-[#1A1A1A] text-[#1A1A1A]'
                        : 'border-transparent text-stone-400 hover:text-stone-600'
                    }`}
                  >
                    <Icon size={12} />
                    <span className="truncate">{t.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Conteúdo */}
            <div className="flex-1 overflow-y-auto p-4">
              {tab === 'toc' && (
                toc.length === 0 ? (
                  <p className="text-xs text-stone-400 text-center py-12">
                    Este arquivo não possui índice de capítulos embutido.
                  </p>
                ) : (
                  <TocTree
                    items={toc}
                    onSelect={(item) => {
                      onSelectToc(item);
                      onClose();
                    }}
                  />
                )
              )}

              {tab === 'bookmarks' && (
                bookmarks.length === 0 ? (
                  <p className="text-xs text-stone-400 text-center py-12">
                    Nenhum marcador salvo neste livro ainda.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {bookmarks.map((bm) => (
                      <div
                        key={bm.id}
                        className="p-3 rounded-2xl bg-stone-50 border border-stone-100 flex items-center justify-between gap-2"
                      >
                        <button
                          onClick={() => {
                            onSelectBookmark(bm);
                            onClose();
                          }}
                          className="flex items-center gap-2.5 text-left flex-1 min-w-0"
                        >
                          <Bookmark size={14} className="text-[#1A1A1A] flex-shrink-0" fill="currentColor" />
                          <div className="min-w-0">
                            <p className="text-xs font-bold truncate">
                              Página {bm.page_number}
                            </p>
                            {bm.chapter_title && (
                              <p className="text-[10px] text-stone-400 truncate">
                                {bm.chapter_title}
                              </p>
                            )}
                          </div>
                        </button>
                        <button
                          onClick={() => onDeleteBookmark(bm.id)}
                          className="p-1.5 text-stone-300 hover:text-red-500"
                          aria-label="Excluir marcador"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )
              )}

              {tab === 'highlights' && (
                highlights.length === 0 ? (
                  <p className="text-xs text-stone-400 text-center py-12">
                    Selecione qualquer trecho do texto para destacar ou adicionar notas.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {highlights.map((hl) => {
                      const style = HIGHLIGHT_STYLES[hl.color] || HIGHLIGHT_STYLES.amber;
                      return (
                        <div
                          key={hl.id}
                          className={`p-3 rounded-2xl border border-stone-100 border-l-4 ${style.border} bg-white shadow-xs`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <span className="text-[10px] font-bold text-stone-400">
                              Pág. {hl.page_number}
                            </span>
                            <button
                              onClick={() => onDeleteHighlight(hl.id)}
                              className="p-1 text-stone-300 hover:text-red-500"
                              aria-label="Excluir destaque"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                          <button
                            onClick={() => {
                              onSelectHighlight(hl);
                              onClose();
                            }}
                            className="text-left w-full"
                          >
                            <p className="text-xs text-[#1A1A1A] line-clamp-3 italic font-serif">
                              “{hl.selected_text}”
                            </p>
                            {hl.note && (
                              <p className="text-[11px] text-stone-500 font-medium mt-1.5">
                                {hl.note}
                              </p>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
