// Scales Savry's national grocery prices to where the cook lives, using the
// BEA's Regional Price Parities for goods by state and the USPS three-digit
// ZIP prefix to find the state. The app runs the same lookup in Swift.

/**
 * @param {string} zip the cook's ZIP code, five digits (ZIP+4 is fine)
 * @param {{ states: Record<string, { name: string, multiplier: number }>, zipPrefixes: [number, number, string][] }} table content/cost/regional-prices.json
 * @returns {{ multiplier: number, state: string | null, stateName: string | null }} 1 and null when the ZIP is unknown
 */
export function regionalPrice(zip, table) {
  const digits = String(zip ?? '').replace(/\D/g, '')
  if (digits.length < 5) return { multiplier: 1, state: null, stateName: null }
  const prefix = Number(digits.slice(0, 3))
  const hit = table.zipPrefixes.find(([first, last]) => prefix >= first && prefix <= last)
  const state = hit ? table.states[hit[2]] : null
  if (!state) return { multiplier: 1, state: null, stateName: null }
  return { multiplier: state.multiplier, state: hit[2], stateName: state.name }
}

/** "6% below the US average", "12% above the US average", or "about the US average". */
export function describeMultiplier(multiplier) {
  const percent = Math.round((multiplier - 1) * 100)
  if (percent === 0) return 'about the US average'
  return `${Math.abs(percent)}% ${percent > 0 ? 'above' : 'below'} the US average`
}
