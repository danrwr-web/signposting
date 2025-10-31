import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import LandingPageClient from './LandingPageClient'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'The Signposting Toolkit – Clinical Signposting and Care Navigation for GP Practices',
  description:
    'A modern, clinically governed signposting platform built by GPs for GPs and their care navigators. Helps reception teams direct patients safely to the right service, with local clinical sign-off and audit trail.',
  alternates: {
    canonical: 'https://www.signpostingtool.co.uk',
  },
  openGraph: {
    title: 'The Signposting Toolkit – Clinical Signposting and Care Navigation for GP Practices',
    description:
      'A modern, clinically governed signposting platform built by GPs for GPs and their care navigators. Helps reception teams direct patients safely to the right service, with local clinical sign-off and audit trail.',
    type: 'website',
    url: 'https://www.signpostingtool.co.uk',
  },
}

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
