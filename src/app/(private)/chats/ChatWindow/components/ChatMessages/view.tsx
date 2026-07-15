import React, { useState, useEffect, useRef, memo, useCallback } from "react"
import useChatMessagesModel from "./model"
import MessageBubble from "../Message/MessageBubble"
import { useTyping } from "@/contexts/typing"
import TypingIndicator from "../TypingIndicator"
import { ChatsContext } from "@/contexts/Chats"
import { useContext } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronDown, Loader2 } from "lucide-react"
import moment from "moment"
import type { MessageSchemaTyped } from "@/contexts/Messages/schemas"

// Componente MessageItem otimizado com memo para evitar re-renderizações desnecessárias
interface MessageItemProps {
  message: MessageSchemaTyped
  openMessageId: string | null
  handleContextMenu: (e: React.MouseEvent, messageId: string) => void
  setOpenMessageId: React.Dispatch<React.SetStateAction<string | null>>
}

const MessageItem = memo(
  (props: MessageItemProps) => {
    const { message, openMessageId, handleContextMenu, setOpenMessageId } = props
    return (
      <MessageBubble
        key={message.id}
        message={message}
        w_full={false}
        actions={true}
        openMessageId={openMessageId}
        handleContextMenu={(e) => handleContextMenu(e, message.id)}
        setOpenMessageId={setOpenMessageId}
      />
    )
  },
  (prevProps, nextProps) => {
    // Otimizar renderização apenas quando necessário
    return (
      prevProps.message.id === nextProps.message.id &&
      prevProps.openMessageId === nextProps.openMessageId &&
      prevProps.message.status === nextProps.message.status
    )
  }
)

// Para evitar erro de displayName
MessageItem.displayName = 'MessageItem'

