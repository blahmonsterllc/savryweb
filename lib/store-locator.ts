/**
 * Store Locator - Returns actual stores based on ZIP code
 * 
 * This ensures users only see stores that actually exist in their area.
 * No more showing Kroger in New York or Wegmans in Texas!
 */

export interface StoreInfo {
  name: string
  commonInRegion: boolean
  chains?: string[] // For stores with multiple banners
}

export interface RegionStores {
  region: string
  primaryStores: string[]
  secondaryStores: string[]
  description: string
}

// ZIP code ranges mapped to regions
const ZIP_TO_REGION: Record<string, (zip: string) => boolean> = {
  'northeast': (zip: string) => {
    const zipNum = parseInt(zip)
    // CT, MA, ME, NH, NJ, NY, PA, RI, VT
    return (zipNum >= 6000 && zipNum <= 6999) ||  // CT, MA, RI
           (zipNum >= 10000 && zipNum <= 14999) || // NY
           (zipNum >= 15000 && zipNum <= 19699) || // PA, NJ, DE
           (zipNum >= 3900 && zipNum <= 4999) ||   // ME, NH, VT, MA
           (zipNum >= 5000 && zipNum <= 5999)      // MA, VT
  },
  'southeast': (zip: string) => {
    const zipNum = parseInt(zip)
    // FL, GA, SC, NC, VA, WV, AL, MS, TN, KY
    return (zipNum >= 20000 && zipNum <= 20599) || // DC
           (zipNum >= 20600 && zipNum <= 24699) || // VA, WV
           (zipNum >= 27000 && zipNum <= 28999) || // NC
           (zipNum >= 29000 && zipNum <= 29999) || // SC
           (zipNum >= 30000 && zipNum <= 31999) || // GA
           (zipNum >= 32000 && zipNum <= 34999) || // FL
           (zipNum >= 35000 && zipNum <= 36999) || // AL
           (zipNum >= 37000 && zipNum <= 38599) || // TN
           (zipNum >= 38600 && zipNum <= 39799) || // MS
           (zipNum >= 40000 && zipNum <= 42799)    // KY
  },
  'midwest': (zip: string) => {
    const zipNum = parseInt(zip)
    // OH, IN, MI, IL, WI, MN, IA, MO, ND, SD, NE, KS
    return (zipNum >= 43000 && zipNum <= 45999) || // OH
           (zipNum >= 46000 && zipNum <= 47999) || // IN
           (zipNum >= 48000 && zipNum <= 49999) || // MI
           (zipNum >= 50000 && zipNum <= 52999) || // IA
           (zipNum >= 53000 && zipNum <= 54999) || // WI
           (zipNum >= 55000 && zipNum <= 56799) || // MN
           (zipNum >= 57000 && zipNum <= 57999) || // SD
           (zipNum >= 58000 && zipNum <= 58999) || // ND
           (zipNum >= 60000 && zipNum <= 62999) || // IL
           (zipNum >= 63000 && zipNum <= 65999) || // MO
           (zipNum >= 66000 && zipNum <= 67999) || // KS
           (zipNum >= 68000 && zipNum <= 69999)    // NE
  },
  'southwest': (zip: string) => {
    const zipNum = parseInt(zip)
    // TX, OK, AR, LA, NM
    return (zipNum >= 70000 && zipNum <= 71599) || // LA
           (zipNum >= 71600 && zipNum <= 72999) || // AR
           (zipNum >= 73000 && zipNum <= 74999) || // OK
           (zipNum >= 75000 && zipNum <= 79999) || // TX
           (zipNum >= 80000 && zipNum <= 81999) || // CO
           (zipNum >= 87000 && zipNum <= 88499)    // NM
  },
  'west': (zip: string) => {
    const zipNum = parseInt(zip)
    // CA, OR, WA, NV, AZ, ID, MT, WY, UT
    return (zipNum >= 82000 && zipNum <= 83199) || // WY
           (zipNum >= 83200 && zipNum <= 83999) || // ID
           (zipNum >= 84000 && zipNum <= 84999) || // UT
           (zipNum >= 85000 && zipNum <= 86599) || // AZ
           (zipNum >= 88500 && zipNum <= 88999) || // NV
           (zipNum >= 89000 && zipNum <= 89999) || // NV
           (zipNum >= 90000 && zipNum <= 96199) || // CA
           (zipNum >= 97000 && zipNum <= 97999) || // OR
           (zipNum >= 98000 && zipNum <= 99499)    // WA
  }
}

