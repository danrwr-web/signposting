'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import CompactToolbar from '@/components/CompactToolbar'
import { useSurgery } from '@/context/SurgeryContext'
import { Surgery } from '@prisma/client'
import {
  type LUTSInput,
  type LUTSRecommendation,
  recommendLUTSTreatment,
} from '@/lib/clinical-tools/lutsLogic'

interface LUTSClientProps {
  surgeryId: string
}

type YesNoAnswer = boolean | null

export default function LUTSClient({ surgeryId }: LUTSClientProps) {
  const { surgery } = useSurgery()
  const surgeries: Surgery[] = surgery ? [surgery] : []

  // Eligibility
  const [adultPatient, setAdultPatient] = useState<boolean | null>(null)

  // Red flags
  const [visibleHaematuria, setVisibleHaematuria] = useState(false)
  const [recurrentUTIs, setRecurrentUTIs] = useState(false)
  const [suspectedRetention, setSuspectedRetention] = useState(false)
  const [neurologicalRedFlags, setNeurologicalRedFlags] = useState(false)
  const [suspectedProstateCancer, setSuspectedProstateCancer] = useState(false)

  // Voiding symptoms
  const [hesitancy, setHesitancy] = useState(false)
  const [weakStream, setWeakStream] = useState(false)
  const [straining, setStraining] = useState(false)
  const [incompleteEmptying, setIncompleteEmptying] = useState(false)
  const [postVoidDribble, setPostVoidDribble] = useState(false)

  // Storage symptoms
  const [urgency, setUrgency] = useState(false)
  const [frequency, setFrequency] = useState(false)
  const [nocturia, setNocturia] = useState(false)
  const [urgeIncontinence, setUrgeIncontinence] = useState(false)

  // Symptom severity
  const [ipssScore, setIpssScore] = useState<number | null>(null)
  const [bladderDiaryAvailable, setBladderDiaryAvailable] = useState<boolean | null>(null)

  // Patient context
  const [maleWithLikelyBPH, setMaleWithLikelyBPH] = useState<boolean | null>(null)
  const [enlargedProstateKnown, setEnlargedProstateKnown] = useState<boolean | null>(null)
  const [raisedPSAKnown, setRaisedPSAKnown] = useState<boolean | null>(null)

  // Contraindications
  const [fallsRiskOrPosturalHypotension, setFallsRiskOrPosturalHypotension] = useState(false)
  const [cognitiveImpairmentOrHighAnticholinergicBurden, setCognitiveImpairmentOrHighAnticholinergicBurden] = useState(false)
  const [narrowAngleGlaucoma, setNarrowAngleGlaucoma] = useState(false)
  const [severeUncontrolledHypertension, setSevereUncontrolledHypertension] = useState(false)

  // Current medications
  const [onAlphaBlocker, setOnAlphaBlocker] = useState(false)
  const [onFiveARI, setOnFiveARI] = useState(false)
  const [onAntimuscarinic, setOnAntimuscarinic] = useState(false)
  const [onBeta3Agonist, setOnBeta3Agonist] = useState(false)

  const [showRecommendation, setShowRecommendation] = useState(false)

  // Build input object
  const input: LUTSInput = useMemo(
    () => ({
      adultPatient: adultPatient === true,
      visibleHaematuria,
      recurrentUTIs,
      suspectedRetention,
      neurologicalRedFlags,
      suspectedProstateCancer,
      hesitancy,
      weakStream,
      straining,
      incompleteEmptying,
      postVoidDribble,
      urgency,
      frequency,
      nocturia,
      urgeIncontinence,
      ipssScore,
      bladderDiaryAvailable,
      maleWithLikelyBPH,
      enlargedProstateKnown,
      raisedPSAKnown,
      fallsRiskOrPosturalHypotension,
      cognitiveImpairmentOrHighAnticholinergicBurden,
      narrowAngleGlaucoma,
      severeUncontrolledHypertension,
      onAlphaBlocker,
      onFiveARI,
      onAntimuscarinic,
      onBeta3Agonist,
    }),
    [
      adultPatient,
      visibleHaematuria,
      recurrentUTIs,
      suspectedRetention,
      neurologicalRedFlags,
      suspectedProstateCancer,
      hesitancy,
      weakStream,
      straining,
      incompleteEmptying,
      postVoidDribble,
      urgency,
      frequency,
      nocturia,
      urgeIncontinence,
      ipssScore,
      bladderDiaryAvailable,
      maleWithLikelyBPH,
      enlargedProstateKnown,
      raisedPSAKnown,
      fallsRiskOrPosturalHypotension,
      cognitiveImpairmentOrHighAnticholinergicBurden,
      narrowAngleGlaucoma,
      severeUncontrolledHypertension,
      onAlphaBlocker,
      onFiveARI,
      onAntimuscarinic,
      onBeta3Agonist,
    ]
  )

  const recommendation: LUTSRecommendation | null = showRecommendation
    ? recommendLUTSTreatment(input)
    : null

  const eligible = adultPatient === true

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
            LUTS treatment decision aid
          </h1>
          <p className="text-base text-slate-700 mb-4">
            This tool supports NICE‑aligned decision‑making for identifying lower urinary tract symptom patterns and choosing appropriate medication classes in primary care. It does not replace clinical judgement.
          </p>
          <div className="text-xs text-slate-500 space-y-1">
            <p>• Aligned with: NICE CG97 + local Devon formulary</p>
            <p>• Audience: GPs and nurses</p>
            <p>• Version 1.0 / Last reviewed: {new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</p>
          </div>
        </div>

        {/* Section A - Eligibility and Red Flags */}
        <section className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm mb-6">
          <h2 className="text-lg font-semibold text-nhs-dark-blue mb-4">Eligibility and red flags</h2>
          <div className="space-y-4">
            <YesNoToggle
              id="adult-patient"
              label="Adult patient?"
              value={adultPatient}
              onChange={(value) => {
                setAdultPatient(value)
                setShowRecommendation(false)
              }}
            />
            <div className="mt-4 pt-4 border-t border-slate-200">
              <h3 className="text-sm font-semibold text-red-700 mb-3">Red flags (require escalation)</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="haematuria"
                    checked={visibleHaematuria}
                    onChange={(e) => {
                      setVisibleHaematuria(e.target.checked)
                      setShowRecommendation(false)
                    }}
                    className="h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                  />
                  <label htmlFor="haematuria" className="text-sm text-slate-700">
                    Visible haematuria
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="retention"
                    checked={suspectedRetention}
                    onChange={(e) => {
                      setSuspectedRetention(e.target.checked)
                      setShowRecommendation(false)
                    }}
                    className="h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                  />
                  <label htmlFor="retention" className="text-sm text-slate-700">
                    Suspected urinary retention
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="neurological"
                    checked={neurologicalRedFlags}
                    onChange={(e) => {
                      setNeurologicalRedFlags(e.target.checked)
                      setShowRecommendation(false)
                    }}
                    className="h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                  />
                  <label htmlFor="neurological" className="text-sm text-slate-700">
                    Neurological red flags
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="prostate-cancer"
                    checked={suspectedProstateCancer}
                    onChange={(e) => {
                      setSuspectedProstateCancer(e.target.checked)
                      setShowRecommendation(false)
                    }}
                    className="h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                  />
                  <label htmlFor="prostate-cancer" className="text-sm text-slate-700">
                    Suspected prostate cancer
                  </label>
                </div>
              </div>
            </div>
          </div>

          {recommendation && recommendation.status === 'not_eligible' && (
            <div className="mt-4 rounded-lg border-l-4 border-red-400 bg-red-50 p-4">
              <p className="text-sm text-red-700">This tool is for adult patients only.</p>
            </div>
          )}

          {recommendation && recommendation.escalation.length > 0 && (
            <div className="mt-4 rounded-lg border-l-4 border-red-400 bg-red-50 p-4">
              <h3 className="text-sm font-semibold text-red-900 mb-2">Escalation required</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-red-700">
                {recommendation.escalation.map((msg, index) => (
                  <li key={index}>{msg}</li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* Sections B-E only shown if eligible */}
        {eligible && (
          <>
            {/* Section B - Symptom Classification */}
            <section className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm mb-6">
              <h2 className="text-lg font-semibold text-nhs-dark-blue mb-4">Symptom classification</h2>
              <p className="text-sm text-slate-600 mb-4">Select all symptoms that apply</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Voiding Symptoms */}
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">Voiding symptoms</h3>
                  <div className="space-y-2">
                    {[
                      { key: 'hesitancy' as const, label: 'Hesitancy', state: hesitancy, setState: setHesitancy },
                      { key: 'weakStream' as const, label: 'Weak stream', state: weakStream, setState: setWeakStream },
                      { key: 'straining' as const, label: 'Straining', state: straining, setState: setStraining },
                      { key: 'incompleteEmptying' as const, label: 'Incomplete emptying', state: incompleteEmptying, setState: setIncompleteEmptying },
                      { key: 'postVoidDribble' as const, label: 'Post-void dribble', state: postVoidDribble, setState: setPostVoidDribble },
                    ].map((symptom) => (
                      <div key={symptom.key} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={symptom.key}
                          checked={symptom.state}
                          onChange={(e) => {
                            symptom.setState(e.target.checked)
                            setShowRecommendation(false)
                          }}
                          className="h-4 w-4 rounded border-slate-300 text-nhs-blue focus:ring-nhs-blue"
                        />
                        <label htmlFor={symptom.key} className="text-sm text-slate-700">
                          {symptom.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Storage Symptoms */}
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">Storage symptoms</h3>
                  <div className="space-y-2">
                    {[
                      { key: 'urgency' as const, label: 'Urgency', state: urgency, setState: setUrgency },
                      { key: 'frequency' as const, label: 'Frequency', state: frequency, setState: setFrequency },
                      { key: 'nocturia' as const, label: 'Nocturia', state: nocturia, setState: setNocturia },
                      { key: 'urgeIncontinence' as const, label: 'Urge incontinence', state: urgeIncontinence, setState: setUrgeIncontinence },
                    ].map((symptom) => (
                      <div key={symptom.key} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={symptom.key}
                          checked={symptom.state}
                          onChange={(e) => {
                            symptom.setState(e.target.checked)
                            setShowRecommendation(false)
                          }}
                          className="h-4 w-4 rounded border-slate-300 text-nhs-blue focus:ring-nhs-blue"
                        />
                        <label htmlFor={symptom.key} className="text-sm text-slate-700">
                          {symptom.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* Section C - Patient Context */}
            <section className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm mb-6">
              <h2 className="text-lg font-semibold text-nhs-dark-blue mb-4">Patient context</h2>
              <div className="space-y-4">
                <YesNoToggle
                  id="male-bph"
                  label="Male with likely BPH?"
                  value={maleWithLikelyBPH}
                  onChange={(value) => {
                    setMaleWithLikelyBPH(value)
                    setShowRecommendation(false)
                  }}
                />
                <YesNoToggle
                  id="enlarged-prostate"
                  label="Enlarged prostate known?"
                  value={enlargedProstateKnown}
                  onChange={(value) => {
                    setEnlargedProstateKnown(value)
                    setShowRecommendation(false)
                  }}
                />
                <YesNoToggle
                  id="raised-psa"
                  label="Raised PSA known?"
                  value={raisedPSAKnown}
                  onChange={(value) => {
                    setRaisedPSAKnown(value)
                    setShowRecommendation(false)
                  }}
                />
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    IPSS score (optional)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="35"
                    value={ipssScore ?? ''}
                    onChange={(e) => {
                      setIpssScore(e.target.value ? Number(e.target.value) : null)
                      setShowRecommendation(false)
                    }}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-nhs-blue"
                    placeholder="0-35"
                  />
                </div>
                <YesNoToggle
                  id="bladder-diary"
                  label="Bladder diary available?"
                  value={bladderDiaryAvailable}
                  onChange={(value) => {
                    setBladderDiaryAvailable(value)
                    setShowRecommendation(false)
                  }}
                />
              </div>
            </section>

            {/* Section D - Contraindications */}
            <section className="mb-6">
              <h2 className="text-lg font-semibold text-nhs-dark-blue mb-4">Contraindications and cautions</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
                  <h3 className="text-sm font-semibold text-nhs-dark-blue mb-3">Safety considerations</h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="falls-risk"
                        checked={fallsRiskOrPosturalHypotension}
                        onChange={(e) => {
                          setFallsRiskOrPosturalHypotension(e.target.checked)
                          setShowRecommendation(false)
                        }}
                        className="h-4 w-4 rounded border-slate-300 text-nhs-blue focus:ring-nhs-blue"
                      />
                      <label htmlFor="falls-risk" className="text-xs text-slate-700">
                        Falls risk or postural hypotension
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="cognitive"
                        checked={cognitiveImpairmentOrHighAnticholinergicBurden}
                        onChange={(e) => {
                          setCognitiveImpairmentOrHighAnticholinergicBurden(e.target.checked)
                          setShowRecommendation(false)
                        }}
                        className="h-4 w-4 rounded border-slate-300 text-nhs-blue focus:ring-nhs-blue"
                      />
                      <label htmlFor="cognitive" className="text-xs text-slate-700">
                        Cognitive impairment or high anticholinergic burden
                      </label>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
                  <h3 className="text-sm font-semibold text-nhs-dark-blue mb-3">Medical conditions</h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="glaucoma"
                        checked={narrowAngleGlaucoma}
                        onChange={(e) => {
                          setNarrowAngleGlaucoma(e.target.checked)
                          setShowRecommendation(false)
                        }}
                        className="h-4 w-4 rounded border-slate-300 text-nhs-blue focus:ring-nhs-blue"
                      />
                      <label htmlFor="glaucoma" className="text-xs text-slate-700">
                        Narrow angle glaucoma
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="hypertension"
                        checked={severeUncontrolledHypertension}
                        onChange={(e) => {
                          setSevereUncontrolledHypertension(e.target.checked)
                          setShowRecommendation(false)
                        }}
                        className="h-4 w-4 rounded border-slate-300 text-nhs-blue focus:ring-nhs-blue"
                      />
                      <label htmlFor="hypertension" className="text-xs text-slate-700">
                        Severe uncontrolled hypertension
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Section E - Current Medications */}
            <section className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm mb-6">
              <h2 className="text-lg font-semibold text-nhs-dark-blue mb-4">Current LUTS medications</h2>
              <p className="text-sm text-slate-600 mb-4">Select all that apply</p>
              <div className="space-y-3">
                {[
                  { key: 'alphaBlocker' as const, label: 'Alpha-blocker', state: onAlphaBlocker, setState: setOnAlphaBlocker },
                  { key: 'fiveARI' as const, label: '5-alpha reductase inhibitor', state: onFiveARI, setState: setOnFiveARI },
                  { key: 'antimuscarinic' as const, label: 'Antimuscarinic', state: onAntimuscarinic, setState: setOnAntimuscarinic },
                  { key: 'beta3Agonist' as const, label: 'Beta-3 agonist', state: onBeta3Agonist, setState: setOnBeta3Agonist },
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

            {/* Section F - Recommendation Output */}
            {recommendation && recommendation.status === 'ok' && (
              <section className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm mb-6">
                <h2 className="text-lg font-semibold text-nhs-dark-blue mb-4">Recommendation</h2>

                {/* Symptom Type Classification */}
                <div className="mb-4 pb-4 border-b border-slate-200">
                  <h3 className="text-base font-semibold text-slate-700 mb-2">Identified symptom pattern</h3>
                  <div className="inline-block rounded-lg bg-nhs-light-blue px-4 py-2">
                    <span className="text-lg font-bold text-nhs-dark-blue">
                      {recommendation.symptomType.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                {/* Primary Recommendation */}
                <div className="mb-4">
                  <h3 className="text-base font-semibold text-slate-700 mb-2">Suggested medication class</h3>
                  <div className="inline-block rounded-lg bg-nhs-light-blue px-4 py-2">
                    <span className="text-lg font-bold text-nhs-dark-blue">{recommendation.primary.drugClass.replace(/_/g, ' ')}</span>
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
                          <strong className="text-slate-700">{alt.drugClass.replace(/_/g, ' ')}</strong>
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

                {recommendation.escalation.length > 0 && (
                  <div className="mb-4 rounded-lg border-l-4 border-amber-400 bg-amber-50 p-4">
                    <h3 className="text-sm font-semibold text-amber-900 mb-2">Escalation considerations</h3>
                    <ul className="list-disc list-inside space-y-1 text-sm text-amber-700">
                      {recommendation.escalation.map((msg, index) => (
                        <li key={index}>{msg}</li>
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

            {/* Section G - Learning Link Panel */}
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
