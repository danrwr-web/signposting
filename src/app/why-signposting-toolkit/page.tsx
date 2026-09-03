import type { Metadata } from 'next'
import WhySignpostingToolkitClient from './WhySignpostingToolkitClient'

export const metadata: Metadata = {
  metadataBase: new URL('https://www.signpostingtool.co.uk'),
  title: 'Why It Works — Signposting Toolkit',
  description:
    'Built in general practice for local care navigation, with practice-owned content, review controls and optional AI tools.',
  alternates: {
    canonical: 'https://www.signpostingtool.co.uk/why-signposting-toolkit',
  },
}

export default function WhySignpostingToolkitPage() {
  return <WhySignpostingToolkitClient />
}
