import type { Metadata } from 'next'
import { renderHomePage, metadata as homeMetadata } from '../page'

export const metadata: Metadata = {
  ...homeMetadata,
}

export default async function LandingPreviewPage() {
  return renderHomePage({ disableAutoRedirect: true })
}


