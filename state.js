import * as config from './config.js';
// Removed updateLayerUI from import as it's no longer needed externally for this
import { showStatusMessage, updateUndoRedoButtons, selectTile, updateSizeUI } from './ui.js';

// --- Game State Variables ---
export let camX = 0; export let camY = 0; export let zoomLevel = 1.0;
// NEW gridData structure: Map<string, { [layer: number]: TileData }>
// TileData = string | { tile: string, size: number, isOrigin: true } | { originX: number, originY: number, isOrigin: false }
export let gridData = new Map();
export let selectedTile = config.DEFAULT_TILE; export let selectedSize = config.DEFAULT_SIZE;
// selectedLayer is now effectively the 'placementLayer' determined by the selected tile
// We don't need a separate state variable that the user changes.
// Let's keep track of the layer for the *currently selected tile*
export let currentPlacementLayer = config.getDefaultLayerForTile(config.DEFAULT_TILE);
export let currentTool = 'build'; export let undoStack = []; export let redoStack = [];

// --- State Modifiers ---
export function setCamPos(x, y) { camX = x; camY = y; } export function setZoomLevel(level) { zoomLevel = level; }
export function setGridData(dataMap) { gridData = dataMap; }
// When selecting a tile, also update the current placement layer
export function setSelectedTile(tileId) {
    selectedTile = tileId;
    currentPlacementLayer = config.getDefaultLayerForTile(tileId);
    // console.log(`Selected ${tileId}, placement layer ${currentPlacementLayer}`); // Debug log
}
export function setSelectedSize(size) { selectedSize = Math.max(1, Math.min(size, config.MAX_BUILD_SIZE)); }
// setSelectedLayer is removed - layer is derived from selected tile
export function setCurrentTool(tool) { currentTool = tool; }

// --- Helper: Get Info for ALL layers at a coordinate ---
// Returns an object: { [layer: number]: TileInfo } or null if empty
// TileInfo = { tile, size, layer, isOrigin, originX, originY }
export function getTileInfoForAllLayers(gx, gy) {
    const key = `${gx},${gy}`;
    const layerMap = gridData.get(key);
    if (!layerMap) return null; // Nothing at this coordinate

    const results = {};
    let foundSomething = false;

    // Iterate through layers defined in the map for this coordinate
    for (const layerStr in layerMap) {
        const layer = parseInt(layerStr, 10);
        const data = layerMap[layer];
        let tileInfo = null;

        if (typeof data === 'string') {
            tileInfo = { tile: data, size: 1, layer: layer, isOrigin: true, originX: gx, originY: gy };
        } else if (typeof data === 'object' && data !== null) {
            if (data.isOrigin) {
                tileInfo = { tile: data.tile, size: data.size || 1, layer: layer, isOrigin: true, originX: gx, originY: gy };
            } else { // It's a part, resolve the origin
                const originKey = `${data.originX},${data.originY}`;
                const originLayerMap = gridData.get(originKey);
                const originData = originLayerMap ? originLayerMap[layer] : null; // Check origin ON THE SAME LAYER
                if (typeof originData === 'object' && originData?.isOrigin) {
                    tileInfo = { tile: originData.tile, size: originData.size || 1, layer: layer, isOrigin: false, originX: data.originX, originY: data.originY };
                } else {
                    console.warn(`Orphaned part at ${gx},${gy}, layer ${layer} ref ${data.originX},${data.originY}`);
                    continue; // Skip orphaned part
                }
            }
        }

        if (tileInfo) {
            results[layer] = tileInfo;
            foundSomething = true;
        }
    }

    return foundSomething ? results : null;
}

// --- Helper: Get TOPMOST Tile Info at coordinate ---
// Returns TileInfo object for the highest layer, or null
export function getTopmostTileInfo(gx, gy) {
    const allLayersInfo = getTileInfoForAllLayers(gx, gy);
    if (!allLayersInfo) return null;

    let topmostLayer = -Infinity;
    let topmostInfo = null;
    for (const layer in allLayersInfo) {
        if (parseInt(layer, 10) > topmostLayer) {
            topmostLayer = parseInt(layer, 10);
            topmostInfo = allLayersInfo[layer];
        }
    }
    return topmostInfo;
}


