/**
 * Per-tenant branding for the login/error pages, layered on top of the
 * common redesign in css/platform.css.
 *
 * Keycloak serves one shared realm/client for every tenant (see
 * apps/workers/src/provisioning/keycloak-sync.ts), so this page has no
 * built-in notion of which tenant is signing in — it only has whatever the
 * browser's current URL says. This login page's own URL is the OIDC
 * authorization request, so its `redirect_uri` query param is always the
 * tenant's own host (e.g. https://acme.techhanker.com/api/auth/callback/...).
 * We pull the hostname out of that, then fetch that tenant's branding
 * straight from ITS OWN origin's public branding endpoint — no lookup table
 * to keep in sync here, and CORS is intentionally wide open on that one
 * endpoint (see riogentix.api.v1.saas_public).
 *
 * window.__BRANDING_API_PATH__ is injected by template.ftl from the "web"
 * client's `brandingApiPath` attribute — see that file for how it gets set.
 */
(function () {
  function tenantHostFromLocation() {
    var params = new URLSearchParams(window.location.search);
    var redirectUri = params.get('redirect_uri');
    if (!redirectUri) return null;
    try {
      return new URL(redirectUri).host;
    } catch (e) {
      return null;
    }
  }

  function hexToRgb(hex) {
    var m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
    if (!m) return null;
    var int = parseInt(m[1], 16);
    return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
  }

  // Darkens a hex color for the :hover state (roughly -12% lightness).
  function darken(hex) {
    var rgb = hexToRgb(hex);
    if (!rgb) return hex;
    var f = 0.88;
    var d = rgb.map(function (c) {
      return Math.max(0, Math.round(c * f));
    });
    return (
      '#' +
      d
        .map(function (c) {
          return c.toString(16).padStart(2, '0');
        })
        .join('')
    );
  }

  function applyBranding(branding) {
    if (!branding) return;
    var root = document.documentElement.style;
    if (branding.primary_color && hexToRgb(branding.primary_color)) {
      root.setProperty('--tenant-primary', branding.primary_color);
      root.setProperty('--tenant-primary-hover', darken(branding.primary_color));
    }
    if (branding.accent_color && hexToRgb(branding.accent_color)) {
      root.setProperty('--tenant-accent', branding.accent_color);
    }
    if (branding.bg_color && hexToRgb(branding.bg_color)) {
      root.setProperty('--tenant-bg', branding.bg_color);
    }
    if (branding.logo_text) {
      var header = document.getElementById('kc-header-wrapper');
      if (header) header.textContent = branding.logo_text;
      document.title = branding.logo_text + ' — ' + document.title;
    }
  }

  var host = tenantHostFromLocation();
  if (!host) return; // platform-level login (no tenant context) — default theme stands.

  var path = window.__BRANDING_API_PATH__ || '/api/v1/internal/saas/branding';
  fetch('https://' + host + path, { mode: 'cors', credentials: 'omit' })
    .then(function (res) {
      return res.ok ? res.json() : null;
    })
    .then(function (data) {
      if (data) applyBranding(data.branding);
    })
    .catch(function () {
      // Network/CORS failure — the common redesign's default theme stands.
    });
})();
