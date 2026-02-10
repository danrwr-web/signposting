/**
 * Decision logic for diabetic medication titration
 * Aligned with NICE NG28 + local Devon formulary
 * 
 * Deterministic decision engine for choosing the next medication class
 * when HbA1c remains above target in adults with type 2 diabetes.
 */

import type { DiabetesDrugClass, LocalFormularyConfig } from './formulary.config'
import { defaultFormularyConfig as defaultConfig, getPreferredAgent as getPreferred } from './formulary.config'

export type { DiabetesDrugClass }

export interface DiabetesInput {
  // Eligibility
  adultT2DM: boolean
  hba1c_mmol_mol: number | null
  target_hba1c_mmol_mol: number | null
  months_since_last_change: number | null

  // Current therapy
  onMetformin: boolean
  metforminTolerated: boolean | null
  onSGLT2i: boolean
  onDPP4i: boolean
  onSulfonylurea: boolean
  onPioglitazone: boolean
  onGLP1: boolean
  onInsulin: boolean

  // Clinical modifiers
  establishedASCVD: boolean
  chronicHeartFailure: boolean
  highCVDRisk: boolean
  egfrBand: '>=60' | '45-59' | '30-44' | '<30' | 'unknown'

  bmiBand: '<25' | '25-29.9' | '>=30' | 'unknown'
  bmi35orMore: boolean | null
  weightLossPriority: 'yes' | 'no' | 'neutral'

  minimiseHypoRisk: boolean
  injectionsAcceptable: 'yes' | 'no' | 'unsure'

  recurrentGenitalOrUTI: boolean | null
  significantGIIntoleranceHistory: boolean | null

  // SGLT2 safety prompts
  priorDKA: boolean | null
  ketogenicOrVeryLowCarbDiet: boolean | null
  intercurrentIllnessNow: boolean | null
}

export interface DiabetesRecommendation {
  status: 'ok' | 'not_eligible'
  primary: {
    drugClass: DiabetesDrugClass
    preferredAgent?: string
    rationaleBullets: string[]
  }
  alternatives: Array<{
    drugClass: DiabetesDrugClass
    preferredAgent?: string
    rationaleBullets: string[]
  }>
  checks: string[]
  notes: string[]
  metadata: {
    logicVersion: string
    basedOn: string[]
  }
}

/**
 * Calculate recommended next drug class based on all inputs
 * Deterministic function - same inputs always produce same output
 */
