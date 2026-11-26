"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import type { TocItem } from '@/components/reader/ReaderDrawers';

export type ReaderTheme = 'default' | 'sepia' | 'kindle' | 'comfort';

interface PdfViewerProps {
  url: string;
  pageNumber: number;
  theme: ReaderTheme;
  onDocumentReady: (totalPages: number, outline: TocItem[]) => void;
  onError: (message: string) => void;
  onSelectText: (text: string) => void;
  onCenterTap: () => void;
}

const THEME_FILTER: Record<ReaderTheme, string> = {
  default: 'none',
  sepia: 'sepia(0.28) brightness(0.97)',
  kindle: 'grayscale(0.15) contrast(1.04) brightness(0.94)',
  comfort: 'invert(0.91) hue-rotate(180deg) contrast(0.95)',
};

export default function PdfViewer({
  url,
  pageNumber,
  theme,
  onDocumentReady,
  onError,
  onSelectText,
  onCenterTap,
}: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfDocRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderTaskRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const textLayerInstanceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfjsRef = useRef<any>(null);

  const [containerWidth, setContainerWidth] = useState(0);
  const [docLoaded, setDocLoaded] = useState(false);

  // Mede largura do container para responsividade
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateWidth = () => {
      const w = el.clientWidth;
      if (w > 0) setContainerWidth(w);
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Carrega documento PDF + Sumário (Outline)
  useEffect(() => {
    let cancelled = false;

    async function loadPdf() {
      try {
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
        pdfjsRef.current = pdfjsLib;

        const loadingTask = pdfjsLib.getDocument({ url });
        const pdfDoc = await loadingTask.promise;
        if (cancelled) {
          pdfDoc.destroy();
          return;
        }

        pdfDocRef.current = pdfDoc;

        // Extrai sumário (outline) resolvendo páginas
        const rawOutline = await pdfDoc.getOutline();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mapOutline = async (items: any[], prefix = 'pdf'): Promise<TocItem[]> => {
          if (!items) return [];
          const mapped: TocItem[] = [];
          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            let targetPage: number | undefined;
            try {
              let dest = item.dest;
              if (typeof dest === 'string') {
                dest = await pdfDoc.getDestination(dest);
              }
              if (Array.isArray(dest) && dest[0]) {
                const pageIndex = await pdfDoc.getPageIndex(dest[0]);
                targetPage = pageIndex + 1;
              }
            } catch {
              // destino não resolvido
            }

            mapped.push({
              id: `${prefix}-${i}`,
              label: item.title || `Seção ${i + 1}`,
              pageNumber: targetPage,
              subitems: item.items?.length ? await mapOutline(item.items, `${prefix}-${i}`) : [],
            });
          }
          return mapped;
        };

        const toc = await mapOutline(rawOutline || []);
        if (cancelled) return;

        setDocLoaded(true);
        onDocumentReady(pdfDoc.numPages, toc);
      } catch (err) {
        console.error('Erro ao abrir PDF:', err);
        if (!cancelled) onError('Não foi possível abrir este arquivo PDF.');
      }
    }

    loadPdf();

    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel?.();
      textLayerInstanceRef.current?.cancel?.();
      pdfDocRef.current?.destroy?.();
      pdfDocRef.current = null;
      setDocLoaded(false);
    };
  }, [url, onDocumentReady, onError]);

  // Renderiza página atual + TextLayer
  const renderPage = useCallback(async () => {
    const pdfDoc = pdfDocRef.current;
    const pdfjsLib = pdfjsRef.current;
    const canvas = canvasRef.current;
    const textLayerDiv = textLayerRef.current;
    const wrapper = containerRef.current;

    if (!pdfDoc || !pdfjsLib || !canvas || !textLayerDiv || !wrapper || !docLoaded) return;
    if (containerWidth <= 0) return;

    const clampedPage = Math.max(1, Math.min(pageNumber || 1, pdfDoc.numPages));

    try {
      renderTaskRef.current?.cancel?.();
      textLayerInstanceRef.current?.cancel?.();

      const page = await pdfDoc.getPage(clampedPage);
      const baseViewport = page.getViewport({ scale: 1 });

      // Ajusta escala para caber confortavelmente na largura e altura disponíveis
      const maxW = Math.min(containerWidth - 24, 820);
      const maxH = Math.max(wrapper.clientHeight - 24, 300);
      const scaleW = maxW / baseViewport.width;
      const scaleH = maxH / baseViewport.height;
      const scale = Math.max(0.5, Math.min(scaleW, scaleH));

      const viewport = page.getViewport({ scale });
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const renderTask = page.render({
        canvasContext: ctx,
        viewport,
      });
      renderTaskRef.current = renderTask;
      await renderTask.promise;

      // Renderiza TextLayer para seleção de texto
      textLayerDiv.innerHTML = '';
      textLayerDiv.style.width = `${Math.floor(viewport.width)}px`;
      textLayerDiv.style.height = `${Math.floor(viewport.height)}px`;

      const textLayer = new pdfjsLib.TextLayer({
        textContentSource: page.streamTextContent(),
        container: textLayerDiv,
        viewport,
      });
      textLayerInstanceRef.current = textLayer;
      await textLayer.render();
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'RenderingCancelledException') return;
      console.error('Erro ao renderizar página PDF:', err);
    }
  }, [pageNumber, containerWidth, docLoaded]);

  useEffect(() => {
    renderPage();
  }, [renderPage]);

  const handleMouseOrTouchUp = () => {
    const selected = window.getSelection()?.toString().trim() || '';
    if (selected.length > 2) {
      onSelectText(selected);
    }
  };

  return (
    <div
      ref={containerRef}
      onClick={(e) => {
        const selected = window.getSelection()?.toString().trim() || '';
        if (selected.length > 2) return;
        if (e.target === containerRef.current || textLayerRef.current?.contains(e.target as Node)) {
          onCenterTap();
        }
      }}
      onMouseUp={handleMouseOrTouchUp}
      onTouchEnd={handleMouseOrTouchUp}
      className="h-full w-full flex items-center justify-center overflow-auto px-3 py-2"
    >
      <div
        className="relative shadow-[0_12px_40px_rgba(0,0,0,0.12)] rounded-sm overflow-hidden bg-white"
        style={{ filter: THEME_FILTER[theme] }}
      >
        <canvas ref={canvasRef} className="block" />
        <div ref={textLayerRef} className="pdf-text-layer" />
      </div>
    </div>
  );
}
