// main.js — entry point for index.html (the main map).
//
// Reads as the running order of the page and nothing else: create the
// map, wire the panel, then once the style is ready put the imagery,
// the layers and the controls on it. All the actual work lives in the
// modules it imports.

import { createMap, addStandardControls, addDroneImagery, whenStyleReady } from './map.js';
import { loadStaticLayers, addUploadedLayers } from './layers.js';
import { renderLayerControl } from './layer-control.js';
import { createMeasureTool } from './measure.js';

const map = createMap('map');
addStandardControls(map);

setupPanelToggle();
setupSectionHeaders();

whenStyleReady(map, async () => {
  addDroneImagery(map);

  // Panel first: it is built from the config, not from the map, so it
  // is usable while the data files are still arriving.
  renderLayerControl(map, document.getElementById('layer-list'));

  createMeasureTool(map, {
    distanceButton: document.getElementById('measure-distance'),
    areaButton: document.getElementById('measure-area'),
    clearButton: document.getElementById('measure-clear'),
    resultElement: document.getElementById('measure-result'),
  });

  // All configured layers load in parallel; uploaded layers go on after
  // them, so an upload that replaces a built-in layer is what ends up
  // visible (they share a layer id).
  const { loaded, failed } = await loadStaticLayers(map);
  const uploaded = addUploadedLayers(map);

  console.info(
    `Map ready: ${loaded} configured layers loaded` +
      (failed.length ? `, ${failed.length} failed (${failed.join(', ')})` : '') +
      (uploaded.length ? `, ${uploaded.length} uploaded layers restored` : ''),
  );

  // Uploaded layers may have introduced groups the panel has not drawn
  // yet (a layer uploaded into a brand-new group).
  if (uploaded.length) renderLayerControl(map, document.getElementById('layer-list'));
});

/** The ☰ / ✕ button that slides the whole panel out of the way. */
function setupPanelToggle() {
  const button = document.getElementById('layer-toggle');
  const panel = document.getElementById('layer-control');

  button.addEventListener('click', () => {
    const hidden = panel.classList.toggle('hidden');
    button.classList.toggle('panel-open', !hidden);
    button.textContent = hidden ? '☰' : '✕';
    button.setAttribute('aria-expanded', String(!hidden));
    button.setAttribute('aria-label', hidden ? 'Show map controls' : 'Hide map controls');
  });
}

/**
 * The "Layers" / "Upload Layers" section headers.
 * Registered once — this handler used to be attached twice (once inside
 * DOMContentLoaded and once outside it), so every click fired twice and
 * the section appeared not to open.
 */
function setupSectionHeaders() {
  for (const header of document.querySelectorAll('.section-header')) {
    const content = document.getElementById(`${header.dataset.section}-content`);
    if (!content) {
      console.error(`Section header "${header.dataset.section}" has no matching content element.`);
      continue;
    }
    header.addEventListener('click', () => {
      const collapsed = header.classList.toggle('collapsed');
      content.classList.toggle('collapsed', collapsed);
      header.setAttribute('aria-expanded', String(!collapsed));
    });
  }
}
