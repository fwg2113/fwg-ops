import { NextResponse } from 'next/server'
import { supabase } from '../../lib/supabase'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const eventId = searchParams.get('eventId')

  if (!eventId) {
    return NextResponse.json({ error: 'Missing eventId' }, { status: 400 })
  }

  const { data: event, error: eventError } = await supabase
    .from('calendar_events')
    .select('*')
    .eq('id', eventId)
    .single()

  if (eventError || !event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }

  let doc: any = null
  let lineItems: any[] = []
  if (event.document_id) {
    const { data: docData } = await supabase
      .from('documents')
      .select('id, doc_number, vehicle_description, customer_name, customer_email, customer_phone, company_name, category, balance_due, attachments')
      .eq('id', event.document_id)
      .single()
    doc = docData

    const { data: liData } = await supabase
      .from('line_items')
      .select('id, description, quantity, category, line_type, package_key, sort_order, attachments, custom_fields')
      .eq('document_id', event.document_id)
      .order('sort_order', { ascending: true })
    lineItems = liData || []
  }

  // Collect all images
  const images: { url: string; label: string }[] = []
  if (doc) {
    lineItems.forEach((li: any) => {
      if (li.attachments && Array.isArray(li.attachments)) {
        li.attachments.forEach((att: any) => {
          const url = att.url || att.file_url
          if (url) images.push({ url, label: li.description || 'Mockup' })
        })
      }
    })
    if (doc.attachments && Array.isArray(doc.attachments)) {
      doc.attachments.forEach((att: any) => {
        const url = att.url || att.file_url
        const name = att.filename || att.file_name || att.name || 'Project File'
        const type = att.contentType || att.mime_type || att.type || ''
        if (url && (type.startsWith('image/') || /\.(png|jpg|jpeg|webp|gif|svg)$/i.test(name))) {
          images.push({ url, label: name })
        }
      })
    }
  }

  const fmtDate = (d: string | null) => {
    if (!d) return '—'
    return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
  }

  const CATEGORY_COLORS: Record<string, { color: string; label: string }> = {
    PPF: { color: '#ec4899', label: 'PPF' },
    FULL_PPF: { color: '#ec4899', label: 'PPF' },
    PARTIAL_PPF: { color: '#ec4899', label: 'PPF' },
    FULL_WRAP: { color: '#a855f7', label: 'Vinyl Wrap' },
    VINYL_WRAP: { color: '#a855f7', label: 'Vinyl Wrap' },
    CHROME_DELETE: { color: '#a855f7', label: 'Vinyl Wrap' },
    COLOR_CHANGE: { color: '#a855f7', label: 'Vinyl Wrap' },
    COMMERCIAL_WRAP: { color: '#a855f7', label: 'Vinyl Wrap' },
    VINYL_GRAPHICS: { color: '#22c55e', label: 'Vinyl Graphics' },
    DECALS: { color: '#22c55e', label: 'Vinyl Graphics' },
    STRIPES: { color: '#22c55e', label: 'Vinyl Graphics' },
    LETTERING: { color: '#22c55e', label: 'Vinyl Graphics' },
    SIGNAGE: { color: '#14b8a6', label: 'Signage' },
    CHANNEL_LETTERS: { color: '#14b8a6', label: 'Signage' },
    MONUMENT_SIGN: { color: '#14b8a6', label: 'Signage' },
    WINDOW_TINT: { color: '#f59e0b', label: 'Window Tint' },
    RESIDENTIAL_TINT: { color: '#f59e0b', label: 'Window Tint' },
    COMMERCIAL_TINT: { color: '#f59e0b', label: 'Window Tint' },
    APPAREL: { color: '#3b82f6', label: 'Apparel' },
  }

  const catEntry = event.category ? CATEGORY_COLORS[event.category] : null
  const catColor = catEntry?.color || '#6b7280'
  const catLabel = catEntry?.label || ''
  const hasBalance = doc ? (doc.balance_due || 0) > 0 : false

  // Build line items HTML
  const lineItemsHtml = lineItems.map(li => {
    const liCat = li.category && CATEGORY_COLORS[li.category] ? CATEGORY_COLORS[li.category] : null
    return `
      <div class="line-item">
        <div class="line-dot" style="background: ${liCat?.color || catColor}"></div>
        <div class="line-desc">
          ${li.description}${li.quantity > 1 ? ` <span class="line-qty">x${li.quantity}</span>` : ''}
        </div>
        ${liCat ? `<span class="line-cat" style="color: ${liCat.color}; border-color: ${liCat.color}40; background: ${liCat.color}12">${liCat.label}</span>` : ''}
      </div>`
  }).join('')

  // --- Build mini calendar ---
  const vStart = event.vehicle_start
  const vEnd = event.vehicle_end
  const iStart = event.install_start
  const iEnd = event.install_end

  let miniCalendarHtml = ''
  if (vStart && vEnd) {
    const toStr = (d: Date) => d.toISOString().split('T')[0]

    // Find the earliest and latest dates across vehicle + install
    const allDates = [vStart, vEnd]
    if (iStart) allDates.push(iStart)
    if (iEnd) allDates.push(iEnd)
    const earliest = allDates.sort()[0]
    const latest = allDates.sort().reverse()[0]

    // Add 2-day buffer before and after
    const bufferStart = new Date(earliest + 'T00:00:00')
    bufferStart.setDate(bufferStart.getDate() - 2)
    const bufferEnd = new Date(latest + 'T00:00:00')
    bufferEnd.setDate(bufferEnd.getDate() + 2)

    // Go to Sunday of the start week
    const calStart = new Date(bufferStart)
    calStart.setDate(calStart.getDate() - calStart.getDay())

    // Go to Saturday of the end week
    const calEnd = new Date(bufferEnd)
    calEnd.setDate(calEnd.getDate() + (6 - calEnd.getDay()))

    // Build array of all days
    const days: Date[] = []
    const cur = new Date(calStart)
    while (cur <= calEnd) {
      days.push(new Date(cur))
      cur.setDate(cur.getDate() + 1)
    }

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

    // Build week rows
    const weeks: Date[][] = []
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7))
    }

    // Get month labels for the range
    const monthsInRange = new Set<string>()
    days.forEach(d => monthsInRange.add(d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })))
    const monthLabel = Array.from(monthsInRange).join(' — ')

    const weekRowsHtml = weeks.map(week => {
      const weekStart = toStr(week[0])
      const weekEnd = toStr(week[6])

      const vOverlap = vStart <= weekEnd && vEnd >= weekStart
      const iOverlap = iStart && iEnd && iStart <= weekEnd && iEnd >= weekStart

      let barsHtml = ''
      if (vOverlap) {
        const barStart = Math.max(0, week.findIndex(d => toStr(d) >= vStart))
        const barEndIdx = week.findIndex(d => toStr(d) > vEnd)
        const barEnd = barEndIdx === -1 ? 6 : barEndIdx - 1
        const left = (barStart / 7) * 100
        const width = ((barEnd - barStart + 1) / 7) * 100
        barsHtml += `<div class="cal-bar vehicle-bar" style="left:${left}%;width:${width}%"></div>`
      }
      if (iOverlap && iStart && iEnd) {
        const barStart = Math.max(0, week.findIndex(d => toStr(d) >= iStart))
        const barEndIdx = week.findIndex(d => toStr(d) > iEnd)
        const barEnd = barEndIdx === -1 ? 6 : barEndIdx - 1
        const left = (barStart / 7) * 100
        const width = ((barEnd - barStart + 1) / 7) * 100
        barsHtml += `<div class="cal-bar install-bar" style="left:${left}%;width:${width}%"></div>`
      }

      // Month divider — show month name if first day of week is day 1 or first week
      const showMonth = week[0].getDate() <= 7 || week === weeks[0]
      const monthStr = week[0].toLocaleDateString('en-US', { month: 'short' })

      const cellsHtml = week.map(d => {
        const isSunday = d.getDay() === 0
        const isToday = toStr(d) === toStr(new Date())
        const isFirst = d.getDate() === 1
        let cellClass = 'cal-cell'
        if (isSunday) cellClass += ' sunday'
        if (isToday) cellClass += ' today'
        const dayLabel = isFirst ? `${d.toLocaleDateString('en-US', { month: 'short' })} ${d.getDate()}` : `${d.getDate()}`
        return `<div class="${cellClass}"><span class="cal-day-num">${dayLabel}</span></div>`
      }).join('')

      return `<div class="cal-week">
        <div class="cal-cells">${cellsHtml}</div>
        <div class="cal-bars">${barsHtml}</div>
      </div>`
    }).join('')

    miniCalendarHtml = `
      <div class="mini-cal">
        <div class="cal-title">${monthLabel}</div>
        <div class="cal-header-row">
          ${dayNames.map((d, i) => `<div class="cal-header${i === 0 ? ' sunday' : ''}">${d}</div>`).join('')}
        </div>
        ${weekRowsHtml}
        <div class="cal-legend">
          <div class="cal-legend-item"><div class="cal-legend-swatch vehicle-swatch"></div><span>Vehicle On Site</span></div>
          <div class="cal-legend-item"><div class="cal-legend-swatch install-swatch"></div><span>Install Period</span></div>
        </div>
      </div>`
  }

  // Build image page HTML
  let imagesPageHtml = ''
  if (images.length > 0) {
    let gridClass = 'single'
    if (images.length === 2 || images.length === 3) gridClass = 'stacked'
    else if (images.length >= 4) gridClass = 'grid'

    imagesPageHtml = `
    <div class="page page-mockups">
      <div class="mockup-header">
        <img src="/images/fwg-logo.svg" class="logo" alt="FWG" />
        <span class="mockup-title">${doc?.vehicle_description || event.title} — Mockups</span>
      </div>
      <div class="images-grid ${gridClass}">
        ${images.map(img => `<img src="${img.url}" alt="${img.label}" />`).join('')}
      </div>
    </div>`
  }

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Production Card — ${event.title}</title>
  <style>
    @page { size: letter landscape; margin: 0.35in; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { height: 100%; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #1a1a1a;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* Page layout */
    .page {
      width: 100%;
      min-height: 100vh;
      max-height: 100vh;
      overflow: hidden;
      padding: 24px 32px;
      display: flex;
      flex-direction: column;
      page-break-after: always;
      page-break-inside: avoid;
    }
    .page:last-child { page-break-after: auto; }

    /* ========== PAGE 1 — DETAILS ========== */
    .page-details {
      display: flex;
      flex-direction: column;
    }

    /* Header */
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 3px solid #CE0000;
      flex-shrink: 0;
    }
    .logo { height: 32px; }
    .header-right {
      display: flex; align-items: center; gap: 8px;
    }
    .doc-number { font-size: 12px; color: #6b7280; font-weight: 500; }
    .badge {
      font-size: 10px; font-weight: 700; padding: 3px 10px;
      border-radius: 20px; text-transform: uppercase; letter-spacing: 0.04em;
    }
    .badge-cat {
      color: ${catColor}; border: 1.5px solid ${catColor}60; background: ${catColor}12;
    }
    .badge-balance {
      color: #CE0000; border: 1.5px solid #CE000040; background: #CE000012;
    }

    /* Top section: vehicle + job info side by side */
    .details-top {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin-bottom: 16px;
      flex-shrink: 0;
    }
    .details-top-left {}
    .details-top-right {}

    .vehicle {
      font-size: 19px; font-weight: 700; color: #111;
      margin-bottom: 12px; padding: 10px 14px;
      background: #f8f8f8; border-left: 4px solid #CE0000;
      border-radius: 0 6px 6px 0;
    }
    .job-title {
      font-size: 14px; font-weight: 600; color: #1a1a1a; margin-bottom: 12px;
    }
    .section-label {
      font-size: 10px; font-weight: 700; color: #9ca3af;
      text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 5px;
    }
    .customer-block {
      margin-bottom: 12px; padding: 8px 12px;
      background: #fafafa; border: 1px solid #e5e7eb; border-radius: 6px;
    }
    .customer-name { font-size: 13px; font-weight: 600; color: #111; margin-bottom: 1px; }
    .customer-company { font-size: 11px; color: #6b7280; margin-bottom: 3px; }
    .customer-contact { font-size: 11px; color: #374151; }

    .scope-block { margin-bottom: 12px; }
    .line-item {
      display: flex; align-items: center; gap: 8px;
      padding: 5px 0; border-bottom: 1px solid #f0f0f0; font-size: 12px;
    }
    .line-item:last-child { border-bottom: none; }
    .line-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
    .line-desc { flex: 1; color: #1a1a1a; font-weight: 500; }
    .line-qty { color: #9ca3af; font-weight: 400; font-size: 11px; }
    .line-cat {
      font-size: 9px; font-weight: 700; padding: 2px 7px;
      border-radius: 10px; border: 1px solid; flex-shrink: 0;
    }

    /* Schedule dates */
    .dates-grid {
      display: grid; grid-template-columns: 1fr 1fr;
      gap: 6px; margin-bottom: 12px;
    }
    .date-box {
      padding: 7px 10px; border-radius: 6px;
    }
    .date-box.vehicle-box {
      border: 2px dashed ${catColor}; background: ${catColor}08;
    }
    .date-box.install-box {
      border: 2.5px solid ${catColor}; background: ${catColor}15;
    }
    .date-label {
      font-size: 9px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.06em; color: #6b7280; margin-bottom: 2px;
    }
    .date-value { font-size: 12px; font-weight: 600; color: #1a1a1a; }

    /* Notes */
    .notes-section {
      flex-shrink: 0;
      margin-bottom: 12px;
    }
    .notes-block {
      padding: 8px 12px;
      background: #fafafa; border: 1px solid #e5e7eb; border-radius: 6px;
      font-size: 11px; color: #374151; line-height: 1.5; white-space: pre-wrap;
    }

    /* ===== Mini calendar ===== */
    .mini-cal {
      flex: 1;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .cal-title {
      padding: 8px 14px;
      font-size: 13px; font-weight: 700; color: #1a1a1a;
      background: #f9fafb; border-bottom: 1px solid #e5e7eb;
    }
    .cal-header-row {
      display: grid; grid-template-columns: repeat(7, 1fr);
      background: #f9fafb; border-bottom: 1px solid #e5e7eb;
    }
    .cal-header {
      text-align: center; font-size: 11px; font-weight: 700;
      color: #4b5563; padding: 6px 0; text-transform: uppercase;
    }
    .cal-header.sunday { color: #c0c0c0; }
    .cal-week {
      position: relative;
      border-bottom: 1px solid #f0f0f0;
    }
    .cal-week:last-of-type { border-bottom: none; }
    .cal-cells {
      display: grid; grid-template-columns: repeat(7, 1fr);
      position: relative; z-index: 2;
    }
    .cal-cell {
      text-align: center; padding: 10px 0;
      font-size: 14px; font-weight: 500; color: #374151;
    }
    .cal-cell.sunday {
      background: rgba(0,0,0,0.025); color: #c0c0c0;
    }
    .cal-cell.today .cal-day-num {
      background: #CE0000; color: #fff;
      border-radius: 50%; width: 26px; height: 26px;
      display: inline-flex; align-items: center; justify-content: center;
      font-size: 13px;
    }
    .cal-bars {
      position: absolute; top: 0; left: 0; right: 0; bottom: 0;
      z-index: 1; pointer-events: none;
    }
    .cal-bar {
      position: absolute; border-radius: 5px;
    }
    .cal-bar.vehicle-bar {
      top: 3px; bottom: 3px;
      border: 2.5px dashed ${catColor};
      background: ${catColor}0a;
    }
    .cal-bar.install-bar {
      top: 7px; bottom: 7px;
      border: 3px solid ${catColor};
      background: ${catColor}20;
    }
    .cal-legend {
      display: flex; gap: 20px; padding: 7px 14px;
      background: #f9fafb; border-top: 1px solid #e5e7eb;
    }
    .cal-legend-item {
      display: flex; align-items: center; gap: 6px;
      font-size: 11px; color: #4b5563; font-weight: 500;
    }
    .cal-legend-swatch {
      width: 24px; height: 14px; border-radius: 4px;
    }
    .cal-legend-swatch.vehicle-swatch {
      border: 2.5px dashed ${catColor}; background: ${catColor}0a;
    }
    .cal-legend-swatch.install-swatch {
      border: 3px solid ${catColor}; background: ${catColor}20;
    }

    /* ========== PAGE 2 — MOCKUPS ========== */
    .page-mockups {
      padding: 20px 28px;
    }
    .mockup-header {
      display: flex; align-items: center; gap: 14px;
      margin-bottom: 14px; padding-bottom: 10px;
      border-bottom: 3px solid #CE0000;
      flex-shrink: 0;
    }
    .mockup-title {
      font-size: 16px; font-weight: 600; color: #111;
    }

    .images-grid {
      flex: 1; display: flex; gap: 12px; min-height: 0;
    }
    .images-grid.single img {
      width: 100%; height: 100%; object-fit: contain;
      border-radius: 8px; border: 1px solid #e5e7eb;
    }
    .images-grid.stacked {
      flex-direction: column;
    }
    .images-grid.stacked img {
      width: 100%; flex: 1; min-height: 0; object-fit: contain;
      border-radius: 8px; border: 1px solid #e5e7eb;
    }
    .images-grid.grid {
      flex-wrap: wrap; align-content: stretch;
    }
    .images-grid.grid img {
      width: calc(50% - 6px); height: calc(50% - 6px);
      flex: 0 0 auto; object-fit: contain;
      border-radius: 8px; border: 1px solid #e5e7eb;
    }
  </style>
</head>
<body>
  <!-- PAGE 1: Details -->
  <div class="page page-details">
    <div class="header">
      <img src="/images/fwg-logo.svg" class="logo" alt="FWG" />
      <div class="header-right">
        ${doc?.doc_number ? `<span class="doc-number">#${doc.doc_number}</span>` : ''}
        ${catLabel ? `<span class="badge badge-cat">${catLabel}</span>` : ''}
        ${hasBalance ? `<span class="badge badge-balance">Balance Due</span>` : ''}
      </div>
    </div>

    <div class="details-top">
      <div class="details-top-left">
        ${doc?.vehicle_description ? `<div class="vehicle">${doc.vehicle_description}</div>` : ''}
        <div class="job-title">${event.title}</div>

        <div class="section-label">Customer</div>
        <div class="customer-block">
          <div class="customer-name">${doc?.customer_name || event.customer_name || '—'}</div>
          ${doc?.company_name ? `<div class="customer-company">${doc.company_name}</div>` : ''}
          <div class="customer-contact">
            ${doc?.customer_phone || event.customer_phone || ''}${(doc?.customer_phone || event.customer_phone) && doc?.customer_email ? ' &nbsp;·&nbsp; ' : ''}${doc?.customer_email || ''}
          </div>
        </div>

        ${lineItems.length > 0 ? `
          <div class="section-label">Scope of Work</div>
          <div class="scope-block">${lineItemsHtml}</div>
        ` : ''}

        ${event.notes ? `
          <div class="notes-section">
            <div class="section-label">Notes</div>
            <div class="notes-block">${event.notes}</div>
          </div>
        ` : ''}
      </div>

      <div class="details-top-right">
        <div class="section-label">Schedule</div>
        <div class="dates-grid">
          <div class="date-box vehicle-box">
            <div class="date-label">Drop-off</div>
            <div class="date-value">${fmtDate(event.vehicle_start)}</div>
          </div>
          <div class="date-box vehicle-box">
            <div class="date-label">Pick-up</div>
            <div class="date-value">${fmtDate(event.vehicle_end)}</div>
          </div>
          <div class="date-box install-box">
            <div class="date-label">Install Start</div>
            <div class="date-value">${fmtDate(event.install_start)}</div>
          </div>
          <div class="date-box install-box">
            <div class="date-label">Install End</div>
            <div class="date-value">${fmtDate(event.install_end)}</div>
          </div>
        </div>
      </div>
    </div>

    ${miniCalendarHtml}
  </div>

  <!-- PAGE 2: Mockups -->
  ${imagesPageHtml}

  <script>
    window.onload = function() {
      var imgs = document.querySelectorAll('.images-grid img')
      var loaded = 0
      var total = imgs.length
      if (total === 0) { window.print(); return }
      imgs.forEach(function(img) {
        if (img.complete) { loaded++; if (loaded >= total) window.print() }
        else {
          img.onload = function() { loaded++; if (loaded >= total) window.print() }
          img.onerror = function() { loaded++; if (loaded >= total) window.print() }
        }
      })
    }
  </script>
</body>
</html>`

  return new Response(html, {
    headers: { 'Content-Type': 'text/html' }
  })
}
