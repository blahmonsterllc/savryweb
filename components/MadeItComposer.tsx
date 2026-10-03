'use client'

import { useEffect, useRef, useState } from 'react'
import { Camera, ChefHat, Search, X } from 'lucide-react'
import { newPhotoPath, photoToJPEG } from '@/lib/photo-upload'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser'

type Pick = { slug: string; title: string; imageUrl: string | null; authorName: string }

/**
 * "What did you make?" on the feed. A photo of the finished dish, the recipe it
 * came from, and a line about it. Counts as a Made It on the recipe and shows
 * up on the table for the cooks who follow you.
 */
export default function MadeItComposer({ viewerId, onPosted }: { viewerId: string; onPosted: () => void }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Pick[]>([])
  const [saved, setSaved] = useState<Pick[]>([])
  const [recipe, setRecipe] = useState<Pick | null>(null)
  const [photo, setPhoto] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open || saved.length) return
    getSupabaseBrowserClient().rpc('my_saved_recipes', { result_limit: 12 }).then(({ data }: { data: unknown }) => {
      setSaved(((data as { recipes?: Pick[] } | null)?.recipes ?? []))
    })
  }, [open, saved.length])

  useEffect(() => {
    const text = query.trim()
    if (text.length < 2) return setResults([])
    const timer = window.setTimeout(async () => {
      const { data } = await getSupabaseBrowserClient().rpc('browse_public_recipes', { search_query: text, result_limit: 8, result_offset: 0 })
      setResults(((data as { recipes?: Pick[] } | null)?.recipes ?? []))
    }, 250)
    return () => window.clearTimeout(timer)
  }, [query])

  useEffect(() => {
    if (!photo) return setPreview(null)
    const url = URL.createObjectURL(photo)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [photo])

  function reset() {
    setRecipe(null); setPhoto(null); setNote(''); setQuery(''); setResults([]); setError(null)
  }

  async function post() {
    if (!recipe) return setError('Pick the recipe you made.')
    if (!photo) return setError('Add a photo of the finished dish. That’s how a Made It counts.')
    setBusy(true)
    setError(null)
    try {
      const supabase = getSupabaseBrowserClient()
      const prepared = await photoToJPEG(photo)
      const path = newPhotoPath(viewerId, 'madeit')
      const { error: uploadError } = await supabase.storage.from('recipe-images').upload(path, prepared, { contentType: 'image/jpeg', upsert: false })
      if (uploadError) throw new Error('That photo could not be saved. Please try again.')
      const { error: rpcError } = await supabase.rpc('record_made_it', {
        payload: { recipeSlug: recipe.slug, source: 'web', photoPath: path, text: note.trim() || undefined },
      })
      if (rpcError) throw new Error(rpcError.message)
      reset()
      setOpen(false)
      setDone(true)
      window.setTimeout(() => setDone(false), 4000)
      onPosted()
    } catch (e: any) {
      setError(e?.message || 'Could not post that.')
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <div className="made-prompt">
        <button type="button" className="made-prompt__button" onClick={() => setOpen(true)}>
          <Camera size={18} /> What did you make?
        </button>
        {done && <span className="made-prompt__done" role="status">Posted to your table.</span>}
      </div>
    )
  }

  const choices = query.trim().length >= 2 ? results : saved

  return (
    <form className="made-composer" onSubmit={(event) => { event.preventDefault(); post() }}>
      <div className="made-composer__head">
        <strong><ChefHat size={16} /> What did you make?</strong>
        <button type="button" className="made-composer__close" onClick={() => { reset(); setOpen(false) }} aria-label="Close"><X size={16} /></button>
      </div>

      {recipe ? (
        <div className="made-composer__picked">
          {recipe.imageUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={recipe.imageUrl} alt="" />
            : <span>{recipe.title.charAt(0)}</span>}
          <div><strong>{recipe.title}</strong><small>by {recipe.authorName}</small></div>
          <button type="button" className="text-link text-link--muted" onClick={() => setRecipe(null)}>Change</button>
        </div>
      ) : (
        <div className="made-composer__pick">
          <label className="made-composer__search">
            <Search size={15} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Which recipe? Search the table…" autoFocus />
          </label>
          {choices.length > 0 && (
            <ul className="made-composer__choices" role="listbox" aria-label={query.trim().length >= 2 ? 'Matching recipes' : 'Your saved recipes'}>
              {query.trim().length < 2 && <li className="made-composer__hint">From your saved recipes</li>}
              {choices.map((choice) => (
                <li key={choice.slug}>
                  <button type="button" onClick={() => setRecipe(choice)}>
                    {choice.imageUrl
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={choice.imageUrl} alt="" />
                      : <span>{choice.title.charAt(0)}</span>}
                    <span className="made-composer__choice-text"><strong>{choice.title}</strong><small>{choice.authorName}</small></span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="made-composer__body">
        <label className={`made-composer__photo ${preview ? 'has-photo' : ''}`}>
          {preview
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={preview} alt="Your dish" />
            : <span><Camera size={22} /> Add a photo of the dish</span>}
          <input ref={fileInput} type="file" accept="image/*" capture="environment" onChange={(event) => setPhoto(event.target.files?.[0] ?? null)} />
        </label>
        <textarea value={note} onChange={(event) => setNote(event.target.value.slice(0, 400))} placeholder="How did it go? A line or two." rows={3} />
      </div>

      {error && <p className="settings-note" role="alert">{error}</p>}
      <div className="made-composer__actions">
        <span className="made-composer__fine">Posts to your table and counts as a Made It on the recipe.</span>
        <button type="submit" className="button button--coral" disabled={busy}>{busy ? 'Posting…' : 'Post'}</button>
      </div>
    </form>
  )
}
