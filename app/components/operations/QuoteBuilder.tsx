'use client'

import { useState } from 'react'

export interface QuoteLineItem {
  id: string
  style_id: number
  style_name: string
  color_name: string
  size: string
  quantity: number
  wholesale_price: number
  decoration_type?: string
  decoration_locations?: number
  manual_override?: {
    wholesale_price?: number
    decoration_price?: number
    total_price?: number
  }
}

interface QuoteBuilderProps {
  lineItems: QuoteLineItem[]
  onUpdateLineItem: (id: string, updates: Partial<QuoteLineItem>) => void
  onRemoveLineItem: (id: string) => void
  onCalculatePricing: () => void
  calculating: boolean
}

const DECORATION_TYPES = [
  { value: 'embroidery', label: 'Embroidery' },
  { value: 'dtf', label: 'DTF' },
  { value: 'screen_print', label: 'Screen Print' },
]

const SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL']

export default function QuoteBuilder({
  lineItems,
  onUpdateLineItem,
  onRemoveLineItem,
  onCalculatePricing,
  calculating,
}: QuoteBuilderProps) {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Quote Line Items</h2>
        <button
          onClick={onCalculatePricing}
          disabled={calculating || lineItems.length === 0}
          className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {calculating ? (
            <span className="flex items-center">
              <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
              Calculating...
            </span>
          ) : (
            'Calculate Pricing'
          )}
        </button>
      </div>

      {/* Line Items */}
      {lineItems.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <p className="text-gray-500">No items in quote. Add products to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {lineItems.map((item) => (
            <div
              key={item.id}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
            >
              <div className="grid grid-cols-12 gap-3 items-start">
                {/* Product Name */}
                <div className="col-span-3">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Product
                  </label>
                  <p className="text-sm font-semibold">{item.style_name}</p>
                  <p className="text-xs text-gray-500">ID: {item.style_id}</p>
                </div>

                {/* Color */}
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Color
                  </label>
                  <input
                    type="text"
                    value={item.color_name}
                    onChange={(e) =>
                      onUpdateLineItem(item.id, { color_name: e.target.value })
                    }
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Size */}
                <div className="col-span-1">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Size
                  </label>
                  <select
                    value={item.size}
                    onChange={(e) =>
                      onUpdateLineItem(item.id, { size: e.target.value })
                    }
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {SIZES.map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Quantity */}
                <div className="col-span-1">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Qty
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) =>
                      onUpdateLineItem(item.id, {
                        quantity: parseInt(e.target.value) || 1,
                      })
                    }
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Wholesale Price */}
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Wholesale $
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={item.wholesale_price}
                    onChange={(e) =>
                      onUpdateLineItem(item.id, {
                        wholesale_price: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Decoration Type */}
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Decoration
                  </label>
                  <select
                    value={item.decoration_type || ''}
                    onChange={(e) =>
                      onUpdateLineItem(item.id, {
                        decoration_type: e.target.value || undefined,
                      })
                    }
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">None</option>
                    {DECORATION_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Remove Button */}
                <div className="col-span-1 flex items-end">
                  <button
                    onClick={() => onRemoveLineItem(item.id)}
                    className="w-full px-2 py-1.5 text-sm bg-red-50 text-red-600 rounded hover:bg-red-100 transition-colors"
                    title="Remove item"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Summary */}
      {lineItems.length > 0 && (
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Total Items:</span>
            <span className="font-semibold">
              {lineItems.reduce((sum, item) => sum + item.quantity, 0)} units
            </span>
          </div>
          <div className="flex justify-between text-sm mt-1">
            <span className="text-gray-600">Line Items:</span>
            <span className="font-semibold">{lineItems.length}</span>
          </div>
        </div>
      )}
    </div>
  )
}