export default function ChatMessagesView({
  messages,
  messagesContainerRef,
  isAtBottom,
  scrollToBottom,
  loadMoreMessages,
  isLoadingMore,
  hasMoreMessages
}: ReturnType<typeof useChatMessagesModel>) {
  const [openMessageId, setOpenMessageId] = useState<string | null>(null)
  const { typingState } = useTyping();
  const { selected_chat_windows, chats } = useContext(ChatsContext);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const thumbRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const startYRef = useRef(0);
  const startScrollTopRef = useRef(0);
  
  // Encontrar o nome do contato atual
  const currentChat = chats?.find(chat => chat.id === selected_chat_windows);
  const contactName = currentChat?.contact?.name || "Contato";
  
  // Verificar se o contato está digitando
  const isTyping = selected_chat_windows ? 
    (typingState[selected_chat_windows]?.isTyping || false) : 
    false;

  // Otimizar o tratamento de clique direito
  const handleContextMenu = (e: React.MouseEvent, messageId: string) => {
    e.preventDefault()
    setOpenMessageId(openMessageId === messageId ? null : messageId)
  }

  // Função de rolagem manual otimizada
  const handleScrollToBottom = () => scrollToBottom('auto');
  
  // Atualizar a posição da barra de rolagem com debounce
  const updateScrollbarPosition = useCallback(() => {
    if (messagesContainerRef.current) {
      const { scrollTop, clientHeight, scrollHeight } = messagesContainerRef.current;
      setScrollPosition(scrollTop);
      setContainerHeight(clientHeight);
      setContentHeight(scrollHeight);
    }
  }, [messagesContainerRef]);
  
  const debouncedUpdateScrollbar = useCallback(() => {
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(updateScrollbarPosition, 100);
  }, [updateScrollbarPosition]);
  
  // Manipuladores de eventos para a barra de rolagem personalizada - otimizados
  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!messagesContainerRef.current || e.target !== e.currentTarget) return;
    
    const { top, height } = e.currentTarget.getBoundingClientRect();
    const clickPosition = e.clientY - top;
    const percentage = clickPosition / height;
    const scrollTarget = percentage * (contentHeight - containerHeight);
    
    messagesContainerRef.current.scrollTop = scrollTarget;
    updateScrollbarPosition();
  };
  
  const handleThumbMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    isDraggingRef.current = true;
    startYRef.current = e.clientY;
    startScrollTopRef.current = messagesContainerRef.current?.scrollTop || 0;
    
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      document.addEventListener('mousemove', handleThumbMouseMove);
      document.addEventListener('mouseup', handleThumbMouseUp);
    }
  };
  
  const handleThumbMouseMove = useCallback((e: MouseEvent) => {
    if (!isDraggingRef.current || !messagesContainerRef.current) return;
    
    const deltaY = e.clientY - startYRef.current;
    const ratio = containerHeight / contentHeight;
    const scrollDelta = deltaY / ratio;
    
    messagesContainerRef.current.scrollTop = startScrollTopRef.current + scrollDelta;
    updateScrollbarPosition();
  }, [containerHeight, contentHeight, updateScrollbarPosition]);
  
  const handleThumbMouseUp = useCallback(() => {
    isDraggingRef.current = false;
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      document.removeEventListener('mousemove', handleThumbMouseMove);
      document.removeEventListener('mouseup', handleThumbMouseUp);
    }
  }, [handleThumbMouseMove]);
  
  // Referência para controle de timeout
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Observer para detecção de redimensionamento - otimizado
  useEffect(() => {
    const messagesList = messagesContainerRef.current?.querySelector('div.grid');
    if (!messagesList) return;
    
    const observer = new ResizeObserver(debouncedUpdateScrollbar);
    observer.observe(messagesList);
    
    return () => {
      observer.disconnect();
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, [debouncedUpdateScrollbar]);
  
  // Listener de scroll otimizado com debounce
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    
    const handleScroll = () => {
      debouncedUpdateScrollbar();
    };
    
    container.addEventListener('scroll', handleScroll);
    
    // Inicializar dimensões
    updateScrollbarPosition();
    
    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, [debouncedUpdateScrollbar, updateScrollbarPosition]);
  
  // Altura e posição do thumb calculadas apenas quando necessário
  const thumbHeight = containerHeight > 0 && contentHeight > 0
    ? Math.max(30, (containerHeight / contentHeight) * containerHeight)
    : 0;
  const thumbTop = containerHeight > 0 && contentHeight > 0
    ? (scrollPosition / (contentHeight - containerHeight)) * (containerHeight - thumbHeight)
    : 0;

  // Função para gerar separadores de data
  const dayLabel = (isoDate: string) => {
    const m = moment(isoDate)
    if (m.isSame(moment(), "day")) return "Hoje"
    if (m.isSame(moment().subtract(1, "day"), "day")) return "Ontem"
    return m.format("DD/MM/YYYY")
  }

  // Renderizar mensagens com separadores de data
  const renderMessagesWithSeparators = () => {
    if (!messages || messages.length === 0) return null
    
    const elements = []
    let lastLabel: string | null = null
    
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i]
      const ts = (message.created_at ?? message.updated_at ?? new Date().toISOString()) as string
      const label = dayLabel(ts)
      
      // Adicionar separador de data se mudou o dia
      if (label !== lastLabel) {
        elements.push(
          <div key={`sep-${label}-${ts}`} className="flex items-center my-2">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="mx-3 text-[11px] px-2.5 py-0.5 rounded-full bg-gray-100 border border-gray-200 text-gray-600 leading-none">
              {label}
            </span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>
        )
        lastLabel = label
      }
      
      // Adicionar mensagem
      elements.push(
        <div key={message.id} className="w-full flex mb-0.5">
          <MessageItem
            message={message}
            openMessageId={openMessageId}
            handleContextMenu={handleContextMenu}
            setOpenMessageId={setOpenMessageId}
          />
        </div>
      )
    }
    
    return elements
  }

  // Fallback confiável: após renderização de novas mensagens, rolar o anchor invisível
  useEffect(() => {
    if (!messages || messages.length === 0) return
    const last = messages[messages.length - 1]
    // Rolagem imediata para mensagens do usuário; suave para recebidas
    messagesEndRef.current?.scrollIntoView({ behavior: last?.from_me ? 'auto' : 'smooth' })
  }, [messages])

  return (
    <div className="flex-1 min-h-0 overflow-hidden flex">
      <div
        ref={messagesContainerRef}
        className="flex-1 min-h-0 overflow-y-auto p-4 will-change-scroll"
        style={{
          overscrollBehavior: 'contain',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0
        }}
      >
        <style jsx>{`
          div::-webkit-scrollbar {
            display: none;
          }
        `}</style>
        
        <div className="grid gap-0.5 pb-2 flex-grow min-h-0" style={{ minHeight: '100%' }}>
          {/* Loader para carregar mais mensagens */}
          {hasMoreMessages && (
            <div className="flex justify-center my-2">
              <button
                onClick={loadMoreMessages}
                disabled={isLoadingMore}
                className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                {isLoadingMore ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Carregar mensagens anteriores"
                )}
              </button>
            </div>
          )}
          
          {/* Indicador de carregamento */}
          {isLoadingMore && (
            <div className="flex justify-center py-2">
              <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
            </div>
          )}
          
          {/* Renderização de mensagens com separadores */}
          {renderMessagesWithSeparators()}
          
          {/* Indicador de Digitação */}
          <TypingIndicator isTyping={isTyping} contactName={contactName} />
          
          {/* Elemento invisível no final da lista para referência de rolagem */}
          <div ref={messagesEndRef} className="h-4" />
        </div>
      </div>
      
      {/* Barra de rolagem personalizada otimizada */}
      <div 
        className="w-4 h-full flex items-center justify-center"
        style={{
          position: 'relative',
          cursor: 'pointer',
          zIndex: 10
        }}
      >
        <div
          className="w-3 h-full rounded-full bg-gray-100 dark:bg-gray-800"
          style={{
            opacity: 0.6,
            transition: 'opacity 0.2s',
          }}
          onClick={handleTrackClick}
        />
        
        {/* Thumb da barra de rolagem */}
        <div
          ref={thumbRef}
          className="absolute w-3 rounded-full bg-gray-400 dark:bg-gray-600 hover:bg-gray-500 dark:hover:bg-gray-500"
          style={{
            top: `${thumbTop}px`,
            height: `${thumbHeight}px`,
            cursor: 'grab',
            opacity: isDraggingRef.current ? 0.8 : 0.6,
            transition: 'opacity 0.2s, background-color 0.2s',
          }}
          onMouseDown={handleThumbMouseDown}
        />
      </div>
      
      {/* Botão de rolagem para o final */}
      <AnimatePresence>
        {!isAtBottom && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-24 right-5 z-20"
          >
            <button
              onClick={handleScrollToBottom}
              className="flex items-center justify-center w-10 h-10 bg-primary text-white rounded-full shadow-md hover:bg-primary/90 transition-colors"
              aria-label="Rolar para o final"
            >
              <ChevronDown className="w-5 h-5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
