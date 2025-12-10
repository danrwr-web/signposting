import type { Metadata } from 'next'
import WhySignpostingToolkitClient from './WhySignpostingToolkitClient'

export const metadata: Metadata = {
  metadataBase: new URL('https://www.signpostingtool.co.uk'),
  title: 'Why Choose the Signposting Toolkit | Signposting Toolkit',
  description: 'Discover why practices and PCNs choose the Signposting Toolkit: built by GPs for real workflows, with local clinical governance and safety-first design.',
  alternates: {
    canonical: 'https://www.signpostingtool.co.uk/why-signposting-toolkit',
  },
}

export default function WhySignpostingToolkitPage() {
  return <WhySignpostingToolkitClient />
}

