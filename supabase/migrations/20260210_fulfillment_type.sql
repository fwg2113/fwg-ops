-- ============================================================================
-- FWG Ops - Fulfillment Type Migration
-- Created: 2026-02-10
--
-- Adds fulfillment method tracking to documents.
-- Options: on_site_pickup, on_site_service, pickup_and_delivery, shipping
-- Each type stores additional details in a JSONB column.
-- ============================================================================

-- Add fulfillment columns to documents
ALTER TABLE documents ADD COLUMN IF NOT EXISTS fulfillment_type TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS fulfillment_details JSONB DEFAULT '{}'::jsonb;

-- Add index for filtering by fulfillment type
CREATE INDEX IF NOT EXISTS idx_documents_fulfillment_type ON documents(fulfillment_type) WHERE fulfillment_type IS NOT NULL;

-- ============================================================================
-- FULFILLMENT TYPE VALUES:
-- 'on_site_pickup'       - Customer picks up at our location
-- 'on_site_service'      - We service on-site (e.g., mobile install)
-- 'pickup_and_delivery'  - We pick up vehicle/item, service it, deliver back
-- 'shipping'             - We ship the completed product
--
-- FULFILLMENT DETAILS JSONB SCHEMA (varies by type):
--
-- on_site_pickup:
--   { "notes": "..." }
--
-- on_site_service:
--   { "service_address": "...", "dropoff_date": "...", "dropoff_time": "...",
--     "pickup_date": "...", "service_fee": 0, "notes": "..." }
--
-- pickup_and_delivery:
--   { "pickup_address": "...", "delivery_address": "...",
--     "pickup_date": "...", "delivery_date": "...",
--     "pickup_fee": 0, "delivery_fee": 0, "notes": "..." }
--
-- shipping:
--   { "shipping_address": "...", "shipping_method": "...",
--     "tracking_number": "...", "shipping_fee": 0, "notes": "..." }
-- ============================================================================
