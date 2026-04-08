"use client";

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { searchBookByTitle } from '@/lib/googleBooks';
import { Upload, BookMarked, Sparkles, Loader2, CheckCircle2, FileText, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function BookUpload() {
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
  });

  const sanitizeFileName = (name: string) => name.replace(/[^a-z0-9.]/gi, '_').toLowerCase();

  const handleTitleBlur = async () => {
    if (isSearching || !formData.title || formData.title.length < 3) return;
    setIsSearching(true);
    try {
      const data = await searchBookByTitle(formData.title);
      if (data) {
        setFormData({
          title: data.title,
          author: data.author,
          description: data.description?.substring(0, 150) + '...',
          pages: data.pageCount,
        });
        setPreviewCover(data.coverUrl);
      }
    } catch (err) {
      console.error("Erro na busca:", err);
    } finally {
      setTimeout(() => setIsSearching(false), 800);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !formData.title) return alert("Título e o arquivo (PDF ou ePUB) são obrigatórios!");

    setLoading(true);
    try {
      // 1. Upload do Arquivo (PDF ou ePUB)
      const cleanFileName = sanitizeFileName(file.name);
      const filePath = `files/${Date.now()}_${cleanFileName}`; // Mudamos de 'pdfs' para 'files'
      
      const { error: fileError } = await supabase.storage
        .from('pdfs') // Mantendo o bucket 'pdfs' mas aceitando ambos os formatos
        .upload(filePath, file, { upsert: true });

      if (fileError) throw new Error(`Erro no arquivo: ${fileError.message}`);

      // 2. Definir Capa
      let finalCoverUrl = previewCover;
      if (coverFile) {
        const cleanCoverName = sanitizeFileName(coverFile.name);
        const coverPath = `covers/${Date.now()}_${cleanCoverName}`;
        const { error: cError } = await supabase.storage
          .from('covers')
          .upload(coverPath, coverFile, { upsert: true });
        if (cError) throw new Error(`Erro na Capa: ${cError.message}`);
        const { data: { publicUrl } } = supabase.storage.from('covers').getPublicUrl(coverPath);
        finalCoverUrl = publicUrl;
      }

      // 3. Salvar no Banco
      const { error: dbError } = await supabase.from('books').insert([{
        title: formData.title,
        author: formData.author,
        description: formData.description,
        total_pages: formData.pages,
        pdf_url: filePath, // O banco guarda o caminho do arquivo
        cover_url: finalCoverUrl,
      }]);

      if (dbError) throw dbError;

      setSuccess(true);
      setFormData({ title: '', author: '', description: '', pages: 0 });
      setPreviewCover('');
      setFile(null);
      setTimeout(() => setSuccess(false), 3000);
      
    } catch (error: any) {
      alert(error.message || "Erro no upload");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9F7] text-[#1A1A1A] pb-32 font-sans">
      {/* HEADER PREMIUM */}
      <header className="sticky top-0 z-50 bg-[#F8F9F7]/80 backdrop-blur-xl border-b border-stone-200/50 px-6 py-5 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="bg-[#1A1A1A] p-2 rounded-lg shadow-black/10 shadow-lg">
            <BookMarked size={18} className="text-white" />
          </div>
          <h1 className="text-2xl leading-none italic font-serif" style={{ fontFamily: 'var(--font-serif)' }}>
            IB<span className="not-italic font-sans font-light text-stone-400 tracking-tighter">Read</span>
          </h1>
        </div>
        <Sparkles size={16} className={isSearching ? "animate-pulse text-stone-400" : "text-stone-200"} />
      </header>

      <div className="max-w-md mx-auto px-6 py-8">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.04)] border border-stone-100 p-8 relative overflow-hidden"
        >
          <div className="flex items-center gap-2 mb-8">
             <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400">Adicionar à Coleção</h2>
             <div className="h-[1px] flex-1 bg-stone-100" />
          </div>

          <form onSubmit={handleUpload} className="space-y-6">
            {/* UPLOAD DA CAPA */}
            <div className="flex justify-center mb-4">
              <label className="group relative cursor-pointer w-32 h-44 bg-stone-50 rounded-xl flex flex-col items-center justify-center border border-dashed border-stone-200 shadow-inner transition-all hover:bg-stone-100 overflow-hidden">
                {previewCover ? (
                  <img src={previewCover} className="w-full h-full object-cover" alt="preview" />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-stone-300">
                    <Upload size={24} strokeWidth={1.5} />
                    <span className="text-[9px] font-bold uppercase tracking-widest">Capa</span>
                  </div>
                )}
                <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                  const fileInput = e.target.files?.[0];
                  if (fileInput) { setCoverFile(fileInput); setPreviewCover(URL.createObjectURL(fileInput)); }
                }} />
              </label>
            </div>

            <div className="space-y-4">
              {/* TÍTULO */}
              <div className="border-b border-stone-100 py-2">
                <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-stone-300 block mb-1">Título</label>
                <input 
                  className="w-full bg-transparent outline-none font-bold text-sm placeholder:text-stone-200"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  onBlur={handleTitleBlur}
                  placeholder="Ex: Dom Casmurro"
                />
              </div>

              {/* AUTOR */}
              <div className="border-b border-stone-100 py-2">
                <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-stone-300 block mb-1">Autor</label>
                <div className="flex items-center gap-2">
                  <User size={14} className="text-stone-200" />
                  <input 
                    className="w-full bg-transparent outline-none font-bold text-sm placeholder:text-stone-200"
                    value={formData.author}
                    onChange={(e) => setFormData({...formData, author: e.target.value})}
                    placeholder="Autor..."
                  />
                </div>
              </div>

              {/* ARQUIVO PDF / EPUB */}
              <div className="bg-stone-50 rounded-xl p-4 border border-stone-100">
                <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-stone-400 mb-3 block">Arquivo Digital</label>
                <div className="relative flex items-center gap-3 bg-white p-3 rounded-lg border border-stone-100 group">
                    <FileText size={18} className="text-stone-300 group-hover:text-stone-500" />
                    <input 
                        type="file" 
                        accept=".pdf,.epub" 
                        className="text-[10px] font-bold w-full cursor-pointer file:hidden"
                        onChange={(e) => setFile(e.target.files?.[0] || null)}
                    />
                </div>
                <p className="text-[8px] mt-2 text-stone-300 uppercase font-bold tracking-tighter">Aceita PDF e ePUB</p>
                {file && <p className="text-[9px] mt-2 font-bold text-[#1A1A1A] truncate px-1 italic">📎 {file.name}</p>}
              </div>
            </div>

            <button 
              type="submit" disabled={loading}
              className="w-full bg-[#1A1A1A] text-white py-4 rounded-xl font-bold text-[11px] uppercase tracking-[0.2em] shadow-xl shadow-black/10 active:scale-[0.98] transition-all disabled:opacity-30"
            >
              {loading ? <Loader2 className="animate-spin mx-auto" size={18} /> : 'Salvar no Acervo'}
            </button>
          </form>

          {/* SUCESSO */}
          <AnimatePresence>
            {success && (
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center z-10"
              >
                <div className="bg-[#1A1A1A] w-12 h-12 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle2 size={24} className="text-white" />
                </div>
                <h3 className="font-serif italic text-xl">Sincronizado</h3>
                <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mt-2">Disponível na Estante</p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}