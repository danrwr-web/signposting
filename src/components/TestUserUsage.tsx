'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'

interface TestUserUsageProps {
  className?: string
}

interface UserProfile {
  isTestUser: boolean
  symptomUsageLimit: number | null
  symptomsUsed: number
}

export default function TestUserUsage({ className = '' }: TestUserUsageProps) {
  const { data: session } = useSession()
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session?.user) {
      setLoading(false)
      return
    }

    fetch('/api/user/profile')
      .then(res => res.json())
      .then(data => {
        setUserProfile(data)
        setLoading(false)
      })
      .catch(() => {
        setLoading(false)
      })
  }, [session])

  if (loading) {
    return (
      <div className={`animate-pulse bg-gray-200 rounded h-6 w-32 ${className}`}></div>
    )
  }

  if (!userProfile?.isTestUser || !userProfile.symptomUsageLimit) {
    return null
  }

  const remaining = userProfile.symptomUsageLimit - userProfile.symptomsUsed
  const percentage = (userProfile.symptomsUsed / userProfile.symptomUsageLimit) * 100

  return (
    <div className={`bg-yellow-50 border border-yellow-200 rounded-lg p-3 ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-yellow-800">
          Test Account Usage
        </span>
        <span className="text-sm text-yellow-700">
          {userProfile.symptomsUsed} / {userProfile.symptomUsageLimit}
        </span>
      </div>
      
      <div className="w-full bg-yellow-200 rounded-full h-2 mb-2">
        <div 
          className={`h-2 rounded-full transition-all duration-300 ${
            percentage >= 90 ? 'bg-red-500' : 
            percentage >= 75 ? 'bg-orange-500' : 
            'bg-yellow-500'
          }`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        ></div>
      </div>
      
      <div className="flex items-center justify-between text-xs text-yellow-700">
        <span>
          {remaining > 0 ? `${remaining} remaining` : 'Limit reached'}
        </span>
        {percentage >= 90 && (
          <span className="font-medium text-red-600">
            Contact Dr Webber-Rookes for full access
          </span>
        )}
      </div>
    </div>
  )
}
