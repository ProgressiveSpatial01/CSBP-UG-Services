// layers-config.js — the single source of truth for the map's built-in
// layers. Adding a layer to the map should mean adding an entry here and
// dropping its data file in data/ — no code changes anywhere else.
//
// Before the 2026-11-27 tidy-up this config existed twice: the full
// version (groups + subgroups + colours) inline in mapbox-index.html,
// and a shorter, already out-of-sync copy inline in upload.html (which
// knew nothing about the subgrouped DBYD layers, so they could never be
// picked as the layer to replace). Both pages now import this file.
//
// Shape:
//   "Group Name": { layers: [ entry, ... ] }
//   "Group Name": { subgroups: { "Subgroup Name": { layers: [...] } } }
//
// A layer entry is:
//   name     display name, and the seed for its Mapbox layer id — see
//            layerIdFromName() in utils.js. Must be unique map-wide.
//   file     path to a data/*.js file (a GeoJSON object assigned to a
//            var — see parseLayerDataFile() in layers.js)
//   colour   fallback line colour, used for any feature that carries no
//            per-feature `stroke` of its own
//   visible  whether the layer starts switched on
//
// Entries may also carry extra fields; anything not listed above is
// ignored by the renderer today and is there for the planned 3D phase
// (depth, invertStart, invertEnd, diameter, source: "12d" | "assumed").
// Keep that in mind before "cleaning up" unknown keys.

