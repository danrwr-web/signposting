import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import LandingPageClient from './LandingPageClient'
import type { Metadata } from 'next'

const landingPageDescription =
  'A modern, clinically governed GP care navigation software platform built by GPs for GPs and their care navigators. Helps reception teams direct patients safely to the right service, with local clinical sign-off and audit trail.'

export const metadata: Metadata = {
  metadataBase: new URL('https://www.signpostingtool.co.uk'),
  title: 'The Signposting Toolkit – GP care navigation software for primary care teams',
  description: landingPageDescription,
  keywords: [
    'GP care navigation software',
    'GP signposting software',
    'primary care workflow tool',
    'admin triage platform',
    'NHS reception triage',
    'signposting toolkit',
  ],
  alternates: {
    canonical: 'https://www.signpostingtool.co.uk',
  },
  openGraph: {
    title: 'The Signposting Toolkit – GP care navigation software for primary care teams',
    description: landingPageDescription,
    type: 'website',
    url: 'https://www.signpostingtool.co.uk',
    images: [
      {
        url: '/images/signposting-og.png',
        width: 1200,
        height: 630,
        alt: 'Reception team using the Signposting Toolkit GP care navigation software',
      },
      {
        url: '/images/logo.png',
        width: 800,
        height: 418,
        alt: 'Signposting Toolkit logo fallback image',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The Signposting Toolkit – GP care navigation software for primary care teams',
    description: landingPageDescription,
    images: ['/images/signposting-og.png', '/images/logo.png'],
  },
}

type HomeRenderOptions = {
  disableAutoRedirect?: boolean
}

export async function renderHomePage(
  options: HomeRenderOptions = {},
): Promise<JSX.Element> {
  const { disableAutoRedirect = false } = options

  try {
    if (!disableAutoRedirect) {
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
    }

    return <LandingPageClient />
  } catch (error) {
    // Don't catch NEXT_REDIRECT errors - let them propagate
    // This is how Next.js handles redirects internally
    if (
      error &&
      typeof error === 'object' &&
      'digest' in error &&
      typeof error.digest === 'string' &&
      error.digest.startsWith('NEXT_REDIRECT')
    ) {
      throw error
    }

    // If session check fails (not a redirect), still show landing page
    console.error('Error checking session in HomePage:', error)
    return <LandingPageClient />
  }
}

// Trigger rebuild for database migrations

export default async function HomePage() {
  return renderHomePage()
}
