import { Metadata } from 'next'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: "User Guide • Signposting Toolkit",
  description: "Redirects to the public User Guide documentation",
}

export default function HelpPage() {
  redirect('https://docs.signpostingtool.co.uk/wiki/User-Guide')
}
