import type { Metadata } from 'next'
import InsideThePlatformClient from './InsideThePlatformClient'

export const metadata: Metadata = {
  metadataBase: new URL('https://www.signpostingtool.co.uk'),
  title: 'Inside the platform – The Signposting Toolkit',
  description: 'See how the Signposting Toolkit supports day-to-day work for busy practice teams with clear, structured signposting and workflow support.',
  alternates: {
    canonical: 'https://www.signpostingtool.co.uk/inside-the-platform',
  },
}

export default function InsideThePlatformPage() {
  return <InsideThePlatformClient />
}
