import type { SurgerySetupSnapshot } from './surgerySetup'

export type FlagSeverity = 'warn' | 'critical'

export type SetupFlag = {
  code: string
  severity: FlagSeverity
  message: string
  since?: string
}

const DAY_MS = 24 * 60 * 60 * 1000

const THRESHOLDS = {
  onboardingNotStartedDays: 14,
  onboardingStalledDays: 21,
  noUsersAfterOnboardingDays: 7,
  pendingReviewsStuckCount: 50,
  pendingReviewsStuckInactivityDays: 14,
  inactiveDays: 14,
  liveButIdleMinAgeDays: 14,
  aiNotUsedDays: 14,
  highRiskNotConfiguredDays: 14,
  stuckInSetupDays: 30,
  clinicalReviewNotSignedOffDays: 30,
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / DAY_MS)
}

type FlagRule = {
  code: string
  severity: FlagSeverity
  evaluate: (snapshot: SurgerySetupSnapshot, now: Date) => SetupFlag | null
}

export const FLAG_RULES: FlagRule[] = [
  {
    code: 'NO_ONBOARDING_STARTED_14D',
    severity: 'warn',
    evaluate: (s, now) => {
      const days = daysBetween(now, s.createdAt)
      if (s.onboardingStarted || days <= THRESHOLDS.onboardingNotStartedDays) return null
      return {
        code: 'NO_ONBOARDING_STARTED_14D',
        severity: 'warn',
        message: `Created ${days}d ago, onboarding not started`,
        since: s.createdAt.toISOString(),
      }
    },
  },
  {
    code: 'ONBOARDING_STALLED_21D',
    severity: 'warn',
    evaluate: (s, now) => {
      if (!s.onboardingStarted || s.onboardingCompleted || !s.onboardingUpdatedAt) return null
      const days = daysBetween(now, s.onboardingUpdatedAt)
      if (days <= THRESHOLDS.onboardingStalledDays) return null
      return {
        code: 'ONBOARDING_STALLED_21D',
        severity: 'warn',
        message: `Onboarding stalled — last edit ${days}d ago`,
        since: s.onboardingUpdatedAt.toISOString(),
      }
    },
  },
  {
    code: 'NO_STANDARD_USERS_7D_AFTER_COMPLETION',
    severity: 'critical',
    evaluate: (s, now) => {
      if (!s.onboardingCompleted || !s.onboardingCompletedAt) return null
      const days = daysBetween(now, s.onboardingCompletedAt)
      if (days <= THRESHOLDS.noUsersAfterOnboardingDays || s.checklist.standardUsersCount > 0) return null
      return {
        code: 'NO_STANDARD_USERS_7D_AFTER_COMPLETION',
        severity: 'critical',
        message: `Onboarding done ${days}d ago but no team members added`,
        since: s.onboardingCompletedAt.toISOString(),
      }
    },
  },
  {
    code: 'PENDING_REVIEWS_STUCK',
    severity: 'critical',
    evaluate: (s, now) => {
      if (s.checklist.pendingReviewCount < THRESHOLDS.pendingReviewsStuckCount) return null
      const lastReviewIso = s.health.lastReviewActivity
      const lastReview = lastReviewIso ? new Date(lastReviewIso) : null
      const daysSinceReview = lastReview ? daysBetween(now, lastReview) : null
      if (lastReview !== null && daysSinceReview! <= THRESHOLDS.pendingReviewsStuckInactivityDays) return null
      return {
        code: 'PENDING_REVIEWS_STUCK',
        severity: 'critical',
        message:
          daysSinceReview === null
            ? `${s.checklist.pendingReviewCount} symptoms pending review, no activity yet`
            : `${s.checklist.pendingReviewCount} symptoms pending review, no activity for ${daysSinceReview}d`,
        since: lastReviewIso ?? undefined,
      }
    },
  },
  {
    code: 'INACTIVE_14D',
    severity: 'warn',
    evaluate: (s, now) => {
      const daysSinceCreated = daysBetween(now, s.createdAt)
      if (daysSinceCreated <= THRESHOLDS.inactiveDays) return null
      const last = s.lastActivityAt
      if (last && daysBetween(now, last) <= THRESHOLDS.inactiveDays) return null
      const days = last ? daysBetween(now, last) : daysSinceCreated
      return {
        code: 'INACTIVE_14D',
        severity: 'warn',
        message: last
          ? `No engagement events for ${days}d`
          : `No engagement events in ${daysSinceCreated}d since created`,
        since: last?.toISOString(),
      }
    },
  },
  {
    code: 'LIVE_BUT_IDLE',
    severity: 'warn',
    evaluate: (s, now) => {
      const essentialComplete = s.essentialCount === s.essentialTotal
      if (!essentialComplete || s.health.activeUsersLast30 > 0) return null
      const anchor = s.onboardingCompletedAt ?? s.createdAt
      const days = daysBetween(now, anchor)
      if (days <= THRESHOLDS.liveButIdleMinAgeDays) return null
      return {
        code: 'LIVE_BUT_IDLE',
        severity: 'warn',
        message: `Setup complete but no active users in last 30d`,
        since: anchor.toISOString(),
      }
    },
  },
  {
    code: 'AI_NOT_USED_14D',
    severity: 'warn',
    evaluate: (s, now) => {
      if (!s.features.includes('ai_surgery_customisation')) return null
      // In lightweight mode we don't know — skip silently.
      if (s.aiCustomisationOccurred === null) return null
      if (s.aiCustomisationOccurred) return null
      const days = daysBetween(now, s.createdAt)
      if (days <= THRESHOLDS.aiNotUsedDays) return null
      return {
        code: 'AI_NOT_USED_14D',
        severity: 'warn',
        message: `AI enabled but never run (${days}d old)`,
      }
    },
  },
  {
    code: 'HIGH_RISK_NOT_CONFIGURED_14D',
    severity: 'warn',
    evaluate: (s, now) => {
      if (!s.onboardingCompleted || !s.onboardingCompletedAt) return null
      if (s.checklist.highRiskConfigured) return null
      const days = daysBetween(now, s.onboardingCompletedAt)
      if (days <= THRESHOLDS.highRiskNotConfiguredDays) return null
      return {
        code: 'HIGH_RISK_NOT_CONFIGURED_14D',
        severity: 'warn',
        message: `High-risk buttons still unconfigured ${days}d after onboarding`,
        since: s.onboardingCompletedAt.toISOString(),
      }
    },
  },
  {
    code: 'STUCK_IN_SETUP_30D',
    severity: 'critical',
    evaluate: (s, now) => {
      const days = daysBetween(now, s.createdAt)
      if (days <= THRESHOLDS.stuckInSetupDays) return null
      if (s.stage !== 'in_progress') return null
      return {
        code: 'STUCK_IN_SETUP_30D',
        severity: 'critical',
        message: `In setup for ${days}d without completing essentials`,
        since: s.createdAt.toISOString(),
      }
    },
  },
  {
    code: 'GOLIVE_DATE_PASSED',
    severity: 'critical',
    evaluate: (s, now) => {
      if (!s.goLiveDate) return null
      if (s.goLiveDate.getTime() >= now.getTime()) return null
      if (s.stage === 'live') return null
      const iso = s.goLiveDate.toISOString().slice(0, 10)
      return {
        code: 'GOLIVE_DATE_PASSED',
        severity: 'critical',
        message: `Contracted go-live ${iso} passed, still in "${s.stage.replace('_', ' ')}"`,
        since: s.goLiveDate.toISOString(),
      }
    },
  },
  {
    code: 'CLINICAL_GOVERNANCE_NOT_SIGNED_OFF_30D',
    severity: 'warn',
    evaluate: (s, now) => {
      if (!s.requiresClinicalReview) return null
      const days = daysBetween(now, s.createdAt)
      if (days <= THRESHOLDS.clinicalReviewNotSignedOffDays) return null
      return {
        code: 'CLINICAL_GOVERNANCE_NOT_SIGNED_OFF_30D',
        severity: 'warn',
        message: `Clinical review not signed off after ${days}d`,
      }
    },
  },
]

export function evaluateFlags(snapshot: SurgerySetupSnapshot, now: Date = new Date()): SetupFlag[] {
  const flags: SetupFlag[] = []
  for (const rule of FLAG_RULES) {
    const f = rule.evaluate(snapshot, now)
    if (f) flags.push(f)
  }
  return flags
}
