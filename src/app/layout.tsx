import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from 'react-hot-toast'
import { SurgeryProvider } from '@/context/SurgeryContext'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'NHS Signposting',
  description: 'NHS-style symptom signposting application',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const surgeryId = cookieStore.get('surgery')?.value
  
  // Resolve surgery data if ID is present
  let initialSurgery = null
  if (surgeryId) {
    const surgery = await prisma.surgery.findUnique({
      where: { id: surgeryId },
      select: { id: true, name: true }
    })
    if (surgery) {
      initialSurgery = { id: surgery.id, name: surgery.name }
    }
  }

  return (
    <html lang="en">
      <body className={inter.className}>
        <SurgeryProvider initialSurgery={initialSurgery}>
          {children}
        </SurgeryProvider>
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