export function recommendDiabetesNextStep(
  input: DiabetesInput,
  formularyConfig: LocalFormularyConfig = defaultConfig
): DiabetesRecommendation {
  // Rule 0 - Eligibility Gate
  if (!input.adultT2DM) {
    return {
      status: 'not_eligible',
      primary: {
        drugClass: 'Not_eligible',
        rationaleBullets: ['Not an adult with type 2 diabetes'],
      },
      alternatives: [],
      checks: [],
      notes: ['This tool is for adults with type 2 diabetes only'],
      metadata: {
        logicVersion: '1.0',
        basedOn: ['NICE NG28'],
      },
    }
  }

  // Check HbA1c/target missing
  if (input.hba1c_mmol_mol === null || input.target_hba1c_mmol_mol === null) {
    return {
      status: 'ok',
      primary: {
        drugClass: 'Optimise_current_regimen',
        rationaleBullets: ['HbA1c and target values required for escalation guidance'],
      },
      alternatives: [],
      checks: ['Obtain current HbA1c and confirm individualised target'],
      notes: ['Please enter both current HbA1c and target HbA1c to proceed'],
      metadata: {
        logicVersion: '1.0',
        basedOn: ['NICE NG28'],
      },
    }
  }

  // Check at target
  if (input.hba1c_mmol_mol <= input.target_hba1c_mmol_mol) {
    return {
      status: 'ok',
      primary: {
        drugClass: 'Optimise_current_regimen',
        rationaleBullets: [
          `HbA1c (${input.hba1c_mmol_mol} mmol/mol) is at or below target (${input.target_hba1c_mmol_mol} mmol/mol)`,
        ],
      },
      alternatives: [],
      checks: ['Continue current regimen and monitor regularly'],
      notes: ['No escalation needed while HbA1c remains at target'],
      metadata: {
        logicVersion: '1.0',
        basedOn: ['NICE NG28'],
      },
    }
  }

  // Check months since last change
  if (input.months_since_last_change === null) {
    return {
      status: 'ok',
      primary: {
        drugClass: 'Optimise_current_regimen',
        rationaleBullets: ['Duration on current regimen required for escalation guidance'],
      },
      alternatives: [],
      checks: ['Confirm time since last medication change'],
      notes: ['Please enter months since last medication change to proceed'],
      metadata: {
        logicVersion: '1.0',
        basedOn: ['NICE NG28'],
      },
    }
  }

  if (input.months_since_last_change < 3) {
    return {
      status: 'ok',
      primary: {
        drugClass: 'Optimise_current_regimen',
        rationaleBullets: [
          `Current regimen changed ${input.months_since_last_change} month${input.months_since_last_change !== 1 ? 's' : ''} ago`,
          'Allow adequate time for medication to take effect',
        ],
      },
      alternatives: [],
      checks: ['Optimise adherence and lifestyle measures', 'Review in 3 months'],
      notes: ['Consider escalation after 3 months on current regimen if HbA1c remains above target'],
      metadata: {
        logicVersion: '1.0',
        basedOn: ['NICE NG28'],
      },
    }
  }

  // Rule 2 - Metformin Optimisation (check before other rules)
  if (!input.onMetformin && input.metforminTolerated === true) {
    return {
      status: 'ok',
      primary: {
        drugClass: 'Optimise_current_regimen',
        rationaleBullets: [
          'Metformin is first-line therapy per NICE NG28 (1.7.3)',
          'Metformin is tolerated but not currently prescribed',
        ],
      },
      alternatives: [],
      checks: ['Consider starting metformin as first-line therapy'],
      notes: ['Metformin should be optimised before considering add-on therapies'],
      metadata: {
        logicVersion: '1.0',
        basedOn: ['NICE NG28 1.7.3'],
      },
    }
  }

  // Rule 1 - Cardio-renal Priority
  const hasCardioRenalIndication = input.chronicHeartFailure || input.establishedASCVD
  const onSGLT2i = input.onSGLT2i

  if (hasCardioRenalIndication && !onSGLT2i) {
    const rationaleBullets: string[] = []
    if (input.chronicHeartFailure) {
      rationaleBullets.push('Chronic heart failure present')
    }
    if (input.establishedASCVD) {
      rationaleBullets.push('Established ASCVD present')
    }
    rationaleBullets.push('SGLT2 inhibitors have proven cardiovascular benefits (NICE NG28 1.7.5-1.7.6)')
    rationaleBullets.push('Not currently on SGLT2 inhibitor')

    const checks: string[] = []
    if (input.priorDKA === true) {
      checks.push('Prior DKA history - assess DKA risk before SGLT2 initiation (NICE NG28 1.7.11-1.7.13)')
    }
    if (input.ketogenicOrVeryLowCarbDiet === true) {
      checks.push('Ketogenic or very low carb diet - review DKA risk and provide sick-day advice')
    }
    if (input.intercurrentIllnessNow === true) {
      checks.push('Intercurrent illness present - defer SGLT2 initiation until resolved')
    }
    checks.push(`Check renal function thresholds (eGFR ${input.egfrBand === 'unknown' ? 'required' : input.egfrBand})`)
    checks.push('Review sick-day rules for SGLT2 inhibitors')
    const preferredAgent = getPreferred('SGLT2i', formularyConfig)
    if (preferredAgent) {
      checks.push(`Check formulary-preferred agent: ${preferredAgent}`)
    }
    checks.push('Plan review in 3-6 months')

    const alternatives: Array<{
      drugClass: DiabetesDrugClass
      preferredAgent?: string
      rationaleBullets: string[]
    }> = []

    // GLP-1 as alternative if injections acceptable
    if (input.injectionsAcceptable !== 'no') {
      alternatives.push({
        drugClass: 'GLP1_RA',
        preferredAgent: getPreferred('GLP1_RA', formularyConfig),
        rationaleBullets: ['Alternative if SGLT2 not suitable', 'GLP-1 receptor agonists also have cardiovascular benefits'],
      })
    }

    // DPP4i as alternative
    if (!input.onDPP4i) {
      alternatives.push({
        drugClass: 'DPP4i',
        preferredAgent: getPreferred('DPP4i', formularyConfig),
        rationaleBullets: ['Alternative oral option', 'Low hypoglycaemia risk'],
      })
    }

    return {
      status: 'ok',
      primary: {
        drugClass: 'SGLT2i',
        preferredAgent: getPreferred('SGLT2i', formularyConfig),
        rationaleBullets,
      },
      alternatives,
      checks,
      notes: [],
      metadata: {
        logicVersion: '1.0',
        basedOn: ['NICE NG28 1.7.5-1.7.6', 'NICE NG28 1.7.11-1.7.13'],
      },
    }
  }

  // High CVD risk (but not established ASCVD/HF)
  if (input.highCVDRisk && !onSGLT2i && !hasCardioRenalIndication) {
    const rationaleBullets = [
      'High cardiovascular risk (QRISK3-based assessment)',
      'Consider SGLT2 inhibitor for cardiovascular benefit (NICE NG28 1.7.5-1.7.6)',
      'Not currently on SGLT2 inhibitor',
    ]

    const checks: string[] = []
    if (input.priorDKA === true) {
      checks.push('Prior DKA history - assess DKA risk before SGLT2 initiation')
    }
    if (input.ketogenicOrVeryLowCarbDiet === true) {
      checks.push('Ketogenic or very low carb diet - review DKA risk')
    }
    checks.push(`Check renal function thresholds (eGFR ${input.egfrBand === 'unknown' ? 'required' : input.egfrBand})`)
    const preferredAgent = getPreferred('SGLT2i', formularyConfig)
    if (preferredAgent) {
      checks.push(`Check formulary-preferred agent: ${preferredAgent}`)
    }

    return {
      status: 'ok',
      primary: {
        drugClass: 'SGLT2i',
        preferredAgent: getPreferred('SGLT2i', formularyConfig),
        rationaleBullets,
      },
      alternatives: [],
      checks,
      notes: ['Consider SGLT2 inhibitor for cardiovascular risk reduction'],
      metadata: {
        logicVersion: '1.0',
        basedOn: ['NICE NG28 1.7.5-1.7.6'],
      },
    }
  }

  // Rule 4 - GLP-1 Substitution (check before general add-on rules)
  const tripleOralTherapy =
    input.onMetformin && (input.onDPP4i || input.onSGLT2i || input.onSulfonylurea) && (input.onDPP4i || input.onSGLT2i || input.onSulfonylurea || input.onPioglitazone) &&
    [input.onDPP4i, input.onSGLT2i, input.onSulfonylurea, input.onPioglitazone].filter(Boolean).length >= 2

  if (tripleOralTherapy && !input.onGLP1) {
    if (input.bmi35orMore === true && input.injectionsAcceptable !== 'no') {
      return {
        status: 'ok',
        primary: {
          drugClass: 'GLP1_RA',
          preferredAgent: getPreferred('GLP1_RA', formularyConfig),
          rationaleBullets: [
            'Triple oral therapy ineffective',
            'BMI ≥35 kg/m² (NICE NG28 1.7.21)',
            'GLP-1 receptor agonist indicated for weight management and glucose control',
          ],
          alternatives: [],
          checks: [
            'Check contraindications (pancreatitis history, medullary thyroid cancer, personal/family history)',
            'Review GI side effects',
            'Continuation criteria: HbA1c reduction ≥11 mmol/mol AND weight reduction ≥3% at 6 months (NICE NG28 1.7.22)',
            'If criteria not met at 6 months, consider stopping and alternative approach',
            getPreferred('GLP1_RA', formularyConfig) ? `Check formulary-preferred agent: ${getPreferred('GLP1_RA', formularyConfig)}` : 'Check formulary-preferred agent',
            'Plan review in 6 months',
          ],
          notes: [],
          metadata: {
            logicVersion: '1.0',
            basedOn: ['NICE NG28 1.7.21-1.7.22'],
          },
        },
      }
    } else if (input.injectionsAcceptable !== 'no') {
      // Triple therapy but BMI <35
      const alternatives: Array<{
        drugClass: DiabetesDrugClass
        preferredAgent?: string
        rationaleBullets: string[]
      }> = []

      if (!input.onSGLT2i && input.egfrBand !== '<30') {
        alternatives.push({
          drugClass: 'SGLT2i',
          preferredAgent: getPreferred('SGLT2i', formularyConfig),
          rationaleBullets: ['Alternative add-on option', 'Consider if cardio-renal benefits needed'],
        })
      }

      return {
        status: 'ok',
        primary: {
          drugClass: 'GLP1_RA',
          preferredAgent: getPreferred('GLP1_RA', formularyConfig),
          rationaleBullets: [
            'Triple oral therapy ineffective',
            'GLP-1 receptor agonist may be considered (NICE NG28 1.7.21)',
            'Note: BMI ≥35 kg/m² criteria applies for routine use',
          ],
          alternatives,
          checks: [
            'Check NICE criteria for GLP-1 use (BMI ≥35 kg/m² for routine use)',
            'Check contraindications (pancreatitis history, medullary thyroid cancer)',
            'Continuation criteria: HbA1c reduction ≥11 mmol/mol AND weight reduction ≥3% at 6 months',
            getPreferred('GLP1_RA', formularyConfig) ? `Check formulary-preferred agent: ${getPreferred('GLP1_RA', formularyConfig)}` : 'Check formulary-preferred agent',
          ],
          notes: ['GLP-1 receptor agonists are typically reserved for BMI ≥35 kg/m² per NICE NG28'],
          metadata: {
            logicVersion: '1.0',
            basedOn: ['NICE NG28 1.7.21'],
          },
        },
      }
    }
  }

  // Rule 3 - Add-on Selection Rules
  const onMultipleMedications =
    [input.onMetformin, input.onDPP4i, input.onSGLT2i, input.onSulfonylurea, input.onPioglitazone].filter(Boolean).length >= 2

  // Hypo risk minimisation
  if (input.minimiseHypoRisk) {
    // Prefer DPP4i, GLP1_RA, or SGLT2i over sulfonylurea
    if (!input.onDPP4i) {
      return {
        status: 'ok',
        primary: {
          drugClass: 'DPP4i',
          preferredAgent: getPreferred('DPP4i', formularyConfig),
          rationaleBullets: [
            'Hypoglycaemia risk needs minimising',
            'DPP-4 inhibitors have low hypoglycaemia risk',
            'HbA1c remains above target',
          ],
          alternatives: [
            ...(input.injectionsAcceptable !== 'no' && !input.onGLP1
              ? [
                  {
                    drugClass: 'GLP1_RA' as DiabetesDrugClass,
                    preferredAgent: getPreferred('GLP1_RA', formularyConfig),
                    rationaleBullets: ['Alternative low hypoglycaemia risk option'],
                  },
                ]
              : []),
            ...(!input.onSGLT2i && input.egfrBand !== '<30'
              ? [
                  {
                    drugClass: 'SGLT2i' as DiabetesDrugClass,
                    preferredAgent: getPreferred('SGLT2i', formularyConfig),
                    rationaleBullets: ['Alternative low hypoglycaemia risk option'],
                  },
                ]
              : []),
          ],
          checks: [
            'Check renal function thresholds',
            getPreferred('DPP4i', formularyConfig) ? `Check formulary-preferred agent: ${getPreferred('DPP4i', formularyConfig)}` : 'Check formulary-preferred agent',
            'Plan review in 3-6 months',
          ],
          notes: ['Avoid sulfonylureas when minimising hypoglycaemia risk'],
          metadata: {
            logicVersion: '1.0',
            basedOn: ['NICE NG28'],
          },
        },
      }
    }
  }

  // Weight loss priority
  if (input.weightLossPriority === 'yes') {
    if (input.injectionsAcceptable !== 'no' && !input.onGLP1) {
      return {
        status: 'ok',
        primary: {
          drugClass: 'GLP1_RA',
          preferredAgent: getPreferred('GLP1_RA', formularyConfig),
          rationaleBullets: [
            'Weight loss is a priority',
            'GLP-1 receptor agonists support weight reduction',
            'Effective glucose lowering',
          ],
          alternatives: [
            ...(!input.onSGLT2i && input.egfrBand !== '<30'
              ? [
                  {
                    drugClass: 'SGLT2i' as DiabetesDrugClass,
                    preferredAgent: getPreferred('SGLT2i', formularyConfig),
                    rationaleBullets: ['Alternative if injections not acceptable', 'SGLT2 inhibitors also support weight management'],
                  },
                ]
              : []),
          ],
          checks: [
            'Check contraindications (pancreatitis history, medullary thyroid cancer)',
            'Review GI side effects',
            getPreferred('GLP1_RA', formularyConfig) ? `Check formulary-preferred agent: ${getPreferred('GLP1_RA', formularyConfig)}` : 'Check formulary-preferred agent',
            'Plan review in 3-6 months',
          ],
          notes: [],
          metadata: {
            logicVersion: '1.0',
            basedOn: ['NICE NG28'],
          },
        },
      }
    } else if (!input.onSGLT2i && input.egfrBand !== '<30') {
      return {
        status: 'ok',
        primary: {
          drugClass: 'SGLT2i',
          preferredAgent: getPreferred('SGLT2i', formularyConfig),
          rationaleBullets: [
            'Weight loss is a priority',
            'SGLT2 inhibitors support weight management',
            'Oral therapy acceptable',
          ],
          alternatives: [],
          checks: [
            `Check renal function thresholds (eGFR ${input.egfrBand === 'unknown' ? 'required' : input.egfrBand})`,
            getPreferred('SGLT2i', formularyConfig) ? `Check formulary-preferred agent: ${getPreferred('SGLT2i', formularyConfig)}` : 'Check formulary-preferred agent',
            'Plan review in 3-6 months',
          ],
          notes: [],
          metadata: {
            logicVersion: '1.0',
            basedOn: ['NICE NG28'],
          },
        },
      }
    }
  }

  // Rule 5 - Insulin-based Escalation
  const oralOptionsExhausted =
    input.onMetformin &&
    (input.onDPP4i || input.onSGLT2i || input.onSulfonylurea || input.onPioglitazone) &&
    (input.onGLP1 || input.injectionsAcceptable === 'no') &&
    input.hba1c_mmol_mol !== null &&
    input.hba1c_mmol_mol > input.target_hba1c_mmol_mol

  if (oralOptionsExhausted && !input.onInsulin) {
    return {
      status: 'ok',
      primary: {
        drugClass: 'Insulin_based_treatment',
        rationaleBullets: [
          'Oral therapy options exhausted or contraindicated',
          'HbA1c remains above target',
        ],
      },
      alternatives: [],
      checks: ['Consider specialist referral', 'Structured insulin initiation pathway required'],
      notes: ['Insulin titration and management is outside the scope of this tool – consider specialist / structured pathway'],
      metadata: {
        logicVersion: '1.0',
        basedOn: ['NICE NG28'],
      },
    }
  }

  // Rule 6 - Default Add-on Selection
  // If we get here, suggest appropriate add-on based on what's not already in use
  const alternatives: Array<{
    drugClass: DiabetesDrugClass
    preferredAgent?: string
    rationaleBullets: string[]
  }> = []

  let primaryDrugClass: DiabetesDrugClass = 'DPP4i'
  let primaryRationale: string[] = ['HbA1c remains above target', 'Low hypoglycaemia risk', 'Oral therapy acceptable']

  // Build alternatives list (exclude what's already in use, avoid pioglitazone if HF)
  if (!input.onDPP4i) {
    alternatives.push({
      drugClass: 'DPP4i',
      preferredAgent: getPreferred('DPP4i', formularyConfig),
      rationaleBullets: ['Low hypoglycaemia risk', 'Well tolerated'],
    })
  }

  if (!input.onSGLT2i && input.egfrBand !== '<30') {
    if (primaryDrugClass === 'DPP4i') {
      // Make SGLT2 primary if not already on it
      primaryDrugClass = 'SGLT2i'
      primaryRationale = ['HbA1c remains above target', 'Consider cardio-renal benefits', 'Low hypoglycaemia risk']
    } else {
      alternatives.push({
        drugClass: 'SGLT2i',
        preferredAgent: getPreferred('SGLT2i', formularyConfig),
        rationaleBullets: ['Consider cardio-renal benefits', 'Low hypoglycaemia risk'],
      })
    }
  }

  if (!input.onSulfonylurea && !input.minimiseHypoRisk) {
    alternatives.push({
      drugClass: 'Sulfonylurea',
      preferredAgent: getPreferred('Sulfonylurea', formularyConfig),
      rationaleBullets: ['Cost-effective option', 'Avoid if minimising hypoglycaemia risk'],
    })
  }

  // Avoid pioglitazone if heart failure
  if (!input.onPioglitazone && !input.chronicHeartFailure) {
    alternatives.push({
      drugClass: 'Pioglitazone',
      preferredAgent: getPreferred('Pioglitazone', formularyConfig),
      rationaleBullets: ['Avoid in heart failure', 'Consider fluid retention risk'],
    })
  } else if (input.chronicHeartFailure) {
    // Add note about avoiding pioglitazone
    primaryRationale.push('Avoid pioglitazone in heart failure')
  }

  // Limit alternatives to 3
  const limitedAlternatives = alternatives.slice(0, 3)

  const checks: string[] = []
  if (primaryDrugClass === 'SGLT2i') {
    checks.push(`Check renal function thresholds (eGFR ${input.egfrBand === 'unknown' ? 'required' : input.egfrBand})`)
    if (input.priorDKA === true) {
      checks.push('Prior DKA history - assess DKA risk')
    }
  }
  const preferredAgent = getPreferred(primaryDrugClass, formularyConfig)
  if (preferredAgent) {
    checks.push(`Check formulary-preferred agent: ${preferredAgent}`)
  }
  checks.push('Plan review in 3-6 months')

  return {
    status: 'ok',
    primary: {
      drugClass: primaryDrugClass,
      preferredAgent,
      rationaleBullets: primaryRationale,
    },
    alternatives: limitedAlternatives,
    checks,
    notes: [],
    metadata: {
      logicVersion: '1.0',
      basedOn: ['NICE NG28 1.7.17-1.7.20'],
    },
  }
}

