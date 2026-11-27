// utils.js — small shared helpers with no Mapbox and no DOM-layout
// knowledge. Everything here was duplicated (or subtly different)
// between the two pages before the 2026-11-27 tidy-up.

/**
 * The Mapbox source/layer id for a layer display name.
 *
 * SINGLE SOURCE OF TRUTH: this exact expression used to be written out
 * by hand in eight places across the two pages. The layer control, the
 * popup wiring, the upload page's replace flow and the delete button
 * all have to agree on it, or a layer silently fails to toggle/delete.
 *
 * @param {string} name display name, e.g. "ASB Cooling Water"
 * @returns {string} e.g. "asb-cooling-water"
 */
export function layerIdFromName(name) {
  return String(name).replace(/\s+/g, '-').toLowerCase();
}

/**
 * Turn a raw attribute key into something readable in a popup.
 *
 * Real CSBP data carries the same attributes under several prefixes,
 * depending on which export produced the file:
 *   BIM_ServiceAtt_Asset_Owner   (data/*.js, the QGIS exports)
 *   BIM.ServiceAtt.Asset_Owner   (KML uploads — dots, not underscores)
 *   ServiceAtt_Material
 * All of them should read as "Asset Owner" / "Material".
 *
 * @param {string} name raw property key
 * @returns {string} cleaned, title-cased label
 */
export function cleanAttributeName(name) {
  return String(name)
    .replace(/^BIM[._]ServiceAtt[._]/i, '')
    .replace(/^ServiceAtt[._]/i, '')
    .replace(/^Service[._]/i, '')
    .replace(/[._]+/g, ' ')
    // Split runs like "SurveyType" — real keys mix underscores and
    // camel case (BIM_ServiceAtt_SurveyType), and "SurveyType" in a
    // popup label reads as a field name rather than a label.
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Property keys that are plumbing rather than survey information:
 * KML/GeoJSON bookkeeping and the style properties toGeoJSON attaches.
 * Hidden from popups and from the upload page's attribute picker, so
 * both show the same fields.
 */
export const HIDDEN_PROPERTIES = new Set([
  'altitudeMode',
  'begin',
  'drawOrder',
  'end',
  'extrude',
  'fill',
  'fill-opacity',
  'icon',
  'opacity',
  'stroke',
  'stroke-opacity',
  'stroke-width',
  'styleHash',
  'styleMapHash',
  'styleUrl',
  'tessellate',
  'timestamp',
  'visibility',
]);

/** True for a value worth showing: not null, undefined or blank. */
export function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== '';
}

/**
 * Attribute keys of a GeoJSON feature collection, minus the plumbing,
 * sorted. Used by the upload page's attribute picker.
 *
 * @param {object} geojson
 * @returns {string[]}
 */
export function collectAttributeNames(geojson) {
  const keys = new Set();
  for (const feature of geojson?.features || []) {
    for (const [key, value] of Object.entries(feature.properties || {})) {
      if (!HIDDEN_PROPERTIES.has(key) && hasValue(value)) keys.add(key);
    }
  }
  return [...keys].sort();
}

/**
 * Escape text for interpolation into HTML. Popup values come from data
 * files and from user-supplied KML, so they are not trusted markup.
 */
export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Convert a KML colour to a CSS hex colour.
 *
 * KML stores colours as `aabbggrr` — alpha first, then BLUE, green,
 * red. Reading it as #rrggbb (the obvious mistake) turns red pipes
 * blue. Alpha is dropped; Mapbox opacity is handled separately.
 *
 * @param {string} kmlColour e.g. "feff00ff"
 * @returns {string|null} e.g. "#ff00ff", or null if unparseable
 */
export function kmlColourToHex(kmlColour) {
  if (typeof kmlColour !== 'string') return null;
  const hex = kmlColour.trim().replace(/^#/, '');
  if (/^[0-9a-f]{8}$/i.test(hex)) {
    return `#${hex.slice(6, 8)}${hex.slice(4, 6)}${hex.slice(2, 4)}`.toLowerCase();
  }
  // Some writers emit bbggrr with no alpha.
  if (/^[0-9a-f]{6}$/i.test(hex)) {
    return `#${hex.slice(4, 6)}${hex.slice(2, 4)}${hex.slice(0, 2)}`.toLowerCase();
  }
  return null;
}

/** True for a CSS hex colour Mapbox will accept ("#rgb" or "#rrggbb"). */
export function isHexColour(value) {
  return typeof value === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim());
}

/** The value that appears most often in a list, or null if empty. */
export function mostCommon(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  let best = null;
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Show a transient status message in a container element.
 *
 * @param {HTMLElement} container
 * @param {string} message
 * @param {'success'|'error'|'info'} type
 * @param {number} timeoutMs 0 keeps the message until the next call
 */
export function showStatus(container, message, type = 'info', timeoutMs = 5000) {
  if (!container) return;
  clearTimeout(container._statusTimer);
  container.innerHTML = `<div class="status-message ${type}">${escapeHtml(message)}</div>`;
  if (timeoutMs > 0) {
    container._statusTimer = setTimeout(() => {
      container.innerHTML = '';
    }, timeoutMs);
  }
}
