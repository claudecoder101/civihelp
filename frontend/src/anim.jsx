import { useRef } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(useGSAP)

export const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/* Children marked [data-stagger] inside the returned ref rise in once, in order. */
export function useStagger(deps = []) {
  const scope = useRef(null)
  useGSAP(() => {
    // Pages render a loader first; skip until the staggered children exist.
    if (reducedMotion() || !scope.current?.querySelector('[data-stagger]')) return
    const anim = gsap.from('[data-stagger]', { y: 14, opacity: 0, duration: 0.5, ease: 'power3.out', stagger: 0.07, clearProps: 'all' })
    // rAF stalls in background tabs; force the end state so sections never stay invisible.
    const t = setTimeout(() => anim.progress(1), 1500)
    return () => clearTimeout(t)
  }, { scope, dependencies: deps })
  return scope
}

/* CSS 3D tilt: pointer position → --rx/--ry on the element (see .tilt in index.css). */
export function useTilt(max = 8) {
  const ref = useRef(null)
  const onPointerMove = e => {
    const el = ref.current
    if (!el || reducedMotion() || e.pointerType === 'touch') return
    const r = el.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5
    el.style.setProperty('--ry', `${(x * max).toFixed(2)}deg`)
    el.style.setProperty('--rx', `${(-y * max).toFixed(2)}deg`)
  }
  const onPointerLeave = () => { ref.current?.style.setProperty('--rx', '0deg'); ref.current?.style.setProperty('--ry', '0deg') }
  return { ref, onPointerMove, onPointerLeave }
}

/* Animated number. Renders the final value in the DOM first so it is correct without JS motion. */
export function CountUp({ value, format = v => Math.round(v).toLocaleString('en-IN'), duration = 1.1, className }) {
  const el = useRef(null)
  useGSAP(() => {
    if (value == null || !el.current) return
    if (reducedMotion()) { el.current.textContent = format(value); return }
    const o = { v: 0 }
    const anim = gsap.to(o, { v: value, duration, ease: 'power2.out', onUpdate: () => { if (el.current) el.current.textContent = format(o.v) } })
    const t = setTimeout(() => anim.progress(1), duration * 1000 + 700)
    return () => clearTimeout(t)
  }, { dependencies: [value] })
  return <span ref={el} className={className}>{value == null ? '—' : format(value)}</span>
}
