import { recommendLUTSTreatment, type LUTSInput } from '../lutsLogic'
import { defaultLUTSFormularyConfig } from '../lutsFormulary.config'

describe('LUTS Treatment Decision Logic', () => {
  // Helper to create a base eligible input
  const createBaseInput = (overrides: Partial<LUTSInput> = {}): LUTSInput => ({
    adultPatient: true,
    visibleHaematuria: false,
    recurrentUTIs: false,
    suspectedRetention: false,
    neurologicalRedFlags: false,
    suspectedProstateCancer: false,
    hesitancy: false,
    weakStream: false,
    straining: false,
    incompleteEmptying: false,
    postVoidDribble: false,
    urgency: false,
    frequency: false,
    nocturia: false,
    urgeIncontinence: false,
    ipssScore: null,
    bladderDiaryAvailable: null,
    maleWithLikelyBPH: null,
    enlargedProstateKnown: null,
    raisedPSAKnown: null,
    fallsRiskOrPosturalHypotension: false,
    cognitiveImpairmentOrHighAnticholinergicBurden: false,
    narrowAngleGlaucoma: false,
    severeUncontrolledHypertension: false,
    onAlphaBlocker: false,
    onFiveARI: false,
    onAntimuscarinic: false,
    onBeta3Agonist: false,
    ...overrides,
  })

  describe('Rule 0 - Eligibility and Red Flags', () => {
    it('should return Not_eligible when adultPatient is false', () => {
      const input = createBaseInput({ adultPatient: false })
      const result = recommendLUTSTreatment(input)

      expect(result.status).toBe('not_eligible')
      expect(result.primary.drugClass).toBe('Not_eligible')
      expect(result.symptomType).toBe('Unclear')
    })

    it('should return Refer_or_escalate when visible haematuria present', () => {
      const input = createBaseInput({ visibleHaematuria: true })
      const result = recommendLUTSTreatment(input)

      expect(result.status).toBe('ok')
      expect(result.primary.drugClass).toBe('Refer_or_escalate')
      expect(result.escalation.length).toBeGreaterThan(0)
      expect(result.escalation.some((msg) => msg.includes('haematuria'))).toBe(true)
    })

    it('should return Refer_or_escalate when suspected retention present', () => {
      const input = createBaseInput({ suspectedRetention: true })
      const result = recommendLUTSTreatment(input)

      expect(result.status).toBe('ok')
      expect(result.primary.drugClass).toBe('Refer_or_escalate')
      expect(result.escalation.some((msg) => msg.includes('retention'))).toBe(true)
    })

    it('should return Refer_or_escalate when neurological red flags present', () => {
      const input = createBaseInput({ neurologicalRedFlags: true })
      const result = recommendLUTSTreatment(input)

      expect(result.status).toBe('ok')
      expect(result.primary.drugClass).toBe('Refer_or_escalate')
      expect(result.escalation.some((msg) => msg.includes('Neurological'))).toBe(true)
    })

    it('should return Refer_or_escalate when suspected prostate cancer present', () => {
      const input = createBaseInput({ suspectedProstateCancer: true })
      const result = recommendLUTSTreatment(input)

      expect(result.status).toBe('ok')
      expect(result.primary.drugClass).toBe('Refer_or_escalate')
      expect(result.escalation.some((msg) => msg.includes('prostate cancer'))).toBe(true)
    })
  })

  describe('Rule 1 - Symptom Type Classification', () => {
    it('should classify Voiding_predominant when voiding symptoms ≥2 and greater than storage', () => {
      const input = createBaseInput({
        hesitancy: true,
        weakStream: true,
        straining: true,
        urgency: true,
      })
      const result = recommendLUTSTreatment(input)

      expect(result.symptomType).toBe('Voiding_predominant')
    })

    it('should classify Storage_predominant when storage symptoms ≥2 and greater than voiding', () => {
      const input = createBaseInput({
        urgency: true,
        frequency: true,
        nocturia: true,
        hesitancy: true,
      })
      const result = recommendLUTSTreatment(input)

      expect(result.symptomType).toBe('Storage_predominant')
    })

    it('should classify Mixed when both voiding and storage symptoms ≥2', () => {
      const input = createBaseInput({
        hesitancy: true,
        weakStream: true,
        urgency: true,
        frequency: true,
      })
      const result = recommendLUTSTreatment(input)

      expect(result.symptomType).toBe('Mixed')
    })

    it('should classify Unclear when symptoms <2 in each category', () => {
      const input = createBaseInput({
        hesitancy: true,
        urgency: true,
      })
      const result = recommendLUTSTreatment(input)

      expect(result.symptomType).toBe('Unclear')
    })
  })

  describe('Rule 2 - Non-drug Optimisation', () => {
    it('should return Optimise_non_drug_measures when symptom type is Unclear', () => {
      const input = createBaseInput({
        hesitancy: true,
        urgency: true,
      })
      const result = recommendLUTSTreatment(input)

      expect(result.status).toBe('ok')
      expect(result.primary.drugClass).toBe('Optimise_non_drug_measures')
      expect(result.primary.rationaleBullets.some((bullet) => bullet.includes('Unclear'))).toBe(true)
    })

    it('should return Optimise_non_drug_measures when IPSS ≤7', () => {
      const input = createBaseInput({
        hesitancy: true,
        weakStream: true,
        straining: true,
        urgency: true,
        ipssScore: 7,
      })
      const result = recommendLUTSTreatment(input)

      expect(result.status).toBe('ok')
      expect(result.primary.drugClass).toBe('Optimise_non_drug_measures')
      expect(result.primary.rationaleBullets.some((bullet) => bullet.includes('IPSS'))).toBe(true)
    })

    it('should return Optimise_non_drug_measures when IPSS <7', () => {
      const input = createBaseInput({
        hesitancy: true,
        weakStream: true,
        straining: true,
        urgency: true,
        ipssScore: 5,
      })
      const result = recommendLUTSTreatment(input)

      expect(result.status).toBe('ok')
      expect(result.primary.drugClass).toBe('Optimise_non_drug_measures')
    })
  })

  describe('Rule 3 - Voiding-predominant Pathway', () => {
    it('should recommend Alpha_blocker for voiding-predominant symptoms when not on alpha-blocker', () => {
      const input = createBaseInput({
        hesitancy: true,
        weakStream: true,
        straining: true,
        maleWithLikelyBPH: true,
        onAlphaBlocker: false,
      })
      const result = recommendLUTSTreatment(input)

      expect(result.status).toBe('ok')
      expect(result.symptomType).toBe('Voiding_predominant')
      expect(result.primary.drugClass).toBe('Alpha_blocker')
      expect(result.primary.rationaleBullets.some((bullet) => bullet.includes('Voiding'))).toBe(true)
    })

    it('should recommend Five_alpha_reductase_inhibitor when on alpha-blocker and enlarged prostate', () => {
      const input = createBaseInput({
        hesitancy: true,
        weakStream: true,
        straining: true,
        maleWithLikelyBPH: true,
        onAlphaBlocker: true,
        enlargedProstateKnown: true,
        onFiveARI: false,
      })
      const result = recommendLUTSTreatment(input)

      expect(result.status).toBe('ok')
      expect(result.primary.drugClass).toBe('Five_alpha_reductase_inhibitor')
      expect(result.primary.rationaleBullets.some((bullet) => bullet.includes('Prostate'))).toBe(true)
    })

    it('should include falls risk checks when falls risk present', () => {
      const input = createBaseInput({
        hesitancy: true,
        weakStream: true,
        straining: true,
        maleWithLikelyBPH: true,
        fallsRiskOrPosturalHypotension: true,
      })
      const result = recommendLUTSTreatment(input)

      expect(result.status).toBe('ok')
      expect(result.checks.some((check) => check.includes('falls') || check.includes('hypotension'))).toBe(true)
    })
  })

  describe('Rule 4 - Storage-predominant / OAB Pathway', () => {
    it('should recommend Antimuscarinic for storage-predominant symptoms when not contraindicated', () => {
      const input = createBaseInput({
        urgency: true,
        frequency: true,
        nocturia: true,
        onAntimuscarinic: false,
      })
      const result = recommendLUTSTreatment(input)

      expect(result.status).toBe('ok')
      expect(result.symptomType).toBe('Storage_predominant')
      expect(result.primary.drugClass).toBe('Antimuscarinic')
      expect(result.primary.rationaleBullets.some((bullet) => bullet.includes('Storage'))).toBe(true)
    })

    it('should recommend Beta3_agonist when antimuscarinic contraindicated', () => {
      const input = createBaseInput({
        urgency: true,
        frequency: true,
        nocturia: true,
        cognitiveImpairmentOrHighAnticholinergicBurden: true,
        onBeta3Agonist: false,
      })
      const result = recommendLUTSTreatment(input)

      expect(result.status).toBe('ok')
      expect(result.primary.drugClass).toBe('Beta3_agonist')
      expect(result.primary.rationaleBullets.some((bullet) => bullet.includes('contraindicated'))).toBe(true)
    })

    it('should recommend Beta3_agonist when already on antimuscarinic', () => {
      const input = createBaseInput({
        urgency: true,
        frequency: true,
        nocturia: true,
        onAntimuscarinic: true,
        onBeta3Agonist: false,
      })
      const result = recommendLUTSTreatment(input)

      expect(result.status).toBe('ok')
      expect(result.primary.drugClass).toBe('Beta3_agonist')
    })

    it('should include BP check when hypertension caution needed', () => {
      const input = createBaseInput({
        urgency: true,
        frequency: true,
        nocturia: true,
        cognitiveImpairmentOrHighAnticholinergicBurden: true,
        severeUncontrolledHypertension: true,
      })
      const result = recommendLUTSTreatment(input)

      expect(result.status).toBe('ok')
      expect(result.checks.some((check) => check.includes('blood pressure') || check.includes('BP'))).toBe(true)
    })
  })

  describe('Rule 5 - Avoid Duplication', () => {
    it('should not recommend alpha-blocker when already on alpha-blocker', () => {
      const input = createBaseInput({
        hesitancy: true,
        weakStream: true,
        straining: true,
        maleWithLikelyBPH: true,
        onAlphaBlocker: true,
      })
      const result = recommendLUTSTreatment(input)

      expect(result.status).toBe('ok')
      expect(result.primary.drugClass).not.toBe('Alpha_blocker')
    })

    it('should not recommend antimuscarinic when already on antimuscarinic', () => {
      const input = createBaseInput({
        urgency: true,
        frequency: true,
        nocturia: true,
        onAntimuscarinic: true,
      })
      const result = recommendLUTSTreatment(input)

      expect(result.status).toBe('ok')
      expect(result.primary.drugClass).not.toBe('Antimuscarinic')
    })
  })

  describe('Rule 6 - Alternatives Ranking', () => {
    it('should include alternatives for voiding symptoms', () => {
      const input = createBaseInput({
        hesitancy: true,
        weakStream: true,
        straining: true,
        maleWithLikelyBPH: true,
        enlargedProstateKnown: true,
      })
      const result = recommendLUTSTreatment(input)

      expect(result.status).toBe('ok')
      expect(result.alternatives.length).toBeGreaterThan(0)
    })

    it('should limit alternatives to reasonable number', () => {
      const input = createBaseInput({
        urgency: true,
        frequency: true,
        nocturia: true,
      })
      const result = recommendLUTSTreatment(input)

      expect(result.status).toBe('ok')
      expect(result.alternatives.length).toBeLessThanOrEqual(3)
    })
  })

  describe('Rule 7 - Formulary Display', () => {
    it('should include preferred agent when available', () => {
      const input = createBaseInput({
        hesitancy: true,
        weakStream: true,
        straining: true,
        maleWithLikelyBPH: true,
      })
      const result = recommendLUTSTreatment(input, defaultLUTSFormularyConfig)

      expect(result.status).toBe('ok')
      // Preferred agent may or may not be present depending on config
      if (result.primary.preferredAgent) {
        expect(typeof result.primary.preferredAgent).toBe('string')
      }
    })
  })

  describe('Mixed Symptoms', () => {
    it('should choose voiding pathway when voiding dominant in mixed symptoms', () => {
      const input = createBaseInput({
        hesitancy: true,
        weakStream: true,
        straining: true,
        urgency: true,
        frequency: true,
        maleWithLikelyBPH: true,
      })
      const result = recommendLUTSTreatment(input)

      expect(result.status).toBe('ok')
      expect(result.symptomType).toBe('Mixed')
      expect(result.primary.drugClass).toBe('Alpha_blocker')
    })

    it('should choose storage pathway when storage dominant in mixed symptoms', () => {
      const input = createBaseInput({
        hesitancy: true,
        urgency: true,
        frequency: true,
        nocturia: true,
        urgeIncontinence: true,
      })
      const result = recommendLUTSTreatment(input)

      expect(result.status).toBe('ok')
      expect(result.symptomType).toBe('Mixed')
      expect(result.primary.drugClass).toBe('Antimuscarinic')
    })
  })

  describe('Edge Cases', () => {
    it('should handle all medications already in use', () => {
      const input = createBaseInput({
        hesitancy: true,
        weakStream: true,
        urgency: true,
        frequency: true,
        onAlphaBlocker: true,
        onAntimuscarinic: true,
        onBeta3Agonist: true,
      })
      const result = recommendLUTSTreatment(input)

      expect(result.status).toBe('ok')
      // Should still return a recommendation
      expect(result.primary.drugClass).toBeDefined()
    })

    it('should handle cognitive impairment with storage symptoms', () => {
      const input = createBaseInput({
        urgency: true,
        frequency: true,
        nocturia: true,
        cognitiveImpairmentOrHighAnticholinergicBurden: true,
      })
      const result = recommendLUTSTreatment(input)

      expect(result.status).toBe('ok')
      expect(result.primary.drugClass).not.toBe('Antimuscarinic')
      expect(result.primary.drugClass).toBe('Beta3_agonist')
    })

    it('should handle narrow angle glaucoma', () => {
      const input = createBaseInput({
        urgency: true,
        frequency: true,
        nocturia: true,
        narrowAngleGlaucoma: true,
      })
      const result = recommendLUTSTreatment(input)

      expect(result.status).toBe('ok')
      expect(result.primary.drugClass).not.toBe('Antimuscarinic')
    })
  })

  describe('Explainability', () => {
    it('should link rationale bullets to specific inputs', () => {
      const input = createBaseInput({
        hesitancy: true,
        weakStream: true,
        straining: true,
        maleWithLikelyBPH: true,
      })
      const result = recommendLUTSTreatment(input)

      expect(result.primary.rationaleBullets.length).toBeGreaterThan(0)
      expect(result.primary.rationaleBullets.some((bullet) => bullet.includes('Voiding') || bullet.includes('voiding'))).toBe(true)
    })

    it('should include NICE references in metadata', () => {
      const input = createBaseInput({
        urgency: true,
        frequency: true,
        nocturia: true,
      })
      const result = recommendLUTSTreatment(input)

      expect(result.metadata.basedOn.length).toBeGreaterThan(0)
      expect(result.metadata.basedOn.some((ref) => ref.includes('NICE'))).toBe(true)
    })
  })
})
