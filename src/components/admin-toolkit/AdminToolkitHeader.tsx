'use client'

import Link from 'next/link'
import { useState } from 'react'
import UserPreferencesModal from '@/components/UserPreferencesModal'

interface AdminToolkitHeaderProps {
  surgeryId: string
  surgeryName: string
  canWrite: boolean
}

export default function AdminToolkitHeader({ surgeryId, surgeryName, canWrite }: AdminToolkitHeaderProps) {
  const [showPreferencesModal, setShowPreferencesModal] = useState(false)

  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-4">
        <Link
          href={`/s/${surgeryId}`}
          className="text-sm font-medium text-gray-600 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
        >
          ← Back to Signposting
        </Link>

        <div className="flex items-center gap-3">
          {canWrite ? (
            <Link
              href={`/s/${surgeryId}/admin-toolkit/admin`}
              className="text-sm font-medium text-nhs-blue hover:text-nhs-dark-blue underline-offset-2 hover:underline"
            >
              Manage Admin Toolkit
            </Link>
          ) : (
            <span className="text-sm text-gray-500">View only</span>
          )}

          {/* Preferences Button */}
          <button
            onClick={() => setShowPreferencesModal(true)}
            className="p-2 text-gray-600 hover:text-nhs-blue transition-colors focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-offset-2 rounded"
            title="Open preferences"
            aria-label="Open preferences"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </div>

      <header className="mb-6">
        <h1 className="text-3xl font-bold text-nhs-dark-blue">Admin Toolkit</h1>
        <p className="mt-1 text-nhs-grey">{surgeryName}</p>
      </header>

      {/* User Preferences Modal */}
      <UserPreferencesModal 
        isOpen={showPreferencesModal}
        onClose={() => setShowPreferencesModal(false)}
      />
    </>
  )
}
