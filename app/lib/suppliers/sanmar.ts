/**
 * SanMar SOAP API Client
 *
 * Provides authenticated access to SanMar's product catalog, inventory,
 * and pricing via their SOAP/XML Web Services API.
 * Implements caching to reduce API calls and improve performance.
 *
 * API Documentation: SanMar Web Services Integration Guide v24.3
 * Authentication: Customer Number + SanMar.com Username + Password
 *
 * Key endpoints used:
 * - getProductInfoByStyleColorSize: Product data (style, colors, sizes, pricing, images)
 * - getInventoryQtyForStyleColorSize: Warehouse-level inventory
 */

import {
  SupplierProduct,
  SupplierColor,
  SupplierSize,
  SupplierInventory,
  SupplierSizeInventory,
  SupplierProductInventory,
} from './types'

// ============================================================================
// TYPES & INTERFACES (SanMar-specific raw API types)
// ============================================================================

interface SanMarProductBasicInfo {
  availableSizes: string
  brandName: string
  caseSize: string
  catalogColor: string      // Mainframe color (used for ordering)
  color: string             // Display color name
  inventoryKey: string
  keywords: string
  pieceWeight: string
  productDescription: string
  productStatus: string     // Active, Discontinued, New, Coming Soon
  productTitle: string
  size: string
  sizeIndex: string
  style: string
  uniqueKey: string
  category: string
}

interface SanMarProductImageInfo {
  brandLogoImage: string
  colorProductImage: string
  colorProductImageThumbnail: string
  colorSquareImage: string
  colorSwatchImage: string
  productImage: string
  specSheet: string
  thumbnailImage: string
  titleImage: string
  frontModel: string
  backModel: string
  sideModel: string
  backFlat: string
  frontFlat: string
  threeQModel: string
}

interface SanMarProductPriceInfo {
  casePrice: string
  caseSalePrice?: string
  dozenPrice: string
  dozenSalePrice?: string
  piecePrice: string
  pieceSalePrice?: string
  priceCode: string
  priceText: string
  saleEndDate?: string
  saleStartDate?: string
}

interface SanMarProductResponse {
  productBasicInfo: SanMarProductBasicInfo
  productImageInfo: SanMarProductImageInfo
  productPriceInfo: SanMarProductPriceInfo
}

interface SanMarInventorySku {
  color: string
  size: string
  warehouses: Array<{
    whseID: string
    whseName: string
    qty: string
  }>
}

// ============================================================================
// CACHE (same pattern as SS Activewear)
// ============================================================================

interface CacheEntry<T> {
  data: T
  timestamp: number
}

class SimpleCache {
  private cache: Map<string, CacheEntry<any>> = new Map()
  private defaultTtl: number = 15 * 60 * 1000 // 15 minutes

  set<T>(key: string, data: T, ttl?: number): void {
    this.cache.set(key, { data, timestamp: Date.now() })
  }

  get<T>(key: string, ttl?: number): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null
    const maxAge = ttl || this.defaultTtl
    if (Date.now() - entry.timestamp > maxAge) {
      this.cache.delete(key)
      return null
    }
    return entry.data as T
  }

  clear(): void { this.cache.clear() }
  delete(key: string): void { this.cache.delete(key) }
}

const cache = new SimpleCache()

// ============================================================================
// XML HELPERS
// ============================================================================

/**
 * Extract text content from an XML tag. Handles self-closing tags and missing tags.
 */
function xmlValue(xml: string, tag: string): string {
  // Match <tag>content</tag> or <tag /> (self-closing)
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i')
  const match = xml.match(regex)
  if (match) return match[1].trim()
  return ''
}

/**
 * Extract all occurrences of an XML block
 */
