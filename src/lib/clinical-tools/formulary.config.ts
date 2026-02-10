/**
 * Local formulary configuration for Devon
 * Supports preferred agents, exclusions, and display preferences
 */

export type DiabetesDrugClass =
  | 'SGLT2i'
  | 'GLP1_RA'
  | 'DPP4i'
  | 'Sulfonylurea'
  | 'Pioglitazone'
  | 'Insulin_based_treatment'
  | 'Optimise_current_regimen'
  | 'Not_eligible'

export interface LocalFormularyConfig {
  version: string
  preferredAgentsByClass: Partial<Record<DiabetesDrugClass, string[]>>
  exclusions: {
    avoidErtugliflozinForCVBenefit?: boolean
    sglt2MinEgfrForGlycaemicUse?: number
  }
  display: {
    showPreferredAgent: boolean
  }
}

export const defaultFormularyConfig: LocalFormularyConfig = {
  version: '1.0',
  preferredAgentsByClass: {
    SGLT2i: ['dapagliflozin (generic)'],
  },
  exclusions: {
    avoidErtugliflozinForCVBenefit: true,
    sglt2MinEgfrForGlycaemicUse: 60,
  },
  display: {
    showPreferredAgent: true,
  },
}

/**
 * Get preferred agent for a drug class
 */
export function getPreferredAgent(
  drugClass: DiabetesDrugClass,
  config: LocalFormularyConfig = defaultFormularyConfig
): string | undefined {
  if (!config.display.showPreferredAgent) {
    return undefined
  }
  const preferred = config.preferredAgentsByClass[drugClass]
  return preferred && preferred.length > 0 ? preferred[0] : undefined
}

/**
 * Check if an agent should be excluded for a specific indication
 */
export function isExcluded(
  drugClass: DiabetesDrugClass,
  indication: 'cvBenefit' | 'glycaemic',
  config: LocalFormularyConfig = defaultFormularyConfig
): boolean {
  if (drugClass === 'SGLT2i' && indication === 'cvBenefit') {
    return config.exclusions.avoidErtugliflozinForCVBenefit === true
  }
  return false
}
