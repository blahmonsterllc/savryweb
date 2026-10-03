'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, FolderPlus, Plus } from 'lucide-react'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser'

type Collection = { id: string; slug: string; title: string; isPublic: boolean; itemCount: number; contains: boolean }

/** "Collect": put a recipe in one of your collections, or start a new one, from the recipe toolbar. */
export default function CollectButton({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false)
  const [collections, setCollections] = useState<Collection[] | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const root = useRef<HTMLDivElement>(null)

  const inAny = collections?.some((c) => c.contains) ?? false

  async function load() {
    const supabase = getSupabaseBrowserClient()
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) {
      window.location.assign(`/app-login?returnTo=${encodeURIComponent(`/recipes/${slug}`)}`)
      return false
    }
    const { data, error } = await supabase.rpc('my_collections', { recipe_slug: slug })
    if (error) { setNote(error.message); return true }
    setCollections(((data as { collections?: Collection[] } | null)?.collections ?? []))
    return true
  }

  useEffect(() => {
    // Only the "in a collection" state is needed before the menu opens; fetch it quietly for signed-in cooks.
    let active = true
    const supabase = getSupabaseBrowserClient()
    supabase.auth.getUser().then(({ data }: { data: { user: unknown } }) => {
      if (!active || !data.user) return
      supabase.rpc('my_collections', { recipe_slug: slug }).then(({ data: list }: { data: unknown }) => {
        if (active && list) setCollections(((list as { collections?: Collection[] }).collections ?? []))
      })
    })
    return () => { active = false }
  }, [slug])

  useEffect(() => {
    if (!open) return
    function close(event: MouseEvent | KeyboardEvent) {
      if (event instanceof KeyboardEvent ? event.key === 'Escape' : !root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open])

  async function toggleMenu() {
    if (open) return setOpen(false)
    setNote(null)
    if (await load()) setOpen(true)
  }

  async function toggle(collection: Collection) {
    setBusy(collection.slug)
    const { data, error } = await getSupabaseBrowserClient().rpc('toggle_collection_item', { collection_slug: collection.slug, recipe_slug: slug })
    setBusy(null)
    if (error) return setNote(error.message)
    const result = data as { inCollection: boolean; itemCount: number }
    setCollections((list) => (list ?? []).map((c) => (c.slug === collection.slug ? { ...c, contains: result.inCollection, itemCount: result.itemCount } : c)))
  }

  async function create() {
    const title = newTitle.trim()
    if (!title) return
    setBusy('new')
    const supabase = getSupabaseBrowserClient()
    const { data, error } = await supabase.rpc('create_collection', { title })
    if (error) { setBusy(null); return setNote(error.message) }
    const created = data as Collection
    const { data: added, error: addError } = await supabase.rpc('toggle_collection_item', { collection_slug: created.slug, recipe_slug: slug })
    setBusy(null)
    if (addError) return setNote(addError.message)
    const result = added as { inCollection: boolean; itemCount: number }
    setCollections((list) => [{ ...created, contains: result.inCollection, itemCount: result.itemCount }, ...(list ?? [])])
    setNewTitle('')
  }

  return (
    <div className="collect" ref={root}>
      <button type="button" onClick={toggleMenu} aria-haspopup="menu" aria-expanded={open} aria-pressed={inAny} className={inAny ? 'is-saved' : undefined}>
        <FolderPlus size={17} aria-hidden="true" /> <span className="recipe-quick-actions__label">{inAny ? 'Collected' : 'Collect'}</span>
      </button>
      {open && (
        <div className="collect__menu" role="menu" aria-label="Your collections">
          {collections && collections.length > 0 ? (
            <ul>
              {collections.map((c) => (
                <li key={c.id}>
                  <button type="button" role="menuitemcheckbox" aria-checked={c.contains} disabled={busy === c.slug} onClick={() => toggle(c)}>
                    <span className={`collect__check ${c.contains ? 'is-on' : ''}`}>{c.contains && <Check size={13} />}</span>
                    <span className="collect__title">{c.title}</span>
                    <small>{c.itemCount}{c.isPublic ? '' : ' · private'}</small>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="collect__empty">No collections yet. Start one:</p>
          )}
          <form className="collect__new" onSubmit={(event) => { event.preventDefault(); create() }}>
            <input value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="New collection, e.g. Sunday roasts" maxLength={80} aria-label="New collection name" />
            <button type="submit" disabled={busy === 'new' || !newTitle.trim()} aria-label="Create collection"><Plus size={15} /></button>
          </form>
          {note && <p className="collect__note" role="alert">{note}</p>}
        </div>
      )}
    </div>
  )
}
