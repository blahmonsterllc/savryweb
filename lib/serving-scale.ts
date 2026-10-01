'use client'

import { useSyncExternalStore } from 'react'

// The chosen scale for the recipe on screen, shared by the ingredient list and
// Cooking Mode. It lives only in memory and resets when the recipe page leaves.
let factor = 1
const listeners = new Set<() => void>()

export function setServingFactor(next: number) {
  if (!Number.isFinite(next) || next <= 0 || next === factor) return
  factor = next
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function useServingFactor(): number {
  return useSyncExternalStore(subscribe, () => factor, () => 1)
}
