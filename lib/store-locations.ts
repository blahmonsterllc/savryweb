import { prisma } from './prisma'

interface StoreLocation {
  aisle: string
  section: string
  shelfLocation?: string
}

/**
 * Get store locations for grocery items
 * This helps users find items in their local supermarket
 */
export class StoreLocationService {
  /**
   * Get item location in a specific store
   */
  async getItemLocation(
    itemName: string,
    storeName: string,
    location: string
  ): Promise<StoreLocation | null> {
    const itemLocation = await prisma.storeItemLocation.findFirst({
      where: {
        itemName: {
          contains: itemName,
          mode: 'insensitive',
        },
        storeName,
        location,
      },
    })

    if (!itemLocation) {
      return null
    }

    return {
      aisle: itemLocation.aisle,
      section: itemLocation.section,
      shelfLocation: itemLocation.shelfLocation || undefined,
    }
  }

  /**
   * Get locations for multiple items
   */
  async getMultipleItemLocations(
    items: string[],
    storeName: string,
    location: string
  ): Promise<Map<string, StoreLocation>> {
    const locations = new Map<string, StoreLocation>()

    for (const item of items) {
      const location_data = await this.getItemLocation(item, storeName, location)
      if (location_data) {
        locations.set(item, location_data)
      }
    }

    return locations
  }

  /**
   * Get optimized shopping route through store
   * Orders items by aisle number to minimize backtracking
   */
  async getOptimizedShoppingRoute(
    items: Array<{ name: string; quantity: string; category: string }>,
    storeName: string,
    location: string
  ): Promise<Array<{
    item: string
    quantity: string
    category: string
    aisle?: string
    section?: string
    shelfLocation?: string
  }>> {
    const itemsWithLocations = await Promise.all(
      items.map(async (item) => {
        const location_data = await this.getItemLocation(
          item.name,
          storeName,
          location
        )

        return {
          item: item.name,
          quantity: item.quantity,
          category: item.category,
          aisle: location_data?.aisle,
          section: location_data?.section,
          shelfLocation: location_data?.shelfLocation,
        }
      })
    )

    // Sort by aisle number (extract number from "Aisle 5" format)
    return itemsWithLocations.sort((a, b) => {
      if (!a.aisle || !b.aisle) return 0
      
      const aisleA = parseInt(a.aisle.match(/\d+/)?.[0] || '999')
      const aisleB = parseInt(b.aisle.match(/\d+/)?.[0] || '999')
      
      return aisleA - aisleB
    })
  }

  /**
   * Seed sample store location data
   * In production, this would be populated from store APIs or manual data entry
   */
  async seedSampleLocations(storeName: string, location: string) {
    const sampleItems = [
      // Produce
      { itemName: 'banana', category: 'Produce', aisle: 'Aisle 1', section: 'Produce', shelfLocation: 'Front left' },
      { itemName: 'apple', category: 'Produce', aisle: 'Aisle 1', section: 'Produce', shelfLocation: 'Front center' },
      { itemName: 'tomato', category: 'Produce', aisle: 'Aisle 1', section: 'Produce', shelfLocation: 'Middle right' },
      { itemName: 'lettuce', category: 'Produce', aisle: 'Aisle 1', section: 'Produce', shelfLocation: 'Back left' },
      { itemName: 'carrot', category: 'Produce', aisle: 'Aisle 1', section: 'Produce', shelfLocation: 'Middle' },
      { itemName: 'broccoli', category: 'Produce', aisle: 'Aisle 1', section: 'Produce', shelfLocation: 'Back right' },
      { itemName: 'onion', category: 'Produce', aisle: 'Aisle 1', section: 'Produce', shelfLocation: 'Front right' },
      
      // Dairy
      { itemName: 'milk', category: 'Dairy', aisle: 'Aisle 8', section: 'Dairy', shelfLocation: 'Back wall' },
      { itemName: 'cheese', category: 'Dairy', aisle: 'Aisle 8', section: 'Dairy', shelfLocation: 'Middle section' },
      { itemName: 'yogurt', category: 'Dairy', aisle: 'Aisle 8', section: 'Dairy', shelfLocation: 'Top shelf' },
      { itemName: 'butter', category: 'Dairy', aisle: 'Aisle 8', section: 'Dairy', shelfLocation: 'Bottom shelf' },
      { itemName: 'eggs', category: 'Dairy', aisle: 'Aisle 8', section: 'Dairy', shelfLocation: 'Front center' },
      
      // Meat
      { itemName: 'chicken breast', category: 'Meat', aisle: 'Aisle 12', section: 'Meat & Seafood', shelfLocation: 'Left side' },
      { itemName: 'ground beef', category: 'Meat', aisle: 'Aisle 12', section: 'Meat & Seafood', shelfLocation: 'Center' },
      { itemName: 'salmon', category: 'Meat', aisle: 'Aisle 12', section: 'Meat & Seafood', shelfLocation: 'Right side' },
      
      // Pantry
      { itemName: 'rice', category: 'Pantry', aisle: 'Aisle 5', section: 'Grains', shelfLocation: 'Middle shelf' },
      { itemName: 'pasta', category: 'Pantry', aisle: 'Aisle 5', section: 'Pasta', shelfLocation: 'Top shelf' },
      { itemName: 'bread', category: 'Bakery', aisle: 'Aisle 3', section: 'Bakery', shelfLocation: 'Center aisle' },
      { itemName: 'olive oil', category: 'Pantry', aisle: 'Aisle 6', section: 'Oils & Vinegars', shelfLocation: 'Middle' },
      { itemName: 'flour', category: 'Pantry', aisle: 'Aisle 7', section: 'Baking', shelfLocation: 'Bottom shelf' },
      
      // Frozen
      { itemName: 'frozen vegetables', category: 'Frozen', aisle: 'Aisle 15', section: 'Frozen Foods', shelfLocation: 'Left section' },
      { itemName: 'ice cream', category: 'Frozen', aisle: 'Aisle 15', section: 'Frozen Foods', shelfLocation: 'Back wall' },
    ]

    for (const item of sampleItems) {
      await prisma.storeItemLocation.upsert({
        where: {
          storeName_location_itemName: {
            storeName,
            location,
            itemName: item.itemName,
          },
        },
        update: item,
        create: {
          storeName,
          storeChain: storeName.split(' ')[0], // e.g., "Kroger Store 123" -> "Kroger"
          location,
          ...item,
        },
      })
    }
  }
}

export const storeLocationService = new StoreLocationService()







