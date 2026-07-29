/**
 * Feature flag keys shared between server and client code.
 *
 * `src/lib/features.ts` and `src/lib/ensureFeatures.ts` are server-only, so
 * client components must import flag keys from here instead.
 */

/**
 * When enabled for a surgery, the Under-5 / 5–17 / Adult age filter and age
 * badges are hidden and symptoms describe age-specific advice within a
 * single entry. Surgery-level only (no user overrides).
 */
export const FEATURE_HIDE_AGE_BANDS = 'hide_age_bands'

/**
 * When enabled for a surgery, Practice Handbook editors can generate AI
 * "smart visual" layouts of handbook items, and staff can switch between the
 * standard view and the saved visual.
 */
export const FEATURE_AI_HANDBOOK_VISUALS = 'ai_handbook_visuals'
