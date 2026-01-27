export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl p-8 md:p-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">Terms of Service</h1>
        <p className="text-sm text-gray-600 mb-8">Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
        
        <div className="space-y-8 text-gray-700">
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Agreement to Terms</h2>
            <p className="leading-relaxed">
              By accessing or using Savry (the "Service"), you agree to be bound by these Terms of Service 
              ("Terms"). If you disagree with any part of these terms, you may not access the Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Description of Service</h2>
            <p className="leading-relaxed mb-4">
              Savry is an AI-powered recipe management and meal planning application available for iOS devices 
              and web browsers. The Service includes:
            </p>
            <ul className="list-disc list-inside space-y-2 leading-relaxed">
              <li>AI-generated recipe recommendations and meal plans</li>
              <li>Personal recipe storage and organization</li>
              <li>Shopping list generation and management</li>
              <li>Cross-device synchronization</li>
              <li>Integration with local supermarket information (where available)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">User Accounts</h2>
            <div className="space-y-4">
              <p className="leading-relaxed">
                To access certain features of the Service, you must create an account. You are responsible for:
              </p>
              <ul className="list-disc list-inside space-y-2 leading-relaxed">
                <li>Maintaining the confidentiality of your account credentials</li>
                <li>All activities that occur under your account</li>
                <li>Notifying us immediately of any unauthorized access</li>
                <li>Providing accurate and complete information</li>
              </ul>
              <p className="leading-relaxed mt-4">
                You must be at least 13 years old to create an account and use the Service.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">User Content and Conduct</h2>
            <div className="space-y-4">
              <p className="leading-relaxed">
                You retain ownership of any content you create or upload to the Service, including recipes, 
                meal plans, and notes. By using the Service, you grant us a license to use, store, and 
                process your content to provide and improve the Service.
              </p>
              <p className="leading-relaxed font-medium">You agree not to:</p>
              <ul className="list-disc list-inside space-y-2 leading-relaxed">
                <li>Use the Service for any illegal or unauthorized purpose</li>
                <li>Upload content that infringes on others' intellectual property rights</li>
                <li>Attempt to reverse engineer or hack the Service</li>
                <li>Upload harmful code, viruses, or malicious software</li>
                <li>Harass, abuse, or harm other users</li>
                <li>Use automated systems to access the Service without permission</li>
                <li>Resell or redistribute the Service or its content</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">AI-Generated Content</h2>
            <p className="leading-relaxed">
              Our Service uses artificial intelligence to generate recipe suggestions and meal plans. While 
              we strive for accuracy, AI-generated content may contain errors or inaccuracies. You are 
              responsible for reviewing and verifying any AI-generated recipes before use, especially 
              regarding dietary restrictions, allergies, and food safety.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Dietary and Health Disclaimer</h2>
            <p className="leading-relaxed mb-4">
              <strong>IMPORTANT:</strong> Savry is not a medical or nutritional service. The recipes, meal 
              plans, and nutritional information provided are for informational purposes only and should not 
              be considered medical advice.
            </p>
            <ul className="list-disc list-inside space-y-2 leading-relaxed">
              <li>Always consult with healthcare professionals regarding dietary restrictions and allergies</li>
              <li>Verify ingredient lists if you have food allergies or sensitivities</li>
              <li>Follow proper food safety guidelines when preparing recipes</li>
              <li>Nutritional information is estimated and may not be completely accurate</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Subscriptions and Payments</h2>
            <p className="leading-relaxed mb-4">
              Savry offers both free and paid subscription tiers. Premium features may require a paid subscription.
            </p>
            <ul className="list-disc list-inside space-y-2 leading-relaxed">
              <li>Subscriptions automatically renew unless cancelled</li>
              <li>You can cancel your subscription at any time through your device's settings</li>
              <li>Refunds are handled according to Apple's App Store policies</li>
              <li>We reserve the right to change subscription prices with notice</li>
              <li>Premium features are subject to change</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Intellectual Property</h2>
            <p className="leading-relaxed">
              The Service and its original content (excluding user-generated content), features, and 
              functionality are owned by Savry and are protected by international copyright, trademark, 
              patent, trade secret, and other intellectual property laws.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Third-Party Services and Links</h2>
            <p className="leading-relaxed">
              Our Service may contain links to third-party websites or services (such as supermarket websites) 
              that are not owned or controlled by Savry. We have no control over and assume no responsibility 
              for the content, privacy policies, or practices of any third-party services.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Service Availability</h2>
            <p className="leading-relaxed">
              We strive to provide continuous access to the Service but cannot guarantee uninterrupted 
              availability. We reserve the right to modify, suspend, or discontinue any part of the Service 
              at any time with or without notice.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Limitation of Liability</h2>
            <p className="leading-relaxed">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, SAVRY SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, 
              SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED 
              DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES, RESULTING 
              FROM YOUR USE OF THE SERVICE.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Termination</h2>
            <p className="leading-relaxed">
              We may terminate or suspend your account and access to the Service immediately, without prior 
              notice or liability, for any reason, including breach of these Terms. Upon termination, your 
              right to use the Service will immediately cease.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Governing Law</h2>
            <p className="leading-relaxed">
              These Terms shall be governed by and construed in accordance with the laws of the United States, 
              without regard to its conflict of law provisions.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Changes to Terms</h2>
            <p className="leading-relaxed">
              We reserve the right to modify or replace these Terms at any time. If a revision is material, 
              we will provide at least 30 days' notice before new terms take effect. Continued use of the 
              Service after changes constitutes acceptance of the new Terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Contact Us</h2>
            <p className="leading-relaxed">
              If you have any questions about these Terms of Service, please contact us at:
            </p>
            <p className="mt-4 leading-relaxed">
              Email: <a href="mailto:legal@savry.app" className="text-primary-600 hover:text-primary-700 underline">legal@savry.app</a>
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
