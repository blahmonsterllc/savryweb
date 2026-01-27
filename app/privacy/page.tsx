export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl p-8 md:p-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">Privacy Policy</h1>
        <p className="text-sm text-gray-600 mb-8">Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
        
        <div className="space-y-8 text-gray-700">
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Introduction</h2>
            <p className="leading-relaxed">
              Welcome to Savry. We respect your privacy and are committed to protecting your personal data. 
              This privacy policy explains how we collect, use, and safeguard your information when you use 
              our mobile application and website.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Information We Collect</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-medium text-gray-800 mb-2">Account Information</h3>
                <p className="leading-relaxed">
                  When you create an account, we collect your email address and any profile information 
                  you choose to provide.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-medium text-gray-800 mb-2">Recipe and Meal Plan Data</h3>
                <p className="leading-relaxed">
                  We store the recipes you create or save, your meal plans, shopping lists, and dietary 
                  preferences to provide you with personalized recommendations.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-medium text-gray-800 mb-2">Usage Data</h3>
                <p className="leading-relaxed">
                  We collect information about how you interact with our app, including features used, 
                  time spent, and general usage patterns to improve our service.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-medium text-gray-800 mb-2">Location Data</h3>
                <p className="leading-relaxed">
                  If you enable location services, we may collect your zip code to provide local supermarket 
                  deals and store information. This is optional and can be disabled in your device settings.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">How We Use Your Information</h2>
            <ul className="list-disc list-inside space-y-2 leading-relaxed">
              <li>To provide, maintain, and improve our services</li>
              <li>To generate personalized recipe and meal plan recommendations using AI</li>
              <li>To sync your data across your devices</li>
              <li>To provide customer support and respond to your requests</li>
              <li>To send you updates, newsletters, and promotional materials (with your consent)</li>
              <li>To analyze usage patterns and improve our app features</li>
              <li>To ensure the security and integrity of our services</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Data Storage and Security</h2>
            <p className="leading-relaxed mb-4">
              We use Firebase and secure cloud infrastructure to store your data. We implement industry-standard 
              security measures including encryption, secure authentication, and regular security audits to 
              protect your information.
            </p>
            <p className="leading-relaxed">
              While we strive to protect your personal data, no method of transmission over the internet is 
              100% secure. We cannot guarantee absolute security but continuously work to improve our security practices.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Third-Party Services</h2>
            <p className="leading-relaxed mb-4">
              We use third-party services to provide our app functionality:
            </p>
            <ul className="list-disc list-inside space-y-2 leading-relaxed">
              <li><strong>OpenAI</strong>: To generate AI-powered recipe recommendations and meal plans</li>
              <li><strong>Firebase</strong>: For authentication, data storage, and app analytics</li>
              <li><strong>Vercel</strong>: For hosting our website and APIs</li>
            </ul>
            <p className="leading-relaxed mt-4">
              These services have their own privacy policies, and we encourage you to review them.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Your Rights and Choices</h2>
            <ul className="list-disc list-inside space-y-2 leading-relaxed">
              <li><strong>Access and Update</strong>: You can access and update your account information at any time through the app</li>
              <li><strong>Delete Your Data</strong>: You can request deletion of your account and all associated data by contacting us</li>
              <li><strong>Opt-Out of Communications</strong>: You can unsubscribe from promotional emails at any time</li>
              <li><strong>Data Portability</strong>: You can request a copy of your data in a portable format</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Children's Privacy</h2>
            <p className="leading-relaxed">
              Our service is not intended for children under 13 years of age. We do not knowingly collect 
              personal information from children under 13. If you are a parent or guardian and believe your 
              child has provided us with personal information, please contact us.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Changes to This Privacy Policy</h2>
            <p className="leading-relaxed">
              We may update this privacy policy from time to time. We will notify you of any changes by 
              posting the new privacy policy on this page and updating the "Last updated" date. We encourage 
              you to review this privacy policy periodically.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Contact Us</h2>
            <p className="leading-relaxed">
              If you have any questions about this privacy policy or our data practices, please contact us at:
            </p>
            <p className="mt-4 leading-relaxed">
              Email: <a href="mailto:privacy@savry.app" className="text-primary-600 hover:text-primary-700 underline">privacy@savry.app</a>
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
