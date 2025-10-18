import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import LandingPageClient from './LandingPageClient'

// Trigger rebuild for database migrations

export default async function HomePage() {
  const session = await getServerSession(authOptions)
  
  // If user is authenticated, redirect to signposting tool
  if (session?.user) {
    const user = session.user as any
    
    // All users go to signposting tool first
    if (user.defaultSurgeryId) {
      redirect(`/s/${user.defaultSurgeryId}`)
    } else {
      // User has no default surgery, redirect to login to select one
      redirect('/login')
    }
  }

  return <LandingPageClient />
}
