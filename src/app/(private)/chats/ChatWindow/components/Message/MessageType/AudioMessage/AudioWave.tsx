import React, { useRef, useState, useEffect, useContext } from "react"
import { AudioVisualizer } from "../../../../../../utils/audio/AudioVisualizer"
import { ChatsContext } from "@/contexts/Chats"
import ContactImage from "@/app/(private)/chats/components/ContactImage"
import { motion, AnimatePresence } from "framer-motion"
import PlayIcon from "@/app/(private)/utils/icons/PlayIcon"
import PauseIcon from "@/app/(private)/utils/icons/PauseIcon"
import { MessageSchemaTyped } from "@/contexts/Messages/schemas"

export default function AudioWave({
  message,
  blob,
  metadata,
}: {
  message: MessageSchemaTyped
  blob: Blob
  metadata?: React.ReactNode
}) {
  const { chat } = useContext(ChatsContext)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(1)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 1.5 | 2>(1)
  const [visualizerKey, setVisualizerKey] = useState(0)

  useEffect(() => {
    if (!audioRef.current) return

    const audio = audioRef.current

    const updateTime = () => {
      setCurrentTime(audio.currentTime)
    }

    const updateDuration = () => {
      setDuration(audio.duration)
    }

    const handleEnd = () => {
      setIsPlaying(false)
      setCurrentTime(0)
      audioRef.current?.pause()

      setVisualizerKey((prevKey) => prevKey + 1)
    }

    audio.addEventListener("timeupdate", updateTime)
    audio.addEventListener("loadedmetadata", updateDuration)

    audio.addEventListener("ended", handleEnd)

    return () => {
      audio.removeEventListener("timeupdate", updateTime)
      audio.removeEventListener("loadedmetadata", updateDuration)
      audio.removeEventListener("ended", handleEnd)
    }
  }, [])

  const togglePlay = () => {
    if (!audioRef.current) return

    if (isPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }

    setIsPlaying((prev) => !prev)
  }

  const changeSpeed = () => {
    if (!audioRef.current) return

    const speeds: (1 | 1.5 | 2)[] = [1, 1.5, 2]
    const nextSpeed: 1 | 1.5 | 2 =
      speeds[(speeds.indexOf(playbackSpeed) + 1) % speeds.length]

    audioRef.current.playbackRate = nextSpeed
    setPlaybackSpeed(nextSpeed)
  }

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }

  const handleClick = (event: React.MouseEvent) => {
    if (!audioRef.current) return

    const rect = event.currentTarget.getBoundingClientRect()
    const offsetX = event.clientX - rect.left
    const newTime = (offsetX / rect.width) * duration
    audioRef.current.currentTime = newTime

    setCurrentTime(newTime)
  }

  return (
    <div
      className="w-full max-w-md rounded-lg p-1"
      style={{ backgroundColor: "rgb(24, 92, 75)" }}
    >
      <div className="flex items-center">
        <div className="relative min-w-[80px] h-[32px] flex items-center justify-center">
          <AnimatePresence mode="wait">
            {isPlaying ? (
              <motion.button
                key="speedButton"
                onClick={changeSpeed}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.1 }}
                className="absolute text-white w-10 h-5 flex items-center justify-center rounded-full text-sm"
                style={{ backgroundColor: "#0f4138" }}
              >
                {playbackSpeed}x
              </motion.button>
            ) : (
              <motion.div
                key="contactImage"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.1 }}
                className="absolute"
              >
                <ContactImage
                  avatar_url={chat.contact.avatar_url as string}
                  name={chat.contact.name}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="w-full gap-2">
          <div className="flex gap-2">
            <button onClick={togglePlay} className="mr-2 text-white">
              {isPlaying ? <PauseIcon /> : <PlayIcon />}
            </button>
            <AudioVisualizer
              key={visualizerKey}
              blob={blob}
              width={200}
              height={50}
              barWidth={3}
              gap={3}
              barColor={"#fff"}
              currentTime={currentTime}
              audioRef={audioRef}
              onClick={handleClick}
              style={{ width: "200px", height: "40px" }}
            />
          </div>
          <div className="flex justify-between items-center">
            <span className="text-white text-sm ml-2">
              {formatTime(
                currentTime || message.message.audioMessage?.seconds || 0
              )}
            </span>
            {metadata}
          </div>
        </div>

        <audio ref={audioRef}>
          <source src={URL.createObjectURL(blob)} type="audio/mp3" />
          Seu navegador não suporta o elemento de áudio.
        </audio>
      </div>
    </div>
  )
}
