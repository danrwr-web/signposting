'use client'

import { useState } from 'react'
import Link from 'next/link'
import CompactToolbar from '@/components/CompactToolbar'
import { useSurgery } from '@/context/SurgeryContext'
import { Surgery } from '@prisma/client'

interface DiabeticTitrationClientProps {
  surgeryId: string
}

type MedicationType = 'metformin' | 'sulfonylurea' | 'dpp4' | 'sglt2' | 'glp1' | 'insulin' | ''

export default function DiabeticTitrationClient({ surgeryId }: DiabeticTitrationClientProps) {
  const { surgery } = useSurgery()
  const [currentMedication, setCurrentMedication] = useState<MedicationType>('')
  const [hba1c, setHba1c] = useState<string>('')
  const [currentDose, setCurrentDose] = useState<string>('')
  const [sideEffects, setSideEffects] = useState<string>('')
  const [showRecommendation, setShowRecommendation] = useState(false)

  const surgeries: Surgery[] = surgery ? [surgery] : []

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setShowRecommendation(true)
  }

  const getRecommendation = () => {
    if (!currentMedication || !hba1c) {
      return {
        title: 'Incomplete Information',
        message: 'Please provide current medication and HbA1c level to receive recommendations.',
        type: 'info' as const,
      }
    }

    const hba1cValue = parseFloat(hba1c)
    if (isNaN(hba1cValue)) {
      return {
        title: 'Invalid HbA1c',
        message: 'Please enter a valid HbA1c value.',
        type: 'warning' as const,
      }
    }

    // Basic decision logic - this should be replaced with proper clinical guidelines
    if (hba1cValue < 48) {
      return {
        title: 'Good Control',
        message: 'HbA1c is well controlled. Continue current medication and monitor regularly.',
        type: 'success' as const,
      }
    } else if (hba1cValue >= 48 && hba1cValue < 58) {
      return {
        title: 'Consider Titration',
        message: 'HbA1c is above target. Consider increasing dose or adding second-line medication. Review with clinician.',
        type: 'warning' as const,
      }
    } else {
      return {
        title: 'Action Required',
        message: 'HbA1c is significantly above target. Urgent review recommended. Consider intensification of treatment or referral to diabetes specialist.',
        type: 'error' as const,
      }
    }
  }

  const recommendation = showRecommendation ? getRecommendation() : null

  return (
    <div className="min-h-screen bg-nhs-light-grey">
      <CompactToolbar
        variant="full"
        surgeries={surgeries}
        currentSurgeryId={surgeryId}
        searchTerm=""
        onSearchChange={() => {}}
        selectedLetter="All"
        onLetterChange={() => {}}
        selectedAge="All"
        onAgeChange={() => {}}
        resultsCount={0}
        totalCount={0}
        showSurgerySelector={false}
        onShowSurgerySelector={() => {}}
      />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Back Link */}
        <Link
          href={`/s/${surgeryId}/clinical-tools`}
          className="inline-flex items-center text-sm text-nhs-blue hover:underline mb-6"
        >
          ← Back to Clinical Tools
        </Link>

        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-nhs-dark-blue mb-3">
            Diabetic medication titration decision aid
          </h1>
          <p className="text-base text-slate-600">
            This tool helps guide medication titration decisions for patients with type 2 diabetes.
            Always use clinical judgement and refer to local guidelines.
          </p>
        </div>

        {/* Safety Notice */}
        <div className="rounded-lg border-l-4 border-amber-400 bg-amber-50 p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-amber-700">
                <strong>Important:</strong> This is a decision support tool only. All medication changes should be made in consultation with a qualified clinician and in accordance with local guidelines and patient-specific factors.
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
          <div className="space-y-6">
            {/* Current Medication */}
            <div>
              <label htmlFor="medication" className="block text-sm font-semibold text-slate-700 mb-2">
                Current medication
              </label>
              <select
                id="medication"
                value={currentMedication}
                onChange={(e) => setCurrentMedication(e.target.value as MedicationType)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:border-nhs-blue"
                required
              >
                <option value="">Select medication...</option>
                <option value="metformin">Metformin</option>
                <option value="sulfonylurea">Sulfonylurea (e.g., Gliclazide)</option>
                <option value="dpp4">DPP-4 inhibitor (e.g., Sitagliptin)</option>
                <option value="sglt2">SGLT2 inhibitor (e.g., Dapagliflozin)</option>
                <option value="glp1">GLP-1 receptor agonist (e.g., Semaglutide)</option>
                <option value="insulin">Insulin</option>
              </select>
            </div>

            {/* HbA1c */}
            <div>
              <label htmlFor="hba1c" className="block text-sm font-semibold text-slate-700 mb-2">
                Current HbA1c (mmol/mol)
              </label>
              <input
                type="number"
                id="hba1c"
                value={hba1c}
                onChange={(e) => setHba1c(e.target.value)}
                min="0"
                max="200"
                step="0.1"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:border-nhs-blue"
                placeholder="e.g., 52"
                required
              />
              <p className="mt-1 text-xs text-slate-500">
                Target HbA1c is typically &lt;48 mmol/mol (or &lt;6.5% if using percentage)
              </p>
            </div>

            {/* Current Dose */}
            <div>
              <label htmlFor="dose" className="block text-sm font-semibold text-slate-700 mb-2">
                Current dose (optional)
              </label>
              <input
                type="text"
                id="dose"
                value={currentDose}
                onChange={(e) => setCurrentDose(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:border-nhs-blue"
                placeholder="e.g., 500mg BD"
              />
            </div>

            {/* Side Effects */}
            <div>
              <label htmlFor="sideEffects" className="block text-sm font-semibold text-slate-700 mb-2">
                Side effects or concerns (optional)
              </label>
              <textarea
                id="sideEffects"
                value={sideEffects}
                onChange={(e) => setSideEffects(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:border-nhs-blue"
                placeholder="Note any side effects or patient concerns..."
              />
            </div>

            {/* Submit Button */}
            <div>
              <button
                type="submit"
                className="w-full rounded-xl bg-nhs-blue px-6 py-3 text-sm font-semibold text-white hover:bg-nhs-dark-blue focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-offset-2"
              >
                Get Recommendation
              </button>
            </div>
          </div>
        </form>

        {/* Recommendation Display */}
        {recommendation && (
          <div className={`mt-6 rounded-lg border-l-4 p-6 ${
            recommendation.type === 'success' 
              ? 'border-emerald-400 bg-emerald-50' 
              : recommendation.type === 'warning'
              ? 'border-amber-400 bg-amber-50'
              : recommendation.type === 'error'
              ? 'border-red-400 bg-red-50'
              : 'border-blue-400 bg-blue-50'
          }`}>
            <h2 className={`text-lg font-semibold mb-2 ${
              recommendation.type === 'success'
                ? 'text-emerald-800'
                : recommendation.type === 'warning'
                ? 'text-amber-800'
                : recommendation.type === 'error'
                ? 'text-red-800'
                : 'text-blue-800'
            }`}>
              {recommendation.title}
            </h2>
            <p className={`text-sm ${
              recommendation.type === 'success'
                ? 'text-emerald-700'
                : recommendation.type === 'warning'
                ? 'text-amber-700'
                : recommendation.type === 'error'
                ? 'text-red-700'
                : 'text-blue-700'
            }`}>
              {recommendation.message}
            </p>
          </div>
        )}

        {/* Additional Information */}
        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-nhs-dark-blue mb-3">
            Additional Information
          </h2>
          <div className="text-sm text-slate-600 space-y-2">
            <p>
              <strong>Target HbA1c:</strong> Generally &lt;48 mmol/mol (6.5%) for most patients, but individualised targets may apply.
            </p>
            <p>
              <strong>Consider:</strong> Patient factors, comorbidities, medication interactions, and local guidelines when making titration decisions.
            </p>
            <p>
              <strong>Review:</strong> Regular monitoring of HbA1c, renal function, and patient-reported outcomes is essential.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
