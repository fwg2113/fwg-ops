/**
 * Production Checklist Configuration
 *
 * Phase 1: Hardcoded placeholder task lists per line item category.
 * Phase 2: These will be replaced by database-driven config from System Settings.
 *
 * Structure: Two parallel tracks (prep + design) merge into a shared production track.
 * This mirrors the FA Orders two-track pipeline visualization.
 */

// ---------------------------------------------------------------------------
// Category groupings
// ---------------------------------------------------------------------------

export const AUTOMOTIVE_CATEGORIES = [
  'PPF',
  'VINYL_WRAP',
  'VINYL_GRAPHICS',
  'CHROME_DELETE',
  'VINYL_FOX',
  'WINDOW_PERF',
] as const

export const SIGNAGE_CATEGORIES = [
  'SIGNAGE',
  'YARD_SIGNS',
  'BANNERS',
  'BANNER_STAND',
  'A_FRAME',
  'SIGN_BOARDS',
  'STICKERS',
  'LABELS',
  'MAGNETS',
  'WALL_GRAPHICS',
] as const

export const DESIGN_CATEGORIES = [
  'DESIGN_FEE',
  'DESIGN',
] as const

export const APPAREL_CATEGORIES = [
  'APPAREL',
  'DTF_TRANSFER',
  'DTF',
  'EMBROIDERY',
  'SCREEN_PRINT',
] as const

export const ALL_PRODUCTION_CATEGORIES = [
  ...AUTOMOTIVE_CATEGORIES,
  ...SIGNAGE_CATEGORIES,
  ...DESIGN_CATEGORIES,
] as const

// ---------------------------------------------------------------------------
// Task definition types
// ---------------------------------------------------------------------------

export type ChecklistTask = {
  key: string
  label: string
  icon?: string
}

/**
 * Two-track pipeline config per category.
 * - prepTasks: Top track (material sourcing, ordering, receiving)
 * - designTasks: Bottom track (design, artwork, file prep)
 * - productionTasks: Shared track after merge (actual production + QC)
 *
 * Both prep + design must complete before production track activates.
 */
export type PipelineConfig = {
  prepLabel: string
  prepTasks: ChecklistTask[]
  designLabel: string
  designTasks: ChecklistTask[]
  productionTasks: ChecklistTask[]
}

// ---------------------------------------------------------------------------
// Placeholder pipeline configs per category (Phase 1)
// ---------------------------------------------------------------------------

const FULL_WRAP_PIPELINE: PipelineConfig = {
  prepLabel: 'Materials',
  prepTasks: [
    { key: 'material_ordered', label: 'Material\nOrdered', icon: '📋' },
    { key: 'material_received', label: 'Material\nReceived', icon: '📦' },
    { key: 'material_prepped', label: 'Material\nPrepped', icon: '🗂' },
  ],
  designLabel: 'Design',
  designTasks: [
    { key: 'design_started', label: 'Design\nStarted', icon: '🎨' },
    { key: 'design_approved', label: 'Design\nApproved', icon: '✅' },
    { key: 'file_prepped', label: 'File\nPrepped', icon: '💾' },
  ],
  productionTasks: [
    { key: 'printed', label: 'Printed', icon: '🖨' },
    { key: 'laminated', label: 'Laminated', icon: '🔧' },
    { key: 'installed', label: 'Installed', icon: '🚗' },
    { key: 'qc', label: 'QC', icon: '🔍' },
  ],
}

const PARTIAL_WRAP_PIPELINE: PipelineConfig = {
  prepLabel: 'Materials',
  prepTasks: [
    { key: 'material_ordered', label: 'Material\nOrdered', icon: '📋' },
    { key: 'material_received', label: 'Material\nReceived', icon: '📦' },
  ],
  designLabel: 'Design',
  designTasks: [
    { key: 'design_started', label: 'Design\nStarted', icon: '🎨' },
    { key: 'design_approved', label: 'Design\nApproved', icon: '✅' },
    { key: 'file_prepped', label: 'File\nPrepped', icon: '💾' },
  ],
  productionTasks: [
    { key: 'printed', label: 'Printed', icon: '🖨' },
    { key: 'laminated', label: 'Laminated', icon: '🔧' },
    { key: 'installed', label: 'Installed', icon: '🚗' },
    { key: 'qc', label: 'QC', icon: '🔍' },
  ],
}

