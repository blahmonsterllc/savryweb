/**
 * Turns the way a cook writes an ingredient ("2 cups flour", "1 1/2 lb chicken
 * thighs, skin on", "a pinch of salt (optional)") into the amount, unit and
 * name Savry stores, so the site can scale servings and build grocery lists.
 * Plain JS so the Node test runner can exercise it and the browser can use it.
 */

const UNIT_ALIASES = {
  tsp: ['tsp', 'tsps', 'teaspoon', 'teaspoons', 't'],
  tbsp: ['tbsp', 'tbsps', 'tbs', 'tablespoon', 'tablespoons', 'T'],
  cup: ['cup', 'cups', 'c'],
  oz: ['oz', 'ozs', 'ounce', 'ounces'],
  lb: ['lb', 'lbs', 'pound', 'pounds'],
  g: ['g', 'gram', 'grams', 'gr'],
  kg: ['kg', 'kgs', 'kilogram', 'kilograms'],
  ml: ['ml', 'milliliter', 'milliliters', 'millilitre', 'millilitres'],
  l: ['l', 'liter', 'liters', 'litre', 'litres'],
  pinch: ['pinch', 'pinches'],
  clove: ['clove', 'cloves'],
  can: ['can', 'cans', 'tin', 'tins'],
  package: ['package', 'packages', 'pkg', 'packet', 'packets', 'bag', 'bags', 'box', 'boxes'],
  bunch: ['bunch', 'bunches'],
  slice: ['slice', 'slices'],
  stalk: ['stalk', 'stalks', 'rib', 'ribs'],
  sprig: ['sprig', 'sprigs'],
  head: ['head', 'heads'],
  stick: ['stick', 'sticks'],
  handful: ['handful', 'handfuls'],
  dash: ['dash', 'dashes'],
}

const UNIT_LOOKUP = new Map()
for (const [unit, aliases] of Object.entries(UNIT_ALIASES)) {
  for (const alias of aliases) UNIT_LOOKUP.set(alias.toLowerCase() === alias ? alias : alias, unit)
}

const UNICODE_FRACTIONS = { '½': '1/2', '⅓': '1/3', '⅔': '2/3', '¼': '1/4', '¾': '3/4', '⅛': '1/8', '⅜': '3/8', '⅝': '5/8', '⅞': '7/8' }

const AMOUNT = /^((?:\d+\s+)?\d+\/\d+|\d+(?:[.,]\d+)?)(?:\s*(?:-|–|to)\s*(?:\d+\s+)?\d+(?:\/\d+)?(?:[.,]\d+)?)?/

function normalize(line) {
  let text = line.replace(/[ \t]+/g, ' ').trim()
  for (const [glyph, ascii] of Object.entries(UNICODE_FRACTIONS)) text = text.replace(new RegExp(`(\\d)${glyph}`, 'g'), `$1 ${ascii}`).replace(new RegExp(glyph, 'g'), ascii)
  // A pasted list's own numbering ("3. 2 tbsp butter"): a number, a dot or bracket, a space.
  return text.replace(/^[-*•·]\s*/, '').replace(/^\d+[.)]\s+/, '').trim()
}

/**
 * @param {string} line
 * @returns {{ amount: string, unit: string, name: string, isOptional: boolean } | null} null for an empty line
 */
export function parseIngredientLine(line) {
  let text = normalize(line)
  if (!text) return null

  let isOptional = false
  if (/\(\s*optional\s*\)/i.test(text) || /,\s*optional\s*$/i.test(text) || /^optional[:\s]/i.test(text)) {
    isOptional = true
    text = text.replace(/\(\s*optional\s*\)/gi, '').replace(/,\s*optional\s*$/i, '').replace(/^optional[:\s]+/i, '').trim()
  }

  let amount = ''
  const match = AMOUNT.exec(text)
  if (match) {
    amount = match[0].replace(/\s+/g, ' ').replace(/\s*(?:–|to)\s*/, '-').trim()
    text = text.slice(match[0].length).trim()
  } else if (/^(a|an|one)\s+(?:pinch|dash|handful|bunch|clove|can|package|slice|stalk|sprig|head)\b/i.test(text)) {
    amount = '1'
    text = text.replace(/^(a|an|one)\s+/i, '')
  }

  let unit = ''
  const unitMatch = /^([A-Za-z]+)\.?(?=\s|$)/.exec(text)
  if (unitMatch) {
    const word = unitMatch[1]
    const key = UNIT_LOOKUP.get(word) ?? UNIT_LOOKUP.get(word.toLowerCase())
    if (key && (amount || key === 'pinch' || key === 'dash' || key === 'handful')) {
      unit = key
      text = text.slice(unitMatch[0].length).trim().replace(/^of\s+/i, '')
    }
  }

  const name = text.replace(/\s+/g, ' ').trim()
  if (!name && !amount) return null
  return { amount, unit, name: name || 'ingredient', isOptional }
}

