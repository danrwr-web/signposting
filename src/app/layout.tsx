import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from 'react-hot-toast'
import { SurgeryProvider } from '@/context/SurgeryContext'
import { CardStyleProvider } from '@/context/CardStyleContext'
import { NavigationPanelProvider } from '@/context/NavigationPanelContext'
import { cookies } from 'next/headers'
import { getSessionUser } from '@/lib/rbac'
import { surgeriesForViewer } from '@/server/viewerSurgeries'
import Providers from '@/components/Providers'
import UniversalNavigationPanel from '@/components/UniversalNavigationPanel'
import DeploymentEnvironmentBanner from '@/components/DeploymentEnvironmentBanner'

const inter = Inter({ subsets: ['latin'] })

// Mark layout as dynamic since we use cookies()
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'NHS Signposting',
  description: 'NHS-style symptom signposting application',
  other: {
    'google-site-verification': 'Jkfm6MYx8FVRR6F3CQj72ybUFcjI8NJ_p8-F9tmubvQ',
  },
  icons: {
    icon: '/images/signposting_logo_fav.png',
    shortcut: '/images/signposting_logo_fav.png',
    apple: '/images/signposting_logo_fav.png',
  },
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  let surgeries: Array<{ id: string; slug: string | null; name: string; surgeryType?: 'LIVE' | 'TEST' | 'GLOBAL_DEFAULT' }> = []
  let initialSurgery = null
  
  try {
    const cookieStore = await cookies()
    const surgeryId = cookieStore.get('surgery')?.value

    // Scoped to the viewer — this list is a client prop, so it ends up in the
    // HTML of every page. See surgeriesForViewer for why that matters.
    // Note: Prisma has built-in connection timeout handling
    surgeries = await surgeriesForViewer(await getSessionUser())

    // Resolve surgery data if ID is present
    if (surgeryId) {
      const surgery = surgeries.find((s: { id: string }) => s.id === surgeryId)
      if (surgery) {
        initialSurgery = { id: surgery.id, slug: surgery.slug || surgery.id, name: surgery.name }
      }
    }
  } catch (error) {
    // If database query fails or times out, log and continue with empty surgeries
    console.error('Error loading surgeries in layout:', error)
    // Continue with empty array - app should still work
    // This prevents the layout from crashing and returning a 400 error
  }

  return (
    <html lang="en">
      <body className={inter.className}>
        {/* Outside Providers: it depends on nothing but the environment, and
            it must still render if session or surgery resolution fails. */}
        <DeploymentEnvironmentBanner />
        <Providers>
          <CardStyleProvider>
            <SurgeryProvider initialSurgery={initialSurgery} availableSurgeries={surgeries}>
              <NavigationPanelProvider>
                <UniversalNavigationPanel />
                {children}
              </NavigationPanelProvider>
            </SurgeryProvider>
          </CardStyleProvider>
        </Providers>
        <Toaster 
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#fff',
              color: '#425563',
              border: '1px solid #005EB8',
            },
          }}
        />
      </body>
    </html>
  )
}
