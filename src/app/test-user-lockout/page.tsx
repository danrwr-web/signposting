'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function TestUserLockoutPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'loading') return
    
    if (!session?.user) {
      router.push('/login')
      return
    }

    // Fetch user data to check if they're a test user
    fetch('/api/user/profile')
      .then(res => res.json())
      .then(data => {
        if (!data.isTestUser) {
          router.push('/admin')
          return
        }
        setUser(data)
        setLoading(false)
      })
      .catch(() => {
        setLoading(false)
      })
  }, [session, status, router])

  if (loading) {
    return (
      <div className="min-h-screen bg-nhs-light-grey flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-nhs-blue mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-nhs-light-grey flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
            <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Test Access Limit Reached
          </h1>
          
          <p className="text-gray-600 mb-6">
            You have reached your limit of {user.symptomUsageLimit} symptom views for this test account.
          </p>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h2 className="text-lg font-semibold text-blue-900 mb-2">
              Interested in Full Access?
            </h2>
            <p className="text-blue-800 text-sm mb-3">
              If you would like to use this tool for your surgery, please contact:
            </p>
            <div className="text-blue-900 font-medium">
              <p>Dr Daniel Webber-Rookes</p>
              <p>Ide Lane Surgery</p>
              <p className="text-sm font-normal mt-1">
                Email: <a href="mailto:contact@signpostingtool.co.uk" className="underline">contact@signpostingtool.co.uk</a>
              </p>
            </div>
          </div>
          
          <div className="space-y-3">
            <Link
              href="/login"
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-nhs-blue hover:bg-nhs-dark-blue focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-nhs-blue"
            >
              Back to Login
            </Link>
            
            <button
              onClick={() => window.history.back()}
              className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-nhs-blue"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
