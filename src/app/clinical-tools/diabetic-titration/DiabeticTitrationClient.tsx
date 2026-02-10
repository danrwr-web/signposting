'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import CompactToolbar from '@/components/CompactToolbar'
import { useSurgery } from '@/context/SurgeryContext'
import { Surgery } from '@prisma/client'
import {
  type DiabetesInput,
  type DiabetesRecommendation,
  recommendDiabetesNextStep,
} from '@/lib/clinical-tools/diabeticTitrationLogic'

interface DiabeticTitrationClientProps {
  surgeryId: string
}

type YesNoAnswer = boolean | null

export default function DiabeticTitrationClient({ surgeryId }: DiabeticTitrationClientProps) {
  const { surgery } = useSurgery()
  const surgeries: Surgery[] = surgery ? [surgery] : []

  // Eligibility state
  const [adultT2DM, setAdultT2DM] = useState<boolean | null>(null)
  const [hba1c_mmol_mol, setHba1c_mmol_mol] = useState<number | null>(null)
  const [target_hba1c_mmol_mol, setTarget_hba1c_mmol_mol] = useState<number | null>(null)
  const [months_since_last_change, setMonths_since_last_change] = useState<number | null>(null)

  // Current therapy state
  const [onMetformin, setOnMetformin] = useState(false)
  const [metforminTolerated, setMetforminTolerated] = useState<boolean | null>(null)
  const [onSGLT2i, setOnSGLT2i] = useState(false)
  const [onDPP4i, setOnDPP4i] = useState(false)
  const [onSulfonylurea, setOnSulfonylurea] = useState(false)
  const [onPioglitazone, setOnPioglitazone] = useState(false)
  const [onGLP1, setOnGLP1] = useState(false)
  const [onInsulin, setOnInsulin] = useState(false)

  // Clinical modifiers state
  const [establishedASCVD, setEstablishedASCVD] = useState(false)
  const [chronicHeartFailure, setChronicHeartFailure] = useState(false)
  const [highCVDRisk, setHighCVDRisk] = useState(false)
  const [egfrBand, setEgfrBand] = useState<'>=60' | '45-59' | '30-44' | '<30' | 'unknown'>('unknown')
  const [bmiBand, setBmiBand] = useState<'<25' | '25-29.9' | '>=30' | 'unknown'>('unknown')
  const [bmi35orMore, setBmi35orMore] = useState<boolean | null>(null)
  const [weightLossPriority, setWeightLossPriority] = useState<'yes' | 'no' | 'neutral'>('neutral')
  const [minimiseHypoRisk, setMinimiseHypoRisk] = useState(false)
  const [injectionsAcceptable, setInjectionsAcceptable] = useState<'yes' | 'no' | 'unsure'>('unsure')
  const [recurrentGenitalOrUTI, setRecurrentGenitalOrUTI] = useState<boolean | null>(null)
  const [significantGIIntoleranceHistory, setSignificantGIIntoleranceHistory] = useState<boolean | null>(null)
  const [priorDKA, setPriorDKA] = useState<boolean | null>(null)
  const [ketogenicOrVeryLowCarbDiet, setKetogenicOrVeryLowCarbDiet] = useState<boolean | null>(null)
  const [intercurrentIllnessNow, setIntercurrentIllnessNow] = useState<boolean | null>(null)

  const [showRecommendation, setShowRecommendation] = useState(false)

  // Build input object
  const input: DiabetesInput = useMemo(
    () => ({
      adultT2DM: adultT2DM === true,
      hba1c_mmol_mol,
      target_hba1c_mmol_mol,
      months_since_last_change,
      onMetformin,
      metforminTolerated,
      onSGLT2i,
      onDPP4i,
      onSulfonylurea,
      onPioglitazone,
      onGLP1,
      onInsulin,
      establishedASCVD,
      chronicHeartFailure,
      highCVDRisk,
      egfrBand,
      bmiBand,
      bmi35orMore,
      weightLossPriority,
      minimiseHypoRisk,
      injectionsAcceptable,
      recurrentGenitalOrUTI,
      significantGIIntoleranceHistory,
      priorDKA,
      ketogenicOrVeryLowCarbDiet,
      intercurrentIllnessNow,
    }),
    [
      adultT2DM,
      hba1c_mmol_mol,
      target_hba1c_mmol_mol,
      months_since_last_change,
      onMetformin,
      metforminTolerated,
      onSGLT2i,
      onDPP4i,
      onSulfonylurea,
      onPioglitazone,
      onGLP1,
      onInsulin,
      establishedASCVD,
      chronicHeartFailure,
      highCVDRisk,
      egfrBand,
      bmiBand,
      bmi35orMore,
      weightLossPriority,
      minimiseHypoRisk,
      injectionsAcceptable,
      recurrentGenitalOrUTI,
      significantGIIntoleranceHistory,
      priorDKA,
      ketogenicOrVeryLowCarbDiet,
      intercurrentIllnessNow,
    ]
  )

  const recommendation: DiabetesRecommendation | null = showRecommendation
    ? recommendDiabetesNextStep(input)
    : null

  const eligible = adultT2DM === true

  const YesNoToggle = ({
    label,
    value,
    onChange,
    id,
  }: {
    label: string
    value: YesNoAnswer
    onChange: (value: boolean) => void
    id: string
  }) => (
    <div className="flex items-center gap-3">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-offset-2 ${
            value === true
              ? 'bg-nhs-blue text-white'
              : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
          }`}
          aria-pressed={value === true}
        >
          Yes
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-offset-2 ${
            value === false
              ? 'bg-nhs-blue text-white'
              : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
          }`}
          aria-pressed={value === false}
        >
          No
        </button>
      </div>
    </div>
  )

  const YesNoUnsureToggle = ({
    label,
    value,
    onChange,
    id,
  }: {
    label: string
    value: 'yes' | 'no' | 'unsure'
    onChange: (value: 'yes' | 'no' | 'unsure') => void
    id: string
  }) => (
    <div className="flex items-center gap-3">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange('yes')}
          className={`px-3 py-1.5 rounded text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-nhs-blue ${
            value === 'yes'
              ? 'bg-nhs-blue text-white'
              : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
          }`}
          aria-pressed={value === 'yes'}
        >
          Yes
        </button>
        <button
          type="button"
          onClick={() => onChange('no')}
          className={`px-3 py-1.5 rounded text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-nhs-blue ${
            value === 'no'
              ? 'bg-nhs-blue text-white'
              : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
          }`}
          aria-pressed={value === 'no'}
        >
          No
        </button>
        <button
          type="button"
          onClick={() => onChange('unsure')}
          className={`px-3 py-1.5 rounded text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-nhs-blue ${
            value === 'unsure'
              ? 'bg-nhs-blue text-white'
              : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
          }`}
          aria-pressed={value === 'unsure'}
        >
          Unsure
        </button>
      </div>
    </div>
  )

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
            Diabetes medication escalation – decision support
          </h1>
          <p className="text-base text-slate-700 mb-4">
            This tool supports NICE‑aligned decision‑making for adults with type 2 diabetes whose HbA1c remains above target. It does not replace clinical judgement.
          </p>
          <div className="text-xs text-slate-500 space-y-1">
            <p>• Aligned with: NICE NG28 + local Devon formulary</p>
            <p>• Audience: GPs and nurses</p>
            <p>• Version 1.0 / Last reviewed: {new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</p>
          </div>
        </div>

        {/* Section A - Eligibility Check */}
        <section className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm mb-6">
          <h2 className="text-lg font-semibold text-nhs-dark-blue mb-4">Eligibility check</h2>
          <div className="space-y-4">
            <YesNoToggle
              id="adult-type2"
              label="Adult with type 2 diabetes?"
              value={adultT2DM}
              onChange={(value) => {
                setAdultT2DM(value)
                setShowRecommendation(false)
              }}
            />
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Current HbA1c (mmol/mol)
              </label>
              <input
                type="number"
                value={hba1c_mmol_mol ?? ''}
                onChange={(e) => {
                  setHba1c_mmol_mol(e.target.value ? Number(e.target.value) : null)
                  setShowRecommendation(false)
                }}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-nhs-blue"
                placeholder="e.g. 60"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Target HbA1c (mmol/mol)
              </label>
              <input
                type="number"
                value={target_hba1c_mmol_mol ?? ''}
                onChange={(e) => {
                  setTarget_hba1c_mmol_mol(e.target.value ? Number(e.target.value) : null)
                  setShowRecommendation(false)
                }}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-nhs-blue"
                placeholder="e.g. 48"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Months since last medication change
              </label>
              <input
                type="number"
                value={months_since_last_change ?? ''}
                onChange={(e) => {
                  setMonths_since_last_change(e.target.value ? Number(e.target.value) : null)
                  setShowRecommendation(false)
                }}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-nhs-blue"
                placeholder="e.g. 6"
              />
            </div>
          </div>

          {recommendation && recommendation.status === 'not_eligible' && (
            <div className="mt-4 rounded-lg border-l-4 border-red-400 bg-red-50 p-4">
              <p className="text-sm text-red-700">{recommendation.notes[0]}</p>
            </div>
          )}

          {recommendation && recommendation.status === 'ok' && recommendation.primary.drugClass === 'Optimise_current_regimen' && (
            <div className="mt-4 rounded-lg border-l-4 border-amber-400 bg-amber-50 p-4">
              <p className="text-sm text-amber-700">{recommendation.notes[0] || recommendation.primary.rationaleBullets[0]}</p>
            </div>
          )}
        </section>

        {/* Sections B-D only shown if eligible */}
        {eligible && (
          <>
            {/* Section B - Current Treatment */}
            <section className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm mb-6">
              <h2 className="text-lg font-semibold text-nhs-dark-blue mb-4">Current treatment</h2>
              <p className="text-sm text-slate-600 mb-4">Select all medications currently prescribed</p>
              <div className="space-y-3">
                {[
                  { key: 'metformin' as const, label: 'Metformin', state: onMetformin, setState: setOnMetformin },
                  { key: 'sglt2i' as const, label: 'SGLT2 inhibitor', state: onSGLT2i, setState: setOnSGLT2i },
                  { key: 'dpp4i' as const, label: 'DPP-4 inhibitor', state: onDPP4i, setState: setOnDPP4i },
                  { key: 'sulfonylurea' as const, label: 'Sulfonylurea', state: onSulfonylurea, setState: setOnSulfonylurea },
                  { key: 'pioglitazone' as const, label: 'Pioglitazone', state: onPioglitazone, setState: setOnPioglitazone },
                  { key: 'glp1' as const, label: 'GLP-1 receptor agonist', state: onGLP1, setState: setOnGLP1 },
                  { key: 'insulin' as const, label: 'Insulin', state: onInsulin, setState: setOnInsulin },
                ].map((med) => (
                  <div key={med.key} className="flex items-center gap-4">
                    <label className="text-sm font-medium text-slate-700 min-w-[200px]">
                      {med.label}
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        med.setState(!med.state)
                        setShowRecommendation(false)
                      }}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-nhs-blue ${
                        med.state
                          ? 'bg-nhs-blue text-white'
                          : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {med.state ? 'On' : 'Not on'}
                    </button>
                  </div>
                ))}
              </div>

              {/* Metformin tolerance (only if not on metformin) */}
              {!onMetformin && (
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <YesNoToggle
                    id="metformin-tolerated"
                    label="Has metformin been tolerated in the past?"
                    value={metforminTolerated}
                    onChange={(value) => {
                      setMetforminTolerated(value)
                      setShowRecommendation(false)
                    }}
                  />
                </div>
              )}
            </section>

            {/* Section C - Key Clinical Modifiers */}
            <section className="mb-6">
              <h2 className="text-lg font-semibold text-nhs-dark-blue mb-4">Key clinical modifiers</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Card 1 - Cardio-renal status */}
                <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
                  <h3 className="text-sm font-semibold text-nhs-dark-blue mb-3">Cardio‑renal status</h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="ascvd"
                        checked={establishedASCVD}
                        onChange={(e) => {
                          setEstablishedASCVD(e.target.checked)
                          setShowRecommendation(false)
                        }}
                        className="h-4 w-4 rounded border-slate-300 text-nhs-blue focus:ring-nhs-blue"
                      />
                      <label htmlFor="ascvd" className="text-xs text-slate-700">
                        Established ASCVD
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="heart-failure"
                        checked={chronicHeartFailure}
                        onChange={(e) => {
                          setChronicHeartFailure(e.target.checked)
                          setShowRecommendation(false)
                        }}
                        className="h-4 w-4 rounded border-slate-300 text-nhs-blue focus:ring-nhs-blue"
                      />
                      <label htmlFor="heart-failure" className="text-xs text-slate-700">
                        Chronic heart failure
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="high-cvd-risk"
                        checked={highCVDRisk}
                        onChange={(e) => {
                          setHighCVDRisk(e.target.checked)
                          setShowRecommendation(false)
                        }}
                        className="h-4 w-4 rounded border-slate-300 text-nhs-blue focus:ring-nhs-blue"
                      />
                      <label htmlFor="high-cvd-risk" className="text-xs text-slate-700">
                        High CVD risk (QRISK3)
                      </label>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        eGFR band
                      </label>
                      <select
                        value={egfrBand}
                        onChange={(e) => {
                          setEgfrBand(e.target.value as typeof egfrBand)
                          setShowRecommendation(false)
                        }}
                        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-nhs-blue"
                      >
                        <option value="unknown">Not specified</option>
                        <option value=">=60">≥60</option>
                        <option value="45-59">45-59</option>
                        <option value="30-44">30-44</option>
                        <option value="<30">&lt;30</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Card 2 - Safety & priorities */}
                <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
                  <h3 className="text-sm font-semibold text-nhs-dark-blue mb-3">Safety & priorities</h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="minimise-hypo"
                        checked={minimiseHypoRisk}
                        onChange={(e) => {
                          setMinimiseHypoRisk(e.target.checked)
                          setShowRecommendation(false)
                        }}
                        className="h-4 w-4 rounded border-slate-300 text-nhs-blue focus:ring-nhs-blue"
                      />
                      <label htmlFor="minimise-hypo" className="text-xs text-slate-700">
                        Minimise hypoglycaemia risk
                      </label>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Weight loss priority
                      </label>
                      <select
                        value={weightLossPriority}
                        onChange={(e) => {
                          setWeightLossPriority(e.target.value as typeof weightLossPriority)
                          setShowRecommendation(false)
                        }}
                        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-nhs-blue"
                      >
                        <option value="neutral">Neutral</option>
                        <option value="yes">Yes</option>
                        <option value="no">No</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        BMI band
                      </label>
                      <select
                        value={bmiBand}
                        onChange={(e) => {
                          setBmiBand(e.target.value as typeof bmiBand)
                          setShowRecommendation(false)
                        }}
                        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-nhs-blue"
                      >
                        <option value="unknown">Not specified</option>
                        <option value="<25">&lt;25</option>
                        <option value="25-29.9">25-29.9</option>
                        <option value=">=30">≥30</option>
                      </select>
                    </div>
                    <YesNoToggle
                      id="bmi-35"
                      label="BMI ≥35 kg/m²?"
                      value={bmi35orMore}
                      onChange={(value) => {
                        setBmi35orMore(value)
                        setShowRecommendation(false)
                      }}
                    />
                  </div>
                </div>

                {/* Card 3 - Practical factors */}
                <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
                  <h3 className="text-sm font-semibold text-nhs-dark-blue mb-3">Practical factors</h3>
                  <div className="space-y-3">
                    <YesNoUnsureToggle
                      id="injections"
                      label="Injections acceptable?"
                      value={injectionsAcceptable}
                      onChange={(value) => {
                        setInjectionsAcceptable(value)
                        setShowRecommendation(false)
                      }}
                    />
                    <YesNoToggle
                      id="recurrent-uti"
                      label="Recurrent UTIs / genital infections?"
                      value={recurrentGenitalOrUTI}
                      onChange={(value) => {
                        setRecurrentGenitalOrUTI(value)
                        setShowRecommendation(false)
                      }}
                    />
                    <YesNoToggle
                      id="gi-intolerance"
                      label="Significant GI intolerance history?"
                      value={significantGIIntoleranceHistory}
                      onChange={(value) => {
                        setSignificantGIIntoleranceHistory(value)
                        setShowRecommendation(false)
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* SGLT2 Safety Questions */}
              <div className="mt-4 bg-amber-50 rounded-lg border border-amber-200 p-4">
                <h3 className="text-sm font-semibold text-amber-900 mb-3">SGLT2 inhibitor safety checks</h3>
                <div className="space-y-3">
                  <YesNoToggle
                    id="prior-dka"
                    label="Prior DKA history?"
                    value={priorDKA}
                    onChange={(value) => {
                      setPriorDKA(value)
                      setShowRecommendation(false)
                    }}
                  />
                  <YesNoToggle
                    id="keto-diet"
                    label="Ketogenic or very low carb diet?"
                    value={ketogenicOrVeryLowCarbDiet}
                    onChange={(value) => {
                      setKetogenicOrVeryLowCarbDiet(value)
                      setShowRecommendation(false)
                    }}
                  />
                  <YesNoToggle
                    id="intercurrent-illness"
                    label="Intercurrent illness now?"
                    value={intercurrentIllnessNow}
                    onChange={(value) => {
                      setIntercurrentIllnessNow(value)
                      setShowRecommendation(false)
                    }}
                  />
                </div>
              </div>
            </section>

            {/* Get Recommendation Button */}
            <div className="mb-6">
              <button
                type="button"
                onClick={() => setShowRecommendation(true)}
                className="w-full rounded-xl bg-nhs-blue px-6 py-3 text-sm font-semibold text-white hover:bg-nhs-dark-blue focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-offset-2"
              >
                Get Recommendation
              </button>
            </div>

            {/* Section D - Recommendation Output */}
            {recommendation && recommendation.status === 'ok' && (
              <section className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm mb-6">
                <h2 className="text-lg font-semibold text-nhs-dark-blue mb-4">Recommendation</h2>

                <div className="mb-4">
                  <h3 className="text-base font-semibold text-slate-700 mb-2">Suggested next drug class to consider</h3>
                  <div className="inline-block rounded-lg bg-nhs-light-blue px-4 py-2">
                    <span className="text-lg font-bold text-nhs-dark-blue">{recommendation.primary.drugClass}</span>
                    {recommendation.primary.preferredAgent && (
                      <span className="ml-2 text-sm text-slate-600">
                        ({recommendation.primary.preferredAgent})
                      </span>
                    )}
                  </div>
                </div>

                <div className="mb-4">
                  <h3 className="text-base font-semibold text-slate-700 mb-2">Why this fits this patient</h3>
                  <ul className="list-disc list-inside space-y-1 text-sm text-slate-600">
                    {recommendation.primary.rationaleBullets.map((point, index) => (
                      <li key={index}>{point}</li>
                    ))}
                  </ul>
                </div>

                {recommendation.alternatives.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-base font-semibold text-slate-700 mb-2">Alternative options</h3>
                    <ul className="space-y-2">
                      {recommendation.alternatives.map((alt, index) => (
                        <li key={index} className="text-sm text-slate-600">
                          <strong className="text-slate-700">{alt.drugClass}</strong>
                          {alt.preferredAgent && <span className="text-slate-500"> ({alt.preferredAgent})</span>}
                          {' – '}
                          {alt.rationaleBullets.join('; ')}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {recommendation.checks.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-base font-semibold text-slate-700 mb-2">Things to check before prescribing</h3>
                    <ul className="list-disc list-inside space-y-1 text-sm text-slate-600">
                      {recommendation.checks.map((check, index) => (
                        <li key={index}>{check}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {recommendation.notes.length > 0 && (
                  <div className="mb-4 rounded-lg border-l-4 border-blue-400 bg-blue-50 p-4">
                    <h3 className="text-sm font-semibold text-blue-900 mb-2">Notes</h3>
                    <ul className="list-disc list-inside space-y-1 text-sm text-blue-700">
                      {recommendation.notes.map((note, index) => (
                        <li key={index}>{note}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-slate-200 text-xs text-slate-500">
                  <p>Based on: {recommendation.metadata.basedOn.join(', ')}</p>
                  <p>Logic version: {recommendation.metadata.logicVersion}</p>
                </div>
              </section>
            )}

            {/* Section E - Learning Link Panel */}
            {recommendation && recommendation.status === 'ok' && (
              <section className="bg-slate-50 rounded-lg border border-slate-200 p-4">
                <p className="text-sm text-slate-700 mb-2">
                  Want to understand <strong>why</strong> this option was suggested?
                </p>
                <Link
                  href="#"
                  className="text-sm text-nhs-blue hover:underline"
                  onClick={(e) => {
                    e.preventDefault()
                    // Placeholder for future learning card integration
                  }}
                >
                  View explainer and learning resources →
                </Link>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  )
}
