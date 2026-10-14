import { useRef } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(useGSAP)

export const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/* Children marked [data-stagger] inside the returned ref rise in once, in order. */
export function useStagger(deps = []) {
  const scope = useRef(null)
  useGSAP(() => {
    if (reducedMotion()) return
    gsap.from('[data-stagger]', { y: 14, opacity: 0, duration: 0.5, ease: 'power3.out', stagger: 0.07, clearProps: 'all' })
  }, { scope, dependencies: deps })
  return scope
}

/* Animated number. Renders the final value in the DOM first so it is correct without JS motion. */
export function CountUp({ value, format = v => Math.round(v).toLocaleString('en-IN'), duration = 1.1, className }) {
  const el = useRef(null)
  useGSAP(() => {
    if (value == null || !el.current) return
    if (reducedMotion()) { el.current.textContent = format(value); return }
    const o = { v: 0 }
    gsap.to(o, { v: value, duration, ease: 'power2.out', onUpdate: () => { if (el.current) el.current.textContent = format(o.v) } })
  }, { dependencies: [value] })
  return <span ref={el} className={className}>{value == null ? '—' : format(value)}</span>
}
