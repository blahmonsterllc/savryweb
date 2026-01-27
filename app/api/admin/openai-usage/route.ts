import { NextResponse } from 'next/server'
import { getUsageStats } from '@/lib/openai-tracker'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Get OpenAI API usage statistics
 * Admin only endpoint
 */
export async function GET() {
  try {
    const stats = getUsageStats()
    
    return NextResponse.json(stats, {
      headers: {
        'cache-control': 'no-store, max-age=0',
      },
    })
  } catch (error) {
    console.error('Error fetching OpenAI usage stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch usage stats' },
      { status: 500 }
    )
  }
}
