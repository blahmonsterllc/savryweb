'use client'

// Custom SVG food illustrations with personality
export const ChefHat = ({ className = "w-20 h-20" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 200 200" fill="none">
    {/* Chef hat with character */}
    <path d="M100 40 C70 40, 50 60, 50 90 L50 120 C50 130, 60 140, 70 140 L130 140 C140 140, 150 130, 150 120 L150 90 C150 60, 130 40, 100 40 Z" fill="#FFF" stroke="#333" strokeWidth="3"/>
    <ellipse cx="70" cy="70" rx="15" ry="20" fill="#FFF" stroke="#333" strokeWidth="3"/>
    <ellipse cx="100" cy="60" rx="20" ry="25" fill="#FFF" stroke="#333" strokeWidth="3"/>
    <ellipse cx="130" cy="70" rx="15" ry="20" fill="#FFF" stroke="#333" strokeWidth="3"/>
    <rect x="45" y="135" width="110" height="25" rx="3" fill="#FFF" stroke="#333" strokeWidth="3"/>
    {/* Face on hat */}
    <circle cx="85" cy="110" r="3" fill="#333"/>
    <circle cx="115" cy="110" r="3" fill="#333"/>
    <path d="M 90 120 Q 100 125, 110 120" stroke="#333" strokeWidth="2" fill="none" strokeLinecap="round"/>
  </svg>
)

export const CookingPot = ({ className = "w-20 h-20", animate = false }: { className?: string, animate?: boolean }) => (
  <svg className={className} viewBox="0 0 200 200" fill="none">
    {/* Pot */}
    <ellipse cx="100" cy="150" rx="60" ry="15" fill="#E94560" opacity="0.3"/>
    <rect x="50" y="90" width="100" height="70" rx="5" fill="#E94560" stroke="#333" strokeWidth="3"/>
    <ellipse cx="100" cy="90" rx="50" ry="10" fill="#FF6B6B" stroke="#333" strokeWidth="3"/>
    {/* Handles */}
    <path d="M 45 100 Q 30 100, 30 110 Q 30 120, 45 120" stroke="#333" strokeWidth="3" fill="none"/>
    <path d="M 155 100 Q 170 100, 170 110 Q 170 120, 155 120" stroke="#333" strokeWidth="3" fill="none"/>
    {/* Steam */}
    <g className={animate ? "animate-float" : ""}>
      <path d="M 70 70 Q 65 50, 70 30" stroke="#A0A0A0" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.6"/>
      <path d="M 100 75 Q 95 55, 100 35" stroke="#A0A0A0" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.6"/>
      <path d="M 130 70 Q 135 50, 130 30" stroke="#A0A0A0" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.6"/>
    </g>
  </svg>
)

export const ForkKnife = ({ className = "w-16 h-16" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 200 200" fill="none">
    {/* Fork */}
    <line x1="60" y1="40" x2="60" y2="120" stroke="#333" strokeWidth="4" strokeLinecap="round"/>
    <line x1="50" y1="40" x2="50" y2="80" stroke="#333" strokeWidth="4" strokeLinecap="round"/>
    <line x1="70" y1="40" x2="70" y2="80" stroke="#333" strokeWidth="4" strokeLinecap="round"/>
    <line x1="60" y1="120" x2="55" y2="160" stroke="#333" strokeWidth="5" strokeLinecap="round"/>
    {/* Knife */}
    <rect x="130" y="40" width="10" height="120" rx="2" fill="#333"/>
    <path d="M 125 40 L 145 40 L 145 20 L 125 40 Z" fill="#C0C0C0" stroke="#333" strokeWidth="2"/>
  </svg>
)

export const Avocado = ({ className = "w-24 h-24" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 200 200" fill="none">
    {/* Avocado with face */}
    <ellipse cx="100" cy="110" rx="45" ry="60" fill="#8BC34A" stroke="#333" strokeWidth="3"/>
    <ellipse cx="100" cy="110" rx="25" ry="35" fill="#FDD835"/>
    <circle cx="100" cy="110" r="12" fill="#8B4513" stroke="#333" strokeWidth="2"/>
    {/* Cute face */}
    <circle cx="85" cy="95" r="4" fill="#333"/>
    <circle cx="115" cy="95" r="4" fill="#333"/>
    <path d="M 85 110 Q 100 120, 115 110" stroke="#333" strokeWidth="2" fill="none" strokeLinecap="round"/>
    {/* Blush */}
    <circle cx="70" cy="105" r="6" fill="#FF69B4" opacity="0.4"/>
    <circle cx="130" cy="105" r="6" fill="#FF69B4" opacity="0.4"/>
  </svg>
)

export const Pizza = ({ className = "w-24 h-24" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 200 200" fill="none">
    {/* Pizza slice */}
    <path d="M 100 40 L 160 180 L 40 180 Z" fill="#FFD700" stroke="#333" strokeWidth="3"/>
    <path d="M 100 40 L 160 180 L 40 180 Z" fill="#FFA500" opacity="0.7" stroke="#333" strokeWidth="3"/>
    {/* Cheese strings */}
    <path d="M 100 90 Q 80 100, 70 120" stroke="#FFEB3B" strokeWidth="3" fill="none" strokeLinecap="round"/>
    <path d="M 120 110 Q 140 120, 145 140" stroke="#FFEB3B" strokeWidth="3" fill="none" strokeLinecap="round"/>
    {/* Pepperoni */}
    <circle cx="90" cy="120" r="10" fill="#E94560" stroke="#333" strokeWidth="2"/>
    <circle cx="120" cy="140" r="10" fill="#E94560" stroke="#333" strokeWidth="2"/>
    <circle cx="100" cy="160" r="10" fill="#E94560" stroke="#333" strokeWidth="2"/>
    {/* Highlights */}
    <circle cx="92" cy="118" r="3" fill="#FF6B6B" opacity="0.6"/>
    <circle cx="122" cy="138" r="3" fill="#FF6B6B" opacity="0.6"/>
  </svg>
)

export const Taco = ({ className = "w-24 h-24" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 200 200" fill="none">
    {/* Taco shell */}
    <path d="M 40 140 Q 100 60, 160 140" fill="#F4A460" stroke="#333" strokeWidth="3"/>
    <path d="M 40 140 Q 100 80, 160 140" fill="none" stroke="#333" strokeWidth="2"/>
    {/* Filling */}
    <path d="M 50 130 Q 100 90, 150 130" fill="#8BC34A" stroke="#333" strokeWidth="2"/>
    <path d="M 60 125 Q 100 100, 140 125" fill="#E94560" stroke="#333" strokeWidth="2"/>
    <path d="M 70 120 Q 100 105, 130 120" fill="#FFD700" stroke="#333" strokeWidth="2"/>
    {/* Details */}
    <circle cx="80" cy="115" r="3" fill="#FFF" opacity="0.8"/>
    <circle cx="120" cy="115" r="3" fill="#FFF" opacity="0.8"/>
  </svg>
)

export const Donut = ({ className = "w-20 h-20" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 200 200" fill="none">
    {/* Shadow */}
    <ellipse cx="100" cy="180" rx="50" ry="10" fill="#000" opacity="0.1"/>
    {/* Donut */}
    <circle cx="100" cy="100" r="60" fill="#FFB6C1" stroke="#333" strokeWidth="3"/>
    <circle cx="100" cy="100" r="25" fill="#FFF" stroke="#333" strokeWidth="3"/>
    {/* Frosting drips */}
    <path d="M 70 80 Q 75 90, 70 95" fill="#FFB6C1" stroke="#333" strokeWidth="2"/>
    <path d="M 130 80 Q 125 90, 130 95" fill="#FFB6C1" stroke="#333" strokeWidth="2"/>
    <path d="M 100 70 Q 95 80, 100 85" fill="#FFB6C1" stroke="#333" strokeWidth="2"/>
    {/* Sprinkles */}
    <line x1="80" y1="90" x2="85" y2="95" stroke="#FF6B6B" strokeWidth="3" strokeLinecap="round"/>
    <line x1="120" y1="90" x2="115" y2="95" stroke="#4CAF50" strokeWidth="3" strokeLinecap="round"/>
    <line x1="100" y1="85" x2="100" y2="90" stroke="#FFD700" strokeWidth="3" strokeLinecap="round"/>
    <line x1="90" y1="110" x2="85" y2="115" stroke="#9C27B0" strokeWidth="3" strokeLinecap="round"/>
    <line x1="110" y1="110" x2="115" y2="115" stroke="#2196F3" strokeWidth="3" strokeLinecap="round"/>
  </svg>
)

export const Carrot = ({ className = "w-20 h-20" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 200 200" fill="none">
    {/* Carrot body */}
    <path d="M 100 160 L 85 100 Q 85 70, 90 60 L 100 160 Z" fill="#FF9800" stroke="#333" strokeWidth="3"/>
    <path d="M 100 160 L 115 100 Q 115 70, 110 60 L 100 160 Z" fill="#FF9800" stroke="#333" strokeWidth="3"/>
    {/* Leaves */}
    <path d="M 85 60 Q 70 50, 65 35" stroke="#4CAF50" strokeWidth="4" fill="none" strokeLinecap="round"/>
    <path d="M 100 55 Q 100 40, 100 25" stroke="#4CAF50" strokeWidth="4" fill="none" strokeLinecap="round"/>
    <path d="M 115 60 Q 130 50, 135 35" stroke="#4CAF50" strokeWidth="4" fill="none" strokeLinecap="round"/>
    {/* Details */}
    <line x1="90" y1="120" x2="85" y2="120" stroke="#F57C00" strokeWidth="2"/>
    <line x1="95" y1="140" x2="90" y2="140" stroke="#F57C00" strokeWidth="2"/>
    <line x1="110" y1="120" x2="115" y2="120" stroke="#F57C00" strokeWidth="2"/>
  </svg>
)

export const SpiceJar = ({ className = "w-20 h-20" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 200 200" fill="none">
    {/* Jar */}
    <rect x="60" y="80" width="80" height="100" rx="5" fill="#E8F5E9" stroke="#333" strokeWidth="3"/>
    {/* Lid */}
    <rect x="55" y="65" width="90" height="20" rx="3" fill="#FFC107" stroke="#333" strokeWidth="3"/>
    <circle cx="100" cy="75" r="4" fill="#333"/>
    {/* Spices inside */}
    <circle cx="80" cy="120" r="3" fill="#E91E63"/>
    <circle cx="95" cy="130" r="3" fill="#4CAF50"/>
    <circle cx="110" cy="115" r="3" fill="#FF9800"/>
    <circle cx="85" cy="145" r="3" fill="#9C27B0"/>
    <circle cx="115" cy="135" r="3" fill="#E91E63"/>
    <circle cx="100" cy="150" r="3" fill="#4CAF50"/>
    {/* Label */}
    <rect x="70" y="100" width="60" height="25" rx="2" fill="#FFF" stroke="#333" strokeWidth="2"/>
  </svg>
)