// --- Undo/Redo Logic (Data now includes layer maps) ---
// actionData = { type: 'place'/'bulldoze', cells: [ { key, oldLayerMap, newLayerMap }, ... ] }
export function performAction(actionData) {
    actionData.cells.forEach(({ key, newLayerMap }) => {
        if (newLayerMap === null || Object.keys(newLayerMap).length === 0) {
            gridData.delete(key); // Remove map entry if new state is empty
        } else {
            gridData.set(key, newLayerMap); // Set the entire layer map object
        }
    });
    undoStack.push(actionData);
    if (undoStack.length > config.MAX_UNDO_STEPS) { undoStack.shift(); }
    redoStack = [];
    updateUndoRedoButtons();
    saveGameToLocal();
}

export function undo() {
    if (undoStack.length === 0) return;
    const actionData = undoStack.pop();
    actionData.cells.forEach(({ key, oldLayerMap }) => {
        if (oldLayerMap === null || Object.keys(oldLayerMap).length === 0) {
            gridData.delete(key); // Restore empty state
        } else {
            gridData.set(key, oldLayerMap); // Restore previous layer map object
        }
    });
    redoStack.push(actionData);
    updateUndoRedoButtons();
    saveGameToLocal();
}

export function redo() {
    if (redoStack.length === 0) return;
    const actionData = redoStack.pop();
    actionData.cells.forEach(({ key, newLayerMap }) => {
         if (newLayerMap === null || Object.keys(newLayerMap).length === 0) {
            gridData.delete(key);
        } else {
            gridData.set(key, newLayerMap);
        }
    });
    undoStack.push(actionData);
    updateUndoRedoButtons();
    saveGameToLocal();
}

// --- Save/Load Logic (Handles new gridData format) ---
export function saveGameToLocal() {
    try {
        // Need to handle Map of Objects correctly for JSON
        const gridObject = {};
        gridData.forEach((value, key) => { gridObject[key] = value; });

        const saveData = {
            version: 9, // New structure version
            grid: gridObject, // Save as object
            camera: { x: camX, y: camY }, zoom: zoomLevel,
            selected: selectedTile, selectedSize: selectedSize
            // No need to save selectedLayer, it's derived
        };
        localStorage.setItem(config.SAVE_KEY, JSON.stringify(saveData));
    } catch (error) { console.error("LS Save Error:", error); showStatusMessage("Error autosaving!", false); }
}

export function loadGameFromLocal() {
    const savedString = localStorage.getItem(config.SAVE_KEY);
    let loadedSuccessfully = false;
    gridData = new Map(); // Start fresh

    if (savedString) {
        try {
            const saveData = JSON.parse(savedString);
            const dataVersion = saveData.version || 0;

            if (dataVersion >= 9) { // Load new format (object map)
                 const gridObject = saveData.grid || {};
                 for (const key in gridObject) {
                     if (Object.hasOwnProperty.call(gridObject, key)) {
                         gridData.set(key, gridObject[key]); // Convert back to Map
                     }
                 }
            } else if (dataVersion >= 6 && dataVersion < 9) { // Load old format (array map, single item per cell)
                 console.warn(`Loading pre-v9 save format (v${dataVersion}). Converting to layered structure.`);
                 const oldGridArray = saveData.grid || [];
                 const oldGridMap = new Map(oldGridArray);

                 oldGridMap.forEach((value, key) => {
                     let layer = config.DEFAULT_LAYER;
                     let tileId = null;
                     let processedData = null;

                     if(typeof value === 'string'){
                         tileId = value;
                         layer = config.getDefaultLayerForTile(tileId);
                         processedData = tileId; // Store string directly in layer map
                     } else if (typeof value === 'object' && value !== null) {
                         tileId = value.tile; // Assume object always has tile if it's origin
                         layer = value.layer ?? config.getDefaultLayerForTile(tileId); // Use stored layer or derive
                         value.layer = layer; // Ensure layer property exists
                         processedData = value; // Store the object
                     }

                     if(processedData !== null) {
                         const layerMap = { [layer]: processedData }; // Create new layer map
                         gridData.set(key, layerMap);
                     }
                 });

            } else {
                 console.warn(`Loading unsupported save format v${dataVersion}. Grid will be empty.`);
                 // Grid remains empty map
            }

            // Load other state
            setCamPos(saveData.camera?.x || 0, saveData.camera?.y || 0);
            setZoomLevel(saveData.zoom || 1.0);
            setSelectedSize(saveData.selectedSize || config.DEFAULT_SIZE);
            selectTile(saveData.selected || config.DEFAULT_TILE); // Also sets currentPlacementLayer

            showStatusMessage("Game Loaded from Local Storage!", true);
            loadedSuccessfully = true;

        } catch (error) {
            console.error("Error loading game from localStorage:", error);
            showStatusMessage("Error loading local save.", false);
            gridData = new Map(); // Ensure grid is cleared on error
        }
    }

    if (!loadedSuccessfully) {
        // Apply defaults if load failed or no save existed
        gridData = new Map(); setCamPos(0, 0); setZoomLevel(1.0);
        setSelectedSize(config.DEFAULT_SIZE); selectTile(config.DEFAULT_TILE);
        if (!savedString) showStatusMessage("No local save data found.", false);
    }

    updateSizeUI(); // Update size slider/display
    // updateLayerUI removed - no manual layer selection display
    undoStack = []; redoStack = []; updateUndoRedoButtons();
    return loadedSuccessfully;
}


