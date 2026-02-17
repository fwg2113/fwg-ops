/**
 * SS Activewear API Client
 *
 * Provides authenticated access to SS Activewear's product catalog API.
 * Implements caching to reduce API calls and improve performance.
 *
 * API Documentation: https://api.ssactivewear.com/V2/
 * Authentication: Basic Auth (username = account number, password = API key)
 */

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface SSProduct {
  styleID: number
  styleName: string
  brandName: string
  baseCategory: string
  categoryName?: string  // Legacy field, use baseCategory
  description: string
  colors: SSColor[]
  sizes: string[]
  productThumbnail: string
  productImages?: string[]
  tags?: string[]
}

export interface SSColor {
  colorID: number
  colorName: string
  colorHex?: string
  colorSwatchUrl?: string
  colorImages?: string[]
  frontImage?: string
  backImage?: string
  sideImage?: string
  sizes: SSSize[]
}

export interface SSSize {
  sizeID: number
  sizeName: string
  wholesalePrice: number
  retailPrice: number
  inventory?: SSInventory[]
}

export interface SSInventory {
  warehouse: string
  qty: number
  available: boolean
}

export interface SSSearchResult {
  styleID: number
  styleName: string
  brandName: string
  baseCategory: string
  productThumbnail: string
  colors: {
    colorID: number
    colorName: string
  }[]
}

export interface SSStyleDetail {
  styleID: number
  styleName: string
  brandName: string
  baseCategory: string
  categoryName?: string  // Legacy field, use baseCategory
  title: string  // Product title (e.g., "Unisex Heavy Cotton™ T-Shirt")
  description: string
  mill?: string
  gender?: string
  fabricWeight?: string
  colors: SSColor[]
  productImages: string[]
  tags: string[]
}

// ============================================================================
// CACHE CONFIGURATION
// ============================================================================

interface CacheEntry<T> {
  data: T
  timestamp: number
}

class SimpleCache {
  private cache: Map<string, CacheEntry<any>> = new Map()
  private ttl: number = 15 * 60 * 1000 // 15 minutes default

  set<T>(key: string, data: T, ttl?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    })
  }

  get<T>(key: string, ttl?: number): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    const maxAge = ttl || this.ttl
    const age = Date.now() - entry.timestamp

    if (age > maxAge) {
      this.cache.delete(key)
      return null
    }

    return entry.data as T
  }

  clear(): void {
    this.cache.clear()
  }

  delete(key: string): void {
    this.cache.delete(key)
  }
}

const cache = new SimpleCache()

// ============================================================================
// SS ACTIVEWEAR CLIENT
// ============================================================================

export class SSActivewearClient {
  private baseUrl: string
  private accountNumber: string
  private apiKey: string
  private authHeader: string

  constructor() {
    this.baseUrl = process.env.SS_ACTIVEWEAR_BASE_URL || 'https://api.ssactivewear.com/v2'
    this.accountNumber = process.env.SS_ACTIVEWEAR_ACCOUNT_NUMBER || ''
    this.apiKey = process.env.SS_ACTIVEWEAR_API_KEY || ''

    if (!this.accountNumber || !this.apiKey) {
      throw new Error('SS Activewear credentials not configured. Set SS_ACTIVEWEAR_ACCOUNT_NUMBER and SS_ACTIVEWEAR_API_KEY in .env.local')
    }

    // Create Basic Auth header: base64(accountNumber:apiKey)
    const credentials = Buffer.from(`${this.accountNumber}:${this.apiKey}`).toString('base64')
    this.authHeader = `Basic ${credentials}`
  }

