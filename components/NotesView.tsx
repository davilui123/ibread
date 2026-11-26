"use client";

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import {
  HIGHLIGHT_STYLES,
  type Book,
  type BookBookmark,
  type BookHighlight,
} from '@/lib/types';
import {
  Bookmark, Highlighter, Search, Trash2, Loader2, ExternalLink, Edit3, Check, X
} from 'lucide-react';
import Link from 'next/link';

interface NotesViewProps {
  userId: string;
  books: Book[];
}

type NoteFilter = 'all' | 'highlights' | 'bookmarks';

export default function NotesView({ userId, books }: NotesViewProps) {
  const [highlights, setHighlights] = useState<BookHighlight[]>([]);
  const [bookmarks, setBookmarks] = useState<BookBookmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<NoteFilter>('all');
  const [bookFilter, setBookFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');

  const bookMap = useMemo(() => {
    const map = new Map<string, Book>();
    books.forEach((b) => map.set(b.id, b));
    return map;
  }, [books]);

  useEffect(() => {
    let active = true;

    async function fetchNotes() {
      const [hlRes, bmRes] = await Promise.all([
        supabase
          .from('book_highlights')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false }),
        supabase
          .from('book_bookmarks')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false }),
      ]);

      if (!active) return;
      if (!hlRes.error) setHighlights((hlRes.data as BookHighlight[]) || []);
      if (!bmRes.error) setBookmarks((bmRes.data as BookBookmark[]) || []);
      setLoading(false);
    }

    fetchNotes();
    return () => {
      active = false;
    };
  }, [userId]);

  const filteredHighlights = useMemo(() => {
    if (filter === 'bookmarks') return [];
    const q = searchQuery.trim().toLowerCase();
    return highlights.filter((hl) => {
      if (bookFilter !== 'all' && hl.book_id !== bookFilter) return false;
      if (q) {
        const b = bookMap.get(hl.book_id);
        const matchText = hl.selected_text.toLowerCase().includes(q);
        const matchNote = hl.note?.toLowerCase().includes(q);
        const matchBook = b?.title.toLowerCase().includes(q);
        if (!matchText && !matchNote && !matchBook) return false;
      }
      return true;
    });
  }, [highlights, filter, bookFilter, searchQuery, bookMap]);

  const filteredBookmarks = useMemo(() => {
    if (filter === 'highlights') return [];
    const q = searchQuery.trim().toLowerCase();
    return bookmarks.filter((bm) => {
      if (bookFilter !== 'all' && bm.book_id !== bookFilter) return false;
      if (q) {
        const b = bookMap.get(bm.book_id);
        const matchChapter = bm.chapter_title?.toLowerCase().includes(q);
        const matchBook = b?.title.toLowerCase().includes(q);
        if (!matchChapter && !matchBook) return false;
      }
      return true;
    });
  }, [bookmarks, filter, bookFilter, searchQuery, bookMap]);

  const deleteHighlight = async (id: string) => {
    const { error } = await supabase.from('book_highlights').delete().eq('id', id);
    if (!error) setHighlights((prev) => prev.filter((h) => h.id !== id));
  };

  const deleteBookmark = async (id: string) => {
    const { error } = await supabase.from('book_bookmarks').delete().eq('id', id);
    if (!error) setBookmarks((prev) => prev.filter((b) => b.id !== id));
  };

  const saveHighlightNote = async (id: string) => {
    const note = editingNoteText.trim() || null;
    const { error } = await supabase.from('book_highlights').update({ note }).eq('id', id);
    if (!error) {
      setHighlights((prev) => prev.map((h) => (h.id === id ? { ...h, note } : h)));
      setEditingId(null);
    }
  };

  const buildJumpHref = (bookId: string, cfi: string | null, page: number) => {
    if (cfi) return `/reader/${bookId}?cfi=${encodeURIComponent(cfi)}`;
    return `/reader/${bookId}?page=${page}`;
  };

  return (
    <div className="min-h-screen bg-[#F8F9F7] text-[#1A1A1A] font-sans pb-36">
      <div className="max-w-lg mx-auto px-6 pt-8">
        <header className="mb-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-stone-400 mb-1">
            Caderno de Leitura
          </p>
          <h1
            className="text-4xl leading-none tracking-tight"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            Notas & Destaques
          </h1>
        </header>

        {/* Busca */}
        <div className="relative mb-4">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar trechos, anotações ou livros..."
            className="w-full bg-white border border-stone-200/70 rounded-2xl pl-11 pr-4 py-3 text-sm font-medium placeholder:text-stone-300 outline-none focus:border-[#1A1A1A]"
          />
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          {([
            { id: 'all', label: 'Tudo' },
            { id: 'highlights', label: `Destaques (${highlights.length})` },
            { id: 'bookmarks', label: `Marcadores (${bookmarks.length})` },
          ] as const).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-3.5 py-1.5 rounded-full text-[11px] font-bold transition-all ${
                filter === tab.id
                  ? 'bg-[#1A1A1A] text-white'
                  : 'bg-white text-stone-500 border border-stone-200/60'
              }`}
            >
              {tab.label}
            </button>
          ))}

          {books.length > 0 && (
            <select
              value={bookFilter}
              onChange={(e) => setBookFilter(e.target.value)}
              className="ml-auto bg-white border border-stone-200/60 rounded-full px-3 py-1.5 text-[11px] font-semibold text-stone-600 outline-none max-w-[160px]"
            >
              <option value="all">Todos os livros</option>
              {books.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title}
                </option>
              ))}
            </select>
          )}
        </div>

        {loading ? (
          <div className="py-20 flex justify-center">
            <Loader2 className="animate-spin text-stone-300" size={28} />
          </div>
        ) : filteredHighlights.length === 0 && filteredBookmarks.length === 0 ? (
          <div className="bg-white border border-stone-100 rounded-3xl p-10 text-center shadow-[0_12px_30px_rgba(0,0,0,0.03)]">
            <Highlighter size={24} className="text-stone-300 mx-auto mb-3" />
            <h2 className="text-sm font-bold mb-1">Nenhuma marcação ainda</h2>
            <p className="text-xs text-stone-400 leading-relaxed max-w-xs mx-auto">
              Selecione trechos durante a leitura para criar destaques e notas, ou toque no ícone de marcador para salvar uma página.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* ── DESTAQUES ── */}
            {filteredHighlights.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400">
                  Destaques
                </h2>

                {filteredHighlights.map((hl) => {
                  const book = bookMap.get(hl.book_id);
                  const style = HIGHLIGHT_STYLES[hl.color] || HIGHLIGHT_STYLES.amber;
                  const isEditing = editingId === hl.id;

                  return (
                    <div
                      key={hl.id}
                      className={`bg-white rounded-2xl border border-stone-100 border-l-4 ${style.border} p-4 shadow-[0_6px_20px_rgba(0,0,0,0.03)]`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 truncate">
                          {book?.title || 'Livro'} · pág. {hl.page_number}
                          {hl.chapter_title ? ` · ${hl.chapter_title}` : ''}
                        </span>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <Link
                            href={buildJumpHref(hl.book_id, hl.cfi, hl.page_number)}
                            className="p-1.5 rounded-lg bg-stone-50 text-stone-500 hover:text-[#1A1A1A]"
                            title="Abrir no trecho"
                          >
                            <ExternalLink size={13} />
                          </Link>
                          <button
                            onClick={() => {
                              setEditingId(hl.id);
                              setEditingNoteText(hl.note || '');
                            }}
                            className="p-1.5 rounded-lg bg-stone-50 text-stone-500 hover:text-[#1A1A1A]"
                            title="Editar nota"
                          >
                            <Edit3 size={13} />
                          </button>
                          <button
                            onClick={() => deleteHighlight(hl.id)}
                            className="p-1.5 rounded-lg bg-stone-50 text-stone-400 hover:text-red-500"
                            title="Excluir destaque"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      <blockquote
                        className={`text-sm leading-relaxed text-[#1A1A1A] p-3 rounded-xl ${style.bg} italic`}
                        style={{ fontFamily: 'var(--font-serif)' }}
                      >
                        “{hl.selected_text}”
                      </blockquote>

                      {isEditing ? (
                        <div className="mt-3 flex gap-2">
                          <input
                            type="text"
                            value={editingNoteText}
                            onChange={(e) => setEditingNoteText(e.target.value)}
                            placeholder="Escreva sua anotação..."
                            className="flex-1 bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs font-medium outline-none focus:border-[#1A1A1A]"
                          />
                          <button
                            onClick={() => saveHighlightNote(hl.id)}
                            className="p-2 rounded-xl bg-[#1A1A1A] text-white"
                            aria-label="Salvar nota"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="p-2 rounded-xl bg-stone-100 text-stone-500"
                            aria-label="Cancelar"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        hl.note && (
                          <p className="mt-2.5 text-xs text-stone-600 font-medium px-1">
                            {hl.note}
                          </p>
                        )
                      )}
                    </div>
                  );
                })}
              </section>
            )}

            {/* ── MARCADORES ── */}
            {filteredBookmarks.length > 0 && (
              <section className="space-y-2.5">
                <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400">
                  Marcadores de Página
                </h2>

                {filteredBookmarks.map((bm) => {
                  const book = bookMap.get(bm.book_id);
                  return (
                    <div
                      key={bm.id}
                      className="bg-white rounded-2xl border border-stone-100 px-4 py-3.5 flex items-center justify-between gap-3 shadow-[0_4px_16px_rgba(0,0,0,0.03)]"
                    >
                      <Link
                        href={buildJumpHref(bm.book_id, bm.cfi, bm.page_number)}
                        className="flex items-center gap-3 flex-1 min-w-0"
                      >
                        <div className="w-9 h-9 rounded-xl bg-stone-50 border border-stone-100 flex items-center justify-center flex-shrink-0 text-[#1A1A1A]">
                          <Bookmark size={15} fill="currentColor" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold truncate">
                            {book?.title || 'Livro'}
                          </p>
                          <p className="text-[10px] text-stone-400 truncate">
                            Página {bm.page_number}
                            {bm.chapter_title ? ` · ${bm.chapter_title}` : ''}
                          </p>
                        </div>
                      </Link>
                      <button
                        onClick={() => deleteBookmark(bm.id)}
                        className="p-2 text-stone-300 hover:text-red-500 transition-colors"
                        aria-label="Remover marcador"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
