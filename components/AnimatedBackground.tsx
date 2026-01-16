'use client'

import Image from 'next/image'

export default function AnimatedBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      {/* Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-teal-50 via-green-50 to-emerald-50" />
      
      {/* Animated Shapes */}
      <div className="absolute top-20 left-10 w-64 h-64 bg-primary-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-float" />
      <div className="absolute top-40 right-20 w-72 h-72 bg-secondary-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-float-slow" />
      <div className="absolute -bottom-8 left-1/2 w-80 h-80 bg-primary-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-float-slower" />
      
      {/* Animated Vegetable Images - Non-overlapping positions */}
      
      {/* Top Row */}
      <div className="absolute top-10 left-[5%] w-28 h-28 animate-float animate-fade-in-out" style={{ filter: 'brightness(0) saturate(100%) invert(57%) sepia(61%) saturate(437%) hue-rotate(124deg) brightness(95%) contrast(93%)' }}>
        <Image src="/vegetables/carrot.svg" alt="" fill className="object-contain" />
      </div>
      
      <div className="absolute top-16 left-[25%] w-32 h-32 animate-float-slow animate-fade-in-out-slow" style={{ filter: 'brightness(0) saturate(100%) invert(57%) sepia(61%) saturate(437%) hue-rotate(124deg) brightness(95%) contrast(93%)' }}>
        <Image src="/vegetables/avacado.svg" alt="" fill className="object-contain" />
      </div>
      
      <div className="absolute top-20 right-[28%] w-30 h-30 animate-float animate-fade-in-out-slower" style={{ filter: 'brightness(0) saturate(100%) invert(57%) sepia(61%) saturate(437%) hue-rotate(124deg) brightness(95%) contrast(93%)' }}>
        <Image src="/vegetables/tomato.svg" alt="" fill className="object-contain" />
      </div>
      
      <div className="absolute top-12 right-[8%] w-34 h-34 animate-float-slower animate-fade-in-out" style={{ filter: 'brightness(0) saturate(100%) invert(57%) sepia(61%) saturate(437%) hue-rotate(124deg) brightness(95%) contrast(93%)' }}>
        <Image src="/vegetables/pepper.svg" alt="" fill className="object-contain" />
      </div>
      
      {/* Middle Row */}
      <div className="absolute top-[35%] left-[8%] w-36 h-36 animate-float-slow animate-fade-in-out-slower" style={{ filter: 'brightness(0) saturate(100%) invert(57%) sepia(61%) saturate(437%) hue-rotate(124deg) brightness(95%) contrast(93%)' }}>
        <Image src="/vegetables/broccoli.svg" alt="" fill className="object-contain" />
      </div>
      
      <div className="absolute top-[40%] left-[40%] w-32 h-32 animate-float animate-fade-in-out" style={{ filter: 'brightness(0) saturate(100%) invert(57%) sepia(61%) saturate(437%) hue-rotate(124deg) brightness(95%) contrast(93%)' }}>
        <Image src="/vegetables/mushroom.svg" alt="" fill className="object-contain" />
      </div>
      
      <div className="absolute top-[38%] right-[15%] w-34 h-34 animate-float-slow animate-fade-in-out-slow" style={{ filter: 'brightness(0) saturate(100%) invert(57%) sepia(61%) saturate(437%) hue-rotate(124deg) brightness(95%) contrast(93%)' }}>
        <Image src="/vegetables/lettuce.svg" alt="" fill className="object-contain" />
      </div>
      
      {/* Bottom Row */}
      <div className="absolute bottom-[30%] left-[18%] w-32 h-32 animate-float-slower animate-fade-in-out-slow" style={{ filter: 'brightness(0) saturate(100%) invert(57%) sepia(61%) saturate(437%) hue-rotate(124deg) brightness(95%) contrast(93%)' }}>
        <Image src="/vegetables/onion.svg" alt="" fill className="object-contain" />
      </div>
      
      <div className="absolute bottom-[25%] right-[25%] w-30 h-30 animate-float animate-fade-in-out-slower" style={{ filter: 'brightness(0) saturate(100%) invert(57%) sepia(61%) saturate(437%) hue-rotate(124deg) brightness(95%) contrast(93%)' }}>
        <Image src="/vegetables/mushroom.svg" alt="" fill className="object-contain" />
      </div>
      
      <div className="absolute bottom-20 left-[35%] w-28 h-28 animate-float-slow animate-fade-in-out" style={{ filter: 'brightness(0) saturate(100%) invert(57%) sepia(61%) saturate(437%) hue-rotate(124deg) brightness(95%) contrast(93%)' }}>
        <Image src="/vegetables/carrot.svg" alt="" fill className="object-contain" />
      </div>
      
      <div className="absolute bottom-24 right-[10%] w-32 h-32 animate-float-slower animate-fade-in-out-slower" style={{ filter: 'brightness(0) saturate(100%) invert(57%) sepia(61%) saturate(437%) hue-rotate(124deg) brightness(95%) contrast(93%)' }}>
        <Image src="/vegetables/avacado.svg" alt="" fill className="object-contain" />
      </div>
    </div>
  )
}







