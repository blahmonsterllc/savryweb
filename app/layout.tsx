import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Navbar from '@/components/Navbar'
import AnimatedBackground from '@/components/AnimatedBackground'
import ScrollProgress from '@/components/ScrollProgress'
import { Providers } from './providers'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Savry - AI-Powered Recipe Manager for iPhone & iPad',
  description: 'Create amazing recipes and grocery lists with AI. Available for iPhone & iPad with Apple Watch support. Save money with local supermarket discounts and smart shopping.',
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
          <ScrollProgress />
          <AnimatedBackground />
          <Navbar />
          <main className="relative">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  )
}
