// Kroger-family shelf prices as a gauge for Savry's national price table.
// Shared by the sampler, the aggregate endpoint, the monthly refresh, and tests.

/** Store locations sampled in rotation: one region a day, spread across the country. */
export const SAMPLE_ZIPS = ['43017', '98101', '30309', '75201', '80202', '90012', '85004', '27601']

/** A shelf price brought to the US average by the state's price level. */
export function nationalEquivalent(perKg, multiplier) {
  const m = multiplier > 0 ? multiplier : 1
  return Math.round((perKg / m) * 100) / 100
}

export function median(values) {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b)
  if (sorted.length === 0) return null
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 100) / 100
}

/**
 * The next table price for a food: a step from the current price toward the
 * observed median, never more than `maxStep` (25%) of the current price in a
 * month, so one odd month cannot swing a price and the table converges over
 * a few months instead.
 */
export function blendTowardObserved(current, observed, maxStep = 0.25) {
  if (!(current > 0) || !(observed > 0)) return current
  const limit = current * maxStep
  const step = Math.max(-limit, Math.min(limit, observed - current))
  return Math.round((current + step) * 100) / 100
}

/** Observations strong enough to use: at least this many different states. */
export const MIN_STATES = 3
