import { ChatsContext } from "@/contexts/Chats"
import { Chat } from "@/contexts/Chats/interfaces"
import { MessagesContext } from "@/contexts/Messages"
import {
  useContext,
  useState,
  Dispatch,
  SetStateAction,
  useRef,
  useEffect,
} from "react"
import { v4 as uuidv4 } from "uuid"
import { MinioService } from "@/services/MinioService"

// Constante para o nome do evento personalizado
export const MESSAGE_SENT_EVENT = "message_sent";

// Função para notificar que uma mensagem foi enviada (reutilizável)
export const notifyMessageSent = () => {
  console.log('Disparando evento personalizado MESSAGE_SENT_EVENT');
  // Criar e disparar o evento personalizado
  const messageSentEvent = new Event(MESSAGE_SENT_EVENT);
  window.dispatchEvent(messageSentEvent);
};

export interface IChatSendMessageModel {
  chat: Chat
  message: string
  handleSendMessageText: () => Promise<void>
  get_chat_controll: () => Promise<void>
  show_action_text: boolean
  handleSelect: (e: React.SyntheticEvent<HTMLTextAreaElement>) => void
  handleFormatText: (formatType: string) => void
  audio_recording: boolean
  handleRecordingAudio: () => void
  handleStopRecording: () => void
  recordedAudio: string | null
  handleRemoveAudio: () => void
  files: File[]
  set_files: Dispatch<SetStateAction<File[]>>
  handleSendAudio: () => Promise<void>
  recordingTime: number
  formatTime: (seconds: number) => string
  send_midia_message: (chat_id: string, midia: File, caption?: string) => Promise<void>
  audioStream: MediaStream | null
  audio_blob: Blob | null
  handleChangeText: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  rows: number
  isSending: boolean
}