const VINYL_WRAP_PIPELINE: PipelineConfig = {
  prepLabel: 'Materials',
  prepTasks: [
    { key: 'material_ordered', label: 'Material\nOrdered', icon: '📋' },
    { key: 'material_received', label: 'Material\nReceived', icon: '📦' },
  ],
  designLabel: 'Design',
  designTasks: [
    { key: 'design_started', label: 'Design\nStarted', icon: '🎨' },
    { key: 'design_approved', label: 'Design\nApproved', icon: '✅' },
  ],
  productionTasks: [
    { key: 'installed', label: 'Installed', icon: '🚗' },
    { key: 'qc', label: 'QC', icon: '🔍' },
  ],
}

const PPF_PIPELINE: PipelineConfig = {
  prepLabel: 'Materials',
  prepTasks: [
    { key: 'material_ordered', label: 'Material\nOrdered', icon: '📋' },
    { key: 'material_received', label: 'Material\nReceived', icon: '📦' },
  ],
  designLabel: 'Template',
  designTasks: [
    { key: 'template_selected', label: 'Template\nSelected', icon: '📐' },
    { key: 'film_cut', label: 'Film\nCut', icon: '✂️' },
  ],
  productionTasks: [
    { key: 'installed', label: 'Installed', icon: '🚗' },
    { key: 'qc', label: 'QC', icon: '🔍' },
  ],
}

const CHROME_DELETE_PIPELINE: PipelineConfig = {
  prepLabel: 'Materials',
  prepTasks: [
    { key: 'material_ordered', label: 'Material\nOrdered', icon: '📋' },
    { key: 'material_received', label: 'Material\nReceived', icon: '📦' },
  ],
  designLabel: 'Prep',
  designTasks: [
    { key: 'vehicle_prepped', label: 'Vehicle\nPrepped', icon: '🚗' },
  ],
  productionTasks: [
    { key: 'installed', label: 'Installed', icon: '🔧' },
    { key: 'qc', label: 'QC', icon: '🔍' },
  ],
}

const VINYL_CUT_PIPELINE: PipelineConfig = {
  prepLabel: 'Materials',
  prepTasks: [
    { key: 'material_ordered', label: 'Material\nOrdered', icon: '📋' },
    { key: 'material_received', label: 'Material\nReceived', icon: '📦' },
  ],
  designLabel: 'Design',
  designTasks: [
    { key: 'design_started', label: 'Design\nStarted', icon: '🎨' },
    { key: 'design_approved', label: 'Design\nApproved', icon: '✅' },
  ],
  productionTasks: [
    { key: 'cut', label: 'Cut', icon: '✂️' },
    { key: 'weeded', label: 'Weeded', icon: '🧹' },
    { key: 'installed', label: 'Installed', icon: '🚗' },
    { key: 'qc', label: 'QC', icon: '🔍' },
  ],
}

const SIGNAGE_PIPELINE: PipelineConfig = {
  prepLabel: 'Materials',
  prepTasks: [
    { key: 'material_ordered', label: 'Material\nOrdered', icon: '📋' },
    { key: 'material_received', label: 'Material\nReceived', icon: '📦' },
  ],
  designLabel: 'Design',
  designTasks: [
    { key: 'design_started', label: 'Design\nStarted', icon: '🎨' },
    { key: 'design_approved', label: 'Design\nApproved', icon: '✅' },
  ],
  productionTasks: [
    { key: 'fabricated', label: 'Fabricated', icon: '🔧' },
    { key: 'installed', label: 'Installed', icon: '📍' },
    { key: 'qc', label: 'QC', icon: '🔍' },
  ],
}

const BANNER_PIPELINE: PipelineConfig = {
  prepLabel: 'Materials',
  prepTasks: [
    { key: 'material_ordered', label: 'Material\nOrdered', icon: '📋' },
    { key: 'material_received', label: 'Material\nReceived', icon: '📦' },
  ],
  designLabel: 'Design',
  designTasks: [
    { key: 'design_started', label: 'Design\nStarted', icon: '🎨' },
    { key: 'design_approved', label: 'Design\nApproved', icon: '✅' },
  ],
  productionTasks: [
    { key: 'printed', label: 'Printed', icon: '🖨' },
    { key: 'finished', label: 'Finished', icon: '🔧' },
    { key: 'qc', label: 'QC', icon: '🔍' },
  ],
}

