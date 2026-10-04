import test from 'node:test'
import assert from 'node:assert/strict'
import { ingredientRowsToText, parseIngredientLine, parseIngredientLines, parseInstructionLines } from '../lib/ingredient-lines.mjs'

test('an ingredient written the natural way splits into amount, unit and name', () => {
  assert.deepEqual(parseIngredientLine('2 cups all-purpose flour'), { amount: '2', unit: 'cup', name: 'all-purpose flour', isOptional: false })
  assert.deepEqual(parseIngredientLine('1 1/2 lb chicken thighs, skin on'), { amount: '1 1/2', unit: 'lb', name: 'chicken thighs, skin on', isOptional: false })
  assert.deepEqual(parseIngredientLine('3 tablespoons of olive oil'), { amount: '3', unit: 'tbsp', name: 'olive oil', isOptional: false })
  assert.deepEqual(parseIngredientLine('½ tsp salt'), { amount: '1/2', unit: 'tsp', name: 'salt', isOptional: false })
  assert.deepEqual(parseIngredientLine('2 large eggs'), { amount: '2', unit: '', name: 'large eggs', isOptional: false })
  assert.deepEqual(parseIngredientLine('a pinch of nutmeg'), { amount: '1', unit: 'pinch', name: 'nutmeg', isOptional: false })
  assert.deepEqual(parseIngredientLine('400g can chopped tomatoes'), { amount: '400', unit: 'g', name: 'can chopped tomatoes', isOptional: false })
  assert.deepEqual(parseIngredientLine('2-3 cloves garlic'), { amount: '2-3', unit: 'clove', name: 'garlic', isOptional: false })
})

test('optional is understood however it is written, and list markers are ignored', () => {
  assert.equal(parseIngredientLine('fresh parsley (optional)').isOptional, true)
  assert.equal(parseIngredientLine('1 lime, optional').isOptional, true)
  assert.equal(parseIngredientLine('- 1 cup rice').amount, '1')
  assert.equal(parseIngredientLine('3. 2 tbsp butter').amount, '2')
  assert.equal(parseIngredientLine('   '), null)
})

test('a plain name with no amount still becomes an ingredient', () => {
  assert.deepEqual(parseIngredientLine('salt and pepper'), { amount: '', unit: '', name: 'salt and pepper', isOptional: false })
  assert.equal(parseIngredientLine('Cup of coffee').unit, '', 'a unit word with no amount is part of the name')
})

test('lines round-trip through the saved-draft text form', () => {
  const rows = parseIngredientLines('2 cups flour\n\n1 tsp salt (optional)\nbutter')
  assert.equal(rows.length, 3)
  assert.equal(ingredientRowsToText(rows), '2 cup flour\n1 tsp salt (optional)\nbutter')
})

test('steps come one per line or one per paragraph, without their numbering', () => {
  assert.deepEqual(parseInstructionLines('1. Heat the oven to 200C.\n2) Toss the vegetables with oil.\nStep 3: Roast for 25 minutes.'), ['Heat the oven to 200C.', 'Toss the vegetables with oil.', 'Roast for 25 minutes.'])
  assert.deepEqual(parseInstructionLines('Heat the oven\nto 200C.\n\nRoast until\nbrowned.'), ['Heat the oven to 200C.', 'Roast until browned.'])
})
