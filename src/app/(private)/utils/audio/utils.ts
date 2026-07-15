import { type dataPoint } from "./types"

interface CustomCanvasRenderingContext2D extends CanvasRenderingContext2D {
  roundRect: (
    x: number,
    y: number,
    w: number,
    h: number,
    radius: number
  ) => void
}

export const calculateBarData = (
  buffer: AudioBuffer,
  height: number,
  width: number,
  barWidth: number,
  gap: number
): dataPoint[] => {
  const bufferData = buffer.getChannelData(0)
  const units = width / (barWidth + gap)
  const step = Math.floor(bufferData.length / units)
  const amp = height / 2

  let data: dataPoint[] = []
  let maxDataPoint = 0

  for (let i = 0; i < units; i++) {
    const mins: number[] = []
    let minCount = 0
    const maxs: number[] = []
    let maxCount = 0

    for (let j = 0; j < step && i * step + j < buffer.length; j++) {
      const datum = bufferData[i * step + j]
      if (datum <= 0) {
        mins.push(datum)
        minCount++
      }
      if (datum > 0) {
        maxs.push(datum)
        maxCount++
      }
    }
    const minAvg = mins.reduce((a, c) => a + c, 0) / minCount
    const maxAvg = maxs.reduce((a, c) => a + c, 0) / maxCount

    const dataPoint = { max: maxAvg, min: minAvg }

    if (dataPoint.max > maxDataPoint) maxDataPoint = dataPoint.max
    if (Math.abs(dataPoint.min) > maxDataPoint)
      maxDataPoint = Math.abs(dataPoint.min)

    data.push(dataPoint)
  }

  if (amp * 0.8 > maxDataPoint * amp) {
    const adjustmentFactor = (amp * 0.8) / maxDataPoint
    data = data.map((dp) => ({
      max: dp.max * adjustmentFactor,
      min: dp.min * adjustmentFactor,
    }))
  }

  return data
}

export const draw = (
  data: dataPoint[],
  canvas: HTMLCanvasElement,
  barWidth: number,
  gap: number,
  backgroundColor: string,
  barColor: string,
  barPlayedColor?: string,
  currentTime: number = 0,
  duration: number = 1
): void => {
  const amp = canvas.height / 2
  const ctx = canvas.getContext("2d") as CustomCanvasRenderingContext2D
  if (!ctx) return

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  // Preenchendo o fundo, se necessário
  if (backgroundColor !== "transparent") {
    ctx.fillStyle = backgroundColor
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  const playedPercent = (currentTime || 0) / duration

  // Desenhando as barras
  data.forEach((dp, i) => {
    const mappingPercent = i / data.length
    const played = playedPercent > mappingPercent

    // Se a barra foi tocada, ela é branca, caso contrário, ela é quase transparente
    if (played) {
      ctx.fillStyle = barPlayedColor || "white"
      ctx.globalAlpha = 1 // Totalmente opaca para as barras tocadas
    } else {
      ctx.fillStyle = barColor
      ctx.globalAlpha = 0.3 // Opacidade baixa para as barras não tocadas (quase transparente)
    }

    const x = i * (barWidth + gap)
    const y = amp + dp.min
    const w = barWidth
    const h = amp + dp.max - y

    ctx.beginPath()
    if (ctx.roundRect) {
      // Garantir que roundRect é suportado pelo navegador
      ctx.roundRect(x, y, w, h, 0) // 0 é o raio do canto arredondado
      ctx.fill()
    } else {
      // Fallback para navegadores que não suportam roundRect
      ctx.fillRect(x, y, w, h)
    }
  })

  // Desenhando a bolinha de progresso
  if (currentTime !== undefined && duration !== 0) {
    const progressX = (currentTime / duration) * canvas.width

    // Salva o valor atual de globalAlpha antes de desenhar a bolinha
    const currentAlpha = ctx.globalAlpha

    // Ajusta o alpha da bolinha para total opacidade
    ctx.globalAlpha = 1

    ctx.beginPath()
    const ballSize = 7 // Tamanho da bolinha
    ctx.arc(progressX, canvas.height / 2, ballSize, 0, Math.PI * 2) // Bolinha no meio do canvas

    ctx.fillStyle = "#53bdeb" // Cor da bolinha
    ctx.fill()

    // Restaura o valor de globalAlpha após desenhar a bolinha
    ctx.globalAlpha = currentAlpha
  }

  // Restaura a opacidade global para a próxima renderização
  ctx.globalAlpha = 1
}
