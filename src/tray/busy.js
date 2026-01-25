const { nativeImage } = require('electron')

const { queueEvents: extractionQueueEvents } = require('../extraction')
const { queueEvents: analysisQueueEvents } = require('../analysis')

const FRAME_COUNT = 12
const FRAME_INTERVAL_MS = 120

const setTrayImage = (tray, image) => {
  if (!tray || typeof tray.setImage !== 'function') {
    return
  }

  if (typeof tray.isDestroyed === 'function' && tray.isDestroyed()) {
    return
  }

  tray.setImage(image)
}

const buildRingMask = (width, height) => {
  const cx = (width - 1) / 2
  const cy = (height - 1) / 2
  const radius = Math.min(width, height) / 2 - 1
  const thickness = Math.max(1, Math.round(Math.min(width, height) * 0.12))
  const inner = Math.max(0, radius - thickness)
  const mask = []

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const distance = Math.hypot(x - cx, y - cy)
      if (distance >= inner && distance <= radius) {
        mask.push((y * width + x) * 4)
      }
    }
  }

  return mask
}

const resolveRingColor = (bitmap) => {
  let sum = 0
  let count = 0

  for (let i = 0; i < bitmap.length; i += 4) {
    const alpha = bitmap[i + 3]
    if (alpha < 10) {
      continue
    }

    sum += (bitmap[i] + bitmap[i + 1] + bitmap[i + 2]) / 3
    count += 1
  }

  const average = count > 0 ? sum / (count * 255) : 0
  return average < 0.55
    ? { r: 255, g: 255, b: 255 }
    : { r: 20, g: 20, b: 20 }
}

const blendRingPixel = (buffer, offset, ringColor, ringAlpha) => {
  const baseB = buffer[offset]
  const baseG = buffer[offset + 1]
  const baseR = buffer[offset + 2]
  const baseA = buffer[offset + 3] / 255

  const outA = ringAlpha + baseA * (1 - ringAlpha)
  const invAlpha = 1 - ringAlpha

  buffer[offset] = Math.round(baseB * invAlpha + ringColor.b * ringAlpha)
  buffer[offset + 1] = Math.round(baseG * invAlpha + ringColor.g * ringAlpha)
  buffer[offset + 2] = Math.round(baseR * invAlpha + ringColor.r * ringAlpha)
  buffer[offset + 3] = Math.round(outA * 255)
}

const createRingFrames = (baseIcon) => {
  if (!baseIcon || typeof baseIcon.toBitmap !== 'function') {
    console.warn('Tray busy indicator disabled: base icon missing bitmap support')
    return []
  }

  if (typeof baseIcon.isEmpty === 'function' && baseIcon.isEmpty()) {
    console.warn('Tray busy indicator disabled: base icon is empty')
    return []
  }

  const size = baseIcon.getSize ? baseIcon.getSize() : null
  const width = size?.width
  const height = size?.height

  if (!width || !height) {
    console.warn('Tray busy indicator disabled: base icon size unavailable')
    return []
  }

  const baseBitmap = baseIcon.toBitmap()
  if (!baseBitmap || baseBitmap.length === 0) {
    console.warn('Tray busy indicator disabled: base icon bitmap empty')
    return []
  }

  const ringMask = buildRingMask(width, height)
  const ringColor = resolveRingColor(baseBitmap)
  const frames = []

  for (let frame = 0; frame < FRAME_COUNT; frame += 1) {
    const phase = (Math.PI * 2 * frame) / FRAME_COUNT
    const ringAlpha = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(phase))
    const buffer = Buffer.from(baseBitmap)

    for (const offset of ringMask) {
      blendRingPixel(buffer, offset, ringColor, ringAlpha)
    }

    frames.push(nativeImage.createFromBuffer(buffer, { width, height }))
  }

  return frames
}

const registerTrayBusyIndicator = ({ tray, baseIcon }) => {
  const activeSources = new Set()
  let animationTimer = null
  let frameIndex = 0
  const frames = createRingFrames(baseIcon)

  const stopAnimation = () => {
    if (!animationTimer) {
      setTrayImage(tray, baseIcon)
      return
    }

    clearInterval(animationTimer)
    animationTimer = null
    frameIndex = 0
    setTrayImage(tray, baseIcon)
    console.log('Tray busy animation stopped')
  }

  const startAnimation = () => {
    if (animationTimer || frames.length === 0) {
      return
    }

    setTrayImage(tray, frames[frameIndex])
    animationTimer = setInterval(() => {
      frameIndex = (frameIndex + 1) % frames.length
      setTrayImage(tray, frames[frameIndex])
    }, FRAME_INTERVAL_MS)
    console.log('Tray busy animation started')
  }

  const handleScheduled = (source) => {
    const wasIdle = activeSources.size === 0
    activeSources.add(source)

    if (wasIdle && activeSources.size > 0) {
      console.log('Tray busy enter', { source })
      startAnimation()
    }
  }

  const handleIdle = (source) => {
    if (!activeSources.has(source)) {
      return
    }

    activeSources.delete(source)
    if (activeSources.size === 0) {
      console.log('Tray busy exit', { source })
      stopAnimation()
    }
  }

  const extractionHandlers = {
    scheduled: () => handleScheduled('extraction'),
    idle: () => handleIdle('extraction')
  }
  const analysisHandlers = {
    scheduled: () => handleScheduled('analysis'),
    idle: () => handleIdle('analysis')
  }

  if (extractionQueueEvents?.on) {
    extractionQueueEvents.on('scheduled', extractionHandlers.scheduled)
    extractionQueueEvents.on('idle', extractionHandlers.idle)
  } else {
    console.warn('Tray busy indicator disabled: extraction queue events unavailable')
  }

  if (analysisQueueEvents?.on) {
    analysisQueueEvents.on('scheduled', analysisHandlers.scheduled)
    analysisQueueEvents.on('idle', analysisHandlers.idle)
  } else {
    console.warn('Tray busy indicator disabled: analysis queue events unavailable')
  }

  return {
    dispose: () => {
      if (extractionQueueEvents?.off) {
        extractionQueueEvents.off('scheduled', extractionHandlers.scheduled)
        extractionQueueEvents.off('idle', extractionHandlers.idle)
      }
      if (analysisQueueEvents?.off) {
        analysisQueueEvents.off('scheduled', analysisHandlers.scheduled)
        analysisQueueEvents.off('idle', analysisHandlers.idle)
      }

      stopAnimation()
      activeSources.clear()
    }
  }
}

module.exports = {
  registerTrayBusyIndicator
}
