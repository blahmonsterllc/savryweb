import { NextApiRequest, NextApiResponse } from 'next'
import { db } from '@/lib/firebase'

/**
 * Public Unsubscribe Endpoint
 * One-click unsubscribe from marketing emails
 * Required by CAN-SPAM and GDPR
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { token } = req.query

  if (!token || typeof token !== 'string') {
    return res.status(400).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Error - Savry</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: system-ui, -apple-system; text-align: center; padding: 50px 20px; background: #f9fafb; }
            .container { max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
            h1 { color: #ef4444; margin-bottom: 16px; }
            a { color: #0d9488; text-decoration: none; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>❌ Invalid Link</h1>
            <p>This unsubscribe link is invalid or expired.</p>
            <p style="margin-top: 20px;">
              <a href="https://savryweb.vercel.app">← Back to Savry</a>
            </p>
          </div>
        </body>
      </html>
    `)
  }

  try {
    // Decode unsubscribe token (base64 encoded userId)
    const userId = Buffer.from(token, 'base64').toString()

    // Verify user exists
    const userDoc = await db.collection('users').doc(userId).get()
    
    if (!userDoc.exists) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Error - Savry</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body { font-family: system-ui, -apple-system; text-align: center; padding: 50px 20px; background: #f9fafb; }
              .container { max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
              h1 { color: #ef4444; margin-bottom: 16px; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>❌ User Not Found</h1>
              <p>We couldn't find your account.</p>
            </div>
          </body>
        </html>
      `)
    }

    const userData = userDoc.data()

    // Update user to unsubscribed
    await db.collection('users').doc(userId).update({
      emailUnsubscribed: true,
      emailUnsubscribedDate: new Date(),
      emailMarketingConsent: false,
      updatedAt: new Date()
    })

    console.log(`📧 User unsubscribed: ${userData?.email}`)

    // Return friendly HTML page
    return res.status(200).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Unsubscribed - Savry</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { 
              font-family: system-ui, -apple-system; 
              text-align: center; 
              padding: 50px 20px; 
              background: #f9fafb; 
            }
            .container { 
              max-width: 500px; 
              margin: 0 auto; 
              background: white; 
              padding: 40px; 
              border-radius: 16px; 
              box-shadow: 0 1px 3px rgba(0,0,0,0.1); 
            }
            h1 { 
              color: #0d9488; 
              margin-bottom: 16px; 
              font-size: 28px;
            }
            p { 
              color: #6b7280; 
              line-height: 1.6; 
              margin-bottom: 12px;
            }
            a { 
              color: #0d9488; 
              text-decoration: none; 
              font-weight: 600;
            }
            a:hover {
              text-decoration: underline;
            }
            .checkmark {
              font-size: 60px;
              margin-bottom: 20px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="checkmark">✅</div>
            <h1>You're unsubscribed</h1>
            <p>You won't receive marketing emails from Savry anymore.</p>
            <p>We'll still send you important account updates and receipts.</p>
            <p style="margin-top: 30px;">
              You can re-subscribe anytime in your app settings.
            </p>
            <p style="margin-top: 30px;">
              <a href="https://savryweb.vercel.app">← Back to Savry</a>
            </p>
          </div>
        </body>
      </html>
    `)

  } catch (error: any) {
    console.error('❌ Unsubscribe error:', error)
    return res.status(500).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Error - Savry</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: system-ui; text-align: center; padding: 50px 20px; background: #f9fafb; }
            .container { max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 16px; }
            h1 { color: #ef4444; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>❌ Error</h1>
            <p>Failed to unsubscribe. Please try again later.</p>
          </div>
        </body>
      </html>
    `)
  }
}
