import * as config from './config.js';
import { showStatusMessage, updateUndoRedoButtons, selectTile, updateSizeUI, updateLayerUI } from './ui.js';

// --- Game State Variables ---
export let camX = 0;
export let camY = 0;
export let zoomLevel = 1.0;
// Grid Data Structure: Map key="x,y" -> value can be:
// - string: Simple tile ID (assumed to be on its default layer)
// - object: { tile: string, size: number, layer: number, isOrigin: true } - Top-left origin of multi-tile
// - object: { originX: number, originY: number, layer: number, isOrigin: false } - Other part of multi-tile
export let gridData = new Map();
export let selectedTile = config.DEFAULT_TILE;
export let selectedSize = config.DEFAULT_SIZE;
export let selectedLayer = config.DEFAULT_LAYER;
export let currentTool = 'build';
export let undoStack = [];
export let redoStack = [];

// --- State Modifiers ---
export function setCamPos(x, y) { camX = x; camY = y; }
export function setZoomLevel(level) { zoomLevel = level; }
export function setGridData(dataMap) { gridData = dataMap; }
export function setSelectedTile(tile) { selectedTile = tile; }
export function setSelectedSize(size) {
    selectedSize = Math.max(1, Math.min(size, config.MAX_BUILD_SIZE));
}
export function setSelectedLayer(layer) {
    selectedLayer = Math.max(config.MIN_LAYER, Math.min(layer, config.MAX_LAYER));
}
export function setCurrentTool(tool) { currentTool = tool; }

// --- Helper: Get Processed Info About a Tile/Object at Coordinates ---
// Returns null if empty, or an object like:
// { tile, size, layer, isOrigin, originX, originY }
export function getTileInfo(gx, gy) {
    const key = `${gx},${gy}`;
    const data = gridData.get(key);

    if (typeof data === 'string') {
        // Simple tile string
        const layer = config.getDefaultLayerForTile(data);
        return { tile: data, size: 1, layer: layer, isOrigin: true, originX: gx, originY: gy };
    } else if (typeof data === 'object' && data !== null) {
        if (data.isOrigin) {
            // It's the origin of a multi-tile object
            return {
                tile: data.tile,
                size: data.size || 1,
                layer: data.layer ?? config.getDefaultLayerForTile(data.tile), // Use stored layer or default
                isOrigin: true,
                originX: gx,
                originY: gy
            };
        } else {
            // It's part of a multi-tile object, find the origin
            const originKey = `${data.originX},${data.originY}`;
            const originData = gridData.get(originKey);
            // Check if origin data is valid before using it
            if (typeof originData === 'object' && originData?.isOrigin) {
                return {
                    tile: originData.tile,
                    size: originData.size || 1,
                    layer: originData.layer ?? config.getDefaultLayerForTile(originData.tile), // Layer comes from origin
                    isOrigin: false, // This specific cell is not the origin
                    originX: data.originX,
                    originY: data.originY
                };
            } else {
                // Origin data is missing or invalid, treat this part as orphaned/invalid
                console.warn(`Orphaned multi-tile part found at ${gx},${gy} referencing ${data.originX},${data.originY}`);
                return null;
            }
        }
    }
    return null; // No tile or invalid data structure at this coordinate
}


// --- Undo/Redo Logic ---
// actionData = { type: 'place'/'bulldoze', cells: [ { key, oldData, newData }, ... ] }
export function performAction(actionData) {
    actionData.cells.forEach(({ key, newData }) => {
        if (newData === null) { gridData.delete(key); }
        else { gridData.set(key, newData); }
    });
    undoStack.push(actionData);
    if (undoStack.length > config.MAX_UNDO_STEPS) { undoStack.shift(); }
    redoStack = []; // Clear redo stack
    updateUndoRedoButtons();
    saveGameToLocal(); // Autosave on action
}

export function undo() {
    if (undoStack.length === 0) return;
    const actionData = undoStack.pop();
    // Reverse the action by applying the *old* data
    actionData.cells.forEach(({ key, oldData }) => {
        if (oldData === null) { gridData.delete(key); }
        else { gridData.set(key, oldData); }
    });
    redoStack.push(actionData);
    updateUndoRedoButtons();
    saveGameToLocal(); // Autosave on undo
}

export function redo() {
    if (redoStack.length === 0) return;
    const actionData = redoStack.pop();
    // Re-apply the action by applying the *new* data
    actionData.cells.forEach(({ key, newData }) => {
        if (newData === null) { gridData.delete(key); }
        else { gridData.set(key, newData); }
    });
    undoStack.push(actionData);
    updateUndoRedoButtons();
    saveGameToLocal(); // Autosave on redo
}

// --- Save/Load Logic ---
export function saveGameToLocal() {
    try {
        const gridArray = Array.from(gridData.entries());
        const saveData = {
            version: 8, // Match config version
            grid: gridArray,
            camera: { x: camX, y: camY },
            zoom: zoomLevel,
            selected: selectedTile,
            selectedSize: selectedSize,
            selectedLayer: selectedLayer
        };
        localStorage.setItem(config.SAVE_KEY, JSON.stringify(saveData));
        // console.log("Autosaved to localStorage");
    } catch (error) {
        console.error("LS Save Error:", error);
        showStatusMessage("Error autosaving!", false);
    }
}

