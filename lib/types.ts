import type { SupabaseClient } from '@supabase/supabase-js';

export type BookStatus = 'lendo' | 'quero_ler' | 'finalizado';
export type HighlightColor = 'amber' | 'blue' | 'green' | 'rose';

export interface Book {
  id: string;
  user_id?: string | null;
  title: string;
  author: string;
  description?: string | null;
  cover_url: string | null;
  pdf_url: string;
  current_page: number;
  total_pages: number;
  last_cfi?: string | null;
  category?: string | null;
  status?: BookStatus | null;
  personal_notes?: string | null;
  updated_at: string;
  created_at?: string;
}

export interface BookBookmark {
  id: string;
  user_id: string;
  book_id: string;
  cfi: string | null;
  page_number: number;
  chapter_title: string | null;
  created_at: string;
}

export interface BookHighlight {
  id: string;
  user_id: string;
  book_id: string;
  cfi: string | null;
  page_number: number;
  selected_text: string;
  note: string | null;
  color: HighlightColor;
  chapter_title: string | null;
  created_at: string;
}

export const HIGHLIGHT_STYLES: Record<
  HighlightColor,
  { label: string; dot: string; border: string; bg: string; epubFill: string }
> = {
  amber: {
    label: 'Âmbar',
    dot: 'bg-amber-300',
    border: 'border-l-amber-400',
    bg: 'bg-amber-50/70',
    epubFill: '#FCD34D',
  },
  blue: {
    label: 'Azul',
    dot: 'bg-sky-300',
    border: 'border-l-sky-400',
    bg: 'bg-sky-50/70',
    epubFill: '#7DD3FC',
  },
  green: {
    label: 'Verde',
    dot: 'bg-emerald-300',
    border: 'border-l-emerald-400',
    bg: 'bg-emerald-50/70',
    epubFill: '#6EE7B7',
  },
  rose: {
    label: 'Rosa',
    dot: 'bg-rose-300',
    border: 'border-l-rose-400',
    bg: 'bg-rose-50/70',
    epubFill: '#FDA4AF',
  },
};

export function extractStoragePath(urlOrPath: string | null | undefined, bucket: string): string | null {
  if (!urlOrPath) return null;
  const trimmed = urlOrPath.trim();
  if (!trimmed) return null;

  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return trimmed.replace(/^\/+/, '');
  }

  const markers = [
    `/storage/v1/object/public/${bucket}/`,
    `/storage/v1/object/sign/${bucket}/`,
    `/storage/v1/object/authenticated/${bucket}/`,
  ];

  for (const marker of markers) {
    const idx = trimmed.indexOf(marker);
    if (idx !== -1) {
      const rawPath = trimmed.slice(idx + marker.length).split('?')[0];
      return rawPath ? decodeURIComponent(rawPath) : null;
    }
  }

  return null;
}

export async function deleteBookWithAssets(
  supabase: SupabaseClient,
  book: Pick<Book, 'id' | 'pdf_url' | 'cover_url'>
): Promise<void> {
  const { error: dbError } = await supabase.from('books').delete().eq('id', book.id);
  if (dbError) throw dbError;

  const filePath = extractStoragePath(book.pdf_url, 'pdfs');
  if (filePath) {
    const { error: pdfErr } = await supabase.storage.from('pdfs').remove([filePath]);
    if (pdfErr) console.error('Erro ao remover arquivo do bucket pdfs:', pdfErr);
  }

  const coverPath = extractStoragePath(book.cover_url, 'covers');
  if (coverPath) {
    const { error: coverErr } = await supabase.storage.from('covers').remove([coverPath]);
    if (coverErr) console.error('Erro ao remover capa do bucket covers:', coverErr);
  }
}

export function getBookProgressPercent(book: Pick<Book, 'current_page' | 'total_pages'>): number {
  if (!book.total_pages || book.total_pages <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((book.current_page / book.total_pages) * 100)));
}
