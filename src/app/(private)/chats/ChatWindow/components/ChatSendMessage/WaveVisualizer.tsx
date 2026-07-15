import { useEffect, useRef } from "react"

interface WaveVisualizerProps {
  stream: MediaStream | null
  isRecording: boolean
}

export default function WaveVisualizer({
  stream,
  isRecording,
}: WaveVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const dataArrayRef = useRef<Uint8Array | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const lastUpdateTimeRef = useRef<number>(0) // Controle de tempo para desacelerar

  useEffect(() => {
    if (!isRecording || !stream) return

    const audioCtx = new AudioContext()
    const analyser = audioCtx.createAnalyser()
    const source = audioCtx.createMediaStreamSource(stream)

    analyser.fftSize = 512
    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    source.connect(analyser)

    audioContextRef.current = audioCtx
    analyserRef.current = analyser
    dataArrayRef.current = dataArray

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.fillStyle = "#fff"
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    const barWidth = 8
    const spacing = 5

    const draw = (timestamp: number) => {
      if (!analyserRef.current || !dataArrayRef.current || !canvas) return

      // Lógica para desacelerar a animação
      const timeElapsed = timestamp - lastUpdateTimeRef.current
      const updateInterval = 100 // Intervalo maior = animação mais lenta

      if (timeElapsed < updateInterval) {
        animationFrameRef.current = requestAnimationFrame(draw)
        return
      }

      lastUpdateTimeRef.current = timestamp

      analyserRef.current.getByteFrequencyData(dataArrayRef.current)

      const imageData = ctx.getImageData(
        barWidth + spacing,
        0,
        canvas.width - (barWidth + spacing),
        canvas.height
      )
      ctx.putImageData(imageData, 0, 0)

      const barHeight = dataArrayRef.current[bufferLength / 2] / 2
      ctx.fillStyle = "#53bdeb"
      ctx.fillRect(
        canvas.width - barWidth - spacing,
        canvas.height - barHeight,
        barWidth,
        barHeight
      )

      animationFrameRef.current = requestAnimationFrame(draw)
    }

    draw(0)

    return () => {
      if (animationFrameRef.current)
        cancelAnimationFrame(animationFrameRef.current)
      if (audioContextRef.current) audioContextRef.current.close()
    }
  }, [isRecording, stream])

  return <canvas ref={canvasRef} className="" />
}
