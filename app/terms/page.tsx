import type { Metadata } from 'next'
import Link from 'next/link'
import { SITE_URL } from '@/lib/site-url'

const LAST_UPDATED = 'October 1, 2026'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'The terms that govern the Savry website, community, iOS app, and Savry+ membership.',
  alternates: { canonical: `${SITE_URL}/terms` },
}

export default function TermsOfService() {
  return (
    <main className="legal-page site-shell">
      <header className="legal-page__header">
        <span className="eyebrow">Terms</span>
        <h1>Terms of Service</h1>
        <p className="legal-page__meta">Last updated: {LAST_UPDATED}</p>
        <p className="legal-page__lede">These terms govern the Savry website, the Savry community, the Savry iOS app, and Savry+ membership (together, the “Service”). By using Savry you agree to them. If you do not agree, please do not use the Service.</p>
      </header>

      <section id="service">
        <h2>1. What Savry is</h2>
        <p>Savry is a recipe community on the web and a private recipe manager on iOS. On the website you can browse, publish, discuss, and improve recipes. In the app you keep private recipes on your device with optional iCloud sync, plan meals, build grocery lists, and get on-device recipe help. Features may change over time; we will not remove something you paid for during a paid period without a refund or an equivalent replacement.</p>
      </section>

      <section id="accounts">
        <h2>2. Your account</h2>
        <p>You must be at least 13 years old to create an account. You are responsible for keeping your password confidential and for everything that happens under your account. Tell us immediately at <a href="mailto:kitchen@savry.io">kitchen@savry.io</a> if you think your account has been accessed without permission. Give us accurate information, and use one account per person.</p>
      </section>

      <section id="community-guidelines">
        <h2>3. Community guidelines</h2>
        <p><strong>Savry is a family site.</strong> Cooks of all ages use it, often together. Everything you post must be suitable for a general audience: recipes, comments, suggestions, photos, and your name, username, bio, and profile photo.</p>
        <p>The shared table works when everyone treats it with care. When you publish, comment, suggest, or post a photo you agree to:</p>
        <ul>
          <li><strong>Keep it family-friendly.</strong> No sexual content or nudity, no profanity, slurs, or crude language, and no graphic or violent material.</li>
          <li><strong>Nothing illegal or harmful.</strong> No content about illegal drugs, nothing that encourages self-harm or disordered eating, and nothing that exploits or endangers children.</li>
          <li><strong>Respect privacy and identity.</strong> Do not post another person’s private details, and do not pretend to be Savry, a brand, or someone else.</li>
          <li><strong>Be kind.</strong> Critique the dish, not the cook. No harassment, hate, threats, or personal attacks.</li>
          <li><strong>No spam or links.</strong> Do not post promotional content, affiliate links, or off-site links in recipes, comments, or suggestions. Credit a source by name instead.</li>
          <li><strong>No unsafe food advice.</strong> Do not post instructions that are dangerous to follow, such as unsafe canning, fermentation, or temperature guidance, or claims that a recipe treats or cures a medical condition.</li>
          <li><strong>Publish only recipes you have the right to share.</strong> Write recipes in your own words. Do not copy another author’s text, photos, or distinctive presentation without permission.</li>
          <li><strong>Credit your sources.</strong> If a recipe is adapted from a book, site, or another cook, say so in the notes.</li>
          <li><strong>Stay on topic and honest.</strong> “Made It” photos should be of the dish you made; suggestions should be improvements you actually tested or believe in.</li>
        </ul>
        <p><strong>How we enforce this.</strong> What you post is checked by automated filters and by an automated reviewer that reads community content and photos against these guidelines, and members can report anything they see. Flagged content is looked at by a person. We may remove content, hide comments, or suspend or permanently ban accounts that break these guidelines, and we may do so without notice when needed to protect the community. Content that sexualises or endangers a child leads to an immediate ban and is reported to the authorities where the law requires it.</p>
        <p>If you think we got a decision wrong, write to <a href="mailto:kitchen@savry.io">kitchen@savry.io</a> and a person will review it.</p>
      </section>

      <section id="your-content">
        <h2>4. Your content and the license you give Savry</h2>
        <p>You own what you create. Private recipes, meal plans, grocery lists, and notes in the app are yours and are never community content unless you publish them.</p>
        <p>When you publish a recipe or post a comment, suggestion, “Made It” photo, or like on Savry, you grant Savry a non-exclusive, worldwide, royalty-free license to host, store, reproduce, display, adapt for formatting, and distribute that content in order to operate and promote the Service, including showing it on the website, in the app, in search results, in link previews, and in Savry communications that feature community recipes. You also allow other Savry cooks to view your published content, save a personal copy, cook it, adapt it for their own use within Savry, share a link to it, and propose structured improvements. You stay credited as the author, and you decide which suggestions become part of your recipe.</p>
        <p>This license does not let other users sell your original photos or written expression, or republish them outside Savry without your permission. You confirm that you have the rights needed to grant this license for everything you publish.</p>
      </section>

      <section id="unpublish-delete">
        <h2>5. Unpublish and delete</h2>
        <p>You can unpublish any recipe you have published from your account page; it stops being public right away, and its comments, suggestions, and version history are hidden with it. Deleting your account (from the iOS app under Settings → Account, or by emailing <a href="mailto:privacy@savry.io">privacy@savry.io</a>) removes your published recipes, photos, comments, suggestions, and likes. Personal copies other cooks saved before you unpublished, cached search results and link previews, and short-lived backups may persist for a limited time, and we may keep records we need for legal, safety, or moderation reasons.</p>
      </section>

      <section id="copyright">
        <h2>6. Copyright complaints (DMCA)</h2>
        <p>We respect the rights of creators and respond to notices that comply with the Digital Millennium Copyright Act. If you believe content on Savry infringes your copyright, send a notice to our designated agent at <a href="mailto:dmca@savry.io">dmca@savry.io</a> that includes:</p>
        <ol>
          <li>Your physical or electronic signature.</li>
          <li>Identification of the copyrighted work you claim has been infringed.</li>
          <li>Identification of the material you claim is infringing and its location on Savry (the recipe or comment URL) so we can find it.</li>
          <li>Your name, address, telephone number, and email address.</li>
          <li>A statement that you have a good-faith belief that the use is not authorized by the copyright owner, its agent, or the law.</li>
          <li>A statement, under penalty of perjury, that the information in the notice is accurate and that you are the copyright owner or authorized to act for the owner.</li>
        </ol>
        <p>We will remove or disable access to the material, notify the person who posted it, and give them the chance to send a counter-notice under 17 U.S.C. § 512(g). We may terminate the accounts of repeat infringers. Knowingly misrepresenting that material is infringing can make you liable for damages.</p>
      </section>

      <section id="food-safety">
        <h2>7. Food safety and health disclaimer</h2>
        <p>Recipes, nutrition estimates, substitutions, and on-device recipe help are provided for general information only and are not medical, nutritional, or food-safety advice. Community recipes are written by other cooks and are not tested by Savry. Nutrition figures are estimates. You are responsible for checking ingredients for allergens and dietary needs, cooking food to safe temperatures, and following safe handling, storage, canning, and fermentation practices. Consult a qualified professional about any health condition, allergy, or dietary restriction.</p>
      </section>

      <section id="savry-plus">
        <h2>8. Savry+ membership</h2>
        <ul>
          <li>Savry+ is an annual, auto-renewing subscription purchased in the Savry iOS app through Apple’s App Store. The price is shown in the app before you buy and is charged to your Apple ID.</li>
          <li>Your membership renews automatically each year at the then-current price unless you cancel at least 24 hours before the end of the current period. Manage or cancel it in your App Store subscription settings; deleting the app does not cancel a subscription.</li>
          <li>Refunds are handled by Apple under App Store policies; Savry cannot issue App Store refunds directly.</li>
          <li>Member features include unlimited imports in the app, expanded on-device recipe help, smarter weekly plans, advanced nutrition context, and an ad-free website and app. Your membership follows your Savry account.</li>
          <li>If we change the price, Apple will notify you and ask for your agreement before the change applies to you.</li>
        </ul>
      </section>

      <section id="acceptable-use">
        <h2>9. Acceptable use</h2>
        <p>You agree not to use the Service for anything illegal; to scrape, bulk-download, or mirror community content or use automated tools without our written permission; to interfere with the Service, its security, or other users; to upload malicious code; to impersonate anyone; or to resell or sublicense the Service. Content that is illegal, sexually explicit, or that infringes others’ rights is not allowed.</p>
      </section>

      <section id="savry-ip">
        <h2>10. Savry’s intellectual property</h2>
        <p>The Savry name, logo, software, design, and editorial content created by Savry are owned by Savry or its licensors and are protected by copyright, trademark, and other laws. Apart from the rights expressly granted here, no license to Savry’s intellectual property is given.</p>
      </section>

      <section id="advertising">
        <h2>11. Advertising</h2>
        <p>The website may show clearly labeled advertisements served by Google AdSense, subject to your consent choices. Advertisements are never shown to Savry+ members and never appear in the iOS app. Savry is not responsible for the products or services advertised.</p>
      </section>

      <section id="third-parties">
        <h2>12. Third-party services</h2>
        <p>Savry relies on Apple (App Store, iCloud, Apple Intelligence, Sign in with Apple), Supabase, Vercel, and Google. Their terms and privacy policies apply to their services. Links posted by other users or to recipe sources lead to sites we do not control.</p>
      </section>

      <section id="termination">
        <h2>13. Suspension and termination</h2>
        <p>You may stop using Savry and delete your account at any time. We may suspend or terminate accounts that violate these terms, create risk or legal exposure for Savry or others, or have been inactive for an extended period, and we may stop offering the Service with reasonable notice. Sections 4 through 7 and 14 through 17 survive termination.</p>
      </section>

      <section id="disclaimer">
        <h2>14. Disclaimer of warranties</h2>
        <p>The Service is provided “as is” and “as available”. To the fullest extent permitted by law, Savry disclaims all warranties, express or implied, including merchantability, fitness for a particular purpose, and non-infringement. We do not promise that the Service will be uninterrupted, error-free, or that community content is accurate or safe.</p>
      </section>

      <section id="liability">
        <h2>15. Limitation of liability</h2>
        <p>To the fullest extent permitted by law, Savry and its operator will not be liable for any indirect, incidental, special, consequential, or punitive damages, or for any loss of data, profits, or goodwill, arising from your use of the Service or any recipe or content on it. Our total liability for any claim relating to the Service is limited to the greater of the amount you paid Savry in the 12 months before the claim and US $50. Some jurisdictions do not allow these limits, so they may not apply to you.</p>
      </section>

      <section id="indemnity">
        <h2>16. Indemnity</h2>
        <p>You will defend and indemnify Savry and its operator against claims and costs arising from content you publish or your breach of these terms.</p>
      </section>

      <section id="governing-law">
        <h2>17. Governing law and disputes</h2>
        <p>These terms are governed by the laws of the United States and the state where Savry’s operator is organized, without regard to conflict-of-law rules. Disputes will be brought in the state or federal courts located in that state, and you consent to their jurisdiction. If you live in a jurisdiction whose consumer laws give you additional rights, nothing here takes those rights away.</p>
      </section>

      <section id="changes">
        <h2>18. Changes to these terms</h2>
        <p>We may update these terms from time to time. We will post the new version here and update the date at the top. For material changes we will give at least 30 days’ notice by email or on the website before they take effect. Continuing to use Savry after that means you accept the new terms.</p>
      </section>

      <section id="contact">
        <h2>19. Contact</h2>
        <p>Legal questions: <a href="mailto:legal@savry.io">legal@savry.io</a><br />Copyright notices: <a href="mailto:dmca@savry.io">dmca@savry.io</a><br />Privacy: <a href="mailto:privacy@savry.io">privacy@savry.io</a> (see our <Link href="/privacy">Privacy Policy</Link>)<br />Everything else: <a href="mailto:kitchen@savry.io">kitchen@savry.io</a></p>
      </section>
    </main>
  )
}
