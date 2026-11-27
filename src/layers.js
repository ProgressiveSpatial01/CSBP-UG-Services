// layers.js — putting layers on the map and keeping them interactive.
//
// One code path for both kinds of layer: the built-in ones from
// layers-config.js (data/*.js files) and the uploaded ones from
// localStorage. They used to be added by two near-identical blocks with
// two different popup handlers — the static one hardcoded to six
// `ServiceAtt_*` property names, which is why popups showed nothing for
// files that use the `BIM_ServiceAtt_*` spelling, and why uploaded
// layers were the only ones with readable labels.
//
// Every addSource/addLayer call in here assumes the style has already
// loaded; main.js is responsible for that (see whenStyleReady in
// map.js). Calling them earlier is what produced the old
// "Style is not done loading" error for every layer at once.

import { LINE_WIDTH } from './config.js';
import { flattenLayers } from './layers-config.js';
import { readUploadedLayers } from './storage.js';
import {
  layerIdFromName,
  cleanAttributeName,
  escapeHtml,
  hasValue,
  isHexColour,
  HIDDEN_PROPERTIES,
} from './utils.js';

// What the layer control wants each layer's visibility to be, by layer
// id. The panel is built before the 54 data files have finished
// loading, so a checkbox can be clicked while its layer is still in
// flight; recording the intent here means the layer arrives in the
// state the user asked for instead of the config default.
const desiredVisibility = new Map();

// Popup/cursor handlers per layer id, so they can be detached again.
// Without this, replacing a layer left the old handlers bound and one
// click opened two popups.
const layerHandlers = new Map();

/**
 * Add a GeoJSON layer (or replace one of the same name).
 *
 * Line colour is data-driven: a feature's own `stroke` wins, falling
 * back to the layer colour. That is what carries per-feature KML
 * colours (see kml.js) while leaving static layers on their configured
 * colour.
 *
 * @param {object} map Mapbox map
 * @param {{name: string, geojson: object, colour: string, visible?: boolean,
 *   attributes?: string[]|null}} layer
 * @returns {string} the layer id
 */
export function addGeoJsonLayer(map, { name, geojson, colour, visible = true, attributes = null }) {
  const layerId = layerIdFromName(name);
  removeMapLayer(map, layerId);

  const fallback = isHexColour(colour) ? colour : '#0080ff';
  const wanted = desiredVisibility.has(layerId) ? desiredVisibility.get(layerId) : visible;

  map.addSource(layerId, { type: 'geojson', data: geojson });
  map.addLayer({
    id: layerId,
    type: 'line',
    source: layerId,
    layout: {
      visibility: wanted ? 'visible' : 'none',
      'line-join': 'round',
      'line-cap': 'round',
    },
    paint: {
      'line-color': ['coalesce', ['get', 'stroke'], fallback],
      'line-width': LINE_WIDTH,
    },
  });

  attachInteractions(map, layerId, name, attributes);
  return layerId;
}

/** Remove a layer, its source and its handlers, if present. */
export function removeMapLayer(map, layerId) {
  const handlers = layerHandlers.get(layerId);
  if (handlers) {
    map.off('click', layerId, handlers.click);
    map.off('mouseenter', layerId, handlers.enter);
    map.off('mouseleave', layerId, handlers.leave);
    layerHandlers.delete(layerId);
  }
  if (map.getLayer(layerId)) map.removeLayer(layerId);
  if (map.getSource(layerId)) map.removeSource(layerId);
}

/**
 * Show or hide a layer, remembering the intent even if the layer has
 * not loaded yet.
 */
export function setLayerVisibility(map, layerId, visible) {
  desiredVisibility.set(layerId, visible);
  if (map.getLayer(layerId)) {
    map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
  }
}

/** Forget a layer's remembered visibility (used when it is deleted). */
export function forgetLayerVisibility(layerId) {
  desiredVisibility.delete(layerId);
}

/**
 * Popup on click, pointer cursor on hover. One handler shape for every
 * layer: uploaded layers show the attributes chosen at upload time, and
 * everything else shows every non-empty property.
 *
 * @param {string[]|null} attributes chosen popup fields, or null for "all"
 */
