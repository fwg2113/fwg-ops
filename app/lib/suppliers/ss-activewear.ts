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
  categoryName: string
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
  categoryName: string
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
  categoryName: string
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

    const results = allStyles
      .filter(style => {
        const searchTerm = query.toLowerCase()
        return (
          style.styleName?.toLowerCase().includes(searchTerm) ||
          style.brandName?.toLowerCase().includes(searchTerm) ||
          style.categoryName?.toLowerCase().includes(searchTerm) ||
          style.description?.toLowerCase().includes(searchTerm)
        )
      })
      .map(style => ({
        styleID: style.styleID,
        styleName: style.styleName,
        brandName: style.brandName,
        categoryName: style.categoryName,
        productThumbnail: style.productThumbnail,
        colors: style.colors.map(c => ({
          colorID: c.colorID,
          colorName: c.colorName
        }))
      }))
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
      const data = await this.request<SSStyleDetail>(`/styles/${styleId}`)
      cache.set(cacheKey, data, 30 * 60 * 1000)
      return data
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
      // SS Activewear's inventory endpoint typically returns colors with inventory data
      const data = await this.request<{ colors: SSColor[] }>(`/products/${styleId}`)
      cache.set(cacheKey, data.colors, 5 * 60 * 1000)
      return data.colors
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
