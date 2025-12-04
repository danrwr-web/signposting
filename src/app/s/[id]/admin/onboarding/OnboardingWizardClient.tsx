'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import SimpleHeader from '@/components/SimpleHeader'
import { SessionUser } from '@/lib/rbac'
import { SurgeryOnboardingProfileJson } from '@/lib/api-contracts'

interface OnboardingWizardClientProps {
  surgeryId: string
  surgeryName: string
  user: SessionUser
}

const STEPS = [
  { id: 1, label: 'Practice Overview' },
  { id: 2, label: 'Appointment Types' },
  { id: 2.5, label: 'Appointment Types & Naming' },
  { id: 3, label: 'Team Structure' },
  { id: 4, label: 'Safety & Escalation' },
  { id: 5, label: 'Local Services' },
  { id: 6, label: 'Communication Preferences' },
  { id: 7, label: 'Final Settings' },
]

const CLINICIAN_ROLES = [
  'GP',
  'Duty GP',
  'ANP / Nurse Practitioner',
  'First Contact Physiotherapist',
  'Pharmacist',
  'Other',
]

const APPOINTMENT_ARCHETYPES = [
  {
    key: 'routineContinuityGp' as const,
    heading: 'Routine continuity GP',
    intro: 'For non-urgent problems where it\'s best for the patient to see their usual GP or a regular GP in the team.',
    placeholder: 'e.g. Green Slot – continuity GP',
    descriptionPlaceholder: 'e.g. Used for stable or long-term problems where continuity is helpful but not urgent.',
  },
  {
    key: 'routineGpPhone' as const,
    heading: 'Routine GP telephone',
    intro: 'For non-urgent problems that can be safely managed over the phone, without needing an examination.',
    placeholder: 'e.g. Routine GP phone appointment',
    descriptionPlaceholder: 'e.g. Used for follow-up discussions, simple results, or medication queries that don\'t need a face-to-face review.',
  },
  {
    key: 'gpTriage48h' as const,
    heading: 'GP triage within 48 hours',
    intro: 'For problems that need GP input within the next 1–2 days, but are not same-day emergencies.',
    placeholder: 'e.g. Pink/Purple – GP triage (within 48 hours)',
    descriptionPlaceholder: 'e.g. Used when a GP needs to assess symptoms within 48 hours to decide on face-to-face review or self-care.',
  },
  {
    key: 'urgentSameDayPhone' as const,
    heading: 'Urgent same-day telephone (Duty GP)',
    intro: 'For urgent or safety-critical problems where a GP needs to speak to the patient the same day.',
    placeholder: 'e.g. Duty GP telephone today',
    descriptionPlaceholder: 'e.g. Used for acute issues with red-flag symptoms where the Duty GP must assess the patient today.',
  },
  {
    key: 'urgentSameDayF2F' as const,
    heading: 'Urgent same-day face-to-face',
    intro: 'For patients who clearly need to be examined in person on the same day, usually after GP triage.',
    placeholder: 'e.g. Urgent F2F – today',
    descriptionPlaceholder: 'e.g. Used when the GP believes the patient needs to be seen in person urgently (e.g. acute abdominal pain).',
  },
  {
    key: 'otherClinicianDirect' as const,
    heading: 'Direct booking with another clinician',
    intro: 'For problems that can go straight to another clinician, without needing a GP first.',
    placeholder: 'e.g. FCP MSK clinic, Minor illness ANP, Pharmacist meds review',
    descriptionPlaceholder: 'e.g. Used when the patient can be booked directly with FCP, ANP, or pharmacist according to local pathways.',
  },
]

const BOOKING_OPTIONS = [
  'Routine GP',
  'Same-day GP',
  'Nurse Practitioner / Minor Illness',
  'Practice Nurse',
  'HCA',
  'Dressings',
  'Pill Checks / Contraception',
  'Blood Tests',
  'ECG',
  'Asthma Reviews',
  'BP Reviews',
  'Smears',
  'Childhood Immunisations',
]

