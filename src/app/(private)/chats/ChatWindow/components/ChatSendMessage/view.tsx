import React, { useEffect, useRef, useState } from "react"
import useChatSendMessageModel from "./model"
import { AnimatePresence, motion } from "framer-motion"
import {
  Textarea,
  Alert,
  Button,
  Tooltip,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Input,
  Progress,
} from "@nextui-org/react"
import {
  Bold,
  Italic,
  Underline,
  Plus,
  SendHorizontal,
  Mic,
  StopCircle,
  Trash2,
  Send,
} from "lucide-react"
import { toast } from "sonner"
import WaveVisualizer from "./WaveVisualizer"
import AudioWave from "./AudioWave"

export default function ChatSendMessageView({
  chat,
  get_chat_controll,
  message,
  handleSendMessageText,
  handleKeyDown,
  handleChangeText,
  rows,
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
}: ReturnType<typeof useChatSendMessageModel>) {
  if (chat.bot_running) {
    return (
      <div className="sticky">
        <Alert
          radius="none"
          color="warning"
          description="Clique no botão para assumir o controle."
          endContent={
            <Button
              color="warning"
              size="sm"
              variant="flat"
              onPress={get_chat_controll}
            >
              Assumir Controle da Conversa
            </Button>
          }
          title="Conversa controlada Por Assistente!"
          variant="faded"
        />
      </div>
    )
  }

  const handle_midia_message = () => {
    const { isOpen, onOpen, onOpenChange } = useDisclosure()
    const [uploadProgress, setUploadProgress] = useState<{
      [key: string]: number
    }>({})
    const [is_uploading, set_is_uploading] = useState(false)
    const [captions, setCaptions] = useState<Record<string, string>>({})

    const fileInputRef = useRef<HTMLInputElement | null>(null)

    const handle_file_change = (event: React.ChangeEvent<HTMLInputElement>) => {
      if (event.target.files) {
        set_files(Array.from(event.target.files))
      }
    }

    const handle_remove_file = (index: number) => {
      set_files((prevFiles) => prevFiles.filter((_, i) => i !== index))
      setUploadProgress((prevProgress) => {
        const newProgress = { ...prevProgress }
        delete newProgress[files[index].name]
        return newProgress
      })
      setCaptions((prev) => {
        const next = { ...prev }
        delete next[files[index].name]
        return next
      })
    }

    const handleUploadAllFiles = async () => {
      set_is_uploading(true)
      for (const file of files) {
        const caption = captions[file.name] || undefined
        await send_midia_message(chat.id, file, caption)
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = ""
        setUploadProgress({})
        set_files([])
      }

      set_is_uploading(false)
      onOpenChange()
      toast.success("Arquivos enviados com sucesso!")
    }

    return (
      <div>
        <motion.div
          className="size-14 flex items-center justify-center cursor-pointer"
          whileHover={{ rotate: 45, scale: 1.1 }}
          transition={{ duration: 0.2 }}
          onClick={onOpen}
        >
          <Plus color="#9c9c9c" />
        </motion.div>

        <Modal
          isOpen={isOpen}
          onOpenChange={() => {
            if (is_uploading) return
            onOpenChange()
          }}
          size="2xl"
          placement="center"
        >
          <ModalContent>
            {(onClose) => (
              <>
                <ModalHeader className="flex flex-col gap-1">
                  Enviar Arquivos
                </ModalHeader>
                <ModalBody>
                  <div>
                    <Input
                      type="file"
                      multiple
                      onChange={handle_file_change}
                      ref={fileInputRef}
                    />

                    <div className="mt-4">
                      {files.length > 0 && (
                        <div className="border rounded-lg p-4 bg-muted shadow-md">
                          <h3 className="text-lg font-semibold text-foreground mb-2">
                            Arquivos Selecionados
                          </h3>
                          <ul className="space-y-2">
                            <AnimatePresence>
                              {files.map((file, index) => (
                                <motion.li
                                  key={file.name}
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, x: -20 }}
                                  transition={{ duration: 0.3 }}
                                  className="flex flex-col gap-2 p-2 border rounded-lg bg-card shadow-sm"
                                >
                                  <div className="flex justify-between items-center">
                                    <div>
                                      <span className="text-foreground text-sm font-medium">
                                        {file.name}
                                      </span>
                                      <span className="text-muted-foreground text-xs ml-2">
                                        ({(file.size / 1024).toFixed(2)} KB)
                                      </span>
                                    </div>
                                    {!is_uploading && (
                                      <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() =>
                                          handle_remove_file(index)
                                        }
                                        className="p-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors duration-200"
                                      >
                                        <Trash2 />
                                      </motion.button>
                                    )}
                                  </div>

                                  {/* Campo de legenda opcional */}
                                  <div className="grid grid-cols-1 gap-2">
                                    <Input
                                      label="Legenda (opcional)"
                                      placeholder="Escreva uma legenda para este arquivo"
                                      value={captions[file.name] || ''}
                                      onChange={(e) =>
                                        setCaptions((prev) => ({
                                          ...prev,
                                          [file.name]: e.target.value,
                                        }))
                                      }
                                      isDisabled={is_uploading}
                                    />
                                  </div>

                                  {uploadProgress[file.name] !== undefined && (
                                    <Progress
                                      isIndeterminate
                                      value={uploadProgress[file.name]}
                                      color={
                                        uploadProgress[file.name] === 100
                                          ? "success"
                                          : "primary"
                                      }
                                    />
                                  )}
                                </motion.li>
                              ))}
                            </AnimatePresence>
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </ModalBody>
                <ModalFooter>
                  <Button
                    color="danger"
                    variant="light"
                    onPress={onClose}
                    disabled={is_uploading}
                  >
                    {is_uploading ? "Aguarde..." : "Cancelar"}
                  </Button>

                  {files.length > 0 && (
                    <Button
                      color="primary"
                      onPress={handleUploadAllFiles}
                      disabled={is_uploading}
                    >
                      {is_uploading ? "Enviando..." : "Enviar"}
                    </Button>
                  )}
                </ModalFooter>
              </>
            )}
          </ModalContent>
        </Modal>
      </div>
    )
  }

  const handle_text_message = () => {
    return (
      <div className="relative w-full">
        {show_action_text && (
          <div className="absolute bottom-12 left-2 z-10 flex gap-2 mt-2 mb-2">
            {["bold", "italic", "underline"].map((style) => (
              <Tooltip
                key={style}
                content={style.charAt(0).toUpperCase() + style.slice(1)}
              >
                <Button 
                  isIconOnly 
                  onPress={() => handleFormatText(style)}
                  className="transition-all duration-200 hover:bg-muted active:scale-95"
                >
                  {style === "bold" && <Bold width={15} height={15} />}
                  {style === "italic" && <Italic width={15} height={15} />}
                  {style === "underline" && (
                    <Underline width={15} height={15} />
                  )}
                </Button>
              </Tooltip>
            ))}
          </div>
        )}

        <Textarea
          className="w-full"
          // @ts-expect-error keyDown
          onChange={handleChangeText}
          radius="none"
          value={message}
          label="Mensagem"
          placeholder="Enviar mensagem..."
          variant="flat"
          rows={rows}
          maxRows={6}
          disableAutosize
          // @ts-expect-error keyDown
          onKeyDown={handleKeyDown}
          // @ts-expect-error select
          onSelect={handleSelect}
        />
      </div>
    )
  }

  return (
    <div className="sticky pb-4">
      <div className="flex justify-center items-center gap-2">
        {!recordedAudio && !audio_recording && handle_midia_message()}
        {!recordedAudio && !audio_recording && handle_text_message()}

        {recordedAudio && audio_blob && <AudioWave blob={audio_blob} />}

        <motion.div className="size-14 flex items-center justify-center cursor-pointer">
          <AnimatePresence mode="wait">
            {message && !audio_recording ? (
              <motion.div
                key="send"
                initial={{ opacity: 0, scale: 0.8, rotate: -90 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                exit={{ opacity: 0, scale: 0.8, rotate: 90 }}
                transition={{ duration: 0.3 }}
                whileHover={{ scale: 1.1 }}
                onClick={handleSendMessageText}
              >
                <SendHorizontal color="#9c9c9c" />
              </motion.div>
            ) : (
              !recordedAudio &&
              !audio_recording && (
                <motion.div
                  key="mic"
                  initial={{ opacity: 0, scale: 0.8, rotate: 90 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  exit={{ opacity: 0, scale: 0.8, rotate: -90 }}
                  transition={{ duration: 0.3 }}
                  whileHover={{ scale: 1.1 }}
                >
                  <button
                    onClick={handleRecordingAudio}
                    className="p-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors duration-200"
                  >
                    <Mic />
                  </button>
                </motion.div>
              )
            )}

            {!recordedAudio && audio_recording && (
              <div className="flex items-center gap-2">
                <motion.div
                  key="stop"
                  initial={{ opacity: 0, scale: 0.8, rotate: 90 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  exit={{ opacity: 0, scale: 0.8, rotate: -90 }}
                  transition={{ duration: 0.3 }}
                  whileHover={{ scale: 1.1 }}
                >
                  <button
                    onClick={handleStopRecording}
                    className="p-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors duration-200"
                  >
                    <StopCircle />
                  </button>
                </motion.div>
                <div className="flex gap-4">
                  <div className="text-red-500 font-semibold">
                    {formatTime(recordingTime)}
                  </div>
                  <div className="text-red-500 font-semibold">Gravando...</div>
                </div>
                {/* {audio_recording && (
                  <WaveVisualizer
                    stream={audioStream}
                    isRecording={audio_recording}
                  />
                )} */}
              </div>
            )}
          </AnimatePresence>
        </motion.div>

        {recordedAudio && (
          <div className="flex items-center gap-2">
            <motion.div
              initial={{ opacity: 0, scale: 0.8, rotate: 90 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, scale: 0.8, rotate: -90 }}
              transition={{ duration: 0.3 }}
              whileHover={{ scale: 1.1 }}
            >
              <button
                onClick={handleRemoveAudio}
                className="p-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors duration-200"
              >
                <Trash2 />
              </button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.8, rotate: 90 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, scale: 0.8, rotate: -90 }}
              transition={{ duration: 0.3 }}
              whileHover={{ scale: 1.1 }}
            >
              <button
                onClick={() => handleSendAudio()}
                className="p-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors duration-200"
              >
                <Send />
              </button>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  )
}
