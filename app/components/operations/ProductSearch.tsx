'use client'

import { useState, useCallback, useEffect, useRef } from 'react'

// Simple debounce utility
function useDebounce(value: string, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

interface SSProduct {
  styleID: number
  styleName: string
  brandName: string
  categoryName: string
  productThumbnail: string
  colors: {
    colorID: number
    colorName: string
  }[]
}

interface ProductSearchProps {
  onAddProduct: (product: SSProduct) => void
}

export default function ProductSearch({ onAddProduct }: ProductSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SSProduct[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debouncedQuery = useDebounce(query, 500)

  // Search when debounced query changes
  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setResults([])
      return
    }

    const searchProducts = async () => {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch(
          `/api/suppliers/ss/search?q=${encodeURIComponent(debouncedQuery)}`
        )
        const data = await response.json()

        if (data.success) {
          setResults(data.data)
        } else {
          setError(data.error || 'Search failed')
          setResults([])
        }
      } catch (err) {
        setError('Failed to search products')
        setResults([])
      } finally {
        setLoading(false)
      }
    }

    searchProducts()
  }, [debouncedQuery])

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value)
  }

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={handleSearch}
          placeholder="Search SS Activewear catalog (style #, brand, category)..."
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {loading && (
          <div className="absolute right-3 top-3">
            <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Search Results */}
      {results.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
          {results.map((product) => (
            <div
              key={product.styleID}
              className="border border-gray-200 rounded-lg p-4 hover:border-blue-500 hover:shadow-md transition-all"
            >
              <div className="flex items-start space-x-3">
                {/* Product Image */}
                {product.productThumbnail && (
                  <img
                    src={product.productThumbnail}
                    alt={product.styleName}
                    className="w-16 h-16 object-cover rounded"
                  />
                )}

                {/* Product Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm truncate">
                    {product.styleName}
                  </h3>
                  <p className="text-xs text-gray-600">{product.brandName}</p>
                  <p className="text-xs text-gray-500">{product.categoryName}</p>

                  {/* Colors */}
                  {product.colors.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {product.colors.slice(0, 3).map((color) => (
                        <span
                          key={color.colorID}
                          className="text-xs bg-gray-100 px-2 py-1 rounded"
                        >
                          {color.colorName}
                        </span>
                      ))}
                      {product.colors.length > 3 && (
                        <span className="text-xs text-gray-500">
                          +{product.colors.length - 3} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Add Button */}
              <button
                onClick={() => onAddProduct(product)}
                className="mt-3 w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                Add to Quote
              </button>
            </div>
          ))}
        </div>
      )}

      {/* No Results */}
      {query.length >= 2 && !loading && results.length === 0 && !error && (
        <div className="text-center py-8 text-gray-500">
          No products found for &quot;{query}&quot;
        </div>
      )}

      {/* Initial State */}
      {query.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          Start typing to search 5,900+ products
        </div>
      )}
    </div>
  )
}
