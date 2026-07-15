import React, { useRef, useEffect, useState, memo } from "react"
// @ts-expect-error webpack error
import * as pdfjsLib from "pdfjs-dist/webpack"
import { Loader2 } from "lucide-react"

interface PDFPreviewProps {
  url: string
  filename: string
  w_full?: boolean
  footer?: React.ReactNode
  messageId?: string // ID opcional da mensagem para referência
}

// Mapa estático para cache de PDF (compartilhado entre componentes)
const pdfCache: Map<string, {
  pageCount: number,
  fileSizeMB: number,
  canvas: HTMLCanvasElement
}> = new Map();

// Usando memo para evitar re-renderizações desnecessárias
const PDFPreview: React.FC<PDFPreviewProps> = memo(({
  url,
  filename,
  w_full,
  footer,
  messageId
}) => {
  const previewRef = useRef<HTMLDivElement | null>(null)
  const [pageCount, setPageCount] = useState<number | null>(null)
  const [fileSizeMB, setFileSizeMB] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [pdfTask, setPdfTask] = useState<any>(null)

  const renderPDFPreview = async (pdfUrl: string) => {
    try {
      // Verificar se temos o PDF em cache
      if (pdfCache.has(pdfUrl)) {
        const cachedData = pdfCache.get(pdfUrl)!;
        setPageCount(cachedData.pageCount);
        setFileSizeMB(cachedData.fileSizeMB);
        
        if (previewRef.current) {
          previewRef.current.innerHTML = "";
          // Clonar o canvas em vez de mover para permitir reutilização
          previewRef.current.appendChild(cachedData.canvas.cloneNode(true));
        }
        
        setLoading(false);
        return;
      }
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 segundos timeout
      
      const response = await fetch(pdfUrl, {
        signal: controller.signal,
        cache: 'force-cache' // Tentar usar o cache do navegador
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`Erro ao carregar PDF: ${response.status}`);
      }

      const blob = await response.blob()
      const sizeInMB = blob.size / (1024 * 1024) // Convert bytes to MB
      setFileSizeMB(sizeInMB)

      const pdfData = await blob.arrayBuffer()
      const loadingTask = pdfjsLib.getDocument({ data: pdfData })
      
      // Armazenar a tarefa para possível cancelamento
      setPdfTask(loadingTask);
      
      const pdf = await loadingTask.promise

      setPageCount(pdf.numPages) // Set the total number of pages

      const page = await pdf.getPage(1) // Render only the first page
      const viewport = page.getViewport({ scale: w_full ? 1 : 0.5 })
      const canvas = document.createElement("canvas")
      const context = canvas.getContext("2d")

      if (!context) {
        console.error("2D context not supported.")
        setError(true);
        setLoading(false);
        return
      }

      canvas.width = viewport.width
      canvas.height = viewport.height

      await page.render({ canvasContext: context, viewport }).promise

      if (previewRef.current) {
        previewRef.current.innerHTML = ""
        previewRef.current.appendChild(canvas)
        
        // Armazenar no cache
        pdfCache.set(pdfUrl, {
          pageCount: pdf.numPages,
          fileSizeMB: sizeInMB,
          canvas: canvas.cloneNode(true) as HTMLCanvasElement
        });
      }
      
      // Liberar recursos
      pdf.destroy();
      setLoading(false);
    } catch (err: any) {
      console.error("Erro ao renderizar PDF:", err);
      setError(true);
      setLoading(false);
      
      if (err.name === 'AbortError') {
        console.log('PDF rendering aborted due to timeout');
      }
    }
  }

  const handleDownload = async () => {
    try {
      setLoading(true);
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Erro ao baixar arquivo: ${response.status}`);
      }
      
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // Revoga o URL blob para liberar memória
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Erro ao baixar arquivo:", err);
      alert("Não foi possível baixar o arquivo. Tente novamente mais tarde.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (url) {
      renderPDFPreview(url);
    }
    
    // Cleanup: cancelar tarefa de PDF se houver
    return () => {
      if (pdfTask && pdfTask.destroy) {
        pdfTask.destroy();
      }
    };
  }, [url]);

  return (
    <div className="rounded-md">
      <div
        ref={previewRef}
        className="relative rounded-md"
        style={{
          clipPath: "inset(0 0 10% 0)",
          overflow: "hidden",
          height: "120px",
        }}
      >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        )}
        
        {error && !loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
            <p className="text-sm text-gray-500">Não foi possível renderizar o PDF</p>
          </div>
        )}
      </div>

      <div className="bg-gray-200 px-4 pt-2">
        <div className="text-gray-500 text-sm text-left" title={filename}>
          {filename.length > 20 ? `${filename.substring(0, 17)}...` : filename}
        </div>
        <div className="flex justify-between items-center mb-1">
          <div className="text-gray-500 text-sm">
            {pageCount ? `${pageCount} Páginas` : '...'}
          </div>
          <div className="text-gray-500 text-sm">
            {fileSizeMB ? `${fileSizeMB.toFixed(2)} MB` : '...'}
          </div>
          <div className="text-gray-500 text-sm">PDF</div>
        </div>

        <div className="flex justify-between items-center">
          <div
            className="text-gray-500 text-sm cursor-pointer"
            onClick={handleDownload}
          >
            Baixar Arquivo
          </div>
          <div>{footer}</div>
        </div>
      </div>
    </div>
  )
})

export default PDFPreview