const useChatSendMessageModel = (): IChatSendMessageModel => {
  const { chat, getChatControll } = useContext(ChatsContext)
  const { sendTypingIndicator } = useContext(MessagesContext)
  const [message, set_message] = useState("")
  const [show_action_text, set_show_action_text] = useState(false)
  const [selectedText, setSelectedText] = useState<string>("")
  const [audio_recording, set_audio_recording] = useState(false)
  const [recordedAudio, setRecordedAudio] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const [files, set_files] = useState<File[]>([])
  const [audio_blob, set_audio_blob] = useState<Blob | null>(null)
  const [recordingTime, setRecordingTime] = useState(0)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const [rows, setRows] = useState(1)
  const [isSending, setIsSending] = useState(false)
  
  // Referência para o timeout de digitação
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Estado para rastrear quando o usuário está digitando
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    if (audio_recording) {
      setRecordingTime(0) // Reset ao iniciar
      intervalRef.current = setInterval(() => {
        setRecordingTime((prevTime) => prevTime + 1)
      }, 1000)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [audio_recording])

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(
      2,
      "0"
    )}`
  }

  const handleSendMessageText = async () => {
    console.log('Enviando mensagem de texto...');
    if (message.trim() === "") return
    if (!message || !chat?.id) return

    try {
      // Enviar via API interna para inserir no DB (status sending) e acionar n8n
      await fetch('/api/messages/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chat.id,
          message_type: 'text',
          content: { conversation: message },
          from_me: true,
        })
      })
      
      // No response checking with no-cors mode
      
      // Notificar que uma mensagem foi enviada para acionar a rolagem
      notifyMessageSent();

      set_message("")
      // Resetar o número de linhas do textarea
      setRows(1)
      
      // Parar o indicador de digitação quando a mensagem for enviada
      if (isTyping) {
        setIsTyping(false);
        sendTypingIndicator(chat.id, false);
        
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
      }
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
    }
  }

  const adjustRows = (text: string) => {
    const lineCount = text.split("\n").length
    setRows(Math.min(Math.max(lineCount, 1), 6))
  }

  const handleChangeText = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value

    set_message(text)
    adjustRows(text)
    
    // Enviar indicador de digitação
    if (chat?.id && text.length > 0) {
      // Se não está digitando ainda, mudar para digitando
      if (!isTyping) {
        setIsTyping(true);
        sendTypingIndicator(chat.id, true);
      }
      
      // Resetar o timeout existente se houver
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Definir um novo timeout para parar o indicador após 5 segundos
      typingTimeoutRef.current = setTimeout(() => {
        if (isTyping) {
          setIsTyping(false);
          sendTypingIndicator(chat.id, false);
        }
      }, 5000);
    } else if (chat?.id && text.length === 0 && isTyping) {
      // Se parou de digitar (campo vazio), parar o indicador
      setIsTyping(false);
      sendTypingIndicator(chat.id, false);
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter") {
      if (e.shiftKey) {
        e.preventDefault()
        set_message((prev) => prev + "\n")
        adjustRows(message + "\n")
      } else {
        e.preventDefault()
        handleSendMessageText()
      }
    }
  }

  const get_chat_controll = async () => {
    // if (!chat.id) return
    // await getChatControll(chat.id);
  }

  const handleSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const textarea = e.target as HTMLTextAreaElement
    const text = textarea.value.slice(
      textarea.selectionStart,
      textarea.selectionEnd
    )

    setSelectedText(text)
    if (text) {
      set_show_action_text(true)
    } else {
      set_show_action_text(false)
    }
  }

  const handleFormatText = (formatType: string) => {
    let formattedText = ""

    if (!selectedText) return

    switch (formatType) {
      case "bold":
        formattedText = `**${selectedText}**`
        break
      case "italic":
        formattedText = `*${selectedText}*`
        break
      case "underline":
        formattedText = `_${selectedText}_`
        break
      default:
        return
    }

    const start = message.indexOf(selectedText)
    const end = start + selectedText.length

    const updatedMessage =
      message.substring(0, start) + formattedText + message.substring(end)
    set_message(updatedMessage)

    setSelectedText("")
    set_show_action_text(false)
  }

  // Iniciar gravação
  const handleRecordingAudio = async () => {
    try {
      // Limpar qualquer gravação anterior
      audioChunksRef.current = [];
      
      // Solicitar permissão para acessar o microfone
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Configurar o MediaRecorder com melhor qualidade para WhatsApp
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm',
        audioBitsPerSecond: 128000 // 128kbps para melhor qualidade
      });
      
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        // Criar o blob de áudio com o formato correto para WhatsApp
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/mp3",
        });

        const audioUrl = URL.createObjectURL(audioBlob);

        setRecordedAudio(audioUrl);
        set_audio_blob(audioBlob);
      };

      // Iniciar a gravação
      mediaRecorder.start();
      set_audio_recording(true);
      setAudioStream(stream);
    } catch (error) {
      console.error("Erro ao iniciar gravação de áudio:", error);
      alert("Não foi possível acessar o microfone. Verifique as permissões do navegador.");
    }
  };

  // Parar gravação
  const handleStopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop()
      set_audio_recording(false)

      const stream = mediaRecorderRef.current.stream
      if (stream) {
        stream.getTracks().forEach((track) => track.stop())
      }
    }
  }
  
  // Implementação do send_midia_message com Presigned PUT (MinIO) e caption
  const send_midia_message = async (chat_id: string, midia: File, caption?: string) => {
    try {
      console.log('Enviando mídia via presigned PUT:', {
        name: midia.name,
        size: midia.size,
        type: midia.type,
        caption
      });

      if (!chat_id || !chat.id) throw new Error('chat_id inválido')

      let endpoint = '/api/upload/document/presign'
      let message_type: 'image' | 'document' | 'video' | 'audio' = 'document'
      if (midia.type.startsWith('image/')) {
        endpoint = '/api/upload/image/presign'
        message_type = 'image'
      } else if (midia.type.startsWith('video/')) {
        endpoint = '/api/upload/document/presign' // tratar vídeo como documento por enquanto
        message_type = 'video'
      } else if (midia.type.startsWith('audio/')) {
        endpoint = '/api/upload/audio/presign'
        message_type = 'audio'
      }

      // 1) Presign
      const presignRes = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chat_id,
          company_id: (chat as any)?.company_id,
          contentType: midia.type,
          ext: midia.name.split('.').pop() || 'bin'
        })
      })
      if (!presignRes.ok) throw new Error('Falha ao gerar URL assinada para mídia')
      const { uploadUrl, objectUrl } = await presignRes.json()

      if (!uploadUrl || !objectUrl) throw new Error('Resposta inválida do presign')

      // 2) PUT do arquivo
      await fetch(uploadUrl, { method: 'PUT', body: midia })

      // 3) Enviar mensagem com URL pública e caption (se houver)
      await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chat_id,
          message_type,
          content: { url: objectUrl, mimetype: midia.type, fileName: midia.name, caption },
          from_me: true,
        })
      })

      // Notificar rolagem
      notifyMessageSent();

    } catch (error) {
      console.error('Erro ao enviar mídia:', error);
    }
  }

  const handleRemoveAudio = () => {
    setRecordedAudio(null)
    audioChunksRef.current = []
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop() // Parar a gravação ativa, caso haja uma
    }
    set_audio_recording(false) // Atualizar o estado de gravação
    set_audio_blob(null)
  }

  const handleSendAudio = async () => {
    try {
      if (!audioChunksRef.current || audioChunksRef.current.length === 0 || !audio_blob) {
        console.error("Nenhum áudio disponível para enviar");
        return;
      }

      if (!chat.id) {
        console.error("ID do chat não disponível");
        return;
      }

      setIsSending(true);

      // Criar um arquivo de áudio a partir do blob
      const audioFile = new File([audio_blob], `audio-${uuidv4()}.mp3`, {
        type: "audio/mp3",
      });

      console.log('Enviando arquivo de áudio via API interna:', {
        name: audioFile.name,
        size: audioFile.size,
        type: audioFile.type
      });

      try {
        // 1) Solicitar URL pré-assinada para upload no MinIO
        const presignRes = await fetch('/api/upload/audio/presign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chat.id,
            company_id: (chat as any)?.company_id,
            contentType: audioFile.type,
            ext: 'mp3'
          })
        })
        if (!presignRes.ok) throw new Error('Falha ao gerar URL assinada para upload de áudio')
        const { uploadUrl, objectUrl } = await presignRes.json()

        if (!uploadUrl || !objectUrl) throw new Error('Resposta inválida do presign')

        // 2) Enviar o blob do áudio direto para o MinIO via PUT (presigned URL)
        await fetch(uploadUrl, {
          method: 'PUT',
          body: audio_blob
        })

        // 3) Disparar envio de mensagem com a URL pública do MinIO
        await fetch('/api/messages/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chat_id: chat.id,
            message_type: 'audio',
            content: { url: objectUrl, mimetype: audioFile.type, seconds: recordingTime },
            from_me: true,
          })
        })

        // Notificar que a mensagem foi enviada para acionar a rolagem automática
        notifyMessageSent();

        console.log('Mensagem de áudio enviada com sucesso');

        // Limpar o estado do áudio após o envio bem-sucedido
        setRecordedAudio(null);
        audioChunksRef.current = [];
        set_audio_blob(null);
      } catch (error) {
        console.error('Erro ao enviar mensagem de áudio:', error);
      }
    } catch (error) {
      console.error('Erro durante o processamento do áudio:', error);
    } finally {
      setIsSending(false);
    }
  };

  return {
    chat,
    get_chat_controll,
    message,
    handleSendMessageText,
    handleSelect,
    show_action_text,
    handleFormatText,
    audio_recording,
    handleRecordingAudio,
    handleStopRecording,
    recordedAudio,
    handleRemoveAudio,
    files,
    set_files,
    handleSendAudio,
    recordingTime,
    formatTime,
    send_midia_message,
    audioStream,
    audio_blob,
    handleChangeText,
    handleKeyDown,
    rows,
    isSending,
  }
}

export default useChatSendMessageModel