const TEAM_ROLES = [
  'GP partners',
  'Salaried GPs',
  'ANPs / Nurse Practitioners',
  'Practice Nurses',
  'HCAs',
  'First Contact Physiotherapist (FCP)',
  'Pharmacist',
  'Pharmacy Technician',
  'Mental Health Practitioner',
  'Social Prescriber',
  'Frailty Team',
]

const ESCALATION_OPTIONS = [
  'Duty Doctor',
  'Shift GP',
  'Nurse Practitioner',
  'Other…',
]

const getDefaultProfile = (): SurgeryOnboardingProfileJson => ({
  surgeryName: null,
  urgentCareModel: {
    hasDutyDoctor: false,
    dutyDoctorTerm: null,
    usesRedSlots: false,
    redSlotName: null,
    urgentSlotsDescription: '',
  },
  bookingRules: {
    canBookDirectly: [],
    mustNotBookDirectly: '',
  },
  team: {
    roles: [],
    roleRoutingNotes: '',
  },
  escalation: {
    firstEscalation: null,
    urgentWording: '',
  },
  localServices: {
    msk: '',
    mentalHealth: '',
    socialPrescribing: '',
    communityNursing: '',
    audiology: '',
    frailty: '',
    sexualHealth: '',
    outOfHours: '',
    includeInInstructions: 'no',
  },
  communicationStyle: {
    detailLevel: 'moderate',
    terminologyPreference: 'mixed',
  },
  aiSettings: {
    customisationScope: 'core',
    requireClinicalReview: true,
  },
  appointmentModel: {
    routineContinuityGp: { enabled: false, localName: '', clinicianRole: '', description: '' },
    routineGpPhone: { enabled: false, localName: '', clinicianRole: '', description: '' },
    gpTriage48h: { enabled: false, localName: '', clinicianRole: '', description: '' },
    urgentSameDayPhone: { enabled: false, localName: '', clinicianRole: '', description: '' },
    urgentSameDayF2F: { enabled: false, localName: '', clinicianRole: '', description: '' },
    otherClinicianDirect: { enabled: false, localName: '', clinicianRole: '', description: '' },
  },
})