const PRINT_PIPELINE: PipelineConfig = {
  prepLabel: 'Materials',
  prepTasks: [
    { key: 'material_ordered', label: 'Material\nOrdered', icon: '📋' },
    { key: 'material_received', label: 'Material\nReceived', icon: '📦' },
  ],
  designLabel: 'Design',
  designTasks: [
    { key: 'design_started', label: 'Design\nStarted', icon: '🎨' },
    { key: 'design_approved', label: 'Design\nApproved', icon: '✅' },
  ],
  productionTasks: [
    { key: 'printed', label: 'Printed', icon: '🖨' },
    { key: 'qc', label: 'QC', icon: '🔍' },
  ],
}

const PRINT_CUT_PIPELINE: PipelineConfig = {
  prepLabel: 'Materials',
  prepTasks: [
    { key: 'material_ordered', label: 'Material\nOrdered', icon: '📋' },
    { key: 'material_received', label: 'Material\nReceived', icon: '📦' },
  ],
  designLabel: 'Design',
  designTasks: [
    { key: 'design_started', label: 'Design\nStarted', icon: '🎨' },
    { key: 'design_approved', label: 'Design\nApproved', icon: '✅' },
  ],
  productionTasks: [
    { key: 'printed', label: 'Printed', icon: '🖨' },
    { key: 'cut', label: 'Cut', icon: '✂️' },
    { key: 'qc', label: 'QC', icon: '🔍' },
  ],
}

const DESIGN_ONLY_PIPELINE: PipelineConfig = {
  prepLabel: 'Scope',
  prepTasks: [
    { key: 'scope_confirmed', label: 'Scope\nConfirmed', icon: '📋' },
  ],
  designLabel: 'Design',
  designTasks: [
    { key: 'design_started', label: 'Design\nStarted', icon: '🎨' },
    { key: 'design_approved', label: 'Design\nApproved', icon: '✅' },
  ],
  productionTasks: [
    { key: 'files_sent', label: 'Files\nSent', icon: '📧' },
  ],
}

/**
 * Map from category key → pipeline config.
 * In Phase 2 this will be replaced by a database lookup.
 */
