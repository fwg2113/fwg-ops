// Generate email signature HTML for Frederick Wraps & Graphics
// Must use tables + inline styles only (email client compatibility)

export type SignatureData = {
  name: string
  title: string
  email: string
  phone?: string
  closing?: string
}

const LOGO_URL = 'https://fwg-ops.vercel.app/images/email-signature-badge.png'
const RED = '#CE0000'
const DARK = '#1a1a1a'
const GRAY = '#666666'
const WEBSITE = 'frederickwraps.com'
const ADDRESS = '4509 Metropolitan Ct Suite A, Frederick, MD 21704'
const PHONE = '240.693.3715'

export function renderSignatureHTML(sig: SignatureData): string {
  const phonePart = `<a href="tel:2406933715" style="color:${DARK};text-decoration:none;">${PHONE}</a>`
  const siteLink = `<a href="https://${WEBSITE}" style="color:${DARK};text-decoration:none;">${WEBSITE}</a>`
  const metaLine = `${phonePart} &nbsp;|&nbsp; ${siteLink}`
  const closing = sig.closing || 'Best,'

  return `<div style="font-family:Arial,Helvetica,sans-serif;color:${DARK};font-size:13px;line-height:1.5;">
<div style="margin-bottom:14px;">${closing}</div>
<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
  <tr>
    <td style="padding:0 20px 0 0;vertical-align:middle;">
      <img src="${LOGO_URL}" width="85" height="90" alt="Frederick Wraps &amp; Graphics" style="display:block;border:0;width:85px;height:90px;" />
    </td>
    <td style="vertical-align:middle;font-family:Arial,Helvetica,sans-serif;">
      <div style="font-size:22px;font-weight:700;color:${DARK};letter-spacing:-0.3px;line-height:1.2;">${sig.name}</div>
      <div style="height:2px;background:${RED};width:220px;margin:8px 0;"></div>
      <div style="font-size:14px;font-weight:400;color:${DARK};margin-bottom:8px;">${sig.title}</div>
      <div style="font-size:13px;font-weight:600;color:${DARK};margin-bottom:4px;">${metaLine}</div>
      <div style="font-size:12px;color:${GRAY};">${ADDRESS}</div>
    </td>
  </tr>
</table>
</div>`
}

export function renderSignaturePlainText(sig: SignatureData): string {
  const closing = sig.closing || 'Best,'
  return [
    closing,
    '',
    sig.name,
    sig.title,
    '',
    `${PHONE}  |  ${WEBSITE}`,
    ADDRESS,
  ].join('\n')
}
