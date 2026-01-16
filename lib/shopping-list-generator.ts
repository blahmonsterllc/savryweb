/**
 * Shopping List Generator Utility
 * 
 * Consolidates ingredients from multiple recipes into a unified shopping list
 * Aggregates duplicate items and calculates total quantities and prices
 */

interface Ingredient {
  name: string
  quantity: string
  unit: string
}

interface Recipe {
  name: string
  ingredients: Ingredient[]
}

interface ShoppingItem {
  item: string
  amount: string
  price: number
  aisle: string
  section: string
  fromRecipes: string[]
}

interface ShoppingList {
  items: ShoppingItem[]
  totalEstimatedCost: number
  itemCount: number
}

/**
 * Consolidate ingredients from multiple recipes into a shopping list
 */
export function consolidateShoppingList(recipes: Recipe[]): ShoppingList {
  const itemMap = new Map<string, ShoppingItem>()

  recipes.forEach((recipe) => {
    recipe.ingredients.forEach((ingredient) => {
      // Normalize item name (lowercase, trim)
      const itemKey = ingredient.name.toLowerCase().trim()
      
      if (itemMap.has(itemKey)) {
        // Item exists, aggregate it
        const existing = itemMap.get(itemKey)!
        
        // Add recipe name
        if (!existing.fromRecipes.includes(recipe.name)) {
          existing.fromRecipes.push(recipe.name)
        }
        
        // Try to combine quantities (simplified approach)
        // In a real app, you'd want to parse and add numeric quantities
        if (ingredient.quantity && ingredient.unit) {
          const newAmount = `${ingredient.quantity} ${ingredient.unit}`
          if (!existing.amount.includes(newAmount)) {
            existing.amount += ` + ${newAmount}`
          }
        }
        
      } else {
        // New item, add to map
        itemMap.set(itemKey, {
          item: ingredient.name,
          amount: ingredient.quantity && ingredient.unit 
            ? `${ingredient.quantity} ${ingredient.unit}` 
            : ingredient.quantity || '1',
          price: estimatePrice(ingredient.name), // Simple price estimation
          aisle: guessAisle(ingredient.name),
          section: guessSection(ingredient.name),
          fromRecipes: [recipe.name]
        })
      }
    })
  })

  const items = Array.from(itemMap.values())
  const totalEstimatedCost = items.reduce((sum, item) => sum + item.price, 0)

  return {
    items,
    totalEstimatedCost,
    itemCount: items.length
  }
}

/**
 * Simple price estimation based on common ingredients
 * In a real app, this would query a database or API
 */
function estimatePrice(itemName: string): number {
  const name = itemName.toLowerCase()
  
  // Proteins
  if (name.includes('chicken')) return 8.99
  if (name.includes('beef') || name.includes('steak')) return 12.99
  if (name.includes('pork')) return 9.99
  if (name.includes('fish') || name.includes('salmon')) return 11.99
  if (name.includes('shrimp')) return 13.99
  
  // Dairy
  if (name.includes('milk')) return 4.29
  if (name.includes('cheese')) return 5.99
  if (name.includes('yogurt')) return 4.99
  if (name.includes('butter')) return 3.99
  if (name.includes('eggs')) return 3.99
  
  // Produce
  if (name.includes('lettuce') || name.includes('spinach')) return 2.49
  if (name.includes('tomato')) return 3.99
  if (name.includes('onion')) return 1.99
  if (name.includes('garlic')) return 0.99
  if (name.includes('potato')) return 4.99
  if (name.includes('carrot')) return 2.49
  if (name.includes('broccoli')) return 2.99
  if (name.includes('pepper') || name.includes('bell')) return 3.49
  
  // Pantry staples
  if (name.includes('rice')) return 3.99
  if (name.includes('pasta')) return 2.49
  if (name.includes('bread')) return 2.99
  if (name.includes('flour')) return 4.99
  if (name.includes('sugar')) return 3.49
  if (name.includes('oil')) return 5.99
  
  // Default for unknown items
  return 2.99
}

/**
 * Guess which aisle an item might be in
 */
function guessAisle(itemName: string): string {
  const name = itemName.toLowerCase()
  
  if (name.includes('chicken') || name.includes('beef') || name.includes('pork') || 
      name.includes('fish') || name.includes('meat')) {
    return 'Aisle 8'
  }
  
  if (name.includes('milk') || name.includes('cheese') || name.includes('yogurt') || 
      name.includes('butter') || name.includes('eggs')) {
    return 'Aisle 12'
  }
  
  if (name.includes('lettuce') || name.includes('tomato') || name.includes('onion') || 
      name.includes('garlic') || name.includes('potato') || name.includes('carrot') ||
      name.includes('pepper') || name.includes('produce') || name.includes('vegetable') ||
      name.includes('fruit')) {
    return 'Aisle 1'
  }
  
  if (name.includes('bread') || name.includes('bakery')) {
    return 'Aisle 6'
  }
  
  if (name.includes('rice') || name.includes('pasta') || name.includes('flour') || 
      name.includes('sugar') || name.includes('pantry')) {
    return 'Aisle 4'
  }
  
  if (name.includes('oil') || name.includes('sauce') || name.includes('condiment') ||
      name.includes('spice')) {
    return 'Aisle 5'
  }
  
  if (name.includes('frozen')) {
    return 'Aisle 15'
  }
  
  return 'Aisle 10'
}

/**
 * Guess which section an item belongs to
 */
function guessSection(itemName: string): string {
  const name = itemName.toLowerCase()
  
  if (name.includes('chicken') || name.includes('beef') || name.includes('pork') || 
      name.includes('meat')) {
    return 'Meat'
  }
  
  if (name.includes('fish') || name.includes('salmon') || name.includes('shrimp') || 
      name.includes('seafood')) {
    return 'Seafood'
  }
  
  if (name.includes('milk') || name.includes('cheese') || name.includes('yogurt') || 
      name.includes('butter') || name.includes('eggs') || name.includes('dairy')) {
    return 'Dairy'
  }
  
  if (name.includes('lettuce') || name.includes('tomato') || name.includes('onion') || 
      name.includes('garlic') || name.includes('potato') || name.includes('carrot') ||
      name.includes('pepper') || name.includes('produce') || name.includes('vegetable') ||
      name.includes('fruit')) {
    return 'Produce'
  }
  
  if (name.includes('bread') || name.includes('bakery')) {
    return 'Bakery'
  }
  
  if (name.includes('rice') || name.includes('pasta') || name.includes('flour') || 
      name.includes('sugar') || name.includes('pantry') || name.includes('cereal')) {
    return 'Pantry'
  }
  
  if (name.includes('frozen')) {
    return 'Frozen Foods'
  }
  
  return 'General'
}

/**
 * Format shopping list for display
 */
export function formatShoppingList(shoppingList: ShoppingList): string {
  let output = `Shopping List (${shoppingList.itemCount} items)\n`
  output += `Estimated Total: $${shoppingList.totalEstimatedCost.toFixed(2)}\n\n`
  
  // Group by section
  const bySection = new Map<string, ShoppingItem[]>()
  
  shoppingList.items.forEach(item => {
    if (!bySection.has(item.section)) {
      bySection.set(item.section, [])
    }
    bySection.get(item.section)!.push(item)
  })
  
  // Output by section
  bySection.forEach((items, section) => {
    output += `${section}:\n`
    items.forEach(item => {
      output += `  ☐ ${item.item} - ${item.amount} ($${item.price.toFixed(2)}) - ${item.aisle}\n`
    })
    output += '\n'
  })
  
  return output
}