export function attachInteractions(map, layerId, title, attributes = null) {
  const click = (event) => {
    const feature = event.features && event.features[0];
    if (!feature) return;
    new mapboxgl.Popup()
      .setLngLat(event.lngLat)
      .setHTML(buildPopupHtml(title, feature.properties || {}, attributes))
      .addTo(map);
  };
  const enter = () => {
    map.getCanvas().style.cursor = 'pointer';
  };
  const leave = () => {
    map.getCanvas().style.cursor = '';
  };

  map.on('click', layerId, click);
  map.on('mouseenter', layerId, enter);
  map.on('mouseleave', layerId, leave);
  layerHandlers.set(layerId, { click, enter, leave });
}

/**
 * Popup markup for one feature.
 *
 * Labels go through cleanAttributeName(), so
 * `BIM.ServiceAtt.Asset_Owner` reads as "Asset Owner" — the prefixes
 * were previously shown raw. Values are escaped: they come from data
 * files and user-supplied KML.
 *
 * @param {string} title layer name
 * @param {object} properties feature properties
 * @param {string[]|null} attributes chosen fields, or null for all
 * @returns {string} HTML
 */
export function buildPopupHtml(title, properties, attributes = null) {
  const keys = (attributes && attributes.length ? attributes : Object.keys(properties)).filter(
    (key) => !HIDDEN_PROPERTIES.has(key) && hasValue(properties[key]),
  );

  const rows = keys
    .map(
      (key) =>
        `<div class="popup-row"><span class="popup-label">${escapeHtml(
          cleanAttributeName(key),
        )}</span><span class="popup-value">${escapeHtml(properties[key])}</span></div>`,
    )
    .join('');

  return (
    `<h4>${escapeHtml(title)}</h4>` +
    (rows || '<p class="popup-empty">No attributes recorded for this feature.</p>')
  );
}

/**
 * Pull the GeoJSON out of a data/*.js file.
 *
 * These files are QGIS/qgis2web exports: a single GeoJSON object
 * assigned to a var, e.g.
 *   var json_UGWaterCorp_29 = {"type":"FeatureCollection",...}
 * so the JSON starts at the first brace. They are fetched as text and
 * parsed rather than loaded as scripts: 54 <script> tags would have to
 * be listed by hand in the page, which is exactly the kind of
 * duplication this layout is meant to remove.
 *
 * @param {string} text file contents
 * @returns {object} parsed GeoJSON
 */
export function parseLayerDataFile(text) {
  const body = text.replace(/^﻿/, '');
  const start = body.indexOf('{');
  if (start === -1) throw new Error('no JSON object found in the file');
  return JSON.parse(body.slice(start).replace(/;\s*$/, ''));
}

/**
 * Load every layer in layers-config.js.
 *
 * All 54 fetches go out together; each layer is added as soon as its
 * own file arrives. A layer that fails logs an error naming the layer
 * and its file, and the rest carry on — one bad data file must not take
 * the map down.
 *
 * @param {object} map
 * @returns {Promise<{loaded: number, failed: string[]}>}
 */
export async function loadStaticLayers(map) {
  const failed = [];

  const results = await Promise.all(
    flattenLayers().map(async (layer) => {
      try {
        const response = await fetch(layer.file);
        if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
        const geojson = parseLayerDataFile(await response.text());
        addGeoJsonLayer(map, {
          name: layer.name,
          geojson,
          colour: layer.colour,
          visible: layer.visible,
        });
        return true;
      } catch (error) {
        failed.push(layer.name);
        console.error(`Layer "${layer.name}" failed to load from ${layer.file}:`, error);
        return false;
      }
    }),
  );

  return { loaded: results.filter(Boolean).length, failed };
}

/**
 * Add every uploaded layer from localStorage. Called after the static
 * layers so that an upload which replaces a built-in layer wins (both
 * share a layer id, and whoever is added last is what you see).
 *
 * @param {object} map
 * @returns {string[]} names added
 */
export function addUploadedLayers(map) {
  const added = [];
  for (const [name, layer] of Object.entries(readUploadedLayers())) {
    if (!layer.geojson) {
      console.error(`Uploaded layer "${name}" has no geometry stored; skipping it.`);
      continue;
    }
    try {
      addGeoJsonLayer(map, {
        name,
        geojson: layer.geojson,
        colour: layer.colour,
        visible: true,
        attributes: layer.attributes || null,
      });
      added.push(name);
    } catch (error) {
      console.error(`Uploaded layer "${name}" could not be added to the map:`, error);
    }
  }
  return added;
}
