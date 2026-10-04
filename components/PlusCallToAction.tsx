'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser'

/** The membership card's button: join when signed out; otherwise point at the app, where Savry+ is bought. */
export default function PlusCallToAction() {
  const [state, setState] = useState<'unknown' | 'anonymous' | 'member' | 'plus'>('unknown')

  useEffect(() => {
    let active = true
    const supabase = getSupabaseBrowserClient()
    supabase.auth.getUser().then(async ({ data }: { data: { user: unknown } }) => {
      if (!active) return
      if (!data.user) return setState('anonymous')
      const { data: profile } = await supabase.rpc('my_profile')
      if (!active) return
      setState(profile?.tier === 'plus' || profile?.tier === 'pro' ? 'plus' : 'member')
    }).catch(() => active && setState('anonymous'))
    return () => { active = false }
  }, [])

  if (state === 'plus') {
    return <Link className="button button--coral" href="/account#membership">You&rsquo;re a Savry+ member · manage</Link>
  }
  if (state === 'member') {
    return <a className="button button--coral" href="/#app-coming-soon">Get Savry+ in the Savry app</a>
  }
  return <Link className="button button--coral" href="/app-login?returnTo=/savry-plus">Create your free Savry account</Link>
}