  /**
   * Make authenticated request to SS Activewear API
   */
  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Authorization': this.authHeader,
          'Content-Type': 'application/json',
          ...options?.headers
        }
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`SS Activewear API error for ${endpoint}:`, response.status, errorText)
        throw new Error(`SS Activewear API error (${response.status}): ${errorText}`)
      }

      const data = await response.json()
      console.log(`SS Activewear API response for ${endpoint}:`, typeof data, Array.isArray(data) ? `array[${data.length}]` : 'object')
      return data as T
    } catch (error) {
      console.error('SS Activewear API request failed:', error)
      throw error
    }
  }

  /**
   * Get all styles (cached for 1 hour)
   */
  async getAllStyles(): Promise<SSProduct[]> {
    const cacheKey = 'ss:all_styles'
    const cached = cache.get<SSProduct[]>(cacheKey, 60 * 60 * 1000) // 1 hour

    if (cached) {
      return cached
    }

    const data = await this.request<SSProduct[]>('/styles')

    // Ensure we always return an array
    if (!data || !Array.isArray(data)) {
      console.warn('SS Activewear API returned unexpected format:', typeof data)
      return []
    }

    cache.set(cacheKey, data, 60 * 60 * 1000)
    return data
  }

  /**
   * Search styles by keyword or style number
   */
  async searchStyles(query: string): Promise<SSSearchResult[]> {
    const cacheKey = `ss:search:${query.toLowerCase()}`
    const cached = cache.get<SSSearchResult[]>(cacheKey, 15 * 60 * 1000) // 15 minutes

    if (cached) {
      return cached
    }

    // Get all styles and filter locally for better performance
    // SS API doesn't have a dedicated search endpoint
    const allStyles = await this.getAllStyles()

    // Ensure we have an array to work with
    if (!Array.isArray(allStyles)) {
      console.error('getAllStyles did not return an array:', allStyles)
      return []
    }

    const searchTerm = query.toLowerCase()

    const results = allStyles
      .filter(style => {
        return (
          style.styleName?.toLowerCase().includes(searchTerm) ||
          style.brandName?.toLowerCase().includes(searchTerm) ||
          (style as any).baseCategory?.toLowerCase().includes(searchTerm) ||
          style.description?.toLowerCase().includes(searchTerm)
        )
      })
      .map(style => ({
        styleID: style.styleID,
        styleName: style.styleName,
        brandName: style.brandName,
        baseCategory: (style as any).baseCategory || '',
        productThumbnail: style.productThumbnail,
        colors: (style.colors || []).map(c => ({
          colorID: c.colorID,
          colorName: c.colorName
        }))
      }))
      .sort((a, b) => {
        const aName = a.styleName?.toLowerCase() || ''
        const bName = b.styleName?.toLowerCase() || ''

        // 1. Exact match on style name (highest priority)
        const aExact = aName === searchTerm
        const bExact = bName === searchTerm
        if (aExact && !bExact) return -1
        if (!aExact && bExact) return 1

        // 2. Starts with query
        const aStarts = aName.startsWith(searchTerm)
        const bStarts = bName.startsWith(searchTerm)
        if (aStarts && !bStarts) return -1
        if (!aStarts && bStarts) return 1

        // 3. Contains query in style name
        const aContains = aName.includes(searchTerm)
        const bContains = bName.includes(searchTerm)
        if (aContains && !bContains) return -1
        if (!aContains && bContains) return 1

        // 4. Alphabetical by style name
        return aName.localeCompare(bName)
      })
      .slice(0, 20) // Limit to 20 results

    cache.set(cacheKey, results, 15 * 60 * 1000)
    return results
  }

  /**
   * Get detailed product information by style ID
   */
  async getStyleById(styleId: number): Promise<SSStyleDetail | null> {
    const cacheKey = `ss:style:${styleId}`
    const cached = cache.get<SSStyleDetail>(cacheKey, 30 * 60 * 1000) // 30 minutes

    if (cached) {
      return cached
    }

    try {
      const data = await this.request<SSStyleDetail | SSStyleDetail[]>(`/styles/${styleId}`)

      // SS API returns an array with one element for single style queries
      const styleDetail = Array.isArray(data) ? data[0] : data

      if (!styleDetail) {
        return null
      }

      cache.set(cacheKey, styleDetail, 30 * 60 * 1000)
      return styleDetail
    } catch (error) {
      console.error(`Failed to fetch style ${styleId}:`, error)
      return null
    }
  }

  /**
   * Get inventory for a specific style
   */
  async getInventoryByStyleId(styleId: number): Promise<SSColor[]> {
    const cacheKey = `ss:inventory:${styleId}`
    const cached = cache.get<SSColor[]>(cacheKey, 5 * 60 * 1000) // 5 minutes (shorter TTL for inventory)

    if (cached) {
      return cached
    }

    try {
      // SS API returns array of products (one per color/size combo)
      const products = await this.request<any[]>(`/products/?styleid=${styleId}`)

      if (!Array.isArray(products) || products.length === 0) {
        return []
      }

      // Group products by color
      const colorMap = new Map<string, SSColor>()

      products.forEach(product => {
        const colorKey = product.colorCode || product.colorName

        if (!colorMap.has(colorKey)) {
          colorMap.set(colorKey, {
            colorID: product.colorCode ? parseInt(product.colorCode, 10) : 0,
            colorName: product.colorName,
            colorHex: product.color1,
            colorSwatchUrl: product.colorSwatchImage,
            frontImage: product.colorFrontImage || undefined,
            backImage: product.colorBackImage || undefined,
            sideImage: product.colorSideImage || undefined,
            colorImages: [
              product.colorFrontImage,
              product.colorSideImage,
              product.colorBackImage
            ].filter(Boolean),
            sizes: []
          })
        }

        // Add size to this color
        const color = colorMap.get(colorKey)!
        color.sizes.push({
          sizeID: product.sizeCode ? parseInt(product.sizeCode, 10) : 0,
          sizeName: product.sizeName,
          wholesalePrice: product.piecePrice || 0,
          retailPrice: product.mapPrice || 0,
          inventory: product.warehouses?.map((w: any) => ({
            warehouse: w.warehouseAbbr,
            qty: w.qty,
            available: w.qty > 0
          }))
        })
      })

      const colors = Array.from(colorMap.values())
      cache.set(cacheKey, colors, 5 * 60 * 1000)
      return colors
    } catch (error) {
      console.error(`Failed to fetch inventory for style ${styleId}:`, error)
      return []
    }
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    cache.clear()
  }
}

// Export singleton instance
export const ssActivewear = new SSActivewearClient()
