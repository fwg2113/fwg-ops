-- ============================================================================
-- FWG Ops - Purchase Orders System
-- Created: 2026-02-25
-- Phase: 1.0 - SanMar Purchase Order Integration
-- ============================================================================
--
-- This migration creates tables for managing supplier purchase orders:
-- 1. purchase_orders - Header table for POs submitted to suppliers
-- 2. purchase_order_items - Line items within each PO
--
-- ============================================================================

-- ============================================================================
-- 1. PURCHASE ORDERS TABLE
-- ============================================================================
-- Stores submitted purchase orders with full tracking history.
-- Each PO maps to a single supplier submission.
-- ============================================================================

CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number TEXT UNIQUE NOT NULL,
  supplier TEXT NOT NULL DEFAULT 'sanmar',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'confirmed', 'shipped', 'delivered', 'cancelled', 'error')),

  -- Shipping info (hardcoded for now, but stored per-PO for history)
  ship_to TEXT,
  ship_address1 TEXT,
  ship_address2 TEXT,
  ship_city TEXT,
  ship_state TEXT,
  ship_zip TEXT,
  ship_method TEXT DEFAULT 'UPS',
  ship_email TEXT,
  residence TEXT DEFAULT 'N',

  -- Totals
  total_items INTEGER DEFAULT 0,
  total_units INTEGER DEFAULT 0,
  total_cost NUMERIC(10,2) DEFAULT 0,

  -- Supplier response
  supplier_confirmation TEXT,
  supplier_response JSONB,

  -- Tracking
  submitted_at TIMESTAMPTZ,
  submitted_by TEXT,
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON purchase_orders(supplier);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_submitted_at ON purchase_orders(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_po_number ON purchase_orders(po_number);

-- Updated timestamp trigger
CREATE TRIGGER update_purchase_orders_updated_at
  BEFORE UPDATE ON purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE purchase_orders IS 'Supplier purchase orders submitted via API (SanMar, etc.)';
COMMENT ON COLUMN purchase_orders.po_number IS 'Unique PO number sent to supplier (max 28 chars for SanMar)';
COMMENT ON COLUMN purchase_orders.supplier_confirmation IS 'Confirmation number returned by supplier after submission';
COMMENT ON COLUMN purchase_orders.supplier_response IS 'Full JSON response from supplier API';

-- ============================================================================
-- 2. PURCHASE ORDER ITEMS TABLE
-- ============================================================================
-- Individual line items within a purchase order.
-- Links back to the source document/line_item for traceability.
-- ============================================================================

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,

  -- Source tracking (which quote/invoice line item this came from)
  source_document_id UUID,
  source_line_item_id UUID,
  source_document_number TEXT,
  customer_name TEXT,

  -- Product info (snapshot at time of PO)
  supplier TEXT NOT NULL DEFAULT 'sanmar',
  style TEXT NOT NULL,
  color TEXT NOT NULL,
  catalog_color TEXT,
  size TEXT NOT NULL,
  quantity INTEGER NOT NULL,

  -- SanMar-specific ordering fields
  inventory_key INTEGER,
  size_index INTEGER,

  -- Pricing snapshot
  wholesale_price NUMERIC(10,2),
  line_cost NUMERIC(10,2),

  -- Warehouse
  warehouse_id INTEGER,
  warehouse_name TEXT,

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'confirmed', 'backordered', 'shipped', 'cancelled')),

  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_po_items_purchase_order ON purchase_order_items(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_po_items_source_document ON purchase_order_items(source_document_id);
CREATE INDEX IF NOT EXISTS idx_po_items_source_line_item ON purchase_order_items(source_line_item_id);
CREATE INDEX IF NOT EXISTS idx_po_items_style ON purchase_order_items(style, color);

-- Comments
COMMENT ON TABLE purchase_order_items IS 'Individual items within a purchase order, linked to source documents';
COMMENT ON COLUMN purchase_order_items.source_document_id IS 'References the quote/invoice this item originated from';
COMMENT ON COLUMN purchase_order_items.source_line_item_id IS 'References the specific line item this PO item was created from';
COMMENT ON COLUMN purchase_order_items.catalog_color IS 'SanMar mainframe color code used for ordering (different from display color)';
COMMENT ON COLUMN purchase_order_items.inventory_key IS 'SanMar inventory key for this style/color combo';
COMMENT ON COLUMN purchase_order_items.size_index IS 'SanMar size index within the inventory key';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
