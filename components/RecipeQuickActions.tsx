'use client'

import { CheckSquare, Printer } from 'lucide-react'
import CookingMode from '@/components/CookingMode'

type Cooking = { title: string; ingredients: string[]; steps: string[]; ovenTemp?: number | null }

export default function RecipeQuickActions({ cooking }: { cooking?: Cooking }) {
  return (
    <nav className="recipe-quick-actions" aria-label="Recipe shortcuts">
      {cooking ? <CookingMode {...cooking} /> : null}
      <a href="#ingredients"><CheckSquare size={17} aria-hidden="true" /> Ingredients</a>
      <button type="button" onClick={() => window.print()}><Printer size={17} aria-hidden="true" /> Print</button>
    </nav>
  )
}
