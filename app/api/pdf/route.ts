import { NextResponse } from 'next/server'
import { supabase } from '../../lib/supabase'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const docId = searchParams.get('id')

  if (!docId) {
    return NextResponse.json({ error: 'Missing document ID' }, { status: 400 })
  }

  // Get document
  const { data: doc } = await supabase
    .from('documents')
    .select('*')
    .eq('id', docId)
    .single()

  if (!doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  // Get line items
  const { data: lineItems } = await supabase
    .from('line_items')
    .select('*')
    .eq('document_id', docId)
    .order('sort_order')

  // Generate HTML for PDF
  const html = generatePdfHtml(doc, lineItems || [])

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html',
    },
  })
}

function generatePdfHtml(doc: any, lineItems: any[]) {
  const isQuote = doc.doc_type === 'quote'
  const title = isQuote ? 'Quote' : 'Invoice'
  const docNumber = doc.doc_number

  const lineItemsHtml = lineItems.map(item => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #eee;">${item.description || '-'}</td>
      <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
      <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">$${(item.unit_price || 0).toFixed(2)}</td>
      <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">$${(item.line_total || 0).toFixed(2)}</td>
    </tr>
  `).join('')

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${title} #${docNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #333; line-height: 1.5; }
    .container { max-width: 800px; margin: 0 auto; padding: 40px; }
    .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
    .logo { font-size: 24px; font-weight: bold; color: #d71cd1; }
    .doc-info { text-align: right; }
    .doc-type { font-size: 28px; font-weight: bold; color: #333; }
    .doc-number { color: #666; font-size: 14px; }
    .addresses { display: flex; justify-content: space-between; margin-bottom: 40px; }
    .address-block { width: 45%; }
    .address-label { font-size: 12px; color: #666; text-transform: uppercase; margin-bottom: 8px; }
    .address-name { font-size: 16px; font-weight: 600; }
    .address-detail { color: #666; font-size: 14px; }
    .project-info { background: #f8f8f8; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
    .project-label { font-size: 12px; color: #666; text-transform: uppercase; margin-bottom: 4px; }
    .project-desc { font-size: 14px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
    th { background: #f8f8f8; padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #666; }
    th:nth-child(2), th:nth-child(3), th:nth-child(4) { text-align: right; }
    th:nth-child(2) { text-align: center; }
    .totals { display: flex; justify-content: flex-end; }
    .totals-box { width: 250px; }
    .total-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
    .total-row.grand { border-bottom: none; border-top: 2px solid #333; margin-top: 8px; padding-top: 12px; font-size: 18px; font-weight: bold; }
    .total-row.grand .amount { color: #d71cd1; }
    .footer { margin-top: 60px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #666; font-size: 12px; }
    .terms { margin-top: 40px; padding: 20px; background: #f8f8f8; border-radius: 8px; font-size: 12px; color: #666; }
    .terms-title { font-weight: 600; margin-bottom: 8px; }
    @media print {
      .container { padding: 20px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">Frederick Wraps Group</div>
      <div class="doc-info">
        <div class="doc-type">${title}</div>
        <div class="doc-number">#${docNumber}</div>
        <div class="doc-number">${new Date(doc.created_at).toLocaleDateString()}</div>
      </div>
    </div>

    <div class="addresses">
      <div class="address-block">
        <div class="address-label">From</div>
        <div class="address-name">Frederick Wraps Group</div>
        <div class="address-detail">5728 Industry Lane</div>
        <div class="address-detail">Frederick, MD 21704</div>
        <div class="address-detail">info@frederickwraps.com</div>
        <div class="address-detail">(240) 693-3715</div>
      </div>
      <div class="address-block">
        <div class="address-label">Bill To</div>
        <div class="address-name">${doc.customer_name || 'Customer'}</div>
        ${doc.company_name ? `<div class="address-detail">${doc.company_name}</div>` : ''}
        ${doc.customer_email ? `<div class="address-detail">${doc.customer_email}</div>` : ''}
        ${doc.customer_phone ? `<div class="address-detail">${doc.customer_phone}</div>` : ''}
      </div>
    </div>

    ${doc.project_description || doc.vehicle_description ? `
    <div class="project-info">
      <div class="project-label">Project Description</div>
      <div class="project-desc">${doc.project_description || ''} ${doc.vehicle_description || ''}</div>
    </div>
    ` : ''}

    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th style="text-align: center;">Qty</th>
          <th style="text-align: right;">Price</th>
          <th style="text-align: right;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${lineItemsHtml || '<tr><td colspan="4" style="padding: 20px; text-align: center; color: #666;">No line items</td></tr>'}
      </tbody>
    </table>

    <div class="totals">
      <div class="totals-box">
        <div class="total-row">
          <span>Subtotal</span>
          <span>$${(doc.subtotal || 0).toFixed(2)}</span>
        </div>
        ${doc.discount_amount > 0 ? `
        <div class="total-row">
          <span>Discount</span>
          <span>-$${(doc.discount_amount || 0).toFixed(2)}</span>
        </div>
        ` : ''}
        ${doc.tax_amount > 0 ? `
        <div class="total-row">
          <span>Tax</span>
          <span>$${(doc.tax_amount || 0).toFixed(2)}</span>
        </div>
        ` : ''}
        <div class="total-row grand">
          <span>Total</span>
          <span class="amount">$${(doc.total || 0).toFixed(2)}</span>
        </div>
        ${doc.deposit_required > 0 ? `
        <div class="total-row">
          <span>Deposit Required (50%)</span>
          <span>$${(doc.deposit_required || 0).toFixed(2)}</span>
        </div>
        ` : ''}
      </div>
    </div>

    ${isQuote ? `
    <div class="terms">
      <div class="terms-title">Terms & Conditions</div>
      <p>This quote is valid for 30 days from the date above. A 50% deposit is required to schedule your project. Final payment is due upon completion. All sales are final. Colors may vary slightly from digital proofs due to material and lighting differences.</p>
    </div>
    ` : ''}

    <div class="footer">
      <p>Thank you for your business!</p>
      <p>Frederick Wraps Group | frederickwraps.com | (240) 693-3715</p>
    </div>
  </div>
</body>
</html>
  `
}
