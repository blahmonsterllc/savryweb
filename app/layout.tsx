import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Navbar from '@/components/Navbar'
import { Providers } from './providers'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: {
    default: 'Savry — recipes worth sharing',
    template: '%s | Savry',
  },
  description: 'Discover recipes, join the Savry cooking community, and share recipes from your own kitchen.',
  icons: { icon: '/savry-logo.svg' },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <Navbar />
          <main className="relative">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  )
}
