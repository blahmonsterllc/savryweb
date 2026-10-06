import { test } from 'node:test'
import assert from 'node:assert/strict'
import { detectAllergens } from '../lib/allergens.mjs'

const names = (lines, labels) => detectAllergens(lines.map((name) => ({ name })), labels).map((a) => a.allergen)

test('hazelnuts under every name are tree nuts', () => {
  for (const line of ['1 cup hazelnuts', '1/2 cup Nutella', 'chopped filberts', 'gianduja', '2 tbsp Frangelico', 'praline paste']) {
    assert.deepEqual(names([line]), ['Tree nuts'], line)
  }
})

test('lookalikes are not flagged', () => {
  assert.deepEqual(names(['1 can water chestnuts', '1 cup coconut milk', '2 tbsp peanut butter']), ['Peanuts'])
  assert.deepEqual(names(['2 cups almond flour']), ['Tree nuts'])
  assert.deepEqual(names(['1 cup rice noodles']), [])
})

test('the recipe labels count, in the words cooks use', () => {
  assert.deepEqual(names(['1 cup rice'], ['dairy', 'hazelnuts']), ['Milk', 'Tree nuts'])
  assert.deepEqual(names(['1 cup rice'], ['egg']), ['Eggs'])
})

test('lines behind each allergen are listed', () => {
  const found = detectAllergens([{ name: 'unsalted butter' }, { name: 'walnuts' }, { name: 'flour' }])
  assert.deepEqual(found, [
    { allergen: 'Milk', lines: ['unsalted butter'] },
    { allergen: 'Tree nuts', lines: ['walnuts'] },
    { allergen: 'Wheat', lines: ['flour'] },
  ])
})
