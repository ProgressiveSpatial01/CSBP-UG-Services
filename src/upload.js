// upload.js — entry point for upload.html.
//
// Flow: pick a KML, decide whether it replaces an existing layer or
// creates a new one, choose which group it belongs to and which
// attributes its popups show, then upload. "Upload" means: draw it on
// this page's preview map and save it to this browser's localStorage,
// which is where the main map picks it up (see storage.js).
//
// The KML itself is never uploaded anywhere — there is no server. The
// GeoJSON lives in localStorage, so it is per-browser and bounded by
// the browser's storage quota.

import { DEFAULT_LAYER_COLOUR } from './config.js';
import { createMap, addStandardControls, whenStyleReady } from './map.js';
import { flattenLayers, groupNames } from './layers-config.js';
import {
  readUploadedLayers,
  saveUploadedLayer,
  deleteUploadedLayer,
  uploadedGroupNames,
} from './storage.js';
import { addGeoJsonLayer, removeMapLayer } from './layers.js';
import { parseKmlText } from './kml.js';
import { cleanAttributeName, escapeHtml, isHexColour, layerIdFromName, showStatus } from './utils.js';

const DEFAULT_ATTRIBUTE_COUNT = 5;

const dom = {
  status: document.getElementById('status-container'),
  panel: document.getElementById('upload-panel'),
  panelToggle: document.getElementById('toggle-panel'),
  dropZone: document.getElementById('drop-zone'),
  fileInput: document.getElementById('file-input'),
  fileInfo: document.getElementById('file-info'),
  fileName: document.getElementById('file-name'),
  featureCount: document.getElementById('feature-count'),
  existingLayers: document.getElementById('existing-layers'),
  existingGroups: document.getElementById('existing-groups'),
  newLayerName: document.getElementById('new-layer-name'),
  newLayerColour: document.getElementById('new-layer-color'),
  newGroupName: document.getElementById('new-group-name'),
  attributesSection: document.getElementById('attributes-section'),
  attributesList: document.getElementById('attributes-list'),
  previewSection: document.getElementById('preview-section'),
  previewName: document.getElementById('preview-name'),
  previewColour: document.getElementById('preview-color'),
  previewGroup: document.getElementById('preview-group'),
  previewAttributes: document.getElementById('preview-attributes'),
  uploadButton: document.getElementById('upload-btn'),
  manageSection: document.getElementById('manage-section'),
  manageList: document.getElementById('uploaded-layers-list'),
};

/** Everything about the KML currently being worked on. */
let pending = null; // { fileName, geojson, dominantColour, attributes }
let selectedAttributes = [];

const map = createMap('map');
addStandardControls(map, { geolocate: false, search: false, scale: false });

setupPanelToggle();
setupDropZone();
setupActionRadios();
setupPreviewListeners();
refreshDropdowns();

whenStyleReady(map, () => {
  const uploaded = readUploadedLayers();
  for (const [name, layer] of Object.entries(uploaded)) {
    if (!layer.geojson) continue;
    addGeoJsonLayer(map, {
      name,
      geojson: layer.geojson,
      colour: layer.colour,
      attributes: layer.attributes,
    });
  }
  const count = Object.keys(uploaded).length;
  if (count > 0) showStatus(dom.status, `Loaded ${count} previously uploaded layer(s)`, 'info');
  renderManageList();
});

// ---------------------------------------------------------------- file

function setupDropZone() {
  dom.dropZone.addEventListener('click', () => dom.fileInput.click());
  dom.dropZone.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      dom.fileInput.click();
    }
  });
  dom.dropZone.addEventListener('dragover', (event) => {
    event.preventDefault();
    dom.dropZone.classList.add('dragover');
  });
  dom.dropZone.addEventListener('dragleave', () => dom.dropZone.classList.remove('dragover'));
  dom.dropZone.addEventListener('drop', (event) => {
    event.preventDefault();
    dom.dropZone.classList.remove('dragover');
    if (event.dataTransfer.files.length) handleFile(event.dataTransfer.files[0]);
  });
  dom.fileInput.addEventListener('change', (event) => {
    if (event.target.files.length) handleFile(event.target.files[0]);
  });
}

