'use client'

import { useState } from 'react'
import ProductSearch from '@/app/components/operations/ProductSearch'
import QuoteBuilder, {
  QuoteLineItem,
} from '@/app/components/operations/QuoteBuilder'
import PricingDisplay from '@/app/components/operations/PricingDisplay'

export default function OperationsDashboard() {
  const [lineItems, setLineItems] = useState<QuoteLineItem[]>([])
  const [quoteSummary, setQuoteSummary] = useState<any>(null)
  const [calculating, setCalculating] = useState(false)
  const [selectedMatrix, setSelectedMatrix] = useState<string>(
    'fb461159-8538-4ad0-91a1-06b77a1dd6d6' // DTF Apparel default
  )

  // Add product from search results
  const handleAddProduct = (product: any) => {
    const newLineItem: QuoteLineItem = {
      id: `${Date.now()}-${Math.random()}`,
      style_id: product.styleID,
      style_name: product.styleName,
      color_name: product.colors[0]?.colorName || 'Black',
      size: 'L',
      quantity: 24,
      wholesale_price: 8.5, // Default, user can edit
      decoration_type: 'dtf',
      decoration_locations: 1,
    }

    setLineItems([...lineItems, newLineItem])
  }

  // Update line item
  const handleUpdateLineItem = (id: string, updates: Partial<QuoteLineItem>) => {
    setLineItems(
      lineItems.map((item) => (item.id === id ? { ...item, ...updates } : item))
    )
  }

  // Remove line item
  const handleRemoveLineItem = (id: string) => {
    setLineItems(lineItems.filter((item) => item.id !== id))
  }

  // Calculate pricing
  const handleCalculatePricing = async () => {
    setCalculating(true)

    try {
      const response = await fetch('/api/pricing/calculate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pricingMatrixId: selectedMatrix,
          lineItems: lineItems,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setQuoteSummary(data.data)
      } else {
        alert('Failed to calculate pricing: ' + data.error)
      }
    } catch (error) {
      console.error('Error calculating pricing:', error)
      alert('Failed to calculate pricing')
    } finally {
      setCalculating(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">
            Operations Dashboard
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Create quotes with SS Activewear products and automatic pricing
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Product Search & Quote Builder */}
          <div className="lg:col-span-2 space-y-6">
            {/* Product Search */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-bold mb-4">Product Search</h2>
              <ProductSearch onAddProduct={handleAddProduct} />
            </div>

            {/* Quote Builder */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <QuoteBuilder
                lineItems={lineItems}
                onUpdateLineItem={handleUpdateLineItem}
                onRemoveLineItem={handleRemoveLineItem}
                onCalculatePricing={handleCalculatePricing}
                calculating={calculating}
              />
            </div>
          </div>

          {/* Right Column - Pricing Display */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sticky top-4">
              <h2 className="text-xl font-bold mb-4">Quote Summary</h2>

              {/* Pricing Matrix Selector */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pricing Matrix
                </label>
                <select
                  value={selectedMatrix}
                  onChange={(e) => setSelectedMatrix(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="fb461159-8538-4ad0-91a1-06b77a1dd6d6">
                    DTF Apparel
                  </option>
                  <option value="acaf345c-b5ef-46b7-9df8-27f699fdf24b">
                    Polo/Shirt Embroidery
                  </option>
                  <option value="a690dac5-117c-4792-b4b3-10136b98ae39">
                    Cap Embroidery
                  </option>
                </select>
              </div>

              <PricingDisplay quoteSummary={quoteSummary} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