function xmlAll(xml: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}[^>]*>[\\s\\S]*?</${tag}>`, 'gi')
  return xml.match(regex) || []
}

/**
 * Decode XML entities
 */
function decodeXml(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}

// ============================================================================
// SANMAR CLIENT
// ============================================================================

export class SanMarClient {
  private customerNumber: string
  private username: string
  private password: string

  // Production WSDL endpoints
  private productInfoUrl = 'https://ws.sanmar.com:8080/SanMarWebService/SanMarProductInfoServicePort?wsdl'
  private inventoryUrl = 'https://ws.sanmar.com:8080/SanMarWebService/SanMarWebServicePort?wsdl'
  private poUrl = 'https://ws.sanmar.com:8080/SanMarWebService/SanMarPOServicePort?wsdl'

  constructor() {
    this.customerNumber = process.env.SANMAR_CUSTOMER_NUMBER || ''
    this.username = process.env.SANMAR_USERNAME || ''
    this.password = process.env.SANMAR_PASSWORD || ''

    if (!this.customerNumber || !this.username || !this.password) {
      throw new Error(
        'SanMar credentials not configured. Set SANMAR_CUSTOMER_NUMBER, SANMAR_USERNAME, and SANMAR_PASSWORD in .env.local'
      )
    }
  }

  // --------------------------------------------------------------------------
  // SOAP Request Helper
  // --------------------------------------------------------------------------

  /**
   * Make a SOAP request to a SanMar WSDL endpoint
   */
  private async soapRequest(url: string, soapBody: string): Promise<string> {
    const envelope = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:impl="http://impl.webservice.integration.sanmar.com/"
  xmlns:web="http://webservice.integration.sanmar.com/">
  <soapenv:Header/>
  <soapenv:Body>
    ${soapBody}
  </soapenv:Body>
</soapenv:Envelope>`

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': '',
        },
        body: envelope,
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`SanMar SOAP error (${response.status}):`, errorText.substring(0, 500))
        throw new Error(`SanMar API error (${response.status})`)
      }

      return await response.text()
    } catch (error) {
      console.error('SanMar SOAP request failed:', error)
      throw error
    }
  }

  /**
   * Build the SanMar standard auth XML block
   */
  private authXml(): string {
    return `<arg1>
      <sanMarCustomerNumber>${this.customerNumber}</sanMarCustomerNumber>
      <sanMarUserName>${this.username}</sanMarUserName>
      <sanMarUserPassword>${this.password}</sanMarUserPassword>
    </arg1>`
  }

  // --------------------------------------------------------------------------
  // Product Information
  // --------------------------------------------------------------------------

  /**
   * Get product info by style number.
   * Returns all color/size combinations for the given style.
   * Optionally filter by color and/or size.
   *
   * Uses: getProductInfoByStyleColorSize SOAP method
   */
  async getProductByStyle(
    style: string,
    color?: string,
    size?: string
  ): Promise<SupplierProduct | null> {
    const cacheKey = `sanmar:product:${style.toLowerCase()}:${(color || '').toLowerCase()}:${(size || '').toLowerCase()}`
    const cached = cache.get<SupplierProduct>(cacheKey, 30 * 60 * 1000) // 30 min
    if (cached) return cached

    try {
      const soapBody = `<impl:getProductInfoByStyleColorSize>
        <arg0>
          <style>${style}</style>
          ${color ? `<color>${color}</color>` : ''}
          ${size ? `<size>${size}</size>` : ''}
        </arg0>
        ${this.authXml()}
      </impl:getProductInfoByStyleColorSize>`

      const responseXml = await this.soapRequest(this.productInfoUrl, soapBody)

      // Check for errors
      const errorOccurred = xmlValue(responseXml, 'errorOccured')
      if (errorOccurred === 'true') {
        const message = xmlValue(responseXml, 'message')
        console.error('SanMar product lookup error:', message)
        return null
      }

      // Parse all listResponse blocks (each is a color/size combo)
      const listResponses = xmlAll(responseXml, 'listResponse')
      if (listResponses.length === 0) {
        console.log(`SanMar: No products found for style "${style}"`)
        return null
      }

      // Parse each response into structured data
      const rawProducts: SanMarProductResponse[] = listResponses.map(lr => ({
        productBasicInfo: {
          availableSizes: decodeXml(xmlValue(lr, 'availableSizes')),
          brandName: decodeXml(xmlValue(lr, 'brandName')),
          caseSize: xmlValue(lr, 'caseSize'),
          catalogColor: decodeXml(xmlValue(lr, 'catalogColor')),
          color: decodeXml(xmlValue(lr, 'color')),
          inventoryKey: xmlValue(lr, 'inventoryKey'),
          keywords: xmlValue(lr, 'keywords'),
          pieceWeight: xmlValue(lr, 'pieceWeight'),
          productDescription: decodeXml(xmlValue(lr, 'productDescription')),
          productStatus: xmlValue(lr, 'productStatus'),
          productTitle: decodeXml(xmlValue(lr, 'productTitle')),
          size: xmlValue(lr, 'size'),
          sizeIndex: xmlValue(lr, 'sizeIndex'),
          style: xmlValue(lr, 'style'),
          uniqueKey: xmlValue(lr, 'uniqueKey'),
          category: decodeXml(xmlValue(lr, 'category')),
        },
        productImageInfo: {
          brandLogoImage: xmlValue(lr, 'brandLogoImage'),
          colorProductImage: xmlValue(lr, 'colorProductImage'),
          colorProductImageThumbnail: xmlValue(lr, 'colorProductImageThumbnail'),
          colorSquareImage: xmlValue(lr, 'colorSquareImage'),
          colorSwatchImage: xmlValue(lr, 'colorSwatchImage'),
          productImage: xmlValue(lr, 'productImage'),
          specSheet: xmlValue(lr, 'specSheet'),
          thumbnailImage: xmlValue(lr, 'thumbnailImage'),
          titleImage: xmlValue(lr, 'titleImage'),
          frontModel: xmlValue(lr, 'frontModel'),
          backModel: xmlValue(lr, 'backModel'),
          sideModel: xmlValue(lr, 'sideModel'),
          backFlat: xmlValue(lr, 'backFlat'),
          frontFlat: xmlValue(lr, 'frontFlat'),
          threeQModel: xmlValue(lr, 'threeQModel'),
        },
        productPriceInfo: {
          casePrice: xmlValue(lr, 'casePrice'),
          caseSalePrice: xmlValue(lr, 'caseSalePrice'),
          dozenPrice: xmlValue(lr, 'dozenPrice'),
          dozenSalePrice: xmlValue(lr, 'dozenSalePrice'),
          piecePrice: xmlValue(lr, 'piecePrice'),
          pieceSalePrice: xmlValue(lr, 'pieceSalePrice'),
          priceCode: xmlValue(lr, 'priceCode'),
          priceText: xmlValue(lr, 'priceText'),
          saleEndDate: xmlValue(lr, 'saleEndDate'),
          saleStartDate: xmlValue(lr, 'saleStartDate'),
        },
      }))

      // Group by color to build the normalized SupplierProduct
      const product = this.normalizeProductData(rawProducts)
      if (product) {
        cache.set(cacheKey, product, 30 * 60 * 1000)
      }

      return product
    } catch (error) {
      console.error(`SanMar: Failed to fetch product for style "${style}":`, error)
      return null
    }
  }

  /**
   * Normalize SanMar raw product data into our unified SupplierProduct format.
   * Groups the flat list of style/color/size combos into a hierarchical structure.
   */
  private normalizeProductData(rawProducts: SanMarProductResponse[]): SupplierProduct | null {
    if (rawProducts.length === 0) return null

    const first = rawProducts[0]
    const basic = first.productBasicInfo
    const images = first.productImageInfo

    // Group by color
    const colorMap = new Map<string, {
      colorName: string
      catalogColor: string
      images: SanMarProductImageInfo
      sizes: Array<{
        basic: SanMarProductBasicInfo
        price: SanMarProductPriceInfo
      }>
    }>()

    for (const raw of rawProducts) {
      const colorKey = raw.productBasicInfo.catalogColor || raw.productBasicInfo.color
      if (!colorMap.has(colorKey)) {
        colorMap.set(colorKey, {
          colorName: raw.productBasicInfo.color,
          catalogColor: raw.productBasicInfo.catalogColor,
          images: raw.productImageInfo,
          sizes: [],
        })
      }
      colorMap.get(colorKey)!.sizes.push({
        basic: raw.productBasicInfo,
        price: raw.productPriceInfo,
      })
    }

    const colors: SupplierColor[] = Array.from(colorMap.entries()).map(([key, colorData]) => {
      const sizes: SupplierSize[] = colorData.sizes.map(s => {
        const piecePrice = parseFloat(s.price.piecePrice) || 0
        const casePrice = parseFloat(s.price.casePrice) || 0
        const salePrice = parseFloat(s.price.pieceSalePrice || '') || undefined

        return {
          sizeID: s.basic.uniqueKey,
          sizeName: s.basic.size,
          sizeIndex: parseInt(s.basic.sizeIndex, 10) || 0,
          inventoryKey: parseInt(s.basic.inventoryKey, 10) || 0,
          uniqueKey: s.basic.uniqueKey,
          wholesalePrice: casePrice > 0 ? casePrice : piecePrice, // Use case price as our cost
          casePrice: casePrice > 0 ? casePrice : undefined,
          retailPrice: piecePrice,
          salePrice,
          caseSize: parseInt(s.basic.caseSize, 10) || 0,
        }
      })

      // Sort sizes in a logical order
      const sizeOrder = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL', 'OSFA', 'OSFM']
      sizes.sort((a, b) => {
        const aIdx = sizeOrder.indexOf(a.sizeName)
        const bIdx = sizeOrder.indexOf(b.sizeName)
        if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx
        if (aIdx !== -1) return -1
        if (bIdx !== -1) return 1
        return a.sizeName.localeCompare(b.sizeName)
      })

      return {
        colorID: key,
        colorName: colorData.colorName,
        catalogColor: colorData.catalogColor,
        colorHex: undefined,
        colorSwatchUrl: colorData.images.colorSquareImage || undefined,
        frontImage: colorData.images.colorProductImage || colorData.images.frontModel || colorData.images.frontFlat || undefined,
        backImage: colorData.images.backModel || colorData.images.backFlat || undefined,
        sideImage: colorData.images.sideModel || undefined,
        colorImages: [
          colorData.images.colorProductImage,
          colorData.images.frontModel,
          colorData.images.backModel,
          colorData.images.sideModel,
          colorData.images.frontFlat,
          colorData.images.backFlat,
          colorData.images.threeQModel,
        ].filter(Boolean),
        sizes,
      }
    })

    // Sort colors alphabetically
    colors.sort((a, b) => a.colorName.localeCompare(b.colorName))

    return {
      supplier: 'sanmar',
      styleID: basic.style,
      styleName: basic.style,
      brandName: basic.brandName,
      category: basic.category || '',
      description: basic.productDescription,
      productThumbnail: images.thumbnailImage || images.productImage || '',
      colors,
      productImages: [
        images.productImage,
        images.frontModel,
        images.backModel,
      ].filter(Boolean),
    }
  }

  // --------------------------------------------------------------------------
  // Inventory
  // --------------------------------------------------------------------------

  /**
   * Get inventory levels by warehouse for a given style.
   * Optionally filter by color and/or size.
   *
   * Uses: getInventoryQtyForStyleColorSize SOAP method
   * Returns structured warehouse-level inventory.
   */
  async getInventory(
    style: string,
    color?: string,
    size?: string
  ): Promise<SupplierProductInventory | null> {
    const cacheKey = `sanmar:inventory:${style.toLowerCase()}:${(color || '').toLowerCase()}:${(size || '').toLowerCase()}`
    const cached = cache.get<SupplierProductInventory>(cacheKey, 5 * 60 * 1000) // 5 min
    if (cached) return cached

    try {
      const soapBody = `<web:getInventoryQtyForStyleColorSize>
        <arg0>${this.customerNumber}</arg0>
        <arg1>${this.username}</arg1>
        <arg2>${this.password}</arg2>
        <arg3>${style}</arg3>
        ${color ? `<arg4>${color}</arg4>` : ''}
        ${size ? `<arg5>${size}</arg5>` : ''}
      </web:getInventoryQtyForStyleColorSize>`

      const responseXml = await this.soapRequest(this.inventoryUrl, soapBody)

      // Check for errors
      const errorOccurred = xmlValue(responseXml, 'errorOccurred')
      if (errorOccurred === 'true') {
        const message = xmlValue(responseXml, 'message')
        console.error('SanMar inventory error:', message)
        return null
      }

      // Parse the structured response (style-level query returns grouped by sku)
      const result = this.parseInventoryResponse(responseXml, style)
      if (result) {
        cache.set(cacheKey, result, 5 * 60 * 1000)
      }
      return result
    } catch (error) {
      console.error(`SanMar: Failed to fetch inventory for style "${style}":`, error)
      return null
    }
  }

  /**
   * Parse inventory XML response.
   * The response format differs depending on query type:
   * - Style-only query: returns structured <response> with <skus>/<sku> blocks
   * - Style/Color/Size query: may return flat listResponse integers
   */
  private parseInventoryResponse(xml: string, style: string): SupplierProductInventory | null {
    const warehouseNames: Record<string, string> = {
      '1': 'Seattle',
      '2': 'Cincinnati',
      '3': 'Dallas',
      '4': 'Reno',
      '5': 'Virginia (Dulles)',
      '6': 'Jacksonville',
      '7': 'Minneapolis',
      '12': 'Phoenix',
      '31': 'Richmond',
    }

    const items: SupplierSizeInventory[] = []

    // Try structured response first (style-level queries)
    const skuBlocks = xmlAll(xml, 'sku')
    if (skuBlocks.length > 0) {
      for (const sku of skuBlocks) {
        const colorName = decodeXml(xmlValue(sku, 'color'))
        const sizeName = xmlValue(sku, 'size')
        const whseBlocks = xmlAll(sku, 'whse')

        const inventory: SupplierInventory[] = whseBlocks.map(w => {
          const whseID = xmlValue(w, 'whseID')
          const qty = parseInt(xmlValue(w, 'qty'), 10) || 0
          return {
            warehouse: xmlValue(w, 'whseName') || warehouseNames[whseID] || `Warehouse ${whseID}`,
            warehouseId: parseInt(whseID, 10),
            qty,
            available: qty > 0,
          }
        })

        const totalQty = inventory.reduce((sum, inv) => sum + inv.qty, 0)
        items.push({ colorName, sizeName, inventory, totalQty })
      }
    } else {
      // Flat response (single style/color/size): listResponse values are quantities per warehouse
      // Warehouses returned in order: 1, 2, 3, 4, 5, 6, 7, 12, 31
      const warehouseOrder = ['1', '2', '3', '4', '5', '6', '7', '12', '31']
      const listResponses = xmlAll(xml, 'listResponse')

      if (listResponses.length > 0) {
        const inventory: SupplierInventory[] = listResponses.map((lr, i) => {
          // Extract just the integer value
          const qtyMatch = lr.match(/>(\d+)</)
          const qty = qtyMatch ? parseInt(qtyMatch[1], 10) : 0
          const whseId = warehouseOrder[i] || `${i + 1}`
          return {
            warehouse: warehouseNames[whseId] || `Warehouse ${whseId}`,
            warehouseId: parseInt(whseId, 10),
            qty,
            available: qty > 0,
          }
        })

        const totalQty = inventory.reduce((sum, inv) => sum + inv.qty, 0)
        items.push({ colorName: '', sizeName: '', inventory, totalQty })
      }
    }

    if (items.length === 0) return null

    return {
      supplier: 'sanmar',
      styleID: style,
      items,
    }
  }

  // --------------------------------------------------------------------------
  // Purchase Order Methods
  // --------------------------------------------------------------------------

  /**
   * Pre-submit validation: checks inventory availability at closest warehouse.
   * Does NOT submit the order — use submitPO() after validation.
   *
   * Uses: getPreSubmitInfo SOAP method on SanMarPOServicePort
   */
  async getPreSubmitInfo(params: {
    poNum: string
    shipAddress1: string
    shipAddress2?: string
    shipCity: string
    shipState: string
    shipZip: string
    shipMethod: string
    shipEmail?: string
    shipTo?: string
    residence?: string
    attention?: string
    items: Array<{
      style: string
      color: string
      size: string
      quantity: number
      inventoryKey?: number
      sizeIndex?: number
    }>
  }): Promise<{
    success: boolean
    message: string
    items: Array<{
      style: string
      color: string
      size: string
      quantity: number
      inventoryKey?: number
      sizeIndex?: number
      whseNo?: string
      available: boolean
      message: string
    }>
  }> {
    const detailItems = params.items.map(item => `
      <webServicePoDetailList>
        <color>${item.color}</color>
        <errorOccured>?</errorOccured>
        <inventoryKey>${item.inventoryKey || ''}</inventoryKey>
        <message>?</message>
        <poId>?</poId>
        <quantity>${item.quantity}</quantity>
        <size>${item.size}</size>
        <sizeIndex>${item.sizeIndex || ''}</sizeIndex>
        <style>${item.style}</style>
        <whseNo>?</whseNo>
      </webServicePoDetailList>`).join('')

    const soapBody = `<web:getPreSubmitInfo>
      <arg0>
        <attention>${params.attention || ''}</attention>
        <internalMessage>?</internalMessage>
        <notes>?</notes>
        <poNum>${params.poNum}</poNum>
        <poSenderId>?</poSenderId>
        <residence>${params.residence || 'N'}</residence>
        <department>?</department>
        <shipAddress1>${params.shipAddress1}</shipAddress1>
        <shipAddress2>${params.shipAddress2 || ''}</shipAddress2>
        <shipCity>${params.shipCity}</shipCity>
        <shipEmail>${params.shipEmail || ''}</shipEmail>
        <shipMethod>${params.shipMethod}</shipMethod>
        <shipState>${params.shipState}</shipState>
        <shipTo>${params.shipTo || ''}</shipTo>
        <shipZip>${params.shipZip}</shipZip>
        ${detailItems}
      </arg0>
      ${this.authXml()}
    </web:getPreSubmitInfo>`

    try {
      const responseXml = await this.soapRequest(this.poUrl, soapBody)

      const errorOccurred = xmlValue(responseXml, 'errorOccurred')
      const message = xmlValue(responseXml, 'message') || ''

      // Parse detail list responses
      const detailBlocks = xmlAll(responseXml, 'webServicePoDetailList')
      const items = detailBlocks.map(block => ({
        style: xmlValue(block, 'style'),
        color: decodeXml(xmlValue(block, 'color')),
        size: xmlValue(block, 'size'),
        quantity: parseInt(xmlValue(block, 'quantity'), 10) || 0,
        inventoryKey: parseInt(xmlValue(block, 'inventoryKey'), 10) || undefined,
        sizeIndex: parseInt(xmlValue(block, 'sizeIndex'), 10) || undefined,
        whseNo: xmlValue(block, 'whseNo') || undefined,
        available: xmlValue(block, 'errorOccured') !== 'true',
        message: decodeXml(xmlValue(block, 'message')),
      }))

      return {
        success: errorOccurred !== 'true',
        message: decodeXml(message),
        items,
      }
    } catch (error) {
      console.error('SanMar getPreSubmitInfo failed:', error)
      throw error
    }
  }

  /**
   * Submit a purchase order to SanMar for processing.
   * Call getPreSubmitInfo() first to validate inventory.
   *
   * Uses: submitPO SOAP method on SanMarPOServicePort
   */
  async submitPO(params: {
    poNum: string
    shipAddress1: string
    shipAddress2?: string
    shipCity: string
    shipState: string
    shipZip: string
    shipMethod: string
    shipEmail?: string
    shipTo?: string
    residence?: string
    attention?: string
    items: Array<{
      style: string
      color: string
      size: string
      quantity: number
      inventoryKey?: number
      sizeIndex?: number
      whseNo?: string
    }>
  }): Promise<{
    success: boolean
    message: string
    rawResponse: string
  }> {
    const detailItems = params.items.map(item => `
      <webServicePoDetailList>
        <inventoryKey>${item.inventoryKey || ''}</inventoryKey>
        <sizeIndex>${item.sizeIndex || ''}</sizeIndex>
        <style>${item.style}</style>
        <color>${item.color}</color>
        <size>${item.size}</size>
        <quantity>${item.quantity}</quantity>
        <whseNo>${item.whseNo || ''}</whseNo>
      </webServicePoDetailList>`).join('')

    const soapBody = `<web:submitPO>
      <arg0>
        <attention>${params.attention || ''}</attention>
        <notes />
        <poNum>${params.poNum}</poNum>
        <shipTo>${params.shipTo || ''}</shipTo>
        <shipAddress1>${params.shipAddress1}</shipAddress1>
        <shipAddress2>${params.shipAddress2 || ''}</shipAddress2>
        <shipCity>${params.shipCity}</shipCity>
        <shipState>${params.shipState}</shipState>
        <shipZip>${params.shipZip}</shipZip>
        <shipMethod>${params.shipMethod}</shipMethod>
        <shipEmail>${params.shipEmail || ''}</shipEmail>
        <residence>${params.residence || 'N'}</residence>
        <department />
        ${detailItems}
      </arg0>
      ${this.authXml()}
    </web:submitPO>`

    try {
      const responseXml = await this.soapRequest(this.poUrl, soapBody)

      const errorOccurred = xmlValue(responseXml, 'errorOccurred')
      const message = decodeXml(xmlValue(responseXml, 'message') || '')

      return {
        success: errorOccurred !== 'true',
        message,
        rawResponse: responseXml,
      }
    } catch (error) {
      console.error('SanMar submitPO failed:', error)
      throw error
    }
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    cache.clear()
  }
}

// Export singleton instance (lazy - only created when first imported)
let _instance: SanMarClient | null = null

export function getSanMarClient(): SanMarClient {
  if (!_instance) {
    _instance = new SanMarClient()
  }
  return _instance
}
