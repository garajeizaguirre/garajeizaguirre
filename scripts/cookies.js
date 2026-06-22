(function () {
  "use strict";

  var CONSENT_KEY = "garaje_cookie_consent";
  var SESSION_DISMISS_KEY = "garaje_cookie_banner_dismissed";
  var CONSENT_MAX_AGE = 180 * 24 * 60 * 60 * 1000;
  var GA_MEASUREMENT_ID = "G-PFBWCX1JZW";
  var measurementId = "";
  var banner;
  var dialog;
  var analyticsToggle;
  var lastFocusedElement;

  function safeStorage(storage, operation, key, value) {
    try {
      if (operation === "get") return storage.getItem(key);
      if (operation === "set") storage.setItem(key, value);
      if (operation === "remove") storage.removeItem(key);
    } catch (error) {
      return null;
    }
    return null;
  }

  function getConsent() {
    var raw = safeStorage(window.localStorage, "get", CONSENT_KEY);
    if (!raw) return "pending";

    try {
      var saved = JSON.parse(raw);
      if (!saved.expiresAt || Date.now() >= saved.expiresAt) {
        safeStorage(window.localStorage, "remove", CONSENT_KEY);
        return "pending";
      }
      return saved.analytics === true ? "accepted" : "rejected";
    } catch (error) {
      safeStorage(window.localStorage, "remove", CONSENT_KEY);
      return "pending";
    }
  }

  function saveConsent(analyticsAccepted) {
    safeStorage(
      window.localStorage,
      "set",
      CONSENT_KEY,
      JSON.stringify({
        analytics: analyticsAccepted,
        savedAt: Date.now(),
        expiresAt: Date.now() + CONSENT_MAX_AGE
      })
    );
    safeStorage(window.sessionStorage, "remove", SESSION_DISMISS_KEY);
  }

  function removeAnalyticsCookies() {
    var cookieNames = document.cookie
      .split(";")
      .map(function (cookie) { return cookie.split("=")[0].trim(); })
      .filter(function (name) { return name === "_ga" || name.indexOf("_ga_") === 0; });
    var host = window.location.hostname;
    var domains = ["", host, "." + host];
    var hostParts = host.split(".");
    if (hostParts.length > 2) domains.push("." + hostParts.slice(-2).join("."));

    cookieNames.forEach(function (name) {
      domains.forEach(function (domain) {
        var domainPart = domain ? "; domain=" + domain : "";
        document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/" + domainPart + "; SameSite=Lax";
      });
    });
  }

  function disableAnalytics() {
    if (measurementId) window["ga-disable-" + measurementId] = true;
    removeAnalyticsCookies();
  }

  function loadAnalytics() {
    if (!/^G-[A-Z0-9]+$/i.test(measurementId)) return;
    if (document.querySelector("script[data-garaje-analytics]")) {
      window["ga-disable-" + measurementId] = false;
      return;
    }

    window["ga-disable-" + measurementId] = false;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag("js", new Date());
    window.gtag("config", measurementId, { anonymize_ip: true });

    var script = document.createElement("script");
    script.async = true;
    script.dataset.garajeAnalytics = "true";
    script.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(measurementId);
    document.head.appendChild(script);
  }

  function hideBanner() {
    if (banner) banner.hidden = true;
  }

  function showBanner() {
    if (banner) banner.hidden = false;
  }

  function applyConsent(analyticsAccepted) {
    saveConsent(analyticsAccepted);
    hideBanner();
    if (analyticsAccepted) loadAnalytics();
    else disableAnalytics();
  }

  function closePreferences() {
    if (!dialog) return;
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
    if (lastFocusedElement) lastFocusedElement.focus();
  }

  function openPreferences(trigger) {
    lastFocusedElement = trigger || document.activeElement;
    analyticsToggle.checked = getConsent() === "accepted";
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    window.setTimeout(function () { analyticsToggle.focus(); }, 0);
  }

  function buildInterface() {
    var container = document.createElement("div");
    container.innerHTML = [
      '<aside class="cookie-banner" data-cookie-banner hidden role="region" aria-label="Preferencias de cookies">',
      '  <button class="cookie-close" type="button" data-cookie-dismiss aria-label="Continuar sin aceptar cookies">&times;</button>',
      '  <p class="cookie-eyebrow">Tu privacidad</p>',
      '  <p>Usamos cookies analíticas para conocer el uso de la web y mejorarla. Solo se activarán si nos das permiso. <a href="cookies.html">Más información</a>.</p>',
      '  <div class="cookie-actions">',
      '    <button type="button" data-cookie-reject>Rechazar</button>',
      '    <button class="cookie-configure" type="button" data-cookie-configure>Configurar</button>',
      '    <button type="button" data-cookie-accept>Aceptar</button>',
      '  </div>',
      '</aside>',
      '<dialog class="cookie-dialog" data-cookie-dialog aria-labelledby="cookie-dialog-title">',
      '  <form method="dialog" class="cookie-dialog-inner">',
      '    <div class="cookie-dialog-heading">',
      '      <div><p class="cookie-eyebrow">Privacidad</p><h2 id="cookie-dialog-title">Configurar cookies</h2></div>',
      '      <button class="cookie-close" type="button" data-cookie-dialog-close aria-label="Cerrar configuración">&times;</button>',
      '    </div>',
      '    <p>Puedes utilizar toda la web sin cookies analíticas. Las necesarias solo guardan tu elección.</p>',
      '    <div class="cookie-option">',
      '      <div><strong>Necesarias</strong><span>Permiten guardar tus preferencias de privacidad.</span></div>',
      '      <span class="cookie-always-on">Siempre activas</span>',
      '    </div>',
      '    <label class="cookie-option" for="cookie-analytics">',
      '      <div><strong>Google Analytics</strong><span>Nos ayuda a entender de forma agregada cómo se utiliza la web.</span></div>',
      '      <input id="cookie-analytics" type="checkbox" data-cookie-analytics>',
      '    </label>',
      '    <div class="cookie-dialog-actions">',
      '      <button type="button" data-cookie-reject-all>Rechazar todas</button>',
      '      <button type="button" data-cookie-save>Guardar configuración</button>',
      '    </div>',
      '  </form>',
      '</dialog>'
    ].join("");

    while (container.firstChild) document.body.appendChild(container.firstChild);
    banner = document.querySelector("[data-cookie-banner]");
    dialog = document.querySelector("[data-cookie-dialog]");
    analyticsToggle = document.querySelector("[data-cookie-analytics]");
  }

  function bindEvents() {
    document.querySelector("[data-cookie-accept]").addEventListener("click", function () { applyConsent(true); });
    document.querySelector("[data-cookie-reject]").addEventListener("click", function () { applyConsent(false); });
    document.querySelector("[data-cookie-dismiss]").addEventListener("click", function () {
      safeStorage(window.sessionStorage, "set", SESSION_DISMISS_KEY, "true");
      hideBanner();
      disableAnalytics();
    });
    document.querySelector("[data-cookie-configure]").addEventListener("click", function (event) { openPreferences(event.currentTarget); });
    document.querySelector("[data-cookie-dialog-close]").addEventListener("click", closePreferences);
    document.querySelector("[data-cookie-save]").addEventListener("click", function () {
      applyConsent(analyticsToggle.checked);
      closePreferences();
    });
    document.querySelector("[data-cookie-reject-all]").addEventListener("click", function () {
      applyConsent(false);
      analyticsToggle.checked = false;
      closePreferences();
    });

    document.querySelectorAll("[data-cookie-settings]").forEach(function (button) {
      button.addEventListener("click", function (event) { openPreferences(event.currentTarget); });
    });

    dialog.addEventListener("cancel", function (event) {
      event.preventDefault();
      closePreferences();
    });
  }

  function init() {
    measurementId = GA_MEASUREMENT_ID.trim();
    buildInterface();
    bindEvents();

    var consent = getConsent();
    if (consent === "accepted") loadAnalytics();
    else disableAnalytics();

    var dismissed = safeStorage(window.sessionStorage, "get", SESSION_DISMISS_KEY) === "true";
    if (consent === "pending" && !dismissed) showBanner();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
}());
