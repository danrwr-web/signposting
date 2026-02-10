import { recommendDiabetesNextStep, type DiabetesInput } from '../diabeticTitrationLogic'
import { defaultFormularyConfig } from '../formulary.config'

describe('Diabetic Medication Titration Decision Logic', () => {
  // Helper to create a base eligible input
  const createBaseInput = (overrides: Partial<DiabetesInput> = {}): DiabetesInput => ({
    adultT2DM: true,
    hba1c_mmol_mol: 60,
    target_hba1c_mmol_mol: 48,
    months_since_last_change: 6,
    onMetformin: true,
    metforminTolerated: true,
    onSGLT2i: false,
    onDPP4i: false,
    onSulfonylurea: false,
    onPioglitazone: false,
    onGLP1: false,
    onInsulin: false,
    establishedASCVD: false,
    chronicHeartFailure: false,
    highCVDRisk: false,
    egfrBand: 'unknown',
    bmiBand: 'unknown',
    bmi35orMore: null,
    weightLossPriority: 'neutral',
    minimiseHypoRisk: false,
    injectionsAcceptable: 'unsure',
    recurrentGenitalOrUTI: null,
    significantGIIntoleranceHistory: null,
    priorDKA: null,
    ketogenicOrVeryLowCarbDiet: null,
    intercurrentIllnessNow: null,
    ...overrides,
  })

  describe('Rule 0 - Eligibility Gate', () => {
    it('should return Not_eligible when adultT2DM is false', () => {
      const input = createBaseInput({ adultT2DM: false })
      const result = recommendDiabetesNextStep(input)

      expect(result.status).toBe('not_eligible')
      expect(result.primary.drugClass).toBe('Not_eligible')
      expect(result.notes).toContain('This tool is for adults with type 2 diabetes only')
    })

    it('should return Optimise_current_regimen when HbA1c is missing', () => {
      const input = createBaseInput({ hba1c_mmol_mol: null })
      const result = recommendDiabetesNextStep(input)

      expect(result.status).toBe('ok')
      expect(result.primary.drugClass).toBe('Optimise_current_regimen')
      expect(result.primary.rationaleBullets).toContain('HbA1c and target values required')
    })

    it('should return Optimise_current_regimen when target HbA1c is missing', () => {
      const input = createBaseInput({ target_hba1c_mmol_mol: null })
      const result = recommendDiabetesNextStep(input)

      expect(result.status).toBe('ok')
      expect(result.primary.drugClass).toBe('Optimise_current_regimen')
      expect(result.primary.rationaleBullets).toContain('HbA1c and target values required')
    })

    it('should return Optimise_current_regimen when HbA1c is at target', () => {
      const input = createBaseInput({ hba1c_mmol_mol: 48, target_hba1c_mmol_mol: 48 })
      const result = recommendDiabetesNextStep(input)

      expect(result.status).toBe('ok')
      expect(result.primary.drugClass).toBe('Optimise_current_regimen')
      expect(result.primary.rationaleBullets[0]).toContain('at or below target')
    })

    it('should return Optimise_current_regimen when HbA1c is below target', () => {
      const input = createBaseInput({ hba1c_mmol_mol: 45, target_hba1c_mmol_mol: 48 })
      const result = recommendDiabetesNextStep(input)

      expect(result.status).toBe('ok')
      expect(result.primary.drugClass).toBe('Optimise_current_regimen')
    })

    it('should return Optimise_current_regimen when months_since_last_change is missing', () => {
      const input = createBaseInput({ months_since_last_change: null })
      const result = recommendDiabetesNextStep(input)

      expect(result.status).toBe('ok')
      expect(result.primary.drugClass).toBe('Optimise_current_regimen')
      expect(result.primary.rationaleBullets).toContain('Duration on current regimen required')
    })

    it('should return Optimise_current_regimen when months_since_last_change < 3', () => {
      const input = createBaseInput({ months_since_last_change: 2 })
      const result = recommendDiabetesNextStep(input)

      expect(result.status).toBe('ok')
      expect(result.primary.drugClass).toBe('Optimise_current_regimen')
      expect(result.primary.rationaleBullets[0]).toContain('2 month')
      expect(result.checks).toContain('Review in 3 months')
    })

    it('should return Optimise_current_regimen when months_since_last_change is 1', () => {
      const input = createBaseInput({ months_since_last_change: 1 })
      const result = recommendDiabetesNextStep(input)

      expect(result.status).toBe('ok')
      expect(result.primary.drugClass).toBe('Optimise_current_regimen')
      expect(result.primary.rationaleBullets[0]).toContain('1 month')
    })
  })

  describe('Rule 2 - Metformin Optimisation', () => {
    it('should return Optimise_current_regimen when not on metformin but metformin tolerated', () => {
      const input = createBaseInput({
        onMetformin: false,
        metforminTolerated: true,
      })
      const result = recommendDiabetesNextStep(input)

      expect(result.status).toBe('ok')
      expect(result.primary.drugClass).toBe('Optimise_current_regimen')
      expect(result.primary.rationaleBullets).toContain('Metformin is first-line therapy')
      expect(result.primary.rationaleBullets).toContain('Metformin is tolerated but not currently prescribed')
    })
  })

  describe('Rule 1 - Cardio-renal Priority', () => {
    it('should recommend SGLT2i when heart failure present and not on SGLT2i', () => {
      const input = createBaseInput({
        chronicHeartFailure: true,
        onSGLT2i: false,
      })
      const result = recommendDiabetesNextStep(input)

      expect(result.status).toBe('ok')
      expect(result.primary.drugClass).toBe('SGLT2i')
      expect(result.primary.rationaleBullets).toContain('Chronic heart failure present')
      expect(result.primary.rationaleBullets).toContain('SGLT2 inhibitors have proven cardiovascular benefits')
    })

    it('should recommend SGLT2i when ASCVD present and not on SGLT2i', () => {
      const input = createBaseInput({
        establishedASCVD: true,
        onSGLT2i: false,
      })
      const result = recommendDiabetesNextStep(input)

      expect(result.status).toBe('ok')
      expect(result.primary.drugClass).toBe('SGLT2i')
      expect(result.primary.rationaleBullets).toContain('Established ASCVD present')
    })

    it('should include DKA safety check when priorDKA is true', () => {
      const input = createBaseInput({
        chronicHeartFailure: true,
        onSGLT2i: false,
        priorDKA: true,
      })
      const result = recommendDiabetesNextStep(input)

      expect(result.status).toBe('ok')
      expect(result.primary.drugClass).toBe('SGLT2i')
      expect(result.checks.some((check) => check.includes('DKA'))).toBe(true)
    })

    it('should include keto-diet safety check when ketogenicOrVeryLowCarbDiet is true', () => {
      const input = createBaseInput({
        chronicHeartFailure: true,
        onSGLT2i: false,
        ketogenicOrVeryLowCarbDiet: true,
      })
      const result = recommendDiabetesNextStep(input)

      expect(result.status).toBe('ok')
      expect(result.checks.some((check) => check.includes('Ketogenic') || check.includes('keto'))).toBe(true)
    })

    it('should include intercurrent illness check when intercurrentIllnessNow is true', () => {
      const input = createBaseInput({
        chronicHeartFailure: true,
        onSGLT2i: false,
        intercurrentIllnessNow: true,
      })
      const result = recommendDiabetesNextStep(input)

      expect(result.status).toBe('ok')
      expect(result.checks.some((check) => check.includes('Intercurrent illness'))).toBe(true)
    })

    it('should recommend SGLT2i when high CVD risk (but not ASCVD/HF) and not on SGLT2i', () => {
      const input = createBaseInput({
        highCVDRisk: true,
        establishedASCVD: false,
        chronicHeartFailure: false,
        onSGLT2i: false,
      })
      const result = recommendDiabetesNextStep(input)

      expect(result.status).toBe('ok')
      expect(result.primary.drugClass).toBe('SGLT2i')
      expect(result.primary.rationaleBullets).toContain('High cardiovascular risk')
    })

    it('should not recommend SGLT2i when already on SGLT2i', () => {
      const input = createBaseInput({
        chronicHeartFailure: true,
        onSGLT2i: true,
      })
      const result = recommendDiabetesNextStep(input)

      expect(result.status).toBe('ok')
      expect(result.primary.drugClass).not.toBe('SGLT2i')
    })

    it('should include GLP-1 as alternative when injections acceptable', () => {
      const input = createBaseInput({
        chronicHeartFailure: true,
        onSGLT2i: false,
        injectionsAcceptable: 'yes',
      })
      const result = recommendDiabetesNextStep(input)

      expect(result.status).toBe('ok')
      expect(result.primary.drugClass).toBe('SGLT2i')
      const glp1Alt = result.alternatives.find((alt) => alt.drugClass === 'GLP1_RA')
      expect(glp1Alt).toBeDefined()
    })
  })

  describe('Rule 3 - Add-on Selection Rules', () => {
    it('should recommend DPP4i when minimising hypo risk', () => {
      const input = createBaseInput({
        minimiseHypoRisk: true,
        onDPP4i: false,
      })
      const result = recommendDiabetesNextStep(input)

      expect(result.status).toBe('ok')
      expect(result.primary.drugClass).toBe('DPP4i')
      expect(result.primary.rationaleBullets).toContain('Hypoglycaemia risk needs minimising')
      expect(result.notes).toContain('Avoid sulfonylureas when minimising hypoglycaemia risk')
    })

    it('should recommend GLP-1 when weight loss priority and injections acceptable', () => {
      const input = createBaseInput({
        weightLossPriority: 'yes',
        injectionsAcceptable: 'yes',
        onGLP1: false,
      })
      const result = recommendDiabetesNextStep(input)

      expect(result.status).toBe('ok')
      expect(result.primary.drugClass).toBe('GLP1_RA')
      expect(result.primary.rationaleBullets).toContain('Weight loss is a priority')
    })

    it('should recommend SGLT2i when weight loss priority but injections not acceptable', () => {
      const input = createBaseInput({
        weightLossPriority: 'yes',
        injectionsAcceptable: 'no',
        onSGLT2i: false,
        egfrBand: '>=60',
      })
      const result = recommendDiabetesNextStep(input)

      expect(result.status).toBe('ok')
      expect(result.primary.drugClass).toBe('SGLT2i')
      expect(result.primary.rationaleBullets).toContain('Weight loss is a priority')
    })

    it('should not recommend GLP-1 when injections not acceptable', () => {
      const input = createBaseInput({
        weightLossPriority: 'yes',
        injectionsAcceptable: 'no',
        onGLP1: false,
        onSGLT2i: false,
        egfrBand: '>=60',
      })
      const result = recommendDiabetesNextStep(input)

      expect(result.status).toBe('ok')
      expect(result.primary.drugClass).not.toBe('GLP1_RA')
    })
  })

  describe('Rule 4 - GLP-1 Substitution', () => {
    it('should recommend GLP-1 when triple oral therapy ineffective and BMI ≥35', () => {
      const input = createBaseInput({
        onMetformin: true,
        onDPP4i: true,
        onSulfonylurea: true,
        onGLP1: false,
        bmi35orMore: true,
        injectionsAcceptable: 'yes',
      })
      const result = recommendDiabetesNextStep(input)

      expect(result.status).toBe('ok')
      expect(result.primary.drugClass).toBe('GLP1_RA')
      expect(result.primary.rationaleBullets).toContain('Triple oral therapy ineffective')
      expect(result.primary.rationaleBullets).toContain('BMI ≥35 kg/m²')
      expect(result.checks.some((check) => check.includes('Continuation criteria'))).toBe(true)
    })

    it('should recommend GLP-1 with note when triple therapy but BMI <35', () => {
      const input = createBaseInput({
        onMetformin: true,
        onDPP4i: true,
        onSulfonylurea: true,
        onGLP1: false,
        bmi35orMore: false,
        injectionsAcceptable: 'yes',
      })
      const result = recommendDiabetesNextStep(input)

      expect(result.status).toBe('ok')
      expect(result.primary.drugClass).toBe('GLP1_RA')
      expect(result.notes.some((note) => note.includes('BMI ≥35 kg/m²'))).toBe(true)
    })

    it('should not recommend GLP-1 when injections not acceptable', () => {
      const input = createBaseInput({
        onMetformin: true,
        onDPP4i: true,
        onSulfonylurea: true,
        onGLP1: false,
        bmi35orMore: true,
        injectionsAcceptable: 'no',
      })
      const result = recommendDiabetesNextStep(input)

      expect(result.status).toBe('ok')
      expect(result.primary.drugClass).not.toBe('GLP1_RA')
    })
  })

  describe('Rule 5 - Insulin-based Escalation', () => {
    it('should recommend Insulin_based_treatment when oral options exhausted', () => {
      const input = createBaseInput({
        onMetformin: true,
        onDPP4i: true,
        onSGLT2i: true,
        onGLP1: true,
        onInsulin: false,
        injectionsAcceptable: 'yes',
      })
      const result = recommendDiabetesNextStep(input)

      expect(result.status).toBe('ok')
      expect(result.primary.drugClass).toBe('Insulin_based_treatment')
      expect(result.notes).toContain('outside the scope of this tool')
    })
  })

  describe('Rule 6 - Alternatives Ranking', () => {
    it('should avoid pioglitazone when heart failure present', () => {
      const input = createBaseInput({
        chronicHeartFailure: true,
        onSGLT2i: true,
        onDPP4i: false,
      })
      const result = recommendDiabetesNextStep(input)

      expect(result.status).toBe('ok')
      const pioglitazoneAlt = result.alternatives.find((alt) => alt.drugClass === 'Pioglitazone')
      expect(pioglitazoneAlt).toBeUndefined()
      expect(result.primary.rationaleBullets.some((bullet) => bullet.includes('pioglitazone'))).toBe(true)
    })

    it('should limit alternatives to 3', () => {
      const input = createBaseInput({
        onMetformin: true,
        onSGLT2i: false,
        onDPP4i: false,
        onSulfonylurea: false,
        onPioglitazone: false,
        chronicHeartFailure: false,
      })
      const result = recommendDiabetesNextStep(input)

      expect(result.status).toBe('ok')
      expect(result.alternatives.length).toBeLessThanOrEqual(3)
    })
  })

  describe('Rule 7 - Formulary Display', () => {
    it('should include preferred agent when available', () => {
      const input = createBaseInput({
        chronicHeartFailure: true,
        onSGLT2i: false,
      })
      const result = recommendDiabetesNextStep(input, defaultFormularyConfig)

      expect(result.status).toBe('ok')
      expect(result.primary.drugClass).toBe('SGLT2i')
      expect(result.primary.preferredAgent).toBeDefined()
      expect(result.primary.preferredAgent).toContain('dapagliflozin')
    })

    it('should include preferred agent in alternatives when available', () => {
      const input = createBaseInput({
        minimiseHypoRisk: true,
        onDPP4i: false,
      })
      const result = recommendDiabetesNextStep(input, defaultFormularyConfig)

      expect(result.status).toBe('ok')
      expect(result.primary.drugClass).toBe('DPP4i')
      // Check if alternatives have preferred agents
      result.alternatives.forEach((alt) => {
        if (alt.preferredAgent) {
          expect(typeof alt.preferredAgent).toBe('string')
        }
      })
    })
  })

  describe('Edge Cases', () => {
    it('should handle all medications already in use', () => {
      const input = createBaseInput({
        onMetformin: true,
        onSGLT2i: true,
        onDPP4i: true,
        onSulfonylurea: true,
        onPioglitazone: true,
        onGLP1: true,
      })
      const result = recommendDiabetesNextStep(input)

      expect(result.status).toBe('ok')
      // Should still return a recommendation (likely insulin-based)
      expect(result.primary.drugClass).toBeDefined()
    })

    it('should handle eGFR <30 for SGLT2i recommendations', () => {
      const input = createBaseInput({
        chronicHeartFailure: true,
        onSGLT2i: false,
        egfrBand: '<30',
      })
      const result = recommendDiabetesNextStep(input)

      expect(result.status).toBe('ok')
      // Should still recommend SGLT2i but with appropriate checks
      expect(result.checks.some((check) => check.includes('renal function'))).toBe(true)
    })

    it('should handle unknown eGFR band', () => {
      const input = createBaseInput({
        chronicHeartFailure: true,
        onSGLT2i: false,
        egfrBand: 'unknown',
      })
      const result = recommendDiabetesNextStep(input)

      expect(result.status).toBe('ok')
      expect(result.checks.some((check) => check.includes('eGFR') || check.includes('renal'))).toBe(true)
    })
  })

  describe('Explainability', () => {
    it('should link rationale bullets to specific inputs', () => {
      const input = createBaseInput({
        chronicHeartFailure: true,
        onSGLT2i: false,
      })
      const result = recommendDiabetesNextStep(input)

      expect(result.primary.rationaleBullets.length).toBeGreaterThan(0)
      expect(result.primary.rationaleBullets.some((bullet) => bullet.includes('heart failure'))).toBe(true)
    })

    it('should include NICE references in metadata', () => {
      const input = createBaseInput({
        chronicHeartFailure: true,
        onSGLT2i: false,
      })
      const result = recommendDiabetesNextStep(input)

      expect(result.metadata.basedOn.length).toBeGreaterThan(0)
      expect(result.metadata.basedOn.some((ref) => ref.includes('NICE'))).toBe(true)
    })
  })
})
