'use client'

import { ChefHat, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type Props = { title: string; ingredients: string[]; steps: string[]; ovenTemp?: number | null }

/**
 * Full-screen cooking view, like the app's Cooking Mode: the ingredient list
 * on one side, one big step at a time on the other, arrow keys or taps to
 * move, and the screen kept awake while it is open. Nothing is stored.
 */
export default function CookingMode({ title, ingredients, steps, ovenTemp }: Props) {
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)
  const [checked, setChecked] = useState<Set<number>>(new Set())
  const [showIngredients, setShowIngredients] = useState(false)
  const wakeLock = useRef<{ release: () => Promise<void> } | null>(null)

  const total = steps.length
  const next = useCallback(() => setIndex((i) => Math.min(i + 1, total - 1)), [total])
  const prev = useCallback(() => setIndex((i) => Math.max(i - 1, 0)), [])

  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    async function keepAwake() {
      try {
        const nav = navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> } }
        wakeLock.current = (await nav.wakeLock?.request('screen')) ?? null
      } catch {
        wakeLock.current = null
      }
    }
    keepAwake()
    function onVisible() {
      if (document.visibilityState === 'visible') keepAwake()
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'ArrowRight' || event.key === ' ') { event.preventDefault(); next() }
      else if (event.key === 'ArrowLeft') { event.preventDefault(); prev() }
      else if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('keydown', onKey)
      wakeLock.current?.release().catch(() => undefined)
      wakeLock.current = null
    }
  }, [open, next, prev])

  function toggle(i: number) {
    setChecked((current) => {
      const copy = new Set(current)
      if (copy.has(i)) copy.delete(i)
      else copy.add(i)
      return copy
    })
  }

  if (total === 0) return null

  return (
    <>
      <button type="button" className="cooking-mode__launch" onClick={() => { setIndex(0); setOpen(true) }}>
        <ChefHat size={17} aria-hidden="true" /> Start cooking
      </button>

      {open && createPortal(
        <div className="cooking-mode" role="dialog" aria-modal="true" aria-label={`Cooking ${title}`}>
          <header className="cooking-mode__bar">
            <div>
              <span className="cooking-mode__eyebrow">Cooking mode</span>
              <strong>{title}</strong>
            </div>
            <div className="cooking-mode__bar-actions">
              <button type="button" className="cooking-mode__toggle" onClick={() => setShowIngredients((v) => !v)} aria-pressed={showIngredients}>
                Ingredients {checked.size ? `${checked.size}/${ingredients.length}` : ''}
              </button>
              <button type="button" className="cooking-mode__close" onClick={() => setOpen(false)} aria-label="Leave cooking mode"><X size={20} /></button>
            </div>
          </header>

          <div className={`cooking-mode__body ${showIngredients ? 'is-showing-ingredients' : ''}`}>
            <aside className="cooking-mode__ingredients" aria-label="Ingredients">
              <h2>Ingredients</h2>
              {ovenTemp ? <p className="cooking-mode__oven">Oven {ovenTemp}°F</p> : null}
              <ul>
                {ingredients.map((line, i) => (
                  <li key={i}>
                    <label className={checked.has(i) ? 'is-done' : ''}>
                      <input type="checkbox" checked={checked.has(i)} onChange={() => toggle(i)} />
                      <span>{line}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </aside>

            <section className="cooking-mode__step" aria-live="polite">
              <div className="cooking-mode__progress" aria-hidden="true">
                {steps.map((_, i) => <span key={i} className={i <= index ? 'is-done' : ''} />)}
              </div>
              <p className="cooking-mode__count">Step {index + 1} of {total}</p>
              <p className="cooking-mode__text">{steps[index]}</p>
              <div className="cooking-mode__nav">
                <button type="button" onClick={prev} disabled={index === 0}><ChevronLeft size={22} /> Back</button>
                {index < total - 1 ? (
                  <button type="button" className="is-primary" onClick={next}>Next step <ChevronRight size={22} /></button>
                ) : (
                  <button type="button" className="is-primary" onClick={() => setOpen(false)}>Done cooking</button>
                )}
              </div>
              <p className="cooking-mode__hint">Arrow keys or space move between steps. The screen stays awake while this is open.</p>
            </section>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
