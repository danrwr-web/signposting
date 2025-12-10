import type { Metadata } from 'next'
import DemoRequestClient from './DemoRequestClient'

export const metadata: Metadata = {
  metadataBase: new URL('https://www.signpostingtool.co.uk'),
  title: 'Request a Demo – The Signposting Toolkit',
  description: 'Request a demo of the Signposting Toolkit. Tell us about your surgery and we\'ll get in touch to arrange a walkthrough.',
  alternates: {
    canonical: 'https://www.signpostingtool.co.uk/demo-request',
  },
}

export default function DemoRequestPage() {
  return <DemoRequestClient />
}