/** Lines in, structured rows out; blank lines are skipped. */
export function parseIngredientLines(text) {
  return String(text ?? '').split(/\r?\n/).map(parseIngredientLine).filter(Boolean)
}

/**
 * Section headers in the text forms the admin editor uses. A line
 * "## For the sauce" starts a section ("For the sauce") and "##" on its own
 * ends one; "For the sauce:" (a short line ending in a colon, with no amount)
 * is read as a header too, since that is how cooks write them. Up to 60
 * characters, the database's limit.
 * @param {string} line
 * @returns {{ section: string | null } | null} null when the line is not a header
 */
export function sectionHeader(line) {
  const text = String(line ?? '').trim()
  const marked = /^##(?!#)\s*(.*)$/.exec(text)
  if (marked) return { section: marked[1].replace(/:\s*$/, '').trim().slice(0, 60) || null }
  const colon = /^([A-Za-z][^:]{0,58}):$/.exec(text)
  if (colon && !AMOUNT.test(normalize(colon[1]))) return { section: colon[1].trim() }
  return null
}

/**
 * Ingredient lines with "## Section" headers, as the admin editor writes them.
 * Lines before any header have no section.
 * @param {string} text
 * @returns {{ amount: string, unit: string, name: string, isOptional: boolean, section: string | null }[]}
 */
export function parseIngredientSections(text) {
  let section = null
  const rows = []
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const header = sectionHeader(line)
    if (header) { section = header.section; continue }
    const row = parseIngredientLine(line)
    if (row) rows.push({ ...row, section })
  }
  return rows
}

/** The reverse: rows to lines, with a "## Section" line wherever the section changes. */
export function ingredientRowsToText(rows) {
  const lines = []
  let section = null
  for (const row of rows ?? []) {
    if (!row || !(row.name || row.amount)) continue
    const next = row.section || null
    if (next !== section) {
      lines.push(next ? `## ${next}` : '##')
      section = next
    }
    lines.push([row.amount, row.unit, row.name].filter(Boolean).join(' ') + (row.isOptional ? ' (optional)' : ''))
  }
  return lines.join('\n')
}

/**
 * One step per line, or paragraphs separated by a blank line. Leading
 * numbering ("1.", "2)", "Step 3:") is dropped; Savry numbers them itself.
 */
export function parseInstructionLines(text) {
  const raw = String(text ?? '')
  const parts = /\n\s*\n/.test(raw) ? raw.split(/\n\s*\n/) : raw.split(/\r?\n/)
  return parts
    .map((part) => part.replace(/\s*\n\s*/g, ' ').replace(/^\s*(?:step\s*)?\d+\s*[.):-]\s*/i, '').trim())
    .filter(Boolean)
}

const TIMER = /\s*\[timer\s+(?:(\d{1,2}):)?(\d{1,3}):(\d{2})\]\s*$/i

/** "[timer 25:00]" or "[timer 1:30:00]" for a step's countdown, as the admin editor writes it. */
export function formatTimer(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const sec = String(total % 60).padStart(2, '0')
  return h > 0 ? `[timer ${h}:${String(m).padStart(2, '0')}:${sec}]` : `[timer ${m}:${sec}]`
}

/**
 * Steps with "## Section" headers and an optional "[timer mm:ss]" (or
 * h:mm:ss) at the end of a step, as the admin editor writes them. Between
 * headers, steps split exactly as parseInstructionLines splits them.
 * @param {string} text
 * @returns {{ instruction: string, section: string | null, timerSeconds: number | null }[]}
 */
export function parseStepSections(text) {
  const groups = [{ section: null, lines: [] }]
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const header = sectionHeader(line)
    if (header) groups.push({ section: header.section, lines: [] })
    else groups[groups.length - 1].lines.push(line)
  }
  const steps = []
  for (const group of groups) {
    for (const part of parseInstructionLines(group.lines.join('\n'))) {
      const timer = TIMER.exec(part)
      const seconds = timer ? Number(timer[1] ?? 0) * 3600 + Number(timer[2]) * 60 + Number(timer[3]) : null
      const instruction = timer ? part.slice(0, timer.index).trim() : part
      if (instruction) steps.push({ instruction, section: group.section, timerSeconds: seconds && seconds > 0 ? seconds : null })
    }
  }
  return steps
}

/** The reverse: one step per line, "## Section" where the section changes, the timer kept at the end. */
export function stepRowsToText(steps) {
  const lines = []
  let section = null
  for (const step of steps ?? []) {
    const row = typeof step === 'string' ? { instruction: step, section: null, timerSeconds: null } : step
    if (!row?.instruction) continue
    const next = row.section || null
    if (next !== section) {
      lines.push(next ? `## ${next}` : '##')
      section = next
    }
    const instruction = String(row.instruction).replace(/\s*\n\s*/g, ' ').trim()
    lines.push(row.timerSeconds ? `${instruction} ${formatTimer(row.timerSeconds)}` : instruction)
  }
  return lines.join('\n')
}
