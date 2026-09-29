/**
 * "Text cleanliness" (DocumentPage.quality.wordValidity). A proxy for clean
 * reading, not proof of correctness. The warn/fail lines are provisional
 * until the gold set calibrates them against character error rate.
 */
export const QUALITY_THRESHOLDS = { warn: 0.95, fail: 0.9 }

export type QualityLevel = 'good' | 'warn' | 'fail' | 'unknown'

export const qualityLevel = (value?: number, thresholds = QUALITY_THRESHOLDS): QualityLevel =>
  value === undefined ? 'unknown' : value >= thresholds.warn ? 'good' : value >= thresholds.fail ? 'warn' : 'fail'
