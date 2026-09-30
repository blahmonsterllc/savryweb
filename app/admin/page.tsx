import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Admin', robots: { index: false, follow: false } }

/**
 * Admin home. Access is enforced by middleware (admin Google accounts only).
 * The community runs on Supabase; day-to-day work is the moderation queue.
 */
export default function AdminPage() {
  const cards = [
    {
      href: '/admin/moderation',
      title: 'Moderation queue',
      body: 'Comments, tweaks, and recipes hidden after reports. Restore, remove, or ban.',
    },
    {
      href: '/admin/security',
      title: 'Security checks',
      body: 'Environment variables and headers the site depends on.',
    },
    {
      href: 'https://supabase.com/dashboard/project/qnpekzrchqftdoaebzuf',
      title: 'Supabase dashboard',
      body: 'Database, auth users, storage, and logs for the community.',
    },
    {
      href: 'https://vercel.com',
      title: 'Vercel',
      body: 'Deployments, analytics, and environment variables.',
    },
  ]
  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900">Savry admin</h1>
      <p className="mt-1 text-sm text-gray-500">Signed in as an admin. Everything here changes what the public sees.</p>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2">
        {cards.map((card) => (
          <li key={card.href} className="rounded-2xl bg-white p-5 shadow transition hover:shadow-lg">
            <Link href={card.href} className="block">
              <h2 className="text-lg font-semibold text-gray-900">{card.title}</h2>
              <p className="mt-1 text-sm text-gray-600">{card.body}</p>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  )
}
