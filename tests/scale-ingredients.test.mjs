import test from 'node:test'
import assert from 'node:assert/strict'
import { formatAmount, parseAmount, scaledIngredientLine } from '../lib/scale-ingredients.mjs'

const line = (amount, unit, name, factor, isOptional = false) => scaledIngredientLine({ amount, unit, name, isOptional }, factor)

test('amounts are read in every form the catalog uses', () => {
  assert.deepEqual(parseAmount('2'), { low: 2, high: null })
  assert.deepEqual(parseAmount('1/2'), { low: 0.5, high: null })
  assert.deepEqual(parseAmount('1 1/2'), { low: 1.5, high: null })
  assert.deepEqual(parseAmount('1½'), { low: 1.5, high: null })
  assert.deepEqual(parseAmount('¾'), { low: 0.75, high: null })
  assert.deepEqual(parseAmount('0.25'), { low: 0.25, high: null })
  assert.deepEqual(parseAmount('2-3'), { low: 2, high: 3 })
  assert.deepEqual(parseAmount('2 to 3'), { low: 2, high: 3 })
  assert.equal(parseAmount('a pinch'), null)
  assert.equal(parseAmount('1/0'), null)
  assert.equal(parseAmount(null), null)
})

test('scaled amounts come out as kitchen fractions', () => {
  assert.equal(formatAmount(0.5), '1/2')
  assert.equal(formatAmount(1.5), '1 1/2')
  assert.equal(formatAmount(0.3333), '1/3')
  assert.equal(formatAmount(2.6667), '2 2/3')
  assert.equal(formatAmount(2.98), '3')
  assert.equal(formatAmount(0.01), '1/8', 'a real quantity never rounds to nothing')
  assert.equal(formatAmount(37.5), '38')
})

test('a recipe left as written is shown exactly as the cook wrote it', () => {
  assert.equal(line('1 1/2', 'cup', 'flour', 1), '1 1/2 cups flour')
  assert.equal(line('1', 'cup', 'milk', 1), '1 cup milk')
  assert.equal(line('0.25', 'tsp', 'salt', 1), '0.25 tsp salt')
  assert.equal(line(null, null, 'salt, to taste', 1), 'salt, to taste')
})

test('doubling and halving scale amounts and units together', () => {
  assert.equal(line('1', 'cup', 'milk', 2), '2 cups milk')
  assert.equal(line('2', 'cups', 'milk', 0.5), '1 cup milk')
  assert.equal(line('1 1/2', 'tsp', 'cumin', 2), '3 tsp cumin')
  assert.equal(line('1/2', 'tbsp', 'oil', 0.5), '1/4 tbsp oil')
  assert.equal(line('3', 'clove', 'garlic', 2), '6 cloves garlic')
  assert.equal(line('2-3', null, 'limes', 2), '4–6 limes')
  assert.equal(line('1', 'can', 'white beans', 1.5, true), '1 1/2 cans white beans (optional)')
  assert.equal(line('a pinch', null, 'saffron', 3), 'a pinch saffron', 'words are never rescaled')
})
