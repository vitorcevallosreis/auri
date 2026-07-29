import React, { useEffect, useState, useRef, memo } from "react"
import useAudioMessageModel from "./model"
import AudioWave from "./AudioWave"
import MessageMetadata from "../MessageMetadata/MessageMetadata"
import { MinioService } from "@/services/MinioService"
import { Loader2 } from "lucide-react"

// Usando memo para evitar re-renderizações desnecessárias
const AudioMessageView = memo(function AudioMessageView({
  w_full,
  message,
}: ReturnType<typeof useAudioMessageModel>) {
  const [blob, setBlob] = useState<Blob>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [isPending, setIsPending] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [directUrl, setDirectUrl] = useState<string | null>(null)
  
  // Ref para armazenar a URL atual sendo processada
  const processedUrlRef = useRef<string | null>(null);
  const blobCache = useRef<Record<string, Blob>>({});

  // Usar IntersectionObserver para carregar o áudio apenas quando estiver visível
  useEffect(() => {
    if (!window.IntersectionObserver) {
      setIsVisible(true)
      return
    }
    
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: '200px' } // Pré-carregar quando estiver a 200px de distância
    )
    
    const currentElement = document.getElementById(`audio-${message.id}`)
    if (currentElement) {
      observer.observe(currentElement)
    }
    
    return () => {
      if (currentElement) {
        observer.unobserve(currentElement)
      }
    }
  }, [message.id])

  useEffect(() => {
    // Só carregar o blob se o componente estiver visível
    if (!isVisible) return;

    const loadBlob = async () => {
      if (!message.message.audioMessage?.url) {
        setLoading(false)
        setError(true)
        setErrorMessage("URL de áudio não encontrada")
        return
      }

      try {
        const url = message.message.audioMessage.url
        
        // Verificar no cache local de blobs
        if (blobCache.current[url]) {
          console.log('Usando blob do cache para URL:', url);
          setBlob(blobCache.current[url]);
          setLoading(false);
          setError(false);
          setIsPending(false);
          return;
        }
        
        // Se a URL for a mesma que já estamos processando, e já temos um blob, não fazer nada
        if (processedUrlRef.current === url && blob) {
          console.log('URL já está sendo processada e temos um blob, ignorando');
          setLoading(false);
          return;
        }
        
        // Atualizar a URL que estamos processando
        processedUrlRef.current = url;
        
        // Verificar se é uma URL temporária/pendente
        if (url === "pending://audio_upload") {
          console.log("Áudio ainda está sendo processado no servidor")
          setIsPending(true)
          setLoading(false)
          setError(false)
          return
        }
        
        // Se a URL já for base64, podemos criar um blob diretamente
        if (url.startsWith('data:')) {
          console.log('URL de áudio é base64, convertendo para blob')
          
          try {
            // Extrair a parte base64 da URL
            const base64Data = url.split(',')[1]
            const mimeType = url.split(';')[0].split(':')[1]
            
            // Converter base64 para blob - otimizado para grandes volumes de dados
            const byteCharacters = atob(base64Data)
            const byteArrays = []
            
            // Processar em blocos de 1024 bytes para melhor performance
            const chunkSize = 1024;
            for (let offset = 0; offset < byteCharacters.length; offset += chunkSize) {
              const slice = byteCharacters.slice(offset, offset + chunkSize)
              
              const byteNumbers = new Array(slice.length)
              for (let i = 0; i < slice.length; i++) {
                byteNumbers[i] = slice.charCodeAt(i)
              }
              
              const byteArray = new Uint8Array(byteNumbers)
              byteArrays.push(byteArray)
            }
            
            const audioBlob = new Blob(byteArrays, { type: mimeType })
            setBlob(audioBlob)
            // Armazenar no cache local
            blobCache.current[url] = audioBlob;
            setError(false)
            setIsPending(false)
            return
          } catch (base64Error) {
            console.error("Erro ao processar base64:", base64Error)
            throw new Error("Erro ao processar áudio em formato base64")
          }
        }
        
        // Se a URL começar com 'http', é uma URL do Minio ou outra URL externa
        if (url.startsWith('http')) {
          const isMinioUrl = MinioService.isMinioUrl(url);
          const isWhatsappCdn = url.includes('mmg.whatsapp.net') || url.includes('whatsapp.net')

          // Se for CDN do WhatsApp, tocar diretamente via URL (evita CORS no fetch do blob)
          if (isWhatsappCdn) {
            setDirectUrl(url)
            setError(false)
            setIsPending(false)
            return
          }
          
          // Adicionar parâmetros de cache-busting para URLs do Minio
          let fetchUrl = url;
          if (isMinioUrl) {
            // Adicionar timestamp para evitar problemas de cache
            fetchUrl = `${url}?t=${new Date().getTime()}`;
          }
          
          // Tentar carregar o áudio da URL com timeout para evitar esperas infinitas
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 15000) // 15 segundos de timeout
          
          try {
            const response = await fetch(fetchUrl, { 
              signal: controller.signal,
              cache: 'no-store'
            })
            clearTimeout(timeoutId)
            
            if (!response.ok) {
              throw new Error(`Erro ao carregar áudio: ${response.status}`)
            }
            
            const audioBlob = await response.blob()
            setBlob(audioBlob)
            // Armazenar no cache local
            blobCache.current[url] = audioBlob;
            setError(false)
            setIsPending(false)
          } catch (fetchError: unknown) {
            clearTimeout(timeoutId)
            
            if (fetchError instanceof DOMException && fetchError.name === 'AbortError') {
              throw new Error('Tempo limite excedido ao carregar o áudio')
            } else {
              // Fallback: tentar tocar diretamente via URL
              setDirectUrl(url)
              setError(false)
              setIsPending(false)
              return
            }
          }
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        console.error("Erro ao carregar o áudio:", msg)
        setError(true)
        setErrorMessage(msg || "Não foi possível carregar o áudio")
        setIsPending(false)
      } finally {
        setLoading(false)
      }
    }

    setLoading(true)
    setError(false)
    setErrorMessage("")
    setIsPending(false)
    loadBlob()
  }, [message.message.audioMessage?.url, isVisible, blob])

  // Placeholder quando o áudio não está visível
  if (!isVisible) {
    return (
      <div
        id={`audio-${message.id}`}
        className={`flex items-center justify-center rounded-lg shadow-md bg-muted dark:bg-gray-800 ${
          w_full ? "w-full h-20" : "w-[400px] h-20"
        }`}
      >
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div
      id={`audio-${message.id}`}
      className={`flex items-center rounded-lg shadow-md ${
        w_full ? "w-full" : "w-[400px]"
      } ${
        message.from_me ? "bg-[#efffe5]" : "bg-card"
      }`}
    >
      {loading && (
        <div className="p-4 flex items-center justify-center w-full">
          <Loader2 className="w-6 h-6 text-primary animate-spin mr-2" />
          <span className="text-muted-foreground">Carregando áudio...</span>
        </div>
      )}
      
      {isPending && !loading && (
        <div className="p-4 text-amber-500 w-full">
          <span className="flex items-center justify-center">
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-amber-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Processando áudio...
          </span>
        </div>
      )}
      
      {error && !loading && !isPending && (
        <div className="p-4 text-red-500 w-full text-center">
          {errorMessage || "Não foi possível carregar o áudio"}
        </div>
      )}
      
      {blob && !loading && !error && !isPending && !directUrl && (
        <AudioWave
          message={message}
          blob={blob}
          metadata={
            <MessageMetadata message={message} textColor="text-white" />
          }
        />
      )}

      {/* Fallback player quando não conseguimos obter o blob (CORS/signed URL) */}
      {directUrl && !loading && !isPending && (
        <div className="p-3 w-full">
          <audio controls src={directUrl} className="w-full" preload="none" />
          <div className="mt-1">
            <MessageMetadata message={message} textColor={message.from_me ? 'text-black' : 'text-black'} />
          </div>
        </div>
      )}
    </div>
  )
})

export default AudioMessageView;
