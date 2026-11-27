// layer-control.js — the layers panel.
//
// Built from layers-config.js plus whatever is in localStorage, never
// from the map's own layer list, so the panel is complete and clickable
// before the data files have finished arriving (layers.js remembers the
// intent and applies it when each layer lands).
//
// Groups start expanded, subgroups start collapsed — same as before the
// tidy-up, and the same default K2's layer tree uses.

import { LAYER_CONFIG } from './layers-config.js';
import { readUploadedLayers, deleteUploadedLayer } from './storage.js';
import { layerIdFromName } from './utils.js';
import { removeMapLayer, setLayerVisibility, forgetLayerVisibility } from './layers.js';

/**
 * Render (or re-render) the whole panel.
 *
 * @param {object} map Mapbox map
 * @param {HTMLElement} container the #layer-list element
 */
export function renderLayerControl(map, container) {
  container.innerHTML = '';

  for (const [groupName, groupConfig] of Object.entries(LAYER_CONFIG)) {
    container.appendChild(buildGroup(map, groupName, groupConfig));
  }

  const uploaded = readUploadedLayers();
  if (Object.keys(uploaded).length > 0) {
    container.appendChild(buildUploadedGroup(map, container, uploaded));
  }
}

/** One configured group: title row, All On/Off, then layers or subgroups. */
function buildGroup(map, groupName, groupConfig) {
  const body = document.createElement('div');
  body.className = 'layer-group-layers';

  if (groupConfig.subgroups) {
    for (const [subgroupName, subgroupConfig] of Object.entries(groupConfig.subgroups)) {
      body.appendChild(buildSubgroup(map, subgroupName, subgroupConfig));
    }
  } else {
    for (const layer of groupConfig.layers || []) {
      body.appendChild(buildLayerRow(map, layer.name, layer.colour, layer.visible));
    }
  }

  const group = document.createElement('div');
  group.className = 'layer-group';
  group.appendChild(
    buildCollapsibleTitle({
      text: groupName,
      className: 'layer-group-title',
      body,
      collapsed: false,
      action: { label: 'All On/Off', onClick: () => toggleAll(map, body) },
    }),
  );
  group.appendChild(body);
  return group;
}

/** One subgroup, collapsed by default. */
function buildSubgroup(map, subgroupName, subgroupConfig) {
  const layers = subgroupConfig.layers || [];
  const body = document.createElement('div');
  body.className = 'subgroup-layers hidden';
  for (const layer of layers) {
    body.appendChild(buildLayerRow(map, layer.name, layer.colour, layer.visible));
  }

  const subgroup = document.createElement('div');
  subgroup.className = 'subgroup';
  subgroup.appendChild(
    buildCollapsibleTitle({
      text: subgroupName,
      className: 'subgroup-title',
      body,
      collapsed: true,
      action: { label: 'All', onClick: () => toggleAll(map, body) },
    }),
  );
  subgroup.appendChild(body);
  return subgroup;
}

/**
 * A title row that collapses its body, with an optional action button.
 * Used for both groups and subgroups so the arrow/aria handling exists
 * once.
 */
function buildCollapsibleTitle({ text, className, body, collapsed, action }) {
  const title = document.createElement('button');
  title.type = 'button';
  title.className = className + (collapsed ? ' collapsed' : '');
  title.setAttribute('aria-expanded', String(!collapsed));

  const label = document.createElement('span');
  label.className = 'title-text';
  label.textContent = text;
  title.appendChild(label);

  if (action) {
    const actionBtn = document.createElement('button');
    actionBtn.type = 'button';
    actionBtn.className = 'group-toggle-all';
    actionBtn.textContent = action.label;
    actionBtn.title = `Switch every layer in "${text}" on or off`;
    actionBtn.addEventListener('click', (event) => {
      // Without this the click also collapses the group.
      event.stopPropagation();
      action.onClick();
    });
    title.appendChild(actionBtn);
  }

  const arrow = document.createElement('span');
  arrow.className = 'toggle-icon';
  arrow.textContent = '▼';
  arrow.setAttribute('aria-hidden', 'true');
  title.appendChild(arrow);

  title.addEventListener('click', () => {
    const nowCollapsed = !title.classList.contains('collapsed');
    title.classList.toggle('collapsed', nowCollapsed);
    body.classList.toggle('hidden', nowCollapsed);
    title.setAttribute('aria-expanded', String(!nowCollapsed));
  });

  return title;
}

