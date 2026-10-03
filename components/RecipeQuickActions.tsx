'use client'

import { CheckSquare, Printer } from 'lucide-react'
import CookingMode from '@/components/CookingMode'
import SaveRecipeButton from '@/components/SaveRecipeButton'
import CollectButton from '@/components/CollectButton'

type Cooking = { title: string; ingredients: { name: string; amount: string | null; unit: string | null; isOptional: boolean }[]; steps: string[]; ovenTemp?: number | null }

export default function RecipeQuickActions({ cooking, slug }: { cooking?: Cooking; slug?: string }) {
  return (
    <nav className="recipe-quick-actions" aria-label="Recipe shortcuts">
      {cooking ? <CookingMode {...cooking} /> : null}
      {slug ? <SaveRecipeButton slug={slug} /> : null}
      {slug ? <CollectButton slug={slug} /> : null}
      <a href="#ingredients"><CheckSquare size={17} aria-hidden="true" /> Ingredients</a>
      <button type="button" onClick={() => window.print()}><Printer size={17} aria-hidden="true" /> <span className="recipe-quick-actions__label">Print</span></button>
    </nav>
  )
}
