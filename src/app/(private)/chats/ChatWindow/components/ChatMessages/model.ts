import { MessagesContext } from "@/contexts/Messages"
import { MessageSchemaTyped } from "@/contexts/Messages/schemas"
import { useContext, useRef, useEffect, useState, useCallback } from "react"
import { MESSAGE_SENT_EVENT } from "../ChatSendMessage/model"

export interface IChatMessagesModel {
  messages: MessageSchemaTyped[]
  messagesContainerRef: React.RefObject<HTMLDivElement | null>
  isAtBottom: boolean
  scrollToBottom: (behavior?: ScrollBehavior) => void
  loadMoreMessages: () => void
  isLoadingMore: boolean
  hasMoreMessages: boolean
}

const useChatMessagesModel = (): IChatMessagesModel => {
  const { messages, loadMoreMessages, isLoadingMore, hasMoreMessages } = useContext(MessagesContext)
  const messagesContainerRef = useRef<HTMLDivElement | null>(null)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const previousMessagesLength = useRef(messages?.length || 0)
  const previousMessagesId = useRef<string | null>(null)
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isScrollingRef = useRef(false)
  const scrollThreshold = 100 // Threshold para determinar se está perto do final

  // Função otimizada para verificar se o usuário está próximo do final da rolagem
  const isNearBottom = useCallback(() => {
    const container = messagesContainerRef.current
    if (!container) return true
    
    const position = container.scrollHeight - container.scrollTop - container.clientHeight
    return position < scrollThreshold
  }, [])

  // Função otimizada para verificar se o usuário está próximo do topo
  const isNearTop = useCallback(() => {
    const container = messagesContainerRef.current
    if (!container) return false
    
    return container.scrollTop < scrollThreshold
  }, [])

  // Função de rolagem debounced para melhor performance
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    // Evitar múltiplas chamadas de rolagem concorrentes
    if (isScrollingRef.current) return
    
    isScrollingRef.current = true
    
    // Limpar timeout existente
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current)
    }
    
    scrollTimeoutRef.current = setTimeout(() => {
      const container = messagesContainerRef.current
      if (container) {
        container.scrollTo({
          top: container.scrollHeight,
          behavior
        })
        
        // Um único timeout para confirmar o status após a rolagem
        setTimeout(() => {
          setIsAtBottom(isNearBottom())
          isScrollingRef.current = false
        }, 100)
      } else {
        isScrollingRef.current = false
      }
    }, 10)
  }, [isNearBottom])

  // Efeito otimizado para monitorar scroll com throttling
  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container) return
    
    let scrollTimeout: NodeJS.Timeout | null = null
    
    const handleScroll = () => {
      // Evitar atualizações durante rolagem programática
      if (isScrollingRef.current) return
      
      // Throttle para reduzir chamadas
      if (scrollTimeout) return
      
      scrollTimeout = setTimeout(() => {
        const isBottom = isNearBottom()
        if (isBottom !== isAtBottom) {
          setIsAtBottom(isBottom)
        }
        
        // Verificar se precisa carregar mais mensagens
        if (isNearTop() && !isLoadingMore && hasMoreMessages) {
          loadMoreMessages()
        }
        
        scrollTimeout = null
      }, 100)
    }
    
    container.addEventListener('scroll', handleScroll)
    return () => {
      container.removeEventListener('scroll', handleScroll)
      if (scrollTimeout) clearTimeout(scrollTimeout)
    }
  }, [isAtBottom, isNearBottom, isNearTop, loadMoreMessages, isLoadingMore, hasMoreMessages])

  // Evento de mensagem enviada - simplificado
  useEffect(() => {
    const handleMessageSent = () => scrollToBottom('auto')
    
    window.addEventListener(MESSAGE_SENT_EVENT, handleMessageSent)
    return () => window.removeEventListener(MESSAGE_SENT_EVENT, handleMessageSent)
  }, [scrollToBottom])

  // Atualização de rolagem em novas mensagens - otimizado
  useEffect(() => {
    if (!messages || messages.length === 0) return
    
    // Verificar novas mensagens ou substituição
    const hasNewMessages = messages.length !== previousMessagesLength.current
    previousMessagesLength.current = messages.length
    
    const lastMessageId = messages[messages.length - 1]?.id
    const isNewLastMessage = lastMessageId !== previousMessagesId.current
    previousMessagesId.current = lastMessageId
    
    // Verificar se é mensagem do usuário
    const lastMessage = messages[messages.length - 1]
    const isUserMessage = !!lastMessage?.from_me
    
    // Rolar apenas se necessário
    if ((hasNewMessages || isNewLastMessage) && (isAtBottom || isUserMessage)) {
      scrollToBottom(isUserMessage ? 'auto' : 'smooth')
    }
  }, [messages, isAtBottom, scrollToBottom])

  // Rolagem inicial - uma única vez
  useEffect(() => {
    if (messages?.length > 0) {
      scrollToBottom('auto')
    }
  }, []) 

  return {
    messages,
    messagesContainerRef,
    isAtBottom,
    scrollToBottom,
    loadMoreMessages,
    isLoadingMore,
    hasMoreMessages
  }
}

export default useChatMessagesModel
