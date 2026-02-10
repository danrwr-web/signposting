/**
 * Decision logic for LUTS treatment decision aid
 * Aligned with NICE CG97 + local Devon formulary
 * 
 * Deterministic decision engine for identifying LUTS symptom patterns
 * and choosing appropriate medication classes in primary care.
 */

import type { LUTSDrugClass, LocalLUTSFormularyConfig } from './lutsFormulary.config'
import { defaultLUTSFormularyConfig as defaultConfig, getPreferredAgent as getPreferred } from './lutsFormulary.config'

export type { LUTSDrugClass }

export type LUTSSymptomType =
  | 'Voiding_predominant'
  | 'Storage_predominant'
  | 'Mixed'
  | 'Unclear'

export interface LUTSInput {
  // Eligibility
  adultPatient: boolean

  // Red flags
  visibleHaematuria: boolean
  recurrentUTIs: boolean
  suspectedRetention: boolean
  neurologicalRedFlags: boolean
  suspectedProstateCancer: boolean

  // Symptom questions – voiding
  hesitancy: boolean
  weakStream: boolean
  straining: boolean
  incompleteEmptying: boolean
  postVoidDribble: boolean

  // Symptom questions – storage
  urgency: boolean
  frequency: boolean
  nocturia: boolean
  urgeIncontinence: boolean

  // Symptom severity tools
  ipssScore: number | null
  bladderDiaryAvailable: boolean | null

  // Patient context
  maleWithLikelyBPH: boolean | null
  enlargedProstateKnown: boolean | null
  raisedPSAKnown: boolean | null

  // Contraindications / cautions
  fallsRiskOrPosturalHypotension: boolean
  cognitiveImpairmentOrHighAnticholinergicBurden: boolean
  narrowAngleGlaucoma: boolean
  severeUncontrolledHypertension: boolean

  // Current LUTS meds
  onAlphaBlocker: boolean
  onFiveARI: boolean
  onAntimuscarinic: boolean
  onBeta3Agonist: boolean
}

export interface LUTSRecommendation {
  status: 'ok' | 'not_eligible'
  symptomType: LUTSSymptomType
  primary: {
    drugClass: LUTSDrugClass
    preferredAgent?: string
    rationaleBullets: string[]
  }
  alternatives: Array<{
    drugClass: LUTSDrugClass
    preferredAgent?: string
    rationaleBullets: string[]
  }>
  checks: string[]
  escalation: string[]
  metadata: {
    logicVersion: string
    basedOn: string[]
  }
}

/**
 * Classify LUTS symptom type based on voiding and storage symptoms
 */
function classifySymptomType(input: LUTSInput): LUTSSymptomType {
  const voidingSymptoms = [
    input.hesitancy,
    input.weakStream,
    input.straining,
    input.incompleteEmptying,
    input.postVoidDribble,
  ].filter(Boolean).length

  const storageSymptoms = [
    input.urgency,
    input.frequency,
    input.nocturia,
    input.urgeIncontinence,
  ].filter(Boolean).length

  if (voidingSymptoms >= 2 && voidingSymptoms > storageSymptoms) {
    return 'Voiding_predominant'
  }

  if (storageSymptoms >= 2 && storageSymptoms > voidingSymptoms) {
    return 'Storage_predominant'
  }

  if (voidingSymptoms >= 2 && storageSymptoms >= 2) {
    return 'Mixed'
  }

  return 'Unclear'
}

/**
 * Calculate recommendation for LUTS treatment
 * Deterministic function - same inputs always produce same output
 */
