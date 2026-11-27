// kml.js — KML in, GeoJSON (plus real colours) out.
//
// WHY THIS FILE EXISTS — the colour bug, diagnosed 2026-11-27 against
// the project's own KMLs (ASB COMMS.kml, ASB POWER 260422.kml,
// 3RD INCINERATOR LAYOUT.kml, in the WCC "GIS Test" folder):
//
// toGeoJSON only attaches style properties (`stroke`, `fill`) to a
// feature when the Placemark references a document-level style by
// `styleUrl`. Every one of these files does the opposite — the
// Placemark carries its own inline <Style> and there is not a single
// <styleUrl> or <StyleMap> in any of them:
//
//   <Placemark>
//     <Style id="143532495">
//       <LineStyle><color>feff00ff</color><width>1.00</width></LineStyle>
//     </Style>
//     <LineString>...</LineString>
//   </Placemark>
//
// So `stroke` was never set, and the upload page's old two-method
// extractor fell through to its #0080ff default. (Its first method —
// "read the first <Style> in the document" — was also wrong in
// principle: one real file holds 150 inline styles in five different
// colours, so there is no single document colour to find.)
//
// This module therefore resolves colour per Placemark itself, in the
// same document order toGeoJSON walks, and writes the result onto each
// feature as `stroke` so the map can render it data-driven (see
// layers.js). Both styling routes are supported: an inline <Style>, and
// a <styleUrl> pointing at a document <Style> or <StyleMap> (not seen
// in CSBP data so far, but standard KML and cheap to support).

import { kmlColourToHex, mostCommon, collectAttributeNames } from './utils.js';

// Child tags that make a Placemark something toGeoJSON emits a feature
// for. A Placemark with none of these (a folder marker, a bare label)
// produces no feature, and must not consume a colour slot.
const GEOMETRY_TAGS = ['Point', 'LineString', 'Polygon', 'MultiGeometry', 'Track', 'gx:Track'];

// Style blocks to read a colour from, best first. LineStyle wins
// because every CSBP service feature is drawn as a line; PolyStyle
// carries the same colour on polygon placemarks; IconStyle is the last
// resort for point-only placemarks.
const COLOUR_SOURCES = ['LineStyle', 'PolyStyle', 'IconStyle'];

/**
 * Parse KML text into GeoJSON with per-feature colours.
 *
 * @param {string} kmlText raw file contents
 * @returns {{geojson: object, featureCount: number, dominantColour: string|null,
 *   colouredCount: number, attributes: string[], warnings: string[]}}
 * @throws {Error} with a message fit to show the user when the file is
 *   not parseable XML, is not KML, or holds no features.
 */
export function parseKmlText(kmlText) {
  if (typeof toGeoJSON === 'undefined') {
    throw new Error('KML converter (toGeoJSON) failed to load — check the network and reload.');
  }

  const xml = new DOMParser().parseFromString(kmlText, 'text/xml');
  const parseError = xml.getElementsByTagName('parsererror')[0];
  if (parseError) {
    throw new Error('That file is not valid XML, so it cannot be read as KML.');
  }
  if (xml.getElementsByTagName('Placemark').length === 0) {
    throw new Error('No placemarks found — is this a KML file? (KMZ archives must be unzipped first.)');
  }

  const geojson = toGeoJSON.kml(xml);
  const features = geojson?.features || [];
  if (features.length === 0) {
    throw new Error('KML read, but it contains no features with geometry.');
  }

  const warnings = [];
  const colours = placemarkColours(xml);

  // Alignment check: one colour per emitted feature, in order. If the
  // counts disagree, the mapping is untrustworthy — say so loudly and
  // fall back to a single colour for the whole layer rather than
  // painting features with each other's colours.
  if (colours.length === features.length) {
    for (const [index, feature] of features.entries()) {
      const colour = colours[index];
      feature.properties = feature.properties || {};
      // Never overwrite a stroke toGeoJSON already resolved.
      if (colour && !feature.properties.stroke) {
        feature.properties.stroke = colour;
      }
    }
  } else {
    warnings.push(
      `Could not match KML styles to features (${colours.length} styled placemarks, ${features.length} features); using one colour for the layer.`,
    );
  }

  const found = colours.filter(Boolean);
  if (found.length === 0) {
    warnings.push('No LineStyle, PolyStyle or IconStyle colour found in this KML.');
  }

  return {
    geojson,
    featureCount: features.length,
    dominantColour: mostCommon(found),
    colouredCount: found.length,
    attributes: collectAttributeNames(geojson),
    warnings,
  };
}

/**
 * Colour per feature-bearing Placemark, in document order.
 *
 * @param {Document} xml
 * @returns {Array<string|null>} CSS hex colours; null where none resolved
 */
function placemarkColours(xml) {
  const styleIndex = buildStyleIndex(xml);
  const colours = [];

  for (const placemark of xml.getElementsByTagName('Placemark')) {
    if (!hasGeometry(placemark)) continue;
    colours.push(colourForPlacemark(placemark, styleIndex));
  }
  return colours;
}

/** True if this Placemark carries geometry toGeoJSON will emit. */
function hasGeometry(placemark) {
  return GEOMETRY_TAGS.some((tag) => placemark.getElementsByTagName(tag).length > 0);
}

/**
 * Document-level styles by id, so `<styleUrl>#id</styleUrl>` can be
 * resolved. A StyleMap resolves through its "normal" pair.
 *
 * @param {Document} xml
 * @returns {Map<string, Element>} id (without '#') -> Style element
 */
function buildStyleIndex(xml) {
  const styles = new Map();
  for (const style of xml.getElementsByTagName('Style')) {
    const id = style.getAttribute('id');
    if (id) styles.set(id, style);
  }

  for (const styleMap of xml.getElementsByTagName('StyleMap')) {
    const id = styleMap.getAttribute('id');
    if (!id) continue;
    for (const pair of styleMap.getElementsByTagName('Pair')) {
      const key = textOf(pair.getElementsByTagName('key')[0]);
      if (key && key !== 'normal') continue;
      const target = textOf(pair.getElementsByTagName('styleUrl')[0]);
      const resolved = target && styles.get(target.replace(/^#/, ''));
      if (resolved) {
        styles.set(id, resolved);
        break;
      }
    }
  }
  return styles;
}

/**
 * Colour for one Placemark: its own inline <Style> first (how every
 * CSBP KML is written), then a <styleUrl> reference.
 */
function colourForPlacemark(placemark, styleIndex) {
  const inline = placemark.getElementsByTagName('Style')[0];
  const inlineColour = colourFromStyle(inline);
  if (inlineColour) return inlineColour;

  const styleUrl = textOf(placemark.getElementsByTagName('styleUrl')[0]);
  if (styleUrl) {
    const referenced = styleIndex.get(styleUrl.replace(/^#/, ''));
    const referencedColour = colourFromStyle(referenced);
    if (referencedColour) return referencedColour;
  }
  return null;
}

/** First usable colour in a <Style>, as CSS hex. */
function colourFromStyle(style) {
  if (!style) return null;
  for (const source of COLOUR_SOURCES) {
    const block = style.getElementsByTagName(source)[0];
    const raw = block && textOf(block.getElementsByTagName('color')[0]);
    const hex = raw && kmlColourToHex(raw);
    if (hex) return hex;
  }
  return null;
}

/** Trimmed text content of an element, or '' . */
function textOf(element) {
  return element && element.textContent ? element.textContent.trim() : '';
}
