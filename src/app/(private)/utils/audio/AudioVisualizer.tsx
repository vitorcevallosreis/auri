import {
  useRef,
  useState,
  forwardRef,
  type ForwardedRef,
  type ForwardRefExoticComponent,
  type RefAttributes,
  useImperativeHandle,
  useEffect,
} from "react"
import { type dataPoint } from "./types"
import { calculateBarData, draw } from "./utils"

interface Props {
  blob: Blob
  width: number
  height: number
  barWidth?: number
  gap?: number
  backgroundColor?: string
  barColor?: string
  barPlayedColor?: string
  currentTime?: number
  style?: React.CSSProperties
  ref?: React.ForwardedRef<HTMLCanvasElement>
  audioRef?: React.RefObject<HTMLAudioElement | null>
  onClick?: (event: React.MouseEvent<HTMLCanvasElement>) => void
}

const AudioVisualizer: ForwardRefExoticComponent<
  Props & RefAttributes<HTMLCanvasElement>
> = forwardRef(
  (
    {
      blob,
      width,
      height,
      barWidth = 2,
      gap = 1,
      currentTime,
      style,
      backgroundColor = "transparent",
      barColor = "rgb(184, 184, 184)",
      barPlayedColor = "rgb(255, 255, 255)",
      audioRef,
    }: Props,
    ref?: ForwardedRef<HTMLCanvasElement>
  ) => {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [data, setData] = useState<dataPoint[]>([])
    const [duration, setDuration] = useState<number>(0)

    useImperativeHandle<HTMLCanvasElement | null, HTMLCanvasElement | null>(
      ref,
      () => canvasRef.current,
      []
    )

    useEffect(() => {
      const processBlob = async (): Promise<void> => {
        if (!canvasRef.current) return

        if (!blob) {
          const barsData = Array.from({ length: 100 }, () => ({
            max: 0,
            min: 0,
          }))
          draw(
            barsData,
            canvasRef.current,
            barWidth,
            gap,
            backgroundColor,
            barColor,
            barPlayedColor
          )
          return
        }

        const audioBuffer = await blob.arrayBuffer()
        const audioContext = new AudioContext()
        await audioContext.decodeAudioData(audioBuffer, (buffer) => {
          if (!canvasRef.current) return
          setDuration(buffer.duration)
          const barsData = calculateBarData(
            buffer,
            height,
            width,
            barWidth,
            gap
          )
          setData(barsData)
          draw(
            barsData,
            canvasRef.current,
            barWidth,
            gap,
            backgroundColor,
            barColor,
            barPlayedColor
          )
        })
      }

      processBlob()
    }, [blob, canvasRef.current])

    useEffect(() => {
      if (!canvasRef.current || !currentTime || !duration || !audioRef) return

      let animationFrameId: number

      const animate = () => {
        const time = audioRef.current?.currentTime || 0 // Pegando o tempo do audioRef

        draw(
          data,
          canvasRef.current!,
          barWidth,
          gap,
          backgroundColor,
          barColor,
          barPlayedColor,
          time,
          duration
        )

        animationFrameId = requestAnimationFrame(animate)
      }

      animate()

      return () => cancelAnimationFrame(animationFrameId)
    }, [currentTime, duration, data, audioRef])

    // Manipulador de clique para controlar o tempo do áudio
    const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (!audioRef) return
      if (!audioRef.current || !canvasRef.current) return

      // Calcula a posição do clique dentro do canvas
      const canvasRect = canvasRef.current.getBoundingClientRect()
      const clickPosition = event.clientX - canvasRect.left
      const clickTime = (clickPosition / canvasRect.width) * duration

      // Define o tempo do áudio para o tempo calculado
      audioRef.current.currentTime = clickTime
      audioRef.current.play() // Inicia a reprodução do áudio a partir do ponto clicado
    }

    return (
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        // style={{ ...style }}
        onClick={handleCanvasClick} // Adiciona o manipulador de clique
      />
    )
  }
)

AudioVisualizer.displayName = "AudioVisualizer"

export { AudioVisualizer }
