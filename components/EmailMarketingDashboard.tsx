'use client'

import { useEffect, useState } from 'react'

interface EmailStats {
  totalUsers: number
  optedInUsers: number
  unsubscribedUsers: number
  notAskedYet: number
  optInRate: number
  tierBreakdown: {
    freeOptedIn: number
    proOptedIn: number
  }
}

export default function EmailMarketingDashboard() {
  const [stats, setStats] = useState<EmailStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    fetchStats()
  }, [])

  async function fetchStats() {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/admin/email-marketing')
      if (!response.ok) {
        throw new Error('Failed to fetch email stats')
      }
      
      const data = await response.json()
      setStats(data.stats)
    } catch (err: any) {
      console.error('Failed to load email stats:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function exportEmailList() {
    setExporting(true)
    
    try {
      const response = await fetch('/api/admin/email-marketing?action=export')
      if (!response.ok) {
        throw new Error('Failed to export')
      }
      
      const data = await response.json()
      
      // Download as JSON
      const blob = new Blob([JSON.stringify(data.emails, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `savry-email-list-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      alert(`Exported ${data.count} email addresses`)
    } catch (err: any) {
      alert('Export failed: ' + err.message)
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className="bg-red-50 rounded-lg border border-red-200 p-6">
        <h3 className="text-lg font-semibold text-red-800 mb-2">Failed to load email stats</h3>
        <p className="text-red-600">{error || 'Unknown error'}</p>
        <button
          onClick={fetchStats}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Email Marketing</h2>
            <p className="text-gray-600 text-sm mt-1">
              Manage your marketing email list (Apple compliant)
            </p>
          </div>
          <button
            onClick={exportEmailList}
            disabled={exporting || stats.optedInUsers === 0}
            className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {exporting ? 'Exporting...' : '📥 Export Email List'}
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-lg p-5 text-white">
            <div className="text-teal-100 text-sm font-medium mb-1">Total Users</div>
            <div className="text-3xl font-bold">{stats.totalUsers}</div>
            <div className="text-teal-100 text-xs mt-2">
              Registered accounts
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-5 text-white">
            <div className="text-green-100 text-sm font-medium mb-1">Opted In</div>
            <div className="text-3xl font-bold">{stats.optedInUsers}</div>
            <div className="text-green-100 text-xs mt-2">
              {stats.optInRate}% opt-in rate
            </div>
          </div>

          <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-lg p-5 text-white">
            <div className="text-red-100 text-sm font-medium mb-1">Unsubscribed</div>
            <div className="text-3xl font-bold">{stats.unsubscribedUsers}</div>
            <div className="text-red-100 text-xs mt-2">
              {stats.totalUsers > 0 ? Math.round((stats.unsubscribedUsers / stats.totalUsers) * 100) : 0}% unsubscribed
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-5 text-white">
            <div className="text-blue-100 text-sm font-medium mb-1">Not Asked Yet</div>
            <div className="text-3xl font-bold">{stats.notAskedYet}</div>
            <div className="text-blue-100 text-xs mt-2">
              Potential subscribers
            </div>
          </div>
        </div>

        {/* Tier Breakdown */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-2">Free Tier Subscribers</h3>
            <div className="text-3xl font-bold text-gray-900">{stats.tierBreakdown.freeOptedIn}</div>
            <p className="text-sm text-gray-600 mt-2">
              Target for Pro upgrade campaigns
            </p>
          </div>

          <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg p-4 border border-amber-200">
            <h3 className="font-semibold text-amber-900 mb-2 flex items-center gap-2">
              <span className="text-amber-600">⭐</span> Pro Tier Subscribers
            </h3>
            <div className="text-3xl font-bold text-amber-900">{stats.tierBreakdown.proOptedIn}</div>
            <p className="text-sm text-amber-700 mt-2">
              Engaged customers for retention
            </p>
          </div>
        </div>
      </div>

      {/* Marketing Insights */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">📊 Marketing Insights</h3>
        <div className="space-y-2 text-sm text-gray-700">
          <p>
            • <strong>Opt-in Rate:</strong> {stats.optInRate}% 
            {stats.optInRate < 30 && ' (Industry average is 25-40%, consider improving consent flow)'}
            {stats.optInRate >= 30 && stats.optInRate < 50 && ' (Good! Above industry average)'}
            {stats.optInRate >= 50 && ' (Excellent! Well above industry average)'}
          </p>
          <p>
            • <strong>Potential Reach:</strong> {stats.optedInUsers} users can receive campaigns
          </p>
          <p>
            • <strong>Growth Opportunity:</strong> {stats.notAskedYet} users haven't been asked yet
          </p>
          <p>
            • <strong>List Health:</strong> {stats.unsubscribedUsers} unsubscribes 
            ({stats.totalUsers > 0 ? Math.round((stats.unsubscribedUsers / stats.totalUsers) * 100) : 0}% churn)
          </p>
        </div>
      </div>

      {/* Campaign Ideas */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">💡 Campaign Ideas</h3>
        <div className="space-y-3">
          <CampaignCard
            title="Welcome Series"
            description="3-email series for new users"
            audience={`${stats.notAskedYet} users not asked yet`}
            type="Onboarding"
          />
          <CampaignCard
            title="Weekly Recipe Inspiration"
            description="Every Monday at 9am"
            audience={`${stats.optedInUsers} opted-in users`}
            type="Engagement"
          />
          <CampaignCard
            title="Pro Upgrade Offer"
            description="For users who've used 2/2 free recipes"
            audience={`${stats.tierBreakdown.freeOptedIn} free users`}
            type="Conversion"
          />
          <CampaignCard
            title="Win-back Campaign"
            description="For inactive users (30+ days)"
            audience="Inactive segment"
            type="Retention"
          />
        </div>
      </div>

      {/* Tools & Integration */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">🔧 Marketing Tools</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ToolCard
            name="Resend"
            description="Developer-friendly email API"
            price="Free up to 3k/month"
            features={['React templates', 'Analytics', 'Fast delivery']}
          />
          <ToolCard
            name="Mailchimp"
            description="Full marketing suite"
            price="Free up to 500 contacts"
            features={['Drag-drop editor', 'Automation', 'Segmentation']}
          />
          <ToolCard
            name="SendGrid"
            description="Reliable email delivery"
            price="Free up to 100/day"
            features={['Transactional', 'Marketing', 'Templates']}
          />
        </div>
      </div>
    </div>
  )
}

function CampaignCard({ title, description, audience, type }: {
  title: string
  description: string
  audience: string
  type: string
}) {
  const typeColors = {
    'Onboarding': 'bg-blue-100 text-blue-700',
    'Engagement': 'bg-green-100 text-green-700',
    'Conversion': 'bg-amber-100 text-amber-700',
    'Retention': 'bg-purple-100 text-purple-700'
  }

  return (
    <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <h4 className="font-semibold text-gray-900">{title}</h4>
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${typeColors[type as keyof typeof typeColors] || 'bg-gray-100 text-gray-700'}`}>
            {type}
          </span>
        </div>
        <p className="text-sm text-gray-600">{description}</p>
        <p className="text-xs text-gray-500 mt-1">
          <strong>Audience:</strong> {audience}
        </p>
      </div>
    </div>
  )
}

function ToolCard({ name, description, price, features }: {
  name: string
  description: string
  price: string
  features: string[]
}) {
  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <h4 className="font-semibold text-gray-900 mb-1">{name}</h4>
      <p className="text-sm text-gray-600 mb-2">{description}</p>
      <p className="text-xs text-teal-600 font-semibold mb-3">{price}</p>
      <ul className="space-y-1">
        {features.map((feature, i) => (
          <li key={i} className="text-xs text-gray-600 flex items-center gap-1">
            <span className="text-teal-500">✓</span> {feature}
          </li>
        ))}
      </ul>
    </div>
  )
}
