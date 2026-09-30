import type { Metadata } from 'next'
import { SITE_URL } from '@/lib/site-url'
import RecipeComposer from '@/components/RecipeComposer'

export const metadata: Metadata = {
  title: 'Add a recipe',
  description: 'Write, review, and publish a recipe to the Savry community.',
  alternates: { canonical: `${SITE_URL}/recipes/new` },
}

export default function NewRecipePage() {
  return <RecipeComposer />
}
