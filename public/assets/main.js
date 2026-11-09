(function () {
  'use strict';

  var CONSENT_KEY = 'vo_consent';
  var ATTR_KEY = 'vo_attr';
  var PACKAGE_VALUES = ['address', 'vat-ready', 'vat-ready-ai'];
  // Static demo hosting (GitHub Pages) has no /api: the form validates and shows success but saves nothing.
  var DEMO = /\.github\.io$/.test(location.hostname);

  function store(kind) {
    try { return window[kind]; } catch (e) { return null; }
  }
  function getItem(kind, key) {
    try { var s = store(kind); return s ? s.getItem(key) : null; } catch (e) { return null; }
  }
  function setItem(kind, key, val) {
    try { var s = store(kind); if (s) s.setItem(key, val); } catch (e) { /* ignore */ }
  }

  /* ---------------- Tracking (loads only after consent) ---------------- */
  var trackingReady = false;
  var queue = [];

  function hasConsent() { return getItem('localStorage', CONSENT_KEY) === 'granted'; }

  function track(name, params) {
    if (!hasConsent()) return;
    if (!trackingReady) { queue.push([name, params || {}]); return; }
    send(name, params || {});
  }

  function send(name, params) {
    if (typeof window.gtag === 'function') window.gtag('event', name, params);
    if (name === 'generate_lead' && typeof window.fbq === 'function') {
      window.fbq('track', 'Lead', { content_name: params.package });
    }
  }

  var trackingLoading = false;
  function loadTracking() {
    if (trackingLoading) return;
    trackingLoading = true;
    (DEMO ? Promise.resolve({ ok: false, json: function () { return {}; } }) : fetch('api/config', { headers: { Accept: 'application/json' } })
      )
      .then(function (r) { return r.ok ? r.json() : {}; })
      .catch(function () { return {}; })
      .then(function (cfg) {
        if (cfg.ga4Id) {
          var s = document.createElement('script');
          s.async = true;
          s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(cfg.ga4Id);
          document.head.appendChild(s);
          window.dataLayer = window.dataLayer || [];
          window.gtag = function () { window.dataLayer.push(arguments); };
          window.gtag('js', new Date());
          window.gtag('config', cfg.ga4Id);
        }
        if (cfg.metaPixelId) {
          /* Standard Meta Pixel bootstrap */
          (function (f, b, e, v, n, t, s) {
            if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
            if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
            t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
          })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
          window.fbq('init', cfg.metaPixelId);
          window.fbq('track', 'PageView');
        }
        trackingReady = true;
        queue.splice(0).forEach(function (e) { send(e[0], e[1]); });
      });
  }

  /* ---------------- Cookie banner ---------------- */
  var banner = document.getElementById('cookie-banner');
  function showBanner() { if (banner) banner.hidden = false; }
  function setConsent(val) {
    setItem('localStorage', CONSENT_KEY, val);
    if (banner) banner.hidden = true;
    if (val === 'granted') loadTracking();
  }
  document.querySelectorAll('[data-consent]').forEach(function (b) {
    b.addEventListener('click', function () { setConsent(b.getAttribute('data-consent')); });
  });
  document.querySelectorAll('[data-open-consent]').forEach(function (b) {
    b.addEventListener('click', function () {
      showBanner();
      var first = banner && banner.querySelector('button');
      if (first) first.focus();
    });
  });
  var consent = getItem('localStorage', CONSENT_KEY);
  if (consent === 'granted') loadTracking();
  else if (consent !== 'denied') showBanner();

  /* ---------------- Attribution (UTM + referrer) ---------------- */
  var attr = {};
  try { attr = JSON.parse(getItem('sessionStorage', ATTR_KEY) || '{}') || {}; } catch (e) { attr = {}; }
  var qs = new URLSearchParams(location.search);
  var keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'];
  var hasUtm = keys.some(function (k) { return qs.get(k); });
  if (hasUtm || !attr.landing_page) {
    var fresh = { referrer: document.referrer || '', landing_page: location.href.slice(0, 500) };
    keys.forEach(function (k) { fresh[k] = (qs.get(k) || '').slice(0, 200); });
    if (!hasUtm && attr.referrer) fresh.referrer = attr.referrer;
    attr = fresh;
    setItem('sessionStorage', ATTR_KEY, JSON.stringify(attr));
  }

  /* ---------------- Nav toggle (mobile) ---------------- */
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('site-nav');
  if (toggle && nav) {
    var setOpen = function (open) {
      nav.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'ปิดเมนู' : 'เปิดเมนู');
    };
    toggle.addEventListener('click', function () { setOpen(!nav.classList.contains('open')); });
    nav.addEventListener('click', function (e) { if (e.target.closest('a')) setOpen(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('open')) { setOpen(false); toggle.focus(); }
    });
  }

  /* ---------------- CTA + package tracking ---------------- */
  var form = document.getElementById('lead-form');
  var pkgSelect = document.getElementById('f-package');

  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-cta]');
    if (el) track('cta_click', { location: el.getAttribute('data-cta') });
    var pk = e.target.closest('[data-package]');
    if (pk && pkgSelect) {
      var v = pk.getAttribute('data-package');
      pkgSelect.value = v;
      clearError('package');
      track('package_select', { package: v, location: 'package_card' });
    }
  });
  if (pkgSelect) {
    pkgSelect.addEventListener('change', function () {
      if (pkgSelect.value) track('package_select', { package: pkgSelect.value, location: 'form' });
    });
    var pre = qs.get('package');
    if (pre && PACKAGE_VALUES.indexOf(pre) !== -1) pkgSelect.value = pre;
  }

  if (!form) return;

  /* ---------------- Form ---------------- */
  var started = false;
  var loadedAt = Date.now();
  form.addEventListener('focusin', function () {
    if (started) return;
    started = true;
    track('form_start', {});
  });

  var MESSAGES = {
    name: 'กรุณากรอกชื่อผู้ติดต่อ',
    email: 'กรุณากรอกอีเมลให้ถูกต้อง',
    company_status: 'กรุณาเลือกข้อนี้',
    package: 'กรุณาเลือกข้อนี้',
    start_timeline: 'กรุณาเลือกข้อนี้',
    pdpa_consent: 'กรุณายินยอมก่อนส่งข้อมูล'
  };
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function fieldEls(name) { return form.querySelectorAll('[name="' + name + '"]'); }
  function setError(name, msg) {
    var err = document.getElementById('e-' + name);
    if (err) { err.textContent = msg; err.hidden = false; }
    fieldEls(name).forEach(function (el) { el.setAttribute('aria-invalid', 'true'); });
  }
  function clearError(name) {
    var err = document.getElementById('e-' + name);
    if (err) { err.textContent = ''; err.hidden = true; }
    fieldEls(name).forEach(function (el) { el.removeAttribute('aria-invalid'); });
  }

  function readForm() {
    var fd = new FormData(form);
    return {
      name: String(fd.get('name') || '').trim(),
      email: String(fd.get('email') || '').trim(),
      company_status: String(fd.get('company_status') || ''),
      package: String(fd.get('package') || ''),
      start_timeline: String(fd.get('start_timeline') || ''),
      addons: fd.getAll('addons').map(String),
      pdpa_consent: form.querySelector('#f-consent').checked,
      website: String(fd.get('website') || '')
    };
  }

  function validate(d) {
    var errs = {};
    if (!d.name) errs.name = true;
    if (!EMAIL_RE.test(d.email)) errs.email = true;
    if (!d.company_status) errs.company_status = true;
    if (!d.package) errs.package = true;
    if (!d.start_timeline) errs.start_timeline = true;
    if (!d.pdpa_consent) errs.pdpa_consent = true;
    return errs;
  }

  Object.keys(MESSAGES).forEach(function (name) {
    fieldEls(name).forEach(function (el) {
      el.addEventListener('change', function () { clearError(name); });
      if (el.tagName === 'INPUT' && /text|tel|email/.test(el.type)) {
        el.addEventListener('blur', function () {
          if (!el.value) return;
          var d = readForm();
          if (validate(d)[name]) setError(name, MESSAGES[name]); else clearError(name);
        });
      }
    });
  });

  var btn = document.getElementById('submit-btn');
  var statusEl = document.getElementById('form-status');
  var success = document.getElementById('form-success');
  var btnHTML = btn.innerHTML;
  var sending = false;

  function showStatus(msg) { statusEl.textContent = msg; statusEl.hidden = false; }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (sending) return;
    statusEl.hidden = true;

    var d = readForm();
    var errs = validate(d);
    var firstBad = null;
    Object.keys(MESSAGES).forEach(function (name) {
      if (errs[name]) { setError(name, MESSAGES[name]); if (!firstBad) firstBad = name; }
      else clearError(name);
    });
    if (firstBad) { fieldEls(firstBad)[0].focus(); return; }

    var payload = {
      name: d.name, email: d.email,
      company_status: d.company_status, package: d.package, start_timeline: d.start_timeline,
      addons: d.addons,
      pdpa_consent: d.pdpa_consent, website: d.website,
      elapsed_ms: Date.now() - loadedAt,
      utm_source: attr.utm_source || '', utm_medium: attr.utm_medium || '',
      utm_campaign: attr.utm_campaign || '', utm_content: attr.utm_content || '',
      referrer: attr.referrer || '', landing_page: attr.landing_page || location.href
    };

    sending = true;
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');
    btn.textContent = 'กำลังส่งข้อมูล...';

    (DEMO
      ? new Promise(function (res) {
          console.info('[demo] lead not saved (static hosting):', payload);
          setTimeout(function () { res(new Response(JSON.stringify({ ok: true, demo: true }), { status: 200 })); }, 600);
        })
      : fetch('api/lead', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }))
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, body: j }; }); })
      .then(function (res) {
        if (res.ok && res.body.ok) {
          track('generate_lead', { package: d.package, start_timeline: d.start_timeline, addons: d.addons.join(',') });
          form.hidden = true;
          success.hidden = false;
          success.focus();
          return;
        }
        if (res.body && res.body.errors) {
          var first = null;
          Object.keys(res.body.errors).forEach(function (n) {
            if (MESSAGES[n]) { setError(n, MESSAGES[n]); if (!first) first = n; }
          });
          if (first) { fieldEls(first)[0].focus(); }
        }
        throw new Error('submit_failed');
      })
      .catch(function () {
        if (!success.hidden) return;
        showStatus('ส่งข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง หรือติดต่อ [อีเมล / เบอร์โทร]');
      })
      .then(function () {
        sending = false;
        btn.disabled = false;
        btn.removeAttribute('aria-busy');
        btn.innerHTML = btnHTML;
      });
  });
})();
