import { NextRequest, NextResponse } from 'next/server'
import { runContentMigration } from '@/scripts/migrate-content-paragraphs'
import { getSessionUser } from '@/lib/rbac'

export async function POST(request: NextRequest) {
  try {
    // Check if user is superuser
    const user = await getSessionUser()
    if (!user || user.globalRole !== 'SUPERUSER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('Starting content migration...')
    await runContentMigration()
    
    return NextResponse.json({ 
      success: true, 
      message: 'Content migration completed successfully' 
    })
  } catch (error) {
    console.error('Migration failed:', error)
    return NextResponse.json({ 
      error: 'Migration failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}
