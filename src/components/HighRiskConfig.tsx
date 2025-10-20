/**
 * High-risk buttons configuration component
 * Allows surgery admins to configure high-risk quick-access buttons
 */

'use client'

import { useState, useEffect } from 'react'
import { Session } from '@/server/auth'
import { useHighRiskButtons } from '@/hooks/useHighRiskButtons'
import DefaultButtonsConfig from './DefaultButtonsConfig'
import CustomButtonForm from './CustomButtonForm'
import HighRiskButtonsList from './HighRiskButtonsList'
import HighRiskButtonsSkeleton from './HighRiskButtonsSkeleton'

interface HighRiskConfigProps {
  surgeryId?: string
  surgeries?: Array<{ id: string; slug: string; name: string }>
  session?: Session
}

export default function HighRiskConfig({ surgeryId, surgeries, session }: HighRiskConfigProps) {
  const [showAddForm, setShowAddForm] = useState(false)
  
  const {
    highRiskLinks,
    defaultButtons,
    isLoading,
    enableDefaultHighRisk,
    loadHighRiskLinks,
    loadDefaultButtons,
    toggleDefaultButtons,
    toggleIndividualButton,
    updateButton,
    addCustomLink,
    deleteLink,
    updateOrder
  } = useHighRiskButtons({ surgeryId, surgeries })

  useEffect(() => {
    loadHighRiskLinks()
    loadDefaultButtons()
  }, [loadHighRiskLinks, loadDefaultButtons])

  const handleAddCustomLink = async (data: { label: string; symptomSlug: string; orderIndex: number }) => {
    const success = await addCustomLink(data)
    if (success) {
      setShowAddForm(false)
    }
    return success
  }

  if (isLoading) {
    return <HighRiskButtonsSkeleton />
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-semibold text-nhs-dark-blue">
          High-Risk Quick Access Buttons
        </h2>
        <div className="flex gap-3">
          <button
            onClick={toggleDefaultButtons}
            className={`
              px-4 py-2 rounded-lg transition-colors
              focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-offset-2
              ${enableDefaultHighRisk 
                ? 'bg-nhs-green text-white hover:bg-green-600' 
                : 'bg-gray-400 text-white hover:bg-gray-500'
              }
            `}
            aria-label={`${enableDefaultHighRisk ? 'Disable' : 'Enable'} all default buttons`}
          >
            {enableDefaultHighRisk ? 'Disable Defaults' : 'Enable Defaults'}
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="px-4 py-2 bg-nhs-blue text-white rounded-lg hover:bg-nhs-dark-blue transition-colors focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-offset-2"
            aria-label="Add custom high-risk button"
          >
            Add Custom Button
          </button>
        </div>
      </div>

      <DefaultButtonsConfig
        defaultButtons={defaultButtons}
        enableDefaultHighRisk={enableDefaultHighRisk}
        onToggleAll={toggleDefaultButtons}
        onToggleIndividual={toggleIndividualButton}
        onUpdateButton={updateButton}
        session={session}
      />

      {showAddForm && (
        <CustomButtonForm
          onSubmit={handleAddCustomLink}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      <HighRiskButtonsList
        highRiskLinks={highRiskLinks}
        onDeleteLink={deleteLink}
        onUpdateOrder={updateOrder}
      />
    </div>
  )
}
