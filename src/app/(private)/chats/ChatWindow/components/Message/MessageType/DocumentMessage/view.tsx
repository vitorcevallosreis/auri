import React, { useState, useEffect, memo } from "react"
import useDocumentMessageModel from "./model"
import MessageMetadata from "../MessageMetadata/MessageMetadata"
import PdfPreview from "@/app/components/PdfPreview"
import { EnumMessageDocumentMimeType } from "@/contexts/Messages/schemas"
import { Loader2 } from "lucide-react"

const DocumentMessageView = memo(function DocumentMessageView({
  message,
}: ReturnType<typeof useDocumentMessageModel>) {
  const [isVisible, setIsVisible] = useState(false);
  
  // Usar IntersectionObserver para carregar o documento apenas quando estiver visível
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
      { rootMargin: '200px' }
    );

    let currentElement: HTMLElement | null = null;
    if (typeof document !== 'undefined') {
      currentElement = document.getElementById(`document-${message.id}`);
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
  
  const documentUrl = message?.message.documentMessage?.url || '';
  const fileName = message?.message.documentMessage?.fileName || 'Documento';
  const mimeType = message?.message.documentMessage?.mimetype;
  
  // Placeholder quando o documento não está visível
  if (!isVisible) {
    return (
      <div
        id={`document-${message.id}`}
        className="w-[350px] h-[200px] bg-muted dark:bg-gray-800 border border-border rounded-md shadow-sm flex items-center justify-center"
      >
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div 
      id={`document-${message.id}`}
      className="w-[350px] bg-card text-foreground border border-border rounded-md shadow-sm"
    >
      {mimeType === EnumMessageDocumentMimeType.PDF && (
        <PdfPreview
          url={documentUrl}
          w_full={true}
          filename={fileName}
          footer={<MessageMetadata message={message} />}
          messageId={message.id}
        />
      )}
    </div>
  )
})

export default DocumentMessageView