export function saveGameToFile() {
    try {
        const gridObject = {}; gridData.forEach((v, k) => { gridObject[k] = v; }); // Convert map to object
        const saveData = { version: 9, description:"SimEmoji Save", grid: gridObject, camera:{ x:camX, y:camY }, zoom:zoomLevel, selected:selectedTile, selectedSize:selectedSize };
        const jsonString = JSON.stringify(saveData, null, 2); const blob = new Blob([jsonString], {type:'application/json'}); const url = URL.createObjectURL(blob);
        const a=document.createElement('a'); a.href=url; a.download=`simemoji_save_${Date.now()}.json`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
        showStatusMessage("Game Saved to File!", true); saveGameToLocal();
    } catch (error) { console.error("File Save Error:", error); showStatusMessage("Error saving to file.", false); }
}
export function loadGameFromFile(file) {
    if (!file) return; const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const jsonString = e.target.result; const saveData = JSON.parse(jsonString);
            if (!saveData.grid || !saveData.camera || saveData.version !== 9) { throw new Error("Invalid or incompatible save file format (v9 required)."); }

            // Load new format (object map -> Map)
            gridData = new Map(); const gridObject = saveData.grid || {};
            for(const key in gridObject){ if(Object.hasOwnProperty.call(gridObject, key)){ gridData.set(key, gridObject[key]); } }

            setCamPos(saveData.camera.x || 0, saveData.camera.y || 0); setZoomLevel(saveData.zoom || 1.0);
            setSelectedSize(saveData.selectedSize || config.DEFAULT_SIZE);
            selectTile(saveData.selected || config.DEFAULT_TILE); // Sets tile & determines placementLayer

            showStatusMessage(`Loaded "${file.name}"!`, true);
            undoStack = []; redoStack = []; updateUndoRedoButtons(); saveGameToLocal();
            window.dispatchEvent(new Event('stateLoaded'));
        } catch (error) { console.error("File Load Error:", error); showStatusMessage(`Error loading file: ${error.message}`, false); }
    };
    reader.onerror = (e) => { console.error("FileReader error:", e); showStatusMessage("Error reading file.", false); };
    reader.readAsText(file);
}

export function confirmClearSaveData() {
    try {
        localStorage.removeItem(config.SAVE_KEY);
        showStatusMessage("Local save data cleared.", true);
        // Reset Game State
        setGridData(new Map()); setCamPos(0, 0); setZoomLevel(1.0);
        selectTile(config.DEFAULT_TILE); // Resets tile & placementLayer
        selectSize(config.DEFAULT_SIZE); // Resets size & UI
        setCurrentTool('build');
        undoStack = []; redoStack = []; updateUndoRedoButtons();
        // Signal state change for redraw etc.
        window.dispatchEvent(new Event('stateLoaded'));
    } catch (error) { console.error("Error clearing save data:", error); showStatusMessage("Error clearing save data.", false); }
}
