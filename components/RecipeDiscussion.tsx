'use client'

import Link from 'next/link'
import { Check, ChevronDown, Heart, MessageCircle, Reply, Sparkles, X } from 'lucide-react'
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser'
import { memberPost } from '@/lib/member-fetch'
import { newPhotoPath, photoToJPEG } from '@/lib/photo-upload'

type Topic = 'addition' | 'revision' | 'substitution' | 'technique' | 'question'
type DiscussionPost = {
  id: string
  parentId: string | null
  kind: 'comment' | 'suggestion'
  topic: Topic | null
  text: string | null
  changes?: { kind: string; index?: number; from?: string; to?: string; note?: string }[]
  safetyFlags?: string[]
  madeIt?: boolean
  madeCount?: number
  photoUrl?: string | null
  status: 'pending' | 'accepted' | 'declined' | null
  userId: string
  userName: string
  isRecipeAuthor: boolean
  likeCount: number
  replyCount: number
  viewerLiked: boolean
  createdAt: string
}

type DiscussionResponse = {
  recipeAuthorId: string
  viewerId: string | null
  count: number
  madeCount?: number
  posts: DiscussionPost[]
}

const REPORT_REASONS: { value: string; label: string }[] = [
  { value: 'unsafe', label: 'Unsafe cooking advice' },
  { value: 'spam', label: 'Spam or advertising' },
  { value: 'abusive', label: 'Rude or abusive' },
  { value: 'not_a_recipe', label: 'Not about this recipe' },
  { value: 'copied', label: 'Copied from someone else' },
  { value: 'other', label: 'Something else' },
]

function summarizeChange(c: { kind: string; index?: number; from?: string; to?: string; note?: string }) {
  const n = (c.index ?? 0) + 1
  switch (c.kind) {
    case 'ingredient.replace': return `Swap ${c.from ?? 'ingredient'} → ${c.to ?? ''}`
    case 'ingredient.amount': return `${c.from ?? 'Amount'} → ${c.to ?? ''}`
    case 'ingredient.add': return `Add ${c.to ?? ''}`
    case 'ingredient.remove': return `Leave out ${c.from ?? ''}`
    case 'step.edit': return `Step ${n}: ${c.to ?? ''}`
    case 'step.add': return `New step after ${(c.index ?? -1) + 1}: ${c.to ?? ''}`
    case 'step.remove': return `Skip step ${n}`
    case 'time': return `Timing: ${c.to ?? ''}`
    case 'servings': return `Servings: ${c.to ?? ''}`
    default: return c.note ?? c.to ?? 'Tweak'
  }
}

const topicLabels: Record<Topic, string> = {
  addition: 'Addition',
  revision: 'Revision',
  substitution: 'Substitution',
  technique: 'Technique',
  question: 'Question',
}

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'S'
}

function relativeDate(value: string) {
  const time = Date.parse(value)
  if (!Number.isFinite(time)) return ''
  const seconds = Math.max(1, Math.round((Date.now() - time) / 1000))
  if (seconds < 60) return 'now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(time))
}

function messageFrom(error: unknown) {
  if (typeof error === 'string') return error
  return error instanceof Error ? error.message : String((error as { message?: string })?.message || 'Something went wrong')
}

