'use client'

import { useEffect, useState } from 'react'

export default function ScrollProgress() {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const updateProgress = () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight
      const scrolled = window.scrollY
      const progress = (scrolled / scrollHeight) * 100
      setProgress(progress)
    }

    window.addEventListener('scroll', updateProgress)
    updateProgress() // Initial call

    return () => window.removeEventListener('scroll', updateProgress)
  }, [])

  return (
    <div className="fixed top-0 left-0 w-full h-1 bg-gray-200 z-[60]">
      <div
        className="h-full bg-gradient-to-r from-primary-500 via-secondary-500 to-primary-500 transition-all duration-150 ease-out shadow-lg"
        style={{ width: `${progress}%` }}
      >
        <div className="absolute right-0 top-0 w-20 h-full bg-gradient-to-r from-transparent to-white/30 shimmer" />
      </div>
    </div>
  )
}





