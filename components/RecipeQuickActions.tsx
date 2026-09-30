'use client'

import { CheckSquare, ListOrdered, Printer } from 'lucide-react'

export default function RecipeQuickActions() {
  return (
    <nav className="recipe-quick-actions" aria-label="Recipe shortcuts">
      <a href="#ingredients"><CheckSquare size={17} aria-hidden="true" /> Ingredients</a>
      <a href="#instructions"><ListOrdered size={17} aria-hidden="true" /> Start cooking</a>
      <button type="button" onClick={() => window.print()}><Printer size={17} aria-hidden="true" /> Print</button>
    </nav>
  )
}
