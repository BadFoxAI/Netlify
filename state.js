import * as config from './config.js';
import { showStatusMessage, updateUndoRedoButtons, selectTile, updateSizeUI, updateLayerUI } from './ui.js';

// --- Game State Variables --- (Unchanged structure)
export let camX = 0; export let camY = 0; export let zoomLevel = 1.0;
export let gridData = new Map(); export let selectedTile = config.DEFAULT_TILE;
export let selectedSize = config.DEFAULT_SIZE; export let selectedLayer = config.DEFAULT_LAYER;
export let currentTool = 'build'; export let undoStack = []; export let redoStack = [];

// --- State Modifiers --- (Unchanged)
export function setCamPos(x, y) { camX = x; camY = y; } export function setZoomLevel(level) { zoomLevel = level; }
export function setGridData(dataMap) { gridData = dataMap; } export function setSelectedTile(tile) { selectedTile = tile; }
export function setSelectedSize(size) { selectedSize = Math.max(1, Math.min(size, config.MAX_BUILD_SIZE)); }
export function setSelectedLayer(layer) { selectedLayer = Math.max(config.MIN_LAYER, Math.min(layer, config.MAX_LAYER)); }
export function setCurrentTool(tool) { currentTool = tool; }

// --- Helper: Get Data (Handles different stored formats) ---
export function getTileInfo(gx, gy) {
    const key = `${gx},${gy}`;
    const data = gridData.get(key);

    if (typeof data === 'string') { // Simple tile string (assume default layer)
        return { tile: data, size: 1, layer: config.getDefaultLayerForTile(data), isOrigin: true, originX: gx, originY: gy };
    } else if (typeof data === 'object' && data !== null) {
        if (data.isOrigin) { // It's the origin of a multi-tile object
            return { ...data, originX: gx, originY: gy }; // Add origin coords for consistency
        } else { // It's part of a multi-tile object, find the origin
            const originKey = `${data.originX},${data.originY}`;
            const originData = gridData.get(originKey);
            if (typeof originData === 'object' && originData?.isOrigin) {
                // Return info based on the origin
                return { ...originData, isOrigin: false, originX: data.originX, originY: data.originY }; // Mark isOrigin as false, keep reference to actual origin
            }
        }
    }
    return null; // No tile or invalid data structure
}

// --- Undo/Redo Logic --- (Unchanged)
export function performAction(actionData) { /* ... */ } export function undo() { /* ... */ } export function redo() { /* ... */ }

// --- Save/Load Logic (Handle potential missing layers in older saves) ---
export function saveGameToLocal() { /* ... (Save v8 with layers) ... */
     try {
        const gridArray = Array.from(gridData.entries());
        const saveData = { version: 8, grid: gridArray, camera: { x: camX, y: camY }, zoom: zoomLevel, selected: selectedTile, selectedSize: selectedSize, selectedLayer: selectedLayer };
        localStorage.setItem(config.SAVE_KEY, JSON.stringify(saveData));
    } catch (error) { console.error("LS Save Error:", error); showStatusMessage("Error autosaving!", false); }
}

