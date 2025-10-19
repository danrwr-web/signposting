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
    <div className={`bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-300 rounded-lg p-4 shadow-md ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <svg className="w-5 h-5 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span className="text-lg font-bold text-yellow-800">
            TEST ACCOUNT
          </span>
        </div>
        <span className="text-lg font-bold text-yellow-700 bg-white px-3 py-1 rounded-full border">
          {userProfile.symptomsUsed} / {userProfile.symptomUsageLimit}
        </span>
      </div>
      
      <div className="w-full bg-yellow-200 rounded-full h-3 mb-3 shadow-inner">
        <div 
          className={`h-3 rounded-full transition-all duration-300 shadow-sm ${
            percentage >= 90 ? 'bg-gradient-to-r from-red-500 to-red-600' : 
            percentage >= 75 ? 'bg-gradient-to-r from-orange-500 to-orange-600' : 
            'bg-gradient-to-r from-yellow-500 to-yellow-600'
          }`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        ></div>
      </div>
      
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-yellow-800">
          {remaining > 0 ? `${remaining} symptom${remaining === 1 ? '' : 's'} remaining` : 'Limit reached'}
        </span>
        {percentage >= 90 && (
          <span className="text-sm font-bold text-red-700 bg-red-100 px-2 py-1 rounded">
            Contact Dr Webber-Rookes for full access
          </span>
        )}
      </div>
    </div>
  )
}
