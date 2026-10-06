// Scales ingredient amounts when a cook changes the number of servings.
// Plain JS (with JSDoc types) so the Node test runner can import it directly.

const UNICODE_FRACTIONS = { '½': '1/2', '⅓': '1/3', '⅔': '2/3', '¼': '1/4', '¾': '3/4', '⅛': '1/8', '⅜': '3/8', '⅝': '5/8', '⅞': '7/8' }
const FRACTIONS = [[0, ''], [1 / 8, '1/8'], [1 / 4, '1/4'], [1 / 3, '1/3'], [3 / 8, '3/8'], [1 / 2, '1/2'], [5 / 8, '5/8'], [2 / 3, '2/3'], [3 / 4, '3/4'], [7 / 8, '7/8'], [1, '']]
const PLURALS = { cup: 'cups', clove: 'cloves', can: 'cans', sprig: 'sprigs', piece: 'pieces', slice: 'slices', bunch: 'bunches', pinch: 'pinches', stalk: 'stalks', head: 'heads', stick: 'sticks', package: 'packages', jar: 'jars', bottle: 'bottles', dash: 'dashes', handful: 'handfuls', sheet: 'sheets', strip: 'strips', ear: 'ears', fillet: 'fillets', leaf: 'leaves' }
const SINGULARS = Object.fromEntries(Object.entries(PLURALS).map(([one, many]) => [many, one]))
// Words a "makes 12 …" recipe yields whose singular is not the plural minus its -s / -es.
const IRREGULAR_SINGULARS = { loaves: 'loaf', halves: 'half', knives: 'knife', cookies: 'cookie', brownies: 'brownie', pies: 'pie', quiches: 'quiche', smoothies: 'smoothie', pastries: 'pastry', dozen: 'dozen' }

/** @param {string} text @returns {number | null} */
function parseNumber(text) {
  const value = text.trim()
  let match = value.match(/^(\d+(?:\.\d+)?)$/)
  if (match) return Number(match[1])
  match = value.match(/^(\d+)\s*\/\s*(\d+)$/)
  if (match && Number(match[2]) !== 0) return Number(match[1]) / Number(match[2])
  match = value.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/)
  if (match && Number(match[3]) !== 0) return Number(match[1]) + Number(match[2]) / Number(match[3])
  return null
}

/**
 * Reads "2", "1/2", "1 1/2", "1½", "0.75", or a range such as "2-3".
 * @param {string | null | undefined} text
 * @returns {{ low: number, high: number | null } | null} null when it is not a number ("a pinch", "to taste")
 */
export function parseAmount(text) {
  if (typeof text !== 'string' || !text.trim()) return null
  const normalized = text
    .replace(/(\d)?([½⅓⅔¼¾⅛⅜⅝⅞])/g, (_, whole, fraction) => (whole ? `${whole} ` : '') + UNICODE_FRACTIONS[fraction])
    .replace(/⁄/g, '/') // the fraction slash some sites paste ("1⁄2")
    .replace(/(^|[^\d])\.(\d)/g, (_, before, digit) => `${before}0.${digit}`) // ".5"
    .replace(/^(\d+),(\d{1,2})$/, '$1.$2') // "1,5": a decimal comma, not a thousands separator
    .trim()
  const single = parseNumber(normalized)
  if (single !== null) return { low: single, high: null }
  const range = normalized.match(/^(.+?)\s*(-|–|—|to)\s*(.+)$/)
  if (range) {
    const low = parseNumber(range[1])
    const high = parseNumber(range[3])
    // "1-1/2" is how many recipes write one and a half, not a range down to a half.
    if (low !== null && high !== null && range[2] === '-' && /^\d+$/.test(range[1].trim()) && /^\d+\s*\/\s*\d+$/.test(range[3].trim()) && high < 1) {
      return { low: low + high, high: null }
    }
    if (low !== null && high !== null) return { low, high }
  }
  return null
}

/**
 * Kitchen-friendly number: whole numbers and the fractions a measuring set has.
 * @param {number} value
 */
export function formatAmount(value) {
  if (!Number.isFinite(value) || value <= 0) return ''
  if (value >= 20) return String(Math.round(value))
  let whole = Math.floor(value + 1e-9)
  const rest = value - whole
  let best = FRACTIONS[0]
  for (const candidate of FRACTIONS) if (Math.abs(candidate[0] - rest) < Math.abs(best[0] - rest)) best = candidate
  if (best[0] === 1) whole += 1
  // Never round a real quantity down to nothing.
  if (whole === 0 && best[1] === '') return '1/8'
  return [whole > 0 ? String(whole) : '', best[1]].filter(Boolean).join(' ')
}

/** @param {string | null | undefined} unit @param {number} amount */
function unitFor(unit, amount) {
  if (!unit) return unit ?? null
  const key = unit.trim().toLowerCase()
  const singular = SINGULARS[key] ?? key
  if (!(singular in PLURALS)) return unit
  return amount > 1 + 1e-9 ? PLURALS[singular] : singular
}

/**
 * One ingredient line at the chosen scale. Amounts that are not numbers are
 * left exactly as the cook wrote them.
 * @param {{ name: string, amount: string | null, unit: string | null, isOptional?: boolean }} ingredient
 * @param {number} factor 1 leaves the recipe as written
 */
export function scaledIngredientLine(ingredient, factor) {
  const parsed = parseAmount(ingredient.amount)
  let amount = ingredient.amount
  let unit = ingredient.unit
  if (parsed) {
    const low = parsed.low * factor
    const high = parsed.high === null ? null : parsed.high * factor
    // As written when unscaled; only reformat once the cook changes the servings.
    if (Math.abs(factor - 1) > 1e-9) amount = high === null ? formatAmount(low) : `${formatAmount(low)}–${formatAmount(high)}`
    unit = unitFor(ingredient.unit, high ?? low)
  }
  return [amount, unit, ingredient.name].filter(Boolean).join(' ') + (ingredient.isOptional ? ' (optional)' : '')
}

/**
 * The singular of a unit or yield word, for labels like "per sandwich":
 * "sandwiches" → "sandwich", "loaves" → "loaf", "cookies" → "cookie",
 * "mini muffins" → "mini muffin". Words already singular are returned as
 * they are. Only the last word changes; its case is kept.
 * @param {string | null | undefined} word
 * @returns {string}
 */
export function singularUnit(word) {
  const text = (word ?? '').trim()
  const match = /^(.*?)([A-Za-z]+)$/.exec(text)
  if (!match) return text
  const [, head, last] = match
  const lower = last.toLowerCase()
  let one = IRREGULAR_SINGULARS[lower] ?? SINGULARS[lower]
  if (!one) {
    if (/[^aeiou]ies$/.test(lower)) one = lower.slice(0, -3) + 'y'
    else if (/(ch|sh|ss|x|z|[^aeiou]o)es$/.test(lower)) one = lower.slice(0, -2)
    else if (/[^su]s$/.test(lower)) one = lower.slice(0, -1)
    else one = lower
  }
  const cased = last === last.toUpperCase() && last.length > 1 ? one.toUpperCase() : last[0] === last[0].toUpperCase() ? one[0].toUpperCase() + one.slice(1) : one
  return head + cased
}
