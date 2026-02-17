'use client'

import { useState, useEffect, useRef } from 'react'
import { SupplierKey, SUPPLIERS, DEFAULT_SUPPLIER } from '@/app/lib/suppliers/types'

/**
 * Unified product lookup component that works with both SanMar and SS Activewear.
 * - SanMar: exact style# lookup via SOAP API
 * - SS Activewear: fuzzy search across cached catalog
 *
 * Replaces SSProductLookup with supplier-awareness.
 */

interface ProductLookupProps {
  itemNumber: string
  supplier: SupplierKey
  onSelect: (product: any, supplier: SupplierKey) => void
  onItemNumberChange: (value: string) => void
  onSupplierChange: (supplier: SupplierKey) => void
}

export default function ProductLookup({
  itemNumber,
  supplier,
  onSelect,
  onItemNumberChange,
  onSupplierChange,
}: ProductLookupProps) {
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 })
  const [userIsTyping, setUserIsTyping] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Update dropdown position when showing
  useEffect(() => {
    if (showDropdown && inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      })
    }
  }, [showDropdown])

  // Search when item number changes (only if user is typing)
  useEffect(() => {
    const searchProducts = async () => {
      if (itemNumber.length < 2) {
        setResults([])
        setShowDropdown(false)
        return
      }

      if (!userIsTyping) return

      setLoading(true)
      try {
        let data: any

        if (supplier === 'sanmar') {
          // SanMar: exact style lookup
          const response = await fetch(
            `/api/suppliers/sanmar/product/${encodeURIComponent(itemNumber)}`
          )
          if (!response.ok) {
            // Don't show error for 404 (product not found yet - user still typing)
            if (response.status !== 404) {
              console.error('SanMar API error:', response.status)
            }
            setResults([])
            setShowDropdown(false)
            setLoading(false)
            return
          }
          data = await response.json()

          if (data.success && data.data) {
            // SanMar returns a single product - wrap it in array for dropdown
            const product = data.data
            setResults([{
              styleID: product.styleID,
              styleName: product.styleName,
              brandName: product.brandName,
              baseCategory: product.category,
              productThumbnail: product.productThumbnail,
              colors: product.colors.map((c: any) => ({
                colorID: c.colorID,
                colorName: c.colorName,
              })),
              _supplier: 'sanmar',
              _fullProduct: product, // Cache the full product data
            }])
            setShowDropdown(true)
            setSelectedIndex(0)
          } else {
            setResults([])
            setShowDropdown(false)
          }
        } else {
          // SS Activewear: fuzzy search
          const response = await fetch(
            `/api/suppliers/ss/search?q=${encodeURIComponent(itemNumber)}`
          )
          if (!response.ok) {
            console.error('SS API error:', response.status)
            setResults([])
            setShowDropdown(false)
            setLoading(false)
            return
          }
          data = await response.json()

          if (data.success && data.data.length > 0) {
            setResults(data.data.slice(0, 10).map((p: any) => ({ ...p, _supplier: 'ss' })))
            setShowDropdown(true)
            setSelectedIndex(0)
          } else {
            setResults([])
            setShowDropdown(false)
          }
        }
      } catch (error) {
        console.error('Product search error:', error)
        setResults([])
        setShowDropdown(false)
      } finally {
        setLoading(false)
      }
    }

    const debounce = setTimeout(searchProducts, supplier === 'sanmar' ? 500 : 300)
    return () => clearTimeout(debounce)
  }, [itemNumber, userIsTyping, supplier])

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        inputRef.current && !inputRef.current.contains(e.target as Node) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false)
      }
    }
    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showDropdown])

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || results.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => (prev + 1) % results.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => (prev - 1 + results.length) % results.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      handleSelect(results[selectedIndex])
    } else if (e.key === 'Escape') {
      setShowDropdown(false)
    }
  }

  const handleSelect = (product: any) => {
    console.log(`Product Selected (${supplier}):`, product)
    onSelect(product, supplier)
    setShowDropdown(false)
    setUserIsTyping(false)
  }

  const supplierConfig = SUPPLIERS[supplier]

  return (
    <div style={{ position: 'relative', width: '100%' }} ref={dropdownRef}>
      {/* Supplier selector + search input row */}
      <div style={{ display: 'flex', gap: '0px', position: 'relative' }}>
        {/* Supplier toggle button */}
        <button
          onClick={() => {
            const keys = Object.keys(SUPPLIERS) as SupplierKey[]
            const currentIdx = keys.indexOf(supplier)
            const nextSupplier = keys[(currentIdx + 1) % keys.length]
            onSupplierChange(nextSupplier)
            setResults([])
            setShowDropdown(false)
          }}
          title={`Switch supplier (currently ${supplierConfig.name})`}
          style={{
            padding: '8px 8px',
            fontSize: '10px',
            fontWeight: 700,
            background: supplier === 'sanmar' ? '#1e3a5f' : '#3b1f5e',
            color: supplier === 'sanmar' ? '#60a5fa' : '#a78bfa',
            borderTop: `1px solid ${supplier === 'sanmar' ? 'rgba(96,165,250,0.3)' : 'rgba(167,139,250,0.3)'}`,
            borderBottom: `1px solid ${supplier === 'sanmar' ? 'rgba(96,165,250,0.3)' : 'rgba(167,139,250,0.3)'}`,
            borderLeft: `1px solid ${supplier === 'sanmar' ? 'rgba(96,165,250,0.3)' : 'rgba(167,139,250,0.3)'}`,
            borderRight: 'none',
            borderRadius: '8px 0 0 8px',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            letterSpacing: '0.5px',
            transition: 'all 0.15s ease',
            minWidth: '32px',
            textAlign: 'center',
          }}
        >
          {supplierConfig.shortName}
        </button>

        {/* Search input */}
        <div style={{ position: 'relative', flex: 1 }}>
          <input
            ref={inputRef}
            type="text"
            value={itemNumber}
            onChange={(e) => {
              setUserIsTyping(true)
              onItemNumberChange(e.target.value)
            }}
            onKeyDown={handleKeyDown}
            placeholder={supplier === 'sanmar' ? 'PC61, G8000...' : 'ST350, PC54...'}
            style={{
              width: '100%',
              padding: '8px',
              paddingRight: loading ? '32px' : '8px',
              fontSize: '13px',
              background: '#1d1d1d',
              border: '1px solid rgba(148,163,184,0.2)',
              borderRadius: '0 8px 8px 0',
              color: '#f1f5f9',
            }}
          />
          {loading && (
            <div style={{
              position: 'absolute',
              right: '8px',
              top: '50%',
              transform: 'translateY(-50%)',
            }}>
              <div style={{
                width: '14px',
                height: '14px',
                border: '2px solid rgba(148,163,184,0.2)',
                borderTopColor: supplier === 'sanmar' ? '#60a5fa' : '#8b5cf6',
                borderRadius: '50%',
                animation: 'spin 0.6s linear infinite',
              }} />
            </div>
          )}
        </div>
      </div>

      {/* Dropdown results */}
      {showDropdown && results.length > 0 && (
        <div
          style={{
            position: 'fixed',
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
            minWidth: '350px',
            width: 'auto',
            background: '#1d1d1d',
            border: '1px solid rgba(148,163,184,0.3)',
            borderRadius: '10px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            maxHeight: '400px',
            overflowY: 'auto',
            zIndex: 9999,
          }}
        >
          {results.map((product, index) => (
            <div
              key={product.styleID || index}
              onClick={() => handleSelect(product)}
              style={{
                padding: '8px 12px',
                borderBottom: index < results.length - 1 ? '1px solid rgba(148,163,184,0.1)' : 'none',
                cursor: 'pointer',
                background: index === selectedIndex ? '#282a30' : 'transparent',
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <div style={{
                color: '#f1f5f9',
                fontSize: '13px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                <span style={{
                  fontSize: '9px',
                  fontWeight: 700,
                  padding: '1px 4px',
                  borderRadius: '3px',
                  marginRight: '6px',
                  background: supplier === 'sanmar' ? 'rgba(96,165,250,0.15)' : 'rgba(167,139,250,0.15)',
                  color: supplier === 'sanmar' ? '#60a5fa' : '#a78bfa',
                }}>
                  {supplierConfig.shortName}
                </span>
                <span style={{ fontWeight: 600 }}>{product.styleName}</span>
                {' '}
                <span style={{ color: '#64748b' }}>
                  ({product.brandName}
                  {product.baseCategory || product.category ? ` • ${product.baseCategory || product.category}` : ''})
                </span>
              </div>
              {supplier === 'sanmar' && product.colors && product.colors.length > 0 && (
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                  {product.colors.length} color{product.colors.length !== 1 ? 's' : ''} available
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