function handleFile(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.kmz')) {
    showStatus(
      dom.status,
      'KMZ is a zipped KML — unzip it (or re-export as .kml) and try again.',
      'error',
    );
    return;
  }
  if (!name.endsWith('.kml')) {
    showStatus(dom.status, 'Please select a .kml file', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onerror = () => showStatus(dom.status, `Could not read ${file.name}`, 'error');
  reader.onload = (event) => {
    try {
      const result = parseKmlText(event.target.result);
      pending = { fileName: file.name, ...result };

      dom.fileName.textContent = file.name;
      dom.featureCount.textContent = String(result.featureCount);
      dom.fileInfo.classList.remove('hidden');
      dom.uploadButton.disabled = false;

      if (isHexColour(result.dominantColour)) {
        dom.newLayerColour.value = result.dominantColour;
      }
      renderAttributePicker(result.attributes);

      const colourNote = result.colouredCount
        ? `colour read from the KML for ${result.colouredCount} of ${result.featureCount} features`
        : 'no colour in the KML, using the colour picker';
      showStatus(
        dom.status,
        `${file.name}: ${result.featureCount} features, ${colourNote}`,
        'success',
      );
      for (const warning of result.warnings) console.warn(`${file.name}: ${warning}`);
      updatePreview();
    } catch (error) {
      pending = null;
      dom.uploadButton.disabled = true;
      dom.fileInfo.classList.add('hidden');
      showStatus(dom.status, error.message, 'error');
      console.error(`Could not read ${file.name}:`, error);
    }
  };
  reader.readAsText(file);
}

// ----------------------------------------------------------- attributes

function renderAttributePicker(attributes) {
  dom.attributesList.innerHTML = '';
  selectedAttributes = [];

  if (!attributes.length) {
    dom.attributesSection.style.display = 'none';
    dom.attributesList.innerHTML = '<p class="muted">No attributes found in this file</p>';
    updatePreview();
    return;
  }
  dom.attributesSection.style.display = 'block';

  const selectAllWrapper = document.createElement('div');
  selectAllWrapper.className = 'attr-select-all';
  const selectAll = document.createElement('input');
  selectAll.type = 'checkbox';
  selectAll.id = 'select-all-attrs';
  const selectAllLabel = document.createElement('label');
  selectAllLabel.htmlFor = selectAll.id;
  selectAllLabel.textContent = 'Select all';
  selectAllWrapper.append(selectAll, selectAllLabel);
  dom.attributesList.appendChild(selectAllWrapper);

  attributes.forEach((attribute, index) => {
    const row = document.createElement('div');
    row.className = 'attr-row';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'attr-checkbox';
    checkbox.id = `attr-${layerIdFromName(attribute)}`;
    checkbox.dataset.attr = attribute;
    checkbox.checked = index < DEFAULT_ATTRIBUTE_COUNT;

    const label = document.createElement('label');
    label.htmlFor = checkbox.id;
    // Cleaned for display; the raw key stays in dataset.attr because
    // that is what the popup has to look up.
    label.textContent = cleanAttributeName(attribute);
    label.title = attribute;

    checkbox.addEventListener('change', syncSelectedAttributes);
    row.append(checkbox, label);
    dom.attributesList.appendChild(row);
  });

  selectAll.addEventListener('change', () => {
    for (const checkbox of dom.attributesList.querySelectorAll('.attr-checkbox')) {
      checkbox.checked = selectAll.checked;
    }
    syncSelectedAttributes();
  });

  syncSelectedAttributes();
}

function syncSelectedAttributes() {
  const all = [...dom.attributesList.querySelectorAll('.attr-checkbox')];
  const checked = all.filter((checkbox) => checkbox.checked);
  selectedAttributes = checked.map((checkbox) => checkbox.dataset.attr);

  const selectAll = document.getElementById('select-all-attrs');
  if (selectAll) selectAll.checked = all.length > 0 && all.length === checked.length;
  updatePreview();
}

// --------------------------------------------------------------- form

function setupActionRadios() {
  for (const radio of document.querySelectorAll('input[name="action"]')) {
    radio.addEventListener('change', () => {
      const replacing = radio.value === 'replace';
      document.getElementById('replace-options').classList.toggle('hidden', !replacing);
      document.getElementById('new-layer-options').classList.toggle('hidden', replacing);
      updatePreview();
    });
  }
  for (const radio of document.querySelectorAll('input[name="group-action"]')) {
    radio.addEventListener('change', () => {
      const existing = radio.value === 'existing';
      document.getElementById('existing-group-options').classList.toggle('hidden', !existing);
      document.getElementById('new-group-options').classList.toggle('hidden', existing);
      updatePreview();
    });
  }
  dom.uploadButton.addEventListener('click', upload);
}

function setupPreviewListeners() {
  for (const element of [
    dom.existingLayers,
    dom.existingGroups,
    dom.newLayerName,
    dom.newLayerColour,
    dom.newGroupName,
  ]) {
    element.addEventListener('change', updatePreview);
    element.addEventListener('input', updatePreview);
  }
}

/**
 * Every layer that can be replaced: the built-in ones from
 * layers-config.js (all of them, subgroups included — the old
 * hardcoded copy in this page listed only 15 of the 54) and every
 * uploaded layer. Groups come from the config plus any group an upload
 * invented.
 */
function existingLayerIndex() {
  const index = new Map();
  for (const layer of flattenLayers()) {
    index.set(layer.name, {
      group: layer.subgroup ? `${layer.group} › ${layer.subgroup}` : layer.group,
      storeGroup: layer.group,
      colour: layer.colour,
    });
  }
  for (const [name, layer] of Object.entries(readUploadedLayers())) {
    index.set(name, {
      group: `${layer.group || 'Uploaded'} (uploaded)`,
      storeGroup: layer.group || 'Uploaded Layers',
      colour: layer.colour || DEFAULT_LAYER_COLOUR,
    });
  }
  return index;
}

function refreshDropdowns() {
  const previousLayer = dom.existingLayers.value;
  const previousGroup = dom.existingGroups.value;

  dom.existingLayers.innerHTML = '<option value="">Select layer to replace...</option>';
  for (const [name, info] of existingLayerIndex()) {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = `${name} (${info.group})`;
    dom.existingLayers.appendChild(option);
  }

  dom.existingGroups.innerHTML = '<option value="">Select group...</option>';
  for (const group of [...new Set([...groupNames(), ...uploadedGroupNames()])]) {
    const option = document.createElement('option');
    option.value = group;
    option.textContent = group;
    dom.existingGroups.appendChild(option);
  }

  if (previousLayer) dom.existingLayers.value = previousLayer;
  if (previousGroup) dom.existingGroups.value = previousGroup;
}

/** What the form currently describes, whether or not it is complete. */
function readForm() {
  const action = document.querySelector('input[name="action"]:checked').value;
  const groupAction = document.querySelector('input[name="group-action"]:checked').value;
  const index = existingLayerIndex();

  let name = '';
  let colour = DEFAULT_LAYER_COLOUR;
  if (action === 'replace') {
    name = dom.existingLayers.value;
    // Keep the existing layer's colour as the fallback; per-feature KML
    // colours still override it feature by feature.
    colour = (index.get(name) && index.get(name).colour) || colour;
  } else {
    name = dom.newLayerName.value.trim();
    colour = dom.newLayerColour.value;
  }

  const group =
    groupAction === 'existing' ? dom.existingGroups.value : dom.newGroupName.value.trim();

  return { action, name, colour, group };
}

function updatePreview() {
  if (!pending) {
    dom.previewSection.classList.add('hidden');
    return;
  }
  const { name, colour, group } = readForm();
  if (!name || !group) {
    dom.previewSection.classList.add('hidden');
    return;
  }

  dom.previewSection.classList.remove('hidden');
  dom.previewName.textContent = name;
  dom.previewColour.style.backgroundColor = colour;
  dom.previewGroup.textContent = group;
  dom.previewAttributes.textContent = selectedAttributes.length
    ? selectedAttributes.map(cleanAttributeName).join(', ')
    : 'None selected';
}

// ------------------------------------------------------------- upload

function upload() {
  if (!pending) {
    showStatus(dom.status, 'No file loaded', 'error');
    return;
  }
  const { action, name, colour, group } = readForm();

  if (!name) {
    showStatus(
      dom.status,
      action === 'replace' ? 'Please select a layer to replace' : 'Please enter a layer name',
      'error',
    );
    return;
  }
  if (!group) {
    showStatus(dom.status, 'Please select or name a group', 'error');
    return;
  }

  try {
    saveUploadedLayer(name, {
      group,
      colour,
      geojson: pending.geojson,
      attributes: selectedAttributes,
    });
  } catch (error) {
    showStatus(dom.status, error.message, 'error');
    return;
  }

  addGeoJsonLayer(map, {
    name,
    geojson: pending.geojson,
    colour,
    attributes: selectedAttributes,
  });
  zoomToGeoJSON(pending.geojson);

  showStatus(
    dom.status,
    `Layer "${name}" ${action === 'replace' ? 'replaced' : 'added'} — open the main map to see it`,
    'success',
  );
  renderManageList();
  refreshDropdowns();
}

function zoomToGeoJSON(geojson) {
  const bounds = new mapboxgl.LngLatBounds();
  let extended = false;

  const extend = (coordinates) => {
    if (typeof coordinates[0] === 'number') {
      bounds.extend(coordinates);
      extended = true;
      return;
    }
    for (const child of coordinates) extend(child);
  };

  for (const feature of geojson.features || []) {
    const geometry = feature.geometry;
    if (!geometry) continue;
    if (geometry.type === 'GeometryCollection') {
      for (const part of geometry.geometries || []) {
        if (part.coordinates) extend(part.coordinates);
      }
    } else if (geometry.coordinates) {
      extend(geometry.coordinates);
    }
  }

  if (extended) map.fitBounds(bounds, { padding: 50, maxZoom: 19 });
}

// ------------------------------------------------------------- manage

function renderManageList() {
  const layers = readUploadedLayers();
  const names = Object.keys(layers);

  if (names.length === 0) {
    dom.manageSection.style.display = 'none';
    dom.manageList.innerHTML = '';
    return;
  }
  dom.manageSection.style.display = 'block';
  dom.manageList.innerHTML = '';

  for (const name of names) {
    const layer = layers[name];
    const featureCount = layer.geojson?.features?.length ?? 0;

    const item = document.createElement('div');
    item.className = 'manage-layer-item';

    const info = document.createElement('div');
    info.className = 'manage-layer-info';
    info.innerHTML =
      `<div class="manage-layer-name">${escapeHtml(name)}</div>` +
      `<div class="manage-layer-details">Group: ${escapeHtml(
        layer.group || '—',
      )} | ${featureCount} features</div>`;

    const swatch = document.createElement('div');
    swatch.className = 'manage-color-box';
    swatch.style.background = layer.colour || DEFAULT_LAYER_COLOUR;

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'delete-btn';
    remove.textContent = '🗑️ Delete';
    remove.addEventListener('click', () => {
      if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
      // Delete only. The old version of this handler had the whole
      // upload routine pasted in after the delete, so it re-saved the
      // layer it had just removed (and threw on an undefined variable
      // before finishing).
      deleteUploadedLayer(name);
      removeMapLayer(map, layerIdFromName(name));
      renderManageList();
      refreshDropdowns();
      showStatus(dom.status, `Layer "${name}" deleted`, 'info');
    });

    item.append(info, swatch, remove);
    dom.manageList.appendChild(item);
  }
}

// -------------------------------------------------------------- panel

function setupPanelToggle() {
  dom.panelToggle.addEventListener('click', () => {
    const hidden = dom.panel.classList.toggle('hidden');
    dom.panelToggle.setAttribute('aria-expanded', String(!hidden));
  });
}