export function loadGameFromLocal() {
    const savedString = localStorage.getItem(config.SAVE_KEY);
    let loadedSuccessfully = false;
    gridData = new Map(); // Start with a clean map

    if (savedString) {
        try {
            const saveData = JSON.parse(savedString);
            const loadedGridData = new Map(saveData.grid || []);

            // --- Assign Layers if loading older format ---
            // Iterate through the loaded grid data BEFORE setting it to the main state
            loadedGridData.forEach((value, key) => {
                if (value && value.layer === undefined) { // Check if layer is missing
                    let assignedLayer = config.DEFAULT_LAYER;
                    let tileToCheck = null;
                    if (typeof value === 'string') {
                        tileToCheck = value;
                    } else if (typeof value === 'object' && value.isOrigin) {
                        tileToCheck = value.tile;
                    } else if (typeof value === 'object' && !value.isOrigin) {
                         // For parts, find origin to determine layer (though origin should ideally have it)
                         const originData = loadedGridData.get(`${value.originX},${value.originY}`);
                         if(originData?.isOrigin) tileToCheck = originData.tile;
                    }
                    assignedLayer = config.getDefaultLayerForTile(tileToCheck); // Assign based on tile type

                    // Update the object directly in the loaded map
                    if (typeof value === 'object' && value !== null) {
                        value.layer = assignedLayer;
                    }
                    // If it was a string, it will be handled correctly by rendering/placement logic later
                    // No need to convert strings to objects just for layer info here.
                }
                // Add the potentially modified entry to the main gridData
                 gridData.set(key, value);
            });
            // --- End Layer Assignment ---

            // Load other state
            setCamPos(saveData.camera?.x || 0, saveData.camera?.y || 0);
            setZoomLevel(saveData.zoom || 1.0);
            setSelectedSize(saveData.selectedSize || config.DEFAULT_SIZE);
            setSelectedLayer(saveData.selectedLayer || config.DEFAULT_LAYER);
            selectTile(saveData.selected || config.DEFAULT_TILE); // Selects tile AND sets its default layer

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
        selectTile(config.DEFAULT_TILE); // This also sets the default layer
        if (!savedString) showStatusMessage("No local save data found.", false);
    }

    // Always update UI and clear history after attempting load
    updateSizeUI(); updateLayerUI(); // Update UI based on final state
    undoStack = []; redoStack = []; updateUndoRedoButtons();
    return loadedSuccessfully;
}


export function saveGameToFile() { /* ... (Save v8 with layers) ... */
     try {
        const gridArray = Array.from(gridData.entries());
        const saveData = { version: 8, description:"SimEmoji Save", grid: gridArray, camera:{ x:camX, y:camY }, zoom:zoomLevel, selected:selectedTile, selectedSize:selectedSize, selectedLayer:selectedLayer };
        const jsonString = JSON.stringify(saveData, null, 2); const blob = new Blob([jsonString], {type:'application/json'}); const url = URL.createObjectURL(blob);
        const a=document.createElement('a'); a.href=url; a.download=`simemoji_save_${Date.now()}.json`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
        showStatusMessage("Game Saved to File!", true); saveGameToLocal();
    } catch (error) { console.error("File Save Error:", error); showStatusMessage("Error saving to file.", false); }
}
export function loadGameFromFile(file) { /* ... (Ensure it checks for v8 and handles layers) ... */
     if (!file) return; const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const jsonString = e.target.result; const saveData = JSON.parse(jsonString);
            if (!saveData.grid || !saveData.camera || saveData.version !== 8) { throw new Error("Invalid or incompatible save file format (v8 required)."); }
            // Load grid - layer assignment assumes v8 format is correct
            setGridData(new Map(saveData.grid));
            setCamPos(saveData.camera.x || 0, saveData.camera.y || 0); setZoomLevel(saveData.zoom || 1.0);
            setSelectedSize(saveData.selectedSize || config.DEFAULT_SIZE); setSelectedLayer(saveData.selectedLayer || config.DEFAULT_LAYER);
            selectTile(saveData.selected || config.DEFAULT_TILE); // Selects tile & sets default layer
            showStatusMessage(`Loaded "${file.name}"!`, true);
            undoStack = []; redoStack = []; updateUndoRedoButtons(); saveGameToLocal();
            window.dispatchEvent(new Event('stateLoaded'));
        } catch (error) { console.error("File Load Error:", error); showStatusMessage(`Error loading file: ${error.message}`, false); }
    };
    reader.onerror = (e) => { console.error("FileReader error:", e); showStatusMessage("Error reading file.", false); };
    reader.readAsText(file);
}

// UPDATED Clear Logic - Resets state AND triggers UI/Engine update
export function confirmClearSaveData() {
    try {
        localStorage.removeItem(config.SAVE_KEY);
        showStatusMessage("Local save data cleared.", true);
        // Reset Game State
        setGridData(new Map()); setCamPos(0, 0); setZoomLevel(1.0);
        selectTile(config.DEFAULT_TILE); // Resets tile & layer
        selectSize(config.DEFAULT_SIZE); // Resets size & UI
        // selectLayer redundant due to selectTile
        setCurrentTool('build');
        undoStack = []; redoStack = []; updateUndoRedoButtons();
        // Signal state change for redraw etc.
        window.dispatchEvent(new Event('stateLoaded'));
    } catch (error) {
        console.error("Error clearing save data:", error);
        showStatusMessage("Error clearing save data.", false);
    }
}
