'use client'

import Link from 'next/link'
import SimpleHeader from '@/components/SimpleHeader'

interface SystemManagementClientProps {
  surgeryCount: number
  userCount: number
  globalDefaults: {
    recentChangesWindowDays: number
  }
}

interface ManagementCard {
  id: string
  title: string
  description: string
  href: string
  icon: React.ReactNode
  stats?: string
}

export default function SystemManagementClient({
  surgeryCount,
  userCount,
  globalDefaults,
}: SystemManagementClientProps) {
  const cards: ManagementCard[] = [
    {
      id: 'surgeries',
      title: 'Surgery management',
      description: 'Create and edit surgeries, assign administrators, and configure onboarding settings.',
      href: '/admin/surgeries',
      stats: `${surgeryCount} ${surgeryCount === 1 ? 'surgery' : 'surgeries'}`,
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
        </svg>
      ),
    },
    {
      id: 'users',
      title: 'Global user management',
      description: 'Manage all users across the system, create new users, and assign global roles.',
      href: '/admin/users',
      stats: `${userCount} ${userCount === 1 ? 'user' : 'users'}`,
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
        </svg>
      ),
    },
    {
      id: 'ai-usage',
      title: 'AI usage & cost',
      description: 'Monitor AI usage and estimated costs across all surgeries and features.',
      href: '/admin/system/ai-usage',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
        </svg>
      ),
    },
    {
      id: 'features',
      title: 'Feature rollouts',
      description: 'Manage global and per-surgery feature enablement. Control which features are available to which surgeries.',
      href: '/admin/system/features',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5" />
        </svg>
      ),
    },
    {
      id: 'change-awareness',
      title: 'Change awareness & history',
      description: 'Control how and when changes appear in "What\'s changed" feeds. Configure the global recent changes window and per-surgery baselines.',
      href: '/admin/system/changes',
      stats: `${globalDefaults.recentChangesWindowDays}-day window`,
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      id: 'global-defaults',
      title: 'Current global defaults',
      description: 'View system-wide default values that apply unless overridden at surgery level. Includes the recent changes window and other platform-wide settings.',
      href: '/admin/system/defaults',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
  ]

  return (
    <div className="min-h-screen bg-nhs-light-grey">
      <SimpleHeader surgeries={[]} currentSurgeryId={undefined} />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-nhs-dark-blue">
            System management
          </h1>
          <p className="text-nhs-grey mt-2">
            Global, cross-surgery, and platform-wide configuration. These settings affect all surgeries unless overridden.
          </p>
        </div>

        {/* Cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cards.map((card) => (
            <Link
              key={card.id}
              href={card.href}
              className="bg-white rounded-lg border border-gray-200 p-6 hover:border-nhs-blue hover:shadow-md transition-all group"
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 p-3 bg-nhs-light-blue rounded-lg text-nhs-blue group-hover:bg-nhs-blue group-hover:text-white transition-colors">
                  {card.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-semibold text-nhs-dark-blue group-hover:text-nhs-blue transition-colors">
                    {card.title}
                  </h2>
                  <p className="text-sm text-nhs-grey mt-1 line-clamp-3">
                    {card.description}
                  </p>
                  {card.stats && (
                    <p className="text-xs text-nhs-blue font-medium mt-2">
                      {card.stats}
                    </p>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Quick info panel */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-nhs-blue flex-shrink-0 mt-0.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
            </svg>
            <div>
              <h3 className="text-sm font-medium text-nhs-dark-blue">
                Platform governance
              </h3>
              <p className="text-sm text-nhs-grey mt-1">
                These settings control platform-wide behaviour. Changes here may affect all surgeries. 
                For surgery-specific settings, use the individual surgery management pages.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
