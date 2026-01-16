'use client'

interface SavryLogoProps {
  className?: string
  white?: boolean
  width?: number
  height?: number
}

export default function SavryLogo({ className = '', white = false, width = 120, height = 114 }: SavryLogoProps) {
  return (
    <svg 
      width={width} 
      height={height} 
      viewBox="0 0 580 551" 
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <g fill={white ? '#FFFFFF' : '#000000'}>
        <image href="/savry-logo.svg" width="580" height="551" style={{ filter: white ? 'brightness(0) invert(1)' : 'none' }} />
      </g>
    </svg>
  )
}






