import * as config from './config.js';
import { showStatusMessage, updateUndoRedoButtons, selectTile, updateSizeUI } from './ui.js'; // Import more UI functions

// --- Game State Variables ---
export let camX = 0;
export let camY = 0;
export let zoomLevel = 1.0;
// gridData now stores EITHER:
// - A simple string (like '🟩') for single basic tiles
// - OR an object: { tile: '🏠', size: 2, isOrigin: true } for the top-left of a multi-tile object
// - OR an object: { originX: 10, originY: 10, isOrigin: false } for other parts of a multi-tile object
export let gridData = new Map();
export let selectedTile = config.DEFAULT_TILE;
export let selectedSize = config.DEFAULT_SIZE; // Added selected size state
export let currentTool = 'build';
export let undoStack = [];
export let redoStack = [];

// --- State Modifiers ---
export function setCamPos(x, y) { camX = x; camY = y; }
export function setZoomLevel(level) { zoomLevel = level; }
export function setGridData(dataMap) { gridData = dataMap; }
export function setSelectedTile(tile) { selectedTile = tile; }
export function setSelectedSize(size) { selectedSize = size; } // Added size setter
export function setCurrentTool(tool) { currentTool = tool; }

// --- Helper ---
// Gets the data for a specific cell, resolving multi-tile origins if necessary
export function getEffectiveTileData(gx, gy) {
    const key = `${gx},${gy}`;
    const data = gridData.get(key);
    if (typeof data === 'object' && data !== null && !data.isOrigin) {
        // It's part of a multi-tile object, find the origin
        const originKey = `${data.originX},${data.originY}`;
        return gridData.get(originKey) || null; // Return origin data or null if origin missing
    }
    return data; // Return the data directly (string or origin object or null)
}


// --- Undo/Redo Logic (Rewritten for Multi-Tile) ---
export function performAction(actionData) {
    // actionData = { type: 'place'/'bulldoze', cells: [ { key, oldData, newData }, ... ] }

    // Apply changes
    actionData.cells.forEach(({ key, newData }) => {
        if (newData === null) {
            gridData.delete(key);
        } else {
            gridData.set(key, newData);
        }
    });

    // Add reversed action info to undo stack
    undoStack.push(actionData); // Store the whole multi-cell action
    if (undoStack.length > config.MAX_UNDO_STEPS) {
        undoStack.shift();
    }
    redoStack = []; // Clear redo stack

    updateUndoRedoButtons();
    saveGameToLocal();
}

export function undo() {
    if (undoStack.length === 0) return;
    const actionData = undoStack.pop();

    // Reverse the action by applying the *old* data
    actionData.cells.forEach(({ key, oldData }) => {
        if (oldData === null) {
            gridData.delete(key);
        } else {
            gridData.set(key, oldData);
        }
    });

    redoStack.push(actionData); // Push onto redo stack
    updateUndoRedoButtons();
    saveGameToLocal();
}

export function redo() {
    if (redoStack.length === 0) return;
    const actionData = redoStack.pop();

    // Re-apply the action by applying the *new* data
    actionData.cells.forEach(({ key, newData }) => {
        if (newData === null) {
            gridData.delete(key);
        } else {
            gridData.set(key, newData);
        }
    });

    undoStack.push(actionData); // Push back onto undo stack
    updateUndoRedoButtons();
    saveGameToLocal();
}

// --- Save/Load Logic (Updated format) ---
export function saveGameToLocal() {
    try {
        // Convert Map to array including object data correctly
        const gridArray = Array.from(gridData.entries());
        const saveData = {
            version: 5, // Increment version for new format
            grid: gridArray,
            camera: { x: camX, y: camY },
            zoom: zoomLevel,
            selected: selectedTile,
            selectedSize: selectedSize // Save selected size
        };
        localStorage.setItem(config.SAVE_KEY, JSON.stringify(saveData));
    } catch (error) {
        console.error("Error saving game to localStorage:", error);
        showStatusMessage("Error autosaving!", false);
    }
}

