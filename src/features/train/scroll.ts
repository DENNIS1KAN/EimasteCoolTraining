/** Scrolling and focus helpers for the Train screens (respect prefers-reduced-motion, like the app shell does). */

export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** 'smooth', or 'auto' for reduced-motion users (an explicit 'smooth' would override the CSS reduced-motion rule). */
export const scrollBehavior = (): ScrollBehavior => (prefersReducedMotion() ? 'auto' : 'smooth')

export function scrollToId(id: string, block: ScrollLogicalPosition = 'start'): void {
  document.getElementById(id)?.scrollIntoView?.({ behavior: scrollBehavior(), block })
}
