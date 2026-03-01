// =============================================
//  FWG AD ATTRIBUTION — First-Touch Cookie Capture
//  Drop this script into the Shopify theme (theme.liquid)
//  so it runs on every page load site-wide.
//
//  On first visit: reads gclid, gbraid, wbraid, and UTM
//  params from the URL, plus landing_page and referrer.
//  Stores each as a cookie (90 days, first-touch only).
//
//  Exposes window.FWG_ATTR.get() for form submit handlers
//  to read all stored values as a plain object.
// =============================================

(function () {
  'use strict';

  var COOKIE_PREFIX = 'fwg_attr_';
  var MAX_AGE = 90 * 24 * 60 * 60; // 90 days in seconds

  // All URL param keys we capture
  var PARAM_KEYS = [
    'gclid', 'gbraid', 'wbraid',
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'
  ];

  // All keys we store (params + context)
  var ALL_KEYS = PARAM_KEYS.concat(['landing_page', 'referrer']);

  // ── Cookie helpers ──

  function getCookie(name) {
    var match = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : null;
  }

  function setCookie(name, value) {
    if (!value) return;
    document.cookie = name + '=' + encodeURIComponent(value)
      + '; path=/; max-age=' + MAX_AGE
      + '; SameSite=Lax';
  }

  // Set only if not already stored (first-touch)
  function setIfNew(key, value) {
    if (!value) return;
    var cookieName = COOKIE_PREFIX + key;
    if (getCookie(cookieName)) return; // already captured
    setCookie(cookieName, value);
  }

  // ── Capture on page load ──

  function capture() {
    // Parse URL params
    try {
      var params = new URLSearchParams(window.location.search);
      for (var i = 0; i < PARAM_KEYS.length; i++) {
        var key = PARAM_KEYS[i];
        var val = params.get(key);
        if (val) {
          setIfNew(key, val);
        }
      }
    } catch (e) {
      // URLSearchParams not supported in very old browsers — skip gracefully
    }

    // Landing page — only set on very first visit
    setIfNew('landing_page', window.location.href);

    // Referrer — only set on very first visit
    if (document.referrer) {
      setIfNew('referrer', document.referrer);
    }
  }

  // ── Public API ──

  function getAll() {
    var result = {};
    for (var i = 0; i < ALL_KEYS.length; i++) {
      var key = ALL_KEYS[i];
      var val = getCookie(COOKIE_PREFIX + key);
      if (val) {
        result[key] = val;
      }
    }
    return result;
  }

  // Run capture immediately
  capture();

  // Expose for form handlers
  window.FWG_ATTR = { get: getAll };

})();
