import { evaluateFlags } from '@/server/surgerySetupFlags'
import type { SurgerySetupSnapshot } from '@/server/surgerySetup'

const NOW = new Date('2026-04-20T12:00:00Z')
const DAY_MS = 24 * 60 * 60 * 1000
const daysAgo = (n: number) => new Date(NOW.getTime() - n * DAY_MS)

function fixture(overrides: Partial<SurgerySetupSnapshot> = {}): SurgerySetupSnapshot {
  const base: SurgerySetupSnapshot = {
    surgeryId: 'sur_1',
    surgeryName: 'Example Surgery',
    createdAt: daysAgo(5),
    requiresClinicalReview: false,
    onboardingCompleted: true,
    onboardingCompletedAt: daysAgo(2),
    onboardingUpdatedAt: daysAgo(2),
    onboardingStarted: true,
    appointmentModelConfigured: true,
    aiCustomisationOccurred: true,
    pendingCount: 0,
    checklist: {
      onboardingCompleted: true,
      appointmentModelConfigured: true,
      aiCustomisationRun: true,
      pendingReviewCount: 0,
      standardUsersCount: 3,
      highRiskConfigured: true,
      highlightsEnabled: true,
      appointmentTypeCount: 3,
      handbookItemCount: 3,
    },
    health: {
      pendingReviewCount: 0,
      changesRequestedCount: 0,
      lastReviewActivity: daysAgo(1).toISOString(),
      activeUsersLast30: 2,
      totalViewsLast30: 40,
      topSymptomId: null,
      topSymptomCount: 0,
      approvedCount: 20,
      recentlyUpdatedCount: 5,
    },
    features: [],
    stage: 'live',
    essentialCount: 6,
    essentialTotal: 6,
    recommendedCount: 3,
    recommendedTotal: 3,
    lastActivityAt: daysAgo(1),
    goLiveDate: null,
  }
  return { ...base, ...overrides }
}

function codes(snapshot: SurgerySetupSnapshot): string[] {
  return evaluateFlags(snapshot, NOW).map(f => f.code)
}