export const LAYER_CONFIG = {
  "As-Built UG Services": {
    "layers": [
      {
        "name": "ASB Communications",
        "file": "data/CSPBUGServicesAsbuiltASBSERVICESCommunications_4.js",
        "colour": "#FF1493",
        "visible": true
      },
      {
        "name": "ASB Cooling Water",
        "file": "data/CSPBUGServicesAsbuiltASBSERVICESCoolingWater_1.js",
        "colour": "#00CED1",
        "visible": true
      },
      {
        "name": "ASB Power",
        "file": "data/CSPBUGServicesAsbuiltASBSERVICESPower_2.js",
        "colour": "#FF0000",
        "visible": true
      },
      {
        "name": "ASB Sewer",
        "file": "data/CSPBUGServicesAsbuiltASBSERVICESSewer_3.js",
        "colour": "#8B4513",
        "visible": true
      },
      {
        "name": "ASB Stormwater",
        "file": "data/CSPBUGServicesAsbuiltASBSERVICESStormwater_5.js",
        "colour": "#87CEEB",
        "visible": true
      }
    ]
  },
  "Located UG Services": {
    "layers": [
      {
        "name": "LOC Abandoned Water",
        "file": "data/CSPBUGServicesLocatedLOCSERVICESAbandonedWater_6.js",
        "colour": "#808080",
        "visible": true
      },
      {
        "name": "LOC Communications",
        "file": "data/CSPBUGServicesLocatedLOCSERVICESCommunications_7.js",
        "colour": "#FF1493",
        "visible": true
      },
      {
        "name": "LOC Fire Suppression",
        "file": "data/CSPBUGServicesLocatedLOCSERVICESFireSuppression_8.js",
        "colour": "#DC143C",
        "visible": true
      },
      {
        "name": "LOC Gas",
        "file": "data/CSPBUGServicesLocatedLOCSERVICESGas_9.js",
        "colour": "#FFA500",
        "visible": true
      },
      {
        "name": "LOC Power",
        "file": "data/CSPBUGServicesLocatedLOCSERVICESPower_10.js",
        "colour": "#FF4500",
        "visible": true
      },
      {
        "name": "LOC Steam",
        "file": "data/CSPBUGServicesLocatedLOCSERVICESSteam_11.js",
        "colour": "#FF69B4",
        "visible": true
      },
      {
        "name": "LOC Stormwater",
        "file": "data/CSPBUGServicesLocatedLOCSERVICESStormwater_12.js",
        "colour": "#00BFFF",
        "visible": true
      },
      {
        "name": "LOC Unknown",
        "file": "data/CSPBUGServicesLocatedLOCSERVICESUnknown_13.js",
        "colour": "#A9A9A9",
        "visible": true
      },
      {
        "name": "LOC Water",
        "file": "data/CSPBUGServicesLocatedLOCSERVICESWater_14.js",
        "colour": "#1E90FF",
        "visible": true
      }
    ]
  },
  "Design": {
    "layers": [
      {
        "name": "3rd Incinerator Concrete Outline",
        "file": "data/3rdIncineratorConcreteOutline_0.js",
        "colour": "#808080",
        "visible": false
      }
    ]
  },
  "CSBP DBYD UG Services and Existing Infrastructure": {
    "subgroups": {
      "UG Water Services": {
        "layers": [
          {
            "name": "UG Water Corp",
            "file": "data/UGWaterCorp_29.js",
            "colour": "#0066CC",
            "visible": false
          },
          {
            "name": "UG Water Demin",
            "file": "data/UGWaterDemin_28.js",
            "colour": "#3399FF",
            "visible": false
          },
          {
            "name": "UG Water KWRP",
            "file": "data/UGWaterKWRP_27.js",
            "colour": "#66B2FF",
            "visible": false
          },
          {
            "name": "UG Water Permeate",
            "file": "data/UGWaterPermeate_26.js",
            "colour": "#99CCFF",
            "visible": false
          },
          {
            "name": "UG Water Rain",
            "file": "data/UGWaterRain_25.js",
            "colour": "#00BFFF",
            "visible": false
          },
          {
            "name": "UG Water Salt",
            "file": "data/UGWaterSalt_24.js",
            "colour": "#87CEEB",
            "visible": false
          },
          {
            "name": "UG Water Scheme",
            "file": "data/UGWaterScheme_23.js",
            "colour": "#4682B4",
            "visible": false
          },
          {
            "name": "UG Water Scheme Fire",
            "file": "data/UGWaterSchemeFire_22.js",
            "colour": "#5F9EA0",
            "visible": false
          },
          {
            "name": "UG Water Waste",
            "file": "data/UGWaterWaste_21.js",
            "colour": "#708090",
            "visible": false
          },
          {
            "name": "UG Water BP Fire",
            "file": "data/UGWaterBPFire_30.js",
            "colour": "#DC143C",
            "visible": false
          },
          {
            "name": "UG Water Bore and Fire Hydrants",
            "file": "data/UGWaterBoreandBoreFireHydrants_31.js",
            "colour": "#B22222",
            "visible": false
          }
        ]
      },
      "UG Power & Comms": {
        "layers": [
          {
            "name": "UG Power HT",
            "file": "data/UGPowerHT_39.js",
            "colour": "#FF0000",
            "visible": false
          },
          {
            "name": "UG Power LT",
            "file": "data/UGPowerLT_38.js",
            "colour": "#FF6347",
            "visible": false
          },
          {
            "name": "UG Redundant Electrical",
            "file": "data/UGRedundantElectrical_37.js",
            "colour": "#FF4500",
            "visible": false
          },
          {
            "name": "UG Portable Power Supply",
            "file": "data/UGPortablePowerSupply_40.js",
            "colour": "#FFA500",
            "visible": false
          },
          {
            "name": "UG Communications",
            "file": "data/UGCommunications_49.js",
            "colour": "#32CD32",
            "visible": false
          },
          {
            "name": "UG Telephone",
            "file": "data/UGTelephone_32.js",
            "colour": "#00FF00",
            "visible": false
          },
          {
            "name": "UG Fibre Optic",
            "file": "data/UGFibreOptic_45.js",
            "colour": "#7FFF00",
            "visible": false
          }
        ]
      },
      "UG Gas & Air": {
        "layers": [
          {
            "name": "UG Gas Natural",
            "file": "data/UGGasNatural_44.js",
            "colour": "#FFD700",
            "visible": false
          },
          {
            "name": "UG Hydrogen",
            "file": "data/UGHydrogen_43.js",
            "colour": "#FF69B4",
            "visible": false
          },
          {
            "name": "UG Nitrogen",
            "file": "data/UGNitrogen_42.js",
            "colour": "#9370DB",
            "visible": false
          },
          {
            "name": "UG Air Compressed",
            "file": "data/UGAirCompressed_55.js",
            "colour": "#87CEFA",
            "visible": false
          },
          {
            "name": "UG Air Instrument",
            "file": "data/UGAirInstrument_54.js",
            "colour": "#B0E0E6",
            "visible": false
          },
          {
            "name": "UG CO2",
            "file": "data/UGCO2_50.js",
            "colour": "#778899",
            "visible": false
          }
        ]
      },
      "UG Other Services": {
        "layers": [
          {
            "name": "UG Sewerage",
            "file": "data/UGSewerage_34.js",
            "colour": "#8B4513",
            "visible": false
          },
          {
            "name": "UG Drains and Sumps",
            "file": "data/UGDrainsandSumps_48.js",
            "colour": "#A0522D",
            "visible": false
          },
          {
            "name": "UG Reticulation",
            "file": "data/UGReticulation_35.js",
            "colour": "#D2691E",
            "visible": false
          },
          {
            "name": "UG Redundant Pipe",
            "file": "data/UGRedundantPipe_36.js",
            "colour": "#CD853F",
            "visible": false
          },
          {
            "name": "UG Oil",
            "file": "data/UGOil_41.js",
            "colour": "#8B0000",
            "visible": false
          },
          {
            "name": "UG Sulphuric Acid",
            "file": "data/UGSulphuricAcid_33.js",
            "colour": "#FFFF00",
            "visible": false
          },
          {
            "name": "UG Ammonia",
            "file": "data/UGAmmonia_53.js",
            "colour": "#00CED1",
            "visible": false
          },
          {
            "name": "UG Effluent",
            "file": "data/UGEffluent_46.js",
            "colour": "#696969",
            "visible": false
          },
          {
            "name": "UG Earthing Grid",
            "file": "data/UGEarthingGrid_47.js",
            "colour": "#FFD700",
            "visible": false
          },
          {
            "name": "UG Bores",
            "file": "data/UGBores_51.js",
            "colour": "#4169E1",
            "visible": false
          },
          {
            "name": "UG Argon",
            "file": "data/UGArgon_52.js",
            "colour": "#9932CC",
            "visible": false
          }
        ]
      },
      "Infrastructure": {
        "layers": [
          {
            "name": "UT Bench Mark",
            "file": "data/UTBenchMark_20.js",
            "colour": "#000000",
            "visible": false
          },
          {
            "name": "UT Fence",
            "file": "data/UTFence_19.js",
            "colour": "#A9A9A9",
            "visible": false
          },
          {
            "name": "UT Fire Water Test Locations",
            "file": "data/UTFireWaterTestLocations_18.js",
            "colour": "#FF0000",
            "visible": false
          },
          {
            "name": "Base",
            "file": "data/Base_56.js",
            "colour": "#D3D3D3",
            "visible": false
          }
        ]
      }
    }
  }
};

/**
 * Every configured layer as a flat list, each entry tagged with where it
 * sits in the tree. Use this instead of walking LAYER_CONFIG by hand —
 * the group/subgroup walk used to be copy-pasted in four places.
 *
 * @returns {Array<{name: string, file: string, colour: string,
 *   visible: boolean, group: string, subgroup: string|null}>}
 */
export function flattenLayers() {
  const out = [];
  for (const [group, groupConfig] of Object.entries(LAYER_CONFIG)) {
    for (const layer of groupConfig.layers || []) {
      out.push({ ...layer, group, subgroup: null });
    }
    for (const [subgroup, subgroupConfig] of Object.entries(groupConfig.subgroups || {})) {
      for (const layer of subgroupConfig.layers || []) {
        out.push({ ...layer, group, subgroup });
      }
    }
  }
  return out;
}

/** Group names in config order, for the upload page's group dropdown. */
export function groupNames() {
  return Object.keys(LAYER_CONFIG);
}
