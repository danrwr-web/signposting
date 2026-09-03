import type { Metadata } from 'next'
import DemoRequestClient from './DemoRequestClient'

export const metadata: Metadata = {
  metadataBase: new URL('https://www.signpostingtool.co.uk'),
  title: 'Book a demo – The Signposting Toolkit',
  description: 'Book a practical walkthrough of the Signposting Toolkit for your general practice team.',
  alternates: {
    canonical: 'https://www.signpostingtool.co.uk/demo-request',
  },
}

export default function DemoRequestPage() {
  return <DemoRequestClient />
}
