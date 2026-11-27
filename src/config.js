// config.js — everything environment-ish in one place: the Mapbox
// token, where the map opens, the drone imagery source, and the
// localStorage keys. Both pages import this; nothing else should hold a
// token or a hardcoded centre/zoom.

// Mapbox public token (pk.*). Public by design — it ships in the page
// source on any static site — so it is restricted by URL in the Mapbox
// account to the GitHub Pages origin (progressivespatial01.github.io).
// If the map suddenly 401s after a domain change, that restriction is
// the first thing to check. Swapping the token is a one-line edit here.
export const MAPBOX_TOKEN =
  'pk.eyJ1IjoicHJvZ3Jlc3NpdmVzcGF0aWFsMDEiLCJhIjoiY21saXk2ajY4MDd4NjNlbzk1aHh3ZWcxOCJ9.RvuZXciIFtGqGzwXiZnmbw';

// Where both pages open: the CSBP Kwinana site.
export const MAP_DEFAULTS = {
  style: 'mapbox://styles/mapbox/satellite-streets-v12',
  center: [115.774, -32.242],
  zoom: 16,
  pitch: 0,
  bearing: 0,
};

// Drone imagery, served as pre-rendered raster tiles committed under
// tiles/. Kept behind one config entry on purpose: a future
// drone-processing pipeline (or a hosted tileset) should be a change to
// `tiles` and `bounds` here, not a change to map.js.
export const IMAGERY = {
  sourceId: 'drone-tiles',
  layerId: 'drone-imagery',
  tiles: ['tiles/{z}/{x}/{y}.jpg'],
  tileSize: 256,
  minzoom: 15,
  maxzoom: 20,
  // [west, south, east, north] — the flown area only, so Mapbox does
  // not request tiles that were never generated.
  bounds: [115.7715, -32.2426, 115.7737, -32.2414],
  opacity: 1,
};

// Line rendering shared by static and uploaded layers.
export const LINE_WIDTH = 3;

// Fallback colour for an uploaded layer when its KML carries no usable
// style at all (see kml.js).
export const DEFAULT_LAYER_COLOUR = '#0080ff';

// localStorage keys. Read and written only by storage.js.
export const STORAGE_KEYS = {
  uploadedLayers: 'uploadedLayers',
};
