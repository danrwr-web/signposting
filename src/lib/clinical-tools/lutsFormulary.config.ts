/**
 * Local formulary configuration for Devon - LUTS treatments
 * Supports preferred agents, exclusions, and display preferences
 */

export type LUTSDrugClass =
  | 'Alpha_blocker'
  | 'Five_alpha_reductase_inhibitor'
  | 'Alpha_blocker_plus_5ARI'
  | 'Antimuscarinic'
  | 'Beta3_agonist'
  | 'Optimise_non_drug_measures'
  | 'Refer_or_escalate'
  | 'Not_eligible'

export interface LocalLUTSFormularyConfig {
  version: string
  preferredAgentsByClass: Partial<Record<LUTSDrugClass, string[]>>
  exclusions: {
    avoidAntimuscarinicsInFrailty?: boolean
    beta3HypertensionCaution?: boolean
  }
  display: {
    showPreferredAgent: boolean
  }
}

export const defaultLUTSFormularyConfig: LocalLUTSFormularyConfig = {
  version: '1.0',
  preferredAgentsByClass: {
    // To be populated per Devon formulary preferences
  },
  exclusions: {
    avoidAntimuscarinicsInFrailty: true,
    beta3HypertensionCaution: true,
  },
  display: {
    showPreferredAgent: true,
  },
}

/**
 * Get preferred agent for a drug class
 */
export function getPreferredAgent(
  drugClass: LUTSDrugClass,
  config: LocalLUTSFormularyConfig = defaultLUTSFormularyConfig
): string | undefined {
  if (!config.display.showPreferredAgent) {
    return undefined
  }
  const preferred = config.preferredAgentsByClass[drugClass]
  return preferred && preferred.length > 0 ? preferred[0] : undefined
}

/**
 * Check if an agent should be excluded for a specific context
 */
export function isExcluded(
  drugClass: LUTSDrugClass,
  context: 'frailty' | 'hypertension',
  config: LocalLUTSFormularyConfig = defaultLUTSFormularyConfig
): boolean {
  if (drugClass === 'Antimuscarinic' && context === 'frailty') {
    return config.exclusions.avoidAntimuscarinicsInFrailty === true
  }
  if (drugClass === 'Beta3_agonist' && context === 'hypertension') {
    return config.exclusions.beta3HypertensionCaution === true
  }
  return false
}
