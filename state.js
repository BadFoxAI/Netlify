import * as config from './config.js';
// Import updateLayerUI as well
import { showStatusMessage, updateUndoRedoButtons, selectTile, updateSizeUI, updateLayerUI } from './ui.js';

// --- Game State Variables ---
export let camX = 0;
export let camY = 0;
export let zoomLevel = 1.0;
// Grid Data Structure:
// string -> Simple tile on default layer (or layer 0 if loaded from old save)
// { tile, size, layer, isOrigin: true } -> Multi-tile origin
// { originX, originY, layer, isOrigin: false } -> Multi-tile part
export let gridData = new Map();
export let selectedTile = config.DEFAULT_TILE;
export let selectedSize = config.DEFAULT_SIZE;
export let selectedLayer = config.DEFAULT_LAYER; // Added layer state
export let currentTool = 'build';
export let undoStack = [];
export let redoStack = [];

// --- State Modifiers ---
export function setCamPos(x, y) { camX = x; camY = y; }
export function setZoomLevel(level) { zoomLevel = level; }
export function setGridData(dataMap) { gridData = dataMap; }
export function setSelectedTile(tile) { selectedTile = tile; }
export function setSelectedSize(size) { // Clamp size just in case
     selectedSize = Math.max(1, Math.min(size, config.MAX_BUILD_SIZE));
}
export function setSelectedLayer(layer) { // Clamp layer
    selectedLayer = Math.max(config.MIN_LAYER, Math.min(layer, config.MAX_LAYER));
}
export function setCurrentTool(tool) { currentTool = tool; }

// --- Helper ---
export function getEffectiveTileData(gx, gy) {
    const key = `${gx},${gy}`;
    const data = gridData.get(key);
    if (typeof data === 'object' && data !== null && !data.isOrigin) {
        const originKey = `${data.originX},${data.originY}`;
        return gridData.get(originKey) || null;
    }
    return data;
}

