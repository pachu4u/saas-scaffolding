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

  function applyFavicon(url) {
    var link = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = url;
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
    if (branding.favicon_url || branding.logo_icon_url) {
      applyFavicon(branding.favicon_url || branding.logo_icon_url);
    }
    if (branding.logo_text) {
      document.title = branding.logo_text + ' — ' + document.title;
    }
    // Logo image (with-text preferred, icon-only as fallback) replaces the
    // realm display-name text Keycloak renders into #kc-header-wrapper by
    // default; falls back to that text when no image has been uploaded.
    var header = document.getElementById('kc-header-wrapper');
    if (header) {
      var logoSrc = branding.logo_url || branding.logo_icon_url;
      if (logoSrc) {
        header.textContent = '';
        var img = document.createElement('img');
        img.src = logoSrc;
        img.alt = branding.logo_text || '';
        img.className = 'tenant-login-logo';
        header.appendChild(img);
      } else if (branding.logo_text) {
        header.textContent = branding.logo_text;
      }
    }
    var titleEl = document.querySelector('.pf-v5-c-login__main-header h1.pf-v5-c-title');
    if (branding.login_headline && titleEl) {
      titleEl.textContent = branding.login_headline;
    }
    if (branding.login_subheading && titleEl) {
      var sub = document.getElementById('tenant-login-subheading');
      if (!sub) {
        sub = document.createElement('p');
        sub.id = 'tenant-login-subheading';
        sub.className = 'tenant-login-subheading';
        titleEl.insertAdjacentElement('afterend', sub);
      }
      sub.textContent = branding.login_subheading;
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
