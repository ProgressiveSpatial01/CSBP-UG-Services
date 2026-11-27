// storage.js — the only module that touches localStorage.
//
// Uploaded layers live in the browser, per browser, under one key (see
// STORAGE_KEYS.uploadedLayers). Nothing is shared between machines or
// users; a team-wide store is a possible later phase, and keeping every
// read/write behind this module is what makes that swappable.
//
// Stored shape, keyed by layer display name:
//   {
//     group:      "Located UG Services",
//     colour:     "#ff00ff",
//     geojson:    { type: "FeatureCollection", ... },
//     attributes: ["BIM.ServiceAtt.Material", ...],  // popup fields
//     timestamp:  "2026-11-27T01:23:45.678Z"
//   }
// Entries written before the tidy-up spell the colour key `color`;
// readUploadedLayers() normalises those on the way out, so old saved
// layers keep working.

import { STORAGE_KEYS } from './config.js';

/**
 * Every uploaded layer, keyed by display name. Never throws: corrupt or
 * unavailable storage logs and reads as empty, so a bad entry cannot
 * stop the map loading.
 *
 * @returns {Record<string, object>}
 */
export function readUploadedLayers() {
  let raw;
  try {
    raw = localStorage.getItem(STORAGE_KEYS.uploadedLayers);
  } catch (error) {
    console.error('Uploaded layers: localStorage is not available.', error);
    return {};
  }
  if (!raw) return {};

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    console.error(
      `Uploaded layers: stored value under "${STORAGE_KEYS.uploadedLayers}" is not valid JSON; ignoring it.`,
      error,
    );
    return {};
  }
  if (!parsed || typeof parsed !== 'object') return {};

  const layers = {};
  for (const [name, entry] of Object.entries(parsed)) {
    if (!entry || typeof entry !== 'object') continue;
    layers[name] = {
      ...entry,
      // `color` is the pre-2026-11-27 spelling.
      colour: entry.colour || entry.color,
      attributes: Array.isArray(entry.attributes) ? entry.attributes : [],
    };
  }
  return layers;
}

/** One uploaded layer by name, or null. */
export function readUploadedLayer(name) {
  return readUploadedLayers()[name] || null;
}

/** Display names of all uploaded layers. */
export function uploadedLayerNames() {
  return Object.keys(readUploadedLayers());
}

/** Group names used by uploaded layers (may include groups the static config has never heard of). */
export function uploadedGroupNames() {
  const groups = new Set();
  for (const layer of Object.values(readUploadedLayers())) {
    if (layer.group) groups.add(layer.group);
  }
  return [...groups];
}

/**
 * Save (or replace) an uploaded layer.
 *
 * @param {string} name display name — also the identity of the layer
 * @param {{group: string, colour: string, geojson: object, attributes?: string[]}} layer
 * @throws {Error} with a readable message when the browser refuses the
 *   write, which in practice means the ~5 MB localStorage quota: a big
 *   KML can exceed it on its own. The caller is expected to surface the
 *   message rather than fail silently.
 */
export function saveUploadedLayer(name, { group, colour, geojson, attributes = [] }) {
  const layers = readUploadedLayers();
  layers[name] = {
    group,
    colour,
    geojson,
    attributes,
    timestamp: new Date().toISOString(),
  };
  try {
    localStorage.setItem(STORAGE_KEYS.uploadedLayers, JSON.stringify(layers));
  } catch (error) {
    console.error(`Uploaded layers: could not save "${name}".`, error);
    throw new Error(
      `Could not save "${name}" — browser storage is full. Delete an uploaded layer and try again.`,
    );
  }
}

/**
 * Delete an uploaded layer.
 *
 * @param {string} name
 * @returns {boolean} true if an entry was removed
 */
export function deleteUploadedLayer(name) {
  const layers = readUploadedLayers();
  if (!(name in layers)) return false;
  delete layers[name];
  try {
    localStorage.setItem(STORAGE_KEYS.uploadedLayers, JSON.stringify(layers));
  } catch (error) {
    console.error(`Uploaded layers: could not delete "${name}".`, error);
    return false;
  }
  return true;
}
