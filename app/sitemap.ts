import type { MetadataRoute } from 'next'
import { listPublicRecipes } from '@/lib/community-recipes'
import { SITE_URL } from '@/lib/site-url'

export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const recipes = await listPublicRecipes(100).catch(() => [])
  const staticPages: MetadataRoute.Sitemap = [
    ['', 'daily', 1],
    ['/cooks', 'daily', 0.6],
    ['/recipes', 'daily', 0.9],
    ['/savry-plus', 'monthly', 0.5],
    ['/privacy', 'yearly', 0.2],
    ['/terms', 'yearly', 0.2],
  ].map(([path, changeFrequency, priority]) => ({
    url: `${SITE_URL}${path}`,
    lastModified: new Date(),
    changeFrequency: changeFrequency as 'daily' | 'weekly' | 'monthly',
    priority: priority as number,
  }))

  return [
    ...staticPages,
    ...recipes.map((recipe) => ({
      url: recipe.url,
      lastModified: new Date(recipe.publishedAt),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
      images: recipe.imageUrl ? [recipe.imageUrl] : undefined,
    })),
  ]
}
