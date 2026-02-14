'use client'

import { useState, useEffect, useRef } from 'react'

interface SSProductLookupProps {
  itemNumber: string
  onSelect: (product: SSProduct) => void
  onItemNumberChange: (value: string) => void
}

interface SSProduct {
  styleID: number
  styleName: string
  brandName: string
  baseCategory: string
  productThumbnail: string
  colors: Array<{
    colorID: number
    colorName: string
    colorHex?: string
    colorImage?: string
    sizes: Array<{
      sizeID: number
      sizeName: string
      wholesalePrice: number
    }>
  }>
}

export default function SSProductLookup({
  itemNumber,
  onSelect,
  onItemNumberChange
}: SSProductLookupProps) {
  const [results, setResults] = useState<SSProduct[]>([])
  const [loading, setLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 })
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Update dropdown position when showing
  useEffect(() => {
    if (showDropdown && inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width
      })
    }
  }, [showDropdown])

  // Search SS Activewear when item number changes
  useEffect(() => {
    const searchProducts = async () => {
      if (itemNumber.length < 2) {
        setResults([])
        setShowDropdown(false)
        return
      }

      setLoading(true)
      try {
        const response = await fetch(
          `/api/suppliers/ss/search?q=${encodeURIComponent(itemNumber)}`
        )
        const data = await response.json()

        if (data.success && data.data.length > 0) {
          console.log('SS Search Results:', data.data.slice(0, 3)) // Log first 3 results
          setResults(data.data.slice(0, 10)) // Show up to 10 results
          setShowDropdown(true)
          setSelectedIndex(0)
        } else {
          setResults([])
          setShowDropdown(false)
        }
      } catch (error) {
        console.error('SS product search error:', error)
        setResults([])
        setShowDropdown(false)
      } finally {
        setLoading(false)
      }
    }

    const debounce = setTimeout(searchProducts, 300)
    return () => clearTimeout(debounce)
  }, [itemNumber])

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

  const handleSelect = (product: SSProduct) => {
    console.log('SS Product Selected:', product)
    onSelect(product)
    setShowDropdown(false)
  }

  return (
    <div style={{ position: 'relative', width: '100%' }} ref={dropdownRef}>
      <div style={{ position: 'relative' }}>
        <input
          ref={inputRef}
          type="text"
          value={itemNumber}
          onChange={(e) => onItemNumberChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="ST350, PC54, etc."
          style={{
            width: '100%',
            padding: '8px',
            paddingRight: loading ? '32px' : '8px',
            fontSize: '13px',
            background: '#1d1d1d',
            border: '1px solid rgba(148,163,184,0.2)',
            borderRadius: '8px',
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
              borderTopColor: '#8b5cf6',
              borderRadius: '50%',
              animation: 'spin 0.6s linear infinite',
            }} />
          </div>
        )}
      </div>

      {showDropdown && results.length > 0 && (
        <div
          ref={dropdownRef}
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
              key={product.styleID}
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
                <span style={{ fontWeight: 600 }}>{product.styleName}</span>
                {' '}
                <span style={{ color: '#64748b' }}>({product.brandName} • {product.baseCategory})</span>
              </div>
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