/**
 * A labelled checkbox with a colour swatch for one layer.
 *
 * The element id is prefixed per section because an upload can replace
 * a built-in layer, which puts the same layer name in two rows: one
 * element id would then be in the document twice and the second row's
 * <label> would drive the first row's checkbox. The Mapbox layer id
 * lives in dataset.layerId, which is what the toggles actually use.
 */
function buildLayerRow(map, name, colour, visible, idPrefix = 'toggle') {
  const layerId = layerIdFromName(name);

  const row = document.createElement('div');
  row.className = 'layer-item';

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.id = `${idPrefix}-${layerId}`;
  checkbox.dataset.layerId = layerId;
  checkbox.checked = Boolean(visible);
  checkbox.addEventListener('change', () => setLayerVisibility(map, layerId, checkbox.checked));

  const label = document.createElement('label');
  label.htmlFor = checkbox.id;

  const swatch = document.createElement('span');
  swatch.className = 'color-indicator';
  swatch.style.backgroundColor = colour || 'transparent';
  swatch.setAttribute('aria-hidden', 'true');

  label.appendChild(swatch);
  label.appendChild(document.createTextNode(name));

  row.appendChild(checkbox);
  row.appendChild(label);
  return row;
}

/**
 * The "Uploaded Layers" group: a subgroup per group the uploads were
 * filed under, so a group invented on the upload page shows up here by
 * name, with a visibility toggle and a delete button per layer.
 */
function buildUploadedGroup(map, container, uploaded) {
  const body = document.createElement('div');
  body.className = 'layer-group-layers';

  // Group name -> [[name, layer], ...], in insertion order.
  const byGroup = new Map();
  for (const entry of Object.entries(uploaded)) {
    const groupName = entry[1].group || 'Ungrouped';
    if (!byGroup.has(groupName)) byGroup.set(groupName, []);
    byGroup.get(groupName).push(entry);
  }

  for (const [groupName, entries] of byGroup) {
    const subgroupBody = document.createElement('div');
    subgroupBody.className = 'subgroup-layers';

    for (const [name, layer] of entries) {
      const row = buildLayerRow(map, name, layer.colour, true, 'toggle-uploaded');
      row.classList.add('layer-item-uploaded');

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'delete-btn';
      remove.textContent = '🗑️';
      remove.title = `Delete "${name}"`;
      remove.setAttribute('aria-label', `Delete uploaded layer ${name}`);
      remove.addEventListener('click', () => {
        if (!confirm(`Delete "${name}"? This removes it from this browser only.`)) return;
        const layerId = layerIdFromName(name);
        removeMapLayer(map, layerId);
        forgetLayerVisibility(layerId);
        deleteUploadedLayer(name);
        renderLayerControl(map, container);
      });

      row.appendChild(remove);
      subgroupBody.appendChild(row);
    }

    const subgroup = document.createElement('div');
    subgroup.className = 'subgroup';
    subgroup.appendChild(
      buildCollapsibleTitle({
        text: groupName,
        className: 'subgroup-title',
        body: subgroupBody,
        collapsed: false,
        action: { label: 'All', onClick: () => toggleAll(map, subgroupBody) },
      }),
    );
    subgroup.appendChild(subgroupBody);
    body.appendChild(subgroup);
  }

  const group = document.createElement('div');
  group.className = 'layer-group';
  group.appendChild(
    buildCollapsibleTitle({
      text: '📤 Uploaded Layers',
      className: 'layer-group-title',
      body,
      collapsed: false,
    }),
  );
  group.appendChild(body);
  return group;
}

/**
 * All On/Off for every row inside a container: if they are all on,
 * switch them all off; otherwise switch them all on.
 */
function toggleAll(map, container) {
  const boxes = [...container.querySelectorAll('input[type="checkbox"][data-layer-id]')];
  if (boxes.length === 0) return;

  const turnOn = !boxes.every((box) => box.checked);
  for (const box of boxes) {
    box.checked = turnOn;
    setLayerVisibility(map, box.dataset.layerId, turnOn);
  }
}