export function loadGameFromLocal() {
    const savedString = localStorage.getItem(config.SAVE_KEY);
    let loadedSuccessfully = false;
    gridData = new Map(); // Start fresh

    if (savedString) {
        try {
            const saveData = JSON.parse(savedString);
            const loadedGridData = new Map(saveData.grid || []);
            const dataVersion = saveData.version || 0; // Get version or assume 0

            loadedGridData.forEach((value, key) => {
                let processedValue = value; // Start with loaded value

                // --- Migration / Layer Assignment Logic ---
                if (dataVersion < 8) { // Example: Assign layers if loading pre-v8
                    if (processedValue && processedValue.layer === undefined) {
                        let assignedLayer = config.DEFAULT_LAYER;
                        let tileToCheck = null;

                        if (typeof processedValue === 'string') {
                            tileToCheck = processedValue;
                        } else if (typeof processedValue === 'object' && processedValue.isOrigin) {
                            tileToCheck = processedValue.tile;
                        } else if (typeof processedValue === 'object' && !processedValue.isOrigin) {
                            // Need origin to determine default layer for parts
                            const originData = loadedGridData.get(`${processedValue.originX},${processedValue.originY}`);
                            if (originData?.isOrigin) tileToCheck = originData.tile;
                        }
                        assignedLayer = config.getDefaultLayerForTile(tileToCheck);

                        // If it's an object, add the layer property
                        if (typeof processedValue === 'object' && processedValue !== null) {
                            processedValue.layer = assignedLayer;
                        }
                        // If it's a string, getTileInfo will handle layer assignment later
                    }
                }
                // --- End Migration ---

                gridData.set(key, processedValue); // Add processed value to main grid
            });

            // Load other state
            setCamPos(saveData.camera?.x || 0, saveData.camera?.y || 0);
            setZoomLevel(saveData.zoom || 1.0);
            setSelectedSize(saveData.selectedSize || config.DEFAULT_SIZE);
            setSelectedLayer(saveData.selectedLayer || config.DEFAULT_LAYER); // Use loaded layer or default
            selectTile(saveData.selected || config.DEFAULT_TILE); // Sets tile AND its default layer

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
        gridData = new Map(); // Ensure empty grid
        setCamPos(0, 0); setZoomLevel(1.0);
        setSelectedSize(config.DEFAULT_SIZE);
        // selectTile also sets default layer
        selectTile(config.DEFAULT_TILE);
        if (!savedString) showStatusMessage("No local save data found.", false);
    }

    // Always update UI and clear history after attempting load
    updateSizeUI();
    updateLayerUI(); // Make sure layer display is correct
    undoStack = []; redoStack = []; updateUndoRedoButtons();
    return loadedSuccessfully;
}


export function saveGameToFile() {
    try {
        const gridArray = Array.from(gridData.entries());
        const saveData = {
            version: 8, // Match current version
            description:"SimEmoji Save File",
            grid: gridArray,
            camera:{ x:camX, y:camY },
            zoom:zoomLevel,
            selected:selectedTile,
            selectedSize:selectedSize,
            selectedLayer:selectedLayer
        };
        const jsonString = JSON.stringify(saveData, null, 2);
        const blob = new Blob([jsonString], {type:'application/json'});
        const url = URL.createObjectURL(blob);
        const a=document.createElement('a'); a.href=url; a.download=`simemoji_save_${Date.now()}.json`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
        showStatusMessage("Game Saved to File!", true);
        saveGameToLocal(); // Keep local in sync
    } catch (error) {
        console.error("File Save Error:", error);
        showStatusMessage("Error saving to file.", false);
    }
}
export function loadGameFromFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const jsonString = e.target.result;
            const saveData = JSON.parse(jsonString);
            // Check version compatibility - require v8 for now
            if (!saveData.grid || !saveData.camera || saveData.version !== 8) {
                throw new Error("Invalid or incompatible save file format (v8 required).");
            }

            // Directly set the grid data from the file
            setGridData(new Map(saveData.grid));

            // Load other state
            setCamPos(saveData.camera.x || 0, saveData.camera.y || 0);
            setZoomLevel(saveData.zoom || 1.0);
            setSelectedSize(saveData.selectedSize || config.DEFAULT_SIZE);
            setSelectedLayer(saveData.selectedLayer || config.DEFAULT_LAYER);
            selectTile(saveData.selected || config.DEFAULT_TILE); // Also sets default layer

            showStatusMessage(`Loaded "${file.name}"!`, true);
            undoStack = []; redoStack = []; updateUndoRedoButtons();
            saveGameToLocal(); // Update local storage with the loaded state
            window.dispatchEvent(new Event('stateLoaded')); // Signal update

        } catch (error) {
            console.error("File Load Error:", error);
            showStatusMessage(`Error loading file: ${error.message}`, false);
        }
    };
    reader.onerror = (e) => {
        console.error("FileReader error:", e);
        showStatusMessage("Error reading file.", false);
    };
    reader.readAsText(file);
}

export function confirmClearSaveData() {
    try {
        localStorage.removeItem(config.SAVE_KEY);
        showStatusMessage("Local save data cleared.", true);
        // Reset Game State
        setGridData(new Map()); setCamPos(0, 0); setZoomLevel(1.0);
        selectTile(config.DEFAULT_TILE); // Resets tile & layer
        selectSize(config.DEFAULT_SIZE); // Resets size & UI
        setCurrentTool('build');
        undoStack = []; redoStack = []; updateUndoRedoButtons();
        // Signal state change for redraw etc.
        window.dispatchEvent(new Event('stateLoaded'));
    } catch (error) {
        console.error("Error clearing save data:", error);
        showStatusMessage("Error clearing save data.", false);
    }
}