export function loadGameFromLocal() {
    const savedString = localStorage.getItem(config.SAVE_KEY);
    if (!savedString) {
        showStatusMessage("No local save data found.", false);
        gridData = new Map(); camX = 0; camY = 0; zoomLevel = 1.0; selectedSize = config.DEFAULT_SIZE;
        selectTile(config.DEFAULT_TILE); // Use UI function
        updateSizeUI(); // Update size button highlight
        undoStack = []; redoStack = []; updateUndoRedoButtons();
        return false;
    }
    try {
        const saveData = JSON.parse(savedString);
        // Version check
        if (!saveData.version || saveData.version < 5) {
             console.warn("Loading older save format. Resetting grid.");
             // Simplest approach: reset grid if format is too old
             gridData = new Map();
             camX = 0; camY = 0; zoomLevel = 1.0; selectedSize = config.DEFAULT_SIZE;
        } else {
            setGridData(new Map(saveData.grid || []));
            setCamPos(saveData.camera?.x || 0, saveData.camera?.y || 0);
            setZoomLevel(saveData.zoom || 1.0);
            setSelectedSize(saveData.selectedSize || config.DEFAULT_SIZE); // Load size
        }

        // Load selected tile *after* potential reset or loading grid
        selectTile(saveData.selected || config.DEFAULT_TILE);
        updateSizeUI(); // Update size button highlight

        showStatusMessage("Game Loaded from Local Storage!", true);
        undoStack = []; redoStack = []; updateUndoRedoButtons();
        return true;
    } catch (error) {
        console.error("Error loading game from localStorage:", error);
        showStatusMessage("Error loading local save.", false);
        gridData = new Map(); camX = 0; camY = 0; zoomLevel = 1.0; selectedSize = config.DEFAULT_SIZE;
        selectTile(config.DEFAULT_TILE);
        updateSizeUI();
        undoStack = []; redoStack = []; updateUndoRedoButtons();
        return false;
    }
}

export function saveGameToFile() {
     try {
        const gridArray = Array.from(gridData.entries());
        const saveData = {
            version: 5,
            description: "SimEmoji Save File",
            grid: gridArray,
            camera: { x: camX, y: camY },
            zoom: zoomLevel,
            selected: selectedTile,
            selectedSize: selectedSize // Save size
        };
        // Rest of save logic... (unchanged from previous version)
        const jsonString = JSON.stringify(saveData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `simemoji_save_${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showStatusMessage("Game Saved to File!", true);
        saveGameToLocal();
    } catch (error) /* ... unchanged ... */ {
        console.error("Error saving game to file:", error);
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

            // Stricter format check for version 5
            if (!saveData.grid || !saveData.camera || saveData.version !== 5) {
                 throw new Error("Invalid or incompatible save file format (v5 required).");
            }

            setGridData(new Map(saveData.grid));
            setCamPos(saveData.camera.x || 0, saveData.camera.y || 0);
            setZoomLevel(saveData.zoom || 1.0);
            setSelectedSize(saveData.selectedSize || config.DEFAULT_SIZE); // Load size
            selectTile(saveData.selected || config.DEFAULT_TILE); // Load tile

            showStatusMessage(`Loaded "${file.name}"!`, true);
            undoStack = []; redoStack = []; updateUndoRedoButtons();
            saveGameToLocal(); // Update local storage

            // Signal main engine to update derived state
            window.dispatchEvent(new Event('stateLoaded'));

        } catch (error) /* ... unchanged ... */ {
            console.error("Error loading game from file:", error);
            showStatusMessage(`Error loading file: ${error.message}`, false);
        }
    };
    reader.onerror = (e) => { /* ... unchanged ... */
        console.error("FileReader error:", e);
        showStatusMessage("Error reading file.", false);
    };
    reader.readAsText(file);
}

export function confirmClearSaveData() { /* ... Unchanged ... */ }