// --- Undo/Redo Logic ---
export function performAction(actionData) {
    actionData.cells.forEach(({ key, newData }) => {
        if (newData === null) { gridData.delete(key); }
        else { gridData.set(key, newData); }
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
    actionData.cells.forEach(({ key, oldData }) => {
        if (oldData === null) { gridData.delete(key); }
        else { gridData.set(key, oldData); }
    });
    redoStack.push(actionData);
    updateUndoRedoButtons();
    saveGameToLocal();
}

export function redo() {
    if (redoStack.length === 0) return;
    const actionData = redoStack.pop();
    actionData.cells.forEach(({ key, newData }) => {
        if (newData === null) { gridData.delete(key); }
        else { gridData.set(key, newData); }
    });
    undoStack.push(actionData);
    updateUndoRedoButtons();
    saveGameToLocal();
}

// --- Save/Load Logic (Updated format for layers) ---
export function saveGameToLocal() {
    try {
        const gridArray = Array.from(gridData.entries());
        const saveData = {
            version: 6, // Increment version
            grid: gridArray,
            camera: { x: camX, y: camY },
            zoom: zoomLevel,
            selected: selectedTile,
            selectedSize: selectedSize,
            selectedLayer: selectedLayer // Save selected layer
        };
        localStorage.setItem(config.SAVE_KEY, JSON.stringify(saveData));
    } catch (error) { /* ... unchanged error handling ... */
        console.error("Error saving game to localStorage:", error);
        showStatusMessage("Error autosaving!", false);
    }
}

export function loadGameFromLocal() {
    const savedString = localStorage.getItem(config.SAVE_KEY);
    let loadedSuccessfully = false;
    if (savedString) {
        try {
            const saveData = JSON.parse(savedString);
            // Basic version check - adapt as needed for migration
            if (!saveData.version || saveData.version < 6) {
                 console.warn("Loading older save format. Layers may be missing or default.");
                 // Attempt to load what we can, assign default layer later
                 setGridData(new Map(saveData.grid || [])); // Load grid
                 // Assign default layers to loaded objects that lack them
                 gridData.forEach((value, key) => {
                     if (typeof value === 'object' && value !== null && value.layer === undefined) {
                         value.layer = config.DEFAULT_LAYER;
                         gridData.set(key, value); // Update the map entry
                     }
                     // Simple strings implicitly use default layer during rendering
                 });
            } else {
                 setGridData(new Map(saveData.grid || []));
            }

            setCamPos(saveData.camera?.x || 0, saveData.camera?.y || 0);
            setZoomLevel(saveData.zoom || 1.0);
            setSelectedSize(saveData.selectedSize || config.DEFAULT_SIZE);
            setSelectedLayer(saveData.selectedLayer || config.DEFAULT_LAYER); // Load layer
            selectTile(saveData.selected || config.DEFAULT_TILE); // Update selected tile state & UI

            showStatusMessage("Game Loaded from Local Storage!", true);
            loadedSuccessfully = true;
        } catch (error) {
            console.error("Error loading game from localStorage:", error);
            showStatusMessage("Error loading local save.", false);
        }
    }

    if (!loadedSuccessfully) {
        // Reset state if load failed or no save exists
        gridData = new Map(); camX = 0; camY = 0; zoomLevel = 1.0;
        selectedSize = config.DEFAULT_SIZE; selectedLayer = config.DEFAULT_LAYER;
        selectTile(config.DEFAULT_TILE);
        if (!savedString) showStatusMessage("No local save data found.", false); // Only show if no data existed
    }

    // Always update UI and clear history after attempting load
    updateSizeUI();
    updateLayerUI();
    undoStack = []; redoStack = []; updateUndoRedoButtons();
    return loadedSuccessfully;
}


export function saveGameToFile() {
     try {
        const gridArray = Array.from(gridData.entries());
        const saveData = {
            version: 6,
            description: "SimEmoji Save File",
            grid: gridArray,
            camera: { x: camX, y: camY },
            zoom: zoomLevel,
            selected: selectedTile,
            selectedSize: selectedSize,
            selectedLayer: selectedLayer // Save layer
        };
        // Rest of save logic... (unchanged)
        const jsonString = JSON.stringify(saveData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `simemoji_save_${Date.now()}.json`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
        showStatusMessage("Game Saved to File!", true); saveGameToLocal();
    } catch (error) /* ... unchanged ... */ {
        console.error("Error saving game to file:", error); showStatusMessage("Error saving to file.", false);
    }
}

export function loadGameFromFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const jsonString = e.target.result;
            const saveData = JSON.parse(jsonString);

            if (!saveData.grid || !saveData.camera || saveData.version !== 6) {
                 throw new Error("Invalid or incompatible save file format (v6 required).");
            }

            setGridData(new Map(saveData.grid));
            setCamPos(saveData.camera.x || 0, saveData.camera.y || 0);
            setZoomLevel(saveData.zoom || 1.0);
            setSelectedSize(saveData.selectedSize || config.DEFAULT_SIZE);
            setSelectedLayer(saveData.selectedLayer || config.DEFAULT_LAYER); // Load layer
            selectTile(saveData.selected || config.DEFAULT_TILE); // Load tile

            showStatusMessage(`Loaded "${file.name}"!`, true);
            undoStack = []; redoStack = []; updateUndoRedoButtons();
            saveGameToLocal(); // Update local storage

            // Signal main engine
            window.dispatchEvent(new Event('stateLoaded'));

        } catch (error) /* ... unchanged ... */ {
            console.error("Error loading game from file:", error); showStatusMessage(`Error loading file: ${error.message}`, false);
        }
    };
    reader.onerror = (e) => { /* ... unchanged ... */ };
    reader.readAsText(file);
}

export function confirmClearSaveData() { /* ... Unchanged ... */
    try { localStorage.removeItem(config.SAVE_KEY); showStatusMessage("Local save data cleared.", true); }
    catch (error) { console.error("Error clearing save data:", error); showStatusMessage("Error clearing save data.", false); }
}
