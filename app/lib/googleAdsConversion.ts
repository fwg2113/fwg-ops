// ─── Google Ads Offline Conversion Upload ───
// Uses the Google Ads REST API (v18) to upload click conversions.
// Requires OAuth2 credentials + developer token in env vars.

const GOOGLE_ADS_API_VERSION = 'v20'

interface ConversionResult {
  ok: boolean
  data?: any
  error?: string
}

/**
 * Get a fresh OAuth2 access token using the refresh token.
 */
async function getAccessToken(): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: process.env.GOOGLE_AD_CLIENT_ID!,
      client_secret: process.env.GOOGLE_AD_CLIENT_SECRET!,
      refresh_token: process.env.GOOGLE_AD_REFRESH_TOKEN!,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`OAuth2 token refresh failed (${res.status}): ${body}`)
  }

  const json = await res.json()
  return json.access_token
}

/**
 * Format a Date into the Google Ads conversion_date_time format:
 * "yyyy-mm-dd hh:mm:ss+00:00"
 */
function formatConversionDateTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ` +
    `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}+00:00`
  )
}

/**
 * Upload an offline click conversion to Google Ads.
 *
 * @param gclid       - The Google Click ID captured from the form submission
 * @param conversionAt - The timestamp of the form submission (conversion time)
 * @param conversionValue - Dollar value to assign (default 1.0)
 */
export async function uploadClickConversion(
  gclid: string,
  conversionAt: Date,
  conversionValue: number = 1.0,
): Promise<ConversionResult> {
  const customerId = process.env.GOOGLE_AD_CUSTOMER_ID || '9095980260'
  const managerId = process.env.GOOGLE_AD_MANAGER_ID || '3934611145'
  const conversionActionId = process.env.GOOGLE_AD_CONVERSION_ACTION_ID || '7518078141'

  const conversionAction = `customers/${customerId}/conversionActions/${conversionActionId}`
  const conversionDateTime = formatConversionDateTime(conversionAt)

  try {
    const accessToken = await getAccessToken()

    const url =
      `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/` +
      `customers/${customerId}:uploadClickConversions`

    const payload = {
      conversions: [
        {
          gclid,
          conversion_action: conversionAction,
          conversion_date_time: conversionDateTime,
          conversion_value: conversionValue,
          currency_code: 'USD',
        },
      ],
      partial_failure: true,
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'developer-token': process.env.GOOGLE_AD_DEVELOPER_TOKEN!,
        'login-customer-id': managerId,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const data = await res.json()

    if (!res.ok) {
      console.error('Google Ads conversion upload failed:', JSON.stringify(data))
      return { ok: false, data, error: `HTTP ${res.status}` }
    }

    // Check for partial failure errors in the response
    if (data.partial_failure_error) {
      console.warn('Google Ads partial failure:', JSON.stringify(data.partial_failure_error))
      return { ok: false, data, error: data.partial_failure_error.message }
    }

    console.log('Google Ads conversion uploaded:', gclid)
    return { ok: true, data }
  } catch (err: any) {
    console.error('Google Ads conversion error:', err)
    return { ok: false, error: err.message }
  }
}
