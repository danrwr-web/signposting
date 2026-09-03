import type { Metadata } from 'next'
import InsideThePlatformClient from './InsideThePlatformClient'

export const metadata: Metadata = {
  metadataBase: new URL('https://www.signpostingtool.co.uk'),
  title: 'Inside the platform – The Signposting Toolkit',
  description: 'Explore symptom guidance, the Appointment Directory, Workflow Guidance and Practice Handbook in the Signposting Toolkit platform.',
  alternates: {
    canonical: 'https://www.signpostingtool.co.uk/inside-the-platform',
  },
}

export default function InsideThePlatformPage() {
  return <InsideThePlatformClient />
}
