import Image from 'next/image'
import Link from 'next/link'
import PrivacyChoicesLink from '@/components/PrivacyChoicesLink'

export default function SiteFooter() {
  return (
    <footer className="savry-footer">
      <div className="site-shell savry-footer__inner">
        <div className="savry-footer__brand"><Image className="savry-footer__logo" src="/savry-logo.svg" alt="Savry" width={43} height={41} /><span>Savry</span></div>
        <p>Recipes worth keeping—and improving.</p>
        <nav aria-label="Footer">
          <Link href="/recipes">Recipes</Link>
          <Link href="/recipes/new">Share a recipe</Link>
          <Link href="/account">My Savry</Link>
          <Link href="/savry-plus">Savry+</Link>
          <Link href="/advertise">Advertise</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <PrivacyChoicesLink />
        </nav>
        <span>© {new Date().getFullYear()} Savry</span>
      </div>
    </footer>
  )
}
