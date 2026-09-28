/**
 * The CalibrationField.
 *
 * The page's one ambient system, coded and never sourced. A fine measurement
 * grid, a red sweep line travelling the viewport every 14 seconds with a live
 * CAL readout riding it, and a tick ruler along the top edge.
 *
 * The field's opacity follows the density of whichever section is in view, read
 * from a shared context that each section writes through an observer. It lerps
 * toward the target at 0.04 per frame and never snaps.
 *
 * Under `prefers-reduced-motion` the grid renders static, the sweep parks at
 * 62 percent, the readout freezes at CAL 0.620 and the opacity is fixed at 0.25.
 */

'use client'

import { useEffect, useRef } from 'react'
import { useReducedMotion } from '@/lib/motion'
import { useSectionDensity } from '@/hooks/useSectionDensity'

/** Milliseconds for one full sweep across the viewport. */
const SWEEP_PERIOD_MS = 14_000

/** How far the readout sits ahead of the sweep, in pixels. */
const READOUT_OFFSET_PX = 16

/** Opacity per density band. */
const OPACITY = { hero: 0.55, sparse: 0.35, dense: 0.15 } as const

/** The opacity held under reduced motion. */
const REDUCED_OPACITY = 0.25

/** The position the sweep parks at under reduced motion. */
const REDUCED_POSITION = 0.62

/** How quickly the opacity chases its target, per frame. */
const OPACITY_LERP = 0.04

/** The characters the readout draws from while scrubbing. */
const READOUT_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#'

/**
 * Reads the design tokens off the document, falling back to the spec values.
 * @param name The CSS custom property name.
 * @param fallback The value to use when the property is not set.
 * @returns The trimmed property value.
 */
function token(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value.length > 0 ? value : fallback
}

/**
 * Converts a hex colour token to its rgb components.
 * @param hex The hex string, with or without a leading hash.
 * @returns The `r, g, b` string, or null when the value is not hex.
 */
function hexToRgb(hex: string): string | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!match) return null
  const value = Number.parseInt(match[1], 16)
  return `${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}`
}

/**
 * The CalibrationField canvas.
 *
 * @returns The fixed canvas element.
 */
export default function CalibrationField() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const densityRef = useRef<{ density: 'hero' | 'sparse' | 'dense'; opacity: number }>({
    density: 'hero',
    opacity: OPACITY.hero,
  })
  const reduced = useReducedMotion()
  const density = useSectionDensity()

  useEffect(() => {
    densityRef.current.density = density
  }, [density])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const context = canvas.getContext('2d')
    if (!context) return undefined

    let frame = 0
    let width = 0
    let height = 0
    let ratio = 1
    const started = performance.now()

    const ink = token('--text-primary', '#141814')
    const accent = token('--accent', '#d3301f')
    // The canvas cannot resolve a CSS variable inside a gradient stop, so the
    // accent is read once from the document and its alpha applied here.
    const accentRgb = hexToRgb(accent)
    const trailInner = accentRgb ? `rgba(${accentRgb}, 0.08)` : accent

    /**
     * Resizes the backing store and the CSS box to the viewport.
     * @returns Nothing.
     */
    const resize = () => {
      ratio = Math.min(2, window.devicePixelRatio || 1)
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = Math.floor(width * ratio)
      canvas.height = Math.floor(height * ratio)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
    }

    /**
     * Draws the grid, the ruler, the sweep and the readout for one frame.
     * @param now The animation frame timestamp.
     * @returns Nothing.
     */
    const draw = (now: number) => {
      const spacing = width < 768 ? 36 : 48
      const elapsed = now - started
      const progress = reduced ? REDUCED_POSITION : ((elapsed % SWEEP_PERIOD_MS) / SWEEP_PERIOD_MS)
      const sweepX = progress * width

      const target = reduced ? REDUCED_OPACITY : OPACITY[densityRef.current.density]
      const state = densityRef.current
      state.opacity += (target - state.opacity) * OPACITY_LERP
      if (Math.abs(target - state.opacity) < 0.001) state.opacity = target

      context.clearRect(0, 0, width, height)
      context.globalAlpha = state.opacity

      context.strokeStyle = ink
      context.lineWidth = 1
      for (let x = 0.5; x < width; x += spacing) {
        const major = Math.round(x / spacing) % 4 === 0
        context.globalAlpha = state.opacity * (major ? 0.62 : 0.32)
        context.beginPath()
        context.moveTo(Math.floor(x), 0)
        context.lineTo(Math.floor(x), height)
        context.stroke()
      }
      for (let y = 0.5; y < height; y += spacing) {
        const major = Math.round(y / spacing) % 4 === 0
        context.globalAlpha = state.opacity * (major ? 0.62 : 0.32)
        context.beginPath()
        context.moveTo(0, Math.floor(y))
        context.lineTo(width, Math.floor(y))
        context.stroke()
      }

      // The top ruler. Minor every grid step, major every fifth.
      context.globalAlpha = state.opacity * 0.8
      for (let x = 0; x < width; x += spacing) {
        const major = Math.round(x / spacing) % 5 === 0
        context.beginPath()
        context.moveTo(Math.floor(x) + 0.5, 0)
        context.lineTo(Math.floor(x) + 0.5, major ? 6 : 2)
        context.stroke()
      }

      if (sweepX > 0 && sweepX < width) {
        const trail = context.createLinearGradient(sweepX - 120, 0, sweepX, 0)
        trail.addColorStop(0, 'rgba(0, 0, 0, 0)')
        trail.addColorStop(1, trailInner)
        context.globalAlpha = 1
        context.fillStyle = trail
        context.fillRect(sweepX - 120, 0, 120, height)

        context.strokeStyle = accent
        context.globalAlpha = 0.55 * (state.opacity / OPACITY.hero)
        context.beginPath()
        context.moveTo(Math.floor(sweepX) + 0.5, 0)
        context.lineTo(Math.floor(sweepX) + 0.5, height)
        context.stroke()

        context.globalAlpha = 0.8 * (state.opacity / OPACITY.hero)
        context.beginPath()
        context.moveTo(sweepX - 5, 3)
        context.lineTo(sweepX + 5, 3)
        context.moveTo(sweepX, 0)
        context.lineTo(sweepX, 8)
        context.stroke()

        const ready = reduced ? false : progress > 0.975
        const label = ready ? 'READY' : `CAL ${progress.toFixed(3)}`
        context.globalAlpha = 0.3 * (state.opacity / OPACITY.hero)
        context.fillStyle = ink
        context.font = '400 11px "Fragment Mono", monospace'
        context.textBaseline = 'middle'
        const x = Math.min(sweepX + READOUT_OFFSET_PX, width - 76)
        context.fillText(label, x, height / 2)
      }

      if (!reduced) frame = requestAnimationFrame(draw)
    }

    resize()
    window.addEventListener('resize', resize)
    frame = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
    }
  }, [reduced])

  return <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none fixed inset-0 z-0" />
}

/**
 * The character set the readout scrubs through, exported for the hero tile.
 * @returns The readout alphabet.
 */
export function readoutAlphabet(): string {
  return READOUT_CHARS
}
