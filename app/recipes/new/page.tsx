import type { Metadata } from 'next'
import RecipeComposer from '@/components/RecipeComposer'

export const metadata: Metadata = {
  title: 'Add a recipe',
  description: 'Write, review, and publish a recipe to the Savry community.',
}

export default function NewRecipePage() {
  return <RecipeComposer />
}