export default function OnboardingWizardClient({ surgeryId, surgeryName, user }: OnboardingWizardClientProps) {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [profile, setProfile] = useState<SurgeryOnboardingProfileJson>(getDefaultProfile())
  const [completed, setCompleted] = useState(false)
  const [completedAt, setCompletedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [otherRole, setOtherRole] = useState('')
  const [otherEscalation, setOtherEscalation] = useState('')

  useEffect(() => {
    fetchProfile()
  }, [surgeryId])

  const fetchProfile = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/surgeries/${surgeryId}/onboarding`)
      if (!response.ok) {
        throw new Error('Failed to fetch profile')
      }
      const data = await response.json()
      setProfile(data.profileJson)
      setCompleted(data.completed)
      setCompletedAt(data.completedAt)
      
      // Extract "Other" role if present
      const otherRoleValue = data.profileJson.team.roles.find((r: string) => !TEAM_ROLES.includes(r))
      if (otherRoleValue) {
        setOtherRole(otherRoleValue)
      }
      
      // Extract "Other" escalation if present
      const escalationValue = data.profileJson.escalation.firstEscalation
      if (escalationValue && !ESCALATION_OPTIONS.slice(0, -1).includes(escalationValue)) {
        setOtherEscalation(escalationValue)
        // Temporarily set firstEscalation to "Other…" for dropdown display
        data.profileJson.escalation.firstEscalation = 'Other…'
      }
    } catch (error) {
      console.error('Error fetching profile:', error)
      toast.error('Failed to load onboarding profile')
    } finally {
      setLoading(false)
    }
  }

  const saveProfile = async (markCompleted = false) => {
    try {
      setSaving(true)
      
      // Prepare profile with "Other" values
      const profileToSave = { ...profile }
      
      // Handle "Other" role
      const rolesWithoutOther = profileToSave.team.roles.filter((r: string) => r !== otherRole && TEAM_ROLES.includes(r))
      if (otherRole.trim()) {
        profileToSave.team.roles = [...rolesWithoutOther, otherRole.trim()]
      } else {
        profileToSave.team.roles = rolesWithoutOther
      }
      
      // Handle "Other" escalation
      if (profileToSave.escalation.firstEscalation === 'Other…' || otherEscalation.trim()) {
        profileToSave.escalation.firstEscalation = otherEscalation.trim() || null
      }

      const response = await fetch(`/api/surgeries/${surgeryId}/onboarding`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileJson: profileToSave,
          completed: markCompleted ? true : completed,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to save profile')
      }

      const data = await response.json()
      setCompleted(data.completed)
      setCompletedAt(data.completedAt)
      toast.success(markCompleted ? 'Onboarding completed!' : 'Saved')
    } catch (error) {
      console.error('Error saving profile:', error)
      toast.error('Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  const handleNext = () => {
    const currentIndex = STEPS.findIndex(s => s.id === currentStep)
    if (currentIndex < STEPS.length - 1) {
      saveProfile()
      const nextStep = STEPS[currentIndex + 1].id
      setCurrentStep(nextStep)
    }
  }

  const handleBack = () => {
    const currentIndex = STEPS.findIndex(s => s.id === currentStep)
    if (currentIndex > 0) {
      saveProfile()
      const prevStep = STEPS[currentIndex - 1].id
      setCurrentStep(prevStep)
    }
  }

  const handleFinish = async () => {
    await saveProfile(true)
    router.push(`/s/${surgeryId}`)
  }

  const updateProfile = (updates: Partial<SurgeryOnboardingProfileJson>) => {
    setProfile((prev) => ({ ...prev, ...updates }))
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-nhs-light-grey">
        <SimpleHeader surgeries={[]} currentSurgeryId={surgeryId} />
        <main className="max-w-4xl mx-auto px-4 py-8">
          <div className="text-center">Loading...</div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-nhs-light-grey">
      <SimpleHeader surgeries={[]} currentSurgeryId={surgeryId} />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-3xl font-bold text-nhs-dark-blue mb-2">
            Surgery Onboarding Questionnaire
          </h1>
          <p className="text-nhs-grey mb-4">
            Tell us how your surgery operates so we can tailor instructions for your team.
          </p>
          {completed && completedAt && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-green-800">
                ✓ Onboarding completed on {new Date(completedAt).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            </div>
          )}
          {!completed && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-yellow-800">
                Onboarding not completed yet
              </p>
            </div>
          )}
        </div>

        {/* Step Indicator */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                      currentStep === step.id
                        ? 'bg-nhs-blue text-white'
                        : currentStep > step.id
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {currentStep > step.id ? '✓' : (typeof step.id === 'number' && step.id % 1 !== 0 ? '2b' : step.id)}
                  </div>
                  <span className={`text-xs mt-2 text-center ${currentStep === step.id ? 'font-semibold text-nhs-blue' : 'text-gray-600'}`}>
                    {step.label}
                  </span>
                </div>
                {index < STEPS.length - 1 && (
                  <div className={`flex-1 h-1 mx-2 ${currentStep > step.id ? 'bg-green-500' : 'bg-gray-200'}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="bg-white rounded-lg shadow-md p-8 mb-6">
          {/* Step 1: Practice Overview */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold text-nhs-dark-blue mb-4">Practice Overview</h2>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  What is your surgery called?
                </label>
                <input
                  type="text"
                  value={profile.surgeryName || ''}
                  onChange={(e) => updateProfile({ surgeryName: e.target.value || null })}
                  placeholder="e.g. Ide Lane Surgery"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nhs-blue focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Do you have a Duty Doctor model for urgent same-day issues?
                </label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="hasDutyDoctor"
                      checked={profile.urgentCareModel.hasDutyDoctor === true}
                      onChange={() => updateProfile({
                        urgentCareModel: { ...profile.urgentCareModel, hasDutyDoctor: true }
                      })}
                      className="mr-2"
                    />
                    Yes
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="hasDutyDoctor"
                      checked={profile.urgentCareModel.hasDutyDoctor === false}
                      onChange={() => updateProfile({
                        urgentCareModel: { ...profile.urgentCareModel, hasDutyDoctor: false }
                      })}
                      className="mr-2"
                    />
                    No
                  </label>
                </div>
              </div>

              {profile.urgentCareModel.hasDutyDoctor && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    What terminology do you use?
                  </label>
                  <input
                    type="text"
                    value={profile.urgentCareModel.dutyDoctorTerm || ''}
                    onChange={(e) => updateProfile({
                      urgentCareModel: { ...profile.urgentCareModel, dutyDoctorTerm: e.target.value || null }
                    })}
                    placeholder="e.g. Duty Doctor, On-Call GP, Urgent Care GP"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nhs-blue focus:border-transparent"
                  />
                </div>
              )}
            </div>
          )}

          {/* Step 2: Appointment Types */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold text-nhs-dark-blue mb-4">Appointment Types & Booking Rules</h2>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Which appointments can reception book directly?
                </label>
                <div className="space-y-2 max-h-96 overflow-y-auto border border-gray-200 rounded-lg p-4">
                  {BOOKING_OPTIONS.map((option) => (
                    <label key={option} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={profile.bookingRules.canBookDirectly.includes(option)}
                        onChange={(e) => {
                          const current = profile.bookingRules.canBookDirectly
                          const updated = e.target.checked
                            ? [...current, option]
                            : current.filter((item) => item !== option)
                          updateProfile({
                            bookingRules: { ...profile.bookingRules, canBookDirectly: updated }
                          })
                        }}
                        className="mr-2"
                      />
                      {option}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Are there any appointment types reception must NOT book directly?
                </label>
                <textarea
                  value={profile.bookingRules.mustNotBookDirectly}
                  onChange={(e) => updateProfile({
                    bookingRules: { ...profile.bookingRules, mustNotBookDirectly: e.target.value }
                  })}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nhs-blue focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Do you have any named appointment types reserved for urgent or same-day problems?
                </label>
                <p className="text-xs text-gray-500 mb-3">
                  (for example &quot;red slots&quot;, &quot;orange slots&quot;, &quot;duty GP slots&quot;)
                </p>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="usesRedSlots"
                      checked={profile.urgentCareModel.usesRedSlots === true}
                      onChange={() => updateProfile({
                        urgentCareModel: { ...profile.urgentCareModel, usesRedSlots: true }
                      })}
                      className="mr-2"
                    />
                    Yes
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="usesRedSlots"
                      checked={profile.urgentCareModel.usesRedSlots === false}
                      onChange={() => updateProfile({
                        urgentCareModel: { ...profile.urgentCareModel, usesRedSlots: false }
                      })}
                      className="mr-2"
                    />
                    No
                  </label>
                </div>
              </div>

              {profile.urgentCareModel.usesRedSlots && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Briefly describe how your urgent appointment types are used.
                  </label>
                  <p className="text-xs text-gray-500 mb-2">
                    Include each slot type, who can book it, and how they&apos;re used in practice (for example which are triage vs booked F2F, or which are used first).
                  </p>
                  <textarea
                    value={profile.urgentCareModel.urgentSlotsDescription || ''}
                    onChange={(e) => updateProfile({
                      urgentCareModel: { ...profile.urgentCareModel, urgentSlotsDescription: e.target.value }
                    })}
                    placeholder="e.g. We have orange and red GP slots. Orange are used for urgent F2F after triage. Red are used as triage slots or if there are no orange slots left."
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nhs-blue focus:border-transparent"
                  />
                </div>
              )}
            </div>
          )}

          {/* Step 2.5: Appointment Types & Naming */}
          {currentStep === 2.5 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold text-nhs-dark-blue mb-4">Appointment types & naming</h2>
              <p className="text-sm text-gray-600 mb-6">
                Define how your appointment types map to common archetypes. This helps the AI customise instructions with your surgery&apos;s terminology.
              </p>

              {APPOINTMENT_ARCHETYPES.map((archetype) => {
                const config = profile.appointmentModel[archetype.key]
                return (
                  <div key={archetype.key} className="border border-gray-200 rounded-lg p-6 space-y-4">
                    <div>
                      <h3 className="text-lg font-semibold text-nhs-dark-blue mb-2">{archetype.heading}</h3>
                      <p className="text-sm text-gray-600">{archetype.intro}</p>
                    </div>

                    <div className="flex items-center">
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={config.enabled}
                          onChange={(e) => {
                            updateProfile({
                              appointmentModel: {
                                ...profile.appointmentModel,
                                [archetype.key]: {
                                  ...config,
                                  enabled: e.target.checked,
                                },
                              },
                            })
                          }}
                          className="mr-2"
                        />
                        <span className="text-sm font-medium text-gray-700">
                          Use this appointment type at your surgery?
                        </span>
                      </label>
                    </div>

                    {config.enabled && (
                      <div className="space-y-4 pl-6 border-l-2 border-nhs-blue">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Local name shown to staff
                          </label>
                          <p className="text-xs text-gray-500 mb-2">
                            This is the wording your reception team sees in the appointment book.
                          </p>
                          <input
                            type="text"
                            value={config.localName}
                            onChange={(e) => {
                              updateProfile({
                                appointmentModel: {
                                  ...profile.appointmentModel,
                                  [archetype.key]: {
                                    ...config,
                                    localName: e.target.value,
                                  },
                                },
                              })
                            }}
                            placeholder={archetype.placeholder}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nhs-blue focus:border-transparent"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Who usually sees the patient?
                          </label>
                          <select
                            value={config.clinicianRole}
                            onChange={(e) => {
                              updateProfile({
                                appointmentModel: {
                                  ...profile.appointmentModel,
                                  [archetype.key]: {
                                    ...config,
                                    clinicianRole: e.target.value,
                                  },
                                },
                              })
                            }}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nhs-blue focus:border-transparent"
                          >
                            <option value="">Select...</option>
                            {CLINICIAN_ROLES.map((role) => (
                              <option key={role} value={role}>
                                {role}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            One sentence description for the AI
                          </label>
                          <p className="text-xs text-gray-500 mb-2">
                            Explain when this appointment type is normally used.
                          </p>
                          <textarea
                            value={config.description}
                            onChange={(e) => {
                              updateProfile({
                                appointmentModel: {
                                  ...profile.appointmentModel,
                                  [archetype.key]: {
                                    ...config,
                                    description: e.target.value,
                                  },
                                },
                              })
                            }}
                            placeholder={archetype.descriptionPlaceholder}
                            rows={3}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nhs-blue focus:border-transparent"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Step 3: Team Structure */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold text-nhs-dark-blue mb-4">Clinical Team Structure</h2>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Which clinicians do you have on site?
                </label>
                <div className="space-y-2 max-h-96 overflow-y-auto border border-gray-200 rounded-lg p-4">
                  {TEAM_ROLES.map((role) => (
                    <label key={role} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={profile.team.roles.includes(role)}
                        onChange={(e) => {
                          const current = profile.team.roles.filter((r) => TEAM_ROLES.includes(r))
                          const updated = e.target.checked
                            ? [...current, role]
                            : current.filter((r) => r !== role)
                          updateProfile({
                            team: { ...profile.team, roles: updated }
                          })
                        }}
                        className="mr-2"
                      />
                      {role}
                    </label>
                  ))}
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={otherRole.trim() !== ''}
                      onChange={(e) => {
                        if (!e.target.checked) {
                          setOtherRole('')
                        }
                      }}
                      className="mr-2"
                    />
                    Other
                  </label>
                  {otherRole.trim() !== '' && (
                    <input
                      type="text"
                      value={otherRole}
                      onChange={(e) => setOtherRole(e.target.value)}
                      placeholder="Specify other role"
                      className="ml-6 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nhs-blue focus:border-transparent"
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Are certain symptoms or tasks usually handled by specific roles?
                </label>
                <textarea
                  value={profile.team.roleRoutingNotes}
                  onChange={(e) => updateProfile({
                    team: { ...profile.team, roleRoutingNotes: e.target.value }
                  })}
                  placeholder="e.g. Back pain → FCP, Medication queries → Pharmacist"
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nhs-blue focus:border-transparent"
                />
              </div>
            </div>
          )}

          {/* Step 4: Safety & Escalation */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold text-nhs-dark-blue mb-4">Safety & Escalation</h2>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  When a receptionist is worried about a patient, who should they escalate to FIRST?
                </label>
                <select
                  value={profile.escalation.firstEscalation === otherEscalation ? 'Other…' : (profile.escalation.firstEscalation || '')}
                  onChange={(e) => {
                    if (e.target.value === 'Other…') {
                      updateProfile({ escalation: { ...profile.escalation, firstEscalation: 'Other…' } })
                    } else {
                      updateProfile({ escalation: { ...profile.escalation, firstEscalation: e.target.value || null } })
                      setOtherEscalation('')
                    }
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nhs-blue focus:border-transparent"
                >
                  <option value="">Select...</option>
                  {ESCALATION_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                {(profile.escalation.firstEscalation === 'Other…' || otherEscalation.trim() !== '') && (
                  <input
                    type="text"
                    value={otherEscalation}
                    onChange={(e) => setOtherEscalation(e.target.value)}
                    placeholder="Specify other escalation point"
                    className="mt-2 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nhs-blue focus:border-transparent"
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Do you have specific internal wording for urgent symptoms?
                </label>
                <textarea
                  value={profile.escalation.urgentWording}
                  onChange={(e) => updateProfile({
                    escalation: { ...profile.escalation, urgentWording: e.target.value }
                  })}
                  placeholder="e.g. Always pass to Duty Doctor immediately"
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nhs-blue focus:border-transparent"
                />
              </div>
            </div>
          )}

          {/* Step 5: Local Services */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold text-nhs-dark-blue mb-4">Local Services</h2>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-blue-800">
                  Please describe the main service you use and how staff should signpost or refer patients. For each box, include: the service name, whether it&apos;s GP referral or self-referral, and what reception should tell the patient (e.g. give number, website, or book an appointment).
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    MSK / physiotherapy
                  </label>
                  <input
                    type="text"
                    value={profile.localServices.msk}
                    onChange={(e) => updateProfile({
                      localServices: { ...profile.localServices, msk: e.target.value }
                    })}
                    placeholder="e.g. Local Physio Service – FCP if booked by us; or self-referral via website"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nhs-blue focus:border-transparent placeholder:text-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Mental health
                  </label>
                  <input
                    type="text"
                    value={profile.localServices.mentalHealth}
                    onChange={(e) => updateProfile({
                      localServices: { ...profile.localServices, mentalHealth: e.target.value }
                    })}
                    placeholder="e.g. Talkworks – self-referral, give website and phone number"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nhs-blue focus:border-transparent placeholder:text-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Social prescribing
                  </label>
                  <input
                    type="text"
                    value={profile.localServices.socialPrescribing}
                    onChange={(e) => updateProfile({
                      localServices: { ...profile.localServices, socialPrescribing: e.target.value }
                    })}
                    placeholder="e.g. In-house social prescriber – reception can book directly into clinic"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nhs-blue focus:border-transparent placeholder:text-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Community nursing / wound care
                  </label>
                  <input
                    type="text"
                    value={profile.localServices.communityNursing}
                    onChange={(e) => updateProfile({
                      localServices: { ...profile.localServices, communityNursing: e.target.value }
                    })}
                    placeholder="e.g. Community nurse team – GP or nurse to refer; reception cannot book directly"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nhs-blue focus:border-transparent placeholder:text-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Audiology
                  </label>
                  <input
                    type="text"
                    value={profile.localServices.audiology}
                    onChange={(e) => updateProfile({
                      localServices: { ...profile.localServices, audiology: e.target.value }
                    })}
                    placeholder="e.g. Local audiology service – GP referral only"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nhs-blue focus:border-transparent placeholder:text-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Frailty / falls
                  </label>
                  <input
                    type="text"
                    value={profile.localServices.frailty}
                    onChange={(e) => updateProfile({
                      localServices: { ...profile.localServices, frailty: e.target.value }
                    })}
                    placeholder="e.g. Community frailty team – refer via [system]"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nhs-blue focus:border-transparent placeholder:text-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sexual health
                  </label>
                  <input
                    type="text"
                    value={profile.localServices.sexualHealth}
                    onChange={(e) => updateProfile({
                      localServices: { ...profile.localServices, sexualHealth: e.target.value }
                    })}
                    placeholder="e.g. Local GUM clinic – self-referral, give website/phone number"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nhs-blue focus:border-transparent placeholder:text-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Out-of-hours service
                  </label>
                  <input
                    type="text"
                    value={profile.localServices.outOfHours}
                    onChange={(e) => updateProfile({
                      localServices: { ...profile.localServices, outOfHours: e.target.value }
                    })}
                    placeholder="e.g. NHS 111 / OOH GP – advise patients to call 111"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nhs-blue focus:border-transparent placeholder:text-gray-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Include local pathway details directly in instructions?
                </label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="includeInInstructions"
                      checked={profile.localServices.includeInInstructions === 'yes'}
                      onChange={() => updateProfile({
                        localServices: { ...profile.localServices, includeInInstructions: 'yes' }
                      })}
                      className="mr-2"
                    />
                    Yes
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="includeInInstructions"
                      checked={profile.localServices.includeInInstructions === 'brief'}
                      onChange={() => updateProfile({
                        localServices: { ...profile.localServices, includeInInstructions: 'brief' }
                      })}
                      className="mr-2"
                    />
                    Yes, but keep wording brief
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="includeInInstructions"
                      checked={profile.localServices.includeInInstructions === 'no'}
                      onChange={() => updateProfile({
                        localServices: { ...profile.localServices, includeInInstructions: 'no' }
                      })}
                      className="mr-2"
                    />
                    No
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Step 6: Communication Preferences */}
          {currentStep === 6 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold text-nhs-dark-blue mb-4">Communication Preferences</h2>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Should instructions be brief or detailed?
                </label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="detailLevel"
                      checked={profile.communicationStyle.detailLevel === 'brief'}
                      onChange={() => updateProfile({
                        communicationStyle: { ...profile.communicationStyle, detailLevel: 'brief' }
                      })}
                      className="mr-2"
                    />
                    Brief and concise
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="detailLevel"
                      checked={profile.communicationStyle.detailLevel === 'moderate'}
                      onChange={() => updateProfile({
                        communicationStyle: { ...profile.communicationStyle, detailLevel: 'moderate' }
                      })}
                      className="mr-2"
                    />
                    Moderate detail
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="detailLevel"
                      checked={profile.communicationStyle.detailLevel === 'detailed'}
                      onChange={() => updateProfile({
                        communicationStyle: { ...profile.communicationStyle, detailLevel: 'detailed' }
                      })}
                      className="mr-2"
                    />
                    Detailed explanations
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Should instructions use your surgery&apos;s terminology or more generic NHS wording?
                </label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="terminologyPreference"
                      checked={profile.communicationStyle.terminologyPreference === 'surgery'}
                      onChange={() => updateProfile({
                        communicationStyle: { ...profile.communicationStyle, terminologyPreference: 'surgery' }
                      })}
                      className="mr-2"
                    />
                    Use our surgery terms
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="terminologyPreference"
                      checked={profile.communicationStyle.terminologyPreference === 'generic'}
                      onChange={() => updateProfile({
                        communicationStyle: { ...profile.communicationStyle, terminologyPreference: 'generic' }
                      })}
                      className="mr-2"
                    />
                    Use generic terms
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="terminologyPreference"
                      checked={profile.communicationStyle.terminologyPreference === 'mixed'}
                      onChange={() => updateProfile({
                        communicationStyle: { ...profile.communicationStyle, terminologyPreference: 'mixed' }
                      })}
                      className="mr-2"
                    />
                    A mix of both
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Step 7: Final Settings */}
          {currentStep === 7 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold text-nhs-dark-blue mb-4">Final Settings</h2>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  How much should be customised now?
                </label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="customisationScope"
                      checked={profile.aiSettings.customisationScope === 'all'}
                      onChange={() => updateProfile({
                        aiSettings: { ...profile.aiSettings, customisationScope: 'all' }
                      })}
                      className="mr-2"
                    />
                    Customise ALL symptoms
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="customisationScope"
                      checked={profile.aiSettings.customisationScope === 'core'}
                      onChange={() => updateProfile({
                        aiSettings: { ...profile.aiSettings, customisationScope: 'core' }
                      })}
                      className="mr-2"
                    />
                    Customise core set only (recommended)
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="customisationScope"
                      checked={profile.aiSettings.customisationScope === 'manual'}
                      onChange={() => updateProfile({
                        aiSettings: { ...profile.aiSettings, customisationScope: 'manual' }
                      })}
                      className="mr-2"
                    />
                    I will select symptoms manually
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Should all AI-generated instructions be automatically set to PENDING for clinical review?
                </label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="requireClinicalReview"
                      checked={profile.aiSettings.requireClinicalReview === true}
                      onChange={() => updateProfile({
                        aiSettings: { ...profile.aiSettings, requireClinicalReview: true }
                      })}
                      className="mr-2"
                    />
                    Yes (recommended)
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="requireClinicalReview"
                      checked={profile.aiSettings.requireClinicalReview === false}
                      onChange={() => updateProfile({
                        aiSettings: { ...profile.aiSettings, requireClinicalReview: false }
                      })}
                      className="mr-2"
                    />
                    No
                  </label>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  These settings will be used to tailor instructions for your surgery. You can change them later.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="bg-white rounded-lg shadow-md p-6 flex items-center justify-between">
          <button
            onClick={handleBack}
            disabled={currentStep === 1}
            className={`px-6 py-2 rounded-lg font-medium ${
              currentStep === 1
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Back
          </button>
          
          <div className="flex items-center gap-4">
            {saving && (
              <span className="text-sm text-gray-600">Saving...</span>
            )}
            {!saving && completed && (
              <span className="text-sm text-green-600">Saved</span>
            )}
          </div>

          {currentStep < STEPS.length ? (
            <button
              onClick={handleNext}
              className="px-6 py-2 bg-nhs-blue text-white rounded-lg font-medium hover:bg-nhs-dark-blue"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleFinish}
              disabled={saving}
              className="px-6 py-2 bg-nhs-blue text-white rounded-lg font-medium hover:bg-nhs-dark-blue disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Finish & Save'}
            </button>
          )}
        </div>
      </main>
    </div>
  )
}

