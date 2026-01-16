'use client'

import { useState } from 'react'
import { Check, MapPin, ShoppingCart, Store } from 'lucide-react'

interface ShoppingItem {
  item: string
  amount: string
  price: number
  originalPrice?: number | null
  isOnSale?: boolean
  brandName?: string | null
  discountPercent?: number | null
  aisle?: string | null
  section?: string | null
  store?: string
}

interface AisleGroup {
  aisle: string
  section: string
  items: ShoppingItem[]
  totalCost: number
}

interface AisleNavigatorProps {
  shoppingList: {
    byAisle: Record<string, ShoppingItem[]>
    byStore: Record<string, {
      items: ShoppingItem[]
      total: number
    }>
  }
}

export default function AisleNavigator({ shoppingList }: AisleNavigatorProps) {
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<'aisle' | 'store'>('aisle')

  const toggleItem = (itemKey: string) => {
    const newChecked = new Set(checkedItems)
    if (newChecked.has(itemKey)) {
      newChecked.delete(itemKey)
    } else {
      newChecked.add(itemKey)
    }
    setCheckedItems(newChecked)
  }

  // Group items by aisle for navigation mode
  const aisleGroups: AisleGroup[] = Object.entries(shoppingList.byAisle || {}).map(([key, items]) => {
    const [section, aisle] = key.includes(' - ') 
      ? key.split(' - ').reverse() 
      : [key, 'Aisle unavailable']
    
    return {
      aisle,
      section,
      items,
      totalCost: items.reduce((sum, item) => sum + item.price, 0)
    }
  }).sort((a, b) => {
    // Sort by aisle number
    const aNum = parseInt(a.aisle.replace(/\D/g, '')) || 999
    const bNum = parseInt(b.aisle.replace(/\D/g, '')) || 999
    return aNum - bNum
  })

  const totalItems = Object.values(shoppingList.byAisle || {})
    .flat()
    .length
  const checkedCount = checkedItems.size
  const progress = totalItems > 0 ? (checkedCount / totalItems) * 100 : 0

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-2xl p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <ShoppingCart className="w-7 h-7" />
              Smart Shopping List
            </h2>
            <p className="text-green-100 mt-1">
              Navigate your store efficiently • Save time & money
            </p>
          </div>
          
          <div className="text-right">
            <div className="text-3xl font-bold">
              {checkedCount}/{totalItems}
            </div>
            <div className="text-sm text-green-100">items collected</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="bg-white/20 rounded-full h-3 overflow-hidden">
          <div 
            className="bg-white h-full transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* View Toggle */}
      <div className="flex gap-2 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setViewMode('aisle')}
          className={`px-4 py-2 rounded-md font-medium transition-all ${
            viewMode === 'aisle'
              ? 'bg-white text-green-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <MapPin className="w-4 h-4 inline mr-2" />
          By Aisle
        </button>
        <button
          onClick={() => setViewMode('store')}
          className={`px-4 py-2 rounded-md font-medium transition-all ${
            viewMode === 'store'
              ? 'bg-white text-green-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Store className="w-4 h-4 inline mr-2" />
          By Store
        </button>
      </div>

      {/* Aisle View */}
      {viewMode === 'aisle' && (
        <div className="space-y-4">
          {aisleGroups.map((group, groupIndex) => {
            const groupItemsChecked = group.items.filter(item => 
              checkedItems.has(`${group.aisle}-${item.item}`)
            ).length
            const allChecked = groupItemsChecked === group.items.length

            return (
              <div
                key={groupIndex}
                className={`bg-white rounded-xl shadow-md overflow-hidden border-2 transition-all ${
                  allChecked 
                    ? 'border-green-500 opacity-60' 
                    : 'border-gray-200 hover:border-green-300'
                }`}
              >
                {/* Aisle Header */}
                <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-3">
                        <div className="bg-green-500 text-white px-3 py-1 rounded-lg font-bold text-lg">
                          {group.aisle}
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-900 text-lg">
                            {group.section}
                          </h3>
                          <p className="text-sm text-gray-500">
                            {group.items.length} items • ${group.totalCost.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    {allChecked && (
                      <div className="flex items-center gap-2 text-green-600 font-medium">
                        <Check className="w-5 h-5" />
                        Complete!
                      </div>
                    )}
                  </div>
                </div>

                {/* Items in this aisle */}
                <div className="divide-y divide-gray-100">
                  {group.items.map((item, itemIndex) => {
                    const itemKey = `${group.aisle}-${item.item}`
                    const isChecked = checkedItems.has(itemKey)

                    return (
                      <div
                        key={itemIndex}
                        onClick={() => toggleItem(itemKey)}
                        className={`px-6 py-4 cursor-pointer transition-all hover:bg-gray-50 ${
                          isChecked ? 'bg-green-50' : ''
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          {/* Checkbox */}
                          <div
                            className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
                              isChecked
                                ? 'bg-green-500 border-green-500'
                                : 'border-gray-300 hover:border-green-400'
                            }`}
                          >
                            {isChecked && <Check className="w-4 h-4 text-white" />}
                          </div>

                          {/* Item Info */}
                          <div className="flex-1">
                            <div className={`font-medium ${isChecked ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                              {item.item}
                            </div>
                            {item.brandName && item.isOnSale && (
                              <div className="text-sm font-medium text-green-700 mt-0.5">
                                🏷️ {item.brandName}
                              </div>
                            )}
                            <div className="text-sm text-gray-500 flex items-center gap-2 mt-1">
                              <span>{item.amount}</span>
                              {item.store && <span>• {item.store}</span>}
                              {item.isOnSale && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">
                                  🔥 ON SALE {item.discountPercent ? `${Math.round(item.discountPercent)}% OFF` : ''}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Price */}
                          <div className="text-right">
                            {item.isOnSale && item.originalPrice && (
                              <div className="text-sm text-gray-400 line-through">
                                ${item.originalPrice.toFixed(2)}
                              </div>
                            )}
                            <div className={`text-lg font-bold ${isChecked ? 'text-gray-400' : item.isOnSale ? 'text-red-600' : 'text-green-600'}`}>
                              ${item.price.toFixed(2)}
                            </div>
                            {item.isOnSale && item.originalPrice && (
                              <div className="text-xs text-green-600 font-medium">
                                Save ${(item.originalPrice - item.price).toFixed(2)}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Store View */}
      {viewMode === 'store' && (
        <div className="space-y-4">
          {Object.entries(shoppingList.byStore || {}).map(([storeName, storeData], storeIndex) => (
            <div
              key={storeIndex}
              className="bg-white rounded-xl shadow-md overflow-hidden border-2 border-gray-200 hover:border-green-300 transition-all"
            >
              {/* Store Header */}
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 px-6 py-4 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Store className="w-6 h-6 text-blue-600" />
                    <div>
                      <h3 className="font-bold text-gray-900 text-lg">{storeName}</h3>
                      <p className="text-sm text-gray-500">
                        {storeData.items.length} items
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-blue-600">
                      ${storeData.total.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Store Items */}
              <div className="divide-y divide-gray-100">
                {storeData.items.map((item, itemIndex) => {
                  const itemKey = `${storeName}-${item.item}`
                  const isChecked = checkedItems.has(itemKey)

                  return (
                    <div
                      key={itemIndex}
                      onClick={() => toggleItem(itemKey)}
                      className={`px-6 py-4 cursor-pointer transition-all hover:bg-gray-50 ${
                        isChecked ? 'bg-green-50' : ''
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
                            isChecked
                              ? 'bg-green-500 border-green-500'
                              : 'border-gray-300 hover:border-green-400'
                          }`}
                        >
                          {isChecked && <Check className="w-4 h-4 text-white" />}
                        </div>

                        <div className="flex-1">
                          <div className={`font-medium ${isChecked ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                            {item.item}
                          </div>
                          {item.brandName && item.isOnSale && (
                            <div className="text-sm font-medium text-green-700 mt-0.5">
                              🏷️ {item.brandName}
                            </div>
                          )}
                          <div className="text-sm text-gray-500 flex items-center gap-2 mt-1">
                            <span>{item.amount}</span>
                            <span>
                              • {item.aisle || 'Aisle unavailable'}
                              {item.section ? `, ${item.section}` : ''}
                            </span>
                            {item.isOnSale && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">
                                🔥 ON SALE {item.discountPercent ? `${Math.round(item.discountPercent)}% OFF` : ''}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="text-right">
                          {item.isOnSale && item.originalPrice && (
                            <div className="text-sm text-gray-400 line-through">
                              ${item.originalPrice.toFixed(2)}
                            </div>
                          )}
                          <div className={`text-lg font-bold ${isChecked ? 'text-gray-400' : item.isOnSale ? 'text-red-600' : 'text-green-600'}`}>
                            ${item.price.toFixed(2)}
                          </div>
                          {item.isOnSale && item.originalPrice && (
                            <div className="text-xs text-green-600 font-medium">
                              Save ${(item.originalPrice - item.price).toFixed(2)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Summary Footer */}
      <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-gray-200 sticky bottom-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-500">Total Cost</div>
            <div className="text-3xl font-bold text-gray-900">
              ${Object.values(shoppingList.byStore || {})
                .reduce((sum, store) => sum + store.total, 0)
                .toFixed(2)}
            </div>
          </div>
          
          <div className="text-right">
            <div className="text-sm text-gray-500">Progress</div>
            <div className="text-3xl font-bold text-green-600">
              {Math.round(progress)}%
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}





