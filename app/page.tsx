'use client'

import Link from 'next/link'
import { useEffect, useState, useRef } from 'react'

export default function Home() {
  const [scrollY, setScrollY] = useState(0)
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const featuresRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY)
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY })
    }

    window.addEventListener('scroll', handleScroll)
    window.addEventListener('mousemove', handleMouseMove)

    // Intersection Observer for scroll animations
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed')
          }
        })
      },
      { threshold: 0.1 }
    )

    const scrollRevealElements = document.querySelectorAll('.scroll-reveal')
    scrollRevealElements.forEach((el) => observer.observe(el))

    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('mousemove', handleMouseMove)
      scrollRevealElements.forEach((el) => observer.unobserve(el))
    }
  }, [])

  return (
    <div className="min-h-screen relative overflow-hidden bg-white">
      {/* Hero Section */}
      <section 
        className="relative min-h-[85vh] flex items-center justify-center overflow-hidden"
        style={{
          background: `
            linear-gradient(to bottom, 
              rgba(249, 250, 251, 0.2) 0%, 
              rgba(249, 250, 251, 0.5) 30%, 
              rgba(249, 250, 251, 0.8) 60%, 
              rgba(249, 250, 251, 0.95) 85%, 
              rgba(249, 250, 251, 1) 100%
            ),
            url(/veggies@0.5x.jpg)`,
          backgroundSize: 'cover',
          backgroundPosition: 'top center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        
        <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12 py-16 text-center relative z-10">
          <div className="animate-fade-in">
            {/* Simplified badge */}
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-pink-50 to-orange-50 px-5 py-2 rounded-full mb-6 border border-pink-100">
              <span className="text-lg">🍎</span>
              <span className="text-sm font-semibold text-gray-700">For iPhone & iPad</span>
            </div>

            <h1 className="text-5xl md:text-7xl font-bold text-gray-900 mb-5 animate-slide-up leading-tight tracking-tight">
              Your Personal
              <br />
              <span className="bg-gradient-to-r from-pink-500 via-orange-500 to-pink-500 bg-clip-text text-transparent">
                Recipe Manager
              </span>
            </h1>
            <p className="text-lg md:text-xl text-gray-600 mb-8 max-w-2xl mx-auto animate-slide-up font-normal" style={{ animationDelay: '0.1s' }}>
              Import recipes from anywhere and shop smarter. Built for iPhone & iPad with Apple Watch for grocery shopping.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-3 animate-slide-up" style={{ animationDelay: '0.2s' }}>
              <a
                href="#download"
                className="bg-gradient-to-r from-pink-500 to-orange-500 text-white px-8 py-4 rounded-2xl text-base font-semibold hover:shadow-xl transition-all transform hover:scale-[1.02]"
              >
                Download for iPhone & iPad
              </a>
              <Link
                href="#features"
                className="bg-white text-gray-900 px-8 py-4 rounded-2xl text-base font-semibold border border-gray-200 hover:border-gray-300 transition-all transform hover:scale-[1.02]"
              >
                Learn More
              </Link>
            </div>
            
            {/* Stats */}
            <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-8 rounded-3xl animate-scale-in shadow-sm border border-blue-100" style={{ animationDelay: '0.3s' }}>
                <div className="text-4xl font-bold text-gray-900 mb-1">
                  1-Tap
                </div>
                <div className="text-sm font-medium text-gray-600">Recipe Import</div>
              </div>
              
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-8 rounded-3xl animate-scale-in shadow-sm border border-green-100 relative" style={{ animationDelay: '0.4s' }}>
                <div className="absolute top-3 right-3">
                  <span className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full">PRO</span>
                </div>
                <div className="text-4xl font-bold text-gray-900 mb-1">
                  ⌚ 🛒
                </div>
                <div className="text-sm font-medium text-gray-600">Shop with Apple Watch</div>
              </div>
              
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-8 rounded-3xl animate-scale-in shadow-sm border border-purple-100 relative" style={{ animationDelay: '0.5s' }}>
                <div className="absolute top-3 right-3">
                  <span className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full">PRO</span>
                </div>
                <div className="text-4xl font-bold text-gray-900 mb-1">
                  📊
                </div>
                <div className="text-sm font-medium text-gray-600">Health & Nutrition Tracking</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-gray-50" ref={featuresRef}>
        
        <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12">
          <div className="text-center mb-16 scroll-reveal">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-3 leading-tight tracking-tight">
              Everything You Need
            </h2>
            <p className="text-lg text-gray-600 max-w-xl mx-auto">
              From recipe ideas to grocery shopping
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Feature 1 */}
            <div className="scroll-reveal bg-white p-8 rounded-3xl shadow-sm border border-gray-100 hover:shadow-md transition-all">
              <div className="w-14 h-14 bg-gradient-to-br from-pink-400 to-orange-400 rounded-2xl mb-5 flex items-center justify-center shadow-sm">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2 text-gray-900">Recipe Import & Management</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Import from any website or social media with one tap. Organize, rate, and search unlimited recipes.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="scroll-reveal bg-white p-8 rounded-3xl shadow-sm border border-gray-100 hover:shadow-md transition-all" style={{ animationDelay: '0.1s' }}>
              <div className="w-14 h-14 bg-gradient-to-br from-blue-400 to-indigo-400 rounded-2xl mb-5 flex items-center justify-center shadow-sm">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2 text-gray-900">Smart Grocery Lists</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Auto-generate shopping lists from your recipes. Upgrade to Pro to check off items on Apple Watch while shopping. Share via iCloud.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="scroll-reveal bg-white p-8 rounded-3xl shadow-sm border border-gray-100 hover:shadow-md transition-all" style={{ animationDelay: '0.2s' }}>
              <div className="w-14 h-14 bg-gradient-to-br from-teal-400 to-cyan-400 rounded-2xl mb-5 flex items-center justify-center shadow-sm">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2 text-gray-900">Recipe Organization</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Save and organize your favorite recipes. Add tags, search by ingredients, and access them from all your devices.
              </p>
            </div>

            {/* Feature 4 - Pro */}
            <div className="scroll-reveal relative bg-white p-8 rounded-3xl shadow-sm border border-gray-100 hover:shadow-md transition-all" style={{ animationDelay: '0.3s' }}>
              <div className="absolute top-4 right-4">
                <span className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full">PRO</span>
              </div>
              <div className="w-14 h-14 bg-gradient-to-br from-green-400 to-emerald-400 rounded-2xl mb-5 flex items-center justify-center shadow-sm">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2 text-gray-900">Health & Nutrition Tracking</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Complete nutrition facts for every recipe. Log meals to Apple Health. Track calories and macros.
              </p>
            </div>

            {/* Feature 5 - Pro */}
            <div className="scroll-reveal relative bg-gradient-to-br from-yellow-50 to-amber-50 p-8 rounded-3xl shadow-sm border border-yellow-100 hover:shadow-md transition-all" style={{ animationDelay: '0.4s' }}>
              <div className="absolute top-4 right-4">
                <span className="bg-gradient-to-r from-yellow-400 to-amber-400 text-white text-xs font-semibold px-3 py-1 rounded-full">PRO</span>
              </div>
              <div className="w-14 h-14 bg-gradient-to-br from-yellow-400 to-amber-400 rounded-2xl mb-5 flex items-center justify-center shadow-sm">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2 text-gray-900">AI-Powered Chef</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Generate recipes from ingredients in your fridge. Smart substitutions and dietary filters included.
              </p>
            </div>

            {/* Feature 6 - Pro */}
            <div className="scroll-reveal relative bg-white p-8 rounded-3xl shadow-sm border border-gray-100 hover:shadow-md transition-all" style={{ animationDelay: '0.5s' }}>
              <div className="absolute top-4 right-4">
                <span className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full">PRO</span>
              </div>
              <div className="w-14 h-14 bg-gradient-to-br from-purple-400 to-indigo-400 rounded-2xl mb-5 flex items-center justify-center shadow-sm">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2 text-gray-900">Shop with Apple Watch</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Check off grocery items directly on your wrist while shopping in stores. Real-time sync with iPhone & iPad.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-50 to-white" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-20 scroll-reveal">
            <div className="inline-block mb-4">
              <span className="bg-gradient-to-r from-primary-600 to-secondary-600 text-white px-6 py-2 rounded-full text-sm font-bold uppercase tracking-wide">
                How It Works
              </span>
            </div>
            <h2 className="text-5xl md:text-6xl font-extrabold text-gray-900 mb-6 leading-tight">
              Start Saving in
              <br />
              <span className="bg-gradient-to-r from-primary-600 via-secondary-600 to-primary-600 bg-clip-text text-transparent">
                3 Simple Steps
              </span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-12">
            {/* Step 1 */}
            <div className="scroll-reveal relative group" style={{ animationDelay: '0.1s' }}>
              <div className="flex flex-col items-center text-center">
                <div className="relative mb-8">
                  <div className="absolute inset-0 bg-gradient-to-r from-primary-400 to-secondary-400 rounded-full blur-2xl opacity-30 group-hover:opacity-50 transition-opacity animate-pulse-slow" />
                  <div className="relative w-32 h-32 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-full flex items-center justify-center transform group-hover:scale-110 group-hover:rotate-12 transition-all duration-500 shadow-2xl">
                    <span className="text-5xl font-extrabold text-white">1</span>
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">Import Your Recipes</h3>
                <p className="text-gray-600 leading-relaxed">
                  One-tap import from any website or social media. Organize your favorites in one beautiful app.
                </p>
              </div>
              
              {/* Connecting line */}
              <div className="hidden md:block absolute top-16 left-full w-full h-1 bg-gradient-to-r from-primary-300 to-secondary-300 opacity-30" style={{ width: 'calc(100% - 8rem)' }} />
            </div>

            {/* Step 2 */}
            <div className="scroll-reveal relative group" style={{ animationDelay: '0.2s' }}>
              <div className="flex flex-col items-center text-center">
                <div className="relative mb-8">
                  <div className="absolute inset-0 bg-gradient-to-r from-secondary-400 to-primary-400 rounded-full blur-2xl opacity-30 group-hover:opacity-50 transition-opacity animate-pulse-slow" />
                  <div className="relative w-32 h-32 bg-gradient-to-br from-secondary-500 to-primary-500 rounded-full flex items-center justify-center transform group-hover:scale-110 group-hover:rotate-12 transition-all duration-500 shadow-2xl">
                    <span className="text-5xl font-extrabold text-white">2</span>
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">Plan Your Week</h3>
                <p className="text-gray-600 leading-relaxed">
                  Add meals into your weekly calendar. Sync to Apple Calendar and generate smart grocery lists.
                </p>
              </div>
              
              {/* Connecting line */}
              <div className="hidden md:block absolute top-16 left-full w-full h-1 bg-gradient-to-r from-secondary-300 to-primary-300 opacity-30" style={{ width: 'calc(100% - 8rem)' }} />
            </div>

            {/* Step 3 */}
            <div className="scroll-reveal relative group" style={{ animationDelay: '0.3s' }}>
              <div className="flex flex-col items-center text-center">
                <div className="relative mb-8">
                  <div className="absolute inset-0 bg-gradient-to-r from-primary-400 to-secondary-400 rounded-full blur-2xl opacity-30 group-hover:opacity-50 transition-opacity animate-pulse-slow" />
                  <div className="relative w-32 h-32 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-full flex items-center justify-center transform group-hover:scale-110 group-hover:rotate-12 transition-all duration-500 shadow-2xl">
                    <span className="text-5xl font-extrabold text-white">3</span>
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">Shop with Apple Watch</h3>
                <p className="text-gray-600 leading-relaxed">
                  Check off items on your wrist as you shop. Everything syncs in real-time with your iPhone & iPad.
                </p>
              </div>
            </div>
          </div>

          {/* CTA under steps */}
          <div className="text-center mt-16 scroll-reveal" style={{ animationDelay: '0.4s' }}>
            <a
              href="#download"
              className="inline-flex items-center gap-3 bg-gradient-to-r from-primary-600 to-secondary-600 text-white px-12 py-5 rounded-2xl text-xl font-bold hover:from-primary-700 hover:to-secondary-700 transition-all shadow-xl hover:shadow-2xl transform hover:scale-105"
            >
              Download for iPhone & iPad
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </a>
          </div>
        </div>
      </section>


      {/* Social Proof / Testimonials Section */}
      <section className="py-24 bg-white">
        
        <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12">
          <div className="text-center mb-16 scroll-reveal">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-3 leading-tight tracking-tight">
              Loved by Home Cooks
            </h2>
            <p className="text-lg text-gray-600">Real stories from real people</p>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {/* Testimonial 1 */}
            <div className="scroll-reveal bg-gradient-to-br from-pink-50 to-orange-50 p-7 rounded-3xl shadow-sm border border-pink-100">
              <div className="flex items-center gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="w-4 h-4 text-orange-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <p className="text-gray-700 text-sm leading-relaxed mb-5">
                "I used to screenshot recipes from Instagram and lose track of them. Now I just tap 'import' and they're organized perfectly. The Apple Watch grocery list while I'm at Whole Foods is a game-changer!"
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-orange-400 flex items-center justify-center text-white font-semibold text-sm">
                  J
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">Jessica M.</p>
                  <p className="text-xs text-gray-600">Food Blogger, NYC</p>
                </div>
              </div>
            </div>

            {/* Testimonial 2 */}
            <div className="scroll-reveal bg-gradient-to-br from-green-50 to-teal-50 p-7 rounded-3xl shadow-sm border border-green-100" style={{ animationDelay: '0.1s' }}>
              <div className="flex items-center gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="w-4 h-4 text-teal-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <p className="text-gray-700 text-sm leading-relaxed mb-5">
                "Between work and three kids, I never had time to plan meals. The Apple Calendar sync means my husband knows what's for dinner, and I check off groceries on my Watch during lunch breaks. Seriously life-changing."
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-teal-400 flex items-center justify-center text-white font-semibold text-sm">
                  A
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">Amanda R.</p>
                  <p className="text-xs text-gray-600">Working Mom, Chicago</p>
                </div>
              </div>
            </div>

            {/* Testimonial 3 */}
            <div className="scroll-reveal bg-gradient-to-br from-purple-50 to-pink-50 p-7 rounded-3xl shadow-sm border border-purple-100" style={{ animationDelay: '0.2s' }}>
              <div className="flex items-center gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="w-4 h-4 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <p className="text-gray-700 text-sm leading-relaxed mb-5">
                "I went Pro for the AI Chef and it's worth every penny. I just tell it what's in my fridge and boom—actual recipes I can make tonight. No more random ingredients going bad. The nutrition tracking to Apple Health is a nice bonus too."
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-semibold text-sm">
                  M
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">Mike T.</p>
                  <p className="text-xs text-gray-600">Fitness Enthusiast, LA</p>
                </div>
              </div>
            </div>
          </div>

          {/* Trust badges */}
          <div className="mt-20 scroll-reveal" style={{ animationDelay: '0.3s' }}>
            <div className="flex flex-wrap justify-center items-center gap-12 opacity-60">
              <div className="flex items-center gap-2">
                <svg className="w-8 h-8 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="font-semibold text-gray-700">SSL Secured</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-8 h-8 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                  <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                </svg>
                <span className="font-semibold text-gray-700">Privacy Protected</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-8 h-8 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span className="font-semibold text-gray-700">4.9/5 Rating</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-8 h-8 text-primary-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="font-semibold text-gray-700">Verified Users</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Download Section */}
      <section id="download" className="py-24 bg-gray-50">
        <div className="max-w-4xl mx-auto px-6 sm:px-8 lg:px-12 text-center">
          <div className="scroll-reveal bg-gradient-to-br from-pink-500 to-orange-500 rounded-3xl p-12 md:p-16 shadow-lg">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4 leading-tight tracking-tight">
              Download Savry Today
            </h2>
            <p className="text-lg text-white/90 mb-8 max-w-xl mx-auto">
              Start with 25 free recipes. Upgrade to Pro for Apple Watch shopping, nutrition tracking, and more.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <a
                href="https://apps.apple.com/app/savry"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 bg-black text-white px-8 py-4 rounded-2xl text-base font-semibold hover:bg-gray-900 transition-all transform hover:scale-[1.02] shadow-lg"
              >
                <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                </svg>
                <div className="text-left">
                  <div className="text-xs">Download on the</div>
                  <div className="text-lg font-bold -mt-1">App Store</div>
                </div>
              </a>
            </div>
            
            <p className="text-white/80 text-sm mt-6">Free download • iPhone & iPad • Pro features available</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white py-20 overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary-500 via-secondary-500 to-primary-500" />
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-primary-600/10 rounded-full blur-3xl" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div className="md:col-span-1">
              <div className="flex items-center space-x-3 mb-6 group">
                <div className="relative w-12 h-12 transform group-hover:scale-110 group-hover:rotate-12 transition-all">
                  <svg width="48" height="48" viewBox="0 0 580 551" className="brightness-0 invert">
                    <image href="/savry-logo.svg" width="580" height="551" />
                  </svg>
                </div>
                <h3 className="text-2xl font-extrabold">Savry</h3>
              </div>
              <p className="text-gray-400 leading-relaxed mb-6">
                AI-powered recipe management for smarter, healthier, and more affordable cooking.
              </p>
              <div className="flex space-x-4">
                <a href="#" className="w-10 h-10 rounded-full bg-gray-800 hover:bg-primary-600 flex items-center justify-center transition-all transform hover:scale-110">
                  <span className="text-xl">𝕏</span>
                </a>
                <a href="#" className="w-10 h-10 rounded-full bg-gray-800 hover:bg-primary-600 flex items-center justify-center transition-all transform hover:scale-110">
                  <span className="text-xl">in</span>
                </a>
                <a href="#" className="w-10 h-10 rounded-full bg-gray-800 hover:bg-primary-600 flex items-center justify-center transition-all transform hover:scale-110">
                  <span className="text-xl">f</span>
                </a>
              </div>
            </div>
            
            <div>
              <h4 className="font-bold mb-6 text-lg text-white">Product</h4>
              <ul className="space-y-3">
                <li>
                  <Link href="/#features" className="text-gray-400 hover:text-primary-400 transition-colors flex items-center group">
                    <span className="mr-2 transform group-hover:translate-x-1 transition-transform">→</span>
                    Features
                  </Link>
                </li>
                <li>
                  <a href="#download" className="text-gray-400 hover:text-primary-400 transition-colors flex items-center group">
                    <span className="mr-2 transform group-hover:translate-x-1 transition-transform">→</span>
                    Download
                  </a>
                </li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-bold mb-6 text-lg text-white">Company</h4>
              <ul className="space-y-3">
                <li>
                  <Link href="/about" className="text-gray-400 hover:text-primary-400 transition-colors flex items-center group">
                    <span className="mr-2 transform group-hover:translate-x-1 transition-transform">→</span>
                    About
                  </Link>
                </li>
                <li>
                  <Link href="/contact" className="text-gray-400 hover:text-primary-400 transition-colors flex items-center group">
                    <span className="mr-2 transform group-hover:translate-x-1 transition-transform">→</span>
                    Contact
                  </Link>
                </li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-bold mb-6 text-lg text-white">Download</h4>
              <a href="#" className="inline-flex items-center gap-3 bg-gradient-to-r from-primary-600 to-secondary-600 hover:from-primary-700 hover:to-secondary-700 text-white px-6 py-3 rounded-xl font-bold transition-all transform hover:scale-105 shadow-lg">
                <span className="text-2xl">📱</span>
                <div className="text-left">
                  <div className="text-xs opacity-80">Download on the</div>
                  <div className="text-sm">App Store</div>
                </div>
              </a>
            </div>
          </div>
          
          <div className="border-t border-gray-700 pt-8">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <p className="text-gray-400 text-sm">
                &copy; 2026 Savry. All rights reserved.
              </p>
              <div className="flex gap-6 text-sm text-gray-400">
                <Link href="/privacy" className="hover:text-primary-400 transition-colors">Privacy Policy</Link>
                <Link href="/terms" className="hover:text-primary-400 transition-colors">Terms of Service</Link>
              </div>
            </div>
          </div>
        </div>
      </footer>

    </div>
  )
}
