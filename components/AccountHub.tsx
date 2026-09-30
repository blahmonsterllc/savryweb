'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowRight, BookOpen, LogOut, Plus } from 'lucide-react'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser'

type AccountData = {
  user: { id: string; name: string; email: string; tier: string }
  recipes: Array<{ id: string; slug: string; title: string; image_url: string | null; made_count: number; version: number }>
}

export default function AccountHub() {
  const [data, setData] = useState<AccountData | null>(null)
  const [status, setStatus] = useState<'loading' | 'signed-out' | 'ready' | 'error'>('loading')

  useEffect(() => {
    let active = true
    const supabase = getSupabaseBrowserClient()

    async function load() {
      const { data: authData } = await supabase.auth.getUser()
      const user = authData.user
      if (!active) return
      if (!user) {
        setStatus('signed-out')
        return
      }

      const [{ data: profile, error: profileError }, { data: recipes, error: recipesError }] = await Promise.all([
        supabase.from('profiles').select('display_name,tier').eq('id', user.id).maybeSingle(),
        supabase
          .from('recipes')
          .select('id,slug,title,image_url,made_count,version')
          .eq('author_id', user.id)
          .order('created_at', { ascending: false })
          .limit(100),
      ])
      if (!active) return
      if (profileError || recipesError) {
        setStatus('error')
        return
      }
      setData({
        user: {
          id: user.id,
          name: profile?.display_name || String(user.user_metadata?.full_name || user.email?.split('@')[0] || 'Savry cook'),
          email: user.email || 'Apple private relay',
          tier: profile?.tier || 'free',
        },
        recipes: recipes ?? [],
      })
      setStatus('ready')
    }

    load().catch(() => active && setStatus('error'))
    return () => { active = false }
  }, [])

  async function signOut() {
    await getSupabaseBrowserClient().auth.signOut()
    setData(null)
    setStatus('signed-out')
  }

  if (status === 'loading') return <div className="account-state">Opening your Savry kitchen…</div>

  if (status === 'signed-out') {
    return (
      <div className="account-state account-state--signin">
        <BookOpen size={34} />
        <h2>Join the first cooks at the table.</h2>
        <p>Create one community account with Apple or email. Use it to publish recipes now and connect to the Savry app when it launches.</p>
        <Link className="button button--coral" href="/app-login?returnTo=/account">Create an account or sign in <ArrowRight size={18} /></Link>
      </div>
    )
  }

  if (status === 'error' || !data) return <div className="account-state">We could not open your account right now. Please try again shortly.</div>

  return (
    <div className="account-hub">
      <section className="account-profile">
        <div>
          <span className="eyebrow">Community account</span>
          <h2>{data.user.name}</h2>
          <p>{data.user.email} · {data.user.tier === 'plus' ? 'Savry+' : 'Free preview account'}</p>
        </div>
        <button type="button" onClick={signOut}><LogOut size={16} /> Sign out</button>
      </section>

      <section className="account-library">
        <div className="section-heading section-heading--row">
          <div><span className="eyebrow">From your kitchen</span><h2>Your shared recipes</h2></div>
          <Link href="/recipes/new" className="text-link"><Plus size={16} /> Add a recipe</Link>
        </div>
        {data.recipes.length ? (
          <ul>
            {data.recipes.map((recipe) => (
              <li key={recipe.id}>
                <Link href={`/recipes/${recipe.slug}`}>
                  {recipe.image_url ? <img src={recipe.image_url} alt="" /> : <span className="account-library__initial">{recipe.title.charAt(0)}</span>}
                  <div><strong>{recipe.title}</strong><span>{recipe.made_count} made it · version {recipe.version}</span></div>
                  <ArrowRight size={18} />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="account-library__empty">
            <p>You have not shared a recipe yet. Start with the dish friends or family always ask you to make.</p>
            <Link href="/recipes/new">Add your first recipe <ArrowRight size={16} /></Link>
          </div>
        )}
      </section>
    </div>
  )
}
