import AdSlotClient, { type AdPlacement } from '@/components/AdSlotClient'
import { getViewerMembership } from '@/lib/viewer-membership'

/**
 * Server wrapper for ad placements. Savry+ (and pro) members see no ads: the
 * membership check runs on the server from the Supabase session cookie, so a
 * member never receives ad markup and there is nothing to reconcile on hydrate.
 * Use `AdSlotClient` with `checkMembership` from inside client components.
 */
export default async function AdSlot({ placement, hidden = false }: { placement: AdPlacement; hidden?: boolean }) {
  if (hidden) return null
  const { isMember } = await getViewerMembership()
  if (isMember) return null
  return <AdSlotClient placement={placement} />
}
