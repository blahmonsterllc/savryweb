import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseAmount } from '../lib/scale-ingredients.mjs'
import { parseIngredientLines } from '../lib/ingredient-lines.mjs'

test('1-1/2 is one and a half, not a range down to a half', () => {
  assert.deepEqual(parseAmount('1-1/2'), { low: 1.5, high: null })
  assert.deepEqual(parseAmount('2-3/4'), { low: 2.75, high: null })
  const [line] = parseIngredientLines('1-1/2 cups flour')
  assert.deepEqual(parseAmount(line?.amount), { low: 1.5, high: null })
})

test('real ranges stay ranges', () => {
  assert.deepEqual(parseAmount('2-3'), { low: 2, high: 3 })
  assert.deepEqual(parseAmount('1/2-1'), { low: 0.5, high: 1 })
  assert.deepEqual(parseAmount('2 to 3'), { low: 2, high: 3 })
  assert.deepEqual(parseAmount('2½-3'), { low: 2.5, high: 3 })
})

test('decimal comma, leading point and fraction slash', () => {
  assert.deepEqual(parseAmount('1,5'), { low: 1.5, high: null })
  assert.deepEqual(parseAmount('.5'), { low: 0.5, high: null })
  assert.deepEqual(parseAmount('1⁄2'), { low: 0.5, high: null })
  assert.equal(parseAmount('1,000'), null)
})