/**
 * Legacy compatibility function - maps old interface to new
 * @deprecated Use recommendDiabetesNextStep with DiabetesInput instead
 */
export function calculateRecommendation(
  medications: {
    metformin?: 'tolerated' | 'not-tolerated' | 'not-taking'
    sulfonylurea?: 'tolerated' | 'not-tolerated' | 'not-taking'
    dpp4?: 'tolerated' | 'not-tolerated' | 'not-taking'
    sglt2?: 'tolerated' | 'not-tolerated' | 'not-taking'
    glp1?: 'tolerated' | 'not-tolerated' | 'not-taking'
    insulin?: 'tolerated' | 'not-tolerated' | 'not-taking'
  },
  modifiers: {
    establishedASCVD: boolean | null
    heartFailure: boolean | null
    hypoglycaemiaRiskMinimise: boolean | null
    weightLossPriority: boolean | null
    injectionsAcceptable: boolean | null
  }
): {
  suggestedDrugClass: string
  explanation: string[]
  alternatives: Array<{ drugClass: string; reason: string }>
  safetyChecks: string[]
} {
  // Convert old format to new format
  const input: DiabetesInput = {
    adultT2DM: true, // Assume eligible if using old function
    hba1c_mmol_mol: 60, // Default value
    target_hba1c_mmol_mol: 48, // Default value
    months_since_last_change: 6, // Default value
    onMetformin: medications.metformin === 'tolerated',
    metforminTolerated: medications.metformin === 'tolerated' ? true : medications.metformin === 'not-tolerated' ? false : null,
    onSGLT2i: medications.sglt2 === 'tolerated',
    onDPP4i: medications.dpp4 === 'tolerated',
    onSulfonylurea: medications.sulfonylurea === 'tolerated',
    onPioglitazone: false,
    onGLP1: medications.glp1 === 'tolerated',
    onInsulin: medications.insulin === 'tolerated',
    establishedASCVD: modifiers.establishedASCVD === true,
    chronicHeartFailure: modifiers.heartFailure === true,
    highCVDRisk: false,
    egfrBand: 'unknown',
    bmiBand: 'unknown',
    bmi35orMore: null,
    weightLossPriority: modifiers.weightLossPriority === true ? 'yes' : modifiers.weightLossPriority === false ? 'no' : 'neutral',
    minimiseHypoRisk: modifiers.hypoglycaemiaRiskMinimise === true,
    injectionsAcceptable: modifiers.injectionsAcceptable === true ? 'yes' : modifiers.injectionsAcceptable === false ? 'no' : 'unsure',
    recurrentGenitalOrUTI: null,
    significantGIIntoleranceHistory: null,
    priorDKA: null,
    ketogenicOrVeryLowCarbDiet: null,
    intercurrentIllnessNow: null,
  }

  const result = recommendDiabetesNextStep(input)

  return {
    suggestedDrugClass: result.primary.drugClass,
    explanation: result.primary.rationaleBullets,
    alternatives: result.alternatives.map((alt) => ({
      drugClass: alt.drugClass,
      reason: alt.rationaleBullets.join('; '),
    })),
    safetyChecks: result.checks,
  }
}

/**
 * Check if patient is eligible for escalation guidance
 * @deprecated Use recommendDiabetesNextStep and check status instead
 */
export function isEligible(eligibility: {
  adultType2Diabetes: boolean | null
  hba1cAboveTarget: boolean | null
  onRegimen3Months: boolean | null
}): boolean {
  return (
    eligibility.adultType2Diabetes === true &&
    eligibility.hba1cAboveTarget === true &&
    eligibility.onRegimen3Months === true
  )
}
