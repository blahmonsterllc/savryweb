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

test('sections and step timers survive the admin editor\'s text', async () => {
  const { parseIngredientSections, parseStepSections, stepRowsToText, sectionHeader } = await import('../lib/ingredient-lines.mjs')
  const rows = [
    { amount: '2', unit: 'cup', name: 'flour', isOptional: false, section: null },
    { amount: '1', unit: 'tbsp', name: 'butter', isOptional: false, section: 'Sauce' },
    { amount: '1', unit: 'cup', name: 'cheese', isOptional: true, section: 'Topping' },
    { amount: '', unit: '', name: 'salt', isOptional: false, section: null },
  ]
  const text = ingredientRowsToText(rows)
  assert.equal(text, '2 cup flour\n## Sauce\n1 tbsp butter\n## Topping\n1 cup cheese (optional)\n##\nsalt')
  assert.deepEqual(parseIngredientSections(text), rows, 'ingredients round-trip with their sections')
  assert.equal(parseIngredientSections('For the glaze:\n1 cup sugar')[0].section, 'For the glaze', 'a cook\'s "For the …:" line is a header')

  const steps = [
    { instruction: 'Heat the oven.', section: null, timerSeconds: null },
    { instruction: 'Melt the butter.', section: 'Sauce', timerSeconds: 300 },
    { instruction: 'Whisk in the flour.', section: 'Sauce', timerSeconds: null },
    { instruction: 'Bake until golden.', section: 'Bake', timerSeconds: 3930 },
  ]
  const stepText = stepRowsToText(steps)
  assert.equal(stepText, 'Heat the oven.\n## Sauce\nMelt the butter. [timer 5:00]\nWhisk in the flour.\n## Bake\nBake until golden. [timer 1:05:30]')
  assert.deepEqual(parseStepSections(stepText), steps, 'steps round-trip with sections and timers')
  assert.deepEqual(parseStepSections('1. Heat the oven\nto 200C.\n\nRoast until\nbrowned.').map((s) => s.instruction), ['Heat the oven to 200C.', 'Roast until browned.'], 'paragraph steps split as before')
  assert.equal(stepRowsToText(['Chop.', 'Fry.']), 'Chop.\nFry.', 'plain string steps still work')

  assert.equal(sectionHeader('Note: stir often'), null)
  assert.equal(sectionHeader('2 cups:'), null, 'an amount is never a header')
  assert.equal(sectionHeader('### big'), null)
  assert.deepEqual(sectionHeader('##'), { section: null })
})

test('admin edits keep sections, timers, and a cook\'s package-label nutrition', async () => {
  const { readFile } = await import('node:fs/promises')
  const api = await readFile(new URL('../pages/api/admin/recipes.ts', import.meta.url), 'utf8')
  assert.match(api, /parseIngredientSections\(/)
  assert.match(api, /parseStepSections\(/)
  assert.match(api, /nutrition_source === 'package_label'/, 'label nutrition is kept when the engine cannot cover the recipe')
  assert.match(api, /keepLabel \? \{\} : nutrition/)
  const migration = await readFile(new URL('../supabase/migrations/20261006030000_admin_edit_keeps_sections.sql', import.meta.url), 'utf8')
  assert.match(migration, /insert into public\.recipe_ingredients \(recipe_id, position, section, name, amount, unit, is_optional\)/)
  assert.match(migration, /insert into public\.recipe_steps \(recipe_id, position, section, instruction, timer_seconds\)/)
  assert.match(migration, /insert into public\.recipe_versions/, 'the version before the edit is still kept')
  assert.match(migration, /revoke all on function public\.admin_update_recipe\(uuid, jsonb\) from public, anon, authenticated/)
  assert.match(migration, /revoke all on function public\.admin_recipe_detail\(uuid\) from public, anon, authenticated/)
})
