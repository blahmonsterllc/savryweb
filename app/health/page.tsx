import HealthClient from './HealthClient'

export const dynamic = 'force-dynamic'

export default function HealthPage() {
  return (
    <div className="min-h-screen bg-white">
      <HealthClient />
    </div>
  )
}



