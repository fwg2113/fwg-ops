'use client'

interface QuoteCalculation {
  line_item: {
    style_name: string
    color_name: string
    size: string
    quantity: number
  }
  wholesale_cost: number
  decoration_cost: number
  size_upcharge: number
  subtotal: number
  total: number
  breakdown: {
    base_wholesale: number
    decoration_base: number
    decoration_multiplier: number
    manual_override: boolean
  }
}

interface QuoteSummary {
  line_items: QuoteCalculation[]
  total_wholesale_cost: number
  total_decoration_cost: number
  total_size_upcharges: number
  grand_total: number
  item_count: number
}

interface PricingDisplayProps {
  quoteSummary: QuoteSummary | null
}

export default function PricingDisplay({ quoteSummary }: PricingDisplayProps) {
  if (!quoteSummary) {
    return (
      <div className="bg-gray-50 rounded-lg p-8 text-center border-2 border-dashed border-gray-300">
        <p className="text-gray-500">
          Calculate pricing to see quote breakdown
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Grand Total Card */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium opacity-90">Grand Total</p>
            <p className="text-4xl font-bold mt-1">
              ${quoteSummary.grand_total.toFixed(2)}
            </p>
            <p className="text-sm opacity-75 mt-1">
              {quoteSummary.item_count} total units
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm opacity-90">Avg per Unit</p>
            <p className="text-2xl font-semibold">
              ${(quoteSummary.grand_total / quoteSummary.item_count).toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      {/* Cost Breakdown */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Cost Breakdown</h3>
        <div className="space-y-3">
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-gray-600">Wholesale Cost</span>
            <span className="font-semibold">
              ${quoteSummary.total_wholesale_cost.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-gray-600">Decoration Cost</span>
            <span className="font-semibold">
              ${quoteSummary.total_decoration_cost.toFixed(2)}
            </span>
          </div>
          {quoteSummary.total_size_upcharges > 0 && (
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-gray-600">Size Upcharges</span>
              <span className="font-semibold">
                ${quoteSummary.total_size_upcharges.toFixed(2)}
              </span>
            </div>
          )}
          <div className="flex justify-between items-center py-3 border-t-2 border-gray-300">
            <span className="text-lg font-semibold">Total</span>
            <span className="text-lg font-bold text-blue-600">
              ${quoteSummary.grand_total.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Line Items Detail */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Line Item Details</h3>
        <div className="space-y-4">
          {quoteSummary.line_items.map((item, index) => (
            <div
              key={index}
              className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="font-semibold text-sm">
                    {item.line_item.style_name}
                  </h4>
                  <p className="text-xs text-gray-600">
                    {item.line_item.color_name} • {item.line_item.size} • Qty:{' '}
                    {item.line_item.quantity}
                  </p>
                  {item.breakdown.manual_override && (
                    <span className="inline-block mt-1 text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                      Manual Override
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-blue-600">
                    ${item.total.toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-500">
                    ${item.subtotal.toFixed(2)} × {item.line_item.quantity}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-xs text-gray-500">Wholesale</p>
                  <p className="font-medium">
                    ${item.wholesale_cost.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Decoration</p>
                  <p className="font-medium">
                    ${item.decoration_cost.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Per Unit</p>
                  <p className="font-medium">${item.subtotal.toFixed(2)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
