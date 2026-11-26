"use client";

import { useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import {
  deleteBookWithAssets,
  getBookProgressPercent,
  type Book,
  type BookStatus,
} from '@/lib/types';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Plus, BookMarked, MoreHorizontal, Trash2, Check, Tag, X, FolderOpen
} from 'lucide-react';
import Link from 'next/link';

interface LibraryViewProps {
  books: Book[];
  onBooksChange: (updater: (prev: Book[]) => Book[]) => void;
  onOpenUpload: () => void;
}

const STATUS_TABS: { id: 'all' | BookStatus; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'lendo', label: 'Lendo' },
  { id: 'quero_ler', label: 'Quero Ler' },
  { id: 'finalizado', label: 'Finalizados' },
];

export default function LibraryView({
  books,
  onBooksChange,
  onOpenUpload,
}: LibraryViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | BookStatus>('all');
  const [collectionFilter, setCollectionFilter] = useState<string>('all');
  const [menuBook, setMenuBook] = useState<Book | null>(null);
  const [editingCollection, setEditingCollection] = useState('');
  const [savingBook, setSavingBook] = useState(false);

  const collections = useMemo(() => {
    const set = new Set<string>();
    books.forEach((b) => {
      if (b.category?.trim()) set.add(b.category.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [books]);

  const filteredBooks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return books.filter((book) => {
      const effectiveStatus: BookStatus = book.status || 'lendo';
      if (statusFilter !== 'all' && effectiveStatus !== statusFilter) return false;
      if (collectionFilter !== 'all' && (book.category?.trim() || '') !== collectionFilter) {
        return false;
      }
      if (q) {
        const matchTitle = book.title?.toLowerCase().includes(q);
        const matchAuthor = book.author?.toLowerCase().includes(q);
        const matchCollection = book.category?.toLowerCase().includes(q);
        if (!matchTitle && !matchAuthor && !matchCollection) return false;
      }
      return true;
    });
  }, [books, searchQuery, statusFilter, collectionFilter]);

  const handleUpdateBook = async (
    bookId: string,
    updates: Partial<Pick<Book, 'status' | 'category'>>
  ) => {
    setSavingBook(true);
    try {
      const { error } = await supabase.from('books').update(updates).eq('id', bookId);
      if (error) throw error;

      onBooksChange((prev) =>
        prev.map((b) => (b.id === bookId ? { ...b, ...updates } : b))
      );
      setMenuBook((prev) => (prev && prev.id === bookId ? { ...prev, ...updates } : prev));
    } catch (err) {
      console.error('Erro ao atualizar livro:', err);
      alert('Não foi possível atualizar o livro.');
    } finally {
      setSavingBook(false);
    }
  };

  const handleDelete = async (book: Book) => {
    if (!confirm(`Excluir "${book.title}" permanentemente?`)) return;
    try {
      await deleteBookWithAssets(supabase, book);
      onBooksChange((prev) => prev.filter((b) => b.id !== book.id));
      setMenuBook(null);
    } catch (err) {
      console.error('Erro ao excluir livro:', err);
      alert('Erro ao excluir o livro!');
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9F7] text-[#1A1A1A] font-sans pb-36">
      <div className="max-w-lg mx-auto px-6 pt-8">
        {/* ── HEADER ── */}
        <header className="flex items-center justify-between mb-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-stone-400 mb-1">
              {books.length} {books.length === 1 ? 'obra' : 'obras'}
            </p>
            <h1
              className="text-4xl leading-none tracking-tight"
              style={{ fontFamily: 'var(--font-serif)' }}
            >
              Biblioteca
            </h1>
          </div>

          <button
            onClick={onOpenUpload}
            className="inline-flex items-center gap-1.5 bg-[#1A1A1A] text-white px-4 py-2.5 rounded-full text-[11px] font-bold uppercase tracking-wider shadow-lg shadow-black/10 active:scale-95 transition-transform"
          >
            <Plus size={14} />
            Adicionar
          </button>
        </header>

        {/* ── BUSCA INTEGRADA ── */}
        <div className="relative mb-4">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar título, autor ou coleção..."
            className="w-full bg-white border border-stone-200/70 rounded-2xl pl-11 pr-10 py-3 text-sm font-medium placeholder:text-stone-300 outline-none focus:border-[#1A1A1A] transition-colors shadow-[0_4px_16px_rgba(0,0,0,0.02)]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-300 hover:text-[#1A1A1A]"
              aria-label="Limpar busca"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* ── FILTROS DE STATUS ── */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 mb-2">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3.5 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all ${
                statusFilter === tab.id
                  ? 'bg-[#1A1A1A] text-white shadow-sm'
                  : 'bg-white text-stone-500 border border-stone-200/60 hover:text-[#1A1A1A]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── FILTROS DE COLEÇÕES ── */}
        {collections.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-3 mb-4">
            <Tag size={12} className="text-stone-400 flex-shrink-0" />
            <button
              onClick={() => setCollectionFilter('all')}
              className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-colors ${
                collectionFilter === 'all'
                  ? 'bg-stone-800 text-white'
                  : 'bg-stone-200/60 text-stone-500 hover:bg-stone-200'
              }`}
            >
              Todas coleções
            </button>
            {collections.map((col) => (
              <button
                key={col}
                onClick={() => setCollectionFilter(col)}
                className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-colors ${
                  collectionFilter === col
                    ? 'bg-stone-800 text-white'
                    : 'bg-stone-200/60 text-stone-500 hover:bg-stone-200'
                }`}
              >
                {col}
              </button>
            ))}
          </div>
        )}

        {/* ── GRADE DE LIVROS ── */}
        {filteredBooks.length === 0 ? (
          <div className="bg-white border border-stone-100 rounded-3xl p-10 text-center mt-4">
            <FolderOpen size={24} className="text-stone-300 mx-auto mb-3" />
            <p className="text-sm font-bold text-[#1A1A1A] mb-1">Nenhum livro encontrado</p>
            <p className="text-xs text-stone-400">
              Ajuste a busca, os filtros ou adicione um novo livro à sua coleção.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-5 gap-y-7 mt-2">
            {filteredBooks.map((book) => {
              const pct = getBookProgressPercent(book);
              const isPdf = book.pdf_url?.toLowerCase().endsWith('.pdf');
              return (
                <div key={book.id} className="relative group">
                  <Link href={`/reader/${book.id}`} className="flex flex-col">
                    <motion.div
                      whileTap={{ scale: 0.96 }}
                      className="relative aspect-[2/3] rounded-2xl overflow-hidden bg-stone-100 shadow-[0_12px_26px_rgba(0,0,0,0.07)] border border-white mb-2.5 flex items-center justify-center"
                    >
                      {book.cover_url ? (
                        <img
                          src={book.cover_url}
                          alt={book.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <BookMarked size={28} className="text-stone-300" />
                      )}

                      <span className="absolute top-2 left-2 text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-black/65 text-white backdrop-blur-sm">
                        {isPdf ? 'PDF' : 'ePUB'}
                      </span>

                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/10">
                        <div className="h-full bg-white" style={{ width: `${pct}%` }} />
                      </div>
                    </motion.div>

                    <h3 className="text-xs font-bold leading-tight truncate px-0.5">
                      {book.title}
                    </h3>
                    <p className="text-[10px] text-stone-400 truncate px-0.5 mt-0.5">
                      {book.author}
                    </p>
                    <div className="flex items-center justify-between px-0.5 mt-1">
                      <span className="text-[10px] font-bold text-stone-400">{pct}%</span>
                      {book.category && (
                        <span className="text-[9px] font-semibold text-stone-400 bg-stone-200/60 px-2 py-0.5 rounded-full truncate max-w-[90px]">
                          {book.category}
                        </span>
                      )}
                    </div>
                  </Link>

                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setEditingCollection(book.category || '');
                      setMenuBook(book);
                    }}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 backdrop-blur-sm text-stone-600 shadow-md flex items-center justify-center hover:bg-white transition-colors"
                    aria-label={`Opções de ${book.title}`}
                  >
                    <MoreHorizontal size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── MODAL DE OPÇÕES DO LIVRO ── */}
      <AnimatePresence>
        {menuBook && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMenuBook(null)}
              className="fixed inset-0 bg-black/25 backdrop-blur-xs z-[110]"
            />
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-md bg-white rounded-3xl shadow-2xl border border-stone-100 p-6 z-[120]"
            >
              <div className="flex items-start justify-between gap-3 mb-5">
                <div className="min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-stone-400">
                    Gerenciar Obra
                  </p>
                  <h3 className="text-sm font-bold truncate mt-0.5">{menuBook.title}</h3>
                </div>
                <button
                  onClick={() => setMenuBook(null)}
                  className="p-1.5 rounded-full bg-stone-50 text-stone-400"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Status */}
              <div className="mb-5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-2">
                  Status de Leitura
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { id: 'lendo', label: 'Lendo' },
                    { id: 'quero_ler', label: 'Quero Ler' },
                    { id: 'finalizado', label: 'Finalizado' },
                  ] as const).map((st) => {
                    const active = (menuBook.status || 'lendo') === st.id;
                    return (
                      <button
                        key={st.id}
                        disabled={savingBook}
                        onClick={() => handleUpdateBook(menuBook.id, { status: st.id })}
                        className={`py-2 px-2 rounded-xl text-[11px] font-bold border flex items-center justify-center gap-1 transition-all ${
                          active
                            ? 'bg-[#1A1A1A] text-white border-[#1A1A1A]'
                            : 'bg-stone-50 text-stone-600 border-stone-100 hover:bg-stone-100'
                        }`}
                      >
                        {active && <Check size={12} />}
                        {st.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Coleção */}
              <div className="mb-6">
                <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-2">
                  Coleção
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editingCollection}
                    onChange={(e) => setEditingCollection(e.target.value)}
                    placeholder="Ex: Ficção, Clássicos..."
                    className="flex-1 bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-[#1A1A1A]"
                  />
                  <button
                    disabled={savingBook}
                    onClick={() =>
                      handleUpdateBook(menuBook.id, {
                        category: editingCollection.trim() || null,
                      })
                    }
                    className="px-4 py-2 rounded-xl bg-[#1A1A1A] text-white text-xs font-bold disabled:opacity-40"
                  >
                    Salvar
                  </button>
                </div>
              </div>

              <button
                onClick={() => handleDelete(menuBook)}
                className="w-full py-3 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 text-xs font-bold flex items-center justify-center gap-2 transition-colors"
              >
                <Trash2 size={14} />
                Excluir Livro Permanentemente
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