export const PIPELINE_CONFIGS: Record<string, PipelineConfig> = {
  // Automotive — wraps (these are line_type keys under VINYL_WRAP)
  FULL_WRAP: FULL_WRAP_PIPELINE,
  PARTIAL_WRAP: PARTIAL_WRAP_PIPELINE,
  COLOR_CHANGE_PARTIAL: PARTIAL_WRAP_PIPELINE,
  COLOR_CHANGE_FULL: FULL_WRAP_PIPELINE,
  VINYL_WRAP: VINYL_WRAP_PIPELINE,

  // Automotive — PPF / chrome / other
  PPF: PPF_PIPELINE,
  CHROME_DELETE: CHROME_DELETE_PIPELINE,

  // Automotive — vinyl graphics (category + sub-types)
  VINYL_GRAPHICS: VINYL_CUT_PIPELINE,
  CUT_VINYL: VINYL_CUT_PIPELINE,
  VAN_INSERTS: VINYL_CUT_PIPELINE,
  CAST_LET_GRAPH: VINYL_CUT_PIPELINE,
  CAST_GRAPH_BULK: VINYL_CUT_PIPELINE,
  CAL_LET_GRAPH: VINYL_CUT_PIPELINE,

  // Signage
  SIGNAGE: SIGNAGE_PIPELINE,
  BANNERS: BANNER_PIPELINE,
  YARD_SIGNS: PRINT_PIPELINE,
  A_FRAME: PRINT_PIPELINE,
  STICKERS: PRINT_CUT_PIPELINE,
  LABELS: PRINT_CUT_PIPELINE,

  // Sticker sub-types
  KISS_CUT: PRINT_CUT_PIPELINE,
  DIE_CUT: PRINT_CUT_PIPELINE,
  SHEET_LABELS: PRINT_CUT_PIPELINE,

  // Design fees
  DESIGN_FEE: DESIGN_ONLY_PIPELINE,
  DESIGN: DESIGN_ONLY_PIPELINE,

  // Categories with no default pipeline (configured in settings):
  // VINYL_FOX, WINDOW_PERF, MAGNETS, WALL_GRAPHICS, SIGN_BOARDS, BANNER_STAND
  // + sub-types: WITH_FRAME, INSERT_ONLY, VERTICAL_FLUTE, HORIZONTAL_FLUTE, CORO_PLAST, MAX_METAL, FOAM_CORE
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Get pipeline config for a category/line_type. Checks line_type first, then category. */
export function getPipelineForCategory(category: string, lineType?: string): PipelineConfig | null {
  if (lineType && PIPELINE_CONFIGS[lineType]) return PIPELINE_CONFIGS[lineType]
  return PIPELINE_CONFIGS[category] || null
}

/** Get ALL task keys (flat) for a category/line_type */
export function getAllTaskKeys(category: string, lineType?: string): string[] {
  const pipeline = getPipelineForCategory(category, lineType)
  if (!pipeline) return []
  return [
    ...pipeline.prepTasks.map(t => t.key),
    ...pipeline.designTasks.map(t => t.key),
    ...pipeline.productionTasks.map(t => t.key),
  ]
}

/** Flat task list for a category/line_type */
export function getTasksForCategory(category: string, lineType?: string): ChecklistTask[] {
  const pipeline = getPipelineForCategory(category, lineType)
  if (!pipeline) return []
  return [...pipeline.prepTasks, ...pipeline.designTasks, ...pipeline.productionTasks]
}

/** Check if a category is automotive */
export function isAutomotiveCategory(cat: string): boolean {
  return (AUTOMOTIVE_CATEGORIES as readonly string[]).includes(cat)
}

/** Check if a category is signage */
export function isSignageCategory(cat: string): boolean {
  return (SIGNAGE_CATEGORIES as readonly string[]).includes(cat)
}

/** Check if a category is design-only */
export function isDesignCategory(cat: string): boolean {
  return (DESIGN_CATEGORIES as readonly string[]).includes(cat)
}

/** Check if a category is apparel (excluded from this page) */
export function isApparelCategory(cat: string): boolean {
  return (APPAREL_CATEGORIES as readonly string[]).includes(cat)
}

/** Check if a category has production tracking (anything non-apparel) */
export function isProductionCategory(cat: string): boolean {
  return !isApparelCategory(cat)
}

export type ChecklistState = Record<string, { done: boolean; at?: string; label?: string; track?: string; position?: number; sort_order?: number; ad_hoc?: boolean }>

/** Check if all tasks in a track are done */
export function isTrackComplete(tasks: ChecklistTask[], checklist: ChecklistState): boolean {
  return tasks.length > 0 && tasks.every(t => checklist[t.key]?.done)
}

/** Compute a production status string from a document's line items + checklists */
export function computeDocProductionStatus(
  lineItems: { category: string; production_checklist?: ChecklistState }[],
  docStatus: string
): { status: string; label: string; done: number; total: number } {
  const COMPLETED_STATUSES = ['completed', 'shipped', 'picked_up']
  if (COMPLETED_STATUSES.includes(docStatus)) {
    return { status: docStatus, label: docStatus === 'picked_up' ? 'Picked Up' : docStatus.charAt(0).toUpperCase() + docStatus.slice(1), done: 0, total: 0 }
  }

  const productionItems = lineItems.filter(li => isProductionCategory(li.category))
  if (productionItems.length === 0) {
    return { status: docStatus, label: 'Paid', done: 0, total: 0 }
  }

  let totalTasks = 0
  let doneTasks = 0

  for (const li of productionItems) {
    const allTasks = getTasksForCategory(li.category)
    const checklist = li.production_checklist || {}
    totalTasks += allTasks.length
    doneTasks += allTasks.filter(t => checklist[t.key]?.done).length
  }

  if (totalTasks === 0) {
    return { status: 'paid', label: 'Paid', done: 0, total: 0 }
  }

  if (doneTasks === totalTasks) {
    return { status: 'complete', label: 'Complete', done: doneTasks, total: totalTasks }
  }

  if (doneTasks > 0) {
    return { status: 'in_production', label: `${doneTasks}/${totalTasks}`, done: doneTasks, total: totalTasks }
  }

  return { status: 'paid', label: 'Paid', done: 0, total: totalTasks }
}

// ---------------------------------------------------------------------------
// Database-driven pipeline lookup (Phase 2)
// ---------------------------------------------------------------------------

export type DbPipelineRow = {
  id: string
  category_key: string
  track: 'prep' | 'design' | 'production'
  track_label: string | null
  task_key: string
  task_label: string
  task_icon: string
  sort_order: number
}

/** Build a PipelineConfig from database rows for a given category */
export function buildPipelineFromRows(category: string, rows: DbPipelineRow[]): PipelineConfig | null {
  const catRows = rows.filter(r => r.category_key === category)
  if (catRows.length === 0) return null

  const prepRows = catRows.filter(r => r.track === 'prep').sort((a, b) => a.sort_order - b.sort_order)
  const designRows = catRows.filter(r => r.track === 'design').sort((a, b) => a.sort_order - b.sort_order)
  const prodRows = catRows.filter(r => r.track === 'production').sort((a, b) => a.sort_order - b.sort_order)

  return {
    prepLabel: prepRows[0]?.track_label || 'Prep',
    prepTasks: prepRows.map(r => ({ key: r.task_key, label: r.task_label, icon: r.task_icon })),
    designLabel: designRows[0]?.track_label || 'Design',
    designTasks: designRows.map(r => ({ key: r.task_key, label: r.task_label, icon: r.task_icon })),
    productionTasks: prodRows.map(r => ({ key: r.task_key, label: r.task_label, icon: r.task_icon })),
  }
}

/** Get pipeline for a category/line_type, preferring DB data, falling back to hardcoded.
 *  Checks line_type first, then category in both DB and hardcoded. */
export function getPipelineWithDbFallback(category: string, dbRows: DbPipelineRow[], lineType?: string): PipelineConfig | null {
  // Try line_type in DB first
  if (lineType) {
    const fromDb = buildPipelineFromRows(lineType, dbRows)
    if (fromDb) return fromDb
  }
  // Try category in DB
  const fromDbCat = buildPipelineFromRows(category, dbRows)
  if (fromDbCat) return fromDbCat
  // Fall back to hardcoded (also checks line_type first)
  return getPipelineForCategory(category, lineType)
}

/** Get all task keys for a category/line_type from DB rows, with hardcoded fallback */
export function getAllTaskKeysWithDb(category: string, dbRows: DbPipelineRow[], lineType?: string): string[] {
  const pipeline = getPipelineWithDbFallback(category, dbRows, lineType)
  if (!pipeline) return []
  return [
    ...pipeline.prepTasks.map(t => t.key),
    ...pipeline.designTasks.map(t => t.key),
    ...pipeline.productionTasks.map(t => t.key),
  ]
}

/** Get flat task list for a category/line_type from DB rows, with hardcoded fallback */
export function getTasksWithDb(category: string, dbRows: DbPipelineRow[], lineType?: string): ChecklistTask[] {
  const pipeline = getPipelineWithDbFallback(category, dbRows, lineType)
  if (!pipeline) return []
  return [...pipeline.prepTasks, ...pipeline.designTasks, ...pipeline.productionTasks]
}

/** Compute production status using DB pipeline configs */
export function computeDocProductionStatusWithDb(
  lineItems: { category: string; line_type?: string; production_checklist?: ChecklistState }[],
  docStatus: string,
  dbRows: DbPipelineRow[]
): { status: string; label: string; done: number; total: number } {
  const COMPLETED_STATUSES = ['completed', 'shipped', 'picked_up']
  if (COMPLETED_STATUSES.includes(docStatus)) {
    return { status: docStatus, label: docStatus === 'picked_up' ? 'Picked Up' : docStatus.charAt(0).toUpperCase() + docStatus.slice(1), done: 0, total: 0 }
  }

  const productionItems = lineItems.filter(li => isProductionCategory(li.category))
  if (productionItems.length === 0) {
    return { status: docStatus, label: 'Paid', done: 0, total: 0 }
  }

  let totalTasks = 0
  let doneTasks = 0

  for (const li of productionItems) {
    const allTasks = getTasksWithDb(li.category, dbRows, li.line_type)
    const checklist = li.production_checklist || {}
    totalTasks += allTasks.length
    doneTasks += allTasks.filter(t => checklist[t.key]?.done).length
  }

  if (totalTasks === 0) return { status: 'paid', label: 'Paid', done: 0, total: 0 }
  if (doneTasks === totalTasks) return { status: 'complete', label: 'Complete', done: doneTasks, total: totalTasks }
  if (doneTasks > 0) return { status: 'in_production', label: `${doneTasks}/${totalTasks}`, done: doneTasks, total: totalTasks }
  return { status: 'paid', label: 'Paid', done: 0, total: totalTasks }
}
