/**
 * GET /api/suppliers/sanmar/test
 *
 * Diagnostic endpoint to test SanMar API connectivity and credentials.
 * Tests with style PC54 (a common basic tee that should always exist).
 */

import { NextResponse } from 'next/server'

export async function GET() {
  const diagnostics: Record<string, any> = {
    timestamp: new Date().toISOString(),
    envVars: {
      SANMAR_CUSTOMER_NUMBER: process.env.SANMAR_CUSTOMER_NUMBER ? `set (${process.env.SANMAR_CUSTOMER_NUMBER.length} chars)` : 'MISSING',
      SANMAR_USERNAME: process.env.SANMAR_USERNAME ? `set (${process.env.SANMAR_USERNAME.length} chars)` : 'MISSING',
      SANMAR_PASSWORD: process.env.SANMAR_PASSWORD ? `set (${process.env.SANMAR_PASSWORD.length} chars)` : 'MISSING',
    },
  }

  // Test raw SOAP call
  const customerNumber = process.env.SANMAR_CUSTOMER_NUMBER || ''
  const username = process.env.SANMAR_USERNAME || ''
  const password = process.env.SANMAR_PASSWORD || ''

  if (!customerNumber || !username || !password) {
    diagnostics.result = 'FAIL - missing credentials'
    return NextResponse.json(diagnostics)
  }

  const testStyle = 'PC54'
  const url = 'https://ws.sanmar.com:8080/SanMarWebService/SanMarProductInfoServicePort?wsdl'

  const envelope = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:impl="http://impl.webservice.integration.sanmar.com/"
  xmlns:web="http://webservice.integration.sanmar.com/">
  <soapenv:Header/>
  <soapenv:Body>
    <impl:getProductInfoByStyleColorSize>
      <arg0>
        <style>${testStyle}</style>
      </arg0>
      <arg1>
        <sanMarCustomerNumber>${customerNumber}</sanMarCustomerNumber>
        <sanMarUserName>${username}</sanMarUserName>
        <sanMarUserPassword>${password}</sanMarUserPassword>
      </arg1>
    </impl:getProductInfoByStyleColorSize>
  </soapenv:Body>
</soapenv:Envelope>`

  try {
    diagnostics.testStyle = testStyle
    diagnostics.endpoint = url

    const startTime = Date.now()
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': '',
      },
      body: envelope,
    })
    diagnostics.responseTime = `${Date.now() - startTime}ms`
    diagnostics.httpStatus = response.status

    const body = await response.text()

    if (!response.ok) {
      diagnostics.result = `FAIL - HTTP ${response.status}`
      diagnostics.errorBody = body.substring(0, 1000)
      return NextResponse.json(diagnostics)
    }

    // Check for SOAP fault
    if (body.includes('<faultstring>') || body.includes('<faultcode>')) {
      const faultMatch = body.match(/<faultstring>([\s\S]*?)<\/faultstring>/)
      diagnostics.result = 'FAIL - SOAP Fault'
      diagnostics.soapFault = faultMatch ? faultMatch[1] : body.substring(0, 500)
      return NextResponse.json(diagnostics)
    }

    // Check for SanMar error response
    const errorMatch = body.match(/<errorOccured>([\s\S]*?)<\/errorOccured>/)
    if (errorMatch && errorMatch[1].trim() === 'true') {
      const msgMatch = body.match(/<message>([\s\S]*?)<\/message>/)
      diagnostics.result = 'FAIL - SanMar Error'
      diagnostics.sanmarError = msgMatch ? msgMatch[1].trim() : 'Unknown error'
      return NextResponse.json(diagnostics)
    }

    // Check for product data
    const hasProducts = body.includes('<listResponse>')
    diagnostics.result = hasProducts ? 'SUCCESS' : 'WARN - No products found'
    if (hasProducts) {
      const productCount = (body.match(/<listResponse>/g) || []).length
      diagnostics.productsFound = productCount
      // Extract first style name as proof
      const styleMatch = body.match(/<style>([\s\S]*?)<\/style>/)
      diagnostics.firstStyle = styleMatch ? styleMatch[1] : '?'
    }

    return NextResponse.json(diagnostics)
  } catch (error) {
    diagnostics.result = 'FAIL - Network/Connection Error'
    diagnostics.error = error instanceof Error ? error.message : String(error)
    return NextResponse.json(diagnostics)
  }
}
