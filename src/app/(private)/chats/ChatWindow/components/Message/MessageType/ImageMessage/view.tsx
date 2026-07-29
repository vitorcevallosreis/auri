import React, { useState, useEffect } from "react"
import useImageMessageModel from "./model"
import { Image } from "@nextui-org/react"
import MessageMetadata from "../MessageMetadata/MessageMetadata"
import { Loader2 } from "lucide-react"

export default function ImageMessageView({
  w_full,
  message,
}: ReturnType<typeof useImageMessageModel>) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [error, setError] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  
  const imageUrl = message.message.imageMessage?.url
  const caption = message.message.imageMessage?.caption || 'Imagem'
  
  // Gerar URL de thumbnail para carregamento inicial mais rápido
  // Ou usar a própria imagem como thumbnail se for uma URL do Minio
  const isMinio = !!imageUrl && (imageUrl.includes('minio') || imageUrl.includes('s3'))
  const thumbnailUrl = imageUrl
  
  // Usar IntersectionObserver para carregar a imagem apenas quando estiver visível
  useEffect(() => {
    if (typeof window === 'undefined' || !window.IntersectionObserver) {
      setIsVisible(true);
      return;
    }

    const observer = new window.IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        });
      },
      { rootMargin: '100px' }
    );

    let currentElement: HTMLElement | null = null;
    if (typeof document !== 'undefined') {
      currentElement = document.getElementById(`image-${message.id}`);
      if (currentElement) {
        observer.observe(currentElement);
      }
    }

    return () => {
      if (observer && currentElement) {
        observer.unobserve(currentElement);
      }
    };
  }, [message.id]);
  
  // Handler para imagens que falham ao carregar
  const handleError = () => {
    console.error(`Falha ao carregar imagem: ${imageUrl}`)
    setError(true)
    setIsLoaded(true) // Considerar como carregada mesmo com erro
  }

  return w_full ? (
    <div className={`${message.from_me ? "bg-[#efffe5]" : "bg-card"} rounded-md shadow-sm`}>
      <div 
        id={`image-${message.id}`}
        className="relative"
      >
        {isVisible && (
          <>
            {!isLoaded && !error && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted dark:bg-gray-800 rounded-md">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
              </div>
            )}
            
            {error && (
              <div className="flex items-center justify-center h-[300px] w-[400px] bg-muted dark:bg-gray-800 rounded-md">
                <p className="text-sm text-muted-foreground">Não foi possível carregar a imagem</p>
              </div>
            )}
            
            <Image
              isZoomed
              alt={caption}
              src={imageUrl}
              width={400}
              radius="sm"
              onLoad={() => setIsLoaded(true)}
              onError={handleError}
              style={{ display: isLoaded || error ? 'block' : 'none' }}
              className="transition-opacity duration-300"
              loading="lazy"
            />
          </>
        )}
        
        {!isVisible && (
          <div className="h-[300px] w-[400px] bg-muted dark:bg-gray-800 rounded-md flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        )}
      </div>

      <MessageMetadata message={message} bgColor="text-black" />
    </div>
  ) : (
    <div className={`relative inline-block ${message.from_me ? "bg-[#efffe5]" : ""} rounded-md`}>
      <div 
        id={`image-${message.id}`}
        className="relative"
      >
        {isVisible && (
          <>
            {!isLoaded && !error && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted dark:bg-gray-800 rounded-md">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
              </div>
            )}
            
            {error && (
              <div className="flex items-center justify-center h-[200px] w-[250px] bg-muted dark:bg-gray-800 rounded-md">
                <p className="text-sm text-muted-foreground">Não foi possível carregar a imagem</p>
              </div>
            )}
            
            <Image
              isZoomed
              alt={caption}
              src={imageUrl}
              width={250}
              radius="sm"
              onLoad={() => setIsLoaded(true)}
              onError={handleError}
              style={{ display: isLoaded || error ? 'block' : 'none' }}
              className="transition-opacity duration-300"
              loading="lazy"
            />
          </>
        )}
        
        {!isVisible && (
          <div className="h-[200px] w-[250px] bg-muted dark:bg-gray-800 rounded-md flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        )}
      </div>

      <div className="absolute bottom-1 right-1 rounded text-xs z-10">
        <MessageMetadata message={message} bgColor="text-white" />
      </div>
    </div>
  )
}