export function recommendLUTSTreatment(
  input: LUTSInput,
  formularyConfig: LocalLUTSFormularyConfig = defaultConfig
): LUTSRecommendation {
  // Rule 0 - Eligibility and red flags
  if (!input.adultPatient) {
    return {
      status: 'not_eligible',
      symptomType: 'Unclear',
      primary: {
        drugClass: 'Not_eligible',
        rationaleBullets: ['Not an adult patient'],
      },
      alternatives: [],
      checks: [],
      escalation: [],
      metadata: {
        logicVersion: '1.0',
        basedOn: ['NICE CG97'],
      },
    }
  }

  // Check for red flags
  const redFlags: string[] = []
  if (input.visibleHaematuria) {
    redFlags.push('Visible haematuria')
  }
  if (input.suspectedRetention) {
    redFlags.push('Suspected urinary retention')
  }
  if (input.neurologicalRedFlags) {
    redFlags.push('Neurological red flags')
  }
  if (input.suspectedProstateCancer) {
    redFlags.push('Suspected prostate cancer')
  }

  if (redFlags.length > 0) {
    const escalationMessages: string[] = []
    if (input.visibleHaematuria) {
      escalationMessages.push('Visible haematuria requires urgent urological assessment (NICE CG97)')
    }
    if (input.suspectedRetention) {
      escalationMessages.push('Suspected retention requires immediate assessment')
    }
    if (input.neurologicalRedFlags) {
      escalationMessages.push('Neurological red flags require specialist neurological/urological assessment')
    }
    if (input.suspectedProstateCancer) {
      escalationMessages.push('Suspected prostate cancer requires urgent urological referral')
    }

    return {
      status: 'ok',
      symptomType: 'Unclear',
      primary: {
        drugClass: 'Refer_or_escalate',
        rationaleBullets: [`Red flag present: ${redFlags.join(', ')}`],
      },
      alternatives: [],
      checks: [],
      escalation: escalationMessages,
      metadata: {
        logicVersion: '1.0',
        basedOn: ['NICE CG97'],
      },
    }
  }

  // Rule 1 - Classify symptom type
  const symptomType = classifySymptomType(input)

  // Rule 2 - Non-drug optimisation for unclear/mild symptoms
  if (symptomType === 'Unclear' || (input.ipssScore !== null && input.ipssScore <= 7)) {
    const alternatives: Array<{
      drugClass: LUTSDrugClass
      preferredAgent?: string
      rationaleBullets: string[]
    }> = []

    // Suggest medication options as alternatives if symptoms persist
    if (input.maleWithLikelyBPH === true) {
      alternatives.push({
        drugClass: 'Alpha_blocker',
        preferredAgent: getPreferred('Alpha_blocker', formularyConfig),
        rationaleBullets: ['Consider if voiding symptoms persist after lifestyle measures'],
      })
    }

    if ([input.urgency, input.frequency, input.nocturia, input.urgeIncontinence].some(Boolean)) {
      alternatives.push({
        drugClass: 'Antimuscarinic',
        preferredAgent: getPreferred('Antimuscarinic', formularyConfig),
        rationaleBullets: ['Consider if storage symptoms persist after lifestyle measures'],
      })
    }

    return {
      status: 'ok',
      symptomType,
      primary: {
        drugClass: 'Optimise_non_drug_measures',
        rationaleBullets: [
          symptomType === 'Unclear'
            ? 'Symptom pattern unclear - optimise non-drug measures first'
            : 'Mild symptoms (IPSS ≤7) - optimise non-drug measures first',
          'Lifestyle advice: fluid management, caffeine reduction, bladder training',
        ],
      },
      alternatives,
      checks: ['Review in 4-6 weeks', 'Consider bladder diary if not already done'],
      escalation: [],
      metadata: {
        logicVersion: '1.0',
        basedOn: ['NICE CG97'],
      },
    }
  }

  // Rule 3 - Voiding-predominant pathway
  if (symptomType === 'Voiding_predominant' || (symptomType === 'Mixed' && input.maleWithLikelyBPH === true)) {
    if (!input.onAlphaBlocker) {
      const rationaleBullets = [
        'Voiding-predominant symptoms identified',
        'Alpha-blockers are first-line for voiding symptoms (NICE CG97)',
      ]

      const checks: string[] = []
      if (input.fallsRiskOrPosturalHypotension) {
        checks.push('Postural hypotension risk - start low dose, monitor BP')
        checks.push('Advise about falls risk')
      }
      checks.push('Review in 4-6 weeks')
      checks.push('Consider IPSS reassessment')

      const preferredAgent = getPreferred('Alpha_blocker', formularyConfig)
      if (preferredAgent) {
        checks.push(`Check formulary-preferred agent: ${preferredAgent}`)
      }

      const alternatives: Array<{
        drugClass: LUTSDrugClass
        preferredAgent?: string
        rationaleBullets: string[]
      }> = []

      if (input.enlargedProstateKnown === true || input.raisedPSAKnown === true) {
        alternatives.push({
          drugClass: 'Five_alpha_reductase_inhibitor',
          preferredAgent: getPreferred('Five_alpha_reductase_inhibitor', formularyConfig),
          rationaleBullets: ['Consider if prostate enlargement confirmed', 'Takes 3-6 months to show benefit'],
        })
      }

      return {
        status: 'ok',
        symptomType,
        primary: {
          drugClass: 'Alpha_blocker',
          preferredAgent,
          rationaleBullets,
        },
        alternatives,
        checks,
        escalation: [],
        metadata: {
          logicVersion: '1.0',
          basedOn: ['NICE CG97'],
        },
      }
    }

    // Already on alpha-blocker, consider 5-ARI
    if ((input.enlargedProstateKnown === true || input.raisedPSAKnown === true) && !input.onFiveARI) {
      return {
        status: 'ok',
        symptomType,
        primary: {
          drugClass: 'Five_alpha_reductase_inhibitor',
          preferredAgent: getPreferred('Five_alpha_reductase_inhibitor', formularyConfig),
          rationaleBullets: [
            'Voiding symptoms persist on alpha-blocker',
            'Prostate enlargement or raised PSA confirmed',
            '5-alpha reductase inhibitor indicated (NICE CG97)',
          ],
        },
        alternatives: [
          {
            drugClass: 'Alpha_blocker_plus_5ARI',
            preferredAgent: getPreferred('Alpha_blocker_plus_5ARI', formularyConfig),
            rationaleBullets: ['Consider combination if symptoms severe'],
          },
        ],
        checks: ['Takes 3-6 months to show benefit', 'Review PSA if indicated', 'Review in 6 months'],
        escalation: [],
        metadata: {
          logicVersion: '1.0',
          basedOn: ['NICE CG97'],
        },
      }
    }
  }

  // Rule 4 - Storage-predominant / OAB pathway
  if (symptomType === 'Storage_predominant' || (symptomType === 'Mixed' && input.maleWithLikelyBPH !== true)) {
    // Check contraindications to antimuscarinics
    const antimuscarinicContraindicated =
      input.cognitiveImpairmentOrHighAnticholinergicBurden ||
      input.narrowAngleGlaucoma ||
      (formularyConfig.exclusions.avoidAntimuscarinicsInFrailty === true && input.fallsRiskOrPosturalHypotension)

    if (!antimuscarinicContraindicated && !input.onAntimuscarinic) {
      const rationaleBullets = [
        'Storage-predominant symptoms identified',
        'Antimuscarinics are first-line for overactive bladder symptoms (NICE CG97)',
      ]

      const checks: string[] = []
      if (input.fallsRiskOrPosturalHypotension) {
        checks.push('Monitor for falls risk')
      }
      checks.push('Review in 4-6 weeks')
      checks.push('Consider bladder diary to monitor progress')

      const preferredAgent = getPreferred('Antimuscarinic', formularyConfig)
      if (preferredAgent) {
        checks.push(`Check formulary-preferred agent: ${preferredAgent}`)
      }

      const alternatives: Array<{
        drugClass: LUTSDrugClass
        preferredAgent?: string
        rationaleBullets: string[]
      }> = []

      // Beta-3 agonist as alternative
      if (!input.onBeta3Agonist) {
        alternatives.push({
          drugClass: 'Beta3_agonist',
          preferredAgent: getPreferred('Beta3_agonist', formularyConfig),
          rationaleBullets: ['Alternative if antimuscarinic not tolerated or ineffective', 'Per NICE TA290/TA999'],
        })
      }

      return {
        status: 'ok',
        symptomType,
        primary: {
          drugClass: 'Antimuscarinic',
          preferredAgent,
          rationaleBullets,
        },
        alternatives,
        checks,
        escalation: [],
        metadata: {
          logicVersion: '1.0',
          basedOn: ['NICE CG97', 'NICE TA290'],
        },
      }
    }

    // Antimuscarinic contraindicated or already on one, consider beta-3 agonist
    if (!input.onBeta3Agonist) {
      const rationaleBullets = [
        'Storage-predominant symptoms identified',
        antimuscarinicContraindicated
          ? 'Antimuscarinic contraindicated due to safety concerns'
          : 'Antimuscarinic already in use or not effective',
        'Beta-3 agonist indicated as alternative (NICE TA290/TA999)',
      ]

      const checks: string[] = []
      if (input.severeUncontrolledHypertension || formularyConfig.exclusions.beta3HypertensionCaution === true) {
        checks.push('Check blood pressure before starting')
        checks.push('Monitor BP during treatment')
      }
      checks.push('Review in 4-6 weeks')

      const preferredAgent = getPreferred('Beta3_agonist', formularyConfig)
      if (preferredAgent) {
        checks.push(`Check formulary-preferred agent: ${preferredAgent}`)
      }

      return {
        status: 'ok',
        symptomType,
        primary: {
          drugClass: 'Beta3_agonist',
          preferredAgent,
          rationaleBullets,
        },
        alternatives: [],
        checks,
        escalation: [],
        metadata: {
          logicVersion: '1.0',
          basedOn: ['NICE TA290', 'NICE TA999'],
        },
      }
    }
  }

  // Rule 5 & 6 - Mixed symptoms or fallback
  // For mixed symptoms, choose dominant pathway or provide alternatives
  if (symptomType === 'Mixed') {
    const voidingSymptoms = [
      input.hesitancy,
      input.weakStream,
      input.straining,
      input.incompleteEmptying,
      input.postVoidDribble,
    ].filter(Boolean).length

    const storageSymptoms = [
      input.urgency,
      input.frequency,
      input.nocturia,
      input.urgeIncontinence,
    ].filter(Boolean).length

    // If voiding dominant in mixed symptoms
    if (voidingSymptoms > storageSymptoms && input.maleWithLikelyBPH === true && !input.onAlphaBlocker) {
      return {
        status: 'ok',
        symptomType,
        primary: {
          drugClass: 'Alpha_blocker',
          preferredAgent: getPreferred('Alpha_blocker', formularyConfig),
          rationaleBullets: [
            'Mixed symptoms with voiding predominance',
            'Alpha-blocker addresses voiding component (NICE CG97)',
          ],
        },
        alternatives: [
          ...(!input.onAntimuscarinic
            ? [
                {
                  drugClass: 'Antimuscarinic' as LUTSDrugClass,
                  preferredAgent: getPreferred('Antimuscarinic', formularyConfig),
                  rationaleBullets: ['Consider if storage symptoms persist'],
                },
              ]
            : []),
        ],
        checks: ['Review both voiding and storage symptoms', 'Consider combination if both persist'],
        escalation: [],
        metadata: {
          logicVersion: '1.0',
          basedOn: ['NICE CG97'],
        },
      }
    }

    // If storage dominant in mixed symptoms
    if (storageSymptoms > voidingSymptoms && !input.onAntimuscarinic && !input.cognitiveImpairmentOrHighAnticholinergicBurden) {
      return {
        status: 'ok',
        symptomType,
        primary: {
          drugClass: 'Antimuscarinic',
          preferredAgent: getPreferred('Antimuscarinic', formularyConfig),
          rationaleBullets: [
            'Mixed symptoms with storage predominance',
            'Antimuscarinic addresses storage component (NICE CG97)',
          ],
        },
        alternatives: [
          ...(input.maleWithLikelyBPH === true && !input.onAlphaBlocker
            ? [
                {
                  drugClass: 'Alpha_blocker' as LUTSDrugClass,
                  preferredAgent: getPreferred('Alpha_blocker', formularyConfig),
                  rationaleBullets: ['Consider if voiding symptoms persist'],
                },
              ]
            : []),
        ],
        checks: ['Review both voiding and storage symptoms', 'Consider combination if both persist'],
        escalation: [],
        metadata: {
          logicVersion: '1.0',
          basedOn: ['NICE CG97'],
        },
      }
    }
  }

  // Fallback - optimise current regimen
  return {
    status: 'ok',
    symptomType,
    primary: {
      drugClass: 'Optimise_non_drug_measures',
      rationaleBullets: ['Review current treatment and optimise non-drug measures', 'Consider specialist referral if symptoms persist'],
    },
    alternatives: [],
    checks: ['Review current medications', 'Consider bladder diary', 'Review in 4-6 weeks'],
    escalation: ['Consider urological referral if symptoms persist despite treatment'],
    metadata: {
      logicVersion: '1.0',
      basedOn: ['NICE CG97'],
    },
  }
}
