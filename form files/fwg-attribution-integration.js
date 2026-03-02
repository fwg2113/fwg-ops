// =============================================
//  FWG AD ATTRIBUTION — Form Integration
//
//  Requires: fwg-attribution.js loaded first (provides window.FWG_ATTR)
//
//  HOW TO USE:
//  In your form's submit handler, after building the payload object
//  but BEFORE the fetch() call, add one line:
//
//    FWG_ATTR_FORM.attach(payload);
//
//  This merges all captured attribution values into the payload.
//  It will NOT overwrite any existing keys on the payload.
//
//  Example (in shopify-embed.liquid or submit handler):
//
//    var payload = {
//      business_name: formData.business_name,
//      contact_name: formData.contact_name,
//      // ... rest of form fields ...
//    };
//
//    FWG_ATTR_FORM.attach(payload);   // <── add this line
//
//    fetch(url, { method: 'POST', body: JSON.stringify(payload) });
//
// =============================================

(function () {
  'use strict';

  /**
   * Attach attribution data to a payload object.
   * Only adds keys that are (a) present in cookies and (b) not already set on the payload.
   * This ensures form-specific fields are never overwritten.
   */
  function attach(payload) {
    if (!payload || typeof payload !== 'object') return payload;

    // Get attribution data from cookies
    var attr = (window.FWG_ATTR && window.FWG_ATTR.get) ? window.FWG_ATTR.get() : {};

    var keys = Object.keys(attr);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      // Only set if the payload doesn't already have this key with a truthy value
      if (!payload[key]) {
        payload[key] = attr[key];
      }
    }

    return payload;
  }

  window.FWG_ATTR_FORM = { attach: attach };

})();
