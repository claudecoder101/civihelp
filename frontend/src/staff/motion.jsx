import { useRef } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(useGSAP)

/* rAF stalls in hidden/background tabs; force any animation to its end state after `ms` so content never stays invisible. */
export function settle(anim, ms) {
  const t = setTimeout(() => anim.progress(1), ms)
  return () => clearTimeout(t)
}

export const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/* Staggered entrance for every `[data-enter]` child of the returned ref. Re-runs when deps change. */
export function useEnter(deps = []) {
  const scope = useRef(null)
  useGSAP(() => {
    if (reduced()) return
    return settle(gsap.from('[data-enter]', { y: 14, opacity: 0, duration: 0.45, ease: 'power3.out', stagger: 0.05, clearProps: 'transform,opacity' }), 1500)
  }, { scope, dependencies: deps, revertOnUpdate: true })
  return scope
}

/* Number that counts up from 0. `format` turns the tweened number into text. */
export function CountUp({ value, format = v => Math.round(v), className = '' }) {
  const el = useRef(null)
  useGSAP(() => {
    if (value == null || !Number.isFinite(Number(value))) return
    const node = el.current
    if (reduced()) { node.textContent = format(Number(value)); return }
    const o = { v: 0 }
    return settle(gsap.to(o, { v: Number(value), duration: 1.1, ease: 'power2.out', onUpdate: () => { node.textContent = format(o.v) } }), 1800)
  }, { dependencies: [value] })
  // Final value in the DOM from the first render, so screen readers and no-JS-tween cases read the truth.
  return <span ref={el} className={className}>{value == null ? '—' : format(Number(value))}</span>
}

export { gsap, useGSAP }
