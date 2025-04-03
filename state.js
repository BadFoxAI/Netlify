import * as config from './config.js';
import { showStatusMessage, updateUndoRedoButtons, selectTile } from './ui.js'; // Import necessary UI functions

// --- Game State Variables ---
export let camX = 0;
export let camY = 0;
export let zoomLevel = 1.0;
export let gridData = new Map(); // key="x,y", value=tile_char
export let selectedTile = config.DEFAULT_TILE; // Use config for default
export let currentTool = 'build';
export let undoStack = [];
export let redoStack = [];

// --- State Modifiers (Exported for use by other modules) ---
export function setCamPos(x, y) { camX = x; camY = y; }
export function setZoomLevel(level) { zoomLevel = level; }
export function setGridData(dataMap) { gridData = dataMap; }
export function setSelectedTile(tile) { selectedTile = tile; }
export function setCurrentTool(tool) { currentTool = tool; }

// --- Undo/Redo Logic ---
export function performAction(type, key, oldTile, newTile) {
    // Apply the change
    if (newTile === null) {
        gridData.delete(key);
    } else {
        gridData.set(key, newTile);
    }

    // Add to undo stack
    undoStack.push({ type, key, oldTile, newTile });
    if (undoStack.length > config.MAX_UNDO_STEPS) {
        undoStack.shift();
    }
    redoStack = []; // Clear redo stack

    updateUndoRedoButtons(); // Update UI
    saveGameToLocal();     // Autosave
}

export function undo() {
    if (undoStack.length === 0) return;
    const action = undoStack.pop();
    const { key, oldTile } = action;

    // Reverse the action
    if (oldTile === null) { gridData.delete(key); }
    else { gridData.set(key, oldTile); }

    redoStack.push(action); // Push onto redo stack
    updateUndoRedoButtons();
    saveGameToLocal();
}

export function redo() {
    if (redoStack.length === 0) return;
    const action = redoStack.pop();
    const { key, newTile } = action;

    // Re-apply the original action
    if (newTile === null) { gridData.delete(key); }
    else { gridData.set(key, newTile); }

    undoStack.push(action); // Push back onto undo stack
    updateUndoRedoButtons();
    saveGameToLocal();
}

// --- Save/Load Logic ---
export function saveGameToLocal() {
    try {
        const gridArray = Array.from(gridData.entries());
        const saveData = {
            version: 4,
            grid: gridArray,
            camera: { x: camX, y: camY },
            zoom: zoomLevel,
            selected: selectedTile
        };
        localStorage.setItem(config.SAVE_KEY, JSON.stringify(saveData));
        // console.log("Autosaved to localStorage");
    } catch (error) {
        console.error("Error saving game to localStorage:", error);
        showStatusMessage("Error autosaving!", false);
    }
}

export function loadGameFromLocal() {
    const savedString = localStorage.getItem(config.SAVE_KEY);
    if (!savedString) {
        showStatusMessage("No local save data found.", false);
        gridData = new Map(); camX = 0; camY = 0; zoomLevel = 1.0;
        selectTile(config.DEFAULT_TILE); // Use UI function to update selection
        undoStack = []; redoStack = []; updateUndoRedoButtons();
        return false;
    }
    try {
        const saveData = JSON.parse(savedString);
        if (!saveData.version || saveData.version < 4) {
             console.warn("Loading older/invalid save format.");
             // Potential migration logic needed
        }

        setGridData(new Map(saveData.grid || []));
        setCamPos(saveData.camera?.x || 0, saveData.camera?.y || 0);
        setZoomLevel(saveData.zoom || 1.0);
        selectTile(saveData.selected || config.DEFAULT_TILE); // Use UI func

        showStatusMessage("Game Loaded from Local Storage!", true);
        undoStack = []; redoStack = []; updateUndoRedoButtons(); // Clear undo/redo on load
        return true;
    } catch (error) {
        console.error("Error loading game from localStorage:", error);
        showStatusMessage("Error loading local save.", false);
        setGridData(new Map()); setCamPos(0, 0); setZoomLevel(1.0);
        selectTile(config.DEFAULT_TILE);
        undoStack = []; redoStack = []; updateUndoRedoButtons();
        return false;
    }
}

export function saveGameToFile() {
     try {
        const gridArray = Array.from(gridData.entries());
        const saveData = {
            version: 4,
            description: "SimEmoji Save File",
            grid: gridArray,
            camera: { x: camX, y: camY },
            zoom: zoomLevel,
            selected: selectedTile
        };
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
        saveGameToLocal(); // Keep local save in sync
    } catch (error) {
        console.error("Error saving game to file:", error);
        showStatusMessage("Error saving to file.", false);
    }
}

export function loadGameFromFile(file) { // Takes file object directly
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const jsonString = e.target.result;
            const saveData = JSON.parse(jsonString);

            if (!saveData.grid || !saveData.camera || saveData.version !== 4) {
                 throw new Error("Invalid or incompatible save file format.");
            }

            setGridData(new Map(saveData.grid));
            setCamPos(saveData.camera.x || 0, saveData.camera.y || 0);
            setZoomLevel(saveData.zoom || 1.0);
            selectTile(saveData.selected || config.DEFAULT_TILE);

            showStatusMessage(`Loaded "${file.name}"!`, true);
            undoStack = []; redoStack = []; updateUndoRedoButtons();
            saveGameToLocal(); // Update local storage with the loaded state

            // Need to signal main engine to update grid size and clamp camera
            // This is slightly awkward. We could pass callback functions,
            // or have the main engine poll a "needsUpdate" flag,
            // or dispatch a custom event. Let's use a simple flag for now.
            window.dispatchEvent(new Event('stateLoaded'));


        } catch (error) {
            console.error("Error loading game from file:", error);
            showStatusMessage(`Error loading file: ${error.message}`, false);
        }
    };
    reader.onerror = (e) => {
        console.error("FileReader error:", e);
        showStatusMessage("Error reading file.", false);
    };
    reader.readAsText(file);
}


export function confirmClearSaveData() { // Moved from ui.js as it modifies localStorage
    try {
        localStorage.removeItem(config.SAVE_KEY);
        showStatusMessage("Local save data cleared.", true);
        // Note: Doesn't reset the current game state automatically
    } catch (error) {
        console.error("Error clearing save data:", error);
        showStatusMessage("Error clearing save data.", false);
    }
}
