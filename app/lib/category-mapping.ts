/**
 * Category Mapping Configuration
 *
 * Maps line item categories from the FWG Ops system to revenue categories
 * used in the Google Sheets TRANSACTIONS tab and MONTHLY_PL sheet.
 *
 * This mapping ensures payments are properly categorized for financial reporting.
 */

export interface CategoryMapping {
  /**
   * The category key from line_items.category in the database
   */
  systemCategory: string

  /**
   * The revenue category name that appears in Column H of the TRANSACTIONS sheet
   */
  sheetCategory: string

  /**
   * Optional description for documentation
   */
  description?: string
}

/**
 * Category mappings from system to Google Sheets
 *
 * To modify: Update the sheetCategory value for any systemCategory
 * To add: Add a new object to the array
 */
export const CATEGORY_MAPPINGS: CategoryMapping[] = [
  // Automotive Categories
  {
    systemCategory: 'PPF',
    sheetCategory: 'PPF Revenue',
    description: 'Paint Protection Film installations'
  },
  {
    systemCategory: 'VINYL_WRAP',
    sheetCategory: 'Full Wrap Revenue',
    description: 'Full and partial vinyl wraps (user configured to use Full Wrap Revenue)'
  },
  {
    systemCategory: 'FULL_WRAP',
    sheetCategory: 'Full Wrap Revenue',
    description: 'Complete vehicle wraps'
  },
  {
    systemCategory: 'COMMERCIAL_WRAP',
    sheetCategory: 'Full Wrap Revenue',
    description: 'Commercial vehicle wraps'
  },
  {
    systemCategory: 'PARTIAL_WRAP',
    sheetCategory: 'Partial Wrap Revenue',
    description: 'Partial vehicle wraps'
  },
  {
    systemCategory: 'VINYL_LETTERING',
    sheetCategory: 'Vinyl Lettering Revenue',
    description: 'Cut vinyl lettering and text'
  },
  {
    systemCategory: 'VINYL_GRAPHICS',
    sheetCategory: 'Vinyl Graphics Revenue',
    description: 'Custom vinyl graphics and decals'
  },
  {
    systemCategory: 'CHROME_DELETE',
    sheetCategory: 'Partial Wrap Revenue',
    description: 'Chrome delete services'
  },

  // Signage Categories
  {
    systemCategory: 'SIGNAGE',
    sheetCategory: 'Signage Revenue',
    description: 'General signage products'
  },
  {
    systemCategory: 'YARD_SIGNS',
    sheetCategory: 'Signage Revenue',
    description: 'Yard signs'
  },
  {
    systemCategory: 'BANNERS',
    sheetCategory: 'Signage Revenue',
    description: 'Vinyl banners'
  },
  {
    systemCategory: 'A_FRAMES',
    sheetCategory: 'Signage Revenue',
    description: 'A-frame signs'
  },
  {
    systemCategory: 'CHANNEL_LETTERS',
    sheetCategory: 'Signage Revenue',
    description: 'Channel letter signs'
  },

  // Stickers & Labels
  {
    systemCategory: 'STICKERS',
    sheetCategory: 'Stickers Revenue',
    description: 'Custom stickers (kiss cut, die cut)'
  },
  {
    systemCategory: 'KISS_CUT_STICKERS',
    sheetCategory: 'Stickers Revenue',
    description: 'Kiss cut stickers'
  },
  {
    systemCategory: 'DIE_CUT_STICKERS',
    sheetCategory: 'Stickers Revenue',
    description: 'Die cut stickers'
  },
  {
    systemCategory: 'LABELS',
    sheetCategory: 'Labels Revenue',
    description: 'Product labels and roll labels'
  },

  // Apparel
  {
    systemCategory: 'APPAREL',
    sheetCategory: 'Apparel Revenue',
    description: 'General apparel products'
  },
  {
    systemCategory: 'DTF_TRANSFER',
    sheetCategory: 'DTF Transfer Revenue',
    description: 'Direct-to-Film transfers'
  },
  {
    systemCategory: 'DTF',
    sheetCategory: 'DTF Transfer Revenue',
    description: 'Direct-to-Film transfers (alternate key)'
  },
  {
    systemCategory: 'EMBROIDERY',
    sheetCategory: 'Embroidery Revenue',
    description: 'Embroidered apparel'
  },
  {
    systemCategory: 'SCREEN_PRINT',
    sheetCategory: 'Apparel Revenue',
    description: 'Screen printed apparel'
  },

  // Special Categories
  {
    systemCategory: 'DESIGN_FEE',
    sheetCategory: 'Design Fee Revenue',
    description: 'Design and artwork fees'
  },
  {
    systemCategory: 'DESIGN',
    sheetCategory: 'Design Fee Revenue',
    description: 'Design and artwork fees (alternate key)'
  },
  {
    systemCategory: 'FOX_DECALS',
    sheetCategory: 'Vinyl Fox Decals Revenue',
    description: 'Vinyl Fox branded decals'
  },

  // Fallback - catches any unmapped categories
  {
    systemCategory: 'OTHER',
    sheetCategory: 'Other Revenue',
    description: 'Miscellaneous revenue'
  }
]

/**
 * Get the sheet category name for a given system category
 * Returns 'Other Revenue' if no mapping is found
 */
export function getSheetCategory(systemCategory: string | null | undefined): string {
  if (!systemCategory) {
    return 'Other Revenue'
  }

  // Normalize the system category (uppercase, trim whitespace)
  const normalized = systemCategory.toUpperCase().trim()

  // Find matching mapping
  const mapping = CATEGORY_MAPPINGS.find(
    m => m.systemCategory.toUpperCase() === normalized
  )

  return mapping?.sheetCategory || 'Other Revenue'
}

/**
 * Get all unique sheet categories (for validation)
 */
export function getAllSheetCategories(): string[] {
  const categories = new Set(CATEGORY_MAPPINGS.map(m => m.sheetCategory))
  return Array.from(categories).sort()
}