describe('surgerySetupFlags.evaluateFlags', () => {
  describe('NO_ONBOARDING_STARTED_14D', () => {
    it('fires when unstarted and >14d old', () => {
      const s = fixture({
        createdAt: daysAgo(20),
        onboardingStarted: false,
        onboardingCompleted: false,
        stage: 'not_started',
        essentialCount: 0,
      })
      expect(codes(s)).toContain('NO_ONBOARDING_STARTED_14D')
    })
    it('does not fire at 14d exactly', () => {
      const s = fixture({
        createdAt: daysAgo(14),
        onboardingStarted: false,
        onboardingCompleted: false,
      })
      expect(codes(s)).not.toContain('NO_ONBOARDING_STARTED_14D')
    })
    it('does not fire when onboarding has started', () => {
      const s = fixture({ createdAt: daysAgo(30), onboardingStarted: true })
      expect(codes(s)).not.toContain('NO_ONBOARDING_STARTED_14D')
    })
  })

  describe('ONBOARDING_STALLED_21D', () => {
    it('fires when started, not completed, last edit >21d ago', () => {
      const s = fixture({
        onboardingStarted: true,
        onboardingCompleted: false,
        onboardingCompletedAt: null,
        onboardingUpdatedAt: daysAgo(25),
        essentialCount: 2,
      })
      expect(codes(s)).toContain('ONBOARDING_STALLED_21D')
    })
    it('does not fire if already completed', () => {
      const s = fixture({
        onboardingStarted: true,
        onboardingCompleted: true,
        onboardingUpdatedAt: daysAgo(60),
      })
      expect(codes(s)).not.toContain('ONBOARDING_STALLED_21D')
    })
  })

  describe('NO_STANDARD_USERS_7D_AFTER_COMPLETION', () => {
    it('fires when completed >7d and zero users', () => {
      const s = fixture({
        onboardingCompleted: true,
        onboardingCompletedAt: daysAgo(10),
        checklist: { ...fixture().checklist, standardUsersCount: 0 },
      })
      expect(codes(s)).toContain('NO_STANDARD_USERS_7D_AFTER_COMPLETION')
    })
    it('does not fire with users added', () => {
      const s = fixture({
        onboardingCompleted: true,
        onboardingCompletedAt: daysAgo(10),
        checklist: { ...fixture().checklist, standardUsersCount: 1 },
      })
      expect(codes(s)).not.toContain('NO_STANDARD_USERS_7D_AFTER_COMPLETION')
    })
  })

  describe('PENDING_REVIEWS_STUCK', () => {
    it('fires with >=50 pending and last review >14d ago', () => {
      const s = fixture({
        checklist: { ...fixture().checklist, pendingReviewCount: 75 },
        health: { ...fixture().health, pendingReviewCount: 75, lastReviewActivity: daysAgo(30).toISOString() },
      })
      expect(codes(s)).toContain('PENDING_REVIEWS_STUCK')
    })
    it('fires when lastReviewActivity is null', () => {
      const s = fixture({
        checklist: { ...fixture().checklist, pendingReviewCount: 60 },
        health: { ...fixture().health, pendingReviewCount: 60, lastReviewActivity: null },
      })
      expect(codes(s)).toContain('PENDING_REVIEWS_STUCK')
    })
    it('does not fire when recent review activity', () => {
      const s = fixture({
        checklist: { ...fixture().checklist, pendingReviewCount: 60 },
        health: { ...fixture().health, pendingReviewCount: 60, lastReviewActivity: daysAgo(2).toISOString() },
      })
      expect(codes(s)).not.toContain('PENDING_REVIEWS_STUCK')
    })
    it('does not fire below 50 pending', () => {
      const s = fixture({
        checklist: { ...fixture().checklist, pendingReviewCount: 49 },
        health: { ...fixture().health, pendingReviewCount: 49, lastReviewActivity: null },
      })
      expect(codes(s)).not.toContain('PENDING_REVIEWS_STUCK')
    })
  })

  describe('INACTIVE_14D', () => {
    it('fires when no activity and >14d old', () => {
      const s = fixture({ createdAt: daysAgo(30), lastActivityAt: null })
      expect(codes(s)).toContain('INACTIVE_14D')
    })
    it('fires when last activity >14d ago', () => {
      const s = fixture({ createdAt: daysAgo(40), lastActivityAt: daysAgo(20) })
      expect(codes(s)).toContain('INACTIVE_14D')
    })
    it('does not fire when recent activity', () => {
      const s = fixture({ createdAt: daysAgo(40), lastActivityAt: daysAgo(2) })
      expect(codes(s)).not.toContain('INACTIVE_14D')
    })
    it('does not fire for brand new surgery', () => {
      const s = fixture({ createdAt: daysAgo(3), lastActivityAt: null })
      expect(codes(s)).not.toContain('INACTIVE_14D')
    })
  })

  describe('LIVE_BUT_IDLE', () => {
    it('fires when essentials done but zero active users for >14d', () => {
      const s = fixture({
        onboardingCompletedAt: daysAgo(30),
        essentialCount: 6,
        essentialTotal: 6,
        health: { ...fixture().health, activeUsersLast30: 0 },
      })
      expect(codes(s)).toContain('LIVE_BUT_IDLE')
    })
    it('does not fire when active users present', () => {
      const s = fixture({
        onboardingCompletedAt: daysAgo(30),
        essentialCount: 6,
        essentialTotal: 6,
        health: { ...fixture().health, activeUsersLast30: 3 },
      })
      expect(codes(s)).not.toContain('LIVE_BUT_IDLE')
    })
  })

  describe('AI_NOT_USED_14D', () => {
    it('fires when AI enabled, never used, >14d', () => {
      const s = fixture({
        features: ['ai_surgery_customisation'],
        aiCustomisationOccurred: false,
        createdAt: daysAgo(20),
      })
      expect(codes(s)).toContain('AI_NOT_USED_14D')
    })
    it('does not fire when aiCustomisationOccurred is null (lightweight unknown)', () => {
      const s = fixture({
        features: ['ai_surgery_customisation'],
        aiCustomisationOccurred: null,
        createdAt: daysAgo(30),
      })
      expect(codes(s)).not.toContain('AI_NOT_USED_14D')
    })
    it('does not fire when feature not enabled', () => {
      const s = fixture({ features: [], aiCustomisationOccurred: false, createdAt: daysAgo(30) })
      expect(codes(s)).not.toContain('AI_NOT_USED_14D')
    })
  })

  describe('STUCK_IN_SETUP_30D', () => {
    it('fires when in_progress and >30d old', () => {
      const s = fixture({ stage: 'in_progress', createdAt: daysAgo(45), essentialCount: 2 })
      expect(codes(s)).toContain('STUCK_IN_SETUP_30D')
    })
    it('does not fire when stage is live', () => {
      const s = fixture({ stage: 'live', createdAt: daysAgo(45) })
      expect(codes(s)).not.toContain('STUCK_IN_SETUP_30D')
    })
  })

  describe('GOLIVE_DATE_PASSED', () => {
    it('fires when contracted go-live is in the past and not live yet', () => {
      const s = fixture({
        stage: 'in_progress',
        essentialCount: 3,
        goLiveDate: daysAgo(10),
      })
      expect(codes(s)).toContain('GOLIVE_DATE_PASSED')
    })
    it('does not fire when already live', () => {
      const s = fixture({ stage: 'live', goLiveDate: daysAgo(10) })
      expect(codes(s)).not.toContain('GOLIVE_DATE_PASSED')
    })
    it('does not fire with no go-live date set', () => {
      const s = fixture({ stage: 'in_progress', goLiveDate: null })
      expect(codes(s)).not.toContain('GOLIVE_DATE_PASSED')
    })
  })

  describe('CLINICAL_GOVERNANCE_NOT_SIGNED_OFF_30D', () => {
    it('fires when requiresClinicalReview and >30d old', () => {
      const s = fixture({ requiresClinicalReview: true, createdAt: daysAgo(40) })
      expect(codes(s)).toContain('CLINICAL_GOVERNANCE_NOT_SIGNED_OFF_30D')
    })
    it('does not fire when already signed off', () => {
      const s = fixture({ requiresClinicalReview: false, createdAt: daysAgo(60) })
      expect(codes(s)).not.toContain('CLINICAL_GOVERNANCE_NOT_SIGNED_OFF_30D')
    })
  })

  describe('HIGH_RISK_NOT_CONFIGURED_14D', () => {
    it('fires when onboarding done 14d+ ago but high-risk still not configured', () => {
      const s = fixture({
        onboardingCompleted: true,
        onboardingCompletedAt: daysAgo(20),
        checklist: { ...fixture().checklist, highRiskConfigured: false },
      })
      expect(codes(s)).toContain('HIGH_RISK_NOT_CONFIGURED_14D')
    })
    it('does not fire when configured', () => {
      const s = fixture({
        onboardingCompleted: true,
        onboardingCompletedAt: daysAgo(30),
        checklist: { ...fixture().checklist, highRiskConfigured: true },
      })
      expect(codes(s)).not.toContain('HIGH_RISK_NOT_CONFIGURED_14D')
    })
  })

  describe('healthy baseline', () => {
    it('raises no flags for a fully healthy live surgery', () => {
      expect(codes(fixture())).toEqual([])
    })
  })
})
