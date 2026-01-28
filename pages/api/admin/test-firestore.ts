import { NextApiRequest, NextApiResponse } from 'next'
import { db } from '@/lib/firebase'
import { Timestamp } from 'firebase-admin/firestore'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    console.log('Testing Firestore write...')
    
    // Try to write a simple test document
    const testDoc = {
      test: true,
      message: 'Test write',
      timestamp: Timestamp.now(),
      createdAt: new Date()
    }
    
    console.log('Writing test document:', testDoc)
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