// Stores available by region
const REGIONAL_STORES: Record<string, RegionStores> = {
  'northeast': {
    region: 'Northeast',
    primaryStores: [
      'Stop & Shop',
      'ShopRite',
      'Wegmans',
      'Price Chopper',
      'Market Basket',
      'Giant Food Stores',
    ],
    secondaryStores: [
      'Acme',
      'Hannaford',
      'Big Y',
      'King Kullen',
      'Target',
      'Walmart',
      'Whole Foods',
      'Trader Joe\'s',
    ],
    description: 'Northeast stores (NY, NJ, PA, CT, MA, etc.)'
  },
  'southeast': {
    region: 'Southeast',
    primaryStores: [
      'Publix',
      'Harris Teeter',
      'Food Lion',
      'Kroger',
      'Winn-Dixie',
    ],
    secondaryStores: [
      'Bi-Lo',
      'Ingles',
      'Piggly Wiggly',
      'Target',
      'Walmart',
      'Whole Foods',
      'Trader Joe\'s',
    ],
    description: 'Southeast stores (FL, GA, NC, SC, VA, etc.)'
  },
  'midwest': {
    region: 'Midwest',
    primaryStores: [
      'Kroger',
      'Meijer',
      'Hy-Vee',
      'Jewel-Osco',
      'Schnucks',
    ],
    secondaryStores: [
      'Giant Eagle',
      'Festival Foods',
      'Fareway',
      'Target',
      'Walmart',
      'Whole Foods',
      'Trader Joe\'s',
    ],
    description: 'Midwest stores (OH, IL, MI, IN, IA, etc.)'
  },
  'southwest': {
    region: 'Southwest',
    primaryStores: [
      'H-E-B',
      'Kroger',
      'Tom Thumb',
      'Albertsons',
      'Sprouts',
    ],
    secondaryStores: [
      'Market Street',
      'Fiesta',
      'Brookshire\'s',
      'Target',
      'Walmart',
      'Whole Foods',
      'Trader Joe\'s',
    ],
    description: 'Southwest stores (TX, OK, AR, LA, NM, etc.)'
  },
  'west': {
    region: 'West',
    primaryStores: [
      'Safeway',
      'Albertsons',
      'Fred Meyer',
      'Vons',
      'Ralphs',
      'Smith\'s',
    ],
    secondaryStores: [
      'QFC',
      'Pavilions',
      'Lucky',
      'WinCo',
      'Target',
      'Walmart',
      'Whole Foods',
      'Trader Joe\'s',
    ],
    description: 'West stores (CA, OR, WA, NV, AZ, etc.)'
  }
}

/**
 * Get region from ZIP code
 */
export function getRegionFromZip(zipCode: string): string {
  const cleanZip = zipCode.replace(/\D/g, '').substring(0, 5)
  
  for (const [region, checkFn] of Object.entries(ZIP_TO_REGION)) {
    if (checkFn(cleanZip)) {
      return region
    }
  }
  
  return 'midwest' // Default fallback
}

/**
 * Get stores available in a ZIP code
 */
export function getStoresForZip(zipCode: string): RegionStores {
  const region = getRegionFromZip(zipCode)
  return REGIONAL_STORES[region] || REGIONAL_STORES['midwest']
}

/**
 * Check if a store exists in a ZIP code area
 */
export function isStoreInArea(storeName: string, zipCode: string): boolean {
  const stores = getStoresForZip(zipCode)
  const allStores = [...stores.primaryStores, ...stores.secondaryStores]
  
  return allStores.some(store => 
    store.toLowerCase() === storeName.toLowerCase() ||
    storeName.toLowerCase().includes(store.toLowerCase()) ||
    store.toLowerCase().includes(storeName.toLowerCase())
  )
}

/**
 * Get recommended stores for a ZIP code (primary + Target/Walmart)
 */
export function getRecommendedStores(zipCode: string): string[] {
  const stores = getStoresForZip(zipCode)
  return [
    ...stores.primaryStores.slice(0, 4), // Top 4 primary stores
    'Target',
    'Walmart'
  ]
}

/**
 * Example store data for specific ZIP codes
 */
export const EXAMPLE_ZIPS = {
  '11764': { // Miller Place, NY
    region: 'Northeast',
    stores: ['Stop & Shop', 'King Kullen', 'ShopRite', 'Target', 'Walmart'],
    description: 'Long Island, NY'
  },
  '10001': { // New York, NY
    region: 'Northeast',
    stores: ['Whole Foods', 'Trader Joe\'s', 'Target', 'Gristedes', 'Morton Williams'],
    description: 'Manhattan, NY'
  },
  '33139': { // Miami Beach, FL
    region: 'Southeast',
    stores: ['Publix', 'Winn-Dixie', 'Whole Foods', 'Target', 'Walmart'],
    description: 'Miami Beach, FL'
  },
  '78701': { // Austin, TX
    region: 'Southwest',
    stores: ['H-E-B', 'Whole Foods', 'Target', 'Walmart', 'Trader Joe\'s'],
    description: 'Austin, TX'
  },
  '60601': { // Chicago, IL
    region: 'Midwest',
    stores: ['Jewel-Osco', 'Mariano\'s', 'Whole Foods', 'Target', 'Trader Joe\'s'],
    description: 'Chicago, IL'
  },
  '90210': { // Beverly Hills, CA
    region: 'West',
    stores: ['Ralphs', 'Pavilions', 'Whole Foods', 'Bristol Farms', 'Trader Joe\'s'],
    description: 'Beverly Hills, CA'
  }
}




