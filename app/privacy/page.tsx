import type { Metadata } from 'next'
import Link from 'next/link'
import { SITE_URL } from '@/lib/site-url'

const LAST_UPDATED = 'October 6, 2026'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How Savry collects, uses, stores, and protects your information on the website and in the iOS app.',
  alternates: { canonical: `${SITE_URL}/privacy` },
}

export default function PrivacyPolicy() {
  return (
    <main className="legal-page site-shell">
      <header className="legal-page__header">
        <span className="eyebrow">Privacy</span>
        <h1>Privacy Policy</h1>
        <p className="legal-page__meta">Last updated: {LAST_UPDATED}</p>
        <p className="legal-page__lede">Savry is a recipe community on the web and a private recipe app on iOS. This policy explains what we collect, why, where it is stored, and the choices you have. Questions go to <a href="mailto:privacy@savry.io">privacy@savry.io</a>.</p>
      </header>

      <section id="summary">
        <h2>The short version</h2>
        <ul>
          <li>Your private recipes, meal plans, and grocery lists in the iOS app stay on your device and, if you enable it, in your own iCloud (CloudKit) account. Savry cannot read them.</li>
          <li>Recipe AI in the iOS app runs on your device with Apple Intelligence. Your recipes are not sent to Savry or to a third-party AI service for that.</li>
          <li>Your Savry account and everything you publish to the community are stored in Supabase (Postgres and Storage) in the United States.</li>
          <li>Savry shows no advertising and uses no advertising cookies, on the website or in the app.</li>
          <li>You can access, correct, or delete your data at any time.</li>
        </ul>
      </section>

      <section id="information-we-collect">
        <h2>Information we collect</h2>
        <h3>Account information</h3>
        <p>When you create a Savry account we collect your email address, the display name you choose, and your sign-in method. Sign-in is by email and password or Sign in with Apple, both handled through Supabase Auth. Passwords are stored only as salted hashes. If you use Sign in with Apple, Apple may share a relay email address instead of your real one.</p>
        <h3>Community content</h3>
        <p>Recipes you publish, along with their photos, ingredients, steps, notes, and version history, are stored in our community database. So are the comments, suggestions, “Made It” photos, and likes you add to recipes. This content is public: anyone on the internet can see it together with your display name.</p>
        <h3>Membership status</h3>
        <p>If you subscribe to Savry+, we record that your account is a member and when the membership renews or ends, so we can turn on member features. Payment is processed by Apple; we never receive your card details.</p>
        <h3>Private recipes in the iOS app</h3>
        <p>Recipes you import or write in the app, your meal plans, grocery lists, and cooking preferences are stored on your device. If iCloud sync is on, they are also stored in your private iCloud database through Apple’s CloudKit, under your Apple ID and Apple’s privacy terms. Savry has no access to that data.</p>
        <h3>Technical and usage information</h3>
        <p>Like most websites, our servers log the IP address, browser type, requested page, referring page, and time of each request, along with error reports. We use these logs to keep the service running, protect it from abuse, and understand which parts of Savry are used. The website does not use third-party analytics trackers. Server logs are deleted after 30 days.</p>
        <h3>Communications</h3>
        <p>If you email us, we keep the message and our reply so we can help you. If you opt in to Savry emails, we keep your address and your preferences until you unsubscribe.</p>
      </section>

      <section id="how-we-use">
        <h2>How we use information</h2>
        <ul>
          <li>To create and secure your account and to sign you in.</li>
          <li>To publish and display the recipes and community activity you choose to share, with your display name.</li>
          <li>To run Savry+ membership features.</li>
          <li>To answer support requests and send account or service notices.</li>
          <li>To send product news only if you opt in, with an unsubscribe link in every email.</li>
          <li>To keep the service safe: preventing spam, abuse, fraud, and unauthorized access, and enforcing our <Link href="/terms">Terms</Link>. This includes automated review of what you publish to the community and of your public profile, to check that it is suitable for a family site. Flagged items are reviewed by a person.</li>
        </ul>
      </section>

      <section id="legal-bases">
        <h2>Legal bases (EEA, UK, and Switzerland)</h2>
        <p>Where the GDPR or UK GDPR applies, we rely on these legal bases:</p>
        <ul>
          <li><strong>Performance of a contract</strong>: providing your account, the community features you use, and Savry+.</li>
          <li><strong>Legitimate interests</strong>: securing the service, preventing abuse, keeping short-lived server logs, and improving Savry, balanced against your rights.</li>
          <li><strong>Consent</strong>: marketing email. You can withdraw consent at any time using the unsubscribe link in an email.</li>
          <li><strong>Legal obligation</strong>: responding to lawful requests and keeping records we are required to keep.</li>
        </ul>
      </section>

      <section id="where-data-lives">
        <h2>Where your data is stored and who processes it</h2>
        <ul>
          <li><strong>Supabase</strong> (Postgres database, file storage, and authentication), hosted in the United States, for accounts, memberships, and all community content.</li>
          <li><strong>Apple iCloud / CloudKit</strong>, for private recipe sync in the iOS app, under your Apple ID.</li>
          <li><strong>Apple Intelligence</strong> on-device models, for recipe help in the iOS app. Processing happens on your device.</li>
          <li><strong>Apple App Store</strong>, for Savry+ purchases and subscription management.</li>
          <li><strong>Vercel</strong>, which hosts the website and its short-lived server logs.</li>
          <li><strong>Anthropic</strong>, whose Claude model reviews community content for us. The recipes, comments, suggestions, and photos you publish, and your profile name, username, bio, links, and photo, are sent to it to be checked against our community guidelines. Private recipes in the app are never sent.</li>
        </ul>
        <p>If you are outside the United States, your account and community data are transferred to and stored in the United States. Where required, we rely on standard contractual clauses and the safeguards offered by these providers. Data in transit is encrypted with TLS, and access to the database is restricted with row-level security so that only you can change your own content.</p>
      </section>

      <section id="public-content">
        <h2>What is public</h2>
        <p>The following are visible to anyone, including search engines and people without a Savry account: published recipes and their photos, your display name, comments, suggestions, “Made It” photos, likes, and the version history of published recipes. Your email address, sign-in method, and membership status are never shown publicly. Private recipes in the iOS app are never public unless you publish them.</p>
      </section>

      <section id="advertising-choices">
        <h2>Advertising</h2>
        <p>Savry shows no advertising on the website or in the iOS app, and sets no advertising or tracking cookies. The only cookies on the website keep you signed in. Savry is supported by Savry+ memberships.</p>
      </section>

      <section id="do-not-sell">
        <h2>Do Not Sell or Share (California and other US states)</h2>
        <p>Savry does not sell or share your personal information, for money or for advertising, under the California Privacy Rights Act (CPRA) or similar state laws. Savry shows no advertising and uses no advertising or tracking cookies, so there is nothing to opt out of. We honor Global Privacy Control signals sent by your browser. We do not knowingly sell or share the personal information of anyone, including anyone under 16.</p>
      </section>

      <section id="retention">
        <h2>How long we keep information</h2>
        <ul>
          <li><strong>Account data</strong> is kept until you delete your account.</li>
          <li><strong>Published content</strong> (recipes, comments, suggestions, photos, likes) is removed when you delete your account. You can also unpublish individual recipes from your account at any time.</li>
          <li><strong>Recipe version history</strong> is kept for as long as the recipe exists on Savry, and is removed with the recipe.</li>
          <li><strong>Server logs</strong> are kept for 30 days.</li>
          <li><strong>Support email</strong> is kept as long as needed to resolve your request and for a reasonable period afterwards.</li>
          <li><strong>Private app data</strong> lives on your device and in your iCloud account; deleting the app or your iCloud data removes it, and Savry never holds a copy.</li>
        </ul>
        <p>We may keep limited records longer where the law requires it or to resolve disputes and enforce our terms.</p>
      </section>

      <section id="your-rights">
        <h2>Your rights</h2>
        <p>Wherever you live, you can:</p>
        <ul>
          <li><strong>Access</strong> the personal information we hold about you and receive a copy in a portable format.</li>
          <li><strong>Correct</strong> your display name and email from your account settings, or ask us to fix anything else.</li>
          <li><strong>Delete</strong> your account and all associated data. In the iOS app, use Settings → Account → Delete account. On the web, email <a href="mailto:privacy@savry.io">privacy@savry.io</a> from the address on your account and we will complete the deletion within 30 days.</li>
          <li><strong>Opt out</strong> of marketing email through the unsubscribe link in every message.</li>
          <li><strong>Object to or restrict</strong> processing based on legitimate interests, and <strong>withdraw consent</strong> at any time without affecting earlier processing.</li>
          <li><strong>Complain</strong> to your local data protection authority if you believe we have not respected your rights. We would appreciate the chance to help first.</li>
        </ul>
        <p>We will never discriminate against you for exercising these rights. We may ask you to verify your identity before acting on a request.</p>
      </section>

      <section id="children">
        <h2>Children</h2>
        <p>Savry is not directed to children under 13, and we do not knowingly collect personal information from them. If you believe a child has created an account, contact <a href="mailto:privacy@savry.io">privacy@savry.io</a> and we will delete it.</p>
      </section>

      <section id="security">
        <h2>Security</h2>
        <p>We use encrypted connections, hashed passwords, database row-level security, and least-privilege access to protect your information. No system is perfectly secure, so please use a strong, unique password and tell us right away at <a href="mailto:privacy@savry.io">privacy@savry.io</a> if you suspect a problem with your account.</p>
      </section>

      <section id="changes">
        <h2>Changes to this policy</h2>
        <p>When we change this policy we will update the date at the top and, for material changes, notify you by email or with a notice on the website before they take effect.</p>
      </section>

      <section id="contact">
        <h2>Contact</h2>
        <p>Privacy questions and requests: <a href="mailto:privacy@savry.io">privacy@savry.io</a><br />Everything else: <a href="mailto:kitchen@savry.io">kitchen@savry.io</a></p>
      </section>
    </main>
  )
}
