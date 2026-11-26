"use client";

import { useState } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';
import { searchBookByTitle } from '@/lib/googleBooks';
import type { BookStatus } from '@/lib/types';
import { Upload, Search, Loader2, CheckCircle2, FileText, User, X, Tag } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface BookUploadProps {
  user?: SupabaseUser;
  onSuccess?: () => void;
  onClose?: () => void;
  existingCollections?: string[];
}

const DEFAULT_COLLECTIONS = ['Ficção', 'Não-ficção', 'Clássicos', 'Estudos'];

export default function BookUpload({
  user,
  onSuccess,
  onClose,
  existingCollections = [],
}: BookUploadProps) {
  const [loading, setLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [success, setSuccess] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [previewCover, setPreviewCover] = useState('');

  const [formData, setFormData] = useState({
    title: '',
    author: '',
    description: '',
    pages: 0,
    category: '',
    status: 'lendo' as BookStatus,
  });

  const collectionSuggestions = Array.from(
    new Set([...DEFAULT_COLLECTIONS, ...existingCollections].filter(Boolean))
  );

  const sanitizeFileName = (name: string) => name.replace(/[^a-z0-9.]/gi, '_').toLowerCase();

  const handleTitleBlur = async () => {
    if (isSearching || !formData.title || formData.title.length < 3) return;
    setIsSearching(true);
    try {
      const data = await searchBookByTitle(formData.title);
      if (data) {
        setFormData((prev) => ({
          ...prev,
          title: data.title || prev.title,
          author: data.author || prev.author,
          description: data.description ? data.description.substring(0, 150) + '...' : prev.description,
          pages: data.pageCount || prev.pages,
        }));
        if (!coverFile && data.coverUrl) {
          setPreviewCover(data.coverUrl);
        }
      }
    } catch (err) {
      console.error('Erro na busca:', err);
    } finally {
      setTimeout(() => setIsSearching(false), 600);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !formData.title.trim()) {
      alert('Título e o arquivo (PDF ou ePUB) são obrigatórios!');
      return;
    }

    setLoading(true);
    try {
      const currentUser = user ?? (await supabase.auth.getUser()).data.user;
      if (!currentUser) throw new Error('Você precisa estar autenticado para enviar livros.');

      // 1. Upload do Arquivo (PDF ou ePUB)
      const cleanFileName = sanitizeFileName(file.name);
      const filePath = `files/${currentUser.id}/${Date.now()}_${cleanFileName}`;

      const { error: fileError } = await supabase.storage
        .from('pdfs')
        .upload(filePath, file, { upsert: true });

      if (fileError) throw new Error(`Erro no arquivo: ${fileError.message}`);

      // 2. Definir Capa
      let finalCoverUrl = previewCover;
      if (coverFile) {
        const cleanCoverName = sanitizeFileName(coverFile.name);
        const coverPath = `covers/${currentUser.id}/${Date.now()}_${cleanCoverName}`;
        const { error: cError } = await supabase.storage
          .from('covers')
          .upload(coverPath, coverFile, { upsert: true });
        if (cError) throw new Error(`Erro na Capa: ${cError.message}`);
        const { data: { publicUrl } } = supabase.storage.from('covers').getPublicUrl(coverPath);
        finalCoverUrl = publicUrl;
      }

      // 3. Salvar no Banco
      const payload = {
        user_id: currentUser.id,
        title: formData.title.trim(),
        author: formData.author.trim() || 'Autor desconhecido',
        description: formData.description,
        total_pages: formData.pages,
        pdf_url: filePath,
        cover_url: finalCoverUrl,
        category: formData.category.trim() || null,
        status: formData.status,
      };

      const { error: dbError } = await supabase.from('books').insert([payload]);
      if (dbError) throw dbError;

      setSuccess(true);
      setFormData({
        title: '',
        author: '',
        description: '',
        pages: 0,
        category: '',
        status: 'lendo',
      });
      setPreviewCover('');
      setCoverFile(null);
      setFile(null);

      setTimeout(() => {
        setSuccess(false);
        onSuccess?.();
      }, 1200);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Erro no upload';
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      className="bg-white rounded-3xl shadow-[0_24px_60px_rgba(0,0,0,0.12)] border border-stone-100 p-7 relative overflow-hidden w-full max-w-md max-h-[90vh] overflow-y-auto"
    >
      <div className="flex items-center justify-between gap-2 mb-6">
        <div className="flex items-center gap-2">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400">
            Adicionar à Coleção
          </h2>
          {isSearching && <Search size={13} className="animate-pulse text-stone-400" />}
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full bg-stone-50 text-stone-400 hover:text-[#1A1A1A] transition-colors"
            aria-label="Fechar"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <form onSubmit={handleUpload} className="space-y-5">
        {/* UPLOAD DA CAPA */}
        <div className="flex justify-center">
          <label className="group relative cursor-pointer w-28 h-40 bg-stone-50 rounded-xl flex flex-col items-center justify-center border border-dashed border-stone-200 shadow-inner transition-all hover:bg-stone-100 overflow-hidden">
            {previewCover ? (
              <img src={previewCover} className="w-full h-full object-cover" alt="preview" />
            ) : (
              <div className="flex flex-col items-center gap-2 text-stone-300">
                <Upload size={22} strokeWidth={1.5} />
                <span className="text-[9px] font-bold uppercase tracking-widest">Capa</span>
              </div>
            )}
            <input
              type="file"
              className="hidden"
              accept="image/*"
              onChange={(e) => {
                const fileInput = e.target.files?.[0];
                if (fileInput) {
                  setCoverFile(fileInput);
                  setPreviewCover(URL.createObjectURL(fileInput));
                }
              }}
            />
          </label>
        </div>

        <div className="space-y-4">
          {/* TÍTULO */}
          <div className="border-b border-stone-100 py-1.5">
            <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-stone-400 block mb-1">
              Título
            </label>
            <input
              className="w-full bg-transparent outline-none font-bold text-sm placeholder:text-stone-300"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              onBlur={handleTitleBlur}
              placeholder="Ex: Dom Casmurro"
            />
          </div>

          {/* AUTOR */}
          <div className="border-b border-stone-100 py-1.5">
            <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-stone-400 block mb-1">
              Autor
            </label>
            <div className="flex items-center gap-2">
              <User size={14} className="text-stone-300" />
              <input
                className="w-full bg-transparent outline-none font-bold text-sm placeholder:text-stone-300"
                value={formData.author}
                onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                placeholder="Autor..."
              />
            </div>
          </div>

          {/* STATUS */}
          <div>
            <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-stone-400 block mb-2">
              Lista inicial
            </label>
            <div className="grid grid-cols-2 gap-2">
              {([
                { id: 'lendo', label: 'Lendo Agora' },
                { id: 'quero_ler', label: 'Quero Ler' },
              ] as const).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setFormData({ ...formData, status: opt.id })}
                  className={`py-2 px-3 rounded-xl text-[11px] font-bold border transition-all ${
                    formData.status === opt.id
                      ? 'bg-[#1A1A1A] text-white border-[#1A1A1A]'
                      : 'bg-stone-50 text-stone-500 border-stone-100 hover:bg-stone-100'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* COLEÇÃO */}
          <div className="border-b border-stone-100 py-1.5">
            <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-stone-400 block mb-1">
              Coleção (opcional)
            </label>
            <div className="flex items-center gap-2">
              <Tag size={14} className="text-stone-300" />
              <input
                className="w-full bg-transparent outline-none font-semibold text-sm placeholder:text-stone-300"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="Ex: Ficção, Estudos..."
              />
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {collectionSuggestions.slice(0, 5).map((col) => (
                <button
                  key={col}
                  type="button"
                  onClick={() => setFormData({ ...formData, category: col })}
                  className={`text-[10px] font-semibold px-2.5 py-1 rounded-full transition-colors ${
                    formData.category === col
                      ? 'bg-[#1A1A1A] text-white'
                      : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                  }`}
                >
                  {col}
                </button>
              ))}
            </div>
          </div>

          {/* ARQUIVO PDF / EPUB */}
          <div className="bg-stone-50 rounded-xl p-4 border border-stone-100">
            <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-stone-400 mb-2.5 block">
              Arquivo Digital
            </label>
            <div className="relative flex items-center gap-3 bg-white p-3 rounded-lg border border-stone-100 group">
              <FileText size={18} className="text-stone-300 group-hover:text-stone-500 flex-shrink-0" />
              <input
                type="file"
                accept=".pdf,.epub"
                className="text-[11px] font-semibold w-full cursor-pointer file:hidden"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </div>
            <p className="text-[9px] mt-2 text-stone-400 font-semibold">Aceita ePUB e PDF</p>
            {file && <p className="text-[10px] mt-1.5 font-bold text-[#1A1A1A] truncate">📎 {file.name}</p>}
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#1A1A1A] text-white py-3.5 rounded-xl font-bold text-[11px] uppercase tracking-[0.2em] shadow-xl shadow-black/10 active:scale-[0.98] transition-all disabled:opacity-30"
        >
          {loading ? <Loader2 className="animate-spin mx-auto" size={18} /> : 'Salvar no Acervo'}
        </button>
      </form>

      {/* SUCESSO */}
      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center z-10"
          >
            <div className="bg-[#1A1A1A] w-12 h-12 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 size={24} className="text-white" />
            </div>
            <h3 className="font-serif italic text-2xl">Sincronizado</h3>
            <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mt-2">
              Disponível na Biblioteca
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
