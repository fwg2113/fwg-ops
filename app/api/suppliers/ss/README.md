# SS Activewear API Integration

API proxy routes for SS Activewear product catalog integration.

## Setup

Add these environment variables to your `.env.local`:

```env
SS_ACTIVEWEAR_ACCOUNT_NUMBER=787075
SS_ACTIVEWEAR_API_KEY=c8d9b480-39d7-44b7-8edc-276ed0e5c456
SS_ACTIVEWEAR_BASE_URL=https://api.ssactivewear.com/v2/
```

## API Endpoints

### 1. Get All Styles
```
GET /api/suppliers/ss/styles
```

Returns all available styles from SS Activewear catalog.
**Cache:** 1 hour

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "styleID": 12345,
      "styleName": "ST350",
      "brandName": "Sport-Tek",
      "categoryName": "Polos",
      "description": "PosiCharge Competitor Polo",
      "productThumbnail": "https://...",
      "colors": [...],
      "sizes": ["S", "M", "L", "XL", "2XL"]
    }
  ],
  "count": 1234
}
```

### 2. Search Products
```
GET /api/suppliers/ss/search?q={query}
```

Search products by style number, brand, or keyword.
**Cache:** 15 minutes
**Limit:** 20 results

**Example:**
```bash
curl http://localhost:3000/api/suppliers/ss/search?q=ST350
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "styleID": 12345,
      "styleName": "ST350",
      "brandName": "Sport-Tek",
      "categoryName": "Polos",
      "productThumbnail": "https://...",
      "colors": [
        { "colorID": 101, "colorName": "Black" },
        { "colorID": 102, "colorName": "Navy" }
      ]
    }
  ],
  "count": 1,
  "query": "ST350"
}
```

### 3. Get Style Details
```
GET /api/suppliers/ss/style/[styleId]
```

Get full product details including colors, sizes, pricing, and images.
**Cache:** 30 minutes

**Example:**
```bash
curl http://localhost:3000/api/suppliers/ss/style/12345
```

**Response:**
```json
{
  "success": true,
  "data": {
    "styleID": 12345,
    "styleName": "ST350",
    "brandName": "Sport-Tek",
    "categoryName": "Polos",
    "description": "PosiCharge Competitor Polo",
    "colors": [
      {
        "colorID": 101,
        "colorName": "Black",
        "colorHex": "#000000",
        "sizes": [
          {
            "sizeID": 1,
            "sizeName": "S",
            "wholesalePrice": 8.50,
            "retailPrice": 25.00
          }
        ]
      }
    ],
    "productImages": ["https://..."],
    "tags": ["moisture-wicking", "polo"]
  }
}
```

### 4. Get Inventory
```
GET /api/suppliers/ss/inventory/[styleId]
```

Get real-time inventory by warehouse.
**Cache:** 5 minutes

**Example:**
```bash
curl http://localhost:3000/api/suppliers/ss/inventory/12345
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "colorID": 101,
      "colorName": "Black",
      "sizes": [
        {
          "sizeID": 1,
          "sizeName": "S",
          "wholesalePrice": 8.50,
          "retailPrice": 25.00,
          "inventory": [
            { "warehouse": "Dallas", "qty": 150, "available": true },
            { "warehouse": "LA", "qty": 200, "available": true }
          ]
        }
      ]
    }
  ],
  "styleId": 12345
}
```

## Error Handling

All endpoints return errors in this format:

```json
{
  "success": false,
  "error": "Error message here"
}
```

**Common Error Codes:**
- `400` - Invalid request (missing query, invalid ID)
- `404` - Resource not found
- `500` - Server error (API failure, authentication issue)

## Caching Strategy

- **All Styles:** 1 hour (product catalog changes infrequently)
- **Search Results:** 15 minutes (balance between freshness and performance)
- **Style Details:** 30 minutes (pricing/info moderately stable)
- **Inventory:** 5 minutes (needs to be relatively fresh)

## Testing

To test the API routes locally:

1. Ensure environment variables are set in `.env.local`
2. Start dev server: `npm run dev`
3. Use curl or browser to test endpoints
4. Check terminal for error logs if requests fail

**Test Search:**
```bash
curl http://localhost:3000/api/suppliers/ss/search?q=polo
```

**Test Style Details:**
```bash
# Replace 12345 with actual style ID from search results
curl http://localhost:3000/api/suppliers/ss/style/12345
```
