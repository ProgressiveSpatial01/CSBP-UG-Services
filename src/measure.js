// measure.js — the distance and area tools.
//
// Self-contained: it owns its two Mapbox layers (measure-line,
// measure-polygon) and its own click handling, and it does the maths
// itself (haversine for distance, spherical excess for area) rather
// than pulling in a geometry library — this project has no build step
// and no npm dependencies, so every extra library is another CDN
// script tag in the page.

const EARTH_RADIUS_M = 6371000;

const LINE_SOURCE = 'measure-line';
const POLYGON_SOURCE = 'measure-polygon';
const POLYGON_OUTLINE = 'measure-polygon-outline';

/**
 * Wire up the measure control.
 *
 * @param {object} map Mapbox map (style already loaded)
 * @param {{distanceButton: HTMLElement, areaButton: HTMLElement,
 *   clearButton: HTMLElement, resultElement: HTMLElement}} ui
 */
export function createMeasureTool(map, { distanceButton, areaButton, clearButton, resultElement }) {
  let points = [];
  let mode = null; // 'distance' | 'area' | null

  distanceButton.addEventListener('click', () => start('distance'));
  areaButton.addEventListener('click', () => start('area'));
  clearButton.addEventListener('click', clear);
  map.on('click', onMapClick);

  function start(nextMode) {
    if (mode === nextMode) {
      stop();
      return;
    }
    clear();
    mode = nextMode;
    syncButtons();
    resultElement.textContent =
      mode === 'distance' ? 'Click points on the map' : 'Click to draw a polygon';
  }

  /** Stop collecting points but leave the drawing and the reading up. */
  function stop() {
    mode = null;
    syncButtons();
  }

  function clear() {
    points = [];
    mode = null;
    removeDrawing();
    resultElement.textContent = '';
    clearButton.disabled = true;
    syncButtons();
  }

  function onMapClick(event) {
    if (!mode) return;
    points.push([event.lngLat.lng, event.lngLat.lat]);
    clearButton.disabled = false;

    if (mode === 'distance' && points.length >= 2) drawDistance();
    if (mode === 'area' && points.length >= 3) drawArea();
  }

  function drawDistance() {
    setData(LINE_SOURCE, {
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: points },
    });
    if (!map.getLayer(LINE_SOURCE)) {
      map.addLayer({
        id: LINE_SOURCE,
        type: 'line',
        source: LINE_SOURCE,
        paint: { 'line-color': '#ff0000', 'line-width': 3, 'line-dasharray': [2, 2] },
      });
    }
    resultElement.textContent = `Distance: ${pathLengthMetres(points).toFixed(3)} m`;
  }

  function drawArea() {
    const ring = [...points, points[0]];
    setData(POLYGON_SOURCE, {
      type: 'Feature',
      properties: {},
      geometry: { type: 'Polygon', coordinates: [ring] },
    });
    if (!map.getLayer(POLYGON_SOURCE)) {
      map.addLayer({
        id: POLYGON_SOURCE,
        type: 'fill',
        source: POLYGON_SOURCE,
        paint: { 'fill-color': '#ff0000', 'fill-opacity': 0.2 },
      });
      map.addLayer({
        id: POLYGON_OUTLINE,
        type: 'line',
        source: POLYGON_SOURCE,
        paint: { 'line-color': '#ff0000', 'line-width': 3, 'line-dasharray': [2, 2] },
      });
    }
    resultElement.textContent = `Area: ${polygonAreaSquareMetres(points).toFixed(3)} m²`;
  }

  /** Create the source on first use, update it afterwards. */
  function setData(sourceId, feature) {
    const source = map.getSource(sourceId);
    if (source) {
      source.setData(feature);
    } else {
      map.addSource(sourceId, { type: 'geojson', data: feature });
    }
  }

  function removeDrawing() {
    for (const layerId of [LINE_SOURCE, POLYGON_SOURCE, POLYGON_OUTLINE]) {
      if (map.getLayer(layerId)) map.removeLayer(layerId);
    }
    for (const sourceId of [LINE_SOURCE, POLYGON_SOURCE]) {
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    }
  }

  function syncButtons() {
    distanceButton.textContent = mode === 'distance' ? 'Stop' : 'Distance';
    areaButton.textContent = mode === 'area' ? 'Stop' : 'Area';
    distanceButton.classList.toggle('measuring', mode === 'distance');
    areaButton.classList.toggle('measuring', mode === 'area');
    distanceButton.setAttribute('aria-pressed', String(mode === 'distance'));
    areaButton.setAttribute('aria-pressed', String(mode === 'area'));
  }

  return { clear, destroy: () => map.off('click', onMapClick) };
}

/** Great-circle length of a [lng, lat] path, in metres. */
export function pathLengthMetres(coordinates) {
  let total = 0;
  for (let i = 0; i < coordinates.length - 1; i += 1) {
    total += haversineMetres(coordinates[i], coordinates[i + 1]);
  }
  return total;
}

function haversineMetres([lon1, lat1], [lon2, lat2]) {
  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);
  const deltaPhi = toRadians(lat2 - lat1);
  const deltaLambda = toRadians(lon2 - lon1);

  const a =
    Math.sin(deltaPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Area of a [lng, lat] ring in square metres, by spherical excess.
 * Accurate enough at site scale; not a survey-grade computation.
 */
export function polygonAreaSquareMetres(coordinates) {
  if (coordinates.length < 3) return 0;

  let total = 0;
  for (let i = 0; i < coordinates.length; i += 1) {
    const [lon1, lat1] = coordinates[i];
    const [lon2, lat2] = coordinates[(i + 1) % coordinates.length];
    total +=
      (toRadians(lon2) - toRadians(lon1)) *
      (2 + Math.sin(toRadians(lat1)) + Math.sin(toRadians(lat2)));
  }
  return Math.abs((total * EARTH_RADIUS_M * EARTH_RADIUS_M) / 2);
}

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}
