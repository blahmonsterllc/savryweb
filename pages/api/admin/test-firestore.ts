import { NextApiRequest, NextApiResponse } from 'next'
import { db } from '@/lib/firebase'
import { Timestamp } from 'firebase-admin/firestore'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    console.log('Testing Firestore write with proper AI request structure...')
    
    // Try to write a properly formatted AI request document
    const testDoc = {
      userId: 'test-user',
      userTier: 'FREE' as const,
      model: 'gpt-4o-mini',
      promptTokens: 50,
      completionTokens: 100,
      totalTokens: 150,
      costUSD: 0.000225,
      inputCostUSD: 0.0000075,
      outputCostUSD: 0.00021,
      requestType: 'generate',
      promptLength: 100,
      success: true,
      responseTimeMs: 2000,
      endpoint: '/api/admin/test-firestore',
      createdAt: Timestamp.now()
    }
    
    console.log('Writing test AI request:', testDoc)
    const docRef = await db.collection('ai_requests').add(testDoc)
    console.log('Document written successfully! ID:', docRef.id)
    
    // Try to read it back
    const doc = await docRef.get()
    const data = doc.data()
    
    return res.status(200).json({
      success: true,
      message: 'Firestore write successful',
      docId: docRef.id,
      dataWritten: testDoc,
      dataRead: data
    })
  } catch (error: any) {
    console.error('Firestore test error:', error)
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    })
  }
}
