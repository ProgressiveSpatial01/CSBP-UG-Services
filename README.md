# CSBP Underground Services — web map

Underground services viewer for the CSBP Kwinana site: as-built and
located services surveyed by Progressive Spatial, the DBYD/existing
infrastructure overlays, and drone imagery, on a Mapbox GL map with a
KML upload path for adding or refreshing a layer from the field.

- **Live:** <https://progressivespatial01.github.io/CSBP-UG-Services/>
  (the old `mapbox-index.html` URL still works — it redirects)
- **Stack:** static HTML/CSS/ES modules, Mapbox GL JS v3.0.1, Mapbox
  Geocoder, `@mapbox/togeojson`. **No build step, no npm, no server** —
  GitHub Pages serves this repo exactly as it is committed.

This repo is standalone. The Kwinana Power Plant **K2** project
(`K2-power-station-3d`) is a different client, site and dataset; the two
share conventions, not code or data — see "Relationship to K2" below.

## Quick start

ES modules and `fetch()` do not work from `file://`, so open the pages
through a local web server rather than double-clicking the HTML:

```powershell
python -m http.server 8099
```

Then <http://127.0.0.1:8099/index.html>. (`.claude/launch.json` starts
the same server from Claude Code's preview pane.)

There is nothing to install and nothing to compile.

## Layout

```
index.html              main map — markup and <script> tags only
upload.html             KML upload page — markup only
mapbox-index.html       redirect to index.html, for old links
css/
  map.css               page layout, panel shell, popups
  controls.css          layer tree, measure tool, upload form
src/
  config.js             Mapbox token, map defaults, imagery, storage keys
  layers-config.js      LAYER_CONFIG — the built-in layers (54 of them)
  utils.js              layer ids, attribute-name cleaning, colour helpers
  storage.js            the only module that touches localStorage
  kml.js                KML -> GeoJSON + per-feature colour extraction
  layers.js             adding/removing layers, popups, data-file loading
  layer-control.js      the layers panel
  measure.js            distance and area tools
  map.js                map creation, controls, drone imagery
  main.js               entry point for index.html
  upload.js             entry point for upload.html
data/                   GeoJSON data files (QGIS exports, unchanged)
tiles/                  drone imagery raster tiles {z}/{x}/{y}.jpg
legacy/                 the superseded QGIS2Web Leaflet export (see below)
```

Single source of truth, one place each: the layer list
(`layers-config.js`), the token and map defaults (`config.js`), layer-id
generation and attribute cleaning (`utils.js`), and localStorage
(`storage.js`). Both pages import the same modules — nothing is
duplicated between them.

## How to add a layer

1. Put the data file in `data/`. It is a QGIS/qgis2web export: a single
   GeoJSON object assigned to a var,
   `var json_MyLayer_57 = {"type":"FeatureCollection",...}`.
2. Add an entry to `LAYER_CONFIG` in `src/layers-config.js`, in the
   group (or subgroup) it belongs to:

   ```js
   {
     "name": "UG Water Corp",          // display name; must be unique
     "file": "data/UGWaterCorp_29.js",
     "colour": "#0066CC",              // fallback line colour
     "visible": false                  // does it start switched on
   }
   ```

3. That is all. The map, the layer panel and the upload page's
   "replace existing layer" dropdown are all built from this config.

A layer whose file is missing or malformed logs
`Layer "<name>" failed to load from <file>: <reason>` and is skipped —
the other layers still load.

Default-on layers are the as-built and located services (14 of 54);
everything else starts off, as it always has.

## How uploads work

`upload.html` reads a `.kml`, converts it with toGeoJSON, and saves the
result to **this browser's** `localStorage` under `uploadedLayers`. There
is no server and nothing is shared between machines or people — an
upload is visible to whoever made it, in that browser, until they delete
it. (A shared team store is a possible later phase; keeping every
read/write inside `storage.js` is what makes that swappable.)

The flow: pick a file → replace an existing layer or create a new one →
choose the group → tick which attributes its popups show → Upload. The
main map then shows it under **Uploaded Layers**, grouped by the group
it was filed under, each with a visibility toggle and a delete button.

### KML colour

Colours come from the KML itself, per feature. CSBP's exports put an
inline `<Style>` inside every `<Placemark>` and never use `<styleUrl>`
or `<StyleMap>`:

```xml
<Placemark>
  <Style id="143532495">
    <LineStyle><color>feff00ff</color><width>1.00</width></LineStyle>
  </Style>
  <LineString>...</LineString>
</Placemark>
```

