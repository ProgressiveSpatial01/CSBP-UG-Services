// map.js — creating the Mapbox map and the things that sit on it that
// are not data layers: navigation, geolocate, search, scale, and the
// drone imagery raster source.
//
// mapboxgl and MapboxGeocoder come from the CDN <script> tags in the
// page, not from imports: this project deliberately has no build step
// (GitHub Pages serves the repo as-is), so they are globals here.

import { MAPBOX_TOKEN, MAP_DEFAULTS, IMAGERY } from './config.js';

/**
 * Create the map.
 *
 * @param {string} container element id
 * @param {object} overrides anything from MAP_DEFAULTS to change
 * @returns {object} Mapbox map
 */
export function createMap(container, overrides = {}) {
  mapboxgl.accessToken = MAPBOX_TOKEN;
  return new mapboxgl.Map({ container, ...MAP_DEFAULTS, ...overrides });
}

/**
 * Add the standard controls.
 *
 * @param {object} map
 * @param {{navigation?: boolean, geolocate?: boolean, search?: boolean, scale?: boolean}} options
 */
export function addStandardControls(
  map,
  { navigation = true, geolocate = true, search = true, scale = true } = {},
) {
  if (navigation) map.addControl(new mapboxgl.NavigationControl());

  if (geolocate) {
    const control = new mapboxgl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
      showUserHeading: true,
      showAccuracyCircle: true,
    });
    map.addControl(control);
    // Resets the control's internal state after a fix so that clicking
    // it again switches tracking off instead of cycling through its
    // tracking states. Reaches into a private field (_watchState) —
    // carried over from the original page; revisit if Mapbox GL is
    // upgraded past v3.
    control.on('geolocate', () => {
      control._watchState = 'OFF';
    });
  }

  if (search) {
    if (typeof MapboxGeocoder === 'undefined') {
      console.error('Search unavailable: the Mapbox Geocoder plugin failed to load.');
    } else {
      map.addControl(
        new MapboxGeocoder({ accessToken: MAPBOX_TOKEN, mapboxgl, marker: false }),
      );
    }
  }

  if (scale) map.addControl(new mapboxgl.ScaleControl({ maxWidth: 200, unit: 'metric' }));
}

/**
 * Add the drone imagery tiles (tiles/{z}/{x}/{y}.jpg).
 * Must run after the style has loaded.
 */
export function addDroneImagery(map) {
  if (map.getSource(IMAGERY.sourceId)) return;

  map.addSource(IMAGERY.sourceId, {
    type: 'raster',
    tiles: IMAGERY.tiles,
    tileSize: IMAGERY.tileSize,
    minzoom: IMAGERY.minzoom,
    maxzoom: IMAGERY.maxzoom,
    bounds: IMAGERY.bounds,
  });
  map.addLayer({
    id: IMAGERY.layerId,
    type: 'raster',
    source: IMAGERY.sourceId,
    paint: { 'raster-opacity': IMAGERY.opacity },
  });
}

/**
 * Run something once the style is ready for addSource/addLayer.
 *
 * Every "Style is not done loading" error this project has had came
 * from adding layers too early, so all layer work goes through here.
 *
 * @param {object} map
 * @param {() => void} run
 */
export function whenStyleReady(map, run) {
  if (map.isStyleLoaded()) {
    run();
  } else {
    map.once('load', run);
  }
}