export default function RecipeDiscussion({ slug, initialCount = 0 }: { slug: string; initialCount?: number }) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), [])
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [data, setData] = useState<DiscussionResponse | null>(null)
  const [viewerId, setViewerId] = useState<string | null>(null)
  const [mode, setMode] = useState<'comment' | 'suggestion' | 'made'>('comment')
  const [photo, setPhoto] = useState<File | null>(null)
  const [reportingId, setReportingId] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [topic, setTopic] = useState<Topic>('revision')
  const [text, setText] = useState('')
  const [replyTo, setReplyTo] = useState<DiscussionPost | null>(null)
  const [error, setError] = useState('')

  const loadDiscussion = useCallback(async () => {
    setLoading(true)
    setError('')
    const { data: response, error: loadError } = await supabase.rpc('get_recipe_discussion', { target_slug: slug })
    if (loadError) setError(loadError.message)
    else {
      setData(response as DiscussionResponse)
      setLoaded(true)
    }
    setLoading(false)
  }, [slug, supabase])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: auth }: { data: { user: User | null } }) => setViewerId(auth.user?.id ?? null))
    const { data: subscription } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => setViewerId(session?.user.id ?? null))
    return () => subscription.subscription.unsubscribe()
  }, [supabase])

  useEffect(() => {
    if (open && !loaded && !loading) void loadDiscussion()
  }, [loadDiscussion, loaded, loading, open])

  const roots = (data?.posts ?? []).filter((post) => !post.parentId)
  const repliesByParent = useMemo(() => {
    const grouped = new Map<string, DiscussionPost[]>()
    for (const post of data?.posts ?? []) {
      if (!post.parentId) continue
      grouped.set(post.parentId, [...(grouped.get(post.parentId) ?? []), post])
    }
    return grouped
  }, [data?.posts])
  const count = data?.count ?? initialCount
  const loginHref = `/app-login?returnTo=${encodeURIComponent(`/recipes/${slug}`)}`

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!viewerId) return
    if (mode === 'made' && !replyTo) {
      setSending(true)
      setError('')
      try {
        await submitMadeIt(text.trim())
        setText('')
        setPhoto(null)
        setMode('comment')
        setNotice('Counted! Thanks for cooking it.')
        await loadDiscussion()
      } catch (madeError) {
        setError(messageFrom(madeError))
      }
      setSending(false)
      return
    }
    if (text.trim().length < 2) {
      setError('Write at least two characters before posting.')
      return
    }
    setSending(true)
    setError('')
    const { error: postError } = await supabase.rpc('post_recipe_discussion', {
      payload: {
        recipeSlug: slug,
        kind: replyTo ? 'comment' : mode,
        topic: replyTo || mode === 'comment' ? null : topic,
        parentId: replyTo?.id ?? null,
        text: text.trim(),
      },
    })
    if (postError) setError(postError.message)
    else {
      setText('')
      setReplyTo(null)
      setMode('comment')
      await loadDiscussion()
    }
    setSending(false)
  }

  async function toggleLike(post: DiscussionPost) {
    if (!viewerId) {
      window.location.href = loginHref
      return
    }
    setError('')
    const { data: response, error: likeError } = await supabase.rpc('toggle_recipe_discussion_like', {
      target_contribution: post.id,
    })
    if (likeError) {
      setError(likeError.message)
      return
    }
    const result = response as { liked: boolean; likeCount: number }
    setData((current) => current ? {
      ...current,
      posts: current.posts.map((item) => item.id === post.id
        ? { ...item, viewerLiked: result.liked, likeCount: result.likeCount }
        : item),
    } : current)
  }

  async function decide(post: DiscussionPost, decision: 'accepted' | 'declined') {
    setError('')
    const { error: decisionError } = await supabase.rpc('moderate_recipe_suggestion', {
      payload: { contributionId: post.id, decision },
    })
    if (decisionError) return setError(decisionError.message)
    setData((current) => current ? {
      ...current,
      posts: current.posts.map((item) => item.id === post.id ? { ...item, status: decision } : item),
    } : current)
    // An accepted tweak changes the recipe; refresh its cached pages now. Best effort.
    if (decision === 'accepted') memberPost('/api/recipes/refresh', { slug }).catch(() => undefined)
  }

  async function report(post: DiscussionPost, reason: string) {
    setError('')
    setReportingId(null)
    const { data: result, error: reportError } = await supabase.rpc('report_content', {
      payload: { recipeSlug: slug, contributionId: post.id, reason },
    })
    if (reportError) setError(reportError.message)
    else setNotice(result?.hidden ? 'Thanks. It’s hidden while we review it.' : 'Thanks. We’ll take a look.')
  }

  async function blockCook(post: DiscussionPost) {
    setError('')
    const { error: blockError } = await supabase.rpc('block_user', { target: post.userId })
    if (blockError) setError(blockError.message)
    else {
      setNotice(`You won’t see posts from ${post.userName} anymore.`)
      setData((current) => current ? { ...current, posts: current.posts.filter((item) => item.userId !== post.userId) } : current)
    }
  }

  async function submitMadeIt(note: string) {
    if (!photo || !viewerId) throw new Error('Add a photo of your finished dish. That’s how a Made It counts.')
    // Phone photos are far over the storage limit as taken; shrink before sending.
    const prepared = await photoToJPEG(photo)
    const path = newPhotoPath(viewerId, 'madeit')
    const { error: uploadError } = await supabase.storage.from('recipe-images').upload(path, prepared, { contentType: 'image/jpeg', upsert: false })
    if (uploadError) throw new Error('That photo could not be saved. Please try again.')
    const { error: madeError } = await supabase.rpc('record_made_it', {
      payload: { recipeSlug: slug, source: 'web', photoPath: path, text: note || undefined },
    })
    if (madeError) throw new Error(madeError.message)
  }

  function startReply(post: DiscussionPost) {
    setReplyTo(post)
    setMode('comment')
    setText('')
    requestAnimationFrame(() => document.getElementById('recipe-discussion-composer')?.focus())
  }

  function Post({ post, reply = false }: { post: DiscussionPost; reply?: boolean }) {
    const isOwner = viewerId === data?.recipeAuthorId
    return (
      <article className={`discussion-post ${reply ? 'discussion-post--reply' : ''}`}>
        <div className="discussion-avatar" aria-hidden="true">{initials(post.userName)}</div>
        <div className="discussion-post__body">
          <header className="discussion-post__header">
            <strong>{post.userName}</strong>
            {post.isRecipeAuthor && <span className="discussion-badge discussion-badge--author">Author</span>}
            {post.kind === 'suggestion' && post.topic && <span className="discussion-badge">{topicLabels[post.topic]}</span>}
            {post.kind === 'suggestion' && post.status !== 'pending' && (
              <span className={`discussion-status discussion-status--${post.status}`}>{post.status}</span>
            )}
            <time dateTime={post.createdAt}>{relativeDate(post.createdAt)}</time>
          </header>
          {post.madeIt && <span className="discussion-badge discussion-badge--made">Made it{post.madeCount && post.madeCount > 1 ? ` · ${post.madeCount}` : ''}</span>}
          {post.photoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.photoUrl} alt={`${post.userName}'s finished dish`} className="discussion-photo" loading="lazy" />
          )}
          {post.changes && post.changes.length > 0 && (
            <ul className="discussion-changes">{post.changes.map((c, i) => <li key={i}>{summarizeChange(c)}</li>)}</ul>
          )}
          {post.safetyFlags && post.safetyFlags.length > 0 && (
            <p className="discussion-safety" role="note">⚠️ Food safety: {post.safetyFlags.join('; ')}</p>
          )}
          {post.text && <p>{post.text}</p>}
          <footer className="discussion-post__actions">
            <button type="button" className={post.viewerLiked ? 'is-liked' : ''} onClick={() => void toggleLike(post)} aria-label={post.viewerLiked ? 'Unlike this post' : 'Like this post'}>
              <Heart size={15} fill={post.viewerLiked ? 'currentColor' : 'none'} /> {post.likeCount || 'Like'}
            </button>
            {!reply && <button type="button" onClick={() => startReply(post)}><Reply size={15} /> Reply</button>}
            {viewerId && viewerId !== post.userId && (
              <button type="button" onClick={() => setReportingId(reportingId === post.id ? null : post.id)} aria-expanded={reportingId === post.id}>Report</button>
            )}
            {viewerId && viewerId !== post.userId && !post.isRecipeAuthor && (
              <button type="button" onClick={() => void blockCook(post)}>Block</button>
            )}
            {isOwner && post.kind === 'suggestion' && post.status === 'pending' && (
              <>
                <button type="button" className="discussion-action--accept" onClick={() => void decide(post, 'accepted')}><Check size={15} /> Accept idea</button>
                <button type="button" onClick={() => void decide(post, 'declined')}><X size={15} /> Pass</button>
              </>
            )}
          </footer>
          {reportingId === post.id && (
            <div className="discussion-report" role="group" aria-label="Report reason">
              {REPORT_REASONS.map((r) => (
                <button key={r.value} type="button" onClick={() => void report(post, r.value)}>{r.label}</button>
              ))}
            </div>
          )}
          {!reply && (repliesByParent.get(post.id) ?? []).map((response) => <Post key={response.id} post={response} reply />)}
        </div>
      </article>
    )
  }

  return (
    <section className={`recipe-discussion ${open ? 'recipe-discussion--open' : ''}`} aria-labelledby="recipe-discussion-title">
      <button
        type="button"
        className="recipe-discussion__toggle"
        aria-expanded={open}
        aria-controls="recipe-discussion-panel"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="recipe-discussion__icon"><MessageCircle size={20} /></span>
        <span>
          <strong id="recipe-discussion-title">Cook notes &amp; suggestions</strong>
          <small>{count ? `${count} contribution${count === 1 ? '' : 's'} from the community` : 'Ask, share what worked, or improve this recipe'}</small>
        </span>
        {count > 0 && <span className="recipe-discussion__count">{count}</span>}
        <ChevronDown className="recipe-discussion__chevron" size={22} aria-hidden="true" />
      </button>

      {open && (
        <div id="recipe-discussion-panel" className="recipe-discussion__panel">
          <div className="recipe-discussion__intro">
            <div>
              <span className="eyebrow">A living recipe</span>
              <h2>Talk it through with other cooks.</h2>
              <p>Share results, ask a focused question, or suggest a change for the author to review.</p>
            </div>
            <Sparkles size={24} aria-hidden="true" />
          </div>

          {loading && <p className="discussion-state">Setting the table…</p>}
          {error && <p className="discussion-error" role="alert">{messageFrom(error)}</p>}
          {notice && <p className="discussion-state" role="status">{notice}</p>}
          {!loading && loaded && roots.length === 0 && (
            <div className="discussion-empty">
              <strong>Be the first cook at the table.</strong>
              <p>Leave a useful note or suggest an improvement—the recipe author can respond here.</p>
            </div>
          )}
          {roots.length > 0 && <div className="discussion-feed">{roots.map((post) => <Post key={post.id} post={post} />)}</div>}

          {viewerId ? (
            <form className="discussion-composer" onSubmit={submit}>
              {replyTo ? (
                <div className="discussion-composer__replying">
                  Replying to <strong>{replyTo.userName}</strong>
                  <button type="button" onClick={() => setReplyTo(null)} aria-label="Cancel reply"><X size={15} /></button>
                </div>
              ) : (
                <div className="discussion-composer__modes" role="group" aria-label="Post type">
                  <button type="button" className={mode === 'comment' ? 'is-active' : ''} onClick={() => setMode('comment')}>Join the conversation</button>
                  <button type="button" className={mode === 'suggestion' ? 'is-active' : ''} onClick={() => setMode('suggestion')}>Suggest an improvement</button>
                  <button type="button" className={mode === 'made' ? 'is-active' : ''} onClick={() => setMode('made')}>I made it</button>
                </div>
              )}
              {mode === 'suggestion' && !replyTo && (
                <label className="discussion-composer__topic">
                  Type
                  <select value={topic} onChange={(event) => setTopic(event.target.value as Topic)}>
                    {Object.entries(topicLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
              )}
              {mode === 'made' && !replyTo && (
                <label className="discussion-composer__topic">
                  Photo of your finished dish (required)
                  <input id="recipe-discussion-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setPhoto(event.target.files?.[0] ?? null)} />
                </label>
              )}
              <textarea
                id="recipe-discussion-composer"
                value={text}
                maxLength={2000}
                onChange={(event) => setText(event.target.value)}
                placeholder={replyTo ? `Reply to ${replyTo.userName}…` : mode === 'suggestion' ? 'What would you change, and why did it work for you?' : mode === 'made' ? 'How did it turn out? (optional)' : 'What worked? What would you tell the next cook?'}
              />
              <div className="discussion-composer__footer">
                <span>{text.length}/2000</span>
                <button type="submit" className="button button--coral" disabled={sending || (mode === 'made' && !replyTo ? !photo : text.trim().length < 2)}>{sending ? 'Posting…' : mode === 'made' && !replyTo ? 'Share that I made it' : 'Post'}</button>
              </div>
            </form>
          ) : (
            <div className="discussion-signin">
              <p>Read every note freely. Sign in to reply or suggest a change.</p>
              <Link className="button button--coral" href={loginHref}>Join the conversation</Link>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
