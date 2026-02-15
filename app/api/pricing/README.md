# Pricing API

API endpoints for apparel decoration pricing calculations.

## Endpoints

### 1. Get All Pricing Matrices
```
GET /api/pricing/matrices
```

Returns all pricing matrices with quantity breaks and size upcharges.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "polo-embroidery-001",
      "name": "Polo Embroidery",
      "description": "Standard left chest embroidery pricing for polos",
      "decoration_type": "embroidery",
      "base_price": 8.00,
      "quantity_breaks": [
        { "min_qty": 1, "max_qty": 11, "price_per_unit": 8.00 },
        { "min_qty": 12, "max_qty": 23, "price_per_unit": 7.50 },
        { "min_qty": 24, "max_qty": 47, "price_per_unit": 7.00 },
        { "min_qty": 48, "max_qty": 95, "price_per_unit": 6.50 },
        { "min_qty": 96, "max_qty": null, "price_per_unit": 6.00 }
      ],
      "size_upcharges": [
        { "size": "2XL", "upcharge_amount": 2.00 },
        { "size": "3XL", "upcharge_amount": 3.00 }
      ]
    }
  ],
  "count": 3
}
```

### 2. Get Pricing Matrix by ID
```
GET /api/pricing/matrices/[id]
```

**Example:**
```bash
curl http://localhost:3000/api/pricing/matrices/polo-embroidery-001
```

### 3. Calculate Quote
```
POST /api/pricing/calculate
```

Calculate total pricing for a quote with multiple line items.

**Request Body:**
```json
{
  "pricingMatrixId": "polo-embroidery-001",
  "lineItems": [
    {
      "style_id": 12345,
      "style_name": "Sport-Tek ST350",
      "color_name": "Black",
      "size": "L",
      "quantity": 24,
      "wholesale_price": 8.50,
      "decoration_type": "embroidery",
      "decoration_locations": 1
    },
    {
      "style_id": 12345,
      "style_name": "Sport-Tek ST350",
      "color_name": "Black",
      "size": "2XL",
      "quantity": 12,
      "wholesale_price": 8.50,
      "decoration_type": "embroidery",
      "decoration_locations": 1
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "line_items": [
      {
        "line_item": { ... },
        "wholesale_cost": 8.50,
        "decoration_cost": 7.00,
        "size_upcharge": 0,
        "subtotal": 15.50,
        "total": 372.00,
        "breakdown": {
          "base_wholesale": 8.50,
          "quantity_discount": 0,
          "decoration_base": 7.00,
          "decoration_multiplier": 1,
          "size_upcharge": 0,
          "manual_override": false
        }
      },
      {
        "line_item": { ... },
        "wholesale_cost": 8.50,
        "decoration_cost": 7.50,
        "size_upcharge": 2.00,
        "subtotal": 18.00,
        "total": 216.00,
        "breakdown": {
          "base_wholesale": 8.50,
          "quantity_discount": 0,
          "decoration_base": 7.50,
          "decoration_multiplier": 1,
          "size_upcharge": 2.00,
          "manual_override": false
        }
      }
    ],
    "total_wholesale_cost": 306.00,
    "total_decoration_cost": 258.00,
    "total_size_upcharges": 24.00,
    "grand_total": 588.00,
    "item_count": 36
  }
}
```

## Manual Overrides

You can override pricing at different levels:

### Override Wholesale Price Only
```json
{
  "style_id": 12345,
  "quantity": 24,
  "wholesale_price": 8.50,
  "manual_override": {
    "wholesale_price": 7.00
  }
}
```

### Override Decoration Price Only
```json
{
  "style_id": 12345,
  "quantity": 24,
  "wholesale_price": 8.50,
  "manual_override": {
    "decoration_price": 5.00
  }
}
```

### Override Total Price (Complete Override)
```json
{
  "style_id": 12345,
  "quantity": 24,
  "wholesale_price": 8.50,
  "manual_override": {
    "total_price": 12.00
  }
}
```

## Pricing Calculation Flow

1. **Wholesale Cost**: Base price from SS Activewear or manual override
2. **Decoration Cost**: Based on quantity breaks from pricing matrix
   - Looks up applicable quantity break
   - Multiplies by number of decoration locations
3. **Size Upcharge**: Additional cost for 2XL, 3XL, etc.
4. **Subtotal**: Wholesale + Decoration + Size Upcharge
5. **Total**: Subtotal × Quantity

## Testing

**Test Get Matrices:**
```bash
curl http://localhost:3000/api/pricing/matrices
```

**Test Calculate Quote:**
```bash
curl -X POST http://localhost:3000/api/pricing/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "pricingMatrixId": "polo-embroidery-001",
    "lineItems": [
      {
        "style_id": 12345,
        "style_name": "Test Polo",
        "color_name": "Black",
        "size": "L",
        "quantity": 24,
        "wholesale_price": 8.50,
        "decoration_type": "embroidery",
        "decoration_locations": 1
      }
    ]
  }'
```

Expected: $15.50 per unit × 24 = $372.00 total
- Wholesale: $8.50
- Decoration (24 qty): $7.00
- Size upcharge: $0
