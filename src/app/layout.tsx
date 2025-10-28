import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from 'react-hot-toast'
import { SurgeryProvider } from '@/context/SurgeryContext'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import Providers from '@/components/Providers'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'NHS Signposting',
  description: 'NHS-style symptom signposting application',
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
  const cookieStore = await cookies()
  const surgeryId = cookieStore.get('surgery')?.value
  
  // Get all surgeries for the SurgeryProvider
  const surgeries = await prisma.surgery.findMany({
    select: { id: true, slug: true, name: true },
    orderBy: { name: 'asc' }
  })
  
  // Resolve surgery data if ID is present
  let initialSurgery = null
  if (surgeryId) {
    const surgery = surgeries.find(s => s.id === surgeryId)
    if (surgery) {
      initialSurgery = { id: surgery.id, slug: surgery.slug || surgery.id, name: surgery.name }
    }
  }

  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <SurgeryProvider initialSurgery={initialSurgery} availableSurgeries={surgeries}>
            {children}
          </SurgeryProvider>
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
