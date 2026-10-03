'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { UserPlus, UserCheck } from 'lucide-react'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser'

type FollowState = { following: boolean; followerCount: number; followingCount: number; isSelf: boolean }

/**
 * One Follow control for a cook. Reads the state from the server, toggles
 * through toggle_follow (counts are kept there), and sends signed-out
 * visitors to sign in and come back.
 */
export default function FollowButton({ username, compact = false, onChange }: { username: string; compact?: boolean; onChange?: (state: FollowState) => void }) {
  const [state, setState] = useState<FollowState | null>(null)
  const [viewer, setViewer] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    async function load() {
      const supabase = getSupabaseBrowserClient()
      const [{ data: auth }, { data }] = await Promise.all([supabase.auth.getUser(), supabase.rpc('follow_state', { target_username: username })])
      if (!active) return
      setViewer(Boolean(auth.user))
      if (data) setState(data as FollowState)
    }
    load().catch(() => active && setViewer(false))
    return () => { active = false }
  }, [username])

  async function toggle() {
    if (!state || busy) return
    setBusy(true)
    setNote(null)
    const { data, error } = await getSupabaseBrowserClient().rpc('toggle_follow', { target_username: username })
    setBusy(false)
    if (error) return setNote(error.message)
    const next = { ...state, following: Boolean(data?.following), followerCount: Number(data?.followerCount ?? state.followerCount) }
    setState(next)
    onChange?.(next)
  }

  if (!state) return null
  const count = !compact && <span className="follow-button__count">{state.followerCount} follower{state.followerCount === 1 ? '' : 's'}</span>
  if (state.isSelf) return count || null
  if (viewer === false) {
    return (
      <span className="follow-button__wrap">
        <Link href={`/app-login?returnTo=${encodeURIComponent(`/cooks/${username}`)}`} className={`follow-button ${compact ? 'follow-button--compact' : ''}`}>
          <UserPlus size={15} /> Follow
        </Link>
        {count}
      </span>
    )
  }
  return (
    <span className="follow-button__wrap">
      <button
        type="button"
        className={`follow-button ${state.following ? 'is-following' : ''} ${compact ? 'follow-button--compact' : ''}`}
        onClick={toggle}
        disabled={busy}
        aria-pressed={state.following}
      >
        {state.following ? <UserCheck size={15} /> : <UserPlus size={15} />} {state.following ? 'Following' : 'Follow'}
      </button>
      {count}
      {note && <span className="follow-button__note" role="alert">{note}</span>}
    </span>
  )
}