toGeoJSON only attaches `stroke` when a Placemark references a
document-level style by `styleUrl`, so it attaches nothing here — which
is why uploads used to land on the `#0080ff` default. `src/kml.js`
resolves the colour per Placemark itself (inline style first, then
`styleUrl` → `Style`/`StyleMap`), converts KML's `aabbggrr` to
`#rrggbb`, and writes it onto each feature as `stroke`. The map paints
with `['coalesce', ['get', 'stroke'], <layer colour>]`, so a KML with
five colours in it renders with five colours, and anything without a
style falls back to the layer colour. The colour picker on the upload
page shows the file's dominant colour and is the fallback only.

Checked against the real files in `1_WCC/GIS Test` (`ASB COMMS.kml`,
`ASB POWER 260422.kml`, `3RD INCINERATOR LAYOUT.kml`): 14/14 and 150/150
features coloured.

### Popup attributes

Attribute keys are shown cleaned, by one shared helper
(`cleanAttributeName`): `BIM_ServiceAtt_Asset_Owner`,
`BIM.ServiceAtt.Asset_Owner` and `ServiceAtt_Asset_Owner` all read as
**Asset Owner**, and `SurveyType` as **Survey Type**. Built-in layers
show every non-empty attribute; uploaded layers show the ones ticked at
upload time. KML/GeoJSON plumbing (`tessellate`, `altitudeMode`,
`styleUrl`, `stroke`, …) is hidden from popups and from the attribute
picker, by the same list in `utils.js`.

## Deploying

Push to `main`. GitHub Pages serves the repo root, so a merge is the
deploy. There is no build, so what is in the repo is what is live.

`mapbox-index.html` is kept as a redirect to `index.html` because the
map lived at that URL for most of 2026 and links and bookmarks point
there. It can go once nothing references it.

### Mapbox token

The public token (`pk.*`) lives in `src/config.js` and is restricted by
URL in the Mapbox account to `progressivespatial01.github.io`. Public
tokens are visible in page source on any static site — the URL
restriction, not secrecy, is what protects it. If the map 401s after a
domain change, check that restriction first. Swapping the token is a
one-line edit in `config.js`.

## Known issues and data notes

- **479 of 34,644 features are single-coordinate LineStrings** (1.4%,
  across 26 data files — worst: `Base_56.js` 162, `UGPowerLT_38.js` 117,
  `UGCommunications_49.js` 46, `UTPotholeSurvey_17.js` 39 of 117). A
  line layer cannot draw a one-point line, so these are invisible and
  always have been. They look like point features (hydrants, pits,
  pothole locations) exported as degenerate lines. No layer is affected
  wholesale. Fixing it means rendering those features as circles, which
  changes what the map looks like — left alone deliberately.
- **Three data files are not in the config** and so never load:
  `UTwatercooling_15.js`, `UTStacks_16.js`, `UTPotholeSurvey_17.js`.
  They are in the Leaflet export. Add entries to `layers-config.js` if
  they are wanted.
- **Polygons in an uploaded KML render as outlines**, not fills: every
  layer is drawn as a line layer. Fine for services; worth knowing for
  an outline/extent upload.
- **KMZ is not supported** — it is a zipped KML, and the page says so
  rather than failing silently. Unzip or re-export as `.kml`.
- **Deleting an upload that replaced a built-in layer** removes it from
  the current view (they share a layer id). Reload to get the built-in
  data back.
- **localStorage has a per-browser quota of roughly 5 MB.** A large KML
  can approach it on its own; the save fails with a message asking you
  to delete a layer rather than failing silently.

## Relationship to K2

`K2-power-station-3d` is the Kwinana Power Plant K2 platform (2D map
plus a Three.js excavation/clash view, Vite + npm). This repo follows
its conventions — `src/` with one concern per kebab-case module, a
config module instead of scattered constants, British spelling for
`colour`, comments that say *why* and name the data that proved it — but
not its tooling: CSBP has to keep working as static files on GitHub
Pages, so there is no bundler here and Mapbox arrives via CDN
`<script>` tags as globals.

The layer config and the stored-upload format are deliberately open to
extra fields, for the planned 3D phase: a layer entry may carry
`depth`, `invertStart`, `invertEnd`, `diameter` or
`source` (`"12d"` / `"assumed"`) without any change to the renderer,
which ignores keys it does not know. The drone imagery sits behind the
`IMAGERY` entry in `config.js` so a future processing pipeline or hosted
tileset is a config change, not a code change.

## Legacy

`legacy/` holds the original QGIS2Web Leaflet export (`index.html` plus
`css/`, `js/`, `legend/`, `webfonts/`) that this map replaced. It is
kept for reference only and is not wired up: its relative paths to
`data/` and `tiles/` would need `../` to work from inside `legacy/`.
