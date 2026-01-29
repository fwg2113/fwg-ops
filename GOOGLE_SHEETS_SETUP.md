# Google Sheets API Setup Guide

This guide will help you connect your Next.js application to Google Sheets to read live data for the Command Center metrics.

## Step 1: Create a Google Cloud Project Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Google Sheets API**:
   - Go to "APIs & Services" > "Library"
   - Search for "Google Sheets API"
   - Click "Enable"

## Step 2: Create Service Account Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "Service Account"
3. Fill in the details:
   - Service account name: `fwg-ops-sheets-reader`
   - Service account ID: Will be auto-generated
   - Description: "Read-only access to FWG Google Sheets"
4. Click "Create and Continue"
5. Grant role: **Viewer** (read-only access)
6. Click "Continue" then "Done"

## Step 3: Download JSON Credentials

1. In the "Credentials" page, find your newly created service account
2. Click on the service account email
3. Go to the "Keys" tab
4. Click "Add Key" > "Create new key"
5. Select "JSON" format
6. Click "Create"
7. The JSON file will download automatically - **SAVE THIS FILE SECURELY**

## Step 4: Share Google Sheets with Service Account

You need to share your Google Sheets with the service account email.

1. Open the JSON credentials file
2. Find the `client_email` field (looks like: `fwg-ops-sheets-reader@project-id.iam.gserviceaccount.com`)
3. Copy this email address

**Share these sheets with the service account:**

### Financial Core Sheet
- **Sheet ID:** `1dK9v4XosHHHs6eJWHBhhBVtSQKS8_hcZa2uelp3ErBc`
- Open: https://docs.google.com/spreadsheets/d/1dK9v4XosHHHs6eJWHBhhBVtSQKS8_hcZa2uelp3ErBc
- Click "Share" button
- Paste the service account email
- Set permission to **Viewer**
- Uncheck "Notify people"
- Click "Share"

### Ops Sheet
- **Sheet ID:** `1Pyh1w6Gsx7pkZd9uRwB4YhGQfb0VWHzIE_qzcSO39lw`
- Open: https://docs.google.com/spreadsheets/d/1Pyh1w6Gsx7pkZd9uRwB4YhGQfb0VWHzIE_qzcSO39lw
- Click "Share" button
- Paste the service account email
- Set permission to **Viewer**
- Uncheck "Notify people"
- Click "Share"

## Step 5: Add Credentials to Your Project

### Option A: Environment Variable (Recommended for Production)

1. Open the downloaded JSON credentials file
2. Copy the **entire contents** of the file
3. Create or edit `.env.local` in your project root:

```bash
GOOGLE_SHEETS_CREDENTIALS='{"type":"service_account","project_id":"...","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"...","client_id":"...","auth_uri":"...","token_uri":"...","auth_provider_x509_cert_url":"...","client_x509_cert_url":"..."}'
```

**Important:**
- The value must be the entire JSON on a single line
- Wrap it in single quotes
- Do NOT add this file to git (.env.local is already in .gitignore)

### Option B: Credentials File (For Testing)

1. Create a `credentials` folder in project root: `mkdir credentials`
2. Move the JSON file to: `credentials/google-sheets-service-account.json`
3. Add to `.gitignore`:
```
credentials/
```

Then update `app/lib/googleSheets.ts` to read from file:
```typescript
import fs from 'fs'
import path from 'path'

const credentials = JSON.parse(
  fs.readFileSync(
    path.join(process.cwd(), 'credentials/google-sheets-service-account.json'),
    'utf-8'
  )
)
```

## Step 6: Install Dependencies

Run this command in your project directory:

```bash
npm install
```

This will install the `googleapis` package that was added to package.json.

## Step 7: Restart Your Development Server

```bash
# Stop the current server (Ctrl+C)
# Then restart:
npm run dev
```

## Step 8: Verify the Connection

1. Navigate to the Command Center (dashboard homepage)
2. Check the metrics:
   - **Monthly Revenue** should show data from Financial Core TRANSACTIONS sheet
   - **PPF & Vinyl** should show bonus-eligible revenue
   - **Pipeline** should show quote + invoice totals from Ops Documents sheet
   - **Category breakdown** should display below

3. Check the browser console for any errors
4. Check the terminal/server logs for Google Sheets API errors

## Troubleshooting

### Error: "Unable to parse credentials"
- Make sure the JSON is properly formatted
- Check that you copied the entire contents
- Ensure there are no extra line breaks or spaces

### Error: "The caller does not have permission"
- Verify you shared both sheets with the service account email
- Check that the email address matches the `client_email` in your JSON credentials
- Make sure you granted "Viewer" permission

### Error: "Requested entity was not found"
- Verify the sheet IDs in `app/lib/googleSheets.ts` match your actual sheets
- Check that the sheet names are correct (TRANSACTIONS, Documents, Submissions)

### Metrics showing $0.00
- Check that your TRANSACTIONS sheet has data
- Verify the column indices match your sheet structure:
  - Column B (index 1): Date
  - Column C (index 2): Business
  - Column D (index 3): Direction
  - Column F (index 5): Amount
  - Column H (index 7): Category
- Make sure Business='FWG' and Direction='IN' for revenue transactions

### Wrong column mapping
If your sheet columns are different, update the indices in `app/lib/googleSheets.ts`:
```typescript
const COL_DATE = 1        // Adjust to your Date column (0-indexed)
const COL_BUSINESS = 2    // Adjust to your Business column
const COL_DIRECTION = 3   // Adjust to your Direction column
const COL_AMOUNT = 5      // Adjust to your Amount column
const COL_CATEGORY = 7    // Adjust to your Category column
```

## Security Best Practices

1. **Never commit credentials to git**
   - Keep .env.local and credentials/ in .gitignore
   - Use environment variables in production

2. **Use read-only permissions**
   - Service account only needs "Viewer" role
   - Never grant "Editor" access

3. **Rotate credentials periodically**
   - Delete old service account keys
   - Create new ones every 90 days

4. **For production deployment:**
   - Use your hosting platform's environment variable system (Vercel, Netlify, etc.)
   - Never expose credentials in client-side code
   - Keep the credentials server-side only

## Next Steps

Once connected, the Command Center will automatically:
- Read live revenue data from your Financial Core TRANSACTIONS sheet
- Calculate MTD/YTD totals
- Filter bonus-eligible categories (PPF, Full Wrap, Partial Wrap, Vinyl Lettering, Vinyl Graphics)
- Calculate 2.5% employee bonus
- Pull pipeline data from your Ops Documents sheet
- Display category breakdown

All metrics will match your legacy AppScript system exactly!
